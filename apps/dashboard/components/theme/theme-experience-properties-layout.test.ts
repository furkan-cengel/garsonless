import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const source = readFileSync(`${directory}/ThemeExperiencePanels.tsx`, 'utf8')
const clientSource = readFileSync(`${directory}/ThemeEditorClient.tsx`, 'utf8')
const styles = readFileSync(`${directory}/ThemeExperiencePanels.module.css`, 'utf8')

test('experience properties share one compact panel and card rhythm', () => {
  assert.match(source, /data-theme-experience-properties/)
  assert.match(source, /data-settings-density="compact"/)
  assert.match(source, /data-theme-experience-settings-stack[^>]+gap-2\.5 p-3/)
  assert.match(source, /function SettingsCard\(\{ children, className, toolbar, density = 'compact' \}/)
  assert.match(source, /data-settings-card-density=\{density\}/)
  assert.match(source, /gap-0 py-0/)
  assert.match(source, /flex flex-col gap-2\.5 px-3 py-2\.5/)
  assert.doesNotMatch(source, /<SettingsCard className="mt-3\.5"/)
})

test('home tabs and range values use the streamlined property chrome', () => {
  assert.match(source, /<TabsList variant="line"/)
  assert.match(source, /className="h-8 w-full justify-stretch px-1"/)
  assert.match(source, /function RangeField/)
  assert.match(source, /<output[^>]+aria-live="polite"/)
  assert.match(source, /size-7 shrink-0 place-items-center rounded-lg bg-muted/)
})

test('compact typography remains scoped to the properties panel', () => {
  assert.match(source, /ThemeExperiencePanels\.module\.css/)
  assert.match(source, /className=\{styles\.properties\}/)
  assert.match(styles, /\.properties :global\(\[data-slot="field-label"\]\)/)
  assert.match(styles, /font-size: 12px/)
  assert.match(styles, /data-slot="field-description"/)
  assert.doesNotMatch(styles, /^:global/m)
})

test('home campaign slider receives server-projected coupon choices', () => {
  assert.match(clientSource, /<ThemeExperienceProperties[\s\S]*couponOptions=\{couponOptions\}/)
  assert.match(source, /couponOptions: PublicCouponChoice\[\]/)
  assert.match(source, /<SectionSettingsEditor[\s\S]*couponOptions=\{couponOptions\}/)
  assert.match(source, /couponId: value[\s\S]*couponCode: coupon\.code/)
})
