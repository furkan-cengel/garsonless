import type { CSSProperties, ReactNode } from 'react'
import { Skeleton } from '../../lib/ui'
import { ThemeEditorLoadingFrame } from '../theme/ThemeEditorLoadingFrame'
import { MenuWorkspaceSkeleton } from '../menu/MenuWorkspaceSkeleton'

type SkeletonKind = 'pano' | 'orders' | 'menu' | 'theme' | 'customers'
type FrameKind = SkeletonKind | 'analytics'

interface Props {
  kind?: SkeletonKind
}

const shell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  background: 'var(--bg)',
}

const ROUTE_SKELETON_CSS = `
.dashboard-route-skeleton-analytics-filter-control { height: 28px; }
@media (pointer: coarse), (max-width: 760px) {
  .dashboard-route-skeleton-analytics-filter-control { height: 44px; }
}

.dashboard-route-skeleton-pano-metrics > div > div {
  min-height: 126px;
}
.dashboard-route-skeleton-pano > * {
  flex-shrink: 0;
}
@media (max-width: 760px) {
  .dashboard-route-skeleton-topbar {
    height: 52px !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    gap: 8px !important;
    padding: 6px 8px !important;
  }
  .dashboard-route-skeleton-topbar-start > :not(:first-child),
  .dashboard-route-skeleton-topbar-center {
    display: none !important;
  }
  .dashboard-route-skeleton-topbar-end {
    gap: 5px !important;
  }
  .dashboard-route-skeleton-topbar-end > * {
    width: 42px !important;
    height: 32px !important;
  }
}
@media (max-width: 900px) {
  .dashboard-route-skeleton-topbar--pano {
    height: 104px !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    grid-template-rows: 52px 52px;
    gap: 0 8px !important;
    padding: 0 10px !important;
  }
  .dashboard-route-skeleton-topbar--pano .dashboard-route-skeleton-topbar-start {
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .dashboard-route-skeleton-topbar--pano .dashboard-route-skeleton-topbar-start > :nth-child(-n + 3) {
    display: none !important;
  }
  .dashboard-route-skeleton-topbar--pano .dashboard-route-skeleton-topbar-start > :nth-child(4),
  .dashboard-route-skeleton-topbar--pano .dashboard-route-skeleton-topbar-start > :nth-child(5) {
    display: block !important;
  }
  .dashboard-route-skeleton-topbar--pano .dashboard-route-skeleton-topbar-center {
    display: flex !important;
    grid-column: 1;
    grid-row: 2;
    min-width: 0;
  }
  .dashboard-route-skeleton-topbar--pano .dashboard-route-skeleton-topbar-end {
    grid-column: 2;
    grid-row: 2;
  }
  .dashboard-route-skeleton-topbar--pano .dashboard-route-skeleton-topbar-end > :first-child {
    width: 104px !important;
    height: 32px !important;
  }
  .dashboard-route-skeleton-topbar--pano .dashboard-route-skeleton-topbar-end > :last-child {
    width: 32px !important;
    height: 32px !important;
  }
}
@media (max-width: 1024px) and (min-width: 761px) {
  .dashboard-route-skeleton-menu {
    --nav: 220px;
  }
}
@media (max-width: 1279px) {
  .dashboard-route-skeleton-analytics-sidebar {
    display: none !important;
  }
}
@media (max-width: 1180px) {
  .dashboard-route-skeleton-topbar--orders {
    height: 104px !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    grid-template-rows: 52px 52px;
    gap: 0 8px !important;
    padding: 0 10px !important;
  }
  .dashboard-route-skeleton-topbar--orders .dashboard-route-skeleton-topbar-start {
    display: flex !important;
    grid-column: 1;
    grid-row: 1;
  }
  .dashboard-route-skeleton-topbar--orders .dashboard-route-skeleton-topbar-center {
    display: flex !important;
    grid-column: 1 / -1;
    grid-row: 2;
    width: max-content;
    min-width: 100%;
  }
  .dashboard-route-skeleton-topbar--orders .dashboard-route-skeleton-topbar-end {
    grid-column: 2;
    grid-row: 1;
  }
  .dashboard-route-skeleton-orders-nav,
  .dashboard-route-skeleton-orders-detail {
    display: none !important;
  }
  .dashboard-route-skeleton-orders-main {
    padding: 0 12px 24px !important;
    overflow-x: hidden !important;
  }
  .dashboard-route-skeleton-orders-toolbar {
    display: flex !important;
  }
  .dashboard-route-skeleton-orders-kanban {
    height: calc(100% - 68px) !important;
    min-width: 0 !important;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding-top: 12px;
  }
  .dashboard-route-skeleton-orders-column {
    flex: 0 0 min(340px, calc(100vw - 112px)) !important;
    min-width: min(340px, calc(100vw - 112px)) !important;
    scroll-snap-align: start;
  }
}
@media (max-width: 760px) {
  .dashboard-route-skeleton-pano {
    padding: 18px 14px 16px !important;
  }
  .dashboard-route-skeleton-pano-metrics > div,
  .dashboard-route-skeleton-pano-panels {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  .dashboard-route-skeleton-topbar--menu {
    height: 104px !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    grid-template-rows: 52px 52px;
    gap: 0 6px !important;
    padding: 0 8px !important;
  }
  .dashboard-route-skeleton-topbar--menu .dashboard-route-skeleton-topbar-start {
    display: flex !important;
    grid-column: 1;
    grid-row: 1;
  }
  .dashboard-route-skeleton-topbar--menu .dashboard-route-skeleton-topbar-start > :not(:first-child) {
    display: none !important;
  }
  .dashboard-route-skeleton-topbar--menu > :nth-child(2) {
    display: block !important;
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100% !important;
    min-width: 0 !important;
  }
  .dashboard-route-skeleton-topbar--menu .dashboard-route-skeleton-topbar-end {
    grid-column: 2;
    grid-row: 1;
  }
  .dashboard-route-skeleton-topbar--menu .dashboard-route-skeleton-topbar-end > :not(:last-child) {
    display: none !important;
  }
  .dashboard-route-skeleton-menu {
    overflow: hidden;
  }
  .dashboard-route-skeleton-topbar--orders {
    height: 104px !important;
  }
  .dashboard-route-skeleton-topbar--orders .dashboard-route-skeleton-topbar-start > :nth-child(-n + 3) {
    display: none !important;
  }
  .dashboard-route-skeleton-topbar--orders .dashboard-route-skeleton-topbar-start > :nth-child(4) {
    display: none !important;
  }
  .dashboard-route-skeleton-topbar--orders .dashboard-route-skeleton-topbar-start > :nth-child(5) {
    display: block !important;
  }
  .dashboard-route-skeleton-orders-main {
    padding: 0 10px 20px !important;
  }
  .dashboard-route-skeleton-orders-tabs {
    display: grid !important;
  }
  .dashboard-route-skeleton-orders-kanban {
    height: calc(100% - 124px) !important;
    overflow-x: hidden;
  }
  .dashboard-route-skeleton-orders-column {
    flex-basis: 100% !important;
    min-width: 100% !important;
  }
  .dashboard-route-skeleton-orders-column:not(:first-child) {
    display: none !important;
  }
  .dashboard-route-skeleton-topbar--analytics {
    height: 104px !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    grid-template-rows: 44px 44px;
    align-content: center;
    gap: 4px !important;
    padding: 4px 6px !important;
  }
  .dashboard-route-skeleton-topbar--analytics .dashboard-route-skeleton-topbar-start {
    display: flex !important;
    grid-column: 1 / -1;
    grid-row: 1;
  }
  .dashboard-route-skeleton-topbar--analytics .dashboard-route-skeleton-topbar-start > :nth-child(4) {
    display: block !important;
    width: 74px !important;
  }
  .dashboard-route-skeleton-topbar--analytics .dashboard-route-skeleton-topbar-center { display: none !important; }
  .dashboard-route-skeleton-topbar--analytics .dashboard-route-skeleton-topbar-end {
    grid-column: 1 / -1;
    grid-row: 2;
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) 44px 44px;
    gap: 4px !important;
  }
  .dashboard-route-skeleton-topbar--analytics .dashboard-route-skeleton-topbar-end > * {
    width: 44px !important;
    height: 44px !important;
  }
  .dashboard-route-skeleton-topbar--analytics .dashboard-route-skeleton-topbar-end > :first-child { width: 100% !important; }
  .dashboard-route-skeleton-analytics-filter { padding: 10px 12px !important; }
  .dashboard-route-skeleton-analytics-filter-fields { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}
@media (max-width: 600px) {
  .dashboard-route-skeleton-analytics-filter { display: none !important; }
  .dashboard-route-skeleton-analytics-filter-toggle { display: block !important; }
}
@media (max-width: 820px) {
  .dashboard-route-skeleton-customers { overflow-y: auto !important; }
  .dashboard-route-skeleton-customers-content { padding: 22px 20px 48px !important; }
  .dashboard-route-skeleton-customers-header { align-items: stretch !important; flex-direction: column !important; }
  .dashboard-route-skeleton-customers-actions > * { flex: 1 1 0 !important; }
  .dashboard-route-skeleton-customers-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  .dashboard-route-skeleton-customers-toolbar { flex-direction: column !important; }
  .dashboard-route-skeleton-customers-toolbar > * { width: 100% !important; }
  .dashboard-route-skeleton-customers-table { display: none !important; }
  .dashboard-route-skeleton-customers-mobile { display: grid !important; }
}
@media (max-width: 520px) {
  .dashboard-route-skeleton-customers-content { padding: 20px 12px 44px !important; }
  .dashboard-route-skeleton-customers-kpis { gap: 8px !important; }
}
`

