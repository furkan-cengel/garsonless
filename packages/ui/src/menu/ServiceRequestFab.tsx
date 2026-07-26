'use client'

import { useEffect, useRef, useState } from 'react'
import { AppIcons as I } from '../icons'
import type { ServiceRequestType } from '@garsonless/domain/tables'
import { resolveServiceRequestFabConfig } from './serviceRequestFabConfig'
import type { ServiceRequestIcon } from './serviceRequestFabConfig'

interface ServiceRequestFabProps {
  tableLabel?: string | null
  onRequest: (type: ServiceRequestType) => Promise<boolean>
  config?: Record<string, string>
  trigger?: 'floating' | 'none'
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

const REQUEST_ICONS: Record<Exclude<ServiceRequestIcon, 'none' | 'custom'>, typeof I.bell> = {
  bell: I.bell,
  spray: I.spray,
  cigarette: I.cigarette,
  'hand-platter': I.handPlatter,
  'glass-water': I.glassWater,
  receipt: I.receipt,
}

function RequestIcon({ name, size, customIconUrl }: {
  name: ServiceRequestIcon
  size: number
  customIconUrl?: string | null
}) {
  if (name === 'none') return null
  if (name === 'custom') {
    return customIconUrl ? (
      <img
        src={customIconUrl}
        alt=""
        aria-hidden="true"
        style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
      />
    ) : <I.image size={size} />
  }
  const Icon = REQUEST_ICONS[name]
  return <Icon size={size} />
}

export function ServiceRequestFab({ tableLabel, onRequest, config = {}, trigger = 'floating', open: controlledOpen, onOpenChange }: ServiceRequestFabProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (next: boolean | ((current: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next
    if (controlledOpen === undefined) setInternalOpen(value)
    onOpenChange?.(value)
  }
  const [pending, setPending] = useState<ServiceRequestType | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const resolved = resolveServiceRequestFabConfig(config)
  const waiter = resolved.requests.find((request) => request.type === 'waiter')
  const quickRequests = resolved.requests.filter((request) => request.type !== 'waiter')
  const fabSize = resolved.size === 'compact' ? 52 : resolved.size === 'large' ? 64 : 58
  const sideStyle = resolved.position === 'left' ? { left: 18 } : { right: 18 }
  const dialogSideStyle = resolved.position === 'left' ? { left: 16 } : { right: 16 }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
    })
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]'))
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      const previous = previousFocusRef.current
      const fallback = document.querySelector<HTMLElement>('[aria-label="Menüyü aç"]')
      if (previous?.isConnected && !previous.closest('[inert]')) previous.focus()
      else fallback?.focus()
    }
  }, [open])

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

  if (resolved.requests.length === 0) return null

  return (
    <>
      <style>{`
        [data-service-request-row] {
          transition: background-color 140ms ease, border-color 140ms ease, transform 140ms ease;
        }
        [data-service-request-row]:not(:disabled):hover {
          background: var(--p-accent-soft) !important;
          border-color: color-mix(in srgb, var(--p-accent) 34%, var(--p-border)) !important;
          transform: translateY(-1px);
        }
        [data-service-request-row]:focus-visible,
        [data-service-request-primary]:focus-visible {
          outline: 2px solid var(--p-accent);
          outline-offset: 2px;
        }
      `}</style>
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
        ref={dialogRef}
        role="dialog"
        aria-label="Garson ve hızlı istekler"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        style={{
          position: 'fixed',
          ...dialogSideStyle,
          bottom: `calc(${trigger === 'floating' ? resolved.bottomOffset + fabSize + 16 : 16}px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 48,
          width: 'min(292px, calc(100vw - 32px))',
          borderRadius: 16,
          overflow: 'hidden',
          background: 'var(--p-card)',
          border: '1px solid var(--p-border)',
          boxShadow: '0 24px 56px -20px rgba(0,0,0,.42)',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(10px) scale(.97)',
          transformOrigin: `bottom ${resolved.position}`,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 160ms ease, transform 200ms cubic-bezier(.2,.8,.2,1)',
          fontFamily: 'var(--p-body)',
        }}
      >
        <div style={{ padding: '14px 14px 12px' }}>
          <strong style={{ display: 'block', color: 'var(--p-text)', fontSize: 14.5 }}>{resolved.title}</strong>
          <span style={{ display: 'block', marginTop: 3, color: 'var(--p-text-2)', fontSize: 11.5 }}>
            {tableLabel ?? 'Masanız'} · {resolved.subtitle}
          </span>
          {waiter ? (
            <button
              data-service-request-primary
              type="button"
              disabled={pending !== null}
              onClick={() => void send('waiter', waiter.label)}
              style={{
                width: '100%', height: 46, marginTop: 12, border: 0, borderRadius: 10,
                background: 'var(--p-accent)', color: '#fff', cursor: pending ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, padding: '0 13px',
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 750,
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: 18, height: 18, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {waiter.icon !== 'none' ? <RequestIcon name={waiter.icon} customIconUrl={waiter.customIconUrl} size={18} /> : null}
              </span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                {pending === 'waiter' ? 'İletiliyor…' : waiter.label}
              </span>
              <I.chevRight size={16} />
            </button>
          ) : null}
        </div>

        {quickRequests.length > 0 ? (
          <div style={{ padding: '2px 14px 6px', color: 'var(--p-text-2)', fontSize: 10.5, fontWeight: 750 }}>
            {resolved.quickHeading}
          </div>
        ) : null}
        {quickRequests.length > 0 ? (
          <div style={{ padding: '0 8px 8px' }}>
            {quickRequests.map(({ type, label, icon, customIconUrl }) => (
              <button
                data-service-request-row
                key={type}
                type="button"
                disabled={pending !== null}
                onClick={() => void send(type, label)}
                style={{
                  width: '100%', minHeight: 50, border: '1px solid var(--p-border)', borderRadius: 10,
                  background: 'var(--p-card)', color: 'var(--p-text)',
                  display: 'flex', alignItems: 'center', gap: 11, padding: '6px 8px',
                  cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit',
                  marginBottom: 6,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    // Keep the leading action slot visible even when the tenant
                    // intentionally selects "İkonsuz". Removing the surface as
                    // well as the glyph makes that row look like a different
                    // control and shifts the visual hierarchy.
                    background: icon === 'none' ? 'var(--p-bg)' : 'var(--p-accent-soft)',
                    border: icon === 'none' ? '1px dashed var(--p-border)' : '1px solid transparent',
                    color: 'var(--p-accent)',
                  }}
                >
                  {icon !== 'none' ? <RequestIcon name={icon} customIconUrl={customIconUrl} size={17} /> : null}
                </span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 650 }}>
                  {pending === type ? 'İletiliyor…' : label}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {trigger === 'floating' && <button
        type="button"
        aria-label={open ? 'Hızlı istekleri kapat' : 'Garson çağır ve hızlı istekler'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        style={{
          position: 'fixed',
          ...sideStyle,
          bottom: `calc(${resolved.bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 49,
          width: fabSize,
          height: fabSize,
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
      </button>}

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
