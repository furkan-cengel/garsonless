'use client'

import { useEffect, useRef, useState } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { useTheme } from './ThemeContext'
import { AnnouncementBar } from './AnnouncementBar'
import { formatTRY } from './formatCurrency'
import { ML_STAMP_POP_KEYFRAME } from './keyframes'

const HEADER_RESPONSIVE_CSS = `
${ML_STAMP_POP_KEYFRAME}
  [data-component="header"] [data-header-more] {
    display: none;
    position: relative;
    flex-shrink: 0;
  }
  [data-component="header"] [data-header-more] > summary {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    background: var(--p-accent-soft);
    color: var(--p-accent);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    list-style: none;
  }
  [data-component="header"] [data-header-more] > summary::-webkit-details-marker {
    display: none;
  }
  [data-component="header"] [data-header-more] > summary:focus-visible {
    outline: 2px solid var(--p-accent);
    outline-offset: 2px;
  }
  [data-component="header"] [data-header-more-popover] {
    position: absolute;
    z-index: 30;
    top: calc(100% + 8px);
    right: 0;
    min-width: 176px;
    padding: 6px;
    border: 1px solid var(--p-border, rgba(0,0,0,.08));
    border-radius: 12px;
    background: var(--p-bg, #fff);
    box-shadow: 0 14px 36px rgba(20,25,31,.16);
  }
  [data-component="header"] [data-header-more-popover] > button,
  [data-component="header"] [data-header-more-popover] > div {
    width: 100%;
    min-height: 42px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--p-text, #1c1d20);
    font: 600 13px var(--p-body);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    white-space: nowrap;
  }
  [data-component="header"] [data-header-more-popover] > button {
    cursor: pointer;
  }
  [data-component="header"] [data-header-more-popover] > button:hover,
  [data-component="header"] [data-header-more-popover] > button:focus-visible {
    background: var(--p-accent-soft);
    outline: none;
  }
  [data-component="header"] [data-header-more-popover] span {
    color: var(--p-text-2);
    font-weight: 500;
  }
  [data-component="header"] [data-header-more-popover] [data-overflow-priority="secondary"] {
    display: none;
  }
  @container menu-header (max-width: 420px) {
    [data-component="header"] [data-action-priority="secondary"] {
      display: none;
    }
    [data-component="header"] [data-header-more][data-has-secondary="true"] {
      display: block;
    }
    [data-component="header"] [data-header-more-popover] [data-overflow-priority="secondary"] {
      display: flex;
    }
  }
`

