import type { GarsonlessTheme, MenuFilterPresetId } from '@garsonless/design-engine'
import type { MenuItem } from './types'

export type MenuFilterDefinition =
  | { id: MenuFilterPresetId; label: string; kind: 'preset' }
  | { id: string; label: string; kind: 'custom'; itemIds: string[] }

export const MENU_FILTER_PRESETS: ReadonlyArray<{ id: MenuFilterPresetId; label: string }> = [
  { id: 'vegan', label: 'Vegan' },
  { id: 'vegetarian', label: 'Vejetaryen' },
  { id: 'halal', label: 'Helal' },
]

const MENU_FILTER_PRESET_IDS = new Set<MenuFilterPresetId>(MENU_FILTER_PRESETS.map((filter) => filter.id))

export function resolveMenuFilterDefinitions(
  theme: Pick<GarsonlessTheme, 'menuFilterPresetIds' | 'menuCustomFilters'>,
): MenuFilterDefinition[] {
  const enabledPresetIds = new Set(theme.menuFilterPresetIds ?? MENU_FILTER_PRESETS.map((filter) => filter.id))
  const presets: MenuFilterDefinition[] = MENU_FILTER_PRESETS
    .filter((filter) => enabledPresetIds.has(filter.id))
    .map((filter) => ({ ...filter, kind: 'preset' }))
  const seen = new Set<string>(presets.map((filter) => filter.id))
  const custom = (theme.menuCustomFilters ?? []).flatMap((filter) => {
    const label = filter.label.trim()
    const itemIds = [...new Set(filter.itemIds)]
    if (!filter.id || !label || itemIds.length === 0 || seen.has(filter.id) || MENU_FILTER_PRESET_IDS.has(filter.id as MenuFilterPresetId)) return []
    seen.add(filter.id)
    return [{ id: filter.id, label, kind: 'custom' as const, itemIds }]
  })
  return [...presets, ...custom]
}

export function itemMatchesMenuFilters(
  item: MenuItem,
  filters: readonly MenuFilterDefinition[],
): boolean {
  return filters.every((filter) => {
    if (filter.kind === 'custom') return filter.itemIds.includes(item.id)
    if (filter.id === 'vegan') return item.is_vegan === true
    if (filter.id === 'vegetarian') return item.is_vegetarian === true
    return item.is_halal === true
  })
}

export function itemMatchesDietaryFilters(
  item: MenuItem,
  filters: readonly MenuFilterPresetId[],
): boolean {
  const definitions = filters.flatMap((id) => {
    const preset = MENU_FILTER_PRESETS.find((candidate) => candidate.id === id)
    return preset ? [{ ...preset, kind: 'preset' as const }] : []
  })
  return itemMatchesMenuFilters(item, definitions)
}
