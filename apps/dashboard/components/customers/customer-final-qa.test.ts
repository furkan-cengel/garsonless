import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const list = readFileSync(new URL('./CustomersClient.tsx', import.meta.url), 'utf8')
const campaign = readFileSync(new URL('./CustomerCampaignModal.tsx', import.meta.url), 'utf8')
const detail = readFileSync(new URL('./CustomerDetailClient.tsx', import.meta.url), 'utf8')
const topbar = readFileSync(new URL('../layout/PageTopBar.tsx', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../layout/RestaurantShell.tsx', import.meta.url), 'utf8')
const globalCss = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8')

test('customer list exposes bounded offline recovery instead of an unhandled action failure', () => {
  assert.match(list, /setListError\('Müşteriler yüklenemedi\. Bağlantınızı kontrol edip yeniden deneyin\.'\)/)
  assert.match(list, /<Alert variant="destructive" aria-live="polite"/)
  assert.match(list, />Yeniden dene<\/Button>/)
  assert.match(list, /window\.addEventListener\('online', retryWhenOnline\)/)
})

test('customer controls use compact shadcn variants while narrow layouts keep safe targets', () => {
  assert.match(topbar, /backLabel = 'Geri'[\s\S]*aria-label=\{backLabel\}[\s\S]*width: 44, height: 44/)
  assert.match(topbar, /page-topbar-notification[\s\S]*width: 44, height: 44/)
  assert.match(topbar, /minHeight: 44/)
  assert.match(list, /<Button type="button" variant="outline" size="sm"/)
  assert.match(list, /<InputGroup className="customer-search h-9 flex-1/)
  assert.match(list, /<Button type="button" variant="outline" size="sm" disabled=\{page <= 1\}/)
  assert.match(list, /<Button type="button" variant="ghost" size="icon-xs"/)
  assert.match(list, /\.customer-segment-filter \{[^}]*min-height: 44px/)
  assert.match(list, /@media \(max-width: 720px\)[\s\S]*\.customer-page-actions > button \{ flex: 1 1 0; min-height: 44px; \}/)
})

test('customer actions, segment filters, saved filters and rows expose hover feedback', () => {
  assert.match(list, /\.customer-segment-filter:not\(:disabled\):hover/)
  assert.match(list, /\.customer-segment-filter\[aria-pressed="true"\]:not\(:disabled\):hover/)
  assert.match(list, /\.customer-saved-segment-icon:not\(:disabled\):hover/)
  assert.match(list, /\.customer-new-segment:not\(:disabled\):hover/)
  assert.match(list, /\.customer-campaign-strip:not\(:disabled\):hover/)
  assert.match(list, /button\.customer-row-action:hover/)
  assert.match(list, /@media \(prefers-reduced-motion: reduce\)/)
})

test('the three-column workspace collapses to segment chips and card rows on narrow screens', () => {
  assert.match(globalCss, /@media \(max-width: 520px\)[\s\S]*\.page-topbar-brand,[\s\S]*\.page-topbar-tag[\s\S]*display: none !important/)
  assert.match(globalCss, /\.page-topbar-title[\s\S]*text-overflow: ellipsis !important/)
  assert.match(list, /className="customer-rail" aria-label="Segmentler"/)
  assert.match(list, /className="customer-profile-column" aria-label="Müşteri profili"/)
  assert.match(list, /grid-template-columns: 236px minmax\(0, 1fr\) 400px/)
  assert.match(list, /@media \(max-width: 900px\)[\s\S]*\.customer-rail \{ position: static;[^}]*overflow-x: auto/)
  assert.match(list, /@media \(max-width: 720px\)[\s\S]*\.customer-list-head \{ display: none; \}/)
  assert.match(list, /className="customer-list" role="list"/)
  // Below the wide breakpoint the profile opens as a sheet instead of a third column.
  assert.match(list, /wide === false && \([\s\S]*<Sheet open=\{Boolean\(selectedId\)\}/)
  assert.match(detail, /customer-page-content \{ padding: 20px 12px 44px !important; \}/)
})

test('staff never see spend, consent segments or contact details in the list', () => {
  assert.match(list, /ownerOnly: true \}/)
  assert.match(list, /SEGMENTS\.filter\(\(sg\) => isOwner \|\| !sg\.ownerOnly\)/)
  assert.match(list, /SORTS\.filter\(\(option\) => isOwner \|\| !option\.ownerOnly\)/)
  assert.match(list, /\{isOwner && <span className="text-right">Harcama<\/span>\}/)
  assert.match(list, /RULES\.filter\(\(rule\) => ownerFields \|\| rule\.key !== 'spend'\)/)
})

test('customer list exposes human labels, email search and one Turkish loading status', () => {
  assert.match(list, /placeholder="Ad, e-posta veya telefon"/)
  assert.match(list, /<SelectValue>\{SORTS\.find/)
  assert.match(list, /role="status"[\s\S]*<Spinner aria-hidden="true"[\s\S]*Güncelleniyor/)
})

test('email campaigns disclose the restaurant sender identity and reply address', () => {
  assert.match(campaign, /<strong>Gönderen: \{restaurantName\}<\/strong>/)
  assert.match(campaign, /Müşteri yanıtları <strong>\{campaignReplyToEmail\}<\/strong> adresine gelir/)
  assert.match(campaign, /Ayarlar → Mağaza bölümüne işletme e-postası ekleyin/)
})

test('email campaigns provide ready templates and a sandboxed custom HTML preview', () => {
  assert.match(campaign, /EMAIL_CAMPAIGN_TEMPLATES\.map/)
  assert.match(campaign, />Hazır şablon<\/ToggleGroupItem>/)
  assert.match(campaign, />Tasarımcı<\/ToggleGroupItem>/)
  assert.match(campaign, />Özel HTML<\/ToggleGroupItem>/)
  assert.match(campaign, /Kullanılabilir değişken: \{'\{\{restaurant_name\}\}'\}/)
  assert.match(campaign, /<iframe title="E-posta önizlemesi" sandbox="" referrerPolicy="no-referrer" srcDoc=\{previewHtml\}/)
  assert.match(campaign, /previewCampaignEmailAction/)
  assert.match(campaign, /<CampaignEmailBuilder design=\{emailDesign\}/)
  assert.match(campaign, /Şablonu kaydet/)
  assert.match(campaign, /Kayıtlı işletme e-posta şablonları/)
  assert.match(campaign, /Alıcı e-postalarını göster/)
  assert.match(campaign, /getCampaignDeliveryLogAction/)
})

test('customer route skeleton follows the mobile two-column KPI and card layout', () => {
  const skeleton = readFileSync(new URL('../layout/DashboardRouteSkeleton.tsx', import.meta.url), 'utf8')
  assert.match(skeleton, /dashboard-route-skeleton-customers-kpis[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(skeleton, /dashboard-route-skeleton-customers-table \{ display: none !important; \}/)
  assert.match(skeleton, /dashboard-route-skeleton-customers-mobile \{ display: grid !important; \}/)
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

test('choosing a customer opens the profile in place and keeps it in the URL', () => {
  assert.match(list, /onOpen=\{\(\) => setSelectedId\(customer\.customerId\)\}/)
  assert.match(list, /customerListHref\(pathname, \{[^}]*customerId: selectedId \}\)/)
  assert.match(list, /setSelectedId\(restored\.customerId\)/)
  assert.match(list, /dynamic\(\(\) => import\('\.\/CustomerProfilePanel'\)/)
  assert.match(topbar, /beginNavigation\(backHref\)[\s\S]*router\.push\(backHref\)/)
  assert.match(topbar, /className="page-topbar-back"/)
  assert.match(globalCss, /\.page-topbar-back:not\(:disabled\):hover/)
})
