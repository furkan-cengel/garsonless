import { err, ok, type Result } from '@garsonless/domain/result'
import { createServiceClient } from './service-client'

export type ParasutOAuthLease = {
  refreshToken: string
  version: number
}

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{
  data: unknown
  error: { message: string } | null
}>

function serviceRpc(): Rpc {
  const service = createServiceClient()
  return service.rpc.bind(service) as unknown as Rpc
}

function parseLease(value: unknown): ParasutOAuthLease | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  return typeof row.refreshToken === 'string' && row.refreshToken.length >= 20
    && Number.isSafeInteger(row.version) && (row.version as number) >= 0
    ? { refreshToken: row.refreshToken, version: row.version as number }
    : null
}

export function createParasutOAuthPort(rpc: Rpc = serviceRpc()) {
  return {
    async initialize(refreshToken: string): Promise<Result<boolean>> {
      const { data, error } = await rpc('initialize_parasut_refresh_token', {
        p_refresh_token: refreshToken,
      })
      return error ? err('Paraşüt token vault initialization failed')
        : typeof data === 'boolean' ? ok(data) : err('Paraşüt token vault response is invalid')
    },
    async configure(refreshToken: string): Promise<Result<true>> {
      const { data, error } = await rpc('configure_parasut_refresh_token', {
        p_refresh_token: refreshToken,
      })
      return error ? err('Paraşüt token vault configuration failed')
        : data === true ? ok(true) : err('Paraşüt token vault response is invalid')
    },
    async claim(workerId: string, leaseSeconds = 30): Promise<Result<ParasutOAuthLease | null>> {
      const { data, error } = await rpc('claim_parasut_refresh_token', {
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
      })
      if (error) return err('Paraşüt refresh token is unavailable')
      if (data === null) return ok(null)
      const lease = parseLease(data)
      return lease ? ok(lease) : err('Paraşüt token lease response is invalid')
    },
    async rotate(input: {
      workerId: string
      expectedVersion: number
      refreshToken: string
    }): Promise<Result<true>> {
      const { data, error } = await rpc('rotate_parasut_refresh_token', {
        p_worker_id: input.workerId,
        p_expected_version: input.expectedVersion,
        p_refresh_token: input.refreshToken,
      })
      return error ? err('Paraşüt refresh token rotation failed')
        : data === true ? ok(true) : err('Paraşüt refresh token lease was lost')
    },
    async release(workerId: string, expectedVersion: number): Promise<Result<true>> {
      const { data, error } = await rpc('release_parasut_refresh_token', {
        p_worker_id: workerId,
        p_expected_version: expectedVersion,
      })
      return error ? err('Paraşüt refresh token release failed')
        : data === true ? ok(true) : err('Paraşüt refresh token lease was lost')
    },
  }
}
