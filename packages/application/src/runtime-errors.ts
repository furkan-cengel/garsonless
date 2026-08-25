export interface RuntimeErrorEvent {
  app: string
  release: string
  routeFamily: string
  method: string
  routerKind: string
  errorName: string
  digest: string | null
}
