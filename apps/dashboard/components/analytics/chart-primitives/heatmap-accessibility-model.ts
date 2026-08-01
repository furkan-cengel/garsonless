export const HEATMAP_FIRST_HOUR = 8
export const HEATMAP_LAST_HOUR = 22
export const HEATMAP_LAST_DAY = 6

export interface HeatmapFocus {
  day: number
  hour: number
}

export function moveHeatmapFocus(current: HeatmapFocus, key: string): HeatmapFocus {
  switch (key) {
    case 'ArrowLeft':
      return { ...current, hour: Math.max(HEATMAP_FIRST_HOUR, current.hour - 1) }
    case 'ArrowRight':
      return { ...current, hour: Math.min(HEATMAP_LAST_HOUR, current.hour + 1) }
    case 'ArrowUp':
      return { ...current, day: Math.max(0, current.day - 1) }
    case 'ArrowDown':
      return { ...current, day: Math.min(HEATMAP_LAST_DAY, current.day + 1) }
    case 'Home':
      return { ...current, hour: HEATMAP_FIRST_HOUR }
    case 'End':
      return { ...current, hour: HEATMAP_LAST_HOUR }
    default:
      return current
  }
}
