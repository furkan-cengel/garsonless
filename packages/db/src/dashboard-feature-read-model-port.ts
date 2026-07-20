import type { MenuManagementReadModelPort } from '@garsonless/application/menu'
import type { DashboardRestaurantReadModelPort } from '@garsonless/application/restaurants'
import type { DashboardTablesReadModelPort } from '@garsonless/application/tables'
import type { ThemeMenuReferenceReadModelPort } from '@garsonless/application/themes'
import type { DashboardSettingsReadModelPort } from '@garsonless/application/settings'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'
import { DASHBOARD_FEATURE_READ_PROJECTIONS as projection } from './dashboard-feature-read-model-contract'
import { listTeamMembers, type TeamMember } from './team'
import type { Tables } from './types.gen'

type RestaurantRow = Tables<'restaurants'>
type MenuCategoryRow = Tables<'menu_categories'>
type MenuItemRow = Tables<'menu_items'>
type KitchenStationRow = Tables<'kitchen_stations'>
type TableRow = Tables<'tables'>
type SecurityEventRow = {
  id: string
  eventType: 'login' | 'password_change'
  ip: string | null
  userAgent: string | null
  createdAt: string
}

function dbError(fallback: string, error: { message: string } | null) {
  return error?.message ? `${fallback}: ${error.message}` : fallback
}

export function createDashboardRestaurantReadModelPort(): DashboardRestaurantReadModelPort<RestaurantRow> {
  return {
    async listAccessible({ userId }) {
      const service = createServiceClient()
      const [{ data: owned, error: ownedError }, { data: memberships, error: membershipError }] = await Promise.all([
        service.from('restaurants')
          .select(projection.restaurant)
          .eq('owner_id', userId)
          .is('deleted_at', null),
        service.from('restaurant_members')
          .select('restaurant_id')
          .eq('user_id', userId)
          .eq('status', 'active'),
      ])
      if (ownedError) return err(dbError('İşletmeler yüklenemedi', ownedError))
      if (membershipError) return err(dbError('Üyelikler yüklenemedi', membershipError))

      const ownedRows = (owned ?? []) as unknown as RestaurantRow[]
      const ownedIds = new Set(ownedRows.map((restaurant) => restaurant.id))
      const memberIds = ((memberships ?? []) as Array<{ restaurant_id: string }>)
        .map((membership) => membership.restaurant_id)
        .filter((id) => !ownedIds.has(id))

      let memberRows: RestaurantRow[] = []
      if (memberIds.length > 0) {
        const { data, error } = await service.from('restaurants')
          .select(projection.restaurant)
          .in('id', memberIds)
          .is('deleted_at', null)
        if (error) return err(dbError('Üye işletmeleri yüklenemedi', error))
        memberRows = (data ?? []) as unknown as RestaurantRow[]
      }

      return ok([...ownedRows, ...memberRows]
        .sort((left, right) => left.created_at.localeCompare(right.created_at)))
    },

    async readById({ restaurantId }) {
      const { data, error } = await createServiceClient().from('restaurants')
        .select(projection.restaurant)
        .eq('id', restaurantId)
        .is('deleted_at', null)
        .maybeSingle()
      return error
        ? err(dbError('İşletme yüklenemedi', error))
        : ok(data as unknown as RestaurantRow | null)
    },
  }
}

export function createMenuManagementReadModelPort(): MenuManagementReadModelPort<
  MenuCategoryRow,
  MenuItemRow,
  KitchenStationRow
> {
  return {
    async readManagementData({ restaurantId }) {
      const service = createServiceClient()
      const [categoryResult, stationResult] = await Promise.all([
        service.from('menu_categories')
          .select(projection.menuCategory)
          .eq('restaurant_id', restaurantId)
          .is('deleted_at', null)
          .order('position'),
        service.from('kitchen_stations')
          .select(projection.kitchenStation)
          .eq('restaurant_id', restaurantId)
          .order('position'),
      ])
      if (categoryResult.error) return err('Kategoriler yüklenemedi.')
      if (stationResult.error) return err('Mutfak istasyonları yüklenemedi.')

      const categories = (categoryResult.data ?? []) as unknown as MenuCategoryRow[]
      let items: MenuItemRow[] = []
      if (categories.length > 0) {
        const itemResult = await service.from('menu_items')
          .select(projection.menuItem)
          .in('category_id', categories.map((category) => category.id))
          .is('deleted_at', null)
          .order('position')
        if (itemResult.error) return err('Ürünler yüklenemedi.')
        items = (itemResult.data ?? []) as unknown as MenuItemRow[]
      }

      return ok({
        categories,
        items,
        kitchenStations: (stationResult.data ?? []) as unknown as KitchenStationRow[],
      })
    },

    async readKitchenStations({ restaurantId }) {
      const { data, error } = await createServiceClient().from('kitchen_stations')
        .select(projection.kitchenStation)
        .eq('restaurant_id', restaurantId)
        .order('position')
      return error
        ? err(dbError('Mutfak istasyonları yüklenemedi', error))
        : ok((data ?? []) as unknown as KitchenStationRow[])
    },
  }
}

