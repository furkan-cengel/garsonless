'use client'

import { createContext, lazy, Suspense, useCallback, useContext, useState, useEffect, type ReactNode } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { TAG_SHIMMER_CSS } from './tagShimmer'

const ThemePreviewBridge = lazy(() => import('./ThemePreviewBridge').then((module) => ({ default: module.ThemePreviewBridge })))

const SYSTEM_FONTS_SET = new Set([
  'Arial', 'Helvetica', 'Verdana', 'Georgia', 'Times New Roman',
  'Bodoni 72', 'sans-serif', 'serif', 'cursive', 'monospace',
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
  root.style.setProperty('--p-text-xs', 'clamp(10px, calc(var(--p-fs) - 4px), 13px)')
  root.style.setProperty('--p-text-sm', 'clamp(11px, calc(var(--p-fs) - 2px), 15px)')
  root.style.setProperty('--p-text-md', 'clamp(13px, var(--p-fs), 18px)')
  root.style.setProperty('--p-text-lg', 'clamp(16px, calc(var(--p-fs) + 4px), 24px)')
  root.style.setProperty('--p-text-xl', 'clamp(20px, calc(var(--p-fs) + 8px), 32px)')
  root.style.setProperty('--p-line-body', 'var(--p-lh)')
  root.style.setProperty('--p-line-tight', 'clamp(1.1, calc(var(--p-lh) - .18), 1.35)')
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
  document.body.style.lineHeight = String(t.lh / 100)
}

function applyFontVars(bodyFont: string, displayFont: string) {
  const root = document.documentElement
  root.style.setProperty('--p-display', displayFont)
  root.style.setProperty('--p-body', bodyFont)
  document.body.style.fontFamily = bodyFont
}

function loadAndApplyFonts(t: GarsonlessTheme) {
  const bodyFont = SELF_HOSTED_FONT_VARIABLES[t.bodyFont]
    ?? (SYSTEM_FONTS_SET.has(t.bodyFont) ? t.bodyFont : 'sans-serif')
  const displayFont = SELF_HOSTED_FONT_VARIABLES[t.displayFont]
    ?? (SYSTEM_FONTS_SET.has(t.displayFont) ? t.displayFont : 'serif')
  applyFontVars(bodyFont, displayFont)
}

interface ThemeProviderProps {
  children: ReactNode
  initialTheme: GarsonlessTheme
  isPreview?: boolean
  initialRestaurantName?: string
  initialLogoUrl?: string | null
  onThemeChange?: (theme: GarsonlessTheme) => void
}

export function ThemeScope({ children, theme }: { children: ReactNode; theme: GarsonlessTheme }) {
  const parent = useTheme()
  return <ThemeContext.Provider value={{ ...parent, theme }}>{children}</ThemeContext.Provider>
}

export function ThemeProvider({ children, initialTheme, isPreview = false, initialRestaurantName = '', initialLogoUrl = null, onThemeChange }: ThemeProviderProps) {
  const [theme, setTheme] = useState<GarsonlessTheme>(initialTheme)
  const handlePreviewThemeChange = useCallback((nextTheme: GarsonlessTheme) => {
    setTheme(nextTheme)
    onThemeChange?.(nextTheme)
  }, [onThemeChange])

  useEffect(() => {
    applyNonFontVars(theme)
    loadAndApplyFonts(theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, isPreview, restaurantName: initialRestaurantName, logoUrl: initialLogoUrl }}>
      <style>{TAG_SHIMMER_CSS}</style>
      {isPreview ? <Suspense fallback={null}><ThemePreviewBridge theme={theme} onThemeChange={handlePreviewThemeChange} /></Suspense> : null}
      {children}
    </ThemeContext.Provider>
  )
}
