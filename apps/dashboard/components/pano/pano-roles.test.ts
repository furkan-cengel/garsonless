import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('the shift view opens with analytics or the cash section; the service view is for everyone', () => {
  const view = read('./use-pano-view.ts')
  assert.match(view, /filter\(\(value\) => value === 'service' \|\| allowed\[value\]\)/)
  assert.match(read('./PanoClient.tsx'), /usePanoView\(restaurantId, \{ business: canAnalytics, shift: canAnalytics \|\| can\('cash'\) \}\)/)
  const query = read('../../lib/queries/pano.ts')
  assert.match(query, /const canCash = canAnalytics \|\| context\.permissions\.includes\('cash'\)/)
  assert.match(query, /readPanoTill\(context/)
})

test('team roles come as presets and the till needs Pano', () => {
  const team = read('../settings/AccountSections.tsx')
  assert.match(team, /label: 'Vardiya sorumlusu', hint: '[^']+', permissions: \['pano', 'orders', 'tables', 'customers', 'cash'\]/)
  assert.match(team, /label: 'Garson', hint: '[^']+', permissions: \['pano', 'orders', 'tables'\]/)
  assert.match(read('../../lib/actions/team.ts'), /\.refine\(\(permissions\) => !permissions\.includes\('cash'\) \|\| permissions\.includes\('pano'\)/)
})
