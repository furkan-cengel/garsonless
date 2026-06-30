import { DEFAULT_THEME, TEMPLATES } from '@garsonless/design-engine'
import type { GarsonlessTheme } from '@garsonless/design-engine'

/**
 * Single source of truth for the menu theme.
 *
 * BOTH the SSR layout (which injects the <style> CSS variables) and the page
 * (which seeds the client ThemeProvider's initialTheme) MUST resolve the theme
 * identically. If they diverge, the server paints one theme and the client
 * repaints another on hydration → a visible color flash on first load
 * (the bug this fixes: layout fell back to DEFAULT_THEME's purple accent while
 * the page used TEMPLATES['default']'s green accent).
 *
 * Resolution: the restaurant's active template is the base; saved token overrides
 * are merged on top only when they belong to that same template and carry real
 * theme data (a top-level `bg`).
 */
export function resolveMenuTheme(args: {
  settings: Record<string, unknown> | null
  themeTokens: unknown
  /** Preview `?template=` override; null/undefined → the saved active template. */
  templateOverride?: string | null
}): { theme: GarsonlessTheme; templateId: string } {
  const savedTemplateId = typeof args.settings?.['active_template_id'] === 'string'
    ? (args.settings['active_template_id'] as string)
    : 'default'
  const templateId = args.templateOverride ?? savedTemplateId
  const baseTheme = TEMPLATES[templateId] ?? DEFAULT_THEME

  const raw = args.themeTokens
  const rawTemplateId =
    raw != null && typeof raw === 'object' && typeof (raw as Record<string, unknown>)['__template_id'] === 'string'
      ? ((raw as Record<string, unknown>)['__template_id'] as string)
      : null

  const theme: GarsonlessTheme =
    rawTemplateId === templateId && raw != null && typeof raw === 'object' && 'bg' in (raw as object)
      ? { ...baseTheme, ...(raw as Partial<GarsonlessTheme>) }
      : baseTheme

  return { theme, templateId }
}
