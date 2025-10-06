import { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import BlingService from "../../../../modules/bling.service"

// Handler to get current settings
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const blingService: BlingService = req.scope.resolve("blingService");
  const config = await blingService.getBlingConfig();
  res.status(200).json({ 
    client_id: config?.client_id || "", 
    client_secret: config?.client_secret || "",
    is_connected: !!config?.access_token
  });
}

// Handler to save new settings
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { client_id, client_secret } = req.body as any;

  if (typeof client_id !== 'string' || typeof client_secret !== 'string') {
    res.status(400).json({ message: "Invalid input" });
    return;
  }

  const blingService: BlingService = req.scope.resolve("blingService");
  await blingService.saveBlingConfig(client_id, client_secret);

  res.status(200).json({ message: "Bling credentials saved successfully." });
}