# Medusa Plugin Bling v2.0

Plugin oficial para integração entre **Medusa v2+** e **Bling ERP** - Solução completa para e-commerce brasileiro com interface admin e configurações granulares.

## 🚀 Recursos v2.0

- ✅ **Interface Admin Completa** - Configure tudo pelo painel administrativo
- ✅ **Configurações Granulares** - Controle total sobre o que sincronizar
- ✅ **OAuth 2.0 Automático** - Autenticação segura via interface
- ✅ **Sincronização Automática** - Pedidos, produtos e estoque
- ✅ **Webhooks em Tempo Real** - Atualizações instantâneas
- ✅ **Workflows Avançados** - Processamento assíncrono
- ✅ **Jobs Agendados** - Sincronização periódica automática
- ✅ **Toggles de Controle** - Ative/desative recursos específicos
- ✅ **Logs Detalhados** - Monitoramento completo das operações

## 📦 Instalação

```bash
npm install medusa-plugin-bling
# ou
yarn add medusa-plugin-bling
```

## ⚙️ Configuração

### 1. Adicionar ao Medusa

No seu `medusa-config.js`:

```javascript
import { defineConfig } from '@medusajs/framework/utils'

export default defineConfig({
  plugins: [
    {
      resolve: "medusa-plugin-bling",
      options: {
        enableUI: true, // Habilita interface admin
        // Todas as outras configurações são feitas via interface
      }
    }
  ]
})
```

### 2. Criar Aplicação no Bling

1. **Acesse:** https://developer.bling.com.br
2. **Crie uma aplicação** com os seguintes escopos:
   - ✅ Produtos (Leitura/Escrita)
   - ✅ Pedidos de Venda (Leitura/Escrita)
   - ✅ Estoques (Leitura/Escrita)
   - ✅ Contatos (Leitura/Escrita)
   - ✅ Logística (Leitura/Escrita)
3. **Configure URL de redirecionamento:**
   ```
   https://seu-dominio.com/admin/bling/oauth/callback
   ```

### 3. Configurar via Interface Admin

1. **Acesse o Admin:** `https://seu-dominio.com/app`
2. **Navegue para:** Configurações → Bling
3. **Configure:**
   - Client ID e Client Secret
   - Ambiente (Produção/Sandbox)
   - Clique em "Autorizar OAuth"
   - Configure as sincronizações desejadas

## 🎛️ Configurações Disponíveis

### Sincronização de Produtos
- ✅ **Habilitar sincronização** - Liga/desliga a sincronização
- ✅ **Importar imagens** - Controla se traz imagens do Bling
- ✅ **Importar descrições** - Controla descrições
- ✅ **Importar preços** - Controla preços
- ✅ **Importar categorias** - Controla categorias
- ✅ **Sincronização automática** - Sync contínua

### Sincronização de Pedidos
- ✅ **Habilitar sincronização** - Liga/desliga envio de pedidos
- ✅ **Envio automático** - Envia pedidos automaticamente
- ✅ **Gerar NFe** - Geração automática de NFe
- ✅ **Atualizar status** - Sincroniza status dos pedidos

### Sincronização de Estoque
- ✅ **Habilitar sincronização** - Liga/desliga sync de estoque
- ✅ **Bidirecional** - Sync nos dois sentidos
- ✅ **Intervalo** - Frequência da sincronização (minutos)

## 🔧 Fluxo de Uso

### 1. Configuração Inicial
```javascript
// Nenhuma configuração manual necessária
// Tudo é feito via interface admin
```

### 2. Primeira Sincronização
1. Configure credenciais no admin
2. Autorize OAuth
3. Configure toggles de sincronização
4. Clique em "Sincronizar Produtos Agora"

### 3. Operação Automática
- Pedidos são enviados automaticamente ao Bling
- Estoque é sincronizado periodicamente
- Webhooks atualizam dados em tempo real
- Logs mostram todas as operações

