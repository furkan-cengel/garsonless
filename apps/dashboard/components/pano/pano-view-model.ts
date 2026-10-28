import type { PaymentStatus } from '../../lib/queries/pano'
import type { PanoLiveStatus } from './pano-live-model'

export type PanoHealthStatus = 'ok' | 'warn' | 'down' | 'idle'

export type PanoHealthCheck = {
  label: string
  status: PanoHealthStatus
  detail: string
}

export type PanoRealtimeStatus = PanoLiveStatus

function relativeTime(value: string | Date, now: Date): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000))
  return elapsedSeconds < 60
    ? 'az önce'
    : elapsedSeconds < 3600
      ? `${Math.floor(elapsedSeconds / 60)} dk önce`
      : elapsedSeconds < 86400
        ? `${Math.floor(elapsedSeconds / 3600)} sa önce`
        : `${Math.floor(elapsedSeconds / 86400)} gün önce`
}

export function getPanoGreeting(timezone: string, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now))

  return hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
}

export function getPanoHealthChecks({
  paymentStatus,
  isOwner,
  realtime,
  updatedAt,
  lastOrderAt,
  now = new Date(),
}: {
  paymentStatus: PaymentStatus | null
  isOwner: boolean
  realtime: PanoRealtimeStatus
  updatedAt: Date
  lastOrderAt: string | null
  now?: Date
}): PanoHealthCheck[] {
  const checks: PanoHealthCheck[] = []

  // Missing configuration has its own setup notice, outside live system health.
  if (isOwner && paymentStatus?.configured) {
    checks.push(
      paymentStatus.mode === 'live'
          ? { label: 'İyzico ödeme', status: 'ok', detail: 'Canlı · bağlı' }
          : { label: 'İyzico ödeme', status: 'warn', detail: 'Test modu (sandbox)' },
    )
  }

  const lastSync = `son başarılı ${relativeTime(updatedAt, now)}`
  checks.push(
    realtime === 'live'
      ? { label: 'Canlı veri', status: 'ok', detail: `Bağlı · ${lastSync}` }
      : realtime === 'stale'
        ? { label: 'Canlı veri', status: 'warn', detail: `Güncelleme gecikti · ${lastSync}` }
        : realtime === 'offline'
          ? { label: 'Canlı veri', status: 'down', detail: `Çevrimdışı · ${lastSync}` }
          : realtime === 'error'
            ? { label: 'Canlı veri', status: 'down', detail: `Yenileme başarısız · ${lastSync}` }
            : { label: 'Canlı veri', status: 'idle', detail: `Bağlanıyor · ${lastSync}` },
  )

  if (!lastOrderAt) {
    checks.push({ label: 'Son sipariş', status: 'idle', detail: 'Henüz sipariş yok' })
    return checks
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / 1000))

  checks.push({
    label: 'Son sipariş',
    status: elapsedSeconds < 86400 ? 'ok' : 'idle',
    detail: relativeTime(lastOrderAt, now),
  })

  return checks
}
