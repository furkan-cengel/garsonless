/** Offline gallery: only synthetic data; never invokes a delivery provider. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { renderNotificationEmail, type NotificationEmailEvent } from '@garsonless/application/notification-emails'
import { BILLING_NOTIFICATION_EVENT_TYPES } from '@garsonless/application/notifications'
import { EMAIL_BRAND } from '@garsonless/domain/email-brand'
import { renderContactEmail, renderDeviceCodeEmail, renderInvoiceEmail, renderStandRequestEmail, renderTeamInviteEmail } from '@garsonless/domain/email-messages'
import { DEFAULT_CAMPAIGN_EMAIL_DESIGN } from '@garsonless/domain/campaigns'
import { renderCampaignEmail } from '../src/campaign-email'
import { authEmailSubject, renderAuthEmailHtml } from '../supabase/functions/send-email-hook/email-template'

const output = new URL('../../../test-results/email-brand/', import.meta.url)
await mkdir(output, { recursive: true })
const logo = await readFile(new URL('../../../assets/brand/masabu-logo-transparent-512px.png', import.meta.url))
const examples: Array<{ id: string; group: string; subject: string; html: string }> = []
const add = (id: string, group: string, message: { subject: string; html: string }) => examples.push({ id, group, ...message })
const auth = { email: 'deniz@example.test', token: '00123456', tokenHash: 'preview-token-not-valid', redirectTo: 'https://app.masabu.co/auth/confirm', supabaseUrl: 'https://preview.example.test' }
for (const actionType of ['signup', 'magiclink', 'recovery', 'email_change', 'otp', 'invite', 'reauthentication']) {
  add(`auth-${actionType}`, 'Hesap ve güvenlik', { subject: authEmailSubject(actionType, auth.redirectTo), html: renderAuthEmailHtml({ ...auth, actionType }) })
}
add('customer-login', 'Hesap ve güvenlik', { subject: authEmailSubject('magiclink'), html: renderAuthEmailHtml({ ...auth, actionType: 'magiclink', redirectTo: 'https://menu.masabu.co/auth/callback' }) })
add('device', 'Hesap ve güvenlik', renderDeviceCodeEmail('001234'))
add('team-invite', 'Ekip', renderTeamInviteEmail({ restaurantName: 'Mimoza Kahve', url: 'https://app.masabu.co/auth/accept-invite?token=preview-only', permissions: ['orders', 'menu', 'tables'] }))
const event: NotificationEmailEvent = { id: 'preview', type: 'order.created', restaurantId: 'preview-restaurant', restaurantName: 'Mimoza Kahve', aggregateId: 'preview', tableLabel: 'Masa 08', payload: { total: 450, source: 'customer', requestType: 'waiter' } }
for (const type of ['order.created', 'service_request.created', 'onboarding.incomplete', ...BILLING_NOTIFICATION_EVENT_TYPES] as const) {
  const payload = type === 'invoice.paid' ? { amountMinor: 59880, currency: 'TRY', plan: 'pro', billingInterval: 'monthly', paidAt: '2026-09-08T11:32:00Z' }
    : type === 'invoice.upcoming' ? { plan: 'pro', billingInterval: 'monthly', periodEnd: '2026-10-08T11:32:00Z' }
    : type === 'refund.succeeded' ? { amountMinor: 59880, currency: 'TRY', invoiceId: 'ORNEK-FATURA-001', refundId: 'ORNEK-IADE-001' }
    : type === 'fiscal_document.ready' ? { invoiceId: 'ORNEK-FATURA-001', fiscalDocumentType: 'e_arsiv' } : event.payload
  const rendered = renderNotificationEmail({ ...event, type, payload }, { dashboardBaseUrl: 'https://app.masabu.co' })
  add(type, ['order.created', 'service_request.created'].includes(type) ? 'İşletme' : 'Abonelik ve başlangıç', { subject: rendered.subject, html: rendered.bodyHtml })
}
const welcome = renderNotificationEmail({ ...event, type: 'invoice.paid', payload: { firstPaidActivation: true, plan: 'pro', billingInterval: 'annual', addOns: [], onboardingComplete: false } }, { dashboardBaseUrl: 'https://app.masabu.co' })
add('welcome', 'Abonelik ve başlangıç', { subject: welcome.subject, html: welcome.bodyHtml })
add('invoice-pdf', 'Fatura', renderInvoiceEmail({ name: 'Deniz Yılmaz', plan: 'pro', reference: 'ORNEK-FATURA-2026-001', amountMinor: 59880, periodStart: '2026-09-08T00:00:00Z', periodEnd: '2026-10-08T00:00:00Z', documentType: 'e_arsiv' }))
add('stand-request', 'Operasyon', renderStandRequestEmail({ restaurantName: 'Mimoza Kahve', contactName: 'Deniz Yılmaz', email: 'deniz@example.test', phone: '+90 555 000 00 00', tableCount: 24, standType: 'premium', notes: 'Teras masaları için de stand istiyoruz.' }))
add('contact', 'Operasyon', renderContactEmail({ name: 'Deniz Yılmaz', email: 'deniz@example.test', topic: 'Satış', businessName: 'Mimoza Kahve', branchCount: 3, message: 'Merhaba, üç şubemiz için masabu’yu değerlendirmek istiyoruz.\nBirlikte nasıl başlayabiliriz?' }))
for (const templateId of ['minimal', 'announcement', 'offer'] as const) {
  add(`campaign-${templateId}`, 'Müşteri kampanyası', { subject: 'Mimoza Kahve · Kahve molasına bekliyoruz', html: renderCampaignEmail({ contentMode: 'template', templateId, restaurantName: 'Mimoza Kahve', content: templateId === 'offer' ? 'İkinci kahve bizden\n\nHafta içi 14:00–17:00 arası gelin, ikinci kahvenizi ısmarlayalım. Masadaki QR’ı okutup menüden seçmeniz yeterli.\n\n8–14 Eylül · Filtre kahve ve espresso bazlı içeceklerde geçerlidir. Paket servisi kapsamaz.' : 'İşletmemizden haberler\n\nYeni mevsim menümüzü keşfetmek için sizi Mimoza’ya bekliyoruz. En sevdiğiniz masanız hazır.' }) })
}
add('campaign-builder', 'Müşteri kampanyası', { subject: 'Mimoza Kahve · Yeni menümüz hazır', html: renderCampaignEmail({ contentMode: 'builder', templateId: null, content: '', emailDesign: DEFAULT_CAMPAIGN_EMAIL_DESIGN, restaurantName: 'Mimoza Kahve' }) })
add('campaign-html', 'Müşteri kampanyası', { subject: 'Mimoza Kahve · İşletmeye özel tasarım', html: renderCampaignEmail({ contentMode: 'html', templateId: null, content: '<h1>Merhaba, {{restaurant_name}}.</h1><p>Yeni tatlarımızla tanışmaya hazır mısınız?</p>', restaurantName: 'Mimoza Kahve' }) })
for (const item of examples) await writeFile(new URL(`${item.id}.html`, output), item.html.replaceAll(EMAIL_BRAND.logoUrl, `data:image/png;base64,${logo.toString('base64')}`))
const shell = await readFile(new URL('../../../docs/email/preview-shell.html', import.meta.url), 'utf8')
const manifest = JSON.stringify(examples.map(({ id, group, subject }) => ({ id, group, subject }))).replaceAll('<', '\\u003c')
await writeFile(new URL('index.html', output), shell
  .replace('{{LOGO_URL}}', () => `data:image/png;base64,${logo.toString('base64')}`)
  .replace('{{EXAMPLE_COUNT}}', () => String(examples.length))
  .replace('{{EXAMPLES_JSON}}', () => manifest))
console.log(`${examples.length} email previews: ${fileURLToPath(new URL('index.html', output))}`)
