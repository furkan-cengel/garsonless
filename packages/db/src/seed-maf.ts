/**
 * Seed script: MAF Cafe Lounge test data
 * Run: pnpm --filter @garsonless/db seed:maf
 *
 * Idempotent — safe to run multiple times. Existing data for this slug is
 * cleared and re-created so the state is always predictable.
 *
 * Note: "growth" plan is not in the schema. Using "pro" as the closest match.
 */

import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config as loadEnv } from 'dotenv'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from './types.gen'

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
loadEnv({ path: join(__dirname, '../../../apps/dashboard/.env.local') })

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const OWNER_EMAIL = process.env['SEED_OWNER_EMAIL'] ?? 'furkan.cengel@hotellinkage.com'
// Kitchen token comes from env (never hardcoded) so this seed can be committed
// without leaking a working KDS token. See apps/dashboard/.env.example.
const MAF_KITCHEN_TOKEN = process.env['MAF_KITCHEN_TOKEN'] ?? ''

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in apps/dashboard/.env.local')
  process.exit(1)
}
if (!MAF_KITCHEN_TOKEN) {
  console.error('Missing MAF_KITCHEN_TOKEN in apps/dashboard/.env.local (kitchen access token for the seed).')
  process.exit(1)
}

const supabase = createSupabaseClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID()
}

function ok<T>(label: string, error: unknown, data?: T): T {
  if (error) {
    console.error(`✗ ${label}:`, error)
    process.exit(1)
  }
  console.log(`  ✓ ${label}`)
  return data as T
}

// ---------------------------------------------------------------------------
// Templates (inline to avoid bundling issues with design-engine)
// ---------------------------------------------------------------------------

const BEACHSIDE_CONFIG = {
  page: { backgroundColor: '#f8f9fa', fontFamily: 'Nunito', fontFamilyDisplay: 'Pacifico', baseFontSize: 16, globalRadius: 16 },
  header: { style: 'hero', backgroundColor: '#0077b6', textColor: '#ffffff', logoSize: 'large', sticky: false, showRestaurantName: true, borderBottom: false },
  categoryNav: { style: 'pills', backgroundColor: '#f8f9fa', textColor: '#4a8db5', activeColor: '#0077b6', activeTextColor: '#ffffff', fontSize: 'md', sticky: true },
  productCard: { layout: 'grid', imageRatio: '4:3', showDescription: true, descriptionLines: 2, borderRadius: 24, backgroundColor: '#ffffff', textColor: '#023e8a', priceColor: '#f77f00', addButtonStyle: 'full-width', addButtonColor: '#0077b6', addButtonTextColor: '#ffffff', showBadge: true, shadow: 'md' },
  cartDrawer: { position: 'bottom', backgroundColor: '#ffffff', textColor: '#023e8a', accentColor: '#f77f00', orderButtonStyle: 'floating', orderButtonColor: '#0077b6', orderButtonTextColor: '#ffffff', orderButtonRadius: 24 },
}

