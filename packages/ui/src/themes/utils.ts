import type { GarsonlessTheme } from '@garsonless/design-engine'

const SHADOW_MAP: Record<GarsonlessTheme['shadow'], string> = {
  none: 'none',
  soft: '0 1px 8px rgba(0,0,0,.07)',
  hard: '0 2px 16px rgba(0,0,0,.14)',
}

const BORDER_W_MAP: Record<GarsonlessTheme['border'], string> = {
  none: '0px',
  hair: '1px',
  solid: '2px',
}

const SYSTEM_FONTS = new Set(['Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana', 'Trebuchet MS'])

export function computeThemeVars(t: GarsonlessTheme): Record<string, string> {
  const bodyFont = SYSTEM_FONTS.has(t.bodyFont) ? t.bodyFont : `"${t.bodyFont}", sans-serif`
  const displayFont = SYSTEM_FONTS.has(t.displayFont) ? t.displayFont : `"${t.displayFont}", cursive`
  return {
    '--p-bg': t.bg,
    '--p-card': '#ffffff',
    '--p-display': displayFont,
    '--p-body': bodyFont,
    '--p-radius': `${t.radius}px`,
    '--p-fs': `${t.fs}px`,
    '--p-lh': `${t.lh / 100}`,
    '--p-accent': t.accent,
    '--p-accent-soft': t.accentSoft,
    '--p-cta': t.cta,
    '--p-text': '#1c1d20',
    '--p-text-2': '#6c6f76',
    '--p-shadow': SHADOW_MAP[t.shadow],
    '--p-border-w': BORDER_W_MAP[t.border],
    '--p-border': t.border === 'none' ? 'transparent' : t.accentSoft,
    '--p-cols': String(t.cols),
    '--p-gap': `${t.gap}px`,
    '--p-pad': `${t.pad}px`,
    '--p-section-gap': `${t.sectionGap}px`,
  }
}
