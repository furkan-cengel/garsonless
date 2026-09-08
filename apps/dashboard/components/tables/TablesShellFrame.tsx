'use client'

import Link from 'next/link'
import Image from 'next/image'
import { LockKeyhole } from 'lucide-react'
import { useShell } from '../../lib/shell-context'
import DashboardIconRail from '../layout/IconRail'
import { TABLES_MOBILE_STYLES } from './tables-builder-mobile-styles'

export const TABLES_SHELL_CSS = `
.tb-tables * { box-sizing: border-box; }
.tb-tables {
  --text-inv: var(--on-action);
  --action-hover: color-mix(in srgb, var(--action) 88%, white);
  --topbar: 52px;
  --rail: 56px;
  --nav: 320px;
  --props: 340px;
  --statusbar: 32px;
  font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.005em;
  /* Tables uses unusually compact operational copy. Keep every normal-sized
     label at the same AA-safe contrast as the shared secondary text token. */
  --text-3: var(--text-2);
  --text-4: var(--text-2);
}
.tb-tables button { font-family: inherit; }
.tb-tables button:not(:disabled) { transition: filter 120ms ease, transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease, border-color 120ms ease; }
.tb-tables button:not(:disabled):hover { filter: brightness(.96); transform: translateY(-1px); }
.tb-tables button:not(:disabled):active { filter: brightness(.92); transform: translateY(0); }
.tb-tables button:focus-visible,
.tb-tables input:focus-visible,
.tb-tables select:focus-visible,
.tb-tables a:focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }
.tb-tables button:disabled { cursor: not-allowed; }
.tb-tables input, .tb-tables select { font-family: inherit; }
.tb-tables ::-webkit-scrollbar { width: 10px; height: 10px; }
.tb-tables ::-webkit-scrollbar-track { background: transparent; }
.tb-tables ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 8px; border: 2px solid var(--surface); }
.tb-tables ::-webkit-scrollbar-thumb:hover { background: var(--text-4); }
.tb-tables .tb-hover { transition: filter .12s ease, opacity .12s ease; }
.tb-tables .tb-hover:hover:not(:disabled) { filter: brightness(0.93); }
.tb-tables .tb-hover:active:not(:disabled) { filter: brightness(0.84); }
.tb-tables .tb-hover:disabled { opacity: .4; cursor: not-allowed; }
.tb-tables__body { flex: 1; min-width: 0; min-height: 0; display: flex; overflow: hidden; }
.tb-tables__content { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.tb-tables__directory-error { min-height: 48px; display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid color-mix(in srgb, var(--critical) 28%, var(--border)); background: var(--critical-bg); color: var(--critical); font-size: 12px; }
.tb-tables__directory-error > span { flex: 1; min-width: 0; }
.tb-tables__directory-error button { min-height: 36px; flex: none; border: 1px solid currentColor; border-radius: 8px; background: var(--surface); color: inherit; padding: 0 10px; font-weight: 750; cursor: pointer; }
.tb-tables__section-tabs { min-height: 46px; display: flex; align-items: center; gap: 4px; padding: 0 14px; border-bottom: 1px solid var(--border); background: var(--surface); }
.tb-tables__section-tab { min-height: 36px; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 8px; color: var(--text-2); font-size: 12.5px; font-weight: 650; text-decoration: none; }
.tb-tables__section-tab:hover { background: var(--surface-3); color: var(--text); }
.tb-tables__section-tab[aria-current='page'] { background: var(--surface-inset); color: var(--text); box-shadow: inset 0 0 0 1px var(--border); }
.tb-tables--operations .tb-tables__operations-main { flex: 1; min-width: 0; display: flex; overflow: hidden; padding: 0; background: var(--bg); }
.tb-tables__operations-workspace { flex: 1; min-width: 0; min-height: 0; display: flex; overflow: hidden; }
.tb-tables--operations .tb-tables__nav { width: var(--nav); flex: none; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid var(--border); background: var(--surface); box-shadow: 2px 0 10px rgba(17,17,19,.03); z-index: 2; }
.tb-tables__nav-mobile-actions { display: none; }
.tb-tables__nav-desktop-content { min-height: 0; flex: 1; display: contents; }
.tb-mobile-navigation__overlay { align-items: flex-end; justify-content: center; }
.tb-mobile-navigation__panel { width: 100%; max-height: 86dvh; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-bottom: 0; border-radius: 18px 18px 0 0; background: var(--surface); box-shadow: 0 -24px 70px rgba(17,17,19,.22); }
.tb-mobile-navigation__panel.is-list { height: 86dvh; }
.tb-mobile-navigation__panel > header { min-height: 72px; flex: none; display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 16px; border-bottom: 1px solid var(--divider); }
.tb-mobile-navigation__panel > header > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
.tb-mobile-navigation__panel > header span { color: var(--text-3); font-size: 9.5px; font-weight: 750; text-transform: uppercase; letter-spacing: .055em; }
.tb-mobile-navigation__panel > header strong { font-size: 16px; }
.tb-mobile-navigation__panel > header button { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text-2); cursor: pointer; }
.tb-mobile-navigation__content { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; overscroll-behavior: contain; }
.tb-mobile-navigation__panel > footer { min-height: 64px; flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--divider); background: var(--surface-2); }
.tb-mobile-navigation__panel > footer span { flex: 1; color: var(--text-3); font-size: 11px; }
.tb-mobile-navigation__panel > footer button { min-height: 44px; border: 1px solid var(--action); border-radius: 9px; background: var(--action); color: var(--on-action); padding: 0 14px; font-size: 12px; font-weight: 750; cursor: pointer; }
.tb-floor { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--bg); }
.tb-floor--loading { padding: 18px; }
.tb-floor__loading-block { flex: 1; min-height: 590px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); animation: tb-floor-loading 1.4s ease-in-out infinite; }
@keyframes tb-floor-loading { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) { .tb-floor__loading-block { animation: none; } }
.tb-floor__toolbar { min-height: 72px; flex: none; display: flex; align-items: center; gap: 20px; padding: 10px 18px; border-bottom: 1px solid var(--border); background: var(--surface); }
.tb-floor__heading { min-width: 150px; display: grid; gap: 1px; }
.tb-floor__heading strong { font-size: 14px; letter-spacing: -.012em; }
.tb-floor__heading > span:last-child { font-size: 10.5px; color: var(--text-3); }
.tb-floor__eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--text-2); font-size: 10.5px; font-weight: 750; text-transform: uppercase; letter-spacing: .06em; }
.tb-floor__legend { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 14px; color: var(--text-3); font-size: 10.5px; }
.tb-floor__legend span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.tb-floor__legend i { width: 8px; height: 8px; display: inline-block; border-radius: 999px; background: var(--text-4); }
.tb-floor__legend i.is-stale { background: var(--warning); }
.tb-floor__legend i.is-paid { background: var(--positive); }
.tb-floor__legend i.is-new { background: var(--warning); }
.tb-floor__legend i.is-open { background: var(--positive); }
.tb-floor__legend i.is-late { background: var(--critical); }
.tb-floor__actions { margin-left: auto; display: flex; align-items: center; justify-content: flex-end; gap: 7px; }
.tb-floor__edit-disabled-copy { max-width: 190px; color: var(--text-2); font-size: 10px; line-height: 1.3; }
.tb-floor__button { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 11.5px; font-weight: 700; cursor: pointer; }
.tb-floor__button--primary { border-color: var(--action); background: var(--action); color: var(--on-action); }
.tb-floor__button:disabled { opacity: .5; }
.tb-floor__properties { min-height: 52px; flex: none; display: flex; align-items: center; gap: 12px; padding: 8px 18px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
.tb-floor__properties > strong { min-width: 90px; font-size: 12px; }
.tb-floor__properties label { display: inline-flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 10.5px; font-weight: 650; }
.tb-floor__properties select { height: 32px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text); padding: 0 8px; font-size: 11.5px; }
.tb-floor__edit-help { margin-left: auto; color: var(--text-3); font-size: 10.5px; }
.tb-floor__message { flex: none; min-height: 42px; display: flex; align-items: center; gap: 10px; padding: 7px 18px; border-bottom: 1px solid currentColor; font-size: 11.5px; font-weight: 650; }
.tb-floor__message > span:first-child { flex: 1; }
.tb-floor__message.is-error { background: var(--critical-bg); color: var(--critical); }
.tb-floor__message.is-success { background: var(--positive-bg); color: var(--positive); }
.tb-floor__message button { min-height: 30px; border: 1px solid currentColor; border-radius: 7px; background: transparent; color: inherit; padding: 0 8px; font-size: 10.5px; font-weight: 750; cursor: pointer; }
.tb-floor__conflict-actions { display: flex; align-items: center; gap: 6px; }
.tb-floor__legacy-import { flex: none; min-height: 58px; display: flex; align-items: center; gap: 9px; padding: 8px 18px; border-bottom: 1px solid color-mix(in srgb, var(--warning) 32%, var(--border)); background: var(--warning-bg); color: var(--text); }
.tb-floor__legacy-icon { width: 32px; height: 32px; flex: none; display: grid; place-items: center; border-radius: 9px; background: var(--surface); color: var(--warning); }
.tb-floor__legacy-import > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
.tb-floor__legacy-import strong { font-size: 11.5px; }
.tb-floor__legacy-import > div > span { color: var(--text-2); font-size: 10.5px; }
.tb-floor__legacy-import button { min-height: 36px; flex: none; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); padding: 0 10px; font-size: 10.5px; font-weight: 750; cursor: pointer; }
.tb-floor__legacy-import button.is-primary { border-color: var(--action); background: var(--action); color: var(--on-action); }
.tb-floor__viewport { flex: 1; min-height: 0; overflow: auto; padding: 18px; }
.tb-floor__canvas { position: relative; min-width: 760px; min-height: 590px; height: 100%; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); box-shadow: inset 0 1px 0 rgba(255,255,255,.65), var(--shadow-1); }
.tb-floor__canvas.is-editing { border-color: color-mix(in srgb, var(--action) 42%, var(--border)); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--action) 8%, transparent), var(--shadow-1); }
.tb-floor__grid { position: absolute; inset: 12px; border: 1px dashed color-mix(in srgb, var(--action) 22%, var(--border)); border-radius: 10px; pointer-events: none; }
.tb-floor__empty { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 6px; text-align: center; color: var(--text-3); }
.tb-floor__empty strong { margin-top: 4px; color: var(--text-2); font-size: 13px; }
.tb-floor__empty span { max-width: 260px; font-size: 11px; }
.tb-floor-card { position: absolute; min-width: 92px; min-height: 72px; overflow: hidden; padding: 0; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--surface); color: var(--text); box-shadow: 0 5px 14px rgba(22,24,27,.07), inset 0 1px 0 rgba(255,255,255,.75); text-align: left; touch-action: none; user-select: none; }
.tb-floor-card__main { width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; justify-content: flex-start; padding: 7px 9px; border: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.tb-floor-card__more { position: absolute; top: 6px; right: 6px; z-index: 2; width: 44px; height: 44px; display: none; place-items: center; border: 1px solid var(--border); border-radius: 9px; background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--text-2); box-shadow: var(--shadow-1); cursor: pointer; }
.tb-floor-card--new { border-color: color-mix(in srgb, var(--warning) 52%, var(--border)); background: var(--warning-bg); }
.tb-floor-card--open { border-color: color-mix(in srgb, var(--positive) 52%, var(--border)); background: var(--positive-bg); }
.tb-floor-card--stale { border-color: var(--warning); background: var(--warning-bg); }
.tb-floor-card--paid { border-color: var(--positive); background: var(--positive-bg); }
.tb-floor-card--late { border-color: color-mix(in srgb, var(--critical) 55%, var(--border)); background: var(--critical-bg); }
.tb-floor-card.is-active { outline: 3px solid color-mix(in srgb, var(--action) 22%, transparent); outline-offset: 2px; border-color: var(--action); }
.tb-floor-card.is-editing { cursor: grab; }
.tb-floor-card.is-editing .tb-floor-card__main { cursor: grab; }
.tb-floor-card.is-editing .tb-floor-card__main:active { cursor: grabbing; }
.tb-floor-card.is-colliding { border-color: var(--critical); outline: 3px solid color-mix(in srgb, var(--critical) 20%, transparent); }
.tb-floor-card__topline { min-width: 0; flex: none; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.tb-floor-card__status { display: inline-flex; align-items: center; gap: 4px; color: var(--text-3); font-size: 8.5px; font-weight: 800; line-height: 1.2; text-transform: uppercase; letter-spacing: .045em; white-space: nowrap; }
.tb-floor-card__dot { width: 6px; height: 6px; flex: none; border-radius: 999px; background: var(--text-4); }
.tb-floor-card--new .tb-floor-card__dot { background: var(--warning); }
.tb-floor-card--open .tb-floor-card__dot { background: var(--positive); }
.tb-floor-card--late .tb-floor-card__dot { background: var(--critical); }
.tb-floor-card__label { display: block; max-width: 100%; flex: none; margin-top: 2px; overflow: hidden; color: var(--text); font-size: clamp(11px, .9vw, 14px); line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.tb-floor-card__summary { min-width: 0; flex: none; display: flex; align-items: baseline; gap: 5px; margin-top: 1px; overflow: hidden; }
.tb-floor-card__meta, .tb-floor-card__amount { display: block; min-width: 0; overflow: hidden; color: var(--text-3); font-size: clamp(8px, .68vw, 10px); line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.tb-floor-card__meta { flex: 1; }
.tb-floor-card__amount { flex: none; color: var(--text-2); font-weight: 750; }
.tb-floor-card__badges { width: 100%; min-height: 15px; flex: none; margin-top: auto; padding-top: 3px; display: flex; align-items: center; gap: 4px; overflow: hidden; }
.tb-floor-card__badge, .tb-floor-card__seats { min-width: 0; display: inline-flex; align-items: center; gap: 3px; padding: 2px 5px; border: 1px solid color-mix(in srgb, var(--positive) 34%, var(--border)); border-radius: 999px; background: var(--surface); color: var(--positive); font-size: 7.5px; font-weight: 800; white-space: nowrap; }
.tb-floor-card__badge--request { border-color: color-mix(in srgb, var(--warning) 40%, var(--border)); color: var(--warning); }
.tb-floor-card__seats { margin-left: auto; border-color: var(--border); color: var(--text-3); }
.tb-table-detail-surface { flex: none; min-width: 0; background: var(--surface); }
.tb-table-detail-surface.is-desktop { width: 360px; min-height: 0; border-left: 1px solid var(--border); box-shadow: -3px 0 14px rgba(17,17,19,.04); }
.tb-table-detail-surface.is-drawer { width: min(390px, 92vw); height: 100%; box-shadow: -20px 0 60px rgba(17,17,19,.18); }
.tb-table-detail-surface.is-sheet { width: 100%; height: min(82dvh, 720px); overflow: hidden; border-radius: 18px 18px 0 0; box-shadow: 0 -20px 60px rgba(17,17,19,.2); }
.tb-detail-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--surface); }
.tb-detail-panel__header { min-height: 82px; flex: none; display: flex; align-items: flex-start; gap: 12px; padding: 14px 14px 12px 16px; border-bottom: 1px solid var(--border); }
.tb-detail-panel__header > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
.tb-detail-panel__header strong { overflow: hidden; font-size: 17px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.tb-detail-panel__header > div > span:last-child { overflow: hidden; color: var(--text-3); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
.tb-detail-panel__header > button { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text-2); cursor: pointer; }
.tb-detail-panel__state { display: inline-flex; align-items: center; gap: 5px; color: var(--text-3); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .055em; }
.tb-detail-panel__state i { width: 6px; height: 6px; border-radius: 999px; background: var(--text-4); }
.tb-detail-panel__state.is-new i { background: var(--warning); }
.tb-detail-panel__state.is-open i { background: var(--positive); }
.tb-detail-panel__state.is-late i { background: var(--critical); }
.tb-detail-panel__scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 14px; }
.tb-detail-panel__stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.tb-detail-panel__stats > div { min-width: 0; padding: 9px 10px; border: 1px solid var(--divider); border-radius: 9px; background: var(--surface-2); }
.tb-detail-panel__stats span { display: block; color: var(--text-3); font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
.tb-detail-panel__stats strong { display: block; margin-top: 2px; overflow: hidden; font-size: 14px; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.tb-detail-panel__stats strong.is-positive { color: var(--positive); }
.tb-detail-panel__stats strong.is-critical { color: var(--critical); }
.tb-detail-panel__empty { min-height: 230px; display: grid; place-content: center; justify-items: center; padding: 24px; text-align: center; }
.tb-detail-panel__empty > span { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 13px; background: var(--surface-3); color: var(--text-3); }
.tb-detail-panel__empty strong { margin-top: 11px; font-size: 14px; }
.tb-detail-panel__empty p { max-width: 280px; margin: 5px 0 0; color: var(--text-3); font-size: 11.5px; line-height: 1.5; }
.tb-detail-panel__requests { margin-top: 12px; padding: 10px; border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border)); border-radius: 10px; background: var(--warning-bg); }
.tb-detail-panel__requests h3, .tb-detail-panel__orders h3 { margin: 0; font-size: 11px; }
.tb-detail-panel__requests > div { display: flex; align-items: center; gap: 8px; margin-top: 7px; }
.tb-detail-panel__requests span { flex: 1; min-width: 0; display: inline-flex; align-items: center; gap: 5px; color: var(--warning); font-size: 11px; font-weight: 700; }
.tb-detail-panel__requests button, .tb-detail-panel__section-heading button { min-height: 30px; border: 1px solid currentColor; border-radius: 7px; background: var(--surface); color: var(--warning); padding: 0 8px; font-size: 10.5px; font-weight: 750; cursor: pointer; }
.tb-detail-panel__orders { margin-top: 14px; }
.tb-detail-panel__section-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tb-detail-panel__section-heading > div { flex: 1; min-width: 0; }
.tb-detail-panel__section-heading span { display: block; margin-top: 1px; color: var(--text-3); font-size: 10px; }
.tb-detail-panel__section-heading button { color: var(--text-2); }
.tb-detail-panel__loading, .tb-detail-panel__empty-row { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 100px; padding: 18px; color: var(--text-3); font-size: 11.5px; }
.tb-detail-panel__error { padding: 10px; border-radius: 8px; background: var(--critical-bg); color: var(--critical); font-size: 11.5px; }
.tb-detail-panel__error button { display: block; margin-top: 7px; border: 1px solid currentColor; border-radius: 6px; background: transparent; color: inherit; padding: 5px 8px; font-weight: 750; cursor: pointer; }
.tb-detail-order { overflow: hidden; margin-bottom: 8px; border: 1px solid var(--divider); border-radius: 10px; background: var(--surface); }
.tb-detail-order.is-selected { border-color: var(--action); box-shadow: 0 0 0 2px color-mix(in srgb, var(--action) 10%, transparent); }
.tb-detail-order > header { min-height: 42px; display: flex; align-items: center; gap: 7px; padding: 7px 9px; background: var(--surface-2); border-bottom: 1px solid var(--divider); }
.tb-detail-order > header input { width: 18px; height: 18px; flex: none; }
.tb-detail-order > header > div { flex: 1; min-width: 0; }
.tb-detail-order > header > div strong { display: block; font-size: 11px; }
.tb-detail-order > header > div span { display: block; color: var(--text-3); font-size: 9.5px; }
.tb-detail-order > header > span { padding: 2px 5px; border-radius: 999px; background: var(--warning-bg); color: var(--warning); font-size: 8.5px; font-weight: 800; }
.tb-detail-order > header > span.is-paid { background: var(--positive-bg); color: var(--positive); }
.tb-detail-order > header > strong { font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tb-detail-order__items { padding: 2px 9px; }
.tb-detail-item { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: start; gap: 6px; padding: 9px 0; border-bottom: 1px solid var(--divider); }
.tb-detail-item:last-child { border-bottom: 0; }
.tb-detail-item > span { color: var(--text-2); font-size: 11px; font-weight: 800; }
.tb-detail-item > div { min-width: 0; display: grid; gap: 2px; }
.tb-detail-item > div > strong { overflow-wrap: anywhere; font-size: 11.5px; }
.tb-detail-item > div > span { color: var(--text-3); font-size: 10px; line-height: 1.4; overflow-wrap: anywhere; }
.tb-detail-item > div > span.is-removed { color: var(--critical); }
.tb-detail-item > div > span.is-note { color: var(--warning); white-space: pre-wrap; }
.tb-detail-item small { color: var(--text-4); font-size: 9.5px; }
.tb-detail-item > strong { font-size: 10.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tb-detail-panel__selection-note { margin: 7px 1px 0; color: var(--text-3); font-size: 10px; line-height: 1.45; }
.tb-detail-panel__actions { flex: none; display: flex; flex-wrap: wrap; gap: 7px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--surface-2); box-shadow: 0 -8px 22px rgba(17,17,19,.04); }
.tb-detail-panel__actions button { min-height: 44px; flex: 1 1 calc(50% - 4px); display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); padding: 0 10px; font-size: 11px; font-weight: 750; cursor: pointer; }
.tb-detail-panel__actions button.is-primary { border-color: var(--action); background: var(--action); color: var(--on-action); }
.tb-detail-panel__actions button:disabled { opacity: .45; }
.tb-quick-menu { position: fixed; z-index: 300; width: min(270px, calc(100vw - 16px)); overflow: hidden; padding: 5px; border: 1px solid var(--border); border-radius: 11px; background: var(--surface); color: var(--text); box-shadow: var(--shadow-pop); font-family: 'Geist','Inter',system-ui,sans-serif; }
.tb-quick-menu__title { padding: 7px 9px 6px; color: var(--text-3); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .055em; }
.tb-quick-menu__item { width: 100%; min-height: 40px; display: flex; align-items: flex-start; gap: 9px; padding: 8px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.tb-quick-menu__item.has-separator { margin-top: 4px; border-top: 1px solid var(--divider); border-radius: 0 0 7px 7px; padding-top: 10px; }
.tb-quick-menu__item:hover, .tb-quick-menu__item:focus-visible { background: var(--surface-3); outline: none; }
.tb-quick-menu__item[aria-disabled='true'] { color: var(--text-4); cursor: not-allowed; }
.tb-quick-menu__item.is-destructive:not([aria-disabled='true']) { color: var(--critical); }
.tb-quick-menu__item > svg { flex: none; margin-top: 1px; }
.tb-quick-menu__item > span { min-width: 0; display: grid; gap: 1px; }
.tb-quick-menu__item strong { font-size: 11.5px; font-weight: 700; }
.tb-quick-menu__item small { color: var(--text-3); font-size: 9.5px; line-height: 1.35; }
.tb-quick-menu__hint { margin: 4px -5px -5px; padding: 6px 10px; border-top: 1px solid var(--divider); background: var(--surface-2); color: var(--text-4); font-size: 9px; }
.tb-properties-dialog { width: min(460px, 100%); overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow-pop); }
.tb-properties-dialog > header { display: flex; align-items: flex-start; gap: 10px; padding: 15px 16px; border-bottom: 1px solid var(--divider); }
.tb-properties-dialog > header > div { flex: 1; display: grid; gap: 3px; }
.tb-properties-dialog > header strong { font-size: 15px; }
.tb-properties-dialog > header span { color: var(--text-3); font-size: 11px; line-height: 1.45; }
.tb-properties-dialog > header button { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); cursor: pointer; }
.tb-properties-dialog__body { display: grid; gap: 11px; padding: 16px; }
.tb-properties-dialog label { display: grid; gap: 5px; color: var(--text-2); font-size: 11px; font-weight: 700; }
.tb-properties-dialog input { width: 100%; height: 40px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); padding: 0 10px; }
.tb-properties-dialog__locations { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.tb-properties-dialog__error, .tb-properties-dialog__delete-confirm { padding: 10px; border-radius: 8px; background: var(--critical-bg); color: var(--critical); font-size: 11px; }
.tb-properties-dialog__delete-confirm { display: grid; gap: 6px; }
.tb-properties-dialog__delete-confirm > div { display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px; }
.tb-properties-dialog__delete-confirm button, .tb-properties-dialog > footer button { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 5px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); padding: 0 11px; font-size: 11.5px; font-weight: 700; cursor: pointer; }
.tb-properties-dialog__delete-confirm button:last-child, .tb-properties-dialog > footer button.is-destructive { border-color: var(--critical); color: var(--critical); }
.tb-properties-dialog > footer { display: flex; align-items: center; gap: 7px; padding: 11px 16px; border-top: 1px solid var(--divider); background: var(--surface-2); }
.tb-properties-dialog > footer span { flex: 1; }
.tb-properties-dialog > footer button.is-primary { border-color: var(--action); background: var(--action); color: var(--on-action); }
${TABLES_MOBILE_STYLES}
@media (max-width: 1180px) {
  .tb-tables { --nav: 286px; }
  .tb-floor__toolbar { gap: 12px; padding-inline: 14px; }
  .tb-floor__legend { gap: 8px; }
  .tb-floor__edit-help { display: none; }
}
@media (max-width: 900px) {
  .tb-tables__body, .tb-tables__content { flex-direction: column; overflow: visible; }
  .tb-tables__section-tabs { min-height: 52px; padding: 4px 10px; }
  .tb-tables__section-tab { min-height: 44px; flex: 1; justify-content: center; }
  .tb-tables--operations .tb-tables__operations-main { padding: 0; overflow: visible; }
  .tb-tables__operations-workspace { flex-direction: column; overflow: visible; }
  .tb-tables--operations .tb-tables__nav { width: 100% !important; max-height: none; border-right: 0; border-bottom: 1px solid var(--border); box-shadow: none; }
  .tb-tables--operations .tb-tables__nav-header { padding: 11px 14px 9px !important; border-bottom: 0 !important; }
  .tb-tables--operations .tb-tables__nav-history { display: none; }
  .tb-tables__nav-desktop-content { display: none; }
  .tb-tables__nav-mobile-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; padding: 0 10px 10px; }
  .tb-tables__nav-mobile-actions > button { min-width: 0; min-height: 48px; display: flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface-2); color: var(--text-2); padding: 5px 7px; cursor: pointer; }
  .tb-tables__nav-mobile-actions > button[aria-expanded='true'] { border-color: var(--action); background: color-mix(in srgb, var(--action) 7%, var(--surface)); color: var(--action); }
  .tb-tables__nav-mobile-actions span { min-width: 0; display: grid; gap: 0; text-align: left; font-size: 10.5px; font-weight: 750; line-height: 1.25; }
  .tb-tables__nav-mobile-actions small { overflow: hidden; color: var(--text-4); font-size: 8.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .tb-mobile-navigation__panel button { min-height: 44px; }
  .tb-mobile-navigation__panel .tb-tables__search { height: 44px !important; }
  .tb-mobile-navigation__panel .tb-tables__search input { height: 100%; }
  .tb-floor { flex: none; min-height: 620px; }
  .tb-floor__toolbar { min-height: 64px; flex-wrap: wrap; gap: 8px 12px; padding: 9px 10px; }
  .tb-floor__heading { flex: 1; min-width: 140px; }
  .tb-floor__legend { order: 3; flex: 1 0 100%; justify-content: flex-start; overflow-x: auto; padding-bottom: 2px; }
  .tb-floor__actions { margin-left: 0; }
  .tb-floor__button { min-height: 44px; }
  .tb-floor__edit-button { display: none; }
  .tb-floor__edit-disabled-copy { display: none; }
  .tb-floor__properties { display: none; }
  .tb-floor__message { padding: 8px 10px; flex-wrap: wrap; }
  .tb-floor__conflict-actions { width: 100%; }
  .tb-floor__legacy-import { align-items: flex-start; flex-wrap: wrap; padding: 10px; }
  .tb-floor__legacy-import > div { flex-basis: calc(100% - 42px); }
  .tb-floor__legacy-import button { min-height: 44px; flex: 1; }
  .tb-floor__viewport { padding: 10px; overflow: visible; }
  .tb-floor__canvas { min-width: 0; min-height: 0; height: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; overflow: visible; padding: 10px; border-radius: 12px; }
  .tb-floor__grid { display: none; }
  .tb-floor-card { position: relative; left: auto !important; top: auto !important; width: 100% !important; height: auto !important; min-width: 0; min-height: 132px; padding: 10px; border-radius: 11px; touch-action: manipulation; }
  .tb-floor-card { padding: 0; }
  .tb-floor-card__main { padding: 10px 52px 10px 10px; }
  .tb-floor-card__summary { display: grid; gap: 1px; }
  .tb-floor-card__more { display: grid; }
  .tb-floor-card__label { font-size: 13px; white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 1.2; }
  .tb-floor-card__status { white-space: normal; }
  .tb-floor-card__meta, .tb-floor-card__amount { font-size: 10px; }
  .tb-floor-card__status { font-size: 8.5px; }
  .tb-floor-card__badge, .tb-floor-card__seats { font-size: 8px; }
  .tb-floor__empty { position: static; grid-column: 1 / -1; min-height: 260px; }
}
@media (min-width: 650px) and (max-width: 900px) {
  .tb-floor__canvas { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .tb-mobile-navigation__overlay { align-items: stretch; justify-content: flex-end; }
  .tb-mobile-navigation__panel { width: min(390px, 92vw); height: 100%; max-height: none; border-width: 0 0 0 1px; border-radius: 0; box-shadow: -24px 0 70px rgba(17,17,19,.2); }
}
@media (max-width: 430px) {
  .tb-floor__canvas { gap: 8px; padding: 8px; }
  .tb-floor-card { min-height: 126px; }
  .tb-table-detail-surface.is-sheet { height: 84dvh; }
  .tb-detail-panel__scroll { padding: 12px; }
  .tb-detail-panel__header { min-height: 76px; }
  .tb-properties-dialog__locations { grid-template-columns: 1fr; }
}
@media (max-width: 360px) {
  .tb-floor__canvas { grid-template-columns: minmax(0, 1fr); }
  .tb-floor-card__meta, .tb-floor-card__amount { overflow: visible; text-overflow: clip; white-space: normal; }
}
@media (prefers-reduced-motion: reduce) {
  .tb-tables *, .tb-tables *::before, .tb-tables *::after {
    scroll-behavior: auto !important;
    transition-duration: 0s !important;
  }
}
`

