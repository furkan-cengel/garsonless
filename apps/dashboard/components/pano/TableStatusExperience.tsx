'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { InlineSpinner } from '@garsonless/ui'
import dynamic from 'next/dynamic'
import { EmptyState, I, IconButton, S } from '../../lib/ui'
import { closeTableSession } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import { fetchPanoTableDetail } from '../../lib/actions/pano'
import type { PanoTableDetail } from '../../lib/actions/pano'
import type { TableStatusData } from '../../lib/queries/pano'

const SettlementSheet = dynamic(() => import('../tables/SettlementSheet'))

type TableStatus = TableStatusData['status']

const STATUS: Record<TableStatus, {
  label: string
  dot: string
  bg: string
  fg: string
  border: string
}> = {
  active: { label: 'Aktif', dot: 'var(--info)', bg: 'var(--info-bg)', fg: 'var(--info)', border: 'var(--info-bg)' },
  new: { label: 'Yeni', dot: 'var(--warning)', bg: 'var(--warning-bg)', fg: 'var(--warning)', border: 'var(--warning-bg)' },
  late: { label: 'Geciken', dot: 'var(--critical)', bg: 'var(--critical-bg)', fg: 'var(--critical)', border: 'var(--critical)' },
  paid: { label: 'Ödendi', dot: 'var(--positive)', bg: 'var(--positive-bg)', fg: 'var(--positive)', border: 'var(--positive-bg)' },
  empty: { label: 'Boş', dot: 'var(--text-4)', bg: 'var(--surface-3)', fg: 'var(--text-3)', border: 'var(--border)' },
}

const fmt = (value: number) => `₺${value.toLocaleString('tr-TR')}`

function sessionFromTable(table: TableStatusData): OpenSessionInfo | null {
  if (!table.sessionId || !table.openedAt) return null
  return {
    sessionId: table.sessionId,
    tableId: table.id,
    openedAt: table.openedAt,
    total: table.total,
    unpaidTotal: table.unpaidTotal,
    splitSettledTotal: table.splitSettledTotal,
    splitDeclaredCashTotal: table.splitDeclaredCashTotal,
    orderCount: table.orderCount,
    hasUnfinished: table.hasUnfinished,
  }
}

export function TableStatusBadge({ status }: { status: TableStatus }) {
  const tone = STATUS[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 999,
      background: tone.bg, color: tone.fg,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.dot }} />
      {tone.label}
    </span>
  )
}

function tableSubtitle(table: TableStatusData): string {
  if (table.status === 'empty') return 'QR siparişi bekliyor'
  if (table.status === 'paid') return `${fmt(table.total)} · kapatılabilir`
  if (table.status === 'late') return `${table.time} dk · müdahale gerekli`
  if (table.status === 'new') return `${table.time} dk · yeni sipariş`
  return `${table.time} dk · ${fmt(table.unpaidTotal)} açık`
}

