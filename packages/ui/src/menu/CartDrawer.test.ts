import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./CartDrawer.tsx', import.meta.url), 'utf8')

test('secondary checkout actions use the shared vector icon system', () => {
  assert.match(source, /<I\.card size=\{18\} strokeWidth=\{1\.9\}/)
  assert.match(source, /<I\.users size=\{18\} strokeWidth=\{1\.9\}/)
  assert.doesNotMatch(source, /💳 Ödeme Yap|÷ Kişi Başı Hesapla/)
})

test('buy two pay one cart lines expose the exact two-item campaign price', () => {
  assert.match(source, /2 al 1 öde · 2 adet/)
  assert.match(source, /formatTRY\(\(item\.price \+ item\.modifiersPriceDelta\) \* 2\)/)
})

test('freebie reward lines are labelled and do not expose independent quantity controls', () => {
  assert.match(source, /cart-freebie-badge/)
  assert.match(source, /Hediye · taban fiyat ₺0/)
  assert.match(source, /item\.promotion\.role === 'reward'/)
  assert.match(source, /onChangeFreebieReward/)
})

test('checkout coupon control is accessible, removable and blocks stale pricing', () => {
  assert.match(source, /Kupon kodun var mı\?/)
  assert.match(source, /aria-live="polite"/)
  assert.match(source, /coupon\.onApply/)
  assert.match(source, /coupon\.onRemove/)
  assert.match(source, /coupon\?\.blocksCheckout/)
  assert.match(source, /discountPreview\?\.couponDiscountAmount/)
})

test('coupon typing does not reinstall the drawer focus trap', () => {
  assert.match(source, /const onCloseRef = useRef\(onClose\)/)
  assert.match(source, /onCloseRef\.current\(\)/)
  assert.match(source, /\}, \[isOpen, returnFocusSelector\]\)/)
  assert.doesNotMatch(source, /\}, \[isOpen, onClose\]\)/)
})

test('all compact cart actions keep 44px targets and quantity changes are announced', () => {
  assert.match(source, /height: 44, width: 44/)
  assert.match(source, /height: 44/)
  assert.match(source, /minHeight: 44/)
  assert.match(source, /role="status" aria-live="polite" aria-atomic="true"/)
  assert.match(source, /setQuantityAnnouncement/)
})

test('cart uses vector empty and reward icons plus Checkout-owned header colors', () => {
  assert.match(source, /<I\.cart size=\{29\}/)
  assert.match(source, /<I\.gift size=\{16\}/)
  assert.match(source, /<I\.star size=\{15\}/)
  assert.doesNotMatch(source, /🛒|🎁|⭐/)
  assert.match(source, /checkoutPreset === 'brand-header'/)
  assert.doesNotMatch(source, /headerIsAccent =[^\n]+cartDrawerTone/)
})

test('exclusive coupons make loyalty redemption an explicit alternative', () => {
  assert.match(source, /exclusiveCouponApplied/)
  assert.match(source, /cart-exclusive-coupon-notice/)
  assert.match(source, /Kuponu kaldır ve puan kullan/)
  assert.match(source, /!exclusiveCouponApplied && !catalogReward && pointsRedeem/)
})

test('cart uses one main scroll region and keeps only total plus primary action in the fixed tray', () => {
  assert.equal(source.match(/overflowY: 'auto'/g)?.length, 1)
  assert.match(source, /data-component="cart-scroll-region"/)
  assert.match(source, /data-component="cart-items-region"/)
  assert.match(source, /data-component="cart-details-region"/)
  assert.match(source, /data-component="cart-action-tray"/)
  assert.match(source, /data-component="cart-primary-action"/)
  assert.doesNotMatch(source, /flex: 1, overflowY: 'auto'/)

  const scrollRegion = source.indexOf('data-component="cart-scroll-region"')
  const itemsRegion = source.indexOf('data-component="cart-items-region"')
  const detailsRegion = source.indexOf('data-component="cart-details-region"')
  const secondaryActions = source.indexOf('<I.card size={18}')
  const actionTray = source.indexOf('data-component="cart-action-tray"')
  const primaryAction = source.indexOf('data-component="cart-primary-action"')

  assert.ok(scrollRegion < itemsRegion)
  assert.ok(itemsRegion < detailsRegion)
  assert.ok(detailsRegion < secondaryActions)
  assert.ok(secondaryActions < actionTray)
  assert.ok(actionTray < primaryAction)
})

test('points redemption amounts stay positive in the selector while discount summaries remain signed', () => {
  assert.match(source, />\{formatTRY\(pointsRedeem\.redeemTl\)\}<\/span>/)
  assert.match(source, /Tümünü kullan \(\{formatTRY\(maxRedeemTl\)\}\)/)
  assert.doesNotMatch(source, /-\{formatTRY\(pointsRedeem\.redeemTl\)\}/)
  assert.doesNotMatch(source, /Tümünü kullan \(-\{formatTRY\(maxRedeemTl\)\}\)/)
  assert.match(source, /-\{formatTRY\(pointsDiscount\)\}/)
})
