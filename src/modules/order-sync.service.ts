import type { Logger, FindConfig, BigNumberValue } from "@medusajs/types";
import type {
  OrderAddressDTO,
  OrderDTO,
  OrderLineItemDTO,
  OrderShippingMethodDTO,
  OrderTransactionDTO,
} from "@medusajs/types/dist/order/common";
import type { IOrderModuleService } from "@medusajs/types/dist/order/service";
import axios, { type AxiosError } from "axios";
import type { BlingModuleService } from "./bling";
import type { SyncPreferences } from "../models/bling-config.entity";
import { isValidCPF, isValidCNPJ, sanitizeDocument } from "../utils/document-validation";

export type OrderSyncOptions = {
  generateNfe?: boolean;
  generateShippingLabel?: boolean;
};

export type OrderSyncSummary = {
  total_items: number;
  total_amount: number;
  freight_amount: number;
  bling_sale_id: string | null;
  synced_at: string;
};

export type OrderSyncResult = {
  summary: OrderSyncSummary;
  payload: BlingOrderPayload;
  response: Record<string, unknown> | null;
  warnings: string[];
};

type BlingOrderItemPayload = {
  codigo: string;
  descricao: string;
  quantidade: number;
  valor: number;
  desconto?: number;
};

type BlingOrderCustomerPayload = {
  nome: string;
  tipoPessoa: "F" | "J";
  cpf_cnpj: string;
  email?: string | null;
  fone?: string;
  endereco: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cep?: string;
  cidade?: string | null;
  uf?: string | null;
  ie_rg?: string | null;
};

type BlingOrderInstallmentPayload = {
  data: string;
  vlr: number;
  obs?: string;
};

type BlingOrderAddressPayload = {
  nome: string;
  endereco: string;
  numero: string;
  complemento?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string;
  bairro?: string | null;
};

type BlingOrderTransportPayload = {
  transportadora?: string | null;
  servico_correios?: string | null;
  tipo_frete?: string | null;
  dados_etiqueta?: BlingOrderAddressPayload;
};

type BlingOrderPayload = {
  numeroPedidoLoja: string;
  numero?: string | number;
  situacao?: string;
  data: string;
  cliente: BlingOrderCustomerPayload;
  itens: BlingOrderItemPayload[];
  vlr_frete?: number;
  vlr_desconto?: number;
  parcelas?: BlingOrderInstallmentPayload[];
  observacoes?: string | null;
  observacoesInternas?: string | null;
  total?: number;
  natureza_operacao?: string | null;
  gerar_nfe?: "S";
  gerar_etiqueta?: "S";
  transporte?: BlingOrderTransportPayload;
};

type InjectedDependencies = {
  logger: Logger;
  orderModuleService?: IOrderModuleService | undefined;
  blingService: BlingModuleService;
};

export default class OrderSyncService {
  private readonly logger: Logger;
  private readonly orderModuleService: IOrderModuleService | undefined;
  private readonly blingService: BlingModuleService;

  constructor(deps: InjectedDependencies) {
    this.logger = deps.logger;
    this.orderModuleService = deps.orderModuleService;
    this.blingService = deps.blingService;
  }

