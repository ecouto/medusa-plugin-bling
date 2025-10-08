import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/dist/http";
import type { ConfigModule } from "@medusajs/types";
import { BLING_MODULE } from "../../../../modules/bling";
import type { BlingModuleService } from "../../../../modules/bling";

const firstHeaderValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
};

const resolveAdminOrigin = (req: MedusaRequest, config: ConfigModule): string | undefined => {
  const headerOrigin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
  if (headerOrigin && headerOrigin.trim().length > 0) {
    return headerOrigin;
  }

  const forwardedProto = firstHeaderValue(req.headers["x-forwarded-proto"]);
  const forwardedHost = firstHeaderValue(req.headers["x-forwarded-host"]);
  const host = forwardedHost ?? req.headers.host;

  if (host) {
    const protocol = forwardedProto ?? req.protocol ?? "https";
    return `${protocol}://${host}`;
  }

  return config.admin?.backendUrl;
};

// Redirects user to Bling's authorization page
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = req.scope.resolve("logger");
  const configModule = req.scope.resolve<ConfigModule>("configModule");
  const blingService = req.scope.resolve<BlingModuleService>(BLING_MODULE);

  const adminOrigin = resolveAdminOrigin(req, configModule);
  if (!adminOrigin) {
    logger.error("[bling] Não foi possível determinar a origem do Admin para o fluxo OAuth.");
    res.redirect(
      `/a/settings/bling?auth_error=true&message=${encodeURIComponent(
        "Não foi possível determinar a origem do painel administrativo para concluir a autenticação."
      )}`
    );
    return;
  }

  const redirectUri = `${adminOrigin.replace(/\/$/, "")}/a/settings/bling`;

  try {
    const authUrl = await blingService.getAuthorizationUrl(redirectUri);
    res.redirect(authUrl);
  } catch (error: unknown) {
    const errorObject =
      error instanceof Error ? error : new Error("Falha ao gerar URL de autorização.");
    logger.error("Failed to get Bling authorization URL:", errorObject);
    res.redirect(
      `/a/settings/bling?auth_error=true&message=${encodeURIComponent(errorObject.message)}`
    );
  }
}
