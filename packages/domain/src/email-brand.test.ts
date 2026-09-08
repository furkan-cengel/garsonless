import assert from 'node:assert/strict'
import test from 'node:test'
import { emailAction, emailCode, emailHtmlToText, emailParagraph, renderBrandEmail } from './email-brand'
import { renderContactEmail, renderDeviceCodeEmail, renderInvoiceEmail, renderTeamInviteEmail } from './email-messages'

test('untrusted names, subjects and contact messages remain data in both alternatives', () => {
  const mail = renderContactEmail({ name: 'Ada <img src=x onerror=alert(1)>', email: 'ada@example.test', topic: 'Satış\r\nBcc: x', branchCount: 0, message: 'A & B\n<script>alert(1)</script>' })
  assert.doesNotMatch(mail.subject, /[\r\n]/)
  assert.doesNotMatch(mail.html, /<script>|onerror="/)
  assert.match(mail.html, /&lt;script&gt;/)
  assert.match(mail.text, /A & B/)
  assert.match(mail.html, /Şube sayısı/)
  assert.doesNotMatch(mail.text, /<table|font-family|&#847;/)
})

test('codes preserve leading zeros and remain selectable text', () => {
  const mail = renderDeviceCodeEmail('00123456')
  assert.match(mail.html, />00123456<\/span>/)
  assert.match(mail.text, /00123456/)
  assert.match(mail.text, /10 dakika/)
  assert.match(emailCode('<script>'), /&lt;script&gt;/)
})

test('actions reject active schemes and preserve complete escaped verification URLs', () => {
  assert.equal(emailAction('Aç', 'javascript:alert(1)'), '')
  assert.equal(emailAction('Aç', 'data:text/html,bad'), '')
  const href = 'https://app.masabu.co/auth/confirm?token_hash=a&flow=signup'
  const action = emailAction('Aç', href)
  assert.match(action, /&amp;flow=signup/)
  assert.ok(emailHtmlToText(action).includes(href))
})

test('invitations expose Turkish permissions, expiry and a usable text link', () => {
  const mail = renderTeamInviteEmail({ restaurantName: 'A & B', url: 'https://app.masabu.co/auth/accept-invite?token=demo', permissions: ['orders', 'tables'] })
  assert.match(mail.html, /Siparişler, Masalar/)
  assert.match(mail.text, /7 gün/)
  assert.match(mail.text, /accept-invite\?token=demo/)
  assert.match(mail.subject, /A & B/)
})

test('invoice document identifies its attachment without promising a payment status', () => {
  const mail = renderInvoiceEmail({ name: 'Ada', plan: 'pro', reference: 'invoice-demo-001' })
  assert.match(mail.html, /invoice-demo-001/)
  assert.match(mail.text, /PDF/)
  assert.doesNotMatch(mail.text, /ödemeniz alındı/i)
})

test('branded documents include language, preheader and image fallback; plain text omits hidden text', () => {
  const html = renderBrandEmail({ title: 'Başlık', category: 'Hesap', preheader: 'Sadece gelen kutusu özeti', bodyHtml: emailParagraph('Gövde') })
  assert.match(html, /<html lang="tr"/)
  assert.match(html, /alt="masabu"/)
  assert.match(html, /role="presentation"/)
  assert.match(html, /Sadece gelen kutusu özeti/)
  assert.doesNotMatch(emailHtmlToText(html), /Sadece gelen kutusu özeti/)
})

test('invoice totals and periods come from the job rather than the design example', () => {
  const mail = renderInvoiceEmail({ name: 'Ada', plan: 'plus', reference: 'invoice-real', amountMinor: 12345, periodStart: '2026-09-08T00:00:00Z', periodEnd: '2026-10-08T00:00:00Z' })
  assert.match(mail.text, /123,45/)
  assert.match(mail.text, /Plus/)
  assert.match(mail.text, /0?8\.0?9\.2026/)
  assert.doesNotMatch(mail.text, /499,00|598,80|718,80|KDV|MSB2026/)
})
