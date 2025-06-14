import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { syncInventoryWorkflow } from "../workflows"

export default async function inventoryBlingSync({
  data,
  eventName,
  container,
  pluginOptions
}: SubscriberArgs<{ 
  inventory_item_id: string
  location_id: string
  quantity: number 
}>) {
  // Check if auto inventory sync is enabled
  if (!pluginOptions?.auto_sync_inventory) {
    return
  }

  const logger = container.resolve("logger")

  try {
    logger.info(`Bling Plugin: Processing ${eventName} for inventory item ${data.inventory_item_id}`)

    // Find the product variant associated with this inventory item
    const productVariantService = container.resolve("productVariantService")
    const variants = await productVariantService.list({
      inventory_item_id: data.inventory_item_id
    }, {
      relations: ["product"]
    })

    if (variants.length === 0) {
      logger.warn(`Bling Plugin: No product variant found for inventory item ${data.inventory_item_id}`)
      return
    }

    const variant = variants[0]
    const blingProductId = variant.product?.metadata?.bling_id || variant.metadata?.bling_id

    if (!blingProductId) {
      logger.info(`Bling Plugin: Product variant ${variant.id} not linked to Bling, skipping inventory sync`)
      return
    }

    // Execute the inventory sync workflow
    await syncInventoryWorkflow.run({
      input: {
        product_variant_id: variant.id,
        quantity: data.quantity,
        direction: "medusa-to-bling"
      },
      context: {
        container
      }
    })

    logger.info(`Bling Plugin: Successfully synced inventory for variant ${variant.id} to Bling`)
  } catch (error) {
    logger.error(`Bling Plugin: Failed to sync inventory for item ${data.inventory_item_id}:`, error)
    
    // Don't throw error to prevent inventory updates from failing
  }
}

export const config: SubscriberConfig = {
  event: [
    "inventory-level.updated",
    "inventory-level.created"
  ]
}