import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import test from 'node:test'
import { createSecurityHeaders } from '../next-security-headers.mjs'

const root = new URL('..', import.meta.url).pathname
const apps = ['dashboard', 'kitchen', 'marketing', 'menu', 'platform-admin']

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ['.next', 'node_modules'].includes(entry.name)) return []
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

test('Next.js runtime and lint conventions stay on major 15', () => {
  const workspace = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.match(workspace.devDependencies['@next/eslint-plugin-next'], /^15\./)
  assert.equal(workspace.engines.node, '>=24 <25')
  assert.equal(readFileSync(join(root, '.nvmrc'), 'utf8').trim(), '24')

  for (const app of apps) {
    const manifest = JSON.parse(readFileSync(join(root, 'apps', app, 'package.json'), 'utf8'))
    assert.match(manifest.dependencies.next, /^\^?15\./, `${app} must remain on Next.js 15`)
    assert.equal(manifest.type, 'module', `${app} must use explicit ESM semantics`)
  }
})

test('every application owns route, root, and not-found recovery UI', () => {
  for (const app of apps) {
    for (const filename of ['error.tsx', 'global-error.tsx', 'not-found.tsx']) {
      assert.doesNotThrow(
        () => readFileSync(join(root, 'apps', app, 'app', filename), 'utf8'),
        `${app} is missing app/${filename}`,
      )
    }
  }
})

test('every application applies the shared baseline security headers', () => {
  for (const app of apps) {
    const config = readFileSync(join(root, 'apps', app, 'next.config.ts'), 'utf8')
    assert.match(config, /allowedDevOrigins:\s*\[[^\]]*['"]127\.0\.0\.1['"][^\]]*\]/)
    assert.match(config, /createSecurityHeaders/)
    assert.match(config, /poweredByHeader:\s*false/)
  }
})

test('baseline headers deny embedding except for the tenant-aware public menu', () => {
  const protectedHeaders = new Map(createSecurityHeaders().map(({ key, value }) => [key, value]))
  assert.equal(protectedHeaders.get('X-Content-Type-Options'), 'nosniff')
  assert.equal(protectedHeaders.get('X-Frame-Options'), 'DENY')
  assert.equal(protectedHeaders.get('Content-Security-Policy'), "frame-ancestors 'none'")
  assert.match(protectedHeaders.get('Content-Security-Policy-Report-Only'), /default-src 'self'/)

  const menuHeaders = new Map(
    createSecurityHeaders({ allowEmbedding: true }).map(({ key, value }) => [key, value]),
  )
  assert.equal(menuHeaders.has('X-Frame-Options'), false)
  assert.equal(menuHeaders.has('Content-Security-Policy'), false)
})

test('private apps are noindex and every app owns instrumentation', () => {
  for (const app of ['dashboard', 'kitchen', 'platform-admin']) {
    const config = readFileSync(join(root, 'apps', app, 'next.config.ts'), 'utf8')
    const layout = readFileSync(join(root, 'apps', app, 'app', 'layout.tsx'), 'utf8')
    assert.match(config, /noIndex:\s*true/)
    assert.match(layout, /robots:\s*\{\s*index:\s*false/)
  }
  for (const app of apps) {
    const instrumentation = readFileSync(join(root, 'apps', app, 'instrumentation.ts'), 'utf8')
    assert.match(instrumentation, /export function register/)
    assert.match(instrumentation, /export function onRequestError/)
  }
})

test('Dashboard root is a server redirect and normal Server Actions keep the default body limit', () => {
  const rootPage = readFileSync(join(root, 'apps/dashboard/app/page.tsx'), 'utf8')
  const config = readFileSync(join(root, 'apps/dashboard/next.config.ts'), 'utf8')
  assert.doesNotMatch(rootPage, /['"]use client['"]|MARKETING_CSS|PricingSection/)
  assert.match(rootPage, /redirect\(['"]\/auth\/login['"]\)/)
  assert.doesNotMatch(config, /bodySizeLimit|serverActions/)
})

test('pnpm is the only workspace lockfile and stale packages are not configured', () => {
  for (const app of apps) {
    assert.throws(() => readFileSync(join(root, 'apps', app, 'package-lock.json'), 'utf8'))
    assert.throws(() => readFileSync(join(root, 'apps', app, 'yarn.lock'), 'utf8'))
  }
  assert.doesNotMatch(readFileSync(join(root, 'apps/menu/next.config.ts'), 'utf8'), /@garsonless\/ai/)
})

test('application fonts are self-hosted and never depend on Google Fonts at build or runtime', () => {
  for (const app of apps) {
    const appRoot = join(root, 'apps', app)
    for (const path of walk(appRoot).filter((value) => /\.[cm]?[jt]sx?$/.test(value))) {
      const source = readFileSync(path, 'utf8')
      assert.doesNotMatch(source, /next\/font\/google|fonts\.googleapis\.com|fonts\.gstatic\.com/)
    }
  }
  assert.match(readFileSync(join(root, 'assets/fonts/OFL.txt'), 'utf8'), /SIL OPEN FONT LICENSE/)
})

test('authored marketing media uses the optimized image boundary', () => {
  const marketingRoot = join(root, 'apps/marketing')
  for (const path of walk(marketingRoot).filter((value) => /\.tsx$/.test(value))) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /<img\b/, `${relative(root, path)} uses a raw authored image`)
  }
  assert.match(
    readFileSync(join(root, 'docs/architecture/media-rendering-policy.md'), 'utf8'),
    /Tenant-authored Supabase images/,
  )
})

test('database browser and service clients are physically separated', () => {
  const browser = readFileSync(join(root, 'packages/db/src/browser.ts'), 'utf8')
  const service = readFileSync(join(root, 'packages/db/src/service-client.ts'), 'utf8')
  const server = readFileSync(join(root, 'packages/db/src/server.ts'), 'utf8')
  assert.match(browser, /from '\.\/browser-client'/)
  assert.doesNotMatch(browser, /service-client|SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(service, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(server, /import 'server-only'/)
})

test('Client Components never import the server-only DB entrypoint', () => {
  for (const app of apps) {
    const appRoot = join(root, 'apps', app)
    for (const path of walk(appRoot).filter((value) => /\.[cm]?[jt]sx?$/.test(value))) {
      const source = readFileSync(path, 'utf8')
      if (!/^\s*['"]use client['"]/m.test(source)) continue
      assert.doesNotMatch(
        source,
        /from\s+['"]@garsonless\/db\/server['"]/,
        `${relative(root, path)} crosses the client/server DB boundary`,
      )
    }
  }
})
