# Masabu

Masabu is a QR menu SaaS monorepo for restaurants: customizable digital menus, table ordering, kitchen display, loyalty, analytics, AI waiter flows, and payment integrations.

## Apps

- `apps/dashboard` — restaurant admin dashboard and theme/menu tools, default dev port `3000`
- `apps/menu` — customer-facing QR menu, dev port `3011`
- `apps/kitchen` — kitchen display system, dev port `3002`
- `apps/marketing` — public marketing site, dev port `3003`

## Packages

- `@garsonless/ui` — shared UI primitives and icons
- `@garsonless/db` — Supabase clients, types, migrations, data helpers
- `@garsonless/design-engine` — menu theme schema/templates/rendering
- `@garsonless/ai` — AI helper package
- `@garsonless/qr` — QR generation utilities

## Getting Started

1. Install dependencies:
   ```bash
   corepack pnpm install
   ```
2. Create env files from the examples:
   ```bash
   cp .env.example .env.local
   cp apps/dashboard/.env.example apps/dashboard/.env.local
   cp apps/menu/.env.example apps/menu/.env.local
   cp apps/kitchen/.env.example apps/kitchen/.env.local
   cp apps/marketing/.env.example apps/marketing/.env.local
   ```
3. Fill the local env files with Supabase, payment, email, and AI credentials.
4. Run all apps:
   ```bash
   corepack pnpm dev
   ```

Useful checks:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm check
corepack pnpm check:visual
```
