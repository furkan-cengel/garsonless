import type { TableLayoutRotation, TableLayoutShape } from '@garsonless/application/tables'
import type { PersistedQRStyle, QRStyleSafetyResult } from '@garsonless/application/qr-style'

export type { PersistedQRStyle, QRStyleSafetyResult }

export interface TableItem {
  id: string
  qrToken: string | null
  label: string
  slug: string
  floorLabel: string | null
  areaLabel: string | null
  layoutXBp: number | null
  layoutYBp: number | null
  layoutShape: TableLayoutShape
  layoutRotation: TableLayoutRotation
  seatCount: number
  orders: number
  status: 'active' | 'idle' | 'paused'
}

export interface QRConfig {
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

export type SaveState = 'saved' | 'validating' | 'blocked' | 'saving' | 'error' | 'conflict'

export interface PendingTableRequestView {
  id: string
  label: string
}

export type OpenTableSessionView = import('@garsonless/application/tables').OpenTableSession

export type QRHealth = {
  state: 'checking' | 'valid' | 'warning' | 'invalid'
  message: string
  contrast: number
}

export interface QRHistory {
  stack: QRConfig[]
  index: number
}
