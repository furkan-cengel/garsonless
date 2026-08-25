# Masabu Vercel project topology

Masabu deploys each Next.js application as a separate Vercel project from the
same monorepo. Production origins are immutable release inputs:

| Project | Root directory | Production domain |
| --- | --- | --- |
| Marketing | `apps/marketing` | `masabu.co` |
| Dashboard | `apps/dashboard` | `app.masabu.co` |
| Menu | `apps/menu` | `menu.masabu.co` |
| Kitchen | `apps/kitchen` | `kds.masabu.co` |
| Platform Admin | `apps/platform-admin` | `admin.masabu.co` |

Every project uses the repository-pinned Node and pnpm versions. Vercel manages
the Next.js build cache and Server Action encryption keys; do not configure
`output: standalone`, a custom cache handler, `deploymentId`, or a manual
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for this topology.

Run `pnpm prod:topology` with all production env scopes before promoting a
release. Callback, webhook, OAuth, preview and worker URLs must resolve from
`config/production-topology.json`; they must not be typed independently in a
Vercel project.
