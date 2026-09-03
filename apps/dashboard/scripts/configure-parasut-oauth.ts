import assert from 'node:assert/strict'
import { createParasutOAuthPort } from '@garsonless/db/server'

const clientId = process.env.PARASUT_CLIENT_ID?.trim()
const clientSecret = process.env.PARASUT_CLIENT_SECRET?.trim()
const authorizationCode = process.env.PARASUT_AUTHORIZATION_CODE?.trim()
const redirectUri = process.env.PARASUT_REDIRECT_URI?.trim()
const apiBaseUrl = process.env.PARASUT_API_BASE_URL?.trim() || 'https://api.parasut.com'

assert(clientId, 'PARASUT_CLIENT_ID is required')
assert(clientSecret, 'PARASUT_CLIENT_SECRET is required')
assert(authorizationCode, 'PARASUT_AUTHORIZATION_CODE is required')
assert(redirectUri, 'PARASUT_REDIRECT_URI is required')

const oauthClientId = clientId
const oauthClientSecret = clientSecret
const oauthAuthorizationCode = authorizationCode
const oauthRedirectUri = redirectUri

const apiUrl = new URL(apiBaseUrl)
assert.equal(apiUrl.protocol, 'https:', 'PARASUT_API_BASE_URL must use HTTPS')
assert(!apiUrl.username && !apiUrl.password, 'PARASUT_API_BASE_URL must not contain credentials')
if (oauthRedirectUri !== 'urn:ietf:wg:oauth:2.0:oob') {
  const callbackUrl = new URL(oauthRedirectUri)
  assert.equal(callbackUrl.protocol, 'https:', 'PARASUT_REDIRECT_URI must use HTTPS or the documented OOB URI')
  assert(!callbackUrl.username && !callbackUrl.password, 'PARASUT_REDIRECT_URI must not contain credentials')
}

async function main() {
  const response = await fetch(new URL('/oauth/token', apiUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
      code: oauthAuthorizationCode,
      redirect_uri: oauthRedirectUri,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  assert(response.ok, `Paraşüt OAuth exchange failed with HTTP ${response.status}`)
  const payload = await response.json() as Record<string, unknown>
  const refreshToken = typeof payload.refresh_token === 'string' ? payload.refresh_token : ''
  assert(refreshToken.length >= 20, 'Paraşüt OAuth response did not contain a valid refresh token')

  const configured = await createParasutOAuthPort().configure(refreshToken)
  assert(configured.ok, 'Paraşüt refresh token could not be stored in Supabase Vault')
  console.log('PASS Paraşüt OAuth refresh token stored in Supabase Vault')
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Paraşüt OAuth configuration failed')
  process.exitCode = 1
})
