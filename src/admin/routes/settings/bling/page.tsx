import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
  useToast,
} from "@medusajs/ui"
import { useAdminCustomMutation, useAdminCustomQuery } from "medusa-react"
import { useForm } from "react-hook-form"
import { useEffect } from "react"

type BlingForm = {
  client_id: string
  client_secret: string
}

            </div>
          </div>

          <div className="flex flex-col gap-y-4">
            <Heading level="h2">Sincronização Manual</Heading>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div>
                    <Text className="font-semibold">Produtos e Estoque</Text>
                    <Text className="text-ui-fg-subtle">
                        Clique para buscar todos os produtos e níveis de estoque do Bling. Isso pode levar alguns minutos.
                    </Text>
                </div>
                <Button variant="secondary" onClick={() => syncMutate({})}>Sincronizar Agora</Button>
            </div>
          </div>

        </div>
        <div className="flex items-center justify-end gap-x-2">
          <Button
            variant="primary"
            size="small"
            onClick={handleSubmit(onSubmit)}
            disabled={isLoading || isSaving}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Container>
  )
}

const BlingSettingsPage = () => {
  const { register, handleSubmit, reset } = useForm<BlingForm>()
  const { toast } = useToast()

  const { data, isLoading } = useAdminCustomQuery<any, BlingForm>(
    "/bling/config",
    ["bling-settings"]
  )

  useEffect(() => {
    if (!isLoading && data) {
      reset(data)
    }
  }, [isLoading, data, reset])

  const { mutate: saveMutate, isLoading: isSaving } = useAdminCustomMutation(
    "/bling/config",
    "POST",
    ["bling-settings"],
    {
      onSuccess: () => {
        toast({
          variant: "success",
          title: "Sucesso",
          description: "Configurações do Bling salvas com sucesso.",
        })
      },
      onError: () => {
        toast({
          variant: "error",
          title: "Erro",
          description: "Falha ao salvar as configurações do Bling.",
        })
      },
    }
  )

  const { mutate: syncMutate } = useAdminCustomMutation(
    "/bling/sync",
    "POST",
    [],
    {
      onSuccess: () => {
        toast({
          variant: "success",
          title: "Sincronização Iniciada",
          description: "Buscando produtos do Bling. Verifique os logs do servidor para o resultado.",
        })
      },
      onError: () => {
        toast({
          variant: "error",
          title: "Erro",
          description: "Falha ao iniciar a sincronização.",
        })
      },
    }
  )

  const onSubmit = (formData: BlingForm) => {
    saveMutate(formData)
  }

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
          <div className="flex flex-col gap-y-4">
            <Heading level="h2">Credenciais da API</Heading>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="client_id">Client ID</Label>
                <Input
                  id="client_id"
                  placeholder="Seu Client ID do Bling"
                  {...register("client_id")}
                  disabled={isLoading}
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="client_secret">Client Secret</Label>
                <Input
                  id="client_secret"
                  type="password"
                  placeholder="Seu Client Secret do Bling"
                  {...register("client_secret")}
                  disabled={isLoading}
                />
              </div>

export default BlingSettingsPage