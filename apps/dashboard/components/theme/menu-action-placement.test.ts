import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_THEME,
  resolveMenuActionPlacements,
  sanitizeThemeTokens,
  type GarsonlessTheme,
} from '@garsonless/design-engine'

function theme(patch: Partial<GarsonlessTheme>): GarsonlessTheme {
  return { ...DEFAULT_THEME, ...patch }
}

test('default customer actions have exactly one surface', () => {
  assert.deepEqual(resolveMenuActionPlacements(theme({})), {
    member: 'drawer',
    bill: 'drawer',
    cart: 'footer',
    service: 'drawer',
  })
})

test('header capacity keeps cart and service before membership', () => {
  assert.deepEqual(resolveMenuActionPlacements(theme({
    memberPlacement: 'header',
    cartPlacement: 'header',
    servicePlacement: 'header',
  })), {
    member: 'drawer',
    bill: 'drawer',
    cart: 'header',
    service: 'header',
  })
})

test('missing callbacks do not consume the two visible header slots', () => {
  assert.deepEqual(resolveMenuActionPlacements(theme({
    memberPlacement: 'header',
    cartPlacement: 'header',
    servicePlacement: 'header',
  }), {
    member: true,
    cart: true,
    service: false,
    bill: false,
  }), {
    member: 'header',
    bill: 'drawer',
    cart: 'header',
    service: 'header',
  })
})

test('every action resolves to exactly one selected surface across the placement matrix', () => {
  const options = {
    memberPlacement: ['header', 'drawer', 'hidden'],
    billPlacement: ['header', 'drawer', 'hidden'],
    cartPlacement: ['header', 'drawer', 'footer', 'hidden'],
    servicePlacement: ['header', 'drawer', 'floating', 'hidden'],
  } as const
  for (const [field, values] of Object.entries(options)) {
    for (const value of values) {
      const action = field.replace('Placement', '') as keyof ReturnType<typeof resolveMenuActionPlacements>
      const projected = resolveMenuActionPlacements(theme({ [field]: value }))
      assert.equal(projected[action], value)
    }
  }
})

test('legacy duplicate controls migrate to one surface and old layouts map to presets', () => {
  const migrated = sanitizeThemeTokens({
    headerLayout: 'center',
    headerTableBadge: true,
    headerShowBill: true,
    drawerShowBill: true,
    drawerShowMember: true,
    cartHeaderTriggerStyle: 'icon',
    cartFooterTriggerStyle: 'pill',
    drawerShowCart: true,
    pageBlocks: [{ type: 'section', id: 'request-buttons' }],
  }, 'default')

  assert.equal(migrated?.headerPreset, 'standard')
  assert.equal(migrated?.headerShowContextBar, true)
  assert.equal(migrated?.memberPlacement, 'drawer')
  assert.equal(migrated?.billPlacement, 'drawer')
  assert.equal(migrated?.cartPlacement, 'header')
  assert.equal(migrated?.servicePlacement, 'floating')
})

test('invalid persisted placement and preset values fail closed to canonical defaults', () => {
  const sanitized = sanitizeThemeTokens({
    headerPreset: 'stacked-again',
    memberPlacement: 'popover',
    billPlacement: 'both',
    cartPlacement: 'sidebar',
    servicePlacement: 'toast',
  }, 'default')

  assert.equal(sanitized?.headerPreset, DEFAULT_THEME.headerPreset)
  assert.equal(sanitized?.memberPlacement, DEFAULT_THEME.memberPlacement)
  assert.equal(sanitized?.billPlacement, DEFAULT_THEME.billPlacement)
  assert.equal(sanitized?.cartPlacement, DEFAULT_THEME.cartPlacement)
  assert.equal(sanitized?.servicePlacement, DEFAULT_THEME.servicePlacement)
})
