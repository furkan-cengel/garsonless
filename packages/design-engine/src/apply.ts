import type { GarsonlessTheme } from './schema'

const SYSTEM_FONTS = new Set([
  'Arial',
  'Helvetica',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Bodoni 72',
  'sans-serif',
  'serif',
  'cursive',
  'monospace',
])

const SELF_HOSTED_FONT_VARIABLES: Record<string, string> = {
  'DM Sans': 'var(--font-dm-sans)',
  Fraunces: 'var(--font-fraunces)',
  Inter: 'var(--font-inter)',
  'Playfair Display': 'var(--font-playfair)',
  Manrope: 'var(--font-manrope)',
  Nunito: 'var(--font-nunito)',
  Fredoka: 'var(--font-fredoka)',
  'Fredoka One': 'var(--font-fredoka)',
  Pacifico: 'var(--font-pacifico)',
}

/**
 * Maps a theme font name to a usable `font-family` value. Self-hosted fonts are
 * loaded under hashed family names, so their raw names never match a face and
 * the browser would fall back to its default serif.
 */
export function resolveThemeFontFamily(font: string, fallback: 'sans-serif' | 'serif'): string {
  return SELF_HOSTED_FONT_VARIABLES[font] ?? (SYSTEM_FONTS.has(font) ? font : fallback)
}

export function buildFontsUrlFromTheme(theme: GarsonlessTheme): string | null {
  void theme
  return null
}

const THEME_SHADOW_MAP: Record<GarsonlessTheme['shadow'], string> = {
  none: 'none',
  soft: '0 1px 8px rgba(0,0,0,.07)',
  hard: '0 2px 16px rgba(0,0,0,.14)',
}

const THEME_BORDER_W_MAP: Record<GarsonlessTheme['border'], string> = {
  none: '0px',
  hair: '1px',
  solid: '2px',
}

export function applyGarsonlessTheme(theme: GarsonlessTheme): string {
  const bodyFont = resolveThemeFontFamily(theme.bodyFont, 'sans-serif')
  const displayFont = resolveThemeFontFamily(theme.displayFont, 'serif')
  return `:root {
  --p-bg: ${theme.bg};
  --p-card: ${theme.cardColor ?? '#ffffff'};
  --p-display: ${displayFont};
  --p-body: ${bodyFont};
  --p-radius: ${theme.radius}px;
  --p-fs: ${theme.fs}px;
  --p-lh: ${theme.lh / 100};
  --p-accent: ${theme.accent};
  --p-accent-soft: ${theme.accentSoft};
  --p-cta: ${theme.cta};
  --p-text: ${theme.textColor ?? '#1c1d20'};
  --p-text-2: ${theme.mutedTextColor ?? '#6c6f76'};
  --p-cta-text: ${theme.ctaTextColor ?? '#ffffff'};
  --p-shadow: ${THEME_SHADOW_MAP[theme.shadow]};
  --p-border-w: ${THEME_BORDER_W_MAP[theme.border]};
  --p-border: ${theme.border === 'none' ? 'transparent' : (theme.borderColor ?? theme.accentSoft)};
  --p-cols: ${theme.cols};
  --p-gap: ${theme.gap}px;
  --p-pad: ${theme.pad}px;
  --p-section-gap: ${theme.sectionGap}px;
}
body {
  background-color: ${theme.bg};
  color: ${theme.textColor ?? '#1c1d20'};
  font-family: ${bodyFont};
  font-size: ${theme.fs}px;
  line-height: ${theme.lh / 100};
}`
}
