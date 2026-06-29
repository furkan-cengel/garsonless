export const ALLERGEN_CODES = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const

export type AllergenCode = (typeof ALLERGEN_CODES)[number]

export const ALLERGEN_LABELS: Record<AllergenCode, string> = {
  gluten: 'Gluten',
  crustaceans: 'Kabuklular',
  eggs: 'Yumurta',
  fish: 'Balık',
  peanuts: 'Yer fıstığı',
  soy: 'Soya',
  milk: 'Süt',
  tree_nuts: 'Sert kabuklu meyveler',
  celery: 'Kereviz',
  mustard: 'Hardal',
  sesame: 'Susam',
  sulphites: 'Kükürt dioksit ve sülfitler',
  lupin: 'Acı bakla',
  molluscs: 'Yumuşakçalar',
}

const ALLERGEN_SET = new Set<string>(ALLERGEN_CODES)

export interface MenuIngredient {
  id: string
  name: string
  removable: boolean
  allergen_codes: AllergenCode[]
  /** Optional display quantity, e.g. "60g" / "2 dilim". Display-only. */
  amount?: string
}

export type ModifierSelectionMode = 'single' | 'multiple' | 'quantity'

export interface MenuModifierOption {
  id: string
  name: string
  price_delta: number
  calorie_delta: number
  is_default: boolean
  allergen_codes: AllergenCode[]
}

export interface MenuModifierGroup {
  id: string
  name: string
  selection_mode: ModifierSelectionMode
  required: boolean
  min: number
  max: number
  options: MenuModifierOption[]
}

export interface SelectedMenuModifier {
  group_id: string
  option_id: string
  quantity?: number
}

export interface ResolvedOrderModifier {
  groupId: string
  groupName: string
  optionId: string
  optionName: string
  name: string
  quantity: number
  priceDelta: number
  calorieDelta: number
  allergenCodes: AllergenCode[]
}

export interface RemovedOrderIngredient {
  id: string
  name: string
}

export interface OrderLineSnapshot {
  itemId: string
  name: string
  price: number
  quantity: number
  modifiers: ResolvedOrderModifier[]
  modifiersPriceDelta: number
  removedIngredients: RemovedOrderIngredient[]
  energyKcal: number | null
  allergens: AllergenCode[]
  mayContainAllergens: AllergenCode[]
  containsAlcohol: boolean
  containsPork: boolean
}

export interface ResolvableMenuItem {
  id: string
  name: string
  price: number
  is_available: boolean
  ingredients: unknown
  energy_kcal: number | null
  may_contain_allergens: unknown
  contains_allergens: unknown
  contains_alcohol: boolean
  contains_pork: boolean
  modifier_groups: unknown
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeAllergenCodes(value: unknown): AllergenCode[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((code): code is AllergenCode =>
    typeof code === 'string' && ALLERGEN_SET.has(code),
  ))]
}

export function normalizeIngredients(value: unknown): MenuIngredient[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const row = raw as Record<string, unknown>
    const name = stringValue(row['name'])
    if (!name) return []
    const amount = stringValue(row['amount'])
    return [{
      id: stringValue(row['id']) || `ingredient-${index}`,
      name,
      removable: row['removable'] === true,
      allergen_codes: normalizeAllergenCodes(row['allergen_codes'] ?? row['allergenCodes']),
      ...(amount ? { amount } : {}),
    }]
  })
}

