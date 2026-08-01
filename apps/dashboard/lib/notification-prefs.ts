// Owner notification preferences — stored in restaurants.settings.notifications
// (JSONB). Only channels that map to a REAL implemented surface are represented:
//   newOrderSound       → global shell Web Audio alarm
//   newOrderPush        → desktop Web Notification via the service worker
//   newOrderToast       → global shell in-app OrderToast
//   serviceRequestAlert → "Garson çağrısı" toast on a service request (shell)
//   serviceRequestPush  → durable desktop notification for a service request
// Email/SMS and other events are intentionally NOT here — no implementation exists.

export interface NotificationPrefs {
  newOrderSound: boolean
  newOrderSoundPreset: OrderSoundPreset
  newOrderSoundVolume: number
  newOrderRepeatSeconds: 0 | 15 | 30 | 60
  newOrderRepeatMaxMinutes: number
  newOrderPush: boolean
  newOrderToast: boolean
  serviceRequestAlert: boolean
  serviceRequestPush: boolean
}

const ORDER_SOUND_PRESETS = ['classic', 'kitchen-bell', 'double-chime', 'soft-ping'] as const
export type OrderSoundPreset = (typeof ORDER_SOUND_PRESETS)[number]

// Default ON → preserves today's (always-firing) behaviour for existing tenants
// that have no saved notification config.
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newOrderSound: true,
  newOrderSoundPreset: 'classic',
  newOrderSoundVolume: 70,
  newOrderRepeatSeconds: 0,
  newOrderRepeatMaxMinutes: 5,
  newOrderPush: true,
  newOrderToast: true,
  serviceRequestAlert: true,
  // External notification channels require an explicit opt-in. Existing
  // tenants keep their in-app waiter alert without unexpectedly receiving a
  // new operating-system notification after deployment.
  serviceRequestPush: false,
}

/** Read prefs from a restaurant's settings JSONB, filling defaults for missing keys. */
export function readNotificationPrefs(settings: unknown): NotificationPrefs {
  const root = settings && typeof settings === 'object' ? (settings as Record<string, unknown>) : null
  const n = root && typeof root['notifications'] === 'object' ? (root['notifications'] as Record<string, unknown>) : null
  type BooleanPreference = 'newOrderSound' | 'newOrderPush' | 'newOrderToast' | 'serviceRequestAlert' | 'serviceRequestPush'
  const read = (k: BooleanPreference): boolean =>
    n && typeof n[k] === 'boolean' ? (n[k] as boolean) : DEFAULT_NOTIFICATION_PREFS[k]
  const preset = n?.['newOrderSoundPreset']
  const volume = n?.['newOrderSoundVolume']
  const repeatSeconds = n?.['newOrderRepeatSeconds']
  const repeatMaxMinutes = n?.['newOrderRepeatMaxMinutes']
  return {
    newOrderSound: read('newOrderSound'),
    newOrderSoundPreset: ORDER_SOUND_PRESETS.includes(preset as OrderSoundPreset)
      ? preset as OrderSoundPreset
      : DEFAULT_NOTIFICATION_PREFS.newOrderSoundPreset,
    newOrderSoundVolume: typeof volume === 'number' && Number.isFinite(volume)
      ? Math.min(100, Math.max(0, Math.round(volume)))
      : DEFAULT_NOTIFICATION_PREFS.newOrderSoundVolume,
    newOrderRepeatSeconds: repeatSeconds === 15 || repeatSeconds === 30 || repeatSeconds === 60
      ? repeatSeconds
      : 0,
    newOrderRepeatMaxMinutes: typeof repeatMaxMinutes === 'number' && Number.isFinite(repeatMaxMinutes)
      ? Math.min(10, Math.max(1, Math.round(repeatMaxMinutes)))
      : DEFAULT_NOTIFICATION_PREFS.newOrderRepeatMaxMinutes,
    newOrderPush: read('newOrderPush'),
    newOrderToast: read('newOrderToast'),
    serviceRequestAlert: read('serviceRequestAlert'),
    serviceRequestPush: read('serviceRequestPush'),
  }
}
