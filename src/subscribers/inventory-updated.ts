import {
  SubscriberConfig,
  SubscriberArgs,
} from "@medusajs/framework"
import { BlingService } from "../modules/bling/bling"

export default async function inventoryUpdatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{
  id: string
  variant_id: string
  inventory_item_id: string
  location_id: string
  stocked_quantity: number
  reserved_quantity: number
}>) {
  try {
    const manager = container.resolve("manager")

    // Check if Bling integration is enabled for inventory
    const configResult = await manager.query(`
      SELECT sync_inventory_enabled, sync_inventory_bidirectional
      FROM bling_configuration
      WHERE sync_inventory_enabled = true
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (configResult.length === 0 || !configResult[0].sync_inventory_bidirectional) {
      console.log("Bling inventory sync is disabled, skipping...")
      return
    }

    // Get variant data with Bling metadata
    const variantResult = await manager.query(`
      SELECT pv.id, pv.sku, pv.metadata, p.title
      FROM product_variant pv
      JOIN product p ON p.id = pv.product_id
      WHERE pv.id = $1 AND pv.metadata->>'bling_id' IS NOT NULL
    `, [data.variant_id])

    if (variantResult.length === 0) {
      console.log(`Variant ${data.variant_id} not linked to Bling product, skipping...`)
      return
    }

    const variant = variantResult[0]
    const blingProductId = variant.metadata.bling_id

    if (!blingProductId) {
      console.log(`Variant ${data.variant_id} has no Bling ID, skipping...`)
      return
    }

    console.log(`Syncing inventory for ${variant.title} (Bling ID: ${blingProductId}) to Bling...`)

    const blingService: BlingService = container.resolve("blingService")

    // Calculate available quantity (stocked - reserved)
    const availableQuantity = data.stocked_quantity - data.reserved_quantity

    try {
      // Update inventory in Bling
      await blingService.updateInventory(
        parseInt(blingProductId),
        availableQuantity,
        "entrada" // This should be calculated based on previous quantity
      )

      console.log(`Successfully updated inventory for Bling product ${blingProductId}: ${availableQuantity} units`)

      // Log the sync
      await manager.query(`
        INSERT INTO bling_sync_log (
          entity_type, entity_id, bling_id, action, status, details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        "inventory",
        data.variant_id,
        blingProductId,
        "update_inventory",
        "success",
        JSON.stringify({
          stocked_quantity: data.stocked_quantity,
          reserved_quantity: data.reserved_quantity,
          available_quantity: availableQuantity
        })
      ])

    } catch (error: any) {
      console.error(`Failed to update inventory for Bling product ${blingProductId}:`, error)

      // Log the error
      await manager.query(`
        INSERT INTO bling_sync_log (
          entity_type, entity_id, bling_id, action, status, error_message, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `, [
        "inventory",
        data.variant_id,
        blingProductId,
        "update_inventory",
        "error",
        error.message
      ])
    }

  } catch (error) {
    console.error(`Error in inventoryUpdatedHandler for variant ${data.variant_id}:`, error)
  }
}

export const config: SubscriberConfig = {
  event: "inventory-item.updated",
  context: {
    subscriberId: "bling-inventory-updated",
  },
}