import {
  getFeatureEntitlement, PLAN_DEFINITIONS, SELF_SERVE_PLANS,
  type BillableFeature, type RestaurantPlan, type SelfServePlan,
} from '@garsonless/domain/entitlements'

export function selectablePlans(currentPlan: RestaurantPlan, feature: BillableFeature, currentPlanAlreadyIncludesFeature: boolean): SelfServePlan[] {
  if (currentPlan === 'business') return []
  const currentIndex = SELF_SERVE_PLANS.indexOf(currentPlan)
  return SELF_SERVE_PLANS.filter((plan, index) =>
    index >= currentIndex && (currentPlanAlreadyIncludesFeature || index > currentIndex)
    && getFeatureEntitlement(plan, feature).allowed)
}

export function additionalFeatures(currentPlan: RestaurantPlan, selectedPlan: SelfServePlan): BillableFeature[] {
  return PLAN_DEFINITIONS[selectedPlan].features.filter((feature) => !PLAN_DEFINITIONS[currentPlan].features.includes(feature))
}

export const FEATURE_LABELS: Record<BillableFeature, string> = {
  multilingual_menu: 'Çoklu dil menü',
  inventory_management: 'Reçeteli stok takibi',
  qr_menu: 'Dijital menü',
  rich_product_content: 'Zengin ürün içeriği',
  theme_editor: 'Tema editörü',
  qr_studio: 'QR Studio',
  table_management: 'Canlı masa yönetimi',
  staff_orders: 'Personel siparişleri',
  settlement: 'Adisyon ve tahsilat',
  analytics_basic: 'Satış, ürün, masa ve ödeme raporları',
  team_management: 'Ekip yönetimi',
  guest_ordering: 'Misafir siparişleri',
  service_requests: 'Servis talepleri',
  kitchen_display: 'Mutfak ekranı',
  online_payments: 'Online ödeme',
  split_payments: 'Bölünmüş ödeme',
  customer_accounts: 'Müşteri hesapları',
  crm: 'Müşteri ilişkileri (CRM)',
  loyalty: 'Sadakat programı',
  campaigns: 'Kampanyalar',
  analytics_advanced: 'Gelişmiş raporlar',
  browser_notifications: 'Tarayıcı bildirimleri',
  theme_advanced_sections: 'Gelişmiş tema bölümleri',
  theme_video_hero: 'Video Hero',
  multi_location: 'Çoklu şube yönetimi',
}