// ---------------------------------------------------------------------------
// Seed logic
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\n🌱  MAF Cafe seed starting…\n')

  // ── 1. Resolve owner ─────────────────────────────────────────────────────

  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error('Could not list users:', usersError.message)
    process.exit(1)
  }

  const owner =
    users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL.toLowerCase()) ?? users[0]

  if (!owner) {
    console.error('No auth users found in this Supabase project.')
    console.error('Sign up at the dashboard first, then re-run.')
    process.exit(1)
  }

  if (owner.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    console.log(`  (email ${OWNER_EMAIL} not found — using ${owner.email} instead)`)
  }

  const ownerId = owner.id
  console.log(`Owner: ${OWNER_EMAIL} (${ownerId})\n`)

  // ── 2. Upsert restaurant ─────────────────────────────────────────────────

  const { data: restaurant, error: restError } = await supabase
    .from('restaurants')
    .upsert(
      {
        slug: 'maf-lounge',
        name: 'MAF Cafe Lounge',
        owner_id: ownerId,
        plan: 'pro',
        settings: {
          ai_waiter_enabled: true,
          ai_persona_name: 'Maf',
          ai_tone: 'friendly',
          ai_language: 'tr',
          kitchen_token: MAF_KITCHEN_TOKEN,
        },
      },
      { onConflict: 'slug' },
    )
    .select('id')
    .single()

  const restaurantId: string = ok('Upsert restaurant', restError, restaurant!).id
  console.log(`  Restaurant ID: ${restaurantId}\n`)

  // ── 3. Tables (clear + re-insert) ────────────────────────────────────────

  const { error: delTablesErr } = await supabase
    .from('tables')
    .delete()
    .eq('restaurant_id', restaurantId)
  ok('Clear old tables', delTablesErr)

  const tableLabels = [
    ...Array.from({ length: 8 }, (_, i) => `Masa ${i + 1}`),
    ...Array.from({ length: 4 }, (_, i) => `Teras ${i + 1}`),
  ]

  const { error: tablesErr } = await supabase.from('tables').insert(
    tableLabels.map((label) => ({ restaurant_id: restaurantId, label })),
  )
  ok(`Insert ${tableLabels.length} tables`, tablesErr)

  // ── 4. Menu categories (clear + re-insert) ───────────────────────────────

  // Delete items first (FK dependency)
  const { data: existingCats } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurantId)

  if (existingCats && existingCats.length > 0) {
    const catIds = existingCats.map((c) => c.id)
    const { error: delItemsErr } = await supabase
      .from('menu_items')
      .delete()
      .in('category_id', catIds)
    ok('Clear old items', delItemsErr)
  }

  const { error: delCatsErr } = await supabase
    .from('menu_categories')
    .delete()
    .eq('restaurant_id', restaurantId)
  ok('Clear old categories', delCatsErr)

  const categoryNames = ['Kahvaltı', 'Kahveler', 'Tatlılar', 'İçecekler']
  const catIds: Record<string, string> = {}

  const { data: cats, error: catsErr } = await supabase
    .from('menu_categories')
    .insert(
      categoryNames.map((name, i) => ({
        restaurant_id: restaurantId,
        name,
        position: i + 1,
        is_visible: true,
      })),
    )
    .select('id, name')
  ok('Insert categories', catsErr)
  cats!.forEach((c) => { catIds[c.name] = c.id })
  console.log(`  Category IDs: ${JSON.stringify(catIds)}\n`)

  // ── 5. Menu items ────────────────────────────────────────────────────────

  // Modifier group builders
  function required(name: string, options: { name: string; price_delta?: number; is_default?: boolean }[]): Json {
    return {
      id: uuid(),
      name,
      type: 'required',
      min: 1,
      max: 1,
      options: options.map((o) => ({
        id: uuid(),
        name: o.name,
        price_delta: o.price_delta ?? 0,
        is_default: o.is_default ?? false,
      })),
    }
  }

  function optional(name: string, options: { name: string; price_delta?: number }[]): Json {
    return {
      id: uuid(),
      name,
      type: 'optional',
      min: 0,
      max: options.length,
      options: options.map((o) => ({
        id: uuid(),
        name: o.name,
        price_delta: o.price_delta ?? 0,
        is_default: false,
      })),
    }
  }

  const MILK = required('Süt seçimi', [
    { name: 'Normal süt', is_default: true },
    { name: 'Oat milk', price_delta: 15 },
    { name: 'Badem sütü', price_delta: 15 },
  ])

  const SAUCE = optional('Sos seçimi', [
    { name: 'Çilek sosu' },
    { name: 'Yaban mersini sosu' },
    { name: 'Karamel sos' },
  ])

  const SUGAR = required('Şeker', [
    { name: 'Normal', is_default: true },
    { name: 'Az şekerli' },
    { name: 'Şekersiz' },
  ])

  type ItemInput = {
    category_id: string
    name: string
    description?: string
    price: number
    modifier_groups?: Json[]
    position: number
  }

  const items: ItemInput[] = [
    // Kahvaltı
    { category_id: catIds['Kahvaltı']!, name: 'Serpme Kahvaltı', description: '2 kişilik zengin serpme', price: 380, position: 1 },
    { category_id: catIds['Kahvaltı']!, name: 'Menemen', description: 'Domates, biber, yumurta', price: 180, position: 2 },
    { category_id: catIds['Kahvaltı']!, name: 'Avokado Toast', description: 'Ekşi maya ekmek, avokado, egg', price: 220, position: 3 },
    // Kahveler
    { category_id: catIds['Kahveler']!, name: 'Türk Kahvesi', price: 85, position: 1 },
    { category_id: catIds['Kahveler']!, name: 'Filtre Kahve', price: 95, position: 2 },
    { category_id: catIds['Kahveler']!, name: 'Flat White', price: 120, position: 3 },
    { category_id: catIds['Kahveler']!, name: 'Latte', price: 130, modifier_groups: [MILK], position: 4 },
    { category_id: catIds['Kahveler']!, name: 'Soğuk Brew', price: 140, position: 5 },
    // Tatlılar
    { category_id: catIds['Tatlılar']!, name: 'Tiramisu', price: 195, position: 1 },
    { category_id: catIds['Tatlılar']!, name: 'Cheesecake', price: 185, modifier_groups: [SAUCE], position: 2 },
    { category_id: catIds['Tatlılar']!, name: 'Brownie', description: 'Sıcak servis, yanında dondurma', price: 150, position: 3 },
    // İçecekler
    { category_id: catIds['İçecekler']!, name: 'Limonata', price: 95, modifier_groups: [SUGAR], position: 1 },
    { category_id: catIds['İçecekler']!, name: 'Mango Smoothie', price: 145, position: 2 },
    { category_id: catIds['İçecekler']!, name: 'Su', price: 25, position: 3 },
  ]

  const { error: itemsErr } = await supabase.from('menu_items').insert(
    items.map((item) => ({
      category_id: item.category_id,
      name: item.name,
      description: item.description ?? null,
      price: item.price,
      images: [],
      modifier_groups: item.modifier_groups ?? [],
      is_available: true,
      position: item.position,
    })),
  )
  ok(`Insert ${items.length} menu items`, itemsErr)

  // ── 6. Theme config ──────────────────────────────────────────────────────

  const { error: themeErr } = await supabase
    .from('theme_configs')
    .upsert(
      { restaurant_id: restaurantId, tokens: BEACHSIDE_CONFIG },
      { onConflict: 'restaurant_id' },
    )
  ok('Upsert theme config (beachside)', themeErr)

  // ── Done ─────────────────────────────────────────────────────────────────

  console.log('\n✅  MAF Cafe seed complete!')
  console.log(`\n   Menu:      http://localhost:3001/maf-lounge`)
  console.log(`   Table 1:   http://localhost:3001/maf-lounge/table/<tableId>`)
  console.log(`   Dashboard: http://localhost:3000`)
  console.log(`   Kitchen:   http://localhost:3002/kitchen/${restaurantId}?token=${MAF_KITCHEN_TOKEN}\n`)
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
