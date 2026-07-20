import {
  isThemeTemplateId,
  resolveTheme,
  sanitizeThemeTokens,
  type GarsonlessTheme,
} from '@garsonless/design-engine'
import {
  err,
  hasSameRestaurant,
  ok,
  type DashboardActorContext,
  type Result,
} from '@garsonless/domain'
import { authorizeDashboardFeatureRead } from './dashboard-feature-read-models'

export interface ThemeRestaurantSnapshot {
  slug: string
  name: string
  logoUrl: string | null
  settings: Record<string, unknown> | null
}

export interface ThemeApplicationPort {
  readRestaurant(input: { restaurantId: string }): Promise<Result<ThemeRestaurantSnapshot | null>>
  readConfig(input: { restaurantId: string }): Promise<Result<unknown | null>>
  publish(input: {
    restaurantId: string
    templateId: string
    theme: GarsonlessTheme
    publishedBy: string
  }): Promise<Result<{ slug: string }>>
}

export interface ThemeMenuReference<TCategory, TItem> {
  categories: TCategory[]
  items: TItem[]
}

export interface ThemeMenuReferenceReadModelPort<TCategory, TItem> {
  readMenuReferences(input: {
    restaurantId: string
    operation: 'theme.menu-references'
  }): Promise<Result<ThemeMenuReference<TCategory, TItem>>>
}

function requireThemeAccess(
  context: DashboardActorContext,
  restaurantId: string,
): Result<true> {
  return hasSameRestaurant(context, restaurantId) && context.permissions.includes('theme')
    ? ok(true)
    : err('Not authorized')
}

export async function readThemeMenuReferences<TCategory, TItem>(
  context: DashboardActorContext,
  restaurantId: string,
  port: ThemeMenuReferenceReadModelPort<TCategory, TItem>,
): Promise<Result<ThemeMenuReference<TCategory, TItem>>> {
  const access = authorizeDashboardFeatureRead(context, restaurantId, 'theme.menu-references')
  return access.ok
    ? port.readMenuReferences({ restaurantId, operation: 'theme.menu-references' })
    : access
}

async function resolveFromPort(
  input: { restaurantId: string; templateOverride?: string | null },
  port: ThemeApplicationPort,
): Promise<Result<{ theme: GarsonlessTheme; templateId: string; restaurant: ThemeRestaurantSnapshot }>> {
  const [restaurantResult, configResult] = await Promise.all([
    port.readRestaurant({ restaurantId: input.restaurantId }),
    port.readConfig({ restaurantId: input.restaurantId }),
  ])
  if (!restaurantResult.ok) return restaurantResult
  if (!configResult.ok) return configResult
  if (!restaurantResult.value) return err('Restaurant not found')

  const resolved = resolveTheme({
    settings: restaurantResult.value.settings,
    themeTokens: configResult.value,
    ...(input.templateOverride !== undefined ? { templateOverride: input.templateOverride } : {}),
  })
  return ok({ ...resolved, restaurant: restaurantResult.value })
}

export async function readThemeForEditor(
  context: DashboardActorContext,
  input: { restaurantId: string; templateId: string },
  port: ThemeApplicationPort,
): Promise<Result<{ theme: GarsonlessTheme; templateId: string; restaurant: ThemeRestaurantSnapshot }>> {
  const access = requireThemeAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (!isThemeTemplateId(input.templateId)) return err('Unknown theme template')
  return resolveFromPort({ restaurantId: input.restaurantId, templateOverride: input.templateId }, port)
}

export async function readActiveThemeForDashboard(
  context: DashboardActorContext,
  input: { restaurantId: string },
  port: ThemeApplicationPort,
): Promise<Result<{ theme: GarsonlessTheme; templateId: string; restaurant: ThemeRestaurantSnapshot }>> {
  const access = requireThemeAccess(context, input.restaurantId)
  if (!access.ok) return access
  return resolveFromPort(input, port)
}

/** Public menu read: no actor authority, only already-public restaurant theme data. */
export async function readPublishedTheme(
  input: { restaurantId: string; templateOverride?: string | null },
  port: ThemeApplicationPort,
): Promise<Result<{ theme: GarsonlessTheme; templateId: string; restaurant: ThemeRestaurantSnapshot }>> {
  if (input.templateOverride != null && !isThemeTemplateId(input.templateOverride)) {
    return err('Unknown theme template')
  }
  return resolveFromPort(input, port)
}

export async function publishRestaurantTheme(
  context: DashboardActorContext,
  input: { restaurantId: string; templateId: string; theme: unknown },
  port: ThemeApplicationPort,
): Promise<Result<{ slug: string }>> {
  const access = requireThemeAccess(context, input.restaurantId)
  if (!access.ok) return access
  if (!isThemeTemplateId(input.templateId)) return err('Unknown theme template')
  const theme = sanitizeThemeTokens(input.theme, input.templateId)
  if (!theme) return err('Invalid theme document')
  return port.publish({
    restaurantId: input.restaurantId,
    templateId: input.templateId,
    theme,
    publishedBy: context.userId,
  })
}
