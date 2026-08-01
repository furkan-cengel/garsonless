'use client'

import Link from 'next/link'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import { EmptyState, I, S } from '../../lib/ui'
import type { PanoServiceRequest, TableStatusData } from '../../lib/queries/pano'
import { PanoCard } from './PanoOverviewWidgets'

const STATUS = {
  late: { label: 'Geciken', color: 'var(--critical)', background: 'var(--critical-bg)' },
  active: { label: 'Aktif', color: 'var(--info)', background: 'var(--info-bg)' },
  new: { label: 'Yeni', color: 'var(--warning)', background: 'var(--warning-bg)' },
  paid: { label: 'Tahsil edildi', color: 'var(--positive)', background: 'var(--positive-bg)' },
  empty: { label: 'Boş', color: 'var(--text-3)', background: 'var(--surface-3)' },
} satisfies Record<TableStatusData['status'], { label: string; color: string; background: string }>

function remainingTotal(table: TableStatusData): number {
  return Math.max(0, table.unpaidTotal - table.splitSettledTotal)
}

function attentionTables(
  tables: TableStatusData[],
  requests: PanoServiceRequest[],
): Array<{ table: TableStatusData; requests: PanoServiceRequest[] }> {
  const requestsByTable = new Map<string, PanoServiceRequest[]>()
  for (const request of requests) {
    const current = requestsByTable.get(request.tableId) ?? []
    current.push(request)
    requestsByTable.set(request.tableId, current)
  }

  return tables
    .filter((table) => table.status === 'late' || requestsByTable.has(table.id))
    .map((table) => ({ table, requests: requestsByTable.get(table.id) ?? [] }))
    .sort((left, right) => {
      const late = Number(right.table.status === 'late') - Number(left.table.status === 'late')
      const requestCount = right.requests.length - left.requests.length
      return late || requestCount || right.table.time - left.table.time || left.table.label.localeCompare(right.table.label, 'tr')
    })
}

function TableAttentionRow({
  restaurantId,
  table,
  requests,
  canViewTables,
}: {
  restaurantId: string
  table: TableStatusData
  requests: PanoServiceRequest[]
  canViewTables: boolean
}) {
  const tone = STATUS[table.status]
  const content = (
    <>
      <span aria-hidden="true" style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        display: 'grid', placeItems: 'center', color: tone.color, background: tone.background,
      }}><I.chair size={17} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <strong style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.label}</strong>
          <span style={{ color: tone.color, fontSize: 10.5, fontWeight: 700 }}>{tone.label}</span>
        </span>
        <span style={{ display: 'block', marginTop: 3, color: 'var(--text-3)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {requests.length > 0
            ? requests.map((request) => serviceRequestLabel(request.requestType)).join(' · ')
            : `${table.time} dk açık · ${remainingTotal(table).toLocaleString('tr-TR')} TL kalan`}
        </span>
      </span>
      <span style={{ ...S.mono, flexShrink: 0, fontSize: 12, fontWeight: 700, color: remainingTotal(table) > 0 ? 'var(--text)' : tone.color }}>
        {remainingTotal(table) > 0 ? `₺${remainingTotal(table).toLocaleString('tr-TR')}` : '—'}
      </span>
      {canViewTables && <span aria-hidden="true" style={{ color: 'var(--text-3)', display: 'inline-flex' }}><I.chevRight size={14} /></span>}
    </>
  )

  const style = {
    minHeight: 58, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10,
    color: 'inherit', textDecoration: 'none', borderBottom: '1px solid var(--divider)',
  } as const

  return canViewTables ? (
    <Link
      className="pano-table-attention-row"
      href={`/dashboard/${restaurantId}/tables?tableId=${encodeURIComponent(table.id)}`}
      aria-label={`${table.label} detayını Canlı Masalar'da aç`}
      style={style}
    >{content}</Link>
  ) : <div style={style}>{content}</div>
}

export default function PanoAttentionTables({
  restaurantId,
  tables,
  serviceRequests,
  canViewTables,
}: {
  restaurantId: string
  tables: TableStatusData[]
  serviceRequests: PanoServiceRequest[]
  canViewTables: boolean
}) {
  const attention = attentionTables(tables, serviceRequests)
  const visible = attention.slice(0, 5)
  return (
    <PanoCard
      title="Dikkat gereken masalar"
      subtitle={attention.length > 0 ? `${attention.length} masa müdahale bekliyor` : 'Masa operasyonları normal'}
      action={canViewTables ? (
        <Link className="pano-table-plan-link" href={`/dashboard/${restaurantId}/tables`}>
          Canlı Masalar <I.chevRight size={13} />
        </Link>
      ) : undefined}
    >
      {visible.length === 0 ? (
        <div role="status">
          <EmptyState title="Dikkat gereken masa yok" sub="Geciken masalar ve servis çağrıları burada görünür" />
        </div>
      ) : (
        <div>
          {visible.map(({ table, requests }) => (
            <TableAttentionRow
              key={table.id}
              restaurantId={restaurantId}
              table={table}
              requests={requests}
              canViewTables={canViewTables}
            />
          ))}
          {attention.length > visible.length && (
            <div style={{ padding: '8px 14px', color: 'var(--text-3)', fontSize: 11 }}>
              {attention.length - visible.length} masa daha Canlı Masalar&apos;da bekliyor.
            </div>
          )}
        </div>
      )}
    </PanoCard>
  )
}
