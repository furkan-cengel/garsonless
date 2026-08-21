import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_THEME, resolveMenuHeaderTheme } from '@garsonless/design-engine'
import {
  buildMenuHeaderFieldPatch,
  buildMenuHeaderGroupResetPatch,
  buildMenuHeaderContrastRepairPatch,
  getMenuHeaderOverride,
  isMenuHeaderEditorGroup,
  projectMenuHeaderFieldChange,
} from './menu-header-editor-scope'

test('Menu Header groups use the scoped editor path', () => {
  assert.equal(isMenuHeaderEditorGroup('header'), true)
  assert.equal(isMenuHeaderEditorGroup('header-layout'), true)
  assert.equal(isMenuHeaderEditorGroup('header-context'), true)
  assert.equal(isMenuHeaderEditorGroup('header-actions'), true)
  assert.equal(isMenuHeaderEditorGroup('drawer'), false)
})

test('field changes create a Menu-only override without mutating flat or Home values', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.surfaces!.home.chrome = { header: { headerLogoSize: 54 } }

  const patch = buildMenuHeaderFieldPatch(theme, 'headerLogoSize', 72)
  const next = { ...theme, ...patch }

  assert.equal(next.headerLogoSize, DEFAULT_THEME.headerLogoSize)
  assert.equal(resolveMenuHeaderTheme(next).headerLogoSize, 72)
  assert.equal(next.surfaces?.home.chrome?.header?.headerLogoSize, 54)
})

test('matching the flat fallback removes only that scoped field', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.surfaces!.menu = {
    chrome: { header: { headerLogoSize: 72, headerPadX: 28 } },
  }

  const patch = buildMenuHeaderFieldPatch(theme, 'headerLogoSize', theme.headerLogoSize)
  const next = { ...theme, ...patch }

  assert.deepEqual(getMenuHeaderOverride(next), { headerPadX: 28 })
})

test('group reset removes only active group fields and preserves other Menu Header overrides', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.surfaces!.menu = {
    chrome: {
      header: {
        headerLogoSize: 72,
        headerNameSize: 42,
        stickyHeader: false,
        memberPlacement: 'header',
      },
    },
  }

  const patch = buildMenuHeaderGroupResetPatch(theme, ['headerLogoSize', 'headerNameSize'])
  const next = { ...theme, ...patch }

  assert.deepEqual(getMenuHeaderOverride(next), {
    stickyHeader: false,
    memberPlacement: 'header',
  })
})

test('scoped placement changes retain the two-action Header capacity rule', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.surfaces!.menu = {
    chrome: {
      header: {
        memberPlacement: 'header',
        cartPlacement: 'header',
      },
    },
  }

  const result = projectMenuHeaderFieldChange(theme, 'servicePlacement', 'header')
  const next = { ...theme, ...result.patch }

  assert.equal(result.movedHeaderAction, true)
  assert.deepEqual(getMenuHeaderOverride(next), {
    memberPlacement: 'drawer',
    cartPlacement: 'header',
    servicePlacement: 'header',
  })
})

test('contrast repair updates only the Menu Header palette and preserves unrelated overrides', () => {
  const theme = structuredClone(DEFAULT_THEME)
  theme.surfaces!.menu = {
    chrome: { header: { headerBg: '#ffffff', headerTextColor: '#eeeeee', headerRadius: 18 } },
  }

  const next = { ...theme, ...buildMenuHeaderContrastRepairPatch(theme) }
  assert.deepEqual(getMenuHeaderOverride(next), {
    headerBg: '#ffffff',
    headerTextColor: '#1c1d20',
    headerIconColor: '#166534',
    headerRadius: 18,
  })
  assert.equal(next.headerTextColor, theme.headerTextColor)
})
