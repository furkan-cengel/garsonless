'use client'

import Link from 'next/link'
import React from 'react'
import { AppIconNodes } from '@garsonless/ui/icons'
import type { TableItem } from './tables-builder-types'

export function TablesQRPickerContent({ restaurantId, tables, filtered, activeId, query, setQuery, onSelect, mobile = false }: {
  restaurantId: string
  tables: TableItem[]
  filtered: TableItem[]
  activeId: string
  query: string
  setQuery: (query: string) => void
  onSelect: (tableId: string) => void
  mobile?: boolean
}) {
  return (
    <>
      {!mobile && (
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong style={{ flex: 1, fontSize: 14 }}>QR masaları</strong>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tables.length}</span>
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 11.5, color: 'var(--text-3)' }}>Önizlenecek ve indirilecek masayı seçin.</p>
        </div>
      )}
      <div style={{ padding: '10px 12px 4px' }}>
        <label className="tb-tables__search" style={{
          display: 'flex', alignItems: 'center', gap: 6, height: 44, padding: '0 10px',
          background: 'var(--surface-3)', borderRadius: 7, color: 'var(--text-3)',
        }}>
          {React.cloneElement(AppIconNodes.search as React.ReactElement<{ size?: number }>, { size: 13 })}
          <span className="sr-only">QR masası ara</span>
          <input data-modal-initial-focus={mobile ? true : undefined} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Masa ara" style={{ flex: 1, minWidth: 0, minHeight: 44, border: 0, outline: 0, background: 'transparent', fontSize: 12.5 }} />
        </label>
      </div>
      <div className="tb-tables__nav-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 8px 12px' }}>
        {filtered.map((table) => {
          const active = table.id === activeId
          return (
            <button
              key={table.id}
              type="button"
              aria-pressed={active}
              aria-label={`${table.label} QR kodunu düzenle`}
              onClick={() => onSelect(table.id)}
              style={{
                width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 9,
                marginBottom: 4, padding: '7px 10px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                border: active ? '1px solid var(--action)' : '1px solid transparent',
                background: active ? 'var(--positive-bg)' : 'transparent', color: 'var(--text)',
              }}
            >
              <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 7, display: 'grid', placeItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {React.cloneElement(AppIconNodes.qr as React.ReactElement<{ size?: number }>, { size: 15 })}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.label}</span>
                <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-3)' }}>{table.qrToken ? 'QR etkin' : 'QR hazırlanıyor'}</span>
              </span>
              {active && <span style={{ color: 'var(--positive)', fontSize: 11, fontWeight: 750 }}>Seçili</span>}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ margin: 8, padding: 16, border: '1px dashed var(--border-strong)', borderRadius: 9, textAlign: 'center', color: 'var(--text-3)' }}>
            <strong style={{ display: 'block', color: 'var(--text-2)' }}>{tables.length === 0 ? 'Henüz masa yok' : 'Eşleşen masa yok'}</strong>
            <span style={{ display: 'block', marginTop: 4, fontSize: 11.5 }}>{tables.length === 0 ? 'Canlı Masalar bölümünden ilk masanızı ekleyin.' : 'Arama ifadesini değiştirin.'}</span>
          </div>
        )}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
        <Link href={`/dashboard/${restaurantId}/tables`} style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-strong)', borderRadius: 8, color: 'var(--text)', fontWeight: 700, textDecoration: 'none' }}>
          Masaları yönet
        </Link>
      </div>
    </>
  )
}
