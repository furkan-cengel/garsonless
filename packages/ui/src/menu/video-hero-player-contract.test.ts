import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../themes/default/sections/StorefrontSections.tsx', import.meta.url), 'utf8')

test('modern Video Hero defers video for motion/data preferences and tracks viewport visibility', () => {
  assert.match(source, /prefers-reduced-motion: reduce/)
  assert.match(source, /connection\?\.saveData/)
  assert.match(source, /new IntersectionObserver/)
  assert.match(source, /document\.visibilityState/)
  assert.match(source, /userPausedRef/)
})

test('modern Video Hero keeps poster fallback, retry and accessible playback control', () => {
  assert.match(source, /Videoyu yeniden dene/)
  assert.match(source, /Video oynatılamadı; poster gösteriliyor/)
  assert.match(source, /event\.currentTarget\.style\.display = 'none'/)
  assert.match(source, /opacity: playing \? 1 : 0/)
  assert.match(source, /aria-label=\{label\}/)
  assert.match(source, /width:48px;height:48px/)
  assert.match(source, /focus-visible/)
})

test('modern Video Hero content participates in layout and supports responsive wrapping', () => {
  assert.match(source, /min-height:max\(var\(--video-hero-min-height\),calc\(100svh - var\(--p-header-flow-height,var\(--p-header-sticky-height,64px\)\)\)\)/)
  assert.match(source, /overflow-wrap:anywhere/)
  assert.match(source, /container-type:inline-size/)
  assert.match(source, /data-placement=\{hero\.placement\}/)
  assert.match(source, /font-family:var\(--p-body,inherit\)/)
  assert.match(source, /garsonless-video-hero__body\{[^}]*color:var\(--video-hero-text\);opacity:\.82/)
  assert.doesNotMatch(source, /garsonless-video-hero__body\{[^}]*currentColor/)
  assert.doesNotMatch(source, /garsonless-video-hero__cta/)
})

test('modern Video Hero exposes an accessible reduced-motion-safe discovery cue', () => {
  assert.match(source, /hero\.showExplore \? <button/)
  assert.match(source, /<span>\{hero\.exploreLabel\}<\/span>/)
  assert.match(source, /aria-label=\{`\$\{hero\.exploreLabel\}: sonraki bölüme git`\}/)
  assert.match(source, /data-animate=\{hero\.animateExplore \? 'true' : 'false'\}/)
  assert.match(source, /explore\[data-animate="true"\] svg\{animation:/)
  assert.match(source, /scrollIntoView\(\{ behavior: reducedMotion \? 'auto' : 'smooth'/)
  assert.match(source, /garsonless-video-hero__explore/)
  assert.match(source, /@keyframes garsonless-video-hero-explore/)
  assert.match(source, /prefers-reduced-motion:reduce[\s\S]*?explore svg\{animation:none!important\}/)
})
