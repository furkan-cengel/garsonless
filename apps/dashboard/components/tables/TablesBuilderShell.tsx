'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { Tables } from '@garsonless/db'
import { createTable, deleteTable, getOpenTableSessions, closeTableSession, renameTable, saveQRStyle } from '../../lib/actions/tables'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import SettlementSheet from './SettlementSheet'
import { getPendingServiceRequests, resolveServiceRequest } from '../../lib/actions/service-requests'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { useShell } from '../../lib/shell-context'
import { InlineSpinner } from '@garsonless/ui'
import { AppIconNodes, AppIcons } from '@garsonless/ui/icons'
import DashboardIconRail from '../layout/IconRail'

/* ─── Types ─────────────────────────────────────────────────── */
interface TableItem {
  id: string
  label: string
  slug: string
  orders: number
  status: 'active' | 'idle' | 'paused'
}

interface QRConfig {
  dotsType: string
  eyeFrame: string
  eyeBall: string
  size: number
  margin: number
  ecl: string
  colorType: string
  fg: string
  fg2: string
  gradType: string
  gradAngle: number
  bg: string
  bgTransparent: boolean
  logo: string | null
  logoSize: number
  logoMargin: number
  logoHideBg: boolean
  frame: string
  frameTitle: string
  frameSubtitle: string
  frameColor: string
  baseUrl: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  autoLang: boolean
  countdown: boolean
  _presetId?: string
}

interface Props {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  initialTables: Tables<'tables'>[]
  initialQRStyle?: unknown
}

type SaveState = 'saved' | 'saving' | 'error'

type QRCodeStylingCtor = typeof import('qr-code-styling').default

let qrCodeStylingCtorPromise: Promise<QRCodeStylingCtor> | null = null

function loadQRCodeStyling(): Promise<QRCodeStylingCtor> {
  qrCodeStylingCtorPromise ??= import('qr-code-styling').then(mod => mod.default)
  return qrCodeStylingCtorPromise
}

/* ─── Helpers ───────────────────────────────────────────────── */
function deriveSlug(label: string, index: number): string {
  if (/bahçe/i.test(label)) return `b${String(index + 1).padStart(2, '0')}`
  if (/bar/i.test(label)) return `ba${String.fromCharCode(64 + index + 1).toLowerCase()}`
  const num = label.match(/\d+/)?.[0]
  return num ? num.padStart(2, '0') : String(index + 1).padStart(2, '0')
}

function mapDBTables(dbTables: Tables<'tables'>[]): TableItem[] {
  return dbTables.map((t, i) => ({
    id: t.id,
    label: t.label,
    slug: deriveSlug(t.label, i),
    orders: 0,
    status: t.qr_code_url ? 'active' : 'idle',
  }))
}

function defaultQR(baseUrl: string): QRConfig {
  return {
    dotsType: 'rounded',
    eyeFrame: 'extra-rounded',
    eyeBall: 'dot',
    size: 600,
    margin: 10,
    ecl: 'H',
    colorType: 'single',
    fg: '#111113',
    fg2: '#3b3b40',
    gradType: 'linear',
    gradAngle: 90,
    bg: '#ffffff',
    bgTransparent: false,
    logo: null,
    logoSize: 0.30,
    logoMargin: 8,
    logoHideBg: true,
    frame: 'card',
    frameTitle: 'Menüyü tara',
    frameSubtitle: "QR'ı telefon kameranızla okutun",
    frameColor: '#111113',
    baseUrl,
    utmSource: 'qr',
    utmMedium: 'masa',
    utmCampaign: '',
    autoLang: true,
    countdown: false,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function readString(row: Record<string, unknown>, key: keyof QRConfig, fallback: string): string {
  const value = row[key]
  return typeof value === 'string' ? value : fallback
}

function readNumber(row: Record<string, unknown>, key: keyof QRConfig, fallback: number): number {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readBoolean(row: Record<string, unknown>, key: keyof QRConfig, fallback: boolean): boolean {
  const value = row[key]
  return typeof value === 'boolean' ? value : fallback
}

function normalizeQRStyle(input: unknown, baseUrl: string): QRConfig {
  const fallback = defaultQR(baseUrl)
  const row = asRecord(input)
  if (!row) return fallback

  return {
    dotsType: readString(row, 'dotsType', fallback.dotsType),
    eyeFrame: readString(row, 'eyeFrame', fallback.eyeFrame),
    eyeBall: readString(row, 'eyeBall', fallback.eyeBall),
    size: Math.round(readNumber(row, 'size', fallback.size)),
    margin: Math.round(readNumber(row, 'margin', fallback.margin)),
    ecl: ['L', 'M', 'Q', 'H'].includes(readString(row, 'ecl', fallback.ecl))
      ? readString(row, 'ecl', fallback.ecl)
      : fallback.ecl,
    colorType: readString(row, 'colorType', fallback.colorType) === 'gradient' ? 'gradient' : 'single',
    fg: readString(row, 'fg', fallback.fg),
    fg2: readString(row, 'fg2', fallback.fg2),
    gradType: readString(row, 'gradType', fallback.gradType) === 'radial' ? 'radial' : 'linear',
    gradAngle: Math.round(readNumber(row, 'gradAngle', fallback.gradAngle)),
    bg: readString(row, 'bg', fallback.bg),
    bgTransparent: readBoolean(row, 'bgTransparent', fallback.bgTransparent),
    logo: typeof row.logo === 'string' ? row.logo : null,
    logoSize: readNumber(row, 'logoSize', fallback.logoSize),
    logoMargin: Math.round(readNumber(row, 'logoMargin', fallback.logoMargin)),
    logoHideBg: readBoolean(row, 'logoHideBg', fallback.logoHideBg),
    frame: readString(row, 'frame', fallback.frame),
    frameTitle: readString(row, 'frameTitle', fallback.frameTitle),
    frameSubtitle: readString(row, 'frameSubtitle', fallback.frameSubtitle),
    frameColor: readString(row, 'frameColor', fallback.frameColor),
    baseUrl: readString(row, 'baseUrl', fallback.baseUrl),
    utmSource: readString(row, 'utmSource', fallback.utmSource),
    utmMedium: readString(row, 'utmMedium', fallback.utmMedium),
    utmCampaign: readString(row, 'utmCampaign', fallback.utmCampaign),
    autoLang: readBoolean(row, 'autoLang', fallback.autoLang),
    countdown: readBoolean(row, 'countdown', fallback.countdown),
    _presetId: typeof row._presetId === 'string' ? row._presetId : undefined,
  }
}

/* ─── Constants ─────────────────────────────────────────────── */
const PRESETS = [
  { id: 'classic',  name: 'Klasik',     fg: '#111113', bg: '#ffffff', dots: 'square',          ef: 'square',        eb: 'square', grad: false },
  { id: 'soft',     name: 'Yumuşak',    fg: '#111113', bg: '#ffffff', dots: 'rounded',         ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'dotty',    name: 'Noktalı',    fg: '#111113', bg: '#ffffff', dots: 'dots',            ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'amber',    name: 'Kehribar',   fg: '#8a4a1c', bg: '#fdf6ec', dots: 'classy-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'emerald',  name: 'Zümrüt',     fg: '#1b5b3e', bg: '#eaf3ed', dots: 'extra-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'midnight', name: 'Gece',       fg: '#0e0e10', bg: '#f3f3f5', dots: 'rounded',         ef: 'square',        eb: 'square', grad: true, gradTo: '#3b3b40' },
  { id: 'sunset',   name: 'Gün batımı', fg: '#b8551c', bg: '#fff6ef', dots: 'extra-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: true, gradTo: '#a13b7a' },
  { id: 'mint',     name: 'Nane',       fg: '#0e8a64', bg: '#edf9f4', dots: 'classy-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
] as const

const DOT_STYLES = [
  { value: 'square',          label: 'Kare' },
  { value: 'dots',            label: 'Nokta' },
  { value: 'rounded',         label: 'Yuvarlak' },
  { value: 'classy',          label: 'Klasik' },
  { value: 'classy-rounded',  label: 'Klasik+' },
  { value: 'extra-rounded',   label: 'Çok yuvarlak' },
]
const EYE_FRAME_STYLES = [
  { value: 'square',         label: 'Kare' },
  { value: 'dot',            label: 'Nokta' },
  { value: 'extra-rounded',  label: 'Yuvarlak' },
]
const EYE_BALL_STYLES = [
  { value: 'square', label: 'Kare' },
  { value: 'dot',    label: 'Nokta' },
]
const FRAME_STYLES = [
  { id: 'none',   label: 'Yok' },
  { id: 'card',   label: 'Kart' },
  { id: 'banner', label: 'Şerit' },
  { id: 'speech', label: 'Balon' },
  { id: 'phone',  label: 'Telefon' },
]

/* ─── CSS Design System ─────────────────────────────────────── */
const CSS_VARS = `
.tb-tables * { box-sizing: border-box; }
.tb-tables {
  --bg: #f6f6f7;
  --surface: #ffffff;
  --surface-2: #fafafa;
  --surface-3: #f3f3f4;
  --surface-inset: #ececef;
  --border: #e7e7ea;
  --border-strong: #d6d7db;
  --divider: #efeff1;
  --text: #111113;
  --text-2: #5b5d63;
  --text-3: #8b8d94;
  --text-4: #b3b4ba;
  --text-inv: #ffffff;
  --action: #18181b;
  --action-hover: #27272a;
  --on-action: #ffffff;
  --positive: #137a4d;
  --positive-bg: #e6f4ec;
  --warning: #a55a00;
  --warning-bg: #fef3e2;
  --critical: #b42318;
  --critical-bg: #fde7e5;
  --accent: #2f6f4e;
  --accent-soft: #eaf3ed;
  --shadow-1: 0 1px 0 rgba(17,17,19,.04), 0 1px 2px rgba(17,17,19,.04);
  --shadow-2: 0 1px 0 rgba(17,17,19,.04), 0 4px 12px rgba(17,17,19,.06);
  --shadow-pop: 0 8px 24px rgba(17,17,19,.10), 0 2px 6px rgba(17,17,19,.06);
  --topbar: 52px;
  --rail: 56px;
  --nav: 260px;
  --props: 340px;
  --statusbar: 32px;
  font-family: 'Geist', 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.005em;
}
.tb-tables button { font-family: inherit; }
.tb-tables input, .tb-tables select { font-family: inherit; }
.tb-tables ::-webkit-scrollbar { width: 10px; height: 10px; }
.tb-tables ::-webkit-scrollbar-track { background: transparent; }
.tb-tables ::-webkit-scrollbar-thumb { background: #d8d9dc; border-radius: 8px; border: 2px solid var(--surface); }
.tb-tables ::-webkit-scrollbar-thumb:hover { background: #b8b9bd; }
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
    overflow: auto;
  }
  .tb-tables__rail {
    display: none !important;
  }
  .tb-tables__nav {
    width: 100% !important;
    flex: none !important;
    max-height: 420px;
    border-right: none !important;
    border-bottom: 1px solid var(--border);
  }
  .tb-tables__canvas {
    flex: none !important;
    min-height: 520px;
  }
  .tb-tables__canvas-toolbar {
    height: auto !important;
    min-height: 44px;
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 10px !important;
    align-items: flex-start !important;
  }
  .tb-tables__canvas-toolbar-left,
  .tb-tables__canvas-toolbar-actions {
    flex: 1 1 100%;
    min-width: 0;
  }
  .tb-tables__canvas-toolbar-actions {
    justify-content: space-between;
    overflow-x: auto;
  }
  .tb-tables__canvas-body {
    padding: 20px !important;
  }
  .tb-tables__props {
    width: 100% !important;
    flex: none !important;
    border-left: none !important;
    border-top: 1px solid var(--border);
  }
  .tb-tables__statusbar {
    display: none !important;
  }
}
`

/* ─── Shared icon aliases ───────────────────────────────────── */
const I = {
  cutlery: AppIconNodes.cutlery,
  chair: AppIconNodes.chair,
  palette: AppIconNodes.palette,
  clipboard: AppIconNodes.clipboard,
  gear: AppIconNodes.gear,
  question: AppIconNodes.question,
  chevDown: AppIconNodes.chevDown,
  chevRight: AppIconNodes.chevRight,
  chevLeft: AppIconNodes.chevLeft,
  eye: AppIconNodes.eye,
  warn: AppIconNodes.warn,
  plus: AppIconNodes.plus,
  search: AppIconNodes.search,
  image: AppIconNodes.image,
  copy: AppIconNodes.copy,
  undo: AppIconNodes.undo,
  redo: AppIconNodes.redo,
  history: AppIconNodes.history,
  layout: AppIconNodes.layout,
  bell: AppIconNodes.bell,
  bellSmall: <AppIcons.bell size={11} />,
  check: AppIconNodes.check,
  close: AppIconNodes.close,
  trash: AppIconNodes.trash,
}

const QRI = {
  download: AppIconNodes.download,
  upload: AppIconNodes.upload,
  qr: AppIconNodes.qr,
  paint: AppIconNodes.paint,
  frame: AppIconNodes.frame,
  print: AppIconNodes.print,
  link2: AppIconNodes.link2,
  scan: AppIconNodes.scan,
  more: AppIconNodes.more,
  refresh: AppIconNodes.refresh,
  star: AppIconNodes.star,
}

const S = {
  label: { fontSize: 11, fontWeight: 500, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: 'var(--text-3)' },
  mono:  { fontFamily: "'Geist Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' as const },
}

function btnPrimary(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 30, padding: '0 12px', borderRadius: 7, border: '1px solid var(--action)',
    background: 'var(--action)', color: 'var(--on-action)',
    fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08), 0 1px 0 rgba(0,0,0,.04)',
  }
}
function btnGhost(): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 30, padding: '0 10px', borderRadius: 7,
    border: '1px solid var(--border-strong)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
  }
}

/* ─── Tag ───────────────────────────────────────────────────── */
function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral:  { bg: 'var(--surface-3)', fg: 'var(--text-2)' },
    positive: { bg: 'var(--positive-bg)', fg: 'var(--positive)' },
  }
  const t = tones[tone] ?? { bg: 'var(--surface-3)', fg: 'var(--text-2)' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: t.bg, color: t.fg,
      fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 999, lineHeight: 1.4,
    }}>{children}</span>
  )
}

