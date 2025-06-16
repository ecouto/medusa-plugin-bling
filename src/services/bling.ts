import axios, { AxiosInstance } from "axios"
import { 
  BlingPluginOptions, 
  BlingAuthResponse, 
  BlingProduct, 
  BlingOrder, 
  BlingApiResponse,
  BlingApiError 
} from "../types"

interface SavedBlingToken {
  access_token: string
  refresh_token: string
  expires_at: Date
}

class BlingService {
  static identifier = "blingService"
  private client: AxiosInstance
  private options: BlingPluginOptions
  private accessToken: string | null = null
  private container: any

  constructor(container: any, options: BlingPluginOptions) {
    // Medusa v2 passa container como primeiro parâmetro
    this.container = container
    this.options = options || {}
    this.accessToken = this.options.access_token || null

    const baseURL = this.options.environment === "production" 
      ? "https://www.bling.com.br/Api/v3"
      : "https://sandbox.bling.com.br/Api/v3"

    this.client = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    })

    this.setupInterceptors()
    
    // Tentar renovar token se parece estar expirado
    this.initializeAuth()
  }

  private async initializeAuth(): Promise<void> {
    try {
      // Fazer inicialização em background para não bloquear o Medusa
      setTimeout(async () => {
        await this.ensureValidToken()
      }, 2000) // Aguardar 2s após inicialização completa do Medusa
    } catch (error) {
      // Ignorar erros de inicialização para não bloquear o Medusa
      console.warn("Bling: Inicialização com warnings, mas plugin disponível")
    }
  }

  // 🚀 RENOVAÇÃO AUTOMÁTICA DE TOKEN - Funciona 24/7 sem intervenção manual
  private async ensureValidToken(): Promise<string> {
    try {
      // 1. Tentar recuperar token salvo do banco
      const savedToken = await this.getTokenFromDatabase()
      
      // 2. Se token válido (não expira nos próximos 30 min), usar
      const now = new Date()
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)
      
      if (savedToken && new Date(savedToken.expires_at) > thirtyMinutesFromNow) {
        this.accessToken = savedToken.access_token
        console.log("Bling: Token válido recuperado do banco")
        return this.accessToken
      }
      
      // 3. Token expirado ou não existe, renovar automaticamente
      console.log("Bling: Token expirado, renovando automaticamente...")
      const newTokenData = await this.refreshAccessToken()
      
      // 4. Salvar novo token no banco para próximas inicializações
      await this.saveTokenToDatabase(newTokenData)
      
      console.log("Bling: Token renovado e salvo automaticamente!")
      return this.accessToken!
      
    } catch (error: any) {
      console.warn(`Bling: Não foi possível renovar token automaticamente: ${error.message}`)
      // Usar token das configurações como fallback
      return this.options.access_token || ''
    }
  }

  private async getTokenFromDatabase(): Promise<SavedBlingToken | null> {
    try {
      // Usar query direta no PostgreSQL via container
      const query = `
        SELECT access_token, refresh_token, expires_at 
        FROM bling_tokens 
        ORDER BY created_at DESC 
        LIMIT 1
      `
      
      // Tentar acessar o banco via container do Medusa
      if (this.container?.resolve) {
        const manager = this.container.resolve("manager")
        const result = await manager.query(query)
        
        if (result && result.length > 0) {
          return {
            access_token: result[0].access_token,
            refresh_token: result[0].refresh_token,
            expires_at: new Date(result[0].expires_at)
          }
        }
      }
    } catch (error) {
      // Ignorar erros - primeira vez ou tabela não existe ainda
      console.log("Bling: Primeira inicialização ou tabela bling_tokens não existe")
    }
    
    return null
  }

  private async saveTokenToDatabase(tokenData: BlingAuthResponse): Promise<void> {
    try {
      // Calcular quando o token expira (6 horas - 30 min de margem)
      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in - 1800) // -30 min de margem
      
      // Criar tabela se não existir
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS bling_tokens (
          id SERIAL PRIMARY KEY,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `
      
      // Insert do novo token
      const insertQuery = `
        INSERT INTO bling_tokens (access_token, refresh_token, expires_at)
        VALUES ($1, $2, $3)
      `
      
      if (this.container?.resolve) {
        const manager = this.container.resolve("manager")
        await manager.query(createTableQuery)
        await manager.query(insertQuery, [
          tokenData.access_token,
          tokenData.refresh_token,
          expiresAt
        ])
        
        console.log(`Bling: Token salvo no banco (expira em ${Math.round(tokenData.expires_in/3600)}h)`)
      }
    } catch (error: any) {
      console.warn(`Bling: Não foi possível salvar token no banco: ${error.message}`)
      // Não é crítico, o token ainda funciona em memória
    }
  }

  private setupInterceptors() {
    this.client.interceptors.request.use((config) => {
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`
      }
      return config
    })

    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && this.options.refresh_token) {
          try {
            await this.refreshAccessToken()
            const originalRequest = error.config
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`
            return this.client.request(originalRequest)
          } catch (refreshError) {
            throw new Error("Failed to refresh Bling access token")
          }
        }
        throw error
      }
    )
  }

  async authenticate(): Promise<BlingAuthResponse> {
    // If we already have an access token, use it
    if (this.accessToken) {
      return {
        access_token: this.accessToken,
        refresh_token: this.options.refresh_token || '',
        expires_in: 21600,
        token_type: 'Bearer'
      }
    }

    // If we have a stored access token in options, use it
    if (this.options.access_token) {
      this.accessToken = this.options.access_token
      return {
        access_token: this.accessToken,
        refresh_token: this.options.refresh_token || '',
        expires_in: 21600,
        token_type: 'Bearer'
      }
    }

    throw new Error(`Bling authentication failed: No access token available. Please configure BLING_ACCESS_TOKEN in your environment or use the authorization flow.`)
  }

  async refreshAccessToken(): Promise<BlingAuthResponse> {
    try {
      const credentials = Buffer.from(`${this.options.client_id}:${this.options.client_secret}`).toString('base64')
      
      const response = await axios.post("https://www.bling.com.br/Api/v3/oauth/token", 
        `grant_type=refresh_token&refresh_token=${this.options.refresh_token}`,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`
          }
        }
      )

      const authData: BlingAuthResponse = response.data
      this.accessToken = authData.access_token
      
      return authData
    } catch (error: any) {
      throw new Error(`Bling token refresh failed: ${error?.response?.data?.error || error?.message || 'Unknown error'}`)
    }
  }

  async createProduct(product: Partial<BlingProduct>): Promise<BlingProduct> {
    try {
      const response = await this.client.post("/produtos", product)
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "create product")
    }
  }

  async getProduct(id: number): Promise<BlingProduct> {
    try {
      const response = await this.client.get(`/produtos/${id}`)
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "get product")
    }
  }

  async updateProduct(id: number, product: Partial<BlingProduct>): Promise<BlingProduct> {
    try {
      const response = await this.client.put(`/produtos/${id}`, product)
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "update product")
    }
  }

  async listProducts(params?: any): Promise<BlingProduct[]> {
    try {
      const response = await this.client.get("/produtos", { params })
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "list products")
    }
  }

  async createOrder(order: Partial<BlingOrder>): Promise<BlingOrder> {
    try {
      const response = await this.client.post("/pedidos/vendas", order)
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "create order")
    }
  }

  async getOrder(id: number): Promise<BlingOrder> {
    try {
      const response = await this.client.get(`/pedidos/vendas/${id}`)
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "get order")
    }
  }

  async updateOrder(id: number, order: Partial<BlingOrder>): Promise<BlingOrder> {
    try {
      const response = await this.client.put(`/pedidos/vendas/${id}`, order)
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "update order")
    }
  }

  async listOrders(params?: any): Promise<BlingOrder[]> {
    try {
      const response = await this.client.get("/pedidos/vendas", { params })
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "list orders")
    }
  }

  async generateShippingLabel(orderId: number, transporterId?: number): Promise<any> {
    try {
      const response = await this.client.post(`/pedidos/vendas/${orderId}/gerar-etiqueta`, {
        transportadora: transporterId ? { id: transporterId } : undefined
      })
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "generate shipping label")
    }
  }

  async getShippingLabel(orderId: number): Promise<any> {
    try {
      const response = await this.client.get(`/pedidos/vendas/${orderId}/etiqueta`)
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "get shipping label")
    }
  }

  async updateInventory(productId: number, quantity: number, operation: "entrada" | "saida" = "entrada"): Promise<any> {
    try {
      const response = await this.client.post(`/produtos/${productId}/estoques`, {
        operacao: operation,
        quantidade: quantity,
        preco: 0,
        observacoes: "Sincronização via Medusa"
      })
      return response.data.data
    } catch (error) {
      this.handleApiError(error, "update inventory")
    }
  }

  private handleApiError(error: any, operation: string): never {
    const errorMessage = error?.response?.data?.error?.message || error?.message || 'Unknown error'
    const errorType = error?.response?.data?.error?.type || "unknown"
    
    console.error(`Bling API Error during ${operation}:`, {
      type: errorType,
      message: errorMessage,
      status: error?.response?.status,
      data: error?.response?.data
    })

    throw new Error(`Failed to ${operation}: ${errorMessage}`)
  }

  async validateWebhook(payload: string, signature: string): Promise<boolean> {
    if (!this.options.webhook_secret) {
      return true // Skip validation if no secret is configured
    }

    const crypto = require("crypto")
    const expectedSignature = crypto
      .createHmac("sha256", this.options.webhook_secret)
      .update(payload)
      .digest("hex")

    return signature === expectedSignature
  }
}

export default BlingService