  async syncOrder(orderId: string, options: OrderSyncOptions = {}): Promise<OrderSyncResult> {
    if (!this.orderModuleService) {
      throw new Error("Serviço de pedidos do Medusa não está disponível no container.");
    }

    const order = await this.orderModuleService.retrieveOrder(
      orderId,
      this.buildOrderFetchConfig()
    );
    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado no Medusa.`);
    }

    const config = await this.blingService.getBlingConfig();
    const preferences = this.blingService.mergePreferences(
      {},
      config?.syncPreferences ?? undefined
    );

    if (!preferences.orders.enabled || !preferences.orders.send_to_bling) {
      throw new Error("Sincronização de pedidos com o Bling está desativada nas preferências.");
    }

    const warnings: string[] = [];

    const shippingAddress = order.shipping_address ?? order.billing_address;
    if (!shippingAddress) {
      throw new Error("Pedido sem endereço. Endereço de entrega ou faturamento é obrigatório.");
    }

    const document = this.extractDocument(order, shippingAddress);
    if (!document) {
      throw new Error("CPF ou CNPJ obrigatório para sincronizar o pedido com o Bling.");
    }

    const documentDigits = sanitizeDocument(document);
    const isCpf = documentDigits.length === 11;
    if (isCpf && !isValidCPF(documentDigits)) {
      throw new Error("CPF informado é inválido.");
    }
    if (!isCpf && !isValidCNPJ(documentDigits)) {
      throw new Error("CNPJ informado é inválido.");
    }

    const itemsPayload = this.buildItemsPayload(order.items ?? [], warnings);
    if (itemsPayload.length === 0) {
      throw new Error("Nenhum item do pedido possui SKU ou ID associado no Bling.");
    }

    const payload = this.buildPayload({
      order,
      shippingAddress,
      document: documentDigits,
      isCpf,
      itemsPayload,
      preferences,
      options,
      warnings,
    });

    try {
      const client = await this.blingService.createAuthorizedClient();
      const response = await client.post("/vendas", payload);
      const responseData = (response.data ?? {}) as Record<string, unknown>;
      const blingSaleId = this.extractSaleId(responseData);

      await this.persistOrderMetadata(order, blingSaleId, payload, responseData, warnings);

      const summary: OrderSyncSummary = {
        total_items: itemsPayload.length,
        total_amount: payload.total ?? this.safeNumber(order.total),
        freight_amount: payload.vlr_frete ?? this.safeNumber(order.shipping_total),
        bling_sale_id: blingSaleId,
        synced_at: new Date().toISOString(),
      };

      if (preferences.inventory.enabled && preferences.inventory.bidirectional) {
        try {
          await this.blingService.syncProductsToMedusa();
        } catch (error) {
          warnings.push(
            `Falha ao atualizar o estoque no Medusa após enviar o pedido: ${
              (error as Error).message ?? error
            }`
          );
        }
      }

      this.logger.info(
        `Pedido ${order.id} sincronizado com sucesso no Bling${blingSaleId ? ` (ID ${blingSaleId})` : ""}.`
      );

      return {
        summary,
        payload,
        response: responseData,
        warnings,
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const details = this.serializeError(axiosError);
      const metaPieces: string[] = [];
      if (typeof details.status === "number") {
        metaPieces.push(`status ${details.status}`);
      }
      if (details.response) {
        metaPieces.push("verifique os detalhes retornados pela API do Bling");
      }
      const metaSuffix = metaPieces.length > 0 ? ` (${metaPieces.join(", ")})` : "";
      this.logger.error(`Falha ao enviar pedido para o Bling: ${details.message}${metaSuffix}`);
      throw new Error(details.message);
    }
  }

  private buildOrderFetchConfig(): FindConfig<OrderDTO> {
    return {
      relations: [
        "items",
        "shipping_address",
        "billing_address",
        "shipping_methods",
        "transactions",
      ],
    };
  }

  private extractDocument(order: OrderDTO, address: OrderAddressDTO): string | null {
    const candidates: Array<unknown> = [
      address.metadata?.document,
      address.metadata?.cpf,
      address.metadata?.cnpj,
      (order.billing_address?.metadata as Record<string, unknown> | undefined)?.document,
      (order.billing_address?.metadata as Record<string, unknown> | undefined)?.cpf,
      (order.billing_address?.metadata as Record<string, unknown> | undefined)?.cnpj,
      order.metadata?.document,
      order.metadata?.cpf,
      order.metadata?.cnpj,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }

  private buildItemsPayload(
    items: OrderLineItemDTO[],
    warnings: string[]
  ): BlingOrderItemPayload[] {
    return items
      .map((item) => this.mapItemToBlingPayload(item, warnings))
      .filter((item): item is BlingOrderItemPayload => item !== null);
  }

  private mapItemToBlingPayload(
    item: OrderLineItemDTO,
    warnings: string[]
  ): BlingOrderItemPayload | null {
    const metadata = (item.metadata as Record<string, unknown> | null) ?? {};

    const externalId = this.pickString(
      metadata?.bling_external_id,
      metadata?.external_id,
      metadata?.codigo,
      metadata?.sku,
      item.variant_sku ?? undefined
    );

    if (!externalId) {
      warnings.push(
        `Item ${item.title} (ID ${item.id}) ignorado: nenhuma referência de SKU/ID do Bling encontrada.`
      );
      return null;
    }

    const quantity = item.quantity ?? 0;
    const subtotalValue = this.safeNumber(item.subtotal);
    const unitPrice = quantity > 0 ? subtotalValue / quantity : 0;
    const discount = this.safeNumber(item.discount_total);

    const payload: BlingOrderItemPayload = {
      codigo: externalId,
      descricao: item.title,
      quantidade: quantity,
      valor: unitPrice,
    };

    if (discount > 0) {
      payload.desconto = discount;
    }

    return payload;
  }

  private buildPayload(params: {
    order: OrderDTO;
    shippingAddress: OrderAddressDTO;
    document: string;
    isCpf: boolean;
    itemsPayload: BlingOrderItemPayload[];
    preferences: SyncPreferences;
    options: OrderSyncOptions;
    warnings: string[];
  }): BlingOrderPayload {
    const { order, shippingAddress, document, isCpf, itemsPayload, preferences, options } = params;

    if (!shippingAddress.address_1) {
      throw new Error("Endereço (logradouro) é obrigatório para sincronizar o pedido.");
    }

    const addressMetadata = (shippingAddress.metadata as Record<string, unknown> | null) ?? {};
    const orderMetadata = (order.metadata as Record<string, unknown> | null) ?? null;

    const metadataString = (...values: Array<unknown>): string | undefined =>
      this.pickString(...values);

    const nomeCliente = this.composeCustomerName(order);
    const telefone = this.pickString(
      shippingAddress.phone,
      order.billing_address?.phone,
      order.metadata?.telefone,
      order.metadata?.phone
    );
    const bairro =
      this.pickString(
        addressMetadata?.bairro,
        addressMetadata?.district,
        shippingAddress.province
      ) ?? "Centro";
    const numero = this.extractHouseNumber(shippingAddress) ?? "S/N";
    const uf =
      this.pickString(
        addressMetadata?.uf,
        shippingAddress.province,
        shippingAddress.country_code
      ) ?? "SP";
    const cep = shippingAddress.postal_code
      ? sanitizeDocument(shippingAddress.postal_code)
      : undefined;

    const totalAmount = this.safeNumber(order.total);
    const discountTotal = this.safeNumber(order.discount_total);

    const cliente: BlingOrderCustomerPayload = {
      nome: nomeCliente,
      tipoPessoa: isCpf ? "F" : "J",
      cpf_cnpj: document,
      endereco: shippingAddress.address_1,
      numero,
      bairro,
    };

    const complemento = this.pickString(addressMetadata?.complemento, shippingAddress.address_2);
    if (complemento) {
      cliente.complemento = complemento;
    }

    const email = order.email ?? this.pickString(order.metadata?.email);
    if (email) {
      cliente.email = email;
    }

    const telefoneNormalizado = telefone ? sanitizeDocument(telefone) : undefined;
    if (telefoneNormalizado) {
      cliente.fone = telefoneNormalizado;
    }

    if (cep) {
      cliente.cep = cep;
    }

    if (shippingAddress.city) {
      cliente.cidade = shippingAddress.city;
    }

    if (uf) {
      cliente.uf = uf;
    }

    const inscricaoEstadual = this.pickString(addressMetadata?.state_registration, "ISENTO");
    if (inscricaoEstadual) {
      cliente.ie_rg = inscricaoEstadual;
    }

    const shippingMethod = (order.shipping_methods ?? [])[0] as OrderShippingMethodDTO | undefined;
    const freightValue = this.safeNumber(order.shipping_total ?? shippingMethod?.amount);
    const shippingMetadata = (shippingMethod?.metadata as Record<string, unknown> | null) ?? {};

    const payload: BlingOrderPayload = {
      numeroPedidoLoja: order.id,
      situacao: "Atendido",
      data: new Date(order.created_at).toISOString().slice(0, 10),
      cliente,
      itens: itemsPayload,
      total: totalAmount,
    };

    if (order.display_id !== undefined && order.display_id !== null) {
      payload.numero = order.display_id;
    }

    if (freightValue > 0) {
      payload.vlr_frete = freightValue;
    }

    if (discountTotal > 0) {
      payload.vlr_desconto = discountTotal;
    }

    const observacoes = metadataString(orderMetadata?.["observacoes"]);
    if (observacoes) {
      payload.observacoes = observacoes;
    }

    const observacoesInternas = metadataString(orderMetadata?.["observacoes_internas"]);
    if (observacoesInternas) {
      payload.observacoesInternas = observacoesInternas;
    }

    const naturezaOperacao = metadataString(orderMetadata?.["natureza_operacao"]);
    if (naturezaOperacao) {
      payload.natureza_operacao = naturezaOperacao;
    }

    if (preferences.orders.generate_nf || options.generateNfe) {
      payload.gerar_nfe = "S";
    }

    if (options.generateShippingLabel) {
      payload.gerar_etiqueta = "S";
    }

    const installments = this.buildInstallments(order.transactions ?? []);
    if (installments.length > 0) {
      payload.parcelas = installments;
    }

    const enderecoEntrega: BlingOrderAddressPayload = {
      nome: cliente.nome,
      endereco: cliente.endereco,
      numero: cliente.numero,
      bairro: cliente.bairro,
    };

    if (cliente.complemento ?? null) {
      enderecoEntrega.complemento = cliente.complemento ?? null;
    }
    if (cliente.cidade) {
      enderecoEntrega.municipio = cliente.cidade;
    }
    if (cliente.uf) {
      enderecoEntrega.uf = cliente.uf;
    }
    if (cliente.cep) {
      enderecoEntrega.cep = cliente.cep;
    }

    const transporte: BlingOrderTransportPayload = {
      dados_etiqueta: enderecoEntrega,
    };

    if (shippingMethod?.name) {
      transporte.transportadora = shippingMethod.name;
    }

    const serviceCode = this.pickString(shippingMetadata?.service_code);
    if (serviceCode) {
      transporte.servico_correios = serviceCode;
    }

    const shippingType = this.pickString(shippingMetadata?.shipping_type);
    if (shippingType) {
      transporte.tipo_frete = shippingType;
    }

    payload.transporte = transporte;

    return payload;
  }

  private buildInstallments(transactions: OrderTransactionDTO[]): BlingOrderInstallmentPayload[] {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    return transactions.map((transaction) => {
      const amount = this.safeNumber(transaction.amount);
      const date = transaction.created_at ? new Date(transaction.created_at) : new Date();
      return {
        data: date.toISOString().slice(0, 10),
        vlr: amount,
        obs: transaction.currency_code ?? undefined,
      };
    });
  }

  private extractHouseNumber(address: OrderAddressDTO): string | undefined {
    const candidates: Array<unknown> = [
      address.metadata?.number,
      address.metadata?.numero,
      address.address_2,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    const numericMatch = address.address_1?.match(/(\d+)/);
    if (numericMatch && numericMatch[0]) {
      return numericMatch[0];
    }
    return undefined;
  }

  private composeCustomerName(order: OrderDTO): string {
    const shipping = order.shipping_address;
    if (shipping?.first_name) {
      return `${shipping.first_name} ${shipping.last_name ?? ""}`.trim();
    }
    const billing = order.billing_address;
    if (billing?.first_name) {
      return `${billing.first_name} ${billing.last_name ?? ""}`.trim();
    }
    return order.email ?? "Cliente";
  }

  private safeNumber(value: BigNumberValue | unknown): number {
    if (value == null) {
      return 0;
    }
    if (typeof value === "number") {
      return Number.isNaN(value) ? 0 : value;
    }
    if (typeof value === "string") {
      const normalized = value.replace(/,/g, ".");
      const parsed = Number.parseFloat(normalized);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof value === "object") {
      const candidate = value as {
        numeric?: number;
        toNumber?: () => unknown;
        valueOf?: () => unknown;
        value?: unknown;
      };

      if (typeof candidate.numeric === "number" && !Number.isNaN(candidate.numeric)) {
        return candidate.numeric;
      }

      if (typeof candidate.toNumber === "function") {
        const result = candidate.toNumber();
        if (typeof result === "number" && !Number.isNaN(result)) {
          return result;
        }
        if (typeof result === "string") {
          const parsed = Number.parseFloat(result);
          if (!Number.isNaN(parsed)) {
            return parsed;
          }
        }
      }

      if (typeof candidate.value === "number" || typeof candidate.value === "string") {
        return this.safeNumber(candidate.value);
      }

      if (typeof candidate.valueOf === "function") {
        const result = candidate.valueOf();
        if (typeof result === "number" && !Number.isNaN(result)) {
          return result;
        }
      }
    }
    return 0;
  }

  private pickString(...values: Array<unknown>): string | undefined {
    for (const value of values) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private extractSaleId(response: Record<string, unknown>): string | null {
    const data = (response?.data as Record<string, unknown> | undefined) ?? response;
    const id = this.pickString(data?.id as string | undefined, data?.numero as string | undefined);
    return id ?? null;
  }

  private async persistOrderMetadata(
    order: OrderDTO,
    blingSaleId: string | null,
    payload: BlingOrderPayload,
    response: Record<string, unknown>,
    warnings: string[]
  ): Promise<void> {
    if (!this.orderModuleService) {
      return;
    }

    const baseMetadata = {
      ...((order.metadata as Record<string, unknown> | null) ?? {}),
    };
    const existingBling = (baseMetadata.bling as Record<string, unknown> | undefined) ?? {};

    const blingMetadata = {
      ...existingBling,
      sale_id: blingSaleId,
      last_sync_at: new Date().toISOString(),
      last_payload: payload,
      last_response: response,
      warnings,
    };

    await this.orderModuleService.updateOrders(order.id, {
      metadata: {
        ...baseMetadata,
        bling: blingMetadata,
      },
    });
  }

  private serializeError(error: AxiosError): {
    message: string;
    status?: number | undefined;
    response?: unknown;
  } {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const response = error.response?.data;
      let message = error.message ?? "Falha ao comunicar com a API do Bling.";

      if (typeof response === "string" && response.trim().length > 0) {
        message = response;
      } else if (
        response &&
        typeof response === "object" &&
        "message" in response &&
        typeof (response as { message?: unknown }).message === "string"
      ) {
        message = (response as { message: string }).message;
      }

      const serialized: {
        message: string;
        status?: number | undefined;
        response?: unknown;
      } = {
        message,
      };

      if (typeof status === "number") {
        serialized.status = status;
      }

      if (response !== undefined) {
        serialized.response = response;
      }

      return serialized;
    }

    return {
      message: (error as Error).message ?? "Erro desconhecido ao comunicar com o Bling.",
    };
  }
}
