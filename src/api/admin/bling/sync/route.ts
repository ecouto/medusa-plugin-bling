import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http"
import BlingService from "../../../../modules/bling.service"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const blingService: BlingService = req.scope.resolve("blingService")

    req.scope.resolve("logger").info(
      "Starting synchronization of Bling products with Medusa..."
    )

    const result = await blingService.syncProductsToMedusa()

    if (result.summary.preview.length === 0) {
      req.scope.resolve("logger").info(
        "No products returned from Bling for synchronization."
      )
    } else {
      req.scope
        .resolve("logger")
        .debug(
          `Preview of synchronized Bling products -> ${JSON.stringify(result.summary.preview, null, 2)}`
        )
    }

    res.status(200).json({
      message: "Sincronização concluída com sucesso.",
      summary: result.summary,
      warnings: result.warnings,
    })
  } catch (error: unknown) {
    req
      .scope
      .resolve("logger")
      .error(
        "Manual sync failed:",
        (error as any).response?.data || (error as any).message
      )
    res.status(500).json({ message: "Manual sync failed." })
  }
}
