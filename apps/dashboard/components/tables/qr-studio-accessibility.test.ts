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

test('property tabs delegate roving focus and keyboard behavior to shadcn Tabs', () => {
  assert.match(propertiesChrome, /from '@\/components\/ui\/tabs'/)
  assert.match(propertiesChrome, /<TabsList variant="line"/)
  assert.match(propertiesChrome, /<TabsTrigger[^>]*value=\{item\.id\}/)
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

test('topbar exposes only the five primary presets without an overflow menu', () => {
  assert.match(chrome, /PRESETS\.slice\(0, 5\)\.map/)
  assert.doesNotMatch(chrome, /MoreHorizontal/)
  assert.doesNotMatch(chrome, /<DropdownMenu/)
  assert.doesNotMatch(chrome, /Tüm stiller/)
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
