import { MedusaRequest, MedusaResponse } from "@medusajs/medusa"

// Mock storage for settings. In a real implementation, this would use a database.
let settings = {
  client_id: "",
  client_secret: "",
};

// Handler to get current settings
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  res.status(200).json(settings);
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

  settings = { client_id, client_secret };
  console.log("Bling settings updated:", settings);

  res.status(200).json(settings);
}