function Block({ height, width = '100%', style }: { height: number | string; width?: number | string; style?: CSSProperties }) {
  return <Skeleton width={width} height={height} style={{ borderRadius: 6, ...style }} />
}

function TopBarSkeleton({ kind }: { kind: FrameKind }) {
  const isMenu = kind === 'menu'
  const isCustomers = kind === 'customers'
  const isPano = kind === 'pano'
  const isAnalytics = kind === 'analytics'
  return (
    <div className={`dashboard-route-skeleton-topbar dashboard-route-skeleton-topbar--${kind}`} style={{
      height: 'var(--topbar)',
      flexShrink: 0,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
      alignItems: 'center',
      gap: 12,
      padding: '0 12px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
    }}>
      <div className="dashboard-route-skeleton-topbar-start" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Block width={26} height={26} style={{ borderRadius: 7, flexShrink: 0 }} />
        <Block width={84} height={13} />
        <Block width={1} height={28} style={{ borderRadius: 0, flexShrink: 0 }} />
        <Block width={112} height={24} />
        <Block width={46} height={12} />
      </div>
      {isMenu ? (
        <Block width="min(420px, 34vw)" height={32} style={{ minWidth: 300 }} />
      ) : isCustomers || isAnalytics ? (
        <div className="dashboard-route-skeleton-topbar-center" />
      ) : isPano ? (
        <div className="dashboard-route-skeleton-topbar-center" style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <Block width="min(280px, 46vw)" height={24} />
        </div>
      ) : (
        <div className="dashboard-route-skeleton-topbar-center" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <KpiShadow />
          <KpiShadow />
          <KpiShadow />
        </div>
      )}
      <div className="dashboard-route-skeleton-topbar-end" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6 }}>
        {isMenu ? (
          <>
            <Block width={84} height={30} />
            <Block width={78} height={30} />
            <Block width={92} height={30} />
          </>
        ) : isCustomers ? null : (
          <Block width={118} height={30} />
        )}
        {isAnalytics && <Block width={30} height={30} style={{ borderRadius: 7 }} />}
        <Block width={30} height={30} style={{ borderRadius: 7 }} />
      </div>
    </div>
  )
}

