import { Module } from "@medusajs/framework/utils"
import BlingService from "./modules/bling/bling"

// Export types for consumers
export * from "./modules/bling/types"
export * from "./modules/bling/utils"

// Export the service for direct usage
export { BlingService }

// Plugin configuration interface
export interface BlingPluginOptions {
  client_id?: string
  client_secret?: string
  access_token?: string
  refresh_token?: string
  environment?: "production" | "sandbox"
  webhook_secret?: string

  // Sync configuration toggles
  sync_config?: {
    products?: {
      enabled?: boolean
      import_images?: boolean
      import_descriptions?: boolean
      import_prices?: boolean
      import_categories?: boolean
      auto_sync?: boolean
    }
    orders?: {
      enabled?: boolean
      auto_send_to_bling?: boolean
      generate_nfe?: boolean
      update_status?: boolean
    }
    inventory?: {
      enabled?: boolean
      bidirectional_sync?: boolean
      auto_sync_interval?: number // minutes
    }
  }
}

// Default configuration
const defaultConfig: BlingPluginOptions["sync_config"] = {
  products: {
    enabled: true,
    import_images: false, // Default: don't import images
    import_descriptions: true,
    import_prices: true,
    import_categories: true,
    auto_sync: false
  },
  orders: {
    enabled: true,
    auto_send_to_bling: true,
    generate_nfe: false,
    update_status: true
  },
  inventory: {
    enabled: true,
    bidirectional_sync: true,
    auto_sync_interval: 60 // 1 hour
  }
}

// Main plugin module
export default Module("blingModule", {
  service: BlingService,
  options: (options: BlingPluginOptions) => ({
    ...options,
    sync_config: {
      ...defaultConfig,
      ...options.sync_config,
      products: {
        ...defaultConfig.products,
        ...options.sync_config?.products
      },
      orders: {
        ...defaultConfig.orders,
        ...options.sync_config?.orders
      },
      inventory: {
        ...defaultConfig.inventory,
        ...options.sync_config?.inventory
      }
    }
  })
})