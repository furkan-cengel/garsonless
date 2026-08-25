import { registerAppInstrumentation, reportAppRequestError } from '../../next-instrumentation'

export function register() { registerAppInstrumentation('menu') }
export function onRequestError(error: unknown, request: { path?: string; method?: string }, context: { routerKind?: string }) {
  reportAppRequestError('menu', error, request, context)
}