function KpiShadow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Block width={7} height={7} style={{ borderRadius: 999 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Block width={44} height={9} />
        <Block width={58} height={14} />
      </div>
    </div>
  )
}

function MetricRow({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 14 }}>
          <Block width={i % 2 ? 92 : 118} height={11} />
          <Block width={i % 2 ? 70 : 86} height={26} style={{ marginTop: 14 }} />
          <Block width="62%" height={10} style={{ marginTop: 12 }} />
        </div>
      ))}
    </div>
  )
}

function PanoSkeleton() {
  return (
    <div
      className="dashboard-route-skeleton-pano"
      style={{
        width: '100%',
        maxWidth: 1280,
        height: '100%',
        margin: '0 auto',
        padding: '28px 32px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
        overflowX: 'hidden',
        overflowY: 'auto',
        overscrollBehaviorY: 'contain',
      }}
    >
      <div className="dashboard-route-skeleton-pano-greeting" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        <Block width={168} height={30} />
        <Block width="min(260px, 72%)" height={13} />
      </div>
      <div className="dashboard-route-skeleton-pano-attention" style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
          <Block width={148} height={15} />
          <Block width={116} height={11} />
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} style={{ minHeight: 72, padding: '13px 16px', display: 'grid', gridTemplateColumns: '36px minmax(0, 1fr) 58px', alignItems: 'center', gap: 12, borderBottom: index === 0 ? '1px solid var(--divider)' : undefined }}>
            <Block width={32} height={32} style={{ borderRadius: 999 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
              <Block width={index === 0 ? '58%' : '42%'} height={13} />
              <Block width={index === 0 ? '76%' : '54%'} height={11} />
            </div>
            <Block width={58} height={12} />
          </div>
        ))}
      </div>
      <div className="dashboard-route-skeleton-pano-metrics" style={{ flexShrink: 0 }}>
        <MetricRow />
      </div>
      <div className="dashboard-route-skeleton-pano-panels" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 12, minHeight: 280, flexShrink: 0 }}>
        <Panel rows={5} />
        <Panel rows={4} />
      </div>
    </div>
  )
}

