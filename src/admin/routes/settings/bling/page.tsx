import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  useToast,
  Badge,
} from "@medusajs/ui"
import { useAdminCustomMutation, useAdminCustomQuery } from "medusa-react"
import { useForm } from "react-hook-form"
import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"

type BlingConfigForm = {
  client_id: string
  client_secret: string
}

const BlingSettingsPage = () => {
  const { register, handleSubmit, reset, watch } = useForm<BlingConfigForm>()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const clientId = watch("client_id");
  const clientSecret = watch("client_secret");

  // Fetch current config and connection status
  const { data: configData, isLoading: isConfigLoading, refetch: refetchConfig } = useAdminCustomQuery<any, BlingConfigForm & { is_connected: boolean }>(
    "/bling/config",
    ["bling-config"]
  )

  const { data: healthData, isLoading: isHealthLoading, refetch: refetchHealth } = useAdminCustomQuery<any, { status: string }>(
    "/bling/health",
    ["bling-connection-status"]
  )

  // Set form values once config data is loaded
  useEffect(() => {
    if (!isConfigLoading && configData) {
      reset({ client_id: configData.client_id, client_secret: configData.client_secret })
    }
  }, [isConfigLoading, configData, reset])

  // Handle OAuth callback messages
  useEffect(() => {
    if (searchParams.get("auth_success")) {
      toast({ variant: "success", title: "Sucesso", description: "Bling conectado com sucesso!" })
      refetchHealth(); // Refresh connection status
      searchParams.delete("auth_success")
      setSearchParams(searchParams)
    }
    if (searchParams.get("auth_error")) {
      const errorMessage = searchParams.get("message") || "Falha ao conectar com o Bling.";
      toast({ variant: "error", title: "Erro", description: errorMessage })
      searchParams.delete("auth_error")
      searchParams.delete("message")
      setSearchParams(searchParams)
    }
  }, [searchParams, setSearchParams, toast, refetchHealth])

  // Mutation to save credentials
  const { mutate: saveConfigMutate, isLoading: isSavingConfig } = useAdminCustomMutation(
    "/bling/config",
    "POST",
    ["bling-config"],
    {
      onSuccess: () => {
        toast({
          variant: "success",
          title: "Sucesso",
          description: "Credenciais do Bling salvas com sucesso.",
        })
        refetchConfig(); // Refresh config data
      },
      onError: (error: any) => {
        toast({
          variant: "error",
          title: "Erro",
          description: error.response?.data?.message || "Falha ao salvar as credenciais do Bling.",
        })
      },
    }
  )

  // Mutation to trigger sync
  const { mutate: syncMutate, isLoading: isSyncing } = useAdminCustomMutation(
    "/bling/sync",
    "POST",
    [],
    {
      onSuccess: () => {
        toast({
          variant: "success",
          title: "Sincronização Iniciada",
          description: "Buscando produtos e estoque do Bling. Verifique os logs do servidor para o resultado.",
        })
      },
      onError: (error: any) => {
        toast({
          variant: "error",
          title: "Erro",
          description: error.response?.data?.message || "Falha ao iniciar a sincronização.",
        })
      },
    }
  )

  const handleSaveConfig = (formData: BlingConfigForm) => {
    saveConfigMutate(formData)
  }

  const handleConnectBling = () => {
    window.location.href = "/admin/bling/authorize";
  }

  const isConnected = healthData?.status === 'ok';
  const canConnect = clientId && clientSecret && !isConfigLoading && !isSavingConfig;
  const canSync = isConnected && !isSyncing;

  return (
    <Container>
      <div className="flex flex-col gap-y-4">
        <div>
          <Heading level="h1">Configurações do Bling ERP</Heading>
          <Text className="text-ui-fg-subtle">
            Gerencie suas credenciais e opções de sincronização com o Bling.
          </Text>
        </div>

        <div className="flex flex-col gap-y-8">
          {/* Credenciais da API */}
          <div className="flex flex-col gap-y-4">
            <Heading level="h2">Credenciais da API</Heading>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="client_id">Client ID</Label>
                <Input
                  id="client_id"
                  placeholder="Seu Client ID do Bling"
                  {...register("client_id")}
                  disabled={isConfigLoading || isSavingConfig}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="client_secret">Client Secret</Label>
                <Input
                  id="client_secret"
                  type="password"
                  placeholder="Seu Client Secret do Bling"
                  {...register("client_secret")}
                  disabled={isConfigLoading || isSavingConfig}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-x-2">
              <Button
                variant="primary"
                size="small"
                onClick={handleSubmit(handleSaveConfig)}
                disabled={isConfigLoading || isSavingConfig}
              >
                Salvar Credenciais
              </Button>
            </div>
          </div>

          {/* Conexão OAuth */}
          <div className="flex flex-col gap-y-4">
            <Heading level="h2">Conexão com Bling</Heading>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-x-4">
                <Text className="font-semibold">Status da Conexão</Text>
                {(isConfigLoading || isHealthLoading) && <Badge color="grey">Verificando...</Badge>}
                {isConnected && <Badge color="green">Conectado</Badge>}
                {!isConnected && !(isConfigLoading || isHealthLoading) && <Badge color="red">Desconectado</Badge>}
              </div>
              <Button 
                variant="secondary" 
                onClick={handleConnectBling}
                disabled={!canConnect || isConnected}
              >
                {isConnected ? 'Reconectar' : 'Conectar com Bling'}
              </Button>
            </div>
          </div>

          {/* Sincronização Manual */}
          <div className="flex flex-col gap-y-4">
            <Heading level="h2">Sincronização Manual</Heading>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                    <Text className="font-semibold">Produtos e Estoque</Text>
                    <Text className="text-ui-fg-subtle">
                        Clique para buscar todos os produtos e níveis de estoque do Bling. Isso pode levar alguns minutos.
                    </Text>
                </div>
                <Button 
                  variant="secondary" 
                  onClick={() => syncMutate({})}
                  disabled={!canSync}
                >
                  Sincronizar Agora
                </Button>
            </div>
          </div>

        </div>
      </div>
    </Container>
  )
}

export default BlingSettingsPage
