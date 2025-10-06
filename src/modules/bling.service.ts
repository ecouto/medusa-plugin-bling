import { TransactionBaseService, Logger } from "@medusajs/medusa"
import { EntityManager, Repository } from "typeorm"
import axios from "axios"
import { BlingConfig } from "../models/bling-config.entity"

const BLING_CONFIG_ID = "bling_config";

type InjectedDependencies = {
  blingConfigRepository: Repository<BlingConfig>;
  logger: Logger;
  manager: EntityManager;
};

class BlingService extends TransactionBaseService {
  protected readonly logger_: Logger;
  protected readonly blingConfigRepository_: Repository<BlingConfig>;

  private apiBaseUrl: string;
  private oauthUrl: string;

  constructor(container: InjectedDependencies, options: Record<string, any>) {
    super(container)
    this.logger_ = container.logger;
    this.blingConfigRepository_ = container.blingConfigRepository;

    this.apiBaseUrl = "https://api.bling.com.br/Api/v3";
    this.oauthUrl = "https://www.bling.com.br/Api/v3/oauth";
  }

  async getBlingConfig(): Promise<BlingConfig | undefined> {
    return await this.blingConfigRepository_.findOne({ where: { id: BLING_CONFIG_ID } });
  }

  async saveBlingConfig(clientId: string, clientSecret: string): Promise<BlingConfig> {
    let config = await this.getBlingConfig();
    if (!config) {
      config = this.blingConfigRepository_.create({ id: BLING_CONFIG_ID });
    }
    config.client_id = clientId;
    config.client_secret = clientSecret;
    return await this.blingConfigRepository_.save(config);
  }

  async getAuthorizationUrl(redirectUri: string): Promise<string> {
    const config = await this.getBlingConfig();
    if (!config?.client_id) {
      throw new Error("Bling Client ID is not configured. Please save credentials first.");
    }

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.client_id,
      redirect_uri: redirectUri,
      state: "medusa-bling-auth", // TODO: Use a random state
    });
    return `${this.oauthUrl}/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string): Promise<{ success: boolean }> {
    try {
      const config = await this.getBlingConfig();
      if (!config?.client_id || !config?.client_secret) {
        throw new Error("Bling Client ID or Secret not configured.");
      }

      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("code", code);

      const response = await axios.post(`${this.oauthUrl}/token`, params, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      config.access_token = access_token;
      config.refresh_token = refresh_token;
      config.expires_in = expires_in;
      config.token_updated_at = new Date();

      await this.blingConfigRepository_.save(config);
      this.logger_.info("Bling OAuth token saved successfully.");
      return { success: true };
    } catch (error: unknown) {
      this.logger_.error("Bling OAuth callback failed:", (error as any).response?.data || (error as any).message);
      return { success: false };
    }
  }

  public async getAccessToken(): Promise<string> {
    const config = await this.getBlingConfig();
    if (!config?.access_token) {
      throw new Error("Bling access token not found. Please authenticate.");
    }

    // Check if token is expired (with a 5-minute buffer)
    const now = new Date();
    const expiryTime = new Date(config.token_updated_at!.getTime() + (config.expires_in! - 300) * 1000);

    if (now < expiryTime) {
      return config.access_token;
    }

    // Token is expired, refresh it
    this.logger_.info("Bling access token expired, refreshing...");
    try {
      if (!config?.client_id || !config?.client_secret || !config?.refresh_token) {
        throw new Error("Missing Bling credentials or refresh token for renewal.");
      }

      const params = new URLSearchParams();
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", config.refresh_token);

      const response = await axios.post(`${this.oauthUrl}/token`, params, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;
      
      config.access_token = access_token;
      config.refresh_token = refresh_token;
      config.expires_in = expires_in;
      config.token_updated_at = new Date();

      await this.blingConfigRepository_.save(config);
      this.logger_.info("Bling access token refreshed and saved successfully.");
      return config.access_token;
    } catch (error: unknown) {
      this.logger_.error("Failed to refresh Bling access token:", (error as any).response?.data || (error as any).message);
      throw new Error("Failed to refresh Bling token.");
    }
  }

  async getProductsAndStock(): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await axios.get(`${this.apiBaseUrl}/produtos`, {
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      this.logger_.info(`Successfully fetched ${response.data.data.length} products from Bling.`);
      return response.data.data;
    } catch (error: unknown) {
      this.logger_.error("Failed to fetch products from Bling:", (error as any).response?.data || (error as any).message);
      return [];
    }
  }
}

export default BlingService;
