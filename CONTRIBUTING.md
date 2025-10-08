# Contributing to medusa-plugin-bling

First off, thank you for considering contributing to medusa-plugin-bling! 🎉

## Code of Conduct

This project and everyone participating in it is governed by respect and professionalism. Please be kind and constructive in your interactions.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include as many details as possible:

- **Clear descriptive title**
- **Exact steps to reproduce the issue**
- **Expected vs actual behavior**
- **Screenshots** (if applicable)
- **Environment details:**
  - MedusaJS version
  - Node.js version
  - Plugin version
  - Operating system

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear descriptive title**
- **Detailed description** of the proposed feature
- **Why this enhancement would be useful** to most users
- **Possible implementation approach** (optional)

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding standards** (see below)
3. **Write clear commit messages** following [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat(scope): add new feature`
   - `fix(scope): fix bug`
   - `docs(scope): update documentation`
   - `refactor(scope): refactor code`
   - `test(scope): add tests`
   - `chore(scope): update build scripts`

4. **Add tests** if applicable
5. **Update documentation** if needed
6. **Ensure all tests pass**: `pnpm run typecheck && pnpm run lint`
7. **Submit the pull request**

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- MedusaJS v2.3+ project for testing

### Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/medusa-plugin-bling.git
cd medusa-plugin-bling

# Install dependencies
pnpm install

# Build the plugin
pnpm run build

# Run type checking
pnpm run typecheck

# Run linting
pnpm run lint

# Format code
pnpm run format:fix
```

### Testing Locally

To test your changes in a real MedusaJS project:

```bash
# In your plugin directory, build it
pnpm run build

# In your MedusaJS project, install the local version
pnpm add /path/to/medusa-plugin-bling
```

## Coding Standards

### TypeScript

- **Strict mode enabled** - all types must be explicit
- **No `any` types** without justification
- **Use camelCase** for variables/functions
- **Use PascalCase** for classes/types/interfaces
- **Prefix interfaces** with `I` or types with `T` when appropriate

### Code Style

- **Format with Prettier** - run `pnpm run format:fix`
- **Lint with ESLint** - run `pnpm run lint:fix`
- **2 spaces** for indentation
- **Single quotes** for strings
- **Semicolons required**

### Documentation

- **TSDoc comments** for public APIs
- **Inline comments** for complex logic
- **Update README.md** for user-facing changes

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Build process or auxiliary tools

**Examples:**

```
feat(admin): add real-time sync status indicator

Add a visual indicator in the admin UI that shows when products
are being synchronized from Bling in real-time.

Closes #123
```

```
fix(oauth): handle token refresh edge case

Fix an issue where expired tokens weren't properly refreshed
when multiple requests happened simultaneously.

Fixes #456
```

## Release Process

Releases are automated using `semantic-release`:

1. **Merge to `main`** triggers automatic versioning
2. **Commit messages determine version bump:**
   - `fix:` → patch (3.0.x)
   - `feat:` → minor (3.x.0)
   - `BREAKING CHANGE:` → major (x.0.0)
3. **Changelog is auto-generated**
4. **Published to npm automatically**

## Project Structure

```
src/
├── admin/              # Admin UI components
│   ├── api/            # API client wrapper
│   ├── routes/         # Settings pages
│   └── widgets/        # Order widgets
├── api/                # API routes
│   ├── admin/          # Admin routes
│   └── store/          # Store routes (webhooks)
├── modules/            # Core business logic
├── models/             # Database entities
└── utils/              # Shared utilities
```

## Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers.

Thank you for contributing! 🚀
