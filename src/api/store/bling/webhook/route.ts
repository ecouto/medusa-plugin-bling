import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http";
import crypto from "crypto";
import { BLING_MODULE } from "../../../../modules/bling";
import type { BlingModuleService } from "../../../../modules/bling";

const SIGNATURE_HEADER = "x-bling-signature";

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve("logger");
  const blingService = req.scope.resolve<BlingModuleService>(BLING_MODULE);

  const config = await blingService.getBlingConfig();
  const secret = config?.webhookSecret ?? undefined;

  if (secret) {
    const signature = req.headers[SIGNATURE_HEADER] as string | undefined;
    if (!signature) {
      logger.warn("[bling] Webhook recebido sem assinatura. Solicitação rejeitada.");
      res.status(401).json({ message: "Assinatura ausente." });
      return;
    }

    const payload = JSON.stringify(req.body ?? {});
    const computed = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");

    if (computed !== signature) {
      logger.warn("[bling] Assinatura do webhook inválida. Solicitação rejeitada.");
      res.status(401).json({ message: "Assinatura inválida." });
      return;
    }
  }

  logger.info("[bling] Webhook recebido. Iniciando sincronização de catálogo/estoque.");

  try {
    await blingService.syncProductsToMedusa();
    res.status(200).json({ received: true });
  } catch (error: unknown) {
    const errorObject = error instanceof Error ? error : new Error(String(error));
    logger.error(`[bling] Falha ao processar webhook do Bling: ${errorObject.message}`);
    res.status(500).json({ message: errorObject.message });
  }
}
