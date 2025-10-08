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
  Select,
} from "@medusajs/ui";
import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import {
  ApiError,
  blingApi,
  type OrderSyncResultResponse,
  type StockLocationOption,
  type InventoryLocationMappingForm,
  type SyncPreferencesForm,
  type ProductSyncSummary,
  type UpdateBlingConfigRequest,
} from "../../../api/bling";

type BlingConfigForm = {
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  sync_preferences: SyncPreferencesForm;
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
  const defaultPreferences = useMemo<SyncPreferencesForm>(
    () => ({
      products: {
        enabled: true,
        import_images: true,
        import_descriptions: true,
        import_prices: true,
      },
      inventory: {
        enabled: true,
        bidirectional: false,
        locations: [],
      },
      orders: {
        enabled: true,
        send_to_bling: true,
        receive_from_bling: true,
        generate_nf: false,
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
    setValue,
    getValues,
    formState: { isSubmitting },
  } = useForm<BlingConfigForm>({
    defaultValues: {
      client_id: "",
      client_secret: "",
      webhook_secret: "",
      sync_preferences: defaultPreferences,
    },
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const [isConfigLoading, setIsConfigLoading] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isHealthLoading, setIsHealthLoading] = useState<boolean>(true);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>(null);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<ProductSyncSummary | null>(null);
  const [availableStockLocations, setAvailableStockLocations] = useState<StockLocationOption[]>([]);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [orderSyncId, setOrderSyncId] = useState<string>("");
  const [isOrderSyncing, setIsOrderSyncing] = useState<boolean>(false);
  const [orderSyncResult, setOrderSyncResult] = useState<OrderSyncResultResponse | null>(null);
  const [orderSyncWarnings, setOrderSyncWarnings] = useState<string[]>([]);
  const {
    fields: locationFields,
    append: appendLocation,
    remove: removeLocation,
    replace: replaceLocationMappings,
  } = useFieldArray({
    control,
    name: "sync_preferences.inventory.locations",
  });

  const clientId = watch("client_id");
  const clientSecret = watch("client_secret");

  const productSyncEnabled = watch("sync_preferences.products.enabled");
  const inventorySyncEnabled = watch("sync_preferences.inventory.enabled");
  const orderSyncEnabled = watch("sync_preferences.orders.enabled");

  const fetchConfig = useCallback(async () => {
    setIsConfigLoading(true);
    try {
      const [configPayload, locationsPayload] = await Promise.all([
        blingApi.getConfig(),
        blingApi.getInventoryLocations().catch((error) => {
          const message = getErrorMessage(
            error,
            "Falha desconhecida ao carregar locais de estoque."
          );
          console.warn(
            `[bling] Não foi possível carregar os locais de estoque do Medusa: ${message}`
          );
          return {
            locations: [],
            mappings: [],
          };
        }),
      ]);

      setAvailableStockLocations(locationsPayload.locations);

      const incomingPreferences = configPayload.sync_preferences ?? defaultPreferences;
      const locationMappings: InventoryLocationMappingForm[] = (
        locationsPayload.mappings.length > 0
          ? locationsPayload.mappings
          : (incomingPreferences.inventory.locations ?? [])
      ).map((location) => ({ ...location }));

      if (
        locationMappings.length > 0 &&
        !locationMappings.some((location) => location.is_default)
      ) {
        const firstMapping = locationMappings[0]!;
        locationMappings[0] = {
          ...firstMapping,
          is_default: true,
        };
      }

      reset({
        client_id: configPayload.client_id ?? "",
        client_secret: configPayload.client_secret ?? "",
        webhook_secret: configPayload.webhook_secret ?? "",
        sync_preferences: {
          products: incomingPreferences.products,
          inventory: {
            ...incomingPreferences.inventory,
            locations: locationMappings,
          },
          orders: incomingPreferences.orders,
        },
      });

      replaceLocationMappings(locationMappings);
    } catch (error: unknown) {
      const message = getErrorMessage(
        error,
        "Não foi possível carregar as configurações do Bling."
      );
      toast.error("Erro ao carregar configurações", { description: message });
    } finally {
      setIsConfigLoading(false);
    }
  }, [defaultPreferences, replaceLocationMappings, reset]);

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

  const handleAddLocationMapping = useCallback(() => {
    const existing = getValues("sync_preferences.inventory.locations") ?? [];
    const usedLocations = new Set(
      existing
        .map((mapping) => mapping?.stock_location_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );
    const nextAvailableLocation = availableStockLocations.find(
      (location) => !usedLocations.has(location.id)
    );
    const hasDefault = existing.some((mapping) => mapping?.is_default);

    appendLocation({
      stock_location_id: nextAvailableLocation?.id ?? "",
      bling_deposit_id: "",
      is_default: hasDefault ? false : true,
    });
  }, [appendLocation, availableStockLocations, getValues]);

  const handleRemoveLocation = useCallback(
    (index: number) => {
      const currentMappings = getValues("sync_preferences.inventory.locations") ?? [];
      const wasDefault = Boolean(currentMappings[index]?.is_default);

      removeLocation(index);

      if (wasDefault) {
        setTimeout(() => {
          const remaining = getValues("sync_preferences.inventory.locations") ?? [];
          remaining.forEach((_, idx) => {
            setValue(`sync_preferences.inventory.locations.${idx}.is_default`, idx === 0, {
              shouldDirty: true,
            });
          });
        }, 0);
      }
    },
    [getValues, removeLocation, setValue]
  );

  const handleSetDefaultLocation = useCallback(
    (index: number, checked: boolean) => {
      const mappings = getValues("sync_preferences.inventory.locations") ?? [];
      if (mappings.length === 0) {
        return;
      }

      if (checked) {
        mappings.forEach((_, idx) => {
          setValue(`sync_preferences.inventory.locations.${idx}.is_default`, idx === index, {
            shouldDirty: true,
          });
        });
      } else {
        setValue(`sync_preferences.inventory.locations.${index}.is_default`, false, {
          shouldDirty: true,
        });
      }
    },
    [getValues, setValue]
  );

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
        client_id: formData.client_id,
        client_secret: formData.client_secret,
        webhook_secret: formData.webhook_secret,
        sync_preferences: formData.sync_preferences,
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

  const handleOrderSync = useCallback(async () => {
    if (!orderSyncId) {
      toast.warning("Informe o ID do pedido do Medusa para sincronizar.");
      return;
    }

    setIsOrderSyncing(true);
    setOrderSyncWarnings([]);

    try {
      const payload = await blingApi.syncOrder(orderSyncId, {
        generateNfe: watch("sync_preferences.orders.generate_nf"),
      });

      setOrderSyncResult(payload.result);
      setOrderSyncWarnings(payload.result.warnings ?? []);
      toast.success(payload.message, {
        description: payload.result.summary.bling_sale_id
          ? `Venda registrada no Bling sob ID ${payload.result.summary.bling_sale_id}.`
          : undefined,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Não foi possível sincronizar o pedido com o Bling.");
      toast.error("Erro ao sincronizar pedido", { description: message });
      setOrderSyncResult(null);
      setOrderSyncWarnings([]);
    } finally {
      setIsOrderSyncing(false);
    }
  }, [orderSyncId, toast, watch]);

  const handleManualSync = useCallback(async () => {
    setIsSyncing(true);
    setSyncWarnings([]);
    try {
      const payload = await blingApi.syncProducts();
      setSyncSummary(payload.summary);
      setSyncWarnings(payload.warnings ?? []);

      toast.success(payload.message, {
        description: `Produtos processados: ${payload.summary.total_products}. Criados: ${payload.summary.created}. Atualizados: ${payload.summary.updated}.`,
      });

      if (payload.warnings && payload.warnings.length > 0) {
        payload.warnings.forEach((warning) => {
          toast.warning("Aviso durante sincronização", { description: warning });
        });
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Não foi possível iniciar a sincronização manual.");
      toast.error("Erro ao sincronizar", { description: message });
      setSyncSummary(null);
      setSyncWarnings([]);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const renderProductSyncSummary = () => {
    if (!syncSummary) {
      return null;
    }

    const summary = syncSummary;

    return (
      <div className="flex flex-col gap-y-4 rounded-lg border border-gray-200 p-4">
        <div className="flex flex-row flex-wrap items-center gap-4">
          <StatBadge label="Produtos" value={summary.total_products} />
          <StatBadge label="Variantes" value={summary.total_variants} />
          <StatBadge label="Com estoque" value={summary.products_with_inventory_data} />
          <StatBadge label="Criados" value={summary.created} variant="success" />
          <StatBadge label="Atualizados" value={summary.updated} variant="info" />
          <StatBadge label="Ignorados" value={summary.skipped} variant="warning" />
        </div>
        {summary.preview.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] table-fixed border-separate text-left text-sm">
              <thead>
                <tr className="text-ui-fg-subtle">
                  <th className="border-b border-gray-200 px-2 py-2 font-medium">ID externo</th>
                  <th className="border-b border-gray-200 px-2 py-2 font-medium">Nome</th>
                  <th className="border-b border-gray-200 px-2 py-2 font-medium text-center">
                    Variantes
                  </th>
                  <th className="border-b border-gray-200 px-2 py-2 font-medium text-center">
                    Registros de estoque
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.preview.map((item) => (
                  <tr key={item.external_id}>
                    <td className="border-b border-gray-100 px-2 py-2 font-mono text-xs text-ui-fg-subtle">
                      {item.external_id}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-2">{item.name}</td>
                    <td className="border-b border-gray-100 px-2 py-2 text-center">
                      {item.variants}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-2 text-center">
                      {item.stock_entries}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Text className="text-ui-fg-subtle mt-2 text-xs">
              Exibindo primeiros {summary.preview.length} itens retornados pela API do Bling.
            </Text>
          </div>
        )}
        {syncWarnings.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <Text className="font-semibold text-amber-900">Avisos</Text>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {syncWarnings.map((warning, index) => (
                <li key={`product-warning-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const isConnected = healthStatus === "ok";
  const canConnect = Boolean(clientId && clientSecret && !isConfigLoading && !isSavingConfig);
  const canSync = Boolean(isConnected && !isSyncing);

  return (
    <div className="flex flex-col gap-y-6">
      <Container>
        <div className="flex flex-col gap-y-4">
          <div>
            <Heading level="h1">Configurações do Bling ERP</Heading>
            <Text className="text-ui-fg-subtle">
              Armazene suas credenciais de acesso e personalize quais dados serão sincronizados
              entre o Bling e o Medusa.
            </Text>
          </div>

          <div className="flex flex-col gap-y-6">
            <section className="flex flex-col gap-y-4">
              <Heading level="h2">Credenciais de Autenticação</Heading>
              <Text className="text-ui-fg-subtle">
                Informe as credenciais obtidas no portal do desenvolvedor do Bling para habilitar o
                fluxo de OAuth.
              </Text>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="client_id">Client ID</Label>
                  <Input
                    id="client_id"
                    placeholder="Seu Client ID do Bling"
                    {...register("client_id")}
                    disabled={isConfigLoading || isSavingConfig || isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="client_secret">Client Secret</Label>
                  <Input
                    id="client_secret"
                    type="password"
                    placeholder="Seu Client Secret do Bling"
                    {...register("client_secret")}
                    disabled={isConfigLoading || isSavingConfig || isSubmitting}
                  />
                </div>
                <div className="flex flex-col gap-y-2 md:col-span-2">
                  <Label htmlFor="webhook_secret">Webhook Secret</Label>
                  <Input
                    id="webhook_secret"
                    type="password"
                    placeholder="Opcional: usado para validar webhooks do Bling"
                    {...register("webhook_secret")}
                    disabled={isConfigLoading || isSavingConfig || isSubmitting}
                  />
                  <Text className="text-xs text-ui-fg-subtle">
                    Defina o mesmo segredo na configuração de webhooks do Bling para validar
                    notificações recebidas.
                  </Text>
                </div>
              </div>
              <div className="flex items-center justify-end">
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

            <section className="flex flex-col gap-y-4">
              <Heading level="h2">Conexão com o Bling</Heading>
              <div className="flex flex-col gap-y-2 rounded-lg border border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-y-2 lg:flex-row lg:items-center lg:gap-x-4">
                  <div className="flex items-center gap-x-3">
                    <Text className="font-semibold">Status da Conexão</Text>
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
        </div>
      </Container>

      <Container>
        <div className="flex flex-col gap-y-6">
          <section className="flex flex-col gap-y-4">
            <Heading level="h2">Preferências de Sincronização</Heading>
            <Text className="text-ui-fg-subtle">
              Ative ou desative as sincronizações de acordo com o seu fluxo. As alterações são
              aplicadas nas próximas execuções.
            </Text>

            <div className="flex flex-col gap-y-6">
              <div className="flex flex-col gap-y-3 rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Text className="font-semibold">Produtos</Text>
                    <Text className="text-ui-fg-subtle">
                      Sincroniza catálogo, variantes e atributos obrigatórios do Bling para o
                      Medusa.
                    </Text>
                  </div>
                  <Controller
                    name="sync_preferences.products.enabled"
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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Controller
                    name="sync_preferences.products.import_images"
                    control={control}
                    render={({ field }) => (
                      <PreferenceToggle
                        label="Importar imagens"
                        description="Ignora as imagens do Bling quando desativado, permitindo gerenciar assets diretamente no Medusa."
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={!productSyncEnabled || isSavingConfig}
                      />
                    )}
                  />
                  <Controller
                    name="sync_preferences.products.import_descriptions"
                    control={control}
                    render={({ field }) => (
                      <PreferenceToggle
                        label="Importar descrições"
                        description="Atualiza títulos e descrições dos produtos conforme cadastrados no Bling."
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={!productSyncEnabled || isSavingConfig}
                      />
                    )}
                  />
                  <Controller
                    name="sync_preferences.products.import_prices"
                    control={control}
                    render={({ field }) => (
                      <PreferenceToggle
                        label="Importar preços"
                        description="Mantém os preços do Medusa alinhados aos valores vigentes no Bling."
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={!productSyncEnabled || isSavingConfig}
                      />
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-y-3 rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Text className="font-semibold">Inventário</Text>
                    <Text className="text-ui-fg-subtle">
                      Controla a sincronização dos níveis de estoque entre os sistemas.
                    </Text>
                  </div>
                  <Controller
                    name="sync_preferences.inventory.enabled"
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

                <Controller
                  name="sync_preferences.inventory.bidirectional"
                  control={control}
                  render={({ field }) => (
                    <PreferenceToggle
                      label="Sincronização bidirecional"
                      description="Quando ativo, ajustes de estoque realizados no Medusa também são enviados para o Bling."
                      checked={field.value}
                      onChange={field.onChange}
                      disabled={!inventorySyncEnabled || isSavingConfig}
                    />
                  )}
                />
              </div>

              <div className="flex flex-col gap-y-3 rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-x-4">
                  <div className="flex flex-col">
                    <Text className="font-semibold">Depósitos do Bling</Text>
                    <Text className="text-ui-fg-subtle">
                      Associe os locais de estoque do Medusa aos depósitos configurados no Bling.
                      Utilize o ID do depósito disponível no painel do Bling (Menu &gt; Cadastros
                      &gt; Depósitos).
                    </Text>
                  </div>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={handleAddLocationMapping}
                    disabled={isSavingConfig || availableStockLocations.length === 0}
                  >
                    Adicionar mapeamento
                  </Button>
                </div>

                {availableStockLocations.length === 0 && (
                  <Text className="text-sm text-ui-fg-subtle">
                    Nenhum local de estoque encontrado no Medusa. Cadastre um local para habilitar a
                    sincronização de inventário.
                  </Text>
                )}

                {availableStockLocations.length > 0 && locationFields.length === 0 && (
                  <Text className="text-sm text-ui-fg-subtle">
                    Nenhum mapeamento configurado. Adicione um novo para sincronizar estoque com o
                    Bling.
                  </Text>
                )}

                {locationFields.length > 0 && (
                  <div className="flex flex-col gap-y-3">
                    {locationFields.map((field, index) => {
                      const isDefault =
                        watch(`sync_preferences.inventory.locations.${index}.is_default`) ?? false;

                      return (
                        <div
                          key={field.id}
                          className="grid gap-4 rounded-md border border-gray-100 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                        >
                          <div className="flex flex-col gap-y-2">
                            <Label htmlFor={`stock_location_${field.id}`}>Local no Medusa</Label>
                            <Controller
                              name={`sync_preferences.inventory.locations.${index}.stock_location_id`}
                              control={control}
                              render={({ field: selectField }) => (
                                <Select
                                  value={selectField.value ?? ""}
                                  onValueChange={(value) => selectField.onChange(value)}
                                >
                                  <Select.Trigger id={`stock_location_${field.id}`}>
                                    <Select.Value placeholder="Selecione um local" />
                                  </Select.Trigger>
                                  <Select.Content>
                                    {availableStockLocations.map((location) => (
                                      <Select.Item key={location.id} value={location.id}>
                                        {location.name}
                                      </Select.Item>
                                    ))}
                                  </Select.Content>
                                </Select>
                              )}
                            />
                          </div>

                          <div className="flex flex-col gap-y-2">
                            <Label htmlFor={`bling_deposit_${field.id}`}>
                              ID do depósito no Bling
                            </Label>
                            <Input
                              id={`bling_deposit_${field.id}`}
                              placeholder="Ex.: 12345"
                              disabled={isSavingConfig}
                              {...register(
                                `sync_preferences.inventory.locations.${index}.bling_deposit_id`
                              )}
                            />
                          </div>

                          <div className="flex flex-col items-end justify-between gap-y-2">
                            <div className="flex items-center gap-x-2">
                              <Text className="text-xs text-ui-fg-subtle">Padrão</Text>
                              <Switch
                                checked={isDefault}
                                onCheckedChange={(checked) =>
                                  handleSetDefaultLocation(index, checked)
                                }
                                disabled={isSavingConfig}
                              />
                            </div>
                            <Button
                              variant="danger"
                              size="small"
                              onClick={() => handleRemoveLocation(index)}
                              disabled={isSavingConfig}
                            >
                              Remover
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-y-3 rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <Text className="font-semibold">Pedidos</Text>
                    <Text className="text-ui-fg-subtle">
                      Envia pedidos confirmados para o Bling e recebe atualizações fiscais e de
                      logística.
                    </Text>
                  </div>
                  <Controller
                    name="sync_preferences.orders.enabled"
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

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Controller
                    name="sync_preferences.orders.send_to_bling"
                    control={control}
                    render={({ field }) => (
                      <PreferenceToggle
                        label="Enviar pedidos ao Bling"
                        description="Gera pedidos automaticamente no Bling sempre que um pedido for confirmado no Medusa."
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={!orderSyncEnabled || isSavingConfig}
                      />
                    )}
                  />
                  <Controller
                    name="sync_preferences.orders.receive_from_bling"
                    control={control}
                    render={({ field }) => (
                      <PreferenceToggle
                        label="Receber atualizações do Bling"
                        description="Importa status, códigos de rastreio e notas fiscais emitidas diretamente no Bling."
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={!orderSyncEnabled || isSavingConfig}
                      />
                    )}
                  />
                  <Controller
                    name="sync_preferences.orders.generate_nf"
                    control={control}
                    render={({ field }) => (
                      <PreferenceToggle
                        label="Solicitar emissão de NF-e"
                        description="Quando ativo, solicita automaticamente a emissão de nota fiscal no Bling após a sincronização."
                        checked={field.value}
                        onChange={field.onChange}
                        disabled={!orderSyncEnabled || isSavingConfig}
                      />
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                variant="secondary"
                size="small"
                onClick={handleSubmit(handleSaveConfig)}
                disabled={isConfigLoading || isSavingConfig || isSubmitting}
              >
                Atualizar Preferências
              </Button>
            </div>
          </section>
        </div>
      </Container>

      <Container>
        <div className="flex flex-col gap-y-4">
          <Heading level="h2">Sincronização Manual</Heading>
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <Text className="font-semibold">Produtos e Estoque</Text>
              <Text className="text-ui-fg-subtle">
                Inicie uma sincronização sob demanda utilizando as preferências configuradas acima.
              </Text>
            </div>
            <Button variant="secondary" onClick={handleManualSync} disabled={!canSync}>
              {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
            </Button>
          </div>
          {renderProductSyncSummary()}
        </div>
      </Container>

      <Container>
        <div className="flex flex-col gap-y-4">
          <Heading level="h2">Sincronização de Pedidos</Heading>
          <div className="flex flex-col gap-y-3 rounded-lg border border-gray-200 p-4">
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="order_id_sync">ID do Pedido no Medusa</Label>
              <Input
                id="order_id_sync"
                placeholder="ex: order_01J8Z..."
                value={orderSyncId}
                onChange={(event) => setOrderSyncId(event.target.value)}
                disabled={isOrderSyncing}
              />
            </div>
            <div className="flex items-center justify-end gap-x-2">
              <Button
                variant="secondary"
                onClick={handleOrderSync}
                disabled={isOrderSyncing || !orderSyncId}
              >
                {isOrderSyncing ? "Sincronizando..." : "Enviar Pedido ao Bling"}
              </Button>
            </div>
          </div>
          {orderSyncResult && (
            <div className="flex flex-col gap-y-3 rounded-lg border border-gray-200 p-4">
              <div className="flex flex-row flex-wrap items-center gap-4">
                <StatBadge label="Itens" value={orderSyncResult.summary.total_items} />
                <StatBadge
                  label="Total"
                  value={orderSyncResult.summary.total_amount}
                  variant="info"
                />
                <StatBadge
                  label="Frete"
                  value={orderSyncResult.summary.freight_amount}
                  variant="info"
                />
              </div>
              <div className="text-sm text-ui-fg-subtle">
                {orderSyncResult.summary.bling_sale_id ? (
                  <>
                    Venda registrada com ID{" "}
                    <span className="font-semibold">{orderSyncResult.summary.bling_sale_id}</span>.
                  </>
                ) : (
                  <>Venda sincronizada sem ID retornado. Verifique o Bling para confirmar.</>
                )}
                <br />
                Última sincronização: {new Date(orderSyncResult.summary.synced_at).toLocaleString()}
              </div>
              {orderSyncWarnings.length > 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <Text className="font-semibold text-amber-900">Avisos</Text>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
                    {orderSyncWarnings.map((warning, index) => (
                      <li key={`order-warning-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
};

export default BlingSettingsPage;

type StatBadgeProps = {
  label: string;
  value: number;
  variant?: "default" | "success" | "info" | "warning";
};

const STAT_BADGE_STYLES: Record<NonNullable<StatBadgeProps["variant"]>, string> = {
  default: "border border-gray-200 bg-ui-bg-base text-ui-fg-base",
  success: "border border-green-200 bg-green-50 text-ui-tag-green-icon",
  info: "border border-blue-200 bg-blue-50 text-ui-tag-blue-icon",
  warning: "border border-amber-200 bg-amber-50 text-amber-900",
};

const StatBadge = ({ label, value, variant = "default" }: StatBadgeProps) => {
  return (
    <div className={`flex items-center gap-x-2 rounded-md px-3 py-2 ${STAT_BADGE_STYLES[variant]}`}>
      <Text className="text-xs uppercase tracking-wide">{label}</Text>
      <Text className="text-lg font-semibold">{value}</Text>
    </div>
  );
};

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
    <label className="flex cursor-pointer select-none items-start justify-between rounded-md bg-ui-bg-component px-4 py-3 shadow-elevation-card-rest transition hover:shadow-elevation-card-hover">
      <div className="mr-4 flex flex-col">
        <Text className="font-semibold">{label}</Text>
        <Text className="text-ui-fg-subtle">{description}</Text>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
};
