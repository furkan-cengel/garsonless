'use client'

import { Fragment } from 'react'
import { selectPanoAttentionTables } from '../../lib/pano-attention-model'
import Link from 'next/link'
import { serviceRequestLabel } from '@garsonless/domain/tables'
import { I } from '../../lib/ui'
import { formatPanoCurrency, formatPanoDuration } from '../../lib/pano-format'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item'
import type { PanoServiceRequest, TableStatusData } from '../../lib/queries/pano'
import { PanoCard, PanoEmptyState } from './PanoOverviewWidgets'

const STATUS = {
  late: { label: 'Geciken', variant: 'destructive' },
  stale: { label: 'Eski oturum', variant: 'warning' },
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
            : `${formatPanoDuration(table.time)} açık · ${formatPanoCurrency(remainingTotal(table))} kalan`}
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
  const attention = selectPanoAttentionTables(tables, serviceRequests)
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
