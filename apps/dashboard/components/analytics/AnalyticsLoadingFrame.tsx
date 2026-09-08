import type { CSSProperties } from 'react'
import { Skeleton } from '../../lib/ui'
import { DashboardSkeletonFrame } from '../layout/DashboardRouteSkeleton'
import { AnalyticsReportLoading } from './AnalyticsReportLoading'

function Block({ height, width = '100%', style }: { height: number | string; width?: number | string; style?: CSSProperties }) {
  return <Skeleton width={width} height={height} style={{ borderRadius: 6, ...style }} />
}

export function AnalyticsLoadingFrame() {
  return <DashboardSkeletonFrame kind="analytics"><AnalyticsSkeleton /></DashboardSkeletonFrame>
}

function AnalyticsSkeleton() {
  return (
    <div className="dashboard-route-skeleton-analytics analytics-body" style={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden' }}>
      <aside className="dashboard-route-skeleton-analytics-sidebar" style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)', padding: 14 }}>
        <Block width={88} height={14} />
        <Block width={124} height={10} style={{ marginTop: 8, marginBottom: 18 }} />
        {Array.from({ length: 6 }, (_, index) => <Block key={index} height={52} style={{ marginBottom: 6, borderRadius: 8 }} />)}
      </aside>
      <div className="analytics-mobile-navigation">
        <div className="analytics-mobile-navigation-heading"><Block width={60} height={14} /><Block width={118} height={11} /></div>
        <div className="analytics-mobile-report-tabs">
          {Array.from({ length: 6 }, (_, index) => <Block key={index} width={104} height={44} style={{ flexShrink: 0 }} />)}
        </div>
      </div>
      <div className="analytics-main" style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto' }}>
        <div className="dashboard-route-skeleton-analytics-filter-toggle" style={{ display: 'none', margin: '8px 12px' }}><Block width={112} height={44} /></div>
        <div className="dashboard-route-skeleton-analytics-filter analytics-filter-bar">
          <div className="analytics-filter-context"><Block width={40} height={14.5} /><Block width={112} height={17.4} /></div>
          <div className="dashboard-route-skeleton-analytics-filter-fields analytics-filter-fields">
            {Array.from({ length: 3 }, (_, index) => <div key={index} style={{ display: 'grid', gap: 4, minWidth: 0 }}><Block width={48} height={19.25} /><div className="dashboard-route-skeleton-analytics-filter-control"><Block height="100%" /></div></div>)}
          </div>
          <div className="analytics-filter-actions"><Block width={140} height={14.5} /><div className="dashboard-route-skeleton-analytics-filter-control" style={{ width: '100%' }}><Block height="100%" /></div></div>
        </div>
        <div className="analytics-freshness"><Block width={160} height={12} /><Block width={46} height={24} /></div>
        <div className="analytics-content" style={{ padding: '24px 28px 60px' }}>
          <div className="analytics-active-label"><Block width={80} height={16} /></div>
          <AnalyticsReportLoading />
        </div>
      </div>
    </div>
  )
}

