/**
 * Prepares the isolated tenant used to record the "Menü & Tema" Supademo.
 *
 * Inspect: pnpm --filter @garsonless/db prepare:supademo-menu-theme
 * Reset:   pnpm --filter @garsonless/db prepare:supademo-menu-theme -- --apply
 *
 * The script intentionally refuses to mutate a slug that is not explicitly a
 * demo tenant. The production-like maf-lounge fixture is only used to resolve
 * the owner account and is never modified.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

import { DEFAULT_THEME } from '../../design-engine/src/schema'
import { CANONICAL_THEME_ID } from '../../design-engine/src/theme-policy'
import {
  fingerprintThemeDraftSave,
  fingerprintThemePublish,
} from '../src/theme-publish-fingerprint'
import type { Database, Json } from '../src/types.gen'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDir, '../../..')
loadEnv({ path: join(repoRoot, 'apps/dashboard/.env.local') })

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const SOURCE_SLUG = process.env['SUPADEMO_SOURCE_SLUG'] ?? 'maf-lounge'
const TARGET_SLUG = process.env['SUPADEMO_RESTAURANT_SLUG'] ?? 'maf-lounge-demo'
const OWNER_EMAIL = process.env['SUPADEMO_OWNER_EMAIL']?.trim()
const APPLY = process.argv.includes('--apply')

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing Supabase service credentials in apps/dashboard/.env.local')
}

if (TARGET_SLUG === SOURCE_SLUG || !/(?:demo|supademo)/i.test(TARGET_SLUG)) {
  throw new Error('Refusing to reset a non-demo tenant. SUPADEMO_RESTAURANT_SLUG must contain "demo".')
}

const supabase = createSupabaseClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const IDS = {
  kitchen: '31000000-0000-4000-8000-000000000001',
  bar: '31000000-0000-4000-8000-000000000002',
  breakfast: '32000000-0000-4000-8000-000000000001',
  coffee: '32000000-0000-4000-8000-000000000002',
  beverages: '32000000-0000-4000-8000-000000000003',
  desserts: '32000000-0000-4000-8000-000000000004',
  serpme: '33000000-0000-4000-8000-000000000001',
  menemen: '33000000-0000-4000-8000-000000000002',
  avocado: '33000000-0000-4000-8000-000000000003',
  coffeeItem: '33000000-0000-4000-8000-000000000004',
  orangeJuice: '33000000-0000-4000-8000-000000000005',
  tiramisu: '33000000-0000-4000-8000-000000000006',
  table5: '34000000-0000-4000-8000-000000000005',
  logoAsset: '35000000-0000-4000-8000-000000000001',
  foodAsset: '35000000-0000-4000-8000-000000000002',
  recommendation: '36000000-0000-4000-8000-000000000001',
} as const

function assertOk(label: string, error: { message?: string } | null): void {
  if (error) throw new Error(`${label}: ${error.message ?? 'Unknown Supabase error'}`)
}

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json
}

async function resolveOwnerId(): Promise<string> {
  if (OWNER_EMAIL) {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    assertOk('List auth users', error)
    const owner = data.users.find((user) => user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase())
    if (!owner) throw new Error(`SUPADEMO_OWNER_EMAIL was not found: ${OWNER_EMAIL}`)
    return owner.id
  }

  const { data, error } = await supabase
    .from('restaurants')
    .select('owner_id')
    .eq('slug', SOURCE_SLUG)
    .maybeSingle()
  assertOk('Read source restaurant owner', error)
  if (!data?.owner_id) {
    throw new Error(`Source restaurant "${SOURCE_SLUG}" was not found. Set SUPADEMO_OWNER_EMAIL.`)
  }
  return data.owner_id
}

async function uploadAsset(path: string, filePath: string, contentType: string): Promise<string> {
  const { error } = await supabase.storage
    .from('restaurant-assets')
    .upload(path, readFileSync(filePath), {
      cacheControl: '31536000',
      contentType,
      upsert: true,
    })
  assertOk(`Upload ${path}`, error)
  return supabase.storage.from('restaurant-assets').getPublicUrl(path).data.publicUrl
}

function option(
  id: string,
  name: string,
  priceDelta: number,
  isDefault = false,
): Record<string, unknown> {
  return {
    id,
    name,
    price_delta: priceDelta,
    calorie_delta: 0,
    is_default: isDefault,
    allergen_codes: [],
  }
}

async function publishBaselineTheme(restaurantId: string, ownerId: string): Promise<void> {
  const theme = {
    ...DEFAULT_THEME,
    __template_id: CANONICAL_THEME_ID,
    bg: '#f8f9f8',
    cardColor: '#ffffff',
    textColor: '#1c1d20',
    mutedTextColor: '#6c6f76',
    borderColor: '#e3e4e7',
    accent: '#2e7d52',
    accentSoft: '#d2f4e2',
    cta: '#38a169',
    ctaTextColor: '#ffffff',
    cols: 2,
    gap: 12,
    radius: 14,
    shadow: 'soft',
    headerLogoStyle: 'display',
    motion: 'full',
  }
  const tokens = asJson(theme)

  const { data: currentTheme, error: themeReadError } = await supabase
    .from('theme_configs')
    .select('revision')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  assertOk('Read published theme revision', themeReadError)
  const expectedRevision = currentTheme?.revision ?? 0
  const publishFingerprint = fingerprintThemePublish({
    restaurantId,
    templateId: CANONICAL_THEME_ID,
    tokens,
    publishedBy: ownerId,
    expectedRevision,
  })
  const { error: publishError } = await supabase.rpc('publish_theme_config_atomic', {
    p_restaurant_id: restaurantId,
    p_template_id: CANONICAL_THEME_ID,
    p_tokens: tokens,
    p_published_by: ownerId,
    p_expected_revision: expectedRevision,
    p_request_id: crypto.randomUUID(),
    p_request_fingerprint: publishFingerprint,
  })
  assertOk('Publish Supademo baseline theme', publishError)

  const { data: currentDraft, error: draftReadError } = await supabase
    .from('theme_drafts')
    .select('revision')
    .eq('restaurant_id', restaurantId)
    .maybeSingle()
  assertOk('Read draft theme revision', draftReadError)
  const expectedDraftRevision = currentDraft?.revision ?? 0
  const draftFingerprint = fingerprintThemeDraftSave({
    restaurantId,
    templateId: CANONICAL_THEME_ID,
    tokens,
    savedBy: ownerId,
    expectedRevision: expectedDraftRevision,
  })
  const { error: draftError } = await supabase.rpc('save_theme_draft_atomic', {
    p_restaurant_id: restaurantId,
    p_template_id: CANONICAL_THEME_ID,
    p_tokens: tokens,
    p_saved_by: ownerId,
    p_expected_revision: expectedDraftRevision,
    p_request_id: crypto.randomUUID(),
    p_request_fingerprint: draftFingerprint,
  })
  assertOk('Save Supademo baseline draft', draftError)
}

async function inspect(): Promise<void> {
  const { data: restaurant, error } = await supabase
    .from('restaurants')
    .select('id, name, slug, logo_url')
    .eq('slug', TARGET_SLUG)
    .maybeSingle()
  assertOk('Inspect demo restaurant', error)

  if (!restaurant) {
    console.log(JSON.stringify({ ready: false, slug: TARGET_SLUG, next: 'Run again with --apply' }, null, 2))
    return
  }

  const [{ count: categories }, { count: items }, { count: tables }, { data: menemen }] = await Promise.all([
    supabase.from('menu_categories').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
    supabase.from('menu_items').select('id, menu_categories!inner(restaurant_id)', { count: 'exact', head: true }).eq('menu_categories.restaurant_id', restaurant.id),
    supabase.from('tables').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurant.id),
    supabase.from('menu_items').select('id, name, images, modifier_groups, ingredients').eq('id', IDS.menemen).maybeSingle(),
  ])

  console.log(JSON.stringify({
    ready: Boolean(menemen && restaurant.logo_url && categories === 4 && items === 6 && tables === 1),
    restaurant,
    counts: { categories, items, tables },
    featuredItem: menemen?.name ?? null,
    routes: {
      menu: `http://localhost:3011/${TARGET_SLUG}`,
      dashboardMenu: `http://localhost:3000/dashboard/${restaurant.id}/menu`,
      themeEditor: `http://localhost:3000/dashboard/${restaurant.id}/theme/default/edit`,
    },
  }, null, 2))
}

async function apply(): Promise<void> {
  const ownerId = await resolveOwnerId()
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .upsert({
      slug: TARGET_SLUG,
      name: 'MAF Cafe Lounge',
      owner_id: ownerId,
      plan: 'pro',
      settings: {},
      deleted_at: null,
    }, { onConflict: 'slug' })
    .select('id')
    .single()
  assertOk('Upsert Supademo restaurant', restaurantError)
  const restaurantId = restaurant.id

  const logoPath = `${ownerId}/${restaurantId}/logo-${IDS.logoAsset}.png`
  const logoUrl = await uploadAsset(
    logoPath,
    join(repoRoot, 'assets/brand/masabu-logo-transparent-512px.png'),
    'image/png',
  )
  const { error: logoUpdateError } = await supabase
    .from('restaurants')
    .update({ logo_url: logoUrl })
    .eq('id', restaurantId)
  assertOk('Attach restaurant logo', logoUpdateError)

  const { error: recommendationDeleteError } = await supabase
    .from('menu_item_recommendations')
    .delete()
    .eq('restaurant_id', restaurantId)
  assertOk('Clear recommendations', recommendationDeleteError)

  const { data: oldCategories, error: oldCategoryReadError } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId)
  assertOk('Read old categories', oldCategoryReadError)
  if (oldCategories.length > 0) {
    const { error: itemDeleteError } = await supabase
      .from('menu_items')
      .delete()
      .in('category_id', oldCategories.map((category) => category.id))
    assertOk('Clear menu items', itemDeleteError)
  }
  const { error: categoryDeleteError } = await supabase.from('menu_categories').delete().eq('restaurant_id', restaurantId)
  assertOk('Clear categories', categoryDeleteError)
  const { error: stationDeleteError } = await supabase.from('kitchen_stations').delete().eq('restaurant_id', restaurantId)
  assertOk('Clear kitchen stations', stationDeleteError)
  const { error: tableDeleteError } = await supabase.from('tables').delete().eq('restaurant_id', restaurantId)
  assertOk('Clear tables', tableDeleteError)

  const { error: stationError } = await supabase.from('kitchen_stations').insert([
    { id: IDS.kitchen, restaurant_id: restaurantId, name: 'Mutfak', color: '#2e7d52', position: 1, is_active: true },
    { id: IDS.bar, restaurant_id: restaurantId, name: 'Bar', color: '#b7791f', position: 2, is_active: true },
  ])
  assertOk('Insert kitchen stations', stationError)

  const foodPath = `restaurants/${restaurantId}/items/${IDS.menemen}/${IDS.foodAsset}.webp`
  const foodUrl = await uploadAsset(
    foodPath,
    join(repoRoot, 'apps/marketing/public/hero/turkish-breakfast-order.webp'),
    'image/webp',
  )

  const { error: categoryError } = await supabase.from('menu_categories').insert([
    { id: IDS.breakfast, restaurant_id: restaurantId, name: 'Kahvaltı', description: 'Güne iyi başlayan tabaklar', image_url: foodUrl, kitchen_station_id: IDS.kitchen, vat_rate: 10, position: 1, is_visible: true },
    { id: IDS.coffee, restaurant_id: restaurantId, name: 'Kahveler', description: 'Sıcak kahve çeşitleri', kitchen_station_id: IDS.bar, vat_rate: 10, position: 2, is_visible: true },
    { id: IDS.beverages, restaurant_id: restaurantId, name: 'İçecekler', description: 'Taze ve soğuk içecekler', kitchen_station_id: IDS.bar, vat_rate: 10, position: 3, is_visible: true },
    { id: IDS.desserts, restaurant_id: restaurantId, name: 'Tatlılar', description: 'Günün tatlıları', kitchen_station_id: IDS.kitchen, vat_rate: 10, position: 4, is_visible: true },
  ])
  assertOk('Insert menu categories', categoryError)

  const reviewedAt = new Date().toISOString()
  const menemenGroups = [{
    id: 'menemen-cook',
    name: 'Pişirme tercihi',
    selection_mode: 'single',
    required: true,
    min: 1,
    max: 1,
    options: [
      option('menemen-cook-soft', 'Az pişmiş', 0),
      option('menemen-cook-medium', 'Orta pişmiş', 0, true),
      option('menemen-cook-well', 'İyi pişmiş', 0),
    ],
  }, {
    id: 'menemen-extra',
    name: 'Ekstralar',
    selection_mode: 'multiple',
    required: false,
    min: 0,
    max: 2,
    options: [
      option('menemen-extra-sucuk', 'Sucuk', 40),
      option('menemen-extra-pastirma', 'Pastırma', 50),
    ],
  }]

  const demoItems = [
    { id: IDS.serpme, category_id: IDS.breakfast, name: 'Serpme Kahvaltı', description: 'İki kişilik zengin kahvaltı seçkisi', price: 380, cost: 150, vat_rate: 10, kitchen_station_id: IDS.kitchen, images: [], ingredients: [], modifier_groups: [], is_available: true, is_halal: true, position: 1 },
    { id: IDS.menemen, category_id: IDS.breakfast, name: 'Menemen', description: 'Domates, köy biberi ve gezen tavuk yumurtası', price: 180, cost: 72, vat_rate: 10, kitchen_station_id: IDS.kitchen, images: [foodUrl], ingredients: [
      { id: 'tomato', name: 'Domates', removable: false, allergen_codes: [], amount: '120 g' },
      { id: 'pepper', name: 'Köy biberi', removable: true, allergen_codes: [], amount: '40 g' },
      { id: 'egg', name: 'Yumurta', removable: false, allergen_codes: ['eggs'], amount: '2 adet' },
      { id: 'butter', name: 'Tereyağı', removable: true, allergen_codes: ['milk'], amount: '12 g' },
    ], modifier_groups: menemenGroups, energy_kcal: 250, protein_g: 16, carb_g: 12, fat_g: 16, contains_allergens: ['eggs', 'milk'], may_contain_allergens: [], allergen_note: 'Yumurta ve süt ürünü içerir.', cross_contact_note: 'Gluten içeren ürünlerin hazırlandığı mutfakta üretilir.', contains_alcohol: false, contains_pork: false, is_vegetarian: true, is_vegan: false, is_halal: true, food_info_reviewed_at: reviewedAt, food_info_reviewed_by: ownerId, earns_stamp: true, is_available: true, position: 2 },
    { id: IDS.avocado, category_id: IDS.breakfast, name: 'Avokado Toast', description: 'Ekşi maya ekmeği ve taze avokado', price: 220, cost: 88, vat_rate: 10, kitchen_station_id: IDS.kitchen, images: [], ingredients: [], modifier_groups: [], is_available: true, is_vegetarian: true, position: 3 },
    { id: IDS.coffeeItem, category_id: IDS.coffee, name: 'Türk Kahvesi', description: 'Geleneksel sunumuyla', price: 75, cost: 18, vat_rate: 10, kitchen_station_id: IDS.bar, images: [], ingredients: [], modifier_groups: [], is_available: true, is_halal: true, earns_stamp: true, position: 1 },
    { id: IDS.orangeJuice, category_id: IDS.beverages, name: 'Taze Portakal Suyu', description: 'Sipariş üzerine taze sıkılır', price: 80, cost: 30, vat_rate: 10, kitchen_station_id: IDS.bar, images: [], ingredients: [], modifier_groups: [], energy_kcal: 110, is_available: true, is_vegan: true, is_vegetarian: true, is_halal: true, position: 1 },
    { id: IDS.tiramisu, category_id: IDS.desserts, name: 'Tiramisu', description: 'Mascarpone ve espresso', price: 195, cost: 70, vat_rate: 10, kitchen_station_id: IDS.kitchen, images: [], ingredients: [], modifier_groups: [], contains_allergens: ['eggs', 'milk', 'gluten'], is_available: true, is_vegetarian: true, position: 1 },
  ]
  const { error: itemError } = await supabase.from('menu_items').insert(demoItems.map((item) => ({
    energy_kcal: null,
    protein_g: null,
    carb_g: null,
    fat_g: null,
    contains_allergens: [],
    may_contain_allergens: [],
    allergen_note: null,
    cross_contact_note: null,
    contains_alcohol: false,
    contains_pork: false,
    is_vegetarian: false,
    is_vegan: false,
    is_halal: false,
    food_info_reviewed_at: null,
    food_info_reviewed_by: null,
    earns_stamp: false,
    deleted_at: null,
    ...item,
  })))
  assertOk('Insert demo menu items', itemError)

  const { error: recommendationError } = await supabase.from('menu_item_recommendations').insert({
    id: IDS.recommendation,
    restaurant_id: restaurantId,
    source_item_id: IDS.menemen,
    recommended_item_id: IDS.orangeJuice,
    position: 1,
  })
  assertOk('Insert Menemen recommendation', recommendationError)

  const { error: tableError } = await supabase.from('tables').insert({
    id: IDS.table5,
    restaurant_id: restaurantId,
    label: 'Masa 5',
    floor_label: 'Zemin Kat',
    area_label: 'Salon',
    seat_count: 4,
    layout_x_bp: 5000,
    layout_y_bp: 4200,
  })
  assertOk('Insert Masa 5', tableError)

  await publishBaselineTheme(restaurantId, ownerId)
  await inspect()
}

async function main(): Promise<void> {
  if (APPLY) {
    console.log(`Resetting isolated Supademo tenant: ${TARGET_SLUG}`)
    await apply()
    return
  }
  await inspect()
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
