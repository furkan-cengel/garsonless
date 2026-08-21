import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homePage = readFileSync(new URL('../app/[slug]/page.tsx', import.meta.url), 'utf8')
const menuExperience = readFileSync(new URL('../app/[slug]/_menu-experience.tsx', import.meta.url), 'utf8')
const tablePage = readFileSync(new URL('../app/[slug]/table/[tableId]/page.tsx', import.meta.url), 'utf8')
const homeClient = readFileSync(new URL('../app/[slug]/HomePageClient.tsx', import.meta.url), 'utf8')

test('public menu surfaces resolve subscription-aware plan features on the server', () => {
  for (const source of [homePage, menuExperience, tablePage]) {
    assert.match(source, /feature: 'qr_menu'/)
    assert.match(source, /feature: 'theme_advanced_sections'/)
    assert.match(source, /withoutAdvancedThemeSections/)
  }
  for (const source of [homePage, menuExperience, tablePage]) {
    assert.match(source, /feature: 'guest_ordering'/)
    assert.match(source, /feature: 'customer_accounts'/)
  }
})

test('home account and cart controls disappear when their Pro entitlements are absent', () => {
  assert.match(homeClient, /guestOrderingEnabled \? \{[\s\S]+cartSummary/)
  assert.match(homeClient, /customerAccountsEnabled \? \{ memberSummary, onOpenMember/)
  assert.match(homeClient, /customerAccountsEnabled && memberOpen \? <MemberSheet/)
})

test('only a signed dashboard preview can bypass the public QR-menu entitlement gate', () => {
  assert.match(menuExperience, /hasThemePreviewAccess\(\{/)
  assert.match(menuExperience, /if \(isPreview && !previewAccessGranted\) notFound\(\)/)
  assert.match(menuExperience, /if \(!previewAccessGranted && \(!menuAccess\.ok \|\| !menuAccess\.value\)\) notFound\(\)/)
})

test('table QR entry opens the enabled home surface and preserves table scope when entering the menu', () => {
  assert.match(tablePage, /const homeEnabled = experienceV2Enabled && servedTheme\.surfaces\?\.home\.enabled === true/)
  assert.match(tablePage, /if \(homeEnabled && sp\['surface'\] !== 'menu'\) \{[\s\S]*?<HomePageRenderer/)
  assert.match(tablePage, /<HomePageRenderer[\s\S]*?tableToken=\{tableId\}[\s\S]*?tableLabel=\{tableState\.token\.tableLabel\}/)
  assert.match(homeClient, /const menuNavigation = \{ preview: isPreview, previewTemplateId, previewAccessToken, tableToken \}/)
  assert.match(homeClient, /tableToken=\{tableToken\}/)
  assert.match(homeClient, /<HomeMenuEntryCta href=\{menuHref\} \/>/)
  assert.match(homeClient, /data-home-menu-entry-cta[\s\S]*?Menüyü Gör/)
  assert.match(homeClient, /querySelector<HTMLElement>\('\[data-home-menu-entry-cta\]'\)/)
  assert.match(homeClient, /querySelector<HTMLElement>\('\[data-home-hero\]'\)/)
  assert.match(homeClient, /setHeroPassed\(!entry\.isIntersecting && entry\.boundingClientRect\.bottom <= 0\)/)
  assert.match(homeClient, /const hidden = entryCtaVisible \|\| !heroPassed/)
})
