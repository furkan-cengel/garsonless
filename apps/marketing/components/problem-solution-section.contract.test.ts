import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
const problemSolutionStylesStart = globalsCss.indexOf('.problem-solution {')
const mobileBreakpointStart = globalsCss.indexOf(
  '@media (max-width: 700px)',
  problemSolutionStylesStart,
)
const mobileProblemSolutionCss = globalsCss.slice(
  mobileBreakpointStart,
  globalsCss.indexOf('  .process-flow {', mobileBreakpointStart),
)

test('ProblemSolutionSection keeps both flow panels compact on mobile', () => {
  assert.match(globalsCss, /min-height: 390px;/)
  assert.match(globalsCss, /min-height: 420px;/)
})

test('ProblemSolutionSection renders the mobile problem network as a two-dimensional path', () => {
  assert.match(globalsCss, /left: 10% !important; top: 60%; width: 30% !important;/)
  assert.doesNotMatch(globalsCss, /left: 50% !important;\s+width: 1px !important;/)
})

test('ProblemSolutionSection keeps mobile solution steps in horizontal lanes', () => {
  assert.match(
    globalsCss,
    /grid-template-columns: repeat\(var\(--route-step-count\), minmax\(0, 1fr\)\);/,
  )
  assert.doesNotMatch(globalsCss, /grid-template-columns: 58px minmax\(0, 1fr\);/)
})

test('ProblemSolutionSection keeps the primary order flow in the middle on mobile', () => {
  assert.match(
    mobileProblemSolutionCss,
    /grid-template-rows: minmax\(76px, \.86fr\) minmax\(132px, 1\.34fr\) minmax\(76px, \.86fr\);/,
  )
  assert.doesNotMatch(
    mobileProblemSolutionCss,
    /\.solution-route--(?:primary|top|bottom) \{\s*order:/,
  )
})

test('ProblemSolutionSection gives the primary mobile flow room without stacking it', () => {
  const narrowMobileStart = globalsCss.indexOf('@media (max-width: 480px)')
  const narrowMobileCss = globalsCss.slice(
    narrowMobileStart,
    globalsCss.indexOf('@media (prefers-reduced-motion: reduce)', narrowMobileStart),
  )

  assert.match(narrowMobileCss, /column-gap: 4px;/)
  assert.match(narrowMobileCss, /max-width: 44px;/)
  assert.match(narrowMobileCss, /min-height: 452px;/)
  assert.doesNotMatch(narrowMobileCss, /grid-template-columns: repeat\(3,/)
})
