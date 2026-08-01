import assert from 'node:assert/strict'
import test from 'node:test'
import { moveHeatmapFocus } from './chart-primitives/heatmap-accessibility-model'

test('heatmap arrow navigation moves within the 7 by 15 grid', () => {
  assert.deepEqual(moveHeatmapFocus({ day: 3, hour: 12 }, 'ArrowLeft'), { day: 3, hour: 11 })
  assert.deepEqual(moveHeatmapFocus({ day: 3, hour: 12 }, 'ArrowRight'), { day: 3, hour: 13 })
  assert.deepEqual(moveHeatmapFocus({ day: 3, hour: 12 }, 'ArrowUp'), { day: 2, hour: 12 })
  assert.deepEqual(moveHeatmapFocus({ day: 3, hour: 12 }, 'ArrowDown'), { day: 4, hour: 12 })
})

test('heatmap navigation clamps edges and supports Home and End', () => {
  assert.deepEqual(moveHeatmapFocus({ day: 0, hour: 8 }, 'ArrowLeft'), { day: 0, hour: 8 })
  assert.deepEqual(moveHeatmapFocus({ day: 0, hour: 8 }, 'ArrowUp'), { day: 0, hour: 8 })
  assert.deepEqual(moveHeatmapFocus({ day: 6, hour: 22 }, 'ArrowRight'), { day: 6, hour: 22 })
  assert.deepEqual(moveHeatmapFocus({ day: 6, hour: 22 }, 'ArrowDown'), { day: 6, hour: 22 })
  assert.deepEqual(moveHeatmapFocus({ day: 2, hour: 14 }, 'Home'), { day: 2, hour: 8 })
  assert.deepEqual(moveHeatmapFocus({ day: 2, hour: 14 }, 'End'), { day: 2, hour: 22 })
})
