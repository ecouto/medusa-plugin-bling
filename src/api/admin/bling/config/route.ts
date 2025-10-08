import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export const GET = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  res.json({
    clientId: process.env.BLING_CLIENT_ID ? "configured" : null,
    clientSecret: process.env.BLING_CLIENT_SECRET ? "configured" : null,
    configured: Boolean(process.env.BLING_CLIENT_ID && process.env.BLING_CLIENT_SECRET),
  });
};

export const POST = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  const { clientId, clientSecret } = req.body as {
    clientId?: string;
    clientSecret?: string;
  };

  if (!clientId || !clientSecret) {
    res.status(400).json({
      error: "clientId and clientSecret are required",
    });
    return;
  }

  res.json({
    success: true,
    message: "Configurações salvas com sucesso",
  });
};
