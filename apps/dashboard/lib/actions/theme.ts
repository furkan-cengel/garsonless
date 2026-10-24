'use server'
import { ingestMediaFile } from '../media-library-server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { sanitizeThemeTokens } from '@garsonless/design-engine'
import {
  publishSavedRestaurantTheme,
  readThemeMenuReferences,
  readThemeForEditor,
  saveRestaurantThemeDraft,
  type SavedThemePublishResult,
  type ThemeDraftSaveResult,
  type ThemeEditorSnapshot,
} from '@garsonless/application/themes'
import {
  createThemeMenuReferenceReadModelPort,
  createThemeApplicationPort,
} from '@garsonless/db/server'
import { assertAccess } from '../auth/access'
import { sanitizeServerDiagnostic } from '../server-log-redaction'
import {
  isThemeMediaPurpose,
  parseOwnedThemeMediaPath,
  validateThemeMediaMetadata,
} from '../theme-media-policy'
import { processThemeMedia } from '../theme-media-processor'
import { validateThemeVideo } from '../theme-video-policy'
import { getThemePromoSliderIssues } from '../promo-slider-validation'
import { getThemeComboRibbonIssues } from '../combo-ribbon-validation'
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

export async function readThemeRecoverySnapshot(restaurantId: string, templateId: string): Promise<{ snapshot: ThemeEditorSnapshot } | DashboardActionFailure> {
  if (!z.string().uuid().safeParse(restaurantId).success || templateId !== 'default') {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.recovery' })
  }
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'theme.recovery')
  const result = await readThemeForEditor({ actor: 'dashboard-member', userId: gate.userId, restaurantId, permissions: ['theme'] },
    { restaurantId, templateId }, createThemeApplicationPort())
  if (!result.ok) return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'theme.recovery' })
  const { theme, revision, templateId: resolvedTemplateId, publishedAt, draftRevision, publishedRevision, draftSavedAt, hasUnpublishedChanges } = result.value
  return { snapshot: { theme, revision, templateId: resolvedTemplateId, publishedAt, draftRevision, publishedRevision, draftSavedAt, hasUnpublishedChanges } }
}

export type ThemeMediaUploadResult =
  | { error: string }
  | { url: string; width: number; height: number; mime: 'image/webp' }

export type ThemeVideoUploadResult =
  | { error: string }
  | { url: string; durationSeconds: number; mime: 'video/mp4' | 'video/webm' }

/** Hero video and its poster are billed by the separately sold Video Hero entitlement. */
async function canUseVideoHeroMedia(restaurantId: string): Promise<boolean> {
  const port = createThemeApplicationPort()
  const restaurant = await port.readRestaurant({ restaurantId })
  if (!restaurant.ok || !restaurant.value) return false
  const access = await port.readFeatureAccess({
    restaurantId,
    plan: restaurant.value.plan,
    feature: 'theme_video_hero',
  })
  return access.ok && access.value
}

