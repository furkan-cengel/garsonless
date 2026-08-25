import type { OnboardingSnapshot, OnboardingTargetPlan } from '@garsonless/application/onboarding'

export const PLAN_LABELS: Record<Exclude<OnboardingTargetPlan, null>, string> = {
  starter: 'Starter',
  plus: 'Plus',
  pro: 'Pro',
}
export function planLabel(plan: OnboardingTargetPlan) {
  return plan ? PLAN_LABELS[plan] : 'Daha sonra seçilecek'
}

export function trialDaysRemaining(trialEndsAt: string | null, now = new Date()) {
  if (!trialEndsAt) return 14
  const remaining = new Date(trialEndsAt).getTime() - now.getTime()
  return Math.max(0, Math.ceil(remaining / 86_400_000))
}

export function publicMenuUrl(slug: string, baseUrl: string) {
  return `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(slug)}`
}

export function stepIndex(snapshot: OnboardingSnapshot | null) {
  if (!snapshot) return 0
  if (snapshot.currentStep === 'branding') return 1
  if (snapshot.currentStep === 'menu') return 2
  if (snapshot.currentStep === 'complete') return 3
  return 0
}

export function normalizeDetectedTimezone(value: string | undefined) {
  if (!value) return 'Europe/Istanbul'
  try {
    new Intl.DateTimeFormat('tr-TR', { timeZone: value })
    return value
  } catch {
    return 'Europe/Istanbul'
  }
}
