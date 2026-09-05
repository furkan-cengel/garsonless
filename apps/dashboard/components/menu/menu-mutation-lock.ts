/** Structural edits exclude every product edit; disjoint products may save together. */
export function createMenuMutationLock() {
  const items = new Set<string>()
  let structural = false
  return {
    acquire(ids: readonly string[] | null): (() => void) | null {
      if (structural || (ids === null ? items.size > 0 : ids.some((id) => items.has(id)))) return null
      if (ids === null) structural = true
      else ids.forEach((id) => items.add(id))
      let released = false
      return () => {
        if (released) return
        released = true
        if (ids === null) structural = false
        else ids.forEach((id) => items.delete(id))
      }
    },
    snapshot: () => ({ itemIds: new Set(items), structural }),
  }
}
