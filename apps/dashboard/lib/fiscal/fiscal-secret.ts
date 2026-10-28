import { timingSafeEqual } from 'node:crypto'

/** Bearer secret check that does not leak length or content through timing. */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  const configured = secret?.trim()
  const supplied = header?.replace(/^Bearer\s+/i, '') ?? ''
  if (!configured || configured.length < 32 || !supplied) return false
  const left = Buffer.from(configured)
  const right = Buffer.from(supplied)
  return left.length === right.length && timingSafeEqual(left, right)
}
