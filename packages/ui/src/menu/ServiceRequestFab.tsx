'use client'

import { useEffect, useRef, useState } from 'react'
import { AppIcons as I } from '../icons'
import type { ServiceRequestType } from '@garsonless/db/browser'

interface ServiceRequestFabProps {
  tableLabel?: string | null
  onRequest: (type: ServiceRequestType) => Promise<boolean>
}

const REQUESTS: Array<{
  type: Exclude<ServiceRequestType, 'waiter'>
  label: string
  Icon: typeof I.bell
}> = [
  { type: 'clean_table', label: 'Masam temizlensin', Icon: I.spray },
  { type: 'change_ashtray', label: 'Küllük değişsin', Icon: I.cigarette },
  { type: 'table_service', label: 'Servis istiyorum', Icon: I.handPlatter },
  { type: 'water', label: 'Su istiyorum', Icon: I.glassWater },
  { type: 'bill', label: 'Hesap istiyorum', Icon: I.receipt },
]

export function ServiceRequestFab({ tableLabel, onRequest }: ServiceRequestFabProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<ServiceRequestType | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  async function send(type: ServiceRequestType, label: string) {
    if (pending) return
    setPending(type)
    const ok = await onRequest(type)
    setPending(null)
    setOpen(false)
    setFeedback(ok ? `${label} iletildi` : 'İstek iletilemedi')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFeedback(null), 3200)
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Hızlı istekleri kapat"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 47, border: 0,
            background: 'rgba(14,18,16,.38)', backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <div
        role="dialog"
        aria-label="Garson ve hızlı istekler"
        aria-hidden={!open}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 'calc(170px + env(safe-area-inset-bottom, 0px))',
          zIndex: 48,
          width: 'min(292px, calc(100vw - 32px))',
          borderRadius: 16,
          overflow: 'hidden',
          background: 'var(--p-card)',
          border: '1px solid var(--p-border)',
          boxShadow: '0 24px 56px -20px rgba(0,0,0,.42)',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(10px) scale(.97)',
          transformOrigin: 'bottom right',
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 160ms ease, transform 200ms cubic-bezier(.2,.8,.2,1)',
          fontFamily: 'var(--p-body)',
        }}
      >
        <div style={{ padding: '14px 14px 12px' }}>
          <strong style={{ display: 'block', color: 'var(--p-text)', fontSize: 14.5 }}>Nasıl yardımcı olalım?</strong>
          <span style={{ display: 'block', marginTop: 3, color: 'var(--p-text-2)', fontSize: 11.5 }}>
            {tableLabel ?? 'Masanız'} · isteğiniz doğrudan ekibe iletilir
          </span>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => void send('waiter', 'Garson çağrısı')}
            style={{
              width: '100%', height: 46, marginTop: 12, border: 0, borderRadius: 10,
              background: 'var(--p-accent)', color: '#fff', cursor: pending ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 13px',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 750,
            }}
          >
            <I.bell size={18} />
            <span style={{ flex: 1, textAlign: 'left' }}>
              {pending === 'waiter' ? 'İletiliyor…' : 'Garsonu çağır'}
            </span>
            <I.chevRight size={16} />
          </button>
        </div>

        <div style={{ padding: '2px 14px 6px', color: 'var(--p-text-2)', fontSize: 10.5, fontWeight: 750 }}>
          Hızlı istekler
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          {REQUESTS.map(({ type, label, Icon }) => (
            <button
              key={type}
              type="button"
              disabled={pending !== null}
              onClick={() => void send(type, label)}
              style={{
                width: '100%', minHeight: 48, border: 0, borderRadius: 8,
                background: 'transparent', color: 'var(--p-text)',
                display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px',
                cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit',
              }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--p-accent-soft)', color: 'var(--p-accent)',
              }}>
                <Icon size={17} />
              </span>
              <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 650 }}>
                {pending === type ? 'İletiliyor…' : label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        aria-label={open ? 'Hızlı istekleri kapat' : 'Garson çağır ve hızlı istekler'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{
          position: 'fixed',
          right: 18,
          bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          zIndex: 49,
          width: 58,
          height: 58,
          borderRadius: '50%',
          border: 0,
          background: open ? 'var(--p-text)' : 'var(--p-accent)',
          color: '#fff',
          boxShadow: '0 14px 30px -10px color-mix(in srgb, var(--p-accent) 70%, transparent)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 160ms ease, transform 160ms ease',
        }}
      >
        {open ? <I.close size={23} /> : <I.bell size={23} />}
      </button>

      {feedback && (
        <div
          role="status"
          style={{
            position: 'fixed', left: '50%', bottom: 'calc(166px + env(safe-area-inset-bottom, 0px))',
            zIndex: 50, transform: 'translateX(-50%)', width: 'max-content', maxWidth: 'calc(100vw - 32px)',
            borderRadius: 10, background: 'var(--p-text)', color: 'var(--p-bg)',
            padding: '10px 13px', boxShadow: '0 14px 30px -14px rgba(0,0,0,.55)',
            fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--p-body)',
          }}
        >
          {feedback}
        </div>
      )}
    </>
  )
}
