import { registerAppInstrumentation, reportAppRequestError } from '../../next-instrumentation'

export function register() { registerAppInstrumentation('dashboard') }
export function onRequestError(error: unknown, request: { path?: string; method?: string }, context: { routerKind?: string }) {
  reportAppRequestError('dashboard', error, request, context)
}
