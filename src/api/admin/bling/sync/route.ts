import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http";
import { BLING_MODULE } from "../../../../modules/bling";
import type { BlingModuleService } from "../../../../modules/bling";

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve("logger");
  const blingService = req.scope.resolve<BlingModuleService>(BLING_MODULE);

  logger.info("Starting synchronization of Bling products with Medusa...");

  try {
    const result = await blingService.syncProductsToMedusa();

    if (result.summary.preview.length === 0) {
      logger.info("No products returned from Bling for synchronization.");
    } else {
      logger.debug(
        `Preview of synchronized Bling products -> ${JSON.stringify(result.summary.preview.slice(0, 5), null, 2)}`
      );
    }

    res.status(200).json({
      message: "Sincronização concluída com sucesso.",
      summary: result.summary,
      warnings: result.warnings,
    });
  } catch (error: unknown) {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    logger.error("Manual sync failed:", errorObject);
    res.status(500).json({ message: errorObject.message });
  }
}
