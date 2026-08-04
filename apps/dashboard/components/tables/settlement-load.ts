const SETTLEMENT_LOAD_TIMEOUT_MS = 12_000
export const SETTLEMENT_LOAD_ERROR = 'Adisyon bilgileri yüklenemedi. Lütfen tekrar deneyin.'

export async function withSettlementLoadTimeout<T>(
  load: () => Promise<T>,
  timeoutMs = SETTLEMENT_LOAD_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      load(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(SETTLEMENT_LOAD_ERROR)), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}
