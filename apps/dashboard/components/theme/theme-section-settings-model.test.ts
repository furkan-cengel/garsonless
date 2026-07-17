import assert from 'node:assert/strict'
import test from 'node:test'

import type { SectionSettingField } from './theme-editor-properties-model'
import {
  getSectionSettingLabel,
  getVisibleSectionSettingFields,
  groupMenuItems,
  resolveSectionSettingValue,
  sectionSettingControlId,
} from './theme-section-settings-model'

const field = (key: string, type: SectionSettingField['type'] = 'text'): SectionSettingField => ({
  key,
  label: key,
  type,
  editorTab: 'content',
})

test('link targets reveal only the URL while category targets reveal the selector', () => {
  const fields = [field('targetType', 'select'), field('targetId', 'select'), field('targetUrl', 'url')]
  assert.deepEqual(getVisibleSectionSettingFields(fields, { targetType: 'link' }).map((item) => item.key), ['targetType', 'targetUrl'])
  assert.deepEqual(getVisibleSectionSettingFields(fields, { targetType: 'category' }).map((item) => item.key), ['targetType', 'targetId'])
})

test('promo slide defaults are projected and disabled slide details stay hidden', () => {
  const fields = [field('couponHeading', 'heading'), field('couponEnabled', 'toggle'), field('couponBody'), field('loyaltyEnabled', 'toggle'), field('loyaltyBody')]
  assert.equal(resolveSectionSettingValue(fields[1]!, {}, true), 'true')
  assert.equal(resolveSectionSettingValue(fields[3]!, {}, true), 'false')
  assert.deepEqual(getVisibleSectionSettingFields(fields, {}).map((item) => item.key), ['couponHeading', 'couponEnabled', 'couponBody', 'loyaltyEnabled'])
  assert.ok(getVisibleSectionSettingFields(fields, { loyaltyEnabled: 'true' }).some((item) => item.key === 'loyaltyBody'))
})

test('combo count and icon gates fail closed for malformed stored values', () => {
  const fields = [field('comboCount'), field('combo1IconCount'), field('combo1Icon3'), field('combo2Title'), field('combo3Title')]
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { comboCount: 'invalid', combo1IconCount: 'invalid' }).map((item) => item.key),
    ['comboCount', 'combo1IconCount', 'combo2Title', 'combo3Title'],
  )
  assert.deepEqual(
    getVisibleSectionSettingFields(fields, { comboCount: '1', combo1IconCount: '3' }).map((item) => item.key),
    ['comboCount', 'combo1IconCount', 'combo1Icon3'],
  )
})

test('target labels and control ids are deterministic and accessible', () => {
  assert.equal(getSectionSettingLabel(field('targetId'), 'category'), 'Kategori')
  assert.equal(getSectionSettingLabel(field('targetId'), 'product'), 'Ürün')
  assert.equal(sectionSettingControlId('Hero CTA / URL'), 'section-field-hero-cta-url')
})

test('menu items are grouped in source order without losing category context', () => {
  assert.deepEqual(groupMenuItems([
    { id: '1', name: 'Latte', categoryId: 'c1', categoryName: 'Kahve' },
    { id: '2', name: 'Brownie', categoryId: 'c2', categoryName: 'Tatlı' },
    { id: '3', name: 'Mocha', categoryId: 'c1', categoryName: 'Kahve' },
  ]), [
    { categoryName: 'Kahve', items: [{ id: '1', name: 'Latte' }, { id: '3', name: 'Mocha' }] },
    { categoryName: 'Tatlı', items: [{ id: '2', name: 'Brownie' }] },
  ])
})
