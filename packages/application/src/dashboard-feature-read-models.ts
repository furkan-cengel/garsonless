import {
  err,
  hasSameRestaurant,
  ok,
  type DashboardActorContext,
  type Result,
} from '@garsonless/domain'

/** The stable vocabulary for dashboard feature snapshots. */
export const DASHBOARD_FEATURE_READ_OPERATIONS = [
  'restaurant.portfolio',
  'restaurant.detail',
  'menu.management',
  'menu.kitchen-stations',
  'theme.menu-references',
  'tables.list',
  'settings.snapshot',
] as const

export type DashboardFeatureReadOperation = typeof DASHBOARD_FEATURE_READ_OPERATIONS[number]

type DashboardFeatureReadPolicy = {
  /** Any listed section grants this tenant-bound snapshot. */
  permissions: readonly string[]
}

export const DASHBOARD_FEATURE_READ_POLICIES: Record<
  Exclude<DashboardFeatureReadOperation, 'restaurant.portfolio'>,
  DashboardFeatureReadPolicy
> = {
  'restaurant.detail': { permissions: [] },
  'menu.management': { permissions: ['menu'] },
  'menu.kitchen-stations': { permissions: ['menu', 'settings'] },
  'theme.menu-references': { permissions: ['theme'] },
  'tables.list': { permissions: ['tables'] },
  'settings.snapshot': { permissions: ['settings'] },
}

/** Tenant and section gate shared by every dashboard feature read. */
export function authorizeDashboardFeatureRead(
  context: DashboardActorContext,
  restaurantId: string,
  operation: Exclude<DashboardFeatureReadOperation, 'restaurant.portfolio'>,
): Result<true> {
  const policy = DASHBOARD_FEATURE_READ_POLICIES[operation]
  const hasPermission = policy.permissions.length === 0
    || policy.permissions.some((permission) => context.permissions.includes(permission))
  return hasSameRestaurant(context, restaurantId) && hasPermission
    ? ok(true)
    : err('Not authorized')
}
