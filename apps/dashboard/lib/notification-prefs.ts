// Owner notification preferences — stored in restaurants.settings.notifications
// (JSONB). Only channels that map to a REAL implemented surface are represented:
//   newOrderSound       → Web Audio beep on a new order (useNotificationSW)
//   newOrderPush        → desktop Web Notification via the service worker
//   newOrderToast       → in-app OrderToast on a new order (OrderBoard)
//   serviceRequestAlert → "Garson çağrısı" toast on a service request (shell)
// Email/SMS and other events are intentionally NOT here — no implementation exists.

export interface NotificationPrefs {
  newOrderSound: boolean
  newOrderPush: boolean
  newOrderToast: boolean
  serviceRequestAlert: boolean
}

export const NOTIFICATION_KEYS = [
  'newOrderSound',
  'newOrderPush',
  'newOrderToast',
  'serviceRequestAlert',
] as const

// Default ON → preserves today's (always-firing) behaviour for existing tenants
// that have no saved notification config.
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newOrderSound: true,
  newOrderPush: true,
  newOrderToast: true,
  serviceRequestAlert: true,
}

/** Read prefs from a restaurant's settings JSONB, filling defaults for missing keys. */
export function readNotificationPrefs(settings: unknown): NotificationPrefs {
  const root = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : null
  const n = root && typeof root['notifications'] === 'object' ? (root['notifications'] as Record<string, unknown>) : null
  const read = (k: keyof NotificationPrefs): boolean =>
    n && typeof n[k] === 'boolean' ? (n[k] as boolean) : DEFAULT_NOTIFICATION_PREFS[k]
  return {
    newOrderSound: read('newOrderSound'),
    newOrderPush: read('newOrderPush'),
    newOrderToast: read('newOrderToast'),
    serviceRequestAlert: read('serviceRequestAlert'),
  }
}
