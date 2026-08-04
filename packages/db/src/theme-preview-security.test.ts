import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260801010000_theme_preview_security_boundary.sql', import.meta.url),
  'utf8',
)
const themePort = readFileSync(new URL('./theme-application-port.ts', import.meta.url), 'utf8')

test('anonymous clients cannot read theme publisher metadata directly', () => {
  assert.match(migration, /drop policy if exists "anon_read_theme_configs" on public\.theme_configs/)
  assert.match(migration, /revoke select on table public\.theme_configs from anon/)
  assert.doesNotMatch(migration, /grant\s+select[\s\S]*\b(?:public|anon)\b/i)
})
test('public theme reads stay behind the service-role application adapter', () => {
  assert.match(themePort, /readConfig[\s\S]*createServiceClient\(\)[\s\S]*\.from\('theme_configs'\)/)
  assert.doesNotMatch(themePort, /createClient\(\)[\s\S]*\.from\('theme_configs'\)/)
})
