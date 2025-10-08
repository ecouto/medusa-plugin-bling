import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export const GET = async (req: MedusaRequest, res: MedusaResponse): Promise<void> => {
  try {
    const locations: unknown[] = [];

    res.json({
      locations,
      count: locations.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    res.status(500).json({
      error: message,
    });
  }
};
