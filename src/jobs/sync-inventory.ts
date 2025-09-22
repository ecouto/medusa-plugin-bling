import { ScheduledJobConfig, ScheduledJobArgs } from "@medusajs/framework"
import { BlingService } from "../modules/bling/bling"

export default async function syncInventoryJob({
  container,
}: ScheduledJobArgs) {
  try {
    const manager = container.resolve("manager")

    // Check if inventory sync is enabled
    const configResult = await manager.query(`
      SELECT * FROM bling_configuration
      WHERE sync_inventory_enabled = true AND sync_inventory_bidirectional = true
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (configResult.length === 0) {
      console.log("Inventory sync is disabled, skipping scheduled job")
      return
    }

    const config = configResult[0]
    const blingService: BlingService = container.resolve("blingService")

    console.log("Starting scheduled inventory sync job...")

    // Get all variants linked to Bling products
    const variantsResult = await manager.query(`
      SELECT pv.id, pv.metadata, p.title, p.handle
      FROM product_variant pv
      JOIN product p ON p.id = pv.product_id
      WHERE pv.metadata->>'bling_id' IS NOT NULL
      ORDER BY p.title
    `)

    let syncedCount = 0
    let errorCount = 0

    for (const variant of variantsResult) {
      try {
        const blingProductId = parseInt(variant.metadata.bling_id)

        // Get current inventory from Bling
        const blingProduct = await blingService.getProduct(blingProductId)

        if (blingProduct.estoque) {
          // Get current Medusa inventory
          const inventoryResult = await manager.query(`
            SELECT ili.stocked_quantity, ili.reserved_quantity
            FROM inventory_level il
            JOIN inventory_item ili ON ili.id = il.inventory_item_id
            WHERE il.variant_id = $1
            LIMIT 1
          `, [variant.id])

          if (inventoryResult.length > 0) {
            const currentInventory = inventoryResult[0]
            const currentAvailable = currentInventory.stocked_quantity - currentInventory.reserved_quantity

            // Compare with Bling inventory (assuming Bling has a quantity field)
            const blingQuantity = blingProduct.estoque.minimo || 0

            if (Math.abs(currentAvailable - blingQuantity) > 0) {
              // Update Medusa inventory to match Bling
              await manager.query(`
                UPDATE inventory_level SET
                  stocked_quantity = $1,
                  updated_at = NOW()
                WHERE variant_id = $2
              `, [
                blingQuantity + currentInventory.reserved_quantity,
                variant.id
              ])

              console.log(
                `Updated inventory for ${variant.title}: ${currentAvailable} → ${blingQuantity}`
              )

              // Log the sync
              await manager.query(`
                INSERT INTO bling_sync_log (
                  entity_type, entity_id, bling_id, action, status, details, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
              `, [
                "inventory",
                variant.id,
                blingProductId.toString(),
                "sync_from_bling",
                "success",
                JSON.stringify({
                  previous_quantity: currentAvailable,
                  new_quantity: blingQuantity,
                  source: "scheduled_job"
                })
              ])

              syncedCount++
            }
          }
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: any) {
        console.error(`Error syncing inventory for variant ${variant.id}:`, error)
        errorCount++

        // Log the error
        await manager.query(`
          INSERT INTO bling_sync_log (
            entity_type, entity_id, bling_id, action, status, error_message, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          "inventory",
          variant.id,
          variant.metadata.bling_id,
          "sync_from_bling",
          "error",
          error.message
        ])
      }
    }

    // Update last sync timestamp
    await manager.query(`
      UPDATE bling_configuration SET
        last_sync = NOW(),
        updated_at = NOW()
      WHERE id = (
        SELECT id FROM bling_configuration
        WHERE sync_inventory_enabled = true
        ORDER BY updated_at DESC
        LIMIT 1
      )
    `)

    console.log(
      `Inventory sync job completed. Synced: ${syncedCount}, Errors: ${errorCount}, Total checked: ${variantsResult.length}`
    )

  } catch (error) {
    console.error("Scheduled inventory sync job failed:", error)
  }
}

export const config: ScheduledJobConfig = {
  name: "bling-sync-inventory",
  cron: "0 */1 * * *", // Every hour
  data: {
    description: "Sync inventory levels from Bling to Medusa"
  }
}