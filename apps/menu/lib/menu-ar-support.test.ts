import assert from 'node:assert/strict'
import test from 'node:test'
import { menuArSupport } from './menu-ar-support.ts'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36'
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36'
const xr = (supported: boolean) => ({ isSessionSupported: async () => supported })

test('desktop never offers AR', async () => {
  assert.equal(await menuArSupport(true, { userAgent: DESKTOP, maxTouchPoints: 0 }), 'desktop')
})

test('iPhone and iPadOS follow model-viewer', async () => {
  assert.equal(await menuArSupport(true, { userAgent: IPHONE, maxTouchPoints: 5 }), 'available')
  assert.equal(await menuArSupport(false, { userAgent: IPHONE, maxTouchPoints: 5 }), 'unsupported')
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15'
  assert.equal(await menuArSupport(true, { userAgent: ipad, maxTouchPoints: 5 }), 'available')
})

test('Android needs WebXR immersive-ar, not only Scene Viewer', async () => {
  assert.equal(await menuArSupport(true, { userAgent: ANDROID, maxTouchPoints: 5, xr: xr(true) }), 'available')
  assert.equal(await menuArSupport(true, { userAgent: ANDROID, maxTouchPoints: 5, xr: xr(false) }), 'unsupported')
  assert.equal(await menuArSupport(true, { userAgent: ANDROID, maxTouchPoints: 5 }), 'unsupported')
  const failing = { isSessionSupported: () => Promise.reject(new Error('blocked')) }
  assert.equal(await menuArSupport(true, { userAgent: ANDROID, maxTouchPoints: 5, xr: failing }), 'unsupported')
})
