import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import test from 'node:test'
import { loadMenuCatalog } from './menu-catalog-loader.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

test('product reads proceed while unrelated theme/session work is still pending', async () => {
  const revision = deferred<{ revision: number }>()
  const categories = deferred<{ id: string }[]>()
  const session = deferred<null>()
  const calls: unknown[][] = []
  const catalog = loadMenuCatalog('restaurant-a', {
    readRevision: () => revision.promise,
    readCategories: async (...args) => {
      calls.push(['categories', ...args])
      return categories.promise
    },
    readItems: async (...args) => {
      calls.push(['items', ...args])
      return [{ id: 'product-a' }]
    },
  })
  const pageReads = Promise.all([catalog, session.promise])
  assert.deepEqual(calls, [])
  revision.resolve({ revision: 7 })
  await setImmediate()
  assert.deepEqual(calls, [['categories', 'restaurant-a', 7]])
  categories.resolve([{ id: 'visible-a' }, { id: 'visible-b' }])
  assert.deepEqual(await catalog, {
    categories: [{ id: 'visible-a' }, { id: 'visible-b' }],
    items: [{ id: 'product-a' }],
  })
  assert.deepEqual(calls[1], ['items', 'restaurant-a', 7, ['visible-a', 'visible-b']])
  session.resolve(null)
  await pageReads
})

test('concurrent tenants and revisions never share category IDs', async () => {
  const seen: unknown[][] = []
  const load = (restaurantId: string, revision: number) => loadMenuCatalog(restaurantId, {
    readRevision: async () => ({ revision }),
    readCategories: async (id) => [{ id: `${id}-category` }],
    readItems: async (...args) => {
      seen.push(args)
      return []
    },
  })
  await Promise.all([load('restaurant-a', 2), load('restaurant-b', 9)])
  assert.deepEqual(seen, [
    ['restaurant-a', 2, ['restaurant-a-category']],
    ['restaurant-b', 9, ['restaurant-b-category']],
  ])
})

test('failed revision/category reads fail visibly without reading products', async () => {
  for (const failure of ['revision', 'categories']) {
    let itemReads = 0
    await assert.rejects(loadMenuCatalog('restaurant-a', {
      readRevision: async () => {
        if (failure === 'revision') throw new Error('revision unavailable')
        return { revision: 3 }
      },
      readCategories: async (): Promise<{ id: string }[]> => {
        throw new Error('categories unavailable')
      },
      readItems: async () => { itemReads += 1; return [] },
    }), new RegExp(`${failure} unavailable`))
    assert.equal(itemReads, 0)
  }
})
