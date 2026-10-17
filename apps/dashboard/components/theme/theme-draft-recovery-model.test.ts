import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from '@garsonless/design-engine'
import { mergeThemeRecovery, themeRecoveryKey } from './theme-draft-recovery-model'
import { requireThemeMenuReferences } from '../../lib/theme-menu-references'
import { isThemeSectionLocked } from './theme-section-access-model'

const base = structuredClone(DEFAULT_THEME)
const scope = { userId: 'member-a', restaurantId: 'restaurant-a', templateId: 'default' }
test('legacy backup cleanup is scoped to member, tenant and template', () => {
  assert.equal(themeRecoveryKey(scope), 'masabu:theme-recovery:["member-a","restaurant-a","default"]')
  for (const other of [{ ...scope, userId: 'member-b' }, { ...scope, restaurantId: 'restaurant-b' }, { ...scope, templateId: 'other' }]) {
    assert.notEqual(themeRecoveryKey(other), themeRecoveryKey(scope))
  }
})

test('three-way merge preserves disjoint local and remote fields without mutating inputs', () => {
  const local = { ...base, bg: '#fff0e0' }
  const remote = { ...base, textColor: '#112233' }
  const result = mergeThemeRecovery(base, local, remote)
  assert.deepEqual(result.conflicts, [])
  assert.equal(result.theme.bg, local.bg)
  assert.equal(result.theme.textColor, remote.textColor)
  assert.equal(base.bg, DEFAULT_THEME.bg)
  assert.equal(local.textColor, DEFAULT_THEME.textColor)
})

test('conflict choice affects only overlapping edits; remote-only values survive either choice', () => {
  const local = { ...base, bg: '#fff0e0', accent: '#123456' }
  const remote = { ...base, bg: '#ffffff', textColor: '#112233' }
  for (const preference of ['local', 'remote'] as const) {
    const result = mergeThemeRecovery(base, local, remote, preference)
    assert.deepEqual(result.conflicts.map((conflict) => conflict.path), ['bg'])
    assert.equal(result.theme.bg, preference === 'local' ? local.bg : remote.bg)
    assert.equal(result.theme.accent, local.accent)
    assert.equal(result.theme.textColor, remote.textColor)
  }
})

test('identical changes do not conflict and unchanged local adopts the current server document', () => {
  const remote = { ...base, bg: '#fff0e0' }
  assert.deepEqual(mergeThemeRecovery(base, remote, remote).conflicts, [])
  assert.deepEqual(mergeThemeRecovery(base, base, remote).theme, remote)
})

test('nested fields merge independently and deletion versus modification requires a choice', () => {
  const before = { ...base, sectionSettings: { hours: { title: 'A', color: 'B' } } }
  const local = { ...before, sectionSettings: { hours: { title: 'Local', color: 'B' } } }
  const remote = { ...before, sectionSettings: { hours: { title: 'A', color: 'Remote' } } }
  assert.deepEqual(mergeThemeRecovery(before, local, remote).theme.sectionSettings?.hours, { title: 'Local', color: 'Remote' })
  const deleted = { ...before, sectionSettings: {} }
  assert.equal(mergeThemeRecovery(before, deleted, remote).conflicts[0]?.path, 'sectionSettings.hours')
  assert.deepEqual(mergeThemeRecovery(before, deleted, remote, 'remote').theme.sectionSettings, remote.sectionSettings)
  assert.deepEqual(mergeThemeRecovery(before, deleted, before).theme.sectionSettings, {})
})

test('simultaneous block reordering/removal remains an explicit atomic conflict', () => {
  const before = { ...base, sections: ['hours', 'wifi-info', 'hero-banner'] }
  const local = { ...before, sections: ['hero-banner', 'hours', 'wifi-info'] }
  const remote = { ...before, sections: ['hours', 'hero-banner'] }
  assert.deepEqual(mergeThemeRecovery(before, local, remote).conflicts.map((issue) => issue.path), ['sections'])
  assert.deepEqual(mergeThemeRecovery(before, local, remote, 'remote').theme.sections, remote.sections)
})

test('a failed menu read throws while a genuinely empty catalogue stays valid', () => {
  const empty = { categories: [], items: [] }
  assert.equal(requireThemeMenuReferences({ ok: true, value: empty }), empty)
  assert.throws(() => requireThemeMenuReferences({ ok: false, error: 'private upstream detail' }), { message: 'Theme menu references unavailable' })
})

test('existing advanced sections and separately billed video use their own entitlements', () => {
  assert.equal(isThemeSectionLocked({ id: 'hours', plan: 'starter' }, false, false), false)
  assert.equal(isThemeSectionLocked({ id: 'request-buttons', plan: 'pro' }, false, true), true)
  assert.equal(isThemeSectionLocked({ id: 'request-buttons', plan: 'pro' }, true, false), false)
  assert.equal(isThemeSectionLocked({ id: 'storefront-video-hero', plan: 'pro' }, true, false), true)
  assert.equal(isThemeSectionLocked({ id: 'storefront-video-hero', plan: 'pro' }, false, true), false)
})
