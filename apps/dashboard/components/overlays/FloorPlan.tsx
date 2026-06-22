'use client'

import { S, btnGhost, IconButton } from '../../lib/ui'
import { I } from '../../lib/ui'
import type { TableStatusData } from '../../lib/queries'

interface Props {
  restaurantName: string
  tableStatuses?: TableStatusData[]
  onClose: () => void
}

const TABLE_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  empty:  { bg: 'var(--surface)',     fg: 'var(--text-3)',   border: 'var(--border)' },
  paid:   { bg: 'var(--positive-bg)', fg: 'var(--positive)', border: 'var(--positive)' },
  active: { bg: 'var(--info-bg)',     fg: 'var(--info)',     border: 'var(--info)' },
  new:    { bg: 'var(--warning-bg)',  fg: 'var(--warning)',  border: 'var(--warning)' },
  late:   { bg: 'var(--critical-bg)', fg: 'var(--critical)', border: 'var(--critical)' },
}

export default function FloorPlan({ restaurantName, tableStatuses, onClose }: Props) {
  const tables = tableStatuses ?? []

  const counts = {
    paid:   tables.filter(t => t.status === 'paid').length,
    active: tables.filter(t => t.status === 'active').length,
    new:    tables.filter(t => t.status === 'new').length,
    late:   tables.filter(t => t.status === 'late').length,
    empty:  tables.filter(t => t.status === 'empty').length,
  }

  const activeSub = tables
    .filter(t => t.status !== 'empty' && t.status !== 'paid')
    .reduce((s, t) => s + (t.unpaidTotal ?? t.total ?? 0), 0)

  const summaryParts: string[] = []
  if (counts.active + counts.new + counts.late > 0) summaryParts.push(`${counts.active + counts.new + counts.late} aktif`)
  if (counts.empty > 0) summaryParts.push(`${counts.empty} boş`)
  if (counts.paid > 0) summaryParts.push(`${counts.paid} ödendi`)

  return (
    <>
      <style>{`
        @keyframes pulse-late {
          0%, 100% { box-shadow: 0 0 0 0 rgba(180,35,24,.5); }
          50%       { box-shadow: 0 0 0 8px rgba(180,35,24,0); }
        }
        @keyframes pulse-new {
          0%, 100% { box-shadow: 0 0 0 0 rgba(165,90,0,.5); }
          50%       { box-shadow: 0 0 0 6px rgba(165,90,0,0); }
        }
      `}</style>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(17,17,19,.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 1280, height: '90vh',
            background: 'var(--surface)', borderRadius: 14,
            boxShadow: '0 30px 80px -10px rgba(0,0,0,.4)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--divider)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--text)' }}>
                Mağaza planı · {restaurantName}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                {summaryParts.join(' · ') || 'Henüz masa yok'} · son güncelleme şimdi
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={btnGhost()}>
                <I.image size={13} />Plan düzenle
              </button>
              <button style={btnGhost()}>
                <I.monitor size={13} />Tam ekran
              </button>
            </div>
            <IconButton icon={<I.close size={16} />} ariaLabel="Kapat" onClick={onClose} />
          </div>

          {/* Floor canvas */}
          <div style={{
            flex: 1, overflow: 'auto',
            background: '#f9f7f2',
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.06) 1px, transparent 0)',
            backgroundSize: '20px 20px',
            padding: 28,
          }}>
            {tables.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', gap: 10 }}>
                <I.chair size={32} />
                <div style={{ fontSize: 14, fontWeight: 500 }}>Henüz masa eklenmedi</div>
                <div style={{ fontSize: 12 }}>Masalar sayfasından masa ekleyin</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 12, maxWidth: 1100 }}>
                {tables.map(t => <FloorTableCard key={t.id} table={t} />)}
              </div>
            )}
          </div>

          {/* Legend footer */}
          <div style={{
            padding: '12px 20px', borderTop: '1px solid var(--divider)',
            display: 'flex', alignItems: 'center', gap: 18,
            background: 'var(--surface-2)',
          }}>
            {counts.paid   > 0 && <LegendItem color="var(--positive)" label={`Ödendi · ${counts.paid}`} />}
            {counts.active > 0 && <LegendItem color="var(--info)"     label={`Aktif · ${counts.active}`} />}
            {counts.new    > 0 && <LegendItem color="var(--warning)"  label={`Yeni · ${counts.new}`} />}
            {counts.late   > 0 && <LegendItem color="var(--critical)" label={`Geciken · ${counts.late}`} />}
            {counts.empty  > 0 && <LegendItem color="var(--text-4)"   label={`Boş · ${counts.empty}`} />}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)' }}>
              Toplam açık adisyon:{' '}
              <strong style={{ ...S.mono, color: 'var(--text)' }}>₺{activeSub.toLocaleString('tr-TR')}</strong>
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

function FloorTableCard({ table }: { table: TableStatusData }) {
  const c = TABLE_COLORS[table.status] ?? TABLE_COLORS.empty!
  const pulse = table.status === 'late' || table.status === 'new'

  return (
    <div style={{
      padding: '10px 12px',
      background: c.bg, borderRadius: 10,
      border: '1.5px solid ' + c.border, cursor: 'pointer',
      transition: 'transform 120ms',
      animation: pulse ? `pulse-${table.status} 1.8s infinite` : 'none',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: c.fg }}>{table.label}</span>
        {table.time > 0 && (
          <span style={{ ...S.mono, fontSize: 10, color: c.fg, opacity: 0.9 }}>{table.time}dk</span>
        )}
      </div>
      {table.total > 0 && (
        <div style={{ ...S.mono, fontSize: 11, fontWeight: 600, color: c.fg }}>₺{table.total}</div>
      )}
      <div style={{ fontSize: 9.5, color: c.fg, opacity: 0.75, marginTop: 2 }}>
        {table.status === 'empty'  ? 'boş' :
         table.status === 'paid'   ? 'ödendi · kapatılabilir' :
         table.status === 'new'    ? 'yeni sipariş' :
         table.status === 'late'   ? 'gecikiyor' :
         table.unpaidTotal > 0     ? 'açık adisyon' : 'aktif'}
      </div>
    </div>
  )
}

function LegendItem({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-2)' }}>
      <span style={{
        width: 10, height: 10, borderRadius: 999,
        background: color,
        border: border ? '1px solid var(--border-strong)' : 'none',
      }} />
      {label}
    </span>
  )
}
