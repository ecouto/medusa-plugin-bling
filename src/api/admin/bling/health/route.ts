import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export const GET = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  try {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Bling integration is running",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    res.status(500).json({
      status: "error",
      message,
    });
  }
};
