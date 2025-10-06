import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Text,
} from "@medusajs/ui"
import { useForm } from "react-hook-form"

// TODO: Fetch and update settings via API
// import { useAdminUpdateSettings, useAdminSettings } from "medusa-react"

type BlingForm = {
  client_id: string
  client_secret: string
}

const BlingSettingsPage = () => {
  const { register, handleSubmit } = useForm<BlingForm>()

  // TODO: Replace with actual API call
  const onSubmit = (data: BlingForm) => {
    console.log("Saving settings:", data)
    // const { mutate } = useAdminUpdateSettings() 
    // mutate(data)
  }

  // TODO: Load initial data
  // const { settings } = useAdminSettings()

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
                />
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="client_secret">Client Secret</Label>
                <Input
                  id="client_secret"
                  type="password"
                  placeholder="Seu Client Secret do Bling"
                  {...register("client_secret")}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-x-2">
          <Button
            variant="primary"
            size="small"
            onClick={handleSubmit(onSubmit)}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Container>
  )
}

export default BlingSettingsPage
