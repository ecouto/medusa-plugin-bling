import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http"
import { Modules } from "@medusajs/utils"
import type { IStockLocationService } from "@medusajs/types/dist/stock-location/service"
import BlingService from "../../../../../modules/bling.service"

type StockLocationOption = {
  id: string
  name: string
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve("logger")
  const blingService: BlingService = req.scope.resolve("blingService")

  const config = await blingService.getBlingConfig()
  const preferences = blingService.mergePreferences(
    {},
    config?.sync_preferences ?? undefined
  )

  let locations: StockLocationOption[] = []
  try {
    const stockLocationService =
      req.scope.resolve<IStockLocationService>(Modules.STOCK_LOCATION)
    const result = await stockLocationService.listStockLocations({}, undefined, undefined)
    locations = result.map((location) => ({
      id: location.id,
      name:
        location.name ??
        (location.metadata?.label as string | undefined) ??
        location.id,
    }))
  } catch (error) {
    logger.warn(
      `[bling] Não foi possível carregar os locais de estoque do Medusa: ${
        (error as Error).message ?? error
      }`
    )
  }

  res.status(200).json({
    locations,
    mappings: preferences.inventory.locations ?? [],
  })
}
