import { registerAppInstrumentation, reportAppRequestError } from '../../next-instrumentation'

export function register() { registerAppInstrumentation('kitchen') }
export function onRequestError(error: unknown, request: { path?: string; method?: string }, context: { routerKind?: string }) {
  reportAppRequestError('kitchen', error, request, context)
}
