import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Input, Switch, Toast, Alert } from "@medusajs/ui"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

// Configuration schema
const blingConfigSchema = z.object({
  client_id: z.string().min(1, "Client ID é obrigatório"),
  client_secret: z.string().min(1, "Client Secret é obrigatório"),
  environment: z.enum(["production", "sandbox"]).default("production"),

  // Sync configurations
  sync_products_enabled: z.boolean().default(true),
  sync_products_import_images: z.boolean().default(false),
  sync_products_import_descriptions: z.boolean().default(true),
  sync_products_import_prices: z.boolean().default(true),
  sync_products_import_categories: z.boolean().default(true),
  sync_products_auto_sync: z.boolean().default(false),

  sync_orders_enabled: z.boolean().default(true),
  sync_orders_auto_send: z.boolean().default(true),
  sync_orders_generate_nfe: z.boolean().default(false),
  sync_orders_update_status: z.boolean().default(true),

  sync_inventory_enabled: z.boolean().default(true),
  sync_inventory_bidirectional: z.boolean().default(true),
  sync_inventory_interval: z.number().min(15).default(60),
})

type BlingConfigForm = z.infer<typeof blingConfigSchema>

const BlingConfigurationPage = () => {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connected" | "error">("disconnected")
  const [lastSync, setLastSync] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<BlingConfigForm>({
    resolver: zodResolver(blingConfigSchema),
    defaultValues: {
      environment: "production",
      sync_products_enabled: true,
      sync_products_import_images: false,
      sync_products_import_descriptions: true,
      sync_products_import_prices: true,
      sync_products_import_categories: true,
      sync_products_auto_sync: false,
      sync_orders_enabled: true,
      sync_orders_auto_send: true,
      sync_orders_generate_nfe: false,
      sync_orders_update_status: true,
      sync_inventory_enabled: true,
      sync_inventory_bidirectional: true,
      sync_inventory_interval: 60,
    }
  })

  // Load existing configuration
  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      const response = await fetch("/admin/bling/config")
      if (response.ok) {
        const config = await response.json()
        Object.keys(config).forEach((key) => {
          setValue(key as keyof BlingConfigForm, config[key])
        })
        setConnectionStatus(config.is_connected ? "connected" : "disconnected")
        setLastSync(config.last_sync)
      }
    } catch (error) {
      console.error("Erro ao carregar configuração:", error)
    }
  }

  const onSubmit = async (data: BlingConfigForm) => {
    setIsLoading(true)
    try {
      const response = await fetch("/admin/bling/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        Toast.success("Configuração salva com sucesso!")
        await testConnection()
      } else {
        Toast.error("Erro ao salvar configuração")
      }
    } catch (error) {
      Toast.error("Erro ao salvar configuração")
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/admin/bling/test-connection", {
        method: "POST",
      })

      if (response.ok) {
        setConnectionStatus("connected")
        Toast.success("Conexão com Bling estabelecida!")
      } else {
        setConnectionStatus("error")
        Toast.error("Erro na conexão com Bling")
      }
    } catch (error) {
      setConnectionStatus("error")
      Toast.error("Erro ao testar conexão")
    } finally {
      setIsLoading(false)
    }
  }

  const initiateOAuth = async () => {
    try {
      const response = await fetch("/admin/bling/oauth/url")
      const { auth_url } = await response.json()
      window.open(auth_url, "_blank", "width=600,height=600")
    } catch (error) {
      Toast.error("Erro ao iniciar autenticação OAuth")
    }
  }

  const syncProducts = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/admin/bling/sync/products", {
        method: "POST",
      })

      if (response.ok) {
        Toast.success("Sincronização de produtos iniciada!")
      } else {
        Toast.error("Erro ao sincronizar produtos")
      }
    } catch (error) {
      Toast.error("Erro ao sincronizar produtos")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h1">Configuração Bling</Heading>
            <Text className="text-ui-fg-subtle">
              Configure a integração com o ERP Bling para sincronização de produtos, pedidos e estoque
            </Text>
          </div>
          {connectionStatus === "connected" && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <Text size="small" className="text-green-600">Conectado</Text>
            </div>
          )}
        </div>

        {/* Connection Status Alert */}
        {connectionStatus === "error" && (
          <Alert variant="error">
            <Alert.Title>Erro de Conexão</Alert.Title>
            <Alert.Description>
              Não foi possível conectar com o Bling. Verifique suas credenciais e tente novamente.
            </Alert.Description>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Credentials Section */}
          <div className="border rounded-lg p-6">
            <Heading level="h2" className="mb-4">Credenciais do Bling</Heading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Client ID</label>
                <Input
                  {...register("client_id")}
                  placeholder="Seu Client ID do Bling"
                />
                {errors.client_id && (
                  <Text size="small" className="text-red-500 mt-1">
                    {errors.client_id.message}
                  </Text>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Client Secret</label>
                <Input
                  {...register("client_secret")}
                  type="password"
                  placeholder="Seu Client Secret do Bling"
                />
                {errors.client_secret && (
                  <Text size="small" className="text-red-500 mt-1">
                    {errors.client_secret.message}
                  </Text>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Ambiente</label>
                <select {...register("environment")} className="w-full px-3 py-2 border rounded-md">
                  <option value="production">Produção</option>
                  <option value="sandbox">Sandbox</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={initiateOAuth}
                disabled={isLoading}
              >
                Autorizar OAuth
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={testConnection}
                disabled={isLoading}
              >
                Testar Conexão
              </Button>
            </div>
          </div>

          {/* Products Sync Configuration */}
          <div className="border rounded-lg p-6">
            <Heading level="h2" className="mb-4">Sincronização de Produtos</Heading>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Text weight="plus">Habilitar sincronização de produtos</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    Permite importar e sincronizar produtos do Bling
                  </Text>
                </div>
                <Switch {...register("sync_products_enabled")} />
              </div>

              {watch("sync_products_enabled") && (
                <div className="ml-4 space-y-3 border-l-2 border-gray-200 pl-4">
                  <div className="flex items-center justify-between">
                    <Text>Importar imagens</Text>
                    <Switch {...register("sync_products_import_images")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Text>Importar descrições</Text>
                    <Switch {...register("sync_products_import_descriptions")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Text>Importar preços</Text>
                    <Switch {...register("sync_products_import_prices")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Text>Importar categorias</Text>
                    <Switch {...register("sync_products_import_categories")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Text>Sincronização automática</Text>
                    <Switch {...register("sync_products_auto_sync")} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Orders Sync Configuration */}
          <div className="border rounded-lg p-6">
            <Heading level="h2" className="mb-4">Sincronização de Pedidos</Heading>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Text weight="plus">Habilitar sincronização de pedidos</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    Envia pedidos do Medusa para o Bling automaticamente
                  </Text>
                </div>
                <Switch {...register("sync_orders_enabled")} />
              </div>

              {watch("sync_orders_enabled") && (
                <div className="ml-4 space-y-3 border-l-2 border-gray-200 pl-4">
                  <div className="flex items-center justify-between">
                    <Text>Envio automático para Bling</Text>
                    <Switch {...register("sync_orders_auto_send")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Text>Gerar NFe automaticamente</Text>
                    <Switch {...register("sync_orders_generate_nfe")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <Text>Atualizar status dos pedidos</Text>
                    <Switch {...register("sync_orders_update_status")} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Inventory Sync Configuration */}
          <div className="border rounded-lg p-6">
            <Heading level="h2" className="mb-4">Sincronização de Estoque</Heading>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Text weight="plus">Habilitar sincronização de estoque</Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    Mantém o estoque sincronizado entre Medusa e Bling
                  </Text>
                </div>
                <Switch {...register("sync_inventory_enabled")} />
              </div>

              {watch("sync_inventory_enabled") && (
                <div className="ml-4 space-y-3 border-l-2 border-gray-200 pl-4">
                  <div className="flex items-center justify-between">
                    <Text>Sincronização bidirecional</Text>
                    <Switch {...register("sync_inventory_bidirectional")} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Intervalo de sincronização (minutos)
                    </label>
                    <Input
                      {...register("sync_inventory_interval", { valueAsNumber: true })}
                      type="number"
                      min="15"
                      placeholder="60"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isLoading || !isDirty}
            >
              Salvar Configurações
            </Button>

            {connectionStatus === "connected" && (
              <Button
                type="button"
                variant="secondary"
                onClick={syncProducts}
                disabled={isLoading}
              >
                Sincronizar Produtos Agora
              </Button>
            )}
          </div>

          {/* Last Sync Info */}
          {lastSync && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <Text size="small" className="text-ui-fg-subtle">
                Última sincronização: {new Date(lastSync).toLocaleString('pt-BR')}
              </Text>
            </div>
          )}
        </form>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Bling",
  description: "Configuração da integração com ERP Bling"
})

export default BlingConfigurationPage