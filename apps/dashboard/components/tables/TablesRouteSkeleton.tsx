import type { ReactNode } from 'react'

type TablesRouteSkeletonVariant = 'operations' | 'qr'

const TABLES_ROUTE_SKELETON_CSS = `
.tb-route-skeleton, .tb-route-skeleton * { box-sizing: border-box; }
.tb-route-skeleton {
  --tb-sk-topbar: 52px;
  --tb-sk-rail: 56px;
  --tb-sk-nav: 320px;
  --tb-sk-props: 340px;
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text);
  background: var(--surface);
}
.tb-route-skeleton__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.tb-route-skeleton__block {
  display: block;
  flex: none;
  border-radius: 6px;
  background: var(--surface-3);
  animation: tb-route-skeleton-pulse 1.5s ease-in-out infinite;
}
.tb-route-skeleton__topbar {
  height: var(--tb-sk-topbar);
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
}
.tb-route-skeleton__topbar .tb-route-skeleton__block:last-child { margin-left: auto; }
.tb-route-skeleton__tabs {
  min-height: 46px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border-bottom: 1px solid var(--border);
}
.tb-route-skeleton__tab { width: 118px; height: 36px; border-radius: 8px; }
.tb-route-skeleton__workspace { flex: 1; min-height: 0; display: flex; }
.tb-route-skeleton__rail {
  width: var(--tb-sk-rail);
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 13px;
  padding: 12px 0;
  border-right: 1px solid var(--border);
}
.tb-route-skeleton__rail .tb-route-skeleton__block { width: 32px; height: 32px; border-radius: 8px; }
.tb-route-skeleton__operations-main {
  flex: 1;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  background: var(--bg);
}
.tb-route-skeleton__operations-card {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  border: 1px solid var(--border);
  border: 0;
  border-radius: 0;
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.tb-route-skeleton__operations-panel { width: var(--tb-sk-nav); flex: none; overflow: hidden; border-right: 1px solid var(--border); background: var(--surface); }
.tb-route-skeleton__operations-plan { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--bg); }
.tb-route-skeleton__plan-grid { flex: 1; margin: 18px; padding: 42px; display: grid; grid-template-columns: repeat(4, minmax(90px, 1fr)); align-content: start; gap: 48px 42px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); }
.tb-route-skeleton__plan-table { width: 100%; height: 92px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
.tb-route-skeleton__operations-header { padding: 16px; border-bottom: 1px solid var(--border); }
.tb-route-skeleton__mobile-actions { display: none; }
.tb-route-skeleton__title-row, .tb-route-skeleton__status-row, .tb-route-skeleton__filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tb-route-skeleton__title-row { justify-content: space-between; }
.tb-route-skeleton__status-row { margin-top: 14px; flex-wrap: wrap; }
.tb-route-skeleton__status {
  width: 108px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface-2);
}
.tb-route-skeleton__status::before {
  content: '';
  display: block;
  width: 8px;
  height: 8px;
  margin: 11px 0 0 12px;
  border-radius: 999px;
  background: var(--text-4);
}
.tb-route-skeleton__status:nth-child(2)::before { background: var(--info); }
.tb-route-skeleton__status:nth-child(3)::before { background: var(--positive); }
.tb-route-skeleton__status:nth-child(4)::before { background: var(--critical); }
.tb-route-skeleton__filter-row { margin-top: 12px; }
.tb-route-skeleton__search { height: 40px; flex: 1; min-width: 180px; }
.tb-route-skeleton__filter { width: 124px; height: 40px; }
.tb-route-skeleton__list { padding: 4px 12px 14px; }
.tb-route-skeleton__table-row {
  min-height: 78px;
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) 84px 108px;
  align-items: center;
  gap: 12px;
  padding: 12px 8px;
  border-bottom: 1px solid var(--divider);
}
.tb-route-skeleton__table-dot { width: 10px; height: 10px; border-radius: 999px; }
.tb-route-skeleton__table-copy { display: flex; flex-direction: column; gap: 8px; }
.tb-route-skeleton__table-meta { display: flex; gap: 8px; }
.tb-route-skeleton__table-action { width: 100%; height: 32px; }
.tb-route-skeleton__qr-picker {
  width: var(--tb-sk-nav);
  flex: none;
  padding: 14px 12px;
  border-right: 1px solid var(--border);
}
.tb-route-skeleton__picker-row {
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--divider);
}
.tb-route-skeleton__qr-canvas {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.tb-route-skeleton__canvas-toolbar {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
.tb-route-skeleton__canvas-body { flex: 1; min-height: 0; display: grid; place-items: center; padding: 24px; }
.tb-route-skeleton__qr-sheet {
  width: min(46vh, 420px);
  max-width: 78%;
  aspect-ratio: 3 / 4;
  display: grid;
  place-items: center;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.tb-route-skeleton__qr-code { width: 62%; aspect-ratio: 1; border-radius: 8px; }
.tb-route-skeleton__properties {
  width: var(--tb-sk-props);
  flex: none;
  padding: 14px;
  border-left: 1px solid var(--border);
}
.tb-route-skeleton__property-tabs { display: flex; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.tb-route-skeleton__property-section { display: flex; flex-direction: column; gap: 12px; padding-top: 18px; }
.tb-route-skeleton__statusbar {
  height: 32px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-top: 1px solid var(--border);
}
.tb-route-skeleton__qr-taskbar,
.tb-route-skeleton__qr-mobile-selector { display: none; }
@keyframes tb-route-skeleton-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) {
  .tb-route-skeleton__block { animation: none; }
}
@media (max-width: 900px) {
  .tb-route-skeleton { height: auto; min-height: 100vh; overflow-x: clip; overflow-y: visible; }
  .tb-route-skeleton__topbar { min-height: 52px; height: auto; padding: 8px 10px; }
  .tb-route-skeleton__topbar .tb-route-skeleton__block:last-child { display: none; }
  .tb-route-skeleton__tabs { min-height: 52px; padding: 4px 10px; }
  .tb-route-skeleton__tab { width: auto; height: 44px; flex: 1; }
  .tb-route-skeleton__workspace { flex-direction: column; overflow: visible; }
  .tb-route-skeleton__rail { display: none; }
  .tb-route-skeleton__operations-main { padding: 0; overflow: visible; }
  .tb-route-skeleton__operations-card { border: 0; border-radius: 0; box-shadow: none; }
  .tb-route-skeleton__operations-card { flex-direction: column; }
  .tb-route-skeleton__operations-panel { width: 100%; max-height: none; border-right: 0; border-bottom: 1px solid var(--border); }
  .tb-route-skeleton__operations-plan { min-height: 520px; }
  .tb-route-skeleton__plan-grid { margin: 10px; padding: 10px; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .tb-route-skeleton__plan-table { height: 126px; }
  .tb-route-skeleton__title-row { align-items: flex-start; }
  .tb-route-skeleton__status-row { margin-top: 8px; }
  .tb-route-skeleton__status-row .tb-route-skeleton__status:not(:first-child),
  .tb-route-skeleton__filter-row,
  .tb-route-skeleton__list { display: none; }
  .tb-route-skeleton__status { width: 148px; height: 24px; }
  .tb-route-skeleton__status::before { margin-top: 7px; }
  .tb-route-skeleton__mobile-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; padding: 0 10px 10px; }
  .tb-route-skeleton__mobile-action { height: 48px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); }
  .tb-route-skeleton__qr-picker { display: none; }
  .tb-route-skeleton__qr-taskbar { min-height: 52px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; padding: 6px 10px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .tb-route-skeleton__qr-taskbar .tb-route-skeleton__block { width: 100%; height: 40px; border-radius: 9px; }
  .tb-route-skeleton__qr-mobile-selector { min-height: 66px; display: flex; align-items: center; gap: 12px; padding: 8px 10px 8px 14px; border-bottom: 1px solid var(--border); background: var(--surface); }
  .tb-route-skeleton__qr-mobile-selector .tb-route-skeleton__block:nth-child(2) { margin-left: auto; }
  .tb-route-skeleton__canvas-toolbar { min-height: 60px; flex-wrap: wrap; }
  .tb-route-skeleton__canvas-toolbar .tb-route-skeleton__block { height: 44px !important; }
  .tb-route-skeleton__canvas-body { min-height: 440px; padding: 20px; }
  .tb-route-skeleton__qr-sheet { width: min(300px, 86vw); max-width: none; }
  .tb-route-skeleton__properties { display: none; }
  .tb-route-skeleton__statusbar { display: none; }
}
@media (max-width: 760px) {
  .tb-route-skeleton { padding-bottom: calc(58px + env(safe-area-inset-bottom)); }
  .tb-route-skeleton__rail {
    position: fixed;
    z-index: 170;
    inset: auto 0 0 0;
    width: 100%;
    height: calc(58px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    gap: 8px;
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
    overflow: hidden;
    border-right: 0;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .tb-route-skeleton__rail .tb-route-skeleton__block { flex: none; }
}
@media (max-width: 360px) {
  .tb-route-skeleton__plan-grid { grid-template-columns: minmax(0, 1fr); }
}
`

