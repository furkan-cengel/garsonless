import type { OrderCheckoutPort } from '@garsonless/application/payments'
import { err, ok } from '@garsonless/domain/result'
import { createServiceClient } from './client'
import {
  decryptPaymentCredentials,
  encryptPaymentCredentials,
  fingerprintPaymentCredentialWrite,
  loadPaymentCredentialKeyring,
} from './payment-credential-crypto'

export interface IyzicoCredentialRecord {
  apiKey: string
  secretKey: string
  mode: string
  protection: 'encrypted' | 'legacy-plaintext'
  keyVersion: string | null
}

export interface PaymentCredentialMetaRecord {
  configured: boolean
  mode: 'sandbox' | 'live'
  apiKeyLast4: string | null
  updatedAt: string | null
  protection: 'encrypted' | 'legacy-plaintext' | 'none'
  requiresRotation: boolean
}

type CredentialDbError = { message: string; code?: string } | null
type CredentialSelectResult = Promise<{ data: unknown; error: CredentialDbError }>
interface CredentialSelectChain {
  eq(column: string, value: unknown): CredentialSelectChain
  maybeSingle(): CredentialSelectResult
}
interface CredentialTable {
  select(columns: string): CredentialSelectChain
}
interface CredentialRepository {
  from(table: string): CredentialTable
  rpc(name: string, args: Record<string, unknown>): CredentialSelectResult
}

function credentialRepository(): CredentialRepository {
  return createServiceClient() as unknown as CredentialRepository
}

type VaultRow = {
  encrypted_payload: unknown
  key_version: string
  api_key_last4: string
  mode: string
  updated_at: string
}

type LegacyCredentialRow = {
  api_key: string
  secret_key: string
  mode: string
  updated_at: string
}

function credentialStoreError(code: 'unavailable' | 'decryption_failed' | 'key_unavailable' | 'writes_disabled') {
  return `payment_credential_store_${code}`
}

async function readVaultRow(restaurantId: string): Promise<{
  row: VaultRow | null
  error: string | null
}> {
  const { data, error } = await credentialRepository()
    .from('payment_credential_vaults')
    .select('encrypted_payload, key_version, api_key_last4, mode, updated_at')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'iyzico')
    .maybeSingle()
  if (error) return { row: null, error: credentialStoreError('unavailable') }
  return { row: data as VaultRow | null, error: null }
}

async function readLegacyCredentialRow(restaurantId: string): Promise<{
  row: LegacyCredentialRow | null
  error: string | null
}> {
  const { data, error } = await credentialRepository()
    .from('payment_credentials')
    .select('api_key, secret_key, mode, updated_at')
    .eq('restaurant_id', restaurantId)
    .eq('provider', 'iyzico')
    .maybeSingle()
  if (error) return { row: null, error: credentialStoreError('unavailable') }
  return { row: data as LegacyCredentialRow | null, error: null }
}

export async function readPaymentCredentialMeta(restaurantId: string): Promise<{
  meta: PaymentCredentialMetaRecord | null
  error: string | null
}> {
  const vault = await readVaultRow(restaurantId)
  if (vault.error) return { meta: null, error: vault.error }
  if (vault.row) {
    const activeVersion = process.env['PAYMENT_CREDENTIAL_ACTIVE_KEY_VERSION']
    return {
      meta: {
        configured: true,
        mode: vault.row.mode === 'live' ? 'live' : 'sandbox',
        apiKeyLast4: vault.row.api_key_last4,
        updatedAt: vault.row.updated_at,
        protection: 'encrypted',
        requiresRotation: !activeVersion || vault.row.key_version !== activeVersion,
      },
      error: null,
    }
  }

  const legacy = await readLegacyCredentialRow(restaurantId)
  if (legacy.error) return { meta: null, error: legacy.error }
  if (!legacy.row) {
    return {
      meta: {
        configured: false,
        mode: 'sandbox',
        apiKeyLast4: null,
        updatedAt: null,
        protection: 'none',
        requiresRotation: false,
      },
      error: null,
    }
  }
  return {
    meta: {
      configured: true,
      mode: legacy.row.mode === 'live' ? 'live' : 'sandbox',
      apiKeyLast4: legacy.row.api_key.slice(-4),
      updatedAt: legacy.row.updated_at,
      protection: 'legacy-plaintext',
      requiresRotation: true,
    },
    error: null,
  }
}

