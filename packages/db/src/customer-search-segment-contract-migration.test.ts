import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL(
  '../supabase/migrations/20260730030000_customer_search_segment_contract.sql',
  import.meta.url,
), 'utf8')
const generated = readFileSync(new URL('./types.gen.ts', import.meta.url), 'utf8')

test('customer search canonicalizes Turkish names and phone formats with indexes', () => {
  assert.match(migration, /normalize_customer_search_text/i)
  assert.match(migration, /ÇĞİIÖŞÜ/)
  assert.match(migration, /normalize_customer_search_phone/i)
  assert.match(migration, /left\(digits, 4\) = '0090'/i)
  assert.match(migration, /customers_search_name_trgm_idx/i)
  assert.match(migration, /customers_search_phone_trgm_idx/i)
  assert.match(migration, /gin_trgm_ops/i)
  assert.doesNotMatch(migration, /new_search[^;]+lower\(name\) like/is)
})

test('built-in segment edges are inclusive and pagination is deterministic and bounded', () => {
  assert.match(migration, /first_seen >= now\(\) - interval \\'30 days\\'/i)
  assert.match(migration, /last_seen <= now\(\) - interval \\'60 days\\'/i)
  assert.match(migration, /customer_id asc/i)
  assert.match(migration, /limit least\(greatest\(p_limit, 0\), 100\)/i)
})

test('read RPC migration fails closed if tenant association or known lineage is missing', () => {
  assert.match(migration, /from customer_restaurants/i)
  assert.match(migration, /where restaurant_id = p_restaurant_id/i)
  assert.match(migration, /tenant candidate contract is missing/i)
  assert.match(migration, /unexpected shape/i)
  assert.match(migration, /revoke all on function public\.get_restaurant_customers[\s\S]*public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.get_restaurant_customers[\s\S]*service_role/i)
})

test('generated database contract includes both deployed search normalizers', () => {
  assert.match(generated, /normalize_customer_search_phone:\s*\{[\s\S]*?Args: \{ p_value: string \}[\s\S]*?Returns: string/)
  assert.match(generated, /normalize_customer_search_text:\s*\{[\s\S]*?Args: \{ p_value: string \}[\s\S]*?Returns: string/)
})
