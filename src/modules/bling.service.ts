import { TransactionBaseService, Logger } from "@medusajs/medusa"
import { EntityManager } from "typeorm"
import axios from "axios"
import { BlingToken } from "../models/bling-token.entity"

const TOKEN_ID = "bling_token";

class BlingService extends TransactionBaseService {
  protected readonly logger_: Logger;
  protected readonly blingTokenRepository_;

  private clientId: string;
  private clientSecret: string;
  private apiBaseUrl: string;
  private oauthUrl: string;

  constructor(container, options) {
    super(container)
    this.logger_ = container.logger;
    this.blingTokenRepository_ = this.activeManager_.getRepository(BlingToken);

    this.clientId = options.client_id;
    this.clientSecret = options.client_secret;
    this.apiBaseUrl = "https://api.bling.com.br/Api/v3";
    this.oauthUrl = "https://www.bling.com.br/Api/v3/oauth";
  }

  async getAuthorizationUrl(redirectUri: string): Promise<string> {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state: "medusa-bling-auth", // TODO: Use a random state
    });
    return `${this.oauthUrl}/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code: string): Promise<{ success: boolean }> {
    try {
      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("code", code);

      const response = await axios.post(`${this.oauthUrl}/token`, params, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;

      const token = this.blingTokenRepository_.create({
        id: TOKEN_ID,
        access_token,
        refresh_token,
        expires_in,
        updated_at: new Date(),
      });

      await this.blingTokenRepository_.save(token);
      this.logger_.info("Bling OAuth token saved successfully.");
      return { success: true };
    } catch (error) {
      this.logger_.error("Bling OAuth callback failed:", error);
      return { success: false };
    }
  }

  private async getAccessToken(): Promise<string> {
    const token = await this.blingTokenRepository_.findOne({ where: { id: TOKEN_ID } });
    if (!token) {
      throw new Error("Bling token not found. Please authenticate.");
    }

    // Check if token is expired (with a 5-minute buffer)
    const now = new Date();
    const expiryTime = new Date(token.updated_at.getTime() + (token.expires_in - 300) * 1000);

    if (now < expiryTime) {
      return token.access_token;
    }

    // Token is expired, refresh it
    this.logger_.info("Bling access token expired, refreshing...");
    try {
      const params = new URLSearchParams();
      params.append("grant_type", "refresh_token");
      params.append("refresh_token", token.refresh_token);

      const response = await axios.post(`${this.oauthUrl}/token`, params, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      const { access_token, refresh_token, expires_in } = response.data;
      const newToken = this.blingTokenRepository_.create({
        ...token,
        access_token,
        refresh_token,
        expires_in,
        updated_at: new Date(),
      });

      await this.blingTokenRepository_.save(newToken);
      this.logger_.info("Bling access token refreshed and saved successfully.");
      return newToken.access_token;
    } catch (error) {
      this.logger_.error("Failed to refresh Bling access token:", error);
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
    } catch (error) {
      this.logger_.error("Failed to fetch products from Bling:", error.response?.data || error.message);
      return [];
    }
  }
}

export default BlingService;
