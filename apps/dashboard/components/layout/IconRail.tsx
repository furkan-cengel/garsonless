'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { I } from '../../lib/ui'
import type { Icon } from '../../lib/ui'
import { useShell } from '../../lib/shell-context'

const RAIL_CSS = `
.rail-link {
  width:36px;height:36px;cursor:pointer;
  background:transparent;color:var(--text-2);
  border-radius:8px;display:inline-flex;
  align-items:center;justify-content:center;
  transition:background 120ms,color 120ms;text-decoration:none;
}
.rail-link:hover { background:var(--surface-3); }
.rail-link--active { background:var(--surface-inset)!important;color:var(--text)!important; }
.rail-btn {
  width:36px;height:36px;border:none;cursor:pointer;
  background:transparent;color:var(--text-2);
  border-radius:8px;display:inline-flex;
  align-items:center;justify-content:center;
  transition:background 120ms;
}
.rail-btn:hover { background:var(--surface-3); }
`

interface NavItem {
  id: string
  Icon: Icon
  label: string
  segment: string
}

const NAV: NavItem[] = [
  { id: 'home',      Icon: I.home,      label: 'Pano',       segment: '' },
  { id: 'menu',      Icon: I.cutlery,   label: 'Menü',       segment: 'menu' },
  { id: 'tables',    Icon: I.chair,     label: 'Masalar',    segment: 'tables' },
  { id: 'theme',     Icon: I.palette,   label: 'Tema',       segment: 'theme' },
  { id: 'orders',    Icon: I.clipboard, label: 'Siparişler', segment: 'orders' },
  { id: 'customers', Icon: I.users,     label: 'Müşteriler', segment: 'customers' },
  { id: 'analytics', Icon: I.chart,     label: 'Raporlar',   segment: 'analytics' },
  { id: 'settings',  Icon: I.gear,      label: 'Ayarlar',    segment: 'settings' },
]

interface Props {
  restaurantId: string
  userInitials: string
  pathname: string
  ordersBadge?: number
  /** Sections the user may access; owner sees all. */
  permissions: string[]
  isOwner: boolean
}

// The nav item's section key (the Pano/home item maps to 'pano').
function navSection(item: NavItem): string {
  return item.segment || 'pano'
}

export default function IconRail({ restaurantId, userInitials, pathname, ordersBadge = 0, permissions, isOwner }: Props) {
  const { openHelp, openProfile } = useShell()
  const router = useRouter()
  const base = `/dashboard/${restaurantId}`
  // Slim nav: render only permitted sections (owner sees all 8).
  const navItems = NAV.filter(item => isOwner || permissions.includes(navSection(item)))

  useEffect(() => {
    const routes = [
      base,
      `${base}/menu`,
      `${base}/orders`,
      `${base}/customers`,
      `${base}/tables`,
      `${base}/theme`,
      `${base}/analytics`,
      `${base}/settings`,
    ]
    routes.forEach(route => router.prefetch(route))
  }, [restaurantId, base, router])

  const activeId = (() => {
    const rel = pathname.replace(base, '')
    if (!rel || rel === '/') return 'home'
    const seg = rel.split('/')[1]
    return NAV.find(n => n.segment === seg)?.id ?? 'home'
  })()

  return (
    <>
      <style>{RAIL_CSS}</style>
      <div style={{
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
        {navItems.map(item => (
          <RailLink
            key={item.id}
            ItemIcon={item.Icon}
            label={item.label}
            href={`${base}${item.segment ? `/${item.segment}` : ''}`}
            active={activeId === item.id}
            badge={item.id === 'orders' && ordersBadge > 0 ? ordersBadge : undefined}
          />
        ))}

        <div style={{
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
            onClick={openHelp}
          />
          <button
            onClick={openProfile}
            aria-label="Profil"
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: 'none',
              background: 'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
              color: '#5a2a14',
              fontWeight: 600,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 4,
              cursor: 'pointer',
            }}
          >
            {userInitials}
          </button>
        </div>
      </div>
    </>
  )
}

interface RailLinkProps {
  ItemIcon: Icon
  label: string
  href: string
  active: boolean
  badge?: number
}

function RailLink({ ItemIcon, label, href, active, badge }: RailLinkProps) {
  const router = useRouter()
  const { getNavigationGuard } = useShell()
  return (
    <div
      onMouseEnter={() => router.prefetch(href)}
      style={{ position: 'relative', width: 40, display: 'flex', justifyContent: 'center' }}
      title={label}
    >
      {active && (
        <div style={{
          position: 'absolute',
          left: -1,
          top: 6,
          bottom: 6,
          width: 2.5,
          background: 'var(--text)',
          borderRadius: 2,
        }} />
      )}
      <Link
        href={href}
        aria-label={label}
        prefetch={true}
        className={`rail-link${active ? ' rail-link--active' : ''}`}
        onClick={(e) => {
          if (active) return
          const guardMessage = getNavigationGuard()
          if (guardMessage && !window.confirm(guardMessage)) {
            e.preventDefault()
            return
          }
          window.dispatchEvent(new Event('navigation-start'))
        }}
      >
        <ItemIcon size={18} />
      </Link>
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
    </div>
  )
}

interface RailButtonProps {
  ItemIcon: Icon
  label: string
  size?: number
  onClick: () => void
}

function RailButton({ ItemIcon, label, size = 18, onClick }: RailButtonProps) {
  return (
    <div
      style={{ position: 'relative', width: 40, display: 'flex', justifyContent: 'center' }}
      title={label}
    >
      <button
        onClick={onClick}
        aria-label={label}
        className="rail-btn"
      >
        <ItemIcon size={size} />
      </button>
    </div>
  )
}
