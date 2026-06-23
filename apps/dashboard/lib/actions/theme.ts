'use server'

import { revalidatePath } from 'next/cache'
import { createDashboardServerClient } from '../supabase-server'
import { mut } from '../supabase-mut'
import { createServiceClient } from '@garsonless/db'
import { assertAccess } from '../auth/access'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import type { Json } from '@garsonless/db'

async function getAuthUser() {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function saveTheme(
  restaurantId: string,
  config: GarsonlessTheme,
  templateId = 'default',
): Promise<{ error: string } | { success: true }> {
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return { error: gate.error }
  const { supabase } = await getAuthUser()

  const { error } = await mut(supabase, 'theme_configs').upsert(
    {
      restaurant_id: restaurantId,
      tokens: { ...config, __template_id: templateId } as unknown as import('@garsonless/db').Json,
    },
    { onConflict: 'restaurant_id' },
  )

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/theme`)
  revalidatePath(`/dashboard/${restaurantId}/theme/${templateId}/edit`)
  return { success: true }
}

export async function saveActiveTemplate(
  restaurantId: string,
  templateId: string,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return { error: gate.error }
  const { supabase } = await getAuthUser()

  const { data: existing } = await supabase
    .from('restaurants')
    .select('settings, slug')
    .eq('id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!existing) return { error: 'Not found' }

  const prev = ((existing as { settings: Record<string, unknown> }).settings) ?? {}
  const updated: Json = { ...prev, active_template_id: templateId } as Json

  // active_template_id lives in restaurants (owner-only RLS); write via service
  // role so a 'theme' member can switch the active template. Only this key changes.
  const { error } = await createServiceClient()
    .from('restaurants')
    .update({ settings: updated })
    .eq('id', restaurantId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/${restaurantId}/theme`)
  const slug = (existing as { slug?: string | null }).slug
  if (slug) revalidatePath(`/${slug}`)
  return { success: true }
}
