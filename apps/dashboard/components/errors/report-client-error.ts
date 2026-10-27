import { reportClientErrorAction } from '../../lib/actions/client-errors'

const reported = new WeakSet<object>()

/** Sends a client-side route error to the server log once. Errors with a digest
 * came from the server and are already in its log, so they are skipped. */
export function reportClientError(error: Error & { digest?: string }, screen: string, pathname: string | null): void {
  if (error.digest || reported.has(error)) return
  reported.add(error)
  void reportClientErrorAction({
    screen,
    pathname: (pathname ?? '').slice(0, 200),
    name: String(error.name || 'Error').slice(0, 80),
    message: String(error.message || '').slice(0, 500),
    ...(error.stack ? { stack: error.stack.slice(0, 2_000) } : {}),
  }).catch(() => {})
}
