import { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import BlingService from "../../../../modules/bling.service"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const blingService: BlingService = req.scope.resolve("blingService");
    
    req.scope.resolve("logger").info("Starting manual sync of products and stock from Bling...");
    const products = await blingService.getProductsAndStock();
    
    // TODO: Implement Medusa product creation/update logic here.
    req.scope.resolve("logger").info(`Found ${products.length} products in Bling.`);
    req.scope.resolve("logger").debug(JSON.stringify(products, null, 2));

    res.status(200).json({ message: `Sync started. Found ${products.length} products.` });
  } catch (error: unknown) {
    req.scope.resolve("logger").error("Manual sync failed:", (error as any).response?.data || (error as any).message);
    res.status(500).json({ message: "Manual sync failed." });
  }
}
