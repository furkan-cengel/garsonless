'use client'

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { I } from '../../lib/ui'
import type { Icon } from '../../lib/ui'
import { useShell } from '../../lib/shell-context'
import { SHELL_OVERLAY_IDS } from '../../lib/shell-context'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import ProfileAvatar from '../overlays/ProfileAvatar'
import type { DashboardSectionEntitlements } from '../../lib/auth/dashboard-entitlements'

const RAIL_CSS = `
.rail-link {
  width:44px;height:44px;cursor:pointer;
  background:transparent;color:var(--text-2);
  border-radius:8px;display:inline-flex;
  align-items:center;justify-content:center;
  transition:background 120ms,color 120ms;text-decoration:none;
}
.rail-link:hover { background:var(--surface-3); }
.rail-menu-dish { color:color-mix(in srgb,var(--text) 22%,var(--text-2)); }
.rail-menu-dish path {
  stroke:currentColor;stroke-width:28;stroke-linecap:round;stroke-linejoin:round;
}
.rail-link--active .rail-menu-dish,
.mobile-nav-link--active .rail-menu-dish { color:inherit; }
.rail-link:focus-visible,.rail-btn:focus-visible,.rail-profile:focus-visible,
.mobile-nav-link:focus-visible,.mobile-more-trigger:focus-visible,
.mobile-more-row:focus-visible,.mobile-more-close:focus-visible {
  outline:2px solid var(--action);outline-offset:2px;
}
.rail-link--active { background:var(--surface-inset)!important;color:var(--text)!important; }
.rail-link--locked { color:var(--text-4); }
.rail-lock-badge {
  position:absolute;right:1px;bottom:3px;z-index:2;
  width:15px;height:15px;border:1.5px solid var(--surface);border-radius:999px;
  background:var(--surface-inset);color:var(--text-2);display:grid;place-items:center;
}
.rail-primary { display:flex;flex-direction:column;gap:2px;align-items:center; }
.rail-item { position:relative;width:48px;display:flex;justify-content:center; }
.rail-active-indicator {
  position:absolute;left:-1px;top:8px;bottom:8px;
  z-index:1;width:2.5px;background:var(--text);border-radius:2px;
  pointer-events:none;
}
.rail-tooltip {
  position:absolute;left:50px;top:50%;z-index:120;
  transform:translate(4px,-50%);opacity:0;visibility:hidden;
  pointer-events:none;white-space:nowrap;
  padding:6px 8px;border:1px solid var(--border);
  border-radius:6px;background:var(--text,#111113);color:var(--on-action,#fff);
  box-shadow:var(--shadow-pop);font-size:11.5px;font-weight:550;
  line-height:1;transition:opacity 120ms,transform 120ms,visibility 120ms;
}
.rail-item:hover .rail-tooltip,
.rail-link:focus-visible + .rail-tooltip,
.rail-btn:focus-visible + .rail-tooltip,
.rail-item > button:focus-visible + .rail-tooltip {
  opacity:1;visibility:visible;transform:translate(0,-50%);
}
.rail-btn {
  width:44px;height:44px;border:none;cursor:pointer;
  background:transparent;color:var(--text-2);
  border-radius:8px;display:inline-flex;
  align-items:center;justify-content:center;
  transition:background 120ms;
}
.rail-btn:hover { background:var(--surface-3); }
.rail-btn[aria-expanded="true"],.rail-profile[aria-expanded="true"] {
  background:var(--surface-inset);color:var(--text);
}
.rail-profile { width:44px!important;height:44px!important; }
.rail-order-badge {
  position:absolute;top:4px;right:2px;z-index:3;
  min-width:14px;height:14px;padding:0 4px;
  background:var(--critical);color:#fff;font-size:9.5px;font-weight:600;
  border-radius:999px;display:inline-flex;align-items:center;justify-content:center;
  border:1.5px solid var(--surface);
}

.mobile-bottom-navigation { display:none; }
.mobile-more-sheet {
  overflow:hidden;border-radius:18px 18px 0 0;
  background:var(--surface);color:var(--text);
  padding-bottom:env(safe-area-inset-bottom,0px)!important;
}
.mobile-more-header {
  position:relative;flex:none;padding:18px 64px 16px 18px!important;
  border-bottom:1px solid var(--border);
}
.mobile-more-close {
  position:absolute;right:10px;top:10px;width:44px;height:44px;
  border:0;border-radius:10px;background:transparent;color:var(--text-2);
  display:grid;place-items:center;cursor:pointer;
}
.mobile-more-close:hover { background:var(--surface-3);color:var(--text); }
.mobile-more-list {
  min-height:0;overflow-y:auto;overscroll-behavior-y:contain;
  padding:10px 10px 14px;
}
.mobile-more-group + .mobile-more-group { margin-top:12px; }
.mobile-more-group-title {
  margin:0;padding:6px 10px;color:var(--text-3);
  font-size:10px;font-weight:750;letter-spacing:.055em;text-transform:uppercase;
}
.mobile-more-row {
  width:100%;min-height:58px;border:0;border-radius:12px;padding:8px 10px;
  background:transparent;color:var(--text);text-decoration:none;text-align:left;
  display:flex;align-items:center;gap:12px;cursor:pointer;
}
.mobile-more-row:hover { background:var(--surface-2); }
.mobile-more-row--active { background:var(--surface-inset); }
.mobile-more-row--locked { color:var(--text-2); }
.mobile-more-row-icon {
  width:36px;height:36px;flex:none;border-radius:10px;
  background:var(--surface-2);color:var(--text-2);display:grid;place-items:center;
}
.mobile-more-row--active .mobile-more-row-icon { background:var(--surface-3);color:var(--text); }
.mobile-more-row-copy { min-width:0;flex:1;display:grid;gap:2px; }
.mobile-more-row-copy strong { font-size:13px;font-weight:680;line-height:1.25; }
.mobile-more-row-copy small {
  color:var(--text-3);font-size:10.5px;line-height:1.3;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.mobile-more-profile-avatar { width:36px;height:36px;flex:none;display:grid;place-items:center; }

@media (max-width:760px) {
  .desktop-rail-primary,.desktop-rail-secondary { display:none!important; }
  .mobile-bottom-navigation {
    width:100%;height:56px;min-width:0;
    display:grid;
    grid-template-columns:repeat(var(--mobile-nav-count),minmax(0,1fr));
    align-items:stretch;gap:2px;
  }
  .mobile-nav-cell { position:relative;min-width:0;height:56px;display:flex; }
  .mobile-nav-link,.mobile-more-trigger {
    width:100%;min-width:0;min-height:56px;border:0;border-radius:10px;
    padding:3px 2px 4px;background:transparent;color:var(--text-3);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
    text-decoration:none;cursor:pointer;
  }
  .mobile-nav-icon {
    position:relative;width:36px;height:28px;flex:none;border-radius:999px;
    display:grid;place-items:center;transition:background 120ms,color 120ms;
  }
  .mobile-nav-label {
    display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    font-size:10px;font-weight:620;line-height:12px;letter-spacing:-.01em;
  }
  .mobile-nav-link--active,.mobile-more-trigger[aria-current="page"] { color:var(--text); }
  .mobile-nav-link--active .mobile-nav-icon,
  .mobile-more-trigger[aria-current="page"] .mobile-nav-icon,
  .mobile-more-trigger[aria-expanded="true"] .mobile-nav-icon {
    background:var(--surface-inset);color:var(--text);
  }
  .mobile-nav-link--active .mobile-nav-label,
  .mobile-more-trigger[aria-current="page"] .mobile-nav-label { font-weight:780; }
  .mobile-nav-link--locked { color:var(--text-4); }
  .mobile-nav-lock {
    position:absolute;right:-2px;bottom:-2px;width:14px;height:14px;
    border:1.5px solid var(--surface);border-radius:999px;
    background:var(--surface-inset);color:var(--text-2);display:grid;place-items:center;
  }
  .mobile-nav-badge {
    position:absolute;right:-7px;top:-4px;min-width:16px;height:16px;padding:0 4px;
    border:1.5px solid var(--surface);border-radius:999px;
    background:var(--critical);color:#fff;font-size:9px;font-weight:750;line-height:1;
    display:flex;align-items:center;justify-content:center;
  }
}
@media (prefers-reduced-motion: reduce) {
  .rail-link,.rail-tooltip,.rail-btn { transition:none!important; }
  .mobile-nav-icon { transition:none!important; }
}
`

