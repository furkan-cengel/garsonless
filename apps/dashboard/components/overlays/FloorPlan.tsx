'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import Link from 'next/link'
import { I, IconButton, S, btnGhost, btnPrimary } from '../../lib/ui'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import type { TableStatusData } from '../../lib/queries/pano'
import { TableDetailModal, TableStatusBadge } from '../pano/TableStatusExperience'
import SettlementSheet from '../tables/SettlementSheet'

interface Props {
  restaurantId: string
  restaurantName: string
  tableStatuses?: TableStatusData[]
  onClose: () => void
  onNewOrder: (tableId: string) => void
  onRefresh: () => void
  canCreateOrders?: boolean
}

interface LayoutEntry {
  x: number
  y: number
  zone: 'İç salon' | 'Teras'
  seats: number
}

type FloorLayout = Record<string, LayoutEntry>

const TABLE_COLORS: Record<TableStatusData['status'], { bg: string; fg: string; border: string }> = {
  empty: { bg: 'var(--surface)', fg: 'var(--text-3)', border: 'var(--border)' },
  paid: { bg: 'var(--positive-bg)', fg: 'var(--positive)', border: 'var(--positive)' },
  active: { bg: 'var(--info-bg)', fg: 'var(--info)', border: 'var(--info)' },
  new: { bg: 'var(--warning-bg)', fg: 'var(--warning)', border: 'var(--warning)' },
  late: { bg: 'var(--critical-bg)', fg: 'var(--critical)', border: 'var(--critical)' },
}

const fmt = (value: number) => `₺${value.toLocaleString('tr-TR')}`

function defaultEntry(index: number, count: number): LayoutEntry {
  const salonCount = Math.max(1, Math.ceil(count * 0.68))
  if (index < salonCount) {
    const column = index % 3
    const row = Math.floor(index / 3)
    return { x: 8 + column * 18, y: 14 + row * 24, zone: 'İç salon', seats: 4 }
  }
  const terraceIndex = index - salonCount
  return {
    x: 69 + (terraceIndex % 2) * 16,
    y: 16 + Math.floor(terraceIndex / 2) * 30,
    zone: 'Teras',
    seats: 4,
  }
}

function normalizeLayout(tables: TableStatusData[], layout: FloorLayout): FloorLayout {
  const next: FloorLayout = {}
  tables.forEach((table, index) => {
    next[table.id] = layout[table.id] ?? defaultEntry(index, tables.length)
  })
  return next
}

function loadLayout(restaurantId: string, tables: TableStatusData[]): FloorLayout {
  try {
    const raw = window.localStorage.getItem(`garsonless-floor:${restaurantId}`)
    if (raw) return normalizeLayout(tables, JSON.parse(raw) as FloorLayout)
  } catch {
    // Invalid local layout falls back to the deterministic arrangement.
  }
  return normalizeLayout(tables, {})
}

