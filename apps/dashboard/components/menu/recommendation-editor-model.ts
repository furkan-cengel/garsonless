export function haveSameOrderedIds(current: readonly string[], saved: readonly string[]): boolean {
  return current.length === saved.length
    && current.every((id, index) => id === saved[index])
}
