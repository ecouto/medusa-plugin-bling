import { 
  createWorkflow, 
  createStep, 
  StepResponse,
  WorkflowResponse 
} from "@medusajs/workflows-sdk"

interface GenerateShippingLabelInput {
  order_id: string
  transporter_id?: number
}

interface GenerateShippingLabelOutput {
  label_url?: string
  tracking_code?: string
  success: boolean
}

const generateShippingLabelStep = createStep(
  "generate-shipping-label-step",
  async (input: GenerateShippingLabelInput, { container }) => {
    const blingService = container.resolve("blingService")
    const orderService = container.resolve("orderService")
    const fulfillmentService = container.resolve("fulfillmentService")
    
    try {
      // Get Medusa order
      const medusaOrder = await orderService.retrieve(input.order_id, {
        relations: ["metadata", "fulfillments"]
      })

      const blingOrderId = medusaOrder.metadata?.bling_id

      if (!blingOrderId) {
        throw new Error("Order not synced to Bling - missing bling_id in metadata")
      }

      // Generate shipping label in Bling
      const labelResult = await blingService.generateShippingLabel(
        parseInt(blingOrderId),
        input.transporter_id
      )

      // Get the generated label details
      const labelDetails = await blingService.getShippingLabel(parseInt(blingOrderId))

      // Update order metadata with shipping info
      await orderService.update(input.order_id, {
        metadata: {
          ...medusaOrder.metadata,
          bling_shipping_label_url: labelDetails.url,
          bling_tracking_code: labelDetails.codigoRastreamento,
          bling_label_generated_at: new Date().toISOString()
        }
      })

      // Create fulfillment if it doesn't exist
      if (!medusaOrder.fulfillments || medusaOrder.fulfillments.length === 0) {
        await fulfillmentService.createFulfillment(
          medusaOrder,
          medusaOrder.items.map(item => ({
            item_id: item.id,
            quantity: item.quantity
          })),
          {
            metadata: {
              bling_tracking_code: labelDetails.codigoRastreamento,
              bling_label_url: labelDetails.url,
              shipping_provider: "bling"
            }
          }
        )
      }

      return new StepResponse({
        label_url: labelDetails.url,
        tracking_code: labelDetails.codigoRastreamento,
        success: true
      })
    } catch (error) {
      console.error("Error generating shipping label:", error)
      
      // Update order with error status
      await orderService.update(input.order_id, {
        metadata: {
          ...medusaOrder.metadata,
          bling_label_error: error.message,
          bling_label_error_at: new Date().toISOString()
        }
      })

      throw error
    }
  }
)

export const generateShippingLabelWorkflow = createWorkflow(
  "generate-shipping-label",
  (input: GenerateShippingLabelInput) => {
    const result = generateShippingLabelStep(input)
    return new WorkflowResponse(result)
  }
)