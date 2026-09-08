/** Email primitives adapted from docs/email/reference. No runtime dependencies: also deployed to Deno. */
export const EMAIL_BRAND = {
  name: 'masabu', green: '#2f6f4e', ink: '#16211c', muted: '#4d5852',
  subtle: '#737d77', canvas: '#f4f5f3', tint: '#fafbfa', line: '#e4e7e3',
  logoUrl: 'https://masabu.co/brand/masabu-logo-transparent-512px.png',
  // Existing published business identity, rather than the reference's example address.
  address: 'Cevizli Mah. Zuhal Cad. A Blok No: 46 İç Kapı No: 50, Maltepe/İstanbul',
} as const
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace"
export type EmailTone = 'brand' | 'attention' | 'critical'
const TONES: Record<EmailTone, string> = { brand: EMAIL_BRAND.green, attention: '#b7791f', critical: '#b42318' }

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
export function emailParagraph(value: string): string {
  return `<p style="margin:16px 0 0;font:15px/1.65 ${FONT};color:${EMAIL_BRAND.muted}">${escapeEmailHtml(value).replaceAll('\n', '<br>')}</p>`
}
export function emailDetails(rows: ReadonlyArray<readonly [string, string]>): string {
  if (!rows.length) return ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border:1px solid ${EMAIL_BRAND.line};border-radius:8px;background:${EMAIL_BRAND.tint}">${rows.map(([label, value], i) => `<tr><td valign="top" width="38%" style="padding:11px 16px;font:13px/1.5 ${FONT};color:${EMAIL_BRAND.subtle};${i ? `border-top:1px solid ${EMAIL_BRAND.line}` : ''}">${escapeEmailHtml(label)}</td><td valign="top" align="right" style="padding:11px 16px;font:600 13px/1.5 ${FONT};word-break:break-word;color:${EMAIL_BRAND.ink};${i ? `border-top:1px solid ${EMAIL_BRAND.line}` : ''}">${escapeEmailHtml(value).replaceAll('\n', '<br>')}</td></tr>`).join('')}</table>`
}
export function emailSteps(steps: ReadonlyArray<readonly [string, string]>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px;border:1px solid ${EMAIL_BRAND.line};border-radius:8px">${steps.map(([title, description], i) => `<tr><td style="padding:14px 16px;${i ? `border-top:1px solid ${EMAIL_BRAND.line}` : ''}"><div style="font:600 14px/1.5 ${FONT};color:${EMAIL_BRAND.ink}">${i + 1}. ${escapeEmailHtml(title)}</div><div style="margin-top:2px;font:13px/1.5 ${FONT};color:${EMAIL_BRAND.subtle}">${escapeEmailHtml(description)}</div></td></tr>`).join('')}</table>`
}
export function emailLineItems(rows: ReadonlyArray<readonly [string, string]>, total: string, totalLabel = 'Toplam'): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border:1px solid ${EMAIL_BRAND.line};border-radius:8px">${[...rows, [totalLabel, total] as const].map(([label, amount], i, all) => `<tr><td style="padding:12px 16px;font:${i === all.length - 1 ? '600' : '400'} 14px/1.5 ${FONT};color:${EMAIL_BRAND.ink};${i ? `border-top:1px solid ${EMAIL_BRAND.line};` : ''}${i === all.length - 1 ? `background:${EMAIL_BRAND.tint}` : ''}">${escapeEmailHtml(label)}</td><td align="right" style="padding:12px 16px;font:600 14px/1.5 ${MONO};color:${EMAIL_BRAND.ink};${i ? `border-top:1px solid ${EMAIL_BRAND.line};` : ''}${i === all.length - 1 ? `background:${EMAIL_BRAND.tint}` : ''}">${escapeEmailHtml(amount)}</td></tr>`).join('')}</table>`
}
export function emailCode(code: string, label = 'Tek kullanımlık kod'): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px"><tr><td align="center" style="padding:22px 12px;background:${EMAIL_BRAND.tint};border:1px solid ${EMAIL_BRAND.line};border-radius:10px"><span style="font:600 34px ${MONO};letter-spacing:3px;color:${EMAIL_BRAND.ink};white-space:nowrap">${escapeEmailHtml(code)}</span><div style="margin-top:8px;font:12px ${FONT};color:${EMAIL_BRAND.subtle}">${escapeEmailHtml(label)}</div></td></tr></table>`
}
function safeEmailUrl(href: string): string | null {
  try { const url = new URL(href); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? escapeEmailHtml(href) : null } catch { return null }
}
export function emailAction(label: string, href: string, options: { fallback?: boolean } = {}): string {
  const safeHref = safeEmailUrl(href)
  if (!safeHref) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px"><tr><td align="center" bgcolor="${EMAIL_BRAND.green}" style="border-radius:6px;mso-padding-alt:13px 24px"><a href="${safeHref}" style="display:inline-block;padding:13px 24px;font:600 15px/20px ${FONT};color:#ffffff;text-decoration:none;border-radius:6px;mso-padding-alt:0">${escapeEmailHtml(label)}</a></td></tr></table>${options.fallback ? `<p style="margin:20px 0 0;font:12px/1.6 ${FONT};color:${EMAIL_BRAND.subtle};word-break:break-all">Düğme açılmıyorsa bu bağlantıyı tarayıcınıza yapıştırın:<br><a href="${safeHref}" style="color:${EMAIL_BRAND.green};text-decoration:underline">${safeHref}</a></p>` : ''}`
}
export interface BrandEmailInput {
  preheader: string
  category: string
  title?: string
  /** Trusted markup only; escape all interpolated data. */
  bodyHtml: string
  footer?: string
  merchantName?: string
  headerLabel?: string
  tone?: EmailTone
  notificationSettingsUrl?: string
}
export function renderBrandEmail(input: BrandEmailInput): string {
  const { ink, muted, subtle, canvas, line, green } = EMAIL_BRAND
  const accent = TONES[input.tone ?? 'brand']
  const settingsUrl = input.notificationSettingsUrl ? safeEmailUrl(input.notificationSettingsUrl) : null
  const header = `<img src="${EMAIL_BRAND.logoUrl}" width="118" height="26" alt="masabu" style="display:block;width:118px;height:26px;border:0;outline:none;text-decoration:none;font:600 22px ${FONT};color:${green}">`
  return `<!doctype html>
<html lang="tr" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><title>${escapeEmailHtml(input.title ?? input.preheader)}</title><style>body{margin:0!important;padding:0!important}table{mso-table-lspace:0pt;mso-table-rspace:0pt}a{color:${green}}@media only screen and (max-width:620px){.email-outer{padding:16px 8px!important}.email-content{padding:28px 22px!important}.email-title{font-size:23px!important}}</style></head>
<body style="margin:0;padding:0;background:${canvas};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeEmailHtml(input.preheader)}${'&#847; &zwnj; &nbsp;'.repeat(24)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${canvas}"><tr><td class="email-outer" align="center" style="padding:40px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td style="padding:0 4px 14px"><table role="presentation" width="100%"><tr><td align="left">${header}</td><td align="right" style="padding-left:12px;font:12px/1.5 ${FONT};color:${subtle};letter-spacing:.02em">${escapeEmailHtml(input.merchantName ?? input.headerLabel ?? input.category)}</td></tr></table></td></tr>
<tr><td style="background:#ffffff;border:1px solid ${line};border-radius:12px"><div style="height:3px;background:${accent};border-radius:12px 12px 0 0;font-size:0;line-height:0">&nbsp;</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="email-content" style="padding:36px 40px 38px;word-break:break-word;font:15px/1.65 ${FONT};color:${muted}"><div style="font:600 11px/1.5 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:${accent};margin-bottom:12px">${escapeEmailHtml(input.category)}</div>${input.title ? `<h1 class="email-title" style="margin:0;font:400 27px/1.25 Georgia,'Times New Roman',Times,serif;color:${ink};letter-spacing:-.01em">${escapeEmailHtml(input.title)}</h1>` : ''}${input.bodyHtml}</td></tr></table></td></tr>
<tr><td style="padding:14px 4px 0;font:13px/1.6 ${FONT};color:${subtle}">${escapeEmailHtml(input.footer ?? 'İşletmenizin her adımında yanınızdayız. masabu ekibi.').replaceAll('\n', '<br>')}</td></tr>
<tr><td class="email-footer" align="center" style="text-align:center;padding:32px 4px 0;border-top:1px solid ${line};font:12px/1.7 ${FONT};color:${subtle}">masabu · Dijital menü, sipariş ve masa yönetimi<br>${escapeEmailHtml(EMAIL_BRAND.address)}<br>masabu.co<div style="margin-top:10px"><a href="https://masabu.co/iletisim" style="color:${subtle};text-decoration:none">Destek</a>${settingsUrl ? ` &nbsp;·&nbsp; <a href="${settingsUrl}" style="color:${subtle};text-decoration:none">Bildirim ayarları</a>` : ''} &nbsp;·&nbsp; <a href="https://masabu.co/yasal/gizlilik-politikasi" style="color:${subtle};text-decoration:none">Gizlilik</a></div></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`
}

/** Plain-text alternative for our generated HTML, including visible action URLs. */
export function emailHtmlToText(html: string): string {
  return html.replace(/<(head|style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<div style="display:none[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|h[1-6]|tr|table|div)>|<br\s*\/?>|<div\b[^>]*>/gi, '\n\n')
    .replace(/<\/td>/gi, '  ').replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n: string) => { const point = Number(n); return point <= 0x10ffff ? String.fromCodePoint(point) : '' })
    .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
