import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { ALLERGEN_CODES } from '@garsonless/domain/menu'
import sitemap from '../app/sitemap'
import {
  ALLERGENS,
  COMPLIANCE_ROWS,
  COMPLIANCE_SOURCE,
  MAIN_DEADLINE_ISO,
  REGULATION_FAQS,
  REGULATION_SOURCE,
  daysUntilDeadline,
  hasDeadlinePassed,
} from '../lib/menu-regulation'

const CANONICAL = '/menu-alerjen-zorunlulugu'

test('regulation landing page is routable, crawlable and linked', () => {
  assert.ok(existsSync(path.join(process.cwd(), 'app', 'menu-alerjen-zorunlulugu', 'page.tsx')))
  assert.ok(sitemap().some((entry) => entry.url === `https://masabu.co${CANONICAL}`))
  const footer = readFileSync(new URL('./MarketingFooter.tsx', import.meta.url), 'utf8')
  assert.match(footer, new RegExp(CANONICAL))
})

test('published allergen list never drifts from the product vocabulary', () => {
  assert.equal(ALLERGENS.length, 14)
  assert.deepEqual(
    ALLERGENS.map((allergen) => allergen.code),
    [...ALLERGEN_CODES],
  )
  for (const allergen of ALLERGENS) assert.ok(allergen.label.trim().length > 0)
})

test('compliance calendar keeps the declared deadline and cites an official source', () => {
  assert.ok(COMPLIANCE_ROWS.length >= 3)
  assert.ok(COMPLIANCE_ROWS.some((row) => row.deadlineIso === MAIN_DEADLINE_ISO))
  for (const row of COMPLIANCE_ROWS) {
    assert.match(row.deadlineIso, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(row.who.trim().length > 0 && row.scope.trim().length > 0)
  }
  assert.ok(REGULATION_SOURCE.url.startsWith('https://'))
  assert.ok(COMPLIANCE_SOURCE.url.startsWith('https://itb.org.tr/'))
})

test('deadline badges follow the Turkish calendar and remain correct after launch', () => {
  assert.equal(daysUntilDeadline(new Date('2026-12-30T20:59:59Z')), 1)
  assert.equal(daysUntilDeadline(new Date('2026-12-30T21:00:00Z')), 0)
  assert.equal(hasDeadlinePassed(new Date('2026-12-31T20:59:59Z'), MAIN_DEADLINE_ISO), false)
  assert.equal(hasDeadlinePassed(new Date('2026-12-31T21:00:00Z'), MAIN_DEADLINE_ISO), true)
  const route = readFileSync(new URL('../app/menu-alerjen-zorunlulugu/page.tsx', import.meta.url), 'utf8')
  assert.match(route, /export const revalidate = 3600/)
})

test('regulation artwork shares the product SVG language without external assets or executable content', () => {
  const page = readFileSync(new URL('./MenuRegulationPage.tsx', import.meta.url), 'utf8')
  for (const name of ['menu-regulation', 'menu-regulation-details', 'menu-regulation-workflow']) {
    const svg = readFileSync(new URL(`../public/illustrations/${name}.svg`, import.meta.url), 'utf8')
    assert.match(page, new RegExp(`src="/illustrations/${name}\\.svg"`))
    assert.match(svg, /viewBox="0 0 640 480"/)
    assert.match(svg, /<title>[^<]+<\/title>/)
    assert.match(svg, /stroke="#30483d" stroke-width="1.5"/)
    assert.match(svg, /fill="#deeee4"/)
    assert.doesNotMatch(svg, /<(?:script|foreignObject|image)\b|\bon\w+=|(?:href|src)=/i)
  }
  assert.equal((page.match(/width=\{640\}/g) ?? []).length, 3)
  assert.equal((page.match(/height=\{480\}/g) ?? []).length, 3)
  assert.match(page, /priority/)
})

test('regulation page keeps legal context and accessible mobile navigation with the illustrated layout', () => {
  const page = readFileSync(new URL('./MenuRegulationPage.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('./MenuRegulationPage.module.css', import.meta.url), 'utf8')
  assert.match(page, /1 Ocak 2020/)
  assert.match(page, /cihazı olmayan/)
  assert.doesNotMatch(page, /alerjen bilgisi zorunlu oluyor|güncelleme maliyeti olmayan tek seçenek/)
  assert.match(page, /href="#uyum-takvimi"/)
  assert.match(page, /id="uyum-takvimi"/)
  assert.match(page, /href="\/qr-menu"/)
  assert.match(page, /href="\/qr-siparis"/)
  assert.match(page, /<caption className="sr-only">/)
  assert.match(page, /role="region"[^>]+tabIndex=\{0\}/)
  assert.match(css, /@media \(max-width: 800px\)/)
  assert.match(css, /\.heroGrid, \.detailsGrid, \.workflow \{ grid-template-columns: 1fr; \}/)
})

test('countdown counts down and never goes negative after the deadline', () => {
  assert.equal(daysUntilDeadline(new Date('2026-12-30T00:00:00Z')), 1)
  assert.equal(daysUntilDeadline(new Date('2026-12-31T00:00:00Z')), 0)
  assert.equal(daysUntilDeadline(new Date('2027-03-01T00:00:00Z')), 0)
  assert.equal(daysUntilDeadline(new Date('2026-09-12T00:00:00Z')), 110)
})

test('faq entries are unique and answer the question they ask', () => {
  const questions = REGULATION_FAQS.map((faq) => faq.question)
  assert.equal(new Set(questions).size, questions.length)
  for (const faq of REGULATION_FAQS) {
    assert.ok(faq.question.trim().endsWith('?'))
    assert.ok(faq.answer.trim().length > 40)
  }
})
