import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import type { Database } from './types.gen'

const transferTables = [
  'table_transfer_item_splits',
  'table_transfer_operations',
  'table_transfer_orders',
  'table_transfer_shares',
] as const satisfies ReadonlyArray<keyof Database['public']['Tables']>

const transferFunctions = [
  'list_table_transfer_history',
  'move_table_session',
  'resolve_guest_transfer',
  'table_transfer_financial_fingerprint',
  'table_transfer_item_order_fingerprint',
  'table_transfer_item_request_intent',
  'table_transfer_request_intent',
  'transfer_table_order_items',
  'transfer_table_orders',
  'undo_table_transfer',
] as const satisfies ReadonlyArray<keyof Database['public']['Functions']>

const operationInsert = {
  created_by: 'actor-id',
  financial_fingerprint: '',
  kind: 'table_move',
  request_id: 'request-id',
  request_intent: { kind: 'table_move' },
  restaurant_id: 'restaurant-id',
  source_session_id: 'source-session-id',
  source_table_id: 'source-table-id',
  target_session_id: 'target-session-id',
  target_table_id: 'target-table-id',
} satisfies Database['public']['Tables']['table_transfer_operations']['Insert']

const moveArgs = {
  p_actor_id: 'actor-id',
  p_request_id: 'request-id',
  p_restaurant_id: 'restaurant-id',
  p_source_table_id: 'source-table-id',
  p_target_table_id: 'target-table-id',
} satisfies Database['public']['Functions']['move_table_session']['Args']

const itemTransferArgs = {
  p_actor_id: 'actor-id', p_request_id: 'request-id', p_restaurant_id: 'restaurant-id',
  p_source_table_id: 'source-table-id', p_target_table_id: 'target-table-id',
  p_selections: [{ orderId: 'order-id', lineIndex: 0, quantity: 2 }],
} satisfies Database['public']['Functions']['transfer_table_order_items']['Args']

type TransferHistoryRow = Database['public']['Functions']['list_table_transfer_history']['Returns'][number]
const historyMetadataFields = [
  'request_id',
  'source_session_closed',
  'target_session_created',
  'created_by',
  'undone_by',
  'undone_at',
] as const satisfies ReadonlyArray<keyof TransferHistoryRow>

test('generated database contract includes every table transfer relation and RPC', () => {
  assert.deepEqual(transferTables, [
    'table_transfer_item_splits',
    'table_transfer_operations',
    'table_transfer_orders',
    'table_transfer_shares',
  ])
  assert.equal(transferFunctions.length, 10)
  assert.equal(operationInsert.request_intent.kind, 'table_move')
  assert.equal(moveArgs.p_target_table_id, 'target-table-id')
  assert.equal(itemTransferArgs.p_selections[0]?.quantity, 2)
  assert.equal(historyMetadataFields.length, 6)
})

test('table transfer adapters use generated Supabase calls without local cast bridges', () => {
  const commandPort = readFileSync(join(process.cwd(), 'src/table-command-port.ts'), 'utf8')
  const qrTokens = readFileSync(join(process.cwd(), 'src/table-qr-tokens.ts'), 'utf8')

  assert.doesNotMatch(commandPort, /service\.rpc as unknown as[\s\S]{0,240}(move_table_session|transfer_table_orders|undo_table_transfer|list_table_transfer_history)/)
  assert.doesNotMatch(commandPort, /relation: 'table_transfer_operations'/)
  assert.doesNotMatch(qrTokens, /service\.rpc as unknown as[\s\S]{0,240}resolve_guest_transfer/)
  assert.match(commandPort, /service\.from\('table_transfer_operations'\)/)
  assert.match(qrTokens, /service\.rpc\('resolve_guest_transfer'/)
})
