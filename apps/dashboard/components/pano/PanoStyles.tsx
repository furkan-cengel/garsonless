export default function PanoStyles() {
  return <style>{`
    .pano-shell { max-width: 1280px; margin: 0 auto; padding: 28px 32px 60px; }
    .pano-greeting { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
    .pano-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
    .pano-attention { margin-bottom: 12px; }
    .pano-main-grid, .pano-wide-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); gap: 12px; margin-bottom: 12px; }
    .pano-lower-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 12px; }
    .pano-wide-grid { margin-bottom: 0; }
    .pano-heatmap-scroll, .pano-data-table-scroll { min-width: 0; overflow-x: auto; padding-bottom: 2px; }
    .pano-action, .pano-range-action, .pano-attention-action, .pano-data-toggle {
      min-height: 44px;
      transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease, border-color 140ms ease, opacity 140ms ease;
    }
    .page-topbar--pano .page-topbar-restaurant { min-height: 44px; }
    .page-topbar--pano .page-topbar-notification { width: 44px !important; height: 44px !important; }
    .pano-action:hover { transform: translateY(-1px); box-shadow: var(--shadow-2); }
    .pano-action-primary:hover { filter: brightness(1.15); }
    .pano-action-secondary:hover { background: var(--surface-2) !important; border-color: var(--border-strong) !important; }
    .pano-attention-action { padding: 0 8px; border-radius: 8px; display: inline-flex; align-items: center; gap: 3px; color: var(--text-2); font-size: 11.5px; font-weight: 650; text-decoration: none; }
    .pano-attention-action:hover { background: var(--surface-3); color: var(--text); }
    .pano-table-attention-row:hover { background: var(--surface-2); }
    .pano-table-attention-row:focus-visible, .pano-table-plan-link:focus-visible { outline: 2px solid var(--focus-ring, var(--text)); outline-offset: -2px; }
    .pano-table-plan-link { min-height: 44px; padding: 0 4px; display: inline-flex; align-items: center; gap: 3px; color: var(--text-2); font-size: 11.5px; font-weight: 650; text-decoration: none; }
    .pano-live-retry { min-height: 44px; padding: 0 6px; border: 0; border-radius: 8px; display: inline-flex; align-items: center; gap: 5px; background: transparent; color: var(--text-2); font-size: 11.5px; font-weight: 650; cursor: pointer; }
    .pano-live-retry:hover:not(:disabled) { background: var(--surface-3); color: var(--text); }
    .pano-live-retry:disabled { opacity: .55; cursor: wait; }
    .pano-kpi-link > div:hover { transform: translateY(-1px); box-shadow: var(--shadow-2); border-color: var(--border-strong) !important; }
    .pano-kpi-link:focus-visible { outline: 2px solid var(--focus-ring, var(--text)); outline-offset: 2px; border-radius: 12px; }
    .pano-range-action:not(:disabled):hover { background: var(--surface-2) !important; color: var(--text) !important; }
    .pano-action:focus-visible, .pano-range-action:focus-visible, .pano-attention-action:focus-visible, .pano-live-retry:focus-visible, .pano-data-toggle:focus-visible, .pano-chart-keyboard:focus-visible, .pano-analytics-summary:focus-visible {
      outline: 2px solid var(--focus-ring, var(--text)); outline-offset: 2px;
    }
    .pano-action:active { transform: translateY(0) scale(.98); box-shadow: none; }
    .pano-data-toggle { border: 0; border-radius: 8px; padding: 0 10px; background: transparent; color: var(--text-2); font-size: 11.5px; font-weight: 650; cursor: pointer; }
    .pano-data-toggle:hover { background: var(--surface-3); color: var(--text); }
    .pano-data-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    .pano-data-table th, .pano-data-table td { padding: 8px 10px; border-bottom: 1px solid var(--divider); text-align: left; white-space: nowrap; }
    .pano-data-table th { color: var(--text-2); font-weight: 650; }
    .pano-data-table td:last-child, .pano-data-table th:last-child { text-align: right; }
    .pano-analytics-summary { min-height: 52px; margin-bottom: 10px; border-radius: 10px; display: flex; align-items: center; cursor: pointer; list-style: none; }
    .pano-analytics-summary::-webkit-details-marker { display: none; }
    .pano-analytics-summary::after { content: '⌄'; margin-left: auto; color: var(--text-3); font-size: 18px; transform: rotate(-90deg); transition: transform 140ms ease; }
    .pano-analytics[open] > .pano-analytics-summary::after { transform: rotate(0); }
    @media (max-width: 1100px) {
      .pano-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .pano-main-grid, .pano-wide-grid { grid-template-columns: minmax(0, 1fr); }
      .pano-lower-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 760px) {
      .page-topbar--pano { height: 104px !important; grid-template-columns: minmax(0, 1fr) auto !important; grid-template-rows: 52px 52px; padding: 0 10px !important; }
      .page-topbar--pano .page-topbar-left { display: contents !important; }
      .page-topbar--pano .page-topbar-context { grid-column: 1 / -1; grid-row: 1; }
      .page-topbar--pano .page-topbar-tag { grid-column: 1; grid-row: 2; min-width: 0; }
      .page-topbar--pano .page-topbar-right { grid-column: 2; grid-row: 2; }
      .page-topbar--pano .page-topbar-brand, .page-topbar--pano .pano-today { display: none !important; }
      .page-topbar--pano .page-topbar-restaurant { min-width: 0; min-height: 44px; padding-left: 0 !important; }
      .page-topbar--pano .page-topbar-restaurant-name { max-width: 176px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pano-status-full { display: none; }
      .pano-status-compact { display: inline; }
      .pano-shell { padding: 18px 14px 48px; }
      .pano-greeting { align-items: flex-start; flex-direction: column; margin-bottom: 18px; }
      .pano-kpis, .pano-lower-grid { grid-template-columns: minmax(0, 1fr); }
      .pano-chart-head { align-items: flex-start !important; flex-wrap: wrap; }
      .pano-chart-ranges { width: 100%; margin-left: 0 !important; }
      .pano-chart-ranges button { flex: 1; }
      .pano-analytics-summary { position: sticky; top: 0; z-index: 2; background: var(--bg); }
    }
    @media (min-width: 761px) { .pano-status-compact { display: none; } }
    @media (max-width: 420px) {
      .page-topbar--pano .page-topbar-restaurant-name { max-width: 150px; }
      .page-topbar--pano .pano-action-primary { padding-inline: 10px !important; }
    }
    @media (prefers-reduced-motion: reduce) {
      .pano-shell *, .page-topbar--pano *, .pano-analytics-summary::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }
  `}</style>
}
