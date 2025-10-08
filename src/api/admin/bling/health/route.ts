import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http";
import { BLING_MODULE } from "../../../../modules/bling";
import type { BlingModuleService } from "../../../../modules/bling";

// Checks if a valid token exists in the database
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve("logger");
  const blingService = req.scope.resolve<BlingModuleService>(BLING_MODULE);

  try {
    const config = await blingService.getBlingConfig();
    if (!config?.accessToken) {
      res.status(200).json({ status: "not_connected" });
      return;
    }

    await blingService.getAccessToken();
    res.status(200).json({ status: "ok" });
  } catch (error: unknown) {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    logger.error("Bling health check failed:", errorObject);
    res.status(200).json({ status: "error", message: errorObject.message });
  }
}
