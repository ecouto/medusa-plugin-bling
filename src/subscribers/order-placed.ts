import {
  SubscriberConfig,
  SubscriberArgs,
  OrderService
} from "@medusajs/framework"
import { syncOrderToBlingWorkflow } from "../workflows/sync-order-to-bling"

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const manager = container.resolve("manager")

    // Check if Bling integration is enabled
    const configResult = await manager.query(`
      SELECT sync_orders_enabled, sync_orders_auto_send
      FROM bling_configuration
      WHERE sync_orders_enabled = true
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (configResult.length === 0 || !configResult[0].sync_orders_auto_send) {
      console.log("Bling order sync is disabled, skipping...")
      return
    }

    // Get the complete order data
    const orderService: OrderService = container.resolve("orderService")
    const order = await orderService.retrieveOrder(data.id, {
      relations: [
        "customer",
        "items",
        "items.variant",
        "items.variant.product",
        "shipping_address",
        "billing_address"
      ]
    })

    if (!order) {
      console.error(`Order ${data.id} not found`)
      return
    }

    console.log(`Syncing order ${order.display_id} to Bling...`)

    // Execute the sync workflow
    const { result } = await syncOrderToBlingWorkflow.run({
      input: {
        order_id: order.id,
        medusa_order: order,
        force_sync: false
      },
      container
    })

    if (result.bling_result.success) {
      console.log(`Order ${order.display_id} successfully synced to Bling. Bling ID: ${result.bling_result.bling_id}`)
    } else {
      console.error(`Failed to sync order ${order.display_id} to Bling:`, result.bling_result.error)
    }

  } catch (error) {
    console.error(`Error in orderPlacedHandler for order ${data.id}:`, error)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
  context: {
    subscriberId: "bling-order-placed",
  },
}