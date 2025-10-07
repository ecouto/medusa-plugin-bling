import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http"
import crypto from "crypto"
import BlingService from "../../../../modules/bling.service"

const SIGNATURE_HEADER = "x-bling-signature"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve("logger")
  const blingService: BlingService = req.scope.resolve("blingService")

  const config = await blingService.getBlingConfig()
  const secret = config?.webhook_secret ?? undefined

  if (secret) {
    const signature = req.headers[SIGNATURE_HEADER] as string | undefined
    if (!signature) {
      logger.warn("[bling] Webhook recebido sem assinatura. Solicitação rejeitada.")
      res.status(401).json({ message: "Assinatura ausente." })
      return
    }

    const payload = JSON.stringify(req.body ?? {})
    const computed = crypto
      .createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex")

    if (computed !== signature) {
      logger.warn("[bling] Assinatura do webhook inválida. Solicitação rejeitada.")
      res.status(401).json({ message: "Assinatura inválida." })
      return
    }
  }

  logger.info("[bling] Webhook recebido. Iniciando sincronização de catálogo/estoque.")

  try {
    await blingService.syncProductsToMedusa()
    res.status(200).json({ received: true })
  } catch (error) {
    logger.error(
      `[bling] Falha ao processar webhook do Bling: ${
        (error as Error).message ?? error
      }`
    )
    res.status(500).json({ message: "Falha ao processar webhook do Bling." })
  }
}
