export function normalizeProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0
  return Math.min(100, Math.max(0, Math.round(progress)))
}
