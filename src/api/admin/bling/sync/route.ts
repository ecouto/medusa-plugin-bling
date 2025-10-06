import { MedusaRequest, MedusaResponse } from "@medusajs/medusa"
import BlingService from "../../../../modules/bling.service"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const blingService: BlingService = req.scope.resolve("blingService");
    
    console.log("Starting manual sync of products and stock from Bling...");
    const products = await blingService.getProductsAndStock();
    
    // For now, just log the result.
    // TODO: Implement Medusa product creation/update logic here.
    console.log(`Found ${products.length} products in Bling.`);
    console.log(JSON.stringify(products, null, 2));

    res.status(200).json({ message: `Sync started. Found ${products.length} products.` });
  } catch (error) {
    console.error("Manual sync failed:", error);
    res.status(500).json({ message: "Manual sync failed." });
  }
}
