import {
  DEFAULT_AUTH_STATES,
  type AuthErrorIcon,
  type AuthErrorStateTheme,
  type AuthOtpStateTheme,
  type AuthStateContentAlign,
  type AuthStateContentWidth,
  type AuthStateLayoutTheme,
  type AuthSuccessIcon,
  type AuthSuccessStateTheme,
  type AuthSurfaceTheme,
} from './schema'

export interface ResolvedAuthStateLayoutTheme {
  paddingX: number
  paddingY: number
  contentGap: number
  align: AuthStateContentAlign
  contentWidth: AuthStateContentWidth
  iconSize: number
}

export interface ResolvedAuthOtpStateTheme {
  title: string
  description: string
  primaryActionLabel: string
  resendLabel: string
  layout: ResolvedAuthStateLayoutTheme
}

export interface ResolvedAuthSuccessStateTheme {
  title: string
  description: string
  primaryActionLabel: string
  icon: AuthSuccessIcon
  iconColor: string
  iconBackground: string
  layout: ResolvedAuthStateLayoutTheme
}

export interface ResolvedAuthErrorStateTheme {
  title: string
  description: string
  primaryActionLabel: string
  icon: AuthErrorIcon
  iconColor: string
  iconBackground: string
  layout: ResolvedAuthStateLayoutTheme
}

function resolveLayout(
  fallback: AuthStateLayoutTheme,
  override: AuthStateLayoutTheme | undefined,
): ResolvedAuthStateLayoutTheme {
  return {
    paddingX: override?.paddingX ?? fallback.paddingX ?? 22,
    paddingY: override?.paddingY ?? fallback.paddingY ?? 24,
    contentGap: override?.contentGap ?? fallback.contentGap ?? 12,
    align: override?.align ?? fallback.align ?? 'left',
    contentWidth: override?.contentWidth ?? fallback.contentWidth ?? 'full',
    iconSize: override?.iconSize ?? fallback.iconSize ?? 76,
  }
}

export function resolveAuthOtpState(surface: AuthSurfaceTheme | null | undefined): ResolvedAuthOtpStateTheme {
  const override: AuthOtpStateTheme | undefined = surface?.states?.otp
  return {
    title: override?.title ?? DEFAULT_AUTH_STATES.otp.title,
    description: override?.description ?? DEFAULT_AUTH_STATES.otp.description,
    primaryActionLabel: override?.primaryActionLabel ?? DEFAULT_AUTH_STATES.otp.primaryActionLabel,
    resendLabel: override?.resendLabel ?? DEFAULT_AUTH_STATES.otp.resendLabel,
    layout: resolveLayout(DEFAULT_AUTH_STATES.otp.layout, override?.layout),
  }
}

export function resolveAuthSuccessState(surface: AuthSurfaceTheme | null | undefined): ResolvedAuthSuccessStateTheme {
  const override: AuthSuccessStateTheme | undefined = surface?.states?.success
  return {
    title: override?.title ?? DEFAULT_AUTH_STATES.success.title,
    description: override?.description ?? DEFAULT_AUTH_STATES.success.description,
    primaryActionLabel: override?.primaryActionLabel ?? DEFAULT_AUTH_STATES.success.primaryActionLabel,
    icon: override?.icon ?? DEFAULT_AUTH_STATES.success.icon,
    iconColor: override?.iconColor ?? DEFAULT_AUTH_STATES.success.iconColor,
    iconBackground: override?.iconBackground ?? DEFAULT_AUTH_STATES.success.iconBackground,
    layout: resolveLayout(DEFAULT_AUTH_STATES.success.layout, override?.layout),
  }
}

export function resolveAuthErrorState(surface: AuthSurfaceTheme | null | undefined): ResolvedAuthErrorStateTheme {
  const override: AuthErrorStateTheme | undefined = surface?.states?.error
  return {
    title: override?.title ?? DEFAULT_AUTH_STATES.error.title,
    description: override?.description ?? DEFAULT_AUTH_STATES.error.description,
    primaryActionLabel: override?.primaryActionLabel ?? DEFAULT_AUTH_STATES.error.primaryActionLabel,
    icon: override?.icon ?? DEFAULT_AUTH_STATES.error.icon,
    iconColor: override?.iconColor ?? DEFAULT_AUTH_STATES.error.iconColor,
    iconBackground: override?.iconBackground ?? DEFAULT_AUTH_STATES.error.iconBackground,
    layout: resolveLayout(DEFAULT_AUTH_STATES.error.layout, override?.layout),
  }
}
