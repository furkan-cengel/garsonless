import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME } from './schema'
import { TEMPLATES } from './templates'
import { normalizeThemeTemplateId, resolveTheme, sanitizeThemeTokens } from './theme-policy'

test('retired template ids normalize to the canonical menu while preserving safe tenant tokens', () => {
  const resolved = resolveTheme({
    settings: { active_template_id: 'spain' },
    themeTokens: {
      __template_id: 'spain',
      accent: '#123456',
      bodyFont: 'Inter',
      cardVariant: 'spain',
    },
  })

  assert.equal(normalizeThemeTemplateId('spain'), 'default')
  assert.equal(resolved.templateId, 'default')
  assert.equal(resolved.theme.accent, '#123456')
  assert.equal(resolved.theme.bodyFont, 'Inter')
  assert.equal(Object.hasOwn(resolved.theme, 'cardVariant'), false)
})

test('theme sanitizer rejects CSS-shaped values and keeps canonical fallbacks', () => {
  const sanitized = sanitizeThemeTokens({
    accent: 'var(--stolen)',
    bodyFont: 'Inter; background:red',
    cols: 99,
  }, 'default')

  assert.ok(sanitized)
  assert.equal(sanitized.accent, TEMPLATES.default!.accent)
  assert.equal(sanitized.bodyFont, TEMPLATES.default!.bodyFont)
  assert.equal(sanitized.cols, 4)
})

test('legacy temayı güvenli V2 yüzey varsayılanlarıyla okur', () => {
  const sanitized = sanitizeThemeTokens({ accent: '#123456' }, 'default')
  assert.ok(sanitized?.surfaces)
  assert.equal(sanitized.experienceVersion, 2)
  assert.equal(sanitized.surfaces.home.enabled, false)
  assert.equal(sanitized.surfaces.auth.preset, 'brand-panel')
  assert.equal(sanitized.surfaces.checkout.preset, 'clean')
})

test('home yüzeyinde yalnız bilinen bölümleri ve güvenli URLleri tutar', () => {
  const sanitized = sanitizeThemeTokens({
    surfaces: {
      home: {
        enabled: true,
        sections: [
          { id: 'hero-1', type: 'hero', enabled: true, title: 'Merhaba', showMenuCta: false, imageUrl: 'javascript:alert(1)' },
          { id: 'script-1', type: 'script', enabled: true, body: '<script>alert(1)</script>' },
        ],
      },
      auth: {
        preset: 'unknown',
        title: 'Güvenli giriş',
        header: {
          logoMode: 'custom',
          logoUrl: 'javascript:alert(1)',
          backgroundImageUrl: 'https://assets.example/auth.webp',
          title: 'Yeni marka',
          slogan: 'Masaya özel deneyim',
          align: 'left',
          overlay: 999,
          imageFit: 'contain',
          imagePositionX: -20,
          imagePositionY: 140,
          height: 'wide',
          contentTone: 'dark',
          backgroundColor: '#f5f1e8',
        },
      },
      checkout: { preset: 'soft' },
    },
  }, 'default')

  assert.ok(sanitized?.surfaces)
  assert.equal(sanitized.surfaces.home.enabled, true)
  assert.equal(sanitized.surfaces.home.sections.length, 1)
  assert.equal(sanitized.surfaces.home.sections[0]?.showMenuCta, true)
  assert.equal(sanitized.surfaces.home.sections[0]?.imageUrl, undefined)
  assert.equal(sanitized.surfaces.auth.preset, 'brand-panel')
  assert.equal(sanitized.surfaces.auth.header.logoMode, 'custom')
  assert.equal(sanitized.surfaces.auth.header.logoUrl, undefined)
  assert.equal(sanitized.surfaces.auth.header.backgroundImageUrl, 'https://assets.example/auth.webp')
  assert.equal(sanitized.surfaces.auth.header.title, 'Yeni marka')
  assert.equal(sanitized.surfaces.auth.header.slogan, 'Masaya özel deneyim')
  assert.equal(sanitized.surfaces.auth.header.align, 'left')
  assert.equal(sanitized.surfaces.auth.header.overlay, 85)
  assert.equal(sanitized.surfaces.auth.header.imageFit, 'contain')
  assert.equal(sanitized.surfaces.auth.header.imagePositionX, 0)
  assert.equal(sanitized.surfaces.auth.header.imagePositionY, 100)
  assert.equal(sanitized.surfaces.auth.header.height, 'wide')
  assert.equal(sanitized.surfaces.auth.header.contentTone, 'dark')
  assert.equal(sanitized.surfaces.auth.header.backgroundColor, '#f5f1e8')
  assert.equal(sanitized.surfaces.checkout.preset, 'soft')
  assert.equal(sanitized.surfaces.checkout.sheetSize, 'standard')
})

