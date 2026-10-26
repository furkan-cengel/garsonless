import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const propertiesChrome = readFileSync(`${directory}/TablesQRPropertiesChrome.tsx`, 'utf8')
const sections = readFileSync(`${directory}/TablesQRPropertiesSections.tsx`, 'utf8')
const controls = readFileSync(`${directory}/tables-qr-property-controls.tsx`, 'utf8')
const canvas = readFileSync(`${directory}/TablesQRCanvas.tsx`, 'utf8')
const chrome = readFileSync(`${directory}/TablesBuilderChrome.tsx`, 'utf8')
const picker = readFileSync(`${directory}/TablesQRTablePicker.tsx`, 'utf8')
const mobilePicker = readFileSync(`${directory}/TablesQRMobileTablePicker.tsx`, 'utf8')
const pickerContent = readFileSync(`${directory}/TablesQRPickerContent.tsx`, 'utf8')

test('advanced settings are a disclosure and presets are a labelled radio group', () => {
  assert.match(sections, /aria-expanded=\{advanced\} aria-controls="qr-advanced-settings"/)
  assert.match(sections, /<div id="qr-advanced-settings">/)
  assert.match(sections, /role="radiogroup" aria-labelledby="qr-presets-title"/)
  assert.match(sections, /role="radio" aria-checked=\{qr\._presetId === preset\.id\}/)
  assert.match(propertiesChrome, /AlertDialogAction variant="destructive" onClick=\{onReset\}>Varsayılana dön/)
})

test('field labels programmatically name sliders, switches, segmented groups, colors and text', () => {
  assert.match(controls, /FieldContext\.Provider/)
  assert.match(controls, /aria-labelledby=\{field\?\.labelledBy\}/)
  assert.match(controls, /<Switch[^>]*aria-labelledby/)
  assert.match(controls, /<SliderPrimitive/)
  assert.match(controls, /<ToggleGroup/)
  assert.match(controls, /renk seçici/)
  assert.match(controls, /hex renk değeri/)
})

test('clipboard success is announced only after writeText resolves and failures are visible', () => {
  assert.match(canvas, /await navigator\.clipboard\.writeText\(url\)/)
  assert.match(canvas, /setCopyState\('success'\)/)
  assert.match(canvas, /setCopyState\('error'\)/)
  assert.match(canvas, /role=\{copyState === 'error' \? 'alert' : 'status'\}/)
})

test('download popup delegates menu semantics and keyboard behavior to shadcn DropdownMenu', () => {
  assert.match(canvas, /from '@\/components\/ui\/dropdown-menu'/)
  assert.match(canvas, /<DropdownMenuItem/)
})

test('presets live in the style panel, not the top bar', () => {
  assert.match(sections, /QR_PRESETS\.map/)
  assert.doesNotMatch(chrome, /PRESETS|<DropdownMenu/)
})

test('mobile table selection is a labelled shadcn Sheet with an initial search focus', () => {
  assert.match(picker, /dynamic\(/)
  assert.match(mobilePicker, /from '@\/components\/ui\/sheet'/)
  assert.match(mobilePicker, /<Sheet open=\{open\}/)
  assert.match(mobilePicker, /<SheetTitle>Masa seçin<\/SheetTitle>/)
  assert.match(mobilePicker, /<SheetDescription>/)
  assert.match(pickerContent, /data-modal-initial-focus/)
  assert.match(mobilePicker, /<SheetTrigger/)
})
