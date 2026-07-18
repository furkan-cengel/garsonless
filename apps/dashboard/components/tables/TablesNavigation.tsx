'use client'

import React, { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { InlineSpinner } from '@garsonless/ui'
import { AppIconNodes, AppIcons } from '@garsonless/ui/icons'
import type { OpenTableSessionView, TableItem } from './tables-builder-types'
import { useTableManagement } from './use-table-management'

const I = {
  search: AppIconNodes.search,
  plus: AppIconNodes.plus,
  check: AppIconNodes.check,
  close: AppIconNodes.close,
  bellSmall: <AppIcons.bell size={11} />,
}

const QRI = {
  more: AppIconNodes.more,
}

const S = {
  label: { fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: 'var(--text-3)' },
  mono: { fontFamily: "'Geist Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' as const },
}

function btnPrimary(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid var(--action)',
    background: 'var(--action)', color: 'var(--on-action)',
    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 1px 0 rgba(0,0,0,.04)',
  }
}

function btnGhost(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 30, padding: '0 10px', borderRadius: 7,
    border: '1px solid var(--border-strong)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0,
  }
}

function MiniQR({ seed }: { seed: string }) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const rand = (i: number) => {
    const x = ((h ^ (i * 2654435761)) >>> 0)
    return (x % 100) / 100
  }
  const cells: [number, number][] = []
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    if (rand(y * 7 + x) > 0.55) cells.push([x, y])
  }
  return (
    <svg width="20" height="20" viewBox="0 0 14 14">
      <rect x="0" y="0" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="1" y="1" width="2" height="2" fill="#fff" />
      <rect x="10" y="0" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="11" y="1" width="2" height="2" fill="#fff" />
      <rect x="0" y="10" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="1" y="11" width="2" height="2" fill="#fff" />
      {cells.map(([x, y], i) => (
        (x < 4 && y < 4) || (x > 9 && y < 4) || (x < 4 && y > 9) ? null :
        <rect key={i} x={x * 2} y={y * 2} width="1.6" height="1.6" fill="#111113" />
      ))}
    </svg>
  )
}

/* ─── TableRow ──────────────────────────────────────────────── */
function DeleteTableDialog({ label, busy, onCancel, onConfirm }: {
  label: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])
  return (
    <div onClick={() => { if (!busy) onCancel() }} style={{
      position: 'fixed', inset: 0, zIndex: 90, padding: 20,
      display: 'grid', placeItems: 'center', background: 'rgba(17,17,19,.48)', backdropFilter: 'blur(4px)',
    }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-table-title" aria-describedby="delete-table-description" onClick={event => event.stopPropagation()} style={{
        width: 'min(420px, 100%)', padding: 20, borderRadius: 14,
        background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)',
      }}>
        <div id="delete-table-title" style={{ fontSize: 16, fontWeight: 750 }}>Masayı sil</div>
        <div id="delete-table-description" style={{ marginTop: 8, color: 'var(--text-2)', fontSize: 12.5, lineHeight: 1.55 }}>
          <strong>{label}</strong> listeden kaldırılacak. Bu masanın tahmin edilemez QR bağlantısı artık kullanılamayacak.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button type="button" autoFocus disabled={busy} onClick={onCancel} style={btnGhost()}>Vazgeç</button>
          <button type="button" disabled={busy} onClick={onConfirm} style={{
            ...btnPrimary(), background: 'var(--critical)', opacity: busy ? .6 : 1,
          }}>{busy ? <><InlineSpinner size={12} color="#fff" /> Siliniyor…</> : 'Masayı sil'}</button>
        </div>
      </div>
    </div>
  )
}

