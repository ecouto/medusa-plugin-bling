import { useState, useEffect } from "react"

interface BlingConfig {
  client_id: string
  client_secret: string
  environment: "production" | "sandbox"
  sync_products_enabled: boolean
  sync_products_import_images: boolean
  sync_products_import_descriptions: boolean
  sync_products_import_prices: boolean
  sync_products_import_categories: boolean
  sync_products_auto_sync: boolean
  sync_orders_enabled: boolean
  sync_orders_auto_send: boolean
  sync_orders_generate_nfe: boolean
  sync_orders_update_status: boolean
  sync_inventory_enabled: boolean
  sync_inventory_bidirectional: boolean
  sync_inventory_interval: number
  is_connected?: boolean
  last_sync?: string
}

export function useBlingConfig() {
  const [config, setConfig] = useState<BlingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = async () => {
    try {
      setLoading(true)
      const response = await fetch("/admin/bling/config")
      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      } else {
        setError("Failed to load configuration")
      }
    } catch (err) {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async (newConfig: Partial<BlingConfig>) => {
    try {
      setLoading(true)
      const response = await fetch("/admin/bling/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newConfig),
      })

      if (response.ok) {
        await loadConfig() // Reload config
        return true
      } else {
        setError("Failed to save configuration")
        return false
      }
    } catch (err) {
      setError("Network error")
      return false
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfig()
  }, [])

  return {
    config,
    loading,
    error,
    loadConfig,
    saveConfig,
  }
}