import { err, ok, type Result } from '@garsonless/domain'
import type {
  DashboardInsightsHealthAlert,
  DashboardInsightsHealthSnapshot,
} from './dashboard-read-model-health'

export type DashboardInsightsMonitorStatus =
  | DashboardInsightsHealthSnapshot['status']
  | 'unavailable'

export interface DashboardInsightsHealthAlertPayload {
  schemaVersion: 1
  event: 'dashboard-insights.health-alert'
  environment: string
  checkedAt: string
  observedSince: string | null
  status: Exclude<DashboardInsightsMonitorStatus, 'healthy'>
  fingerprint: string
  alerts: DashboardInsightsHealthAlert[]
}

export interface DeliverDashboardInsightsHealthAlertOptions {
  webhookUrl: string
  payload: DashboardInsightsHealthAlertPayload
  timeoutMs?: number
  fetcher?: typeof fetch
  allowInsecureLocalhost?: boolean
}

function normalizeEnvironment(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return normalized.slice(0, 64) || 'unknown'
}

function createFingerprint(
  environment: string,
  status: DashboardInsightsHealthAlertPayload['status'],
  alerts: DashboardInsightsHealthAlert[],
) {
  const signature = alerts
    .map((alert) => `${alert.level}:${alert.operation}:${alert.metric}:${alert.threshold}`)
    .sort()
    .join('|') || 'health-read-unavailable'
  return `dashboard-insights:${environment}:${status}:${signature}`
}

export function buildDashboardInsightsHealthAlertPayload(
  snapshot: DashboardInsightsHealthSnapshot,
  options: { environment: string; checkedAt?: string },
): DashboardInsightsHealthAlertPayload | null {
  if (snapshot.status === 'healthy') return null
  const environment = normalizeEnvironment(options.environment)
  return {
    schemaVersion: 1,
    event: 'dashboard-insights.health-alert',
    environment,
    checkedAt: options.checkedAt ?? new Date().toISOString(),
    observedSince: snapshot.observedSince,
    status: snapshot.status,
    fingerprint: createFingerprint(environment, snapshot.status, snapshot.alerts),
    alerts: snapshot.alerts,
  }
}

export function buildDashboardInsightsUnavailableAlertPayload(options: {
  environment: string
  checkedAt?: string
}): DashboardInsightsHealthAlertPayload {
  const environment = normalizeEnvironment(options.environment)
  return {
    schemaVersion: 1,
    event: 'dashboard-insights.health-alert',
    environment,
    checkedAt: options.checkedAt ?? new Date().toISOString(),
    observedSince: null,
    status: 'unavailable',
    fingerprint: createFingerprint(environment, 'unavailable', []),
    alerts: [],
  }
}

function parseWebhookUrl(value: string, allowInsecureLocalhost: boolean): URL | null {
  try {
    const url = new URL(value)
    if (url.username || url.password) return null
    if (url.protocol === 'https:') return url
    if (
      allowInsecureLocalhost
      && url.protocol === 'http:'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) return url
    return null
  } catch {
    return null
  }
}

export async function deliverDashboardInsightsHealthAlert(
  options: DeliverDashboardInsightsHealthAlertOptions,
): Promise<Result<void>> {
  const url = parseWebhookUrl(options.webhookUrl, options.allowInsecureLocalhost ?? false)
  if (!url) return err('invalid dashboard insights alert webhook URL')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 5_000)
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(options.payload),
      signal: controller.signal,
    })
    if (!response.ok) return err(`dashboard insights alert webhook returned ${response.status}`)
    return ok(undefined)
  } catch {
    return err('dashboard insights alert webhook request failed')
  } finally {
    clearTimeout(timeout)
  }
}
