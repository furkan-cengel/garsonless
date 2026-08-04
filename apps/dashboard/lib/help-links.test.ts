import assert from 'node:assert/strict'
import test from 'node:test'
import { dashboardHelpLinks, safeSupportUrl } from './help-links'

test('help links are restaurant-scoped routes with no inert placeholder destinations', () => {
  const links = dashboardHelpLinks('restaurant-a')
  assert.equal(links.length, 6)
  assert.ok(links.every((link) => link.href.startsWith('/dashboard/restaurant-a/')))
  assert.ok(links.every((link) => link.href !== '#' && Boolean(link.section)))
})

test('support URL policy permits only credential-free HTTPS URLs', () => {
  assert.equal(safeSupportUrl('https://support.example.com/help'), 'https://support.example.com/help')
  assert.equal(safeSupportUrl('http://support.example.com/help'), null)
  assert.equal(safeSupportUrl('https://user:secret@support.example.com/help'), null)
  assert.equal(safeSupportUrl('javascript:alert(1)'), null)
  assert.equal(safeSupportUrl(undefined), null)
})