export async function writePaymentCredentialVault(input: {
  restaurantId: string
  actorUserId: string
  requestId: string
  operation: 'save' | 'rotate'
  apiKey: string
  secretKey: string
  mode: 'sandbox' | 'live'
}): Promise<{ meta: PaymentCredentialMetaRecord | null; idempotent: boolean; error: string | null }> {
  // Rolling-deploy gate: migration and every menu/dashboard reader must be on
  // the vault-aware version before the first write removes a legacy row.
  if (process.env['PAYMENT_CREDENTIAL_VAULT_WRITES_ENABLED'] !== 'true') {
    return { meta: null, idempotent: false, error: credentialStoreError('writes_disabled') }
  }
  try {
    const keyring = loadPaymentCredentialKeyring()
    const envelope = encryptPaymentCredentials({
      restaurantId: input.restaurantId,
      apiKey: input.apiKey,
      secretKey: input.secretKey,
    }, keyring)
    const payloadFingerprint = fingerprintPaymentCredentialWrite({
      restaurantId: input.restaurantId,
      provider: 'iyzico',
      mode: input.mode,
      apiKey: input.apiKey,
      secretKey: input.secretKey,
    }, keyring)
    const { data, error } = await credentialRepository().rpc('save_payment_credential_vault', {
      p_restaurant_id: input.restaurantId,
      p_actor_user_id: input.actorUserId,
      p_request_id: input.requestId,
      p_operation: input.operation,
      p_payload_fingerprint: payloadFingerprint,
      p_provider: 'iyzico',
      p_encrypted_payload: envelope,
      p_key_version: keyring.activeVersion,
      p_api_key_last4: input.apiKey.slice(-4),
      p_mode: input.mode,
    })
    if (error) {
      return {
        meta: null,
        idempotent: false,
        error: error.message.includes('payment_credential_request_conflict')
          ? 'payment_credential_request_conflict'
          : credentialStoreError('unavailable'),
      }
    }
    const outcome = data && typeof data === 'object' ? data as Record<string, unknown> : {}
    return {
      meta: {
        configured: true,
        mode: input.mode,
        apiKeyLast4: input.apiKey.slice(-4),
        updatedAt: new Date().toISOString(),
        protection: 'encrypted',
        requiresRotation: false,
      },
      idempotent: outcome['idempotent'] === true,
      error: null,
    }
  } catch {
    return { meta: null, idempotent: false, error: credentialStoreError('key_unavailable') }
  }
}

export async function rotatePaymentCredentialVault(input: {
  restaurantId: string
  actorUserId: string
  requestId: string
}): Promise<{ meta: PaymentCredentialMetaRecord | null; idempotent: boolean; error: string | null }> {
  const current = await readIyzicoCredentialRecord(input.restaurantId)
  if (current.error) return { meta: null, idempotent: false, error: current.error }
  if (!current.record) return { meta: null, idempotent: false, error: 'payment_credential_not_configured' }
  return writePaymentCredentialVault({
    ...input,
    operation: 'rotate',
    apiKey: current.record.apiKey,
    secretKey: current.record.secretKey,
    mode: current.record.mode === 'live' ? 'live' : 'sandbox',
  })
}

export async function deletePaymentCredentialVault(input: {
  restaurantId: string
  actorUserId: string
  requestId: string
}): Promise<{ idempotent: boolean; error: string | null }> {
  const { data, error } = await credentialRepository().rpc('delete_payment_credential_vault', {
    p_restaurant_id: input.restaurantId,
    p_actor_user_id: input.actorUserId,
    p_request_id: input.requestId,
  })
  if (error) {
    return {
      idempotent: false,
      error: error.message.includes('payment_credential_request_conflict')
        ? 'payment_credential_request_conflict'
        : credentialStoreError('unavailable'),
    }
  }
  const outcome = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  return { idempotent: outcome['idempotent'] === true, error: null }
}

