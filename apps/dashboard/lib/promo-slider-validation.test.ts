import test from 'node:test'
import assert from 'node:assert/strict'
import { getPromoSliderSettingIssues } from './promo-slider-validation'

test('legacy active mode does not bypass validation for an explicitly enabled special card', () => {
  assert.deepEqual(getPromoSliderSettingIssues({
    sourceMode: 'active',
    flashEnabled: 'true',
    flashOfferType: 'buy-2-pay-1',
  }), ['Flash 2 al 1 öde kampanyası için en az bir ürün seçin.'])
})

test('functional freebie blocks incomplete, duplicated and invalid timed drafts', () => {
  const base = { sourceMode: 'manual', flashEnabled: 'false', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'products' }
  assert.match(getPromoSliderSettingIssues(base).join(' '), /uygun ürün.*hediye ürün/i)
  assert.match(getPromoSliderSettingIssues({ ...base, freebieQualifierItem1Id: 'same', freebieRewardItem1Id: 'same' }).join(' '), /hem uygun ürün hem hediye/i)
  assert.match(getPromoSliderSettingIssues({ ...base, freebieQualifierItem1Id: 'coffee', freebieRewardItem1Id: 'cake', freebieTimingEnabled: 'true', freebieStartsAt: '2030-01-02', freebieEndsAt: '2030-01-01' }, Date.parse('2029-01-01')).join(' '), /başlangıç ve bitiş/i)
})

test('complete category-based freebie configuration can publish', () => {
  const issues = getPromoSliderSettingIssues({ sourceMode: 'manual', flashEnabled: 'false', freebieEnabled: 'true', freebieOfferType: 'gift-with-purchase', freebieQualifierMode: 'category', freebieQualifierCategoryId: 'coffee', freebieRewardItem1Id: 'cake' })
  assert.deepEqual(issues, [])
})

test('functional freebie cannot reuse a product from a pair campaign', () => {
  const issues = getPromoSliderSettingIssues({
    sourceMode: 'manual',
    freebieEnabled: 'true',
    freebieOfferType: 'gift-with-purchase',
    freebieQualifierMode: 'products',
    freebieQualifierItem1Id: 'coffee',
    freebieRewardItem1Id: 'cake',
    flashEnabled: 'true',
    flashOfferType: 'buy-2-pay-1',
    flashItem1Id: 'cake',
  })
  assert.match(issues.join(' '), /çakışamaz/i)
})

test('category qualifier cannot contain a selected reward', () => {
  const issues = getPromoSliderSettingIssues({
    sourceMode: 'manual',
    flashEnabled: 'false',
    freebieEnabled: 'true',
    freebieOfferType: 'gift-with-purchase',
    freebieQualifierMode: 'category',
    freebieQualifierCategoryId: 'dessert',
    freebieRewardItem1Id: 'cake',
  }, Date.now(), [{ id: 'cake', categoryId: 'dessert' }])
  assert.match(issues.join(' '), /kategorinin içinde olamaz/i)
})
