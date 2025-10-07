import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const orderSyncService = req.scope.resolve("orderSyncService") as {
    syncOrder: (orderId: string, options?: Record<string, unknown>) => Promise<unknown>
  }

  const { id } = req.params as { id: string }
  if (!id) {
    res.status(400).json({ message: "Order ID is required" })
    return
  }

  const body = (req.body ?? {}) as Record<string, unknown>

  try {
    const result = await orderSyncService.syncOrder(id, {
      generateNfe: body.generateNfe === true,
      generateShippingLabel: body.generateShippingLabel === true,
    })

    res.status(200).json({
      message: "Pedido sincronizado com o Bling.",
      result,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao sincronizar pedido com o Bling."

    const logger = req.scope.resolve("logger")
    logger.error(`Erro ao sincronizar pedido com o Bling: ${message}`)

    res.status(400).json({
      message,
    })
  }
}
