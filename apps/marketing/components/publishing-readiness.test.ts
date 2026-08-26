import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { BLOG_POSTS } from '../lib/blog'
import { LEGAL_IDENTITY } from '../lib/legal-identity'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8')

test('public identity uses the verified sole proprietor and never exposes a T.C. identity number', () => {
  assert.equal(LEGAL_IDENTITY.proprietor, 'Mustafa Furkan Çengel')
  assert.equal(LEGAL_IDENTITY.taxOffice, 'Kartal Vergi Dairesi')
  assert.equal(LEGAL_IDENTITY.taxNumber, '2420625143')
  const publicSources = [
    'app/hakkimizda/page.tsx', 'app/iletisim/page.tsx', 'components/MarketingFooter.tsx',
  ].map(read).join('\n')
  assert.doesNotMatch(publicSources, /Masabu Teknoloji A\.Ş|MERSİS\s*[:#]|VERBİS\s*[:#]/i)
  assert.doesNotMatch(publicSources, /\b[1-9][0-9]{10}\b/)
})

test('blog manifest is unique and every original MDX source exists with SEO routes', () => {
  assert.equal(BLOG_POSTS.length, 3)
  assert.equal(new Set(BLOG_POSTS.map((post) => post.slug)).size, BLOG_POSTS.length)
  for (const post of BLOG_POSTS) {
    assert.match(post.publishedAt, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(post.description.length > 40)
    assert.ok(existsSync(path.join(process.cwd(), 'content/blog', post.sourceFile)))
  }
  assert.match(read('app/blog/[slug]/page.tsx'), /application\/ld\+json/)
  assert.match(read('app/blog/[slug]/page.tsx'), /canonical/)
  assert.ok(existsSync(path.join(process.cwd(), 'app/blog/rss.xml/route.ts')))
  assert.ok(existsSync(path.join(process.cwd(), 'app/sitemap.ts')))
})

test('Supademo loads automatically only as its step enters the viewport', () => {
  const source = read('components/ProcessFlowSection.tsx')
  assert.match(source, /\{visible && !frameFailed && \([\s\S]*?<iframe/)
  assert.match(source, /loading="lazy"/)
  assert.doesNotMatch(source, /masabu:supademo-consent|Etkileşimli demoyu başlat|startDemo/)
})

test('homepage hero leads with speed and operational control without implying staff replacement', () => {
  const hero = read('components/HeroSection.tsx')
  assert.match(hero, /Siparişinizi hızlandırın\./)
  assert.match(hero, /Servisinizi kusursuzlaştırın\./)
  assert.match(hero, /siparişini saniyeler içinde verir/)
  assert.match(hero, /tek panelden kolayca yönetin/)
  assert.doesNotMatch(hero, /garsonsuz/i)
})

test('legacy mock routes are permanent redirects and footer exposes all release pages', () => {
  assert.match(read('app/company/page.tsx'), /permanentRedirect\('\/hakkimizda'\)/)
  assert.match(read('app/resources/page.tsx'), /permanentRedirect\('\/blog'\)/)
  assert.match(read('app/legal/page.tsx'), /permanentRedirect\('\/yasal'\)/)
  const footer = read('components/MarketingFooter.tsx')
  for (const href of ['/hakkimizda', '/blog', '/iletisim', '/yasal/kvkk-aydinlatma-metni', '/yasal/gizlilik-politikasi', '/yasal/cerez-politikasi', '/yasal/abonelik-hizmet-sozlesmesi', '/yasal/iptal-iade-ve-dijital-teslimat']) {
    assert.match(footer, new RegExp(href.replaceAll('/', '\\/')))
  }
  assert.ok(footer.indexOf("title: 'Ürün'") < footer.indexOf("title: 'Yasal'"))
  assert.ok(footer.indexOf("title: 'Yasal'") < footer.indexOf("title: 'Masabu'"))
  for (const platform of ['Instagram', 'Facebook', 'LinkedIn', 'X']) {
    assert.match(footer, new RegExp(`label: '${platform}'`))
  }
  assert.match(footer, /aria-disabled="true"/)
  assert.match(footer, /bağlantısı yakında/)
  assert.match(footer, /https:\/\/www\.linkedin\.com\/company\/masabu\//)
  assert.match(footer, /aria-label=\{`\$\{label\} sayfasını aç`\}/)
  assert.match(footer, /\/payments\/iyzico-payment-methods\.svg/)
  assert.match(footer, /iyzico ile Öde, Mastercard, Visa, American Express ve Troy/)
  assert.ok(existsSync(path.join(process.cwd(), 'public/payments/iyzico-payment-methods.svg')))
  assert.match(read('app/globals.css'), /\.marketing-footer__nav \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
})

test('legal documents are Masabu-specific, B2B and versioned while review is pending', () => {
  assert.equal(LEGAL_DOCUMENT_VERSION, '2026-08-16')
  const notice = read('app/yasal/kvkk-aydinlatma-metni/page.tsx')
  const terms = read('app/yasal/abonelik-hizmet-sozlesmesi/page.tsx')
  const checkout = read('app/yasal/mesafeli-hizmet-sozlesmesi/page.tsx')
  const cookies = read('app/yasal/cerez-politikasi/page.tsx')
  const index = read('app/yasal/page.tsx')
  const sitemap = read('app/sitemap.ts')
  const metadata = read('lib/legal-metadata.ts')
  const readiness = read('scripts/legal-readiness.mjs')

  assert.match(notice, /Masabu; işletme hesabı, güvenlik, abonelik, faturalama, destek/)
  assert.match(notice, /LegalProviderList/)
  assert.match(terms, /tüketici kullanımına yönelik değildir/)
  assert.match(terms, /KDV hariç liste fiyatıdır/)
  assert.match(checkout, /tüketiciye yönelik mesafeli satış ön bilgilendirme formu değildir/)
  assert.match(checkout, /KDV hariç liste fiyatı, KDV oranı ve tutarı/)
  assert.match(cookies, /açık rıza verdiğiniz anlamına gelmez/)
  assert.match(cookies, /zorunlu olmayan analitik, yeniden hedefleme veya reklam çerezi kullanmaz/)
  assert.match(index, /\/yasal\/veri-isleme-eki/)
  assert.match(sitemap, /\/yasal\/veri-isleme-eki/)
  assert.match(sitemap, /const staticPaths = \[\.\.\.PUBLIC_PATHS, \.\.\.LEGAL_PATHS\]/)
  assert.doesNotMatch(sitemap, /LEGAL_DOCS_APPROVED/)
  assert.match(metadata, /robots: \{ index: true, follow: true \}/)
  assert.doesNotMatch(metadata, /index: false|LEGAL_DOCS_APPROVED/)
  assert.doesNotMatch(readiness, /LEGAL_DOCS_APPROVED|noindex/)
  assert.ok(existsSync(path.join(process.cwd(), 'app/yasal/veri-isleme-eki/page.tsx')))
})
