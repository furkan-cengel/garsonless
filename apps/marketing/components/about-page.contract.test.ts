import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('../app/hakkimizda/page.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const principles = readFileSync(new URL('./AboutPrinciples.tsx', import.meta.url), 'utf8')

test('about page uses the editorial product-led narrative without unverifiable proof', () => {
  assert.match(page, /Restoranın her anını[\s\S]*aynı akışta[\s\S]*buluşturuyoruz/)
  assert.match(page, /Menüden siparişe, mutfaktan tahsilata\./)
  for (const label of ['Dijital menü', 'Masa ve sipariş', 'Mutfak akışı', 'Tahsilat ve rapor']) {
    assert.match(page, new RegExp(label))
  }
  assert.doesNotMatch(page, /\['0[1-4]',\s*'(?:Dijital menü|Masa ve sipariş|Mutfak akışı|Tahsilat ve rapor)'/)
  assert.doesNotMatch(page, /müşteri sayısı|yatırım|kurucu hikâyesi|masabu Teknoloji A\.Ş|PageHero/i)
})

test('about story keeps a focused text narrative and the approved product principles', () => {
  assert.match(page, /İyi servis, bilginin doğru anda doğru yerde olmasıyla başlar\./)
  assert.doesNotMatch(page, /about-story__visual|about-product-flow\.webp|<Image/)
  assert.match(styles, /\.about-story__copy \{[\s\S]*?max-width: 900px/)
  for (const principle of ['Tek operasyon kaydı', 'İşletmenin kontrolü', 'Ölçülü teknoloji']) {
    assert.match(principles, new RegExp(principle))
  }
})

test('about page keeps verified identity, trial conversion and responsive behavior', () => {
  assert.match(page, /LEGAL_IDENTITY\.publicName/)
  assert.match(page, /LEGAL_IDENTITY\.taxOffice/)
  assert.match(page, /LEGAL_IDENTITY\.taxNumber/)
  assert.match(page, /LEGAL_IDENTITY\.address/)
  assert.match(page, /<TrialSection \/>/)
  assert.match(page, /about-hero__signal-progress/)
  assert.match(styles, /\.about-hero__signal-progress \{[\s\S]*?animation: about-signal-travel/)
  assert.match(styles, /\.about-hero__route \{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(max-width: 700px\) \{[\s\S]*?\.about-hero__route \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(styles, /@media \(max-width: 700px\) \{[\s\S]*?\.about-hero__inner \{[\s\S]*?min-height: auto/)
  assert.match(styles, /@media \(max-width: 700px\) \{[\s\S]*?\.about-hero__route \{[\s\S]*?margin: 48px 0 0/)
  assert.match(styles, /@media \(min-width: 701px\) and \(max-width: 1100px\) \{[\s\S]*?\.about-hero h1 \{[\s\S]*?max-width: 760px/)
  assert.match(styles, /@media \(min-width: 701px\) and \(max-width: 1100px\) \{[\s\S]*?\.about-hero__route \{[\s\S]*?margin: 72px 0 0/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.about-hero__eyebrow/)
})

test('about principles follow the scroll-linked Auxia-style narrative', () => {
  assert.match(page, /<AboutPrinciples \/>/)
  assert.match(principles, /requestAnimationFrame\(update\)/)
  assert.match(principles, /about-values__path-progress/)
  assert.match(principles, /data-active=/)
  assert.match(principles, /prefers-reduced-motion: reduce/)
  assert.match(styles, /\.about-values__list > li:nth-child\(1\)[\s\S]*?justify-content: flex-end/)
  assert.match(styles, /\.about-values__list > li:nth-child\(2\)[\s\S]*?justify-content: flex-start/)
  assert.match(styles, /\.about-values__path--mobile[\s\S]*?display: block/)
  assert.match(styles, /\.about-value__title \{[\s\S]*?background: var\(--bg\)/)
  assert.match(styles, /\.about-value__title > \* \{[\s\S]*?opacity: var\(--about-value-opacity\)/)
  const listItemStyles = styles.match(/\.about-values__list > li \{([^}]*)\}/)?.[1] ?? ''
  assert.doesNotMatch(listItemStyles, /(?:^|\s)opacity:/)
})
