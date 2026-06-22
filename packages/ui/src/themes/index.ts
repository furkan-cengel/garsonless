import type { GarsonlessTheme } from '@garsonless/design-engine'
import { TEMPLATES } from '@garsonless/design-engine'
import { DefaultMenuPage } from './default/MenuPage'
import { SpainMenuPage } from './spain/MenuPage'
import { SPAIN_SETTINGS_SCHEMA } from './spain/settings'
import { SETTINGS_SCHEMA as DEFAULT_SCHEMA, THEME_DEFAULTS } from './default/settings'
import type { ThemeRegistryEntry } from './types'

export type { ThemeMenuPageProps, SettingField, SettingOption, SettingsGroup, ThemeRegistryEntry } from './types'
export { computeThemeVars } from './utils'

const TEMPLATE_NAMES: Record<string, string> = {
  default:    'Classic',
  spain:      'Taste of Spain',
  obsidian:   'Obsidian',
  kiosk:      'Kiosk',
  shio:       'Shio',
  sofra:      'Sofra',
  midnight:   'Midnight',
  bloom:      'Bloom',
  raki:       'Raki',
  gunes:      'Güneş',
}

function makeEntry(id: string, defaults: GarsonlessTheme): ThemeRegistryEntry {
  return {
    id,
    name: TEMPLATE_NAMES[id] ?? id,
    SETTINGS_SCHEMA: id === 'spain' ? SPAIN_SETTINGS_SCHEMA : DEFAULT_SCHEMA,
    THEME_DEFAULTS: defaults,
    MenuPage: id === 'spain' ? SpainMenuPage : DefaultMenuPage,
  }
}

export const THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
  default: {
    id: 'default',
    name: 'Classic',
    SETTINGS_SCHEMA: DEFAULT_SCHEMA,
    THEME_DEFAULTS: THEME_DEFAULTS,
    MenuPage: DefaultMenuPage,
  },
  ...Object.fromEntries(
    Object.entries(TEMPLATES).map(([id, t]) => [id, makeEntry(id, t)])
  ),
}
