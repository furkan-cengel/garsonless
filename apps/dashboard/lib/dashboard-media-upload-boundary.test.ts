import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const route = readFileSync(
  new URL('../app/api/uploads/[kind]/route.ts', import.meta.url),
  'utf8',
)
const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8')

test('media uploads use a bounded same-origin route instead of a raised global Server Action limit', () => {
  assert.match(route, /multipart\/form-data/)
  assert.match(route, /content-length/)
  assert.match(route, /origin !== new URL\(request\.url\)\.origin/)
  assert.match(route, /2 \* 1024 \* 1024/)
  assert.match(route, /5 \* 1024 \* 1024/)
  assert.match(route, /8 \* 1024 \* 1024/)
  assert.doesNotMatch(config, /bodySizeLimit/)
})
