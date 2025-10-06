import { TransactionBaseService } from "@medusajs/medusa"
import axios from "axios"

// TODO: Move to a dedicated types file
interface BlingProduct {
  id: string
  nome: string
  codigo: string
  preco: number
  // ... outros campos do produto
}

class BlingService extends TransactionBaseService {
  private clientId: string;
  private clientSecret: string;
  private apiBaseUrl: string;

  constructor(container, options) {
    super(container)
    this.clientId = options.client_id;
    this.clientSecret = options.client_secret;
    // TODO: Use options.environment to switch between sandbox and production
    this.apiBaseUrl = "https://api.bling.com.br/Api/v3";
  }

  // TODO: Implement full OAuth2 flow to get and refresh token
  private async getAccessToken(): Promise<string> {
    // Placeholder: In a real scenario, this would implement the OAuth flow
    // and store/retrieve the token from the database.
    console.warn("Using placeholder for Bling Access Token!");
    // This token needs to be manually generated for now.
    return process.env.BLING_ACCESS_TOKEN;
  }

  /**
   * Fetches products and their stock levels from the Bling API.
   */
  async getProductsAndStock(): Promise<BlingProduct[]> {
    try {
      const accessToken = await this.getAccessToken();
      if (!accessToken) {
        throw new Error("Bling Access Token is not available.");
      }

      const response = await axios.get(`${this.apiBaseUrl}/produtos`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      console.log("Successfully fetched products from Bling API.");
      return response.data.data; // Assuming the products are in response.data.data
    } catch (error) {
      console.error("Failed to fetch products from Bling:", error.response?.data || error.message);
      return [];
    }
  }
}

export default BlingService;
