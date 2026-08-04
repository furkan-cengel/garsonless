'use client'

import { createContext, lazy, Suspense, useContext, useState, useEffect, type ReactNode } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'

const ThemePreviewBridge = lazy(() => import('./ThemePreviewBridge').then((module) => ({ default: module.ThemePreviewBridge })))

const SYSTEM_FONTS_SET = new Set([
  'Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman',
  'Bodoni 72', 'sans-serif', 'serif', 'cursive', 'monospace',
])

function injectGoogleFonts(theme: GarsonlessTheme) {
  const fonts = [...new Set([theme.bodyFont, theme.displayFont])].filter(
    (f) => f && !SYSTEM_FONTS_SET.has(f),
  )
  if (fonts.length === 0) return
  const params = fonts
    .map((f) => `family=${encodeURIComponent(f)}:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400`)
    .join('&')
  const url = `https://fonts.googleapis.com/css2?${params}&display=swap`
  const existing = document.querySelector('link[data-garsonless-fonts]') as HTMLLinkElement | null
  if (existing) {
    if (existing.href !== url) existing.href = url
  } else {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.setAttribute('data-garsonless-fonts', 'dynamic')
    document.head.appendChild(link)
  }
}

interface ThemeContextValue {
  theme: GarsonlessTheme
  isPreview: boolean
  restaurantName: string
  logoUrl: string | null
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}

const SHADOW_MAP = { none: 'none', soft: '0 1px 8px rgba(0,0,0,.07)', hard: '0 2px 16px rgba(0,0,0,.14)' } as const
const BORDER_W_MAP = { none: '0px', hair: '1px', solid: '2px' } as const

function applyNonFontVars(t: GarsonlessTheme) {
  const root = document.documentElement
  root.style.setProperty('--p-bg', t.bg)
  root.style.setProperty('--p-card', t.cardColor ?? '#ffffff')
  root.style.setProperty('--p-radius', `${t.radius}px`)
  root.style.setProperty('--p-fs', `${t.fs}px`)
  root.style.setProperty('--p-lh', `${t.lh / 100}`)
  root.style.setProperty('--p-accent', t.accent)
  root.style.setProperty('--p-accent-soft', t.accentSoft)
  root.style.setProperty('--p-cta', t.cta)
  root.style.setProperty('--p-text', t.textColor ?? '#1c1d20')
  root.style.setProperty('--p-text-2', t.mutedTextColor ?? '#6c6f76')
  root.style.setProperty('--p-cta-text', t.ctaTextColor ?? '#ffffff')
  root.style.setProperty('--p-shadow', SHADOW_MAP[t.shadow])
  root.style.setProperty('--p-border-w', BORDER_W_MAP[t.border])
  root.style.setProperty('--p-border', t.border === 'none' ? 'transparent' : (t.borderColor ?? t.accentSoft))
  root.style.setProperty('--p-cols', String(t.cols))
  root.style.setProperty('--p-gap', `${t.gap}px`)
  root.style.setProperty('--p-pad', `${t.pad}px`)
  root.style.setProperty('--p-section-gap', `${t.sectionGap}px`)
  document.body.style.backgroundColor = t.bg
  document.body.style.color = t.textColor ?? '#1c1d20'
}

function applyFontVars(bodyFont: string, displayFont: string) {
  const root = document.documentElement
  root.style.setProperty('--p-display', displayFont)
  root.style.setProperty('--p-body', bodyFont)
  document.body.style.fontFamily = bodyFont
}

async function loadAndApplyFonts(t: GarsonlessTheme) {
  const bodyFont = SYSTEM_FONTS_SET.has(t.bodyFont) ? t.bodyFont : `"${t.bodyFont}", sans-serif`
  const displayFont = SYSTEM_FONTS_SET.has(t.displayFont) ? t.displayFont : `"${t.displayFont}", serif`
  // Apply the declared stack immediately; font-display handles the eventual
  // web-font swap without blocking the editor handshake.
  applyFontVars(bodyFont, displayFont)

  const toLoad = [t.bodyFont, t.displayFont].filter((f) => f && !SYSTEM_FONTS_SET.has(f))
  if (toLoad.length > 0) {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
    try {
      await Promise.race([
        Promise.all(toLoad.map((f) => document.fonts.load(`400 16px "${f}"`))),
        new Promise<void>((r) => setTimeout(r, 3000)),
      ])
    } catch {
      // proceed even if font check fails
    }
  }

}

interface ThemeProviderProps {
  children: ReactNode
  initialTheme: GarsonlessTheme
  isPreview?: boolean
  initialRestaurantName?: string
  initialLogoUrl?: string | null
}

export function ThemeProvider({ children, initialTheme, isPreview = false, initialRestaurantName = '', initialLogoUrl = null }: ThemeProviderProps) {
  const [theme, setTheme] = useState<GarsonlessTheme>(initialTheme)

  useEffect(() => {
    injectGoogleFonts(theme)
    applyNonFontVars(theme)
    void loadAndApplyFonts(theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, isPreview, restaurantName: initialRestaurantName, logoUrl: initialLogoUrl }}>
      {isPreview ? <Suspense fallback={null}><ThemePreviewBridge theme={theme} onThemeChange={setTheme} /></Suspense> : null}
      {children}
    </ThemeContext.Provider>
  )
}
