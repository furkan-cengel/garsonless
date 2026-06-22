# Skill: Design Engine — Garsonless

## Purpose

Generate and apply restaurant theme tokens to the menu app.
Powers the Shopify-grade visual customization system.

## Token Schema (TypeScript)

interface ThemeTokens {
brand: {
primary: string
secondary: string
accent: string
background: string
surface: string
text: string
textMuted: string
}
typography: {
fontFamily: string
fontFamilyDisplay: string
baseFontSize: number
scaleRatio: number
}
shape: {
borderRadius: number
cardRadius: number
buttonRadius: number
}
spacing: {
density: 'compact' | 'comfortable' | 'spacious'
}
shadow: {
level: 'none' | 'subtle' | 'medium' | 'dramatic'
}
components: {
productCard: ProductCardTokens
categoryNav: CategoryNavTokens
cartDrawer: CartDrawerTokens
header: HeaderTokens
orderButton: OrderButtonTokens
aiChat: AIChatTokens
}
}

## CSS Variable Generation

- Generate --color-primary, --color-secondary etc. from brand tokens
- Generate --radius-base, --radius-card, --radius-button
- Generate --font-base, --font-display
- Inject via generateThemeCSS(tokens: ThemeTokens): string

## Template Registry

8 built-in templates in packages/design-engine/templates/:

- noir, mercato, bento, beachside, steakhouse, fast, mezze, minimal
  Each is a complete ThemeTokens object + component layout config.
