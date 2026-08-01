import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./ProductCard.tsx', import.meta.url), 'utf8')

test('image-less cards reserve the configured media placeholder', () => {
  assert.match(source, /const hasProductImage = imageUrl !== null/)
  assert.match(source, /const mediaVisible = showImage/)
  assert.match(source, /\{mediaVisible && <div/)
  assert.match(source, /<ImagePlaceholderIcon \/>/)
  assert.match(source, /theme\.cardPlaceholderStyle === 'accent'/)
})

test('configurable products retain their options label when card media is disabled', () => {
  assert.match(source, /!mediaVisible && theme\.cardShowTag && hasModifiers/)
  assert.match(source, /data-image-state=\{hasProductImage \? 'available' : 'missing'\}/)
})