## 🔄 Fluxos Automatizados

### Quando um Pedido é Feito
1. Pedido é capturado pelo subscriber
2. Workflow mapeia dados Medusa → Bling
3. Pedido é enviado ao Bling
4. NFe é gerada (se habilitada)
5. Metadata é atualizada no Medusa

### Sincronização de Estoque
1. Job roda a cada intervalo configurado
2. Busca produtos vinculados ao Bling
3. Compara quantidades
4. Atualiza divergências
5. Registra logs das operações

### Webhooks do Bling
1. Bling envia webhook para `/bling/webhooks`
2. Payload é validado
3. Evento é processado conforme tipo
4. Dados são atualizados no Medusa

## 🗃️ Estrutura de Dados

### Produtos Sincronizados
```typescript
// Metadata no produto Medusa
{
  bling_id: "12345",
  bling_codigo: "PROD001",
  bling_synced_at: "2024-01-15T10:00:00.000Z"
}
```

### Pedidos Sincronizados
```typescript
// Metadata no pedido Medusa
{
  bling_id: "67890",
  bling_numero: "1001",
  bling_synced_at: "2024-01-15T10:00:00.000Z",
  bling_nfe_generated: true
}
```

## 🛠️ Estrutura do Plugin

```
src/
├── admin/              # Interface administrativa
│   ├── routes/         # Páginas do admin
│   ├── components/     # Componentes reutilizáveis
│   ├── hooks/          # React hooks
│   └── utils/          # Utilitários do admin
├── api/                # Endpoints da API
│   ├── admin/          # APIs do admin
│   └── bling/          # Webhooks do Bling
├── modules/            # Módulo principal
│   └── bling/          # Service e tipos
├── workflows/          # Workflows de sincronização
├── subscribers/        # Event handlers
├── jobs/               # Jobs agendados
└── index.ts           # Configuração do plugin
```

## 🔒 Segurança

- **OAuth 2.0** com refresh automático
- **Validação de webhooks** com assinatura
- **Configurações no banco** (não em variáveis)
- **Logs auditáveis** de todas as operações
- **Rate limiting** respeitado

## 📊 Monitoramento

### Logs de Sincronização
Acesse via banco de dados:
```sql
SELECT * FROM bling_sync_log
ORDER BY created_at DESC;
```

### Status da Conexão
Verificado automaticamente na interface admin.

### Webhooks Recebidos
```sql
SELECT * FROM bling_webhook_log
ORDER BY received_at DESC;
```

## 🐛 Troubleshooting

### Plugin não aparece no Admin
1. Verifique se `enableUI: true` está configurado
2. Reinicie o servidor Medusa
3. Limpe cache do navegador

### OAuth não funciona
1. Verifique URL de callback no Bling
2. Confirme Client ID e Secret
3. Verifique logs do navegador

### Sincronização não funciona
1. Verifique toggles de configuração
2. Consulte logs de sincronização
3. Teste conexão no admin

## 📈 Performance

- **Jobs em background** para operações pesadas
- **Rate limiting** automático
- **Retry logic** em falhas temporárias
- **Processamento assíncrono** via workflows

## 🆕 Migração da v1.0

Se você já usa a v1.0:

1. Remova configurações do `medusa-config.js`
2. Atualize para v2.0: `npm install medusa-plugin-bling@2.0.0`
3. Configure via interface admin
4. Reauthorize OAuth
5. Configure novos toggles

## 📞 Suporte

- **Issues**: [GitHub Issues](https://github.com/ecouto/medusa-plugin-bling/issues)
- **Documentação Bling**: [API Docs](https://developer.bling.com.br/)
- **Documentação Medusa**: [Medusa v2 Docs](https://docs.medusajs.com/)

## 📄 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, veja [CONTRIBUTING.md](CONTRIBUTING.md) para diretrizes.

---

**Plugin v2.0 - Integração completa e configurável para e-commerce brasileiro 🇧🇷**