import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const propertiesChrome = readFileSync(`${directory}/TablesQRPropertiesChrome.tsx`, 'utf8')
const controls = readFileSync(`${directory}/tables-qr-property-controls.tsx`, 'utf8')
const canvas = readFileSync(`${directory}/TablesQRCanvas.tsx`, 'utf8')
const chrome = readFileSync(`${directory}/TablesBuilderChrome.tsx`, 'utf8')
const picker = readFileSync(`${directory}/TablesQRTablePicker.tsx`, 'utf8')
const mobilePicker = readFileSync(`${directory}/TablesQRMobileTablePicker.tsx`, 'utf8')
const pickerContent = readFileSync(`${directory}/TablesQRPickerContent.tsx`, 'utf8')

test('property tabs use roving focus and the complete horizontal keyboard contract', () => {
  assert.match(propertiesChrome, /tabIndex=\{tab === item\.id \? 0 : -1\}/)
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.match(propertiesChrome, new RegExp(`event\\.key === '${key}'`))
  assert.match(propertiesChrome, /tabRefs\.current\[index\]\?\.focus\(\)/)
})

test('field labels programmatically name sliders, switches, segmented groups, colors and text', () => {
  assert.match(controls, /FieldContext\.Provider/)
  assert.match(controls, /aria-labelledby=\{field\?\.labelledBy\}/)
  assert.match(controls, /role="switch"/)
  assert.match(controls, /renk seçici/)
  assert.match(controls, /hex renk değeri/)
  assert.match(controls, /minHeight: 44/)
})

test('clipboard success is announced only after writeText resolves and failures are visible', () => {
  assert.match(canvas, /await navigator\.clipboard\.writeText\(url\)/)
  assert.match(canvas, /setCopyState\('success'\)/)
  assert.match(canvas, /setCopyState\('error'\)/)
  assert.match(canvas, /role=\{copyState === 'error' \? 'alert' : 'status'\}/)
})

test('preset and download popups expose menu semantics, keyboard navigation and Escape', () => {
  for (const source of [canvas, chrome]) {
    assert.match(source, /aria-haspopup="menu"/)
    assert.match(source, /aria-expanded=/)
    assert.match(source, /role="menu"/)
    assert.match(source, /ArrowDown/)
    assert.match(source, /ArrowUp/)
    assert.match(source, /event\.key (?:===|!==) 'Escape'/)
  }
})

test('mobile table selection is a labelled shared dialog with an initial search focus', () => {
  assert.match(picker, /dynamic\(/)
  assert.match(mobilePicker, /<AccessibleDialog labelledBy="qr-mobile-picker-title"/)
  assert.match(pickerContent, /data-modal-initial-focus/)
  assert.match(mobilePicker, /aria-haspopup="dialog"/)
  assert.match(mobilePicker, /aria-expanded=\{open\}/)
})
