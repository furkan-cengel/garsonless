import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8')
const tokens = (block: string) => Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [match[1], match[2]]))
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}

test('small supporting text meets WCAG AA on all neutral surfaces in both supported dashboard themes', () => {
  const base = tokens(css.match(/:root\s*\{([^}]+)\}/)![1]!)
  const warm = { ...base, ...tokens(css.match(/html\[data-theme="warm"\]\s*\{([^}]+)\}/)![1]!) }
  for (const [theme, palette] of [['light', base], ['warm', warm]] as const) {
    for (const surface of ['--bg', '--surface', '--surface-2', '--surface-3', '--surface-inset']) {
      const a = luminance(palette['--text-3']!)
      const b = luminance(palette[surface]!)
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      assert.ok(ratio >= 4.5, `${theme} ${surface}: ${ratio.toFixed(2)}:1`)
    }
  }
})