interface HeaderProps {
  tableId?: string | null
  tableName?: string | null
  categories?: { id: string; name: string }[]
  cartSummary?: { count: number; subtotal: number } | undefined
  onOpenCart?: (() => void) | undefined
  /** Open table bill (adisyon) summary — renders a chip next to the table badge. */
  billSummary?: { total: number; count: number } | null
  onOpenBill?: (() => void) | undefined
  /** Membership (loyalty) — renders an "Üye ol"/member chip when provided. */
  memberSummary?: {
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
}

export function Header({ tableId, tableName, categories, cartSummary, onOpenCart, billSummary, onOpenBill, memberSummary, onOpenMember }: HeaderProps) {
  const { theme, restaurantName, logoUrl } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const moreMenuRef = useRef<HTMLDetailsElement>(null)
  const cartCount = cartSummary?.count ?? 0
  const cartSubtotal = cartSummary?.subtotal ?? 0
  const layout = theme.headerLayout ?? (theme.headerAlign === 'center' ? 'center' : 'split')
  const isSplit = layout === 'split'
  const isCenter = layout === 'center'
  const isStacked = layout === 'stacked'
  const isCompact = layout === 'compact'
  const compact = isCompact
  const rowLayout = isSplit || isCompact
  const rowBrandAlignment = theme.headerAlign === 'center' ? 'center' : 'flex-start'
  const showHeaderCartIcon = theme.cartHeaderTriggerStyle === 'icon' && Boolean(onOpenCart)
  const showHeaderCartPill = theme.cartHeaderTriggerStyle === 'pill' && Boolean(onOpenCart) && cartCount > 0
  // Missing on legacy saved themes means true: existing tenants keep the bill
  // chip until they explicitly turn the new independent control off.
  const showBill = theme.headerShowBill ?? true
  const hasBillChip = Boolean(showBill && billSummary && billSummary.count > 0 && onOpenBill)
  // Row layouts host the bill chip + hamburger inside the right action cluster
  // (utility tier); center/stacked keep their original placements.
  const actionsHoldBill = rowLayout && hasBillChip
  const actionsHoldMenu = isSplit && theme.headerShowMenu
  const hasMemberAction = Boolean(memberSummary && onOpenMember)
  const hasSecondaryAction = hasMemberAction
  const hasOverflowAction = hasSecondaryAction
  const closeMoreMenu = () => {
    if (moreMenuRef.current) moreMenuRef.current.open = false
  }
  // Never render a raw UUID — use the human label, else a short id form.
  const tableLabel = tableName
    ? `${tableName} · Açık`
    : tableId
      ? `Masa ${tableId.slice(0, 4).toUpperCase()} · Açık`
      : null
  const stickyStyle: React.CSSProperties = theme.stickyHeader
    ? { position: 'sticky', top: 0, zIndex: 20 }
    : { position: 'relative' }
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const updateHeight = () => {
      document.documentElement.style.setProperty('--p-header-sticky-height', `${header.getBoundingClientRect().height}px`)
    }
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  const menuButton = theme.headerShowMenu ? (
    <button
      type="button"
      aria-label="Menüyü aç"
      onClick={() => setMenuOpen(true)}
      style={{
        width: 34,
        height: 34,
        borderRadius: 999,
        background: 'var(--p-accent-soft)',
        color: 'var(--p-accent)',
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
      <HamburgerIcon />
    </button>
  ) : <span aria-hidden="true" />
  const billChip = hasBillChip ? (
    <button
      type="button"
      onClick={onOpenBill}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: actionsHoldBill ? 30 : 'auto',
        fontSize: actionsHoldBill ? 11.5 : compact ? 10 : 11,
        fontWeight: 700,
        color: 'var(--p-accent)',
        // Outlined (vs the filled member chip) so the two money/membership
        // chips read as distinct controls even when adjacent.
        background: actionsHoldBill ? 'transparent' : 'var(--p-accent-soft)',
        border: actionsHoldBill ? '1px solid color-mix(in srgb, var(--p-accent) 35%, transparent)' : 'none',
        padding: actionsHoldBill ? '0 11px' : '2px 9px',
        borderRadius: 999,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
        flexShrink: 0,
        marginRight: actionsHoldBill ? 6 : 0,
      }}
    >
      Hesap · {formatTRY(billSummary!.total)}
    </button>
  ) : null
  // Logged-in members (real balances present) get a compact progress chip;
  // otherwise the chip is the "Üye ol" entry point. Welcome-bonus teaser only
  // when a real bonus exists — never advertise 0. Stamp ring only with a real
  // goal (> 0); a goal-less stamp program falls back to the points display.
  const memberIsMember = Boolean(memberSummary && (memberSummary.stampEnabled !== undefined || memberSummary.pointsEnabled !== undefined))
  const memberWelcomeBonus = memberSummary?.welcomeBonus ?? 0
  const memberJoinLabel = memberWelcomeBonus > 0 ? `Üye ol · +${memberWelcomeBonus}` : 'Üye ol'
  const memberStamps = typeof memberSummary?.stamps === 'number' ? memberSummary.stamps : null
  const memberStampGoal = memberSummary?.stampGoal ?? 0
  const memberShowStamp = Boolean(memberIsMember && memberSummary?.stampEnabled && memberStamps !== null && memberStampGoal > 0)
  // One-shot pop when the stamp count INCREASES (never on initial mount).
  const prevStampsRef = useRef<number | null>(memberStamps)
  const [stampPop, setStampPop] = useState(0)
  useEffect(() => {
    const prev = prevStampsRef.current
    prevStampsRef.current = memberStamps
    if (memberStamps !== null && prev !== null && memberStamps > prev) setStampPop((t) => t + 1)
  }, [memberStamps])
  const memberChip = memberSummary && onOpenMember ? (() => {
    const isMember = memberIsMember
    const showPoints = memberSummary.pointsEnabled && typeof memberSummary.points === 'number'
    const label = !isMember
      ? memberJoinLabel
      : memberShowStamp
        ? `${memberStamps}/${memberStampGoal}`
        : showPoints
          ? `⭐ ${memberSummary.points}`
          : (memberSummary.name || 'Üyelik')
    return (
      <button
        type="button"
        onClick={onOpenMember}
        aria-label={isMember ? 'Üyelik' : 'Üye ol'}
        style={{
          height: 30, padding: '0 11px', borderRadius: 999,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit',
          background: 'var(--p-accent-soft)', color: 'var(--p-accent)',
          border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
        }}
      >
        {!isMember && <MemberIcon />}
        {memberShowStamp && <StampRing stamps={memberStamps!} goal={memberStampGoal} pop={stampPop} />}
        {isMember && memberSummary.tierColor && (
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: memberSummary.tierColor, flexShrink: 0 }} />
        )}
        {label}
      </button>
    )
  })() : null
  // headerShowLang stays in the schema, but there is NO real language switch
  // behind it yet — per the no-dead-controls rule the static "TR" badge is not
  // rendered (same treatment as the removed search button).
  const headerActions = (
    <div data-header-actions style={{
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      justifyContent: isStacked ? 'center' : 'flex-end',
      flexWrap: 'nowrap',
      minWidth: 0,
      maxWidth: '100%',
      justifySelf: isCenter ? 'end' : isStacked ? 'center' : rowLayout ? 'end' : 'center',
    }}>
      {actionsHoldBill && <span data-action-priority="primary">{billChip}</span>}
      {memberChip && <span data-action-priority="secondary">{memberChip}</span>}
      {showHeaderCartIcon && (
        <button
          type="button"
          aria-label="Sepeti aç"
          onClick={onOpenCart}
          style={{
            position: 'relative',
            width: 34,
            height: 34,
            borderRadius: 999,
            background: '#fff',
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
          aria-label="Sepeti aç"
          onClick={onOpenCart}
          style={{
            height: 36,
            borderRadius: 999,
            border: 'none',
            background: 'var(--p-accent)',
            color: '#fff',
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
          }}>{formatHeaderMoney(cartSubtotal)}</span>
          <span style={{
            position: 'relative',
            width: 25,
            height: 25,
            borderRadius: 999,
            background: 'rgba(255,255,255,.18)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <CartIconSvg kind={theme.cartIcon} color="currentColor" size={14} />
            {theme.cartShowBadge && <CartBadge count={cartCount} small tone="gold" />}
          </span>
        </button>
      )}
      {actionsHoldMenu && menuButton}
      {hasOverflowAction && (
        <details
          ref={moreMenuRef}
          data-header-more
          data-has-secondary={hasSecondaryAction ? 'true' : 'false'}
        >
          <summary aria-label="Daha fazla" title="Daha fazla">
            <MoreIcon />
          </summary>
          <div role="menu" aria-label="Diğer header işlemleri" data-header-more-popover>
            {memberChip && (
              <button data-overflow-priority="secondary" type="button" role="menuitem" onClick={() => { closeMoreMenu(); onOpenMember?.() }}>
                {memberIsMember ? 'Üyelik' : 'Üye ol'}
                {!memberIsMember && memberWelcomeBonus > 0 && <span>+{memberWelcomeBonus} puan</span>}
                {memberShowStamp && <span>☕ {memberStamps}/{memberStampGoal}</span>}
              </button>
            )}
          </div>
        </details>
      )}
    </div>
  )
  const inlineBillChip = actionsHoldBill ? null : billChip
  const tableBadge = theme.headerTableBadge && tableLabel ? (
    <div style={{
      fontSize: compact ? 10.5 : 11.5,
      color: 'var(--p-text-2)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginTop: compact ? 0 : 4,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--p-cta)', flexShrink: 0 }} />
      {tableLabel}
      {inlineBillChip}
    </div>
  ) : inlineBillChip
  const brandBlock = (
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
          centered
          maxLines={isCenter || isStacked ? 2 : 1}
        />
      </div>
      {tableBadge}
      {theme.headerTagline && (
        <p style={{
          fontSize: compact ? 10.5 : 11,
          color: 'var(--p-text-2, rgba(0,0,0,0.5))',
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

  return (
    <>
      <AnnouncementBar />
      <header
        ref={headerRef}
        data-component="header"
        data-header-layout={layout}
        style={{
          background: theme.headerStyle === 'blur' ? 'rgba(255,255,255,.8)' : theme.headerBg,
          backdropFilter: theme.headerStyle === 'blur' ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: theme.headerStyle === 'blur' ? 'blur(10px)' : 'none',
          ...stickyStyle,
          minHeight: theme.headerHeight + 'px',
          boxSizing: 'border-box',
          padding: `${theme.headerPadY ?? 8}px 16px`,
          marginBottom: theme.headerBottomGap ?? 0,
          display: 'grid',
          // split: the hamburger lives in the right action cluster (utility
          // tier) so the restaurant name owns the leading edge.
          gridTemplateColumns: isSplit
            ? 'minmax(0,1fr) auto'
            : isCenter
              ? '40px 1fr 40px'
              : isCompact
                ? 'minmax(0,1fr) auto'
                : '1fr',
          alignItems: isStacked ? 'center' : 'center',
          justifyItems: isStacked ? 'center' : 'stretch',
          columnGap: (isSplit || isCompact) ? 10 : isCenter ? 8 : 0,
          rowGap: isStacked ? 10 : isCenter ? 0 : 6,
          borderBottom: theme.headerBorder ? '1px solid var(--p-border, rgba(0,0,0,0.08))' : 'none',
          overflow: 'visible',
          containerType: 'inline-size',
          containerName: 'menu-header',
        }}
      >
        {isCenter && menuButton}
        {brandBlock}
        {headerActions}
        {isStacked && theme.headerShowMenu && menuButton}
      </header>

      <style>{HEADER_RESPONSIVE_CSS}</style>

      {theme.headerShowMenu && (
        <NavDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          restaurantName={restaurantName}
          categories={categories}
        />
      )}
    </>
  )
}

function NavDrawer({ open, onClose, restaurantName, categories }: {
  open: boolean
  onClose: () => void
  restaurantName: string
  categories?: { id: string; name: string }[] | undefined
}) {
  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: 'rgba(0,0,0,0.3)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 300ms',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigasyon menüsü"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: 280,
          background: 'var(--p-bg, #fff)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
          zIndex: 999,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--p-border, rgba(0,0,0,0.08))',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--p-display)', fontSize: 20,
            color: 'var(--p-accent)', lineHeight: 1,
          }}>{restaurantName}</span>
          <button
            type="button"
            aria-label="Kapat"
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 999,
              background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--p-text, #1c1d20)',
              flexShrink: 0,
            }}
          >
            <CloseIcon />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '8px 0' }}>
          {categories && categories.length > 0
            ? categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  document.getElementById(`section-${cat.id}`)?.scrollIntoView({ behavior: 'smooth' })
                  onClose()
                }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '14px 20px',
                  background: 'transparent', border: 'none',
                  borderBottom: '1px solid var(--p-border, rgba(0,0,0,0.05))',
                  cursor: 'pointer',
                  fontFamily: 'var(--p-body)', fontSize: 15, fontWeight: 500,
                  color: 'var(--p-text, #1c1d20)',
                  display: 'block',
                }}
              >
                {cat.name}
              </button>
            ))
            : [68, 52, 80].map((w, i) => (
              <div key={i} style={{
                margin: '14px 20px',
                height: 16, borderRadius: 6,
                background: 'rgba(0,0,0,0.08)',
                width: `${w}%`,
              }} />
            ))
          }
        </nav>
      </div>
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
  const textSize = compact ? Math.min(theme.headerNameSize, 30) : theme.headerNameSize
  const textMaxWidth = centered ? 260 : crowded ? 136 : compact ? 158 : 230
  const clampTextStyle: React.CSSProperties = {
    maxWidth: textMaxWidth,
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
      flexShrink: 0,
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
              maxWidth: centered ? 200 : crowded ? 120 : 180,
              width: 'auto',
              objectFit: 'contain',
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
        color: theme.logoBg === 'accent' ? '#fff' : 'var(--p-accent)',
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
        color: 'var(--p-accent)', letterSpacing: '-.02em', textTransform: 'uppercase' as const,
        lineHeight: 1.05,
        ...clampTextStyle,
      }}>{restaurantName}</div>
    )
  }
  return (
    <div title={restaurantName} aria-label={restaurantName} style={{
      fontFamily: 'var(--p-display)',
      fontSize: textSize + 'px',
      fontWeight: 700,
      color: 'var(--p-accent)',
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
      color: tone === 'gold' ? '#1a1612' : '#fff',
      border: '2px solid #fff',
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

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

/** 22px stamp-progress ring. Purely decorative (aria-hidden) — the chip text
 * carries the real count. Arc rotation lives on the circle (SVG attribute) so
 * the pop animation's transform on the svg can't knock the start point off. */
function StampRing({ stamps, goal, pop }: { stamps: number; goal: number; pop: number }) {
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

function MemberIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={14} height={14}>
      <circle cx="12" cy="8" r="3.2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 19a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}