export function normalizeModifierGroups(value: unknown): MenuModifierGroup[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw, groupIndex) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
    const group = raw as Record<string, unknown>
    const optionsRaw = Array.isArray(group['options']) ? group['options'] : []
    const options = optionsRaw.flatMap((optionRaw, optionIndex): MenuModifierOption[] => {
      if (!optionRaw || typeof optionRaw !== 'object' || Array.isArray(optionRaw)) return []
      const option = optionRaw as Record<string, unknown>
      const name = stringValue(option['name'])
      if (!name) return []
      return [{
        id: stringValue(option['id']) || `option-${groupIndex}-${optionIndex}`,
        name,
        price_delta: Math.max(0, finiteNumber(option['price_delta'])),
        calorie_delta: Math.round(finiteNumber(option['calorie_delta'])),
        is_default: option['is_default'] === true,
        allergen_codes: normalizeAllergenCodes(option['allergen_codes'] ?? option['allergenCodes']),
      }]
    })

    const legacyType = group['type']
    const selectionMode: ModifierSelectionMode =
      group['selection_mode'] === 'single' ||
      group['selection_mode'] === 'multiple' ||
      group['selection_mode'] === 'quantity'
        ? group['selection_mode']
        : legacyType === 'required'
          ? 'single'
          : legacyType === 'quantity'
            ? 'quantity'
            : 'multiple'
    const required = group['required'] === true || legacyType === 'required'
    const defaultMin = required ? 1 : 0
    const defaultMax = selectionMode === 'single' ? 1 : Math.max(options.length, 1)
    const min = Math.max(0, Math.floor(finiteNumber(group['min'], defaultMin)))
    const max = Math.max(min, Math.floor(finiteNumber(group['max'], defaultMax)))

    return [{
      id: stringValue(group['id']) || `group-${groupIndex}`,
      name: stringValue(group['name']),
      selection_mode: selectionMode,
      required,
      min,
      max,
      options,
    }]
  })
}

export function resolveModifierSelections(
  groupsValue: unknown,
  selections: SelectedMenuModifier[],
): { ok: true; modifiers: ResolvedOrderModifier[] } | { ok: false; error: string } {
  const groups = normalizeModifierGroups(groupsValue)
  const byGroup = new Map<string, SelectedMenuModifier[]>()
  for (const selection of selections) {
    const list = byGroup.get(selection.group_id) ?? []
    list.push(selection)
    byGroup.set(selection.group_id, list)
  }

  for (const groupId of byGroup.keys()) {
    if (!groups.some((group) => group.id === groupId)) {
      return { ok: false, error: 'Invalid modifier group' }
    }
  }

  const resolved: ResolvedOrderModifier[] = []
  for (const group of groups) {
    const selected = byGroup.get(group.id) ?? []
    const count = selected.reduce((sum, item) =>
      sum + (group.selection_mode === 'quantity' ? Math.max(1, item.quantity ?? 1) : 1), 0)
    if (count < group.min || count > group.max || (group.required && count === 0)) {
      return { ok: false, error: `Invalid selection count for ${group.name || 'modifier group'}` }
    }
    if (group.selection_mode === 'single' && selected.length > 1) {
      return { ok: false, error: `Only one option may be selected for ${group.name}` }
    }

    const seen = new Set<string>()
    for (const selection of selected) {
      if (seen.has(selection.option_id)) {
        return { ok: false, error: 'Duplicate modifier option' }
      }
      seen.add(selection.option_id)
      const option = group.options.find((candidate) => candidate.id === selection.option_id)
      if (!option) return { ok: false, error: 'Invalid modifier option' }
      const quantity = group.selection_mode === 'quantity'
        ? Math.max(1, Math.floor(selection.quantity ?? 1))
        : 1
      resolved.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        name: option.name,
        quantity,
        priceDelta: option.price_delta,
        calorieDelta: option.calorie_delta,
        allergenCodes: option.allergen_codes,
      })
    }
  }
  return { ok: true, modifiers: resolved }
}

