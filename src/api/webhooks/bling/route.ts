import { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import { BlingWebhookEvent } from "../../../types"
import { syncProductFromBlingWorkflow } from "../../../workflows"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const blingService = req.scope.resolve("blingService")
  const logger = req.scope.resolve("logger")

  try {
    // Get raw body for signature validation
    const rawBody = JSON.stringify(req.body)
    const signature = req.headers["x-bling-signature"] as string

    // Validate webhook signature
    const isValid = await blingService.validateWebhook(rawBody, signature)
    if (!isValid) {
      logger.warn("Bling Plugin: Invalid webhook signature")
      return res.status(401).json({ error: "Invalid signature" })
    }

    const webhookEvent: BlingWebhookEvent = req.body
    logger.info(`Bling Plugin: Received webhook event: ${webhookEvent.topic}.${webhookEvent.event}`)

    // Handle different webhook events
    switch (webhookEvent.topic) {
      case "produto":
        await handleProductWebhook(webhookEvent, req.scope)
        break
        
      case "pedido":
        await handleOrderWebhook(webhookEvent, req.scope)
        break
        
      case "estoque":
        await handleInventoryWebhook(webhookEvent, req.scope)
        break
        
      default:
        logger.info(`Bling Plugin: Unhandled webhook topic: ${webhookEvent.topic}`)
    }

    res.status(200).json({ success: true })
  } catch (error) {
    logger.error("Bling Plugin: Webhook processing error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}

async function handleProductWebhook(event: BlingWebhookEvent, scope: any) {
  const logger = scope.resolve("logger")

  try {
    switch (event.event) {
      case "created":
      case "updated":
        // Sync product from Bling to Medusa
        await syncProductFromBlingWorkflow.run({
          input: {
            bling_product_id: event.data.id
          },
          context: {
            container: scope
          }
        })
        logger.info(`Bling Plugin: Synced product ${event.data.id} from Bling`)
        break
        
      case "deleted":
        // Handle product deletion
        const productService = scope.resolve("productService")
        const products = await productService.list({
          metadata: {
            bling_id: event.data.id.toString()
          }
        })
        
        if (products.length > 0) {
          await productService.update(products[0].id, {
            status: "draft", // Don't delete, just deactivate
            metadata: {
              ...products[0].metadata,
              bling_deleted_at: new Date().toISOString()
            }
          })
          logger.info(`Bling Plugin: Deactivated product ${products[0].id} due to Bling deletion`)
        }
        break
    }
  } catch (error) {
    logger.error(`Bling Plugin: Error handling product webhook:`, error)
    throw error
  }
}

async function handleOrderWebhook(event: BlingWebhookEvent, scope: any) {
  const logger = scope.resolve("logger")
  const orderService = scope.resolve("orderService")

  try {
    switch (event.event) {
      case "updated":
        // Find Medusa order by Bling ID
        const orders = await orderService.list({
          metadata: {
            bling_id: event.data.id.toString()
          }
        })

        if (orders.length > 0) {
          const blingService = scope.resolve("blingService")
          const blingOrder = await blingService.getOrder(event.data.id)
          
          // Update order status based on Bling status
          let medusaStatus = "pending"
          if (blingOrder.situacao?.valor === 6) { // Entregue
            medusaStatus = "completed"
          } else if (blingOrder.situacao?.valor === 9) { // Cancelado
            medusaStatus = "canceled"
          }

          await orderService.update(orders[0].id, {
            metadata: {
              ...orders[0].metadata,
              bling_status: blingOrder.situacao?.valor,
              bling_updated_at: new Date().toISOString()
            }
          })

          logger.info(`Bling Plugin: Updated order ${orders[0].id} status from Bling`)
        }
        break
    }
  } catch (error) {
    logger.error(`Bling Plugin: Error handling order webhook:`, error)
    throw error
  }
}

async function handleInventoryWebhook(event: BlingWebhookEvent, scope: any) {
  const logger = scope.resolve("logger")

  try {
    // Handle inventory updates from Bling
    logger.info(`Bling Plugin: Processing inventory webhook for product ${event.data.id}`)
    
    // This would typically trigger an inventory sync workflow
    // For now, just log the event
    logger.info(`Bling Plugin: Inventory event processed for product ${event.data.id}`)
  } catch (error) {
    logger.error(`Bling Plugin: Error handling inventory webhook:`, error)
    throw error
  }
}