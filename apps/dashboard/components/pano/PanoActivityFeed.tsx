'use client'

import { type ReactNode } from 'react'
import { EmptyState, I, S } from '../../lib/ui'
import type { ActivityEvent } from '../../lib/queries/pano'
import { PanoCard } from './PanoOverviewWidgets'
import type { PanoOrderApprovalState } from './use-pano-order-approval'

const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  pending: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  pending_approval: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  sent_to_kitchen: { bg: 'var(--info-bg)', fg: 'var(--info)' },
  preparing: { bg: 'var(--info-bg)', fg: 'var(--info)' },
  ready: { bg: 'var(--positive-bg)', fg: 'var(--positive)' },
  served: { bg: 'var(--surface-3)', fg: 'var(--text-2)' },
  paid: { bg: 'var(--surface-3)', fg: 'var(--text-2)' },
  cancelled: { bg: 'var(--critical-bg)', fg: 'var(--critical)' },
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
  pending: <I.receipt size={13} />,
  pending_approval: <I.clock size={13} />,
  sent_to_kitchen: <I.cutlery size={13} />,
  preparing: <I.clock size={13} />,
  ready: <I.check size={13} />,
  served: <I.cutlery size={13} />,
  paid: <I.card size={13} />,
  cancelled: <I.x size={13} />,
}

function relativeTime(iso: string): string {
  const difference = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
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
}: {
  feed: ActivityEvent[]
  canManageOrders: boolean
  approvalStates: Record<string, PanoOrderApprovalState | undefined>
  onApproveOrder: (orderId: string) => void
}) {
  return (
    <PanoCard title="Canlı akış" subtitle="Bugünün sipariş aktivitesi · gerçek zamanlı">
      <style>{`
        .pano-feed-action {
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
        .pano-feed-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid color-mix(in srgb, var(--positive) 25%, transparent);
          border-top-color: var(--positive);
          border-radius: 999px;
          animation: pano-feed-spin .7s linear infinite;
        }
        @keyframes pano-feed-spin { to { transform: rotate(360deg); } }
        @media (hover: none) {
          .pano-feed-action { opacity: 1; pointer-events: auto; transform: none; }
          .pano-feed-time { opacity: 0; }
        }
      `}</style>
      {feed.length === 0
        ? <EmptyState title="Bugün henüz sipariş yok" sub="Yeni siparişler burada anlık görünür" />
        : (
          <div style={{ padding: '0 0 8px', maxHeight: 360, overflow: 'auto' }}>
            {feed.map((event, index) => (
              <PanoActivityFeedRow
                key={event.id}
                event={event}
                last={index === feed.length - 1}
                canManageOrders={canManageOrders}
                approval={approvalStates[event.id]}
                onApprove={() => onApproveOrder(event.id)}
              />
            ))}
          </div>
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
}: {
  event: ActivityEvent
  last: boolean
  canManageOrders: boolean
  approval?: PanoOrderApprovalState
  onApprove: () => void
}) {
  const tone = STATUS_TONES[event.status] ?? STATUS_TONES.pending!
  const canApprove = canManageOrders && event.status === 'pending_approval'
  const isPending = approval?.isPending ?? false
  const error = approval?.error ?? null

  return (
    <div
      className="pano-feed-row"
      style={{
        position: 'relative', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10,
        minHeight: 58, borderBottom: last ? 'none' : '1px solid var(--divider)',
        background: error ? 'var(--critical-bg)' : 'transparent', transition: 'background 120ms ease',
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 999, background: tone.bg, color: tone.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{STATUS_ICONS[event.status] ?? <I.bell size={13} />}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: error ? 'var(--critical)' : 'var(--text)' }}>
          {error ?? STATUS_LABELS[event.status] ?? event.status}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
          {(event.tableLabel ?? (event.tableId ? 'Masa' : 'Paket'))} · ₺{event.total.toLocaleString('tr-TR')}
        </div>
      </div>
      {canApprove ? (
        <div style={{ position: 'relative', width: 90, height: 30, flexShrink: 0 }}>
          <span className="pano-feed-time" style={{
            ...S.mono, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            fontSize: 10.5, color: 'var(--text-3)',
          }}>{relativeTime(event.createdAt)}</span>
          <button
            type="button"
            className="pano-feed-action"
            disabled={isPending}
            onClick={onApprove}
            aria-label={`${event.tableLabel ?? 'Sipariş'} siparişini onayla`}
            style={{
              position: 'absolute', right: 0, top: 0, height: 30, padding: '0 10px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              border: '1px solid var(--positive)', borderRadius: 7, background: 'var(--positive-bg)', color: 'var(--positive)',
              fontSize: 11.5, fontWeight: 700, cursor: isPending ? 'wait' : 'pointer',
            }}
          >
            {isPending ? <span className="pano-feed-spinner" /> : <I.check size={13} />}
            {isPending ? 'Onaylanıyor' : 'Onayla'}
          </button>
        </div>
      ) : (
        <span style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 }}>
          {relativeTime(event.createdAt)}
        </span>
      )}
    </div>
  )
}
