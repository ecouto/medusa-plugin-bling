import type { Logger, FindConfig } from "@medusajs/types"
import type {
  OrderAddressDTO,
  OrderDTO,
  OrderLineItemDTO,
  OrderShippingMethodDTO,
  OrderTransactionDTO,
} from "@medusajs/types/dist/order/common"
import type { IOrderModuleService } from "@medusajs/types/dist/order/service"
import axios, { type AxiosError } from "axios"
import BlingService from "./bling.service"
import type { SyncPreferences } from "../models/bling-config.entity"
import { isValidCPF, isValidCNPJ, sanitizeDocument } from "../utils/document-validation"

export type OrderSyncOptions = {
  generateNfe?: boolean
  generateShippingLabel?: boolean
}

export type OrderSyncSummary = {
  total_items: number
  total_amount: number
  freight_amount: number
  bling_sale_id: string | null
  synced_at: string
}

export type OrderSyncResult = {
  summary: OrderSyncSummary
  payload: Record<string, unknown>
  response: Record<string, unknown> | null
  warnings: string[]
}

type BlingOrderItemPayload = {
  codigo: string
  descricao: string
  quantidade: number
  valor: number
  desconto?: number
}

type InjectedDependencies = {
  logger: Logger
  orderModuleService?: IOrderModuleService | undefined
  blingService: BlingService
}

export default class OrderSyncService {
  private readonly logger: Logger
  private readonly orderModuleService: IOrderModuleService | undefined
  private readonly blingService: BlingService

  constructor(deps: InjectedDependencies) {
    this.logger = deps.logger
    this.orderModuleService = deps.orderModuleService
    this.blingService = deps.blingService
  }

  async syncOrder(orderId: string, options: OrderSyncOptions = {}): Promise<OrderSyncResult> {
    if (!this.orderModuleService) {
      throw new Error("Serviço de pedidos do Medusa não está disponível no container.")
    }

    const order = await this.orderModuleService.retrieveOrder(orderId, this.buildOrderFetchConfig())
    if (!order) {
      throw new Error(`Pedido ${orderId} não encontrado no Medusa.`)
    }

    const config = await this.blingService.getBlingConfig()
    const preferences = this.blingService.mergePreferences({}, config?.sync_preferences ?? undefined)

    if (!preferences.orders.enabled || !preferences.orders.send_to_bling) {
      throw new Error("Sincronização de pedidos com o Bling está desativada nas preferências.")
    }

    const warnings: string[] = []

    const shippingAddress = order.shipping_address ?? order.billing_address
    if (!shippingAddress) {
      throw new Error("Pedido sem endereço. Endereço de entrega ou faturamento é obrigatório.")
    }

    const document = this.extractDocument(order, shippingAddress)
    if (!document) {
      throw new Error("CPF ou CNPJ obrigatório para sincronizar o pedido com o Bling.")
    }

    const documentDigits = sanitizeDocument(document)
    const isCpf = documentDigits.length === 11
    if (isCpf && !isValidCPF(documentDigits)) {
      throw new Error("CPF informado é inválido.")
    }
    if (!isCpf && !isValidCNPJ(documentDigits)) {
      throw new Error("CNPJ informado é inválido.")
    }

    const itemsPayload = this.buildItemsPayload(order.items ?? [], warnings)
    if (itemsPayload.length === 0) {
      throw new Error("Nenhum item do pedido possui SKU ou ID associado no Bling.")
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
    })

