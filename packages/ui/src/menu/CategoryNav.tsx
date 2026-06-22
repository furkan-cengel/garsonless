'use client'

import { useEffect, useRef, useState } from 'react'
import type { MenuCategory } from './types'
import { useTheme } from './ThemeContext'

interface CategoryNavProps {
  categories: MenuCategory[]
  categoryMeta?: Record<string, { imageUrl?: string | null; itemCount?: number }> | undefined
  activeCategoryId?: string | undefined
  onCategorySelect?: ((id: string) => void) | undefined
}

export function CategoryNav({ categories, categoryMeta = {}, activeCategoryId, onCategorySelect }: CategoryNavProps) {
  const { theme } = useTheme()
  const [internalActiveId, setInternalActiveId] = useState(categories[0]?.id ?? '')
  const navRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)
  const style = theme.catnavStyle
  const activeId = activeCategoryId ?? internalActiveId

  useEffect(() => {
    if (categories.length === 0) return
    const observers: IntersectionObserver[] = []
    categories.forEach((cat) => {
      const section = document.getElementById(`section-${cat.id}`)
      if (!section) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting && !isScrollingRef.current && activeCategoryId == null) setInternalActiveId(cat.id)
        },
        { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
      )
      observer.observe(section)
      observers.push(observer)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [categories, activeCategoryId])

  const scrollToCategory = (id: string) => {
    setInternalActiveId(id)
    onCategorySelect?.(id)
    isScrollingRef.current = true
    requestAnimationFrame(() => {
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    setTimeout(() => { isScrollingRef.current = false }, 800)
    navRef.current?.querySelector(`[data-cat="${id}"]`)?.scrollIntoView({
      behavior: 'smooth', block: 'nearest', inline: 'center',
    })
  }

  const acc = 'var(--p-accent)'
  const gap = style === 'visual' ? 12 : style === 'underline' ? 16 : style === 'dots' ? 12 : 8

  return (
    <nav
      data-component="catnav"
      ref={navRef}
      style={{
        background: 'var(--p-bg)',
        position: theme.stickyNav ? 'sticky' : 'relative',
        top: theme.stickyNav ? 0 : undefined,
        zIndex: theme.stickyNav ? 10 : undefined,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        borderBottom: style === 'underline' ? '1px solid rgba(0,0,0,.08)' : 'none',
      }}
    >
      <div style={{
        padding: style === 'visual'
          ? `${theme.navTopGap ?? 4}px 16px ${theme.navBottomGap ?? 16}px`
          : `${theme.navTopGap ?? 0}px 16px ${theme.navBottomGap ?? 14}px`,
        display: 'flex',
      }}>
        <div style={{
          display: 'flex',
          gap,
          background: style === 'segmented' ? 'rgba(0,0,0,.06)' : 'transparent',
          padding: style === 'segmented' ? 3 : 0,
          borderRadius: style === 'segmented' ? 9 : 0,
        }}>
          {categories.map((cat, index) => (
            <NavItem
              key={cat.id}
              cat={cat}
              index={index}
              isActive={activeId === cat.id}
              navStyle={style}
              meta={categoryMeta[cat.id] ?? null}
              acc={acc}
              onClick={() => scrollToCategory(cat.id)}
            />
          ))}
        </div>
      </div>
    </nav>
  )
}

function NavItem({
  cat,
  index,
  isActive,
  navStyle,
  meta,
  acc,
  onClick,
}: {
  cat: MenuCategory
  index: number
  isActive: boolean
  navStyle: string
  meta: { imageUrl?: string | null; itemCount?: number } | null
  acc: string
  onClick: () => void
}) {
  const { theme } = useTheme()
  const countSuffix = theme.catnavShowCount ? ` · ${String(index + 1).padStart(2, '0')}` : ''
  const base: React.CSSProperties = {
    flexShrink: 0, cursor: 'pointer', border: 'none',
    fontFamily: 'inherit', transition: 'all 150ms ease',
    background: 'transparent',
  }

  if (navStyle === 'underline') {
    return (
      <button data-cat={cat.id} onClick={onClick} style={{
        ...base, padding: '6px 2px', fontSize: 13,
        fontWeight: isActive ? 600 : 500,
        color: isActive ? acc : 'var(--p-text-2)',
        borderBottom: `2px solid ${isActive ? acc : 'transparent'}`,
      }}>{cat.name}{countSuffix}</button>
    )
  }
  if (navStyle === 'segmented') {
    return (
      <button data-cat={cat.id} onClick={onClick} style={{
        ...base, padding: '5px 11px', borderRadius: 7,
        fontSize: 12, fontWeight: isActive ? 600 : 500,
        background: isActive ? '#fff' : 'transparent',
        color: isActive ? acc : 'var(--p-text-2)',
        boxShadow: isActive ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
      }}>{cat.name}{countSuffix}</button>
    )
  }
  if (navStyle === 'visual') {
    return (
      <button data-cat={cat.id} onClick={onClick} style={{
        ...base,
        width: 118,
        minHeight: 134,
        borderRadius: 14,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        background: isActive ? acc : 'var(--p-card)',
        color: isActive ? '#fff' : 'var(--p-text-2)',
        border: isActive ? 'none' : '1px solid #e3e4e7',
        overflow: 'hidden',
        boxShadow: isActive ? '0 10px 22px -14px color-mix(in srgb, var(--p-accent) 80%, #000), var(--p-shadow)' : 'var(--p-shadow)',
      }}>
        <span
          aria-hidden
          style={{
            height: 82,
            width: '100%',
            display: 'grid',
            placeItems: 'center',
            background: meta?.imageUrl
              ? `url("${meta.imageUrl}") center/cover`
              : 'linear-gradient(135deg, #f3f4f6 0%, #e6e7eb 100%)',
            color: '#bfc1c6',
            position: 'relative',
          }}
        >
          {!meta?.imageUrl && <span style={{ fontSize: 24 }}>▧</span>}
          {isActive && (
            <span style={{
              position: 'absolute',
              inset: 0,
              background: 'color-mix(in srgb, var(--p-accent) 28%, transparent)',
            }} />
          )}
        </span>
        <span style={{
          minHeight: 52,
          padding: '9px 10px 10px',
          display: 'grid',
          alignContent: 'center',
          gap: 2,
          background: isActive ? acc : 'var(--p-card)',
        }}>
          <span style={{
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 12.5,
            lineHeight: 1.2,
            fontWeight: isActive ? 850 : 750,
            color: isActive ? '#fff' : 'var(--p-accent)',
          }}>
            {cat.name}
          </span>
          {theme.catnavShowCount && (
            <span style={{
              fontSize: 10.5,
              lineHeight: 1.2,
              fontWeight: 650,
              color: isActive ? 'rgba(255,255,255,.72)' : 'var(--p-text-2)',
            }}>
              {meta?.itemCount ?? index + 1} ürün
            </span>
          )}
        </span>
      </button>
    )
  }
  if (navStyle === 'outlined') {
    return (
      <button data-cat={cat.id} onClick={onClick} style={{
        ...base, padding: '5px 11px', borderRadius: 6,
        fontSize: 12, fontWeight: isActive ? 600 : 500,
        background: '#fff',
        color: isActive ? acc : 'var(--p-text-2)',
        border: `1px solid ${isActive ? acc : '#e3e4e7'}`,
      }}>{cat.name}{countSuffix}</button>
    )
  }
  if (navStyle === 'dots') {
    return (
      <button data-cat={cat.id} onClick={onClick} style={{
        ...base, padding: '4px 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        fontSize: 12, fontWeight: isActive ? 600 : 500,
        color: isActive ? acc : 'var(--p-text-2)',
      }}>
        {cat.name}{countSuffix}
        <span style={{ width: 4, height: 4, borderRadius: 999, background: isActive ? acc : 'transparent' }} />
      </button>
    )
  }
  return (
    <button data-cat={cat.id} onClick={onClick} style={{
      ...base, padding: '6px 12px', borderRadius: 999,
      fontSize: 12, fontWeight: isActive ? 600 : 500,
      background: isActive ? acc : 'transparent',
      color: isActive ? '#fff' : 'var(--p-text-2)',
      border: isActive ? 'none' : '1px solid #e3e4e7',
    }}>{cat.name}{countSuffix}</button>
  )
}
