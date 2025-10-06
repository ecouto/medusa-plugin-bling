import { Container, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

const BlingSettingsWidget = () => {
  return (
    <Container>
      <Text>Link para as configurações do Bling</Text>
      <Link to="/a/settings/bling">Ir para Configurações</Link>
    </Container>
  )
}

export default BlingSettingsWidget