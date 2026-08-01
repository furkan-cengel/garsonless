import type { MenuManagementReadModelPort } from '@garsonless/application/menu'
import type { DashboardRestaurantReadModelPort } from '@garsonless/application/restaurants'
import type { DashboardTablesReadModelPort } from '@garsonless/application/tables'
import type { ThemeMenuReferenceReadModelPort } from '@garsonless/application/themes'
import type { DashboardSettingsReadModelPort } from '@garsonless/application/settings'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'
import { DASHBOARD_FEATURE_READ_PROJECTIONS as projection } from './dashboard-feature-read-model-contract'
import { TEAM_SECURITY_EVENT_TYPES, type TeamSecurityEventType } from './security'
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

export interface TeamAuditEventRow {
  id: string
  eventType: TeamSecurityEventType
  targetEmail: string | null
  permissions: string[]
  createdAt: string
}

function readTeamAuditMetadata(value: unknown): Pick<TeamAuditEventRow, 'targetEmail' | 'permissions'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { targetEmail: null, permissions: [] }
  }
  const metadata = value as Record<string, unknown>
  return {
    targetEmail: typeof metadata['targetEmail'] === 'string' ? metadata['targetEmail'] : null,
    permissions: Array.isArray(metadata['permissions'])
      ? metadata['permissions'].filter((permission): permission is string => typeof permission === 'string')
      : [],
  }
}

function dbError(fallback: string, error: { message: string } | null) {
  return error?.message ? `${fallback}: ${error.message}` : fallback
}

function isUndefinedColumn(error: { code?: string } | null): boolean {
  return error?.code === '42703'
}

function withDefaultTableLayoutRestaurant(row: unknown): RestaurantRow {
  return {
    ...(row as RestaurantRow),
    table_layout_revision: 0,
    table_layout_initialized_at: null,
  }
}

function withDefaultTableLayoutTable(row: unknown): TableRow {
  return {
    ...(row as TableRow),
    layout_x_bp: null,
    layout_y_bp: null,
    layout_shape: 'rectangle',
    layout_rotation: 0,
    seat_count: 4,
  }
}

