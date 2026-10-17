import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const menuClient = readFileSync(
  new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url),
  'utf8',
)
const menuMembership = readFileSync(
  new URL('./hooks/useMenuMembership.ts', import.meta.url),
  'utf8',
)
const membershipClient = readFileSync(
  new URL('./menu-membership-client.ts', import.meta.url),
  'utf8',
)
const productCard = readFileSync(
  new URL('../../../packages/ui/src/menu/ProductCard.tsx', import.meta.url),
  'utf8',
)
const categoryNav = readFileSync(
  new URL('../../../packages/ui/src/menu/CategoryNav.tsx', import.meta.url),
  'utf8',
)

test('interaction-only menu surfaces stay behind dynamic boundaries', () => {
  for (const modulePath of [
    '@garsonless/ui/menu/ProductModal',
    '@garsonless/ui/menu/CartDrawer',
    '@garsonless/ui/menu/OrderConfirmation',
    '@garsonless/ui/menu/TableBillSheet',
    './components/PaymentModal',
    './components/MemberSheet',
    './components/SplitBillModal',
    './MenuArViewer',
  ]) {
    const escaped = modulePath.replace(/[./]/g, '\\$&')
    // Loaded only through a dynamic import expression (directly inside
    // next/dynamic or through a loader that also warms it), never statically.
    assert.match(menuClient, new RegExp(`import\\(['"]${escaped}['"]\\)`))
    assert.doesNotMatch(menuClient, new RegExp(`from ['"]${escaped}['"]`))
  }
  assert.match(menuClient, /const ProductModal = dynamic\(loadProductModal\)/)
})

test('customer auth stays on server routes and out of the browser SDK', () => {
  assert.doesNotMatch(menuClient, /^import .*createMenuAuthBrowserClient/m)
  assert.doesNotMatch(menuMembership, /^import .*createMenuAuthBrowserClient/m)
  assert.doesNotMatch(menuMembership, /supabase-browser/)
  assert.match(menuMembership, /import\('\.\.\/menu-membership-client'\)/)
  assert.match(membershipClient, /fetch\('\/api\/account\/logout'/)
})

test('menu images and motion preferences do not inflate initial work', () => {
  assert.match(productCard, /loading=\{imagePriority \? 'eager' : 'lazy'\}/)
  assert.match(productCard, /fetchPriority=\{imagePriority \? 'high' : 'auto'\}/)
  assert.match(productCard, /decoding="async"/)
  assert.doesNotMatch(categoryNav, /from 'framer-motion'/)
  assert.match(categoryNav, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/)
})
