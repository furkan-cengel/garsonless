'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { MenuCategory } from './types'
import { useTheme } from './ThemeContext'
import {
  getActiveCategoryAtLine,
  getCategoryNavActiveTreatment,
  getCategoryScrollEdges,
  getCenteredCategoryScrollLeft,
} from './categoryNavModel'

interface CategoryNavProps {
  categories: MenuCategory[]
  categoryMeta?: Record<string, { imageUrl?: string | null; itemCount?: number }> | undefined
  activeCategoryId?: string | undefined
  onCategorySelect?: ((id: string) => void) | undefined
  leadingControl?: ReactNode
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

export function CategoryNav({ categories, categoryMeta = {}, activeCategoryId, onCategorySelect, leadingControl }: CategoryNavProps) {
  const { theme } = useTheme()
  const prefersReducedMotion = usePrefersReducedMotion()
  const [internalActiveId, setInternalActiveId] = useState(categories[0]?.id ?? '')
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: false })
  const [contentFits, setContentFits] = useState(false)
  const [navigationStatus, setNavigationStatus] = useState('')
  const navRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLElement>(null)
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
    setContentFits((current) => {
      const next = nav.scrollWidth <= nav.clientWidth + 2
      return current === next ? current : next
    })
    document.documentElement.style.setProperty('--p-catnav-sticky-height', `${shellRef.current?.getBoundingClientRect().height ?? nav.getBoundingClientRect().height}px`)
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
    if (shellRef.current) observer.observe(shellRef.current)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.documentElement.style.removeProperty('--p-catnav-sticky-height')
    }
  }, [categories, style, updateMeasurements])

  useEffect(() => {
    if (activeCategoryId != null || categories.length === 0) return
    let frame = 0
    const updateActiveCategory = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const activationLine = Math.max(0, shellRef.current?.getBoundingClientRect().bottom ?? 0) + 1
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
      if (internalActiveId) setNavigationStatus('Aktif kategori artık görünür olmadığı için ilk görünür kategori seçildi.')
    }
  }, [activeCategoryId, categories, internalActiveId])

  useEffect(() => {
    if (!activeId) return
    const frame = requestAnimationFrame(() => centerCategory(activeId, theme.motion === 'none' || prefersReducedMotion ? 'auto' : 'smooth'))
    return () => cancelAnimationFrame(frame)
  }, [activeId, centerCategory, prefersReducedMotion, theme.motion])

  const scrollToCategory = (id: string) => {
    manualActiveIdRef.current = id
    if (manualActiveTimerRef.current) clearTimeout(manualActiveTimerRef.current)
    manualActiveTimerRef.current = setTimeout(() => {
      manualActiveIdRef.current = null
      manualActiveTimerRef.current = null
    }, 1_200)
    setInternalActiveId(id)
    onCategorySelect?.(id)
    const nextHash = `#category-${encodeURIComponent(id)}`
    if (window.location.hash !== nextHash) {
      window.history.pushState({ ...window.history.state, garsonlessCategoryId: id }, '', nextHash)
    }
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
  const density = theme.catnavDensity ?? 'normal'
  const gap = density === 'compact' ? 6 : density === 'comfortable' ? 10 : 8

  return (
    <nav
      data-component="catnav"
      aria-label="Ürün kategorileri"
      ref={shellRef}
      data-scroll-left={scrollEdges.left ? 'true' : 'false'}
      data-scroll-right={scrollEdges.right ? 'true' : 'false'}
      style={{
        background: 'var(--p-bg)',
        position: theme.stickyNav ? 'sticky' : 'relative',
        top: theme.stickyNav ? (theme.stickyHeader ? `calc(var(--p-header-sticky-height, ${theme.headerHeight}px) + var(--p-header-sticky-gap, 0px))` : 0) : undefined,
        zIndex: theme.stickyNav ? 'var(--p-layer-catnav, 10)' : undefined,
        borderBottom: style === 'underline' ? '1px solid var(--p-border)' : 'none',
      }}
    >
      <style>{`
        [data-catnav-scroll]::-webkit-scrollbar{display:none}
        [data-component="catnav"] button:focus-visible{outline:2px solid var(--p-accent);outline-offset:2px}
        @media (hover:hover) and (pointer:fine){
          [data-component="catnav"] button:hover [data-catnav-chip],
          [data-component="menu-filters"] [data-filter-trigger]:hover [data-filter-trigger-surface]{filter:brightness(.97)}
        }
        @media (prefers-reduced-motion:reduce){
          [data-component="catnav"] [data-catnav-chip]{transition:none!important}
        }
        @media (max-width:767px){
          [data-component="catnav"] [data-catnav-chip]{max-width:220px!important}
        }
      `}</style>
      {navigationStatus && <span role="status" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>{navigationStatus}</span>}
      <div style={{
        padding: style === 'visual'
          ? `${theme.navTopGap ?? 4}px var(--p-pad) ${theme.navBottomGap ?? 16}px`
          : `${theme.navTopGap ?? 10}px var(--p-pad) ${theme.navBottomGap ?? 14}px`,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        {leadingControl}
        <div
          ref={navRef}
          data-catnav-scroll
          onScroll={updateMeasurements}
          style={{
            minWidth: 0,
            flex: 1,
            overflowX: 'auto',
            overscrollBehaviorX: 'contain',
            WebkitOverflowScrolling: 'touch',
            scrollPaddingInline: 2,
            scrollbarWidth: 'none',
            maskImage: (scrollEdges.left || scrollEdges.right)
              ? `linear-gradient(90deg, ${scrollEdges.left ? 'transparent 0, #000 18px' : '#000 0'}, #000 calc(100% - 18px), ${scrollEdges.right ? 'transparent 100%' : '#000 100%'})`
              : undefined,
          }}
        >
          <div style={{
            display: 'flex',
            width: 'max-content',
            minWidth: '100%',
            justifyContent: contentFits ? 'center' : 'flex-start',
            gap,
            background: style === 'segmented' ? 'color-mix(in srgb, var(--p-border) 68%, transparent)' : 'transparent',
            padding: style === 'segmented' ? 3 : 0,
            borderRadius: style === 'segmented' ? 9 : 0,
          }}>
            {categories.map((cat, index) => (
              <NavItem
                key={cat.id}
                cat={cat}
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
      </div>
    </nav>
  )
}

function NavItem({
  cat,
  isActive,
  navStyle,
  meta,
  acc,
  onClick,
  onKeyDown,
}: {
  cat: MenuCategory
  isActive: boolean
  navStyle: string
  meta: { imageUrl?: string | null; itemCount?: number } | null
  acc: string
  onClick: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void
}) {
  const { theme } = useTheme()
  const density = theme.catnavDensity ?? 'normal'
  const visibleHeight = density === 'compact' ? 32 : density === 'comfortable' ? 40 : 36
  const fontSize = 'clamp(12px, calc(var(--p-fs) - 2px), 17px)'
  const activeStyle = theme.catnavActiveStyle ?? 'filled'
  const supportsActiveStyle = ['pills', 'segmented', 'outlined'].includes(navStyle)
  const activeTreatment = getCategoryNavActiveTreatment(activeStyle, acc)
  const base: React.CSSProperties = {
    flexShrink: 0,
    minWidth: 44,
    minHeight: 44,
    padding: 0,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
    background: 'transparent',
    color: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  const selectedSurface: React.CSSProperties = isActive ? {
    background: activeTreatment.background,
    color: activeTreatment.color,
    borderColor: activeTreatment.borderColor,
    boxShadow: activeTreatment.boxShadow,
  } : {}
  const count = meta?.itemCount ?? 0
  const a11y = {
    type: 'button' as const,
    'aria-current': isActive ? 'location' as const : undefined,
    'aria-label': theme.catnavShowCount ? `${cat.name}, ${count} ürün` : cat.name,
    title: cat.name,
    onKeyDown,
  }
  const surfaceBase: React.CSSProperties = {
    minHeight: visibleHeight,
    maxWidth: 280,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize,
    lineHeight: 'var(--p-line-tight)',
    transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
    pointerEvents: 'none',
  }
  const label = (
    <>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
      {theme.catnavShowCount && (
        <span aria-hidden="true" style={{ minWidth: 18, height: 18, paddingInline: 5, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, lineHeight: 1, fontWeight: 800, background: isActive && supportsActiveStyle && activeStyle === 'filled' ? 'color-mix(in srgb, var(--p-cta-text) 18%, transparent)' : 'color-mix(in srgb, currentColor 10%, transparent)' }}>{count}</span>
      )}
    </>
  )

  if (navStyle === 'underline') {
    return (
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={base}>
        <span data-catnav-chip style={{ ...surfaceBase, padding: '5px 8px', borderRadius: 6, fontWeight: isActive ? 700 : 550, color: isActive ? acc : 'var(--p-text-2)', border: '1px solid transparent', borderBottomWidth: 2, borderBottomColor: isActive ? acc : 'transparent' }}>{label}</span>
      </button>
    )
  }
  if (navStyle === 'segmented') {
    return (
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={base}>
        <span data-catnav-chip style={{ ...surfaceBase, padding: '5px 11px', borderRadius: 7, border: '1px solid transparent', fontWeight: isActive ? 700 : 550, color: 'var(--p-text-2)', ...selectedSurface }}>{label}</span>
      </button>
    )
  }
  if (navStyle === 'outlined') {
    return (
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={base}>
        <span data-catnav-chip style={{ ...surfaceBase, padding: '5px 11px', borderRadius: 6, fontWeight: isActive ? 700 : 550, background: 'var(--p-card)', color: 'var(--p-text-2)', border: '1px solid var(--p-border)', ...selectedSurface }}>{label}</span>
      </button>
    )
  }
  if (navStyle === 'dots') {
    return (
      <button {...a11y} data-cat={cat.id} onClick={onClick} style={base}>
        <span data-catnav-chip style={{ ...surfaceBase, padding: '3px 8px', borderRadius: 7, border: '1px solid transparent', flexDirection: 'column', gap: 2, fontWeight: isActive ? 700 : 550, color: isActive ? acc : 'var(--p-text-2)' }}>
        {label}
        <span style={{ width: 4, height: 4, borderRadius: 999, background: isActive ? acc : 'transparent' }} />
        </span>
      </button>
    )
  }
  return (
    <button {...a11y} data-cat={cat.id} onClick={onClick} style={base}>
      <span data-catnav-chip style={{ ...surfaceBase, padding: '5px 12px', borderRadius: 999, fontWeight: isActive ? 700 : 550, color: 'var(--p-text-2)', border: '1px solid var(--p-border)', ...selectedSurface }}>{label}</span>
    </button>
  )
}