export function createDashboardRestaurantReadModelPort(): DashboardRestaurantReadModelPort<RestaurantRow> {
  return {
    async listAccessible({ userId }) {
      const service = createServiceClient()
      const [ownedResult, membershipResult] = await Promise.all([
        service.from('restaurants')
          .select(projection.restaurant)
          .eq('owner_id', userId)
          .is('deleted_at', null),
        service.from('restaurant_members')
          .select('restaurant_id')
          .eq('user_id', userId)
          .eq('status', 'active'),
      ])
      let { data: owned, error: ownedError } = ownedResult
      const { data: memberships, error: membershipError } = membershipResult
      let usedLayoutFallback = false
      if (isUndefinedColumn(ownedError)) {
        const fallback = await service.from('restaurants')
          .select(projection.restaurantBeforeTableLayout)
          .eq('owner_id', userId)
          .is('deleted_at', null)
        owned = fallback.data
        ownedError = fallback.error
        usedLayoutFallback = true
      }
      if (ownedError) return err(dbError('İşletmeler yüklenemedi', ownedError))
      if (membershipError) return err(dbError('Üyelikler yüklenemedi', membershipError))

      const ownedRows = usedLayoutFallback
        ? (owned ?? []).map(withDefaultTableLayoutRestaurant)
        : (owned ?? []) as unknown as RestaurantRow[]
      const ownedIds = new Set(ownedRows.map((restaurant) => restaurant.id))
      const memberIds = ((memberships ?? []) as Array<{ restaurant_id: string }>)
        .map((membership) => membership.restaurant_id)
        .filter((id) => !ownedIds.has(id))

      let memberRows: RestaurantRow[] = []
      if (memberIds.length > 0) {
        const memberProjection = usedLayoutFallback
          ? projection.restaurantBeforeTableLayout
          : projection.restaurant
        const { data, error } = await service.from('restaurants')
          .select(memberProjection)
          .in('id', memberIds)
          .is('deleted_at', null)
        if (error) return err(dbError('Üye işletmeleri yüklenemedi', error))
        memberRows = usedLayoutFallback
          ? (data ?? []).map(withDefaultTableLayoutRestaurant)
          : (data ?? []) as unknown as RestaurantRow[]
      }

      return ok([...ownedRows, ...memberRows]
        .sort((left, right) => left.created_at.localeCompare(right.created_at)))
    },

    async readById({ restaurantId }) {
      const service = createServiceClient()
      let { data, error } = await service.from('restaurants')
        .select(projection.restaurant)
        .eq('id', restaurantId)
        .is('deleted_at', null)
        .maybeSingle()
      let usedLayoutFallback = false
      if (isUndefinedColumn(error)) {
        const fallback = await service.from('restaurants')
          .select(projection.restaurantBeforeTableLayout)
          .eq('id', restaurantId)
          .is('deleted_at', null)
          .maybeSingle()
        data = fallback.data
        error = fallback.error
        usedLayoutFallback = true
      }
      return error
        ? err(dbError('İşletme yüklenemedi', error))
        : ok(data && usedLayoutFallback
          ? withDefaultTableLayoutRestaurant(data)
          : data as unknown as RestaurantRow | null)
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

export type ThemeEditorCategoryRow = Pick<
  MenuCategoryRow,
  'id' | 'name' | 'parent_id' | 'image_url'
>

export type ThemeEditorItemRow = Pick<
  MenuItemRow,
  | 'id'
  | 'category_id'
  | 'name'
  | 'description'
  | 'price'
  | 'images'
  | 'ingredients'
  | 'energy_kcal'
  | 'contains_allergens'
  | 'may_contain_allergens'
  | 'allergen_note'
  | 'cross_contact_note'
  | 'contains_alcohol'
  | 'contains_pork'
  | 'is_vegetarian'
  | 'is_vegan'
  | 'is_halal'
  | 'food_info_reviewed_at'
  | 'modifier_groups'
  | 'is_available'
  | 'position'
>

export function createThemeMenuReferenceReadModelPort(): ThemeMenuReferenceReadModelPort<
  ThemeEditorCategoryRow,
  ThemeEditorItemRow
> {
  return {
    async readMenuReferences({ restaurantId }) {
      const service = createServiceClient()
      const { data: categories, error: categoryError } = await service.from('menu_categories')
        .select('id, name, parent_id, image_url')
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('position')
      if (categoryError) return err(dbError('Tema kategorileri yüklenemedi', categoryError))

      const categoryRows = (categories ?? []) as ThemeEditorCategoryRow[]
      if (categoryRows.length === 0) return ok({ categories: [], items: [] })

      const { data: items, error: itemError } = await service.from('menu_items')
        .select(projection.menuItem)
        .in('category_id', categoryRows.map((category) => category.id))
        .is('deleted_at', null)
        .order('position')
      if (itemError) return err(dbError('Tema ürün referansları yüklenemedi', itemError))
      return ok({
        categories: categoryRows,
        items: (items ?? []) as unknown as ThemeEditorItemRow[],
      })
    },
  }
}

export function createDashboardTablesReadModelPort(): DashboardTablesReadModelPort<TableRow> {
  return {
    async readTables({ restaurantId }) {
      const service = createServiceClient()
      let { data, error } = await service.from('tables')
        .select(projection.table)
        .eq('restaurant_id', restaurantId)
        .is('deleted_at', null)
        .order('created_at')
      let usedLayoutFallback = false
      if (isUndefinedColumn(error)) {
        const fallback = await service.from('tables')
          .select(projection.tableBeforeFloorLayout)
          .eq('restaurant_id', restaurantId)
          .is('deleted_at', null)
          .order('created_at')
        data = fallback.data
        error = fallback.error
        usedLayoutFallback = true
      }
      return error
        ? err(dbError('Masalar yüklenemedi', error))
        : ok(usedLayoutFallback
          ? (data ?? []).map(withDefaultTableLayoutTable)
          : (data ?? []) as unknown as TableRow[])
    },
  }
}

export function createDashboardSettingsReadModelPort(): DashboardSettingsReadModelPort<
  KitchenStationRow,
  TeamMember,
  SecurityEventRow,
  TeamAuditEventRow
> {
  return {
    async readSettings({ restaurantId, userId, includeOwnerData }) {
      const service = createServiceClient()
      const [credentialResult, securityResult, ownerResult, teamAuditResult] = await Promise.all([
        service.from('kitchen_credentials')
          .select(projection.kitchenCredential)
          .eq('restaurant_id', restaurantId)
          .maybeSingle(),
        service.from('security_events')
          .select(projection.securityEvent)
          .eq('user_id', userId)
          .in('event_type', ['login', 'password_change'])
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
        includeOwnerData
          ? service.from('security_events')
            .select('id, event_type, metadata, created_at')
            .eq('restaurant_id', restaurantId)
            .in('event_type', [...TEAM_SECURITY_EVENT_TYPES])
            .order('created_at', { ascending: false })
            .limit(20)
          : Promise.resolve(null),
      ])
      if (credentialResult.error) return err(dbError('Mutfak erişimi yüklenemedi', credentialResult.error))
      if (securityResult.error) return err(dbError('Güvenlik etkinlikleri yüklenemedi', securityResult.error))
      if (teamAuditResult?.error) return err(dbError('Ekip etkinlikleri yüklenemedi', teamAuditResult.error))

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
        teamAuditEvents: ((teamAuditResult?.data ?? []) as Array<{
          id: string; event_type: TeamSecurityEventType; metadata: unknown; created_at: string
        }>).map((row) => ({
          id: row.id,
          eventType: row.event_type,
          ...readTeamAuditMetadata(row.metadata),
          createdAt: row.created_at,
        })),
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
