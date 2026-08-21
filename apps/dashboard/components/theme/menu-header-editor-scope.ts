import {
  DEFAULT_THEME,
  resolveMenuActionPlacements,
  resolveMenuHeaderTheme,
  type GarsonlessTheme,
  type MenuHeaderThemeOverride,
  type ThemeSurfaces,
} from '@garsonless/design-engine'

const MENU_HEADER_GROUP_IDS = new Set(['header', 'header-layout', 'header-context', 'header-actions'])

export function isMenuHeaderEditorGroup(groupId: string) {
  return MENU_HEADER_GROUP_IDS.has(groupId)
}

export function getMenuHeaderOverride(theme: GarsonlessTheme): MenuHeaderThemeOverride {
  return theme.surfaces?.menu?.chrome?.header ?? {}
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

export function buildMenuHeaderOverridePatch(
  theme: GarsonlessTheme,
  nextHeaderOverride: MenuHeaderThemeOverride,
): Partial<GarsonlessTheme> {
  const currentSurfaces = theme.surfaces ?? DEFAULT_THEME.surfaces!
  const currentMenu = currentSurfaces.menu ?? {}
  const nextChrome = { ...(currentMenu.chrome ?? {}) }

  if (Object.keys(nextHeaderOverride).length > 0) nextChrome.header = nextHeaderOverride
  else delete nextChrome.header

  const nextMenu = { ...currentMenu }
  if (Object.keys(nextChrome).length > 0) nextMenu.chrome = nextChrome
  else delete nextMenu.chrome

  const nextSurfaces: ThemeSurfaces = { ...currentSurfaces }
  if (Object.keys(nextMenu).length > 0) nextSurfaces.menu = nextMenu
  else delete nextSurfaces.menu

  return { surfaces: nextSurfaces }
}

export function buildMenuHeaderFieldPatch(
  theme: GarsonlessTheme,
  key: keyof GarsonlessTheme,
  value: unknown,
): Partial<GarsonlessTheme> {
  const next = { ...getMenuHeaderOverride(theme) } as Record<string, unknown>
  if (sameValue(value, theme[key])) delete next[key]
  else next[key] = value
  return buildMenuHeaderOverridePatch(theme, next as MenuHeaderThemeOverride)
}

export function projectMenuHeaderFieldChange(
  theme: GarsonlessTheme,
  key: keyof GarsonlessTheme,
  value: unknown,
): { patch: Partial<GarsonlessTheme>; movedHeaderAction: boolean } {
  const initialPatch = buildMenuHeaderFieldPatch(theme, key, value)
  if (key !== 'memberPlacement' && key !== 'cartPlacement' && key !== 'servicePlacement') {
    return { patch: initialPatch, movedHeaderAction: false }
  }

  const candidate = { ...theme, ...initialPatch }
  const resolvedCandidate = resolveMenuHeaderTheme(candidate)
  const placements = resolveMenuActionPlacements(resolvedCandidate)
  const adjusted = {
    memberPlacement: placements.member,
    cartPlacement: placements.cart,
    servicePlacement: placements.service,
  } as const
  const movedHeaderAction = (Object.keys(adjusted) as Array<keyof typeof adjusted>).some(
    (placementKey) => resolvedCandidate[placementKey] !== adjusted[placementKey],
  )
  if (!movedHeaderAction) return { patch: initialPatch, movedHeaderAction: false }

  const nextOverride = {
    ...getMenuHeaderOverride(candidate),
    ...adjusted,
  }
  return {
    patch: buildMenuHeaderOverridePatch(theme, nextOverride),
    movedHeaderAction: true,
  }
}

export function buildMenuHeaderGroupResetPatch(
  theme: GarsonlessTheme,
  keys: readonly (keyof GarsonlessTheme)[],
): Partial<GarsonlessTheme> {
  const next = { ...getMenuHeaderOverride(theme) } as Record<string, unknown>
  for (const key of keys) delete next[key]
  return buildMenuHeaderOverridePatch(theme, next as MenuHeaderThemeOverride)
}

export function buildMenuHeaderContrastRepairPatch(theme: GarsonlessTheme): Partial<GarsonlessTheme> {
  return buildMenuHeaderOverridePatch(theme, {
    ...getMenuHeaderOverride(theme),
    headerBg: '#ffffff',
    headerTextColor: '#1c1d20',
    headerIconColor: '#166534',
  })
}
