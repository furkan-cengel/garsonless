import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVerificationUrl,
  renderAuthEmailHtml,
} from '../supabase/functions/send-email-hook/email-template'

const input = {
  actionType: 'magiclink',
  token: '12345678',
  tokenHash: 'hashed-token',
  redirectTo: 'https://app.masabu.co/auth/callback?next=%2Fdashboard',
  supabaseUrl: 'https://svxvloeosiksqfadgkvo.supabase.co',
}

test('send-email hook builds a production verification link for magic-link login', () => {
  const result = buildVerificationUrl(input)
  assert.ok(result)

  const url = new URL(result)
  assert.equal(url.origin, input.supabaseUrl)
  assert.equal(url.pathname, '/auth/v1/verify')
  assert.equal(url.searchParams.get('token'), input.tokenHash)
  assert.equal(url.searchParams.get('type'), 'magiclink')
  assert.equal(url.searchParams.get('redirect_to'), input.redirectTo)
})

test('send-email hook renders both a clickable action and fallback OTP', () => {
  const html = renderAuthEmailHtml(input)
  assert.match(html, />Güvenli giriş yap<\/a>/)
  assert.match(html, />12345678<\/span>/)
  assert.match(html, /redirect_to=https%3A%2F%2Fapp\.masabu\.co/)
  assert.doesNotMatch(html, /&redirect_to=/)
})

test('send-email hook keeps code-only actions free of misleading links', () => {
  const html = renderAuthEmailHtml({ ...input, actionType: 'otp' })
  assert.doesNotMatch(html, /<a href=/)
  assert.match(html, /tek kullanımlık kodu/)
})

test('send-email hook refuses non-HTTPS verification origins', () => {
  assert.equal(buildVerificationUrl({ ...input, supabaseUrl: 'http://localhost:54321' }), null)
})
