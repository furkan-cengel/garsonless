'use client'
import { useMenuLocale } from './MenuLocaleContext'
import React, { type CSSProperties, type ReactNode } from 'react'
import { ALLERGEN_CODES, ALLERGEN_LABELS } from '@garsonless/db/browser'
import type { AllergenCode } from './types'

const GLYPHS: Record<AllergenCode, ReactNode> = {
  gluten: <><path d="M12 21V4"/><path d="M12 8c-2.8 0-4.5-1.8-4.5-4 2.8 0 4.5 1.8 4.5 4Zm0 5c-2.8 0-4.5-1.8-4.5-4 2.8 0 4.5 1.8 4.5 4Zm0 5c-2.8 0-4.5-1.8-4.5-4 2.8 0 4.5 1.8 4.5 4Zm0-10c2.8 0 4.5-1.8 4.5-4C13.7 4 12 5.8 12 8Zm0 5c2.8 0 4.5-1.8 4.5-4-2.8 0-4.5 1.8-4.5 4Zm0 5c2.8 0 4.5-1.8 4.5-4-2.8 0-4.5 1.8-4.5 4Z"/></>,
  crustaceans: <><path d="M9 8.5c0-2 1.3-3.5 3-3.5s3 1.5 3 3.5V14a3 3 0 0 1-6 0V8.5Z"/><path d="M9 10 5 7M15 10l4-3M9 13l-5 1.5M15 13l5 1.5M9.5 17 7 20M14.5 17l2.5 3"/><circle cx="11" cy="8.5" r=".5" fill="currentColor" stroke="none"/><circle cx="13" cy="8.5" r=".5" fill="currentColor" stroke="none"/></>,
  eggs: <path d="M18 14.5c0 3.6-2.7 6.5-6 6.5s-6-2.9-6-6.5S8.7 3 12 3s6 7.9 6 11.5Z"/>,
  fish: <><path d="M3 12c3.4-4.4 9.4-5.6 14-2.8L21 6v12l-4-3.2C12.4 17.6 6.4 16.4 3 12Z"/><circle cx="8" cy="11.5" r=".7" fill="currentColor" stroke="none"/></>,
  peanuts: <><path d="M9.3 3.5c2.2 0 3.9 1.7 3.9 3.8 0 1.4-.7 2.5-1.7 3.3-1 .8-1.7 1.9-1.7 3.3a4.1 4.1 0 0 1-4.1 4.2A3.7 3.7 0 0 1 2 14.3c0-1.8 1.2-3.1 2.6-4 1.1-.7 1.7-1.8 1.4-3.1-.4-2 1.1-3.7 3.3-3.7Z"/><path d="m6 11 4 4M7.7 8.5l4.1 4.1"/></>,
  soy: <><path d="M5 19c0-7.5 5.2-13 14-14-.1 8.8-5.5 14-14 14Z"/><path d="M7 17c3-3.8 6.2-6.4 10-8"/><circle cx="10" cy="14" r="1.2"/><circle cx="14" cy="10.7" r="1.2"/></>,
  milk: <><path d="M8 3h7l2 4v13H7V7l1-4Z"/><path d="M8 3l4 4h5M7 10h10"/><path d="M10 14c1-1 3-1 4 0v3c-1 1-3 1-4 0v-3Z"/></>,
  tree_nuts: <><path d="M12 4c4.2 0 7 3.1 7 7.4 0 5.2-3.2 8.6-7 8.6s-7-3.4-7-8.6C5 7.1 7.8 4 12 4Z"/><path d="M8.3 8.5c2.5 2.1 4.9 2.1 7.4 0M8.3 13c2.5 2.1 4.9 2.1 7.4 0M12 4v16"/></>,
  celery: <><path d="M12 21V8M8 21V10M16 21V10"/><path d="M12 9c-2.8 0-5-2.2-5-5 2.8 0 5 2.2 5 5Zm0 0c2.8 0 5-2.2 5-5-2.8 0-5 2.2-5 5ZM8 12c-2.2 0-4-1.8-4-4 2.2 0 4 1.8 4 4Zm8 0c2.2 0 4-1.8 4-4-2.2 0-4 1.8-4 4Z"/></>,
  mustard: <><path d="M9 3h6v4l2 2v11H7V9l2-2V3Z"/><path d="M9 7h6M9 13h6"/><circle cx="10" cy="16.5" r=".7" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r=".7" fill="currentColor" stroke="none"/><circle cx="14" cy="17" r=".7" fill="currentColor" stroke="none"/></>,
  sesame: <><ellipse cx="8" cy="9" rx="2.2" ry="3.4" transform="rotate(-28 8 9)"/><ellipse cx="15.5" cy="14.5" rx="2.2" ry="3.4" transform="rotate(28 15.5 14.5)"/><path d="M6.8 7.2 9.2 11M14.3 12.7l2.4 3.7"/></>,
  sulphites: <><path d="M7 3h10l-1 6a4 4 0 0 1-8 0L7 3Z"/><path d="M12 13v6M8.5 21h7"/><circle cx="10" cy="7" r=".7" fill="currentColor" stroke="none"/><circle cx="13.5" cy="5.8" r=".7" fill="currentColor" stroke="none"/></>,
  lupin: <><path d="M12 21v-8"/><circle cx="12" cy="8" r="3"/><circle cx="8.5" cy="11.5" r="3"/><circle cx="15.5" cy="11.5" r="3"/><path d="M12 17c-2.6 0-4.5-1.4-5.5-3.5M12 17c2.6 0 4.5-1.4 5.5-3.5"/></>,
  molluscs: <><path d="M4 16c0-5 3.6-9 8-9s8 4 8 9H4Z"/><path d="M4 16c2.2 3.3 5 5 8 5s5.8-1.7 8-5M12 7v9M7.5 9.3 10 16M16.5 9.3 14 16"/></>,
}

