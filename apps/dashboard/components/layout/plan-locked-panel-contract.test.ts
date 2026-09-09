import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8')

test('plan lock upsell uses the canonical catalogue and carries selection into hosted billing', () => {
  const panel = read('../PlanLockedPanel.tsx')
  const billing = read('../settings/BillingSection.tsx')

  assert.match(panel, /BillingPlanPrices/)
  assert.match(panel, /SELF_SERVE_PLANS/)
  assert.match(panel, /method="get"/)
  assert.match(panel, /name="section" value="billing"/)
  assert.match(panel, /name="plan"/)
  assert.match(panel, /name="interval"/)
  assert.doesNotMatch(panel, /'use client'/)
  assert.match(billing, /searchParams\.get\('plan'\)/)
  assert.match(billing, /searchParams\.get\('interval'\)/)
  assert.match(billing, /PAID_PLANS\.includes/)
  assert.match(panel, /checkoutConfigured/)
  assert.match(panel, /Ödeme yapılandırılıyor/)
})

test('plan lock reflects an already scheduled provider change without offering a duplicate checkout', () => {
  const panel = read('../PlanLockedPanel.tsx')

  assert.match(panel, /readSubscriptionBillingSettings/)
  assert.match(panel, /scheduledUnlockPlan/)
  assert.match(panel, /Yeni paket yalnızca bir sonraki dönem ödemesi başarıyla alındıktan sonra etkinleşir/)
  assert.match(panel, /Şimdi tekrar ödeme başlatmanız gerekmez/)
  assert.match(panel, /Planlamayı görüntüle/)
  assert.doesNotMatch(panel, />Anında etkinleşir</)
})

test('plan lock separates owner checkout from member guidance', () => {
  const panel = read('../PlanLockedPanel.tsx')

  assert.match(panel, /isOwner \? scheduledUnlockPlan \? \(/)
  assert.match(panel, /\) : plans\.length > 0 \? \(/)
  assert.match(panel, /Yükseltme yetkiniz bulunmuyor/)
  assert.match(panel, /Plan ve ödeme bilgilerini yalnız işletme sahibi değiştirebilir/)
  assert.match(panel, /type="radio" name="plan" value=\{plan\}/)
  assert.match(panel, /aria-label="Fatura dönemi"/)
  assert.match(panel, /type="radio"/)
})

test('plan lock always provides a deterministic escape route', () => {
  const panel = read('../PlanLockedPanel.tsx')
  const tablesPage = read('../../app/dashboard/[restaurantId]/tables/page.tsx')

  assert.match(panel, /returnHref\?: string/)
  assert.match(panel, /returnLabel = 'Menüye dön'/)
  assert.match(panel, /returnHref \?\? `\/dashboard\/\$\{restaurantId\}\/menu`/)
  const card = read('../plan-lock/PlanLockCard.tsx')
  assert.match(card, /className=\{styles\.returnLink\}/)
  assert.match(card, /aria-label=\{returnLabel\}/)
  assert.match(tablesPage, /returnHref=\{`\/dashboard\/\$\{restaurantId\}\/tables\/qr`\}/)
  assert.match(tablesPage, /returnLabel="QR Studio'ya dön"/)
})

test('plan lock is responsive, touch-safe and reduced-motion safe', () => {
  const styles = read('../PlanLockedPanel.module.css')

  assert.match(styles, /@media \(max-width: 980px\)/)
  assert.match(styles, /@media \(max-width: 600px\)/)
  assert.match(styles, /@media \(pointer: coarse\)[\s\S]*min-height: 44px/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
})


test('all plan locks share a content-only card without feature preview imports', () => {
  const card = read('../plan-lock/PlanLockCard.tsx')
  const panel = read('../PlanLockedPanel.tsx')
  const settings = read('../settings/SettingsPlanLock.tsx')
  assert.match(panel, /<PlanLockCard/)
  assert.match(settings, /<PlanLockCard/)
  assert.doesNotMatch(card, /PlanLockVisual|ReportPreview|FeaturePreview/)
})
