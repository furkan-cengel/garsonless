/** Constant-time shared-secret check for worker endpoints. Both sides are
 * hashed first, so neither timing nor an early length mismatch reveals the
 * configured value. A missing header or secret always fails closed. */
export async function workerSecretMatches(supplied: string | null, expected: string | undefined): Promise<boolean> {
  if (!supplied || !expected) return false
  const digest = (value: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const [left, right] = (await Promise.all([digest(supplied), digest(expected)])).map((buffer) => new Uint8Array(buffer))
  let diff = 0
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i]
  return diff === 0
}
