import { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import BlingService from "../../../../modules/bling.service"

// Redirects user to Bling's authorization page
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const blingService: BlingService = req.scope.resolve("blingService");
  
  // The admin frontend URL, where Bling should redirect back to.
  const redirectUri = `${req.get('origin')}/admin/bling/oauth/callback`;

  const authUrl = await blingService.getAuthorizationUrl(redirectUri);
  res.redirect(authUrl);
}
