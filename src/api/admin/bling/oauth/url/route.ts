import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const manager = req.scope.resolve("manager")

    // Get current configuration
    const result = await manager.query(`
      SELECT client_id, environment FROM bling_configuration
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (result.length === 0) {
      return res.status(400).json({
        error: "Configuração não encontrada. Configure as credenciais primeiro."
      })
    }

    const { client_id, environment } = result[0]

    if (!client_id) {
      return res.status(400).json({
        error: "Client ID não configurado"
      })
    }

    // Build OAuth URL
    const baseUrl = environment === "production"
      ? "https://www.bling.com.br"
      : "https://sandbox.bling.com.br"

    const state = generateRandomState()
    const redirectUri = `${req.protocol}://${req.get('host')}/admin/bling/oauth/callback`

    const authUrl = `${baseUrl}/Api/v3/oauth/authorize?` +
      `response_type=code&` +
      `client_id=${encodeURIComponent(client_id)}&` +
      `state=${encodeURIComponent(state)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}`

    // Store state for validation (you might want to use Redis here)
    await manager.query(`
      INSERT INTO bling_oauth_states (state, created_at, expires_at)
      VALUES ($1, NOW(), NOW() + INTERVAL '10 minutes')
      ON CONFLICT (state) DO UPDATE SET
        created_at = NOW(),
        expires_at = NOW() + INTERVAL '10 minutes'
    `, [state])

    return res.json({
      auth_url: authUrl,
      state
    })

  } catch (error) {
    console.error("Error generating OAuth URL:", error)
    return res.status(500).json({
      error: "Erro ao gerar URL de autenticação"
    })
  }
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15)
}

// Ensure OAuth states table exists
export async function ensureOAuthTable(manager: any) {
  await manager.query(`
    CREATE TABLE IF NOT EXISTS bling_oauth_states (
      state TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP
    )
  `)
}