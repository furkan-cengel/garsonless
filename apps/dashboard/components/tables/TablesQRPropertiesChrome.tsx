'use client'

import React from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'
import type { QRHealth, SaveState } from './tables-builder-types'
import { QR_PROPERTY_TABS, type QRPropertiesTab } from './use-tables-qr-properties-model'
import { Tag } from './tables-qr-property-controls'

const TAB_ICONS = {
  qr: AppIconNodes.qr,
  paint: AppIconNodes.paint,
  image: AppIconNodes.image,
  frame: AppIconNodes.frame,
  link2: AppIconNodes.link2,
}

export function TablesQRPropertiesHeader({
  status,
  saveState,
  saveError,
  health,
  onRetry,
}: {
  status: { label: string; tone: 'neutral' | 'positive'; dot: string }
  saveState: SaveState
  saveError: string | null
  health: QRHealth
  onRetry: () => void
}) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5 }}>QR Stüdyosu</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Tüm masalara uygulanır</div>
        </div>
        <Tag tone={status.tone}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: status.dot }} />
          {status.label}
        </Tag>
      </div>
      {(saveState === 'blocked' || health.state === 'invalid') && (
        <div role="alert" aria-live="assertive" style={{ marginTop: 10, padding: '8px 9px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>
          <strong style={{ display: 'block', marginBottom: 2 }}>Kaydetme engellendi</strong>
          {saveError ?? health.message}
        </div>
      )}
      {(saveState === 'error' || saveState === 'conflict') && (
        <div role={saveState === 'error' ? 'alert' : 'status'} aria-live="polite" style={{ marginTop: 10, padding: '8px 9px', borderRadius: 7, background: saveState === 'error' ? 'var(--critical-bg)' : 'var(--warning-bg)', color: saveState === 'error' ? 'var(--critical)' : 'var(--warning)', fontSize: 11.5 }}>
          <div>{saveError ?? (saveState === 'conflict' ? 'Sunucudaki güncel QR stili yüklendi.' : 'Değişiklikler kaydedilemedi.')}</div>
          {saveState === 'error' && <button type="button" onClick={onRetry} style={{ marginTop: 6, minHeight: 44, padding: '0 8px', border: 'none', background: 'transparent', color: 'inherit', cursor: 'pointer', fontWeight: 750, textDecoration: 'underline' }}>Tekrar dene</button>}
        </div>
      )}
    </div>
  )
}

export function TablesQRPropertiesTabs({ tab, onChange }: {
  tab: QRPropertiesTab
  onChange: (tab: QRPropertiesTab) => void
}) {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const moveFocus = (index: number) => {
    const item = QR_PROPERTY_TABS[index]
    if (!item) return
    onChange(item.id)
    tabRefs.current[index]?.focus()
  }
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % QR_PROPERTY_TABS.length
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + QR_PROPERTY_TABS.length) % QR_PROPERTY_TABS.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = QR_PROPERTY_TABS.length - 1
    if (nextIndex === null) return
    event.preventDefault()
    moveFocus(nextIndex)
  }
  return (
    <div className="tb-tables__props-tabs" role="tablist" aria-label="QR stüdyosu ayarları" style={{ display: 'flex', borderBottom: '1px solid var(--divider)', padding: '0 8px', overflowX: 'auto' }}>
      {QR_PROPERTY_TABS.map((item, index) => (
        <button
          key={item.id}
          id={`qr-properties-tab-${item.id}`}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          aria-controls="qr-properties-panel"
          tabIndex={tab === item.id ? 0 : -1}
          ref={(node) => { tabRefs.current[index] = node }}
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            minHeight: 44, padding: '10px 10px', fontSize: 12, fontWeight: 500,
            border: 'none', background: 'transparent', flexShrink: 0,
            color: tab === item.id ? 'var(--text)' : 'var(--text-2)',
            borderBottom: `1.5px solid ${tab === item.id ? 'var(--text)' : 'transparent'}`,
            marginBottom: -1, cursor: 'pointer',
          }}
        >
          {React.cloneElement(TAB_ICONS[item.icon] as React.ReactElement<{ size?: number }>, { size: 13 })}
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function TablesQRPropertiesFooter({ tableCount, onReset }: { tableCount: number; onReset: () => void }) {
  return (
    <div style={{
      borderTop: '1px solid var(--divider)', padding: '10px 14px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--surface-2)',
    }}>
      <button type="button" onClick={onReset} style={{
        fontSize: 11.5, color: 'var(--text-2)', background: 'transparent',
        border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2,
      }}>Stili sıfırla</button>
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tableCount} masa</span>
    </div>
  )
}