export default function FloorPlan({
  restaurantId,
  restaurantName,
  tableStatuses,
  onClose,
  onNewOrder,
  onRefresh,
  canCreateOrders = true,
}: Props) {
  const tables = useMemo(() => tableStatuses ?? [], [tableStatuses])
  const shellRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const backupRef = useRef<FloorLayout>({})
  const [layout, setLayout] = useState<FloorLayout>(() => loadLayout(restaurantId, tables))
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailTable, setDetailTable] = useState<TableStatusData | null>(null)
  const [settleTable, setSettleTable] = useState<{ table: TableStatusData; session: OpenSessionInfo } | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    setLayout((current) => normalizeLayout(tables, current))
  }, [tables])

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === shellRef.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  const counts = {
    paid: tables.filter((table) => table.status === 'paid').length,
    active: tables.filter((table) => table.status === 'active').length,
    new: tables.filter((table) => table.status === 'new').length,
    late: tables.filter((table) => table.status === 'late').length,
    empty: tables.filter((table) => table.status === 'empty').length,
  }
  const activeCount = counts.active + counts.new + counts.late
  const activeTotal = tables
    .filter((table) => ['active', 'new', 'late'].includes(table.status))
    .reduce((sum, table) => sum + table.unpaidTotal, 0)
  const selectedTable = tables.find((table) => table.id === selectedId) ?? null

  const startEditing = () => {
    backupRef.current = structuredClone(layout)
    setEditing(true)
  }
  const cancelEditing = () => {
    setLayout(backupRef.current)
    setSelectedId(null)
    setEditing(false)
  }
  const saveLayout = () => {
    window.localStorage.setItem(`garsonless-floor:${restaurantId}`, JSON.stringify(layout))
    setSelectedId(null)
    setEditing(false)
  }
  const patchLayout = (tableId: string, patch: Partial<LayoutEntry>) => {
    setLayout((current) => ({
      ...current,
      [tableId]: { ...(current[tableId] ?? defaultEntry(0, 1)), ...patch },
    }))
  }
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await shellRef.current?.requestFullscreen()
  }

  return (
    <div
      className="pano-floor__overlay"
      onClick={editing ? undefined : onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(17,17,19,.55)', backdropFilter: 'blur(4px)',
      }}
    >
      <style>{`
        @keyframes floor-pulse-late {
          0%, 100% { box-shadow: 0 0 0 0 rgba(180,35,24,.5); }
          50% { box-shadow: 0 0 0 8px rgba(180,35,24,0); }
        }
        @keyframes floor-pulse-new {
          0%, 100% { box-shadow: 0 0 0 0 rgba(165,90,0,.5); }
          50% { box-shadow: 0 0 0 6px rgba(165,90,0,0); }
        }
        .pano-floor__header-actions { display: flex; gap: 6px; }
        @media (max-width: 720px) {
          .pano-floor__overlay { padding: 0 !important; }
          .pano-floor__shell { height: 100dvh !important; border-radius: 0 !important; }
          .pano-floor__header { align-items: flex-start !important; flex-wrap: wrap; }
          .pano-floor__header-actions { width: 100%; order: 3; }
          .pano-floor__header-actions > * { flex: 1; justify-content: center; }
          .pano-floor__editor { position: absolute; right: 0; top: 0; bottom: 0; z-index: 20; box-shadow: var(--shadow-pop); }
          .pano-floor__footer { overflow-x: auto; }
        }
      `}</style>
      <div
        ref={shellRef}
        className="pano-floor__shell"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1280, height: fullscreen ? '100vh' : '90vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          borderRadius: fullscreen ? 0 : 14, background: 'var(--surface)',
          boxShadow: '0 30px 80px -10px rgba(0,0,0,.4)',
        }}
      >
        <header className="pano-floor__header" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', borderBottom: '1px solid var(--divider)',
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700 }}>
              {editing ? 'Planı düzenle' : 'Mağaza planı'} · {restaurantName}
              {editing && (
                <span style={{ padding: '2px 7px', borderRadius: 999, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 10.5 }}>
                  Düzenleme modu
                </span>
              )}
            </div>
            <div style={{ marginTop: 2, color: 'var(--text-3)', fontSize: 11.5 }}>
              {editing
                ? 'Masaları sürükleyerek yerleştir; bölge ve koltuk bilgisini sağ panelden düzenle.'
                : `${tables.length} masa · ${activeCount} açık adisyon · ${counts.empty} boş · canlı durum`}
            </div>
          </div>
          <div className="pano-floor__header-actions">
            {editing ? (
              <>
                <Link href={`/dashboard/${restaurantId}/tables`} style={{ ...btnGhost(), textDecoration: 'none' }}>
                  <I.plus size={13} />Masaları yönet
                </Link>
                <button type="button" onClick={cancelEditing} style={btnGhost()}>İptal</button>
                <button type="button" onClick={saveLayout} style={btnPrimary()}>
                  <I.check size={13} />Kaydet
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={startEditing} style={btnGhost()}>
                  <I.image size={13} />Plan düzenle
                </button>
                <button type="button" onClick={() => void toggleFullscreen()} style={btnGhost()}>
                  <I.monitor size={13} />{fullscreen ? 'Tam ekrandan çık' : 'Tam ekran'}
                </button>
              </>
            )}
          </div>
          {!editing && <IconButton icon={<I.close size={16} />} ariaLabel="Kapat" onClick={onClose} />}
        </header>

        <div style={{ position: 'relative', minHeight: 0, flex: 1, display: 'flex' }}>
          <div style={{ minWidth: 0, flex: 1, overflow: 'auto' }}>
            <div
              ref={canvasRef}
              onClick={() => editing && setSelectedId(null)}
              style={{
                position: 'relative', minWidth: 760, minHeight: 520, width: '100%', height: '100%',
                overflow: 'hidden', background: '#f9f7f2',
                backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.06) 1px, transparent 0)',
                backgroundSize: '20px 20px',
              }}
            >
              <FloorZone label="İç salon" left="4%" top="6%" width="57%" height="82%" tone="warm" />
              <FloorZone label="Teras" left="65%" top="6%" width="31%" height="64%" tone="green" />

              <div style={{ position: 'absolute', left: '30%', bottom: 16, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', fontSize: 10, fontWeight: 600 }}>
                <I.chevRight size={13} />Giriş
              </div>
              <div style={{ position: 'absolute', left: '5%', bottom: 16, color: 'var(--text-3)', fontSize: 10, fontWeight: 600 }}>
                Mutfak
              </div>

              {tables.map((table) => (
                <FloorTable
                  key={table.id}
                  table={table}
                  entry={layout[table.id] ?? defaultEntry(0, 1)}
                  editing={editing}
                  selected={selectedId === table.id}
                  canvasRef={canvasRef}
                  onSelect={() => editing ? setSelectedId(table.id) : setDetailTable(table)}
                  onMove={(x, y) => patchLayout(table.id, { x, y })}
                />
              ))}
            </div>
          </div>

          {editing && (
            <aside className="pano-floor__editor" style={{
              width: 244, flexShrink: 0, overflowY: 'auto',
              padding: 16, borderLeft: '1px solid var(--divider)', background: 'var(--surface)',
            }}>
              {selectedTable ? (
                <LayoutEditor
                  table={selectedTable}
                  entry={layout[selectedTable.id] ?? defaultEntry(0, 1)}
                  onPatch={(patch) => patchLayout(selectedTable.id, patch)}
                />
              ) : (
                <div style={{ padding: '36px 8px', textAlign: 'center', color: 'var(--text-3)' }}>
                  <span style={{ width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'var(--surface-3)' }}>
                    <I.chair size={20} />
                  </span>
                  <div style={{ marginTop: 12, color: 'var(--text-2)', fontSize: 12.5, fontWeight: 700 }}>Bir masa seç</div>
                  <div style={{ marginTop: 4, fontSize: 11.5, lineHeight: 1.5 }}>Yerleşim bilgisini düzenlemek için tuvalde bir masaya tıkla.</div>
                </div>
              )}
            </aside>
          )}
        </div>

        <footer className="pano-floor__footer" style={{
          minHeight: 46, display: 'flex', alignItems: 'center', gap: 18,
          padding: '10px 20px', borderTop: '1px solid var(--divider)', background: 'var(--surface-2)',
          whiteSpace: 'nowrap',
        }}>
          {editing ? (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                {tables.length} masa · {Object.values(layout).reduce((sum, entry) => sum + entry.seats, 0)} koltuk
              </span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-3)', fontSize: 11 }}>
                <I.drag size={13} />Sürükle-bırak ile yerleştir
              </span>
            </>
          ) : (
            <>
              <Legend color="var(--info)" label={`Aktif · ${counts.active}`} />
              <Legend color="var(--warning)" label={`Yeni · ${counts.new}`} />
              <Legend color="var(--critical)" label={`Geciken · ${counts.late}`} />
              <Legend color="var(--positive)" label={`Ödendi · ${counts.paid}`} />
              <Legend color="var(--text-4)" label={`Boş · ${counts.empty}`} />
              <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 11 }}>
                Toplam açık adisyon: <strong style={{ ...S.mono, color: 'var(--text)' }}>{fmt(activeTotal)}</strong>
              </span>
            </>
          )}
        </footer>
      </div>

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
          zIndex={260}
          onClose={() => setSettleTable(null)}
          onSettled={onRefresh}
          onSessionClosed={() => {
            setSettleTable(null)
            onRefresh()
          }}
        />
      )}
    </div>
  )
}

