import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BlingService } from "../../../modules/bling/bling"

interface BlingWebhookPayload {
  eventId: string
  date: string
  version: string
  event: string
  companyId: number
  data: {
    id: number
    [key: string]: any
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const payload = req.body as BlingWebhookPayload
    const signature = req.headers['x-bling-signature'] as string

    console.log(`Received Bling webhook: ${payload.event} for entity ${payload.data.id}`)

    // Validate webhook signature
    const blingService: BlingService = req.scope.resolve("blingService")
    const isValid = await blingService.validateWebhook(
      JSON.stringify(req.body),
      signature
    )

    if (!isValid) {
      console.error("Invalid webhook signature")
      return res.status(401).json({ error: "Invalid signature" })
    }

    const manager = req.scope.resolve("manager")

    // Log the webhook event
    await manager.query(`
      INSERT INTO bling_webhook_log (
        event_id, event_type, entity_id, payload, received_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      payload.eventId,
      payload.event,
      payload.data.id,
      JSON.stringify(payload)
    ])

    // Process webhook based on event type
    switch (payload.event) {
      case "product.created":
      case "product.updated":
        await handleProductWebhook(payload, manager)
        break

      case "order.created":
      case "order.updated":
        await handleOrderWebhook(payload, manager)
        break

      case "inventory.updated":
        await handleInventoryWebhook(payload, manager, blingService)
        break

      default:
        console.log(`Unhandled webhook event: ${payload.event}`)
    }

    // Respond with success
    return res.status(200).json({ received: true })

  } catch (error: any) {
    console.error("Webhook processing error:", error)
    return res.status(500).json({ error: "Internal server error" })
  }
}

async function handleProductWebhook(payload: BlingWebhookPayload, manager: any) {
  try {
    const blingProductId = payload.data.id

    // Check if we have a corresponding Medusa product
    const productResult = await manager.query(`
      SELECT id FROM product
      WHERE metadata->>'bling_id' = $1
    `, [blingProductId.toString()])

    if (productResult.length === 0) {
      console.log(`No Medusa product found for Bling product ${blingProductId}`)
      return
    }

    // TODO: Implement product sync from Bling to Medusa
    // This would fetch the updated product data from Bling API
    // and update the corresponding Medusa product

    console.log(`Product webhook processed for Bling ID ${blingProductId}`)

  } catch (error) {
    console.error("Error handling product webhook:", error)
  }
}

async function handleOrderWebhook(payload: BlingWebhookPayload, manager: any) {
  try {
    const blingOrderId = payload.data.id

    // Find corresponding Medusa order
    const orderResult = await manager.query(`
      SELECT id, display_id FROM "order"
      WHERE metadata->>'bling_id' = $1
    `, [blingOrderId.toString()])

    if (orderResult.length === 0) {
      console.log(`No Medusa order found for Bling order ${blingOrderId}`)
      return
    }

    const order = orderResult[0]

    // TODO: Implement order status sync from Bling to Medusa
    // This would update the order status based on Bling data

    console.log(`Order webhook processed for Medusa order ${order.display_id}`)

  } catch (error) {
    console.error("Error handling order webhook:", error)
  }
}

async function handleInventoryWebhook(
  payload: BlingWebhookPayload,
  manager: any,
  blingService: BlingService
) {
  try {
    const blingProductId = payload.data.id

    // Check if inventory sync is enabled
    const configResult = await manager.query(`
      SELECT sync_inventory_enabled, sync_inventory_bidirectional
      FROM bling_configuration
      WHERE sync_inventory_enabled = true
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (configResult.length === 0 || !configResult[0].sync_inventory_bidirectional) {
      console.log("Inventory bidirectional sync is disabled, skipping...")
      return
    }

    // Find corresponding Medusa variant
    const variantResult = await manager.query(`
      SELECT pv.id, p.title
      FROM product_variant pv
      JOIN product p ON p.id = pv.product_id
      WHERE pv.metadata->>'bling_id' = $1
    `, [blingProductId.toString()])

    if (variantResult.length === 0) {
      console.log(`No Medusa variant found for Bling product ${blingProductId}`)
      return
    }

    const variant = variantResult[0]

    // Get updated inventory from Bling
    const blingProduct = await blingService.getProduct(blingProductId)

    if (blingProduct.estoque) {
      // TODO: Update Medusa inventory levels
      // This would update the inventory item quantities in Medusa

      console.log(`Inventory webhook processed for ${variant.title}`)
    }

  } catch (error) {
    console.error("Error handling inventory webhook:", error)
  }
}

// Create webhook tables if they don't exist
export async function ensureWebhookTables(manager: any) {
  await manager.query(`
    CREATE TABLE IF NOT EXISTS bling_webhook_log (
      id SERIAL PRIMARY KEY,
      event_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      payload JSONB NOT NULL,
      processed BOOLEAN DEFAULT false,
      received_at TIMESTAMP DEFAULT NOW()
    )
  `)

  await manager.query(`
    CREATE TABLE IF NOT EXISTS bling_sync_log (
      id SERIAL PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      bling_id TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      details JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `)
}