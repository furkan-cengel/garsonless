import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const source = readFileSync(`${directory}/ThemeSectionSettings.tsx`, 'utf8')

test('section settings use semantic groups and labelled compact controls', () => {
  assert.match(source, /<FieldSet/)
  assert.match(source, /<FieldLegend variant="label"/)
  assert.match(source, /data-section-setting-group=\{group\.id\}/)
  assert.match(source, /<FieldLabel htmlFor=\{controlId\}/)
  assert.match(source, /<output htmlFor=\{controlId\}/)
  assert.match(source, /grid-cols-\[104px_minmax\(0,1fr\)\]/)
  assert.match(source, /layout === 'toggle'/)
  assert.match(source, /layout === 'range'/)
  assert.match(source, /layout === 'stacked'/)
  assert.match(source, /text-xs leading-4/)
  assert.match(source, /data-selected-product-summary/)
  assert.match(source, /text-\[10px\] font-bold uppercase/)
  assert.match(source, /max-w-full truncate text-xs font-bold leading-tight/)
})

test('section image upload actions live in a footer instead of overlaying the preview', () => {
  const start = source.indexOf('export function SectionImageUploadPanel')
  const end = source.indexOf('const SERVICE_REQUEST_ICON_UPLOADS', start)
  const panelSource = source.slice(start, end)

  assert.ok(start >= 0 && end > start)
  assert.match(panelSource, /data-section-image-upload-actions/)
  assert.match(panelSource, /style=\{\{ width: '100%', maxWidth: 'none' \}\}/)
  assert.match(panelSource, /justify-end/)
  assert.doesNotMatch(panelSource, /<AttachmentActions/)
  assert.ok(panelSource.indexOf('</AttachmentContent>') < panelSource.indexOf('data-section-image-upload-actions'))
})
