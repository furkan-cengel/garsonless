const DASHBOARD_WEB_VITAL_NAMES = ['LCP', 'INP', 'CLS', 'TTFB'] as const

export type DashboardWebVitalName = (typeof DASHBOARD_WEB_VITAL_NAMES)[number]

const DASHBOARD_ROUTE_FAMILIES = new Set([
  'analytics',
  'customers',
  'menu',
  'orders',
  'pano',
  'settings',
  'tables',
  'theme',
])

export function dashboardRouteFamily(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'dashboard') return 'dashboard/other'
  if (segments[1] === 'onboarding') return 'dashboard/onboarding'
  const section = segments[2]
  return section && DASHBOARD_ROUTE_FAMILIES.has(section)
    ? `dashboard/${section}`
    : 'dashboard/home'
}

export function isDashboardWebVitalName(value: string): value is DashboardWebVitalName {
  return DASHBOARD_WEB_VITAL_NAMES.some((name) => name === value)
}

export function normalizeWebVitalsSampleRate(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.1
}
