'use client'

import { useEffect, useRef, useState } from 'react'
import { getSectionDefinitionId } from '@garsonless/design-engine/section-blocks'
import { resolveReadableMenuForeground, type GarsonlessTheme } from '@garsonless/design-engine'
import { resolveMenuActionPlacements } from '@garsonless/design-engine/menu-action-placement'
import { parseOpenThemeNavDrawerCommand } from '@garsonless/design-engine/theme-preview-nav-command'
import { useTheme } from './ThemeContext'
import { formatTRY } from './formatCurrency'
import { ML_STAMP_POP_KEYFRAME } from './keyframes'
import type { MenuCategory } from './types'
import type { StoreInfo } from '../themes/types'
import { NavDrawer } from './NavDrawer'
import type { ServiceRequestType } from '@garsonless/domain/tables'
import { AppIcons as I } from '../icons'
import { MenuMorphIcon } from './MenuMorphIcon'

const HEADER_RESPONSIVE_CSS = `
${ML_STAMP_POP_KEYFRAME}
  [data-header-action] { min-width:44px; height:44px; }
  [data-header-control] { transition:transform .16s ease,filter .16s ease,box-shadow .16s ease; }
  @media (hover:hover) and (pointer:fine) {
    [data-header-control]:hover { filter:brightness(.97); transform:translateY(-1px); }
  }
  [data-header-control]:active { filter:brightness(.94); transform:translateY(0) scale(.98); }
  @container menu-header (max-width: 480px) {
    [data-header-action-label] { display:none; }
    [data-header-cart-label] { display:none; }
    [data-header-action] { width:44px; padding-inline:0 !important; }
  }
  @container menu-header (max-width: 420px) {
    [data-header-cart-action] {
      width:44px !important;
      min-width:44px !important;
      padding-inline:0 !important;
      justify-content:center;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-header-control] { transition:none !important; }
    [data-menu-morph-icon] line {
      transition-duration: .01ms !important;
      transition-delay: 0ms !important;
    }
  }
`

interface HeaderProps {
  tableId?: string | null
  tableName?: string | null
  homeHref?: string | null
  categories?: MenuCategory[]
  categoryMeta?: Record<string, { imageUrl?: string | null; itemCount?: number }> | undefined
  onCategorySelect?: ((categoryId: string) => void) | undefined
  cartSummary?: { count: number; subtotal: number } | undefined
  onOpenCart?: (() => void) | undefined
  /** Open table bill (adisyon) summary — renders a chip next to the table badge. */
  billSummary?: { total: number; count: number } | null
  onOpenBill?: (() => void) | undefined
  /** Membership (loyalty) — renders an "Üye ol"/member chip when provided. */
  memberSummary?: {
    authenticated?: boolean
    name: string | null
    stamps?: number
    stampGoal?: number
    points?: number
    stampEnabled?: boolean
    pointsEnabled?: boolean
    /** Tier accent color — renders a small dot on the compact member chip. */
    tierColor?: string
    /** Join teaser for NON-members: welcome bonus points. 0/absent → plain "Üye ol". */
    welcomeBonus?: number
  } | null
  onOpenMember?: (() => void) | undefined
  storeInfo?: StoreInfo | null | undefined
  onServiceRequest?: ((type: ServiceRequestType) => Promise<boolean>) | undefined
  onOpenServiceRequests?: (() => void) | undefined
}

