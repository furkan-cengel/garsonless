export default function PanoStyles() {
  return (
    <style>{`
    .pano-shell { max-width: 1280px; margin: 0 auto; padding: 28px 32px 16px; }
    .pano-number, .pano-metric-value { font-variant-numeric: tabular-nums lining-nums; font-feature-settings: 'tnum' 1, 'lnum' 1; }
    .pano-metric-value { letter-spacing: -.015em; }
    .pano-kpi-card { min-width: 0; overflow-wrap: anywhere; }
    .pano-greeting { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    .pano-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .pano-kpis[data-count="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .pano-attention { margin-bottom: 12px; }
    .pano-main-grid, .pano-wide-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 12px; margin-bottom: 12px; }
    .pano-lower-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 0; }
    .pano-wide-grid { margin-bottom: 0; }

    .pano-heatmap-scroll { min-width: 0; overflow-x: auto; overflow-y: hidden; padding: 6px; }
    .pano-heatmap-cell { position: relative; display: block; transition: transform 120ms ease, box-shadow 120ms ease; }
    .pano-heatmap-axis { color: var(--text-2); font-size: 11px; line-height: 1.25; }
    .pano-heatmap-cell[tabindex="0"]:hover, .pano-heatmap-cell:focus-visible { z-index: 2; transform: scale(1.12); box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px var(--accent); outline: none; }
    .pano-heatmap-tooltip { position: fixed; z-index: 130; min-width: 132px; padding: 8px 10px; border-radius: 8px; display: flex; flex-direction: column; gap: 2px; transform: translate(-50%, -100%); pointer-events: none; color: #fff; background: rgba(17,17,19,.96); box-shadow: var(--shadow-pop); font-size: 11px; line-height: 1.35; }
    .pano-heatmap-tooltip strong { font-size: 11.5px; font-weight: 700; }
    .pano-heatmap-tooltip span { color: rgba(255,255,255,.72); }
    .pano-peak-view { min-height: 292px; }

    .page-topbar--pano .page-topbar-restaurant { min-height: 44px; }
    .page-topbar--pano .page-topbar-notification { width: 44px !important; height: 44px !important; }
    .page-topbar--pano .pano-action-primary { position: relative; min-height: 30px; }
    .page-topbar--pano .pano-action-primary::after { content: ''; position: absolute; inset: -7px 0; }
    .pano-chart-ranges { min-height: 44px; }
    .pano-chart-ranges button { position: relative; min-height: 44px; }

    .pano-kpi-link > div:hover { transform: translateY(-1px); box-shadow: var(--shadow-2); }
    .pano-kpi-link:focus-visible { outline: 2px solid var(--focus-ring, var(--text)); outline-offset: 2px; border-radius: 12px; }
    .pano-chart-keyboard:focus-visible,
    .pano-analytics-summary:focus-visible { outline: 2px solid var(--focus-ring, var(--text)); outline-offset: 2px; }

    .pano-analytics-summary { width: 100%; min-height: 52px; margin-bottom: 10px; padding: 0; border: 0; border-radius: 10px; display: flex; align-items: center; background: transparent; cursor: pointer; text-align: left; }
    .pano-analytics-chevron { margin-left: auto; color: var(--text-3); transform: rotate(-90deg); transition: transform 140ms ease; }
    .pano-analytics-chevron[data-open] { transform: rotate(0); }

    @media (max-width: 1100px) {
      .pano-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pano-main-grid, .pano-wide-grid { grid-template-columns: minmax(0, 1fr); }
      .pano-lower-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 900px) {
      .page-topbar--pano { height: 104px !important; grid-template-columns: minmax(0, 1fr) auto !important; grid-template-rows: 52px 52px; padding: 0 10px !important; }
      .page-topbar--pano .page-topbar-left { display: contents !important; }
      .page-topbar--pano .page-topbar-context { grid-column: 1 / -1; grid-row: 1; }
      .page-topbar--pano .page-topbar-tag { display: flex !important; grid-column: 1; grid-row: 2; min-width: 0; overflow: hidden; }
      .page-topbar--pano .page-topbar-right { grid-column: 2; grid-row: 2; }
      .page-topbar--pano .page-topbar-brand, .page-topbar--pano .pano-today { display: none !important; }
      .page-topbar--pano .page-topbar-restaurant { width: auto !important; min-width: 44px !important; max-width: 210px; min-height: 44px; padding-left: 0 !important; }
      .page-topbar--pano .page-topbar-restaurant-name { display: inline !important; max-width: 176px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pano-status-full { display: none; }
      .pano-status-compact { display: inline; }
    }
    @media (max-width: 760px) {
      .pano-shell { padding: 16px 14px; }
      .pano-greeting { align-items: flex-start; flex-direction: column; margin-bottom: 14px; }
      .pano-kpis, .pano-lower-grid { grid-template-columns: minmax(0, 1fr); }
      .pano-kpis { gap: 10px; margin-bottom: 14px; }
      .pano-shell .pano-kpi-card { min-height: 0; padding-block: 12px; --card-spacing: 12px; }
      .pano-shell .pano-empty { min-height: 96px; padding: 16px; }
      .pano-attention .pano-empty { min-height: 72px; }
      .pano-chart-head { align-items: flex-start !important; flex-wrap: wrap; }
      .pano-chart-ranges { width: 100%; margin-left: 0 !important; }
      .pano-chart-ranges button { flex: 1; }
    }
    @media (min-width: 380px) and (max-width: 760px) {
      .pano-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pano-kpi-meta { align-items: flex-start; flex-direction: column; }
    }
    @media (min-width: 901px) { .pano-status-compact { display: none; } }
    @media (max-width: 420px) {
      .page-topbar--pano .page-topbar-restaurant-name { max-width: 150px; }
      .page-topbar--pano .pano-action-primary { padding-inline: 10px !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pano-shell *, .page-topbar--pano *, .pano-analytics-chevron { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }
  `}</style>
  )
}
