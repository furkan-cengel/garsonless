import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_THEME, type AuthSurfaceTheme } from './schema'
import { resolveAuthErrorState, resolveAuthOtpState, resolveAuthSuccessState } from './auth-state-policy'

test('legacy auth surfaces resolve to the current OTP and return-screen defaults', () => {
  const auth = DEFAULT_THEME.surfaces!.auth
  assert.equal(resolveAuthOtpState(auth).title, 'Doğrulama')
  assert.equal(resolveAuthOtpState(auth).layout.paddingX, 22)
  assert.equal(resolveAuthSuccessState(auth).icon, 'check')
  assert.equal(resolveAuthSuccessState(auth).iconColor, '#7fe0ad')
  assert.equal(resolveAuthSuccessState(auth).iconBackground, '#133a2a')
  assert.equal(resolveAuthErrorState(auth).icon, 'warn')
  assert.equal(resolveAuthErrorState(auth).iconColor, '#ffb0aa')
  assert.equal(resolveAuthErrorState(auth).iconBackground, '#421c1d')
})

test('state overrides remain isolated and merge only their bounded layout fields', () => {
  const auth: AuthSurfaceTheme = {
    ...DEFAULT_THEME.surfaces!.auth,
    states: {
      otp: { title: 'Kodunu gir', layout: { contentGap: 24 } },
      success: { icon: 'sparkles', iconColor: '#ffffff', iconBackground: '#102030', primaryActionLabel: 'Menüye geç' },
    },
  }

  const otp = resolveAuthOtpState(auth)
  assert.equal(otp.title, 'Kodunu gir')
  assert.equal(otp.layout.contentGap, 24)
  assert.equal(otp.layout.paddingY, 24)
  assert.equal(resolveAuthSuccessState(auth).icon, 'sparkles')
  assert.equal(resolveAuthSuccessState(auth).iconColor, '#ffffff')
  assert.equal(resolveAuthSuccessState(auth).iconBackground, '#102030')
  assert.equal(resolveAuthErrorState(auth).icon, 'warn')
})
