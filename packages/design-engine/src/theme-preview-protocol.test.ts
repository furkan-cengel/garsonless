import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from './schema'
import {
  THEME_PREVIEW_CHANNEL,
  THEME_PREVIEW_VERSION,
  createFullThemePreviewCommand,
  createRevealMenuPageBlockCommand,
  createSetMenuCartPreviewStateCommand,
  createThemeAppliedEvent,
  createThemePreviewNavigationEvent,
  parseThemePreviewCommand,
  parseThemePreviewEvent,
} from './theme-preview-protocol'
import { parseOpenThemeNavDrawerCommand } from './theme-preview-nav-command'

test('yalnız sürümlü ve izinli preview komutlarını kabul eder', () => {
  const message = createFullThemePreviewCommand(DEFAULT_THEME, 'request-1')
  assert.ok(message)
  assert.deepEqual(parseThemePreviewCommand(message), message)

  assert.equal(parseThemePreviewCommand({ ...message, channel: 'foreign' }), null)
  assert.equal(parseThemePreviewCommand({ ...message, version: 1 }), null)
  assert.equal(parseThemePreviewCommand({ ...message, type: 'CSS_VARS_UPDATE' }), null)
  assert.equal(parseThemePreviewCommand({ type: 'GARSONLESS_THEME', css: 'body{display:none}' }), null)
})

test('preview yüzeyi ve örnek durumu kapalı sözlükten doğrular', () => {
  const auth = createFullThemePreviewCommand(DEFAULT_THEME, undefined, { surface: 'auth', state: 'otp' })
  assert.ok(auth && auth.type === 'FULL_THEME_UPDATE')
  assert.equal(auth.context.surface, 'auth')
  assert.equal(auth.context.state, 'otp')

  for (const state of ['overview', 'orders', 'favorites', 'profile', 'detail', 'reorder', 'loading', 'error', 'empty'] as const) {
    const account = createFullThemePreviewCommand(DEFAULT_THEME, undefined, { surface: 'account', state })
    assert.ok(account && account.type === 'FULL_THEME_UPDATE')
    assert.equal(account.context.surface, 'account')
    assert.equal(account.context.state, state)
  }

  assert.equal(createFullThemePreviewCommand(DEFAULT_THEME, undefined, {
    surface: 'menu',
    state: 'otp',
  }), null)
  assert.equal(createFullThemePreviewCommand(DEFAULT_THEME, undefined, {
    surface: 'account',
    state: 'cart',
  }), null)
})

test('önizleme navigasyonu yalnız ana sayfa ve menü yüzeylerini bildirir', () => {
  const menu = createThemePreviewNavigationEvent('menu')
  assert.ok(menu)
  assert.deepEqual(parseThemePreviewEvent(menu), menu)
  assert.deepEqual(parseThemePreviewEvent(createThemePreviewNavigationEvent('home')), createThemePreviewNavigationEvent('home'))
  assert.equal(createThemePreviewNavigationEvent('checkout'), null)
  assert.equal(parseThemePreviewEvent({
    channel: THEME_PREVIEW_CHANNEL,
    version: THEME_PREVIEW_VERSION,
    type: 'PREVIEW_NAVIGATION',
    surface: 'account',
  }), null)
})

test('tema payloadını canonical güvenlik doğrulamasından geçirir', () => {
  const parsed = parseThemePreviewCommand({
    channel: THEME_PREVIEW_CHANNEL,
    version: THEME_PREVIEW_VERSION,
    type: 'FULL_THEME_UPDATE',
    context: { surface: 'menu' },
    theme: { ...DEFAULT_THEME, bg: 'url(javascript:alert(1))', unknown: '<script>' },
  })
  assert.ok(parsed && parsed.type === 'FULL_THEME_UPDATE')
  assert.match(parsed.theme.bg, /^#[0-9a-f]{6}$/i)
  assert.notEqual(parsed.theme.bg, 'url(javascript:alert(1))')
  assert.equal('unknown' in parsed.theme, false)
})

test('aşırı büyük, bozuk veya sınırsız event payloadlarını reddeder', () => {
  assert.equal(parseThemePreviewCommand({
    channel: THEME_PREVIEW_CHANNEL,
    version: THEME_PREVIEW_VERSION,
    type: 'FULL_THEME_UPDATE',
    context: { surface: 'menu' },
    theme: { ...DEFAULT_THEME, sectionSettings: { x: { value: 'x'.repeat(170 * 1024) } } },
  }), null)
  assert.equal(createThemeAppliedEvent(''), null)
  assert.equal(parseThemePreviewEvent({
    channel: THEME_PREVIEW_CHANNEL,
    version: THEME_PREVIEW_VERSION,
    type: 'COMPONENT_CLICK',
    component: 'card',
    x: Number.POSITIVE_INFINITY,
    y: 0,
    iframeWidth: 390,
    iframeHeight: 844,
  }), null)
})

test('menü drawer preview komutu hafif istemci sınırında da kapalı doğrulanır', () => {
  assert.deepEqual(parseOpenThemeNavDrawerCommand({
    channel: THEME_PREVIEW_CHANNEL,
    version: THEME_PREVIEW_VERSION,
    type: 'OPEN_NAV_DRAWER',
    sectionId: 'hours',
  }), { sectionId: 'hours' })
  assert.equal(parseOpenThemeNavDrawerCommand({
    channel: THEME_PREVIEW_CHANNEL,
    version: THEME_PREVIEW_VERSION,
    type: 'FULL_THEME_UPDATE',
    sectionId: 'hours',
  }), null)
  assert.equal(parseOpenThemeNavDrawerCommand({
    channel: 'foreign',
    version: THEME_PREVIEW_VERSION,
    type: 'OPEN_NAV_DRAWER',
    sectionId: 'hours',
  }), null)
})

test('sepet önizleme durumu yalnız kapalı sözlükten ve null kapatma komutundan kabul edilir', () => {
  for (const state of ['trigger', 'filled', 'empty'] as const) {
    const command = createSetMenuCartPreviewStateCommand(state)
    assert.deepEqual(parseThemePreviewCommand(command), command)
  }
  const off = createSetMenuCartPreviewStateCommand(null)
  assert.deepEqual(parseThemePreviewCommand(off), off)
  assert.equal(parseThemePreviewCommand({ ...off, state: 'customer-cart' }), null)
})

test('sayfa akışı reveal komutu yalnız bilinen hedef türlerini ve sınırlı kimlikleri kabul eder', () => {
  for (const kind of ['nav', 'category', 'section'] as const) {
    const command = createRevealMenuPageBlockCommand({ kind, id: 'coffee' })
    assert.ok(command)
    assert.deepEqual(parseThemePreviewCommand(command), command)
  }
  assert.equal(createRevealMenuPageBlockCommand({ kind: 'category', id: '' }), null)
  assert.equal(parseThemePreviewCommand({
    channel: THEME_PREVIEW_CHANNEL,
    version: THEME_PREVIEW_VERSION,
    type: 'REVEAL_MENU_PAGE_BLOCK',
    target: { kind: 'unknown', id: 'coffee' },
  }), null)
})
