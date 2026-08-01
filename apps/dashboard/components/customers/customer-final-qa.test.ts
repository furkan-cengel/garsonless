import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const list = readFileSync(new URL('./CustomersClient.tsx', import.meta.url), 'utf8')
const detail = readFileSync(new URL('./CustomerDetailClient.tsx', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('../layout/PageTopBar.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../layout/RestaurantShell.tsx', import.meta.url), 'utf8')
const globalCss = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8')

test('customer list exposes bounded offline recovery instead of an unhandled action failure', () => {
  assert.match(list, /setListError\('Müşteriler yüklenemedi\. Bağlantınızı kontrol edip yeniden deneyin\.'\)/)
  assert.match(list, /role="alert" aria-live="polite"/)
  assert.match(list, />Yeniden dene<\/button>/)
  assert.match(list, /window\.addEventListener\('online', retryWhenOnline\)/)
})

test('customer controls and shared topbar use 44px interaction targets', () => {
  assert.match(topbar, /aria-label="Geri"[\s\S]*width: 44, height: 44/)
  assert.match(topbar, /page-topbar-notification[\s\S]*width: 44, height: 44/)
  assert.match(topbar, /minHeight: 44/)
  assert.match(list, /customer-search[\s\S]*height: 46/)
  assert.match(list, /minWidth: 0, height: 44/)
  assert.match(list, /minHeight: 44/)
  assert.match(list, /function pagerBtn[\s\S]*height: 44/)
  assert.match(list, /function segmentIconBtn[\s\S]*width: 44,[\s\S]*height: 42/)
})

test('customer list and detail reflow at 320px without topbar breadcrumb collisions', () => {
  assert.match(globalCss, /@media \(max-width: 520px\)[\s\S]*\.page-topbar-brand,[\s\S]*\.page-topbar-tag[\s\S]*display: none !important/)
  assert.match(globalCss, /\.page-topbar-title[\s\S]*text-overflow: ellipsis !important/)
  assert.match(list, /customer-page-content\{padding:20px 12px 44px!important\}/)
  assert.match(list, /customer-list-header\{align-items:stretch!important;flex-direction:column!important\}/)
  assert.match(list, /customer-table-scroll-hint/)
  assert.match(detail, /customer-page-content\{padding:20px 12px 44px!important\}/)
})

test('customer routes use one natural vertical scroll container with reachable pagination', () => {
  assert.match(shell, /const isCustomersRoute = pathname\.includes\('\/customers'\)/)
  assert.match(shell, /overflow: isCustomersRoute \? 'auto' : 'hidden'/)
  assert.match(shell, /overscrollBehaviorY: isCustomersRoute \? 'contain' : 'auto'/)
  for (const source of [list, detail]) {
    assert.match(source, /className="customer-route-shell"[\s\S]*minHeight: '100%'/)
    assert.match(source, /className="customer-page-scroll"[\s\S]*overflow: 'visible'/)
    assert.match(source, /customer-page-topbar\{position:sticky;top:0;z-index:30\}/)
  }
  assert.match(list, /data\.total > data\.pageSize[\s\S]*Sonraki ›/)
})

test('customer detail navigation announces pending state before changing routes', () => {
  assert.match(list, /window\.dispatchEvent\(new Event\('navigation-start'\)\)[\s\S]*router\.push\(`\/dashboard\/\$\{restaurantId\}\/customers\/\$\{c\.customerId\}/)
  assert.match(topbar, /window\.dispatchEvent\(new Event\('navigation-start'\)\)[\s\S]*router\.push\(backHref\)/)
})