function OrdersSkeleton() {
  return (
    <div className="dashboard-route-skeleton-orders" style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div className="dashboard-route-skeleton-orders-nav" style={{ display: 'contents' }}><NavRailSkeleton rows={4} search footer /></div>
      <div className="dashboard-route-skeleton-orders-main" style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '16px 16px 32px', background: 'var(--bg)' }}>
        <div className="dashboard-route-skeleton-orders-toolbar" style={{ display: 'none', minHeight: 56, alignItems: 'center', gap: 8, marginInline: -12, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <Block width={140} height={40} />
          <Block width={44} height={40} />
          <Block width={44} height={40} />
          <Block width={44} height={40} />
        </div>
        <div className="dashboard-route-skeleton-orders-tabs" style={{ display: 'none', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4, margin: '8px -2px 0', paddingBottom: 8, borderBottom: '1px solid var(--divider)' }}>
          {Array.from({ length: 4 }).map((_, i) => <Block key={i} height={44} style={{ borderRadius: 8 }} />)}
        </div>
        <div className="dashboard-route-skeleton-orders-kanban" style={{ display: 'flex', gap: 12, minWidth: 'max-content', height: '100%' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <KanbanColumnShadow key={i} count={i === 0 ? 4 : i === 1 ? 3 : 2} />
          ))}
        </div>
      </div>
      <div className="dashboard-route-skeleton-orders-detail" style={{ display: 'contents' }}><DetailPanelShadow /></div>
    </div>
  )
}

function KanbanColumnShadow({ count }: { count: number }) {
  return (
    <div className="dashboard-route-skeleton-orders-column" style={{
      flex: 1,
      minWidth: 220,
      background: 'var(--surface-2)',
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid var(--divider)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '1px solid var(--divider)',
      }}>
        <Block width={28} height={20} style={{ borderRadius: 999 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Block width={76} height={13} />
          <Block width={94} height={10} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: count }).map((_, i) => (
          <OrderCardShadow key={i} dense={i > 1} />
        ))}
      </div>
    </div>
  )
}

function OrderCardShadow({ dense = false }: { dense?: boolean }) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      boxShadow: 'var(--shadow-1)',
      padding: '10px 12px 10px 15px',
      minHeight: dense ? 82 : 116,
    }}>
      <Block width={3} height="100%" style={{ position: 'absolute', left: 0, top: 0, borderRadius: 0 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Block width="46%" height={14} />
          <Block width="32%" height={10} />
        </div>
        <Block width={48} height={16} />
      </div>
      {!dense && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--divider)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Block width="72%" height={11} />
          <Block width="58%" height={11} />
        </div>
      )}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between' }}>
        <Block width={72} height={18} style={{ borderRadius: 999 }} />
        <Block width={64} height={22} />
      </div>
    </div>
  )
}

