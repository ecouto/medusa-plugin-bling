import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import axios from "axios"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { code, state, error: oauthError } = req.query

    if (oauthError) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Erro na Autorização</h1>
            <p>Erro: ${oauthError}</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `)
    }

    if (!code || !state) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Erro na Autorização</h1>
            <p>Parâmetros obrigatórios não fornecidos</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `)
    }

    const manager = req.scope.resolve("manager")

    // Validate state
    const stateResult = await manager.query(`
      SELECT state FROM bling_oauth_states
      WHERE state = $1 AND expires_at > NOW()
    `, [state])

    if (stateResult.length === 0) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Erro na Autorização</h1>
            <p>State inválido ou expirado</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `)
    }

    // Get current configuration
    const configResult = await manager.query(`
      SELECT client_id, client_secret, environment FROM bling_configuration
      ORDER BY updated_at DESC
      LIMIT 1
    `)

    if (configResult.length === 0) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Erro na Autorização</h1>
            <p>Configuração não encontrada</p>
            <script>
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `)
    }

    const { client_id, client_secret, environment } = configResult[0]

    // Exchange code for tokens
    const tokenUrl = environment === "production"
      ? "https://www.bling.com.br/Api/v3/oauth/token"
      : "https://sandbox.bling.com.br/Api/v3/oauth/token"

    const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64')

    const tokenResponse = await axios.post(tokenUrl,
      `grant_type=authorization_code&code=${code}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`
        }
      }
    )

    const { access_token, refresh_token, expires_in } = tokenResponse.data

    // Save tokens to database
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + expires_in - 300) // 5 min margin

    await manager.query(`
      INSERT INTO bling_tokens (access_token, refresh_token, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
    `, [access_token, refresh_token, expiresAt])

    // Update configuration with tokens
    await manager.query(`
      UPDATE bling_configuration SET
        access_token = $1,
        refresh_token = $2,
        updated_at = NOW()
      WHERE id = (
        SELECT id FROM bling_configuration
        ORDER BY updated_at DESC
        LIMIT 1
      )
    `, [access_token, refresh_token])

    // Clean up used state
    await manager.query(`DELETE FROM bling_oauth_states WHERE state = $1`, [state])

    return res.send(`
      <html>
        <head>
          <title>Autorização Concluída</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
            .success { color: #22c55e; }
            .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Autorização Concluída</h1>
          <p>A integração com o Bling foi configurada com sucesso!</p>
          <div class="loading"></div>
          <p>Fechando janela...</p>
          <script>
            // Notify parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'BLING_OAUTH_SUCCESS' }, '*');
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `)

  } catch (error: any) {
    console.error("OAuth callback error:", error)

    return res.status(500).send(`
      <html>
        <body>
          <h1>Erro na Autorização</h1>
          <p>Erro interno: ${error.message}</p>
          <script>
            setTimeout(() => window.close(), 5000);
          </script>
        </body>
      </html>
    `)
  }
}