function FloorZone({
  label,
  left,
  top,
  width,
  height,
  tone,
}: {
  label: string
  left: string
  top: string
  width: string
  height: string
  tone: 'warm' | 'green'
}) {
  const warm = tone === 'warm'
  return (
    <div style={{
      position: 'absolute', left, top, width, height,
      borderRadius: 14,
      background: warm ? 'rgba(255,208,137,.16)' : 'rgba(47,111,78,.10)',
      border: `1px dashed ${warm ? 'rgba(217,119,87,.4)' : 'rgba(47,111,78,.4)'}`,
    }}>
      <span style={{
        position: 'absolute', top: 10, left: 14,
        color: 'var(--accent)', fontSize: 10, fontWeight: 700,
        letterSpacing: '.08em', textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}

function FloorTable({
  table,
  entry,
  editing,
  selected,
  canvasRef,
  onSelect,
  onMove,
}: {
  table: TableStatusData
  entry: LayoutEntry
  editing: boolean
  selected: boolean
  canvasRef: RefObject<HTMLDivElement | null>
  onSelect: () => void
  onMove: (x: number, y: number) => void
}) {
  const tone = TABLE_COLORS[table.status]
  const dragged = useRef(false)
  const [hovered, setHovered] = useState(false)

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!editing || !canvasRef.current) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragged.current = false
    const rect = canvasRef.current.getBoundingClientRect()
    const startX = event.clientX
    const startY = event.clientY
    const originalX = entry.x
    const originalY = entry.y

    const move = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / rect.width) * 100
      const dy = ((moveEvent.clientY - startY) / rect.height) * 100
      if (Math.abs(moveEvent.clientX - startX) > 3 || Math.abs(moveEvent.clientY - startY) > 3) dragged.current = true
      onMove(
        Math.max(0, Math.min(88, Math.round(originalX + dx))),
        Math.max(0, Math.min(88, Math.round(originalY + dy))),
      )
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <button
      type="button"
      onPointerDown={pointerDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(event) => {
        event.stopPropagation()
        if (dragged.current) {
          dragged.current = false
          return
        }
        onSelect()
      }}
      style={{
        position: 'absolute', left: `${entry.x}%`, top: `${entry.y}%`,
        width: 104, minHeight: 58, padding: '9px 10px',
        borderRadius: 10, textAlign: 'left',
        background: tone.bg, color: tone.fg,
        border: `1.5px solid ${selected ? 'var(--text)' : tone.border}`,
        outline: selected ? '2px solid var(--text)' : 'none', outlineOffset: 1,
        boxShadow: selected || hovered ? 'var(--shadow-pop)' : '0 1px 3px rgba(0,0,0,.06)',
        transform: !editing && hovered ? 'translateY(-2px)' : 'none',
        transition: editing ? 'none' : 'transform 120ms ease, box-shadow 120ms ease',
        animation: !editing && !hovered && (table.status === 'late' || table.status === 'new')
          ? `floor-pulse-${table.status} 1.8s infinite`
          : 'none',
        cursor: editing ? 'grab' : 'pointer',
        zIndex: selected ? 6 : hovered ? 5 : 1,
        touchAction: 'none', userSelect: 'none',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700 }}>
          {table.label}
        </span>
        {editing
          ? <I.drag size={13} />
          : table.status !== 'empty' && table.status !== 'paid'
            ? <span style={{ ...S.mono, fontSize: 9.5 }}>{table.time}dk</span>
            : null}
      </span>
      <span style={{ display: 'block', marginTop: 3, fontSize: 10, opacity: 0.8 }}>
        {editing
          ? `${entry.zone} · ${entry.seats} kişilik`
          : table.status === 'empty'
            ? `boş · ${entry.seats} kişilik`
            : table.status === 'paid'
              ? <><strong style={{ ...S.mono, fontSize: 12 }}>{fmt(table.total)}</strong> ödendi</>
              : <strong style={{ ...S.mono, fontSize: 12 }}>{fmt(table.unpaidTotal)}</strong>}
      </span>
    </button>
  )
}

