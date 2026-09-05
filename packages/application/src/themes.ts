import {
  CANONICAL_THEME_ID,
  gatedThemeSectionIds,
  hasSameGatedThemeSections,
  isThemeTemplateId,
  projectThemeForSectionAccess,
  resolveTheme,
  sanitizeThemeTokens,
  type GarsonlessTheme,
  type ThemeSectionAccess,
} from '@garsonless/design-engine'
import {
  err,
  hasSameRestaurant,
  ok,
  type DashboardActorContext,
  type BillableFeature,
  type RestaurantPlan,
  type Result,
} from '@garsonless/domain'
import { authorizeDashboardFeatureRead } from './dashboard-feature-read-models'

export interface ThemeRestaurantSnapshot {
  slug: string
  name: string
  logoUrl: string | null
  settings: Record<string, unknown> | null
  plan: RestaurantPlan
}

export interface ThemeConfigSnapshot {
  tokens: unknown
  revision: number
  publishedAt: string | null
}

export interface PersistedThemeDraftSnapshot {
  tokens: unknown
  templateId: string
  revision: number
  basedOnPublishedRevision: number
  savedAt: string
}

export interface ThemeDraftSnapshot {
  theme: GarsonlessTheme
  templateId: string
  revision: number
  publishedAt: string | null
}

export interface ThemeEditorSnapshot extends ThemeDraftSnapshot {
  draftRevision: number
  publishedRevision: number
  draftSavedAt: string | null
  hasUnpublishedChanges: boolean
}

export type ThemeDraftSaveResult =
  | {
      status: 'saved' | 'replayed'
      revision: number
      basedOnPublishedRevision: number
      savedAt: string
      hasUnpublishedChanges: boolean
    }
  | { status: 'conflict'; snapshot: (ThemeDraftSnapshot & { basedOnPublishedRevision: number; savedAt: string }) | null }

export type SavedThemePublishResult = ThemePublishResult | {
  status: 'draft_conflict'
  snapshot: ThemeDraftSnapshot & { basedOnPublishedRevision: number; savedAt: string }
}

export type ThemePublishResult =
  | { status: 'published'; revision: number; publishedAt: string; slug: string }
  | { status: 'replayed'; revision: number; publishedAt: string; slug: string }
  | { status: 'conflict'; snapshot: ThemeDraftSnapshot }

export type ThemePublishPersistenceResult =
  | Exclude<ThemePublishResult, { status: 'conflict' }>
  | {
      status: 'conflict'
      snapshot: {
        tokens: unknown
        templateId: string
        revision: number
        publishedAt: string | null
      }
    }

const ORDERING_THEME_KEYS: ReadonlyArray<keyof GarsonlessTheme> = [
  'cartPlacement',
  'cartStyle',
  'cartHeaderTriggerStyle',
  'cartFooterTriggerStyle',
  'cartIcon',
  'cartShowBadge',
  'cartPillPosition',
  'cartPillTone',
  'cartDrawerTone',
  'cartShowSubtotal',
  'cartShowItemCount',
  'cartPrimaryActionText',
  'cartButtonText',
  'cartEmptyText',
]

function orderingThemeProjection(theme: GarsonlessTheme): unknown {
  const topLevel = Object.fromEntries(ORDERING_THEME_KEYS.map((key) => [key, theme[key]]))
  return {
    ...topLevel,
    checkout: theme.surfaces?.checkout ?? null,
  }
}

function hasSameOrderingTheme(left: GarsonlessTheme, right: GarsonlessTheme): boolean {
  return JSON.stringify(orderingThemeProjection(left)) === JSON.stringify(orderingThemeProjection(right))
}

/**
 * Public rendering boundary for a theme created during Pro trial and later
 * served on Starter/Plus. Persisted data is preserved; only the sections the
 * tenant is not entitled to are removed from the runtime projection.
 */
export function projectThemeForEntitlements(
  theme: GarsonlessTheme,
  access: ThemeSectionAccess,
): GarsonlessTheme {
  return projectThemeForSectionAccess(theme, access)
}

