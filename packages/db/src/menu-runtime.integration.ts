import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createServiceClient } from './service-client'
import { createMenuCommandPort } from './menu-command-port'
import { createMenuManagementReadModelPort } from './dashboard-feature-read-model-port'
import { createRestaurantAssetStoragePort } from './restaurant-asset-storage-port'
import { removeUnreferencedMenuMedia } from './menu-media-cleanup'

test('DEV menu: CAS, tenant isolation, 1001+ rows and referenced media protection', {
  skip: process.env['MENU_RUNTIME_ALLOW_MUTATION'] !== '1',
}, async () => {
  const storageOrigin = process.env['NEXT_PUBLIC_SUPABASE_URL']!
  assert.equal(new URL(storageOrigin).hostname, 'yxsegwkzyiscrxiwdeuf.supabase.co', 'Menu runtime writes are DEV-only')
  const service = createServiceClient()
  const owner = await service.from('restaurants').select('owner_id').is('deleted_at', null).limit(1).single()
  assert.ifError(owner.error)
  const restaurant = await service.from('restaurants').insert({
    owner_id: owner.data!.owner_id, name: 'Isolated Menu Runtime', slug: `menu-runtime-${randomUUID()}`, plan: 'business',
  }).select('id').single()
  assert.ifError(restaurant.error)
  const restaurantId = restaurant.data!.id
  let imagePath: string | undefined
  try {
    const category = await service.from('menu_categories').insert({ restaurant_id: restaurantId, name: 'Runtime' }).select('id').single()
    assert.ifError(category.error)
    const created = await service.from('menu_items').insert({ category_id: category.data!.id, name: 'Original', price: 10, description: 'Keep this description' }).select('*').single()
    assert.ifError(created.error)
    const item = created.data!
    const port = createMenuCommandPort()
    const first = await port.updateItem({ id: item.id, restaurantId, expectedUpdatedAt: item.updated_at, price: 20 })
    assert.equal(first.ok, true)
    if (!first.ok) return
    assert.equal(first.value.description, item.description)
    const stale = await port.updateItem({ id: item.id, restaurantId, expectedUpdatedAt: item.updated_at, name: 'Stale session' })
    assert.deepEqual(stale, { ok: false, error: 'menu_item_conflict' })
    const wrongTenant = await port.updateItem({ id: item.id, restaurantId: randomUUID(), expectedUpdatedAt: first.value.updated_at, price: 1 })
    assert.equal(wrongTenant.ok, false)
    const persisted = await service.from('menu_items').select('name,price').eq('id', item.id).single()
    assert.equal(persisted.data?.name, 'Original')
    assert.equal(Number(persisted.data?.price), 20)

    for (let offset = 0; offset < 1001; offset += 100) {
      const rows = Array.from({ length: Math.min(100, 1001 - offset) }, (_, index) => ({
        category_id: category.data!.id, name: `Runtime ${offset + index}`, price: 1, position: offset + index + 1,
      }))
      const result = await service.from('menu_items').insert(rows)
      assert.ifError(result.error)
    }
    const catalog = await createMenuManagementReadModelPort().readManagementData({ restaurantId, operation: 'menu.management' })
    assert.equal(catalog.ok, true)
    if (catalog.ok) {
      assert.equal(catalog.value.items.length, 1002)
      assert.equal(catalog.value.items.at(-1)?.name, 'Runtime 1000')
    }

    imagePath = `restaurants/${restaurantId}/items/${item.id}/${randomUUID()}.png`
    const media = await createRestaurantAssetStoragePort().uploadImmutable({ path: imagePath, bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), contentType: 'image/png' })
    const attached = await port.updateItem({ id: item.id, restaurantId, expectedUpdatedAt: first.value.updated_at, images: [media.publicUrl] })
    assert.equal(attached.ok, true)
    assert.equal(await removeUnreferencedMenuMedia({ restaurantId, publicUrl: media.publicUrl, storageOrigin }), false)
    assert.equal(await removeUnreferencedMenuMedia({ restaurantId: randomUUID(), publicUrl: media.publicUrl, storageOrigin }), false)
    if (attached.ok) {
      const detached = await port.updateItem({ id: item.id, restaurantId, expectedUpdatedAt: attached.value.updated_at, images: [] })
      assert.equal(detached.ok, true)
      assert.equal(await removeUnreferencedMenuMedia({ restaurantId, publicUrl: media.publicUrl, storageOrigin }), true)
    }
  } finally {
    if (imagePath) await createRestaurantAssetStoragePort().remove(imagePath)
    const cleanupCategories = await service.from('menu_categories').select('id').eq('restaurant_id', restaurantId)
    assert.ifError(cleanupCategories.error)
    for (const category of cleanupCategories.data ?? []) {
      assert.ifError((await service.from('menu_items').delete().eq('category_id', category.id)).error)
    }
    assert.ifError((await service.from('menu_categories').delete().eq('restaurant_id', restaurantId)).error)
    const deleted = await service.from('restaurants').delete().eq('id', restaurantId)
    assert.ifError(deleted.error)
  }
})