/* ─── IconRail ──────────────────────────────────────────────── */
function TablesIconRail({ restaurantId }: { restaurantId: string }) {
  const { navigation } = useShell()
  return (
    <DashboardIconRail
      className="tb-tables__rail"
      restaurantId={restaurantId}
      userInitials={navigation.userInitials}
      pathname={navigation.pathname}
      ordersBadge={navigation.ordersBadge}
      permissions={navigation.permissions}
      isOwner={navigation.isOwner}
    />
  )
}

/* ─── PresetChip ────────────────────────────────────────────── */
function PresetChip({ preset, active, onClick }: { preset: typeof PRESETS[number]; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={preset.name} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 28, padding: '0 10px 0 4px',
      background: active ? 'var(--surface)' : 'transparent',
      border: '1px solid ' + (active ? 'var(--text)' : 'var(--border)'),
      borderRadius: 6, cursor: 'pointer',
      boxShadow: active ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 4, background: preset.bg,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14">
          {preset.dots === 'dots'
            ? ([2,5,8,11] as number[]).flatMap(x => ([2,5,8,11] as number[]).map(y =>
                <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill={preset.fg} />
              ))
            : <>
                <rect x="1" y="1" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
                <rect x="10" y="1" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
                <rect x="1" y="10" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
                {([[5,2],[7,4],[9,6],[5,7],[6,9],[8,9],[9,11]] as [number,number][]).map(([x,y], i) => (
                  <rect key={i} x={x} y={y} width="1.6" height="1.6" rx={preset.dots === 'rounded' ? .5 : 0} fill={preset.fg} />
                ))}
              </>
          }
        </svg>
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 500, color: active ? 'var(--text)' : 'var(--text-2)' }}>{preset.name}</span>
    </button>
  )
}

/* ─── TablesTopBar ──────────────────────────────────────────── */
function TablesTopBar({ qr, setQR, restaurantName, saveState, previewUrl }: {
  qr: QRConfig
  setQR: (q: QRConfig) => void
  restaurantName: string
  saveState: SaveState
  previewUrl: string
}) {
  const { openNotifications, notificationCount } = useShell()
  const status = saveState === 'saving'
    ? { label: 'Stil kaydediliyor', color: 'var(--warning)' }
    : saveState === 'error'
      ? { label: 'Stil kaydedilemedi', color: 'var(--critical)' }
      : { label: 'Stil kaydedildi', color: 'var(--positive)' }
  return (
    <div className="tb-tables__topbar" style={{
      height: 'var(--topbar)', flexShrink: 0,
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
      padding: '0 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)',
    }}>
      <div className="tb-tables__topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8, borderRight: '1px solid var(--border)', height: 28, textDecoration: 'none' }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 12, letterSpacing: '-.02em',
          }}>g</div>
          <span style={{ fontWeight: 600, fontSize: 13, letterSpacing: '-.01em', color: 'var(--text)' }}>garsonless</span>
        </a>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
          color: 'var(--text-2)', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '5px 8px', borderRadius: 6,
        }}>
          <span>{restaurantName}</span>
          {React.cloneElement(I.chevDown as React.ReactElement<{ size?: number }>, { size: 13 })}
        </button>
        <span style={{ color: 'var(--text-4)' }}>/</span>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Mağaza</span>
        <span style={{ color: 'var(--text-4)' }}>/</span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Masalar & QR</span>
      </div>

      <div className="tb-tables__topbar-presets" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span style={{ ...S.label, marginRight: 4 }}>Hazır</span>
        {PRESETS.slice(0, 5).map(p => (
          <PresetChip key={p.id} preset={p} active={qr._presetId === p.id}
            onClick={() => setQR({
              ...qr,
              fg: p.fg, bg: p.bg,
              dotsType: p.dots, eyeFrame: p.ef, eyeBall: p.eb,
              colorType: p.grad ? 'gradient' : 'single',
              fg2: ('gradTo' in p ? p.gradTo : qr.fg2) as string,
              _presetId: p.id,
            })}
          />
        ))}
        <button style={{
          height: 28, width: 28, border: '1px solid var(--border-strong)',
          background: 'var(--surface)', borderRadius: 6, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)',
        }}>
          {React.cloneElement(QRI.more as React.ReactElement<{ size?: number }>, { size: 14 })}
        </button>
      </div>

      <div className="tb-tables__topbar-right" style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 8px', color: 'var(--text-3)', fontSize: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: status.color }} />
          {status.label}
        </div>
        <div aria-hidden style={{ display: 'inline-flex', gap: 2, opacity: 0.35 }}>
          {React.cloneElement(I.undo as React.ReactElement<{ size?: number }>, { size: 15 })}
          {React.cloneElement(I.redo as React.ReactElement<{ size?: number }>, { size: 15 })}
        </div>
        <button
          onClick={openNotifications}
          aria-label="Bildirimler"
          style={{
            position: 'relative',
            width: 30, height: 30, border: 'none', borderRadius: 7,
            background: 'transparent', color: 'var(--text-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {React.cloneElement(I.bell as React.ReactElement<{ size?: number }>, { size: 16 })}
          {notificationCount > 0 && (
            <span style={{
              position: 'absolute', top: 2, right: 2,
              minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999,
              background: 'var(--critical)', color: '#fff',
              fontSize: 9.5, fontWeight: 700, lineHeight: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid var(--surface)',
            }}>
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </button>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />
        <button style={btnGhost()} onClick={() => window.open(previewUrl, '_blank', 'noopener')}>
          {React.cloneElement(I.eye as React.ReactElement<{ size?: number }>, { size: 13 })}Önizle
        </button>
        <Tag tone="positive">
          <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />
          Otomatik yayında
        </Tag>
      </div>
    </div>
  )
}

/* ─── MiniQR (deterministic static SVG) ────────────────────── */
function MiniQR({ seed }: { seed: string }) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  const rand = (i: number) => {
    const x = ((h ^ (i * 2654435761)) >>> 0)
    return (x % 100) / 100
  }
  const cells: [number, number][] = []
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    if (rand(y * 7 + x) > 0.55) cells.push([x, y])
  }
  return (
    <svg width="20" height="20" viewBox="0 0 14 14">
      <rect x="0" y="0" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="1" y="1" width="2" height="2" fill="#fff" />
      <rect x="10" y="0" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="11" y="1" width="2" height="2" fill="#fff" />
      <rect x="0" y="10" width="4" height="4" fill="#111113" rx=".5" />
      <rect x="1" y="11" width="2" height="2" fill="#fff" />
      {cells.map(([x, y], i) => (
        (x < 4 && y < 4) || (x > 9 && y < 4) || (x < 4 && y > 9) ? null :
        <rect key={i} x={x * 2} y={y * 2} width="1.6" height="1.6" fill="#111113" />
      ))}
    </svg>
  )
}

