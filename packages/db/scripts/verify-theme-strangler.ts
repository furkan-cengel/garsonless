import { randomUUID } from 'node:crypto'
import {
  publishRestaurantTheme,
  readPublishedTheme,
} from '@garsonless/application/themes'
import { TEMPLATES } from '@garsonless/design-engine'
import { createClient, createServiceClient } from '../src/client'
import { createThemeApplicationPort } from '../src/theme-application-port'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const service = createServiceClient()
const anon = createClient()
const suffix = randomUUID().slice(0, 8)
let restaurantId = ''

async function main() {
  try {
    const { data: fixture, error: fixtureError } = await service
      .from('restaurants')
      .select('owner_id')
      .eq('slug', 'test-cafe-b')
      .single()
    if (fixtureError || !fixture?.owner_id) throw fixtureError ?? new Error('Fixture owner unavailable')

    const { data: restaurant, error: restaurantError } = await service
      .from('restaurants')
      .insert({
        owner_id: fixture.owner_id,
        slug: `theme-strangler-${suffix}`,
        name: `Theme strangler ${suffix}`,
        settings: { active_template_id: 'default', runtime_marker: 'preserve-me' },
      })
      .select('id')
      .single()
    if (restaurantError) throw restaurantError
    restaurantId = restaurant.id

    const context = {
      actor: 'dashboard-member' as const,
      userId: fixture.owner_id,
      restaurantId,
      permissions: ['theme'],
    }
    const port = createThemeApplicationPort()
    const unsafeTheme = {
      ...TEMPLATES['obsidian'],
      accent: '#abcdef',
      bg: '#fff;}</style><script>alert(1)</script>',
      bodyFont: 'Inter; background:url(javascript:alert(1))',
      runtime_unknown: 'drop-me',
    }

    const first = await publishRestaurantTheme(context, {
      restaurantId,
      templateId: 'obsidian',
      theme: unsafeTheme,
    }, port)
    assert(first.ok, first.ok ? '' : first.error)

    const { data: firstConfig, error: firstConfigError } = await service
      .from('theme_configs')
      .select('id, tokens, updated_by')
      .eq('restaurant_id', restaurantId)
      .single()
    if (firstConfigError) throw firstConfigError

    const retry = await publishRestaurantTheme(context, {
      restaurantId,
      templateId: 'obsidian',
      theme: unsafeTheme,
    }, port)
    assert(retry.ok, retry.ok ? '' : retry.error)

    const [{ data: persisted, error: persistedError }, { count: configCount }] = await Promise.all([
      service
        .from('restaurants')
        .select('slug, settings')
        .eq('id', restaurantId)
        .single(),
      service
        .from('theme_configs')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId),
    ])
    if (persistedError) throw persistedError
    const settings = persisted.settings as Record<string, unknown>
    const tokens = firstConfig.tokens as Record<string, unknown>
    assert(settings['active_template_id'] === 'obsidian', 'Active template did not publish')
    assert(settings['runtime_marker'] === 'preserve-me', 'Unrelated restaurant settings were overwritten')
    assert(configCount === 1, 'Retry created a duplicate theme config')
    assert(tokens['__template_id'] === 'obsidian', 'Template ownership marker is missing')
    assert(tokens['accent'] === '#abcdef', 'Valid theme override did not persist')
    assert(tokens['bg'] === TEMPLATES['obsidian']?.bg, 'Unsafe CSS color was persisted')
    assert(tokens['bodyFont'] === TEMPLATES['obsidian']?.bodyFont, 'Unsafe font was persisted')
    assert(!('runtime_unknown' in tokens), 'Unknown theme token was persisted')
    assert(firstConfig.updated_by === fixture.owner_id, 'Publisher audit identity mismatch')

    const publicRead = await readPublishedTheme({ restaurantId }, port)
    assert(publicRead.ok, publicRead.ok ? '' : publicRead.error)
    assert(publicRead.value.templateId === 'obsidian', 'Public resolver selected the wrong template')
    assert(publicRead.value.theme.accent === '#abcdef', 'Public resolver did not read published tokens')

    const crossTenant = await publishRestaurantTheme({ ...context, restaurantId: randomUUID() }, {
      restaurantId,
      templateId: 'default',
      theme: TEMPLATES['default'],
    }, port)
    assert(!crossTenant.ok && crossTenant.error === 'Not authorized', 'Cross-tenant publish was not rejected')

    const missingRestaurantId = randomUUID()
    const failedAtomic = await port.publish({
      restaurantId: missingRestaurantId,
      templateId: 'default',
      theme: TEMPLATES['default']!,
      publishedBy: fixture.owner_id,
    })
    const { count: missingConfigCount } = await service
      .from('theme_configs')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', missingRestaurantId)
    assert(!failedAtomic.ok, 'Missing restaurant publish unexpectedly succeeded')
    assert(missingConfigCount === 0, 'Failed atomic publish left a theme config behind')

    const anonPublish = await anon.rpc('publish_theme_config_atomic', {
      p_restaurant_id: restaurantId,
      p_template_id: 'default',
      p_tokens: { ...TEMPLATES['default'], __template_id: 'default' },
      p_published_by: fixture.owner_id,
    })
    assert(anonPublish.error?.code === '42501', `Anon RPC was not denied: ${anonPublish.error?.code ?? 'none'}`)

    console.log(JSON.stringify({
      restaurantId,
      publish: {
        templateId: settings['active_template_id'],
        unrelatedSettingPreserved: settings['runtime_marker'],
        accent: tokens['accent'],
        sanitizedBg: tokens['bg'],
        sanitizedFont: tokens['bodyFont'],
        publisher: firstConfig.updated_by,
      },
      retry: { configCount, sameConfigId: firstConfig.id },
      publicRead: { templateId: publicRead.value.templateId, accent: publicRead.value.theme.accent },
      crossTenantRejected: !crossTenant.ok,
      atomicFailure: { rejected: !failedAtomic.ok, orphanConfigs: missingConfigCount },
      anonRpcCode: anonPublish.error?.code,
    }, null, 2))
  } finally {
    if (restaurantId) await service.from('restaurants').delete().eq('id', restaurantId)
    const [{ count: restaurantCount }, { count: configCount }] = await Promise.all([
      service.from('restaurants').select('id', { count: 'exact', head: true }).eq('id', restaurantId || randomUUID()),
      service.from('theme_configs').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurantId || randomUUID()),
    ])
    console.log(JSON.stringify({ cleanup: { restaurantOrphans: restaurantCount, themeConfigOrphans: configCount } }))
  }
}

void main()