export function Header({ tableId, tableName, homeHref, categories, categoryMeta, onCategorySelect, cartSummary, onOpenCart, billSummary, onOpenBill, memberSummary, onOpenMember, storeInfo, onServiceRequest, onOpenServiceRequests }: HeaderProps) {
  const { theme, isPreview, restaurantName, logoUrl } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editorDrawerSectionId, setEditorDrawerSectionId] = useState<string | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const cartCount = cartSummary?.count ?? 0
  const cartSubtotal = cartSummary?.subtotal ?? 0
  const headerTextColor = theme.headerTextColor ?? 'var(--p-accent)'
  const headerIconColor = theme.headerIconColor ?? 'var(--p-accent)'
  const cartAccentForeground = resolveReadableMenuForeground(theme.accent)
  const legacyLayout = theme.headerLayout ?? (theme.headerAlign === 'center' ? 'center' : 'split')
  const preset = theme.headerPreset ?? (legacyLayout === 'compact' ? 'compact' : legacyLayout === 'center' ? 'standard' : 'brand')
  const isSplit = preset === 'brand'
  const isCenter = preset === 'standard'
  const isCompact = preset === 'compact'
  const compact = isCompact
  const headerHeight = theme.headerHeight ?? 64
  // Header height is the total height of the primary row. Keep the 44px
  // controls inside that box and cap padding instead of letting padding make
  // the selected height appear ineffective.
  const headerPadY = Math.min(theme.headerPadY ?? 8, Math.max(0, (headerHeight - 44) / 2))
  const rowLayout = isSplit || isCompact
  const rowBrandAlignment = isSplit ? 'flex-start' : 'center'
  const hasServiceRequests = Boolean(theme.pageBlocks?.some((block) => block.type === 'section' && getSectionDefinitionId(block) === 'request-buttons') || theme.sections?.includes('request-buttons'))
  // Never render a raw UUID — use the human label, else a short id form.
  const tableLabel = tableName
    ? `${tableName} · Açık`
    : tableId
      ? `Masa ${tableId.slice(0, 4).toUpperCase()} · Açık`
      : null
  const placements = resolveMenuActionPlacements(theme, {
    member: Boolean(memberSummary && onOpenMember),
    bill: Boolean(tableLabel && onOpenBill),
    cart: Boolean(onOpenCart),
    service: Boolean(hasServiceRequests && (onOpenServiceRequests || onServiceRequest)),
  })
  const showHeaderCartIcon = placements.cart === 'header' && theme.cartHeaderTriggerStyle !== 'pill' && Boolean(onOpenCart)
  const showHeaderCartPill = placements.cart === 'header' && theme.cartHeaderTriggerStyle === 'pill' && Boolean(onOpenCart)
  const hasBillChip = Boolean(placements.bill === 'header' && billSummary && billSummary.count > 0 && onOpenBill)
  useEffect(() => {
    if (!isPreview) return
    let parentOrigin: string | null = null
    try {
      parentOrigin = document.referrer ? new URL(document.referrer).origin : null
    } catch {
      parentOrigin = null
    }
    if (!parentOrigin || window.parent === window) return
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !parentOrigin || event.origin !== parentOrigin) return
      const message = parseOpenThemeNavDrawerCommand(event.data)
      if (!message) return
      setEditorDrawerSectionId(message.sectionId)
      setMenuOpen(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [isPreview])
  const stickyStyle: React.CSSProperties = theme.stickyHeader
    ? { position: 'sticky', top: 0, zIndex: 'var(--p-layer-header, 20)' }
    : { position: 'relative' }
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const updateHeight = () => {
      const headerHeight = header.getBoundingClientRect().height
      document.documentElement.style.setProperty('--p-header-sticky-height', `${headerHeight}px`)
      document.documentElement.style.setProperty('--p-header-sticky-gap', `${theme.headerBottomGap ?? 0}px`)
      document.documentElement.style.setProperty('--p-header-flow-height', `${headerHeight + (theme.headerBottomGap ?? 0)}px`)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [theme.headerBottomGap])
  const menuButton = theme.headerShowMenu ? (
    <button
      type="button"
      data-header-control
      title={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
      aria-label={menuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
      aria-expanded={menuOpen}
      aria-controls="menu-nav-drawer"
      onClick={() => setMenuOpen((current) => !current)}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        background: 'var(--p-accent-soft)',
        color: headerIconColor,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        justifySelf: 'start',
        alignSelf: 'center',
      }}
    >
      <MenuMorphIcon open={menuOpen} size={21} />
    </button>
  ) : <span aria-hidden="true" />
  const billChip = hasBillChip ? (
    <button
      type="button"
      data-header-control
      data-header-bill-action
      title="Hesabı aç"
      onClick={onOpenBill}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        minWidth: 44,
        color: headerTextColor,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        flexShrink: 0,
        marginRight: 0,
      }}
    >
      <span data-header-bill-pill style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        height: 32,
        padding: '0 9px',
        borderRadius: 999,
        background: 'var(--p-accent-soft)',
        fontSize: compact ? 10.5 : 11,
        fontWeight: 750,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}>
        Hesap · {formatTRY(billSummary!.total)}
      </span>
    </button>
  ) : null
  const memberIsMember = memberSummary?.authenticated === true
  const memberChip = placements.member === 'header' && onOpenMember ? (
    <button
      type="button"
      data-header-control
      title={memberIsMember ? 'Hesabımı aç' : 'Müşteri hesabını aç'}
      onClick={onOpenMember}
      aria-label={memberIsMember ? 'Hesabımı aç' : 'Müşteri hesabını aç'}
      style={{
        height: 44, minWidth: 44, padding: '0 12px', borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontSize: 11.5, fontWeight: 750, fontFamily: 'inherit',
        background: 'var(--p-accent-soft)', color: headerIconColor,
        border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >
      {memberIsMember ? <I.userCircle size={19} strokeWidth={1.9} /> : <I.userPlus size={19} strokeWidth={1.9} />}
      <span data-header-action-label>{memberIsMember ? (memberSummary?.name?.split(' ')[0] || 'Hesabım') : 'Hesap'}</span>
    </button>
  ) : null
  // headerShowLang stays in the schema, but there is NO real language switch
  // behind it yet — per the no-dead-controls rule the static "TR" badge is not
  // rendered (same treatment as the removed search button).
  const headerActionCount = Number(Boolean(memberChip))
    + Number(placements.service === 'header' && hasServiceRequests && Boolean(onOpenServiceRequests))
    + Number(showHeaderCartIcon || showHeaderCartPill)
  const centerSideBudget = Math.max(44, headerActionCount > 0 ? headerActionCount * 44 + Math.max(0, headerActionCount - 1) * 8 : 44)
  const headerActions = (
    <div data-header-actions style={{
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'flex-end',
      flexWrap: 'nowrap',
      minWidth: 0,
      maxWidth: '100%',
      justifySelf: 'end',
    }}>
      {memberChip && <span data-action-priority="secondary" data-header-action>{memberChip}</span>}
      {placements.service === 'header' && hasServiceRequests && onOpenServiceRequests && (
        <button
          type="button"
          data-header-action
          data-header-control
          title="Servis istekleri"
          aria-label="Servis isteklerini aç"
          onClick={onOpenServiceRequests}
          style={{ width: 44, height: 44, borderRadius: 999, border: '1px solid var(--p-border)', background: 'var(--p-card)', color: headerIconColor, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <I.bell size={19} />
        </button>
      )}
      {showHeaderCartIcon && (
        <button
          type="button"
          data-header-control
          title="Sepeti aç"
          aria-label="Sepeti aç"
          onClick={onOpenCart}
          style={{
            position: 'relative',
            width: 44,
            height: 44,
            borderRadius: 999,
            background: 'var(--p-card)',
            color: 'var(--p-text)',
            border: '1px solid var(--p-border, rgba(0,0,0,.08))',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 18px rgba(20,25,31,.06)',
            flexShrink: 0,
          }}
        >
          <CartIconSvg kind={theme.cartIcon} color="currentColor" size={18} />
          {theme.cartShowBadge && cartCount > 0 && <CartBadge count={cartCount} />}
        </button>
      )}
      {showHeaderCartPill && (
        <button
          type="button"
          data-header-control
          title="Sepeti aç"
          aria-label="Sepeti aç"
          onClick={onOpenCart}
          data-header-action
          data-header-cart-action
          style={{
            height: 44,
            borderRadius: 999,
            border: 'none',
            background: 'var(--p-accent)',
            color: cartAccentForeground,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 6px 0 13px',
            fontFamily: 'var(--p-body)',
            fontSize: 12.5,
            fontWeight: 850,
            cursor: 'pointer',
            boxShadow: '0 10px 24px rgba(46,125,82,.22)',
            flexShrink: 1,
            maxWidth: 138,
            minWidth: 72,
            overflow: 'hidden',
          }}
        >
          <span style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }} data-header-cart-label>{cartCount > 0 ? formatHeaderMoney(cartSubtotal) : theme.cartButtonText || 'Sepet'}</span>
          <span style={{
            position: 'relative',
            width: 25,
            height: 25,
            borderRadius: 999,
            background: 'color-mix(in srgb, currentColor 18%, transparent)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CartIconSvg kind={theme.cartIcon} color="currentColor" size={14} />
            {theme.cartShowBadge && cartCount > 0 && <CartBadge count={cartCount} small tone="gold" />}
          </span>
        </button>
      )}
    </div>
  )
  const showContextBar = (theme.headerShowContextBar ?? theme.headerTableBadge) && Boolean(tableLabel)
  const contextBar = showContextBar ? (
    <div data-header-context-bar style={{
      width: '100%', minHeight: 52, padding: '4px 16px', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      borderTop: '1px solid var(--p-border)', background: 'color-mix(in srgb,var(--p-bg) 72%,var(--p-card))',
      color: 'var(--p-text-2)', fontSize: 11.5, fontWeight: 650,
    }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
        <i aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--p-cta)', flexShrink: 0 }} />
        <span data-header-table-label style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tableLabel?.replace(' · Açık', '')}</span>
      </span>
      {hasBillChip ? billChip : <span style={{ color: headerTextColor }}>{billSummary?.count ? 'Adisyon açık' : 'Masa hazır'}</span>}
    </div>
  ) : null
  const brandContent = (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: compact ? 0 : 2,
      minWidth: 0,
      width: '100%',
      alignItems: rowLayout ? rowBrandAlignment : 'center',
      justifySelf: isSplit ? 'start' : 'center',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? 8 : 10,
        minWidth: 0,
        maxWidth: '100%',
      }}>
        <Logo
          theme={theme}
          restaurantName={restaurantName}
          logoUrl={logoUrl}
          compact={compact}
          centered={isCenter}
          maxLines={isCenter ? 2 : 1}
        />
      </div>
      {theme.headerTagline && (
        <p style={{
          fontSize: compact ? 10.5 : 11,
          color: theme.headerTextColor ?? 'var(--p-text-2, rgba(0,0,0,0.5))',
          margin: '2px 0 0',
          fontFamily: 'var(--p-body)',
          letterSpacing: '0.02em',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {theme.headerTagline}
        </p>
      )}
    </div>
  )
  const brandBlock = homeHref ? (
    <a
      href={homeHref}
      aria-label={`${restaurantName} Ana Sayfa`}
      data-header-brand-link
      style={{ display: 'block', width: '100%', minWidth: 0, maxWidth: '100%', color: 'inherit', textDecoration: 'none', borderRadius: 10, justifySelf: 'center' }}
    >
      {brandContent}
    </a>
  ) : brandContent
  const headerShadow = theme.headerShadow === 'strong'
    ? '0 16px 38px -22px rgba(15,23,42,.55)'
    : theme.headerShadow === 'soft'
      ? '0 10px 26px -22px rgba(15,23,42,.38)'
      : 'none'

  return (
    <>
      <header
        ref={headerRef}
        data-component="header"
        data-header-layout={preset}
        aria-hidden={menuOpen || undefined}
        inert={menuOpen || undefined}
        style={{
          background: theme.headerStyle === 'blur' ? `color-mix(in srgb, ${theme.headerBg} 82%, transparent)` : theme.headerBg,
          backdropFilter: theme.headerStyle === 'blur' ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: theme.headerStyle === 'blur' ? 'blur(10px)' : 'none',
          ...stickyStyle,
          minHeight: headerHeight + 'px',
          boxSizing: 'border-box',
          padding: 'env(safe-area-inset-top, 0px) 0 0',
          marginBottom: theme.headerBottomGap ?? 0,
          display: 'flex',
          flexDirection: 'column',
          borderBottom: theme.headerBorder ? '1px solid var(--p-border, rgba(0,0,0,0.08))' : 'none',
          borderRadius: `0 0 ${theme.headerRadius ?? 0}px ${theme.headerRadius ?? 0}px`,
          boxShadow: headerShadow,
          overflow: 'clip',
          containerType: 'inline-size',
          containerName: 'menu-header',
        }}
      >
        <div data-header-main style={{
          width: '100%', height: headerHeight + 'px', minHeight: headerHeight + 'px',
          boxSizing: 'border-box', padding: `${headerPadY}px ${theme.headerPadX ?? 16}px`,
          display: 'grid', alignItems: 'center', columnGap: 10,
          gridTemplateColumns: isCenter ? `minmax(${centerSideBudget}px,1fr) minmax(0,auto) minmax(${centerSideBudget}px,1fr)` : 'auto minmax(0,1fr) auto',
        }}>
          <span style={{ display: 'flex', justifyContent: 'flex-start' }}>{menuButton}</span>
          {brandBlock}
          {headerActions}
        </div>
        {contextBar}
      </header>

      <style>{HEADER_RESPONSIVE_CSS}</style>

      {theme.headerShowMenu && (
        <NavDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          restaurantName={restaurantName}
          categories={categories}
          categoryMeta={categoryMeta}
          tableId={tableId}
          tableName={tableName}
          homeHref={homeHref}
          billSummary={billSummary}
          onOpenBill={onOpenBill}
          storeInfo={storeInfo}
          pageBlocks={theme.pageBlocks}
          sectionSettings={theme.sectionSettings}
          onCategorySelect={onCategorySelect}
          cartSummary={cartSummary}
          onOpenCart={onOpenCart}
          memberSummary={memberSummary}
          onOpenMember={onOpenMember}
          onServiceRequest={onServiceRequest}
          onOpenServiceRequests={onOpenServiceRequests}
          placements={placements}
          editorExpandedSectionId={editorDrawerSectionId}
        />
      )}
    </>
  )
}

function Logo({ theme, restaurantName, logoUrl, compact = false, crowded = false, centered = false, maxLines = 2 }: {
  theme: GarsonlessTheme
  restaurantName: string
  logoUrl: string | null
  compact?: boolean
  crowded?: boolean
  centered?: boolean
  maxLines?: 1 | 2
}) {
  const logoSize = theme.headerLogoSize ?? 40
  const logoMaxWidth = theme.headerLogoMaxWidth ?? (centered ? 200 : crowded ? 120 : 180)
  const logoFit = theme.headerLogoFit ?? 'contain'
  const headerTextColor = theme.headerTextColor ?? 'var(--p-accent)'
  const textSize = compact ? Math.min(theme.headerNameSize, 30) : theme.headerNameSize
  const textMaxWidth = centered ? 260 : crowded ? 136 : compact ? 158 : 230
  const clampTextStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: `min(${textMaxWidth}px, 100%)`,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    wordBreak: 'normal',
    overflowWrap: 'normal',
    display: maxLines === 1 ? 'block' : '-webkit-box',
    whiteSpace: maxLines === 1 ? 'nowrap' : undefined,
    WebkitBoxOrient: maxLines === 1 ? undefined : 'vertical',
    WebkitLineClamp: maxLines === 1 ? undefined : maxLines,
  }

  if (theme.headerLogoStyle === 'image') {
    const shape = theme.logoShape ?? 'rounded'
    const borderRadius = shape === 'circle' ? '50%' : shape === 'square' ? 4 : Math.max(8, logoSize * 0.2)
    const hasBg = theme.logoBg && theme.logoBg !== 'none'
    const bgColor = theme.logoBg === 'white' ? '#fff' : theme.logoBg === 'accent' ? 'var(--p-accent)' : 'transparent'
    const shadow = theme.logoShadow ? '0 4px 14px rgba(0,0,0,0.18)' : 'none'
    const border = theme.logoBorder ? '1.5px solid var(--p-border, rgba(0,0,0,0.12))' : 'none'
    const containerStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius,
      background: hasBg ? bgColor : 'transparent',
      boxShadow: shadow,
      border,
      padding: hasBg ? Math.max(4, logoSize * 0.1) : 0,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '100%',
    }
    if (logoUrl) {
      return (
        <div style={containerStyle}>
          <img
            src={logoUrl}
            alt={restaurantName}
            style={{
              height: logoSize,
              maxHeight: logoSize,
              maxWidth: `min(${logoMaxWidth}px, 100%)`,
              width: logoFit === 'cover' ? `min(${logoMaxWidth}px, 100%)` : 'auto',
              objectFit: logoFit,
              display: 'block',
              borderRadius: hasBg ? 0 : borderRadius,
            }}
          />
        </div>
      )
    }
    return (
      <div title={restaurantName} aria-label={restaurantName} style={{
        ...containerStyle,
        width: logoSize, height: logoSize,
        background: hasBg ? bgColor : 'var(--p-accent)',
        color: theme.logoBg === 'accent' ? '#fff' : headerTextColor,
        fontWeight: 700, fontSize: Math.max(15, logoSize * 0.42),
      }}>
        {restaurantName.charAt(0).toUpperCase()}
      </div>
    )
  }
  if (theme.headerLogoStyle === 'wordmark') {
    return (
      <div style={{
        fontFamily: 'var(--p-body)', fontSize: textSize + 'px', fontWeight: 650,
        color: headerTextColor, letterSpacing: '-.02em', textTransform: 'uppercase' as const,
        lineHeight: 1.05,
        ...clampTextStyle,
      }}>{restaurantName}</div>
    )
  }
  return (
    <div title={restaurantName} aria-label={restaurantName} style={{
      fontFamily: 'var(--p-body)',
      fontSize: textSize + 'px',
      fontWeight: 700,
      color: headerTextColor,
      lineHeight: 1,
      ...clampTextStyle,
    }}>
      {restaurantName}
    </div>
  )
}