test('checkout panel boyutunu kapalı sözlükten doğrular', () => {
  const compact = sanitizeThemeTokens({
    surfaces: {
      ...DEFAULT_THEME.surfaces,
      checkout: { ...DEFAULT_THEME.surfaces!.checkout, sheetSize: 'compact' },
    },
  }, 'default')
  const rejected = sanitizeThemeTokens({
    surfaces: {
      ...DEFAULT_THEME.surfaces,
      checkout: { ...DEFAULT_THEME.surfaces!.checkout, sheetSize: 'calc(100vh)' },
    },
  }, 'default')

  assert.equal(compact?.surfaces?.checkout.sheetSize, 'compact')
  assert.equal(rejected?.surfaces?.checkout.sheetSize, 'standard')
})

test('checkout durumlarını güvenli içerik, kapalı ikon ve sınırlı yerleşim kontratıyla temizler', () => {
  const sanitized = sanitizeThemeTokens({
    surfaces: {
      ...DEFAULT_THEME.surfaces,
      checkout: {
        ...DEFAULT_THEME.surfaces!.checkout,
        states: {
          payment: {
            title: 'Ödemeni tamamla',
            description: '<script>unsafe</script>',
            amountLabel: 'Toplam',
            cardActionLabel: 'Devam et',
            layout: { paddingX: -10, sectionGap: 100, density: 'giant', contentWidth: 'wide' },
          },
          success: {
            icon: 'uploaded-svg', iconColor: 'red', iconBackground: '#102030',
            layout: { paddingX: 99, paddingY: 1, contentGap: 100, align: 'right', contentWidth: 'full', iconSize: 200 },
          },
          tablePayment: { icon: 'clock', primaryActionLabel: 'Takip et' },
          error: { icon: 'refresh', primaryActionLabel: 'Yeniden dene', secondaryActionLabel: 'Kapat' },
        },
      },
    },
  }, 'default')

  const states = sanitized?.surfaces?.checkout.states
  assert.equal(states?.payment?.title, 'Ödemeni tamamla')
  assert.equal(states?.payment?.description, undefined)
  assert.equal(states?.payment?.layout?.paddingX, 12)
  assert.equal(states?.payment?.layout?.sectionGap, 28)
  assert.equal(states?.payment?.layout?.density, undefined)
  assert.equal(states?.payment?.layout?.contentWidth, 'wide')
  assert.equal(states?.success?.icon, undefined)
  assert.equal(states?.success?.iconColor, undefined)
  assert.equal(states?.success?.iconBackground, '#102030')
  assert.deepEqual(states?.success?.layout, { paddingX: 40, paddingY: 12, contentGap: 32, contentWidth: 'full', iconSize: 96 })
  assert.equal(states?.tablePayment?.icon, 'clock')
  assert.equal(states?.error?.icon, 'refresh')
})

test('V2 ana sayfa aynı Menü bileşenlerini korur, üç bağlam bileşenini reddeder ve blokları tekilleştirir', () => {
  const sanitized = sanitizeThemeTokens({
    surfaces: {
      home: {
        enabled: true,
        compositionVersion: 2,
        blocks: [
          { id: 'hero-one', sectionId: 'hero-banner', enabled: true },
          { id: 'hero-one', sectionId: 'hero-banner', enabled: true },
          { id: 'gallery-one', sectionId: 'gallery', enabled: true },
          { id: 'unsafe', sectionId: 'request-buttons', enabled: true },
          { id: 'unsafe-hours', sectionId: 'hours', enabled: true },
          { id: 'unsafe-wifi', sectionId: 'wifi-info', enabled: true },
        ],
        sections: DEFAULT_THEME.surfaces!.home.sections,
      },
      auth: DEFAULT_THEME.surfaces!.auth,
      checkout: DEFAULT_THEME.surfaces!.checkout,
    },
    sectionSettings: {
      'hero-one': {
        title: 'Günün kampanyası',
        imageUrl: 'https://assets.example/hero.webp',
      },
    },
  }, 'default')

  assert.equal(sanitized?.surfaces?.home.compositionVersion, 2)
  assert.deepEqual(sanitized?.surfaces?.home.blocks?.map((block) => block.sectionId), ['hero-banner', 'gallery'])
  assert.deepEqual(sanitized?.sectionSettings?.['hero-one'], { title: 'Günün kampanyası', imageUrl: 'https://assets.example/hero.webp' })
})

