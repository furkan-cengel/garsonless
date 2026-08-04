'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { I } from '../../lib/ui'
import { useShell } from '../../lib/shell-context'

interface Props {
  restaurantName: string
  title: string
  className?: string
  tag?: ReactNode
  center?: ReactNode
  right?: ReactNode
  backHref?: string
}

export default function PageTopBar({ restaurantName, title, className, tag, center, right, backHref }: Props) {
  const { beginNavigation, openStoreSwitcher, openNotifications, notificationCount } = useShell()
  const router = useRouter()

  return (
    <div className={`page-topbar${className ? ` ${className}` : ''}`} style={{
      height: 'var(--topbar)',
      flexShrink: 0,
      display: 'grid',
      gridTemplateColumns: center ? '1fr auto 1fr' : '1fr 1fr',
      alignItems: 'center',
      padding: '0 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      {/* Left: brand + breadcrumb */}
      <div className="page-topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div className="page-topbar-context" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {backHref && (
          <button
            onClick={() => {
              beginNavigation(backHref)
              router.push(backHref)
            }}
            aria-label="Geri"
            style={{
              width: 44, height: 44, border: 'none', borderRadius: 8,
              background: 'transparent', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <I.chevLeft size={16} />
          </button>
        )}
        <div className="page-topbar-brand" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingRight: 8, borderRight: '1px solid var(--border)',
          height: 28, flexShrink: 0,
        }}>
          {/* Real wordmark (light topbar → transparent variant); replaces the placeholder m-box + text. */}
          <Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={83} height={18} priority style={{ height: 18, width: 'auto', display: 'block' }} />
        </div>

        <button
          className="page-topbar-restaurant"
          onClick={openStoreSwitcher}
          aria-label={`${restaurantName} işletmesini değiştir`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-2)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            minHeight: 44, minWidth: 44, padding: '0 8px', borderRadius: 8,
          }}
        >
          <span className="page-topbar-restaurant-name">{restaurantName}</span>
          <I.chevDown size={13} />
        </button>

        <span className="page-topbar-separator" style={{ color: 'var(--text-4)', fontSize: 13 }}>/</span>
        <span className="page-topbar-title" style={{ fontSize: 12, fontWeight: 500 }}>{title}</span>
        </div>
        {tag && <div className="page-topbar-tag">{tag}</div>}
      </div>

      {/* Center */}
      {center && <div>{center}</div>}

      {/* Right */}
      <div className="page-topbar-right" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        justifyContent: 'flex-end',
      }}>
        {right}
        <button
          className="page-topbar-notification"
          onClick={openNotifications}
          aria-label="Bildirimler"
          style={{
            position: 'relative',
            width: 44, height: 44, border: 'none', borderRadius: 8,
            background: 'transparent', color: 'var(--text-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          >
            <I.bell size={16} />
            <span
              suppressHydrationWarning
              aria-hidden={notificationCount === 0}
              style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999,
              background: 'var(--critical)', color: '#fff',
              fontSize: 9.5, fontWeight: 700, lineHeight: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--surface)',
              visibility: notificationCount > 0 ? 'visible' : 'hidden',
            }}
            >
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
        </button>
      </div>
    </div>
  )
}
