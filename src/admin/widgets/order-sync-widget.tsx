import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import type { DetailWidgetProps, AdminOrder } from "@medusajs/framework/types";
import { ApiError, blingApi } from "../api/bling";

type FeedbackState = {
  variant: "success" | "error";
  message: string;
};

type BlingOrderMetadata = {
  sale_id?: string | null | undefined;
  last_sync_at?: string | undefined;
  warnings?: string[] | undefined;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "Falha ao sincronizar pedido com o Bling.";
};

const OrderSyncWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const metadata = useMemo<BlingOrderMetadata>(() => {
    const rawMetadata = (order.metadata as Record<string, unknown> | null) ?? null;
    if (!rawMetadata || typeof rawMetadata !== "object" || rawMetadata.bling === undefined) {
      return {};
    }

    const blingMetadata = rawMetadata.bling as BlingOrderMetadata | undefined;
    if (!blingMetadata || typeof blingMetadata !== "object") {
      return {};
    }

    return {
      sale_id: blingMetadata.sale_id ?? null,
      last_sync_at: blingMetadata.last_sync_at,
      warnings: Array.isArray(blingMetadata.warnings) ? blingMetadata.warnings : [],
    };
  }, [order.metadata]);

  const lastSyncLabel = useMemo(() => {
    if (!metadata.last_sync_at) {
      return null;
    }

    const parsed = new Date(metadata.last_sync_at);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toLocaleString();
  }, [metadata.last_sync_at]);

  const handleSync = async () => {
    if (isSyncing) {
      return;
    }

    setIsSyncing(true);
    setFeedback(null);

    try {
      const response = await blingApi.syncOrder(order.id, {});
      const summary = response.result.summary;
      const saleId = summary.bling_sale_id;
      const message =
        response.message ??
        `Pedido enviado ao Bling${saleId ? ` (ID ${saleId})` : ""} em ${new Date(
          summary.synced_at
        ).toLocaleString()}.`;

      setFeedback({
        variant: "success",
        message,
      });
    } catch (error) {
      setFeedback({
        variant: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Heading level="h2">Bling ERP</Heading>
        <div className="flex items-center gap-x-3">
          <Link to="/settings/bling" className="text-sm text-ui-link hover:text-ui-link-hover">
            Configurações
          </Link>
          <Button variant="secondary" size="small" onClick={handleSync} disabled={isSyncing}>
            {isSyncing ? "Sincronizando..." : "Sincronizar pedido"}
          </Button>
        </div>
      </div>
      <div className="space-y-3 px-6 py-4 text-sm">
        {lastSyncLabel ? (
          <Text className="text-ui-fg-base">
            Última sincronização: <span className="font-semibold">{lastSyncLabel}</span>
          </Text>
        ) : (
          <Text className="text-ui-fg-subtle">
            Este pedido ainda não foi sincronizado com o Bling.
          </Text>
        )}
        {metadata.sale_id ? (
          <Text className="text-ui-fg-subtle">
            Venda no Bling: <span className="font-mono text-ui-fg-base">{metadata.sale_id}</span>
          </Text>
        ) : null}
        {feedback ? (
          <Text
            className={
              feedback.variant === "success" ? "text-ui-tag-green-icon" : "text-ui-tag-red-icon"
            }
          >
            {feedback.message}
          </Text>
        ) : null}
        {metadata.warnings && metadata.warnings.length > 0 ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <Text className="text-sm font-semibold text-amber-900">Avisos</Text>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
              {metadata.warnings.map((warning, index) => (
                <li key={`bling-warning-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.before",
});

export default OrderSyncWidget;
