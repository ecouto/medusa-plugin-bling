import { Container, Heading } from "@medusajs/ui"

const BlingSettingsPage = () => {
  return (
    <Container>
      <Heading level="h1">Configurações do Bling ERP</Heading>
      <div className="mt-4">
        <p className="text-grey-50">
          Aqui você poderá configurar seu Client ID, Client Secret e outras opções de sincronização.
        </p>
        {/* TODO: Adicionar campos do formulário de configuração */}
      </div>
    </Container>
  )
}

export default BlingSettingsPage
