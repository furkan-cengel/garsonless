'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { z } from 'zod'
import { recordSignupLegalEvidence } from '@garsonless/db/server'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import {
  advanceOnboardingBranding,
  completeOnboardingCsv,
  createOnboardingFirstItem,
  dismissOnboardingChecklist,
  type OnboardingApplicationPort,
  type OnboardingBrandingInput,
  type OnboardingFirstItemInput,
  type OnboardingPersistenceResult,
  type OnboardingSnapshot,
} from '@garsonless/application/onboarding'
import {
  CANONICAL_THEME_ID,
  inspectAuthSurfaceContrast,
  inspectCheckoutSurfaceContrast,
  inspectMenuCardSurfaceContrast,
  inspectMenuCartContrast,
  inspectMenuFooterContrast,
  inspectMenuNavigationContrast,
  inspectMenuThemeContrast,
  sanitizeThemeTokens,
} from '@garsonless/design-engine'
import { THEME_DEFAULTS } from '@garsonless/ui/themes/default/settings'
import { err, ok, type DashboardActorContext, type Result } from '@garsonless/domain'
import { createDashboardServerClient } from '../supabase-server'
import { getDashboardRequestAuth } from '../auth/current-user'
import { assertOwner } from '../auth/access'
import { importMenuRows } from './menu'
import type { MenuBulkImportRow } from '../menu-import-validation'
import { sanitizeServerDiagnostic } from '../server-log-redaction'

const planSchema = z.enum(['starter', 'plus', 'pro']).nullable()
const menuDraftSchema = z.object({
  mode: z.enum(['manual', 'csv']),
  categoryName: z.string().max(100), itemName: z.string().max(100),
  price: z.string().max(64), description: z.string().max(500),
  csvFileName: z.string().max(255),
  csvRows: z.array(z.object({
    sourceRow: z.number().int().nonnegative(), category: z.string().max(100),
    name: z.string().max(100), description: z.string().max(500),
    price: z.string().max(64), error: z.string().max(500).nullable(),
  }).strict()).max(1000),
}).strict()
const snapshotSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed']),
  restaurantId: z.string().uuid().nullable(),
  restaurantName: z.string(),
  slug: z.string(),
  logoUrl: z.string().url().nullable(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  currentStep: z.enum(['business', 'branding', 'menu', 'complete']),
  completedSteps: z.array(z.enum(['business', 'branding', 'menu', 'complete'])),
  menuEntryMethod: z.enum(['manual', 'csv']).nullable(),
  targetPlan: planSchema,
  targetBillingInterval: z.enum(['monthly', 'yearly']).default('monthly'),
  menuDraft: menuDraftSchema.nullable().default(null),
  trialEndsAt: z.string().datetime({ offset: true }).nullable(),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  revision: z.number().int().nonnegative(),
  categoryCount: z.number().int().nonnegative(),
  itemCount: z.number().int().nonnegative(),
  checklistDismissedAt: z.string().datetime({ offset: true }).nullable(),
}).strict()

const persistenceSchema = z.object({
  outcome: z.enum(['saved', 'replayed', 'conflict']),
  snapshot: snapshotSchema,
}).strict()

const createSchema = z.object({
  name: z.string().trim().min(1, 'İşletme adını girin.').max(100),
  slug: z.string().trim().min(1).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Menü adresi geçersiz.'),
  timezone: z.string().trim().min(1).max(100).refine((value) => {
    try { new Intl.DateTimeFormat('tr-TR', { timeZone: value }); return true } catch { return false }
  }, 'Geçerli bir saat dilimi seçin.'),
  targetPlan: planSchema,
  targetBillingInterval: z.enum(['monthly', 'yearly']).default('monthly'),
  requestId: z.string().uuid(),
  termsAccepted: z.boolean().optional(),
  termsVersion: z.string().optional(),
}).strict()

const mutationSchema = z.object({
  restaurantId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  requestId: z.string().uuid(),
}).strict()

const brandingSchema = mutationSchema

const firstItemSchema = mutationSchema.extend({
  categoryName: z.string().trim().min(1).max(100),
  itemName: z.string().trim().min(1).max(100),
  price: z.number().positive().max(99_999_999),
  description: z.string().trim().max(500).optional(),
}).strict()

