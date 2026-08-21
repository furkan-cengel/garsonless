import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildLayoutDensityPatch,
  resolveLayoutDensityPreset,
} from './layout-density-model'

test('layout density presets project to the existing five spacing fields', () => {
  assert.deepEqual(buildLayoutDensityPatch('compact'), {
    pad: 12,
    gap: 8,
    sectionGap: 16,
    sectionHeadingTopGap: 16,
    sectionHeadingBottomGap: 8,
  })
  assert.deepEqual(buildLayoutDensityPatch('normal'), {
    pad: 16,
    gap: 12,
    sectionGap: 24,
    sectionHeadingTopGap: 24,
    sectionHeadingBottomGap: 12,
  })
  assert.deepEqual(buildLayoutDensityPatch('comfortable'), {
    pad: 24,
    gap: 16,
    sectionGap: 32,
    sectionHeadingTopGap: 32,
    sectionHeadingBottomGap: 16,
  })
})

test('layout density derives a preset only when every projected value matches', () => {
  assert.equal(resolveLayoutDensityPreset(buildLayoutDensityPatch('normal')), 'normal')
  assert.equal(resolveLayoutDensityPreset({ ...buildLayoutDensityPatch('normal'), gap: 14 }), null)
})
