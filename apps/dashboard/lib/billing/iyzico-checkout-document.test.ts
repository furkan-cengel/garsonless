import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createIyzicoCheckoutDocument,
  validateIyzicoCheckoutContent,
} from './iyzico-checkout-document'

function checkoutContent(environment: 'sandbox' | 'live' = 'sandbox'): string {
  const api = environment === 'sandbox' ? 'sandbox-api.iyzipay.com' : 'api.iyzipay.com'
  const staticHost = environment === 'sandbox' ? 'sandbox-static.iyzipay.com' : 'static.iyzipay.com'
  return `<script type="text/javascript">if (typeof iyziInit === 'undefined') { var iyziInit = { baseUrl: 'https://${api}', createTag: function () { var tag = document.createElement('script'); tag.setAttribute('src', 'https://${staticHost}/checkoutform/v2/bundle.js?v=1'); document.head.appendChild(tag); } }; iyziInit.createTag(); }</script>`
}

test('iyzico subscription loader receives its documented responsive mount', () => {
  const providerContent = checkoutContent()
  const document = createIyzicoCheckoutDocument(providerContent, 'frame-nonce')

  assert.match(document, /^<!doctype html>/i)
  assert.match(document, /<meta name="viewport"/)
  assert.match(document, /Content-Security-Policy/)
  assert.match(document, /https:\/\/sandbox-static\.iyzipay\.com/)
  assert.match(document, /connect-src[^;]*https:\/\/sandbox-gql\.iyzipay\.com/)
  assert.match(document, /form-action 'self'[^;]*https:\/\/sandbox-api\.iyzipay\.com/)
  assert.match(document, /img-src data: blob:[^;]*https:\/\/cdn\.iyzipay\.com/)
  assert.match(document, /font-family: Inter, -apple-system/)
  assert.match(document, /<div id="iyzipay-checkout-form" class="responsive"><\/div>/)
  assert.ok(document.indexOf('id="iyzipay-checkout-form"') < document.indexOf(providerContent))
  assert.ok(document.indexOf('masabu:iyzico-mounted') < document.indexOf(providerContent))
  assert.match(document, /document\.addEventListener\('submit'/)
  assert.match(document, /masabu:iyzico-attempting/)
  assert.match(document, /masabu:iyzico-navigating/)
  assert.ok(document.indexOf('masabu:iyzico-attempting') < document.indexOf('masabu:iyzico-navigating'))
  assert.equal(document.match(/frame-nonce/g)?.length, 1)
})

test('checkout content validation binds loader resources to the expected environment', () => {
  assert.equal(validateIyzicoCheckoutContent(checkoutContent(), 'sandbox')?.environment, 'sandbox')
  assert.equal(validateIyzicoCheckoutContent(checkoutContent('live'), 'live')?.environment, 'live')
  assert.equal(validateIyzicoCheckoutContent(checkoutContent(), 'live'), null)
  assert.equal(validateIyzicoCheckoutContent(
    checkoutContent().replace('sandbox-static.iyzipay.com', 'attacker.example'),
  ), null)
})

test('checkout content validation rejects markup, malformed loaders, and oversized responses', () => {
  assert.equal(validateIyzicoCheckoutContent('<form action="https://sandbox-api.iyzipay.com"></form>'), null)
  assert.equal(validateIyzicoCheckoutContent('<script>window.notIyzico = true</script>'), null)
  assert.equal(validateIyzicoCheckoutContent(`${checkoutContent()}${' '.repeat(512 * 1024)}`), null)
})