/* ─── TableRow ──────────────────────────────────────────────── */
function TableRow({
  table,
  active,
  onClick,
  onRename,
  onDelete,
  deleteDisabled,
}: {
  table: TableItem
  active: boolean
  onClick: () => void
  onRename: (label: string) => Promise<string | null>
  onDelete: () => Promise<string | null>
  deleteDisabled: boolean
}) {
  const [hov, setHov] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(table.label)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dotColor = table.status === 'active' ? 'var(--positive)' : table.status === 'paused' ? 'var(--warning)' : 'var(--text-4)'

  useEffect(() => {
    if (!editing) setDraft(table.label)
  }, [editing, table.label])

  const commitRename = async () => {
    const nextLabel = draft.trim()
    if (!nextLabel) return
    if (nextLabel === table.label) {
      setEditing(false)
      return
    }
    setBusy(true)
    setError(null)
    const nextError = await onRename(nextLabel)
    setBusy(false)
    if (nextError) {
      setError(nextError)
      return
    }
    setEditing(false)
  }

  const commitDelete = async () => {
    if (deleteDisabled) {
      setError('Bu masada açık adisyon var. Önce adisyonu kapatın.')
      setMenuOpen(false)
      return
    }
    if (!window.confirm(`${table.label} silinsin mi? QR bağlantısı da listeden kalkar.`)) return
    setBusy(true)
    setError(null)
    const nextError = await onDelete()
    setBusy(false)
    if (nextError) setError(nextError)
  }

  if (editing) {
    return (
      <div style={{
        padding: 8, marginBottom: 3,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        borderRadius: 8,
      }}>
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void commitRename()
            if (e.key === 'Escape') { setEditing(false); setError(null) }
          }}
          style={{
            width: '100%', height: 28, padding: '0 8px', marginBottom: 6,
            border: '1px solid var(--border-strong)', borderRadius: 6,
            outline: 'none', fontSize: 12.5,
          }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void commitRename()}
            style={{ ...btnPrimary(), height: 26, fontSize: 11.5, padding: '0 10px', flex: 1, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <><InlineSpinner size={11} color="var(--on-action)" /> Kaydediliyor…</> : <>{React.cloneElement(I.check as React.ReactElement<{ size?: number }>, { size: 12 })}Kaydet</>}
          </button>
          <button
            type="button"
            onClick={() => { setEditing(false); setError(null) }}
            style={{ ...btnGhost(), height: 26, fontSize: 11.5, padding: '0 10px' }}
          >
            {React.cloneElement(I.close as React.ReactElement<{ size?: number }>, { size: 12 })}
          </button>
        </div>
        {error && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--critical)' }}>{error}</div>}
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ position: 'relative', marginBottom: 1 }}
    >
      <button onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '8px 8px',
          background: active ? 'var(--surface-inset)' : (hov || menuOpen ? 'var(--surface-3)' : 'transparent'),
          border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{
          width: 26, height: 26, borderRadius: 5,
          background: '#fff', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <MiniQR seed={table.slug} />
        </div>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--text)' }}>{table.label}</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: dotColor }} />
            {table.orders > 0 ? `${table.orders} sipariş bugün` : 'Boş'}
          </span>
        </span>
        <span style={{ ...S.mono, fontSize: 10, color: 'var(--text-4)', marginRight: hov || active || menuOpen ? 28 : 0 }}>/{table.slug}</span>
      </button>
      {(hov || active || menuOpen) && (
        <button
          type="button"
          aria-label={`${table.label} seçenekleri`}
          disabled={busy}
          onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
          style={{
            position: 'absolute', top: 7, right: 6,
            width: 24, height: 24, border: '1px solid var(--border)',
            borderRadius: 6, background: 'var(--surface)', color: 'var(--text-2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          {React.cloneElement(QRI.more as React.ReactElement<{ size?: number }>, { size: 13 })}
        </button>
      )}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 4 }} />
          <div style={{
            position: 'absolute', top: 34, right: 4, zIndex: 5,
            minWidth: 160, padding: 4,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-pop)',
          }}>
            <button
              type="button"
              onClick={() => { setMenuOpen(false); setEditing(true); setError(null) }}
              style={{
                width: '100%', border: 'none', background: 'transparent',
                borderRadius: 5, padding: '7px 9px', textAlign: 'left',
                fontSize: 12, color: 'var(--text)', cursor: 'pointer',
              }}
            >
              Yeniden adlandır
            </button>
            <button
              type="button"
              onClick={() => void commitDelete()}
              style={{
                width: '100%', border: 'none', background: 'transparent',
                borderRadius: 5, padding: '7px 9px', textAlign: 'left',
                fontSize: 12, color: deleteDisabled ? 'var(--text-4)' : 'var(--critical)',
                cursor: deleteDisabled ? 'default' : 'pointer',
              }}
              title={deleteDisabled ? 'Açık adisyonu olan masa silinemez' : undefined}
            >
              Sil
            </button>
          </div>
        </>
      )}
      {error && <div style={{ margin: '3px 6px 4px 36px', fontSize: 11, color: 'var(--critical)' }}>{error}</div>}
    </div>
  )
}

/* ─── TablesNav ─────────────────────────────────────────────── */
function sessionDuration(openedAt: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(openedAt).getTime()) / 60_000))
  if (mins < 60) return `${mins}dk`
  return `${Math.floor(mins / 60)}s ${mins % 60}dk`
}

