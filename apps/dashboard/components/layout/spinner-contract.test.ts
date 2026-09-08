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
  for (const route of ['pano', 'orders', 'menu', 'theme', 'customers']) {
    assert.match(skeleton, new RegExp(`${route}:`))
  }
  // Heavy report/form placeholders must not become dependencies of every route.
  assert.doesNotMatch(skeleton, /import .*from ['"]\.\.\/(analytics|settings)\//)
  assert.match(read('../analytics/AnalyticsLoadingFrame.tsx'), /<DashboardSkeletonFrame kind="analytics"/)
  assert.match(read('../settings/SettingsLoadingFrame.tsx'), /role="status"/)
  const tableSkeleton = read('../tables/TablesRouteSkeleton.tsx')
  assert.match(tableSkeleton, /role="status"/)
  assert.match(tableSkeleton, /prefers-reduced-motion/)
})

test('Pano route skeleton mirrors the mobile shell instead of squeezing the desktop grid', () => {
  const skeleton = read('./DashboardRouteSkeleton.tsx')
  assert.match(skeleton, /dashboard-route-skeleton-topbar--\$\{kind\}/)
  assert.match(skeleton, /@media \(max-width: 900px\)[\s\S]*dashboard-route-skeleton-topbar--pano[\s\S]*height: 104px !important/)
  assert.match(skeleton, /grid-template-rows: 52px 52px/)
  assert.match(skeleton, /dashboard-route-skeleton-pano-greeting/)
  assert.match(skeleton, /dashboard-route-skeleton-pano-attention/)
  assert.match(skeleton, /dashboard-route-skeleton-pano > \* \{\s*flex-shrink: 0;/)
  assert.match(skeleton, /dashboard-route-skeleton-pano-metrics/)
  assert.match(skeleton, /dashboard-route-skeleton-pano-panels/)
  assert.match(skeleton, /@media \(max-width: 760px\)[\s\S]*dashboard-route-skeleton-pano-metrics > div,[\s\S]*grid-template-columns: minmax\(0, 1fr\) !important/)
  assert.match(skeleton, /overflowX: 'hidden'/)
  assert.match(skeleton, /overflowY: 'auto'/)
})

test('critical pending controls retain accessible action text', () => {
  assert.match(read('../tables/SettlementSplitStatus.tsx'), /Onaylanıyor…/)
  assert.match(read('../tables/SettlementSheet.tsx'), /Kapatılıyor…/)
  for (const file of [
    '../tables/SettlementSheet.tsx',
    '../tables/SettlementSplitStatus.tsx',
    '../tables/TableTransferDialog.tsx',
    '../tables/TableTransferHistory.tsx',
    '../tables/TablesNavigationHeader.tsx',
  ]) {
    assert.doesNotMatch(read(file), /<Spinner(?![^>]*aria-hidden)/)
  }
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
