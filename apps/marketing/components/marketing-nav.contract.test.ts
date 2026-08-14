import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const navigation = readFileSync(new URL('./MarketingNav.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

test('marketing navigation scrolls to homepage sections without leaving a hash in the URL', () => {
  assert.match(navigation, /section\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/)
  assert.match(navigation, /window\.history\.replaceState/)
  assert.match(navigation, /`\$\{window\.location\.pathname\}\$\{window\.location\.search\}`/)
  assert.match(navigation, /event\.preventDefault\(\)/)
  assert.match(styles, /#özellikler,[\s\S]*?#demo,[\s\S]*?#menu-ozellestirme,[\s\S]*?#fiyatlandırma,[\s\S]*?#sss \{[\s\S]*?scroll-margin-top: 72px;/)
})

test('section links preserve fallback hrefs and work when navigation starts on another page', () => {
  for (const sectionId of ['özellikler', 'demo', 'menu-ozellestirme', 'fiyatlandırma', 'sss']) {
    assert.match(navigation, new RegExp(`href: '/#${sectionId}'`))
    assert.match(navigation, new RegExp(`sectionId: '${sectionId}'`))
  }
  assert.match(navigation, /window\.sessionStorage\.setItem\(PENDING_SECTION_KEY, sectionId\)/)
  assert.match(navigation, /router\.push\('\/', \{ scroll: false \}\)/)
})

test('modified clicks keep native link behavior for new tabs and alternate navigation', () => {
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    assert.match(navigation, new RegExp(`event\\.${modifier}`))
  }
  assert.match(navigation, /event\.button !== 0/)
})