function TablesNav({ tables, setTables, activeId, setActiveId, restaurantId, openSessions, onCloseSession, pendingRequests, onResolveRequest }: {
  tables: TableItem[]
  setTables: (t: TableItem[]) => void
  activeId: string
  setActiveId: (id: string) => void
  restaurantId: string
  openSessions: Record<string, OpenSessionInfo>
  onCloseSession: (session: OpenSessionInfo, label: string) => void
  pendingRequests: Record<string, string>
  onResolveRequest: (requestId: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const filteredTables = query.trim()
    ? tables.filter(t => t.label.toLocaleLowerCase('tr-TR').includes(query.trim().toLocaleLowerCase('tr-TR')) || t.slug.includes(query.trim()))
    : tables

  const addTable = async () => {
    const label = newLabel.trim()
    if (!label) return
    setSaving(true)
    setAddError(null)
    const fd = new FormData()
    fd.append('restaurantId', restaurantId)
    fd.append('label', label)
    const result = await createTable(undefined, fd)
    setSaving(false)
    if ('error' in result) {
      setAddError(result.error)
      return
    }
    const idx = tables.length
    const nextTable = {
      id: result.id,
      label,
      slug: deriveSlug(label, idx),
      orders: 0,
      status: 'idle',
    } satisfies TableItem
    setTables([...tables, nextTable])
    setActiveId(nextTable.id)
    setNewLabel('')
    setAdding(false)
  }

  const handleRename = async (table: TableItem, label: string): Promise<string | null> => {
    const result = await renameTable({ restaurantId, tableId: table.id, label })
    if ('error' in result) return result.error
    const idx = tables.findIndex(t => t.id === table.id)
    setTables(tables.map((t, i) => t.id === table.id
      ? { ...t, label, slug: deriveSlug(label, i >= 0 ? i : idx) }
      : t,
    ))
    return null
  }

  const handleDelete = async (table: TableItem): Promise<string | null> => {
    const result = await deleteTable({ restaurantId, tableId: table.id })
    if ('error' in result) return result.error
    const nextTables = tables.filter(t => t.id !== table.id)
    setTables(nextTables)
    if (activeId === table.id) setActiveId(nextTables[0]?.id ?? '')
    return null
  }

  return (
    <div className="tb-tables__nav" style={{
      width: 'var(--nav)', flexShrink: 0,
      borderRight: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-.01em', flex: 1 }}>Masalar</div>
          <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)' }}>{tables.length}</span>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          {Object.keys(openSessions).length} aktif · Tek stil
        </div>
      </div>

      <div style={{ padding: '10px 12px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          height: 30, padding: '0 10px',
          background: 'var(--surface-3)', borderRadius: 7,
          color: 'var(--text-3)',
        }}>
          {React.cloneElement(I.search as React.ReactElement<{ size?: number }>, { size: 13 })}
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Masa ara"
            style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 12.5, color: 'var(--text)',
          }} />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px 12px' }}>
        <div style={{ ...S.label, padding: '6px 8px 6px' }}>Tüm masalar</div>
        {filteredTables.length === 0 && (
          <div style={{
            margin: '8px 4px 12px', padding: '18px 12px',
            border: '1px dashed var(--border-strong)', borderRadius: 9,
            textAlign: 'center', color: 'var(--text-3)', background: 'var(--surface-2)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>
              {tables.length === 0 ? 'Henüz masa yok' : 'Eşleşen masa yok'}
            </div>
            <div style={{ fontSize: 11.5, marginTop: 4 }}>
              {tables.length === 0 ? 'İlk QR masasını ekleyerek başlayın.' : 'Aramayı temizleyin ya da yeni masa ekleyin.'}
            </div>
          </div>
        )}
        {filteredTables.map(t => {
          const session = openSessions[t.id]
          const pendingRequestId = pendingRequests[t.id]
          const rowTable: TableItem = session
            ? { ...t, status: 'active', orders: session.orderCount }
            : { ...t, status: 'idle', orders: 0 }
          return (
            <div key={t.id}>
              <TableRow
                table={rowTable}
                active={activeId === t.id}
                onClick={() => setActiveId(t.id)}
                onRename={(label) => handleRename(t, label)}
                onDelete={() => handleDelete(t)}
                deleteDisabled={Boolean(session)}
              />
              {pendingRequestId && (
                <div style={{
                  margin: '0 4px 4px 28px', padding: '5px 8px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,159,64,.14)', borderRadius: 6,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#b8690f', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {I.bellSmall}Garson çağrısı
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onResolveRequest(pendingRequestId) }}
                    style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
                      border: '1px solid #d98324', borderRadius: 5,
                      background: 'var(--surface)', color: '#b8690f',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >Çağrıyı kapat</button>
                </div>
              )}
              {session && (
                <div style={{
                  margin: '0 4px 4px 28px', padding: '5px 8px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'var(--positive-bg)', borderRadius: 6,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--positive)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    ₺{session.total.toLocaleString('tr-TR')} · {sessionDuration(session.openedAt)}
                    {session.unpaidTotal > 0 && ` · ₺${session.unpaidTotal.toLocaleString('tr-TR')} açık`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCloseSession(session, t.label) }}
                    style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 8px',
                      border: '1px solid var(--positive)', borderRadius: 5,
                      background: 'var(--surface)', color: 'var(--positive)',
                      cursor: 'pointer', flexShrink: 0,
                    }}
                  >Kapat</button>
                </div>
              )}
            </div>
          )
        })}

        {adding ? (
          <div style={{
            margin: '8px 4px 4px', padding: 8,
            border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-2)',
          }}>
            <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTable(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="örn. Masa 11"
              style={{
                width: '100%', height: 28, padding: '0 8px', marginBottom: 6,
                border: '1px solid var(--border-strong)', borderRadius: 6,
                outline: 'none', fontSize: 12.5,
              }} />
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={addTable} disabled={saving} style={{ ...btnPrimary(), height: 26, fontSize: 11.5, padding: '0 10px', flex: 1, opacity: saving ? 0.6 : 1 }}>{saving ? <><InlineSpinner size={11} color="var(--on-action)" /> Kaydediliyor…</> : 'Ekle'}</button>
              <button onClick={() => { setAdding(false); setNewLabel(''); setAddError(null) }} style={{ ...btnGhost(), height: 26, fontSize: 11.5, padding: '0 10px' }}>İptal</button>
            </div>
            {addError && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--critical)' }}>{addError}</div>}
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 10px', marginTop: 8,
            border: '1px dashed var(--border-strong)', background: 'transparent',
            color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer',
            fontSize: 12.5, fontWeight: 500,
          }}>
            {React.cloneElement(I.plus as React.ReactElement<{ size?: number }>, { size: 13 })}Masa ekle
          </button>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--divider)', padding: '10px 14px', background: 'var(--surface-2)', fontSize: 11.5, color: 'var(--text-3)' }}>
        PNG/SVG indirme seçili masa üzerinden yapılır; toplu PDF export ayrı bir iş olarak duruyor.
      </div>
    </div>
  )
}

/* ─── QR utility fns ────────────────────────────────────────── */
function colorOpts(qr: QRConfig): object {
  if (qr.colorType === 'single') return { color: qr.fg }
  if (qr.gradType === 'linear') {
    return {
      gradient: {
        type: 'linear',
        rotation: (qr.gradAngle * Math.PI) / 180,
        colorStops: [{ offset: 0, color: qr.fg }, { offset: 1, color: qr.fg2 }],
      },
    }
  }
  return {
    gradient: {
      type: 'radial',
      colorStops: [{ offset: 0, color: qr.fg }, { offset: 1, color: qr.fg2 }],
    },
  }
}

const MENU_BASE = process.env.NEXT_PUBLIC_MENU_BASE_URL ?? 'https://menu.garsonless.app'
const MENU_PROTOCOL = MENU_BASE.startsWith('http://') ? 'http' : 'https'

function buildUrl(qr: QRConfig, table?: TableItem): string {
  const base = qr.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const tableId = table?.id && table.id !== 'placeholder' ? table.id : 'preview'
  const params: string[] = []
  if (qr.utmSource) params.push(`utm_source=${qr.utmSource}`)
  if (qr.utmMedium) params.push(`utm_medium=${qr.utmMedium}`)
  if (qr.utmCampaign) params.push(`utm_campaign=${qr.utmCampaign}`)
  const q = params.length ? '?' + params.join('&') : ''
  return `${MENU_PROTOCOL}://${base}/table/${tableId}${q}`
}

/* ─── QR Frame ──────────────────────────────────────────────── */
function Frame({ qr, table, children }: { qr: QRConfig; table?: TableItem; children: React.ReactNode }) {
  const fg = qr.frameColor

  if (qr.frame === 'none') {
    return <div style={{ background: '#fff', padding: 16, borderRadius: 12, boxShadow: 'var(--shadow-2)' }}>{children}</div>
  }
  if (qr.frame === 'card') {
    return (
      <div style={{
        background: '#fff', padding: '28px 28px 22px', borderRadius: 16,
        border: `2px solid ${fg}`, boxShadow: 'var(--shadow-2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'min(360px, calc(100vw - 56px))',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>{table?.label}</div>
        <div style={{ marginBottom: 14 }}>{children}</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: fg, letterSpacing: '-.01em' }}>{qr.frameTitle}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 3, textAlign: 'center', maxWidth: 280 }}>{qr.frameSubtitle}</div>
      </div>
    )
  }
  if (qr.frame === 'banner') {
    return (
      <div style={{
        background: fg, padding: '22px 22px 18px', borderRadius: 16,
        boxShadow: 'var(--shadow-2)', width: 'min(360px, calc(100vw - 56px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', opacity: .7, marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>{table?.label}</div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 14, letterSpacing: '-.01em' }}>{qr.frameTitle}</div>
        <div style={{ fontSize: 11.5, color: '#fff', opacity: .7, marginTop: 4, textAlign: 'center', maxWidth: 280 }}>{qr.frameSubtitle}</div>
      </div>
    )
  }
  if (qr.frame === 'speech') {
    return (
      <div style={{ position: 'relative', width: 'min(360px, calc(100vw - 56px))' }}>
        <div style={{
          background: '#fff', padding: '24px', borderRadius: 18,
          border: `2px solid ${fg}`, display: 'flex', flexDirection: 'column', alignItems: 'center',
          boxShadow: 'var(--shadow-2)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 10, letterSpacing: '.04em', textTransform: 'uppercase' }}>{table?.label}</div>
          <div>{children}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: fg, marginTop: 14, letterSpacing: '-.01em' }}>{qr.frameTitle}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 3, textAlign: 'center' }}>{qr.frameSubtitle}</div>
        </div>
        <svg width="40" height="22" viewBox="0 0 40 22" style={{ position: 'absolute', left: '50%', bottom: -20, transform: 'translateX(-50%)', display: 'block' }}>
          <path d="M0 0 H40 L22 20 Q20 22 18 20 Z" fill="#fff" />
          <path d="M0 0 L18 20 Q20 22 22 20 L40 0" stroke={fg} strokeWidth="2" fill="none" />
        </svg>
      </div>
    )
  }
  if (qr.frame === 'phone') {
    return (
      <div style={{ width: 'min(320px, calc(100vw - 56px))', padding: 12, background: '#0b0b0d', borderRadius: 36, boxShadow: 'var(--shadow-2)' }}>
        <div style={{
          background: '#fff', borderRadius: 26, padding: '24px 22px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{ width: 80, height: 4, background: '#e7e7ea', borderRadius: 4, marginBottom: 16 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: fg, marginBottom: 8, letterSpacing: '.04em', textTransform: 'uppercase' }}>{table?.label}</div>
          <div style={{ marginBottom: 12 }}>{children}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: fg, letterSpacing: '-.01em' }}>{qr.frameTitle}</div>
          <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3, textAlign: 'center', maxWidth: 240 }}>{qr.frameSubtitle}</div>
        </div>
      </div>
    )
  }
  return <>{children}</>
}

