'use client'

import { useMenuLocale } from '../../menu/MenuLocaleContext'
import { useEffect, useMemo, useState } from 'react'
import { ThemeScope, useTheme } from '../../menu/ThemeContext'
import { Header } from '../../menu/Header'
import { MenuFooter } from '../../menu/MenuFooter'
import { CategoryNav } from '../../menu/CategoryNav'
import { VisualCategoryNavigator } from '../../menu/VisualCategoryNavigator'
import type { ThemeMenuPageProps } from '../types'
import type { ComboAddRequest, FreebieAddRequest } from '../types'
import type { MenuCategory, MenuItem, SectionPromotionContext } from '../../menu/types'
import type { CSSProperties } from 'react'
import { CustomSectionRenderer } from './sections/CustomSectionRenderer'
import { deriveActivePromoSliderCampaigns } from './sections/promoSliderCampaignModel'
import {
  getSectionDefinitionId,
  getSectionVisibility,
  isSectionBlockVisibleInContext,
} from '@garsonless/design-engine/section-blocks'
import { resolveMenuHeaderTheme, resolveMenuPageFlow, type ThemePageBlock } from '@garsonless/design-engine'

export function DefaultMenuPage({ categories: sourceCategories, categoryMeta, renderItems, menuFilters, orderStatus, filterEmptyState, tableId, tableLabel, homeHref, cartSummary, onOpenCart, items: sourceItems, onQuickAdd, onAddCombo, comboInteractionState, onAddFreebie, billSummary, onOpenBill, memberSummary, onOpenMember, onServiceRequest, onOpenServiceRequests, memberLoyalty, storeInfo, editorPreview = false }: ThemeMenuPageProps) {
  const { t } = useMenuLocale();
  const menuLocale = useMenuLocale()
  const items = useMemo(() => sourceItems?.map(menuLocale.item), [sourceItems, menuLocale])
  const categories = useMemo(() => sourceCategories.map(menuLocale.category), [sourceCategories, menuLocale])
  const { theme: baseTheme, restaurantName, logoUrl } = useTheme()
  const theme = useMemo(() => menuLocale.theme(resolveMenuHeaderTheme(baseTheme)), [baseTheme, menuLocale])
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
  const [visualSelectionMade, setVisualSelectionMade] = useState(false)
  const [navigationStatus, setNavigationStatus] = useState('')
  const textureStrength = Math.max(1, Math.min(10, theme.textureStrength ?? 4))
  const textureColor = `color-mix(in srgb, var(--p-text) ${textureStrength}%, transparent)`
  const pageMaxWidth = theme.pageMaxWidth === '960' ? 960 : theme.pageMaxWidth === '1200' ? 1200 : undefined
  useEffect(() => {
    if (!rootsForNav.some((category) => category.id === activeVisualRootId)) {
      setActiveVisualRootId(rootsForNav[0]?.id ?? '')
      if (activeVisualRootId) setNavigationStatus(t("Aktif kategori artık görünür olmadığı için kategori seçimi güncellendi."))
    }
  }, [rootsForNav, activeVisualRootId])
  useEffect(() => {
    const nextActive = childCategories[0]?.id ?? activeVisualRootId
    if (!categories.some((category) => category.id === activeVisualCategoryId) || ![activeVisualRootId, ...childCategories.map((category) => category.id)].includes(activeVisualCategoryId)) {
      setActiveVisualCategoryId(nextActive)
      if (activeVisualCategoryId) setNavigationStatus(t("Aktif kategori artık görünür olmadığı için en yakın kategori gösteriliyor."))
    }
  }, [categories, childCategories, activeVisualCategoryId, activeVisualRootId])
  const textureStyle: CSSProperties =
    theme.texture === 'grid'
      ? {
          backgroundImage: `linear-gradient(${textureColor} 1px, transparent 1px), linear-gradient(90deg, ${textureColor} 1px, transparent 1px)`,
          backgroundSize: '18px 18px',
        }
      : theme.texture === 'noise'
        ? {
            backgroundImage: `radial-gradient(circle at 1px 1px, ${textureColor} 1px, transparent 0)`,
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
        scrollMarginTop: !visualNav && theme.stickyNav
          ? `calc(${theme.stickyHeader ? `var(--p-header-sticky-height, ${theme.headerHeight}px) + var(--p-header-sticky-gap, 0px)` : '0px'} + var(--p-catnav-sticky-height, 68px) + 8px)`
          : theme.stickyHeader
            ? `calc(var(--p-header-sticky-height, ${theme.headerHeight}px) + 8px)`
            : 8,
      }}>
        <h2 style={sectionHeadingStyle()}>{cat.name}</h2>
        <div data-product-grid-shell style={{ padding: '0 var(--p-pad)', containerType: 'inline-size' }}>
          <div
            data-product-grid
            data-card-layout={theme.cardLayout}
            style={{
              display: 'grid',
              gap: 'var(--p-gap)',
              gridTemplateColumns:
                theme.cardLayout === 'vertical'
                  ? 'repeat(4, minmax(0, 420px))'
                  : 'minmax(0, 1fr)',
              justifyContent: theme.cardLayout === 'vertical' ? 'center' : 'stretch',
            }}
          >
            {renderItems(cat.id, visualNav
              ? visualStage === 'products' && cat.id === activeVisualCategoryId
              : cat.id === firstProductImageCategoryId)}
          </div>
        </div>
      </section>
    )
  }

  const visibilityCategories = useMemo(
    () => categories.map((category) => ({ id: category.id, parentId: category.parent_id ?? null })),
    [categories],
  )

  function canonicalItem(item: MenuItem): MenuItem {
    const source = sourceItems?.find((candidate) => candidate.id === item.id)
    return source ? { ...item, name: source.name, description: source.description, ingredients: source.ingredients, modifier_groups: source.modifier_groups, allergen_note: source.allergen_note, cross_contact_note: source.cross_contact_note } : item
  }

  function renderCustomSection(
    block: ThemePageBlock,
    context: { view: 'home' } | { view: 'category'; categoryId: string },
  ) {
    const sectionId = getSectionDefinitionId(block)
    if (!sectionId || !isSectionBlockVisibleInContext(block, context, visibilityCategories)) return null
    const config: Record<string, string> = theme.sectionSettings?.[block.id]
      ?? theme.sectionSettings?.[sectionId]
      ?? {}
    const selectCategory = (categoryId: string) => {
      if (!visualNav) {
        navigateToTextCategory(categoryId)
        return
      }
      navigateToVisualCategory(categoryId)
    }
    return (
      <div key={block.id} data-menu-page-section-id={block.id}>
      <CustomSectionRenderer
        sectionId={sectionId}
        sectionInstanceId={block.id}
        config={config}
        theme={theme}
        categories={categories}
        restaurantName={restaurantName}
        restaurantLogoUrl={logoUrl}
        {...(theme.pageDescription ? { pageDescription: theme.pageDescription } : {})}
        memberLoyalty={memberLoyalty ?? null}
        activeCampaigns={activePromoSliderCampaigns}
        {...(items ? { items } : {})}
        {...(onQuickAdd ? { onQuickAdd: (item: MenuItem, originalPrice?: number, promotion?: SectionPromotionContext) => onQuickAdd(canonicalItem(item), originalPrice, promotion) } : {})}
        {...(onAddCombo ? { onAddCombo: (request: ComboAddRequest) => onAddCombo({ ...request, items: request.items.map(canonicalItem) }) } : {})}
        {...(comboInteractionState ? { comboInteractionState } : {})}
        {...(onAddFreebie ? { onAddFreebie: (request: FreebieAddRequest) => onAddFreebie({ ...request, qualifierItems: request.qualifierItems.map(canonicalItem), rewardItems: request.rewardItems.map(canonicalItem) }) } : {})}
        {...(onOpenCart ? { onOpenCart } : {})}
        {...(onOpenMember ? { onOpenMember } : {})}
        onSelectCategory={selectCategory}
        editorPreview={editorPreview}
        storeInfo={storeInfo ?? null}
      />
      </div>
    )
  }

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  )

  function navigateToTextCategory(categoryId: string) {
    const hash = `#category-${encodeURIComponent(categoryId)}`
    if (window.location.hash !== hash) {
      window.history.pushState({ ...window.history.state, garsonlessCategoryId: categoryId }, '', hash)
    }
    document.getElementById(`section-${categoryId}`)?.scrollIntoView({ behavior: theme.motion === 'none' || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  function navigateToVisualCategory(categoryId: string, pushHistory = true) {
    const category = categoryById.get(categoryId)
    if (!category) return
    const rootId = category.parent_id ?? category.id
    const children = orderedCategories.filter((candidate) => candidate.parent_id === rootId)
    setActiveVisualRootId(rootId)
    setActiveVisualCategoryId(category.parent_id ? category.id : children[0]?.id ?? category.id)
    setVisualStage(category.parent_id || children.length === 0 ? 'products' : 'children')
    setVisualSelectionMade(true)
    setNavigationStatus('')
    if (pushHistory) {
      const hash = `#category-${encodeURIComponent(category.id)}`
      if (window.location.hash !== hash) window.history.pushState({ ...window.history.state, garsonlessVisualNav: true, categoryId: category.id }, '', hash)
    }
  }

  function navigateVisualBack() {
    if (window.history.state?.garsonlessVisualNav) {
      window.history.back()
      return
    }
    if (visualStage === 'products' && childCategories.length > 0) {
      setVisualStage('children')
      window.history.replaceState(window.history.state, '', `#category-${encodeURIComponent(activeVisualRootId)}`)
      return
    }
    setVisualStage('roots')
    setVisualSelectionMade(true)
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`)
  }

  useEffect(() => {
    const revealCategoryFromHash = () => {
      const prefix = '#category-'
      if (!window.location.hash.startsWith(prefix)) {
        if (visualNav) {
          setVisualStage('roots')
          setVisualSelectionMade(false)
        }
        return
      }
      let categoryId = ''
      try { categoryId = decodeURIComponent(window.location.hash.slice(prefix.length)) } catch { return }
      const category = categoryById.get(categoryId)
      if (!category) return
      if (visualNav) {
        navigateToVisualCategory(category.id, false)
        return
      }
      window.requestAnimationFrame(() => document.getElementById(`section-${categoryId}`)?.scrollIntoView({ behavior: theme.motion === 'none' || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }))
    }
    revealCategoryFromHash()
    window.addEventListener('hashchange', revealCategoryFromHash)
    window.addEventListener('popstate', revealCategoryFromHash)
    return () => {
      window.removeEventListener('hashchange', revealCategoryFromHash)
      window.removeEventListener('popstate', revealCategoryFromHash)
    }
  }, [categoryById, orderedCategories, visualNav])
  const pageBlocks = useMemo(() => {
    return resolveMenuPageFlow({
      ...(theme.pageBlocks ? { pageBlocks: theme.pageBlocks } : {}),
      ...(theme.sections ? { legacySections: theme.sections } : {}),
      categories: categories.map((category) => ({
        id: category.id,
        parentId: category.parent_id ?? null,
      })),
    })
  }, [categories, theme.pageBlocks, theme.sections])
  // The theme may reorder categories independently of database positions.
  // Choose the LCP candidate from the actual page flow, not the input array.
  const firstProductImageCategoryId = useMemo(() => {
    const imageCategories = new Set(items?.filter((item) => item.images.length > 0).map((item) => item.category_id))
    return pageBlocks.find((block) => block.type === 'category' && imageCategories.has(block.id))?.id
  }, [items, pageBlocks])
  const activePromoSliderCampaigns = useMemo(
    () => deriveActivePromoSliderCampaigns({
      pageBlocks,
      sectionSettings: theme.sectionSettings ?? {},
      items: items ?? [],
    }),
    [items, pageBlocks, theme.sectionSettings],
  )

  return (
    <ThemeScope theme={theme}>
    <div suppressHydrationWarning style={{ minHeight: '100dvh', backgroundColor: 'var(--p-bg)', ...textureStyle }}>
      <Header
        tableId={tableId ?? null}
        tableName={tableLabel ?? null}
        homeHref={homeHref ?? null}
        categories={orderedCategories}
        {...(categoryMeta ? { categoryMeta } : {})}
        onCategorySelect={(categoryId) => {
          if (!visualNav) {
            navigateToTextCategory(categoryId)
            return
          }
          navigateToVisualCategory(categoryId)
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
      <main style={{ paddingBottom: Math.max(24, theme.sectionGap), width: '100%', maxWidth: pageMaxWidth, marginInline: 'auto' }}>
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
                <VisualCategoryNavigator
                  key="category-nav"
                  stage={visualStage}
                  roots={rootsForNav}
                  children={childCategories}
                  activeRootId={activeVisualRootId}
                  activeCategoryId={activeVisualCategoryId}
                  selectedRootId={visualSelectionMade ? activeVisualRootId : ''}
                  categoryMeta={categoryMeta}
                  statusMessage={navigationStatus}
                  onSelectRoot={navigateToVisualCategory}
                  onSelectChild={navigateToVisualCategory}
                  onBack={navigateVisualBack}
                  products={(
                    <>
                      {menuFilters && <div style={{ padding: `${theme.navTopGap ?? 8}px var(--p-pad) 0` }}>{menuFilters}</div>}
                      {filterEmptyState}
                      {categoryById.get(activeVisualCategoryId) && renderSection(categoryById.get(activeVisualCategoryId)!)}
                    </>
                  )}
                />
              )
            }
            return (
              <div key="category-nav" style={{ display: 'contents' }}>
                <CategoryNav
                  categories={orderedCategories}
                  categoryMeta={categoryMeta}
                  activeCategoryId={undefined}
                  onCategorySelect={undefined}
                  leadingControl={menuFilters}
                />
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
      <style>{`
        @container (max-width:1079px){
          [data-product-grid][data-card-layout="vertical"]{grid-template-columns:repeat(3,minmax(0,420px))!important}
        }
        @container (max-width:679px){
          [data-product-grid][data-card-layout="vertical"]{grid-template-columns:repeat(2,minmax(0,420px))!important}
        }
        @container (max-width:279px){
          [data-product-grid][data-card-layout="vertical"]{grid-template-columns:minmax(0,420px)!important}
        }
        .product-card-open:focus-visible,
        [data-card-cta-action]:focus-visible,
        [data-card-quantity-action]:focus-visible,
        [data-card-favorite-action]:focus-visible{
          outline:2px solid var(--p-accent);
          outline-offset:2px;
        }
        .product-card-open:focus-visible{outline-offset:-4px}
        @media (hover:hover) and (pointer:fine){
          [data-product-card][data-card-motion="enabled"][data-card-hover="lift"]:hover{
            transform:translateY(-3px);
            box-shadow:var(--product-card-shadow),0 10px 24px rgba(15,17,21,.12)!important;
          }
          [data-product-card][data-card-motion="enabled"][data-card-hover="glow"]:hover{
            box-shadow:var(--product-card-shadow),0 0 0 3px color-mix(in srgb,var(--p-cta) 24%,transparent)!important;
          }
        }
        @media (prefers-reduced-motion:reduce){
          [data-product-card]{transition:none!important}
        }
      `}</style>
    </div>
    </ThemeScope>
  )
}
