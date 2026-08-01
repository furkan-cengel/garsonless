/**
 * Pinned PostgREST projections for dashboard feature snapshots. They are kept
 * separate from the repository implementation so widening a feature payload
 * is an explicit, reviewable contract change.
 */
export const DASHBOARD_FEATURE_READ_PROJECTIONS = {
  restaurant: [
    'id', 'owner_id', 'slug', 'name', 'logo_url', 'settings', 'qr_style_revision',
    'table_layout_revision', 'table_layout_initialized_at', 'timezone',
    'plan', 'created_at', 'updated_at',
  ].join(', '),
  // Rolling-deploy fallback used only when the additive floor-layout migration
  // has not reached a database yet. Save remains unavailable until the RPC is
  // present; this projection prevents an otherwise valid restaurant becoming a
  // misleading route-level 404 during the migration window.
  restaurantBeforeTableLayout: [
    'id', 'owner_id', 'slug', 'name', 'logo_url', 'settings', 'qr_style_revision',
    'timezone', 'plan', 'created_at', 'updated_at',
  ].join(', '),
  menuCategory: [
    'id', 'restaurant_id', 'name', 'description', 'image_url', 'parent_id',
    'position', 'is_visible', 'vat_rate', 'kitchen_station_id', 'created_at', 'updated_at',
  ].join(', '),
  menuItem: [
    'id', 'category_id', 'name', 'description', 'price', 'cost', 'vat_rate',
    'position', 'is_available', 'earns_stamp', 'kitchen_station_id', 'ingredients',
    'energy_kcal', 'protein_g', 'carb_g', 'fat_g', 'contains_allergens',
    'may_contain_allergens', 'allergen_note', 'cross_contact_note', 'contains_alcohol',
    'contains_pork', 'is_vegetarian', 'is_vegan', 'is_halal', 'food_info_reviewed_at',
    'food_info_reviewed_by', 'modifier_groups', 'images', 'created_at', 'updated_at',
  ].join(', '),
  kitchenStation: [
    'id', 'restaurant_id', 'name', 'color', 'position', 'is_active', 'created_at', 'updated_at',
  ].join(', '),
  table: [
    // `qr_code_url` is a retired, unwritten column and is intentionally absent.
    'id', 'restaurant_id', 'label', 'floor_label', 'area_label',
    'layout_x_bp', 'layout_y_bp', 'layout_shape', 'layout_rotation', 'seat_count',
    'created_at', 'updated_at',
  ].join(', '),
  tableBeforeFloorLayout: [
    'id', 'restaurant_id', 'label', 'floor_label', 'area_label',
    'created_at', 'updated_at',
  ].join(', '),
  kitchenCredential: 'restaurant_id',
  securityEvent: 'id, event_type, ip, user_agent, created_at',
} as const

export type DashboardFeatureReadProjection = keyof typeof DASHBOARD_FEATURE_READ_PROJECTIONS
