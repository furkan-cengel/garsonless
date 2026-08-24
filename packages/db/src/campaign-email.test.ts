import assert from 'node:assert/strict'
import test from 'node:test'
import {
  campaignMessageHtml,
  campaignSenderAddress,
  normalizeCampaignEmail,
  readCampaignEmailIdentity,
  renderCampaignEmail,
  sanitizeCampaignHtml,
  sendCampaignEmail,
} from './campaign-email'

test('campaign email normalization rejects malformed addresses and canonicalizes case', () => {
  assert.equal(normalizeCampaignEmail(' USER@Example.COM '), 'user@example.com')
  assert.equal(normalizeCampaignEmail('user example.com'), null)
  assert.equal(normalizeCampaignEmail('user@example'), null)
})

test('campaign email HTML escapes merchant-authored content', () => {
  const html = campaignMessageHtml('Merhaba <script>alert("x")</script>\n\nİkinci satır')
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /pazarlama iletişimine izin verdiğiniz/)
})

test('campaign sender uses the restaurant name with the verified Masabu mailbox', () => {
  assert.equal(
    campaignSenderAddress('Masabu <campaign@send.masabu.co>', ' MAF Cafe Lounge '),
    'MAF Cafe Lounge <campaign@send.masabu.co>',
  )
  assert.equal(
    campaignSenderAddress('campaign@send.masabu.co', 'Kafe\r\nBcc: attacker@example.com'),
    'Kafe Bcc: attacker@example.com <campaign@send.masabu.co>',
  )
})

test('campaign replies use only the restaurant contact email', () => {
  assert.deepEqual(
    readCampaignEmailIdentity(' MAF Cafe Lounge ', { contact: { email: ' INFO@MAF.EXAMPLE ' } }),
    { senderName: 'MAF Cafe Lounge', replyTo: 'info@maf.example' },
  )
  assert.deepEqual(
    readCampaignEmailIdentity('MAF Cafe Lounge', { contact: { email: 'invalid' } }),
    { senderName: 'MAF Cafe Lounge', replyTo: null },
  )
})

test('Resend receives the branded sender and restaurant reply address', async () => {
  const previousApiKey = process.env['RESEND_API_KEY']
  const previousFrom = process.env['RESEND_FROM_EMAIL']
  const previousFetch = globalThis.fetch
  let payload: Record<string, unknown> | null = null
  process.env['RESEND_API_KEY'] = 're_test_key'
  process.env['RESEND_FROM_EMAIL'] = 'Masabu <campaign@send.masabu.co>'
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    payload = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(JSON.stringify({ id: 'email-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  try {
    const sent = await sendCampaignEmail({
      to: 'customer@example.com',
      subject: 'Hafta sonu menüsü',
      message: 'Sizi bekliyoruz.',
      senderName: 'MAF Cafe Lounge',
      replyTo: 'iletisim@maf.example',
    })
    assert.deepEqual(sent, { provider: 'resend', messageId: 'email-1' })
    assert.equal(payload?.['from'], 'MAF Cafe Lounge <campaign@send.masabu.co>')
    assert.equal(payload?.['reply_to'], 'iletisim@maf.example')
  } finally {
    globalThis.fetch = previousFetch
    if (previousApiKey === undefined) delete process.env['RESEND_API_KEY']
    else process.env['RESEND_API_KEY'] = previousApiKey
    if (previousFrom === undefined) delete process.env['RESEND_FROM_EMAIL']
    else process.env['RESEND_FROM_EMAIL'] = previousFrom
  }
})

test('custom campaign HTML removes executable and interactive content', () => {
  const clean = sanitizeCampaignHtml(`
    <div onclick="alert(1)" style="color:#171719;background-image:url(javascript:alert(1))">
      <script>alert('x')</script>
      <form><input name="password"></form>
      <a href="javascript:alert(1)">Kötü bağlantı</a>
      <img src="https://cdn.example.com/banner.jpg" onerror="alert(1)">
    </div>
  `)
  assert.doesNotMatch(clean, /script|onclick|onerror|javascript:|<form|<input/i)
  assert.match(clean, /https:\/\/cdn\.example\.com\/banner\.jpg/)
})

test('ready templates render restaurant branding while custom HTML keeps the compliance footer', () => {
  const offer = renderCampaignEmail({
    contentMode: 'template',
    templateId: 'offer',
    content: 'Bu hafta sonu sizi bekliyoruz.',
    restaurantName: 'MAF Cafe Lounge',
  })
  assert.match(offer, /MAF Cafe Lounge/)
  assert.match(offer, /Size özel/)

  const custom = renderCampaignEmail({
    contentMode: 'html',
    templateId: null,
    content: '<h1>{{restaurant_name}}</h1><p>Merhaba</p>',
    restaurantName: 'MAF Cafe Lounge',
  })
  assert.match(custom, /<h1>MAF Cafe Lounge<\/h1>/)
  assert.match(custom, /pazarlama iletişimine izin verdiğiniz/)
})

test('block-builder campaigns render their stored design and immutable compliance footer', () => {
  const html = renderCampaignEmail({
    contentMode: 'builder',
    templateId: null,
    content: 'Yedek metin',
    restaurantName: 'MAF Cafe Lounge',
    emailDesign: {
      version: 1,
      backgroundColor: '#101010', contentBackgroundColor: '#ffffff', textColor: '#171719', accentColor: '#c8922a',
      fontFamily: 'georgia', maxWidth: 620, borderRadius: 14,
      blocks: [
        { id: 'heading', type: 'heading', text: '{{restaurant_name}}', level: 1, align: 'center', color: '#171719' },
        { id: 'button', type: 'button', label: 'Rezervasyon yap', href: 'https://example.com', align: 'center', backgroundColor: '#c8922a', textColor: '#ffffff', borderRadius: 10 },
      ],
    },
  })
  assert.match(html, /font-family:Georgia/)
  assert.match(html, /MAF Cafe Lounge/)
  assert.match(html, /Rezervasyon yap/)
  assert.match(html, /pazarlama iletişimine izin verdiğiniz/)
})
