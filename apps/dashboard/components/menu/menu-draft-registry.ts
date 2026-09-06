export interface MenuDraftEntry {
  dirty: boolean
  pending: boolean
  discard: () => void
}

/** One owner for all menu drafts, including drawers and category forms. */
export class MenuDraftRegistry {
  private entries = new Map<string, MenuDraftEntry>()
  private listeners = new Set<() => void>()
  private version = 0
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.version
  get dirty() { return [...this.entries.values()].some((entry) => entry.dirty) }
  get pending() { return [...this.entries.values()].some((entry) => entry.pending) }
  set(id: string, entry: MenuDraftEntry) {
    const previous = this.entries.get(id)
    this.entries.set(id, entry)
    if (previous?.dirty !== entry.dirty || previous?.pending !== entry.pending) this.emit()
  }
  remove(id: string) { if (this.entries.delete(id)) this.emit() }
  discard() {
    if (this.pending) return false
    const entries = [...this.entries.values()]
    this.entries.clear()
    for (const entry of entries) if (entry.dirty) entry.discard()
    this.emit()
    return true
  }
  private emit() { this.version += 1; this.listeners.forEach((listener) => listener()) }
}
