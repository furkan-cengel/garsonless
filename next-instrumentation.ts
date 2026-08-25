type RuntimeErrorEvent = {
  app: string
  release: string
  routeFamily: string
  method: string
  routerKind: string
  errorName: string
  digest: string | null
}

function routeFamily(path: string | undefined): string {
  if (!path) return 'unknown'
  return path
    .split('?')[0]!
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .slice(0, 160)
}

export function registerAppInstrumentation(app: string): void {
  console.info('[masabu-runtime-start]', {
    app,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.MASABU_RELEASE_SHA ?? 'development',
    runtime: process.env.NEXT_RUNTIME ?? 'nodejs',
  })
}

export function reportAppRequestError(
  app: string,
  error: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string },
): void {
  const safeError = error && typeof error === 'object' ? error as { name?: unknown; digest?: unknown } : null
  const event: RuntimeErrorEvent = {
    app,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.MASABU_RELEASE_SHA ?? 'development',
    routeFamily: routeFamily(request.path),
    method: typeof request.method === 'string' ? request.method.slice(0, 12) : 'UNKNOWN',
    routerKind: typeof context.routerKind === 'string' ? context.routerKind.slice(0, 24) : 'unknown',
    errorName: typeof safeError?.name === 'string' ? safeError.name.slice(0, 80) : 'Error',
    digest: typeof safeError?.digest === 'string' ? safeError.digest.slice(0, 120) : null,
  }
  console.error('[masabu-request-error]', event)
}
