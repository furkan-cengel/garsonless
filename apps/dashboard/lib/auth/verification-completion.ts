/** Completion is retryable after the provider has already consumed the email token. */
export async function finishEmailVerification(needsMetadata: boolean, operations: {
  clearMetadata: () => Promise<boolean>
  refreshSession: () => Promise<boolean>
}): Promise<boolean> {
  try {
    if (needsMetadata && !await operations.clearMetadata()) return false
    return await operations.refreshSession()
  } catch {
    return false
  }
}