function hasIncompleteHomeVideo(theme: GarsonlessTheme): boolean {
  const legacyIncomplete = (theme.surfaces?.home.sections ?? []).some((section) =>
    section.enabled && section.type === 'hero-video' && (!section.videoUrl || !section.posterUrl))
  if (legacyIncomplete) return true
  return (theme.surfaces?.home.blocks ?? []).some((block) => {
    if (block.enabled === false) return false
    const settings = theme.sectionSettings?.[block.id] ?? {}
    const videoHero = block.sectionId === 'storefront-video-hero'
    return videoHero && (!settings.videoUrl || !settings.posterUrl)
  })
}

export interface ThemeApplicationPort {
  readRestaurant(input: { restaurantId: string }): Promise<Result<ThemeRestaurantSnapshot | null>>
  readConfig(input: { restaurantId: string }): Promise<Result<ThemeConfigSnapshot | null>>
  readDraft(input: { restaurantId: string }): Promise<Result<PersistedThemeDraftSnapshot | null>>
  readFeatureAccess(input: { restaurantId: string; plan: RestaurantPlan; feature: BillableFeature }): Promise<Result<boolean>>
  publish(input: {
    restaurantId: string
    templateId: string
    theme: GarsonlessTheme
    publishedBy: string
    expectedRevision: number
    requestId: string
  }): Promise<Result<ThemePublishPersistenceResult>>
  saveDraft(input: {
    restaurantId: string
    templateId: string
    theme: GarsonlessTheme
    savedBy: string
    expectedRevision: number
    requestId: string
  }): Promise<Result<
    | Exclude<ThemeDraftSaveResult, { status: 'conflict' }>
    | { status: 'conflict'; snapshot: PersistedThemeDraftSnapshot | null }
  >>
  publishSavedDraft(input: {
    restaurantId: string
    publishedBy: string
    expectedDraftRevision: number
    expectedPublishedRevision: number
    requestId: string
  }): Promise<Result<
    | Exclude<ThemePublishResult, { status: 'conflict' }>
    | { status: 'draft_conflict'; snapshot: PersistedThemeDraftSnapshot }
    | Extract<ThemePublishPersistenceResult, { status: 'conflict' }>
  >>
}

export interface ThemeMenuReference<TCategory, TItem> {
  categories: TCategory[]
  items: TItem[]
}

export interface ThemeMenuReferenceReadModelPort<TCategory, TItem> {
  readMenuReferences(input: {
    restaurantId: string
    operation: 'theme.menu-references'
  }): Promise<Result<ThemeMenuReference<TCategory, TItem>>>
}

function requireThemeAccess(
  context: DashboardActorContext,
  restaurantId: string,
): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.permissions.includes('theme')
    ? ok(true)
    : err('Not authorized')
}

export async function readThemeMenuReferences<TCategory, TItem>(
  context: DashboardActorContext,
  restaurantId: string,
  port: ThemeMenuReferenceReadModelPort<TCategory, TItem>,
): Promise<Result<ThemeMenuReference<TCategory, TItem>>> {
  const access = authorizeDashboardFeatureRead(context, restaurantId, 'theme.menu-references')
  return access.ok
    ? port.readMenuReferences({ restaurantId, operation: 'theme.menu-references' })
    : access
}

async function resolveFromPort(
  input: { restaurantId: string; templateOverride?: string | null },
  port: ThemeApplicationPort,
): Promise<Result<ThemeDraftSnapshot & { restaurant: ThemeRestaurantSnapshot }>> {
  const [restaurantResult, configResult] = await Promise.all([
    port.readRestaurant({ restaurantId: input.restaurantId }),
    port.readConfig({ restaurantId: input.restaurantId }),
  ])
  if (!restaurantResult.ok) return restaurantResult
  if (!configResult.ok) return configResult
  if (!restaurantResult.value) return err('Restaurant not found')

  const resolved = resolveTheme({
    settings: restaurantResult.value.settings,
    themeTokens: configResult.value?.tokens ?? null,
    ...(input.templateOverride !== undefined ? { templateOverride: input.templateOverride } : {}),
  })
  return ok({
    ...resolved,
    restaurant: restaurantResult.value,
    revision: configResult.value?.revision ?? 0,
    publishedAt: configResult.value?.publishedAt ?? null,
  })
}