function TableHoverCard({
  table,
  anchor,
  onEnter,
  onLeave,
  onDetail,
  onNewOrder,
  canViewDetails,
  canCreateOrders,
}: {
  table: TableStatusData
  anchor: DOMRect
  onEnter: () => void
  onLeave: () => void
  onDetail: () => void
  onNewOrder: () => void
  canViewDetails: boolean
  canCreateOrders: boolean
}) {
  const width = 280
  const estimatedHeight = table.status === 'empty' ? 170 : 220
  const left = Math.max(12, Math.min(
    anchor.left + anchor.width / 2 - width / 2,
    window.innerWidth - width - 12,
  ))
  const below = anchor.bottom + 10
  const top = below + estimatedHeight < window.innerHeight
    ? below
    : Math.max(12, anchor.top - estimatedHeight - 10)
  const tone = STATUS[table.status]

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: 'fixed', left, top, width, zIndex: 200,
        overflow: 'hidden', borderRadius: 12,
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-pop)',
        animation: 'table-pop 120ms ease-out',
      }}
    >
      <div style={{ height: 3, background: tone.dot }} />
      <div style={{ padding: '11px 13px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{table.label}</div>
            <div style={{ marginTop: 2, fontSize: 11, color: 'var(--text-3)' }}>
              {table.status === 'empty' ? 'Açık adisyon yok' : `${table.orderCount} sipariş`}
            </div>
          </div>
          <TableStatusBadge status={table.status} />
        </div>

        {table.status === 'empty' ? (
          <>
            <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-2)' }}>
              Masa boş. QR siparişi bekleyebilir veya personel yeni sipariş başlatabilir.
            </p>
            {canCreateOrders && <button type="button" onClick={onNewOrder} style={primaryButton({ width: '100%', marginTop: 11 })}>
              <I.plus size={13} />Yeni sipariş başlat
            </button>}
          </>
        ) : (
          <>
            <div style={{
              marginTop: 11, padding: '10px 11px', borderRadius: 9,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
              background: table.status === 'paid' ? 'var(--positive-bg)' : 'var(--surface-2)',
              border: '1px solid var(--divider)',
            }}>
              <div>
                <div style={{ ...S.label, fontSize: 9.5 }}>
                  {table.status === 'paid' ? 'Tahsil edildi' : 'Açık adisyon'}
                </div>
                <div style={{
                  ...S.mono, marginTop: 2, fontSize: 21, lineHeight: 1.1, fontWeight: 700,
                  color: table.status === 'paid' ? 'var(--positive)' : 'var(--text)',
                }}>
                  {fmt(table.status === 'paid' ? table.total : table.unpaidTotal)}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 10.5, lineHeight: 1.4, color: 'var(--text-3)' }}>
                {table.status === 'paid' ? 'ödendi' : `${table.time} dk açık`}
              </div>
            </div>
            {table.status === 'late' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, color: 'var(--critical)', fontSize: 11, fontWeight: 600 }}>
                <I.warn size={13} />Sipariş bekleme eşiğini geçti
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {canViewDetails && <button type="button" onClick={onDetail} style={primaryButton({ flex: 1 })}>
                <I.clipboard size={13} />Adisyonu gör
              </button>}
              {canCreateOrders && <button type="button" onClick={onNewOrder} style={secondaryButton({ flex: 1 })}>
                <I.plus size={13} />Sipariş
              </button>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function primaryButton(overrides?: CSSProperties): CSSProperties {
  return {
    height: 32, border: 'none', borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    background: 'var(--action)', color: 'var(--on-action)',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    ...overrides,
  }
}

function secondaryButton(overrides?: CSSProperties): CSSProperties {
  return {
    ...primaryButton(overrides),
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)', color: 'var(--text)',
  }
}

function TableCell({
  table,
  onEnter,
  onLeave,
  onClick,
  interactive,
}: {
  table: TableStatusData
  onEnter: (rect: DOMRect) => void
  onLeave: () => void
  onClick: () => void
  interactive: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const tone = STATUS[table.status]

  return (
    <button
      type="button"
      disabled={!interactive}
      onMouseEnter={(event) => {
        setHovered(true)
        onEnter(event.currentTarget.getBoundingClientRect())
      }}
      onMouseLeave={() => {
        setHovered(false)
        onLeave()
      }}
      onFocus={(event) => onEnter(event.currentTarget.getBoundingClientRect())}
      onBlur={onLeave}
      onClick={onClick}
      style={{
        minWidth: 0, minHeight: 58, padding: '9px 9px 10px',
        borderRadius: 9, textAlign: 'left', cursor: interactive ? 'pointer' : 'default',
        background: tone.bg, color: tone.fg,
        border: `1px solid ${hovered ? 'var(--border-strong)' : tone.border}`,
        boxShadow: hovered ? 'var(--shadow-2)' : 'none',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'transform 110ms ease, box-shadow 110ms ease, border-color 110ms ease',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700 }}>
          {table.label}
        </span>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.dot, flexShrink: 0 }} />
      </span>
      <span style={{ ...S.mono, display: 'block', marginTop: 4, minHeight: 13, fontSize: 10.5, fontWeight: table.status === 'empty' ? 400 : 600, opacity: 0.85 }}>
        {table.status === 'empty' ? 'boş' : table.status === 'paid' ? 'ödendi' : fmt(table.unpaidTotal)}
      </span>
    </button>
  )
}

