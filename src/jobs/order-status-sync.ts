import { JobConfig } from "@medusajs/medusa"

export default async function orderStatusSync(container: any) {
  const logger = container.resolve("logger")
  const orderService = container.resolve("orderService")
  const blingService = container.resolve("blingService")

  try {
    logger.info("Bling Plugin: Starting order status sync job")

    // Get orders that are linked to Bling and not completed/canceled
    const orders = await orderService.list({
      status: ["pending", "requires_action"]
    }, {
      relations: ["metadata"],
      take: 50 // Process in batches
    })

    const linkedOrders = orders.filter(order => 
      order.metadata?.bling_id && !order.metadata?.bling_completed
    )

    logger.info(`Bling Plugin: Found ${linkedOrders.length} orders to sync status from Bling`)

    for (const order of linkedOrders) {
      try {
        const blingOrderId = parseInt(order.metadata.bling_id)
        const blingOrder = await blingService.getOrder(blingOrderId)

        // Update order status based on Bling status
        let shouldUpdate = false
        const updates: any = {
          metadata: {
            ...order.metadata,
            bling_status: blingOrder.situacao?.valor,
            bling_status_updated_at: new Date().toISOString()
          }
        }

        // Check if order is completed in Bling
        if (blingOrder.situacao?.valor === 6) { // Entregue
          updates.status = "completed"
          updates.metadata.bling_completed = true
          shouldUpdate = true
        } else if (blingOrder.situacao?.valor === 9) { // Cancelado
          updates.status = "canceled"
          updates.metadata.bling_completed = true
          shouldUpdate = true
        } else if (blingOrder.situacao?.valor !== order.metadata?.bling_status) {
          // Status changed but not completed yet
          shouldUpdate = true
        }

        if (shouldUpdate) {
          await orderService.update(order.id, updates)
          logger.info(`Bling Plugin: Updated order ${order.id} status from Bling (status: ${blingOrder.situacao?.valor})`)
        }
      } catch (error) {
        logger.error(`Bling Plugin: Failed to sync status for order ${order.id}:`, error)
        // Continue with other orders even if one fails
      }
    }

    logger.info("Bling Plugin: Order status sync job completed")
  } catch (error) {
    logger.error("Bling Plugin: Order status sync job failed:", error)
    throw error
  }
}

export const config: JobConfig = {
  name: "bling-order-status-sync",
  schedule: "*/30 * * * *", // Run every 30 minutes
}