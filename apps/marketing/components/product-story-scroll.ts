/** A 96px dead band around each boundary prevents scroll-direction flicker. */
export function nextStoryChapter(current: number, centers: number[], target: number): number {
  let next = current
  while (next < centers.length - 1 && centers[next]! < target - 48) next++
  while (next > 0 && centers[next - 1]! > target + 48) next--
  return next
}
