import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { mock } from 'node:test'
import { uploadLogo, uploadMenuImage, uploadThemeMedia, uploadThemeVideo } from './dashboard-media-upload-client'

const route = readFileSync(
  new URL('../app/api/uploads/[kind]/route.ts', import.meta.url),
  'utf8',
)
const config = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8')

test('media uploads use a bounded same-origin route instead of a raised global Server Action limit', () => {
  assert.match(route, /multipart\/form-data/)
  assert.match(route, /content-length/)
  assert.match(route, /origin !== new URL\(request\.url\)\.origin/)
  assert.match(route, /2 \* 1024 \* 1024/)
  assert.match(route, /5 \* 1024 \* 1024/)
  assert.match(route, /8 \* 1024 \* 1024/)
  assert.doesNotMatch(config, /bodySizeLimit/)
})

const clients = [
  { kind: 'logo', run: (data: FormData) => uploadLogo('restaurant-id', data), result: { url: 'https://example.test/logo.png' } },
  { kind: 'menu-image', run: uploadMenuImage, result: { url: 'https://example.test/item.png' } },
  { kind: 'theme-image', run: uploadThemeMedia, result: { url: 'https://example.test/theme.webp', width: 24, height: 24, mime: 'image/webp' } },
  { kind: 'theme-video', run: uploadThemeVideo, result: { url: 'https://example.test/video.mp4', durationSeconds: 3, mime: 'video/mp4' } },
]

for (const client of clients) {
  test(`${client.kind}: successful upload keeps metadata and multipart authentication`, async () => {
    const data = new FormData()
    const fetchMock = mock.method(globalThis, 'fetch', async (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      assert.equal(url, `/api/uploads/${client.kind}`)
      assert.equal(init?.body, data)
      assert.equal(init?.credentials, 'same-origin')
      assert.equal(init?.method, 'POST')
      return Response.json(client.result)
    })
    try {
      assert.deepEqual(await client.run(data), client.result)
      if (client.kind === 'logo') assert.equal(data.get('restaurantId'), 'restaurant-id')
    } finally { fetchMock.mock.restore() }
  })

  test(`${client.kind}: preserves server validation messages on HTTP 400`, async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Yalnız PNG, JPEG veya WebP logo yükleyin.' }, { status: 400 }))
    try {
      assert.deepEqual(await client.run(new FormData()), { error: 'Yalnız PNG, JPEG veya WebP logo yükleyin.' })
    } finally { fetchMock.mock.restore() }
  })

  test(`${client.kind}: network failure becomes a retryable result`, async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new TypeError('Failed to fetch') })
    try {
      assert.match((await client.run(new FormData()) as { error: string }).error, /İnternet bağlantınızı/)
    } finally { fetchMock.mock.restore() }
  })
}

for (const [status, message] of [[401, /Oturumunuzu/], [403, /yetkiniz yok/], [413, /Dosya yükleme sınırını/], [429, /Biraz bekleyip/]] as const) {
  test(`non-JSON HTTP ${status} has a useful Turkish error`, async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('upstream error', { status }))
    try { assert.match((await uploadMenuImage(new FormData()) as { error: string }).error, message) }
    finally { fetchMock.mock.restore() }
  })
}

test('an authentication redirect with HTTP 200 is not treated as success', async () => {
  const response = new Response('<html>Sign in</html>')
  Object.defineProperty(response, 'redirected', { value: true })
  const fetchMock = mock.method(globalThis, 'fetch', async () => response)
  try { assert.match((await uploadMenuImage(new FormData()) as { error: string }).error, /Oturumunuzu/) }
  finally { fetchMock.mock.restore() }
})

for (const payload of [null, {}, { url: '' }, { url: 'javascript:alert(1)' }, { error: 5 }]) {
  test(`malformed successful payload is rejected: ${JSON.stringify(payload)}`, async () => {
    const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json(payload))
    try { assert.ok('error' in await uploadMenuImage(new FormData())) }
    finally { fetchMock.mock.restore() }
  })
}

test('missing theme metadata and internal server diagnostics are not shown as success', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ url: 'https://example.test/image.webp' }))
  try {
    assert.ok('error' in await uploadThemeMedia(new FormData()))
    assert.ok('error' in await uploadThemeVideo(new FormData()))
    fetchMock.mock.mockImplementation(async () => Response.json({ error: 'secret internal storage diagnostic' }, { status: 500 }))
    assert.equal((await uploadMenuImage(new FormData()) as { error: string }).error, 'Dosya yüklenemedi. Lütfen tekrar deneyin.')
  } finally { fetchMock.mock.restore() }
})

test('legacy authentication messages are translated', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ error: 'Not authenticated' }, { status: 400 }))
  try {
    assert.match((await uploadMenuImage(new FormData()) as { error: string }).error, /Oturumunuzu/)
    fetchMock.mock.mockImplementation(async () => Response.json({ error: 'Not authorized' }, { status: 400 }))
    assert.match((await uploadMenuImage(new FormData()) as { error: string }).error, /yetkiniz yok/)
  } finally { fetchMock.mock.restore() }
})
