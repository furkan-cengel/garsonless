'use client'

import type { ReactNode } from 'react'
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
.tb-tables__section-actions { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.tb-tables__section-action { min-height: 36px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 12.5px; font-weight: 600; cursor: pointer; }
.tb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tb-chip { height: 30px; display: inline-flex; align-items: center; gap: 5px; padding: 0 9px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface); color: var(--text); font-size: 12px; font-weight: 600; cursor: pointer; }
.tb-chip > span { color: var(--text-2); font-variant-numeric: tabular-nums; font-weight: 550; }
.tb-chip--late svg { color: var(--critical); }
.tb-chip--stale svg { color: var(--warning); }
.tb-chip--paid svg, .tb-chip--open svg { color: var(--positive); }
.tb-chip--new svg { color: var(--info); }
.tb-chip--empty svg { color: var(--text-2); }
.tb-chip.is-zero:not([aria-pressed='true']) { opacity: .55; }
.tb-chip[aria-pressed='true'] { border-color: var(--action); background: var(--action); color: var(--on-action); }
.tb-chip[aria-pressed='true'] > span, .tb-chip[aria-pressed='true'] svg { color: inherit; }
.tb-row-wrap { margin-bottom: 2px; }
.tb-row { display: flex; align-items: center; gap: 4px; padding-right: 6px; border-radius: 9px; }
.tb-row:hover, .tb-row.is-menu-open { background: var(--surface-3); }
.tb-row.is-active { background: var(--surface-inset); box-shadow: inset 0 0 0 1px var(--border); }
.tb-row__main { flex: 1; min-width: 0; display: grid; gap: 4px; padding: 9px 4px 9px 10px; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.tb-tables .tb-row__main:not(:disabled):hover { transform: none; filter: none; }
.tb-row__top { min-width: 0; display: flex; align-items: center; gap: 6px; }
.tb-row__top strong { min-width: 0; overflow: hidden; font-size: 13.5px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.tb-row__request { display: inline-flex; color: var(--warning); }
.tb-row__line { min-width: 0; overflow: hidden; color: var(--text-2); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.tb-row__quick { height: 30px; flex: none; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 12px; font-weight: 650; cursor: pointer; }
.tb-row__quick.is-primary { border-color: var(--action); background: var(--action); color: var(--on-action); }
.tb-row__quick.is-positive { border-color: var(--positive); color: var(--positive); }
.tb-row__error { margin: 2px 10px 6px; color: var(--critical); font-size: 11.5px; }
.tb-row-request { margin: 0 6px 6px 10px; padding: 5px 6px 5px 9px; display: flex; align-items: center; gap: 6px; border-radius: 8px; background: var(--warning-bg); color: var(--warning); }
.tb-row-request > span { flex: 1; min-width: 0; display: inline-flex; align-items: center; gap: 5px; overflow: hidden; font-size: 12px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
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
.tb-floor__toolbar { min-height: 72px; flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 10px 18px; border-bottom: 1px solid var(--border); background: var(--surface); }
.tb-floor__heading { min-width: 150px; display: grid; gap: 1px; }
.tb-floor__heading strong { font-size: 14px; letter-spacing: -.012em; }
.tb-floor__heading > span:last-child { font-size: 11.5px; color: var(--text-2); }
.tb-floor__eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--text-2); font-size: 11px; font-weight: 750; text-transform: uppercase; letter-spacing: .06em; }
/* The legend uses the cards' full status words, so it gets its own row under the heading and actions. */
.tb-floor__legend { order: 3; flex: 1 0 100%; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-start; gap: 6px 14px; color: var(--text-3); font-size: 10.5px; }
.tb-floor__legend .tb-state { height: 22px; font-size: 11px; }
.tb-floor__actions { display: flex; align-items: center; justify-content: flex-end; gap: 7px; }
.tb-floor__tabs { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface-3); }
.tb-floor__tab { min-height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border: 0; border-radius: 7px; background: transparent; color: var(--text-2); font-size: 12px; font-weight: 600; cursor: pointer; }
.tb-floor__tab > span { color: var(--text-2); font-size: 11px; font-variant-numeric: tabular-nums; }
.tb-floor__tab[aria-pressed='true'] { background: var(--surface); color: var(--text); box-shadow: 0 1px 2px rgba(17,17,19,.08); }
.tb-floor__area { width: auto; min-width: 140px; }
.tb-floor__threshold { position: relative; margin-left: auto; display: inline-flex; align-items: center; gap: 5px; color: var(--text-2); font-size: 12px; white-space: nowrap; }
.tb-floor__threshold strong { color: var(--text); }
.tb-floor__threshold > button { width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 8px; background: transparent; color: var(--text-2); cursor: pointer; }
.tb-floor__threshold-note { position: absolute; top: calc(100% + 6px); right: 0; z-index: 5; width: 280px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); box-shadow: var(--shadow-pop); color: var(--text-2); font-size: 12px; line-height: 1.5; white-space: normal; }
.tb-floor__setup { flex: none; display: flex; align-items: center; gap: 12px; margin: 14px 18px 0; padding: 12px 12px 12px 14px; border: 1px solid color-mix(in srgb, var(--info) 22%, var(--border)); border-radius: 12px; background: var(--info-bg); }
.tb-floor__setup-icon { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 10px; background: var(--surface); color: var(--info); }
.tb-floor__setup > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
.tb-floor__setup strong { font-size: 13px; }
.tb-floor__setup > div > span { color: var(--text-2); font-size: 12px; line-height: 1.45; }
.tb-floor__edit-band { flex: none; display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-bottom: 1px solid var(--border); background: var(--surface-2); color: var(--text-2); font-size: 12px; }
.tb-floor__edit-disabled-copy { max-width: 200px; color: var(--text-2); font-size: 11px; line-height: 1.35; }
.tb-floor__button { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 11.5px; font-weight: 700; cursor: pointer; }
.tb-floor__button--primary { border-color: var(--action); background: var(--action); color: var(--on-action); }
.tb-floor__button:disabled { opacity: .5; }
.tb-floor__properties { min-height: 52px; flex: none; display: flex; align-items: center; gap: 12px; padding: 8px 18px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
.tb-floor__properties > strong { min-width: 90px; font-size: 12px; }
.tb-floor__properties label { display: inline-flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 10.5px; font-weight: 650; }
.tb-floor__properties select { height: 32px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text); padding: 0 8px; font-size: 11.5px; }
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
.tb-floor__canvas { position: relative; min-width: 560px; min-height: 590px; height: 100%; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--surface-2); box-shadow: inset 0 1px 0 rgba(255,255,255,.65), var(--shadow-1); }
.tb-floor__canvas.is-editing { border-color: color-mix(in srgb, var(--action) 42%, var(--border)); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--action) 8%, transparent), var(--shadow-1); }
.tb-floor__grid { position: absolute; inset: 12px; border: 1px dashed color-mix(in srgb, var(--action) 22%, var(--border)); border-radius: 10px; pointer-events: none; }
.tb-floor__empty { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 6px; text-align: center; color: var(--text-3); }
.tb-floor__empty strong { margin-top: 4px; color: var(--text-2); font-size: 13px; }
.tb-floor__empty span { max-width: 260px; font-size: 11px; }
.tb-state { display: inline-flex; align-items: center; gap: 4px; height: 21px; padding: 0 7px 0 5px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface-3); color: var(--text-2); font-size: 11px; font-weight: 650; line-height: 1; white-space: nowrap; }
.tb-state svg { flex: none; }
.tb-state--new { border-color: color-mix(in srgb, var(--info) 28%, var(--info-bg)); background: var(--info-bg); color: var(--info); }
.tb-state--open { border-color: color-mix(in srgb, var(--positive) 28%, var(--positive-bg)); background: var(--positive-bg); color: var(--positive); }
.tb-state--late { border-color: var(--critical); background: var(--critical); color: #fff; }
.tb-state--stale { border-color: color-mix(in srgb, var(--warning) 45%, var(--warning-bg)); background: var(--warning-bg); color: var(--warning); }
.tb-state--paid { border-color: var(--positive); background: var(--surface); color: var(--positive); }
/* Cards carry the state in texture too: dashed when empty, thick when late, striped when left open from yesterday. */
.tb-floor-card { position: absolute; container-type: size; min-width: 92px; min-height: 72px; overflow: hidden; padding: 0; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--surface); color: var(--text); box-shadow: 0 4px 12px rgba(22,24,27,.06); text-align: left; touch-action: none; user-select: none; }
.tb-floor-card__main { width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; justify-content: flex-start; gap: 4px; padding: 9px 10px; border: 0; background: transparent; color: inherit; cursor: pointer; text-align: left; }
.tb-floor-card__more { position: absolute; top: 6px; right: 6px; z-index: 2; width: 44px; height: 44px; display: none; place-items: center; border: 1px solid var(--border); border-radius: 9px; background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--text-2); box-shadow: var(--shadow-1); cursor: pointer; }
.tb-floor-card--empty { border: 1.5px dashed var(--border-strong); box-shadow: none; }
.tb-floor-card--new { border-color: color-mix(in srgb, var(--info) 34%, var(--border)); background: color-mix(in srgb, var(--info-bg) 55%, var(--surface)); }
.tb-floor-card--open { border-color: color-mix(in srgb, var(--positive) 34%, var(--border)); background: color-mix(in srgb, var(--positive-bg) 55%, var(--surface)); }
.tb-floor-card--late { border: 2px solid var(--critical); background: color-mix(in srgb, var(--critical-bg) 70%, var(--surface)); }
.tb-floor-card--stale { border: 1.5px solid color-mix(in srgb, var(--warning) 70%, var(--warning-bg)); background: repeating-linear-gradient(135deg, var(--warning-bg) 0 7px, color-mix(in srgb, var(--warning-bg) 30%, var(--surface)) 7px 14px); }
.tb-floor-card--paid { border: 1.5px solid var(--positive); background: var(--surface); }
.tb-floor-card.is-active { outline: 2px solid var(--action); outline-offset: 2px; }
.tb-floor-card.is-editing { cursor: grab; }
.tb-floor-card.is-editing:not(.is-active) { outline: 1px dashed var(--text-2); outline-offset: 2px; }
.tb-floor-card.is-editing .tb-floor-card__main { cursor: grab; }
.tb-floor-card.is-editing .tb-floor-card__main:active { cursor: grabbing; }
.tb-floor-card.is-colliding { border-color: var(--critical); outline: 3px solid color-mix(in srgb, var(--critical) 20%, transparent); }
.tb-floor-card__topline { min-width: 0; flex: none; display: flex; align-items: center; gap: 5px; }
.tb-floor-card__request { display: inline-flex; align-items: center; gap: 3px; height: 21px; padding: 0 6px; border: 1px solid color-mix(in srgb, var(--warning) 45%, var(--warning-bg)); border-radius: 999px; background: var(--warning-bg); color: var(--warning); font-size: 11px; font-weight: 700; }
.tb-floor-card__grip { margin-left: auto; flex: none; color: var(--text-2); }
.tb-floor-card__label { display: block; max-width: 100%; flex: none; overflow: hidden; color: var(--text); font-size: 15px; font-weight: 650; line-height: 1.2; text-overflow: ellipsis; white-space: nowrap; }
.tb-floor-card__meta, .tb-floor-card__amount { display: block; min-width: 0; flex: none; overflow: hidden; font-size: 12px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.tb-floor-card__meta { color: var(--text-2); }
.tb-floor-card__amount { color: var(--text); font-size: 12.5px; font-weight: 650; font-variant-numeric: tabular-nums; }
.tb-floor-card__amount.is-empty { color: var(--text-2); font-weight: 550; }
.tb-floor-card__amount.is-late { color: var(--critical); }
.tb-floor-card__amount.is-paid { color: var(--positive); }
.tb-floor-card__footer { min-width: 0; flex: none; display: flex; align-items: center; gap: 8px; margin-top: auto; padding-top: 6px; border-top: 1px solid color-mix(in srgb, var(--text) 9%, transparent); color: var(--text-2); font-size: 11px; white-space: nowrap; }
.tb-floor-card__footer > span { min-width: 0; display: inline-flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; }
.tb-floor-card__footer > span:last-child { margin-left: auto; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 10.5px; }
/* Small cards (narrow canvas or a dense plan) drop detail before the essentials: state, name, amount. */
@container (max-height: 132px) { .tb-floor-card__footer { display: none; } }
@container (max-height: 104px) { .tb-floor-card__meta { display: none; } }
@container (max-width: 150px) { .tb-floor-card__label { font-size: 13.5px; } .tb-floor-card__main { padding: 7px 8px; } }
.tb-table-detail-surface { flex: none; min-width: 0; background: var(--surface); }
.tb-table-detail-surface.is-desktop { width: 360px; min-height: 0; border-left: 1px solid var(--border); box-shadow: -3px 0 14px rgba(17,17,19,.04); }
.tb-table-detail-surface.is-drawer { width: min(390px, 92vw); height: 100%; box-shadow: -20px 0 60px rgba(17,17,19,.18); }
.tb-table-detail-surface.is-sheet { width: 100%; height: min(82dvh, 720px); overflow: hidden; border-radius: 18px 18px 0 0; box-shadow: 0 -20px 60px rgba(17,17,19,.2); }
.tb-detail-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--surface); }
.tb-detail-panel__header { min-height: 82px; flex: none; display: flex; align-items: flex-start; gap: 12px; padding: 14px 14px 12px 16px; border-bottom: 1px solid var(--border); }
.tb-detail-panel__header > div { flex: 1; min-width: 0; display: grid; gap: 2px; }
.tb-detail-panel__header h2 { margin: 0; overflow: hidden; font-size: 19px; font-weight: 650; line-height: 1.25; letter-spacing: -.01em; text-overflow: ellipsis; white-space: nowrap; }
.tb-detail-panel__header > div > span:last-child { overflow: hidden; color: var(--text-2); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.tb-detail-panel__header > button { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-2); color: var(--text-2); cursor: pointer; }
.tb-detail-panel__header .tb-state { justify-self: start; margin-bottom: 4px; }
.tb-detail-panel__scroll { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; overscroll-behavior: contain; padding: 14px; }
.tb-detail-panel__note { margin: 0; padding: 10px 12px; border: 1px solid; border-radius: 10px; font-size: 12.5px; line-height: 1.5; }
.tb-detail-panel__note.is-critical { border-color: color-mix(in srgb, var(--critical) 28%, var(--critical-bg)); background: var(--critical-bg); color: var(--critical); }
.tb-detail-panel__note.is-warning { border-color: color-mix(in srgb, var(--warning) 35%, var(--warning-bg)); background: var(--warning-bg); color: var(--warning); }
.tb-detail-panel__note.is-positive { border-color: color-mix(in srgb, var(--positive) 28%, var(--positive-bg)); background: var(--positive-bg); color: var(--positive); }
.tb-detail-panel__note.is-info { border-color: color-mix(in srgb, var(--info) 25%, var(--info-bg)); background: var(--info-bg); color: var(--info); }
.tb-detail-panel__stats { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.tb-detail-panel__stats > div { min-width: 0; padding: 10px 12px; border: 1px solid var(--divider); border-radius: 10px; background: var(--surface-2); }
.tb-detail-panel__stats dt { color: var(--text-2); font-size: 11.5px; }
.tb-detail-panel__stats dd { margin: 2px 0 0; overflow: hidden; font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; text-overflow: ellipsis; white-space: nowrap; }
.tb-detail-panel__stats dd.is-positive { color: var(--positive); }
.tb-detail-panel__stats dd.is-critical { color: var(--critical); }
.tb-detail-panel__idle { display: grid; gap: 14px; }
.tb-detail-panel__start { min-height: 46px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--action); border-radius: 10px; background: var(--action); color: var(--on-action); font-size: 13.5px; font-weight: 650; cursor: pointer; }
.tb-detail-panel__qr { display: flex; align-items: center; gap: 14px; padding: 14px; border: 1px solid var(--divider); border-radius: 12px; background: var(--surface-2); }
.tb-detail-panel__qr > span { width: 64px; height: 64px; flex: none; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 10px; background: #fff; color: #111113; }
.tb-detail-panel__qr > div { min-width: 0; display: grid; gap: 3px; justify-items: start; }
.tb-detail-panel__qr h3 { margin: 0; font-size: 13.5px; }
.tb-detail-panel__code { color: var(--text-2); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; }
.tb-detail-panel__qr a { margin-top: 4px; min-height: 32px; display: inline-flex; align-items: center; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 12px; font-weight: 600; text-decoration: none; }
.tb-detail-panel__settings { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 14px; border-top: 1px solid var(--divider); }
.tb-detail-panel__settings button { min-height: 36px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 12px; font-weight: 600; cursor: pointer; }
.tb-detail-panel__settings button.is-destructive { border-color: color-mix(in srgb, var(--critical) 35%, var(--border)); color: var(--critical); }
.tb-detail-panel__requests { padding: 10px; border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border)); border-radius: 10px; background: var(--warning-bg); }
.tb-detail-panel__orders h3 { margin: 0; font-size: 13.5px; }
.tb-detail-panel__requests > div { display: flex; align-items: center; gap: 8px; }
.tb-detail-panel__requests > div + div { margin-top: 7px; }
.tb-detail-panel__requests span { flex: 1; min-width: 0; display: inline-flex; align-items: center; gap: 6px; color: var(--warning); font-size: 12.5px; font-weight: 700; }
.tb-detail-panel__requests button, .tb-detail-panel__section-heading button { min-height: 30px; border: 1px solid currentColor; border-radius: 7px; background: var(--surface); color: var(--warning); padding: 0 8px; font-size: 10.5px; font-weight: 750; cursor: pointer; }
.tb-detail-panel__section-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.tb-detail-panel__section-heading > div { flex: 1; min-width: 0; }
.tb-detail-panel__section-heading span { display: block; margin-top: 1px; color: var(--text-2); font-size: 11.5px; }
.tb-detail-panel__section-heading button { color: var(--text-2); }
.tb-detail-panel__loading, .tb-detail-panel__empty-row { display: flex; align-items: center; justify-content: center; gap: 7px; min-height: 100px; padding: 18px; color: var(--text-3); font-size: 11.5px; }
.tb-detail-panel__error { padding: 10px; border-radius: 8px; background: var(--critical-bg); color: var(--critical); font-size: 11.5px; }
.tb-detail-panel__error button { display: block; margin-top: 7px; border: 1px solid currentColor; border-radius: 6px; background: transparent; color: inherit; padding: 5px 8px; font-weight: 750; cursor: pointer; }
.tb-detail-order { overflow: hidden; margin-bottom: 8px; border: 1px solid var(--divider); border-radius: 10px; background: var(--surface); }
.tb-detail-order.is-selected { border-color: var(--action); box-shadow: 0 0 0 2px color-mix(in srgb, var(--action) 10%, transparent); }
.tb-detail-order > header { min-height: 42px; display: flex; align-items: center; gap: 7px; padding: 7px 9px; background: var(--surface-2); border-bottom: 1px solid var(--divider); }
.tb-detail-order > header input { width: 18px; height: 18px; flex: none; }
.tb-detail-order > header > div { flex: 1; min-width: 0; }
.tb-detail-order > header > div strong { display: block; font-size: 12.5px; }
.tb-detail-order > header > div span { display: block; color: var(--text-2); font-size: 11px; }
.tb-detail-order > header > span { padding: 2px 7px; border-radius: 999px; background: var(--surface-3); color: var(--text-2); font-size: 11px; font-weight: 650; }
.tb-detail-order > header > span.is-paid { background: var(--positive-bg); color: var(--positive); }
.tb-detail-order > header > strong { font-size: 12.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tb-detail-order__items { padding: 2px 9px; }
.tb-detail-item { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: start; gap: 6px; padding: 9px 0; border-bottom: 1px solid var(--divider); }
.tb-detail-item:last-child { border-bottom: 0; }
.tb-detail-item > span { color: var(--text-2); font-size: 12px; font-weight: 700; }
.tb-detail-item > div { min-width: 0; display: grid; gap: 2px; }
.tb-detail-item > div > strong { overflow-wrap: anywhere; font-size: 12.5px; font-weight: 550; }
.tb-detail-item > div > span { color: var(--text-2); font-size: 11.5px; line-height: 1.4; overflow-wrap: anywhere; }
.tb-detail-item > div > span.is-removed { color: var(--critical); }
.tb-detail-item > div > span.is-note { color: var(--warning); white-space: pre-wrap; }
.tb-detail-item small { color: var(--text-2); font-size: 11px; }
.tb-detail-item > strong { font-size: 12.5px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tb-detail-panel__selection-note { margin: 7px 1px 0; color: var(--text-3); font-size: 10px; line-height: 1.45; }
.tb-detail-panel__actions { flex: none; display: grid; gap: 8px; padding: 12px 14px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--surface-2); }
.tb-detail-panel__action-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.tb-detail-panel__actions button { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border-strong); border-radius: 9px; background: var(--surface); color: var(--text); padding: 0 10px; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.tb-detail-panel__actions button.is-primary { border-color: var(--action); background: var(--action); color: var(--on-action); }
.tb-detail-panel__actions button.is-positive { border-color: var(--positive); background: var(--positive); color: #fff; }
.tb-detail-panel__actions button:disabled { opacity: .45; }
.tb-detail-panel__main { min-height: 48px !important; font-size: 13.5px !important; }
.tb-detail-panel__hint { color: var(--text-2); font-size: 11.5px; text-align: center; }
/* The global setup launcher sits bottom-right; keep it clear of an open table panel. */
body:has(.tb-table-detail-surface.is-desktop) [data-guided-setup-launcher] { right: 372px; }
@media (min-width: 901px) { body:has(.tb-tables--qr) [data-guided-setup-launcher] { right: calc(var(--props, 340px) + 12px); } }
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
.tb-qr-canvas { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); }
.tb-qr-canvas__head { flex: none; display: flex; align-items: center; gap: 12px; padding: 16px 20px 0; }
.tb-qr-canvas__head > div { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; }
.tb-qr-canvas__head h1 { margin: 0; font-size: 17px; font-weight: 650; letter-spacing: -.01em; }
.tb-qr-canvas__head span { color: var(--text-2); font-size: 12px; }
.tb-qr-canvas__stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; margin: 14px 20px 0; padding: 24px; overflow: auto; border: 1px solid var(--border); border-radius: 14px; background: radial-gradient(circle, var(--border) 1px, transparent 1px) var(--surface-2); background-size: 18px 18px; }
.tb-qr-canvas__table-bar { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; margin: 10px 20px 0; }
.tb-qr-canvas__table-bar .tb-tables__canvas-toolbar-left { min-width: 0; display: flex; align-items: center; gap: 8px; }
.tb-qr-canvas__table-bar strong { font-size: 13.5px; white-space: nowrap; }
.tb-qr-canvas__url { min-width: 0; max-width: 240px; overflow: hidden; color: var(--text-2); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.tb-qr-canvas__table-bar .tb-tables__canvas-toolbar-actions { display: flex; align-items: center; gap: 8px; }
.tb-qr-canvas__bulk { flex: none; display: grid; gap: 10px; margin: 14px 20px 16px; padding-top: 14px; border-top: 1px solid var(--border); }
.tb-qr-canvas__bulk-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.tb-qr-canvas__bulk-head h2 { margin: 0; font-size: 13.5px; font-weight: 650; }
.tb-qr-canvas__bulk-head span { flex: 1; min-width: 160px; color: var(--text-2); font-size: 12px; }
.tb-qr-canvas__thumbs { display: flex; gap: 10px; overflow-x: auto; padding: 2px 2px 6px; }
.tb-qr-thumb { flex: none; width: 116px; display: grid; justify-items: center; gap: 6px; padding: 10px 8px 8px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); cursor: pointer; }
.tb-qr-thumb[aria-pressed='true'] { border-color: var(--action); box-shadow: 0 0 0 1px var(--action); }
.tb-qr-thumb__code { position: relative; width: 92px; height: 92px; display: grid; place-items: center; }
.tb-qr-thumb__skeleton { position: absolute; inset: 0; border-radius: 6px; background: var(--surface-3); }
.tb-qr-thumb__label { max-width: 100%; overflow: hidden; font-size: 12px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.tb-qr-section { border-bottom: 1px solid var(--divider); }
.tb-qr-section > h3 { margin: 0; padding: 14px 16px 10px; font-size: 13px; font-weight: 650; }
.tb-qr-presets { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 0 16px 16px; }
.tb-qr-presets button { min-width: 0; display: grid; justify-items: center; gap: 6px; padding: 8px 4px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); font-size: 11.5px; font-weight: 600; cursor: pointer; }
.tb-qr-presets button[aria-checked='true'] { border-color: var(--action); box-shadow: 0 0 0 1px var(--action); }
.tb-qr-advanced-toggle { width: 100%; min-height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 16px; border: 0; background: transparent; color: var(--text); text-align: left; cursor: pointer; }
.tb-qr-advanced-toggle svg { width: 16px; height: 16px; flex: none; transition: transform 120ms ease; }
.tb-qr-advanced-toggle span { flex: 1; font-size: 13px; font-weight: 650; }
.tb-qr-advanced-toggle small { color: var(--text-2); font-size: 11.5px; }
.tb-qr-subheading { margin: 0; padding: 12px 16px 2px; color: var(--text-2); font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
${TABLES_MOBILE_STYLES}
@media (max-width: 1180px) {
  .tb-tables { --nav: 286px; }
  .tb-floor__toolbar { gap: 12px; padding-inline: 14px; }
  .tb-floor__legend { gap: 8px; }
}
@media (max-width: 900px) {
  .tb-tables__body, .tb-tables__content { flex-direction: column; overflow: visible; }
  .tb-tables__section-tabs { min-height: 52px; padding: 4px 10px; }
  .tb-tables__section-tab { min-height: 44px; flex: 1; justify-content: center; }
  .tb-tables--operations .tb-tables__operations-main { padding: 0; overflow: visible; }
  .tb-tables__operations-workspace { flex-direction: column; overflow: visible; }
  .tb-tables--operations .tb-tables__nav { width: 100% !important; max-height: none; border-right: 0; border-bottom: 1px solid var(--border); box-shadow: none; }
  .tb-tables--operations .tb-tables__nav-header { padding: 11px 14px 9px !important; border-bottom: 0 !important; }
  .tb-tables__section-actions { display: none; }
  .tb-qr-canvas__head, .tb-qr-canvas__bulk { padding-inline: 12px; margin-inline: 0; }
  .tb-qr-canvas__stage { margin: 10px 12px 0; }
  .tb-qr-canvas__table-bar { position: static !important; margin: 10px 12px 0; padding: 0 !important; }
  .tb-qr-presets { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .tb-tables__realtime-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
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
  .tb-floor__threshold { margin-left: 0; }
  .tb-floor__setup { display: none; }
  .tb-floor__edit-band { display: none; }
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
  .tb-floor-card { position: relative; container-type: inline-size; left: auto !important; top: auto !important; width: 100% !important; height: auto !important; min-width: 0; min-height: 140px; padding: 0; border-radius: 11px; touch-action: manipulation; }
  .tb-floor-card__main { padding: 10px 52px 10px 10px; }
  .tb-floor-card__more { display: grid; }
  .tb-floor-card__label { white-space: normal; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 1.2; }
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

export function TablesSectionTabs({ restaurantId, active, tableOperationsAllowed = true, actions }: {
  restaurantId: string
  active: 'operations' | 'qr'
  tableOperationsAllowed?: boolean
  actions?: ReactNode
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
      {actions && <div className="tb-tables__section-actions">{actions}</div>}
    </nav>
  )
}

export function TablesOperationsTopBar({ restaurantName, status }: { restaurantName: string; status?: ReactNode }) {
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
      <div style={{ marginLeft: 'auto', minWidth: 0, display: 'flex', alignItems: 'center' }}>{status}</div>
    </header>
  )
}