export type OnboardingActionResult =
  | { error: string; code?: 'CONFLICT' | 'INVALID' | 'UNAVAILABLE'; snapshot?: OnboardingSnapshot }
  | { snapshot: OnboardingSnapshot; replayed: boolean }

function actionError(error: unknown, fallback: string): OnboardingActionResult {
  console.error('[onboarding-action-failure]', sanitizeServerDiagnostic(error))
  return { error: fallback, code: 'UNAVAILABLE' }
}

function parsePersistence(data: unknown): Result<OnboardingPersistenceResult> {
  const parsed = persistenceSchema.safeParse(data)
  return parsed.success ? ok(parsed.data) : err('Invalid onboarding response')
}

type RpcClient = Awaited<ReturnType<typeof createDashboardServerClient>>

function createOnboardingPort(supabase: RpcClient): OnboardingApplicationPort {
  async function call(name: string, args: Record<string, unknown>) {
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      functionName: string,
      parameters: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
    const { data, error } = await rpc(name, args)
    return error ? err(error.message) : parsePersistence(data)
  }
  return {
    advanceBranding(input) {
      return call('advance_restaurant_onboarding_branding', {
        p_restaurant_id: input.restaurantId,
        p_accent: input.accent,
        p_theme: input.theme,
        p_expected_revision: input.expectedRevision,
        p_request_id: input.requestId,
      })
    },
    createFirstItem(input) {
      return call('create_onboarding_first_menu_item', {
        p_restaurant_id: input.restaurantId,
        p_category_name: input.categoryName,
        p_item_name: input.itemName,
        p_price: input.price,
        p_description: input.description ?? null,
        p_expected_revision: input.expectedRevision,
        p_request_id: input.requestId,
      })
    },
    completeCsv(input) {
      return call('complete_onboarding_csv_menu', {
        p_restaurant_id: input.restaurantId,
        p_expected_revision: input.expectedRevision,
        p_request_id: input.requestId,
      })
    },
    dismissChecklist(input) {
      return call('dismiss_restaurant_onboarding_checklist', {
        p_restaurant_id: input.restaurantId,
        p_expected_revision: input.expectedRevision,
        p_request_id: input.requestId,
      })
    },
  }
}

async function ownerActor(restaurantId: string): Promise<{ error: string } | { actor: DashboardActorContext; supabase: RpcClient }> {
  const owner = await assertOwner(restaurantId)
  if ('error' in owner) return owner
  return {
    actor: {
      actor: 'dashboard-member', userId: owner.userId, restaurantId,
      permissions: ['menu', 'theme'], isOwner: true,
    },
    supabase: await createDashboardServerClient(),
  }
}

function toActionResult(result: Result<OnboardingPersistenceResult>): OnboardingActionResult {
  if (!result.ok) return actionError(result.error, 'Kurulum ilerlemesi kaydedilemedi. Lütfen tekrar deneyin.')
  if (result.value.outcome === 'conflict') {
    return {
      error: 'Kurulum başka bir sekmede güncellendi. Güncel adımdan devam edebilirsiniz.',
      code: 'CONFLICT',
      snapshot: result.value.snapshot,
    }
  }
  return { snapshot: result.value.snapshot, replayed: result.value.outcome === 'replayed' }
}

function signupEmailVerificationRequired(user: { app_metadata?: Record<string, unknown> }): boolean {
  return user.app_metadata?.['dashboard_signup_email_verification_required'] === true
}

export async function readOwnerOnboarding(): Promise<{ error: string } | { snapshot: OnboardingSnapshot | null }> {
  const { supabase, user } = await getDashboardRequestAuth()
  if (!user) return { error: 'Not authenticated' }
  if (!user.email_confirmed_at || signupEmailVerificationRequired(user)) return { error: 'Email verification required' }
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: 'read_owner_restaurant_onboarding',
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await rpc('read_owner_restaurant_onboarding')
  if (error) return actionError(error, 'Kurulum durumu okunamadı.') as { error: string }
  if (data === null) return { snapshot: null }
  const parsed = snapshotSchema.safeParse(data)
  return parsed.success ? { snapshot: parsed.data } : { error: 'Kurulum durumu doğrulanamadı.' }
}

