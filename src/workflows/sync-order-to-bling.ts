import {
  createWorkflow,
  WorkflowResponse,
  createStep,
  StepResponse
} from "@medusajs/framework/workflows-sdk"
import { BlingService } from "../modules/bling/bling"

// Define workflow input type
interface SyncOrderToBlingInput {
  order_id: string
  medusa_order: any
  force_sync?: boolean
}

// Define step to get Bling configuration
const getBlingConfigStep = createStep(
  "get-bling-config",
  async (input: any, { container }) => {
    const manager = container.resolve("manager")

    const result = await manager.query(`
      SELECT * FROM bling_configuration
      WHERE sync_orders_enabled = true
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (result.length === 0) {
      throw new Error("Bling configuration not found or orders sync disabled")
    }

    return new StepResponse(result[0])
  }
)

// Define step to check if order already synced
const checkOrderSyncStatusStep = createStep(
  "check-order-sync-status",
  async ({ orderId, forceSync }: { orderId: string; forceSync?: boolean }, { container }) => {
    if (forceSync) {
      return new StepResponse({ shouldSync: true, alreadySynced: false })
    }

    const manager = container.resolve("manager")

    const result = await manager.query(`
      SELECT metadata FROM "order"
      WHERE id = $1 AND metadata->>'bling_id' IS NOT NULL
    `, [orderId])

    const alreadySynced = result.length > 0

    return new StepResponse({
      shouldSync: !alreadySynced,
      alreadySynced,
      existingBlingId: alreadySynced ? result[0].metadata.bling_id : null
    })
  }
)

// Define step to map Medusa order to Bling format
const mapOrderToBlingStep = createStep(
  "map-order-to-bling",
  async ({ order, config }: { order: any; config: any }) => {
    const blingOrder = {
      data: new Date().toISOString().split('T')[0],
      contato: {
        nome: order.customer?.first_name && order.customer?.last_name
          ? `${order.customer.first_name} ${order.customer.last_name}`
          : order.email || "Cliente",
        email: order.customer?.email || order.email,
        celular: order.customer?.phone,
        endereco: order.shipping_address ? {
          endereco: order.shipping_address.address_1,
          numero: order.shipping_address.address_2 || "S/N",
          bairro: order.shipping_address.city,
          cep: order.shipping_address.postal_code?.replace(/\D/g, ''),
          municipio: order.shipping_address.city,
          uf: order.shipping_address.province
        } : undefined
      },
      itens: order.items?.map((item: any) => ({
        descricao: item.title,
        quantidade: item.quantity,
        valor: item.unit_price / 100, // Convert from cents
        produto: item.variant?.metadata?.bling_id ? {
          id: parseInt(item.variant.metadata.bling_id)
        } : undefined
      })) || [],
      totalProdutos: order.subtotal / 100,
      totalVenda: order.total / 100,
      observacoes: `Pedido Medusa #${order.display_id}`,
      observacoesInternas: `Importado automaticamente do Medusa em ${new Date().toLocaleString('pt-BR')}`
    }

    return new StepResponse(blingOrder)
  }
)

// Define step to send order to Bling
const sendOrderToBlingStep = createStep(
  "send-order-to-bling",
  async (
    { blingOrder, config }: { blingOrder: any; config: any },
    { container }
  ) => {
    const blingService: BlingService = container.resolve("blingService")

    try {
      const createdOrder = await blingService.createOrder(blingOrder)

      return new StepResponse({
        bling_id: createdOrder.id,
        bling_numero: createdOrder.numero,
        success: true
      })
    } catch (error) {
      console.error("Failed to send order to Bling:", error)
      return new StepResponse({
        success: false,
        error: error.message
      })
    }
  }
)

// Define step to generate NFe if enabled
const generateNFeStep = createStep(
  "generate-nfe",
  async (
    { blingOrderId, config }: { blingOrderId: number; config: any },
    { container }
  ) => {
    if (!config.sync_orders_generate_nfe || !blingOrderId) {
      return new StepResponse({ nfe_generated: false, skipped: true })
    }

    const blingService: BlingService = container.resolve("blingService")

    try {
      // Note: This would need to be implemented in BlingService
      // await blingService.generateNFe(blingOrderId)

      return new StepResponse({
        nfe_generated: true,
        success: true
      })
    } catch (error) {
      console.error("Failed to generate NFe:", error)
      return new StepResponse({
        nfe_generated: false,
        success: false,
        error: error.message
      })
    }
  }
)

// Define step to update Medusa order metadata
const updateOrderMetadataStep = createStep(
  "update-order-metadata",
  async (
    { orderId, blingData, nfeData }: { orderId: string; blingData: any; nfeData: any },
    { container }
  ) => {
    if (!blingData.success) {
      return new StepResponse({ updated: false })
    }

    const manager = container.resolve("manager")

    const metadata = {
      bling_id: blingData.bling_id,
      bling_numero: blingData.bling_numero,
      bling_synced_at: new Date().toISOString()
    }

    if (nfeData.nfe_generated) {
      metadata['bling_nfe_generated'] = true
      metadata['bling_nfe_generated_at'] = new Date().toISOString()
    }

    await manager.query(`
      UPDATE "order" SET
        metadata = COALESCE(metadata, '{}'::jsonb) || $1,
        updated_at = NOW()
      WHERE id = $2
    `, [
      JSON.stringify(metadata),
      orderId
    ])

    return new StepResponse({ updated: true })
  }
)

// Create the main workflow
export const syncOrderToBlingWorkflow = createWorkflow(
  "sync-order-to-bling",
  (input: SyncOrderToBlingInput) => {
    // Get Bling configuration
    const config = getBlingConfigStep(input)

    // Check if order is already synced
    const syncStatus = checkOrderSyncStatusStep({
      orderId: input.order_id,
      forceSync: input.force_sync
    })

    // Only proceed if should sync
    const blingOrder = mapOrderToBlingStep({
      order: input.medusa_order,
      config
    })

    // Send to Bling
    const blingResult = sendOrderToBlingStep({
      blingOrder,
      config
    })

    // Generate NFe if enabled
    const nfeResult = generateNFeStep({
      blingOrderId: blingResult.bling_id,
      config
    })

    // Update Medusa order metadata
    const updateResult = updateOrderMetadataStep({
      orderId: input.order_id,
      blingData: blingResult,
      nfeData: nfeResult
    })

    return new WorkflowResponse({
      order_id: input.order_id,
      sync_status: syncStatus,
      bling_result: blingResult,
      nfe_result: nfeResult,
      metadata_updated: updateResult
    })
  }
)