interface NavItem {
  id: string
  Icon: Icon
  iconClassName?: string
  iconSize?: number
  label: string
  segment: string
}

interface ResolvedNavItem extends NavItem {
  href: string
  locked: boolean
  requiredPlanLabel: string | null
}

const NAV: NavItem[] = [
  { id: 'home',      Icon: I.home,      label: 'Pano',       segment: '' },
  { id: 'menu',      Icon: I.menuDish,  iconClassName: 'rail-menu-dish', iconSize: 20, label: 'Menü', segment: 'menu' },
  { id: 'tables',    Icon: I.chair,     label: 'Masalar',    segment: 'tables' },
  { id: 'theme',     Icon: I.palette,   label: 'Tema',       segment: 'theme' },
  { id: 'orders',    Icon: I.clipboard, label: 'Siparişler', segment: 'orders' },
  { id: 'customers', Icon: I.users,     label: 'Müşteriler', segment: 'customers' },
  { id: 'analytics', Icon: I.chart,     label: 'Raporlar',   segment: 'analytics' },
  { id: 'settings',  Icon: I.gear,      label: 'Ayarlar',    segment: 'settings' },
]

const MOBILE_PRIMARY_IDS = ['home', 'orders', 'tables', 'menu'] as const

const MOBILE_SECTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  theme: 'Menü görünümünü ve markanı düzenle',
  customers: 'Müşteri hesaplarını ve ilişkileri yönet',
  analytics: 'Satış ve operasyon raporlarını incele',
  settings: 'İşletme, ekip ve abonelik ayarları',
}

