import type {
  AuthPreviewState,
  CheckoutPreviewState,
  GarsonlessTheme,
  ThemeEditorSurface,
} from './schema'
import { CANONICAL_THEME_ID, sanitizeThemeTokens } from './theme-policy'

export const THEME_PREVIEW_CHANNEL = 'garsonless-theme-preview' as const
export const THEME_PREVIEW_VERSION = 2 as const

const MAX_MESSAGE_BYTES = 160 * 1024
const MAX_REQUEST_ID_LENGTH = 120
const MAX_COMPONENT_ID_LENGTH = 100

interface ThemePreviewEnvelope {
  channel: typeof THEME_PREVIEW_CHANNEL
  version: typeof THEME_PREVIEW_VERSION
}

export interface ThemePreviewContext {
  surface: ThemeEditorSurface
  state?: AuthPreviewState | CheckoutPreviewState
}

export type ThemePreviewCommand = ThemePreviewEnvelope & (
  | { type: 'FULL_THEME_UPDATE'; theme: GarsonlessTheme; context: ThemePreviewContext; requestId?: string }
  | { type: 'SET_PREVIEW_CONTEXT'; context: ThemePreviewContext }
  | { type: 'SCROLL_TO_COMPONENT'; component: 'footer' }
  | { type: 'OPEN_NAV_DRAWER'; sectionId: string | null }
)

export type ThemePreviewEvent = ThemePreviewEnvelope & (
  | { type: 'PREVIEW_READY' }
  | { type: 'THEME_APPLIED'; requestId: string }
  | {
      type: 'COMPONENT_CLICK'
      component: string
      x: number
      y: number
      iframeWidth: number
      iframeHeight: number
    }
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasValidEnvelope(value: Record<string, unknown>) {
  return value.channel === THEME_PREVIEW_CHANNEL && value.version === THEME_PREVIEW_VERSION
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function hasSafeSize(value: unknown) {
  try {
    return JSON.stringify(value).length <= MAX_MESSAGE_BYTES
  } catch {
    return false
  }
}

function isFiniteCoordinate(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 100_000
}

function envelope() {
  return {
    channel: THEME_PREVIEW_CHANNEL,
    version: THEME_PREVIEW_VERSION,
  } as const
}

function sanitizePreviewContext(value: unknown): ThemePreviewContext | null {
  if (!isRecord(value)) return null
  const surface = value.surface
  if (surface !== 'home' && surface !== 'menu' && surface !== 'auth' && surface !== 'checkout') return null
  const state = value.state
  if (state === undefined) return { surface }
  if (surface === 'auth' && (state === 'join' || state === 'otp' || state === 'success' || state === 'error')) {
    return { surface, state }
  }
  if (surface === 'checkout' && (state === 'cart' || state === 'payment' || state === 'success' || state === 'table-payment' || state === 'error')) {
    return { surface, state }
  }
  return null
}

export function createFullThemePreviewCommand(
  theme: GarsonlessTheme,
  requestId?: string,
  context: ThemePreviewContext = { surface: 'menu' },
): ThemePreviewCommand | null {
  const sanitized = sanitizeThemeTokens(theme, CANONICAL_THEME_ID)
  if (!sanitized) return null
  if (requestId !== undefined && !isBoundedString(requestId, MAX_REQUEST_ID_LENGTH)) return null
  const sanitizedContext = sanitizePreviewContext(context)
  if (!sanitizedContext) return null
  return {
    ...envelope(),
    type: 'FULL_THEME_UPDATE',
    theme: sanitized,
    context: sanitizedContext,
    ...(requestId ? { requestId } : {}),
  }
}

function createSetThemePreviewContextCommand(context: ThemePreviewContext): ThemePreviewCommand | null {
  const sanitized = sanitizePreviewContext(context)
  return sanitized ? { ...envelope(), type: 'SET_PREVIEW_CONTEXT', context: sanitized } : null
}

export function createScrollToThemeComponentCommand(): ThemePreviewCommand {
  return { ...envelope(), type: 'SCROLL_TO_COMPONENT', component: 'footer' }
}

export function createOpenThemeNavDrawerCommand(sectionId: string | null): ThemePreviewCommand | null {
  if (sectionId !== null && !isBoundedString(sectionId, MAX_COMPONENT_ID_LENGTH)) return null
  return { ...envelope(), type: 'OPEN_NAV_DRAWER', sectionId }
}

export function createThemePreviewReadyEvent(): ThemePreviewEvent {
  return { ...envelope(), type: 'PREVIEW_READY' }
}

export function createThemeAppliedEvent(requestId: string): ThemePreviewEvent | null {
  if (!isBoundedString(requestId, MAX_REQUEST_ID_LENGTH)) return null
  return { ...envelope(), type: 'THEME_APPLIED', requestId }
}

export function createThemeComponentClickEvent(input: {
  component: string
  x: number
  y: number
  iframeWidth: number
  iframeHeight: number
}): ThemePreviewEvent | null {
  if (!isBoundedString(input.component, MAX_COMPONENT_ID_LENGTH)) return null
  if (![input.x, input.y, input.iframeWidth, input.iframeHeight].every(isFiniteCoordinate)) return null
  return { ...envelope(), type: 'COMPONENT_CLICK', ...input }
}

export function parseThemePreviewCommand(value: unknown): ThemePreviewCommand | null {
  if (!isRecord(value) || !hasSafeSize(value) || !hasValidEnvelope(value)) return null

  if (value.type === 'FULL_THEME_UPDATE') {
    const requestId = value.requestId
    if (requestId !== undefined && !isBoundedString(requestId, MAX_REQUEST_ID_LENGTH)) return null
    const theme = sanitizeThemeTokens(value.theme, CANONICAL_THEME_ID)
    const context = sanitizePreviewContext(value.context)
    if (!theme || !context) return null
    return {
      ...envelope(),
      type: 'FULL_THEME_UPDATE',
      theme,
      context,
      ...(requestId ? { requestId } : {}),
    }
  }


  if (value.type === 'SET_PREVIEW_CONTEXT') {
    const context = sanitizePreviewContext(value.context)
    return context ? createSetThemePreviewContextCommand(context) : null
  }

  if (value.type === 'SCROLL_TO_COMPONENT' && value.component === 'footer') {
    return createScrollToThemeComponentCommand()
  }

  if (value.type === 'OPEN_NAV_DRAWER') {
    return createOpenThemeNavDrawerCommand(value.sectionId === null ? null : value.sectionId as string)
  }

  return null
}

export function parseThemePreviewEvent(value: unknown): ThemePreviewEvent | null {
  if (!isRecord(value) || !hasSafeSize(value) || !hasValidEnvelope(value)) return null

  if (value.type === 'PREVIEW_READY') return createThemePreviewReadyEvent()
  if (value.type === 'THEME_APPLIED') return createThemeAppliedEvent(value.requestId as string)
  if (value.type === 'COMPONENT_CLICK') {
    return createThemeComponentClickEvent({
      component: value.component as string,
      x: value.x as number,
      y: value.y as number,
      iframeWidth: value.iframeWidth as number,
      iframeHeight: value.iframeHeight as number,
    })
  }

  return null
}
