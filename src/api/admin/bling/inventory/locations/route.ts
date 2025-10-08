import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http";
import { Modules } from "@medusajs/utils";
import type { IStockLocationService } from "@medusajs/types/dist/stock-location/service";
import { BLING_MODULE } from "../../../../../modules/bling";
import type { BlingModuleService } from "../../../../../modules/bling";

type StockLocationOption = {
  id: string;
  name: string;
};

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve("logger");
  const blingService = req.scope.resolve<BlingModuleService>(BLING_MODULE);

  const config = await blingService.getBlingConfig();
  const preferences = blingService.mergePreferences({}, config?.syncPreferences ?? undefined);

  let locations: StockLocationOption[] = [];

  try {
    const stockLocationService = req.scope.resolve<IStockLocationService>(Modules.STOCK_LOCATION);

    const result = await stockLocationService.listStockLocations({}, undefined, undefined);
    locations = result.map((location) => ({
      id: location.id,
      name:
        location.name ??
        (typeof location.metadata?.label === "string" ? location.metadata.label : undefined) ??
        location.id,
    }));
  } catch (error: unknown) {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    logger.warn(
      `[bling] Não foi possível carregar os locais de estoque do Medusa: ${errorObject.message}`
    );
  }

  res.status(200).json({
    locations,
    mappings: preferences.inventory.locations ?? [],
  });
}