/* ─── DownloadMenu ──────────────────────────────────────────── */
function DownloadMenu({ onPick, disabled = false }: { onPick: (fmt: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(!open) }}
        style={{ ...btnPrimary(), borderRadius: '0 7px 7px 0', padding: '0 8px', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        {React.cloneElement(I.chevDown as React.ReactElement<{ size?: number }>, { size: 14 })}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 5 }} />
          <div style={{
            position: 'absolute', right: 0, top: '110%',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow-pop)', padding: 4,
            minWidth: 160, zIndex: 6,
          }}>
            {[
              { fmt: 'png',  label: 'PNG',      hint: 'Web için' },
              { fmt: 'svg',  label: 'SVG',      hint: 'Vektör' },
              { fmt: 'jpeg', label: 'JPG',      hint: 'Düşük boyut' },
              { fmt: 'pdf',  label: 'PDF · A4', hint: 'Yazdırılabilir', disabled: true },
            ].map(o => (
              <button key={o.fmt}
                onClick={() => { if (!o.disabled) { onPick(o.fmt); setOpen(false) } }}
                disabled={o.disabled}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '7px 10px', border: 'none', background: 'transparent',
                  borderRadius: 5, cursor: o.disabled ? 'default' : 'pointer', textAlign: 'left',
                  color: o.disabled ? 'var(--text-4)' : 'var(--text)', fontSize: 12.5,
                }}>
                <span style={{ fontWeight: 500 }}>{o.label}</span>
                <span style={{ fontSize: 11, color: o.disabled ? 'var(--text-4)' : 'var(--text-3)' }}>{o.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ─── GridCard ──────────────────────────────────────────────── */
function GridCard({ qr, table }: { qr: QRConfig; table: TableItem }) {
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!hostRef.current) return
    let cancelled = false
    const run = async () => {
      const QRCodeStyling = await loadQRCodeStyling()
      if (cancelled || !hostRef.current) return
      const inst = new QRCodeStyling({
        width: 180, height: 180, type: 'svg', margin: qr.margin / 2,
        data: buildUrl(qr, table),
        qrOptions: { errorCorrectionLevel: qr.ecl as 'L' | 'M' | 'Q' | 'H' },
        image: qr.logo ?? undefined,
        imageOptions: { hideBackgroundDots: qr.logoHideBg, imageSize: qr.logoSize, margin: qr.logoMargin / 2, crossOrigin: 'anonymous' },
        dotsOptions: { type: qr.dotsType as any, ...colorOpts(qr) as object },
        cornersSquareOptions: { type: qr.eyeFrame as any, color: qr.fg },
        cornersDotOptions: { type: qr.eyeBall as any, color: qr.fg },
        backgroundOptions: { color: qr.bgTransparent ? 'transparent' : qr.bg },
      })
      if (hostRef.current) {
        hostRef.current.innerHTML = ''
        inst.append(hostRef.current)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [qr, table])
  return (
    <div style={{
      background: '#fff', borderRadius: 12, border: '1px solid var(--border)',
      padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      boxShadow: 'var(--shadow-1)',
    }}>
      <div ref={hostRef} style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
      <div style={{ fontSize: 13, fontWeight: 600 }}>{table.label}</div>
      <div style={{ ...S.mono, fontSize: 10.5, color: 'var(--text-3)' }}>/masa-{table.slug}</div>
    </div>
  )
}

/* ─── QRCanvas ──────────────────────────────────────────────── */
function QRCanvas({ qr, table, tables, qrInstanceRef }: {
  qr: QRConfig
  table?: TableItem
  tables: TableItem[]
  qrInstanceRef: React.RefObject<unknown>
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<'preview' | 'grid' | 'print'>('preview')
  const PREVIEW_SIZE = 280

  useEffect(() => {
    if (!hostRef.current) return
    let cancelled = false
    const run = async () => {
      const QRCodeStyling = await loadQRCodeStyling()
      if (cancelled || !hostRef.current) return
      const url = buildUrl(qr, table)
      const cfg = {
        width: PREVIEW_SIZE, height: PREVIEW_SIZE,
        type: 'svg' as const,
        data: url,
        margin: Math.round(qr.margin * PREVIEW_SIZE / 600),
        qrOptions: { errorCorrectionLevel: qr.ecl as 'L' | 'M' | 'Q' | 'H' },
        image: qr.logo ?? undefined,
        imageOptions: {
          hideBackgroundDots: qr.logoHideBg,
          imageSize: qr.logoSize,
          margin: Math.round(qr.logoMargin * PREVIEW_SIZE / 600),
          crossOrigin: 'anonymous' as const,
        },
        dotsOptions: { type: qr.dotsType as any, ...colorOpts(qr) as object },
        cornersSquareOptions: { type: qr.eyeFrame as any, color: qr.fg },
        cornersDotOptions: { type: qr.eyeBall as any, color: qr.fg },
        backgroundOptions: { color: qr.bgTransparent ? 'transparent' : qr.bg },
      };
      (qrInstanceRef as React.MutableRefObject<unknown>).current = new QRCodeStyling(cfg)
      if (hostRef.current) {
        hostRef.current.innerHTML = ''
        ;(qrInstanceRef as React.MutableRefObject<{ append: (el: HTMLElement) => void }>).current.append(hostRef.current)
      }
    }
    void run()
    return () => { cancelled = true }
  }, [qr, qrInstanceRef, table, view])

  const download = useCallback(async (ext: string) => {
    const QRCodeStyling = await loadQRCodeStyling()
    const exportInst = new QRCodeStyling({
      width: qr.size, height: qr.size, type: ext === 'svg' ? 'svg' : 'canvas',
      data: buildUrl(qr, table), margin: qr.margin,
      qrOptions: { errorCorrectionLevel: qr.ecl as 'L' | 'M' | 'Q' | 'H' },
      image: qr.logo ?? undefined,
      imageOptions: { hideBackgroundDots: qr.logoHideBg, imageSize: qr.logoSize, margin: qr.logoMargin, crossOrigin: 'anonymous' },
      dotsOptions: { type: qr.dotsType as any, ...colorOpts(qr) as object },
      cornersSquareOptions: { type: qr.eyeFrame as any, color: qr.fg },
      cornersDotOptions: { type: qr.eyeBall as any, color: qr.fg },
      backgroundOptions: { color: qr.bgTransparent ? 'transparent' : qr.bg },
    })
    exportInst.download({ name: `garsonless-${table?.slug || 'qr'}`, extension: ext as 'png' | 'svg' | 'jpeg' | 'webp' })
  }, [qr, table])

  const url = buildUrl(qr, table)

  return (
    <div className="tb-tables__canvas" style={{
      flex: 1, minWidth: 0,
      background: 'var(--bg)',
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.07) 1px, transparent 0)',
      backgroundSize: '20px 20px',
      display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    }}>
      {/* Canvas toolbar */}
      <div className="tb-tables__canvas-toolbar" style={{
        height: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,.7)', backdropFilter: 'blur(8px)',
      }}>
        <div className="tb-tables__canvas-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-2)', minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>{table?.label ?? 'Masa seçin'}</span>
          <span style={{ color: 'var(--text-4)' }}>·</span>
          <span style={{ ...S.mono, fontSize: 11.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
            {url}
          </span>
          <button style={{
            marginLeft: 2, padding: '3px 7px', border: '1px solid var(--border)', background: 'var(--surface)',
            borderRadius: 5, color: 'var(--text-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11,
          }} onClick={() => navigator.clipboard?.writeText(url)}>
            {React.cloneElement(I.copy as React.ReactElement<{ size?: number }>, { size: 11 })}Kopyala
          </button>
          <button style={{
            padding: '3px 7px', border: '1px solid var(--border)', background: 'var(--surface)',
            borderRadius: 5, color: 'var(--text-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11,
          }} onClick={() => window.open(url, '_blank', 'noopener')}>
            {React.cloneElement(QRI.scan as React.ReactElement<{ size?: number }>, { size: 11 })}Önizle
          </button>
        </div>

        <div className="tb-tables__canvas-toolbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            background: 'var(--surface-3)', borderRadius: 7, padding: 3,
          }}>
            {([
              { id: 'preview', label: 'Tek',    icon: QRI.qr },
              { id: 'grid',    label: 'Izgara', icon: I.layout },
              { id: 'print',   label: 'Baskı',  icon: QRI.print },
            ] as const).map(v => (
              <button key={v.id} onClick={() => setView(v.id as typeof view)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px',
                fontSize: 11.5, fontWeight: 500, borderRadius: 5, border: 'none',
                background: view === v.id ? 'var(--surface)' : 'transparent',
                color: view === v.id ? 'var(--text)' : 'var(--text-2)',
                boxShadow: view === v.id ? 'var(--shadow-1)' : 'none',
                cursor: 'pointer',
              }}>
                {React.cloneElement(v.icon as React.ReactElement<{ size?: number }>, { size: 12 })}{v.label}
              </button>
            ))}
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ display: 'inline-flex' }}>
            <button
              onClick={() => { if (table) void download('png') }}
              disabled={!table}
              style={{ ...btnPrimary(), borderRadius: '7px 0 0 7px', borderRight: '1px solid rgba(255,255,255,.15)', paddingRight: 10, opacity: table ? 1 : 0.45, cursor: table ? 'pointer' : 'not-allowed' }}
            >
              {React.cloneElement(QRI.download as React.ReactElement<{ size?: number }>, { size: 13 })}İndir PNG
            </button>
            <DownloadMenu onPick={download} disabled={!table} />
          </div>
        </div>
      </div>

      {/* Canvas body */}
      {view === 'preview' && !table && tables.length === 0 && (
        <div className="tb-tables__canvas-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'auto' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Henüz masa yok</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>QR önizlemesi için sol panelden masa ekleyin.</div>
          </div>
        </div>
      )}
      {view === 'preview' && (table || tables.length > 0) && (
        <div className="tb-tables__canvas-body" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, overflow: 'auto' }}>
          <Frame qr={qr} table={table}>
            <div ref={hostRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
          </Frame>
        </div>
      )}
      {view === 'grid' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 32 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Tüm masalar</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Aynı stil, farklı bağlantılar — {tables.length} QR</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => window.print()} style={btnGhost()}>
                  {React.cloneElement(QRI.print as React.ReactElement<{ size?: number }>, { size: 13 })}Yazdır
                </button>
                <button style={{ ...btnPrimary(), opacity: 0.5, cursor: 'not-allowed' }} title="Yakında">
                  {React.cloneElement(QRI.download as React.ReactElement<{ size?: number }>, { size: 13 })}Tümünü indir (.zip)
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
              {tables.map(t => <GridCard key={t.id} qr={qr} table={t} />)}
            </div>
          </div>
        </div>
      )}
      {view === 'print' && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 32, overflow: 'auto' }}>
          <div style={{
            width: 595 * .8, background: '#fff',
            boxShadow: 'var(--shadow-2)', borderRadius: 4, padding: 50,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', alignSelf: 'flex-start', letterSpacing: '.06em', textTransform: 'uppercase' }}>garsonless · A4</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 30, color: qr.frameColor, letterSpacing: '-.02em' }}>{qr.frameTitle}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{qr.frameSubtitle}</div>
            <div style={{ marginTop: 30 }}>
              <Frame qr={qr} table={table}><div ref={hostRef} /></Frame>
            </div>
            <div style={{ marginTop: 40, fontSize: 10, ...S.mono, color: 'var(--text-3)' }}>{url}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── QRProps shared primitives ─────────────────────────────── */
function Group({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--divider)' }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '11px 16px', border: 'none', background: 'transparent',
        cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        <span style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}>
          {React.cloneElement(I.chevDown as React.ReactElement<{ size?: number }>, { size: 14 })}
        </span>
      </button>
      {open && <div style={{ padding: '2px 16px 14px' }}>{children}</div>}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: 10, padding: '5px 0' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</div>
        {hint && <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function Slider({ value, min, max, step = 1, onChange, suffix }: {
  value: number; min: number; max: number; step?: number; onChange: (v: number) => void; suffix?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--action)' }} />
      <span style={{ ...S.mono, fontSize: 11.5, color: 'var(--text-2)', minWidth: 36, textAlign: 'right' }}>{value}{suffix}</span>
    </div>
  )
}

function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 7, padding: 3, width: '100%' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, height: 26, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11.5, fontWeight: 500,
          background: value === o.value ? 'var(--surface)' : 'transparent',
          color: value === o.value ? 'var(--text)' : 'var(--text-2)',
          boxShadow: value === o.value ? 'var(--shadow-1)' : 'none',
          transition: 'all 100ms',
        }}>{o.label}</button>
      ))}
    </div>
  )
}

