import type { ThemeApplicationPort } from '@garsonless/application/themes'
import { normalizeRestaurantPlan } from '@garsonless/domain/entitlements'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'
import type { Json } from './types.gen'
import { canRestaurantUseFeature } from './feature-entitlement-port'
import {
  fingerprintSavedThemePublish,
  fingerprintThemeDraftSave,
  fingerprintThemePublish,
} from './theme-publish-fingerprint'

function message(prefix: string, error: { message: string } | null): string {
  return error?.message ? `${prefix}: ${error.message}` : prefix
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
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
        .select('tokens, revision, published_at')
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
      if (error) return err(message('Tema ayarları okunamadı', error))
      if (!data) return ok(null)
      const snapshot = data as { tokens: Json; revision: number; published_at: string }
      if (!isRevision(snapshot.revision) || !isTimestamp(snapshot.published_at)) {
        return err('Tema ayarları geçersiz')
      }
      return ok({
        tokens: snapshot.tokens,
        revision: snapshot.revision,
        publishedAt: snapshot.published_at,
      })
    },
    async readDraft({ restaurantId }) {
      const { data, error } = await createServiceClient()
        .from('theme_drafts')
        .select('tokens, template_id, revision, based_on_published_revision, updated_at')
        .eq('restaurant_id', restaurantId)
        .maybeSingle()
      if (error) return err(message('Tema taslağı okunamadı', error))
      if (!data) return ok(null)
      const snapshot = data as {
        tokens: Json
        template_id: string
        revision: number
        based_on_published_revision: number
        updated_at: string
      }
      if (
        !isRevision(snapshot.revision) || snapshot.revision === 0
        || !isRevision(snapshot.based_on_published_revision)
        || !isTimestamp(snapshot.updated_at)
      ) return err('Tema taslağı geçersiz')
      return ok({
        tokens: snapshot.tokens,
        templateId: snapshot.template_id,
        revision: snapshot.revision,
        basedOnPublishedRevision: snapshot.based_on_published_revision,
        savedAt: snapshot.updated_at,
      })
    },
    async readFeatureAccess(input) {
      return ok(await canRestaurantUseFeature(input))
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
          p_expected_revision: number
          p_request_id: string
          p_request_fingerprint: string
        },
      ) => Promise<{ data: Json | null; error: { message: string } | null }>
      const tokens = {
        ...(input.theme as unknown as Record<string, unknown>),
        __template_id: input.templateId,
      } as Json
      const requestFingerprint = fingerprintThemePublish({
        restaurantId: input.restaurantId,
        templateId: input.templateId,
        tokens,
        publishedBy: input.publishedBy,
        expectedRevision: input.expectedRevision,
      })
      const { data, error } = await rpc('publish_theme_config_atomic', {
        p_restaurant_id: input.restaurantId,
        p_template_id: input.templateId,
        p_tokens: tokens,
        p_published_by: input.publishedBy,
        p_expected_revision: input.expectedRevision,
        p_request_id: input.requestId,
        p_request_fingerprint: requestFingerprint,
      })
      if (error) {
        if (error.message.includes('theme_publish_idempotency_conflict')) {
          return err('Theme request conflicts with an earlier attempt')
        }
        return err('Theme could not be published')
      }
      if (!isRecord(data)) return err('Theme publish response is invalid')
      const status = data['status']
      if (status === 'conflict') {
        const snapshot = data['snapshot']
        if (
          !isRecord(snapshot)
          || typeof snapshot['templateId'] !== 'string'
          || !isRevision(snapshot['revision'])
          || (snapshot['publishedAt'] !== null && !isTimestamp(snapshot['publishedAt']))
          || !isRecord(snapshot['tokens'])
        ) return err('Theme publish response is invalid')
        return ok({
          status,
          snapshot: {
            tokens: snapshot['tokens'],
            templateId: snapshot['templateId'],
            revision: snapshot['revision'],
            publishedAt: snapshot['publishedAt'] as string | null,
          },
        })
      }
      if (
        (status !== 'published' && status !== 'replayed')
        || typeof data['slug'] !== 'string'
        || !isRevision(data['revision'])
        || !isTimestamp(data['publishedAt'])
      ) return err('Theme publish response is invalid')
      return ok({
        status,
        slug: data['slug'],
        revision: data['revision'],
        publishedAt: data['publishedAt'],
      })
    },
    async saveDraft(input) {
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        name: 'save_theme_draft_atomic',
        args: {
          p_restaurant_id: string
          p_template_id: string
          p_tokens: Json
          p_saved_by: string
          p_expected_revision: number
          p_request_id: string
          p_request_fingerprint: string
        },
      ) => Promise<{ data: Json | null; error: { message: string } | null }>
      const tokens = {
        ...(input.theme as unknown as Record<string, unknown>),
        __template_id: input.templateId,
      } as Json
      const requestFingerprint = fingerprintThemeDraftSave({
        restaurantId: input.restaurantId,
        templateId: input.templateId,
        tokens,
        savedBy: input.savedBy,
        expectedRevision: input.expectedRevision,
      })
      const { data, error } = await rpc('save_theme_draft_atomic', {
        p_restaurant_id: input.restaurantId,
        p_template_id: input.templateId,
        p_tokens: tokens,
        p_saved_by: input.savedBy,
        p_expected_revision: input.expectedRevision,
        p_request_id: input.requestId,
        p_request_fingerprint: requestFingerprint,
      })
      if (error) {
        if (error.message.includes('theme_draft_idempotency_conflict')) {
          return err('Theme draft request conflicts with an earlier attempt')
        }
        return err('Theme draft could not be saved')
      }
      if (!isRecord(data)) return err('Theme draft response is invalid')
      if (data['status'] === 'conflict') {
        const snapshot = data['snapshot']
        if (snapshot === null) return ok({ status: 'conflict', snapshot: null })
        if (
          !isRecord(snapshot)
          || typeof snapshot['templateId'] !== 'string'
          || !isRecord(snapshot['tokens'])
          || !isRevision(snapshot['revision'])
          || !isRevision(snapshot['basedOnPublishedRevision'])
          || !isTimestamp(snapshot['savedAt'])
        ) return err('Theme draft response is invalid')
        return ok({
          status: 'conflict',
          snapshot: {
            tokens: snapshot['tokens'],
            templateId: snapshot['templateId'],
            revision: snapshot['revision'],
            basedOnPublishedRevision: snapshot['basedOnPublishedRevision'],
            savedAt: snapshot['savedAt'],
          },
        })
      }
      if (
        (data['status'] !== 'saved' && data['status'] !== 'replayed')
        || !isRevision(data['revision']) || data['revision'] === 0
        || !isRevision(data['basedOnPublishedRevision'])
        || !isTimestamp(data['savedAt'])
        || typeof data['hasUnpublishedChanges'] !== 'boolean'
      ) return err('Theme draft response is invalid')
      return ok({
        status: data['status'],
        revision: data['revision'],
        basedOnPublishedRevision: data['basedOnPublishedRevision'],
        savedAt: data['savedAt'],
        hasUnpublishedChanges: data['hasUnpublishedChanges'],
      })
    },
    async publishSavedDraft(input) {
      const service = createServiceClient()
      const rpc = service.rpc.bind(service) as unknown as (
        name: 'publish_saved_theme_draft_atomic',
        args: {
          p_restaurant_id: string
          p_published_by: string
          p_expected_draft_revision: number
          p_expected_published_revision: number
          p_request_id: string
          p_request_fingerprint: string
        },
      ) => Promise<{ data: Json | null; error: { message: string } | null }>
      const requestFingerprint = fingerprintSavedThemePublish(input)
      const { data, error } = await rpc('publish_saved_theme_draft_atomic', {
        p_restaurant_id: input.restaurantId,
        p_published_by: input.publishedBy,
        p_expected_draft_revision: input.expectedDraftRevision,
        p_expected_published_revision: input.expectedPublishedRevision,
        p_request_id: input.requestId,
        p_request_fingerprint: requestFingerprint,
      })
      if (error) {
        if (error.message.includes('theme_publish_idempotency_conflict')) {
          return err('Theme request conflicts with an earlier attempt')
        }
        return err('Theme could not be published')
      }
      if (!isRecord(data)) return err('Theme publish response is invalid')
      const status = data['status']
      if (status === 'draft_conflict') {
        const snapshot = data['snapshot']
        if (
          !isRecord(snapshot) || typeof snapshot['templateId'] !== 'string'
          || !isRecord(snapshot['tokens']) || !isRevision(snapshot['revision'])
          || !isRevision(snapshot['basedOnPublishedRevision'])
          || !isTimestamp(snapshot['savedAt'])
        ) return err('Theme publish response is invalid')
        return ok({ status, snapshot: {
          tokens: snapshot['tokens'], templateId: snapshot['templateId'],
          revision: snapshot['revision'], basedOnPublishedRevision: snapshot['basedOnPublishedRevision'],
          savedAt: snapshot['savedAt'],
        } })
      }
      if (status === 'conflict') {
        const snapshot = data['snapshot']
        if (
          !isRecord(snapshot) || typeof snapshot['templateId'] !== 'string'
          || !isRecord(snapshot['tokens']) || !isRevision(snapshot['revision'])
          || (snapshot['publishedAt'] !== null && !isTimestamp(snapshot['publishedAt']))
        ) return err('Theme publish response is invalid')
        return ok({ status, snapshot: {
          tokens: snapshot['tokens'], templateId: snapshot['templateId'],
          revision: snapshot['revision'], publishedAt: snapshot['publishedAt'] as string | null,
        } })
      }
      if (
        (status !== 'published' && status !== 'replayed')
        || typeof data['slug'] !== 'string' || !isRevision(data['revision'])
        || !isTimestamp(data['publishedAt'])
      ) return err('Theme publish response is invalid')
      return ok({ status, slug: data['slug'], revision: data['revision'], publishedAt: data['publishedAt'] })
    },
  }
}
