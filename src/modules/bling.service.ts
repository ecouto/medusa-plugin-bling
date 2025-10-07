import type {
  IProductModuleService,
  Logger,
  ProductDTO,
  UpsertProductDTO,
  UpsertProductVariantDTO,
} from "@medusajs/types"
import type { Repository } from "typeorm"
import axios, { type AxiosInstance } from "axios"
import type { InventoryLocationMapping, SyncPreferences } from "../models/bling-config.entity"
import { BlingConfig } from "../models/bling-config.entity"

const BLING_CONFIG_ID = "bling_config";

type InjectedDependencies = {
  blingConfigRepository: Repository<BlingConfig>;
  logger: Logger;
  productModuleService?: IProductModuleService | undefined;
};

export type BlingSyncPreferencesInput = {
  products?:
    | {
        enabled?: boolean | undefined;
        import_images?: boolean | undefined;
        import_descriptions?: boolean | undefined;
        import_prices?: boolean | undefined;
      }
    | undefined;
  inventory?:
    | {
        enabled?: boolean | undefined;
        bidirectional?: boolean | undefined;
        locations?: InventoryLocationMapping[] | undefined;
      }
    | undefined;
  orders?:
    | {
        enabled?: boolean | undefined;
        send_to_bling?: boolean | undefined;
        receive_from_bling?: boolean | undefined;
        generate_nf?: boolean | undefined;
      }
    | undefined;
};

type UpdateBlingConfigInput = {
  clientId?: string | null;
  clientSecret?: string | null;
  webhookSecret?: string | null;
  syncPreferences?: BlingSyncPreferencesInput | undefined;
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
  warehouse_id: string | null
  quantity: number | null
}

export interface BlingProductVariantSnapshot {
  external_id: string | null
  sku: string | null
  barcode: string | null
  price: number | null
  currency: string | null
  weight_kg: number | null
  depth_cm: number | null
  height_cm: number | null
  width_cm: number | null
  stock: BlingProductStockSnapshot[]
}

export interface BlingProductSnapshot {
  external_id: string
  name: string
  description?: string
  price?: number | null
  currency?: string | null
  sku?: string | null
  images: string[]
  stock: BlingProductStockSnapshot[]
  variants: BlingProductVariantSnapshot[]
  raw: unknown
}

class BlingService {
  private readonly logger: Logger;
  private readonly blingConfigRepository: Repository<BlingConfig>;
  private readonly productModuleService: IProductModuleService | undefined;

  private apiBaseUrl: string;
  private oauthUrl: string;

  constructor(dependencies: InjectedDependencies) {
    this.logger = dependencies.logger;
    this.blingConfigRepository = dependencies.blingConfigRepository;
    this.productModuleService = dependencies.productModuleService;

    this.apiBaseUrl = "https://api.bling.com.br/Api/v3";
    this.oauthUrl = "https://www.bling.com.br/Api/v3/oauth";
  }

  async getBlingConfig(): Promise<BlingConfig | null> {
    const config = await this.blingConfigRepository.findOne({ where: { id: BLING_CONFIG_ID } });
    if (config) {
      config.sync_preferences = this.mergePreferences(
        {},
        config.sync_preferences ?? undefined
      );
    }
    return config;
  }

  async saveBlingConfig(data: UpdateBlingConfigInput): Promise<BlingConfig> {
    let config = await this.getBlingConfig();
    if (!config) {
      config = this.blingConfigRepository.create({ id: BLING_CONFIG_ID });
    }

    if (data.clientId !== undefined) {
      const trimmed = data.clientId?.trim() ?? null;
      config.client_id = trimmed && trimmed.length > 0 ? trimmed : null;
    }

    if (data.clientSecret !== undefined) {
      const trimmed = data.clientSecret?.trim() ?? null;
      config.client_secret = trimmed && trimmed.length > 0 ? trimmed : null;
    }

    if (data.webhookSecret !== undefined) {
      const trimmed = data.webhookSecret?.trim() ?? null;
      config.webhook_secret = trimmed && trimmed.length > 0 ? trimmed : null;
    }

    if (data.syncPreferences !== undefined) {
      config.sync_preferences = this.mergePreferences(
        data.syncPreferences,
        config.sync_preferences ?? undefined
      );
    } else if (!config.sync_preferences) {
      config.sync_preferences = this.mergePreferences();
    }

    return await this.blingConfigRepository.save(config);
  }

