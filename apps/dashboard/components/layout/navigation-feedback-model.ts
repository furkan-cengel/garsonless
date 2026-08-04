export const NAVIGATION_FEEDBACK_DELAY_MS = 300
export const NAVIGATION_FEEDBACK_STALLED_MS = 10_000

type NavigationFeedbackPhase = 'idle' | 'delay' | 'visible' | 'stalled'

interface NavigationOperation {
  id: string
  sourceRouteKey: string
  targetHref: string
}

export interface NavigationFeedbackSnapshot {
  phase: NavigationFeedbackPhase
  operation: NavigationOperation | null
}

interface NavigationFeedbackScheduler {
  setTimeout: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>
  clearTimeout: (timer: ReturnType<typeof setTimeout>) => void
}

const defaultScheduler: NavigationFeedbackScheduler = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timer) => clearTimeout(timer),
}

export function getRouteKey(value: string, baseHref: string): string | null {
  try {
    const base = new URL(baseHref)
    const url = new URL(value, base)
    if (url.origin !== base.origin) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

export class NavigationFeedbackController {
  private snapshot: NavigationFeedbackSnapshot = { phase: 'idle', operation: null }
  private listeners = new Set<(snapshot: NavigationFeedbackSnapshot) => void>()
  private delayTimer: ReturnType<typeof setTimeout> | null = null
  private stalledTimer: ReturnType<typeof setTimeout> | null = null
  private sequence = 0

  constructor(private readonly scheduler: NavigationFeedbackScheduler = defaultScheduler) {}

  getSnapshot = (): NavigationFeedbackSnapshot => this.snapshot

  subscribe = (listener: (snapshot: NavigationFeedbackSnapshot) => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  begin(targetHref: string, currentHref: string): string | null {
    const sourceRouteKey = getRouteKey(currentHref, currentHref)
    const targetRouteKey = getRouteKey(targetHref, currentHref)
    if (!sourceRouteKey || !targetRouteKey || sourceRouteKey === targetRouteKey) return null

    this.clearTimers()
    const operation: NavigationOperation = {
      id: `navigation-${++this.sequence}`,
      sourceRouteKey,
      targetHref,
    }
    this.publish({ phase: 'delay', operation })
    this.delayTimer = this.scheduler.setTimeout(() => {
      if (this.snapshot.operation?.id === operation.id) {
        this.publish({ phase: 'visible', operation })
      }
    }, NAVIGATION_FEEDBACK_DELAY_MS)
    this.stalledTimer = this.scheduler.setTimeout(() => {
      if (this.snapshot.operation?.id === operation.id) {
        this.publish({ phase: 'stalled', operation })
      }
    }, NAVIGATION_FEEDBACK_STALLED_MS)
    return operation.id
  }

  completeForHref(currentHref: string): void {
    const operation = this.snapshot.operation
    if (!operation) return
    const currentRouteKey = getRouteKey(currentHref, currentHref)
    if (currentRouteKey && currentRouteKey !== operation.sourceRouteKey) this.cancel(operation.id)
  }

  retry(currentHref: string): { id: string; targetHref: string } | null {
    const targetHref = this.snapshot.operation?.targetHref
    if (!targetHref) return null
    const id = this.begin(targetHref, currentHref)
    return id ? { id, targetHref } : null
  }

  cancel(operationId?: string): void {
    if (operationId && this.snapshot.operation?.id !== operationId) return
    this.clearTimers()
    this.publish({ phase: 'idle', operation: null })
  }

  dispose(): void {
    this.clearTimers()
    this.listeners.clear()
    this.snapshot = { phase: 'idle', operation: null }
  }

  private clearTimers(): void {
    if (this.delayTimer) this.scheduler.clearTimeout(this.delayTimer)
    if (this.stalledTimer) this.scheduler.clearTimeout(this.stalledTimer)
    this.delayTimer = null
    this.stalledTimer = null
  }

  private publish(snapshot: NavigationFeedbackSnapshot): void {
    this.snapshot = snapshot
    for (const listener of this.listeners) listener(snapshot)
  }
}
