import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('./ThemeExperiencePanels.tsx', import.meta.url), 'utf8')

test('Giriş Header editor exposes bounded media, logo and copy controls', () => {
  assert.match(panel, /title="Header medyası"/)
  assert.match(panel, /title="Header içeriği"/)
  assert.match(panel, /Tüm durumlarda sabit/)
  assert.match(panel, /auth-header-background/)
  assert.match(panel, /auth-header-logo/)
  assert.match(panel, /logoMode/)
  assert.match(panel, /Header başlığı \(isteğe bağlı\)/)
  assert.match(panel, /Slogan \(isteğe bağlı\)/)
  assert.match(panel, /maxLength=\{100\}/)
  assert.match(panel, /maxLength=\{180\}/)
  assert.match(panel, /<RangeControl label="Fotoğraf karartması" min=\{0\} max=\{85\}/)
  assert.match(panel, /import \{ Slider \} from '@\/components\/ui\/slider'/)
  assert.match(panel, /Alanı doldur \(cover\)/)
  assert.match(panel, /Görselin tamamı \(contain\)/)
  assert.match(panel, /imagePositionX/)
  assert.match(panel, /imagePositionY/)
  assert.match(panel, /Kompakt/)
  assert.match(panel, /Standart/)
  assert.match(panel, /Geniş/)
  assert.match(panel, /İçerik tonu/)
})

test('auth header uploads stay behind the server-owned theme media action', () => {
  assert.match(panel, /uploadThemeMedia\(form\)/)
  assert.match(panel, /form\.set\('restaurantId', restaurantId\)/)
  assert.match(panel, /form\.set\('purpose', kind === 'background'/)
  assert.doesNotMatch(panel, /storage\.from|createDashboardBrowserClient/)
})

test('first auth photo hides only the default logo and semantic colors remain resettable', () => {
  assert.match(panel, /!header\.backgroundImageUrl && header\.logoMode === 'restaurant'/)
  assert.match(panel, /logoMode: 'none' as const/)
  assert.match(panel, /Fotoğraf ve varsayılan işletme logosu aynı alanda çakışabilir/)
  assert.match(panel, /Ortak temadan kullan/)
  assert.match(panel, /field="fieldSurface"/)
  assert.match(panel, /field="fieldBorder"/)
  assert.match(panel, /inspectAuthSurfaceContrast\(theme\)/)
})