export async function createOnboardingRestaurant(input: unknown): Promise<OnboardingActionResult> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'İşletme bilgileri geçersiz.', code: 'INVALID' }
  const { supabase, user } = await getDashboardRequestAuth()
  if (!user) return { error: 'Oturumunuz sona erdi. Tekrar giriş yapın.', code: 'UNAVAILABLE' }
  if (!user.email_confirmed_at || signupEmailVerificationRequired(user)) {
    return { error: 'İşletme oluşturmadan önce e-posta adresini doğrula.', code: 'UNAVAILABLE' }
  }
  if (parsed.data.termsAccepted === true && parsed.data.termsVersion === LEGAL_DOCUMENT_VERSION) {
    const recorded = await recordSignupLegalEvidence({ userId: user.id, documentVersion: LEGAL_DOCUMENT_VERSION, occurredAt: new Date().toISOString(), ipHash: null, userAgent: null })
    if (!recorded.ok) return { error: 'Sözleşme kabulü kaydedilemedi. Tekrar dene.', code: 'UNAVAILABLE' }
  }
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: 'create_restaurant_with_pro_trial_v3',
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string; message: string } | null }>
  const { data, error } = await rpc('create_restaurant_with_pro_trial_v3', {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_timezone: parsed.data.timezone,
    p_intended_plan: parsed.data.targetPlan,
    p_intended_interval: parsed.data.targetBillingInterval,
    p_request_id: parsed.data.requestId,
  })
  if (error) {
    if (error.message.includes('signup_legal_evidence_required')) return { error: 'Devam etmek için hizmet sözleşmesini kabul et.', code: 'INVALID' }
    if (error.code === '23505') return { error: 'Bu menü adresi kullanımda.', code: 'INVALID' }
    if (error.message.includes('additional_location_requires_sales_activation')) {
      return { error: 'Bu hesapta zaten bir işletme bulunuyor.', code: 'INVALID' }
    }
    if (error.message.includes('onboarding_idempotency_conflict')) {
      return { error: 'Bu kayıt isteği farklı bilgilerle kullanıldı. Sayfayı yenileyin.', code: 'CONFLICT' }
    }
    return actionError(error, 'İşletme oluşturulamadı. Lütfen tekrar deneyin.')
  }
  const result = parsePersistence(data)
  if (!result.ok) return actionError(result.error, 'Kurulum yanıtı doğrulanamadı.')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/onboarding')
  return toActionResult(result)
}

export async function saveOnboardingBranding(input: unknown): Promise<OnboardingActionResult> {
  const parsed = brandingSchema.safeParse(input)
  if (!parsed.success) return { error: 'Marka kurulumu isteği geçersiz.', code: 'INVALID' }
  const sanitized = sanitizeThemeTokens(THEME_DEFAULTS, CANONICAL_THEME_ID)
  if (!sanitized || [
    inspectAuthSurfaceContrast,
    inspectCheckoutSurfaceContrast,
    inspectMenuCardSurfaceContrast,
    inspectMenuCartContrast,
    inspectMenuFooterContrast,
    inspectMenuNavigationContrast,
    inspectMenuThemeContrast,
  ].some((inspect) => inspect(sanitized).length > 0)) {
    return { error: 'Varsayılan menü görünümü hazırlanamadı. Lütfen tekrar deneyin.', code: 'UNAVAILABLE' }
  }
  const gate = await ownerActor(parsed.data.restaurantId)
  if ('error' in gate) return { error: 'Bu kurulumda işlem yapma yetkiniz yok.', code: 'UNAVAILABLE' }
  const command: OnboardingBrandingInput = {
    ...parsed.data,
    accent: THEME_DEFAULTS.accent.toLowerCase(),
    theme: sanitized as unknown as Record<string, unknown>,
  }
  const result = await advanceOnboardingBranding(gate.actor, command, createOnboardingPort(gate.supabase))
  const response = toActionResult(result)
  if (!('error' in response)) {
    revalidateTag(`theme:${parsed.data.restaurantId}`)
    revalidateTag(`menu:${parsed.data.restaurantId}`)
    revalidatePath('/dashboard/onboarding')
  }
  return response
}

