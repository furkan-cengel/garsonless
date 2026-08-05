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

test('customer controls stay compact on desktop while touch and narrow layouts keep safe targets', () => {
  assert.match(topbar, /aria-label="Geri"[\s\S]*width: 44, height: 44/)
  assert.match(topbar, /page-topbar-notification[\s\S]*width: 44, height: 44/)
  assert.match(topbar, /minHeight: 44/)
  assert.match(list, /customer-action-secondary[\s\S]*height: 36/)
  assert.match(list, /customer-action-primary[\s\S]*height: 36/)
  assert.match(list, /className="customer-search"[\s\S]*height: 40/)
  assert.match(list, /minWidth: 0, height: 38/)
  assert.match(list, /className="customer-control customer-segment-filter"[\s\S]*minHeight: 34/)
  assert.match(list, /function pagerBtn[\s\S]*height: 34/)
  assert.match(list, /function segmentIconBtn[\s\S]*width: 32,[\s\S]*height: 32/)
  assert.match(list, /@media \(pointer: coarse\)[\s\S]*\.customer-control,[\s\S]*min-height: 44px !important/)
  assert.match(list, /@media \(max-width: 820px\)[\s\S]*\.customer-page-actions > button[\s\S]*min-height: 44px !important/)
})

test('customer actions, segment filters, saved filters and rows expose hover feedback', () => {
  assert.match(list, /\.customer-action-secondary:not\(:disabled\):hover/)
  assert.match(list, /\.customer-action-primary:not\(:disabled\):hover/)
  assert.match(list, /\.customer-segment-filter:not\(:disabled\):hover/)
  assert.match(list, /\.customer-segment-filter\[aria-pressed="true"\]:not\(:disabled\):hover/)
  assert.match(list, /\.customer-saved-segment-icon:not\(:disabled\):hover/)
  assert.match(list, /\.customer-campaign-strip:not\(:disabled\):hover/)
  assert.match(list, /button\.customer-row-action:hover/)
  assert.match(list, /@media \(prefers-reduced-motion: reduce\)/)
})

test('customer list and detail reflow at 320px without topbar breadcrumb collisions', () => {
  assert.match(globalCss, /@media \(max-width: 520px\)[\s\S]*\.page-topbar-brand,[\s\S]*\.page-topbar-tag[\s\S]*display: none !important/)
  assert.match(globalCss, /\.page-topbar-title[\s\S]*text-overflow: ellipsis !important/)
  assert.match(list, /customer-page-content\s*\{\s*padding:\s*20px 12px 44px !important/)
  assert.match(list, /customer-list-header\s*\{\s*align-items:\s*stretch !important;\s*flex-direction:\s*column !important/)
  assert.match(list, /customer-table-scroll-hint/)
  assert.match(detail, /customer-page-content\s*\{\s*padding:\s*20px 12px 44px !important/)
})

test('customer routes use one natural vertical scroll container with reachable pagination', () => {
  assert.match(shell, /const isCustomersRoute = pathname\.includes\('\/customers'\)/)
  assert.match(shell, /overflow: isCustomersRoute \? 'auto' : 'hidden'/)
  assert.match(shell, /overscrollBehaviorY: isCustomersRoute \? 'contain' : 'auto'/)
  for (const source of [list, detail]) {
    assert.match(source, /className="customer-route-shell"[\s\S]*minHeight: '100%'/)
    assert.match(source, /className="customer-page-scroll"[\s\S]*overflow: 'visible'/)
    assert.match(source, /customer-page-topbar\s*\{\s*position:\s*sticky;\s*top:\s*0;\s*z-index:\s*30/)
  }
  assert.match(list, /data\.total > data\.pageSize[\s\S]*Sonraki ›/)
})

test('customer detail navigation announces pending state before changing routes', () => {
  assert.match(list, /beginNavigation\(href\)[\s\S]*router\.push\(href\)/)
  assert.match(topbar, /beginNavigation\(backHref\)[\s\S]*router\.push\(backHref\)/)
  assert.match(topbar, /className="page-topbar-back"/)
  assert.match(globalCss, /\.page-topbar-back:not\(:disabled\):hover/)
})
