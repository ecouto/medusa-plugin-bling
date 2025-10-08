# medusa-plugin-bling

[![npm version](https://img.shields.io/npm/v/medusa-plugin-bling.svg)](https://www.npmjs.com/package/medusa-plugin-bling)
[![npm downloads](https://img.shields.io/npm/dm/medusa-plugin-bling.svg)](https://www.npmjs.com/package/medusa-plugin-bling)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MedusaJS](https://img.shields.io/badge/MedusaJS-v2.3+-9f49e8.svg)](https://medusajs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178c6.svg)](https://www.typescriptlang.org/)

Official Bling ERP integration for MedusaJS v2.3+. Seamlessly sync products, inventory, and orders between your MedusaJS store and Bling ERP using OAuth 2.0.

> 🎯 **Production-ready** plugin with Admin UI, automatic token refresh, and webhook support for real-time synchronization.

## ✨ Features

- 🔐 **OAuth 2.0 Authentication** with automatic token refresh
- 🎨 **Admin UI Integration** - Complete settings page with real-time status
- 📦 **Product Sync** - Import products, variants, prices, and images from Bling
- 📊 **Inventory Management** - Real-time stock updates via webhooks
- 🛒 **Order Export** - Automatic order creation in Bling with customer data
- 🔔 **Webhook Support** - HMAC validation for secure notifications
- 🇧🇷 **Brazilian E-commerce** - Built specifically for Brazilian market needs

## 📋 Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Webhook Setup](#webhook-setup)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## 📦 Requirements

- Node.js 18 or higher
- pnpm 8+ (or npm/yarn)
- MedusaJS v2.3 or higher
- Bling account with API credentials

## 🚀 Installation

```bash
pnpm add medusa-plugin-bling
```

Register the plugin in your `medusa-config.ts`:

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

## ⚙️ Configuration

### 1. Get Bling Credentials

1. Access [Bling Developer Portal](https://developer.bling.com.br/)
2. Create a new application
3. Copy your `Client ID` and `Client Secret`

### 2. Configure in Admin

1. Open your Medusa Admin panel
2. Navigate to **Settings → Integrations → Bling ERP**
3. Enter your `Client ID` and `Client Secret`
4. (Optional) Set a `Webhook Secret` for secure webhook validation
5. Configure sync preferences:
   - **Products**: Import catalog, images, descriptions, and prices
   - **Inventory**: Real-time stock updates
   - **Orders**: Automatic order export to Bling
6. Click **Connect to Bling** to complete OAuth flow

### 3. Start Syncing

Once connected, you can:
- **Manual Sync**: Click "Sync" button in the admin panel
- **Automatic Sync**: Orders are sent automatically on creation
- **Webhook Sync**: Products and inventory update in real-time

## 🔌 API Endpoints

### Admin Routes

| Method | Route                            | Description                                  |
| ------ | -------------------------------- | -------------------------------------------- |
| `GET`  | `/admin/bling/config`            | Get current configuration                    |
| `POST` | `/admin/bling/config`            | Update credentials and preferences           |
| `GET`  | `/admin/bling/health`            | Check OAuth token validity                   |
| `POST` | `/admin/bling/sync`              | Import products and inventory from Bling     |
| `POST` | `/admin/bling/orders/:id/sync`   | Send specific order to Bling                 |

### Store Routes

| Method | Route                    | Description                                         |
| ------ | ------------------------ | --------------------------------------------------- |
| `POST` | `/store/bling/webhook`   | Receive Bling notifications (HMAC validation)       |

## 🛠️ Development

### Available Scripts

```bash
pnpm run build        # Build TypeScript
pnpm run typecheck    # Type checking without build
pnpm run lint         # Run ESLint
pnpm run lint:fix     # Fix ESLint issues
pnpm run format       # Check formatting
pnpm run format:fix   # Fix formatting
```

### Release Process

This repository uses `semantic-release` for automated versioning and publishing:

- **Patch** (`3.0.x`): Commits with `fix:` prefix
- **Minor** (`3.x.0`): Commits with `feat:` prefix
- **Major** (`x.0.0`): Commits with `BREAKING CHANGE:` in footer or `!` after type

Example: `feat(admin): add sync status indicator`

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

## 🔔 Webhook Setup

Configure Bling to send notifications to:

```
POST https://your-store.com/store/bling/webhook
```

If `Webhook Secret` is configured, the plugin validates the `x-bling-signature` header (HMAC SHA-256) before processing requests.

**Supported Events:**
- Product updates
- Inventory changes
- Order status changes

## 🐛 Troubleshooting

### Authentication Errors
Re-enter your `Client ID` and `Client Secret`, then repeat the OAuth flow.

### Orders Not Syncing
- Verify customer has valid CPF/CNPJ
- Ensure all items have SKU matching Bling products
- Check order status is complete

### Rate Limiting
The plugin logs all API calls. Check Medusa logs for details and retry manually through the Admin panel.

## 🗺️ Roadmap

- [ ] Order status sync from Bling to Medusa
- [ ] Automated test coverage (unit + integration)
- [ ] Detailed field mapping documentation
- [ ] Support for multiple Bling accounts
- [ ] GraphQL API support

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and development process.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the [MedusaJS](https://medusajs.com/) ecosystem
- Powered by [Bling ERP API v3](https://developer.bling.com.br/)
- Developed by [Casa Moratti](https://github.com/ecouto)

## 📞 Support

- 📫 Issues: [GitHub Issues](https://github.com/ecouto/medusa-plugin-bling/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/ecouto/medusa-plugin-bling/discussions)
- 🌐 Documentation: [Full Docs](https://github.com/ecouto/medusa-plugin-bling#readme)

---

**Made with ❤️ for Brazilian e-commerce**
