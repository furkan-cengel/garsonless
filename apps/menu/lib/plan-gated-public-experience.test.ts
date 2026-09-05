import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const homePage = readFileSync(new URL('../app/[slug]/page.tsx', import.meta.url), 'utf8')
const menuExperience = readFileSync(new URL('../app/[slug]/_menu-experience.tsx', import.meta.url), 'utf8')
const tablePage = readFileSync(new URL('../app/[slug]/table/[tableId]/page.tsx', import.meta.url), 'utf8')
const homeClient = readFileSync(new URL('../app/[slug]/HomePageClient.tsx', import.meta.url), 'utf8')
const menuClient = readFileSync(new URL('../app/[slug]/MenuPageClient.tsx', import.meta.url), 'utf8')
const previewPage = readFileSync(new URL('../app/theme-preview/[slug]/page.tsx', import.meta.url), 'utf8')
const cartStore = readFileSync(new URL('./store/useCartStore.ts', import.meta.url), 'utf8')
const productModal = readFileSync(new URL('../../../packages/ui/src/menu/ProductModal.tsx', import.meta.url), 'utf8')

test('public menu surfaces resolve subscription-aware plan features on the server', () => {
  for (const source of [homePage, menuExperience, tablePage]) {
    assert.match(source, /feature: 'qr_menu'/)
  }
  // Both paid theme entitlements are resolved server-side on every public
  // surface, and all four project the theme through the shared boundary.
  for (const source of [homePage, menuExperience, tablePage, previewPage]) {
    assert.match(source, /feature: 'theme_advanced_sections'/)
    assert.match(source, /feature: 'theme_video_hero'/)
    assert.match(source, /projectThemeForEntitlements\(/)
    assert.match(source, /advancedSections: advancedThemeAccess\.ok && advancedThemeAccess\.value/)
    assert.match(source, /videoHero: videoHeroAccess\.ok && videoHeroAccess\.value/)
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

test('Starter is view-only on both live and preview menu surfaces', () => {
  assert.match(menuClient, /const orderingEnabled = guestOrderingEnabled/)
  assert.doesNotMatch(menuClient, /guestOrderingEnabled\s*\|\|\s*isPreview/)
  assert.match(menuClient, /clearRestaurantCarts\(restaurant\.id\)/)
  assert.match(menuClient, /\{orderingEnabled && hasOpenedCart && <CartDrawer/)
  assert.match(menuClient, /\{orderingEnabled && !isCartOpen && effectiveCartItems\.length > 0 && \(/)
  assert.match(previewPage, /feature: 'guest_ordering'/)
  for (const source of [homePage, menuExperience, tablePage, previewPage]) {
    assert.match(source, /readTenantOrderIngressStatus\(restaurant\.id\)/)
    assert.match(source, /orderIngressStatus === 'active'/)
  }
  assert.match(previewPage, /if \(surface === 'checkout' && !guestOrderingEnabled\) notFound\(\)/)
  assert.match(cartStore, /clearRestaurantCarts:[\s\S]+const prefix = `v1:\$\{restaurantId\}:`/)
})

test('the shared product modal uses orderingEnabled as the only ordering interaction boundary', () => {
  assert.match(productModal, /data-ordering-enabled=\{orderingEnabled \? "true" : "false"\}/)
  assert.match(productModal, /orderingEnabled && recommendationItems\.length > 0/)
  assert.match(productModal, /orderingEnabled && <div[\s\S]+data-component="product-note"/)
  assert.match(productModal, /orderingEnabled \? <div[\s\S]+data-component="product-modal-actions"/)
  assert.match(productModal, /data-component="product-modal-view-only-notice"/)
  assert.match(productModal, /Bu menü yalnızca görüntüleme amaçlıdır\./)
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
