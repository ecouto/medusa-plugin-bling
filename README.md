# medusa-plugin-bling

Integração básica entre o MedusaJS v2 e o Bling ERP v3. O plugin oferece um painel de configuração no Admin, importação de catálogo/estoque a partir do Bling e envio de pedidos do Medusa para o ERP usando OAuth 2.0.

> ⚠️ Escopo atual: sincronização de produtos (import) e pedidos (export). Recursos fiscais, geração de NF, etiquetas ou automações avançadas devem continuar sendo operados diretamente no Bling.

## Recursos

- Autenticação OAuth 2.0 com refresh automático de tokens
- Página de configurações no Admin com opções de sincronização e disparo manual
- Importação de produtos e estoque do Bling para o Medusa
- Envio de pedidos do Medusa para o Bling com dados de cliente, itens e endereço
- Webhook opcional para disparar sincronização de catálogo quando ocorrerem mudanças no Bling

## Requisitos

- Node.js 18 ou superior
- pnpm 8+ (ou npm/yarn, adaptando os comandos)
- MedusaJS v2.3 ou superior

## Instalação

```bash
pnpm add medusa-plugin-bling
```

No `medusa-config.ts` registre o plugin:

```ts
import { defineConfig } from "@medusajs/framework/utils"

export default defineConfig({
  plugins: [
    {
      resolve: "medusa-plugin-bling",
      options: {},
    },
  ],
})
```

## Configuração via Admin

1. Acesse o Admin e abra **Configurações → Integrações → Bling ERP**.
2. Informe `Client ID` e `Client Secret` obtidos no portal do desenvolvedor Bling.
3. (Opcional) defina um `Webhook Secret` para validar chamadas de webhook do Bling.
4. Ajuste as preferências de sincronização de produtos, estoque e pedidos conforme necessário.
5. Clique em **Conectar ao Bling** para concluir o fluxo OAuth e liberar a sincronização.

## Endpoints expostos

### Admin

| Método | Rota                                | Descrição                                                    |
| ------ | ------------------------------------ | ------------------------------------------------------------ |
| `GET`  | `/admin/bling/config`                | Retorna configuração persistida                             |
| `POST` | `/admin/bling/config`                | Atualiza credenciais e preferências                         |
| `GET`  | `/admin/bling/health`                | Verifica se o token OAuth é válido/renovável                |
| `POST` | `/admin/bling/sync`                  | Importa produtos e estoque do Bling                         |
| `POST` | `/admin/bling/orders/:id/sync`       | Envia um pedido específico do Medusa para o Bling           |

### Store

| Método | Rota                       | Descrição                                                                 |
| ------ | ------------------------- | ------------------------------------------------------------------------- |
| `POST` | `/store/bling/webhook`     | Recebe notificações do Bling (HMAC opcional) e dispara sincronização de catálogo |

## Scripts disponíveis

```bash
pnpm run build        # Compila TypeScript
pnpm run typecheck    # Verifica tipos sem emitir build
pnpm run lint         # Executa ESLint
pnpm run lint:fix     # Corrige problemas simples apontados pelo ESLint
pnpm run format       # Verifica formatação com Prettier
pnpm run format:fix   # Ajusta formatação com Prettier
```

## Estrutura do projeto

```
src/
├── admin/                     # Extensão de interface do Admin
│   ├── api/                   # Client wrapper usado pela UI
│   ├── routes/                # Página de configurações
│   └── widgets/               # (vazio, reservado para futuras extensões)
├── api/                       # Rotas Admin/Store expostas pelo plugin
│   ├── admin/bling/*          # Configuração, health, sync de pedidos/produtos
│   └── store/bling/webhook    # Webhook público
├── loaders/register.ts        # Registro de serviços/eventos
├── models/                    # Entidades persistidas (configuração)
├── modules/bling              # Serviço principal (produtos)
├── modules/order-sync.service.ts # Serviço de sincronização de pedidos
└── utils/                     # Utilitários compartilhados
```

## Webhook do Bling

Configure o Bling para enviar notificações para:

```
POST https://<sua-loja>/store/bling/webhook
```

Se `Webhook Secret` estiver definido nas configurações, o plugin valida o cabeçalho `x-bling-signature` (HMAC SHA-256) antes de processar a requisição.

## Solução de problemas

- **Erro de autenticação**: relacione novamente `Client ID/Secret` e repita o fluxo OAuth.
- **Pedidos não sincronizam**: verifique se o pedido possui CPF/CNPJ válido nas informações de cliente e se cada item contém SKU/código usado no Bling.
- **Rate limit ou falhas de rede**: o plugin registra os detalhes no logger padrão do Medusa. Consulte os logs para identificar a causa e reexecute a sincronização manual pelo Admin.

## Roadmap

- Importação de status de pedido do Bling para o Medusa
- Diferenciação de reservas/estoques por depósito
- Cobertura de testes automatizados
- Documentação detalhada dos mapeamentos de campos

Contribuições são bem-vindas. Abra uma issue com dúvidas, sugestões ou reporte de bugs.