export function CartIconSvg({ kind = 'cart', color, size = 24 }: { kind?: 'cart' | 'bag' | 'basket'; color: string; size?: number }) {
  if (kind === 'bag') return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={color} width={size} height={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V6a3 3 0 1 1 6 0v3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9h14" />
    </svg>
  )
  if (kind === 'basket') return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={color} width={size} height={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4 9 8-5 8 5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h16l-1.5 10a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13v4M15 13v4" />
    </svg>
  )
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke={color} width={size} height={size}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  )
}

function CartBadge({ count, small = false, tone = 'accent' }: { count: number; small?: boolean; tone?: 'accent' | 'gold' }) {
  return (
    <span style={{
      position: 'absolute',
      top: small ? -5 : -7,
      right: small ? -5 : -7,
      minWidth: small ? 16 : 19,
      height: small ? 16 : 19,
      padding: '0 4px',
      borderRadius: 999,
      background: tone === 'gold' ? '#ffd089' : 'var(--p-cta)',
      color: tone === 'gold' ? '#1a1612' : 'var(--p-cta-text)',
      border: '2px solid var(--p-card)',
      fontSize: small ? 9 : 10,
      fontWeight: 900,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      lineHeight: 1,
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

function formatHeaderMoney(value: number) {
  return `₺${value.toLocaleString('tr-TR')}`
}

/** 22px stamp-progress ring. Purely decorative (aria-hidden) — the chip text
 * carries the real count. Arc rotation lives on the circle (SVG attribute) so
 * the pop animation's transform on the svg can't knock the start point off. */
function _StampRing({ stamps, goal, pop }: { stamps: number; goal: number; pop: number }) {
  const R = 8.5
  const C = 2 * Math.PI * R
  const frac = Math.max(0, Math.min(1, stamps / goal))
  return (
    <svg
      key={pop}
      width="22"
      height="22"
      viewBox="0 0 22 22"
      aria-hidden="true"
      style={{ flexShrink: 0, ...(pop > 0 ? { animation: 'ml-stamp-pop .5s cubic-bezier(.2,.9,.3,1.3) both' } : {}) }}
    >
      <circle cx="11" cy="11" r={R} fill="none" stroke="color-mix(in srgb, currentColor 25%, transparent)" strokeWidth="2.5" />
      <circle
        cx="11" cy="11" r={R} fill="none" stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 11 11)"
      />
    </svg>
  )
}
