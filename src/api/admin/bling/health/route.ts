import { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import { BlingToken } from "../../../../models/bling-token.entity"

// Checks if a valid token exists in the database
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const tokenRepository = req.scope.resolve("manager").getRepository(BlingToken);
  const token = await tokenRepository.findOne({ where: { id: "bling_token" } });

  if (token && token.access_token) {
    res.status(200).json({ status: "ok" });
  } else {
    res.status(200).json({ status: "not_connected" });
  }
}