function validateOwnedHomeVideoPairs(theme: unknown, restaurantId: string, requireComplete: boolean): boolean {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return true
  const surfaces = (theme as Record<string, unknown>)['surfaces']
  if (!surfaces || typeof surfaces !== 'object' || Array.isArray(surfaces)) return true
  const home = (surfaces as Record<string, unknown>)['home']
  if (!home || typeof home !== 'object' || Array.isArray(home)) return true
  const sections = (home as Record<string, unknown>)['sections']
  const blocks = (home as Record<string, unknown>)['blocks']
  const sectionSettings = (theme as Record<string, unknown>)['sectionSettings']
  const legacyVideoSections = Array.isArray(sections)
    ? sections.filter((section) => section && typeof section === 'object' && !Array.isArray(section) && (section as Record<string, unknown>)['type'] === 'hero-video' && (!requireComplete || (section as Record<string, unknown>)['enabled'] !== false))
    : []
  const v2VideoSettings = Array.isArray(blocks) && sectionSettings && typeof sectionSettings === 'object' && !Array.isArray(sectionSettings)
    ? blocks.flatMap((block) => {
        if (!block || typeof block !== 'object' || Array.isArray(block)) return []
        const record = block as Record<string, unknown>
        if (typeof record['id'] !== 'string') return []
        if (requireComplete && record['enabled'] === false) return []
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
  if (!storageOrigin) return videoEntries.every((section) => {
    const record = section as Record<string, unknown>
    const hasMedia = Boolean(record['videoUrl'] || record['posterUrl'])
    return !hasMedia && !requireComplete
  })
  return videoEntries.every((section) => {
    const record = section as Record<string, unknown>
    const videoUrl = typeof record['videoUrl'] === 'string' ? record['videoUrl'] : ''
    const posterUrl = typeof record['posterUrl'] === 'string' ? record['posterUrl'] : ''
    if (!videoUrl && !posterUrl) return !requireComplete
    if (requireComplete && (!videoUrl || !posterUrl)) return false
    const videoPath = videoUrl ? parseOwnedThemeMediaPath({ publicUrl: videoUrl, restaurantId, storageOrigin }) : null
    const posterPath = posterUrl ? parseOwnedThemeMediaPath({ publicUrl: posterUrl, restaurantId, storageOrigin }) : null
    return (!videoUrl || (videoPath?.includes('/home-hero-video/') === true || /\/library\/[0-9a-f-]+\/video\.(mp4|webm)$/.test(videoPath ?? '')))
      && (!posterUrl || (posterPath?.includes('/home-hero-poster/') === true || /\/library\/[0-9a-f-]+\/(image|menu|logo)\.webp$/.test(posterPath ?? '')))
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
  if (purposeValue === 'home-hero-poster' && !await canUseVideoHeroMedia(restaurantId)) {
    return { error: 'Hero video posteri, Video Hero paketinizde aktif değil.' }
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

  try {
    const stored = await ingestMediaFile(restaurantId, 'theme', file, purposeValue === 'section-icon' || purposeValue === 'auth-header-logo' ? 'logo' : 'image')
    return { url: stored.url, width: stored.width!, height: stored.height!, mime: 'image/webp' }
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
  if (!await canUseVideoHeroMedia(restaurantId)) return { error: 'Hero video, paketinizde aktif değil.' }
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Video dosyası bulunamadı.' }
  const validated = validateThemeVideo({ bytes: new Uint8Array(await file.arrayBuffer()), claimedType: file.type })
  if (!validated.ok) return { error: validated.error }
  try {
    const stored = await ingestMediaFile(restaurantId, 'theme', file, 'video')
    return { url: stored.url, durationSeconds: validated.video.durationSeconds, mime: validated.video.mime }
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

  // Detaching an image must never delete a shared library asset.
  return { success: true, removed: false }
}

export async function publishTheme(
  restaurantId: string,
  input: PublishThemeInput,
): Promise<DashboardActionFailure | SavedThemePublishResult> {
  const gate = await assertAccess(restaurantId, 'theme')
  if ('error' in gate) return dashboardAccessFailure(gate.error, 'theme.publish')

  const parsed = publishThemeSchema.safeParse(input)
  if (!parsed.success) return dashboardThemeFailure('Invalid theme publish request')

  const themePort = createThemeApplicationPort()
  const [draftRead, liveRead] = await Promise.all([
    themePort.readDraft({ restaurantId }),
    themePort.readConfig({ restaurantId }),
  ])
  if (!draftRead.ok || !liveRead.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', {
      operation: 'theme.publish',
      cause: !draftRead.ok ? draftRead.error : !liveRead.ok ? liveRead.error : 'Unknown theme read failure',
    })
  }
  const draftTokens = draftRead.value?.tokens
  const sanitizedDraft = sanitizeThemeTokens(draftTokens, 'default')
  if (!draftRead.value) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.publish', message: 'Yayınlanacak kayıtlı tema taslağı bulunamadı.' })
  }
  if (!validateOwnedHomeVideoPairs(draftTokens, restaurantId, true)) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.publish', message: 'Tema videosu için video ve poster dosyalarını birlikte yükleyin.' })
  }
  if (!sanitizedDraft) return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.publish' })
  // Colour contrast is advisory: the editor warns and offers a safe palette, but the owner decides.
  const promoSliderIssues = getThemePromoSliderIssues(sanitizedDraft)
  if (promoSliderIssues.length > 0) {
    return dashboardActionFailure('VALIDATION_FAILED', {
      operation: 'theme.publish',
      message: `Kampanya Slider: ${promoSliderIssues[0]}`,
    })
  }
  const menuReferences = await readThemeMenuReferences({
    actor: 'dashboard-member',
    userId: gate.userId,
    restaurantId,
    permissions: ['theme'],
  }, restaurantId, createThemeMenuReferenceReadModelPort())
  if (!menuReferences.ok) {
    return dashboardActionFailure('SERVICE_UNAVAILABLE', { operation: 'theme.publish', cause: menuReferences.error })
  }
  const comboRibbonIssues = getThemeComboRibbonIssues(sanitizedDraft, menuReferences.value.items.map((item) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price),
    position: item.position,
    isAvailable: item.is_available,
  })))
  if (comboRibbonIssues.length > 0) {
    return dashboardActionFailure('VALIDATION_FAILED', {
      operation: 'theme.publish',
      message: `Kombo Şerit: ${comboRibbonIssues[0]}`,
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
    }, themePort)
    if (!result.ok) return dashboardThemeFailure(result.error)

    if (result.value.status === 'published' || result.value.status === 'replayed') {
      revalidateTag(`theme:${restaurantId}`)
      revalidateTag(`public-menu:${result.value.slug}`)
      revalidatePath(`/dashboard/${restaurantId}/theme`)
      revalidatePath(`/dashboard/${restaurantId}/theme/default/edit`)
      revalidatePath(`/${result.value.slug}`)
      revalidatePath(`/${result.value.slug}/menu`)
      const nextUrls = collectThemeMediaUrls(draftRead.value?.tokens)
      const previousUrls = collectThemeMediaUrls(liveRead.value?.tokens)
      // Gallery media is retired by the editor lifecycle only after the URL is
      // absent from the current theme and every undo/redo snapshot. Publishing
      // must not invalidate an otherwise valid local undo operation.
      await Promise.all([...previousUrls]
        .filter((url) => !nextUrls.has(url) && !url.includes('/gallery-image/') && !url.includes('/home-hero-video/') && !url.includes('/home-hero-poster/'))
        .map((url) => removeUnusedThemeMedia(restaurantId, url)))
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
  if (!validateOwnedHomeVideoPairs(parsed.data.theme, restaurantId, false)) {
    return dashboardActionFailure('VALIDATION_FAILED', { operation: 'theme.save-draft' })
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
