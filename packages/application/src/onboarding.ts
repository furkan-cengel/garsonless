import {
  err,
  hasSameRestaurant,
  ok,
  type DashboardActorContext,
  type Result,
} from '@garsonless/domain'

export const ONBOARDING_STEPS = ['business', 'branding', 'menu', 'complete'] as const
export type OnboardingStep = typeof ONBOARDING_STEPS[number]
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed'
export type OnboardingMenuEntryMethod = 'manual' | 'csv'
export type OnboardingTargetPlan = 'starter' | 'plus' | 'pro' | null

export interface OnboardingMenuDraft {
  mode: 'manual' | 'csv'
  categoryName: string
  itemName: string
  price: string
  description: string
  csvFileName: string
  csvRows: { sourceRow: number; category: string; name: string; description: string; price: string; error: string | null }[]
}

export interface OnboardingSnapshot {
  status: OnboardingStatus
  restaurantId: string | null
  restaurantName: string
  slug: string
  logoUrl: string | null
  accent: string
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  menuEntryMethod: OnboardingMenuEntryMethod | null
  targetPlan: OnboardingTargetPlan
  targetBillingInterval?: 'monthly' | 'yearly'
  menuDraft?: OnboardingMenuDraft | null
  trialEndsAt: string | null
  startedAt: string | null
  completedAt: string | null
  revision: number
  categoryCount: number
  itemCount: number
  checklistDismissedAt: string | null
}

export interface OnboardingMutation {
  restaurantId: string
  expectedRevision: number
  requestId: string
}

export interface OnboardingCompletion {
  snapshot: OnboardingSnapshot
  publicMenuPath: string
}

export interface CreateOnboardingInput {
  name: string
  slug: string
  timezone: string
  targetPlan: OnboardingTargetPlan
  targetBillingInterval?: 'monthly' | 'yearly'
  requestId: string
}

export interface OnboardingBrandingInput extends OnboardingMutation {
  accent: string
  theme: Record<string, unknown>
}

export interface OnboardingFirstItemInput extends OnboardingMutation {
  categoryName: string
  itemName: string
  price: number
  description?: string
}

export type OnboardingPersistenceResult =
  | { outcome: 'saved' | 'replayed'; snapshot: OnboardingSnapshot }
  | { outcome: 'conflict'; snapshot: OnboardingSnapshot }

export interface OnboardingApplicationPort {
  advanceBranding(input: OnboardingBrandingInput): Promise<Result<OnboardingPersistenceResult>>
  createFirstItem(input: OnboardingFirstItemInput): Promise<Result<OnboardingPersistenceResult>>
  completeCsv(input: OnboardingMutation): Promise<Result<OnboardingPersistenceResult>>
  dismissChecklist(input: OnboardingMutation): Promise<Result<OnboardingPersistenceResult>>
}

function validRequest(input: OnboardingMutation) {
  return Number.isInteger(input.expectedRevision)
    && input.expectedRevision >= 0
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)
}

function authorizeOwnerMutation(
  context: DashboardActorContext,
  input: OnboardingMutation,
): Result<true> {
  if (!context.isOwner || !hasSameRestaurant(context, input.restaurantId)) return err('Not authorized')
  return validRequest(input) ? ok(true) : err('Invalid onboarding request')
}

export async function advanceOnboardingBranding(
  context: DashboardActorContext,
  input: OnboardingBrandingInput,
  port: OnboardingApplicationPort,
): Promise<Result<OnboardingPersistenceResult>> {
  const access = authorizeOwnerMutation(context, input)
  return access.ok ? port.advanceBranding(input) : access
}

export async function createOnboardingFirstItem(
  context: DashboardActorContext,
  input: OnboardingFirstItemInput,
  port: OnboardingApplicationPort,
): Promise<Result<OnboardingPersistenceResult>> {
  const access = authorizeOwnerMutation(context, input)
  return access.ok ? port.createFirstItem(input) : access
}

export async function completeOnboardingCsv(
  context: DashboardActorContext,
  input: OnboardingMutation,
  port: OnboardingApplicationPort,
): Promise<Result<OnboardingPersistenceResult>> {
  const access = authorizeOwnerMutation(context, input)
  return access.ok ? port.completeCsv(input) : access
}

export async function dismissOnboardingChecklist(
  context: DashboardActorContext,
  input: OnboardingMutation,
  port: OnboardingApplicationPort,
): Promise<Result<OnboardingPersistenceResult>> {
  const access = authorizeOwnerMutation(context, input)
  return access.ok ? port.dismissChecklist(input) : access
}
