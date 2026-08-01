// Orders board operational prefs — stored in restaurants.settings.orders
// (JSONB, non-secret). Currently one knob:
//   late_threshold_min → minutes in the KITCHEN stage before an order counts
//   as "Geciken" on the Orders board (card tag + KPI). Stage-based since P2
//   (sent_to_kitchen_at, falling back to created_at for pre-migration orders).

const DEFAULT_LATE_THRESHOLD_MIN = 20
export const LATE_THRESHOLD_MIN_MIN = 5
export const LATE_THRESHOLD_MIN_MAX = 120

export function clampLateThreshold(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LATE_THRESHOLD_MIN
  return Math.min(LATE_THRESHOLD_MIN_MAX, Math.max(LATE_THRESHOLD_MIN_MIN, Math.round(value)))
}

/** Read the late threshold from a restaurant's settings JSONB (default 20, clamped 5–120). */
export function readLateThresholdMin(settings: unknown): number {
  const root = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : null
  const orders = root && typeof root['orders'] === 'object' && root['orders'] !== null
    ? (root['orders'] as Record<string, unknown>)
    : null
  const raw = orders?.['late_threshold_min']
  return typeof raw === 'number' ? clampLateThreshold(raw) : DEFAULT_LATE_THRESHOLD_MIN
}
