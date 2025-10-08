import {
  Badge,
  Button,
  Container,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import {
  ApiError,
  blingApi,
  type BlingPreferences,
  type UpdateBlingConfigRequest,
} from "../../../api/bling";

type BlingConfigForm = {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  preferences: BlingPreferences;
};

type HealthStatus = "ok" | "not_connected" | "error" | null;

export const config = defineRouteConfig({
  label: "Bling ERP",
});

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return fallback;
};

const BlingSettingsPage = () => {
  const defaultPreferences = useMemo<BlingPreferences>(
    () => ({
      products: {
        syncCatalog: true,
        importImages: true,
        importDescriptions: true,
        importPrices: true,
      },
      inventory: {
        syncInventory: true,
      },
      orders: {
        sendToBling: true,
        receiveUpdates: true,
      },
    }),
    []
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { isSubmitting },
  } = useForm<BlingConfigForm>({
    defaultValues: {
      clientId: "",
      clientSecret: "",
      webhookSecret: "",
      preferences: defaultPreferences,
    },
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>(null);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);

  const clientId = watch("clientId");
  const clientSecret = watch("clientSecret");

  const productSyncEnabled = watch("preferences.products.syncCatalog");
  const inventorySyncEnabled = watch("preferences.inventory.syncInventory");
  const orderSyncEnabled = watch("preferences.orders.sendToBling");

  const fetchConfig = useCallback(async () => {
    setIsConfigLoading(true);
    try {
      const configPayload = await blingApi.getConfig();

      reset({
        clientId: configPayload.clientId ?? "",
        clientSecret: configPayload.clientSecret ?? "",
        webhookSecret: configPayload.webhookSecret ?? "",
        preferences: configPayload.preferences ?? defaultPreferences,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar as configurações do Bling."
      );
      toast.error("Erro ao carregar configurações", { description: message });
    } finally {
      setIsConfigLoading(false);
    }
  }, [defaultPreferences, reset]);

  const fetchHealth = useCallback(async () => {
    setIsHealthLoading(true);
    try {
      const payload = await blingApi.getHealth();
      setHealthStatus((payload.status as HealthStatus) ?? null);
      setHealthMessage(payload.message ?? null);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Não foi possível verificar o status da conexão.");
      setHealthStatus("error");
      setHealthMessage(message);
      toast.error("Erro ao verificar conexão", { description: message });
    } finally {
      setIsHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
    void fetchHealth();
  }, [fetchConfig, fetchHealth]);

  useEffect(() => {
    if (searchParams.get("auth_success")) {
      toast.success("Bling conectado com sucesso!");
      void fetchHealth();
      searchParams.delete("auth_success");
      setSearchParams(searchParams);
    }
    if (searchParams.get("auth_error")) {
      const errorMessage = searchParams.get("message") || "Falha ao conectar com o Bling.";
      toast.error("Erro ao conectar com o Bling", { description: errorMessage });
      searchParams.delete("auth_error");
      searchParams.delete("message");
      setSearchParams(searchParams);
    }
  }, [fetchHealth, searchParams, setSearchParams]);

  const handleSaveConfig = useCallback(
    async (formData: BlingConfigForm) => {
      const payload: UpdateBlingConfigRequest = {
        clientId: formData.clientId,
        clientSecret: formData.clientSecret,
        webhookSecret: formData.webhookSecret,
        preferences: formData.preferences,
      };
      setIsSavingConfig(true);
      try {
        await blingApi.saveConfig(payload);
        toast.success("Configurações salvas com sucesso.");
        await fetchConfig();
      } catch (error: unknown) {
        const message = getErrorMessage(
          error,
          "Não foi possível salvar as configurações do Bling."
        );
        toast.error("Erro ao salvar configurações", { description: message });
      } finally {
        setIsSavingConfig(false);
      }
    },
    [fetchConfig]
  );

  const handleConnectBling = () => {
    window.location.href = "/admin/bling/authorize";
  };

  const isConnected = healthStatus === "ok";
  const canConnect = Boolean(clientId && clientSecret && !isConfigLoading && !isSavingConfig);

  return (
    <div className="flex flex-col gap-y-6">
      {/* SEÇÃO 1: CREDENCIAIS */}
      <Container className="divide-y">
        <div className="flex flex-col gap-y-4 p-6">
          <div>
            <Heading level="h1">Bling ERP</Heading>
            <Text className="text-ui-fg-subtle">
              Configure a integração com o Bling ERP para sincronizar produtos, estoque e pedidos
              automaticamente.
            </Text>
          </div>

          <section className="flex flex-col gap-y-4">
            <Heading level="h2">Credenciais de Autenticação</Heading>
            <Text className="text-ui-fg-subtle">
              Configure suas credenciais do Bling para conectar sua loja.
            </Text>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  placeholder="Seu Client ID do Bling"
                  {...register("clientId")}
                  disabled={isConfigLoading || isSavingConfig || isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder="Seu Client Secret do Bling"
                  {...register("clientSecret")}
                  disabled={isConfigLoading || isSavingConfig || isSubmitting}
                />
              </div>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label htmlFor="webhookSecret">Webhook Secret (Opcional)</Label>
              <Input
                id="webhookSecret"
                type="password"
                placeholder="Secret para validar webhooks do Bling"
                {...register("webhookSecret")}
                disabled={isConfigLoading || isSavingConfig || isSubmitting}
              />
              <Text className="text-xs text-ui-fg-subtle">
                Configure o mesmo secret no painel do Bling para validar notificações via webhook.
              </Text>
            </div>

            <div className="flex items-center justify-end gap-x-2">
              <Button
                variant="primary"
                size="small"
                onClick={handleSubmit(handleSaveConfig)}
                disabled={isConfigLoading || isSavingConfig || isSubmitting}
              >
                Salvar Configurações
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-y-4 border-t pt-6">
            <Heading level="h2">Conexão</Heading>
            <div className="flex flex-col gap-y-3 rounded-lg border border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-y-2 lg:flex-row lg:items-center lg:gap-x-4">
                <div className="flex items-center gap-x-3">
                  <Text className="font-semibold">Status</Text>
                  {(isConfigLoading || isHealthLoading) && (
                    <Badge color="grey">Verificando...</Badge>
                  )}
                  {isConnected && <Badge color="green">Conectado</Badge>}
                  {!isConnected && !(isConfigLoading || isHealthLoading) && (
                    <Badge color="red">Desconectado</Badge>
                  )}
                </div>
                {healthStatus === "error" && healthMessage && (
                  <Text className="text-ui-fg-error text-sm">{healthMessage}</Text>
                )}
              </div>
              <Button variant="secondary" onClick={handleConnectBling} disabled={!canConnect}>
                {isConnected ? "Reconectar" : "Conectar com Bling"}
              </Button>
            </div>
          </section>
        </div>
      </Container>

      {/* SEÇÃO 2: SINCRONIZAÇÃO */}
      <Container className="divide-y">
        <div className="flex flex-col gap-y-6 p-6">
          <div>
            <Heading level="h2">Sincronização</Heading>
            <Text className="text-ui-fg-subtle">
              Configure quais dados devem ser sincronizados entre o Bling e o Medusa.
            </Text>
          </div>

          {/* Produtos */}
          <div className="flex flex-col gap-y-4 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Text weight="plus">Produtos</Text>
                <Text className="text-ui-fg-subtle text-sm">
                  Importa produtos, preços e descrições do Bling para o Medusa
                </Text>
              </div>
              <Controller
                name="preferences.products.syncCatalog"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSavingConfig}
                  />
                )}
              />
            </div>

            <div className="space-y-3">
              <Controller
                name="preferences.products.importImages"
                control={control}
                render={({ field }) => (
                  <PreferenceToggle
                    label="Importar Imagens"
                    description="Baixa e sincroniza imagens dos produtos automaticamente"
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={!productSyncEnabled || isSavingConfig}
                  />
                )}
              />
              <Controller
                name="preferences.products.importDescriptions"
                control={control}
                render={({ field }) => (
                  <PreferenceToggle
                    label="Importar Descrições"
                    description="Atualiza títulos e descrições conforme cadastrados no Bling"
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={!productSyncEnabled || isSavingConfig}
                  />
                )}
              />
              <Controller
                name="preferences.products.importPrices"
                control={control}
                render={({ field }) => (
                  <PreferenceToggle
                    label="Importar Preços"
                    description="Mantém os preços do Medusa alinhados com o Bling"
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={!productSyncEnabled || isSavingConfig}
                  />
                )}
              />
            </div>
          </div>

          {/* Inventário */}
          <div className="flex flex-col gap-y-3 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Text weight="plus">Inventário</Text>
                <Text className="text-ui-fg-subtle text-sm">
                  Atualiza níveis de estoque automaticamente via webhook do Bling
                </Text>
              </div>
              <Controller
                name="preferences.inventory.syncInventory"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSavingConfig}
                  />
                )}
              />
            </div>
            <Text className="text-xs text-ui-fg-subtle">
              O Bling envia atualizações de estoque em tempo real. Todos os depósitos do Bling são
              considerados automaticamente.
            </Text>
          </div>

          {/* Pedidos */}
          <div className="flex flex-col gap-y-4 rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Text weight="plus">Pedidos</Text>
                <Text className="text-ui-fg-subtle text-sm">
                  Envia pedidos para o Bling e recebe atualizações de status
                </Text>
              </div>
              <Controller
                name="preferences.orders.sendToBling"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isSavingConfig}
                  />
                )}
              />
            </div>

            <div className="space-y-3">
              <Controller
                name="preferences.orders.sendToBling"
                control={control}
                render={({ field }) => (
                  <PreferenceToggle
                    label="Enviar Pedidos"
                    description="Pedidos confirmados são enviados automaticamente para o Bling"
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={!orderSyncEnabled || isSavingConfig}
                  />
                )}
              />
              <Controller
                name="preferences.orders.receiveUpdates"
                control={control}
                render={({ field }) => (
                  <PreferenceToggle
                    label="Receber Status"
                    description="Atualiza status dos pedidos via webhook do Bling"
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={!orderSyncEnabled || isSavingConfig}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-end pt-4">
            <Button
              variant="primary"
              onClick={handleSubmit(handleSaveConfig)}
              disabled={isConfigLoading || isSavingConfig || isSubmitting}
            >
              Salvar Configurações
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
};

export default BlingSettingsPage;

type PreferenceToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

const PreferenceToggle = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: PreferenceToggleProps) => {
  return (
    <div className="flex items-start justify-between rounded-md bg-ui-bg-component px-4 py-3">
      <div className="flex flex-col">
        <Text weight="plus" className="text-sm">
          {label}
        </Text>
        <Text className="text-ui-fg-subtle text-xs">{description}</Text>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
};
