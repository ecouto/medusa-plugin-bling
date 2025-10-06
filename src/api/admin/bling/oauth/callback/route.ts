import { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import BlingService from "../../../../modules/bling.service"

// Handles the callback from Bling after authorization
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    // Redirect to settings page with an error
    return res.redirect(`/a/settings/bling?auth_error=true`);
  }

  const blingService: BlingService = req.scope.resolve("blingService");
  const { success } = await blingService.handleOAuthCallback(code);

  if (success) {
    res.redirect(`/a/settings/bling?auth_success=true`);
  } else {
    res.redirect(`/a/settings/bling?auth_error=true`);
  }
}
