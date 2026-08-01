import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260727020000_table_account_transfers.sql'), 'utf8')

test('table and account transfers are atomic, audited and service-only', () => {
  assert.match(sql, /create table public\.table_transfer_operations/)
  assert.match(sql, /create unique index table_transfer_request_uidx/)
  for (const fn of ['move_table_session', 'transfer_table_orders', 'undo_table_transfer', 'list_table_transfer_history']) {
    assert.match(sql, new RegExp(`create or replace function public\\.${fn}`))
  }
  assert.match(sql, /for update/)
  assert.match(sql, /revoke all on function public\.move_table_session[\s\S]+from public,anon,authenticated/)
  assert.match(sql, /grant execute on function public\.move_table_session[\s\S]+to service_role/)
})

test('split payments require full transfer and financial drift locks undo', () => {
  assert.match(sql, /Bölünmüş ödeme bulunan hesap yalnız tamamen taşınabilir/)
  assert.match(sql, /table_transfer_financial_fingerprint/)
  assert.match(sql, /Taşımadan sonra ödeme veya iptal değişikliği oluştu/)
  assert.match(sql, /Kaynak masa yeniden kullanılıyor/)
})

test('guest continuity is device-bound and transfer closes do not emit visit events', () => {
  assert.match(sql, /x\.guest_session_id=p_guest_session_id/)
  assert.match(sql, /o\.status='active'/)
  assert.match(sql, /new\.close_kind <> 'transfer'/)
})