function Block({ className = '', width, height }: { className?: string; width?: string | number; height?: string | number }) {
  return <span className={`tb-route-skeleton__block ${className}`} style={{ width, height }} />
}

function Chrome({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="tb-route-skeleton__topbar">
        <Block width={86} height={18} />
        <Block width={122} height={12} />
        <Block width={164} height={12} />
      </div>
      <div className="tb-route-skeleton__tabs">
        <Block className="tb-route-skeleton__tab" />
        <Block className="tb-route-skeleton__tab" />
      </div>
      {children}
    </>
  )
}

function IconRail() {
  return <div className="tb-route-skeleton__rail">{Array.from({ length: 7 }, (_, index) => <Block key={index} />)}</div>
}

function OperationsSkeleton() {
  return (
    <Chrome>
      <div className="tb-route-skeleton__workspace">
        <IconRail />
        <main className="tb-route-skeleton__operations-main">
          <div className="tb-route-skeleton__operations-card"><aside className="tb-route-skeleton__operations-panel">
            <div className="tb-route-skeleton__operations-header">
              <div className="tb-route-skeleton__title-row"><Block width={152} height={20} /><Block width={92} height={32} /></div>
              <div className="tb-route-skeleton__status-row">{Array.from({ length: 4 }, (_, index) => <span className="tb-route-skeleton__status" key={index} />)}</div>
              <div className="tb-route-skeleton__filter-row"><Block className="tb-route-skeleton__search" /><Block className="tb-route-skeleton__filter" /><Block className="tb-route-skeleton__filter" /></div>
            </div>
            <div className="tb-route-skeleton__mobile-actions">{Array.from({ length: 3 }, (_, index) => <span className="tb-route-skeleton__mobile-action" key={index} />)}</div>
            <div className="tb-route-skeleton__list">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="tb-route-skeleton__table-row" key={index}>
                  <Block className="tb-route-skeleton__table-dot" />
                  <span className="tb-route-skeleton__table-copy"><Block width={`${58 + (index % 3) * 8}%`} height={14} /><span className="tb-route-skeleton__table-meta"><Block width={72} height={10} /><Block width={54} height={10} /></span></span>
                  <Block width="100%" height={12} />
                  <Block className="tb-route-skeleton__table-action" />
                </div>
              ))}
            </div>
          </aside><section className="tb-route-skeleton__operations-plan">
            <div className="tb-route-skeleton__canvas-toolbar"><Block width={142} height={30} /><Block width={88} height={30} /><Block width={112} height={36} /></div>
            <div className="tb-route-skeleton__plan-grid">{Array.from({ length: 12 }, (_, index) => <span className="tb-route-skeleton__plan-table" key={index} />)}</div>
          </section></div>
        </main>
      </div>
    </Chrome>
  )
}

