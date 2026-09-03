import { createParasutOAuthPort } from '@garsonless/db/server'
import {
  providerError,
  type ParasutRefreshTokenStore,
} from './invoice-provider'

export function createParasutRefreshTokenStore(
  workerId: string,
  bootstrapRefreshToken: string | null,
): ParasutRefreshTokenStore {
  const port = createParasutOAuthPort()
  let initialized = false

  async function initialize(): Promise<void> {
    if (initialized) return
    if (bootstrapRefreshToken) {
      const result = await port.initialize(bootstrapRefreshToken)
      if (!result.ok) throw providerError('PARASUT_TOKEN_VAULT_INITIALIZATION', true)
    }
    initialized = true
  }

  return {
    async claim() {
      await initialize()
      const result = await port.claim(workerId, 30)
      if (!result.ok) throw providerError('PARASUT_TOKEN_VAULT_UNAVAILABLE', true)
      if (!result.value) throw providerError('PARASUT_TOKEN_VAULT_BUSY', true)
      return result.value
    },
    async rotate(lease, nextRefreshToken) {
      const result = await port.rotate({
        workerId,
        expectedVersion: lease.version,
        refreshToken: nextRefreshToken,
      })
      if (!result.ok) throw providerError('PARASUT_TOKEN_ROTATION_PERSISTENCE', false)
    },
    async release(lease) {
      await port.release(workerId, lease.version)
    },
  }
}
