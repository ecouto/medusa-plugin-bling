import { 
  createWorkflow, 
  createStep, 
  StepResponse,
  WorkflowResponse 
} from "@medusajs/workflows-sdk"
import { BlingMapper } from "../utils"

interface SyncOrderToBlingInput {
  order_id: string
}

interface SyncOrderToBlingOutput {
  bling_order_id: number
  success: boolean
}

const syncOrderToBlingStep = createStep(
  "sync-order-to-bling-step",
  async (input: SyncOrderToBlingInput, { container }) => {
    const blingService = container.resolve("blingService")
    const orderService = container.resolve("orderService")
    
    try {
      // Get Medusa order
      const medusaOrder = await orderService.retrieve(input.order_id, {
        relations: [
          "items",
          "items.variant",
          "items.variant.product",
          "billing_address",
          "shipping_address",
          "shipping_methods",
          "customer"
        ]
      })

      // Convert to Bling format
      const blingOrderData = BlingMapper.medusaOrderToBling(medusaOrder)

      // Create order in Bling
      const blingOrder = await blingService.createOrder(blingOrderData)

      // Update Medusa order with Bling ID
      await orderService.update(input.order_id, {
        metadata: {
          ...medusaOrder.metadata,
          bling_id: blingOrder.id,
          bling_numero: blingOrder.numero,
          bling_synced_at: new Date().toISOString()
        }
      })

      return new StepResponse(
        {
          bling_order_id: blingOrder.id,
          success: true
        }
      )
    } catch (error) {
      console.error("Error syncing order to Bling:", error)
      
      // Update order with error status
      await orderService.update(input.order_id, {
        metadata: {
          ...medusaOrder.metadata,
          bling_sync_error: error.message,
          bling_sync_error_at: new Date().toISOString()
        }
      })

      throw error
    }
  }
)

export const syncOrderToBlingWorkflow = createWorkflow(
  "sync-order-to-bling",
  (input: SyncOrderToBlingInput) => {
    const result = syncOrderToBlingStep(input)
    return new WorkflowResponse(result)
  }
)