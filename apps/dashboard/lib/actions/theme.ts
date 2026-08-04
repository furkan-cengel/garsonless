'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { inspectAuthSurfaceContrast, inspectCheckoutSurfaceContrast, sanitizeThemeTokens } from '@garsonless/design-engine'
import {
  publishSavedRestaurantTheme,
  saveRestaurantThemeDraft,
  type SavedThemePublishResult,
  type ThemeDraftSaveResult,
} from '@garsonless/application/themes'
import {
  createRestaurantAssetStoragePort,
  createThemeApplicationPort,
} from '@garsonless/db/server'
import { assertAccess } from '../auth/access'
import { createDashboardServerClient } from '../supabase-server'
import { sanitizeServerDiagnostic } from '../server-log-redaction'
import {
  isThemeMediaPurpose,
  parseOwnedThemeMediaPath,
  themeDocumentContainsMediaUrl,
  themeMediaStoragePrefix,
  validateThemeMediaMetadata,
} from '../theme-media-policy'
import { processThemeMedia } from '../theme-media-processor'
import { validateThemeVideo } from '../theme-video-policy'
import {
  dashboardAccessFailure,
  dashboardActionFailure,
  type DashboardActionFailure,
} from '../server-action-error'

function dashboardThemeFailure(error: string): DashboardActionFailure {
  if (error === 'Plan feature unavailable') {
    return dashboardActionFailure('PLAN_REQUIRED', { operation: 'theme.publish' })
  }
  if (error === 'Restaurant not found') {
    return dashboardActionFailure('RESOURCE_NOT_FOUND', { operation: 'theme.publish' })
  }
  if (
    error === 'Invalid theme document'
    || error === 'Invalid theme draft request'
    || error === 'Invalid theme draft response'
    || error === 'Invalid theme publish request'
    || error === 'Invalid theme publish response'
    || error === 'Unknown theme template'
  ) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.publish' })
  }
  if (
    error === 'Theme request conflicts with an earlier attempt'
    || error === 'Theme draft request conflicts with an earlier attempt'
  ) {
    return dashboardActionFailure('CONFLICT', { operation: 'theme.publish' })
  }
  return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'theme.publish' })
}

const publishThemeSchema = z.object({
  expectedDraftRevision: z.number().int().positive().safe(),
  expectedPublishedRevision: z.number().int().nonnegative().safe(),
  requestId: z.string().uuid(),
}).strict()

const saveThemeDraftSchema = z.object({
  templateId: z.string().min(1).max(64),
  theme: z.unknown(),
  expectedRevision: z.number().int().nonnegative().safe(),
  requestId: z.string().uuid(),
}).strict()

export interface PublishThemeInput {
  expectedDraftRevision: number
  expectedPublishedRevision: number
  requestId: string
}

export interface SaveThemeDraftInput {
  templateId: string
  theme: unknown
  expectedRevision: number
  requestId: string
}

export type ThemeMediaUploadResult =
  | { error: string }
  | { url: string; width: number; height: number; mime: 'image/webp' }

export type ThemeVideoUploadResult =
  | { error: string }
  | { url: string; durationSeconds: number; mime: 'video/mp4' | 'video/webm' }

async function canUseAdvancedThemeMedia(restaurantId: string): Promise<boolean> {
  const port = createThemeApplicationPort()
  const restaurant = await port.readRestaurant({ restaurantId })
  if (!restaurant.ok || !restaurant.value) return false
  const access = await port.readFeatureAccess({
    restaurantId,
    plan: restaurant.value.plan,
    feature: 'theme_advanced_sections',
  })
  return access.ok && access.value
}

