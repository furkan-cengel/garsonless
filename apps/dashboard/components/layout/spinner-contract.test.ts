import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')

test('dashboard shell renders one navigation feedback surface and no legacy event', () => {
  const shell = read('./RestaurantShell.tsx')
  const context = read('../../lib/shell-context.tsx')
  const feedback = read('./NavigationFeedback.tsx')
  assert.equal((shell.match(/<NavigationFeedback/g) ?? []).length, 2, 'one render per mutually exclusive shell branch')
  assert.match(context, /beginNavigation: \(targetHref: string\)/)
  assert.doesNotMatch(shell, /navigation-start|NavigationProgress|NavigationPendingOverlay/)
  assert.doesNotMatch(feedback, /Math\.random|aria-valuenow/)
  assert.match(feedback, /className=\{styles\.bar\} aria-hidden="true"/)
})

test('all dashboard route loading boundaries use an accessible skeleton', () => {
  const skeleton = read('./DashboardRouteSkeleton.tsx')
  assert.match(skeleton, /role="status"/)
  assert.match(skeleton, /aria-busy="true"/)
  for (const route of ['pano', 'analytics', 'orders', 'menu', 'theme', 'settings', 'customers']) {
    assert.match(skeleton, new RegExp(`${route}:`))
  }
  const tableSkeleton = read('../tables/TablesRouteSkeleton.tsx')
  assert.match(tableSkeleton, /role="status"/)
  assert.match(tableSkeleton, /prefers-reduced-motion/)
})

test('critical pending controls retain accessible action text', () => {
  assert.match(read('../tables/SettlementSplitStatus.tsx'), /Onaylanıyor…/)
  assert.match(read('../tables/SettlementSheet.tsx'), /Kapatılıyor…/)
  assert.match(read('../orders/HistoryModal.tsx'), /Geçmiş siparişler yükleniyor…/)
  const preview = read('../tables/TablesBuilderChrome.tsx')
  assert.match(preview, /'loading' \| 'ready' \| 'error' \| 'stalled'/)
  assert.match(preview, /10_000/)
  assert.match(preview, /onError=/)
  const billing = read('../settings/BillingSection.tsx')
  assert.match(billing, /profilePending, startProfileTransition/)
  assert.match(billing, /checkoutPending, startCheckoutTransition/)
  assert.match(billing, /cancelPending, startCancelTransition/)
})
