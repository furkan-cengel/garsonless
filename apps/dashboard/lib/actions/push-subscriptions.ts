'use server'

import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { z } from 'zod'
import {
  canRestaurantUseFeature,
  deleteDashboardPushEndpoint,
  readDashboardPushSubscriptionForUser,
  upsertDashboardPushSubscription,
} from '@garsonless/db/server'
import { assertMember } from '../auth/access'
import { dashboardAccessFailure, dashboardActionFailure, type DashboardActionFailure } from '../server-action-error'
import { createDashboardServerClient } from '../supabase-server'
import { createWebPushProvider } from '../web-push-provider'

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2_048).refine((value) => value.startsWith('https://'), 'Geçersiz bildirim adresi'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(32).max(512),
    auth: z.string().min(8).max(256),
  }),
})

const endpointSchema = z.string().url().max(2_048).refine((value) => value.startsWith('https://'))

type PushActionResult = { success: true } | DashboardActionFailure

function endpointHash(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex')
}

async function authorizedPushContext(restaurantId: string) {
  const gate = await assertMember(restaurantId)
  if ('error' in gate) {
    return { ok: false as const, failure: dashboardAccessFailure(gate.error, 'notifications.push.authorize') }
  }

  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.id !== gate.userId) {
    return { ok: false as const, failure: dashboardAccessFailure('Not authenticated', 'notifications.push.authorize') }
  }

  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('plan')
    .eq('id', restaurantId)
    .maybeSingle()

  if (error) {
    return { ok: false as const,
      failure: dashboardActionFailure('SERVICE_UNAVAILABLE', {
        operation: 'notifications.push.authorize',
        message: 'Bildirim aboneliği şu anda doğrulanamıyor. Lütfen tekrar deneyin.',
        cause: error,
      }),
    }
  }
  if (!restaurant) {
    return { ok: false as const, failure: dashboardAccessFailure('Not authorized', 'notifications.push.authorize') }
  }
  const plan = (restaurant as unknown as { plan: unknown }).plan
  if (!await canRestaurantUseFeature({ restaurantId, plan, feature: 'browser_notifications' })) {
    return { ok: false as const,
      failure: dashboardActionFailure('PLAN_REQUIRED', {
        operation: 'notifications.push.authorize',
        message: 'Masaüstü bildirimleri Pro paketiyle kullanılabilir.',
      }),
    }
  }

  return { ok: true as const, user }
}

/** Persist or reactivate the current browser's tenant-scoped push endpoint. */
export async function subscribeDashboardPush(
  restaurantId: string,
  input: unknown,
): Promise<PushActionResult> {
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) {
    return dashboardActionFailure('VALIDATION_FAILED', {
      operation: 'notifications.push.subscribe',
      message: 'Tarayıcı bildirim aboneliği geçersiz. Sayfayı yenileyip tekrar deneyin.',
    })
  }

  const context = await authorizedPushContext(restaurantId)
  if (!context.ok) return context.failure

  const requestHeaders = await headers()
  const persisted = await upsertDashboardPushSubscription({
    restaurantId,
    userId: context.user.id,
    endpoint: parsed.data.endpoint,
    endpointHash: endpointHash(parsed.data.endpoint),
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: requestHeaders.get('user-agent')?.slice(0, 512) ?? null,
  })

  if (!persisted.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.push.subscribe',
      message: 'Bildirim aboneliği kaydedilemedi. Lütfen tekrar deneyin.',
      cause: persisted.error,
    })
  }
  return { success: true }
}

/** Remove only the caller's matching endpoint; RLS prevents cross-user replay. */
export async function unsubscribeDashboardPush(
  restaurantId: string,
  endpoint: unknown,
): Promise<PushActionResult> {
  const parsed = endpointSchema.safeParse(endpoint)
  if (!parsed.success) {
    return dashboardActionFailure('VALIDATION_FAILED', {
      operation: 'notifications.push.unsubscribe',
      message: 'Tarayıcı bildirim aboneliği geçersiz.',
    })
  }

  const context = await authorizedPushContext(restaurantId)
  if (!context.ok) return context.failure

  const deleted = await deleteDashboardPushEndpoint({
    userId: context.user.id,
    endpointHash: endpointHash(parsed.data),
  })

  if (!deleted.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.push.unsubscribe',
      message: 'Bildirim aboneliği kaldırılamadı. Lütfen tekrar deneyin.',
      cause: deleted.error,
    })
  }
  return { success: true }
}

export async function testDashboardPush(restaurantId: string): Promise<PushActionResult> {
  const context = await authorizedPushContext(restaurantId)
  if (!context.ok) return context.failure
  const subscription = await readDashboardPushSubscriptionForUser({ restaurantId, userId: context.user.id })
  if (!subscription.ok || !subscription.value) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.push.test',
      message: 'Bu cihaz için etkin bir bildirim aboneliği bulunamadı.',
      cause: subscription.ok ? null : subscription.error,
    })
  }
  try {
    const result = await createWebPushProvider().send({
      subscription: subscription.value,
      topic: `test-${Date.now()}`.slice(0, 32),
      payload: {
        title: 'Masabu test bildirimi',
        body: 'Bu cihaz yeni sipariş bildirimlerini alabiliyor.',
        icon: '/icon.svg',
        badge: '/icon.svg',
        tag: `test:${context.user.id}`,
        data: { eventId: crypto.randomUUID(), url: `/dashboard/${restaurantId}/settings?section=notifications` },
      },
    })
    if (result.outcome === 'sent') return { success: true }
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.push.test',
      message: result.outcome === 'gone'
        ? 'Cihaz aboneliği geçersiz olmuş. Cihazı kapatıp yeniden etkinleştirin.'
        : 'Test bildirimi gönderilemedi. Lütfen tekrar deneyin.',
      cause: result.error,
    })
  } catch (cause) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'notifications.push.test',
      message: 'Web Push bu ortamda yapılandırılmamış veya kullanılamıyor.',
      cause,
    })
  }
}
