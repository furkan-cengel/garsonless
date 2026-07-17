import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME, TEMPLATES } from '@garsonless/design-engine'
import { err, ok } from '@garsonless/domain'
import {
  publishRestaurantTheme,
  readPublishedTheme,
  readThemeForEditor,
  type ThemeApplicationPort,
} from './themes'

const context = {
  actor: 'dashboard-member' as const,
  userId: 'user-a',
  restaurantId: 'restaurant-a',
  permissions: ['theme'],
}

function port(): ThemeApplicationPort {
  return {
    readRestaurant: async () => ok({ slug: 'cafe-a', name: 'Cafe A', logoUrl: null, settings: { active_template_id: 'default' } }),
    readConfig: async () => ok({ ...DEFAULT_THEME, accent: '#123456', __template_id: 'default' }),
    publish: async ({ restaurantId }) => ok({ slug: restaurantId }),
  }
}

test('theme reads reject cross-tenant and missing permission before the port', async () => {
  const adapter = port()
  let called = false
  adapter.readRestaurant = async () => { called = true; return ok(null) }
  assert.deepEqual(
    await readThemeForEditor(context, { restaurantId: 'restaurant-b', templateId: 'default' }, adapter),
    err('Not authorized'),
  )
  assert.deepEqual(
    await readThemeForEditor({ ...context, permissions: ['menu'] }, { restaurantId: 'restaurant-a', templateId: 'default' }, adapter),
    err('Not authorized'),
  )
  assert.equal(called, false)
})

test('editor and public reads use the same template ownership policy', async () => {
  const adapter = port()
  const editor = await readThemeForEditor(context, { restaurantId: 'restaurant-a', templateId: 'default' }, adapter)
  const publicRead = await readPublishedTheme({ restaurantId: 'restaurant-a' }, adapter)
  assert.equal(editor.ok && editor.value.theme.accent, '#123456')
  assert.equal(publicRead.ok && publicRead.value.theme.accent, '#123456')

  adapter.readRestaurant = async () => ok({ slug: 'cafe-a', name: 'Cafe A', logoUrl: null, settings: { active_template_id: 'obsidian' } })
  const otherTemplate = await readPublishedTheme({ restaurantId: 'restaurant-a' }, adapter)
  assert.equal(otherTemplate.ok && otherTemplate.value.theme.accent === '#123456', false)
})

test('publish sanitizes CSS-shaped values and derives audit identity from actor', async () => {
  const adapter = port()
  let publishedBy = ''
  let publishedTheme = DEFAULT_THEME
  adapter.publish = async (input) => {
    publishedBy = input.publishedBy
    publishedTheme = input.theme
    return ok({ slug: 'cafe-a' })
  }
  const result = await publishRestaurantTheme(context, {
    restaurantId: 'restaurant-a',
    templateId: 'default',
    theme: {
      ...DEFAULT_THEME,
      accent: '#abcdef',
      bg: '#fff;}</style><script>alert(1)</script>',
      bodyFont: 'Inter; background:url(javascript:alert(1))',
      unknown: true,
    },
  }, adapter)
  assert.equal(result.ok, true)
  assert.equal(publishedBy, 'user-a')
  assert.equal(publishedTheme.accent, '#abcdef')
  assert.equal(publishedTheme.bg, TEMPLATES['default']?.bg)
  assert.equal(publishedTheme.bodyFont, TEMPLATES['default']?.bodyFont)
  assert.equal('unknown' in (publishedTheme as unknown as Record<string, unknown>), false)
})

test('publish rejects invalid template and document before persistence', async () => {
  const adapter = port()
  let called = false
  adapter.publish = async () => { called = true; return ok({ slug: 'cafe-a' }) }
  assert.deepEqual(
    await publishRestaurantTheme(context, { restaurantId: 'restaurant-a', templateId: 'missing', theme: DEFAULT_THEME }, adapter),
    err('Unknown theme template'),
  )
  assert.deepEqual(
    await publishRestaurantTheme(context, { restaurantId: 'restaurant-a', templateId: 'default', theme: null }, adapter),
    err('Invalid theme document'),
  )
  assert.equal(called, false)
})