function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <label style={{ position: 'relative', cursor: 'pointer' }}>
        <div style={{
          width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border-strong)',
          background: value, flexShrink: 0,
        }} />
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
      </label>
      <input value={value} onChange={e => onChange(e.target.value)}
        style={{
          flex: 1, height: 28, padding: '0 8px', border: '1px solid var(--border)',
          borderRadius: 6, fontSize: 12.5, ...S.mono, background: 'var(--surface-2)',
          color: 'var(--text)', outline: 'none',
        }} />
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      position: 'relative', width: 32, height: 18, border: 'none', cursor: 'pointer', padding: 0,
      borderRadius: 9, background: on ? 'var(--action)' : 'var(--surface-inset)', transition: 'background 150ms',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 14 : 2, width: 14, height: 14,
        borderRadius: 7, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        transition: 'left 150ms',
      }} />
    </button>
  )
}

function TextInput({ value, onChange, placeholder, prefix }: {
  value: string; onChange: (v: string) => void; placeholder?: string; prefix?: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-2)' }}>
      {prefix && <span style={{ color: 'var(--text-3)' }}>{prefix}</span>}
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--text)' }} />
    </div>
  )
}

function Swatches({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          width: 22, height: 22, borderRadius: 4, background: c, border: '2px solid ' + (value === c ? 'var(--text)' : 'transparent'),
          cursor: 'pointer', padding: 0,
        }} />
      ))}
    </div>
  )
}

/* ─── StylePicker (3-column grid for dot/eye style) ─────────── */
function StylePicker({ value, onChange, options, renderPreview }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  renderPreview: (v: string) => React.ReactNode
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          padding: '10px 6px 8px',
          background: value === o.value ? 'var(--surface)' : 'var(--surface-2)',
          border: '1px solid ' + (value === o.value ? 'var(--text)' : 'var(--border)'),
          borderRadius: 8, cursor: 'pointer',
          boxShadow: value === o.value ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
        }}>
          <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderPreview(o.value)}
          </div>
          <span style={{ fontSize: 11, fontWeight: 500, color: value === o.value ? 'var(--text)' : 'var(--text-2)' }}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function DotPreview({ kind }: { kind: string }) {
  const cells = [[1,1,0,1],[1,0,1,1],[0,1,1,0],[1,1,0,1]]
  const size = 8, gap = 1.2
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {cells.flatMap((row, y) => row.map((v, x) => {
        if (!v) return null
        const cx = 4 + x * (size + gap) + size / 2
        const cy = 4 + y * (size + gap) + size / 2
        if (kind === 'dots') return <circle key={`${x}-${y}`} cx={cx} cy={cy} r={size/2 - 0.4} fill="#111113" />
        if (kind === 'rounded') return <rect key={`${x}-${y}`} x={cx-size/2} y={cy-size/2} width={size} height={size} rx="2" fill="#111113" />
        if (kind === 'extra-rounded') return <rect key={`${x}-${y}`} x={cx-size/2} y={cy-size/2} width={size} height={size} rx="3.5" fill="#111113" />
        if (kind === 'classy') return <path key={`${x}-${y}`} d={`M${cx-size/2} ${cy-size/2}h${size}v${size}h-${size/2}a${size/2} ${size/2} 0 0 1-${size/2} -${size/2}Z`} fill="#111113" />
        if (kind === 'classy-rounded') return <path key={`${x}-${y}`} d={`M${cx-size/2+2} ${cy-size/2}h${size-2}q2 0 2 2v${size-2}h-${size-2}q-2 0-2-2Z`} fill="#111113" />
        return <rect key={`${x}-${y}`} x={cx-size/2} y={cy-size/2} width={size} height={size} fill="#111113" />
      }))}
    </svg>
  )
}

function EyeFramePreview({ kind }: { kind: string }) {
  const rx = kind === 'extra-rounded' ? 8 : kind === 'dot' ? 18 : 0
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      <rect x="3" y="3" width="34" height="34" rx={rx} fill="none" stroke="#111113" strokeWidth="6" />
    </svg>
  )
}

function EyeBallPreview({ kind }: { kind: string }) {
  if (kind === 'dot') return <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="11" fill="#111113" /></svg>
  return <svg width="40" height="40" viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" fill="#111113" /></svg>
}

function FramePreview({ kind }: { kind: string }) {
  if (kind === 'none') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="14" y="6" width="16" height="20" fill="#cbcdd3" rx="2" /></svg>
  if (kind === 'card') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="6" y="3" width="32" height="26" fill="#fff" stroke="#111113" strokeWidth="1.4" rx="3" /><rect x="14" y="7" width="16" height="16" fill="#111113" rx="1" /></svg>
  if (kind === 'banner') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="3" y="3" width="38" height="26" fill="#111113" rx="3" /><rect x="14" y="6" width="16" height="16" fill="#fff" rx="1" /><rect x="11" y="24" width="22" height="2.5" fill="#fff" rx="1" /></svg>
  if (kind === 'speech') return <svg width="44" height="32" viewBox="0 0 44 32"><path d="M5 5h34v18H26l-3 4-3-4H5z" fill="#fff" stroke="#111113" strokeWidth="1.4" /><rect x="14" y="8" width="16" height="12" fill="#111113" rx="1" /></svg>
  if (kind === 'phone') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="14" y="2" width="16" height="28" fill="#fff" stroke="#111113" strokeWidth="1.4" rx="3" /><rect x="17" y="7" width="10" height="10" fill="#111113" rx="1" /><circle cx="22" cy="26" r="1.2" fill="#111113" /></svg>
  return null
}

