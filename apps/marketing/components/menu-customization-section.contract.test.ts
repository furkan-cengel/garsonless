import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const component = readFileSync(new URL('./MenuCustomizationSection.tsx', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const mobileStyles = styles.slice(styles.indexOf('@media (max-width: 700px) {'))

test('mobile customization keeps the desktop moving-field composition', () => {
  assert.match(component, /customization-marquee customization-marquee--up/)
  assert.match(component, /customization-marquee customization-marquee--down/)
  assert.match(mobileStyles, /\.menu-customization__stage \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?height: 600px;[\s\S]*?overflow: hidden;/)
  assert.match(mobileStyles, /\.menu-customization__center \{[\s\S]*?position: absolute;[\s\S]*?transform: translate\(-50%, -50%\);/)
  assert.match(mobileStyles, /\.customization-marquee__track \{[\s\S]*?animation: customization-up 28s linear infinite;/)
  assert.match(mobileStyles, /\.customization-marquee--down \.customization-marquee__track \{[\s\S]*?animation-name: customization-down;/)
  assert.match(mobileStyles, /\.customization-marquee__group\[aria-hidden="true"\] \{[\s\S]*?display: grid;/)
  assert.doesNotMatch(mobileStyles, /\.menu-customization__center \{[\s\S]{0,220}?order: -1;/)
})

test('customization tracks keep moving while hovered', () => {
  assert.doesNotMatch(styles, /\.customization-marquee:hover \.customization-marquee__track/)
})
