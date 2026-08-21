import { createServiceClient } from './client'

type RpcError = { code?: string; message?: string } | null
type RpcResult = { data: unknown; error: RpcError }
type LooseRpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>
}

function rpcClient(): LooseRpcClient {
  return createServiceClient() as unknown as LooseRpcClient
}

export async function registerCustomerAuthIntent(input: {
  nonceHash: string
  flow: 'email' | 'oauth' | 'phone'
  contextHash: string
  expiresAt: string
}): Promise<boolean> {
  const { data, error } = await rpcClient().rpc('register_customer_auth_intent', {
    p_nonce_hash: input.nonceHash,
    p_flow: input.flow,
    p_context_hash: input.contextHash,
    p_expires_at: input.expiresAt,
  })
  return !error && data === true
}

export async function consumeCustomerAuthIntent(input: {
  nonceHash: string
  contextHash: string
}): Promise<boolean> {
  const { data, error } = await rpcClient().rpc('consume_customer_auth_intent', {
    p_nonce_hash: input.nonceHash,
    p_context_hash: input.contextHash,
  })
  return !error && data === true
}

export async function consumeCustomerAuthRateLimit(input: {
  bucket: string
  subjectHash: string
  limit: number
  windowSeconds: number
}): Promise<{ allowed: boolean; retryAfterSeconds: number } | null> {
  const { data, error } = await rpcClient().rpc('consume_customer_auth_rate_limit', {
    p_bucket: input.bucket,
    p_subject_hash: input.subjectHash,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  })
  if (error || !Array.isArray(data) || !data[0]) return null
  const row = data[0] as { allowed?: unknown; retry_after_seconds?: unknown }
  if (typeof row.allowed !== 'boolean' || typeof row.retry_after_seconds !== 'number') return null
  return { allowed: row.allowed, retryAfterSeconds: row.retry_after_seconds }
}