export function buildOrderLineSnapshot(input: {
  item: ResolvableMenuItem
  quantity: number
  selections: SelectedMenuModifier[]
  removedIngredientIds: string[]
}): { ok: true; snapshot: OrderLineSnapshot } | { ok: false; error: string } {
  const { item } = input
  if (!item.is_available) return { ok: false, error: 'Menu item is not available' }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 99) {
    return { ok: false, error: 'Invalid quantity' }
  }
  const modifierResult = resolveModifierSelections(item.modifier_groups, input.selections)
  if (!modifierResult.ok) return modifierResult

  const ingredients = normalizeIngredients(item.ingredients)
  const removedIngredients: RemovedOrderIngredient[] = []
  for (const id of [...new Set(input.removedIngredientIds)]) {
    const ingredient = ingredients.find((candidate) => candidate.id === id)
    if (!ingredient || !ingredient.removable) {
      return { ok: false, error: 'Ingredient cannot be removed' }
    }
    removedIngredients.push({ id: ingredient.id, name: ingredient.name })
  }

  const modifiersPriceDelta = modifierResult.modifiers.reduce(
    (sum, modifier) => sum + modifier.priceDelta * modifier.quantity,
    0,
  )
  const calorieDelta = modifierResult.modifiers.reduce(
    (sum, modifier) => sum + modifier.calorieDelta * modifier.quantity,
    0,
  )
  const allergenSet = new Set<AllergenCode>()
  // Item-level "contains" (the redesigned editor's flat list) + any per-ingredient
  // codes (back-compat) + modifier-option codes → the order line's allergen set.
  for (const code of normalizeAllergenCodes(item.contains_allergens)) allergenSet.add(code)
  for (const ingredient of ingredients) {
    for (const code of ingredient.allergen_codes) allergenSet.add(code)
  }
  for (const modifier of modifierResult.modifiers) {
    for (const code of modifier.allergenCodes) allergenSet.add(code)
  }
  const baseEnergy = item.energy_kcal === null ? null : Number(item.energy_kcal)

  return {
    ok: true,
    snapshot: {
      itemId: item.id,
      name: item.name,
      price: Number(item.price),
      quantity: input.quantity,
      modifiers: modifierResult.modifiers,
      modifiersPriceDelta,
      removedIngredients,
      energyKcal: baseEnergy === null ? null : Math.max(0, Math.round(baseEnergy + calorieDelta)),
      allergens: [...allergenSet],
      mayContainAllergens: normalizeAllergenCodes(item.may_contain_allergens),
      containsAlcohol: item.contains_alcohol,
      containsPork: item.contains_pork,
    },
  }
}

export function readOrderLineSnapshot(value: unknown): OrderLineSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const name = stringValue(row['name'])
  if (!name) return null
  const quantity = Math.max(1, Math.floor(finiteNumber(row['quantity'] ?? row['qty'], 1)))
  const modifiers = Array.isArray(row['modifiers'])
    ? row['modifiers'].flatMap((raw, index): ResolvedOrderModifier[] => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
        const modifier = raw as Record<string, unknown>
        const optionName = stringValue(
          modifier['optionName'] ?? modifier['name'] ?? modifier['option_name'],
        )
        if (!optionName) return []
        return [{
          groupId: stringValue(modifier['groupId'] ?? modifier['group_id']),
          groupName: stringValue(modifier['groupName'] ?? modifier['group_name']),
          optionId: stringValue(modifier['optionId'] ?? modifier['option_id']) || `legacy-${index}`,
          optionName,
          name: optionName,
          quantity: Math.max(1, Math.floor(finiteNumber(modifier['quantity'], 1))),
          priceDelta: finiteNumber(modifier['priceDelta'] ?? modifier['price_delta']),
          calorieDelta: Math.round(finiteNumber(modifier['calorieDelta'] ?? modifier['calorie_delta'])),
          allergenCodes: normalizeAllergenCodes(
            modifier['allergenCodes'] ?? modifier['allergen_codes'],
          ),
        }]
      })
    : []
  const removedIngredients = Array.isArray(row['removedIngredients'])
    ? row['removedIngredients'].flatMap((raw, index): RemovedOrderIngredient[] => {
        if (typeof raw === 'string' && raw.trim()) return [{ id: `legacy-${index}`, name: raw.trim() }]
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
        const ingredient = raw as Record<string, unknown>
        const ingredientName = stringValue(ingredient['name'])
        return ingredientName
          ? [{ id: stringValue(ingredient['id']) || `legacy-${index}`, name: ingredientName }]
          : []
      })
    : []

  return {
    itemId: stringValue(row['itemId'] ?? row['item_id']),
    name,
    price: finiteNumber(row['price'] ?? row['unitPrice']),
    quantity,
    modifiers,
    modifiersPriceDelta: finiteNumber(row['modifiersPriceDelta']),
    removedIngredients,
    energyKcal: typeof row['energyKcal'] === 'number' ? Math.round(row['energyKcal']) : null,
    allergens: normalizeAllergenCodes(row['allergens']),
    mayContainAllergens: normalizeAllergenCodes(row['mayContainAllergens']),
    containsAlcohol: row['containsAlcohol'] === true,
    containsPork: row['containsPork'] === true,
  }
}

export function readOrderLineSnapshots(value: unknown): OrderLineSnapshot[] {
  return Array.isArray(value)
    ? value.flatMap((line) => {
        const parsed = readOrderLineSnapshot(line)
        return parsed ? [parsed] : []
      })
    : []
}
