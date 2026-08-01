import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const directory = new URL('.', import.meta.url)
const source = (file: string) => readFileSync(new URL(file, directory), 'utf8')

const settingsForm = source('SettingsForm.tsx')
const styles = source('SettingsForm.module.css')
const primitives = source('primitives.tsx')
const hours = source('StoreSections.tsx')
const kitchen = source('KitchenAccessSection.tsx')
const loyalty = source('LoyaltySection.tsx')
const billing = source('BillingSection.tsx')
const unsavedDialog = source('../overlays/UnsavedChangesDialog.tsx')
const modalFocus = source('../overlays/use-modal-dialog-focus.ts')
const iconRail = source('../layout/IconRail.tsx')
const advanced = source('AdvancedSections.tsx')
const settingsPage = source('../../app/dashboard/[restaurantId]/settings/page.tsx')

test('settings navigation exposes the canonical current section', () => {
  assert.match(settingsForm, /aria-current=\{active \? 'page' : undefined\}/)
})

test('shared form rows associate labels and hint descriptions with native controls', () => {
  for (const component of [settingsForm, primitives]) {
    assert.match(component, /<label htmlFor=\{controlId\}/)
    assert.match(component, /'aria-describedby'/)
  }
})

test('settings focus rings and minimum pointer targets are scoped to the settings root', () => {
  assert.match(styles, /\.root :is\(button, a\)/)
  assert.match(styles, /min-width: 44px/)
  assert.match(styles, /min-height: 44px/)
  assert.match(styles, /:focus-visible/)
  assert.match(styles, /outline: 2px solid var\(--text\) !important/)
  assert.match(styles, /input\[type='range'\]/)
})

test('settings honors reduced-motion without depending on component inline transitions', () => {
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(styles, /\.root \*::before/)
  assert.match(styles, /animation-duration: 0s !important/)
  assert.match(styles, /transition-duration: 0s !important/)
  assert.match(iconRail, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(iconRail, /\.rail-link,\.rail-tooltip,\.rail-btn \{ transition:none!important; \}/)
})

test('modal dialogs trap focus, close on Escape, and restore their opener', () => {
  assert.match(modalFocus, /event\.key === 'Escape'/)
  assert.match(modalFocus, /event\.key !== 'Tab'/)
  assert.match(modalFocus, /event\.shiftKey/)
  assert.match(modalFocus, /previouslyFocused\?\.isConnected/)
  assert.match(unsavedDialog, /useModalDialogFocus\(onKeepEditing\)/)
  assert.match(billing, /useModalDialogFocus\(onClose\)/)
  assert.match(unsavedDialog, /data-dialog-initial-focus/)
  assert.match(billing, /data-dialog-initial-focus/)
  assert.match(billing, /onFocus=\{\(\) => dialogRef\.current/)
})

test('section-specific controls expose names and selection semantics', () => {
  assert.match(hours, /açılış saati/)
  assert.match(hours, /kapanış saati/)
  assert.match(kitchen, /aria-label="Yeni istasyon adı"/)
  assert.match(kitchen, /role="switch"/)
  assert.match(loyalty, /aria-pressed=\{active\}/)
  assert.match(loyalty, /minimum puanı/)
  assert.match(loyalty, /puan bedeli/)
})

test('billing plan cards reflow instead of squeezing fallback prices', () => {
  assert.match(billing, /repeat\(auto-fit, minmax\(180px, 1fr\)\)/)
  assert.match(billing, /minWidth: 0/)
  assert.match(billing, /overflowWrap: 'anywhere'/)
})

test('security event timestamps hydrate from one server snapshot', () => {
  assert.match(settingsPage, /renderedAt=\{new Date\(\)\.toISOString\(\)\}/)
  assert.match(advanced, /relativeTime\(ev\.createdAt, renderedAt\)/)
  assert.match(advanced, /timeZone: 'Europe\/Istanbul'/)
  assert.doesNotMatch(advanced, /Date\.now\(\)/)
})
