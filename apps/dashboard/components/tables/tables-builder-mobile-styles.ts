export const TABLES_MOBILE_STYLES = `
.tb-qr-taskbar,
.tb-qr-mobile-selector { display: none; }
.tb-qr-mobile-picker-overlay { justify-content: center; }
.tb-qr-mobile-picker-panel { width: min(430px, 100%); max-height: 86dvh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-bottom: 0; border-radius: 18px 18px 0 0; background: var(--surface); box-shadow: 0 -24px 70px rgba(17,17,19,.24); }
.tb-qr-mobile-picker-panel > header { min-height: 68px; flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 16px; border-bottom: 1px solid var(--divider); }
.tb-qr-mobile-picker-panel > header > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
.tb-qr-mobile-picker-panel > header span { color: var(--text-3); font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .06em; }
.tb-qr-mobile-picker-panel > header strong { font-size: 16px; }
.tb-qr-mobile-picker-panel > header button { width: 44px; height: 44px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text-2); font-size: 24px; cursor: pointer; }
@media (max-width: 900px) {
  .tb-tables {
    --topbar: 52px;
    --rail: 0px;
    --nav: 100%;
    --props: 100%;
    min-height: 100vh;
    height: auto !important;
    overflow-x: clip;
  }
  .tb-tables__topbar {
    display: flex !important;
    height: auto !important;
    min-height: var(--topbar);
    padding: 8px 10px !important;
    gap: 8px;
  }
  .tb-tables__topbar-left {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
  }
  .tb-tables--qr .tb-tables__topbar-left > a {
    height: 44px !important;
    min-height: 44px;
  }
  .tb-tables__topbar-left > a span,
  .tb-tables__topbar-left > button,
  .tb-tables__topbar-left > span:nth-of-type(1),
  .tb-tables__topbar-left > span:nth-of-type(2) {
    display: none !important;
  }
  .tb-tables__topbar-presets,
  .tb-tables__topbar-right {
    display: none !important;
  }
  .tb-tables__workspace {
    flex-direction: column;
    overflow: auto !important;
  }
  .tb-tables__rail {
    display: none !important;
  }
  .tb-tables--qr .tb-qr-picker-desktop {
    display: none !important;
  }
  .tb-qr-taskbar {
    order: -2;
    min-height: 52px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .tb-qr-taskbar button {
    min-height: 44px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    color: var(--text-2);
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .tb-qr-taskbar button[aria-selected='true'] {
    border-color: var(--border);
    background: var(--surface-inset);
    color: var(--text);
    box-shadow: var(--shadow-1);
  }
  .tb-qr-mobile-selector {
    order: -1;
    min-height: 66px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px 8px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }
  .tb-qr-mobile-selector > div { flex: 1; min-width: 0; display: grid; gap: 1px; }
  .tb-qr-mobile-selector span { color: var(--text-3); font-size: 9.5px; font-weight: 750; text-transform: uppercase; letter-spacing: .055em; }
  .tb-qr-mobile-selector strong { overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
  .tb-qr-mobile-selector button { min-height: 44px; display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--surface-2); color: var(--text); padding: 0 12px; font-size: 12px; font-weight: 750; cursor: pointer; }
  .tb-tables--qr[data-qr-task='preview'] .tb-tables__props,
  .tb-tables--qr[data-qr-task='design'] .tb-tables__canvas { display: none !important; }
  .tb-tables__nav {
    width: 100% !important;
    flex: none !important;
    max-height: none;
    border-right: none !important;
    border-bottom: 1px solid var(--border);
  }
  .tb-tables--operations .tb-tables__nav-list {
    overflow: visible !important;
  }
  .tb-tables__nav button,
  .tb-tables [aria-labelledby="settlement-dialog-title"] button,
  .tb-tables [aria-labelledby="table-transfer-dialog-title"] button {
    min-height: 44px !important;
  }
  .tb-tables [aria-labelledby="settlement-dialog-title"] input,
  .tb-tables [aria-labelledby="table-transfer-dialog-title"] select {
    min-height: 44px !important;
  }
  .tb-tables__table-options {
    width: 44px !important;
    min-width: 44px;
    height: 44px !important;
    top: 0 !important;
    right: 0 !important;
  }
  .tb-tables__search {
    height: 44px !important;
  }
  .tb-tables__filters select,
  .tb-tables__nav-list input {
    min-height: 44px !important;
  }
  .tb-tables__session-actions {
    margin-left: 8px !important;
    padding: 8px !important;
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px !important;
  }
  .tb-tables__session-summary {
    grid-column: 1 / -1;
    white-space: normal !important;
  }
  .tb-tables__session-action {
    width: 100%;
    min-width: 0;
    justify-content: center;
    padding: 0 8px !important;
    border-radius: 8px !important;
    font-size: 12px !important;
  }
  .tb-tables__canvas {
    flex: none !important;
    min-height: calc(100dvh - 216px);
  }
  .tb-tables__canvas-toolbar {
    height: auto !important;
    min-height: 44px;
    position: sticky;
    top: 0;
    z-index: 12;
    flex-wrap: nowrap;
    gap: 8px;
    padding: 8px 10px !important;
    align-items: center !important;
  }
  .tb-tables__canvas-toolbar-left,
  .tb-tables__canvas-toolbar-actions {
    flex: 1 1 auto;
    min-width: 0;
  }
  .tb-tables__canvas-toolbar-actions {
    justify-content: flex-start;
    flex-wrap: nowrap;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding-bottom: 2px;
  }
  .tb-tables__canvas-toolbar button {
    min-height: 44px !important;
  }
  .tb-tables__canvas-toolbar-actions > * {
    max-width: 100%;
  }
  .tb-tables__canvas-body {
    padding: 16px 12px !important;
  }
  .tb-tables__props {
    width: 100% !important;
    flex: none !important;
    border-left: none !important;
    border-top: 1px solid var(--border);
    min-height: calc(100dvh - 216px);
  }
  .tb-tables__props-tabbar { position: sticky; top: 0; z-index: 10; background: var(--surface); }
  .tb-tables__props-tabs { scroll-padding-inline: 12px; }
  .tb-tables__statusbar {
    display: none !important;
  }
  .tb-tables--qr .tb-tables__props button,
  .tb-tables--qr .tb-tables__props input,
  .tb-tables--qr .tb-tables__props label { min-height: 44px; }
  .tb-transfer-dialog-panel {
    max-height: calc(100dvh - 24px) !important;
  }
  .tb-transfer-dialog-scroll {
    padding-bottom: max(18px, env(safe-area-inset-bottom)) !important;
  }
  .tb-transfer-feedback {
    right: 12px !important;
    bottom: max(12px, env(safe-area-inset-bottom)) !important;
  }
  .tb-transfer-feedback button {
    min-width: 44px;
    min-height: 44px;
  }
}
@media (max-width: 649px) {
  .tb-tables__section-tabs { padding: 0 8px; }
  .tb-tables__section-tab { min-height: 44px; }
  .tb-tables__canvas-toolbar { display: grid !important; grid-template-columns: minmax(0, 1fr); }
  .tb-tables__canvas-toolbar-left,
  .tb-tables__canvas-toolbar-actions { width: 100%; }
  .tb-tables__canvas-toolbar-left > span:first-child { max-width: none !important; flex: 1; }
  .tb-tables__canvas-toolbar-actions {
    overflow: visible;
    gap: 8px !important;
    padding-bottom: 4px;
  }
  .tb-tables__canvas-toolbar-actions .tb-qr-health {
    width: 6px;
    min-width: 6px;
    max-width: 6px !important;
    gap: 0 !important;
    font-size: 0 !important;
  }
  .tb-tables__canvas-toolbar-actions .tb-qr-view-switch { flex: none; }
  .tb-tables__canvas-toolbar-actions .tb-qr-view-switch button {
    width: 44px;
    min-width: 44px;
    padding: 0 !important;
    gap: 0 !important;
    font-size: 0 !important;
    justify-content: center;
  }
  .tb-tables__canvas-toolbar-actions .tb-qr-view-switch button svg { width: 14px; height: 14px; }
  .tb-tables__canvas-toolbar-actions .tb-qr-divider { display: none; }
  .tb-tables__canvas-toolbar-actions { flex-wrap: wrap; }
  .tb-tables__canvas-toolbar-actions .tb-qr-export-actions { flex: 1 0 100%; min-width: 0; }
  .tb-tables__canvas-toolbar-actions .tb-qr-export-actions > button:first-child { flex: 1 1 auto; min-width: 0; }
  .tb-tables__canvas-toolbar-actions .tb-qr-export-actions > div > button { width: 44px; min-width: 44px; padding: 0 !important; }
  .tb-qr-field { grid-template-columns: 1fr !important; gap: 5px !important; align-items: start !important; }
  .tb-qr-mobile-picker-panel { width: 100%; }
}
@media (max-width: 760px) {
  .tb-tables {
    padding-bottom: calc(58px + env(safe-area-inset-bottom));
  }
  .tb-tables__rail {
    position: fixed !important;
    /* Shared dialog/sheet portals use layer 50 and must cover the rail. */
    z-index: 20;
    inset: auto 0 0 0;
    width: 100% !important;
    height: calc(58px + env(safe-area-inset-bottom));
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 2px !important;
    padding: 6px 8px calc(6px + env(safe-area-inset-bottom)) !important;
    overflow: hidden;
    border-right: 0 !important;
    border-top: 1px solid var(--border);
    background: var(--surface);
  }
  .tb-tables__rail .rail-primary {
    min-width: 0;
    flex: 1;
    flex-direction: row;
    align-items: center;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x proximity;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    mask-image: linear-gradient(to right, transparent, #000 10px, #000 calc(100% - 10px), transparent);
  }
  .tb-tables__rail .rail-primary::-webkit-scrollbar { display: none; }
  .tb-tables__rail .rail-item { scroll-snap-align: center; }
  .tb-tables__rail .rail-secondary {
    margin-top: 0 !important;
    margin-left: auto;
    flex-direction: row !important;
    flex-shrink: 0;
    background: var(--surface);
  }
  .tb-tables__rail .rail-tooltip { display: none; }
  .tb-tables__rail .rail-active-indicator {
    left: 8px;
    right: 8px;
    top: auto;
    bottom: -1px;
    width: auto;
    height: 2.5px;
  }
  .tb-transfer-feedback {
    bottom: calc(70px + env(safe-area-inset-bottom)) !important;
  }
}
@media (min-width: 650px) and (max-width: 900px) {
  .tb-qr-mobile-picker-overlay { align-items: stretch !important; justify-content: flex-end; }
  .tb-qr-mobile-picker-panel { width: min(390px, 92vw); height: 100%; max-height: none; border-width: 0 0 0 1px; border-radius: 0; }
}
`