export function createOrderCheckoutPort(): OrderCheckoutPort {
  return {
    async reserveOrderCheckout(input) {
      const service = createServiceClient()
      const call = service.rpc.bind(service) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
      const { data, error } = await call('reserve_order_checkout', {
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_table_id: input.tableId,
        p_reservation_seconds: 900,
      })
      if (error) return err('Checkout rezervasyonu oluşturulamadı')
      const value = data as { amount?: unknown; restaurantSettings?: unknown; reservationId?: unknown } | null
      return typeof value?.amount === 'number' && typeof value.reservationId === 'string'
        ? ok({ amount: value.amount, restaurantSettings: value.restaurantSettings ?? null, reservationId: value.reservationId })
        : err('Checkout rezervasyonu geçersiz yanıt döndürdü')
    },
    async releaseOrderCheckout(input) {
      const service = createServiceClient()
      const call = service.rpc.bind(service) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>
      const { data, error } = await call('release_order_checkout_reservation', {
        p_order_id: input.orderId,
        p_restaurant_id: input.restaurantId,
        p_reservation_id: input.reservationId,
      })
      if (error) return err('Checkout rezervasyonu bırakılamadı')
      return data === true ? ok(true) : err('Checkout rezervasyonu bırakılamadı')
    },
  }
}

export async function readIyzicoCredentialRecord(restaurantId: string): Promise<{
  record: IyzicoCredentialRecord | null
  error: string | null
}> {
  const vault = await readVaultRow(restaurantId)
  if (vault.error) return { record: null, error: vault.error }
  if (vault.row) {
    try {
      const decrypted = decryptPaymentCredentials(
        vault.row.encrypted_payload,
        restaurantId,
        loadPaymentCredentialKeyring(),
      )
      return {
        record: {
          apiKey: decrypted.apiKey,
          secretKey: decrypted.secretKey,
          mode: vault.row.mode,
          protection: 'encrypted',
          keyVersion: decrypted.keyVersion,
        },
        error: null,
      }
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? (error as { code?: unknown }).code
        : null
      return {
        record: null,
        error: credentialStoreError(code === 'KEY_UNAVAILABLE' || code === 'CONFIG_INVALID'
          ? 'key_unavailable'
          : 'decryption_failed'),
      }
    }
  }

  // Expand-phase compatibility only. A successful save/rotate atomically
  // migrates this tenant and deletes the plaintext row. Remove this branch in
  // the follow-up contract migration after the legacy table is proven empty.
  const legacy = await readLegacyCredentialRow(restaurantId)
  if (legacy.error) return { record: null, error: legacy.error }
  if (!legacy.row) return { record: null, error: null }
  return {
    record: {
      apiKey: legacy.row.api_key,
      secretKey: legacy.row.secret_key,
      mode: legacy.row.mode,
      protection: 'legacy-plaintext',
      keyVersion: null,
    },
    error: null,
  }
}

export async function readOrderPaymentMapping(token: string): Promise<{
  orderId: string | null
  restaurantId: string | null
  error: string | null
}> {
  const service = createServiceClient()
  const { data: tokenRow, error } = await service.from('order_payment_tokens')
    .select('order_id').eq('token', token).maybeSingle()
  const orderId = (tokenRow as { order_id: string } | null)?.order_id ?? null
  if (error || !orderId) {
    return {
      orderId: null,
      restaurantId: null,
      error: error ? 'payment_token_lookup_failed' : null,
    }
  }
  const { data: orderRow, error: orderError } = await service.from('orders')
    .select('restaurant_id').eq('id', orderId).is('deleted_at', null).maybeSingle()
  return {
    orderId,
    restaurantId: (orderRow as { restaurant_id: string } | null)?.restaurant_id ?? null,
    error: orderError ? 'payment_order_lookup_failed' : null,
  }
}

export async function readSharePaymentMapping(token: string): Promise<{
  shareId: string | null
  restaurantId: string | null
  error: string | null
}> {
  const service = createServiceClient()
  const { data: tokenRow, error } = await service.from('payment_share_tokens')
    .select('share_id').eq('token', token).maybeSingle()
  const shareId = (tokenRow as { share_id: string } | null)?.share_id ?? null
  if (error || !shareId) {
    return {
      shareId: null,
      restaurantId: null,
      error: error ? 'payment_share_token_lookup_failed' : null,
    }
  }
  const { data: shareRow, error: shareError } = await service.from('payment_shares')
    .select('restaurant_id').eq('id', shareId).maybeSingle()
  return {
    shareId,
    restaurantId: (shareRow as { restaurant_id: string } | null)?.restaurant_id ?? null,
    error: shareError ? 'payment_share_lookup_failed' : null,
  }
}

