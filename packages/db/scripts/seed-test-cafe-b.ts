/**
 * PERMANENT second test tenant for ongoing multi-tenant isolation testing.
 * Idempotent: safe to re-run (reuses the owner + restaurant by email/slug,
 * tops up the known password + loyalty config, seeds menu/tables once).
 * Does NOT touch maf-lounge or its owner (maf is only READ, to report its
 * login + prove the maf→B isolation via the gate's exact query).
 *
 *   Run:  cd packages/db && npx tsx scripts/seed-test-cafe-b.ts
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = readFileSync(new URL('../../../apps/menu/.env.local', import.meta.url), 'utf8')
const get = (k: string) => env.split('\n').find((l) => l.startsWith(k + '='))?.slice(k.length + 1).trim() ?? ''
const URL_ = get('NEXT_PUBLIC_SUPABASE_URL')
const SVC = get('SUPABASE_SERVICE_ROLE_KEY')
const ANON = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const svc = createClient(URL_, SVC, { auth: { autoRefreshToken: false, persistSession: false } })
const MENU = 'http://localhost:3011'

const B_EMAIL = 'test-owner-b@garsonless.dev'
const B_SLUG = 'test-cafe-b'
// Credentials come from env (process.env or apps/menu/.env.local) — never hardcoded,
// so this fixture can be committed without leaking a working login. See .env.example.
const B_PASSWORD = process.env['TEST_OWNER_B_PASSWORD'] || get('TEST_OWNER_B_PASSWORD')
const KITCHEN_TOKEN = process.env['TEST_CAFE_B_KITCHEN_TOKEN'] || get('TEST_CAFE_B_KITCHEN_TOKEN')
if (!B_PASSWORD || !KITCHEN_TOKEN) {
  console.error('Set TEST_OWNER_B_PASSWORD and TEST_CAFE_B_KITCHEN_TOKEN (env or apps/menu/.env.local) before running this seed.')
  process.exit(1)
}

async function findOwnerByEmail(email: string): Promise<string | null> {
  // paginate listUsers (admin) to find by email
  for (let page = 1; page <= 20; page++) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: 200 })
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())
    if (u) return u.id
    if (data.users.length < 200) break
  }
  return null
}

async function main(): Promise<void> {
  // ── 1. owner (idempotent: reuse + reset known password, else create) ──
  let ownerId = await findOwnerByEmail(B_EMAIL)
  if (ownerId) {
    await svc.auth.admin.updateUserById(ownerId, { password: B_PASSWORD, email_confirm: true })
    console.log(`owner: reused ${B_EMAIL} (${ownerId}), password reset to known value`)
  } else {
    const { data, error } = await svc.auth.admin.createUser({ email: B_EMAIL, password: B_PASSWORD, email_confirm: true })
    if (error || !data.user) throw new Error('owner create: ' + error?.message)
    ownerId = data.user.id
    console.log(`owner: created ${B_EMAIL} (${ownerId})`)
  }

  // maf-lounge (READ ONLY) — for the report + the maf→B gate proof.
  const { data: mafRow } = await svc.from('restaurants').select('id, owner_id').eq('slug', 'maf-lounge').maybeSingle()
  const maf = mafRow as { id: string; owner_id: string } | null
  let mafOwnerEmail: string | null = null
  if (maf) {
    const { data: mafUser } = await svc.auth.admin.getUserById(maf.owner_id)
    mafOwnerEmail = mafUser.user?.email ?? null
  }
  if (maf && maf.owner_id === ownerId) throw new Error('SAFETY: B owner equals maf owner — aborting')

  // ── 2. restaurant (idempotent by slug) ──
  const loyaltyBase = {
    stamp_enabled: true, stamp_goal: 8, stamp_reward_text: '8. kahve bizden ☕',
    points_enabled: true, points_per_lira: 1, points_redeem_rate: 10,
    member_discount_pct: 10, welcome_bonus_points: 50,
    scope: 'restaurant', earn_trigger: 'paid',
    tiers: [
      { name: 'Bronz', min: 0, color: '#b87333' }, { name: 'Gümüş', min: 500, color: '#8a9099' },
      { name: 'Altın', min: 1000, color: '#c8922a' }, { name: 'Platin', min: 2500, color: '#5b7a86' },
    ],
  }
  const { data: existing } = await svc.from('restaurants').select('id').eq('slug', B_SLUG).maybeSingle()
  let restId = (existing as { id: string } | null)?.id ?? ''
  if (!restId) {
    const { data, error } = await svc.from('restaurants').insert({
      owner_id: ownerId, name: 'Test Cafe B', slug: B_SLUG, plan: 'pro', settings: { loyalty: loyaltyBase },
    }).select('id').single()
    if (error || !data) throw new Error('restaurant: ' + error?.message)
    restId = (data as { id: string }).id
    console.log(`restaurant: created Test Cafe B (${restId})`)
  } else {
    await svc.from('restaurants').update({ owner_id: ownerId }).eq('id', restId)
    console.log(`restaurant: reused Test Cafe B (${restId})`)
  }

  // ── 3. menu (seed once if empty) ──
  const { data: catRows } = await svc.from('menu_categories').select('id, name').eq('restaurant_id', restId).is('deleted_at', null)
  const itemIdByName = new Map<string, string>()
  if (((catRows as unknown[] | null) ?? []).length === 0) {
    const cats: Record<string, string> = {}
    for (const [i, name] of ['Kahve', 'Tatlı', 'Atıştırmalık'].entries()) {
      const { data } = await svc.from('menu_categories').insert({ restaurant_id: restId, name, position: i }).select('id').single()
      cats[name] = (data as { id: string }).id
    }
    const items: { cat: string; name: string; price: number; earns_stamp: boolean }[] = [
      { cat: 'Kahve', name: 'Filtre Kahve', price: 50, earns_stamp: true },
      { cat: 'Kahve', name: 'Latte', price: 65, earns_stamp: true },
      { cat: 'Kahve', name: 'Türk Kahvesi', price: 40, earns_stamp: false },
      { cat: 'Tatlı', name: 'Cheesecake', price: 90, earns_stamp: false },
      { cat: 'Tatlı', name: 'Brownie', price: 75, earns_stamp: false },
      { cat: 'Atıştırmalık', name: 'Tost', price: 70, earns_stamp: false },
    ]
    for (const [i, it] of items.entries()) {
      const { data } = await svc.from('menu_items').insert({ category_id: cats[it.cat], name: it.name, price: it.price, earns_stamp: it.earns_stamp, position: i }).select('id').single()
      itemIdByName.set(it.name, (data as { id: string }).id)
    }
    console.log(`menu: seeded 3 categories + 6 items`)
  } else {
    const { data: its } = await svc.from('menu_items').select('id, name, menu_categories!inner(restaurant_id)').eq('menu_categories.restaurant_id', restId)
    for (const r of (its as Array<{ id: string; name: string }> | null) ?? []) itemIdByName.set(r.name, r.id)
    console.log(`menu: already seeded (${itemIdByName.size} items) — skipping`)
  }

  // reward_item_id + reward_catalog reference real item ids → patch loyalty config
  const rewardItemId = itemIdByName.get('Filtre Kahve') ?? null
  const catalogItemId = itemIdByName.get('Latte') ?? null
  const loyalty = {
    ...loyaltyBase,
    reward_item_id: rewardItemId,
    reward_catalog: catalogItemId ? [{ itemId: catalogItemId, pointCost: 200, tag: 'Popüler' }] : [],
  }
  await svc.from('restaurants').update({ settings: { loyalty } }).eq('id', restId)

  // ── 4. tables (seed once if empty) ──
  const { data: tblRows } = await svc.from('tables').select('id, label').eq('restaurant_id', restId).is('deleted_at', null).order('label')
  let tables = (tblRows as Array<{ id: string; label: string }> | null) ?? []
  if (tables.length === 0) {
    const ins: Array<{ id: string; label: string }> = []
    for (const label of ['Masa 1', 'Masa 2', 'Masa 3']) {
      const { data } = await svc.from('tables').insert({ restaurant_id: restId, label }).select('id, label').single()
      ins.push(data as { id: string; label: string })
    }
    tables = ins
    console.log(`tables: seeded ${tables.length}`)
  } else {
    console.log(`tables: already present (${tables.length}) — skipping`)
  }

  // ── 5. kitchen token (relocated table, NOT settings) ──
  const kc = svc.from('kitchen_credentials') as unknown as { upsert: (r: Record<string, unknown>, o: { onConflict: string }) => Promise<{ error: unknown }> }
  await kc.upsert({ restaurant_id: restId, token: KITCHEN_TOKEN, updated_at: new Date().toISOString() }, { onConflict: 'restaurant_id' })
  console.log(`kitchen_credentials: token set`)

  // ════ VERIFY ════
  console.log('\n══ ISOLATION VERIFY ══')
  let pass = 0, fail = 0
  const ok = (n: string, c: boolean, g?: unknown) => { if (c) { pass++; console.log(`  ✓ ${n}`) } else { fail++; console.log(`  ✗ ${n}${g !== undefined ? ` — ${JSON.stringify(g)}` : ''}`) } }

  // B owner real auth → cannot resolve maf via the owner-scoped gate (getRestaurantById logic)
  const bClient = createClient(URL_, ANON, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: si, error: siErr } = await bClient.auth.signInWithPassword({ email: B_EMAIL, password: B_PASSWORD })
  ok('B owner signs in (real auth)', !siErr && si.user?.id === ownerId, siErr?.message)
  const bOwn = await bClient.from('restaurants').select('id').eq('id', restId).eq('owner_id', ownerId).is('deleted_at', null).maybeSingle()
  ok('B owner resolves OWN restaurant (gate passes)', (bOwn.data as { id: string } | null)?.id === restId)
  if (maf) {
    const bToMaf = await bClient.from('restaurants').select('id').eq('id', maf.id).eq('owner_id', ownerId).is('deleted_at', null).maybeSingle()
    ok('B owner → maf-lounge gate → null (notFound, blocked)', (bToMaf.data as unknown) === null, bToMaf.data)
    // maf → B via the gate's EXACT query (read-only; we do NOT sign in as maf / touch its auth)
    const mafToB = await svc.from('restaurants').select('id').eq('id', restId).eq('owner_id', maf.owner_id).is('deleted_at', null).maybeSingle()
    ok('maf owner → Test Cafe B gate → null (notFound, blocked)', (mafToB.data as unknown) === null, mafToB.data)
  }
  // B menu renders
  const menuRes = await fetch(`${MENU}/${B_SLUG}`, { redirect: 'manual' }).catch(() => null)
  ok('B menu renders at /test-cafe-b (200)', menuRes?.status === 200, menuRes?.status)

  console.log('\n══ REPORT ══')
  console.log(JSON.stringify({
    bOwner: { email: B_EMAIL, password: B_PASSWORD, userId: ownerId },
    bRestaurant: { id: restId, slug: B_SLUG, dashboard: `/dashboard/${restId}`, menu: `/${B_SLUG}` },
    bTables: tables.map((t) => ({ label: t.label, id: t.id, url: `/${B_SLUG}/table/${t.id}` })),
    kitchen: { token: KITCHEN_TOKEN, url: `/kitchen/${restId}?token=${KITCHEN_TOKEN}` },
    rewardItemId, catalogItemId,
    mafLounge: maf ? { id: maf.id, ownerEmail: mafOwnerEmail, dashboard: `/dashboard/${maf.id}`, note: 'password NOT changed — untouched' } : 'not found',
  }, null, 2))
  console.log(`\n${fail === 0 ? '✅ ALL GREEN' : '❌ FAILURES'} — ${pass} passed, ${fail} failed`)
}

main().catch((e) => { console.error('💥', e.message); process.exit(1) })
