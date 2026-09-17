import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createClient } from '@supabase/supabase-js'
import { createServiceClient } from './service-client'
import { createMenuBulkPort } from './menu-bulk-port'
import type { MenuBulkPatch, MenuBulkResult } from '@garsonless/domain/menu-bulk'

test('DEV bulk menu: atomic writes, tenant/team isolation, concurrency, history and safe undo', {
  skip: process.env['MENU_RUNTIME_ALLOW_MUTATION'] !== '1',
}, async () => {
  assert.equal(new URL(process.env['NEXT_PUBLIC_SUPABASE_URL']!).hostname, 'yxsegwkzyiscrxiwdeuf.supabase.co')
  const client = createServiceClient(), port = createMenuBulkPort()
  const owner = await client.from('restaurants').select('owner_id').eq('slug', 'test-cafe-b').single()
  assert.ifError(owner.error)
  const actorId = owner.data!.owner_id
  const restaurantId = randomUUID(), foreignId = randomUUID(), categoryId = randomUUID(), targetId = randomUUID(), foreignCategoryId = randomUUID()
  let memberId: string | undefined
  function success(result: MenuBulkResult) { if (!result.ok) assert.fail(JSON.stringify(result)); return result }
  try {
    assert.ifError((await client.from('restaurants').insert([
      { id: restaurantId, owner_id: actorId, name: 'Bulk isolated', slug: `bulk-${restaurantId}` },
      { id: foreignId, owner_id: actorId, name: 'Bulk foreign', slug: `bulk-${foreignId}` },
    ])).error)
    assert.ifError((await client.from('menu_categories').insert([
      { id: categoryId, restaurant_id: restaurantId, name: 'Before' },
      { id: targetId, restaurant_id: restaurantId, name: 'After' },
      { id: foreignCategoryId, restaurant_id: foreignId, name: 'Foreign' },
    ])).error)
    const created = await client.from('menu_items').insert(Array.from({ length: 150 }, (_, i) => ({ category_id: categoryId, name: `Ürün ${i}`, description: 'Keep description', price: 100, position: i }))).select('*').order('position')
    assert.ifError(created.error)
    const rows = created.data!, first = rows[0]!, second = rows[1]!
    const order = await client.from('orders').insert({ restaurant_id: restaurantId, session_id: randomUUID(), items: [{ id: first.id, name: first.name, price: 100, quantity: 1 }], total: 100, status: 'paid' }).select('id,items,total').single()
    assert.ifError(order.error)
    const patches: MenuBulkPatch[] = rows.map(row => ({ id: row.id, expectedUpdatedAt: row.updated_at, changes: { price: 110, name: `${row.name} yeni` } }))
    const preview = success(await port.execute({ restaurantId, actorId, mode: 'preview', patches }))
    assert.equal(preview.changes.length, 150)
    assert.equal((await client.from('menu_items').select('price').eq('id', first.id).single()).data!.price, 100)
    assert.equal((await port.execute({ restaurantId, actorId: randomUUID(), mode: 'history' })).ok, false)
    assert.equal((await port.execute({ restaurantId: foreignId, actorId, mode: 'preview', patches })).ok, false)
    assert.equal((await port.execute({ restaurantId, actorId, mode: 'apply', requestId: randomUUID(), patches: [patches[0]!, { ...patches[1]!, changes: { category_id: foreignCategoryId } }] })).ok, false)
    assert.equal((await port.execute({ restaurantId, actorId, mode: 'apply', requestId: randomUUID(), patches: [patches[0]!, { ...patches[1]!, changes: { price: 0 } }] })).ok, false)
    assert.equal((await port.execute({ restaurantId, actorId, mode: 'apply', requestId: randomUUID(), patches: [patches[0]!, { ...patches[1]!, changes: { name: ' ' } }] })).ok, false)
    const stale = await port.execute({ restaurantId, actorId, mode: 'apply', requestId: randomUUID(), patches: [patches[0]!, { ...patches[1]!, expectedUpdatedAt: '2000-01-01T00:00:00Z' }] })
    assert.equal(stale.ok, false)
    assert.equal((await client.from('menu_items').select('price').eq('id', first.id).single()).data!.price, 100)
    const requestId = randomUUID()
    const results = await Promise.all([1,2].map(() => port.execute({ restaurantId, actorId, mode: 'apply', patches, requestId })))
    const applied = success(results[0]!), duplicate = success(results[1]!)
    assert.equal(applied.operation!.id, duplicate.operation!.id)
    assert.equal(applied.changes.length, 150)
    assert.equal((await port.execute({ restaurantId, actorId, mode: 'apply', patches: [{ ...patches[0]!, changes: { price: 120 } }], requestId })).ok, false)
    const history = success(await port.execute({ restaurantId, actorId, mode: 'history' }))
    assert.equal(history.history!.length, 1)
    const ownerIdentity = await client.auth.admin.getUserById(actorId)
    assert.equal(history.history![0]!.actor_email, ownerIdentity.data.user!.email)
    assert.equal(history.history![0]!.actor_role, 'İşletme sahibi')
    const savedOrder = await client.from('orders').select('id,items,total').eq('id', order.data!.id).single()
    assert.deepEqual(savedOrder.data, order.data, 'Existing order snapshot must not change')
    assert.equal((await client.from('menu_items').select('description').eq('id', first.id).single()).data!.description, 'Keep description')
    const undoRequest = randomUUID()
    const undone = success(await port.execute({ restaurantId, actorId, mode: 'undo', operationId: applied.operation!.id, requestId: undoRequest }))
    assert.equal(undone.changes.length, 150)
    success(await port.execute({ restaurantId, actorId, mode: 'undo', operationId: applied.operation!.id, requestId: undoRequest }))
    assert.equal(success(await port.execute({ restaurantId, actorId, mode: 'history' })).history!.length, 2)
    assert.equal((await client.from('menu_items').select('price').eq('id', first.id).single()).data!.price, 100)

    const snapshot = success(await port.execute({ restaurantId, actorId, mode: 'snapshot', patches }))
    const fresh = snapshot.items!.find(row => row.id === first.id)!
    const currentPatch = { id: fresh.id, expectedUpdatedAt: fresh.updated_at, changes: { category_id: targetId, description: null, is_available: false } }
    const moved = success(await port.execute({ restaurantId, actorId, mode: 'apply', patches: [currentPatch], requestId: randomUUID() }))
    assert.ifError((await client.from('menu_items').update({ name: 'Later edit' }).eq('id', first.id)).error)
    const refused = await port.execute({ restaurantId, actorId, mode: 'undo', operationId: moved.operation!.id, requestId: randomUUID() })
    assert.equal(refused.ok, false, 'Undo must refuse subsequent edits')
    if (!refused.ok) assert.deepEqual(refused.conflicts, [first.id])
    const after = (await client.from('menu_items').select('*').eq('id', first.id).single()).data!
    assert.equal(after.name, 'Later edit'); assert.equal(after.category_id, targetId); assert.equal(after.is_available, false)
    assert.equal(after.description, null)
    // A missing original category prevents undo, even when the product version matches.
    const categoryMove = success(await port.execute({ restaurantId, actorId, mode: 'apply', requestId: randomUUID(), patches: [{ id: first.id, expectedUpdatedAt: after.updated_at, changes: { category_id: categoryId } }] }))
    assert.ifError((await client.from('menu_categories').update({ deleted_at: new Date().toISOString() }).eq('id', targetId)).error)
    const missingCategoryUndo = await port.execute({ restaurantId, actorId, mode: 'undo', operationId: categoryMove.operation!.id, requestId: randomUUID() })
    assert.equal(missingCategoryUndo.ok, false)
    const afterMove = (await client.from('menu_items').select('*').eq('id', first.id).single()).data!
    Object.assign(after, afterMove)
    // No-op update creates no operation and does not bump the row version.
    const noOp = success(await port.execute({ restaurantId, actorId, mode: 'apply', requestId: randomUUID(), patches: [{ id: first.id, expectedUpdatedAt: after.updated_at, changes: { price: after.price } }] }))
    assert.equal(noOp.changes.length, 0)
    assert.equal((await client.from('menu_items').select('updated_at').eq('id', first.id).single()).data!.updated_at, after.updated_at)

    const email = `menu-bulk-${randomUUID()}@example.com`
    const member = await client.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: 'Ayşe Yılmaz' } })
    assert.ifError(member.error); memberId = member.data.user!.id
    assert.ifError((await client.from('restaurant_members').insert({ restaurant_id: restaurantId, user_id: memberId, email, status: 'active', permissions: ['menu'] })).error)
    success(await port.execute({ restaurantId, actorId: memberId, mode: 'history' }))
    const teamEdit = success(await port.execute({ restaurantId, actorId: memberId, mode: 'apply', requestId: randomUUID(), patches: [{ id: first.id, expectedUpdatedAt: after.updated_at, changes: { price: 115 } }] }))
    assert.equal(teamEdit.operation!.actor_id, memberId)
    assert.equal(teamEdit.operation!.actor_label, 'Ayşe Yılmaz')
    assert.equal(teamEdit.operation!.actor_email, email)
    assert.equal(teamEdit.operation!.actor_role, 'Ekip üyesi')
    assert.ifError((await client.auth.admin.updateUserById(memberId, { user_metadata: { full_name: 'Ayşe Yeni' } })).error)
    const teamHistory = success(await port.execute({ restaurantId, actorId, mode: 'history' })).history!.find(op => op.id === teamEdit.operation!.id)!
    assert.equal(teamHistory.actor_label, 'Ayşe Yılmaz', 'History keeps the identity at the time of the operation')
    assert.equal(teamHistory.actor_email, email)
    assert.equal(teamHistory.actor_role, 'Ekip üyesi')
    assert.ifError((await client.from('restaurant_members').update({ permissions: ['orders'] }).eq('restaurant_id', restaurantId).eq('user_id', memberId)).error)
    assert.equal((await port.execute({ restaurantId, actorId: memberId, mode: 'history' })).ok, false)
    // Soft-deleted items are rejected without partially updating the other row.
    assert.ifError((await client.from('menu_items').update({ deleted_at: new Date().toISOString() }).eq('id', second.id)).error)
    assert.equal((await port.execute({ restaurantId, actorId, mode: 'apply', requestId: randomUUID(), patches: [currentPatch, patches[1]!] })).ok, false)
    const anon = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL']!, process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!, { auth: { persistSession: false } })
    assert.ok((await anon.rpc('execute_menu_bulk', { p_restaurant_id: restaurantId, p_actor_id: actorId, p_mode: 'history' })).error)
  } finally {
    // Only isolated fixtures created by this run are removed.
    assert.ifError((await client.from('orders').delete().eq('restaurant_id', restaurantId)).error)
    assert.ifError((await client.from('restaurant_members').delete().eq('restaurant_id', restaurantId)).error)
    assert.ifError((await client.from('menu_items').delete().in('category_id', [categoryId,targetId,foreignCategoryId])).error)
    assert.ifError((await client.from('menu_categories').delete().in('restaurant_id', [restaurantId,foreignId])).error)
    assert.ifError((await client.from('restaurants').delete().in('id', [restaurantId,foreignId])).error)
    if (memberId) assert.ifError((await client.auth.admin.deleteUser(memberId)).error)
  }
})