export async function createOnboardingMenuItem(input: unknown): Promise<OnboardingActionResult> {
  const parsed = firstItemSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'İlk ürün bilgileri geçersiz.', code: 'INVALID' }
  const gate = await ownerActor(parsed.data.restaurantId)
  if ('error' in gate) return { error: 'Bu kurulumda işlem yapma yetkiniz yok.', code: 'UNAVAILABLE' }
  const result = await createOnboardingFirstItem(
    gate.actor,
    parsed.data as OnboardingFirstItemInput,
    createOnboardingPort(gate.supabase),
  )
  const response = toActionResult(result)
  if (!('error' in response)) {
    revalidateTag(`menu:${parsed.data.restaurantId}`)
    revalidatePath(`/dashboard/${parsed.data.restaurantId}/menu`)
    // Keep the completed snapshot visible so the user can choose the next action.
    // A later direct visit is still redirected by the onboarding server page.
  }
  return response
}

export async function importOnboardingCsvMenu(input: unknown): Promise<OnboardingActionResult & { failures?: Array<{ row: number; category: string; name: string; error: string }> }> {
  const parsed = mutationSchema.extend({ rows: z.array(z.unknown()).min(1).max(1000) }).strict().safeParse(input)
  if (!parsed.success) return { error: 'İçe aktarma isteği geçersiz.', code: 'INVALID' }
  const imported = await importMenuRows(parsed.data.restaurantId, parsed.data.rows as MenuBulkImportRow[])
  if ('error' in imported) return { error: imported.error, code: imported.code === 'invalid_input' ? 'INVALID' : 'UNAVAILABLE' }
  const gate = await ownerActor(parsed.data.restaurantId)
  if ('error' in gate) return { error: 'Bu kurulumda işlem yapma yetkiniz yok.', code: 'UNAVAILABLE' }
  const result = await completeOnboardingCsv(gate.actor, {
    restaurantId: parsed.data.restaurantId,
    expectedRevision: parsed.data.expectedRevision,
    requestId: parsed.data.requestId,
  }, createOnboardingPort(gate.supabase))
  return { ...toActionResult(result), failures: imported.failures }
}

export async function dismissOnboardingChecklistAction(input: unknown): Promise<OnboardingActionResult> {
  const parsed = mutationSchema.safeParse(input)
  if (!parsed.success) return { error: 'Kurulum kartı kapatılamadı.', code: 'INVALID' }
  const gate = await ownerActor(parsed.data.restaurantId)
  if ('error' in gate) return { error: 'Bu kurulumda işlem yapma yetkiniz yok.', code: 'UNAVAILABLE' }
  return toActionResult(await dismissOnboardingChecklist(
    gate.actor,
    parsed.data,
    createOnboardingPort(gate.supabase),
  ))
}

export async function hasOnboardingLegalEvidence(): Promise<boolean> {
  const { supabase, user } = await getDashboardRequestAuth()
  if (!user) return false
  const call = supabase.rpc.bind(supabase) as unknown as (name: string) => Promise<{ data: unknown; error: unknown }>
  const result = await call('has_current_signup_legal_evidence')
  return !result.error && result.data === true
}

export async function saveOnboardingMenuDraft(input: unknown): Promise<OnboardingActionResult> {
  const parsed = mutationSchema.extend({ draft: menuDraftSchema }).strict().safeParse(input)
  if (!parsed.success) return { error: 'Taslak kaydedilemedi. Alan uzunluklarını ve dosyadaki satır sayısını kontrol et.', code: 'INVALID' }
  const owner = await ownerActor(parsed.data.restaurantId)
  if ('error' in owner) return { error: owner.error, code: 'UNAVAILABLE' }
  const call = owner.supabase.rpc.bind(owner.supabase) as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
  const result = await call('save_restaurant_onboarding_draft', { p_restaurant_id: parsed.data.restaurantId, p_draft: parsed.data.draft, p_expected_revision: parsed.data.expectedRevision, p_request_id: parsed.data.requestId })
  if (result.error) return actionError(result.error, 'Taslak kaydedilemedi. Bilgilerin korundu; tekrar deneyebilirsin.')
  revalidatePath('/dashboard/onboarding')
  return toActionResult(parsePersistence(result.data))
}
