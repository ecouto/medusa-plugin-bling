import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http"
import BlingService from "../../../../modules/bling.service"

// Checks if a valid token exists in the database
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const blingService: BlingService = req.scope.resolve("blingService");
  try {
    const config = await blingService.getBlingConfig();
    if (config?.access_token) {
      // Attempt to get access token to check if it's valid/refreshable
      await blingService.getAccessToken(); 
      res.status(200).json({ status: "ok" });
    } else {
      res.status(200).json({ status: "not_connected" });
    }
  } catch (error: unknown) {
    req.scope.resolve("logger").error("Bling health check failed:", (error as any).message);
    res.status(200).json({ status: "error", message: (error as any).message });
  }
}