export interface ThemeEditorCategoryRow {
  id: string
  name: string
  parent_id: string | null
}

export interface ThemeEditorItemRow {
  id: string
  name: string
  category_id: string
}

export function createThemeMenuReferenceReadModelPort(): ThemeMenuReferenceReadModelPort<
  ThemeEditorCategoryRow,
  ThemeEditorItemRow
> {
  return {
    async readMenuReferences({ restaurantId }) {
      const service = createServiceClient()
      const { data: categories, error: categoryError } = await service.from('menu_categories')
        .select('id, name, parent_id')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('position')
      if (categoryError) return err(dbError('Tema kategorileri yüklenemedi', categoryError))

      const categoryRows = (categories ?? []) as ThemeEditorCategoryRow[]
      if (categoryRows.length === 0) return ok({ categories: [], items: [] })

      const { data: items, error: itemError } = await service.from('menu_items')
        .select('id, name, category_id')
        .in('category_id', categoryRows.map((category) => category.id))
        .is('deleted_at', null)
        .order('position')
      if (itemError) return err(dbError('Tema ürün referansları yüklenemedi', itemError))
      return ok({
        categories: categoryRows,
        items: (items ?? []) as ThemeEditorItemRow[],
      })
    },
  }
}

export function createDashboardTablesReadModelPort(): DashboardTablesReadModelPort<TableRow> {
  return {
    async readTables({ restaurantId }) {
      const { data, error } = await createServiceClient().from('tables')
        .select(projection.table)
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('created_at')
      return error
        ? err(dbError('Masalar yüklenemedi', error))
        : ok((data ?? []) as unknown as TableRow[])
    },
  }
}

export function createDashboardSettingsReadModelPort(): DashboardSettingsReadModelPort<
  KitchenStationRow,
  TeamMember,
  SecurityEventRow
> {
  return {
    async readSettings({ restaurantId, userId, includeOwnerData }) {
      const service = createServiceClient()
      const [credentialResult, securityResult, ownerResult] = await Promise.all([
        service.from('kitchen_credentials')
          .select(projection.kitchenCredential)
          .eq('restaurant_id', restaurantId)
          .maybeSingle(),
        service.from('security_events')
          .select(projection.securityEvent)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20),
        includeOwnerData
          ? Promise.all([
            service.from('kitchen_stations')
              .select(projection.kitchenStation)
              .eq('restaurant_id', restaurantId)
              .order('position'),
            listTeamMembers(restaurantId),
          ])
          : Promise.resolve(null),
      ])
      if (credentialResult.error) return err(dbError('Mutfak erişimi yüklenemedi', credentialResult.error))
      if (securityResult.error) return err(dbError('Güvenlik etkinlikleri yüklenemedi', securityResult.error))

      let kitchenStations: KitchenStationRow[] = []
      let teamMembers: TeamMember[] = []
      if (ownerResult) {
        const [stationResult, members] = ownerResult
        if (stationResult.error) return err(dbError('Mutfak istasyonları yüklenemedi', stationResult.error))
        kitchenStations = (stationResult.data ?? []) as unknown as KitchenStationRow[]
        teamMembers = members
      }

      return ok({
        hasKitchenAccess: credentialResult.data !== null,
        kitchenStations,
        teamMembers,
        securityEvents: ((securityResult.data ?? []) as Array<{
          id: string; event_type: string; ip: string | null; user_agent: string | null; created_at: string
        }>).map((row) => ({
          id: row.id,
          eventType: row.event_type === 'password_change' ? 'password_change' : 'login',
          ip: row.ip,
          userAgent: row.user_agent,
          createdAt: row.created_at,
        })),
      })
    },
  }
}
