import type { PlatformErrorFilterInput } from '@garsonless/application/platform-admin-errors'
import {
  PLATFORM_ERROR_APPS,
  PLATFORM_ERROR_SEVERITIES,
  PLATFORM_ERROR_WINDOWS,
  type PlatformErrorApp,
  type PlatformErrorSeverity,
  type PlatformErrorWindow,
} from '@garsonless/domain/platform-observability'

type RawSearchParams = Record<string, string | string[] | undefined>

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parsePlatformErrorSearchParams(params: RawSearchParams): PlatformErrorFilterInput {
  const window = one(params.window)
  const app = one(params.app)
  const severity = one(params.severity)
  const limit = one(params.limit)
  return {
    window: PLATFORM_ERROR_WINDOWS.includes(window as PlatformErrorWindow)
      ? window as PlatformErrorWindow
      : window ? window as never : null,
    app: app === 'all' || PLATFORM_ERROR_APPS.includes(app as PlatformErrorApp)
      ? app as PlatformErrorApp | 'all'
      : app ? app as never : null,
    severity: severity === 'all' || PLATFORM_ERROR_SEVERITIES.includes(severity as PlatformErrorSeverity)
      ? severity as PlatformErrorSeverity | 'all'
      : severity ? severity as never : null,
    limit: limit && /^\d+$/.test(limit) ? Number(limit) : limit ? Number.NaN : null,
  }
}

export const ERROR_APP_LABELS: Record<PlatformErrorApp, string> = {
  dashboard: 'Dashboard',
  menu: 'Müşteri menüsü',
  kitchen: 'Mutfak',
  'platform-admin': 'Platform yönetimi',
  worker: 'Arka plan işleri',
}

export const ERROR_SEVERITY_LABELS: Record<PlatformErrorSeverity, string> = {
  warning: 'Uyarı',
  error: 'Hata',
  critical: 'Kritik',
}

export const ERROR_WINDOW_LABELS: Record<PlatformErrorWindow, string> = {
  '1h': 'Son 1 saat',
  '24h': 'Son 24 saat',
  '7d': 'Son 7 gün',
  '30d': 'Son 30 gün',
}

const SOURCE_LABELS: Record<string, string> = {
  'dashboard-query.order-volume': 'Sipariş hacmi sorgusu',
  'dashboard-query.collected-orders': 'Tahsil edilen siparişler sorgusu',
  'dashboard-query.table-refs': 'Masa referansları sorgusu',
  'dashboard-query.table-performance': 'Masa performansı sorgusu',
  'dashboard-query.pano-operational': 'Pano operasyon sorgusu',
}

export function platformErrorSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}