  async getAuthorizationUrl(redirectUri: string): Promise<string> {
    const config = await this.getBlingConfig();
    if (!config?.client_id) {
      throw new Error("Bling Client ID is not configured. Please save credentials first.");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.client_id,
      redirect_uri: redirectUri,
      state: "medusa-bling-auth", // TODO: Use a random state
    });
    return `${this.oauthUrl}/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string): Promise<{ success: boolean }> {
    try {
      const config = await this.getBlingConfig();
      if (!config?.client_id || !config?.client_secret) {
        throw new Error("Bling Client ID or Secret not configured.");
      }

      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("code", code);

      const response = await axios.post(`${this.oauthUrl}/token`, params, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      config.access_token = access_token;
      config.refresh_token = refresh_token;
      config.expires_in = expires_in;
      config.token_updated_at = new Date();

      await this.blingConfigRepository.save(config);
      this.logger.info("Bling OAuth token saved successfully.");
      return { success: true };
    } catch (error: unknown) {
      this.logger.error("Bling OAuth callback failed:", (error as any).response?.data || (error as any).message);
      return { success: false };
    }
  }

  public async getAccessToken(): Promise<string> {
    const config = await this.getBlingConfig();
    if (!config?.access_token || !config.token_updated_at || config.expires_in === null) {
      throw new Error("Bling access token not found or invalid. Please authenticate.");
    }

    // Check if token is expired (with a 5-minute buffer)
    const now = new Date();
    const expiryTime = new Date(config.token_updated_at.getTime() + (config.expires_in - 300) * 1000);

    if (now < expiryTime) {
      return config.access_token;
    }

    // Token is expired, refresh it
    this.logger.info("Bling access token expired, refreshing...");
    try {
      if (!config?.client_id || !config?.client_secret || !config?.refresh_token) {
        throw new Error("Missing Bling credentials or refresh token for renewal.");
      }

      const params = new URLSearchParams();
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", config.refresh_token);

      const response = await axios.post(`${this.oauthUrl}/token`, params, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;
      
      config.access_token = access_token;
      config.refresh_token = refresh_token;
      config.expires_in = expires_in;
      config.token_updated_at = new Date();

      await this.blingConfigRepository.save(config);
      this.logger.info("Bling access token refreshed and saved successfully.");
      return access_token;
    } catch (error: unknown) {
      this.logger.error("Failed to refresh Bling access token:", (error as any).response?.data || (error as any).message);
      throw new Error("Failed to refresh Bling token.");
    }
  }

  async getProductsAndStock(): Promise<BlingProductSnapshot[]> {
    try {
      const config = await this.getBlingConfig();
      const preferences = this.mergePreferences(
        {},
        config?.sync_preferences ?? undefined
      );
      if (!preferences.products.enabled) {
        this.logger.info("Product synchronization is disabled via preferences.");
        return [];
      }

      const accessToken = await this.getAccessToken();
      const response = await axios.get(`${this.apiBaseUrl}/produtos`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      const rawProducts = Array.isArray(response.data?.data) ? response.data.data : [];
      const normalized = rawProducts.map((product: unknown) =>
        this.normalizeProductSnapshot(product, preferences)
      );
      this.logger.info(`Successfully fetched ${normalized.length} products from Bling.`);
      return normalized;
    } catch (error: unknown) {
      this.logger.error("Failed to fetch products from Bling:", (error as any).response?.data || (error as any).message);
      return [];
    }
  }

  getDefaultPreferences(): SyncPreferences {
    return this.mergePreferences();
  }
 
  async syncProductsToMedusa(): Promise<ProductSyncResult> {
    const config = await this.getBlingConfig();
    const preferences = this.mergePreferences({}, config?.sync_preferences ?? undefined);

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

    const persisted = await this.productModuleService.upsertProducts(
      upsertPayloads.map((payload) => payload.data)
    );

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

    if (warnings.length > 0) {
      warnings.forEach((warning) => this.logger.warn(warning));
    }

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
        external_id: productSnapshot.external_id ?? null,
        sku: productSnapshot.sku ?? productSnapshot.external_id ?? null,
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
      (acc, product) => acc + product.variants.length,
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
        import_descriptions: incoming.products?.import_descriptions ?? source.products.import_descriptions,
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
    source: any,
    preferences: SyncPreferences
  ): BlingProductSnapshot {
    const productData = source?.produto ?? source ?? {};
    const externalId: string =
      (productData?.id?.toString?.() ??
        productData?.codigo?.toString?.() ??
        productData?.sku?.toString?.() ??
        productData?.idProduto?.toString?.() ??
        "") || "";

    const shouldIncludeDescription = preferences.products.import_descriptions;
    const shouldIncludePrice = preferences.products.import_prices;
    const shouldIncludeImages = preferences.products.import_images;
    const shouldIncludeInventory = preferences.inventory.enabled;

    const images = shouldIncludeImages
      ? this.extractImageUrls(productData)
      : [];

    const stockSnapshots = shouldIncludeInventory
      ? this.extractStockSnapshots(productData)
      : [];

    const variantsSnapshots = this.extractVariantSnapshots(
      productData,
      preferences,
      shouldIncludeInventory
    );

    const snapshot: BlingProductSnapshot = {
      external_id: externalId,
      name: productData?.nome ?? productData?.descricao ?? "Produto sem nome",
      images,
      stock: stockSnapshots,
      variants: variantsSnapshots,
      raw: source,
    };

    if (shouldIncludeDescription && typeof productData?.descricao === "string") {
      snapshot.description = productData.descricao;
    }

    if (shouldIncludePrice) {
      snapshot.price = this.parseNumber(productData?.preco);
      snapshot.currency = productData?.moeda ?? "BRL";
    }

    const sku =
      productData?.codigo ??
      productData?.sku ??
      productData?.referencia ??
      null;
    if (sku) {
      snapshot.sku = String(sku);
    }

    return snapshot;
  }

  private extractVariantSnapshots(
    productData: any,
    preferences: SyncPreferences,
    includeInventory: boolean
  ): BlingProductVariantSnapshot[] {
    const variantsRaw = productData?.variacoes ?? productData?.variantes ?? [];
    if (!Array.isArray(variantsRaw) || variantsRaw.length === 0) {
      return [];
    }

    return variantsRaw.map((variant: any) => {
      const variantData = variant?.variacao ?? variant ?? {};
      const variantStock = includeInventory
        ? this.extractStockSnapshots(variantData)
        : [];

      return {
        external_id: variantData?.id?.toString?.() ?? null,
        sku: variantData?.sku ?? variantData?.codigo ?? null,
        barcode: variantData?.gtin ?? variantData?.ean ?? null,
        price: preferences.products.import_prices
          ? this.parseNumber(variantData?.preco ?? variantData?.precoVenda)
          : null,
        currency: preferences.products.import_prices
          ? variantData?.moeda ?? "BRL"
          : null,
        weight_kg: this.parseNumber(variantData?.pesoLiquido ?? variantData?.pesoBruto),
        depth_cm: this.parseNumber(variantData?.comprimento),
        height_cm: this.parseNumber(variantData?.altura),
        width_cm: this.parseNumber(variantData?.largura),
        stock: variantStock,
      };
    });
  }

  private extractImageUrls(productData: any): string[] {
    const imagesRaw = productData?.imagens ?? productData?.imagem ?? [];
    if (Array.isArray(imagesRaw)) {
      return imagesRaw
        .map((image) => {
          if (typeof image === "string") {
            return image;
          }
          const url = image?.link ?? image?.url ?? image?.path ?? null;
          return typeof url === "string" ? url : null;
        })
        .filter((url): url is string => Boolean(url));
    }
    if (typeof imagesRaw === "string") {
      return [imagesRaw];
    }
    if (imagesRaw && typeof imagesRaw === "object") {
      const single = imagesRaw?.link ?? imagesRaw?.url ?? null;
      return single ? [single] : [];
    }
    return [];
  }

  private extractStockSnapshots(data: any): BlingProductStockSnapshot[] {
    const stockEntries = data?.estoques ?? data?.depositos ?? data?.saldo ?? [];
    if (!Array.isArray(stockEntries)) {
      const normalized = this.normalizeStockEntry(stockEntries);
      return normalized ? [normalized] : [];
    }
    return stockEntries
      .map((entry) => this.normalizeStockEntry(entry))
      .filter((entry): entry is BlingProductStockSnapshot => Boolean(entry));
  }

  private normalizeStockEntry(entry: any): BlingProductStockSnapshot | null {
    if (!entry) {
      return null;
    }

    if (typeof entry === "number") {
      return {
        warehouse_id: null,
        quantity: this.parseNumber(entry),
      };
    }

    if (typeof entry === "object") {
      const warehouseId =
        entry?.idDeposito ??
        entry?.id_deposito ??
        entry?.deposito_id ??
        entry?.deposito?.id ??
        null;

      const quantity =
        entry?.saldo ??
        entry?.quantidade ??
        entry?.estoque ??
        entry?.disponivel ??
        entry?.saldoAtual ??
        entry?.saldoVirtual ??
        null;

      return {
        warehouse_id: warehouseId ? warehouseId.toString() : null,
        quantity: this.parseNumber(quantity),
      };
    }

    return null;
  }

  private parseNumber(value: unknown): number | null {
    if (typeof value === "number" && !Number.isNaN(value)) {
      return value;
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
}

export default BlingService;

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
