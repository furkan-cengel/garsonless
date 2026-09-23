import assert from 'node:assert/strict'
import test from 'node:test'
import {
  customerAuthCallbackUrl,
  safeCustomerReturnPath,
  validateCustomerAuthMutation,
} from './customer-auth-request.ts'

const previousUrl = process.env['NEXT_PUBLIC_MENU_URL']

test.after(() => {
  if (previousUrl === undefined) delete process.env['NEXT_PUBLIC_MENU_URL']
  else process.env['NEXT_PUBLIC_MENU_URL'] = previousUrl
})

test('mutation guard requires exact configured origin and JSON', () => {
  process.env['NEXT_PUBLIC_MENU_URL'] = 'https://menu.masabu.co'
  const valid = new Request('https://menu.masabu.co/api/customer-auth/email/start', {
    method: 'POST',
    headers: {
      Origin: 'https://menu.masabu.co',
      'Content-Type': 'application/json; charset=utf-8',
      'Sec-Fetch-Site': 'same-origin',
    },
  })
  assert.equal(validateCustomerAuthMutation(valid).ok, true)

  const rejectedHeaders: Array<Record<string, string>> = [
    { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    { Origin: 'https://menu.masabu.co', 'Content-Type': 'text/plain' },
    { Origin: 'https://menu.masabu.co', 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
  ]
  for (const headers of rejectedHeaders) {
    assert.equal(validateCustomerAuthMutation(new Request(valid.url, { method: 'POST', headers })).ok, false)
  }
})

test('return path and callback construction reject open redirects', () => {
  process.env['NEXT_PUBLIC_MENU_URL'] = 'https://menu.masabu.co'
  assert.equal(safeCustomerReturnPath('/cafe?table=2#cart'), '/cafe?table=2#cart')
  assert.equal(safeCustomerReturnPath('//evil.example/path'), '/')
  assert.equal(safeCustomerReturnPath('https://evil.example/path'), '/')
  assert.equal(safeCustomerReturnPath('/.//evil.example/path'), '/')
  assert.equal(safeCustomerReturnPath('/cafe/..//evil.example/path'), '/')
  assert.equal(safeCustomerReturnPath('/\\evil.example/path'), '/')
  assert.equal(safeCustomerReturnPath('/cafe/../menu'), '/menu')
  assert.equal(customerAuthCallbackUrl('opaque')?.toString(), 'https://menu.masabu.co/auth/callback?intent=opaque')
})