function TableRow({
  table,
  active,
  onClick,
  onRename,
  onDelete,
  deleteDisabled,
}: {
  table: TableItem
  active: boolean
  onClick: () => void
  onRename: (label: string) => Promise<string | null>
  onDelete: () => Promise<string | null>
  deleteDisabled: boolean
}) {
  const [hov, setHov] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(table.label)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const dotColor = table.status === 'active' ? 'var(--positive)' : table.status === 'paused' ? 'var(--warning)' : 'var(--text-4)'

  useEffect(() => {
    if (!editing) setDraft(table.label)
  }, [editing, table.label])

  const commitRename = async () => {
    const nextLabel = draft.trim()
    if (!nextLabel) return
    if (nextLabel === table.label) {
      setEditing(false)
      return
    }
    setBusy(true)
    setError(null)
    const nextError = await onRename(nextLabel)
    setBusy(false)
    if (nextError) {
      setError(nextError)
      return
    }
    setEditing(false)
  }

  const commitDelete = async () => {
    if (deleteDisabled) {
      setError('Bu masada açık adisyon var. Önce adisyonu kapatın.')
      setMenuOpen(false)
      return
    }
    setBusy(true)
    setError(null)
    const nextError = await onDelete()
    setBusy(false)
    if (nextError) {
      setError(nextError)
      return
    }
    setDeleteOpen(false)
  }

  if (editing) {
    return (
      <div style={{
        padding: 8, marginBottom: 3,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void commitRename()
            if (e.key === 'Escape') { setEditing(false); setError(null) }
          }}
          style={{
            width: '100%', height: 28, padding: '0 8px', marginBottom: 6,
            border: '1px solid var(--border-strong)', borderRadius: 6,
            outline: 'none', fontSize: 12.5,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void commitRename()}
            style={{ ...btnPrimary(), height: 26, fontSize: 11.5, padding: '0 10px', flex: 1, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <><InlineSpinner size={11} color="var(--on-action)" /> Kaydediliyor…</> : <>{React.cloneElement(I.check as React.ReactElement<{ size?: number }>, { size: 12 })}Kaydet</>}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null) }}
            style={{ ...btnGhost(), height: 26, fontSize: 11.5, padding: '0 10px' }}
          >
            {React.cloneElement(I.close as React.ReactElement<{ size?: number }>, { size: 12 })}
          </button>
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--critical)' }}>{error}</div>}
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ position: 'relative', marginBottom: 1 }}
    >
      <button onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '8px 8px',
          background: active ? 'var(--surface-inset)' : (hov || menuOpen ? 'var(--surface-3)' : 'transparent'),
          border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{
          width: 26, height: 26, borderRadius: 5,
          background: '#fff', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <MiniQR seed={table.slug} />
        </div>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--text)' }}>{table.label}</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: dotColor }} />
            {table.orders > 0 ? `${table.orders} sipariş bugün` : 'Boş'}
          </span>
        </span>
        <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-4)', marginRight: hov || active || menuOpen ? 28 : 0 }}>/{table.slug}</span>
      </button>
      {(hov || active || menuOpen) && (
        <button
          type="button"
          aria-label={`${table.label} seçenekleri`}
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
          style={{
            position: 'absolute', top: 7, right: 6,
            width: 24, height: 24, border: '1px solid var(--border)',
            borderRadius: 6, background: 'var(--surface)', color: 'var(--text-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {React.cloneElement(QRI.more as React.ReactElement<{ size?: number }>, { size: 13 })}
        </button>
      )}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />
          <div style={{
            position: 'absolute', top: 34, right: 4, zIndex: 5,
            minWidth: 160, padding: 4,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-pop)',
          }}>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setEditing(true); setError(null) }}
              style={{
                width: '100%', border: 'none', background: 'transparent',
                borderRadius: 5, padding: '7px 9px', textAlign: 'left',
                fontSize: 12, color: 'var(--text)', cursor: 'pointer',
              }}
            >
              Yeniden adlandır
            </button>
            <button
              type="button"
              disabled={deleteDisabled}
              onClick={() => { setMenuOpen(false); setDeleteOpen(true); setError(null) }}
              style={{
                width: '100%', border: 'none', background: 'transparent',
                borderRadius: 5, padding: '7px 9px', textAlign: 'left',
                fontSize: 12, color: deleteDisabled ? 'var(--text-4)' : 'var(--critical)',
                cursor: deleteDisabled ? 'default' : 'pointer',
              }}
              title={deleteDisabled ? 'Açık adisyonu olan masa silinemez' : undefined}
            >
              Sil
            </button>
          </div>
        </>
      )}
      {error && <div style={{ margin: '3px 6px 4px 36px', fontSize: 11, color: 'var(--critical)' }}>{error}</div>}
      {deleteOpen && (
        <DeleteTableDialog
          label={table.label}
          busy={busy}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => { void commitDelete() }}
        />
      )}
    </div>
  )
}

/* ─── TablesNav ─────────────────────────────────────────────── */
function sessionDuration(openedAt: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60_000))
  if (mins < 60) return `${mins}dk`
  return `${Math.floor(mins / 60)}s ${mins % 60}dk`
}

function LiveSessionDuration({ openedAt }: { openedAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const update = () => setNow(Date.now())
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])
  return <>{sessionDuration(openedAt, now)}</>
}

