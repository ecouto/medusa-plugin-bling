import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { syncOrderToBlingWorkflow } from "../workflows"

export default async function orderBlingSync({
  data,
  eventName,
  container,
  pluginOptions
}: SubscriberArgs<{ id: string }>) {
  // Check if auto sync is enabled
  if (!pluginOptions?.auto_sync_orders) {
    return
  }

  const logger = container.resolve("logger")

  try {
    logger.info(`Bling Plugin: Processing ${eventName} for order ${data.id}`)

    // Execute the sync workflow
    await syncOrderToBlingWorkflow.run({
      input: {
        order_id: data.id
      },
      context: {
        container
      }
    })

    logger.info(`Bling Plugin: Successfully synced order ${data.id} to Bling`)
  } catch (error) {
    logger.error(`Bling Plugin: Failed to sync order ${data.id} to Bling:`, error)
    
    // Don't throw error to prevent order creation from failing
    // The error is already logged and stored in order metadata
  }
}

export const config: SubscriberConfig = {
  event: [
    "order.placed",
    "order.completed"
  ]
}