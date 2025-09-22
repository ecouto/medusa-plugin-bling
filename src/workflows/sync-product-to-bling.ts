import {
  createWorkflow,
  WorkflowResponse,
  createStep,
  StepResponse
} from "@medusajs/framework/workflows-sdk"
import { BlingService } from "../modules/bling/bling"

// Define workflow input type
interface SyncProductToBlingInput {
  product_id: string
  medusa_product: any
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

// Define step to map Medusa product to Bling format
const mapProductToBlingStep = createStep(
  "map-product-to-bling",
  async ({ product, config }: { product: any; config: any }) => {
    const blingOrder = {
      data: new Date().toISOString().split('T')[0],
      contato: {
        nome: product.customer?.first_name && product.customer?.last_name
          ? `${product.customer.first_name} ${product.customer.last_name}`
          : product.email || "Cliente",
        email: product.customer?.email || product.email,
        celular: product.customer?.phone,
        endereco: product.shipping_address ? {
          endereco: product.shipping_address.address_1,
          numero: product.shipping_address.address_2 || "S/N",
          bairro: product.shipping_address.city,
          cep: product.shipping_address.postal_code?.replace(/\D/g, ''),
          municipio: product.shipping_address.city,
          uf: product.shipping_address.province
        } : undefined
      },
      itens: product.items?.map((item: any) => ({
        descricao: item.title,
        quantidade: item.quantity,
        valor: item.unit_price / 100, // Convert from cents
        produto: item.variant?.metadata?.bling_id ? {
          id: parseInt(item.variant.metadata.bling_id)
        } : undefined
      })) || [],
      totalProdutos: product.subtotal / 100,
      totalVenda: product.total / 100,
      observacoes: `Pedido Medusa #${product.display_id}`,
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

// Define step to update Medusa order metadata
const updateOrderMetadataStep = createStep(
  "update-order-metadata",
  async (
    { orderId, blingData }: { orderId: string; blingData: any },
    { container }
  ) => {
    if (!blingData.success) {
      return new StepResponse({ updated: false })
    }

    const manager = container.resolve("manager")

    await manager.query(`
      UPDATE "order" SET
        metadata = COALESCE(metadata, '{}'::jsonb) || $1,
        updated_at = NOW()
      WHERE id = $2
    `, [
      JSON.stringify({
        bling_id: blingData.bling_id,
        bling_numero: blingData.bling_numero,
        bling_synced_at: new Date().toISOString()
      }),
      orderId
    ])

    return new StepResponse({ updated: true })
  }
)

// Create the main workflow
export const syncProductToBlingWorkflow = createWorkflow(
  "sync-product-to-bling",
  (input: SyncProductToBlingInput) => {
    // Get Bling configuration
    const config = getBlingConfigStep(input)

    // Map product to Bling format
    const blingOrder = mapProductToBlingStep({
      product: input.medusa_product,
      config
    })

    // Send to Bling
    const blingResult = sendOrderToBlingStep({
      blingOrder,
      config
    })

    // Update Medusa order metadata
    const updateResult = updateOrderMetadataStep({
      orderId: input.product_id,
      blingData: blingResult
    })

    return new WorkflowResponse({
      order_id: input.product_id,
      bling_result: blingResult,
      metadata_updated: updateResult
    })
  }
)