export function sortAllergenCodes(codes: Iterable<AllergenCode>): AllergenCode[] {
  const selected = new Set(codes)
  return ALLERGEN_CODES.filter((code) => selected.has(code))
}

export function AllergenIcon({ code, size = 18, decorative = false, style }: {
  code: AllergenCode
  size?: number
  decorative?: boolean
  style?: CSSProperties
}) {
  const { t } = useMenuLocale();
  const label = t(ALLERGEN_LABELS[code])
  return <svg
    data-allergen-icon={code}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.65}
    strokeLinecap="round"
    strokeLinejoin="round"
    role={decorative ? undefined : 'img'}
    aria-hidden={decorative ? 'true' : undefined}
    aria-label={decorative ? undefined : label}
    style={{ display: 'block', flexShrink: 0, ...style }}
  >
    {GLYPHS[code]}
  </svg>
}

export function AllergenIconList({ codes, maxVisible, showLabels = false, variant = 'contains', size = 18, style }: {
  codes: Iterable<AllergenCode>
  maxVisible?: number
  showLabels?: boolean
  variant?: 'contains' | 'trace'
  size?: number
  style?: CSSProperties
}) {
  const { t } = useMenuLocale();
  const sorted = sortAllergenCodes(codes)
  if (sorted.length === 0) return null
  const visible = maxVisible === undefined ? sorted : sorted.slice(0, Math.max(0, maxVisible))
  const hidden = sorted.slice(visible.length)
  const contains = variant === 'contains'
  const tone = contains ? '#7a4300' : 'var(--p-text-2)'
  const background = contains ? '#fff2df' : 'rgba(241,245,249,.72)'
  const border = contains ? '1px solid rgba(180,83,9,.18)' : '1px dashed rgba(71,85,105,.38)'

  return <div
    data-component="allergen-icon-list"
    data-allergen-variant={variant}
    aria-label={contains ? t("Ürünün içerdiği alerjenler") : t("Olası çapraz temas alerjenleri")}
    style={{ display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',minWidth:0,...style }}
  >
    {visible.map((code) => <span
      key={code}
      title={t(ALLERGEN_LABELS[code])}
      aria-label={t(ALLERGEN_LABELS[code])}
      style={{
        minWidth: showLabels ? undefined : size + 8,
        height: showLabels ? 30 : size + 8,
        padding: showLabels ? '0 9px 0 7px' : 4,
        borderRadius: showLabels ? 8 : 7,
        display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,
        background,color:tone,border,fontSize:11.5,fontWeight:800,lineHeight:1,
      }}
    >
      <AllergenIcon code={code} size={size} decorative />
      {showLabels && <span>{t(ALLERGEN_LABELS[code])}</span>}
    </span>)}
    {hidden.length > 0 && <span
      title={hidden.map((code) => t(ALLERGEN_LABELS[code])).join(', ')}
      aria-label={t("Diğer alerjenler: {names}", { names: hidden.map((code) => t(ALLERGEN_LABELS[code])).join(', ') })}
      style={{height:size+8,minWidth:size+13,padding:'0 5px',borderRadius:7,display:'inline-flex',alignItems:'center',justifyContent:'center',background,color:tone,border,fontSize:10,fontWeight:900,lineHeight:1}}
    >+{hidden.length}</span>}
  </div>
}
