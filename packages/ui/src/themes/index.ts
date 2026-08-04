import { DefaultMenuPage } from './default/MenuPage'
import { SETTINGS_SCHEMA as DEFAULT_SCHEMA, THEME_DEFAULTS } from './default/settings'
import type { ThemeRegistryEntry } from './types'

export type { ComboAddRequest, StoreInfo, SettingField, SettingsGroup, ThemeRegistryEntry } from './types'
export { computeThemeVars } from './utils'
export { readStoreInfo } from './storeInfo'

export const THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
  default: {
    id: 'default',
    name: 'Classic',
    SETTINGS_SCHEMA: DEFAULT_SCHEMA,
    THEME_DEFAULTS: THEME_DEFAULTS,
    MenuPage: DefaultMenuPage,
  },
}
