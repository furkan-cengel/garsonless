'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { I } from '../../lib/ui'
import { useShell } from '../../lib/shell-context'

interface Props {
  restaurantName: string
  title: string
  tag?: ReactNode
  center?: ReactNode
  right?: ReactNode
  backHref?: string
}

export default function PageTopBar({ restaurantName, title, tag, center, right, backHref }: Props) {
  const { openStoreSwitcher, openNotifications, notificationCount } = useShell()
  const router = useRouter()

  return (
    <div style={{
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {backHref && (
          <button
            onClick={() => router.push(backHref)}
            aria-label="Geri"
            style={{
              width: 28, height: 28, border: 'none', borderRadius: 6,
              background: 'transparent', color: 'var(--text-2)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <I.chevLeft size={16} />
          </button>
        )}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingRight: 8, borderRight: '1px solid var(--border)',
          height: 28, flexShrink: 0,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 12,
          }}>g</div>
          <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-.01em' }}>garsonless</span>
        </div>

        <button
          onClick={openStoreSwitcher}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-2)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '5px 8px', borderRadius: 6,
          }}
        >
          <span>{restaurantName}</span>
          <I.chevDown size={13} />
        </button>

        <span style={{ color: 'var(--text-4)', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{title}</span>
        {tag}
      </div>

      {/* Center */}
      {center && <div>{center}</div>}

      {/* Right */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        justifyContent: 'flex-end',
      }}>
        {right}
        <button
          onClick={openNotifications}
          aria-label="Bildirimler"
          style={{
            position: 'relative',
            width: 30, height: 30, border: 'none', borderRadius: 7,
            background: 'transparent', color: 'var(--text-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <I.bell size={16} />
          {notificationCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999,
              background: 'var(--critical)', color: '#fff',
              fontSize: 9.5, fontWeight: 700, lineHeight: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--surface)',
            }}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
