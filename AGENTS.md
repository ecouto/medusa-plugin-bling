# Repository Guidelines

## Project Structure & Module Organization
Core TypeScript sources live under `src/`. `src/modules` hosts the Bling service layer and Medusa workflow logic, while `src/api` exposes REST endpoints. Admin UI components sit in `src/admin`, and support pieces live in `src/models`, `src/migrations`, `src/loaders`, and `src/utils`. Generated output is emitted to `dist/` by the compiler; never edit this directory directly.

## Build, Test, and Development Commands
- `pnpm install` — sync dependencies before any change.
- `pnpm build` — compile TypeScript via `tsc` and refresh `dist/`.
- `pnpm dev` — watch-mode build that rebuilds on file saves.
- `pnpm exec jest --runInBand` — execute the unit and integration suite.
- `pnpm exec eslint "src/**/*.{ts,tsx}"` and `pnpm exec prettier --check .` — verify linting and formatting; append `--write` when autofixing locally.

## Coding Style & Naming Conventions
The project is TypeScript-first with `strict` typing enabled in `tsconfig.json`, so do not introduce `any`. Keep code Prettier-compliant (2-space indentation, trailing semicolons where emitted) and favor `camelCase` for functions/variables, `PascalCase` for classes and React components, and `SCREAMING_SNAKE_CASE` only for constants like `BLING_CONFIG_ID`. Export the minimal surface area needed; re-export shared entry points from `src/index.ts` to stay aligned with the plugin interface.

## Testing Guidelines
Tests should rely on Jest with `ts-jest` and live alongside the code they cover using `*.spec.ts` or `*.test.ts` filenames so the compiler excludes them from builds. Aim to maintain the 80% coverage advertised in `README.md`; add focused integration checks with `supertest` when touching API routes. Run `pnpm exec jest --coverage` before submitting and document any intentional gaps in your PR description.

## Commit & Pull Request Guidelines
Semantic-release expects Conventional Commits — e.g. `feat(api): add Bling order webhook sync`. Each PR must describe the change, reference any GitHub issue, list the commands you ran, and include screenshots or recordings for UI updates under `src/admin`. Call out configuration changes (environment variables, OAuth scopes, webhook secrets) and update docs or migration files in the same PR.

## Security & Configuration Tips
Never commit credentials; rely on `.env` templates and instruct operators to configure Bling OAuth keys privately. When contributing loaders or migrations, ensure new secrets are documented in `README.md` and redacted from logs via the shared logger utilities.