export async function readThemeForEditor(
  context: DashboardActorContext,
  input: { restaurantId: string; templateId: string },
  port: ThemeApplicationPort,
): Promise<Result<ThemeEditorSnapshot & { restaurant: ThemeRestaurantSnapshot }>> {
  const access = requireThemeAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (input.templateId !== CANONICAL_THEME_ID) return err('Unknown theme template')
  const [resolvedResult, draftResult] = await Promise.all([
    resolveFromPort({ restaurantId: input.restaurantId, templateOverride: CANONICAL_THEME_ID }, port),
    port.readDraft({ restaurantId: input.restaurantId }),
  ])
  if (!resolvedResult.ok) return resolvedResult
  if (!draftResult.ok) return draftResult
  const draft = draftResult.value
  if (!draft) {
    return ok({
      ...resolvedResult.value,
      draftRevision: 0,
      publishedRevision: resolvedResult.value.revision,
      draftSavedAt: null,
      hasUnpublishedChanges: false,
    })
  }
  if (draft.templateId !== CANONICAL_THEME_ID) return err('Invalid theme draft response')
  const draftTheme = sanitizeThemeTokens(draft.tokens, draft.templateId)
  if (!draftTheme) return err('Invalid theme draft response')
  return ok({
    ...resolvedResult.value,
    theme: draftTheme,
    templateId: CANONICAL_THEME_ID,
    draftRevision: draft.revision,
    publishedRevision: resolvedResult.value.revision,
    draftSavedAt: draft.savedAt,
    hasUnpublishedChanges: JSON.stringify(draftTheme) !== JSON.stringify(resolvedResult.value.theme),
  })
}

function validateThemeCommand(input: {
  templateId: string
  theme: unknown
  expectedRevision: number
  requestId: string
}): Result<GarsonlessTheme> {
  if (input.templateId !== CANONICAL_THEME_ID) return err('Unknown theme template')
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return err('Invalid theme draft request')
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) {
    return err('Invalid theme draft request')
  }
  const theme = sanitizeThemeTokens(input.theme, CANONICAL_THEME_ID)
  if (!theme) return err('Invalid theme document')
  return ok(theme)
}

async function enforceThemeEntitlement(
  restaurantId: string,
  theme: GarsonlessTheme,
  port: ThemeApplicationPort,
): Promise<Result<true>> {
  const restaurantResult = await port.readRestaurant({ restaurantId })
  if (!restaurantResult.ok) return restaurantResult
  if (!restaurantResult.value) return err('Restaurant not found')
  const [advancedAccess, videoHeroAccess, orderingAccess] = await Promise.all([
    port.readFeatureAccess({
      restaurantId,
      plan: restaurantResult.value.plan,
      feature: 'theme_advanced_sections',
    }),
    port.readFeatureAccess({
      restaurantId,
      plan: restaurantResult.value.plan,
      feature: 'theme_video_hero',
    }),
    port.readFeatureAccess({
      restaurantId,
      plan: restaurantResult.value.plan,
      feature: 'guest_ordering',
    }),
  ])
  if (!advancedAccess.ok) return advancedAccess
  if (!videoHeroAccess.ok) return videoHeroAccess
  if (!orderingAccess.ok) return orderingAccess
  // Sections the tenant may keep but not add, reorder or reconfigure. Video
  // Hero is billed separately, so an add-on holder edits it while the rest of
  // the advanced catalogue stays frozen.
  const frozenSections = gatedThemeSectionIds({
    advancedSections: advancedAccess.value,
    videoHero: videoHeroAccess.value,
  })
  if (frozenSections.size === 0 && orderingAccess.value) return ok(true)

  const draftResult = await port.readDraft({ restaurantId })
  if (!draftResult.ok) return draftResult
  const persistedDraft = draftResult.value
  if (persistedDraft) {
    const currentDraft = sanitizeThemeTokens(persistedDraft.tokens, persistedDraft.templateId)
    if (!currentDraft || persistedDraft.templateId !== CANONICAL_THEME_ID) {
      return err('Invalid theme draft response')
    }
    if (!hasSameGatedThemeSections(theme, currentDraft, frozenSections)) return err('Plan feature unavailable')
    if (!orderingAccess.value && !hasSameOrderingTheme(theme, currentDraft)) return err('Plan feature unavailable')
    return ok(true)
  }

  const currentResult = await resolveFromPort({ restaurantId, templateOverride: CANONICAL_THEME_ID }, port)
  if (!currentResult.ok) return currentResult
  if (!hasSameGatedThemeSections(theme, currentResult.value.theme, frozenSections)) return err('Plan feature unavailable')
  if (!orderingAccess.value && !hasSameOrderingTheme(theme, currentResult.value.theme)) return err('Plan feature unavailable')
  return ok(true)
}

