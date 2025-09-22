import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "zod"

// Configuration schema for validation
const blingConfigSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  environment: z.enum(["production", "sandbox"]),

  // Sync configurations
  sync_products_enabled: z.boolean(),
  sync_products_import_images: z.boolean(),
  sync_products_import_descriptions: z.boolean(),
  sync_products_import_prices: z.boolean(),
  sync_products_import_categories: z.boolean(),
  sync_products_auto_sync: z.boolean(),

  sync_orders_enabled: z.boolean(),
  sync_orders_auto_send: z.boolean(),
  sync_orders_generate_nfe: z.boolean(),
  sync_orders_update_status: z.boolean(),

  sync_inventory_enabled: z.boolean(),
  sync_inventory_bidirectional: z.boolean(),
  sync_inventory_interval: z.number().min(15),
})

type BlingConfig = z.infer<typeof blingConfigSchema>

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const manager = req.scope.resolve("manager")

    // Check if configuration table exists, create if not
    await ensureConfigTable(manager)

    const result = await manager.query(`
      SELECT * FROM bling_configuration
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (result.length === 0) {
      return res.json({
        client_id: "",
        client_secret: "",
        environment: "production",
        sync_products_enabled: true,
        sync_products_import_images: false,
        sync_products_import_descriptions: true,
        sync_products_import_prices: true,
        sync_products_import_categories: true,
        sync_products_auto_sync: false,
        sync_orders_enabled: true,
        sync_orders_auto_send: true,
        sync_orders_generate_nfe: false,
        sync_orders_update_status: true,
        sync_inventory_enabled: true,
        sync_inventory_bidirectional: true,
        sync_inventory_interval: 60,
        is_connected: false,
        last_sync: null
      })
    }

    const config = result[0]

    // Check connection status
    const blingService = req.scope.resolve("blingService")
    let isConnected = false
    try {
      await blingService.authenticate()
      isConnected = true
    } catch (error) {
      isConnected = false
    }

    return res.json({
      ...config,
      client_secret: "***", // Don't expose the secret
      is_connected: isConnected
    })

  } catch (error) {
    console.error("Error loading Bling configuration:", error)
    return res.status(500).json({ error: "Failed to load configuration" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const validatedData = blingConfigSchema.parse(req.body)
    const manager = req.scope.resolve("manager")

    await ensureConfigTable(manager)

    // Insert or update configuration
    await manager.query(`
      INSERT INTO bling_configuration (
        client_id, client_secret, environment,
        sync_products_enabled, sync_products_import_images, sync_products_import_descriptions,
        sync_products_import_prices, sync_products_import_categories, sync_products_auto_sync,
        sync_orders_enabled, sync_orders_auto_send, sync_orders_generate_nfe, sync_orders_update_status,
        sync_inventory_enabled, sync_inventory_bidirectional, sync_inventory_interval,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        client_id = $1, client_secret = $2, environment = $3,
        sync_products_enabled = $4, sync_products_import_images = $5, sync_products_import_descriptions = $6,
        sync_products_import_prices = $7, sync_products_import_categories = $8, sync_products_auto_sync = $9,
        sync_orders_enabled = $10, sync_orders_auto_send = $11, sync_orders_generate_nfe = $12, sync_orders_update_status = $13,
        sync_inventory_enabled = $14, sync_inventory_bidirectional = $15, sync_inventory_interval = $16,
        updated_at = NOW()
    `, [
      validatedData.client_id,
      validatedData.client_secret,
      validatedData.environment,
      validatedData.sync_products_enabled,
      validatedData.sync_products_import_images,
      validatedData.sync_products_import_descriptions,
      validatedData.sync_products_import_prices,
      validatedData.sync_products_import_categories,
      validatedData.sync_products_auto_sync,
      validatedData.sync_orders_enabled,
      validatedData.sync_orders_auto_send,
      validatedData.sync_orders_generate_nfe,
      validatedData.sync_orders_update_status,
      validatedData.sync_inventory_enabled,
      validatedData.sync_inventory_bidirectional,
      validatedData.sync_inventory_interval
    ])

    return res.json({ success: true })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid configuration data", details: error.errors })
    }

    console.error("Error saving Bling configuration:", error)
    return res.status(500).json({ error: "Failed to save configuration" })
  }
}

async function ensureConfigTable(manager: any) {
  await manager.query(`
    CREATE TABLE IF NOT EXISTS bling_configuration (
      id SERIAL PRIMARY KEY,
      client_id TEXT NOT NULL,
      client_secret TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'production',

      -- Product sync settings
      sync_products_enabled BOOLEAN DEFAULT true,
      sync_products_import_images BOOLEAN DEFAULT false,
      sync_products_import_descriptions BOOLEAN DEFAULT true,
      sync_products_import_prices BOOLEAN DEFAULT true,
      sync_products_import_categories BOOLEAN DEFAULT true,
      sync_products_auto_sync BOOLEAN DEFAULT false,

      -- Order sync settings
      sync_orders_enabled BOOLEAN DEFAULT true,
      sync_orders_auto_send BOOLEAN DEFAULT true,
      sync_orders_generate_nfe BOOLEAN DEFAULT false,
      sync_orders_update_status BOOLEAN DEFAULT true,

      -- Inventory sync settings
      sync_inventory_enabled BOOLEAN DEFAULT true,
      sync_inventory_bidirectional BOOLEAN DEFAULT true,
      sync_inventory_interval INTEGER DEFAULT 60,

      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `)
}