function QRSkeleton() {
  return (
    <Chrome>
      <div className="tb-route-skeleton__workspace">
        <IconRail />
        <aside className="tb-route-skeleton__qr-picker">
          <Block width={126} height={18} />
          <Block width="100%" height={36} className="tb-route-skeleton__search" />
          {Array.from({ length: 6 }, (_, index) => <div className="tb-route-skeleton__picker-row" key={index}><Block width={32} height={32} /><Block width={`${52 + (index % 3) * 10}%`} height={13} /></div>)}
        </aside>
        <main className="tb-route-skeleton__qr-canvas">
          <div className="tb-route-skeleton__qr-taskbar"><Block /><Block /></div>
          <div className="tb-route-skeleton__qr-mobile-selector"><Block width={128} height={28} /><Block width={92} height={44} /></div>
          <div className="tb-route-skeleton__canvas-toolbar"><Block width={104} height={30} /><Block width={82} height={30} /><Block width={96} height={30} /></div>
          <div className="tb-route-skeleton__canvas-body"><div className="tb-route-skeleton__qr-sheet"><Block className="tb-route-skeleton__qr-code" /></div></div>
        </main>
        <aside className="tb-route-skeleton__properties">
          <div className="tb-route-skeleton__property-tabs">{Array.from({ length: 5 }, (_, index) => <Block key={index} width={52} height={32} />)}</div>
          <div className="tb-route-skeleton__property-section"><Block width={118} height={16} /><Block height={40} /><Block width={146} height={12} /><Block height={76} /><Block width={98} height={12} /><Block height={40} /><Block height={40} /></div>
        </aside>
      </div>
      <div className="tb-route-skeleton__statusbar"><Block width={150} height={10} /><Block width={184} height={10} /></div>
    </Chrome>
  )
}

export function TablesRouteSkeleton({ variant }: { variant: TablesRouteSkeletonVariant }) {
  const label = variant === 'operations' ? 'Canlı masa görünümü hazırlanıyor' : 'QR Studio hazırlanıyor'
  return (
    <div className={`tb-route-skeleton tb-route-skeleton--${variant}`} role="status" aria-live="polite" aria-busy="true">
      <style dangerouslySetInnerHTML={{ __html: TABLES_ROUTE_SKELETON_CSS }} />
      <span className="tb-route-skeleton__sr-only">{label}</span>
      <div aria-hidden="true" style={{ display: 'contents' }}>
        {variant === 'operations' ? <OperationsSkeleton /> : <QRSkeleton />}
      </div>
    </div>
  )
}