export async function saveRestaurantThemeDraft(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    templateId: string
    theme: unknown
    expectedRevision: number
    requestId: string
  },
  port: ThemeApplicationPort,
): Promise<Result<ThemeDraftSaveResult>> {
  const access = requireThemeAccess(context, input.restaurantId)
  if (!access.ok) return access
  const validated = validateThemeCommand(input)
  if (!validated.ok) return validated
  const entitlement = await enforceThemeEntitlement(input.restaurantId, validated.value, port)
  if (!entitlement.ok) return entitlement
  const result = await port.saveDraft({
    restaurantId: input.restaurantId,
    templateId: CANONICAL_THEME_ID,
    theme: validated.value,
    savedBy: context.userId,
    expectedRevision: input.expectedRevision,
    requestId: input.requestId,
  })
  if (!result.ok) return result
  const persisted = result.value
  if (persisted.status !== 'conflict') return ok(persisted)
  if (persisted.snapshot === null) return ok({ status: 'conflict', snapshot: null })
  const snapshotTheme = sanitizeThemeTokens(persisted.snapshot.tokens, persisted.snapshot.templateId)
  if (!snapshotTheme || persisted.snapshot.templateId !== CANONICAL_THEME_ID) {
    return err('Invalid theme draft response')
  }
  return ok({
    status: 'conflict',
    snapshot: {
      theme: snapshotTheme,
      templateId: CANONICAL_THEME_ID,
      revision: persisted.snapshot.revision,
      publishedAt: null,
      basedOnPublishedRevision: persisted.snapshot.basedOnPublishedRevision,
      savedAt: persisted.snapshot.savedAt,
    },
  })
}