export function TablesNavigation({ tables, setTables, activeId, setActiveId, restaurantId, openSessions, onCloseSession, pendingRequests, onResolveRequest, requestError, sessionError }: {
  tables: TableItem[]
  setTables: Dispatch<SetStateAction<TableItem[]>>
  activeId: string
  setActiveId: Dispatch<SetStateAction<string>>
  restaurantId: string
  openSessions: Record<string, OpenTableSessionView>
  onCloseSession: (session: OpenTableSessionView, label: string) => void
  pendingRequests: Record<string, Array<{ id: string; label: string }>>
  onResolveRequest: (requestId: string) => void
  requestError: string | null
  sessionError: string | null
}) {
  const {
    adding,
    startAdding,
    cancelAdding,
    newLabel,
    setNewLabel,
    saving,
    query,
    setQuery,
    addError,
    filteredTables,
    addTable,
    rename,
    remove,
  } = useTableManagement({ restaurantId, tables, setTables, activeId, setActiveId })

  return (
    <div className="tb-tables__nav" style={{
      width: 'var(--nav)', flexShrink: 0,
      borderRight: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-.01em', flex: 1 }}>Masalar</div>
          <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)' }}>{tables.length}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          {Object.keys(openSessions).length} aktif · Tek stil
        </div>
      </div>
      {requestError && (
        <div role="alert" style={{ margin: '8px 12px 0', padding: '8px 10px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>
          İstek tamamlanamadı: {requestError}
        </div>
      )}
      {sessionError && (
        <div role="alert" style={{ margin: '8px 12px 0', padding: '8px 10px', borderRadius: 7, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 11.5 }}>
          Masa durumu yenilenemedi: {sessionError}
        </div>
      )}

      <div style={{ padding: '10px 12px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 30, padding: '0 10px',
          background: 'var(--surface-3)', borderRadius: 7,
          color: 'var(--text-3)',
        }}>
          {React.cloneElement(I.search as React.ReactElement<{ size?: number }>, { size: 13 })}
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Masa ara"
            style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 12.5, color: 'var(--text)',
          }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 12px' }}>
        <div style={{ ...S.label, padding: '6px 8px 6px' }}>Tüm masalar</div>
        {filteredTables.length === 0 && (
          <div style={{
            margin: '8px 4px 12px', padding: '18px 12px',
            border: '1px dashed var(--border-strong)', borderRadius: 9,
            textAlign: 'center', color: 'var(--text-3)', background: 'var(--surface-2)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              {tables.length === 0 ? 'Henüz masa yok' : 'Eşleşen masa yok'}
            </div>
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              {tables.length === 0 ? 'İlk QR masasını ekleyerek başlayın.' : 'Aramayı temizleyin ya da yeni masa ekleyin.'}
            </div>
          </div>
        )}
        {filteredTables.map(t => {
          const session = openSessions[t.id]
          const tableRequests = pendingRequests[t.id] ?? []
          const rowTable: TableItem = session
            ? { ...t, status: 'active', orders: session.orderCount }
            : { ...t, status: 'idle', orders: 0 }
          return (
            <div key={t.id}>
              <TableRow
                table={rowTable}
                active={activeId === t.id}
                onClick={() => setActiveId(t.id)}
                onRename={(label) => rename(t, label)}
                onDelete={() => remove(t)}
                deleteDisabled={Boolean(session)}
              />
              {tableRequests.map((request) => (
                <div key={request.id} style={{
                  margin: '0 4px 4px 28px', padding: '5px 8px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,159,64,.14)', borderRadius: 6,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#b8690f', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {I.bellSmall}{request.label}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onResolveRequest(request.id) }}
                    style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
                      border: '1px solid #d98324', borderRadius: 5,
                      background: 'var(--surface)', color: '#b8690f',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >Tamamla</button>
                </div>
              ))}
              {session && (
                <div style={{
                  margin: '0 4px 4px 28px', padding: '5px 8px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--positive-bg)', borderRadius: 6,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--positive)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ₺{session.total.toLocaleString('tr-TR')} · <LiveSessionDuration openedAt={session.openedAt} />
                    {session.unpaidTotal > 0 && ` · ₺${session.unpaidTotal.toLocaleString('tr-TR')} açık`}
                    {session.splitDeclaredCashTotal > 0 && ` · ₺${session.splitDeclaredCashTotal.toLocaleString('tr-TR')} nakit onayı`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCloseSession(session, t.label) }}
                    style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
                      border: '1px solid var(--positive)', borderRadius: 5,
                      background: 'var(--surface)', color: 'var(--positive)',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >Kapat</button>
                </div>
              )}
            </div>
          )
        })}

        {adding ? (
          <div style={{
            margin: '8px 4px 4px', padding: 8,
            border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-2)',
          }}>
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTable(); if (e.key === 'Escape') cancelAdding() }}
              placeholder="örn. Masa 11"
              style={{
                width: '100%', height: 28, padding: '0 8px', marginBottom: 6,
                border: '1px solid var(--border-strong)', borderRadius: 6,
                outline: 'none', fontSize: 12.5,
              }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={addTable} disabled={saving} style={{ ...btnPrimary(), height: 26, fontSize: 11.5, padding: '0 10px', flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? <><InlineSpinner size={11} color="var(--on-action)" /> Kaydediliyor…</> : 'Ekle'}</button>
              <button onClick={cancelAdding} style={{ ...btnGhost(), height: 26, fontSize: 11.5, padding: '0 10px' }}>İptal</button>
            </div>
            {addError && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--critical)' }}>{addError}</div>}
          </div>
        ) : (
          <button onClick={startAdding} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 10px', marginTop: 8,
            border: '1px dashed var(--border-strong)', background: 'transparent',
            color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 500,
          }}>
            {React.cloneElement(I.plus as React.ReactElement<{ size?: number }>, { size: 13 })}Masa ekle
          </button>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', background: 'var(--surface-2)', fontSize: 11.5, color: 'var(--text-3)' }}>
        PNG/SVG indirme seçili masa üzerinden yapılır; toplu PDF export ayrı bir iş olarak duruyor.
      </div>
    </div>
  )
}
