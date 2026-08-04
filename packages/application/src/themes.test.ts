import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME, TEMPLATES } from '@garsonless/design-engine'
import { err, ok } from '@garsonless/domain'
import {
  publishRestaurantTheme,
  publishSavedRestaurantTheme,
  readPublishedTheme,
  readThemeForEditor,
  saveRestaurantThemeDraft,
  type ThemeApplicationPort,
} from './themes'

const context = {
  actor: 'dashboard-member' as const,
  userId: 'user-a',
  restaurantId: 'restaurant-a',
  permissions: ['theme'],
}

const request = {
  expectedRevision: 3,
  requestId: '11111111-1111-4111-8111-111111111111',
}

function port(): ThemeApplicationPort {
  return {
    readRestaurant: async () => ok({ slug: 'cafe-a', name: 'Cafe A', logoUrl: null, settings: { active_template_id: 'default' }, plan: 'pro' }),
    readConfig: async () => ok({
      tokens: { ...DEFAULT_THEME, accent: '#123456', __template_id: 'default' },
      revision: 3,
      publishedAt: '2026-08-01T10:00:00.000Z',
    }),
    readDraft: async () => ok(null),
    readFeatureAccess: async () => ok(true),
    publish: async ({ restaurantId }) => ok({
      status: 'published',
      slug: restaurantId,
      revision: 4,
      publishedAt: '2026-08-01T10:01:00.000Z',
    }),
    saveDraft: async () => ok({
      status: 'saved',
      revision: 1,
      basedOnPublishedRevision: 3,
      savedAt: '2026-08-01T10:00:30.000Z',
      hasUnpublishedChanges: true,
    }),
    publishSavedDraft: async ({ restaurantId }) => ok({
      status: 'published',
      slug: restaurantId,
      revision: 4,
      publishedAt: '2026-08-01T10:01:00.000Z',
    }),
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

test('editor and public reads resolve legacy template ids onto the canonical menu without losing tokens', async () => {
  const adapter = port()
  const editor = await readThemeForEditor(context, { restaurantId: 'restaurant-a', templateId: 'default' }, adapter)
  const publicRead = await readPublishedTheme({ restaurantId: 'restaurant-a' }, adapter)
  assert.equal(editor.ok && editor.value.theme.accent, '#123456')
  assert.equal(editor.ok && editor.value.revision, 3)
  assert.equal(editor.ok && editor.value.publishedAt, '2026-08-01T10:00:00.000Z')
  assert.equal(publicRead.ok && publicRead.value.theme.accent, '#123456')

  adapter.readRestaurant = async () => ok({ slug: 'cafe-a', name: 'Cafe A', logoUrl: null, settings: { active_template_id: 'obsidian' }, plan: 'pro' })
  const otherTemplate = await readPublishedTheme({ restaurantId: 'restaurant-a' }, adapter)
  assert.equal(otherTemplate.ok && otherTemplate.value.templateId, 'default')
  assert.equal(otherTemplate.ok && otherTemplate.value.theme.accent, '#123456')
  assert.deepEqual(
    await readThemeForEditor(context, { restaurantId: 'restaurant-a', templateId: 'spain' }, adapter),
    err('Unknown theme template'),
  )
})

test('an unpublished restaurant starts from revision zero and canonical defaults', async () => {
  const adapter = port()
  adapter.readConfig = async () => ok(null)
  const result = await readThemeForEditor(
    context,
    { restaurantId: 'restaurant-a', templateId: 'default' },
    adapter,
  )
  assert.equal(result.ok && result.value.revision, 0)
  assert.equal(result.ok && result.value.publishedAt, null)
  assert.equal(result.ok && result.value.theme.accent, TEMPLATES.default?.accent)
})

test('editor loads a private draft without changing the public theme snapshot', async () => {
  const adapter = port()
  adapter.readDraft = async () => ok({
    tokens: { ...DEFAULT_THEME, accent: '#abcdef', __template_id: 'default' },
    templateId: 'default',
    revision: 7,
    basedOnPublishedRevision: 3,
    savedAt: '2026-08-01T10:03:00.000Z',
  })
  const editor = await readThemeForEditor(context, {
    restaurantId: 'restaurant-a', templateId: 'default',
  }, adapter)
  const publicRead = await readPublishedTheme({ restaurantId: 'restaurant-a' }, adapter)
  assert.equal(editor.ok && editor.value.theme.accent, '#abcdef')
  assert.equal(editor.ok && editor.value.draftRevision, 7)
  assert.equal(editor.ok && editor.value.publishedRevision, 3)
  assert.equal(editor.ok && editor.value.hasUnpublishedChanges, true)
  assert.equal(publicRead.ok && publicRead.value.theme.accent, '#123456')
})

test('draft save derives actor identity and publish forwards only persisted revision coordinates', async () => {
  const adapter = port()
  let savedBy = ''
  let publishedBy = ''
  adapter.saveDraft = async (input) => {
    savedBy = input.savedBy
    return ok({
      status: 'saved', revision: 4, basedOnPublishedRevision: 3,
      savedAt: '2026-08-01T10:04:00.000Z', hasUnpublishedChanges: true,
    })
  }
  adapter.publishSavedDraft = async (input) => {
    publishedBy = input.publishedBy
    assert.equal(input.expectedDraftRevision, 4)
    assert.equal(input.expectedPublishedRevision, 3)
    return ok({ status: 'published', slug: 'cafe-a', revision: 4, publishedAt: '2026-08-01T10:05:00.000Z' })
  }
  const saved = await saveRestaurantThemeDraft(context, {
    restaurantId: 'restaurant-a', templateId: 'default', theme: DEFAULT_THEME,
    expectedRevision: 3, requestId: request.requestId,
  }, adapter)
  const published = await publishSavedRestaurantTheme(context, {
    restaurantId: 'restaurant-a', expectedDraftRevision: 4,
    expectedPublishedRevision: 3, requestId: request.requestId,
  }, adapter)
  assert.equal(saved.ok, true)
  assert.equal(published.ok, true)
  assert.equal(savedBy, 'user-a')
  assert.equal(publishedBy, 'user-a')
})

test('publish sanitizes CSS-shaped values and derives audit identity from actor', async () => {
  const adapter = port()
  let publishedBy = ''
  let publishedTheme = DEFAULT_THEME
  adapter.publish = async (input) => {
    publishedBy = input.publishedBy
    publishedTheme = input.theme
    return ok({ status: 'published', slug: 'cafe-a', revision: 4, publishedAt: '2026-08-01T10:01:00.000Z' })
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
    ...request,
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
  adapter.publish = async () => {
    called = true
    return ok({ status: 'published', slug: 'cafe-a', revision: 4, publishedAt: '2026-08-01T10:01:00.000Z' })
  }
  assert.deepEqual(
    await publishRestaurantTheme(context, { restaurantId: 'restaurant-a', templateId: 'missing', theme: DEFAULT_THEME, ...request }, adapter),
    err('Unknown theme template'),
  )
  assert.deepEqual(
    await publishRestaurantTheme(context, { restaurantId: 'restaurant-a', templateId: 'spain', theme: DEFAULT_THEME, ...request }, adapter),
    err('Unknown theme template'),
  )
  assert.deepEqual(
    await publishRestaurantTheme(context, { restaurantId: 'restaurant-a', templateId: 'default', theme: null, ...request }, adapter),
    err('Invalid theme document'),
  )
  assert.equal(called, false)
})

test('publish rejects malformed revision and request id before persistence', async () => {
  const adapter = port()
  let called = false
  adapter.publish = async () => {
    called = true
    return ok({ status: 'published', slug: 'cafe-a', revision: 4, publishedAt: '2026-08-01T10:01:00.000Z' })
  }
  assert.deepEqual(
    await publishRestaurantTheme(context, {
      restaurantId: 'restaurant-a', templateId: 'default', theme: DEFAULT_THEME,
      expectedRevision: -1, requestId: request.requestId,
    }, adapter),
    err('Invalid theme publish request'),
  )
  assert.deepEqual(
    await publishRestaurantTheme(context, {
      restaurantId: 'restaurant-a', templateId: 'default', theme: DEFAULT_THEME,
      expectedRevision: 3, requestId: 'retry-me',
    }, adapter),
    err('Invalid theme publish request'),
  )
  assert.equal(called, false)
})

test('publish forwards the canonical revision and request id and preserves conflict snapshots', async () => {
  const adapter = port()
  const persisted: Parameters<ThemeApplicationPort['publish']>[0][] = []
  adapter.publish = async (input) => {
    persisted.push(input)
    return ok({
      status: 'conflict',
      snapshot: {
        tokens: { ...DEFAULT_THEME, accent: '#654321' },
        templateId: 'default',
        revision: 4,
        publishedAt: '2026-08-01T10:02:00.000Z',
      },
    })
  }
  const result = await publishRestaurantTheme(context, {
    restaurantId: 'restaurant-a', templateId: 'default', theme: DEFAULT_THEME, ...request,
  }, adapter)
  assert.equal(persisted[0]?.expectedRevision, 3)
  assert.equal(persisted[0]?.requestId, request.requestId)
  assert.equal(persisted[0]?.publishedBy, 'user-a')
  assert.equal(result.ok && result.value.status, 'conflict')
  assert.equal(result.ok && result.value.status === 'conflict' && result.value.snapshot.revision, 4)
})

test('publish enforces the advanced theme section entitlement on the server', async () => {
  const adapter = port()
  let published = false
  adapter.readRestaurant = async () => ok({
    slug: 'cafe-a',
    name: 'Cafe A',
    logoUrl: null,
    settings: null,
    plan: 'starter',
  })
  adapter.publish = async () => {
    published = true
    return ok({ status: 'published', slug: 'cafe-a', revision: 4, publishedAt: '2026-08-01T10:01:00.000Z' })
  }
  adapter.readFeatureAccess = async () => ok(false)

  const result = await publishRestaurantTheme(context, {
    restaurantId: 'restaurant-a',
    templateId: 'default',
    theme: {
      ...DEFAULT_THEME,
      pageBlocks: [{ type: 'section', id: 'request-buttons' }],
    },
    ...request,
  }, adapter)

  assert.deepEqual(result, err('Plan feature unavailable'))
  assert.equal(published, false)
})

test('home Pro bölümlerini istemci bayrağına güvenmeden sunucuda engeller', async () => {
  const adapter = port()
  let saved = false
  adapter.readRestaurant = async () => ok({ slug: 'cafe-a', name: 'Cafe A', logoUrl: null, settings: null, plan: 'starter' })
  adapter.readFeatureAccess = async () => ok(false)
  adapter.saveDraft = async () => {
    saved = true
    return ok({ status: 'saved', revision: 4, basedOnPublishedRevision: 3, savedAt: '2026-08-01T10:05:00.000Z', hasUnpublishedChanges: true })
  }
  const home = DEFAULT_THEME.surfaces!.home
  const result = await saveRestaurantThemeDraft(context, {
    restaurantId: 'restaurant-a',
    templateId: 'default',
    theme: {
      ...DEFAULT_THEME,
      surfaces: {
        ...DEFAULT_THEME.surfaces!,
        home: { ...home, sections: [...home.sections, { id: 'home-video', type: 'hero-video', enabled: true }] },
      },
    },
    expectedRevision: 3,
    requestId: request.requestId,
  }, adapter)
  assert.deepEqual(result, err('Plan feature unavailable'))
  assert.equal(saved, false)
})

test('hero video ile zorunlu poster birlikte değilse taslağı reddeder', async () => {
  const adapter = port()
  const home = DEFAULT_THEME.surfaces!.home
  const result = await saveRestaurantThemeDraft(context, {
    restaurantId: 'restaurant-a',
    templateId: 'default',
    theme: {
      ...DEFAULT_THEME,
      surfaces: {
        ...DEFAULT_THEME.surfaces!,
        home: { ...home, sections: [...home.sections, { id: 'home-video', type: 'hero-video', enabled: true, videoUrl: 'https://cdn.example.com/video.mp4' }] },
      },
    },
    expectedRevision: 3,
    requestId: request.requestId,
  }, adapter)
  assert.deepEqual(result, err('Invalid theme document'))
})
