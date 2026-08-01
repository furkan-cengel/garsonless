import type { ServiceRequestType } from '@garsonless/domain/tables'

type ServiceRequestFabPosition = 'left' | 'right'
type ServiceRequestFabSize = 'compact' | 'normal' | 'large'
export type ServiceRequestIcon =
  | 'bell'
  | 'spray'
  | 'cigarette'
  | 'hand-platter'
  | 'glass-water'
  | 'receipt'
  | 'custom'
  | 'none'

interface ResolvedServiceRequestOption {
  type: ServiceRequestType
  label: string
  icon: ServiceRequestIcon
  customIconUrl: string | null
}

export interface ResolvedServiceRequestFabConfig {
  title: string
  subtitle: string
  quickHeading: string
  position: ServiceRequestFabPosition
  size: ServiceRequestFabSize
  bottomOffset: number
  requests: ResolvedServiceRequestOption[]
}

const REQUEST_DEFINITIONS: Array<{
  type: ServiceRequestType
  enabledKey: string
  labelKey: string
  iconKey: string
  customIconKey: string
  defaultIcon: ServiceRequestIcon
  defaultLabel: string
}> = [
  { type: 'waiter', enabledKey: 'waiterEnabled', labelKey: 'waiterLabel', iconKey: 'waiterIcon', customIconKey: 'waiterIconUrl', defaultIcon: 'bell', defaultLabel: 'Garsonu çağır' },
  { type: 'clean_table', enabledKey: 'cleanTableEnabled', labelKey: 'cleanTableLabel', iconKey: 'cleanTableIcon', customIconKey: 'cleanTableIconUrl', defaultIcon: 'spray', defaultLabel: 'Masam temizlensin' },
  { type: 'change_ashtray', enabledKey: 'ashtrayEnabled', labelKey: 'ashtrayLabel', iconKey: 'ashtrayIcon', customIconKey: 'ashtrayIconUrl', defaultIcon: 'cigarette', defaultLabel: 'Küllük değişsin' },
  { type: 'table_service', enabledKey: 'tableServiceEnabled', labelKey: 'tableServiceLabel', iconKey: 'tableServiceIcon', customIconKey: 'tableServiceIconUrl', defaultIcon: 'hand-platter', defaultLabel: 'Servis istiyorum' },
  { type: 'water', enabledKey: 'waterEnabled', labelKey: 'waterLabel', iconKey: 'waterIcon', customIconKey: 'waterIconUrl', defaultIcon: 'glass-water', defaultLabel: 'Su istiyorum' },
  { type: 'bill', enabledKey: 'billEnabled', labelKey: 'billLabel', iconKey: 'billIcon', customIconKey: 'billIconUrl', defaultIcon: 'receipt', defaultLabel: 'Hesap istiyorum' },
]

const SERVICE_REQUEST_ICONS = new Set<ServiceRequestIcon>([
  'bell',
  'spray',
  'cigarette',
  'hand-platter',
  'glass-water',
  'receipt',
  'custom',
  'none',
])

function text(value: string | undefined, fallback: string) {
  const normalized = value?.trim()
  return normalized ? normalized.slice(0, 80) : fallback
}

function enabled(value: string | undefined) {
  return value !== 'false'
}

function icon(value: string | undefined, fallback: ServiceRequestIcon): ServiceRequestIcon {
  return value && SERVICE_REQUEST_ICONS.has(value as ServiceRequestIcon)
    ? value as ServiceRequestIcon
    : fallback
}

function customIconUrl(value: string | undefined) {
  const normalized = value?.trim()
  if (!normalized || normalized.length > 2048) return null
  return normalized.startsWith('/') || /^https?:\/\//i.test(normalized) ? normalized : null
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

export function resolveServiceRequestFabConfig(
  config: Record<string, string> = {},
): ResolvedServiceRequestFabConfig {
  return {
    title: text(config.title, 'Nasıl yardımcı olalım?'),
    subtitle: text(config.subtitle, 'isteğiniz doğrudan ekibe iletilir'),
    quickHeading: text(config.quickHeading, 'Hızlı istekler'),
    position: config.position === 'left' ? 'left' : 'right',
    size: config.size === 'compact' || config.size === 'large' ? config.size : 'normal',
    bottomOffset: clampNumber(config.bottomOffset, 96, 72, 180),
    requests: REQUEST_DEFINITIONS
      .filter((request) => enabled(config[request.enabledKey]))
      .map((request) => ({
        type: request.type,
        label: text(config[request.labelKey], request.defaultLabel),
        icon: icon(config[request.iconKey], request.defaultIcon),
        customIconUrl: customIconUrl(config[request.customIconKey]),
      })),
  }
}
