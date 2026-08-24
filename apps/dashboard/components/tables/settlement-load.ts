const SETTLEMENT_LOAD_TIMEOUT_MS = 12_000
export const SETTLEMENT_LOAD_ERROR = 'Adisyon bilgileri yüklenemedi. Lütfen tekrar deneyin.'
const inFlightSettlementLoads = new Map<string, Promise<unknown>>()
const recentSettlementLoads = new Map<string, { expiresAt: number; value: unknown }>()

type SettlementLoadReuseOptions<T> = {
  resultTtlMs?: number
  shouldCache?: (result: T) => boolean
}

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

export async function withSettlementLoadRetry<T>(
  load: () => Promise<T>,
  shouldRetry: (result: T) => boolean,
  retries = 1,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await withSettlementLoadTimeout(load)
      if (!shouldRetry(result) || attempt === retries) return result
    } catch (error) {
      lastError = error
      if (attempt === retries) throw error
    }
  }
  throw lastError
}

export function reuseSettlementLoad<T>(
  key: string,
  load: () => Promise<T>,
  options: SettlementLoadReuseOptions<T> = {},
): Promise<T> {
  const cached = recentSettlementLoads.get(key) as { expiresAt: number; value: T } | undefined
  if (cached) {
    if (cached.expiresAt > Date.now()) return Promise.resolve(cached.value)
    recentSettlementLoads.delete(key)
  }

  const existing = inFlightSettlementLoads.get(key) as Promise<T> | undefined
  if (existing) return existing

  const promise = load()
  inFlightSettlementLoads.set(key, promise)
  const clear = () => {
    if (inFlightSettlementLoads.get(key) === promise) inFlightSettlementLoads.delete(key)
  }
  void promise.then((result) => {
    if ((options.resultTtlMs ?? 0) > 0 && (options.shouldCache?.(result) ?? true)) {
      recentSettlementLoads.set(key, {
        expiresAt: Date.now() + (options.resultTtlMs ?? 0),
        value: result,
      })
    }
    clear()
  }, clear)
  return promise
}

export function clearRecentSettlementLoads(prefix: string): void {
  for (const key of recentSettlementLoads.keys()) {
    if (key.startsWith(prefix)) recentSettlementLoads.delete(key)
  }
}
