import type { BillableFeature, RestaurantPlan } from '@garsonless/domain/entitlements'
import type { Section } from './access-policy'

export const DASHBOARD_SECTION_FEATURES: Readonly<Partial<Record<Section, BillableFeature>>> = {
  pano: 'analytics_basic',
  orders: 'staff_orders',
  menu: 'qr_menu',
  tables: 'qr_studio',
  customers: 'customer_accounts',
  analytics: 'analytics_basic',
  inventory: 'inventory_management',
  theme: 'theme_editor',
}

type DashboardSectionEntitlement = {
  allowed: boolean
  feature: BillableFeature | null
  requiredPlan: RestaurantPlan | null
  requiredPlanLabel: string | null
}

export type DashboardSectionEntitlements = Record<Section, DashboardSectionEntitlement>
