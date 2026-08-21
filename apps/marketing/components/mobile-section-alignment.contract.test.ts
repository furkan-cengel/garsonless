import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 700px) {'))
const pricingMobileStyles = styles.slice(styles.indexOf('@media (max-width: 640px) {'))

test('mobile section introductions use centered alignment', () => {
  assert.match(mobileStyles, /\.marketing-hero__copy \{[\s\S]*?text-align: center;/)
  assert.match(mobileStyles, /\.problem-solution__intro \{[\s\S]*?text-align: center;/)
  assert.match(mobileStyles, /\.process-flow__heading \{[\s\S]*?text-align: center;/)
  assert.match(mobileStyles, /\.process-step__copy \{[\s\S]*?text-align: center;/)
  assert.match(mobileStyles, /\.menu-customization__heading \{[\s\S]*?text-align: center;/)
  assert.match(mobileStyles, /\.trial-band__content \{[\s\S]*?align-items: center;[\s\S]*?text-align: center;/)
  assert.match(mobileStyles, /\.story-heading--split \{[\s\S]*?text-align: center;/)
  assert.match(pricingMobileStyles, /\.pricing-heading \{[\s\S]*?text-align: center;/)
  assert.match(pricingMobileStyles, /\.pricing-toolbar > p \{[\s\S]*?text-align: center;/)
})

test('mobile display headings use balanced wrapping and restrained sizes', () => {
  assert.match(mobileStyles, /\.marketing-hero__title \{[\s\S]*?font-size: clamp\(40px, 10\.5vw, 46px\);[\s\S]*?text-wrap: balance;/)
  assert.match(mobileStyles, /\.problem-solution__intro h2 \{[\s\S]*?font-size: clamp\(34px, 9vw, 38px\);[\s\S]*?text-wrap: balance;/)
  assert.match(mobileStyles, /\.process-step__copy h3 \{[\s\S]*?font-size: 35px;[\s\S]*?text-wrap: balance;/)
  assert.match(mobileStyles, /\.trial-band h2 \{[\s\S]*?font-size: clamp\(34px, 9vw, 38px\);[\s\S]*?text-wrap: balance;/)
})
