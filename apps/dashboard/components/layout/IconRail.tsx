'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { I } from '../../lib/ui'
import type { Icon } from '../../lib/ui'
import { useShell } from '../../lib/shell-context'
import { SHELL_OVERLAY_IDS } from '../../lib/shell-context'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import ProfileAvatar from '../overlays/ProfileAvatar'

const RAIL_CSS = `
.rail-link {
  width:44px;height:44px;cursor:pointer;
  background:transparent;color:var(--text-2);
  border-radius:8px;display:inline-flex;
  align-items:center;justify-content:center;
  transition:background 120ms,color 120ms;text-decoration:none;
}
.rail-link:hover { background:var(--surface-3); }
.rail-menu-dish {
  color:color-mix(in srgb,var(--text) 22%,var(--text-2));
}
.rail-menu-dish path {
  stroke:currentColor;stroke-width:28;stroke-linecap:round;stroke-linejoin:round;
}
.rail-link--active .rail-menu-dish { color:inherit; }
.rail-link:focus-visible,.rail-btn:focus-visible,.rail-profile:focus-visible {
  outline:2px solid var(--action);outline-offset:2px;
}
.rail-link--active { background:var(--surface-inset)!important;color:var(--text)!important; }
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
@media (prefers-reduced-motion: reduce) {
  .rail-link,.rail-tooltip,.rail-btn { transition:none!important; }
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
  className?: string
}

// The nav item's section key (the Pano/home item maps to 'pano').
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
  className,
}: Props) {
  const { overlay, toggleOverlay } = useShell()
  const base = `/dashboard/${restaurantId}`
  // Slim nav: render only permitted sections (owner sees all 8).
  const navItems = NAV.filter(item => isOwner || permissions.includes(navSection(item)))

  const activeId = (() => {
    const rel = pathname.replace(base, '')
    if (!rel || rel === '/') return 'home'
    const seg = rel.split('/')[1]
    return NAV.find(n => n.segment === seg)?.id ?? 'home'
  })()

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
        <div className="rail-primary">
          {navItems.map(item => (
            <RailLink
              key={item.id}
              ItemIcon={item.Icon}
              iconClassName={item.iconClassName}
              iconSize={item.iconSize}
              label={item.label}
              href={`${base}${item.segment ? `/${item.segment}` : ''}`}
              active={activeId === item.id}
              badge={item.id === 'orders' && ordersBadge > 0 ? ordersBadge : undefined}
            />
          ))}
        </div>

        <div className="rail-secondary" style={{
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
            onClick={() => toggleOverlay('help')}
            expanded={overlay === 'help'}
            controls={SHELL_OVERLAY_IDS.help}
            popup="dialog"
          />
          <div className="rail-item" style={{ marginTop: 4 }}>
            <button
              type="button"
              onClick={() => toggleOverlay('profile')}
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
              <ProfileAvatar
                displayName={userDisplayName}
                initials={userInitials}
                avatarUrl={userAvatarUrl}
                size={30}
                fontSize={11}
              />
            </button>
            <span id="rail-tooltip-profile" role="tooltip" className="rail-tooltip">Profil</span>
          </div>
        </div>
      </div>
    </>
  )
}

interface RailLinkProps {
  ItemIcon: Icon
  iconClassName?: string
  iconSize?: number
  label: string
  href: string
  active: boolean
  badge?: number
}

function RailLink({ ItemIcon, iconClassName, iconSize = 18, label, href, active, badge }: RailLinkProps) {
  const router = useRouter()
  const { beginNavigation, getNavigationGuard } = useShell()
  const [confirmNavigation, setConfirmNavigation] = useState(false)
  const [navigationGuardMessage, setNavigationGuardMessage] = useState<string | null>(null)
  const tooltipId = `rail-tooltip-${label.toLocaleLowerCase('tr-TR').replaceAll('ı', 'i').replaceAll('ş', 's')}`
  return (
    <div
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
      className="rail-item"
    >
      {active && <div className="rail-active-indicator" aria-hidden="true" />}
      <Link
        href={href}
        aria-label={label}
        aria-describedby={tooltipId}
        prefetch={false}
        className={`rail-link${active ? ' rail-link--active' : ''}`}
        onClick={(e) => {
          if (active) return
          const guardMessage = getNavigationGuard()
          if (guardMessage) {
            e.preventDefault()
            setNavigationGuardMessage(guardMessage)
            setConfirmNavigation(true)
            return
          }
          beginNavigation(href)
        }}
      >
        <ItemIcon className={iconClassName} size={iconSize} />
      </Link>
      <span id={tooltipId} role="tooltip" className="rail-tooltip">{label}</span>
      {badge !== undefined && (
        <div style={{
          position: 'absolute',
          top: 4,
          right: 2,
          minWidth: 14,
          height: 14,
          padding: '0 4px',
          background: 'var(--critical)',
          color: '#fff',
          fontSize: 9.5,
          fontWeight: 600,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1.5px solid var(--surface)',
        }}>
          {badge > 9 ? '9+' : badge}
        </div>
      )}
      {confirmNavigation && (
        <UnsavedChangesDialog
          description={navigationGuardMessage ?? 'Kaydedilmemiş değişiklikler var. Çıkarsan bu değişiklikler kaybolacak.'}
          discardLabel="Değişiklikleri sil ve çık"
          onKeepEditing={() => { setConfirmNavigation(false); setNavigationGuardMessage(null) }}
          onDiscard={() => {
            setConfirmNavigation(false)
            setNavigationGuardMessage(null)
            beginNavigation(href)
            router.push(href)
          }}
        />
      )}
    </div>
  )
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