/* ─── QRProps tabs ──────────────────────────────────────────── */
function ShapeTab({ qr, set }: { qr: QRConfig; set: (k: string, v: unknown) => void }) {
  return (
    <>
      <Group title="Modül şekli" defaultOpen>
        <StylePicker value={qr.dotsType} onChange={v => set('dotsType', v)}
          options={DOT_STYLES} renderPreview={k => <DotPreview kind={k} />} />
      </Group>
      <Group title="Göz çerçevesi">
        <StylePicker value={qr.eyeFrame} onChange={v => set('eyeFrame', v)}
          options={EYE_FRAME_STYLES} renderPreview={k => <EyeFramePreview kind={k} />} />
      </Group>
      <Group title="Göz merkezi">
        <StylePicker value={qr.eyeBall} onChange={v => set('eyeBall', v)}
          options={EYE_BALL_STYLES} renderPreview={k => <EyeBallPreview kind={k} />} />
      </Group>
      <Group title="Genel" defaultOpen={false}>
        <Field label="Boyut"><Slider value={qr.size} min={200} max={1200} step={50} onChange={v => set('size', v)} suffix="px" /></Field>
        <Field label="Kenar boşluğu"><Slider value={qr.margin} min={0} max={40} onChange={v => set('margin', v)} suffix="px" /></Field>
        <Field label="Hata düzeltme" hint="Logo varsa H önerilir">
          <Segmented value={qr.ecl} onChange={v => set('ecl', v)} options={[
            { value: 'L', label: 'L · %7' },
            { value: 'M', label: 'M · %15' },
            { value: 'Q', label: 'Q · %25' },
            { value: 'H', label: 'H · %30' },
          ]} />
        </Field>
      </Group>
    </>
  )
}

function ColorTab({ qr, set }: { qr: QRConfig; set: (k: string, v: unknown) => void }) {
  return (
    <>
      <Group title="Renk türü">
        <Segmented value={qr.colorType} onChange={v => set('colorType', v)} options={[
          { value: 'single', label: 'Tek' },
          { value: 'gradient', label: 'Gradyan' },
        ]} />
      </Group>
      <Group title="Ön plan">
        <Field label="Renk 1"><ColorField value={qr.fg} onChange={v => set('fg', v)} /></Field>
        {qr.colorType === 'gradient' && <>
          <Field label="Renk 2"><ColorField value={qr.fg2} onChange={v => set('fg2', v)} /></Field>
          <Field label="Tip">
            <Segmented value={qr.gradType} onChange={v => set('gradType', v)} options={[
              { value: 'linear', label: 'Doğrusal' },
              { value: 'radial', label: 'Dairesel' },
            ]} />
          </Field>
          {qr.gradType === 'linear' && (
            <Field label="Açı"><Slider value={qr.gradAngle} min={0} max={360} step={15} onChange={v => set('gradAngle', v)} suffix="°" /></Field>
          )}
        </>}
        <div style={{ marginTop: 4 }}>
          <Swatches value={qr.fg} onChange={v => set('fg', v)} options={['#111113', '#a13b7a', '#2f6f4e', '#b8551c', '#1f4e8f', '#0e0e10']} />
        </div>
      </Group>
      <Group title="Arka plan">
        <Field label="Renk"><ColorField value={qr.bg} onChange={v => set('bg', v)} /></Field>
        <Field label="Şeffaf"><Toggle on={qr.bgTransparent} onChange={v => set('bgTransparent', v)} /></Field>
        <div style={{ marginTop: 4 }}>
          <Swatches value={qr.bg} onChange={v => set('bg', v)} options={['#ffffff', '#fdf6ec', '#eaf3ed', '#fff6ef', '#f3f3f5', '#e7eef8']} />
        </div>
      </Group>
    </>
  )
}

// Keep the stored logo small — it rides inside restaurants.settings (read on
// every dashboard SSR + the public menu). Raster logos are downscaled to a
// 256px PNG; the result + any SVG is capped to match the server's 256KB limit.
const MAX_LOGO_CHARS = 262_144

function LogoTab({ qr, set }: { qr: QRConfig; set: (k: string, v: unknown) => void }) {
  const [logoError, setLogoError] = useState<string | null>(null)
  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result) return
      // SVG stays vector — just enforce the size cap.
      if (file.type === 'image/svg+xml') {
        if (result.length > MAX_LOGO_CHARS) { setLogoError('Logo çok büyük (en fazla ~256 KB). Daha küçük bir dosya seçin.'); return }
        set('logo', result)
        return
      }
      // Raster → downscale to <=256px PNG so the persisted payload stays tiny.
      const img = new Image()
      img.onload = () => {
        const max = 256
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { setLogoError('Görsel işlenemedi.'); return }
        ctx.drawImage(img, 0, 0, w, h)
        const out = canvas.toDataURL('image/png')
        if (out.length > MAX_LOGO_CHARS) { setLogoError('Logo çok büyük. Daha küçük/yalın bir görsel deneyin.'); return }
        set('logo', out)
      }
      img.onerror = () => setLogoError('Görsel okunamadı.')
      img.src = result
    }
    reader.readAsDataURL(file)
  }
  return (
    <>
      <Group title="Marka logosu">
        <div style={{
          border: '1.5px dashed var(--border-strong)', borderRadius: 10,
          padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          background: 'var(--surface-2)',
        }}>
          {qr.logo ? (
            <div style={{
              width: 80, height: 80, borderRadius: 12, overflow: 'hidden',
              background: '#fff', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src={qr.logo} style={{ maxWidth: '100%', maxHeight: '100%' }} alt="" />
            </div>
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: 12,
              background: 'var(--surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-3)',
            }}>
              {React.cloneElement(QRI.upload as React.ReactElement<{ size?: number }>, { size: 22 })}
            </div>
          )}
          <label style={{ ...btnGhost(), cursor: 'pointer', height: 28, fontSize: 12 }}>
            {qr.logo ? 'Değiştir' : 'Logo yükle'}
            <input type="file" accept="image/*" onChange={onUpload} style={{ display: 'none' }} />
          </label>
          {qr.logo && (
            <button onClick={() => set('logo', null)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 11.5, color: 'var(--critical)', padding: '2px 6px',
            }}>Logoyu kaldır</button>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--text-3)', textAlign: 'center', maxWidth: 200 }}>
            PNG veya SVG, en az 200×200 px
          </div>
          {logoError && (
            <div style={{ fontSize: 11, color: 'var(--critical)', textAlign: 'center', maxWidth: 200 }}>{logoError}</div>
          )}
        </div>
      </Group>
      <Group title="Yerleşim">
        <Field label="Boyut"><Slider value={Math.round(qr.logoSize * 100)} min={10} max={50} onChange={v => set('logoSize', v / 100)} suffix="%" /></Field>
        <Field label="Boşluk"><Slider value={qr.logoMargin} min={0} max={20} onChange={v => set('logoMargin', v)} suffix="px" /></Field>
        <Field label="Şeffaf arka"><Toggle on={!qr.logoHideBg} onChange={v => set('logoHideBg', !v)} /></Field>
      </Group>
    </>
  )
}

function FrameTab({ qr, set }: { qr: QRConfig; set: (k: string, v: unknown) => void }) {
  return (
    <>
      <Group title="Çerçeve stili" defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {FRAME_STYLES.map(f => (
            <button key={f.id} onClick={() => set('frame', f.id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '12px 6px 8px', cursor: 'pointer',
              background: qr.frame === f.id ? 'var(--surface)' : 'var(--surface-2)',
              border: '1px solid ' + (qr.frame === f.id ? 'var(--text)' : 'var(--border)'),
              borderRadius: 8,
              boxShadow: qr.frame === f.id ? '0 0 0 3px rgba(17,17,19,.06)' : 'none',
            }}>
              <FramePreview kind={f.id} />
              <span style={{ fontSize: 11, fontWeight: 500, color: qr.frame === f.id ? 'var(--text)' : 'var(--text-2)' }}>{f.label}</span>
            </button>
          ))}
        </div>
      </Group>
      <Group title="Etiket">
        <Field label="Başlık"><TextInput value={qr.frameTitle} onChange={v => set('frameTitle', v)} placeholder="Menüyü tara" /></Field>
        <Field label="Alt yazı"><TextInput value={qr.frameSubtitle} onChange={v => set('frameSubtitle', v)} placeholder="QR'ı telefon kameranızla okutun" /></Field>
        <Field label="Renk"><ColorField value={qr.frameColor} onChange={v => set('frameColor', v)} /></Field>
      </Group>
    </>
  )
}

function DataTab({ qr, set, tables }: { qr: QRConfig; set: (k: string, v: unknown) => void; tables: TableItem[] }) {
  return (
    <>
      <Group title="Bağlantı">
        <Field label="Temel URL" hint="Her masa için /masa-ID eklenir">
          <TextInput value={qr.baseUrl} onChange={v => set('baseUrl', v)} prefix={React.cloneElement(QRI.link2 as React.ReactElement<{ size?: number }>, { size: 13 })} />
        </Field>
        <div style={{
          marginTop: 6, padding: '8px 10px', background: 'var(--surface-2)',
          border: '1px solid var(--divider)', borderRadius: 6,
          fontSize: 11, color: 'var(--text-2)', ...S.mono,
        }}>
          Örnek: {qr.baseUrl}/masa-{tables[0]?.slug || '01'}
        </div>
      </Group>
      <Group title="UTM parametreleri" defaultOpen={false}>
        <Field label="Kaynak"><TextInput value={qr.utmSource} onChange={v => set('utmSource', v)} placeholder="qr" /></Field>
        <Field label="Medya"><TextInput value={qr.utmMedium} onChange={v => set('utmMedium', v)} placeholder="masa" /></Field>
        <Field label="Kampanya"><TextInput value={qr.utmCampaign} onChange={v => set('utmCampaign', v)} /></Field>
      </Group>
      <Group title="Davranış">
        <Field label="Otomatik dil"><Toggle on={qr.autoLang} onChange={v => set('autoLang', v)} /></Field>
        <Field label="Geri sayım"><Toggle on={qr.countdown} onChange={v => set('countdown', v)} /></Field>
      </Group>
    </>
  )
}

