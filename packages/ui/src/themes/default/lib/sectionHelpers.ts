import type { CSSProperties } from 'react'
import type { ConfigReaders } from './sectionTypes'

// Outer shell shared by every custom section wrapper.
export const customSectionShell: CSSProperties = {
  padding: '14px var(--p-pad) 2px',
}

// Parse a "HH:MM" string into a Date for today; null when not a valid HH:MM.
export function parseCountdownTarget(value: string): Date | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const target = new Date()
  target.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return target
}

// Build the config readers (text/number/bool/targetHref) over a section's
// raw settings record. Extracted verbatim from renderCustomSection so every
// section reads its settings identically.
export function makeReaders(config: Record<string, string>): ConfigReaders {
  const text = (key: string, fallback: string) => config[key]?.trim() || fallback
  const number = (key: string, fallback: number) => {
    const raw = config[key]?.trim()
    if (!raw) return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const bool = (key: string, fallback = false) => {
    if (config[key] === 'true') return true
    if (config[key] === 'false') return false
    return fallback
  }
  const targetHref = () => {
    const target = resolveSectionTarget(config)
    return target.kind === 'anchor' || target.kind === 'external' ? target.href : '#'
  }
  return { text, number, bool, targetHref }
}

export type SectionTarget =
  | { kind: 'none' }
  | { kind: 'cart' }
  | { kind: 'anchor'; href: string }
  | { kind: 'external'; href: string }

/** Resolve editor-owned CTA settings into a safe, actionable menu target. */
export function resolveSectionTarget(config: Record<string, string>): SectionTarget {
  const targetType = config.targetType?.trim() || 'none'
  const targetId = config.targetId?.trim() || ''
  const targetUrl = config.targetUrl?.trim() || ''

  if (targetType === 'category' && targetId) return { kind: 'anchor', href: `#section-${targetId}` }
  if (targetType === 'product' && targetId) return { kind: 'anchor', href: `#product-${targetId}` }
  if (targetType === 'cart') return { kind: 'cart' }
  if (targetType === 'link' && /^https?:\/\//i.test(targetUrl)) return { kind: 'external', href: targetUrl }
  return { kind: 'none' }
}
