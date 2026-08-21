import assert from 'node:assert/strict'
import test from 'node:test'

import { getSelectedDrawerPreviewSectionId } from './use-theme-editor-drawer-preview'

test('drawer preview opens for ordinary drawer sections', () => {
  assert.equal(getSelectedDrawerPreviewSectionId({
    selectedSectionDefinitionId: 'hours',
    selectedSectionPlacement: 'drawer',
  }), 'hours')
})

test('global request buttons open the drawer when their service placement is drawer', () => {
  assert.equal(getSelectedDrawerPreviewSectionId({
    selectedSectionDefinitionId: 'request-buttons',
    selectedServicePlacement: 'drawer',
  }), 'request-buttons')
})

test('global request buttons do not force the drawer for other placements', () => {
  for (const selectedServicePlacement of ['header', 'floating', 'hidden'] as const) {
    assert.equal(getSelectedDrawerPreviewSectionId({
      selectedSectionDefinitionId: 'request-buttons',
      selectedServicePlacement,
    }), null)
  }
})