function validateOwnedHomeVideoPairs(theme: unknown, restaurantId: string): boolean {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return true
  const surfaces = (theme as Record<string, unknown>)['surfaces']
  if (!surfaces || typeof surfaces !== 'object' || Array.isArray(surfaces)) return true
  const home = (surfaces as Record<string, unknown>)['home']
  if (!home || typeof home !== 'object' || Array.isArray(home)) return true
  const sections = (home as Record<string, unknown>)['sections']
  const blocks = (home as Record<string, unknown>)['blocks']
  const sectionSettings = (theme as Record<string, unknown>)['sectionSettings']
  const legacyVideoSections = Array.isArray(sections)
    ? sections.filter((section) => section && typeof section === 'object' && !Array.isArray(section) && (section as Record<string, unknown>)['type'] === 'hero-video')
    : []
  const v2VideoSettings = Array.isArray(blocks) && sectionSettings && typeof sectionSettings === 'object' && !Array.isArray(sectionSettings)
    ? blocks.flatMap((block) => {
        if (!block || typeof block !== 'object' || Array.isArray(block)) return []
        const record = block as Record<string, unknown>
        if (typeof record['id'] !== 'string') return []
        const isDedicatedVideoHero = record['sectionId'] === 'storefront-video-hero'
        const isLegacyVideoHero = record['sectionId'] === 'storefront-hero'
        const settings = (sectionSettings as Record<string, unknown>)[record['id']]
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return isDedicatedVideoHero ? [{}] : []
        if (!isDedicatedVideoHero && !(isLegacyVideoHero && (settings as Record<string, unknown>)['mediaType'] === 'video')) return []
        return [settings as Record<string, unknown>]
      })
    : []
  const videoEntries = [...legacyVideoSections, ...v2VideoSettings]
  const storageOrigin = process.env['NEXT_PUBLIC_SUPABASE_URL']
  if (!storageOrigin) return videoEntries.length === 0
  return videoEntries.every((section) => {
    const record = section as Record<string, unknown>
    const videoUrl = typeof record['videoUrl'] === 'string' ? record['videoUrl'] : ''
    const posterUrl = typeof record['posterUrl'] === 'string' ? record['posterUrl'] : ''
    if (!videoUrl && !posterUrl) return false
    if (!videoUrl || !posterUrl) return false
    const videoPath = parseOwnedThemeMediaPath({ publicUrl: videoUrl, restaurantId, storageOrigin })
    const posterPath = parseOwnedThemeMediaPath({ publicUrl: posterUrl, restaurantId, storageOrigin })
    return videoPath?.includes('/home-hero-video/') === true && posterPath?.includes('/home-hero-poster/') === true
  })
}

function usesAdvancedHomeSections(theme: unknown): boolean {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return false
  const surfaces = (theme as Record<string, unknown>)['surfaces']
  if (!surfaces || typeof surfaces !== 'object' || Array.isArray(surfaces)) return false
  const home = (surfaces as Record<string, unknown>)['home']
  if (!home || typeof home !== 'object' || Array.isArray(home)) return false
  const sections = (home as Record<string, unknown>)['sections']
  if (Array.isArray(sections) && sections.some((section) => section && typeof section === 'object' && !Array.isArray(section) && ['hero-video', 'gallery', 'promo-slider'].includes(String((section as Record<string, unknown>)['type'])))) return true
  const blocks = (home as Record<string, unknown>)['blocks']
  if (!Array.isArray(blocks)) return false
  const settings = (theme as Record<string, unknown>)['sectionSettings']
  const advancedSectionIds = new Set([
    'storefront-video-hero',
    'featured-scroll',
    'chef-pick',
    'combo-ribbon',
    'discount-badge',
    'promo-slider',
    'gallery',
  ])
  return blocks.some((block) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return false
    const record = block as Record<string, unknown>
    if (advancedSectionIds.has(String(record['sectionId']))) return true
    if (record['sectionId'] !== 'storefront-hero' || typeof record['id'] !== 'string' || !settings || typeof settings !== 'object' || Array.isArray(settings)) return false
    const heroSettings = (settings as Record<string, unknown>)[record['id']]
    return Boolean(heroSettings && typeof heroSettings === 'object' && !Array.isArray(heroSettings) && (heroSettings as Record<string, unknown>)['mediaType'] === 'video')
  })
}

function collectThemeMediaUrls(value: unknown, result = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.includes('/storage/v1/object/public/restaurant-assets/')) result.add(value)
    return result
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectThemeMediaUrls(entry, result))
    return result
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) => collectThemeMediaUrls(entry, result))
  }
  return result
}

