'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../../menu/ThemeContext'
import { Header } from '../../menu/Header'
import { MenuFooter } from '../../menu/MenuFooter'
import { CategoryNav } from '../../menu/CategoryNav'
import type { ThemeMenuPageProps } from '../types'
import type { MenuCategory } from '../../menu/types'
import type { CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import { CustomSectionRenderer } from './sections/CustomSectionRenderer'
import { deriveActivePromoSliderCampaigns } from './sections/promoSliderCampaignModel'
import {
  getSectionDefinitionId,
  getSectionVisibility,
  isSectionBlockVisibleInContext,
} from '@garsonless/design-engine/section-blocks'
import type { ThemePageBlock } from '@garsonless/design-engine'

export function DefaultMenuPage({ categories, categoryMeta, renderItems, menuFilters, orderStatus, filterEmptyState, tableId, tableLabel, cartSummary, onOpenCart, items, onQuickAdd, onAddCombo, billSummary, onOpenBill, memberSummary, onOpenMember, onServiceRequest, onOpenServiceRequests, memberLoyalty, storeInfo }: ThemeMenuPageProps) {
  const { theme, restaurantName } = useTheme()
  const visualNav = theme.catnavStyle === 'visual'
  const orderedCategories = useMemo(() => {
    const flowOrder = new Map(
      (theme.pageBlocks ?? [])
        .filter((block) => block.type === 'category')
        .map((block, index) => [block.id, index]),
    )
    return categories
      .map((category, index) => ({ category, index }))
      .sort((a, b) => (flowOrder.get(a.category.id) ?? Number.MAX_SAFE_INTEGER) - (flowOrder.get(b.category.id) ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
      .map(({ category }) => category)
  }, [categories, theme.pageBlocks])
  const rootCategories = useMemo(() => orderedCategories.filter((category) => !category.parent_id), [orderedCategories])
  const rootsForNav = rootCategories.length > 0 ? rootCategories : orderedCategories
  const [activeVisualRootId, setActiveVisualRootId] = useState(rootsForNav[0]?.id ?? '')
  const childCategories = useMemo(
    () => orderedCategories.filter((category) => category.parent_id === activeVisualRootId),
    [orderedCategories, activeVisualRootId],
  )
  const [activeVisualCategoryId, setActiveVisualCategoryId] = useState(childCategories[0]?.id ?? rootsForNav[0]?.id ?? '')
  const [visualStage, setVisualStage] = useState<'roots' | 'children' | 'products'>('roots')
  const textureAlpha = Math.max(1, Math.min(10, theme.textureStrength ?? 4)) / 100
  const pageMaxWidth = theme.pageMaxWidth === '960' ? 960 : theme.pageMaxWidth === '1200' ? 1200 : undefined
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
          backgroundImage: `linear-gradient(rgba(0,0,0,${textureAlpha}) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,${textureAlpha}) 1px, transparent 1px)`,
          backgroundSize: '18px 18px',
        }
      : theme.texture === 'noise'
        ? {
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,${textureAlpha}) 1px, transparent 0)`,
            backgroundSize: '14px 14px',
          }
        : {}

  function sectionHeadingStyle(): CSSProperties {
    const sh = theme.sectionHeading ?? 'accent'
    if (sh === 'editorial') return {
      padding: `${theme.sectionHeadingTopGap ?? 32}px var(--p-pad) ${theme.sectionHeadingBottomGap ?? 8}px`,
      fontSize: `calc(var(--p-fs) + 4px)`,
      fontWeight: 800,
      fontFamily: 'var(--p-display)',
      color: 'var(--p-text)',
      letterSpacing: '-0.02em',
      textTransform: 'uppercase',
      margin: 0,
    }
    if (sh === 'catalog') return {
      padding: `${theme.sectionHeadingTopGap ?? 20}px var(--p-pad) ${theme.sectionHeadingBottomGap ?? 6}px`,
      fontSize: `calc(var(--p-fs) - 1px)`,
      fontWeight: 700,
      fontFamily: 'var(--p-body)',
      color: 'var(--p-text-2)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      margin: 0,
    }
    return {
      padding: `${theme.sectionHeadingTopGap ?? 24}px var(--p-pad) ${theme.sectionHeadingBottomGap ?? 12}px`,
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
      <section key={cat.id} id={`section-${cat.id}`} style={{
        marginBottom: 'var(--p-section-gap)',
        scrollMarginTop: theme.stickyNav
          ? `calc(${theme.stickyHeader ? `var(--p-header-sticky-height, ${theme.headerHeight}px)` : '0px'} + var(--p-catnav-sticky-height, 68px) + 8px)`
          : theme.stickyHeader
            ? `calc(var(--p-header-sticky-height, ${theme.headerHeight}px) + 8px)`
            : 8,
      }}>
        <h2 style={sectionHeadingStyle()}>{cat.name}</h2>
        <div
          data-product-grid
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
          padding: `${theme.navTopGap ?? 18}px var(--p-pad) ${theme.navBottomGap ?? 14}px`,
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
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gap: 12,
            paddingBottom: 10,
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
                  width: '100%',
                  minWidth: 0,
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

  const visibilityCategories = useMemo(
    () => categories.map((category) => ({ id: category.id, parentId: category.parent_id ?? null })),
    [categories],
  )

  function renderCustomSection(
    block: ThemePageBlock,
    context: { view: 'home' } | { view: 'category'; categoryId: string },
  ) {
    const sectionId = getSectionDefinitionId(block)
    if (!sectionId || !isSectionBlockVisibleInContext(block, context, visibilityCategories)) return null
    const config: Record<string, string> = theme.sectionSettings?.[block.id]
      ?? theme.sectionSettings?.[sectionId]
      ?? {}
    return (
      <CustomSectionRenderer
        key={block.id}
        sectionId={sectionId}
        sectionInstanceId={block.id}
        config={config}
        theme={theme}
        categories={categories}
        restaurantName={restaurantName}
        {...(theme.pageDescription ? { pageDescription: theme.pageDescription } : {})}
        memberLoyalty={memberLoyalty ?? null}
        activeCampaigns={activePromoSliderCampaigns}
        {...(items ? { items } : {})}
        {...(onQuickAdd ? { onQuickAdd } : {})}
        {...(onAddCombo ? { onAddCombo } : {})}
        {...(onOpenCart ? { onOpenCart } : {})}
        storeInfo={storeInfo ?? null}
      />
    )
  }

  function renderVisualTrail() {
    if (visualStage === 'roots') return null
    const rootName = categoryById.get(activeVisualRootId)?.name ?? 'Kategoriler'
    const activeName = categoryById.get(activeVisualCategoryId)?.name ?? rootName
    return (
      <div style={{ padding: `${theme.navTopGap ?? 12}px var(--p-pad) 0`, display: 'flex', alignItems: 'center', gap: 9 }}>
        <button
          type="button"
          aria-label="Bir önceki kategori seviyesine dön"
          onClick={() => setVisualStage(visualStage === 'products' && childCategories.length > 0 ? 'children' : 'roots')}
          style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 999, border: 'var(--p-border-w) solid var(--p-border)', background: 'var(--p-card)', color: 'var(--p-text)', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}
        ><ArrowLeft size={18} strokeWidth={2} aria-hidden="true" /></button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--p-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Kategoriler · {rootName}{visualStage === 'products' && activeName !== rootName ? ` · ${activeName}` : ''}
          </div>
          <div style={{ marginTop: 2, fontFamily: 'var(--p-display)', fontWeight: 800, fontSize: 20, color: 'var(--p-accent)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {visualStage === 'products' ? activeName : rootName}
          </div>
        </div>
      </div>
    )
  }

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )
  const pageBlocks = useMemo(() => {
    const categoryIds = new Set(categories.map((category) => category.id))
    const stored = theme.pageBlocks?.filter((block) =>
      block.type === 'section' ||
      block.type === 'nav' ||
      (block.type === 'category' && categoryById.has(block.id)),
    ) ?? []
    const result: ThemePageBlock[] = stored.length > 0
      ? (stored.some((block) => block.type === 'nav')
          ? stored
          : [{ type: 'nav' as const, id: 'category-nav' }, ...stored])
      : [
          { type: 'nav' as const, id: 'category-nav' },
          ...(theme.sections ?? []).map((id) => ({ type: 'section' as const, id })),
          ...categories.map((category) => ({ type: 'category' as const, id: category.id })),
        ]
    const seen = new Set(result.map((block) => `${block.type}:${block.id}`))
    for (const category of categories) {
      if (!seen.has(`category:${category.id}`)) result.push({ type: 'category', id: category.id })
    }
    const childrenByParent = new Map<string, typeof result>()
    for (const block of result) {
      if (block.type !== 'category') continue
      const parentId = categories.find((category) => category.id === block.id)?.parent_id
      if (!parentId || !categoryIds.has(parentId)) continue
      const children = childrenByParent.get(parentId) ?? []
      children.push(block)
      childrenByParent.set(parentId, children)
    }
    const normalized: typeof result = []
    for (const block of result) {
      if (block.type === 'category' && categories.find((category) => category.id === block.id)?.parent_id) continue
      normalized.push(block)
      if (block.type === 'category') normalized.push(...(childrenByParent.get(block.id) ?? []))
    }
    return normalized
  }, [categories, categoryById, theme.pageBlocks, theme.sections])
  const activePromoSliderCampaigns = useMemo(
    () => deriveActivePromoSliderCampaigns({
      pageBlocks,
      sectionSettings: theme.sectionSettings ?? {},
      items: items ?? [],
    }),
    [items, pageBlocks, theme.sectionSettings],
  )

  return (
    <div suppressHydrationWarning style={{ minHeight: '100dvh', backgroundColor: 'var(--p-bg)', ...textureStyle }}>
      <Header
        tableId={tableId ?? null}
        tableName={tableLabel ?? null}
        categories={orderedCategories}
        {...(categoryMeta ? { categoryMeta } : {})}
        onCategorySelect={(categoryId) => {
          if (!visualNav) {
            document.getElementById(`section-${categoryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            return
          }
          const category = categoryById.get(categoryId)
          if (!category) return
          const rootId = category.parent_id ?? category.id
          const children = orderedCategories.filter((candidate) => candidate.parent_id === rootId)
          setActiveVisualRootId(rootId)
          setActiveVisualCategoryId(category.id)
          setVisualStage(category.parent_id || children.length === 0 ? 'products' : 'children')
        }}
        cartSummary={cartSummary}
        onOpenCart={onOpenCart}
        billSummary={billSummary ?? null}
        onOpenBill={onOpenBill}
        memberSummary={memberSummary ?? null}
        onOpenMember={onOpenMember}
        onServiceRequest={onServiceRequest}
        onOpenServiceRequests={onOpenServiceRequests}
        storeInfo={storeInfo ?? null}
      />
      {orderStatus}
      <main style={{ paddingBottom: theme.footerEnabled ? Math.max(24, theme.sectionGap) : 96, width: '100%', maxWidth: pageMaxWidth, marginInline: 'auto' }}>
        {pageBlocks.map((block) => {
          if (block.type === 'section') {
            if (block.placement === 'drawer') return null
            if (!visualNav && getSectionVisibility(block).mode === 'categories') return null
            const context = visualNav && visualStage !== 'roots'
              ? { view: 'category' as const, categoryId: visualStage === 'products' ? activeVisualCategoryId : activeVisualRootId }
              : { view: 'home' as const }
            return renderCustomSection(block, context)
          }
          if (block.type === 'nav') {
            if (visualNav) {
              return (
                <div key="category-nav">
                  {renderVisualTrail()}
                  {visualStage === 'roots' && renderCategoryGrid({
                    items: rootsForNav,
                    activeId: activeVisualRootId,
                    onSelect: (id) => {
                      setActiveVisualRootId(id)
                      const children = categories.filter((category) => category.parent_id === id)
                      setActiveVisualCategoryId(children[0]?.id ?? id)
                      setVisualStage(children.length > 0 ? 'children' : 'products')
                    },
                  })}
                  {visualStage === 'children' && childCategories.length > 0 && renderCategoryGrid({
                    items: childCategories,
                    activeId: activeVisualCategoryId,
                    onSelect: (id) => { setActiveVisualCategoryId(id); setVisualStage('products') },
                  })}
                  {visualStage === 'products' && menuFilters}
                  {visualStage === 'products' && filterEmptyState}
                  {visualStage === 'products' && categoryById.get(activeVisualCategoryId) && renderSection(categoryById.get(activeVisualCategoryId)!)}
                </div>
              )
            }
            return (
              <div key="category-nav" style={{ display: 'contents' }}>
                <CategoryNav
                  categories={orderedCategories}
                  categoryMeta={categoryMeta}
                  activeCategoryId={undefined}
                  onCategorySelect={undefined}
                />
                {menuFilters}
                {filterEmptyState}
              </div>
            )
          }
          if (visualNav) return null
          const category = categoryById.get(block.id)
          if (!category) return null
          const scopedSections = pageBlocks
            .filter((candidate) => candidate.type === 'section' && getSectionVisibility(candidate).mode === 'categories')
            .map((candidate) => renderCustomSection(candidate, { view: 'category', categoryId: category.id }))
          return (
            <div key={`category-flow-${category.id}`} style={{ display: 'contents' }}>
              {scopedSections}
              {renderSection(category)}
            </div>
          )
        })}
      </main>
      <MenuFooter storeInfo={storeInfo ?? null} cartCount={cartSummary?.count ?? 0} />
      {visualNav && (
        <style>{`
          @keyframes garsonless-category-fade {
            from { opacity: .45; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      )}
      <style>{`@media (max-width:480px){[data-product-grid]{grid-template-columns:repeat(min(var(--p-cols),2),minmax(0,1fr))!important}}`}</style>
    </div>
  )
}