export function TablesIconRail({ restaurantId }: { restaurantId: string }) {
  const { navigation } = useShell()
  return (
    <DashboardIconRail
      className="tb-tables__rail"
      restaurantId={restaurantId}
      userDisplayName={navigation.userDisplayName}
      userInitials={navigation.userInitials}
      userAvatarUrl={navigation.userAvatarUrl}
      pathname={navigation.pathname}
      ordersBadge={navigation.ordersBadge}
      permissions={navigation.permissions}
      isOwner={navigation.isOwner}
      sectionEntitlements={navigation.sectionEntitlements}
      tableOperationsAllowed={navigation.tableOperationsAllowed}
    />
  )
}

export function TablesSectionTabs({ restaurantId, active, tableOperationsAllowed = true }: {
  restaurantId: string
  active: 'operations' | 'qr'
  tableOperationsAllowed?: boolean
}) {
  const base = `/dashboard/${restaurantId}/tables`
  return (
    <nav className="tb-tables__section-tabs" aria-label="Masalar bölümü">
      <Link className="tb-tables__section-tab" href={base} prefetch={false} aria-current={active === 'operations' ? 'page' : undefined}>
        {!tableOperationsAllowed && <LockKeyhole size={12} />} Canlı Masalar
      </Link>
      <Link className="tb-tables__section-tab" href={`${base}/qr`} prefetch={false} aria-current={active === 'qr' ? 'page' : undefined}>
        QR Studio
      </Link>
    </nav>
  )
}

export function TablesOperationsTopBar({ restaurantName }: { restaurantName: string }) {
  return (
    <header className="tb-tables__topbar" style={{
      height: 'var(--topbar)', flexShrink: 0, display: 'flex', alignItems: 'center',
      padding: '0 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <div className="tb-tables__topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Link href="/dashboard" aria-label="Dashboard ana sayfası" style={{ display: 'flex', alignItems: 'center', paddingRight: 8, borderRight: '1px solid var(--border)', height: 28, textDecoration: 'none' }}>
          <Image src="/brand/masabu-logo-transparent.svg" alt="masabu" width={83} height={18} priority style={{ height: 18, width: 'auto', display: 'block' }} />
        </Link>
        <span style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restaurantName}</span>
        <span aria-hidden="true" style={{ color: 'var(--text-4)' }}>/</span>
        <strong style={{ fontSize: 12.5 }}>Canlı Masalar</strong>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text-3)' }}>Sipariş, servis ve tahsilat operasyonları</div>
    </header>
  )
}
