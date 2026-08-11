'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import { I } from '../../lib/ui'
import { formatPanoCurrency, formatPanoInteger } from '../../lib/pano-format'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item'
import type { PanoServiceRequest, TableStatusData } from '../../lib/queries/pano'
import { PanoCard, PanoEmptyState } from './PanoOverviewWidgets'

const STATUS = {
  late: { label: 'Geciken', variant: 'destructive' },
  active: { label: 'Aktif', variant: 'info' },
  new: { label: 'Yeni', variant: 'warning' },
  paid: { label: 'Tahsil edildi', variant: 'positive' },
  empty: { label: 'Boş', variant: 'secondary' },
} satisfies Record<
  TableStatusData['status'],
  {
    label: string
    variant: 'destructive' | 'info' | 'warning' | 'positive' | 'secondary'
  }
>

function remainingTotal(table: TableStatusData): number {
  return Math.max(0, table.unpaidTotal - table.splitSettledTotal)
}

function attentionTables(tables: TableStatusData[], requests: PanoServiceRequest[]): Array<{ table: TableStatusData; requests: PanoServiceRequest[] }> {
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
      <ItemMedia variant="icon">
        <Badge variant={tone.variant} className="size-9 p-0" aria-hidden="true">
          <I.chair />
        </Badge>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className="truncate">{table.label}</span>
          <Badge variant={tone.variant}>{tone.label}</Badge>
        </ItemTitle>
        <ItemDescription className="pano-number line-clamp-1">
          {requests.length > 0
            ? requests.map((request) => serviceRequestLabel(request.requestType)).join(' · ')
            : `${formatPanoInteger(table.time)} dk açık · ${formatPanoCurrency(remainingTotal(table))} kalan`}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <span className="pano-number font-semibold">
          {remainingTotal(table) > 0 ? formatPanoCurrency(remainingTotal(table)) : '—'}
        </span>
        {canViewTables && <I.chevRight aria-hidden="true" />}
      </ItemActions>
    </>
  )

  return canViewTables ? (
    <Item
      render={<Link href={`/dashboard/${restaurantId}/tables?tableId=${encodeURIComponent(table.id)}`} />}
      aria-label={`${table.label} detayını Canlı Masalar'da aç`}
      size="sm"
      className="min-h-[58px] rounded-none"
    >
      {content}
    </Item>
  ) : (
    <Item size="sm" className="min-h-[58px] rounded-none">
      {content}
    </Item>
  )
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
      action={
        canViewTables ? (
          <Link className={buttonVariants({ variant: 'ghost', size: 'sm' })} href={`/dashboard/${restaurantId}/tables`}>
            Canlı Masalar <I.chevRight data-icon="inline-end" />
          </Link>
        ) : undefined
      }
    >
      {visible.length === 0 ? (
        <div role="status">
          <PanoEmptyState title="Dikkat gereken masa yok" sub="Geciken masalar ve servis çağrıları burada görünür" />
        </div>
      ) : (
        <ItemGroup className="gap-0">
          {visible.map(({ table, requests }, index) => (
            <Fragment key={table.id}>
              <TableAttentionRow restaurantId={restaurantId} table={table} requests={requests} canViewTables={canViewTables} />
              {index < visible.length - 1 && <ItemSeparator className="my-0" />}
            </Fragment>
          ))}
          {attention.length > visible.length && (
            <Item size="xs" variant="muted" className="rounded-none">
              <ItemDescription>{attention.length - visible.length} masa daha Canlı Masalar&apos;da bekliyor.</ItemDescription>
            </Item>
          )}
        </ItemGroup>
      )}
    </PanoCard>
  )
}
