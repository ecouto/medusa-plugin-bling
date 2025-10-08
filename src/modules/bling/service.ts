import type { InternalModuleDeclaration } from "@medusajs/framework/types";
import { MedusaService } from "@medusajs/framework/utils";
import type {
  IProductModuleService,
  Logger,
  ProductDTO,
  UpsertProductDTO,
  UpsertProductVariantDTO,
} from "@medusajs/types";
import type { EntityRepository } from "@mikro-orm/core";
import type { SqlEntityManager } from "@mikro-orm/postgresql";
import axios from "axios";
import type { AxiosError, AxiosInstance } from "axios";
import { BlingConfig } from "../../models/bling-config.entity";
import type { InventoryLocationMapping, SyncPreferences } from "../../models/bling-config.entity";

const BLING_CONFIG_ID = "bling_config";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

type InjectedDependencies = {
  manager: SqlEntityManager;
  logger: Logger;
  productModuleService?: IProductModuleService;
};

export type BlingModuleOptions = {
  apiBaseUrl?: string;
  oauthBaseUrl?: string;
};

const DEFAULT_MODULE_OPTIONS: Required<BlingModuleOptions> = {
  apiBaseUrl: "https://api.bling.com.br/Api/v3",
  oauthBaseUrl: "https://www.bling.com.br/Api/v3/oauth",
};

export type BlingSyncPreferencesInput = {
  products?:
    | {
        enabled?: boolean;
        import_images?: boolean;
        import_descriptions?: boolean;
        import_prices?: boolean;
      }
    | undefined;
  inventory?:
    | {
        enabled?: boolean;
        bidirectional?: boolean;
        locations?: InventoryLocationMapping[];
      }
    | undefined;
  orders?:
    | {
        enabled?: boolean;
        send_to_bling?: boolean;
        receive_from_bling?: boolean;
        generate_nf?: boolean;
      }
    | undefined;
};

type UpdateBlingConfigInput = {
  clientId?: string | null;
  clientSecret?: string | null;
  webhookSecret?: string | null;
  syncPreferences?: BlingSyncPreferencesInput;
};

const DEFAULT_SYNC_PREFERENCES: SyncPreferences = {
  products: {
    enabled: true,
    import_images: true,
    import_descriptions: true,
    import_prices: true,
  },
  inventory: {
    enabled: true,
    bidirectional: false,
    locations: [],
  },
  orders: {
    enabled: true,
    send_to_bling: true,
    receive_from_bling: true,
    generate_nf: false,
  },
};

export interface BlingProductStockSnapshot {
  warehouse_id: string | null;
  quantity: number | null;
}

export interface BlingProductVariantSnapshot {
  external_id: string | null;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  currency: string | null;
  weight_kg: number | null;
  depth_cm: number | null;
  height_cm: number | null;
  width_cm: number | null;
  stock: BlingProductStockSnapshot[];
}

export interface BlingProductSnapshot {
  external_id: string;
  name: string;
  description?: string;
  price?: number | null;
  currency?: string | null;
  sku?: string | null;
  images: string[];
  stock: BlingProductStockSnapshot[];
  variants: BlingProductVariantSnapshot[];
  raw: JsonObject;
}

class BlingModuleService extends MedusaService({ BlingConfig }) {
  private readonly logger: Logger;
  private readonly configRepository: EntityRepository<BlingConfig>;
  private readonly productModuleService?: IProductModuleService;
  private readonly apiBaseUrl: string;
  private readonly oauthBaseUrl: string;

  constructor(
    { manager, logger, productModuleService }: InjectedDependencies,
    moduleDeclaration: InternalModuleDeclaration,
    options: BlingModuleOptions = {}
  ) {
    super({ manager, logger, productModuleService }, moduleDeclaration, options);

    this.logger = logger;
    if (productModuleService) {
      this.productModuleService = productModuleService;
    }
    this.configRepository = manager.getRepository(BlingConfig);

    const mergedOptions: Required<BlingModuleOptions> = {
      ...DEFAULT_MODULE_OPTIONS,
      ...options,
    };

    this.apiBaseUrl = mergedOptions.apiBaseUrl;
    this.oauthBaseUrl = mergedOptions.oauthBaseUrl;
  }

