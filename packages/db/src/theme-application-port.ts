import type { ThemeApplicationPort } from '@garsonless/application/themes'
import { normalizeRestaurantPlan } from '@garsonless/domain/entitlements'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'
import type { Json } from './types.gen'

function message(prefix: string, error: { message: string } | null): string {
  return error?.message ? `${prefix}: ${error.message}` : prefix
}

export function createThemeApplicationPort(): ThemeApplicationPort {
  return {
    async readRestaurant({ restaurantId }) {
      const { data, error } = await createServiceClient()
        .from('restaurants')
        .select('slug, name, logo_url, settings, plan')
        .eq('id', restaurantId)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) return err(message('Tema işletmesi okunamadı', error))
      if (!data) return ok(null)
      return ok({
        slug: (data as { slug: string }).slug,
        name: (data as { name: string }).name,
        logoUrl: (data as { logo_url: string | null }).logo_url,
        settings: ((data as { settings: Json | null }).settings ?? null) as Record<string, unknown> | null,
        plan: normalizeRestaurantPlan((data as { plan: unknown }).plan),
      })
    },
    async readConfig({ restaurantId }) {
      const { data, error } = await createServiceClient()
        .from('theme_configs')
        .select('tokens')
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
      if (error) return err(message('Tema ayarları okunamadı', error))
      return ok((data as { tokens: Json } | null)?.tokens ?? null)
    },
    async publish(input) {
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        name: 'publish_theme_config_atomic',
        args: {
          p_restaurant_id: string
          p_template_id: string
          p_tokens: Json
          p_published_by: string
        },
      ) => Promise<{ data: string | null; error: { message: string } | null }>
      const tokens = {
        ...(input.theme as unknown as Record<string, unknown>),
        __template_id: input.templateId,
      } as Json
      const { data, error } = await rpc('publish_theme_config_atomic', {
        p_restaurant_id: input.restaurantId,
        p_template_id: input.templateId,
        p_tokens: tokens,
        p_published_by: input.publishedBy,
      })
      if (error || !data) return err(message('Tema yayınlanamadı', error))
      return ok({ slug: data })
    },
  }
}
