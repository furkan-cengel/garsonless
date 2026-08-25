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

test('plan lock separates owner checkout from member guidance', () => {
  const panel = read('../PlanLockedPanel.tsx')

  assert.match(panel, /isOwner \? plans\.length > 0 \? \(/)
  assert.match(panel, /Yükseltme yetkiniz bulunmuyor/)
  assert.match(panel, /Plan ve ödeme bilgilerini yalnız işletme sahibi değiştirebilir/)
  assert.match(panel, /aria-label="Hedef paket"/)
  assert.match(panel, /type="radio"/)
})

test('plan lock is responsive, touch-safe and reduced-motion safe', () => {
  const styles = read('../PlanLockedPanel.module.css')

  assert.match(styles, /@media \(max-width: 980px\)/)
  assert.match(styles, /@media \(max-width: 600px\)/)
  assert.match(styles, /@media \(pointer: coarse\)[\s\S]*min-height: 44px/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
})
