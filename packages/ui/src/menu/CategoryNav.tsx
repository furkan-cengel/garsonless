'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MenuCategory } from './types'
import { useTheme } from './ThemeContext'
import {
  getActiveCategoryAtLine,
  getCategoryScrollEdges,
  getCenteredCategoryScrollLeft,
} from './categoryNavModel'

interface CategoryNavProps {
  categories: MenuCategory[]
  categoryMeta?: Record<string, { imageUrl?: string | null; itemCount?: number }> | undefined
  activeCategoryId?: string | undefined
  onCategorySelect?: ((id: string) => void) | undefined
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}

export function CategoryNav({ categories, categoryMeta = {}, activeCategoryId, onCategorySelect }: CategoryNavProps) {
  const { theme } = useTheme()
  const prefersReducedMotion = usePrefersReducedMotion()
  const [internalActiveId, setInternalActiveId] = useState(categories[0]?.id ?? '')
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false })
  const navRef = useRef<HTMLDivElement>(null)
  const manualActiveIdRef = useRef<string | null>(null)
  const manualActiveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const style = theme.catnavStyle
  const requestedActiveId = activeCategoryId ?? internalActiveId
  const activeId = categories.some((category) => category.id === requestedActiveId)
    ? requestedActiveId
    : categories[0]?.id ?? ''
  const updateMeasurements = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const nextEdges = getCategoryScrollEdges({
      scrollLeft: nav.scrollLeft,
      containerWidth: nav.clientWidth,
      scrollWidth: nav.scrollWidth,
    })
    setScrollEdges((current) => current.left === nextEdges.left && current.right === nextEdges.right
      ? current
      : nextEdges)
    document.documentElement.style.setProperty('--p-catnav-sticky-height', `${nav.getBoundingClientRect().height}px`)
  }, [])

  const centerCategory = useCallback((id: string, behavior: ScrollBehavior) => {
    const nav = navRef.current
    const item = nav?.querySelector<HTMLElement>(`[data-cat="${CSS.escape(id)}"]`)
    if (!nav || !item) return
    const navRect = nav.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    nav.scrollTo({
      left: getCenteredCategoryScrollLeft({
        containerLeft: navRect.left,
        containerWidth: nav.clientWidth,
        currentScrollLeft: nav.scrollLeft,
        itemLeft: itemRect.left,
        itemWidth: itemRect.width,
        scrollWidth: nav.scrollWidth,
      }),
      behavior,
    })
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(updateMeasurements)
    const observer = new ResizeObserver(updateMeasurements)
    if (navRef.current) observer.observe(navRef.current)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [categories, style, updateMeasurements])

  useEffect(() => {
    if (activeCategoryId != null || categories.length === 0) return
    let frame = 0
    const updateActiveCategory = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const activationLine = Math.max(0, navRef.current?.getBoundingClientRect().bottom ?? 0) + 1
        const sections = categories.flatMap((category) => {
          const section = document.getElementById(`section-${category.id}`)
          return section ? [{ id: category.id, top: section.getBoundingClientRect().top }] : []
        })
        const reachedPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
        const manualId = manualActiveIdRef.current
        if (manualId) {
          const target = sections.find((section) => section.id === manualId)
          setInternalActiveId(manualId)
          if (reachedPageEnd || (target && target.top <= activationLine + 2)) {
            manualActiveIdRef.current = null
            if (manualActiveTimerRef.current) clearTimeout(manualActiveTimerRef.current)
            manualActiveTimerRef.current = null
          }
          return
        }
        const nextId = getActiveCategoryAtLine(sections, activationLine, reachedPageEnd)
        if (nextId) setInternalActiveId((current) => current === nextId ? current : nextId)
      })
    }
    updateActiveCategory()
    window.addEventListener('scroll', updateActiveCategory, { passive: true })
    window.addEventListener('resize', updateActiveCategory)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', updateActiveCategory)
      window.removeEventListener('resize', updateActiveCategory)
    }
  }, [categories, activeCategoryId])

  useEffect(() => {
    if (activeCategoryId == null && !categories.some((category) => category.id === internalActiveId)) {
      setInternalActiveId(categories[0]?.id ?? '')
    }
  }, [activeCategoryId, categories, internalActiveId])

  useEffect(() => {
    if (!activeId || !(theme.catnavAutoCenter ?? true)) return
    const frame = requestAnimationFrame(() => centerCategory(activeId, theme.motion === 'none' || prefersReducedMotion ? 'auto' : 'smooth'))
    return () => cancelAnimationFrame(frame)
  }, [activeId, centerCategory, prefersReducedMotion, theme.catnavAutoCenter, theme.motion])

  const scrollToCategory = (id: string) => {
    manualActiveIdRef.current = id
    if (manualActiveTimerRef.current) clearTimeout(manualActiveTimerRef.current)
    manualActiveTimerRef.current = setTimeout(() => {
      manualActiveIdRef.current = null
      manualActiveTimerRef.current = null
    }, 1_200)
    setInternalActiveId(id)
    onCategorySelect?.(id)
    requestAnimationFrame(() => {
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: theme.motion === 'none' || prefersReducedMotion ? 'auto' : 'smooth', block: 'start' })
    })
  }

  const handleCategoryKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const nextIndex = event.key === 'ArrowRight'
      ? Math.min(categories.length - 1, index + 1)
      : event.key === 'ArrowLeft'
        ? Math.max(0, index - 1)
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? categories.length - 1
            : null
    if (nextIndex === null) return
    event.preventDefault()
    const next = categories[nextIndex]
    if (!next) return
    scrollToCategory(next.id)
    navRef.current?.querySelector<HTMLButtonElement>(`[data-cat="${next.id}"]`)?.focus()
  }

  const acc = 'var(--p-accent)'
  const gap = theme.catnavItemGap ?? (style === 'visual' ? 12 : style === 'underline' ? 16 : style === 'dots' ? 12 : 8)
  const align = theme.catnavAlign ?? 'left'

  return (
    <nav
      data-component="catnav"
      aria-label="Ürün kategorileri"
      ref={navRef}
      onScroll={updateMeasurements}
      data-scroll-left={scrollEdges.left ? 'true' : 'false'}
      data-scroll-right={scrollEdges.right ? 'true' : 'false'}
      style={{
        background: 'var(--p-bg)',
        position: theme.stickyNav ? 'sticky' : 'relative',
        top: theme.stickyNav ? (theme.stickyHeader ? `var(--p-header-sticky-height, ${theme.headerHeight}px)` : 0) : undefined,
        zIndex: theme.stickyNav ? 10 : undefined,
        overflowX: 'auto',
        overscrollBehaviorX: 'contain',
        WebkitOverflowScrolling: 'touch',
        scrollPaddingInline: 'var(--p-pad)',
        scrollbarWidth: 'none',
        borderBottom: style === 'underline' ? '1px solid var(--p-border)' : 'none',
        maskImage: theme.catnavEdgeFade && (scrollEdges.left || scrollEdges.right)
          ? `linear-gradient(90deg, ${scrollEdges.left ? 'transparent 0, #000 18px' : '#000 0'}, #000 calc(100% - 18px), ${scrollEdges.right ? 'transparent 100%' : '#000 100%'})`
          : undefined,
      }}
    >
      <style>{`[data-component="catnav"]::-webkit-scrollbar{display:none}[data-component="catnav"] button:focus-visible{outline:2px solid var(--p-accent);outline-offset:2px}`}</style>
      <div style={{
        padding: style === 'visual'
          ? `${theme.navTopGap ?? 4}px var(--p-pad) ${theme.navBottomGap ?? 16}px`
          : `${theme.navTopGap ?? 10}px var(--p-pad) ${theme.navBottomGap ?? 14}px`,
        display: 'flex',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        minWidth: align === 'spread' ? '100%' : 'max-content',
      }}>
        <div style={{
          display: 'flex',
          width: align === 'spread' ? '100%' : 'max-content',
          justifyContent: align === 'spread' ? 'space-between' : undefined,
          gap,
          background: style === 'segmented' ? 'var(--p-accent-soft)' : 'transparent',
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
              onKeyDown={(event) => handleCategoryKeyDown(event, index)}
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
  onKeyDown,
}: {
  cat: MenuCategory
  index: number
  isActive: boolean
  navStyle: string
  meta: { imageUrl?: string | null; itemCount?: number } | null
  acc: string
  onClick: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
}) {
  const { theme } = useTheme()
  const countSuffix = theme.catnavShowCount ? ` · ${meta?.itemCount ?? 0}` : ''
  const density = theme.catnavDensity ?? 'normal'
  const minHeight = density === 'compact' ? 44 : density === 'comfortable' ? 52 : 48
  const fontSize = theme.catnavFontSize ?? 12
  const activeStyle = theme.catnavActiveStyle ?? 'filled'
  const base: React.CSSProperties = {
    flexShrink: 0, cursor: 'pointer', border: 'none',
    fontFamily: 'inherit', transition: 'all 150ms ease',
    background: 'transparent', minHeight,
  }
  const a11y = { type: 'button' as const, 'aria-current': isActive ? 'location' as const : undefined, onKeyDown }

  if (navStyle === 'underline') {
    return (
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={{
        ...base, padding: '6px 2px', fontSize: fontSize + 1,
        fontWeight: isActive ? 600 : 500,
        color: isActive ? acc : 'var(--p-text-2)',
        borderBottom: `2px solid ${isActive ? acc : 'transparent'}`,
      }}>{cat.name}{countSuffix}</button>
    )
  }
  if (navStyle === 'segmented') {
    return (
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={{
        ...base, padding: '5px 11px', borderRadius: 7,
        fontSize, fontWeight: isActive ? 600 : 500,
        background: isActive ? (activeStyle === 'soft' ? 'var(--p-accent-soft)' : 'var(--p-card)') : 'transparent',
        color: isActive ? acc : 'var(--p-text-2)',
        boxShadow: isActive ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
      }}>{cat.name}{countSuffix}</button>
    )
  }
  if (navStyle === 'visual') {
    return (
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={{
        ...base,
        width: 118,
        minHeight: 134,
        borderRadius: 14,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        background: isActive ? acc : 'var(--p-card)',
        color: isActive ? 'var(--p-cta-text)' : 'var(--p-text-2)',
        border: isActive ? 'none' : '1px solid var(--p-border)',
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
              : 'linear-gradient(135deg, var(--p-card) 0%, var(--p-accent-soft) 100%)',
            color: 'var(--p-text-2)',
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
            color: isActive ? 'var(--p-cta-text)' : 'var(--p-accent)',
          }}>
            {cat.name}
          </span>
          {theme.catnavShowCount && (
            <span style={{
              fontSize: 10.5,
              lineHeight: 1.2,
              fontWeight: 650,
              color: isActive ? 'color-mix(in srgb, var(--p-cta-text) 72%, transparent)' : 'var(--p-text-2)',
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
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={{
        ...base, padding: '5px 11px', borderRadius: 6,
        fontSize, fontWeight: isActive ? 600 : 500,
        background: 'var(--p-card)',
        color: isActive ? acc : 'var(--p-text-2)',
        border: `1px solid ${isActive ? acc : 'var(--p-border)'}`,
      }}>{cat.name}{countSuffix}</button>
    )
  }
  if (navStyle === 'dots') {
    return (
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={{
        ...base, padding: '4px 8px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        fontSize, fontWeight: isActive ? 600 : 500,
        color: isActive ? acc : 'var(--p-text-2)',
      }}>
        {cat.name}{countSuffix}
        <span style={{ width: 4, height: 4, borderRadius: 999, background: isActive ? acc : 'transparent' }} />
      </button>
    )
  }
  return (
    <button {...a11y} data-cat={cat.id} onClick={onClick} style={{
      ...base, padding: '6px 12px', borderRadius: 999,
      fontSize, fontWeight: isActive ? 600 : 500,
      background: isActive ? (activeStyle === 'filled' ? acc : activeStyle === 'soft' ? 'var(--p-accent-soft)' : 'transparent') : 'transparent',
      color: isActive ? (activeStyle === 'filled' ? 'var(--p-cta-text)' : acc) : 'var(--p-text-2)',
      border: `1px solid ${isActive && activeStyle === 'outline' ? acc : isActive && activeStyle === 'filled' ? 'transparent' : 'var(--p-border)'}`,
    }}>{cat.name}{countSuffix}</button>
  )
}
