import type { StoreInfo } from './types'

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Maps the restaurant settings payload to the public menu's store-info model.
 * The theme editor catalogue uses this same mapper so its preview cannot drift
 * from the live menu when contact details or opening hours change.
 */
export function readStoreInfo(settings: unknown): StoreInfo | null {
  if (!isPlainRecord(settings)) return null
  const rawContact = isPlainRecord(settings['contact']) ? settings['contact'] : null
  const rawHours = isPlainRecord(settings['hours']) ? settings['hours'] : null

  const contact: NonNullable<StoreInfo['contact']> = {}
  if (rawContact) {
    for (const key of ['phone', 'email', 'website', 'address', 'district', 'city', 'zip', 'instagram', 'facebook', 'tiktok', 'whatsapp'] as const) {
      const value = cleanString(rawContact[key])
      if (value) contact[key] = value
    }
  }

  const hours: NonNullable<StoreInfo['hours']> = {}
  if (rawHours) {
    for (const [day, value] of Object.entries(rawHours)) {
      if (!isPlainRecord(value)) continue
      const open = cleanString(value['open'])
      const close = cleanString(value['close'])
      const intervals = Array.isArray(value['intervals'])
        ? value['intervals'].flatMap((entry) => {
          if (!isPlainRecord(entry)) return []
          const intervalOpen = cleanString(entry['open'])
          const intervalClose = cleanString(entry['close'])
          return intervalOpen && intervalClose ? [{ open: intervalOpen, close: intervalClose }] : []
        }).slice(0, 3)
        : []
      const active = typeof value['active'] === 'boolean' ? value['active'] : Boolean(open && close)
      hours[day] = { ...(open ? { open } : {}), ...(close ? { close } : {}), ...(intervals.length ? { intervals } : {}), active }
    }
  }

  const hasContact = Object.keys(contact).length > 0
  const hasHours = Object.keys(hours).length > 0
  if (!hasContact && !hasHours) return null
  return {
    ...(hasContact ? { contact } : {}),
    ...(hasHours ? { hours } : {}),
  }
}
