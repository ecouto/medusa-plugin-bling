import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http";
import { BLING_MODULE } from "../../../../../modules/bling";
import type { BlingModuleService } from "../../../../../modules/bling";

// Handles the callback from Bling after authorization
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    // Redirect to settings page with an error
    return res.redirect(
      `/a/settings/bling?auth_error=true&message=${encodeURIComponent("Authorization code missing.")}`
    );
  }

  const blingService = req.scope.resolve<BlingModuleService>(BLING_MODULE);
  const { success } = await blingService.handleOAuthCallback(code as string);

  if (success) {
    res.redirect(`/a/settings/bling?auth_success=true`);
  } else {
    res.redirect(
      `/a/settings/bling?auth_error=true&message=${encodeURIComponent("Failed to exchange code for token.")}`
    );
  }
}
