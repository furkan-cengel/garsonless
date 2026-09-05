import assert from 'node:assert/strict'
import test from 'node:test'
import { productImageDelivery } from './product-image-delivery.ts'

test('public product assets get responsive optimizer requests', () => {
  const source = 'https://svxvloeosiksqfadgkvo.supabase.co/storage/v1/object/public/restaurant-assets/tenant/items/ürün.jpg'
  const image = productImageDelivery(source)
  assert.ok(image)
  const request = new URL(image.src, 'https://menu.masabu.co')
  assert.equal(request.pathname, '/_next/image')
  assert.equal(request.searchParams.get('url'), source)
  assert.equal(request.searchParams.get('w'), '640')
  assert.match(image.srcSet, /384w, .*640w, .*1080w$/)
})

test('external, private and credential-bearing URLs retain their original delivery path', () => {
  for (const source of [undefined, '/local.webp', 'data:image/png;base64,abc',
    'https://example.com/a.jpg',
    'https://svxvloeosiksqfadgkvo.supabase.co/storage/v1/object/sign/restaurant-assets/a.jpg',
    'https://svxvloeosiksqfadgkvo.supabase.co/storage/v1/object/public/restaurant-assets/a.jpg?token=secret',
    'https://user:pass@svxvloeosiksqfadgkvo.supabase.co/storage/v1/object/public/restaurant-assets/a.jpg',
  ]) assert.equal(productImageDelivery(source), undefined)
})