interface Props {
  restaurantId: string
  userDisplayName: string
  userInitials: string
  userAvatarUrl: string | null
  pathname: string
  ordersBadge?: number
  /** Sections the user may access; owner sees all. */
  permissions: string[]
  isOwner: boolean
  sectionEntitlements: DashboardSectionEntitlements
  tableOperationsAllowed: boolean
  className?: string
}

function navSection(item: NavItem): string {
  return item.segment || 'pano'
}

export default function IconRail({
  restaurantId,
  userDisplayName,
  userInitials,
  userAvatarUrl,
  pathname,
  ordersBadge = 0,
  permissions,
  isOwner,
  sectionEntitlements,
  tableOperationsAllowed,
  className,
}: Props) {
  const router = useRouter()
  const { overlay, toggleOverlay, beginNavigation, getNavigationGuard, interceptNavigation } = useShell()
  const base = `/dashboard/${restaurantId}`
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<{ href: string; message: string } | null>(null)

  const activeId = (() => {
    const rel = pathname.replace(base, '')
    if (!rel || rel === '/') return 'home'
    const seg = rel.split('/')[1]
    return NAV.find((item) => item.segment === seg)?.id ?? 'home'
  })()

  const navItems = NAV
    .filter((item) => isOwner || permissions.includes(navSection(item)))
    .map<ResolvedNavItem>((item) => {
      const section = navSection(item) as keyof DashboardSectionEntitlements
      const entitlement = sectionEntitlements[section]
      const href = item.id === 'tables' && entitlement.allowed && !tableOperationsAllowed
        ? `${base}/tables/qr`
        : `${base}${item.segment ? `/${item.segment}` : ''}`
      return { ...item, href, locked: !entitlement.allowed, requiredPlanLabel: entitlement.requiredPlanLabel }
    })

  const mobilePrimaryItems = MOBILE_PRIMARY_IDS
    .map((id) => navItems.find((item) => item.id === id))
    .filter((item): item is ResolvedNavItem => Boolean(item))
  const mobileOverflowItems = navItems.filter((item) => !MOBILE_PRIMARY_IDS.some((id) => id === item.id))
  const mobileMoreActive = mobileOverflowItems.some((item) => item.id === activeId)

  useEffect(() => {
    setMobileMoreOpen(false)
  }, [pathname])

  const handleNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    active: boolean,
    closeMobileMore = false,
  ) => {
    if (active) {
      event.preventDefault()
      if (closeMobileMore) setMobileMoreOpen(false)
      return
    }

    if (interceptNavigation?.(() => { beginNavigation(href); router.push(href) })) {
      event.preventDefault()
      if (closeMobileMore) setMobileMoreOpen(false)
      return
    }
    const guardMessage = getNavigationGuard()
    if (guardMessage) {
      event.preventDefault()
      if (closeMobileMore) setMobileMoreOpen(false)
      setPendingNavigation({ href, message: guardMessage })
      return
    }

    if (closeMobileMore) setMobileMoreOpen(false)
    beginNavigation(href)
  }

  return (
    <>
      <style>{RAIL_CSS}</style>
      <div className={className} style={{
        width: 'var(--rail)',
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0',
        gap: 2,
      }}>
        <DesktopNavigation
          navItems={navItems}
          activeId={activeId}
          ordersBadge={ordersBadge}
          overlay={overlay}
          userDisplayName={userDisplayName}
          userInitials={userInitials}
          userAvatarUrl={userAvatarUrl}
          onNavigate={handleNavigation}
          onToggleHelp={() => toggleOverlay('help')}
          onToggleProfile={() => toggleOverlay('profile')}
        />
        <MobileBottomNavigation
          primaryItems={mobilePrimaryItems}
          overflowItems={mobileOverflowItems}
          activeId={activeId}
          ordersBadge={ordersBadge}
          moreActive={mobileMoreActive}
          moreOpen={mobileMoreOpen}
          userDisplayName={userDisplayName}
          userInitials={userInitials}
          userAvatarUrl={userAvatarUrl}
          onMoreOpenChange={setMobileMoreOpen}
          onNavigate={handleNavigation}
          onOpenHelp={() => {
            setMobileMoreOpen(false)
            toggleOverlay('help')
          }}
          onOpenProfile={() => {
            setMobileMoreOpen(false)
            toggleOverlay('profile')
          }}
        />
      </div>
      {pendingNavigation && (
        <UnsavedChangesDialog
          description={pendingNavigation.message}
          discardLabel="Kaydetmeden çık"
          onKeepEditing={() => setPendingNavigation(null)}
          onDiscard={() => {
            const href = pendingNavigation.href
            setPendingNavigation(null)
            beginNavigation(href)
            router.push(href)
          }}
        />
      )}
    </>
  )
}

