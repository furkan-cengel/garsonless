/** One in-flight operation per mounted controller, including transport failures. */
export function createTableMutationRunner() {
  let running = false
  return async (options: {
    action: () => Promise<void>
    onStart: () => void
    onFailure: () => void
    onFinish: () => void
  }) => {
    if (running) return
    running = true
    try {
      options.onStart()
      await options.action()
    } catch {
      options.onFailure()
    } finally {
      running = false
      options.onFinish()
    }
  }
}
