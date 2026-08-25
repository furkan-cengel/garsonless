import { registerAppInstrumentation, reportAppRequestError } from '../../next-instrumentation'

export function register() { registerAppInstrumentation('marketing') }
export function onRequestError(error: unknown, request: { path?: string; method?: string }, context: { routerKind?: string }) {
  reportAppRequestError('marketing', error, request, context)
}
