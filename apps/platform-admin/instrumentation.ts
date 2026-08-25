import { registerAppInstrumentation, reportAppRequestError } from '../../next-instrumentation'

export function register() { registerAppInstrumentation('platform-admin') }
export function onRequestError(error: unknown, request: { path?: string; method?: string }, context: { routerKind?: string }) {
  reportAppRequestError('platform-admin', error, request, context)
}