/* ─── QRProps panel ─────────────────────────────────────────── */
function QRProps({ qr, setQR, tables, saveState }: { qr: QRConfig; setQR: (q: QRConfig) => void; tables: TableItem[]; saveState: SaveState }) {
  const [tab, setTab] = useState('shape')
  const set = (k: string, v: unknown) => setQR({ ...qr, [k]: v })
  const status = saveState === 'saving'
    ? { label: 'Kaydediliyor', tone: 'neutral', dot: 'var(--warning)' }
    : saveState === 'error'
      ? { label: 'Sorun var', tone: 'neutral', dot: 'var(--critical)' }
      : { label: 'Senkronlu', tone: 'positive', dot: 'var(--positive)' }

  const tabs = [
    { id: 'shape', label: 'Şekil',   icon: QRI.qr },
    { id: 'color', label: 'Renk',    icon: QRI.paint },
    { id: 'logo',  label: 'Logo',    icon: I.image },
    { id: 'frame', label: 'Çerçeve', icon: QRI.frame },
    { id: 'data',  label: 'Veri',    icon: QRI.link2 },
  ]

  return (
    <div className="tb-tables__props" style={{
      width: 'var(--props)', flexShrink: 0,
      borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>QR Stüdyosu</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Tüm masalara uygulanır</div>
          </div>
          <Tag tone={status.tone}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: status.dot }} />
            {status.label}
          </Tag>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--divider)', padding: '0 8px', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '10px 10px', fontSize: 12, fontWeight: 500,
            border: 'none', background: 'transparent', flexShrink: 0,
            color: tab === t.id ? 'var(--text)' : 'var(--text-2)',
            borderBottom: '1.5px solid ' + (tab === t.id ? 'var(--text)' : 'transparent'),
            marginBottom: -1, cursor: 'pointer',
          }}>
            {React.cloneElement(t.icon as React.ReactElement<{ size?: number }>, { size: 13 })}{t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'shape' && <ShapeTab qr={qr} set={set} />}
        {tab === 'color' && <ColorTab qr={qr} set={set} />}
        {tab === 'logo'  && <LogoTab  qr={qr} set={set} />}
        {tab === 'frame' && <FrameTab qr={qr} set={set} />}
        {tab === 'data'  && <DataTab  qr={qr} set={set} tables={tables} />}
      </div>

      <div style={{
        borderTop: '1px solid var(--divider)', padding: '10px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--surface-2)',
      }}>
        <button onClick={() => setQR(defaultQR(qr.baseUrl))} style={{
          fontSize: 11.5, color: 'var(--text-2)', background: 'transparent',
          border: 'none', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2,
        }}>Stili sıfırla</button>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tables.length} masa</span>
      </div>
    </div>
  )
}

/* ─── StatusBar ─────────────────────────────────────────────── */
function StatusBar({ saveState, tableCount, activeCount }: { saveState: SaveState; tableCount: number; activeCount: number }) {
  const statusText = saveState === 'saving'
    ? 'Otomatik kayıt çalışıyor'
    : saveState === 'error'
      ? 'Otomatik kayıt başarısız'
      : 'Otomatik kayıt açık'
  return (
    <div className="tb-tables__statusbar" style={{
      height: 'var(--statusbar)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)',
      fontSize: 11.5, color: 'var(--text-3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          color: saveState === 'error' ? 'var(--critical)' : 'var(--text-3)',
          fontSize: 11.5,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: saveState === 'error' ? 'var(--critical)' : saveState === 'saving' ? 'var(--warning)' : 'var(--positive)',
          }} />
          {statusText}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, ...S.mono }}>
        <span>{tableCount} masa</span>
        <span style={{ color: 'var(--text-4)' }}>·</span>
        <span>{activeCount} aktif</span>
        <span style={{ color: 'var(--text-4)' }}>·</span>
        <span>tr-TR</span>
      </div>
    </div>
  )
}

/* ─── Root shell ────────────────────────────────────────────── */
export default function TablesBuilderShell({ restaurantId, restaurantName, restaurantSlug, initialTables, initialQRStyle }: Props) {
  const baseQRUrl = `${MENU_BASE.replace(/^https?:\/\//, '')}/${restaurantSlug}`
  const [tables, setTables] = useState<TableItem[]>(() => mapDBTables(initialTables))
  const [activeId, setActiveId] = useState<string>(() => {
    const mapped = mapDBTables(initialTables)
    return mapped[0]?.id ?? ''
  })
  const [qr, setQR] = useState<QRConfig>(() => normalizeQRStyle(initialQRStyle, baseQRUrl))
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const qrInstanceRef = useRef<unknown>(null)
  const activeTable = tables.find(t => t.id === activeId)
  const saveSeq = useRef(0)
  const didMount = useRef(false)

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }
    const seq = ++saveSeq.current
    setSaveState('saving')
    const timer = window.setTimeout(() => {
      void saveQRStyle(restaurantId, qr).then((result) => {
        if (seq !== saveSeq.current) return
        setSaveState('error' in result ? 'error' : 'saved')
      })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [restaurantId, qr])

  // Open adisyon (table session) totals per table
  const [openSessions, setOpenSessions] = useState<Record<string, OpenSessionInfo>>({})
  // Active close-flow settlement sheet (set when closing an adisyon that still
  // owes money; null = no sheet open)
  const [settleSession, setSettleSession] = useState<{ session: OpenSessionInfo; label: string } | null>(null)

  const loadSessions = useCallback(async () => {
    const result = await getOpenTableSessions(restaurantId)
    if (Array.isArray(result)) {
      const byTable: Record<string, OpenSessionInfo> = {}
      result.forEach((session) => { byTable[session.tableId] = session })
      setOpenSessions(byTable)
    }
  }, [restaurantId])

  useEffect(() => { void loadSessions() }, [loadSessions])

  // Pending waiter calls per table (one chip per table)
  const [pendingRequests, setPendingRequests] = useState<Record<string, string>>({})

  const loadPendingRequests = useCallback(async () => {
    const result = await getPendingServiceRequests(restaurantId)
    if (Array.isArray(result)) {
      const byTable: Record<string, string> = {}
      result.forEach((req) => { byTable[req.tableId] = req.id })
      setPendingRequests(byTable)
    }
  }, [restaurantId])

  useEffect(() => { void loadPendingRequests() }, [loadPendingRequests])

  useEffect(() => {
    const supabase = createDashboardBrowserClient()
    const channel = supabase
      .channel(`tables-service-requests:${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `restaurant_id=eq.${restaurantId}` },
        () => { void loadPendingRequests() },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [restaurantId, loadPendingRequests])

  const handleResolveRequest = useCallback(async (requestId: string) => {
    setPendingRequests((prev) => {
      const next = { ...prev }
      for (const [tid, id] of Object.entries(next)) if (id === requestId) delete next[tid]
      return next
    })
    await resolveServiceRequest(requestId, restaurantId)
    void loadPendingRequests()
  }, [restaurantId, loadPendingRequests])

  const handleCloseSession = useCallback(async (session: OpenSessionInfo, label: string) => {
    // Unpaid money on the adisyon → the settlement sheet forces a per-order
    // decision (no silent drop). Fully-paid → close directly (no sheet).
    if (session.unpaidTotal > 0) {
      setSettleSession({ session, label })
      return
    }
    const result = await closeTableSession(session.sessionId, restaurantId)
    if (!('error' in result)) void loadSessions()
  }, [restaurantId, loadSessions])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_VARS }} />
      <div className="tb-tables" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        <TablesTopBar
          qr={qr}
          setQR={setQR}
          restaurantName={restaurantName}
          saveState={saveState}
          previewUrl={`${MENU_PROTOCOL}://${qr.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}`}
        />
        <div className="tb-tables__workspace" style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <TablesIconRail restaurantId={restaurantId} />
          <TablesNav tables={tables} setTables={setTables} activeId={activeId} setActiveId={setActiveId} restaurantId={restaurantId} openSessions={openSessions} onCloseSession={handleCloseSession} pendingRequests={pendingRequests} onResolveRequest={handleResolveRequest} />
          <QRCanvas qr={qr} table={activeTable} tables={tables} qrInstanceRef={qrInstanceRef} />
          <QRProps qr={qr} setQR={setQR} tables={tables} saveState={saveState} />
        </div>
        <StatusBar saveState={saveState} tableCount={tables.length} activeCount={Object.keys(openSessions).length} />
        {settleSession && (
          <SettlementSheet
            restaurantId={restaurantId}
            session={settleSession.session}
            tableLabel={settleSession.label}
            onClose={() => setSettleSession(null)}
            onSettled={() => void loadSessions()}
            onSessionClosed={() => { setSettleSession(null); void loadSessions() }}
          />
        )}
      </div>
    </>
  )
}
