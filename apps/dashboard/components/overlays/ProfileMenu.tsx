'use client'

import { useRouter } from 'next/navigation'
import type { Tables } from '@garsonless/db'
import { I, S, Tag } from '../../lib/ui'
import { signOut } from '../../lib/actions/auth'

const GRADIENTS = [
  'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
  'linear-gradient(135deg, #a4f7c8 0%, #4caf7f 100%)',
  'linear-gradient(135deg, #c4d0ff 0%, #6e87e5 100%)',
  'linear-gradient(135deg, #f5dcea 0%, #d97757 100%)',
]

interface Props {
  userEmail: string
  userInitials: string
  restaurants: Tables<'restaurants'>[]
  currentRestaurantId: string
  onClose: () => void
}

export default function ProfileMenu({
  userEmail,
  userInitials,
  restaurants,
  currentRestaurantId,
  onClose,
}: Props) {
  const router = useRouter()

  function handleStoreSelect(id: string) {
    if (id !== currentRestaurantId) {
      router.push(`/dashboard/${id}`)
    }
    onClose()
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 56, bottom: 16,
          width: 280, background: 'var(--surface)',
          borderRadius: 12, boxShadow: 'var(--shadow-pop)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {/* User card */}
        <div style={{
          padding: 14, display: 'flex', alignItems: 'center', gap: 10,
          borderBottom: '1px solid var(--divider)',
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999, flexShrink: 0,
            background: 'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
            color: '#5a2a14', fontWeight: 700, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {userInitials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail.split('@')[0]}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </div>
          </div>
          <Tag tone="positive">Pro</Tag>
        </div>

        {/* Store list */}
        {restaurants.length > 0 && (
          <div style={{ padding: '8px 6px 4px' }}>
            <div style={{ ...S.label, padding: '4px 10px 4px' }}>Mağaza</div>
            {restaurants.slice(0, 3).map((r, i) => {
              const active = r.id === currentRestaurantId
              return (
                <button
                  key={r.id}
                  onClick={() => handleStoreSelect(r.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '7px 10px', borderRadius: 6,
                    background: active ? 'var(--surface-inset)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-3)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? 'var(--surface-inset)' : 'transparent' }}
                >
                  <div style={{
                    width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                    background: GRADIENTS[i % GRADIENTS.length],
                    color: '#fff', fontWeight: 700, fontSize: 10,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {r.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: active ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                  </div>
                  {active && (
                    <span style={{ color: 'var(--positive)', flexShrink: 0 }}>
                      <I.check size={14} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />

        <div style={{ padding: '4px 6px' }}>
          {[
            { Icon: I.gear,    label: 'Hesap ayarları', href: `/dashboard/${currentRestaurantId}/settings` },
            { Icon: I.history, label: 'Etkinlik geçmişi' },
            { Icon: I.bell,    label: 'Bildirimler', badge: '2' },
            { Icon: I.globe,   label: 'Dil & Bölge', sub: 'Türkçe · TRY' },
          ].map((m, i) => (
            <button
              key={i}
              onClick={() => {
                if (m.href) {
                  router.push(m.href)
                  onClose()
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 10px', borderRadius: 6,
                background: 'transparent', border: 'none',
                cursor: m.href ? 'pointer' : 'default', textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-3)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ color: 'var(--text-2)' }}>
                <m.Icon size={15} />
              </span>
              <span style={{ flex: 1, fontSize: 12.5 }}>{m.label}</span>
              {m.sub && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.sub}</span>}
              {m.badge && <Tag tone="critical">{m.badge}</Tag>}
            </button>
          ))}
        </div>

        <div style={{ height: 1, background: 'var(--divider)', margin: '4px 0' }} />

        <div style={{ padding: '6px 10px 12px' }}>
          <form action={signOut}>
            <button
              type="submit"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 10px', borderRadius: 6,
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                color: 'var(--critical)', fontSize: 12.5, fontWeight: 500,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--critical-bg)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <I.logout size={15} />
              Çıkış yap
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
