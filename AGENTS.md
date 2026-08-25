<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

## Masabu monorepo compatibility

- These rules apply to every Next.js app under `apps/`.
- Check the target app's installed Next.js version before proposing framework APIs or migrations.
- This repository currently uses Next.js 15.5.x, which does not bundle `next/dist/docs/`. Until the repository is upgraded to the version required by the managed rule above, do not assume Next.js 16 APIs: consult the official documentation matching the installed version and treat a framework upgrade as a separate, explicitly approved change.

## Next.js DevTools MCP

- The project-scoped MCP server is configured as `next-devtools` in `.mcp.json`.
- For Next.js runtime diagnostics, discover the actual running dev-server ports first; never assume that every app uses port 3000.
- `nextjs_index` and `nextjs_call` runtime access require Next.js 16+. While this monorepo remains on Next.js 15.5.x, do not claim that live route, error, log, or Server Action inspection is available through MCP.
- A Next.js 16 upgrade is a separate migration and must not be started without explicit approval.
