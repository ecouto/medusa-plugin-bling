// Minimal plugin export for build compatibility

export interface BlingPluginConfig {
  client_id?: string
  client_secret?: string
  environment?: 'sandbox' | 'production'
  webhook_secret?: string
  sync_config?: {
    products?: {
      enabled?: boolean
      auto_sync?: boolean
    }
    orders?: {
      enabled?: boolean
      auto_send_to_bling?: boolean
    }
    inventory?: {
      enabled?: boolean
      bidirectional_sync?: boolean
    }
  }
}

export default function blingPlugin(config: BlingPluginConfig = {}) {
  return {
    name: "medusa-plugin-bling",
    version: "3.0.0-alpha.1",
    config
  }
}

// Basic types for external use
export interface BlingProduct {
  id: string
  nome: string
  codigo?: string
  preco: number
  situacao: "A" | "I"
}

export interface BlingOrder {
  id: string
  numero: string
  contato: {
    nome: string
    email?: string
  }
  data: string
  desconto: number
  observacoes?: string
  parcelas: Array<{
    dataVencimento: string
    valor: number
  }>
  transporte: {
    transportador?: string
    codigoRastreamento?: string
  }
  itens: Array<{
    produto: {
      id: string
      nome: string
      codigo?: string
    }
    quantidade: number
    valor: number
  }>
}