'use client'

import { useActionState, useState } from 'react'
import { useParams } from 'next/navigation'
import { requestStands } from '../../../../../lib/actions/stands'
import type { StandType } from '../../../../../lib/actions/stands'
import { I } from '../../../../../lib/ui'

const STANDS = [
  {
    id: 'basic' as StandType,
    name: 'Basic Stand',
    material: 'Akrilik',
    description: 'Hafif akrilik masa standı, QR kart yuvası ile. Gündelik mekanlar için ideal.',
    price: '₺49\'dan',
    icon: <I.qr size={22} />,
  },
  {
    id: 'premium' as StandType,
    name: 'Premium Stand',
    material: 'Metal',
    description: 'Fırçalı paslanmaz çelik stand, manyetik QR kart. Premium görünüm ve his.',
    price: '₺149\'dan',
    icon: <I.frame size={22} />,
  },
  {
    id: 'custom' as StandType,
    name: 'Özel Marka',
    material: 'Tercihinize göre',
    description: 'Logo, renk ve materyal ile tam markalı standlar. Min. 20 adet.',
    price: 'Özel fiyat',
    icon: <I.store size={22} />,
  },
]

const inputStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 11px',
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)',
  fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5, display: 'block',
}

export default function OrderStandsPage() {
  const params = useParams<{ restaurantId: string }>()
  void params
  const [selected, setSelected] = useState<StandType>('basic')
  const [state, formAction, pending] = useActionState(requestStands, null)

  if (state && 'success' in state) {
    return (
      <div style={{
        maxWidth: 480, margin: '80px auto 0', textAlign: 'center',
        padding: '0 24px',
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 999, margin: '0 auto 20px',
          background: 'var(--positive-bg)',
          color: 'var(--positive)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><I.check size={28} /></div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>
          Talebiniz alındı!
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', lineHeight: 1.6 }}>
          En geç 1 iş günü içinde siparişinizi onaylamak ve teslimatı planlamak üzere iletişime geçeceğiz.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, padding: '28px 28px 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
          QR Stand Sipariş Et
        </h1>
        <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6 }}>
          Masalarınız için fiziksel QR standları. Biz basıyoruz, kesiyoruz ve direkt restoranınıza gönderiyoruz.
        </p>
      </div>

      {/* Stand options */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {STANDS.map((stand) => {
          const isSel = selected === stand.id
          return (
            <button
              key={stand.id}
              type="button"
              onClick={() => setSelected(stand.id)}
              style={{
                textAlign: 'left', borderRadius: 12,
                border: `2px solid ${isSel ? 'var(--text)' : 'var(--border)'}`,
                padding: '14px 14px 12px',
                background: isSel ? 'var(--surface-2)' : 'var(--surface)',
                cursor: 'pointer', transition: 'border-color 120ms, background 120ms',
                boxShadow: isSel ? 'var(--shadow-2)' : 'none',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <span style={{ color: 'var(--text-2)', display: 'inline-flex' }}>{stand.icon}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{stand.name}</p>
                <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: '2px 0 0' }}>{stand.material}</p>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.5 }}>{stand.description}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{stand.price}</p>
            </button>
          )
        })}
      </div>

      {/* Contact form */}
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input type="hidden" name="standType" value={selected} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={labelStyle}>Restoran adı</label>
            <input name="restaurantName" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Adınız</label>
            <input name="contactName" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>E-posta</label>
            <input type="email" name="email" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Telefon</label>
            <input type="tel" name="phone" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Masa sayısı</label>
            <input type="number" name="tableCount" min={1} required style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notlar <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(opsiyonel)</span></label>
          <textarea
            name="notes"
            rows={3}
            maxLength={500}
            placeholder="Özel istekler, teslimat adresi, tercih edilen malzeme…"
            style={{
              ...inputStyle, height: 'auto', padding: '9px 11px',
              resize: 'none', lineHeight: 1.5,
            }}
          />
        </div>

        {state && 'error' in state && (
          <p style={{ fontSize: 13, color: 'var(--critical)', margin: 0 }}>{state.error}</p>
        )}

        <div>
          <button
            type="submit"
            disabled={pending}
            style={{
              height: 42, padding: '0 24px', borderRadius: 9,
              background: 'var(--action)', color: 'var(--on-action)',
              border: 'none', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', opacity: pending ? 0.55 : 1,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 2px 8px -2px rgba(0,0,0,.18)',
            }}
          >
            {pending ? 'Gönderiliyor…' : 'Stand talep et'}
          </button>
        </div>
      </form>
    </div>
  )
}