function LayoutEditor({
  table,
  entry,
  onPatch,
}: {
  table: TableStatusData
  entry: LayoutEntry
  onPatch: (patch: Partial<LayoutEntry>) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Masa yerleşimi</div>
        <TableStatusBadge status={table.status} />
      </div>
      <FieldLabel>MASA</FieldLabel>
      <div style={{ padding: '8px 10px', borderRadius: 7, background: 'var(--surface-2)', border: '1px solid var(--divider)', fontSize: 12.5, fontWeight: 600 }}>
        {table.label}
      </div>
      <FieldLabel>BÖLGE</FieldLabel>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['İç salon', 'Teras'] as const).map((zone) => (
          <button key={zone} type="button" onClick={() => onPatch({ zone })} style={{
            flex: 1, height: 32, borderRadius: 7, cursor: 'pointer',
            border: `1px solid ${entry.zone === zone ? 'var(--text)' : 'var(--border-strong)'}`,
            background: entry.zone === zone ? 'var(--surface-inset)' : 'var(--surface)',
            color: 'var(--text)', fontSize: 12, fontWeight: 600,
          }}>
            {zone}
          </button>
        ))}
      </div>
      <FieldLabel>KOLTUK SAYISI</FieldLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={() => onPatch({ seats: Math.max(1, entry.seats - 1) })} style={stepButton()}>−</button>
        <span style={{ ...S.mono, flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 700 }}>{entry.seats}</span>
        <button type="button" onClick={() => onPatch({ seats: Math.min(20, entry.seats + 1) })} style={stepButton()}>+</button>
      </div>
      <p style={{ margin: '16px 0 0', color: 'var(--text-3)', fontSize: 11, lineHeight: 1.5 }}>
        Durum, tutar ve sipariş bilgileri canlı veriden gelir; plan düzenleyicisinden değiştirilemez.
      </p>
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div style={{ ...S.label, marginTop: 15, marginBottom: 6, fontSize: 9.5 }}>{children}</div>
}

function stepButton(): CSSProperties {
  return {
    width: 34, height: 32, borderRadius: 7,
    border: '1px solid var(--border-strong)', background: 'var(--surface)',
    color: 'var(--text)', cursor: 'pointer', fontSize: 17, fontWeight: 700,
  }
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-2)', fontSize: 11 }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: color }} />
      {label}
    </span>
  )
}
