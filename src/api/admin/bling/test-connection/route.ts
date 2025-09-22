import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const blingService = req.scope.resolve("blingService")

    // Test authentication
    await blingService.authenticate()

    // Test API access by trying to list products (limit 1)
    await blingService.listProducts({ limite: 1 })

    return res.json({
      success: true,
      message: "Conexão com Bling estabelecida com sucesso"
    })

  } catch (error: any) {
    console.error("Bling connection test failed:", error)

    let errorMessage = "Erro desconhecido na conexão"
    let statusCode = 500

    if (error.message.includes("authentication")) {
      errorMessage = "Falha na autenticação. Verifique suas credenciais."
      statusCode = 401
    } else if (error.message.includes("refresh")) {
      errorMessage = "Token expirado. Configure novamente a autenticação OAuth."
      statusCode = 401
    } else if (error.response?.status === 403) {
      errorMessage = "Acesso negado. Verifique as permissões da aplicação no Bling."
      statusCode = 403
    } else if (error.response?.status >= 400 && error.response?.status < 500) {
      errorMessage = `Erro na API do Bling: ${error.response?.data?.error?.message || error.message}`
      statusCode = error.response.status
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    })
  }
}