export async function uploadThemeMedia(formData: FormData): Promise<ThemeMediaUploadResult> {
  const restaurantId = String(formData.get('restaurantId') ?? '')
  const purposeValue = String(formData.get('purpose') ?? '')
  if (!z.string().uuid().safeParse(restaurantId).success || !isThemeMediaPurpose(purposeValue)) {
    return { error: 'Geçersiz Tema medya hedefi.' }
  }

  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return { error: 'Tema medyası yüklemek için yetkiniz yok.' }
  if (purposeValue === 'home-hero-poster' && !await canUseAdvancedThemeMedia(restaurantId)) {
    return { error: 'Hero video posteri Pro pakette kullanılabilir.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Görsel dosyası bulunamadı.' }
  const metadata = validateThemeMediaMetadata({
    size: file.size,
    type: file.type,
    purpose: purposeValue,
  })
  if (!metadata.ok) return { error: metadata.error }

  const processed = await processThemeMedia({
    bytes: new Uint8Array(await file.arrayBuffer()),
    claimedType: file.type,
    purpose: purposeValue,
  })
  if (!processed.ok) return { error: processed.error }

  const path = `${themeMediaStoragePrefix(restaurantId)}${purposeValue}/${crypto.randomUUID()}.${processed.media.extension}`
  try {
    const stored = await createRestaurantAssetStoragePort().uploadImmutable({
      path,
      bytes: processed.media.bytes,
      contentType: processed.media.mime,
    })
    return {
      url: stored.publicUrl,
      width: processed.media.width,
      height: processed.media.height,
      mime: processed.media.mime,
    }
  } catch (error) {
    console.error('[theme-media-upload-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Görsel yüklenemedi. Lütfen tekrar deneyin.' }
  }
}

export async function uploadThemeVideo(formData: FormData): Promise<ThemeVideoUploadResult> {
  const restaurantId = String(formData.get('restaurantId') ?? '')
  if (!z.string().uuid().safeParse(restaurantId).success) return { error: 'Geçersiz Tema video hedefi.' }
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return { error: 'Tema videosu yüklemek için yetkiniz yok.' }
  if (!await canUseAdvancedThemeMedia(restaurantId)) return { error: 'Hero video Pro pakette kullanılabilir.' }
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Video dosyası bulunamadı.' }
  const validated = validateThemeVideo({ bytes: new Uint8Array(await file.arrayBuffer()), claimedType: file.type })
  if (!validated.ok) return { error: validated.error }
  const path = `${themeMediaStoragePrefix(restaurantId)}home-hero-video/${crypto.randomUUID()}.${validated.video.extension}`
  try {
    const stored = await createRestaurantAssetStoragePort().uploadImmutable({ path, bytes: validated.video.bytes, contentType: validated.video.mime })
    return { url: stored.publicUrl, durationSeconds: validated.video.durationSeconds, mime: validated.video.mime }
  } catch (error) {
    console.error('[theme-video-upload-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Video yüklenemedi. Lütfen tekrar deneyin.' }
  }
}

export async function removeUnusedThemeMedia(
  restaurantId: string,
  publicUrl: string,
): Promise<{ error: string } | { success: true; removed: boolean }> {
  if (!z.string().uuid().safeParse(restaurantId).success || publicUrl.length > 2_048) {
    return { error: 'Geçersiz Tema medya hedefi.' }
  }
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return { error: 'Tema medyasını kaldırmak için yetkiniz yok.' }

  const storageOrigin = process.env['NEXT_PUBLIC_SUPABASE_URL']
  if (!storageOrigin) return { error: 'Tema medya servisi kullanılamıyor.' }
  const path = parseOwnedThemeMediaPath({ publicUrl, restaurantId, storageOrigin })
  // Legacy or external URLs are never deleted by this action. The draft may
  // still stop referencing them, but storage ownership cannot be proven here.
  if (!path) return { success: true, removed: false }

  const supabase = await createDashboardServerClient()
  const [liveResult, draftResult] = await Promise.all([
    supabase.from('theme_configs').select('tokens').eq('restaurant_id', restaurantId).maybeSingle(),
    supabase.from('theme_drafts').select('tokens').eq('restaurant_id', restaurantId).maybeSingle(),
  ])
  if (liveResult.error || draftResult.error) {
    console.error(
      '[theme-media-reference-read-failure]',
      sanitizeServerDiagnostic(liveResult.error ?? draftResult.error),
    )
    return { error: 'Görselin kullanım durumu doğrulanamadı.' }
  }
  const liveTokens = (liveResult.data as { tokens?: unknown } | null)?.tokens
  const draftTokens = (draftResult.data as { tokens?: unknown } | null)?.tokens
  if (
    themeDocumentContainsMediaUrl(liveTokens, publicUrl)
    || themeDocumentContainsMediaUrl(draftTokens, publicUrl)
  ) {
    return { success: true, removed: false }
  }

  try {
    await createRestaurantAssetStoragePort().remove(path)
  } catch (error) {
    console.error('[theme-media-remove-failure]', sanitizeServerDiagnostic(error))
    return { error: 'Kullanılmayan görsel temizlenemedi.' }
  }
  return { success: true, removed: true }
}

export async function publishTheme(
  restaurantId: string,
  input: PublishThemeInput,
): Promise<DashboardActionFailure | SavedThemePublishResult> {
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'theme.publish')

  const parsed = publishThemeSchema.safeParse(input)
  if (!parsed.success) return dashboardThemeFailure('Invalid theme publish request')

  const dashboardClient = await createDashboardServerClient()
  const [draftRead, liveRead] = await Promise.all([
    dashboardClient.from('theme_drafts').select('tokens').eq('restaurant_id', restaurantId).maybeSingle(),
    dashboardClient.from('theme_configs').select('tokens').eq('restaurant_id', restaurantId).maybeSingle(),
  ])
  const draftTokens = (draftRead.data as { tokens?: unknown } | null)?.tokens
  const sanitizedDraft = sanitizeThemeTokens(draftTokens, 'default')
  if (draftRead.error || !validateOwnedHomeVideoPairs(draftTokens, restaurantId)) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.publish' })
  }
  if (usesAdvancedHomeSections(draftTokens) && !await canUseAdvancedThemeMedia(restaurantId)) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.publish', message: 'Bu ana sayfa bölümleri Pro paket gerektirir.' })
  }
  if (!sanitizedDraft || inspectAuthSurfaceContrast(sanitizedDraft).length > 0) {
    return dashboardActionFailure('VALIDATION_FAILED', {
      operation: 'theme.publish',
      message: 'Giriş yüzeyindeki kritik kontrast sorunlarını düzeltmeden tema yayınlanamaz.',
    })
  }
  if (inspectCheckoutSurfaceContrast(sanitizedDraft).length > 0) {
    return dashboardActionFailure('VALIDATION_FAILED', {
      operation: 'theme.publish',
      message: 'Checkout yüzeyindeki kritik kontrast sorunlarını düzeltmeden tema yayınlanamaz.',
    })
  }

  try {
    const result = await publishSavedRestaurantTheme({
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId,
      permissions: ['theme'],
    }, {
      restaurantId,
      expectedDraftRevision: parsed.data.expectedDraftRevision,
      expectedPublishedRevision: parsed.data.expectedPublishedRevision,
      requestId: parsed.data.requestId,
    }, createThemeApplicationPort())
    if (!result.ok) return dashboardThemeFailure(result.error)

    if (result.value.status === 'published' || result.value.status === 'replayed') {
      revalidatePath(`/dashboard/${restaurantId}/theme`)
      revalidatePath(`/dashboard/${restaurantId}/theme/default/edit`)
      revalidatePath(`/${result.value.slug}`)
      revalidatePath(`/${result.value.slug}/menu`)
      const nextUrls = collectThemeMediaUrls((draftRead.data as { tokens?: unknown } | null)?.tokens)
      const previousUrls = collectThemeMediaUrls((liveRead.data as { tokens?: unknown } | null)?.tokens)
      await Promise.all([...previousUrls].filter((url) => !nextUrls.has(url)).map((url) => removeUnusedThemeMedia(restaurantId, url)))
    }
    return result.value
  } catch (error) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'theme.publish',
      cause: error,
    })
  }
}

