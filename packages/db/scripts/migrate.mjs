#!/usr/bin/env node

console.error('MAS-DB-022: Bu eski doğrudan-Postgres migration aracı devre dışıdır.')
console.error('Hedef kilitli akış için `corepack pnpm db:status -- --target dev` veya belgelenmiş db:push komutunu kullanın.')
process.exitCode = 1
