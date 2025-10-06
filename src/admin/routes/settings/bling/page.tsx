import {
  Button,
  Container,
  Heading,
  Text,
  useToast,
  Badge,
} from "@medusajs/ui"
import { useAdminCustomQuery } from "medusa-react"
import { useSearchParams } from "react-router-dom"
import { useEffect } from "react"

const BlingSettingsPage = () => {
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  // Fetch connection status
  const { data, isLoading, isSuccess, isError } = useAdminCustomQuery<any, { status: string }>( 
    "/bling/health", // We need to create this health-check endpoint
    ["bling-connection-status"]
  )

  useEffect(() => {
    if (searchParams.get("auth_success")) {
      toast({ variant: "success", title: "Sucesso", description: "Bling conectado com sucesso!" })
      searchParams.delete("auth_success")
      setSearchParams(searchParams)
    }
    if (searchParams.get("auth_error")) {
      toast({ variant: "error", title: "Erro", description: "Falha ao conectar com o Bling." })
      searchParams.delete("auth_error")
      setSearchParams(searchParams)
    }
  }, [searchParams, setSearchParams, toast])

  const handleConnect = () => {
    window.location.href = "/admin/bling/authorize";
  }

  return (
    <Container>
      <div className="flex flex-col gap-y-4">
        <div>
          <Heading level="h1">Configurações do Bling ERP</Heading>
          <Text className="text-ui-fg-subtle">
            Gerencie sua conexão e sincronização com o Bling.
          </Text>
        </div>
        <div className="flex flex-col gap-y-8">
          <div className="flex flex-col gap-y-4">
            <Heading level="h2">Conexão</Heading>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-x-4">
                <Text className="font-semibold">Status da Conexão</Text>
                {isLoading && <Badge color="grey">Verificando...</Badge>}
                {isSuccess && data?.status === 'ok' && <Badge color="green">Conectado</Badge>}
                {(isError || (isSuccess && data?.status !== 'ok')) && <Badge color="red">Desconectado</Badge>}
              </div>
              <Button variant="secondary" onClick={handleConnect}>
                {isSuccess && data?.status === 'ok' ? 'Reconectar' : 'Conectar com Bling'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

export default BlingSettingsPage