  async getBlingConfig(): Promise<BlingConfig | null> {
    const config = await this.configRepository.findOne({ id: BLING_CONFIG_ID });
    if (!config) {
      return null;
    }

    config.syncPreferences = this.mergePreferences({}, config.syncPreferences ?? undefined);

    return config;
  }

  async saveBlingConfig(data: UpdateBlingConfigInput): Promise<BlingConfig> {
    const existing = await this.configRepository.findOne({ id: BLING_CONFIG_ID });
    const config = existing ?? new BlingConfig();

    if (data.clientId !== undefined) {
      const sanitized = data.clientId?.trim() ?? null;
      config.clientId = sanitized && sanitized.length > 0 ? sanitized : null;
    }

    if (data.clientSecret !== undefined) {
      const sanitized = data.clientSecret?.trim() ?? null;
      config.clientSecret = sanitized && sanitized.length > 0 ? sanitized : null;
    }

    if (data.webhookSecret !== undefined) {
      const sanitized = data.webhookSecret?.trim() ?? null;
      config.webhookSecret = sanitized && sanitized.length > 0 ? sanitized : null;
    }

    if (data.syncPreferences !== undefined) {
      config.syncPreferences = this.mergePreferences(
        data.syncPreferences,
        config.syncPreferences ?? undefined
      );
    } else if (!config.syncPreferences) {
      config.syncPreferences = this.mergePreferences();
    }

    const entityManager = this.configRepository.getEntityManager();
    entityManager.persist(config);
    await entityManager.flush();

    return config;
  }

  async getAuthorizationUrl(redirectUri: string): Promise<string> {
    const config = await this.getBlingConfig();
    if (!config?.clientId) {
      throw new Error("Bling Client ID is not configured. Please save credentials first.");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: redirectUri,
      state: "medusa-bling-auth",
    });

