/** Keep retry IDs for every intent until this transfer flow completes. */
export function createTransferRequestIds(makeId: () => string = () => crypto.randomUUID()) {
  const ids = new Map<string, string>()
  return {
    forIntent(intent: string) {
      let id = ids.get(intent)
      if (!id) { id = makeId(); ids.set(intent, id) }
      return id
    },
    clear() { ids.clear() },
  }
}
