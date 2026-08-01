/** Keep a late-loaded chart from taking down the report route when its chunk is
 * requested while offline. The import stays pending until reconnect, then the
 * bundler gets a fresh chance to fetch the chunk. */
export async function loadAnalyticsChart<T>(loader: () => Promise<T>): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    if (typeof window === 'undefined' || navigator.onLine) throw error
    await new Promise<void>((resolve) => window.addEventListener('online', () => resolve(), { once: true }))
    return loader()
  }
}
