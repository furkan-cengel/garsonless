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

export function buildFontsUrlFromTheme(theme: GarsonlessTheme): string | null {
  const fonts = [...new Set([theme.bodyFont, theme.displayFont])]
    .filter((f) => !SYSTEM_FONTS.has(f))
  if (fonts.length === 0) return null
  const params = fonts
    .map((f) => `family=${encodeURIComponent(f)}:ital,wght@0,400;0,600;0,700;1,400`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
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
  const bodyFont = SYSTEM_FONTS.has(theme.bodyFont)
    ? theme.bodyFont
    : `"${theme.bodyFont}", sans-serif`
  const displayFont = SYSTEM_FONTS.has(theme.displayFont)
    ? theme.displayFont
    : `"${theme.displayFont}", serif`
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
