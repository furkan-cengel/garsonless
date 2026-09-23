import { createHash, timingSafeEqual } from 'node:crypto'

const WORKER_SECRET_HEADER = 'x-outbox-secret'

/**
 * Constant-time check of the shared worker secret. Both sides are hashed first
 * so neither the comparison time nor an early length mismatch reveals anything
 * about the configured value. A missing or blank secret always fails closed.
 */
export function isAuthorizedWorkerRequest(
  headers: Pick<Headers, 'get'>,
  expected: string | undefined,
): boolean {
  const supplied = headers.get(WORKER_SECRET_HEADER)
  if (!expected?.trim() || !supplied) return false
  const left = createHash('sha256').update(expected).digest()
  const right = createHash('sha256').update(supplied).digest()
  return timingSafeEqual(left, right)
}
