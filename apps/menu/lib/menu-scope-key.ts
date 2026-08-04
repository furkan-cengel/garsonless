export function menuTenantScopeKey(restaurantId: string, tableToken: string | null): string {
  return `v1:${restaurantId}:${tableToken ?? 'menu'}`
}
