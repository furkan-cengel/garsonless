import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const base = new URL('./', import.meta.url)
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(new URL('index.html', base).href)
    await page.evaluate(() => document.fonts.ready)
    const state = await page.evaluate(() => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      images: [...document.querySelectorAll('figure img')].map(image => ({
        file: image.getAttribute('src'),
        width: image.naturalWidth,
        height: image.naturalHeight,
        loaded: image.complete && image.naturalWidth > 0,
        alt: image.alt,
      })),
      downloads: document.querySelectorAll('a[download]').length,
    }))
    assert.equal(state.images.length, 5)
    assert.equal(state.downloads, 5)
    assert.ok(state.images.every(image => image.loaded && image.alt))
    assert.equal(errors.length, 0)
    assert.ok(state.documentWidth <= width, 'Document must not overflow horizontally')
    await page.screenshot({ path: fileURLToPath(new URL(`preview-${width}.png`, base)), fullPage: true })
    results.push({ width, errors, ...state })
    await page.close()
  }
  await writeFile(new URL('verification.json', base), JSON.stringify({ scope: 'Local gallery only; no social platform upload tested', results }, null, 2))
  console.log(JSON.stringify({ pass: true, results }, null, 2))
} finally {
  await browser.close()
}
