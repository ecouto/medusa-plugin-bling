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

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis ao seu arquivo `.env`:

```bash
# Bling API Credentials
BLING_CLIENT_ID=seu_client_id
BLING_CLIENT_SECRET=seu_client_secret
BLING_ACCESS_TOKEN=seu_access_token
BLING_REFRESH_TOKEN=seu_refresh_token
BLING_WEBHOOK_SECRET=seu_webhook_secret
BLING_ENVIRONMENT=sandbox # ou production
```

### 2. Configuração do Plugin

No seu `medusa-config.ts`:

```typescript
const plugins = [
  // ... outros plugins
  {
    resolve: "medusa-plugin-bling",
    options: {
      client_id: process.env.BLING_CLIENT_ID,
      client_secret: process.env.BLING_CLIENT_SECRET,
      access_token: process.env.BLING_ACCESS_TOKEN,
      refresh_token: process.env.BLING_REFRESH_TOKEN,
      environment: process.env.BLING_ENVIRONMENT || "sandbox",
      webhook_secret: process.env.BLING_WEBHOOK_SECRET,
      
      // Configurações opcionais
      auto_sync_orders: true,        // Sincronizar pedidos automaticamente
      auto_sync_inventory: true,     // Sincronizar estoque automaticamente
      auto_generate_labels: false    // Gerar etiquetas automaticamente
    }
  }
]
```

## 🔧 Como Usar

### Sincronização Automática

O plugin funciona automaticamente após a configuração:

1. **Pedidos**: Quando um pedido é criado no Medusa, ele é automaticamente enviado para o Bling
2. **Estoque**: Mudanças no estoque são sincronizadas entre os sistemas
3. **Status**: Updates de status do Bling são refletidos no Medusa via webhooks

### Uso Manual dos Workflows

```typescript
// Sincronizar pedido específico
await syncOrderToBlingWorkflow.run({
  input: { order_id: "order_123" }
})

// Importar produto do Bling
await syncProductFromBlingWorkflow.run({
  input: { bling_product_id: 12345 }
})

// Gerar etiqueta de envio
await generateShippingLabelWorkflow.run({
  input: { 
    order_id: "order_123",
    transporter_id: 1 // opcional
  }
})

// Sincronizar estoque
await syncInventoryWorkflow.run({
  input: {
    product_variant_id: "variant_123",
    quantity: 100,
    direction: "medusa-to-bling"
  }
})
```

### Usando o BlingService

```typescript
// Injeção de dependência
const blingService = container.resolve("blingService")

// Autenticar
await blingService.authenticate()

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

// Gerar etiqueta
const label = await blingService.generateShippingLabel(orderId)
```

## 🔗 Webhooks

Configure os webhooks no painel do Bling apontando para:

```
https://sua-loja.com/webhooks/bling
```

### Eventos Suportados

- **produto.created** - Produto criado no Bling
- **produto.updated** - Produto atualizado no Bling
- **produto.deleted** - Produto deletado no Bling
- **pedido.updated** - Status do pedido atualizado
- **estoque.updated** - Estoque atualizado no Bling

## 📋 Jobs Automáticos

### Sincronização Diária de Estoque
- **Horário**: 02:00 todos os dias
- **Função**: Sincroniza estoque do Bling para Medusa

### Sincronização de Status de Pedidos
- **Horário**: A cada 30 minutos
- **Função**: Atualiza status dos pedidos baseado no Bling

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