function Legend({ status }: { status: TableStatus }) {
  const tone = STATUS[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: tone.dot }} />
      {tone.label}
    </span>
  )
}

export function TableDetailModal({
  restaurantId,
  table,
  onClose,
  onNewOrder,
  onSettle,
  onRefresh,
  canCreateOrders = true,
}: {
  restaurantId: string
  table: TableStatusData
  onClose: () => void
  onNewOrder: () => void
  onSettle: (session: OpenSessionInfo) => void
  onRefresh: () => void
  canCreateOrders?: boolean
}) {
  const [detail, setDetail] = useState<PanoTableDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const empty = table.status === 'empty'

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = dialog?.querySelector<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    focusable?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const elements = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      if (elements.length === 0) return
      const first = elements[0]!
      const last = elements[elements.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (empty) return
    let active = true
    void fetchPanoTableDetail(restaurantId, table.id).then((result) => {
      if (!active) return
      if ('error' in result) setError(result.error)
      else setDetail(result)
    })
    return () => { active = false }
  }, [empty, restaurantId, table.id])

  const items = detail?.orders.flatMap((order) => order.items) ?? []
  const total = detail?.orders.reduce((sum, order) => sum + order.total, 0) ?? table.total
  const session = sessionFromTable(table)

  const closePaidTable = async () => {
    if (!session) return
    setClosing(true)
    setError(null)
    const result = await closeTableSession(session.sessionId, restaurantId)
    setClosing(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    onRefresh()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${table.label} adisyonu`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(17,17,19,.45)', backdropFilter: 'blur(3px)',
      }}
    >
      <div ref={dialogRef} onClick={(event) => event.stopPropagation()} style={{
        width: 'min(480px, 96vw)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        borderRadius: 14, background: 'var(--surface)', boxShadow: 'var(--shadow-pop)',
      }}>
        <div style={{ height: 4, background: STATUS[table.status].dot }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '15px 18px 14px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <strong style={{ fontSize: 18 }}>{table.label}</strong>
              <TableStatusBadge status={table.status} />
            </div>
            <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--text-3)' }}>
              {tableSubtitle(table)}
            </div>
          </div>
          <IconButton icon={<I.close size={16} />} ariaLabel="Kapat" onClick={onClose} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {error && (
            <div style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 8, background: 'var(--critical-bg)', color: 'var(--critical)', fontSize: 12 }}>
              {error}
            </div>
          )}
          {empty ? (
            <div style={{ padding: '30px 12px', textAlign: 'center' }}>
              <span style={{
                width: 46, height: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 12, background: 'var(--surface-3)', color: 'var(--text-3)',
              }}>
                <I.chair size={22} />
              </span>
              <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700 }}>Masa boş</div>
              <div style={{ maxWidth: 300, margin: '5px auto 0', color: 'var(--text-3)', fontSize: 12, lineHeight: 1.5 }}>
                Açık adisyon yok. QR siparişi bekleyebilir veya personel yeni sipariş başlatabilir.
              </div>
            </div>
          ) : detail === null && !error ? (
            <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-3)' }}>
              <InlineSpinner size={15} /> Adisyon yükleniyor…
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <Stat label="Açık süre" value={table.openedAt ? `${Math.max(0, Math.round((Date.now() - new Date(table.openedAt).getTime()) / 60000))}dk` : '—'} />
                <Stat label="Sipariş" value={String(detail?.orders.length ?? table.orderCount)} />
                <Stat label={table.status === 'paid' ? 'Tahsilat' : 'Kalan'} value={fmt(table.status === 'paid' ? total : table.unpaidTotal)} tone={table.status === 'paid' ? 'var(--positive)' : undefined} />
              </div>

              <div style={{ ...S.label, marginTop: 17, fontSize: 10 }}>Adisyon</div>
              <div style={{ marginTop: 8, overflow: 'hidden', border: '1px solid var(--divider)', borderRadius: 10 }}>
                {items.length === 0 ? (
                  <div style={{ padding: 14, color: 'var(--text-3)', fontSize: 12 }}>Ürün satırı bulunamadı.</div>
                ) : items.map((item, index) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderBottom: index === items.length - 1 ? 'none' : '1px solid var(--divider)',
                  }}>
                    <span style={{
                      ...S.mono, width: 26, height: 26, borderRadius: 6,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--surface-3)', color: 'var(--text-2)', fontSize: 12, fontWeight: 700,
                    }}>{item.quantity}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 600 }}>{item.name}</div>
                      {item.modifiers.length > 0 && <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--text-3)' }}>{item.modifiers.join(', ')}</div>}
                      {item.removedIngredients.length > 0 && <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--critical)', fontWeight: 700 }}>ÇIKAR: {item.removedIngredients.join(', ')}</div>}
                      <div style={{ ...S.mono, marginTop: 2, fontSize: 10.5, color: 'var(--text-3)' }}>{fmt(item.unitPrice)} / adet</div>
                    </div>
                    <span style={{ ...S.mono, fontSize: 13, fontWeight: 700 }}>{fmt(item.total)}</span>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 12, padding: '11px 13px', borderRadius: 10,
                display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                background: 'var(--surface-2)', border: '1px solid var(--divider)',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{table.status === 'paid' ? 'Tahsil edilen' : 'Adisyon toplamı'}</span>
                <span style={{ ...S.mono, fontSize: 22, fontWeight: 700, color: table.status === 'paid' ? 'var(--positive)' : 'var(--text)' }}>{fmt(total)}</span>
              </div>
            </>
          )}
        </div>

        {(!empty || canCreateOrders) && <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--divider)', background: 'var(--surface-2)' }}>
          {empty && canCreateOrders ? (
            <button type="button" onClick={onNewOrder} style={primaryButton({ flex: 1, height: 38 })}>
              <I.plus size={14} />Yeni sipariş başlat
            </button>
          ) : table.status === 'paid' ? (
            <>
              {canCreateOrders && <button type="button" onClick={onNewOrder} style={secondaryButton({ flex: 1, height: 38 })}>
                <I.plus size={14} />Sipariş ekle
              </button>}
              <button type="button" disabled={closing} onClick={() => void closePaidTable()} style={primaryButton({ flex: 1, height: 38, opacity: closing ? 0.6 : 1 })}>
                {closing ? <InlineSpinner size={12} color="white" /> : <I.check size={14} />}
                Masayı boşalt
              </button>
            </>
          ) : (
            <>
              {canCreateOrders && <button type="button" onClick={onNewOrder} style={secondaryButton({ flex: 1, height: 38 })}>
                <I.plus size={14} />Ürün ekle
              </button>}
              <button
                type="button"
                disabled={!session}
                onClick={() => session && onSettle(session)}
                style={primaryButton({ flex: 1, height: 38, opacity: session ? 1 : 0.5 })}
              >
                Hesabı kapat · {fmt(table.unpaidTotal)}
              </button>
            </>
          )}
        </div>}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ minWidth: 0, padding: '10px 11px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--divider)' }}>
      <div style={{ ...S.label, fontSize: 9.5 }}>{label}</div>
      <div style={{ ...S.mono, overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 3, color: tone ?? 'var(--text)', fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

export default function TableStatusExperience({
  restaurantId,
  tables,
  onFloorPlan,
  onNewOrder,
  onRefresh,
  canViewDetails,
  canCreateOrders,
}: {
  restaurantId: string
  tables: TableStatusData[]
  onFloorPlan: () => void
  onNewOrder: (tableId: string) => void
  onRefresh: () => void
  canViewDetails: boolean
  canCreateOrders: boolean
}) {
  const [hovered, setHovered] = useState<{ table: TableStatusData; anchor: DOMRect } | null>(null)
  const [detailTable, setDetailTable] = useState<TableStatusData | null>(null)
  const [settleTable, setSettleTable] = useState<{ table: TableStatusData; session: OpenSessionInfo } | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const closeHover = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    setHovered(null)
  }, [])
  const delayedClose = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
    leaveTimer.current = setTimeout(() => setHovered(null), 130)
  }, [])
  const holdHover = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
  }, [])

  useEffect(() => () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current)
  }, [])

  const active = tables.filter((table) => ['active', 'new', 'late'].includes(table.status)).length
  const paid = tables.filter((table) => table.status === 'paid').length
  const empty = tables.filter((table) => table.status === 'empty').length

  return (
    <>
      <style>{`
        @keyframes table-pop {
          from { opacity: 0; transform: translateY(5px) scale(.98); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
      <section style={{ overflow: 'visible', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px 11px', borderBottom: '1px solid var(--divider)' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Masa durumu</div>
            <div style={{ marginTop: 2, fontSize: 10.5, color: 'var(--text-3)' }}>
              Açık adisyonlar · {active} açık, {paid} ödendi, {empty} boş
            </div>
          </div>
          {canViewDetails && <button type="button" onClick={onFloorPlan} style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            padding: 0, border: 'none', background: 'none',
            color: 'var(--text-2)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          }}>
            Plan görünümü <I.chevRight size={11} />
          </button>}
        </div>

        {tables.length === 0 ? (
          <EmptyState title="Masa tanımlanmamış" sub="Masalar sekmesinden masa ekleyebilirsin" />
        ) : (
          <div style={{ padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 8 }}>
              {tables.map((table) => (
                <TableCell
                  key={table.id}
                  table={table}
                  interactive={canViewDetails || canCreateOrders}
                  onEnter={(anchor) => {
                    if (!canViewDetails && !canCreateOrders) return
                    holdHover()
                    setHovered({ table, anchor })
                  }}
                  onLeave={delayedClose}
                  onClick={() => {
                    closeHover()
                    if (canViewDetails) setDetailTable(table)
                    else if (canCreateOrders) onNewOrder(table.id)
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--divider)' }}>
              {(['active', 'new', 'late', 'paid', 'empty'] as const).map((status) => <Legend key={status} status={status} />)}
            </div>
          </div>
        )}
      </section>

      {hovered && (
        <TableHoverCard
          table={hovered.table}
          anchor={hovered.anchor}
          onEnter={holdHover}
          onLeave={delayedClose}
          onDetail={() => {
            closeHover()
            setDetailTable(hovered.table)
          }}
          onNewOrder={() => {
            closeHover()
            onNewOrder(hovered.table.id)
          }}
          canViewDetails={canViewDetails}
          canCreateOrders={canCreateOrders}
        />
      )}

      {detailTable && (
        <TableDetailModal
          restaurantId={restaurantId}
          table={detailTable}
          onClose={() => setDetailTable(null)}
          onNewOrder={() => {
            const tableId = detailTable.id
            setDetailTable(null)
            onNewOrder(tableId)
          }}
          onSettle={(session) => {
            setDetailTable(null)
            setSettleTable({ table: detailTable, session })
          }}
          onRefresh={onRefresh}
          canCreateOrders={canCreateOrders}
        />
      )}

      {settleTable && (
        <SettlementSheet
          restaurantId={restaurantId}
          session={settleTable.session}
          tableLabel={settleTable.table.label}
          onClose={() => setSettleTable(null)}
          onSettled={onRefresh}
          onSessionClosed={() => {
            setSettleTable(null)
            onRefresh()
          }}
        />
      )}
    </>
  )
}