test('V2 vitrin sayısal ayarlarını güvenli aralıklara sıkıştırır', () => {
  const sanitized = sanitizeThemeTokens({
    surfaces: {
      home: {
        enabled: true,
        compositionVersion: 2,
        blocks: [{ id: 'hero-one', sectionId: 'storefront-video-hero', enabled: true }],
        sections: DEFAULT_THEME.surfaces!.home.sections,
      },
      auth: DEFAULT_THEME.surfaces!.auth,
      checkout: DEFAULT_THEME.surfaces!.checkout,
    },
    sectionSettings: {
      'hero-one': {
        height: '9999', contentWidth: '20', overlay: '-5', mediaType: 'video',
        contentPositionX: '140', contentPositionY: '-20', align: 'right',
        showEyebrow: 'false', showTitle: 'false', showBody: 'false', showCta: 'false',
        videoUrl: 'https://assets.example/hero.webm', posterUrl: 'https://assets.example/poster.webp',
      },
    },
  }, 'default')

  assert.deepEqual(sanitized?.sectionSettings?.['hero-one'], {
    height: '820', contentWidth: '320', overlay: '0', contentPositionX: '100', contentPositionY: '0', align: 'right',
    showEyebrow: 'false', showTitle: 'false', showBody: 'false', showCta: 'false',
    videoUrl: 'https://assets.example/hero.webm', posterUrl: 'https://assets.example/poster.webp',
  })
})

test('legacy auth hero görselini sabit Giriş Header arka planına taşır', () => {
  const sanitized = sanitizeThemeTokens({
    surfaces: {
      home: DEFAULT_THEME.surfaces!.home,
      auth: { preset: 'brand-panel', heroImageUrl: 'https://assets.example/legacy-auth.webp' },
      checkout: DEFAULT_THEME.surfaces!.checkout,
    },
  }, 'default')

  assert.equal(sanitized?.surfaces?.auth.header.backgroundImageUrl, 'https://assets.example/legacy-auth.webp')
  assert.equal(sanitized?.surfaces?.auth.header.logoMode, 'restaurant')
  assert.equal(sanitized?.surfaces?.auth.header.imageFit, 'cover')
  assert.equal(sanitized?.surfaces?.auth.header.imagePositionX, 50)
  assert.equal(sanitized?.surfaces?.auth.header.imagePositionY, 50)
})

test('auth durum içeriklerini kapalı sözlük ve güvenli yerleşim sınırlarıyla temizler', () => {
  const sanitized = sanitizeThemeTokens({
    surfaces: {
      home: DEFAULT_THEME.surfaces!.home,
      auth: {
        ...DEFAULT_THEME.surfaces!.auth,
        states: {
          otp: {
            title: 'Kodunu gir',
            description: 'E-postana gelen kodu kullan.',
            primaryActionLabel: 'Devam et',
            resendLabel: 'Yeniden gönder',
            icon: 'star',
            layout: { paddingX: -10, paddingY: 999, contentGap: 7, align: 'center', contentWidth: 'standard', iconSize: 96 },
          },
          success: {
            title: '<script>alert(1)</script>',
            description: 'Hesabın hazır.',
            primaryActionLabel: 'Menüye geç',
            icon: 'sparkles',
            iconColor: '#abcdef',
            iconBackground: '#102030',
            layout: { paddingX: 35, paddingY: 40, contentGap: 31, align: 'left', contentWidth: 'compact', iconSize: 120 },
          },
          error: {
            title: 'Giriş tamamlanamadı',
            description: 'https://evil.example',
            primaryActionLabel: 'background:red',
            icon: 'gift',
            iconColor: 'red',
            iconBackground: 'url(https://evil.example)',
            layout: { paddingX: 20, paddingY: 30, contentGap: 16, align: 'center', contentWidth: 'full', iconSize: 50 },
          },
          unknown: { title: 'Bilinmeyen' },
        },
      },
      checkout: DEFAULT_THEME.surfaces!.checkout,
    },
  }, 'default')

  const states = sanitized?.surfaces?.auth.states
  assert.equal(states?.otp?.title, 'Kodunu gir')
  assert.deepEqual(states?.otp?.layout, { paddingX: 12, paddingY: 56, contentGap: 8, align: 'center', contentWidth: 'standard' })
  assert.equal(states?.success?.title, undefined)
  assert.equal(states?.success?.description, 'Hesabın hazır.')
  assert.equal(states?.success?.icon, 'sparkles')
  assert.equal(states?.success?.iconColor, '#abcdef')
  assert.equal(states?.success?.iconBackground, '#102030')
  assert.equal(states?.success?.layout?.iconSize, 96)
  assert.equal(states?.error?.description, undefined)
  assert.equal(states?.error?.primaryActionLabel, undefined)
  assert.equal(states?.error?.icon, undefined)
  assert.equal(states?.error?.iconColor, undefined)
  assert.equal(states?.error?.iconBackground, undefined)
  assert.equal(states?.error?.layout?.iconSize, 56)
  assert.equal(Object.hasOwn(states ?? {}, 'unknown'), false)
})