interface NavigationPresentationProps {
  navItems: ResolvedNavItem[]
  activeId: string
  ordersBadge: number
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, href: string, active: boolean, closeMobileMore?: boolean) => void
}

function DesktopNavigation({
  navItems,
  activeId,
  ordersBadge,
  overlay,
  userDisplayName,
  userInitials,
  userAvatarUrl,
  onNavigate,
  onToggleHelp,
  onToggleProfile,
}: NavigationPresentationProps & {
  overlay: ReturnType<typeof useShell>['overlay']
  userDisplayName: string
  userInitials: string
  userAvatarUrl: string | null
  onToggleHelp: () => void
  onToggleProfile: () => void
}) {
  const primaryNavRef = useRef<HTMLElement>(null)

  useEffect(() => {
    primaryNavRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeId])

  return (
    <>
      <nav ref={primaryNavRef} className="rail-primary desktop-rail-primary" aria-label="Ana bölümler">
        {navItems.map((item) => (
          <DesktopRailLink
            key={item.id}
            item={item}
            label={item.locked && item.requiredPlanLabel ? `${item.label} · ${item.requiredPlanLabel}` : item.label}
            active={activeId === item.id}
            badge={item.id === 'orders' && ordersBadge > 0 ? ordersBadge : undefined}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
      <div className="rail-secondary desktop-rail-secondary" style={{
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        alignItems: 'center',
      }}>
        <RailButton
          ItemIcon={I.question}
          label="Yardım"
          size={16}
          onClick={onToggleHelp}
          expanded={overlay === 'help'}
          controls={SHELL_OVERLAY_IDS.help}
          popup="dialog"
        />
        <div className="rail-item" style={{ marginTop: 4 }}>
          <button
            type="button"
            onClick={onToggleProfile}
            aria-label={overlay === 'profile' ? 'Profil ve hesap menüsünü kapat' : 'Profil ve hesap menüsünü aç'}
            aria-describedby="rail-tooltip-profile"
            aria-expanded={overlay === 'profile'}
            aria-haspopup="menu"
            aria-controls={SHELL_OVERLAY_IDS.profile}
            className="rail-profile"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: 'none',
              background: overlay === 'profile' ? 'var(--surface-inset)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ProfileAvatar displayName={userDisplayName} initials={userInitials} avatarUrl={userAvatarUrl} size={30} fontSize={11} />
          </button>
          <span id="rail-tooltip-profile" role="tooltip" className="rail-tooltip">Profil</span>
        </div>
      </div>
    </>
  )
}

function DesktopRailLink({ item, label, active, badge, onNavigate }: {
  item: ResolvedNavItem
  label: string
  active: boolean
  badge?: number
  onNavigate: NavigationPresentationProps['onNavigate']
}) {
  const router = useRouter()
  const tooltipId = `rail-tooltip-${item.id}`
  const ItemIcon = item.Icon

  return (
    <div onMouseEnter={() => router.prefetch(item.href)} onFocus={() => router.prefetch(item.href)} className="rail-item">
      {active && <div className="rail-active-indicator" aria-hidden="true" />}
      <Link
        href={item.href}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        aria-describedby={tooltipId}
        prefetch={false}
        className={`rail-link${active ? ' rail-link--active' : ''}${item.locked ? ' rail-link--locked' : ''}`}
        onClick={(event) => onNavigate(event, item.href, active)}
      >
        <ItemIcon className={item.iconClassName} size={item.iconSize ?? 18} />
      </Link>
      {item.locked && <span className="rail-lock-badge" aria-hidden="true"><I.lock size={9} /></span>}
      <span id={tooltipId} role="tooltip" className="rail-tooltip">{label}</span>
      {badge !== undefined && <OrderBadge className="rail-order-badge" count={badge} />}
    </div>
  )
}

function MobileBottomNavigation({
  primaryItems,
  overflowItems,
  activeId,
  ordersBadge,
  moreActive,
  moreOpen,
  userDisplayName,
  userInitials,
  userAvatarUrl,
  onMoreOpenChange,
  onNavigate,
  onOpenHelp,
  onOpenProfile,
}: {
  primaryItems: ResolvedNavItem[]
  overflowItems: ResolvedNavItem[]
  activeId: string
  ordersBadge: number
  moreActive: boolean
  moreOpen: boolean
  userDisplayName: string
  userInitials: string
  userAvatarUrl: string | null
  onMoreOpenChange: (open: boolean) => void
  onNavigate: NavigationPresentationProps['onNavigate']
  onOpenHelp: () => void
  onOpenProfile: () => void
}) {
  return (
    <Sheet open={moreOpen} onOpenChange={onMoreOpenChange}>
      <nav
        className="mobile-bottom-navigation"
        aria-label="Mobil ana bölümler"
        style={{ '--mobile-nav-count': primaryItems.length + 1 } as CSSProperties}
      >
        {primaryItems.map((item) => {
          const active = item.id === activeId
          const badge = item.id === 'orders' && ordersBadge > 0 ? ordersBadge : undefined
          const accessibleLabel = item.locked && item.requiredPlanLabel
            ? `${item.label}, ${item.requiredPlanLabel} ile açılır`
            : item.label
          const ItemIcon = item.Icon

          return (
            <div className="mobile-nav-cell" key={item.id}>
              <Link
                href={item.href}
                aria-label={accessibleLabel}
                aria-current={active ? 'page' : undefined}
                prefetch={false}
                className={`mobile-nav-link${active ? ' mobile-nav-link--active' : ''}${item.locked ? ' mobile-nav-link--locked' : ''}`}
                onClick={(event) => onNavigate(event, item.href, active)}
              >
                <span className="mobile-nav-icon" aria-hidden="true">
                  <ItemIcon className={item.iconClassName} size={item.iconSize ?? 20} />
                  {item.locked && <span className="mobile-nav-lock"><I.lock size={8} /></span>}
                  {badge !== undefined && <OrderBadge className="mobile-nav-badge" count={badge} />}
                </span>
                <span className="mobile-nav-label">{item.label}</span>
              </Link>
            </div>
          )
        })}
        <div className="mobile-nav-cell">
          <SheetTrigger
            render={
              <button
                type="button"
                className="mobile-more-trigger"
                aria-label="Diğer bölümleri aç"
                aria-current={moreActive ? 'page' : undefined}
                aria-controls="mobile-more-navigation"
              />
            }
          >
            <span className="mobile-nav-icon" aria-hidden="true"><I.grid size={20} /></span>
            <span className="mobile-nav-label">Diğer</span>
          </SheetTrigger>
        </div>
      </nav>
      <SheetContent
        id="mobile-more-navigation"
        side="bottom"
        showCloseButton={false}
        className="mobile-more-sheet max-h-[min(76dvh,720px)] gap-0 p-0"
      >
        <SheetHeader className="mobile-more-header">
          <SheetTitle>Diğer bölümler</SheetTitle>
          <SheetDescription>Yönetim, destek ve hesap seçeneklerine ulaşın.</SheetDescription>
          <SheetClose render={<button type="button" className="mobile-more-close" aria-label="Diğer bölümleri kapat" />}>
            <I.close size={18} />
          </SheetClose>
        </SheetHeader>
        <div className="mobile-more-list">
          {overflowItems.length > 0 && (
            <section className="mobile-more-group" aria-labelledby="mobile-more-management-title">
              <h3 id="mobile-more-management-title" className="mobile-more-group-title">Yönetim</h3>
              {overflowItems.map((item) => (
                <MobileMoreLink key={item.id} item={item} active={item.id === activeId} onNavigate={onNavigate} />
              ))}
            </section>
          )}
          <section className="mobile-more-group" aria-labelledby="mobile-more-support-title">
            <h3 id="mobile-more-support-title" className="mobile-more-group-title">Destek ve hesap</h3>
            <button type="button" className="mobile-more-row" onClick={onOpenHelp}>
              <span className="mobile-more-row-icon" aria-hidden="true"><I.question size={18} /></span>
              <span className="mobile-more-row-copy"><strong>Yardım</strong><small>Kullanım desteği ve sık sorulanlar</small></span>
              <I.chevRight size={16} aria-hidden="true" />
            </button>
            <button type="button" className="mobile-more-row" onClick={onOpenProfile}>
              <span className="mobile-more-profile-avatar" aria-hidden="true">
                <ProfileAvatar displayName={userDisplayName} initials={userInitials} avatarUrl={userAvatarUrl} size={36} fontSize={12} />
              </span>
              <span className="mobile-more-row-copy"><strong>Profil</strong><small>{userDisplayName}</small></span>
              <I.chevRight size={16} aria-hidden="true" />
            </button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function MobileMoreLink({ item, active, onNavigate }: {
  item: ResolvedNavItem
  active: boolean
  onNavigate: NavigationPresentationProps['onNavigate']
}) {
  const accessibleLabel = item.locked && item.requiredPlanLabel
    ? `${item.label}, ${item.requiredPlanLabel} ile açılır`
    : item.label
  const ItemIcon = item.Icon

  return (
    <Link
      href={item.href}
      aria-label={accessibleLabel}
      aria-current={active ? 'page' : undefined}
      prefetch={false}
      className={`mobile-more-row${active ? ' mobile-more-row--active' : ''}${item.locked ? ' mobile-more-row--locked' : ''}`}
      onClick={(event) => onNavigate(event, item.href, active, true)}
    >
      <span className="mobile-more-row-icon" aria-hidden="true">
        <ItemIcon className={item.iconClassName} size={item.iconSize ?? 18} />
      </span>
      <span className="mobile-more-row-copy">
        <strong>{item.label}</strong>
        <small>{MOBILE_SECTION_DESCRIPTIONS[item.id]}</small>
      </span>
      {item.locked && item.requiredPlanLabel
        ? <Badge variant="secondary">{item.requiredPlanLabel} ile açılır</Badge>
        : <I.chevRight size={16} aria-hidden="true" />}
    </Link>
  )
}

function OrderBadge({ className, count }: { className: string; count: number }) {
  return <span className={className} aria-hidden="true">{count > 9 ? '9+' : count}</span>
}

interface RailButtonProps {
  ItemIcon: Icon
  label: string
  size?: number
  onClick: () => void
  expanded?: boolean
  controls?: string
  popup?: 'dialog' | 'menu'
}

function RailButton({ ItemIcon, label, size = 18, onClick, expanded, controls, popup }: RailButtonProps) {
  const tooltipId = `rail-tooltip-${label.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').replaceAll('ş', 's')}`
  return (
    <div className="rail-item">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-describedby={tooltipId}
        aria-expanded={expanded}
        aria-haspopup={popup}
        aria-controls={controls}
        className="rail-btn"
      >
        <ItemIcon size={size} />
      </button>
      <span id={tooltipId} role="tooltip" className="rail-tooltip">{label}</span>
    </div>
  )
}
