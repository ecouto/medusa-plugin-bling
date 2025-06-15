# Medusa Plugin Bling

Plugin oficial para integração entre **Medusa v2** e **Bling ERP** - Solução completa para e-commerce brasileiro.

## 🚀 Recursos

- ✅ **Sincronização automática de pedidos** - Pedidos do Medusa são enviados automaticamente para o Bling
- ✅ **Geração de etiquetas de envio** - Crie etiquetas diretamente pelo Bling
- ✅ **Sincronização de produtos** - Importe produtos do Bling para Medusa
- ✅ **Controle de estoque** - Sincronização bidirecional de inventário
- ✅ **Webhooks** - Atualizações em tempo real via webhooks do Bling
- ✅ **Jobs automáticos** - Sincronização periódica de dados
- ✅ **Suporte multi-canal** - Integre Mercado Livre, Shopee e loja própria
- ✅ **OAuth 2.0** - Autenticação segura com refresh token automático

## 📦 Instalação

```bash
npm install medusa-plugin-bling
# ou
yarn add medusa-plugin-bling
```

## ⚙️ Configuração

### 1. Criar Aplicação no Bling

1. **Acesse:** https://developer.bling.com.br
2. **Crie uma aplicação** com os seguintes escopos:
   - ✅ Produtos (Leitura/Escrita)
   - ✅ Pedidos de Venda (Leitura/Escrita)
   - ✅ Estoques (Leitura/Escrita)
   - ✅ Contatos (Leitura/Escrita)
   - ✅ Logística (Leitura/Escrita)
3. **Configure URL de redirecionamento:** `http://localhost:9000/bling/callback`
4. **Anote** `CLIENT_ID` e `CLIENT_SECRET`

### 2. Obter Tokens de Acesso

1. **Abra o link de autorização** (substitua YOUR_CLIENT_ID):
```
https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=YOUR_CLIENT_ID&state=medusa
```

2. **Autorize a aplicação** e copie o `code` da URL de retorno

3. **Troque o código por tokens** usando cURL:
```bash
curl -X POST https://www.bling.com.br/Api/v3/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" \
  -d "grant_type=authorization_code&code=SEU_CODIGO"
```

### 3. Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```bash
# Bling API Credentials
BLING_CLIENT_ID=seu_client_id
BLING_CLIENT_SECRET=seu_client_secret
BLING_ACCESS_TOKEN=seu_access_token
BLING_REFRESH_TOKEN=seu_refresh_token
BLING_ENVIRONMENT=production
```

### 4. Configuração do Plugin

No seu `medusa-config.ts`:

```typescript
// Medusa v2 Configuration
import { defineConfig } from '@medusajs/framework/utils'

module.exports = defineConfig({
  // ... outras configurações
  modules: [
    {
      resolve: "medusa-plugin-bling",
      key: "blingService", // ← OBRIGATÓRIO!
      options: {
        client_id: process.env.BLING_CLIENT_ID,
        client_secret: process.env.BLING_CLIENT_SECRET,
        access_token: process.env.BLING_ACCESS_TOKEN,
        refresh_token: process.env.BLING_REFRESH_TOKEN,
        environment: process.env.BLING_ENVIRONMENT || "production"
      }
    }
  ]
})
```

**⚠️ IMPORTANTE:** O parâmetro `key: "blingService"` é obrigatório no Medusa v2 para plugins customizados!

## 🔧 Como Usar

### Usando o BlingService

O plugin fornece um serviço completo para integração com a API do Bling:

```typescript
import { BlingService } from "medusa-plugin-bling"

// Instanciar o serviço
const blingService = new BlingService({
  client_id: process.env.BLING_CLIENT_ID,
  client_secret: process.env.BLING_CLIENT_SECRET,
  access_token: process.env.BLING_ACCESS_TOKEN,
  refresh_token: process.env.BLING_REFRESH_TOKEN,
  environment: "production"
})

// Listar produtos
const products = await blingService.listProducts({ limite: 10 })

// Criar produto
const product = await blingService.createProduct({
  descricao: "Produto Teste",
  preco: 99.90,
  situacao: "A"
})

// Criar pedido
const order = await blingService.createOrder({
  data: "2024-01-15",
  contato: {
    nome: "Cliente Teste",
    email: "cliente@teste.com"
  },
  itens: [{
    descricao: "Produto",
    quantidade: 1,
    valor: 99.90
  }]
})

// Gerar etiqueta de envio
const label = await blingService.generateShippingLabel(orderId)

// Atualizar estoque
await blingService.updateInventory(productId, 50, "entrada")
```

## 🚀 Versão Atual

Esta é a **versão 1.0** do plugin, que inclui:
- ✅ **BlingService** - Classe principal para comunicação com API
- ✅ **Autenticação OAuth 2.0** - Com refresh automático de tokens  
- ✅ **Operações CRUD** - Produtos, pedidos, estoque
- ✅ **Geração de etiquetas** - Shipping labels via Bling
- ✅ **Tipos TypeScript** - Tipagem completa da API
- ✅ **Mapeadores de dados** - Conversão entre formatos Medusa/Bling

## 🔮 Próximas Versões

Funcionalidades planejadas:
- 🔄 **Workflows automáticos** - Sincronização automática de pedidos
- 📡 **Webhooks** - Eventos em tempo real do Bling
- ⏰ **Jobs periódicos** - Sincronização de estoque automática
- 🔗 **Subscribers** - Integração com eventos do Medusa

## 🗃️ Estrutura de Dados

### Metadata dos Produtos

```typescript
{
  bling_id: "12345",
  bling_codigo: "PROD001",
  bling_synced_at: "2024-01-15T10:00:00.000Z"
}
```

### Metadata dos Pedidos

```typescript
{
  bling_id: "67890",
  bling_numero: "1001",
  bling_status: 3,
  bling_synced_at: "2024-01-15T10:00:00.000Z",
  bling_shipping_label_url: "https://...",
  bling_tracking_code: "BR123456789"
}
```

## 🛠️ Desenvolvimento

### Estrutura do Projeto

```
src/
├── api/          # Rotas da API (webhooks)
├── services/     # BlingService
├── workflows/    # Workflows de sincronização
├── subscribers/  # Event handlers
├── jobs/         # Jobs agendados
├── types/        # Tipos TypeScript
└── utils/        # Utilitários (BlingMapper)
```

### Compilação

```bash
npm run build
```

### Testes

```bash
npm test
```

## 🔒 Segurança

- **OAuth 2.0**: Autenticação segura com tokens
- **Webhook validation**: Validação de assinatura dos webhooks
- **Rate limiting**: Respeita os limites da API do Bling
- **Error handling**: Tratamento robusto de erros

## 🐛 Troubleshooting

### Erro de Autenticação
```bash
# Verifique suas credenciais
BLING_CLIENT_ID=correto
BLING_CLIENT_SECRET=correto
```

### Pedidos não sincronizando
1. Verifique se `auto_sync_orders: true`
2. Verifique logs do Medusa
3. Confirme se o webhook está configurado

### Problemas de Estoque
1. Verifique se os produtos têm `bling_id` no metadata
2. Confirme se `auto_sync_inventory: true`
3. Verifique se o produto existe no Bling

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/your-username/medusa-plugin-bling/issues)
- **Documentação**: [Bling API Docs](https://developer.bling.com.br/bling-api)
- **Medusa Docs**: [Medusa Documentation](https://docs.medusajs.com/)

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, veja [CONTRIBUTING.md](CONTRIBUTING.md) para diretrizes.

---

**Desenvolvido com ❤️ para o e-commerce brasileiro**