import { 
  createWorkflow, 
  createStep, 
  StepResponse,
  WorkflowResponse 
} from "@medusajs/workflows-sdk"
import { BlingMapper } from "../utils"

interface SyncProductFromBlingInput {
  bling_product_id: number
}

interface SyncProductFromBlingOutput {
  medusa_product_id: string
  success: boolean
}

const syncProductFromBlingStep = createStep(
  "sync-product-from-bling-step",
  async (input: SyncProductFromBlingInput, { container }) => {
    const blingService = container.resolve("blingService")
    const productService = container.resolve("productService")
    const productVariantService = container.resolve("productVariantService")
    
    try {
      // Get product from Bling
      const blingProduct = await blingService.getProduct(input.bling_product_id)

      // Convert to Medusa format
      const medusaProductData = BlingMapper.blingProductToMedusa(blingProduct)

      // Check if product already exists
      const existingProducts = await productService.list({
        metadata: {
          bling_id: blingProduct.id.toString()
        }
      })

      let medusaProduct

      if (existingProducts.length > 0) {
        // Update existing product
        medusaProduct = await productService.update(
          existingProducts[0].id,
          {
            title: medusaProductData.title,
            subtitle: medusaProductData.subtitle,
            description: medusaProductData.description,
            weight: medusaProductData.weight,
            metadata: {
              ...existingProducts[0].metadata,
              ...medusaProductData.metadata,
              bling_synced_at: new Date().toISOString()
            }
          }
        )

        // Update variant prices
        if (medusaProduct.variants?.length > 0) {
          await productVariantService.update(
            medusaProduct.variants[0].id,
            {
              prices: medusaProductData.variants[0].prices,
              inventory_quantity: medusaProductData.variants[0].inventory_quantity,
              metadata: {
                ...medusaProduct.variants[0].metadata,
                bling_synced_at: new Date().toISOString()
              }
            }
          )
        }
      } else {
        // Create new product
        medusaProduct = await productService.create({
          ...medusaProductData,
          metadata: {
            ...medusaProductData.metadata,
            bling_synced_at: new Date().toISOString()
          }
        })
      }

      return new StepResponse({
        medusa_product_id: medusaProduct.id,
        success: true
      })
    } catch (error) {
      console.error("Error syncing product from Bling:", error)
      throw error
    }
  }
)

export const syncProductFromBlingWorkflow = createWorkflow(
  "sync-product-from-bling",
  (input: SyncProductFromBlingInput) => {
    const result = syncProductFromBlingStep(input)
    return new WorkflowResponse(result)
  }
)