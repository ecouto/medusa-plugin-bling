import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http";
import { z } from "zod";

const syncOrderBodySchema = z
  .object({
    generateNfe: z.boolean().optional(),
    generateShippingLabel: z.boolean().optional(),
  })
  .strict();

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const orderSyncService = req.scope.resolve("orderSyncService") as {
    syncOrder: (orderId: string, options?: Record<string, unknown>) => Promise<unknown>;
  };

  const { id } = req.params as { id: string };
  if (!id) {
    res.status(400).json({ message: "Order ID is required" });
    return;
  }

  const bodyResult = syncOrderBodySchema.safeParse(req.body ?? {});
  if (!bodyResult.success) {
    res.status(400).json({
      message: "Invalid input",
      issues: bodyResult.error.issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
    return;
  }

  const { generateNfe = false, generateShippingLabel = false } = bodyResult.data;

  try {
    const result = await orderSyncService.syncOrder(id, {
      generateNfe,
      generateShippingLabel,
    });

    res.status(200).json({
      message: "Pedido sincronizado com o Bling.",
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao sincronizar pedido com o Bling.";

    const logger = req.scope.resolve("logger");
    logger.error(`Erro ao sincronizar pedido com o Bling: ${message}`);

    res.status(400).json({
      message,
    });
  }
}
