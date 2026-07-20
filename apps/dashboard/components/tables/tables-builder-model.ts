import type { Tables } from '@garsonless/db/types'
import type { OpenSessionInfo } from '../../lib/actions/tables'
import type { PendingTableRequestView, QRConfig, QRHistory, TableItem } from './tables-builder-types'

const PRODUCTION_MENU_ORIGIN = 'https://menu.masabu.co'

export const MENU_ORIGIN = (
  process.env.NODE_ENV === 'production'
    ? PRODUCTION_MENU_ORIGIN
    : process.env.NEXT_PUBLIC_MENU_BASE_URL ?? process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'
).replace(/\/+$/, '')

const MAX_HISTORY_ENTRIES = 60

export function deriveTableSlug(label: string, index: number): string {
  if (/bahçe/i.test(label)) return `b${String(index + 1).padStart(2, '0')}`
  if (/bar/i.test(label)) return `ba${String.fromCharCode(64 + index + 1).toLowerCase()}`
  const num = label.match(/\d+/)?.[0]
  return num ? num.padStart(2, '0') : String(index + 1).padStart(2, '0')
}

export function filterTables(tables: TableItem[], query: string): TableItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
  if (!normalizedQuery) return tables
  return tables.filter((table) =>
    table.label.toLocaleLowerCase('tr-TR').includes(normalizedQuery)
    || table.slug.toLocaleLowerCase('tr-TR').includes(normalizedQuery),
  )
}

export function renameTableInList(tables: TableItem[], tableId: string, label: string): TableItem[] {
  return tables.map((table, index) => table.id === tableId
    ? { ...table, label, slug: deriveTableSlug(label, index) }
    : table,
  )
}

export function replaceTableQrToken(tables: TableItem[], tableId: string, qrToken: string): TableItem[] {
  return tables.map((table) => table.id === tableId ? { ...table, qrToken } : table)
}

export function removeTableFromList(
  tables: TableItem[],
  tableId: string,
  activeId: string,
): { tables: TableItem[]; activeId: string } {
  const nextTables = tables.filter((table) => table.id !== tableId)
  return {
    tables: nextTables,
    activeId: activeId === tableId ? nextTables[0]?.id ?? '' : activeId,
  }
}

export function mapDBTables(dbTables: Tables<'tables'>[], openSessions: OpenSessionInfo[], qrTokens: Record<string, string>): TableItem[] {
  const openByTable = new Map(openSessions.map((session) => [session.tableId, session]))
  return dbTables.map((table, index) => ({
    id: table.id,
    qrToken: qrTokens[table.id] ?? null,
    label: table.label,
    slug: deriveTableSlug(table.label, index),
    orders: openByTable.get(table.id)?.orderCount ?? 0,
    status: openByTable.has(table.id) ? 'active' : 'idle',
  }))
}

export function sessionsByTable(sessions: OpenSessionInfo[]): Record<string, OpenSessionInfo> {
  return Object.fromEntries(sessions.map((session) => [session.tableId, session]))
}

export function applySessionsToTables(
  tables: TableItem[],
  sessions: Record<string, OpenSessionInfo>,
): TableItem[] {
  return tables.map((table) => {
    const session = sessions[table.id]
    return {
      ...table,
      status: session ? 'active' : 'idle',
      orders: session?.orderCount ?? 0,
    }
  })
}

export function requestsByTable(
  requests: Array<{ id: string; tableId: string; label: string }>,
): Record<string, PendingTableRequestView[]> {
  return requests.reduce<Record<string, PendingTableRequestView[]>>((grouped, request) => {
    grouped[request.tableId] = [
      ...(grouped[request.tableId] ?? []),
      { id: request.id, label: request.label },
    ]
    return grouped
  }, {})
}

export function removePendingRequest(
  requests: Record<string, PendingTableRequestView[]>,
  requestId: string,
): Record<string, PendingTableRequestView[]> {
  return Object.fromEntries(
    Object.entries(requests)
      .map(([tableId, tableRequests]) => [
        tableId,
        tableRequests.filter((request) => request.id !== requestId),
      ] as const)
      .filter(([, tableRequests]) => tableRequests.length > 0),
  )
}

export function sessionRequiresSettlement(session: OpenSessionInfo): boolean {
  return session.unpaidTotal > 0 || session.splitDeclaredCashTotal > 0
}

export function defaultQR(baseUrl: string): QRConfig {
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

export function normalizeQRStyle(input: unknown, baseUrl: string): QRConfig {
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
    // Product domainini settings içindeki legacy/custom değer canlandıramaz.
    baseUrl: fallback.baseUrl,
    utmSource: readString(row, 'utmSource', fallback.utmSource),
    utmMedium: readString(row, 'utmMedium', fallback.utmMedium),
    utmCampaign: readString(row, 'utmCampaign', fallback.utmCampaign),
    autoLang: readBoolean(row, 'autoLang', fallback.autoLang),
    countdown: readBoolean(row, 'countdown', fallback.countdown),
    _presetId: typeof row._presetId === 'string' ? row._presetId : undefined,
  }
}

export function buildUrl(qr: QRConfig, table?: TableItem): string {
  const token = table?.qrToken ?? 'preview'
  const url = new URL(`${qr.baseUrl}/table/${token}`)
  if (qr.utmSource) url.searchParams.set('utm_source', qr.utmSource)
  if (qr.utmMedium) url.searchParams.set('utm_medium', qr.utmMedium)
  if (qr.utmCampaign) url.searchParams.set('utm_campaign', qr.utmCampaign)
  return url.toString()
}

function relativeLuminance(hex: string): number {
  const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((channel) => {
    const value = Number.parseInt(channel, 16) / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  return .2126 * (channels[0] ?? 0) + .7152 * (channels[1] ?? 0) + .0722 * (channels[2] ?? 0)
}

function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground)
  const second = relativeLuminance(background)
  return (Math.max(first, second) + .05) / (Math.min(first, second) + .05)
}

export function qrContrast(qr: QRConfig): number {
  const background = qr.bgTransparent ? '#ffffff' : qr.bg
  const primary = contrastRatio(qr.fg, background)
  return qr.colorType === 'gradient' ? Math.min(primary, contrastRatio(qr.fg2, background)) : primary
}

export function createQRHistory(initial: QRConfig): QRHistory {
  return { stack: [initial], index: 0 }
}

function capHistory(stack: QRConfig[]): QRConfig[] {
  return stack.length > MAX_HISTORY_ENTRIES ? stack.slice(stack.length - MAX_HISTORY_ENTRIES) : stack
}

export function pushQRHistory(history: QRHistory, next: QRConfig): QRHistory {
  const stack = capHistory([...history.stack.slice(0, history.index + 1), next])
  return { stack, index: stack.length - 1 }
}

export function beginQRHistoryChange(history: QRHistory): QRHistory {
  return pushQRHistory(history, { ...history.stack[history.index]! })
}

export function replaceQRHistory(history: QRHistory, next: QRConfig): QRHistory {
  const stack = [...history.stack]
  stack[history.index] = next
  return { ...history, stack }
}

export function undoQRHistory(history: QRHistory): QRHistory {
  return history.index > 0 ? { ...history, index: history.index - 1 } : history
}

export function redoQRHistory(history: QRHistory): QRHistory {
  return history.index < history.stack.length - 1 ? { ...history, index: history.index + 1 } : history
}
