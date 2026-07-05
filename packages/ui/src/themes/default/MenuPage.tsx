'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../../menu/ThemeContext'
import { Header } from '../../menu/Header'
import { CategoryNav } from '../../menu/CategoryNav'
import type { ThemeMenuPageProps } from '../types'
import type { MenuCategory } from '../../menu/types'
import type { CSSProperties } from 'react'
import { HeroSection } from './sections/HeroSection'
import { PromoStripSection } from './sections/PromoStripSection'
import { ChefPickSection } from './sections/ChefPickSection'
import { ComboRibbonSection } from './sections/ComboRibbonSection'
import { DiscountBadgeSection } from './sections/DiscountBadgeSection'
import { GallerySection } from './sections/GallerySection'
import { PromoSliderBlock } from './sections/PromoSliderSection'
import { DailySpecialBlock } from './sections/DailySpecialSection'
import {
  ModeTabsSection,
  AddressBarSection,
  QuickLinksSection,
  InfoCardSection,
  InfoBlockSection,
} from './sections/MiscSections'

export function DefaultMenuPage({ categories, categoryMeta, renderItems, menuFilters, filterEmptyState, tableId, tableLabel, cartSummary, onOpenCart, items, onQuickAdd, billSummary, onOpenBill, memberSummary, onOpenMember, memberLoyalty }: ThemeMenuPageProps) {
  const { theme, restaurantName } = useTheme()
  const visualNav = theme.catnavStyle === 'visual'
  const rootCategories = useMemo(() => categories.filter((category) => !category.parent_id), [categories])
  const rootsForNav = rootCategories.length > 0 ? rootCategories : categories
  const [activeVisualRootId, setActiveVisualRootId] = useState(rootsForNav[0]?.id ?? '')
  const childCategories = useMemo(
    () => categories.filter((category) => category.parent_id === activeVisualRootId),
    [categories, activeVisualRootId],
  )
  const [activeVisualCategoryId, setActiveVisualCategoryId] = useState(childCategories[0]?.id ?? rootsForNav[0]?.id ?? '')
  useEffect(() => {
    if (!rootsForNav.some((category) => category.id === activeVisualRootId)) {
      setActiveVisualRootId(rootsForNav[0]?.id ?? '')
    }
  }, [rootsForNav, activeVisualRootId])
  useEffect(() => {
    const nextActive = childCategories[0]?.id ?? activeVisualRootId
    if (!categories.some((category) => category.id === activeVisualCategoryId) || ![activeVisualRootId, ...childCategories.map((category) => category.id)].includes(activeVisualCategoryId)) {
      setActiveVisualCategoryId(nextActive)
    }
  }, [categories, childCategories, activeVisualCategoryId, activeVisualRootId])
  const textureStyle: CSSProperties =
    theme.texture === 'grid'
      ? {
          backgroundImage: 'linear-gradient(rgba(0,0,0,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.035) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }
      : theme.texture === 'noise'
        ? {
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.055) 1px, transparent 0)',
            backgroundSize: '14px 14px',
          }
        : {}

  function sectionHeadingStyle(): CSSProperties {
    const sh = theme.sectionHeading ?? 'accent'
    if (sh === 'editorial') return {
      padding: `32px var(--p-pad) 8px`,
      fontSize: `calc(var(--p-fs) + 4px)`,
      fontWeight: 800,
      fontFamily: 'var(--p-display)',
      color: 'var(--p-text)',
      letterSpacing: '-0.02em',
      textTransform: 'uppercase',
      margin: 0,
    }
    if (sh === 'catalog') return {
      padding: `20px var(--p-pad) 6px`,
      fontSize: `calc(var(--p-fs) - 1px)`,
      fontWeight: 700,
      fontFamily: 'var(--p-body)',
      color: 'var(--p-text-2)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      margin: 0,
    }
    return {
      padding: `24px var(--p-pad) 12px`,
      fontSize: `calc(var(--p-fs) + 6px)`,
      fontWeight: 700,
      fontFamily: 'var(--p-display)',
      color: 'var(--p-accent)',
      margin: 0,
      lineHeight: 1,
    }
  }

  function renderSection(cat: MenuCategory) {
    return (
      <section key={cat.id} id={`section-${cat.id}`} style={{ marginBottom: 'var(--p-section-gap)' }}>
        <h2 style={sectionHeadingStyle()}>{cat.name}</h2>
        <div
          style={{
            padding: `0 var(--p-pad)`,
            display: 'grid',
            gap: 'var(--p-gap)',
            gridTemplateColumns:
              theme.cardLayout === 'vertical'
                ? `repeat(var(--p-cols), 1fr)`
                : '1fr',
          }}
        >
          {renderItems(cat.id)}
        </div>
      </section>
    )
  }

  function renderCategoryGrid({
    title,
    items,
    activeId,
    onSelect,
  }: {
    title?: string | undefined
    items: MenuCategory[]
    activeId: string
    onSelect: (id: string) => void
  }) {
    if (items.length === 0) return null
    const visualStyle = theme.catnavVisualStyle ?? 'compact'
    const isOverlay = visualStyle === 'overlay'
    const isPoster = visualStyle === 'poster'
    const visualWidth = theme.catnavVisualCardWidth ?? 150
    const visualHeight = theme.catnavVisualCardHeight ?? 104
    const visualRadius = theme.catnavVisualRadius ?? 22
    const overlayOpacity = Math.max(0, Math.min(90, theme.catnavOverlayOpacity ?? 45)) / 100
    const overlayBlur = Math.max(0, theme.catnavOverlayBlur ?? 0)
    const overlayColor = theme.catnavOverlayColor ?? '#000000'
    const overlayTextPosition = theme.catnavOverlayTextPosition ?? 'center'
    const overlayTextAlign = theme.catnavOverlayTextAlign ?? 'center'
    const overlayPlacement: Record<string, CSSProperties> = {
      center: { inset: 0, alignItems: 'center', justifyContent: 'center' },
      'bottom-left': { left: 0, right: 0, bottom: 0, alignItems: 'flex-start', justifyContent: 'flex-end' },
      'bottom-center': { left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-end' },
      'bottom-right': { left: 0, right: 0, bottom: 0, alignItems: 'flex-end', justifyContent: 'flex-end' },
      'top-left': { left: 0, right: 0, top: 0, alignItems: 'flex-start', justifyContent: 'flex-start' },
      'top-center': { left: 0, right: 0, top: 0, alignItems: 'center', justifyContent: 'flex-start' },
      'top-right': { left: 0, right: 0, top: 0, alignItems: 'flex-end', justifyContent: 'flex-start' },
    }
    return (
      <section
        data-component="visual-category-grid"
        style={{
          padding: `${theme.categoryGridTopGap ?? 18}px var(--p-pad) ${theme.navBottomGap ?? 14}px`,
        }}
      >
        {title && (
          <h2 style={{
            ...sectionHeadingStyle(),
            padding: '0 0 12px',
          }}>
            {title}
          </h2>
        )}
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 10,
            marginRight: 'calc(var(--p-pad) * -1)',
            paddingRight: 'var(--p-pad)',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
            scrollSnapType: 'x proximity',
          }}
        >
          {items.map((cat, index) => {
            const meta = categoryMeta?.[cat.id]
            const isActive = activeId === cat.id
            const imageBg = meta?.imageUrl
              ? `url("${meta.imageUrl}") center/cover`
              : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.id)}
                style={{
                  width: isOverlay ? visualWidth : isPoster ? Math.max(104, visualWidth - 32) : Math.max(150, visualWidth + 18),
                  minWidth: isOverlay ? visualWidth : isPoster ? Math.max(104, visualWidth - 32) : Math.max(150, visualWidth + 18),
                  minHeight: isOverlay ? visualHeight : isPoster ? Math.max(130, visualHeight + 44) : Math.max(78, visualHeight - 16),
                  border: isActive ? '1px solid var(--p-accent)' : 'var(--p-border-w) solid var(--p-border)',
                  borderRadius: isOverlay ? visualRadius : isPoster ? visualRadius : Math.max(18, visualRadius + 4),
                  background: isOverlay
                    ? imageBg
                    : isActive
                      ? 'linear-gradient(135deg, var(--p-accent), color-mix(in srgb, var(--p-accent) 86%, #111))'
                      : 'var(--p-card)',
                  color: isActive || isOverlay ? '#fff' : 'var(--p-accent)',
                  boxShadow: isActive
                    ? '0 16px 26px -18px color-mix(in srgb, var(--p-accent) 88%, #000), var(--p-shadow)'
                    : '0 10px 24px -22px rgba(22, 30, 24, .45), var(--p-shadow)',
                  overflow: 'hidden',
                  padding: isOverlay ? 0 : isPoster ? 0 : 9,
                  display: 'flex',
                  flexDirection: isPoster ? 'column' : 'row',
                  alignItems: isPoster ? 'stretch' : 'center',
                  justifyContent: isOverlay ? 'center' : undefined,
                  gap: isOverlay ? 0 : 11,
                  textAlign: 'left',
                  cursor: 'pointer',
                  font: 'inherit',
                  scrollSnapAlign: 'start',
                  position: 'relative',
                  transition: 'transform 160ms ease, box-shadow 160ms ease, background 160ms ease',
                }}
              >
                {isOverlay && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: isActive
                        ? `linear-gradient(180deg, color-mix(in srgb, var(--p-accent) 22%, transparent), color-mix(in srgb, var(--p-accent) 68%, ${overlayColor}))`
                        : `linear-gradient(180deg, rgba(255,255,255,.04), color-mix(in srgb, ${overlayColor} ${Math.round(overlayOpacity * 100)}%, transparent))`,
                      backdropFilter: overlayBlur > 0 ? `blur(${overlayBlur}px)` : 'none',
                      WebkitBackdropFilter: overlayBlur > 0 ? `blur(${overlayBlur}px)` : 'none',
                    }}
                  />
                )}
                {!isOverlay && (
                  <span
                    aria-hidden
                    style={{
                      width: isPoster ? '100%' : 68,
                      height: isPoster ? Math.max(76, visualHeight - 18) : 68,
                      borderRadius: isPoster ? 0 : Math.max(14, visualRadius - 4),
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      background: imageBg,
                      color: '#bfc1c6',
                      position: 'relative',
                      overflow: 'hidden',
                      border: isPoster ? 'none' : isActive ? '2px solid rgba(255,255,255,.54)' : '1px solid rgba(0,0,0,.04)',
                    }}
                  >
                    {!meta?.imageUrl && <span style={{ fontSize: 26 }}>▧</span>}
                    {isActive && !isPoster && (
                      <span style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'color-mix(in srgb, var(--p-accent) 20%, transparent)',
                      }} />
                    )}
                  </span>
                )}
                <span
                  style={{
                    flex: isPoster ? '1 1 auto' : 1,
                    minWidth: isOverlay ? '100%' : 0,
                    padding: isOverlay ? 12 : isPoster ? '11px 10px 12px' : '0 2px 0 0',
                    display: 'grid',
                    alignContent: 'center',
                    gap: 4,
                    background: isPoster
                      ? isActive ? 'var(--p-accent)' : 'var(--p-card)'
                      : 'transparent',
                    position: 'relative',
                    zIndex: 1,
                    ...(isOverlay
                      ? {
                          position: 'absolute',
                          display: 'flex',
                          flexDirection: 'column',
                          minHeight: overlayTextPosition === 'center' ? '100%' : 58,
                          textAlign: overlayTextAlign,
                          ...(overlayPlacement[overlayTextPosition] ?? overlayPlacement.center),
                        }
                      : {}),
                  }}
                >
                  <span style={{
                    fontSize: isPoster ? 'calc(var(--p-fs) - 1px)' : 'calc(var(--p-fs) + 0px)',
                    lineHeight: 1.12,
                    fontWeight: 900,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflowWrap: 'anywhere',
                    textAlign: isOverlay ? overlayTextAlign : isPoster ? 'center' : 'left',
                    textShadow: isOverlay ? '0 1px 8px rgba(0,0,0,.34)' : 'none',
                    color: isOverlay ? (theme.catnavOverlayTextColor ?? '#ffffff') : undefined,
                  }}>
                    {cat.name}
                  </span>
                  {theme.catnavShowCount && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 750,
                      color: isActive || isOverlay ? 'rgba(255,255,255,.76)' : 'var(--p-text-2)',
                      textAlign: isOverlay ? overlayTextAlign : isPoster ? 'center' : 'left',
                    }}>
                      {meta?.itemCount ?? index + 1} ürün
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  function renderCustomSection(sectionId: string) {
    const config: Record<string, string> = theme.sectionSettings?.[sectionId] ?? {}

    if (sectionId === 'hero-note' || sectionId === 'hero-banner') {
      return <HeroSection key={sectionId} sectionId={sectionId} config={config} restaurantName={restaurantName} pageDescription={theme.pageDescription} />
    }
    if (sectionId === 'mode-tabs') {
      return <ModeTabsSection key={sectionId} config={config} />
    }
    if (sectionId === 'address-bar' || sectionId === 'search') {
      return <AddressBarSection key={sectionId} sectionId={sectionId} config={config} />
    }
    if (sectionId === 'promo-strip') {
      return <PromoStripSection key={sectionId} config={config} />
    }
    if (sectionId === 'quick-links' || sectionId === 'cat-pills' || sectionId === 'cat-underline' || sectionId === 'cat-images') {
      return <QuickLinksSection key={sectionId} categories={categories} />
    }
    if (sectionId === 'chef-pick') {
      return <ChefPickSection key={sectionId} config={config} />
    }
    if (sectionId === 'chef-picks' || sectionId === 'featured-scroll' || sectionId === 'minimal-list') {
      return <InfoCardSection key={sectionId} sectionId={sectionId} />
    }
    if (sectionId === 'combo-ribbon') {
      return <ComboRibbonSection key={sectionId} config={config} />
    }
    if (sectionId === 'discount-badge') {
      return <DiscountBadgeSection key={sectionId} config={config} />
    }
    if (sectionId === 'promo-slider') {
      return <PromoSliderBlock key={sectionId} config={config} memberLoyalty={memberLoyalty ?? null} />
    }
    if (sectionId === 'daily-special') {
      return <DailySpecialBlock key={sectionId} config={config} items={items} {...(onQuickAdd ? { onQuickAdd } : {})} />
    }
    if (sectionId === 'gallery') {
      return <GallerySection key={sectionId} config={config} />
    }
    if (sectionId === 'reviews' || sectionId === 'hours' || sectionId === 'allergens' || sectionId === 'service-info' || sectionId === 'request-buttons' || sectionId === 'waiter-call' || sectionId === 'wifi-info' || sectionId === 'bill-summary' || sectionId === 'social-block' || sectionId === 'footer') {
      return <InfoBlockSection key={sectionId} sectionId={sectionId} config={config} restaurantName={restaurantName} />
    }

    return null
  }

  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const pageBlocks = useMemo(() => {
    const stored = theme.pageBlocks?.filter((block) =>
      block.type === 'section' ||
      block.type === 'nav' ||
      (block.type === 'category' && categoryById.has(block.id)),
    ) ?? []
    const result = stored.length > 0
      ? (stored.some((block) => block.type === 'nav')
          ? stored
          : [{ type: 'nav' as const, id: 'category-nav' }, ...stored])
      : [
          { type: 'nav' as const, id: 'category-nav' },
          ...(theme.sections ?? []).map((id) => ({ type: 'section' as const, id })),
          ...categories.map((category) => ({ type: 'category' as const, id: category.id })),
        ]
    return result
  }, [categories, categoryById, theme.pageBlocks, theme.sections])
  const selectedCategoryBlockIndex = visualNav
    ? pageBlocks.findIndex((block) => block.type === 'category' && block.id === activeVisualCategoryId)
    : -1

  return (
    <div suppressHydrationWarning style={{ minHeight: '100dvh', backgroundColor: 'var(--p-bg)', ...textureStyle }}>
      <Header tableId={tableId ?? null} tableName={tableLabel ?? null} categories={categories} cartSummary={cartSummary} onOpenCart={onOpenCart} billSummary={billSummary ?? null} onOpenBill={onOpenBill} memberSummary={memberSummary ?? null} onOpenMember={onOpenMember} />
      <main style={{ paddingBottom: 96 }}>
        {pageBlocks.map((block) => {
          if (block.type === 'section') return renderCustomSection(block.id)
          if (block.type === 'nav') {
            if (visualNav) {
              return (
                <div key="category-nav">
                  {renderCategoryGrid({
                    items: rootsForNav,
                    activeId: activeVisualRootId,
                    onSelect: (id) => {
                      setActiveVisualRootId(id)
                      const firstChild = categories.find((category) => category.parent_id === id)
                      setActiveVisualCategoryId(firstChild?.id ?? id)
                    },
                  })}
                  {childCategories.length > 0 && renderCategoryGrid({
                    title: categoryById.get(activeVisualRootId)?.name,
                    items: childCategories,
                    activeId: activeVisualCategoryId,
                    onSelect: setActiveVisualCategoryId,
                  })}
                  {menuFilters}
                  {filterEmptyState}
                </div>
              )
            }
            return (
              <div key="category-nav">
                <CategoryNav
                  categories={categories}
                  categoryMeta={categoryMeta}
                  activeCategoryId={undefined}
                  onCategorySelect={undefined}
                />
                {menuFilters}
                {filterEmptyState}
              </div>
            )
          }
          if (visualNav && block.id !== activeVisualCategoryId) return null
          const category = categoryById.get(block.id)
          if (!category) return null
          const section = renderSection(category)
          return visualNav && selectedCategoryBlockIndex >= 0
            ? <div key={`visual-category-${category.id}`} style={{ animation: 'garsonless-category-fade 180ms ease' }}>{section}</div>
            : section
        })}
      </main>
      {visualNav && (
        <style>{`
          @keyframes garsonless-category-fade {
            from { opacity: .45; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      )}
    </div>
  )
}