export async function saveThemeDraft(
  restaurantId: string,
  input: SaveThemeDraftInput,
): Promise<DashboardActionFailure | ThemeDraftSaveResult> {
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'theme.save-draft')
  const parsed = saveThemeDraftSchema.safeParse(input)
  if (!parsed.success) return dashboardThemeFailure('Invalid theme draft request')
  if (!validateOwnedHomeVideoPairs(parsed.data.theme, restaurantId)) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.save-draft' })
  }
  if (usesAdvancedHomeSections(parsed.data.theme) && !await canUseAdvancedThemeMedia(restaurantId)) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.save-draft', message: 'Bu ana sayfa bölümleri Pro paket gerektirir.' })
  }

  try {
    const result = await saveRestaurantThemeDraft({
      actor: 'dashboard-member',
      userId: gate.userId,
      restaurantId,
      permissions: ['theme'],
    }, {
      restaurantId,
      templateId: parsed.data.templateId,
      theme: parsed.data.theme,
      expectedRevision: parsed.data.expectedRevision,
      requestId: parsed.data.requestId,
    }, createThemeApplicationPort())
    if (!result.ok) return dashboardThemeFailure(result.error)
    if (result.value.status !== 'conflict') {
      revalidatePath(`/dashboard/${restaurantId}/theme/default/edit`)
    }
    return result.value
  } catch (error) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'theme.save-draft',
      cause: error,
    })
  }
}
