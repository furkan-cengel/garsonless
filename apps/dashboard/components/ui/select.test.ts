import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('.', import.meta.url))
const source = readFileSync(`${directory}/select.tsx`, 'utf8')

test('long select options wrap before the selected-item indicator lane', () => {
  assert.match(source, /data-slot="select-item-text"/)
  assert.match(source, /className="flex min-w-0 flex-1 gap-2 whitespace-normal break-words leading-snug"/)
  assert.doesNotMatch(source, /ItemText className="[^"]*shrink-0/)
  assert.match(source, /absolute top-1\/2 right-2 flex size-4 -translate-y-1\/2/)
})
