'use client'

import { type ReactNode } from 'react'
import { I } from '../../lib/ui'
import { formatPanoCurrency } from '../../lib/pano-format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from '@/components/ui/item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import type { ActivityEvent } from '../../lib/queries/pano'
import { PanoCard, PanoEmptyState } from './PanoOverviewWidgets'
import type { PanoOrderApprovalState } from './use-pano-order-approval'

const STATUS_VARIANTS: Record<string, 'warning' | 'info' | 'positive' | 'secondary' | 'destructive'> = {
  pending: 'warning',
  pending_approval: 'warning',
  sent_to_kitchen: 'info',
  preparing: 'info',
  ready: 'positive',
  served: 'secondary',
  paid: 'secondary',
  cancelled: 'destructive',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Yeni sipariş',
  pending_approval: 'Onay bekliyor',
  sent_to_kitchen: 'Mutfağa gönderildi',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  served: 'Servis edildi',
  paid: 'Ödendi',
  cancelled: 'İptal',
}

const STATUS_ICONS: Record<string, ReactNode> = {
  pending: <I.receipt />,
  pending_approval: <I.clock />,
  sent_to_kitchen: <I.cutlery />,
  preparing: <I.clock />,
  ready: <I.check />,
  served: <I.cutlery />,
  paid: <I.card />,
  cancelled: <I.x />,
}

function relativeTime(iso: string, now: Date): string {
  const difference = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000))
  if (difference < 60) return 'az önce'
  if (difference < 3600) return `${Math.floor(difference / 60)} dk önce`
  if (difference < 86400) return `${Math.floor(difference / 3600)} sa önce`
  return 'Dün'
}

export function PanoActivityFeed({
  feed,
  canManageOrders,
  approvalStates,
  onApproveOrder,
  now,
}: {
  feed: ActivityEvent[]
  canManageOrders: boolean
  approvalStates: Record<string, PanoOrderApprovalState | undefined>
  onApproveOrder: (orderId: string) => void
  now: Date
}) {
  return (
    <PanoCard title="Canlı akış" subtitle="Bugünün sipariş aktivitesi · gerçek zamanlı">
      <style>{`
        .pano-feed-action {
          min-height: 44px;
          opacity: 0;
          pointer-events: none;
          transform: translateX(4px);
          transition: opacity 120ms ease, transform 120ms ease;
        }
        .pano-feed-row:hover .pano-feed-action,
        .pano-feed-row:focus-within .pano-feed-action {
          opacity: 1;
          pointer-events: auto;
          transform: none;
        }
        .pano-feed-time { transition: opacity 120ms ease; }
        .pano-feed-row:hover .pano-feed-time,
        .pano-feed-row:focus-within .pano-feed-time { opacity: 0; }
        @media (prefers-reduced-motion: reduce) {
          .pano-feed-action, .pano-feed-time { transition: none; }
        }
        @media (hover: none) {
          .pano-feed-action { opacity: 1; pointer-events: auto; transform: none; }
          .pano-feed-time { opacity: 0; }
        }
      `}</style>
      {feed.length === 0 ? (
        <PanoEmptyState title="Bugün henüz sipariş yok" sub="Yeni siparişler burada anlık görünür" />
      ) : (
        <ScrollArea className="h-[360px]">
          <ItemGroup className="gap-0 pb-2">
            {feed.map((event, index) => (
              <PanoActivityFeedRow
                key={event.id}
                event={event}
                last={index === feed.length - 1}
                canManageOrders={canManageOrders}
                approval={approvalStates[event.id]}
                onApprove={() => onApproveOrder(event.id)}
                now={now}
              />
            ))}
          </ItemGroup>
        </ScrollArea>
      )}
    </PanoCard>
  )
}

function PanoActivityFeedRow({
  event,
  last,
  canManageOrders,
  approval,
  onApprove,
  now,
}: {
  event: ActivityEvent
  last: boolean
  canManageOrders: boolean
  approval?: PanoOrderApprovalState
  onApprove: () => void
  now: Date
}) {
  const tone = STATUS_VARIANTS[event.status] ?? 'warning'
  const canApprove = canManageOrders && event.status === 'pending_approval'
  const isPending = approval?.isPending ?? false
  const error = approval?.error ?? null

  return (
    <>
      <Item className="pano-feed-row min-h-[58px] rounded-none" size="sm" variant={error ? 'muted' : 'default'}>
        <ItemMedia variant="icon">
          <Badge variant={error ? 'destructive' : tone} className="size-7 rounded-full p-0" aria-hidden="true">
            {STATUS_ICONS[event.status] ?? <I.bell />}
          </Badge>
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{error ?? STATUS_LABELS[event.status] ?? event.status}</ItemTitle>
          <ItemDescription className="pano-number">
            {event.tableLabel ?? (event.tableId ? 'Masa' : 'Paket')} · {formatPanoCurrency(event.total)}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          {canApprove ? (
            <div className="relative h-11 w-24 shrink-0">
              <span className="pano-feed-time pano-number absolute inset-0 flex items-center justify-end text-muted-foreground">
                {relativeTime(event.createdAt, now)}
              </span>
              <Button
                variant="positive"
                size="sm"
                className="pano-feed-action absolute top-0 right-0 min-h-11"
                disabled={isPending}
                aria-busy={isPending}
                onClick={onApprove}
                aria-label={`${event.tableLabel ?? 'Sipariş'} siparişini onayla`}
              >
                {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : <I.check data-icon="inline-start" />}
                {isPending ? 'Onaylanıyor…' : 'Onayla'}
              </Button>
            </div>
          ) : (
            <span className="pano-number shrink-0 text-muted-foreground">
              {relativeTime(event.createdAt, now)}
            </span>
          )}
        </ItemActions>
      </Item>
      {!last && <ItemSeparator className="my-0" />}
    </>
  )
}
