import type { CSSProperties } from 'react'
import { Skeleton } from '../../lib/ui'

/* Loading shape of the menu workspace, shared by the route loader and the
   client mount: category rail, status tabs and view toggle, section title and
   product cards. Phones get the category picker and two card columns. */

function Block({ width = '100%', height, style }: { width?: number | string; height: number | string; style?: CSSProperties }) {
  return <Skeleton width={width} height={height} style={{ borderRadius: 6, ...style }} />
}

export function MenuWorkspaceSkeleton() {
  return (
    <div className="menu-workspace-skeleton" aria-hidden="true">
      <div className="menu-workspace-skeleton-rail">
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)', display: 'flex', justifyContent: 'space-between' }}>
          <Block width={86} height={15} />
          <Block width={14} height={11} />
        </div>
        <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[true, false, false, false, false, false].map((active, i) => (
            <div key={i} style={{ height: 36, display: 'flex', alignItems: 'center', gap: 10, padding: i === 1 || i === 2 ? '0 8px 0 30px' : '0 8px', borderRadius: 7, background: active ? 'var(--surface-inset)' : undefined }}>
              <Block width={18} height={18} style={{ borderRadius: 5, flexShrink: 0 }} />
              <Block width={i === 1 || i === 2 ? '44%' : '56%'} height={12} />
              <div style={{ flex: 1 }} />
              <Block width={14} height={10} />
            </div>
          ))}
          <Block height={34} style={{ marginTop: 8, background: 'transparent', border: '1px dashed var(--border-strong)', borderRadius: 7 }} />
        </div>
      </div>
      <div className="menu-workspace-skeleton-main">
        <div className="menu-workspace-skeleton-mobile-nav">
          <Block height={36} style={{ borderRadius: 8 }} />
        </div>
        <div className="menu-workspace-skeleton-toolbar">
          <div style={{ display: 'flex', gap: 6 }}>
            <Block width={64} height={28} />
            <Block width={84} height={28} />
            <Block width={58} height={28} />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Block width={28} height={28} />
            <Block width={28} height={28} />
          </div>
        </div>
        <div className="menu-workspace-skeleton-content">
          <Block width={150} height={16} style={{ marginBottom: 18 }} />
          <div className="menu-workspace-skeleton-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 10, overflow: 'hidden' }}>
                <Block height="auto" style={{ aspectRatio: '4 / 3', borderRadius: 0 }} />
                <div style={{ padding: '10px 12px 12px', display: 'grid', gap: 12 }}>
                  <Block width="64%" height={13} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Block width={44} height={14} />
                    <Block width={30} height={17} style={{ borderRadius: 999 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
