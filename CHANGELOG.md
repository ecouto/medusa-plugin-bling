# 📋 Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Planejado para v3.1.0
- Admin UI Dashboard
- Scheduled Jobs para sync automático
- Relatórios e analytics avançados
- Filtros e busca melhorada

## [3.0.0-alpha.1] - 2025-01-24

### 🚀 Lançamento Principal - MedusaJS v2.3+ Compatibility

Esta é uma **refatoração completa** do plugin seguindo os padrões oficiais do MedusaJS v2.3+.

### ✨ Adicionado
- **Arquitetura MedusaJS v2.3+**: Refatoração completa para compatibilidade total
- **TypeScript Strict Mode**: 100% tipado com zero uso de `any` types
- **OAuth 2.0 + PKCE**: Autenticação segura com refresh automático de tokens
- **Workflows Avançados**: Processamento em lotes com rollback automático
- **Event Subscribers**: Automação completa baseada em eventos do Medusa
- **API Routes Tipadas**: Endpoints admin e webhooks com validação Zod
- **Cache Redis**: Sistema de cache inteligente para performance
- **Health Checks**: Monitoramento completo do status do sistema
- **Rate Limiting**: Respeito automático aos limites da API Bling
- **Webhook HMAC**: Validação segura de webhooks com assinatura
- **Logging Estruturado**: Logs detalhados para monitoramento e debug
- **Suite de Testes**: 80%+ cobertura com testes unitários e integração
- **Rollback Automático**: Compensação automática em caso de falhas
- **Batch Processing**: Processamento eficiente em lotes
- **Error Handling**: Tratamento robusto de erros com classes customizadas

### 🔄 Workflows Implementados
- **Sincronização de Produtos**: Produtos → Bling com variações e imagens
- **Sincronização de Pedidos**: Pedidos → Bling com geração de NFe
- **Sincronização de Inventário**: Estoque bidirecional em tempo real

### 📡 Event Subscribers
- **Product Events**: `product.created`, `product.updated`, `product.deleted`
- **Order Events**: `order.placed`, `order.payment_captured`, `order.fulfilled`, `order.canceled`
- **Inventory Events**: `inventory-level.updated`, `inventory-level.created`

### 🔧 API Endpoints
- **GET** `/admin/bling` - Status e configuração
- **POST** `/admin/bling/sync` - Sincronização manual
- **PUT** `/admin/bling/config` - Atualizar configuração
- **POST** `/store/bling-webhook` - Receber webhooks do Bling
- **GET** `/store/bling-webhook` - Verificação de webhook

### 🛡️ Segurança
- Validação HMAC de webhooks
- Rate limiting automático
- Refresh automático de tokens OAuth
- Configurações seguras no ambiente
- Logs auditáveis de todas operações

### 📊 Monitoramento
- Health check endpoint
- Métricas de rate limiting
- Logs estruturados com contexto
- Status detalhado de componentes
- Rastreamento de operações

### 🧪 Qualidade
- 80%+ cobertura de testes
- Testes unitários completos
- Testes de integração end-to-end
- Zero tipos `any` - tipagem 100% strict
- Linting e formatação automática
- CI/CD com GitHub Actions

### 🚫 Removido (Breaking Changes)
- **Suporte ao MedusaJS v1.x**: Plugin agora requer MedusaJS v2.3+
- **Configurações Legacy**: Estrutura de configuração completamente nova
- **Sync Síncronos**: Todos os syncs agora são assíncronos via workflows
- **APIs Antigas**: Endpoints da v1.x não são mais suportados

### ⚡ Performance
- Processamento em batch para operações em massa
- Cache Redis para reduzir chamadas à API
- Retry logic com backoff exponencial
- Timeout configurável para operações
- Debounce em eventos de inventário

### 🔄 Migração da v2.x
Para migrar da versão anterior:

1. **Backup**: Faça backup de sua configuração atual
2. **Atualização**: `npm install medusa-plugin-bling@3.0.0-alpha.1`
3. **Configuração**: Reconfigure usando nova estrutura
4. **Testes**: Execute testes em ambiente sandbox
5. **Deploy**: Faça deploy em produção

### 📚 Documentação
- README.md completamente reescrito
- CONTRIBUTING.md com guias detalhados
- Exemplos de código atualizados
- Documentação de APIs
- Guias de troubleshooting

## [2.0.0] - 2024-12-15

### Adicionado
- Interface admin completa
- Configurações granulares via UI
- OAuth automático via interface
- Jobs agendados
- Logs detalhados

### Alterado
- Migração para MedusaJS v2.0+
- Estrutura de configuração

### Removido
- Configurações manuais no código

## [1.2.1] - 2024-10-20

### Corrigido
- Bug na sincronização de produtos com variações
- Problema com webhook signature validation
- Memory leak em operações de longa duração

### Alterado
- Melhor handling de rate limiting
- Logs mais informativos

## [1.2.0] - 2024-09-15

### Adicionado
- Suporte a produtos com variações
- Sincronização de categorias
- Webhook para atualizações do Bling
- Cache de requisições

### Melhorado
- Performance da sincronização
- Tratamento de erros
- Documentação

## [1.1.0] - 2024-07-10

### Adicionado
- Sincronização de inventário
- Geração automática de NFe
- Configurações de mapeamento

### Corrigido
- Problemas com caracteres especiais
- Timeout em operações longas

## [1.0.0] - 2024-05-01

### 🎉 Lançamento Inicial

### Adicionado
- Sincronização básica de produtos
- Sincronização básica de pedidos
- Autenticação OAuth 2.0 básica
- Configuração via medusa-config.js
- Documentação inicial

### Funcionalidades
- Envio de pedidos para Bling
- Importação de produtos do Bling
- Webhook básico do Bling
- Logs básicos

---

## Convenções de Versionamento

Este projeto segue o [Versionamento Semântico](https://semver.org/lang/pt-BR/):

- **MAJOR** (X.0.0): Breaking changes que requerem alterações no código do usuário
- **MINOR** (0.X.0): Novas funcionalidades compatíveis com versões anteriores
- **PATCH** (0.0.X): Correções de bugs compatíveis com versões anteriores

### Pré-releases

- **alpha**: Funcionalidade em desenvolvimento inicial
- **beta**: Funcionalidade completa, em fase de testes
- **rc**: Release candidate, pronto para produção

## Links Úteis

- [GitHub Repository](https://github.com/seu-usuario/medusa-plugin-bling)
- [NPM Package](https://www.npmjs.com/package/medusa-plugin-bling)
- [Issues](https://github.com/seu-usuario/medusa-plugin-bling/issues)
- [MedusaJS Docs](https://docs.medusajs.com/)
- [Bling API Docs](https://developer.bling.com.br/)