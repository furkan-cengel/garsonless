import type { PublicErrorCode } from './errors'

export const PLATFORM_ERROR_APPS = [
  'dashboard',
  'menu',
  'kitchen',
  'platform-admin',
  'worker',
] as const
export type PlatformErrorApp = (typeof PLATFORM_ERROR_APPS)[number]

export const PLATFORM_ERROR_SEVERITIES = ['warning', 'error', 'critical'] as const
export type PlatformErrorSeverity = (typeof PLATFORM_ERROR_SEVERITIES)[number]

export const PLATFORM_ERROR_WINDOWS = ['1h', '24h', '7d', '30d'] as const
export type PlatformErrorWindow = (typeof PLATFORM_ERROR_WINDOWS)[number]

export type PlatformErrorEventInput = {
  app: PlatformErrorApp
  source: string
  publicCode: PublicErrorCode
  severity: PlatformErrorSeverity
  restaurantId?: string | null
  referenceId?: string | null
  occurredAt?: string | null
}

export function isPlatformErrorApp(value: unknown): value is PlatformErrorApp {
  return PLATFORM_ERROR_APPS.includes(value as PlatformErrorApp)
}

export function isPlatformErrorSeverity(value: unknown): value is PlatformErrorSeverity {
  return PLATFORM_ERROR_SEVERITIES.includes(value as PlatformErrorSeverity)
}

export function isPlatformErrorWindow(value: unknown): value is PlatformErrorWindow {
  return PLATFORM_ERROR_WINDOWS.includes(value as PlatformErrorWindow)
}

export function isPlatformErrorSource(value: unknown): value is string {
  return typeof value === 'string'
    && /^[a-z][a-z0-9.-]{2,79}$/.test(value)
}