export async function publishSavedRestaurantTheme(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    expectedDraftRevision: number
    expectedPublishedRevision: number
    requestId: string
  },
  port: ThemeApplicationPort,
): Promise<Result<SavedThemePublishResult>> {
  const access = requireThemeAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (
    !Number.isSafeInteger(input.expectedDraftRevision) || input.expectedDraftRevision <= 0
    || !Number.isSafeInteger(input.expectedPublishedRevision) || input.expectedPublishedRevision < 0
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)
  ) return err('Invalid theme publish request')
  const draftResult = await port.readDraft({ restaurantId: input.restaurantId })
  if (!draftResult.ok) return draftResult
  if (!draftResult.value) return err('Theme draft not found')
  const draftTheme = sanitizeThemeTokens(draftResult.value.tokens, draftResult.value.templateId)
  if (!draftTheme || draftResult.value.templateId !== CANONICAL_THEME_ID) {
    return err('Invalid theme draft response')
  }
  const entitlement = await enforceThemeEntitlement(input.restaurantId, draftTheme, port)
  if (!entitlement.ok) return entitlement
  const result = await port.publishSavedDraft({
    restaurantId: input.restaurantId,
    publishedBy: context.userId,
    expectedDraftRevision: input.expectedDraftRevision,
    expectedPublishedRevision: input.expectedPublishedRevision,
    requestId: input.requestId,
  })
  if (!result.ok) return result
  if (result.value.status === 'published' || result.value.status === 'replayed') return ok(result.value)
  const snapshotTheme = sanitizeThemeTokens(result.value.snapshot.tokens, result.value.snapshot.templateId)
  if (!snapshotTheme || result.value.snapshot.templateId !== CANONICAL_THEME_ID) {
    return err('Invalid theme publish response')
  }
  if (result.value.status === 'draft_conflict') {
    return ok({
      status: 'draft_conflict',
      snapshot: {
        theme: snapshotTheme,
        templateId: CANONICAL_THEME_ID,
        revision: result.value.snapshot.revision,
        publishedAt: null,
        basedOnPublishedRevision: result.value.snapshot.basedOnPublishedRevision,
        savedAt: result.value.snapshot.savedAt,
      },
    })
  }
  return ok({
    status: 'conflict',
    snapshot: {
      theme: snapshotTheme,
      templateId: CANONICAL_THEME_ID,
      revision: result.value.snapshot.revision,
      publishedAt: result.value.snapshot.publishedAt,
    },
  })
}

export async function readActiveThemeForDashboard(
  context: DashboardActorContext,
  input: { restaurantId: string },
  port: ThemeApplicationPort,
): Promise<Result<ThemeDraftSnapshot & { restaurant: ThemeRestaurantSnapshot }>> {
  const access = requireThemeAccess(context, input.restaurantId)
  if (!access.ok) return access
  return resolveFromPort(input, port)
}

/** Public menu read: no actor authority, only already-public restaurant theme data. */
export async function readPublishedTheme(
  input: { restaurantId: string; templateOverride?: string | null },
  port: ThemeApplicationPort,
): Promise<Result<ThemeDraftSnapshot & { restaurant: ThemeRestaurantSnapshot }>> {
  if (input.templateOverride != null && !isThemeTemplateId(input.templateOverride)) {
    return err('Unknown theme template')
  }
  return resolveFromPort(input, port)
}

export async function publishRestaurantTheme(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    templateId: string
    theme: unknown
    expectedRevision: number
    requestId: string
  },
  port: ThemeApplicationPort,
): Promise<Result<ThemePublishResult>> {
  const access = requireThemeAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (input.templateId !== CANONICAL_THEME_ID) return err('Unknown theme template')
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return err('Invalid theme publish request')
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) {
    return err('Invalid theme publish request')
  }
  const theme = sanitizeThemeTokens(input.theme, CANONICAL_THEME_ID)
  if (!theme || hasIncompleteHomeVideo(theme)) return err('Invalid theme document')

  const entitlement = await enforceThemeEntitlement(input.restaurantId, theme, port)
  if (!entitlement.ok) return entitlement

  const publishResult = await port.publish({
    restaurantId: input.restaurantId,
    templateId: CANONICAL_THEME_ID,
    theme,
    publishedBy: context.userId,
    expectedRevision: input.expectedRevision,
    requestId: input.requestId,
  })
  if (!publishResult.ok) return publishResult
  if (publishResult.value.status !== 'conflict') return ok(publishResult.value)

  const snapshotTheme = sanitizeThemeTokens(
    publishResult.value.snapshot.tokens,
    publishResult.value.snapshot.templateId,
  )
  if (!snapshotTheme || publishResult.value.snapshot.templateId !== CANONICAL_THEME_ID) {
    return err('Invalid theme publish response')
  }
  return ok({
    status: 'conflict',
    snapshot: {
      theme: snapshotTheme,
      templateId: CANONICAL_THEME_ID,
      revision: publishResult.value.snapshot.revision,
      publishedAt: publishResult.value.snapshot.publishedAt,
    },
  })
}
