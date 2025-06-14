import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"

export default async function productBlingSync({
  data,
  eventName,
  container,
  pluginOptions
}: SubscriberArgs<{ id: string }>) {
  // This subscriber handles product updates from Medusa to Bling
  // For now, we focus on order sync as it's more critical
  
  const logger = container.resolve("logger")
  
  try {
    logger.info(`Bling Plugin: Processing ${eventName} for product ${data.id}`)
    
    // Get the product to check if it's linked to Bling
    const productService = container.resolve("productService")
    const product = await productService.retrieve(data.id, {
      relations: ["variants"]
    })

    // Check if product has Bling ID in metadata
    const blingProductId = product.metadata?.bling_id

    if (!blingProductId) {
      logger.info(`Bling Plugin: Product ${data.id} not linked to Bling, skipping sync`)
      return
    }

    // For now, just log the event
    // In a full implementation, you would sync product changes back to Bling
    logger.info(`Bling Plugin: Product ${data.id} linked to Bling ID ${blingProductId}`)
    
  } catch (error) {
    logger.error(`Bling Plugin: Error processing product event for ${data.id}:`, error)
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated"
  ]
}