function MenuSkeleton() {
  return (
    <div className="dashboard-route-skeleton-menu" style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <MenuWorkspaceSkeleton />
    </div>
  )
}

function NavRailSkeleton({
  rows,
  compact = false,
  search = false,
  footer = false,
  grouped = false,
}: {
  rows: number
  compact?: boolean
  search?: boolean
  footer?: boolean
  grouped?: boolean
}) {
  return (
    <div style={{
      width: compact ? 272 : 'var(--nav)',
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--divider)' }}>
        <Block width={compact ? 112 : 92} height={14} />
        <Block width={compact ? 168 : 138} height={11} style={{ marginTop: 7 }} />
      </div>
      {search && (
        <div style={{ padding: '8px 12px 4px' }}>
          <Block height={30} style={{ borderRadius: 7 }} />
        </div>
      )}
      <div style={{ flex: 1, overflow: 'hidden', padding: '6px 8px 12px' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ marginTop: grouped && i % 4 === 0 ? 12 : 0 }}>
            {grouped && i % 4 === 0 && <Block width={74} height={9} style={{ margin: '0 8px 7px' }} />}
            <NavRowShadow twoLine={!compact && grouped} count={search} />
          </div>
        ))}
      </div>
      {footer && (
        <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', background: 'var(--surface-2)' }}>
          <Block height={30} />
        </div>
      )}
    </div>
  )
}

