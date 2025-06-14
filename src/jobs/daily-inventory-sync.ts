import { JobConfig } from "@medusajs/medusa"
import { syncInventoryWorkflow } from "../workflows"

export default async function dailyInventorySync(container: any) {
  const logger = container.resolve("logger")
  const productVariantService = container.resolve("productVariantService")

  try {
    logger.info("Bling Plugin: Starting daily inventory sync job")

    // Get all product variants that are linked to Bling
    const variants = await productVariantService.list({}, {
      relations: ["product"],
      take: 100 // Process in batches to avoid memory issues
    })

    const linkedVariants = variants.filter(variant => 
      variant.product?.metadata?.bling_id || variant.metadata?.bling_id
    )

    logger.info(`Bling Plugin: Found ${linkedVariants.length} variants linked to Bling`)

    // Sync inventory for each linked variant
    for (const variant of linkedVariants) {
      try {
        await syncInventoryWorkflow.run({
          input: {
            product_variant_id: variant.id,
            quantity: 0, // This will be ignored when direction is bling-to-medusa
            direction: "bling-to-medusa"
          },
          context: {
            container
          }
        })

        logger.info(`Bling Plugin: Synced inventory for variant ${variant.id}`)
      } catch (error) {
        logger.error(`Bling Plugin: Failed to sync inventory for variant ${variant.id}:`, error)
        // Continue with other variants even if one fails
      }
    }

    logger.info("Bling Plugin: Daily inventory sync job completed")
  } catch (error) {
    logger.error("Bling Plugin: Daily inventory sync job failed:", error)
    throw error
  }
}

export const config: JobConfig = {
  name: "bling-daily-inventory-sync",
  schedule: "0 2 * * *", // Run daily at 2 AM
}