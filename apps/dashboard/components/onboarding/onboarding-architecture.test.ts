import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../../app/dashboard/onboarding/page.tsx', import.meta.url), 'utf8')
const flow = readFileSync(new URL('./OnboardingFlow.tsx', import.meta.url), 'utf8')
const actions = readFileSync(new URL('../../lib/actions/onboarding.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./OnboardingFlow.module.css', import.meta.url), 'utf8')

test('onboarding is server-resumed and no longer exposes a fake theme choice', () => {
  assert.match(page, /readOwnerOnboarding/)
  assert.match(page, /initialBusinessName/)
  assert.match(page, /adminEmail=\{user\.email \?\? ''\}/)
  assert.match(flow, /styles\.accountIdentity/)
  assert.doesNotMatch(flow, /Choose theme|Tema seç|StepTemplateSelect/)
  assert.match(flow, /CSV yükle/)
  assert.match(flow, /Manuel oluştur/)
})

test('all state-changing onboarding intents carry stable request identity', () => {
  assert.match(flow, /stableRequest\(createRequest\)/)
  assert.match(flow, /stableRequest\(brandingRequest\)/)
  assert.match(flow, /stableRequest\(menuRequest\)/)
  assert.match(actions, /expectedRevision/)
  assert.match(actions, /advanceOnboardingBranding/)
  assert.match(actions, /createOnboardingFirstItem/)
})

test('responsive onboarding includes the SaaS step rail, safe area and reduced motion', () => {
  assert.match(flow, /styles\.stepRail/)
  assert.match(flow, /styles\.cardFooter/)
  assert.match(css, /@media \(max-width: 800px\)/)
  assert.match(css, /env\(safe-area-inset-bottom/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(css, /min-height: 44px/)
})

test('menu preview is compact and free of decorative helper copy', () => {
  assert.match(flow, /styles\.inlinePreview/)
  assert.match(css, /\.brandingGrid/)
  assert.doesNotMatch(flow, /styles\.previewPane/)
  assert.doesNotMatch(flow, /CANLI ÖNİZLEME/)
  assert.doesNotMatch(flow, /Otomatik kaydedilen güvenli kurulum/)
  assert.doesNotMatch(css, /\.previewCopy/)
  assert.doesNotMatch(css, /\.previewBadge/)
  assert.doesNotMatch(flow, /Kart bilgisi gerekmez/)
  assert.doesNotMatch(flow, /styles\.previewGlow/)
})

test('branding uses the canonical default theme without asking for a color', () => {
  assert.doesNotMatch(flow, /Ana renk|HEX marka rengi|ACCENTS|setAccent/)
  assert.match(flow, /Varsayılan menü görünümün otomatik hazırlanır/)
  assert.match(actions, /sanitizeThemeTokens\(THEME_DEFAULTS, CANONICAL_THEME_ID\)/)
  assert.match(actions, /accent: THEME_DEFAULTS\.accent\.toLowerCase\(\)/)
  assert.doesNotMatch(actions, /Daha koyu bir renk seçin/)
})

test('detected timezone and fixed TRY policy stay out of the setup form', () => {
  assert.match(flow, /normalizeDetectedTimezone/)
  assert.match(flow, /timezone, targetPlan/)
  assert.doesNotMatch(flow, /label="Saat dilimi"/)
  assert.doesNotMatch(flow, /label="Para birimi"/)
  assert.doesNotMatch(flow, /value="TRY — ₺"/)
})

test('completion stays visible in a centered single-column layout', () => {
  assert.match(flow, /step === 3 \? styles\.successShell : ''/)
  assert.match(css, /\.successShell\s*{[^}]*grid-template-columns:\s*minmax\(0, 680px\);[^}]*justify-content:\s*center;/s)

  const completionAction = actions.slice(
    actions.indexOf('export async function createOnboardingMenuItem'),
    actions.indexOf('export async function importOnboardingCsvMenu'),
  )
  assert.match(completionAction, /revalidatePath\(`\/dashboard\/\$\{parsed\.data\.restaurantId\}\/menu`\)/)
  assert.doesNotMatch(completionAction, /revalidatePath\('\/dashboard\/onboarding'\)/)
  assert.doesNotMatch(page, /snapshot\?\.status === 'completed'[\s\S]{0,100}redirect/)
})
