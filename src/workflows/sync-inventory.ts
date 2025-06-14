import { 
  createWorkflow, 
  createStep, 
  StepResponse,
  WorkflowResponse 
} from "@medusajs/workflows-sdk"

interface SyncInventoryInput {
  product_variant_id: string
  quantity: number
  direction: "medusa-to-bling" | "bling-to-medusa"
}

interface SyncInventoryOutput {
  success: boolean
  medusa_quantity?: number
  bling_quantity?: number
}

const syncInventoryStep = createStep(
  "sync-inventory-step",
  async (input: SyncInventoryInput, { container }) => {
    const blingService = container.resolve("blingService")
    const inventoryService = container.resolve("inventoryService")
    const productVariantService = container.resolve("productVariantService")
    
    try {
      // Get product variant
      const variant = await productVariantService.retrieve(input.product_variant_id, {
        relations: ["product"]
      })

      const blingProductId = variant.product?.metadata?.bling_id || 
                            variant.metadata?.bling_id

      if (!blingProductId) {
        throw new Error("Product not linked to Bling - missing bling_id in metadata")
      }

      if (input.direction === "medusa-to-bling") {
        // Sync from Medusa to Bling
        const currentInventory = await inventoryService.retrieveInventoryLevel(
          variant.inventory_item_id,
          variant.manage_inventory ? undefined : "default"
        )

        const currentQuantity = currentInventory?.stocked_quantity || 0
        const quantityDiff = input.quantity - currentQuantity

        if (quantityDiff !== 0) {
          // Update Bling inventory
          await blingService.updateInventory(
            parseInt(blingProductId),
            Math.abs(quantityDiff),
            quantityDiff > 0 ? "entrada" : "saida"
          )

          // Update Medusa inventory
          await inventoryService.adjustInventory(
            variant.inventory_item_id,
            variant.manage_inventory ? undefined : "default",
            quantityDiff
          )
        }

        return new StepResponse({
          success: true,
          medusa_quantity: input.quantity,
          bling_quantity: input.quantity
        })
      } else {
        // Sync from Bling to Medusa
        const blingProduct = await blingService.getProduct(parseInt(blingProductId))
        const blingQuantity = blingProduct.estoque?.minimo || 0

        const currentInventory = await inventoryService.retrieveInventoryLevel(
          variant.inventory_item_id,
          variant.manage_inventory ? undefined : "default"
        )

        const currentQuantity = currentInventory?.stocked_quantity || 0
        const quantityDiff = blingQuantity - currentQuantity

        if (quantityDiff !== 0) {
          // Update Medusa inventory
          await inventoryService.adjustInventory(
            variant.inventory_item_id,
            variant.manage_inventory ? undefined : "default",
            quantityDiff
          )
        }

        return new StepResponse({
          success: true,
          medusa_quantity: blingQuantity,
          bling_quantity: blingQuantity
        })
      }
    } catch (error) {
      console.error("Error syncing inventory:", error)
      throw error
    }
  }
)

export const syncInventoryWorkflow = createWorkflow(
  "sync-inventory",
  (input: SyncInventoryInput) => {
    const result = syncInventoryStep(input)
    return new WorkflowResponse(result)
  }
)