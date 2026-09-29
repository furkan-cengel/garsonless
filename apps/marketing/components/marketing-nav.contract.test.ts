import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const navigation = readFileSync(new URL('./MarketingNav.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

test('marketing navigation scrolls to homepage sections without leaving a hash in the URL', () => {
  assert.match(navigation, /section\.scrollIntoView\(\{ behavior:.*prefers-reduced-motion.*'auto' : 'smooth', block: 'start' \}\)/)
  assert.match(navigation, /history\.replaceState/)
  assert.match(navigation, /`\$\{location\.pathname\}\$\{location\.search\}`/)
  assert.match(navigation, /event\.preventDefault\(\)/)
  assert.match(styles, /#özellikler,[\s\S]*?#demo,[\s\S]*?#menu-ozellestirme,[\s\S]*?#fiyatlandırma,[\s\S]*?#sss \{[\s\S]*?scroll-margin-top: 72px;/)
})

test('section links preserve fallback hrefs and work when navigation starts on another page', () => {
  for (const href of ['/qr-menu', '/qr-siparis', '/dijital-adisyon', '/mutfak-ekrani', '/fiyatlar', '/blog', '/menu-alerjen-zorunlulugu', '/hakkimizda', '/iletisim', '/#demo', '/#sss']) {
    assert.ok(navigation.includes(href), `Missing navigation destination ${href}`)
  }
  assert.match(navigation, /sessionStorage\.setItem\(PENDING_SECTION_KEY, sectionId\)/)
  assert.match(navigation, /router\.push\('\/', \{ scroll: false \}\)/)
})

test('modified clicks keep native link behavior for new tabs and alternate navigation', () => {
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    assert.match(navigation, new RegExp(`event\\.${modifier}`))
  }
  assert.match(navigation, /event\.button !== 0/)
})