/** Dashboard/provider reconciliation lookup. Raw token never crosses the
 * server-action boundary or enters logs. */
export async function readShareProviderCheckout(input: {
  shareId: string
  restaurantId: string
}): Promise<{
  share: { id: string; amount: number; status: string; method: string | null } | null
  token: string | null
  error: string | null
}> {
  const service = createServiceClient()
  const { data: share, error: shareError } = await service.from('payment_shares')
    .select('id, amount, status, method')
    .eq('id', input.shareId)
    .eq('restaurant_id', input.restaurantId)
    .maybeSingle()
  if (shareError) return { share: null, token: null, error: 'payment_share_lookup_failed' }
  if (!share) return { share: null, token: null, error: null }
  const { data: mapping, error: tokenError } = await service.from('payment_share_tokens')
    .select('token')
    .eq('share_id', input.shareId)
    .maybeSingle()
  return {
    share: {
      id: share.id,
      amount: Number(share.amount ?? 0),
      status: share.status,
      method: share.method,
    },
    token: (mapping as { token: string } | null)?.token ?? null,
    error: tokenError ? 'payment_share_token_lookup_failed' : null,
  }
}

export async function voidVerifiedFailedSplitShare(input: {
  shareId: string
  restaurantId: string
  providerTokenHash: string
}): Promise<{ outcome: 'voided' | 'already_resolved' | 'not_found' | 'provider_mapping_mismatch' | null; error: string | null }> {
  const service = createServiceClient()
  const { data, error } = await service.rpc('void_verified_failed_split_share_atomic' as never, {
    p_share_id: input.shareId,
    p_restaurant_id: input.restaurantId,
    p_provider_token_hash: input.providerTokenHash,
  } as never) as unknown as { data: unknown; error: { message: string } | null }
  if (error) return { outcome: null, error: 'payment_share_void_failed' }
  const outcomes = ['voided', 'already_resolved', 'not_found', 'provider_mapping_mismatch'] as const
  return outcomes.includes(data as typeof outcomes[number])
    ? { outcome: data as typeof outcomes[number], error: null }
    : { outcome: null, error: 'payment_share_void_failed' }
}

export async function attachOrderPaymentToken(
  orderId: string,
  restaurantId: string,
  reservationId: string,
  token: string,
): Promise<string | null> {
  const service = createServiceClient()
  const call = service.rpc.bind(service) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await call('attach_order_checkout_token', {
    p_order_id: orderId,
    p_restaurant_id: restaurantId,
    p_reservation_id: reservationId,
    p_token: token,
  })
  if (error) return 'payment_token_attach_failed'
  return data === true ? null : 'Provider token siparişe bağlanamadı'
}

/** Persists the signed CheckoutForm-retrieve identifiers needed for a future
 * provider refund. The token, order and tenant must all match atomically. */
export async function attachOrderProviderPayment(input: {
  orderId: string
  restaurantId: string
  token: string
  providerPaymentId: string
  paidPrice: number
  currency: string
}): Promise<string | null> {
  const service = createServiceClient()
  const call = service.rpc.bind(service) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await call('attach_order_provider_payment', {
    p_order_id: input.orderId,
    p_restaurant_id: input.restaurantId,
    p_token: input.token,
    p_provider_payment_id: input.providerPaymentId,
    p_paid_price: input.paidPrice,
    p_currency: input.currency,
  })
  if (error) return 'provider_payment_attach_failed'
  return data === true ? null : 'Provider ödeme kimliği siparişe bağlanamadı'
}

export async function attachSharePaymentToken(
  shareId: string,
  restaurantId: string,
  token: string,
): Promise<string | null> {
  const service = createServiceClient()
  const call = service.rpc.bind(service) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>
  const { data, error } = await call('attach_split_checkout_token', {
    p_share_id: shareId,
    p_restaurant_id: restaurantId,
    p_token: token,
  })
  if (error) return 'payment_share_token_attach_failed'
  return data === true ? null : 'Provider token paya bağlanamadı'
}