    try {
      const client = await this.blingService.createAuthorizedClient()
      const response = await client.post("/vendas", payload)
      const responseData = (response.data ?? {}) as Record<string, unknown>
      const blingSaleId = this.extractSaleId(responseData)

      await this.persistOrderMetadata(order, blingSaleId, payload, responseData, warnings)

      const summary: OrderSyncSummary = {
        total_items: itemsPayload.length,
        total_amount: payload.total ?? this.safeNumber(order.total),
        freight_amount: payload.vlr_frete ?? this.safeNumber(order.shipping_total),
        bling_sale_id: blingSaleId,
        synced_at: new Date().toISOString(),
      }

      if (preferences.inventory.enabled && preferences.inventory.bidirectional) {
        try {
          await this.blingService.syncProductsToMedusa()
        } catch (error) {
          warnings.push(
            `Falha ao atualizar o estoque no Medusa após enviar o pedido: ${
              (error as Error).message ?? error
            }`
          )
        }
      }

      this.logger.info(
        `Pedido ${order.id} sincronizado com sucesso no Bling${blingSaleId ? ` (ID ${blingSaleId})` : ""}.`
      )

      return {
        summary,
        payload,
        response: responseData,
        warnings,
      }
    } catch (error) {
      const axiosError = error as AxiosError
      const details = this.serializeError(axiosError)
      const metaPieces: string[] = []
      if (typeof details.status === "number") {
        metaPieces.push(`status ${details.status}`)
      }
      if (details.response) {
        metaPieces.push("verifique os detalhes retornados pela API do Bling")
      }
      const metaSuffix = metaPieces.length > 0 ? ` (${metaPieces.join(", ")})` : ""
      this.logger.error(`Falha ao enviar pedido para o Bling: ${details.message}${metaSuffix}`)
      throw new Error(details.message)
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
    }
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
    ]

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim()
      }
    }

    return null
  }

  private buildItemsPayload(items: OrderLineItemDTO[], warnings: string[]): BlingOrderItemPayload[] {
    return items
      .map((item) => this.mapItemToBlingPayload(item, warnings))
      .filter((item): item is BlingOrderItemPayload => item !== null)
  }

  private mapItemToBlingPayload(item: OrderLineItemDTO, warnings: string[]): BlingOrderItemPayload | null {
    const metadata = (item.metadata as Record<string, unknown> | null) ?? {}

    const externalId = this.pickString(
      metadata?.bling_external_id,
      metadata?.external_id,
      metadata?.codigo,
      metadata?.sku,
      item.variant_sku ?? undefined
    )

    if (!externalId) {
      warnings.push(
        `Item ${item.title} (ID ${item.id}) ignorado: nenhuma referência de SKU/ID do Bling encontrada.`
      )
      return null
    }

    const quantity = item.quantity ?? 0
    const unitPrice = this.safeNumber((item as any).unit_price ?? (item as any).raw_unit_price)
    const discount = this.safeNumber((item as any).discount_total)

    const payload: BlingOrderItemPayload = {
      codigo: externalId,
      descricao: item.title,
      quantidade: quantity,
      valor: unitPrice,
    }

    if (discount > 0) {
      payload.desconto = discount
    }

    return payload
  }

  private buildPayload(params: {
    order: OrderDTO
    shippingAddress: OrderAddressDTO
    document: string
    isCpf: boolean
    itemsPayload: BlingOrderItemPayload[]
    preferences: SyncPreferences
    options: OrderSyncOptions
    warnings: string[]
  }): Record<string, any> {
    const { order, shippingAddress, document, isCpf, itemsPayload, preferences, options } = params

    if (!shippingAddress.address_1) {
      throw new Error("Endereço (logradouro) é obrigatório para sincronizar o pedido.")
    }

    const addressMetadata = (shippingAddress.metadata as Record<string, unknown> | null) ?? {}

    const nomeCliente = this.composeCustomerName(order)
    const telefone = this.pickString(
      shippingAddress.phone,
      order.billing_address?.phone,
      order.metadata?.telefone,
      order.metadata?.phone
    )
    const bairro =
      this.pickString(
        addressMetadata?.bairro,
        addressMetadata?.district,
        shippingAddress.province
      ) ?? "Centro"
    const numero = this.extractHouseNumber(shippingAddress) ?? "S/N"
    const uf =
      this.pickString(
        addressMetadata?.uf,
        shippingAddress.province,
        shippingAddress.country_code
      ) ?? "SP"
    const cep = shippingAddress.postal_code
      ? sanitizeDocument(shippingAddress.postal_code)
      : undefined

    const totalAmount = this.safeNumber(order.total)
    const discountTotal = this.safeNumber(order.discount_total)

    const cliente = {
      nome: nomeCliente,
      tipoPessoa: isCpf ? "F" : "J",
      cpf_cnpj: document,
      email: order.email ?? this.pickString(order.metadata?.email),
      fone: telefone ? sanitizeDocument(telefone) : undefined,
      endereco: shippingAddress.address_1,
      numero,
      complemento: this.pickString(addressMetadata?.complemento, shippingAddress.address_2),
      bairro,
      cep,
      cidade: shippingAddress.city,
      uf,
      ie_rg: this.pickString(addressMetadata?.state_registration, "ISENTO"),
    }

    const shippingMethod = (order.shipping_methods ?? [])[0] as OrderShippingMethodDTO | undefined
    const freightValue = this.safeNumber(order.shipping_total ?? shippingMethod?.amount)
    const shippingMetadata = (shippingMethod?.metadata as Record<string, unknown> | null) ?? {}

    const parcelas = this.buildInstallments(order.transactions ?? [])

    const payload: Record<string, any> = {
      numeroPedidoLoja: order.id,
      numero: order.display_id ?? undefined,
      situacao: "Atendido",
      data: new Date(order.created_at).toISOString().slice(0, 10),
      cliente,
      itens: itemsPayload,
      vlr_frete: freightValue > 0 ? freightValue : undefined,
      vlr_desconto: discountTotal > 0 ? discountTotal : undefined,
      parcelas,
      observacoes: order.metadata?.observacoes ?? undefined,
      observacoesInternas: order.metadata?.observacoes_internas ?? undefined,
      total: totalAmount,
      natureza_operacao: order.metadata?.natureza_operacao ?? undefined,
    }

    if (preferences.orders.generate_nf || options.generateNfe) {
      payload.gerar_nfe = "S"
    }

    if (options.generateShippingLabel) {
      payload.gerar_etiqueta = "S"
    }

    const enderecoEntrega = {
      nome: cliente.nome,
      endereco: cliente.endereco,
      numero: cliente.numero,
      complemento: cliente.complemento,
      municipio: cliente.cidade,
      uf: cliente.uf,
      cep: cliente.cep,
      bairro: cliente.bairro,
    }

    payload.transporte = {
      transportadora: shippingMethod?.name,
      servico_correios: this.pickString(shippingMetadata?.service_code),
      tipo_frete: this.pickString(shippingMetadata?.shipping_type),
      dados_etiqueta: enderecoEntrega,
    }

    return payload
  }

  private buildInstallments(transactions: OrderTransactionDTO[]): Array<Record<string, unknown>> {
    if (!transactions || transactions.length === 0) {
      return []
    }

    return transactions.map((transaction) => {
      const amount = this.safeNumber(transaction.amount)
      const date = transaction.created_at ? new Date(transaction.created_at) : new Date()
      return {
        data: date.toISOString().slice(0, 10),
        vlr: amount,
        obs: transaction.currency_code ?? undefined,
      }
    })
  }

  private extractHouseNumber(address: OrderAddressDTO): string | undefined {
    const candidates: Array<unknown> = [
      address.metadata?.number,
      address.metadata?.numero,
      address.address_2,
    ]

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim()
      }
    }

    const numericMatch = address.address_1?.match(/(\d+)/)
    if (numericMatch && numericMatch[0]) {
      return numericMatch[0]
    }
    return undefined
  }

  private composeCustomerName(order: OrderDTO): string {
    const shipping = order.shipping_address
    if (shipping?.first_name) {
      return `${shipping.first_name} ${shipping.last_name ?? ""}`.trim()
    }
    const billing = order.billing_address
    if (billing?.first_name) {
      return `${billing.first_name} ${billing.last_name ?? ""}`.trim()
    }
    return order.email ?? "Cliente"
  }

  private safeNumber(value: unknown): number {
    if (value == null) {
      return 0
    }
    if (typeof value === "number") {
      return Number.isNaN(value) ? 0 : value
    }
    if (typeof value === "string") {
      const normalized = value.replace(/,/g, ".")
      const parsed = Number.parseFloat(normalized)
      return Number.isNaN(parsed) ? 0 : parsed
    }
    if (typeof value === "object" && "toNumber" in (value as any)) {
      try {
        return Number((value as any).toNumber())
      } catch (error) {
        return 0
      }
    }
    return 0
  }

  private pickString(...values: Array<unknown>): string | undefined {
    for (const value of values) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value.trim()
      }
    }
    return undefined
  }

  private extractSaleId(response: Record<string, unknown>): string | null {
    const data = (response?.data as Record<string, unknown> | undefined) ?? response
    const id = this.pickString(data?.id as string | undefined, data?.numero as string | undefined)
    return id ?? null
  }

  private async persistOrderMetadata(
    order: OrderDTO,
    blingSaleId: string | null,
    payload: Record<string, unknown>,
    response: Record<string, unknown>,
    warnings: string[]
  ): Promise<void> {
    if (!this.orderModuleService) {
      return
    }

    const baseMetadata = {
      ...((order.metadata as Record<string, unknown> | null) ?? {}),
    }
    const existingBling =
      (baseMetadata.bling as Record<string, unknown> | undefined) ?? {}

    const blingMetadata = {
      ...existingBling,
      sale_id: blingSaleId,
      last_sync_at: new Date().toISOString(),
      last_payload: payload,
      last_response: response,
      warnings,
    }

    await this.orderModuleService.updateOrders(order.id, {
      metadata: {
        ...baseMetadata,
        bling: blingMetadata,
      },
    })
  }

  private serializeError(error: AxiosError): {
    message: string
    status?: number | undefined
    response?: unknown
  } {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const response = error.response?.data
      const message =
        (response as any)?.message ??
        error.message ??
        "Falha ao comunicar com a API do Bling."

      const serialized: {
        message: string
        status?: number | undefined
        response?: unknown
      } = {
        message,
      }

      if (typeof status === "number") {
        serialized.status = status
      }

      if (response !== undefined) {
        serialized.response = response
      }

      return serialized
    }

    return {
      message: (error as Error).message ?? "Erro desconhecido ao comunicar com o Bling.",
    }
  }
}
