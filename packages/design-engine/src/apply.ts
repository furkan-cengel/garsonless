import type { MenuPageConfig, PageConfig, HeaderConfig, CategoryNavConfig, ProductCardConfig, CartDrawerConfig, GarsonlessTheme } from './schema'

const SHADOW_MAP: Record<ProductCardConfig['shadow'], string> = {
  none: 'none',
  sm: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
  md: '0 4px 12px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)',
  lg: '0 20px 40px rgba(0,0,0,0.16), 0 8px 20px rgba(0,0,0,0.08)',
}

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

export function buildFontsUrl(page: PageConfig): string | null {
  const fonts = [...new Set([page.fontFamily, page.fontFamilyDisplay])]
    .filter((f) => !SYSTEM_FONTS.has(f))

  if (fonts.length === 0) return null

  const params = fonts
    .map((f) => `family=${encodeURIComponent(f)}:ital,wght@0,400;0,600;0,700;1,400`)
    .join('&')

  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}

export function applyPageConfig(config: PageConfig): string {
  const fontBase = SYSTEM_FONTS.has(config.fontFamily)
    ? config.fontFamily
    : `'${config.fontFamily}', sans-serif`
  const fontDisplay = SYSTEM_FONTS.has(config.fontFamilyDisplay)
    ? config.fontFamilyDisplay
    : `'${config.fontFamilyDisplay}', serif`

  return `:root {
  --font-base: ${fontBase};
  --font-display: ${fontDisplay};
  --font-size-base: ${config.baseFontSize}px;
  --global-radius: ${config.globalRadius}px;
}
body {
  background-color: ${config.backgroundColor};
  font-family: var(--font-base);
  font-size: var(--font-size-base);
}`
}

function applyHeader(config: HeaderConfig): string {
  return `[data-component="header"] {
  background-color: ${config.backgroundColor};
  color: ${config.textColor};
  ${config.borderBottom ? 'border-bottom: 1px solid rgba(0,0,0,0.08);' : ''}
  ${config.sticky ? 'position: sticky; top: 0; z-index: 20;' : ''}
}`
}

function applyCategoryNav(config: CategoryNavConfig): string {
  return `[data-component="categoryNav"] {
  background-color: ${config.backgroundColor};
  color: ${config.textColor};
  ${config.sticky ? 'position: sticky; top: 0; z-index: 10;' : ''}
}`
}

function applyProductCard(config: ProductCardConfig): string {
  return `[data-component="productCard"] {
  background-color: ${config.backgroundColor};
  color: ${config.textColor};
  border-radius: ${config.borderRadius}px;
  box-shadow: ${SHADOW_MAP[config.shadow]};
}`
}

function applyCartDrawer(config: CartDrawerConfig): string {
  return `[data-component="cartDrawer"] {
  background-color: ${config.backgroundColor};
  color: ${config.textColor};
}`
}

export function applyComponentConfig(
  component: keyof MenuPageConfig,
  config: MenuPageConfig[keyof MenuPageConfig],
): string {
  switch (component) {
    case 'page': return applyPageConfig(config as PageConfig)
    case 'header': return applyHeader(config as HeaderConfig)
    case 'categoryNav': return applyCategoryNav(config as CategoryNavConfig)
    case 'productCard': return applyProductCard(config as ProductCardConfig)
    case 'cartDrawer': return applyCartDrawer(config as CartDrawerConfig)
    default: return ''
  }
}

export function applyFullConfig(config: MenuPageConfig): string {
  return [
    applyPageConfig(config.page),
    applyHeader(config.header),
    applyCategoryNav(config.categoryNav),
    applyProductCard(config.productCard),
    applyCartDrawer(config.cartDrawer),
  ].join('\n')
}

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
    : `"${theme.displayFont}", cursive`
  return `:root {
  --p-bg: ${theme.bg};
  --p-card: #ffffff;
  --p-display: ${displayFont};
  --p-body: ${bodyFont};
  --p-radius: ${theme.radius}px;
  --p-fs: ${theme.fs}px;
  --p-lh: ${theme.lh / 100};
  --p-accent: ${theme.accent};
  --p-accent-soft: ${theme.accentSoft};
  --p-cta: ${theme.cta};
  --p-text: #1c1d20;
  --p-text-2: #6c6f76;
  --p-shadow: ${THEME_SHADOW_MAP[theme.shadow]};
  --p-border-w: ${THEME_BORDER_W_MAP[theme.border]};
  --p-cols: ${theme.cols};
  --p-gap: ${theme.gap}px;
  --p-pad: ${theme.pad}px;
  --p-section-gap: ${theme.sectionGap}px;
}
body {
  background-color: ${theme.bg};
  font-family: ${bodyFont};
  font-size: ${theme.fs}px;
  line-height: ${theme.lh / 100};
}`
}
