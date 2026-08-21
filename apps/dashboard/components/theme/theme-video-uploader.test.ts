import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const panel = readFileSync(new URL('./ThemeExperiencePanels.tsx', import.meta.url), 'utf8')

test('video uploader distinguishes rejected, partial and preview-ready media states', () => {
  assert.match(panel, /Video eklenmedi:/)
  assert.match(panel, /Video hazır · değiştir/)
  assert.match(panel, /Poster hazır · değiştir/)
  assert.match(panel, /Video hazır\. Önizleme için zorunlu posteri yükleyin\./)
  assert.match(panel, /Poster hazır\. Önizleme için videoyu yükleyin\./)
  assert.match(panel, /variant=\{effectiveFeedback\.tone === 'error' \? 'destructive' : 'default'\}/)
  assert.match(panel, /<AlertDescription>\{effectiveFeedback\.text\}<\/AlertDescription>/)
})