    return `${this.oauthBaseUrl}/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string): Promise<{ success: boolean }> {
    try {
      const config = await this.getBlingConfig();
      if (!config?.clientId || !config?.clientSecret) {
        throw new Error("Bling Client ID or Secret not configured.");
      }

      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("code", code);

      const response = await axios.post(`${this.oauthBaseUrl}/token`, params, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
            "base64"
          )}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      config.accessToken = access_token;
      config.refreshToken = refresh_token;
      config.expiresIn = expires_in;
      config.tokenUpdatedAt = new Date();

      const entityManager = this.configRepository.getEntityManager();
      entityManager.persist(config);
      await entityManager.flush();

      this.logger.info("Bling OAuth token saved successfully.");
      return { success: true };
    } catch (error) {
      this.logger.error(`Bling OAuth callback failed: ${this.describeAxiosError(error)}`);
      return { success: false };
    }
  }

  async getAccessToken(): Promise<string> {
    const config = await this.getBlingConfig();
    if (!config?.accessToken || !config.tokenUpdatedAt || config.expiresIn === null) {
      throw new Error("Bling access token not found or invalid. Please authenticate.");
    }

    const now = new Date();
    const expiryTime = new Date(config.tokenUpdatedAt.getTime() + (config.expiresIn - 300) * 1000);

    if (now < expiryTime) {
      return config.accessToken;
    }

    this.logger.info("Bling access token expired, refreshing...");

    try {
      if (!config.clientId || !config.clientSecret || !config.refreshToken) {
        throw new Error("Missing Bling credentials or refresh token for renewal.");
      }

      const params = new URLSearchParams();
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", config.refreshToken);

      const response = await axios.post(`${this.oauthBaseUrl}/token`, params, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString(
            "base64"
          )}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      config.accessToken = access_token;
      config.refreshToken = refresh_token;
      config.expiresIn = expires_in;
      config.tokenUpdatedAt = new Date();

      const entityManager = this.configRepository.getEntityManager();
      entityManager.persist(config);
      await entityManager.flush();

      this.logger.info("Bling access token refreshed successfully.");
      return access_token;
    } catch (error) {
      this.logger.error(`Failed to refresh Bling access token: ${this.describeAxiosError(error)}`);
      throw new Error("Failed to refresh Bling token.");
    }
  }

  async getProductsAndStock(): Promise<BlingProductSnapshot[]> {
    const config = await this.getBlingConfig();
    const preferences = this.mergePreferences({}, config?.syncPreferences ?? undefined);

    if (!preferences.products.enabled) {
      this.logger.info("Product synchronization is disabled via preferences.");
      return [];
    }

    try {
      const accessToken = await this.getAccessToken();
      const response = await axios.get(`${this.apiBaseUrl}/produtos`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const rawProducts = Array.isArray(response.data?.data) ? response.data.data : [];

      const normalized = rawProducts.map((product: JsonValue) =>
        this.normalizeProductSnapshot(product, preferences)
      );
      this.logger.info(`Successfully fetched ${normalized.length} products from Bling.`);
      return normalized;
    } catch (error) {
      this.logger.error(`Failed to fetch products from Bling: ${this.describeAxiosError(error)}`);
      return [];
    }
  }

  getDefaultPreferences(): SyncPreferences {
    return this.mergePreferences();
  }

  async syncProductsToMedusa(): Promise<ProductSyncResult> {
    const config = await this.getBlingConfig();
    const preferences = this.mergePreferences({}, config?.syncPreferences ?? undefined);

    if (!preferences.products.enabled) {
      return {
        summary: this.buildSyncSummary([], 0, 0, 0),
        warnings: ["Sincronização de produtos está desativada nas preferências."],
      };
    }

    if (!this.productModuleService) {
      throw new Error(
        "Serviço de produtos do Medusa não encontrado. Verifique se o módulo `@medusajs/product` está habilitado."
      );
    }

    const snapshots = await this.getProductsAndStock();

    if (snapshots.length === 0) {
      return {
        summary: this.buildSyncSummary([], 0, 0, 0),
        warnings: [],
      };
    }

    const externalIds = snapshots
      .map((snapshot) => snapshot.external_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const existingProducts = externalIds.length
      ? await this.productModuleService.listProducts(
          { external_id: externalIds },
          { relations: ["variants"] }
        )
      : [];

    const existingByExternalId = new Map<string, ProductDTO>();
    for (const product of existingProducts) {
      if (product.external_id) {
        existingByExternalId.set(product.external_id, product);
      }
    }

    const upsertPayloads: Array<{
      data: UpsertProductDTO;
      mode: "create" | "update";
      snapshot: BlingProductSnapshot;
    }> = [];
    const warnings: string[] = [];

    for (const snapshot of snapshots) {
      if (!snapshot.external_id) {
        warnings.push(
          `Produto "${snapshot.name}" ignorado: identificador externo (external_id) ausente no Bling.`
        );
        continue;
      }

      const existing = existingByExternalId.get(snapshot.external_id);
      const upsert = this.buildProductUpsert(snapshot, existing);

      if (!upsert) {
        warnings.push(
          `Produto "${snapshot.name}" ignorado: não foi possível gerar payload de sincronização.`
        );
        continue;
      }

      upsertPayloads.push({
        data: upsert,
        mode: existing ? "update" : "create",
        snapshot,
      });
    }

    if (upsertPayloads.length === 0) {
      return {
        summary: this.buildSyncSummary(snapshots, 0, 0, snapshots.length),
        warnings,
      };
    }

    await this.productModuleService.upsertProducts(upsertPayloads.map((payload) => payload.data));

    let created = 0;
    let updated = 0;

    for (const payload of upsertPayloads) {
      if (payload.mode === "create") {
        created += 1;
      } else {
        updated += 1;
      }
    }

    const summary = this.buildSyncSummary(
      snapshots,
      created,
      updated,
      snapshots.length - upsertPayloads.length
    );

    this.logger.info(
      `Sincronização concluída: ${created} produtos criados, ${updated} atualizados, ${summary.total_products} processados.`
    );

    warnings.forEach((warning) => this.logger.warn(warning));

    return {
      summary,
      warnings,
    };
  }

  private buildProductUpsert(
    snapshot: BlingProductSnapshot,
    existing?: ProductDTO
  ): UpsertProductDTO | null {
    const variantsSnapshots =
      snapshot.variants.length > 0
        ? snapshot.variants
        : this.buildFallbackVariantSnapshots(snapshot);

    const upsertVariants: UpsertProductVariantDTO[] = [];

    for (const variant of variantsSnapshots) {
      const upsert = this.buildVariantUpsert(snapshot, variant, existing);
      if (upsert) {
        upsertVariants.push(upsert);
      }
    }

    if (upsertVariants.length === 0) {
      return null;
    }

    const upsert: UpsertProductDTO = {
      title: snapshot.name,
      description: snapshot.description ?? null,
      external_id: snapshot.external_id,
      status: existing?.status ?? "published",
      images: snapshot.images.map((url) => ({ url })),
      variants: upsertVariants,
      metadata: {
        bling_external_id: snapshot.external_id,
        bling_source: "bling",
      },
    };

    if (existing?.id) {
      upsert.id = existing.id;
    }

    if (snapshot.images.length > 0) {
      const thumbnail = snapshot.images[0];
      if (typeof thumbnail === "string" && thumbnail.length > 0) {
        upsert.thumbnail = thumbnail;
      }
    }

    return upsert;
  }

  private buildVariantUpsert(
    productSnapshot: BlingProductSnapshot,
    variantSnapshot: BlingProductVariantSnapshot,
    existing?: ProductDTO
  ): UpsertProductVariantDTO | null {
    const existingVariant = existing?.variants?.find((variant) => {
      if (variantSnapshot.sku && variant.sku) {
        return variant.sku === variantSnapshot.sku;
      }
      if (variantSnapshot.external_id && variant.id) {
        return variant.metadata?.bling_external_id === variantSnapshot.external_id;
      }
      return false;
    });

    const title =
      variantSnapshot.sku ??
      existingVariant?.title ??
      `${productSnapshot.name}${existingVariant ? "" : " - Bling"}`;

    const upsert: UpsertProductVariantDTO = {
      title,
      sku: variantSnapshot.sku ?? existingVariant?.sku ?? null,
      barcode: variantSnapshot.barcode ?? existingVariant?.barcode ?? null,
    };

    const metadata: Record<string, unknown> = {
      ...(existingVariant?.metadata ?? {}),
    };

    if (variantSnapshot.external_id) {
      metadata.bling_external_id = variantSnapshot.external_id;
    }

    if (Object.keys(metadata).length > 0) {
      upsert.metadata = metadata;
    }

    if (existingVariant?.id) {
      upsert.id = existingVariant.id;
    }

    return upsert;
  }

  private buildFallbackVariantSnapshots(
    productSnapshot: BlingProductSnapshot
  ): BlingProductVariantSnapshot[] {
    return [
      {
        external_id: productSnapshot.external_id,
        sku: productSnapshot.sku ?? productSnapshot.external_id,
        barcode: null,
        price: productSnapshot.price ?? null,
        currency: productSnapshot.currency ?? null,
        weight_kg: null,
        depth_cm: null,
        height_cm: null,
        width_cm: null,
        stock: productSnapshot.stock,
      },
    ];
  }

  private buildSyncSummary(
    snapshots: BlingProductSnapshot[],
    created: number,
    updated: number,
    skipped: number
  ): ProductSyncSummary {
    const totalVariants = snapshots.reduce(
      (accumulator, product) => accumulator + product.variants.length,
      0
    );

    const productsWithInventoryData = snapshots.filter((product) =>
      this.hasInventoryData(product)
    ).length;

    const preview = snapshots.slice(0, 5).map((product) => ({
      external_id: product.external_id,
      name: product.name,
      variants: product.variants.length,
      stock_entries: product.stock.length,
    }));

    return {
      total_products: snapshots.length,
      total_variants: totalVariants,
      products_with_inventory_data: productsWithInventoryData,
      created,
      updated,
      skipped,
      preview,
    };
  }

  private hasInventoryData(product: BlingProductSnapshot): boolean {
    if (product.stock.length > 0) {
      return true;
    }

    return product.variants.some((variant) => variant.stock.length > 0);
  }

  mergePreferences(
    incoming: BlingSyncPreferencesInput = {},
    current?: SyncPreferences
  ): SyncPreferences {
    const source = current ?? DEFAULT_SYNC_PREFERENCES;
    return {
      products: {
        enabled: incoming.products?.enabled ?? source.products.enabled,
        import_images: incoming.products?.import_images ?? source.products.import_images,
        import_descriptions:
          incoming.products?.import_descriptions ?? source.products.import_descriptions,
        import_prices: incoming.products?.import_prices ?? source.products.import_prices,
      },
      inventory: {
        enabled: incoming.inventory?.enabled ?? source.inventory.enabled,
        bidirectional: incoming.inventory?.bidirectional ?? source.inventory.bidirectional,
        locations: Array.isArray(incoming.inventory?.locations)
          ? incoming.inventory.locations.map((location) => ({ ...location }))
          : source.inventory.locations.map((location) => ({ ...location })),
      },
      orders: {
        enabled: incoming.orders?.enabled ?? source.orders.enabled,
        send_to_bling: incoming.orders?.send_to_bling ?? source.orders.send_to_bling,
        receive_from_bling: incoming.orders?.receive_from_bling ?? source.orders.receive_from_bling,
        generate_nf: incoming.orders?.generate_nf ?? source.orders.generate_nf,
      },
    };
  }

  private normalizeProductSnapshot(
    source: JsonValue,
    preferences: SyncPreferences
  ): BlingProductSnapshot {
    const productWrapper = this.toJsonObject(source);
    const productData = this.toJsonObject(
      this.isJsonObject(productWrapper.produto) ? productWrapper.produto : productWrapper
    );

    const externalId =
      this.toOptionalString(productData.id) ??
      this.toOptionalString(productData.codigo) ??
      this.toOptionalString(productData.sku) ??
      this.toOptionalString(productData.idProduto) ??
      "";

    const includeDescription = preferences.products.import_descriptions;
    const includePrice = preferences.products.import_prices;
    const includeImages = preferences.products.import_images;
    const includeInventory = preferences.inventory.enabled;

    const images = includeImages ? this.extractImageUrls(productData) : [];
    const stockSnapshots = includeInventory ? this.extractStockSnapshots(productData) : [];
    const variantsSnapshots = this.extractVariantSnapshots(
      productData,
      preferences,
      includeInventory
    );

    const snapshot: BlingProductSnapshot = {
      external_id: externalId,
      name:
        this.toOptionalString(productData.nome) ??
        this.toOptionalString(productData.descricao) ??
        "Produto sem nome",
      images,
      stock: stockSnapshots,
      variants: variantsSnapshots,
      raw: productData,
    };

    if (includeDescription) {
      const description = this.toOptionalString(productData.descricao);
      if (description) {
        snapshot.description = description;
      }
    }

    if (includePrice) {
      snapshot.price = this.parseNumber(productData.preco);
      snapshot.currency = this.toOptionalString(productData.moeda) ?? "BRL";
    }

    const sku =
      this.toOptionalString(productData.codigo) ??
      this.toOptionalString(productData.sku) ??
      this.toOptionalString(productData.referencia);
    if (sku) {
      snapshot.sku = sku;
    }

    return snapshot;
  }

  private extractVariantSnapshots(
    productData: JsonObject,
    preferences: SyncPreferences,
    includeInventory: boolean
  ): BlingProductVariantSnapshot[] {
    const rawVariants = this.toJsonArray(productData.variacoes ?? productData.variantes);
    if (rawVariants.length === 0) {
      return [];
    }

    return rawVariants.map((variant) => {
      const variantRoot = this.toJsonObject(variant);
      const variantData = this.toJsonObject(
        this.isJsonObject(variantRoot.variacao) ? variantRoot.variacao : variantRoot
      );
      const variantStock = includeInventory ? this.extractStockSnapshots(variantData) : [];

      return {
        external_id: this.toOptionalString(variantData.id),
        sku: this.toOptionalString(variantData.sku) ?? this.toOptionalString(variantData.codigo),
        barcode: this.toOptionalString(variantData.gtin) ?? this.toOptionalString(variantData.ean),
        price: preferences.products.import_prices
          ? this.parseNumber(variantData.preco ?? variantData.precoVenda)
          : null,
        currency: preferences.products.import_prices
          ? (this.toOptionalString(variantData.moeda) ?? "BRL")
          : null,
        weight_kg: this.parseNumber(variantData.pesoLiquido ?? variantData.pesoBruto),
        depth_cm: this.parseNumber(variantData.comprimento),
        height_cm: this.parseNumber(variantData.altura),
        width_cm: this.parseNumber(variantData.largura),
        stock: variantStock,
      };
    });
  }

  private extractImageUrls(productData: JsonObject): string[] {
    const imagesRaw = productData.imagens ?? productData.imagem;
    if (Array.isArray(imagesRaw)) {
      return imagesRaw
        .map((image) => {
          if (typeof image === "string") {
            return image;
          }
          const imageObject = this.toJsonObject(image);
          const url =
            this.toOptionalString(imageObject.link) ??
            this.toOptionalString(imageObject.url) ??
            this.toOptionalString(imageObject.path);
          return url;
        })
        .filter((url): url is string => Boolean(url));
    }

    if (typeof imagesRaw === "string") {
      return [imagesRaw];
    }

    if (this.isJsonObject(imagesRaw)) {
      const single = this.toOptionalString(imagesRaw.link) ?? this.toOptionalString(imagesRaw.url);
      return single ? [single] : [];
    }

    return [];
  }

  private extractStockSnapshots(data: JsonObject): BlingProductStockSnapshot[] {
    const rawEntries = data.estoques ?? data.depositos ?? data.saldo ?? null;

    if (!Array.isArray(rawEntries)) {
      const single = this.normalizeStockEntry(rawEntries);
      return single ? [single] : [];
    }

    return rawEntries
      .map((entry) => this.normalizeStockEntry(entry))
      .filter((entry): entry is BlingProductStockSnapshot => entry !== null);
  }

  private normalizeStockEntry(value: JsonValue | undefined): BlingProductStockSnapshot | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "number" || typeof value === "string") {
      return {
        warehouse_id: null,
        quantity: this.parseNumber(value),
      };
    }

    if (Array.isArray(value)) {
      return null;
    }

    const entry = this.toJsonObject(value);
    const warehouseId =
      this.toOptionalString(entry.idDeposito) ??
      this.toOptionalString(entry.id_deposito) ??
      this.toOptionalString(entry.deposito_id) ??
      this.toOptionalString(this.toJsonObject(entry.deposito).id) ??
      null;

    const quantity =
      this.parseNumber(entry.saldo) ??
      this.parseNumber(entry.quantidade) ??
      this.parseNumber(entry.estoque) ??
      this.parseNumber(entry.disponivel) ??
      this.parseNumber(entry.saldoAtual) ??
      this.parseNumber(entry.saldoVirtual) ??
      null;

    if (warehouseId === null && quantity === null) {
      return null;
    }

    return {
      warehouse_id: warehouseId,
      quantity,
    };
  }

  private parseNumber(value: JsonValue | undefined): number | null {
    if (typeof value === "number") {
      return Number.isNaN(value) ? null : value;
    }

    if (typeof value === "string") {
      const normalized = value.replace(/\./g, "").replace(",", ".");
      const parsed = Number.parseFloat(normalized);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  public async createAuthorizedClient(): Promise<AxiosInstance> {
    const accessToken = await this.getAccessToken();
    return axios.create({
      baseURL: this.apiBaseUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  private toJsonObject(value: JsonValue | undefined): JsonObject {
    if (this.isJsonObject(value)) {
      return value;
    }
    return {};
  }

  private toJsonArray(value: JsonValue | undefined): JsonValue[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (value === undefined || value === null) {
      return [];
    }
    return [value];
  }

  private isJsonObject(value: JsonValue | undefined): value is JsonObject {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private toOptionalString(value: JsonValue | undefined): string | null {
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number") {
      return value.toString();
    }
    return null;
  }

  private describeAxiosError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.data) {
        if (typeof axiosError.response.data === "string") {
          return axiosError.response.data;
        }
        return JSON.stringify(axiosError.response.data);
      }
      return axiosError.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}

export default BlingModuleService;

export interface ProductSyncSummary {
  total_products: number;
  total_variants: number;
  products_with_inventory_data: number;
  created: number;
  updated: number;
  skipped: number;
  preview: Array<{
    external_id: string;
    name: string;
    variants: number;
    stock_entries: number;
  }>;
}

export interface ProductSyncResult {
  summary: ProductSyncSummary;
  warnings: string[];
}