function NavRowShadow({ twoLine = false, count = false }: { twoLine?: boolean; count?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', marginBottom: 1, borderRadius: 7 }}>
      <Block width={16} height={16} style={{ borderRadius: 5, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Block width={twoLine ? '58%' : '64%'} height={12} />
        {twoLine && <Block width="76%" height={9} />}
      </div>
      {count && <Block width={18} height={10} />}
    </div>
  )
}

function DetailPanelShadow() {
  return (
    <div style={{ width: 'var(--props)', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Block width={96} height={16} />
            <Block width={88} height={11} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Block width={30} height={30} style={{ borderRadius: 7 }} />
            <Block width={30} height={30} style={{ borderRadius: 7 }} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {Array.from({ length: 4 }).map((_, i) => <Block key={i} height={18} style={{ borderRadius: 999 }} />)}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PanelSectionShadow rows={4} />
        <PanelSectionShadow rows={3} />
        <PanelSectionShadow rows={2} />
      </div>
      <div style={{ borderTop: '1px solid var(--divider)', padding: '12px 16px', display: 'flex', gap: 6, background: 'var(--surface-2)' }}>
        <Block height={32} />
        <Block height={32} width="62%" />
      </div>
    </div>
  )
}

function PanelSectionShadow({ rows }: { rows: number }) {
  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--divider)' }}>
      <Block width={92} height={10} style={{ marginBottom: 10 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Block width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
            <Block width={i % 2 ? '62%' : '78%'} height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

function Panel({ rows, chart = false, style }: { rows: number; chart?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 8, padding: 14, minHeight: 0, ...style }}>
      <Block width="34%" height={13} />
      {chart && <Block height={220} style={{ marginTop: 18 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 72px', gap: 12, alignItems: 'center' }}>
            <Block height={12} width={i % 3 === 0 ? '76%' : i % 3 === 1 ? '58%' : '88%'} />
            <Block height={12} />
          </div>
        ))}
      </div>
    </div>
  )
}

const CUST_COLS = '2.2fr 1.6fr 1.1fr .8fr 1.1fr .8fr 1.1fr'

function CustomersSkeleton() {
  return (
    <div className="dashboard-route-skeleton-customers" style={{ height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      <div className="dashboard-route-skeleton-customers-content" style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 60px' }}>
        {/* header */}
        <div className="dashboard-route-skeleton-customers-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Block width={150} height={28} />
            <Block width={250} height={13} />
          </div>
          <div className="dashboard-route-skeleton-customers-actions" style={{ display: 'flex', gap: 8 }}>
            <Block width={152} height={40} style={{ borderRadius: 10 }} />
            <Block width={140} height={40} style={{ borderRadius: 10 }} />
          </div>
        </div>
        {/* 4 KPI cards */}
        <div className="dashboard-route-skeleton-customers-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 22 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Block width={i % 2 ? 84 : 108} height={11} />
                <Block width={16} height={16} style={{ borderRadius: 5 }} />
              </div>
              <Block width={i % 2 ? 70 : 96} height={26} style={{ marginTop: 15 }} />
              <Block width="52%" height={10} style={{ marginTop: 11 }} />
            </div>
          ))}
        </div>
        {/* search + sort */}
        <div className="dashboard-route-skeleton-customers-toolbar" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <Block height={40} style={{ flex: 1, borderRadius: 10 }} />
          <Block width={150} height={40} style={{ borderRadius: 10 }} />
        </div>
        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[54, 96, 92, 138, 66].map((w, i) => <Block key={i} width={w} height={34} style={{ borderRadius: 999 }} />)}
        </div>
        {/* table */}
        <div className="dashboard-route-skeleton-customers-table" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-1)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: CUST_COLS, gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--divider)', background: 'var(--surface-2)' }}>
            {Array.from({ length: 7 }).map((_, i) => <Block key={i} width={i === 0 ? 60 : i % 2 ? 52 : 72} height={10} />)}
          </div>
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} style={{ display: 'grid', gridTemplateColumns: CUST_COLS, gap: 12, padding: '14px 20px', borderBottom: r === 5 ? 'none' : '1px solid var(--divider)', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Block width={38} height={38} style={{ borderRadius: 999, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Block width={116} height={13} />
                  <Block width={72} height={10} />
                </div>
              </div>
              <Block width={124} height={12} />
              <Block width={64} height={20} style={{ borderRadius: 999 }} />
              <Block width={22} height={12} style={{ marginLeft: 'auto' }} />
              <Block width={58} height={12} style={{ marginLeft: 'auto' }} />
              <Block width={46} height={12} style={{ marginLeft: 'auto' }} />
              <Block width={66} height={12} style={{ marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
        <div className="dashboard-route-skeleton-customers-mobile" style={{ display: 'none', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Block width={40} height={40} style={{ borderRadius: 999, flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'grid', gap: 7 }}><Block width="54%" height={13} /><Block width="78%" height={10} /></div>
                <Block width={58} height={22} style={{ borderRadius: 999 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: 12, marginTop: 14, paddingTop: 13, borderTop: '1px solid var(--divider)' }}>
                <div style={{ display: 'grid', gap: 7 }}><Block width="82%" height={10} /><Block width="55%" height={10} /></div>
                <div style={{ display: 'grid', gap: 7 }}><Block height={11} /><Block width="72%" height={10} style={{ marginLeft: 'auto' }} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DashboardRouteSkeleton({ kind = 'pano' }: Props) {
  if (kind === 'theme') {
    return <ThemeEditorLoadingFrame label="Tema düzenleyici yükleniyor" />
  }

  const content: Record<SkeletonKind, ReactNode> = {
    pano: <PanoSkeleton />,
    orders: <OrdersSkeleton />,
    menu: <MenuSkeleton />,
    theme: null,
    customers: <CustomersSkeleton />,
  }

  return <DashboardSkeletonFrame kind={kind}>{content[kind]}</DashboardSkeletonFrame>
}

/** Lightweight chrome only; route-specific loaders stay in their own bundles. */
export function DashboardSkeletonFrame({ kind, children }: { kind: FrameKind; children: ReactNode }) {
  const labels: Record<FrameKind, string> = {
    pano: 'Pano yükleniyor',
    analytics: 'Raporlar yükleniyor',
    orders: 'Siparişler yükleniyor',
    menu: 'Menü yükleniyor',
    theme: 'Tema düzenleyici yükleniyor',
    customers: 'Müşteriler yükleniyor',
  }
  return (
    <div role="status" aria-live="polite" aria-busy="true" aria-label={labels[kind]} style={shell}>
      <style>{ROUTE_SKELETON_CSS}</style>
      <div aria-hidden="true" style={{ display: 'contents' }}>
        <TopBarSkeleton kind={kind} />
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
