import { Container, Heading } from "@medusajs/ui";

const BlingSettingsPage = () => {
  return (
    <Container>
      <Heading level="h1">Configuracoes do Bling ERP</Heading>
      <div className="mt-4">
        <p className="text-grey-50">
          Aqui voce podera configurar seu Client ID, Client Secret e outras opcoes de sincronizacao.
        </p>
        {/* TODO: Adicionar campos do formulario de configuracao */}
      </div>
    </Container>
  );
};

export default BlingSettingsPage;
