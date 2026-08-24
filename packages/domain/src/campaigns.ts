import type { CustomerSegment } from './customers'

export type CampaignSegmentKind = 'all' | 'builtin' | 'custom'
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'cancelled'
export type CampaignChannel = 'sms' | 'email'
export type CampaignEmailContentMode = 'plain' | 'template' | 'builder' | 'html'
export type CampaignEmailTemplateId = 'minimal' | 'announcement' | 'offer'
export type CampaignEmailAlignment = 'left' | 'center' | 'right'
export type CampaignEmailFontFamily = 'arial' | 'georgia' | 'trebuchet' | 'courier'

export type CampaignEmailBlock =
  | { id: string; type: 'heading'; text: string; level: 1 | 2; align: CampaignEmailAlignment; color: string }
  | { id: string; type: 'text'; text: string; align: CampaignEmailAlignment; color: string; fontSize: number }
  | { id: string; type: 'image'; src: string; alt: string; href: string; borderRadius: number }
  | { id: string; type: 'button'; label: string; href: string; align: CampaignEmailAlignment; backgroundColor: string; textColor: string; borderRadius: number }
  | { id: string; type: 'divider'; color: string; thickness: number }
  | { id: string; type: 'spacer'; height: number }
  | { id: string; type: 'grid'; columns: 2 | 3; items: Array<{ title: string; text: string; imageUrl: string; href: string }> }

export interface CampaignEmailDesign {
  version: 1
  backgroundColor: string
  contentBackgroundColor: string
  textColor: string
  accentColor: string
  fontFamily: CampaignEmailFontFamily
  maxWidth: number
  borderRadius: number
  blocks: CampaignEmailBlock[]
}

export interface SavedCampaignEmailTemplate {
  id: string
  restaurantId: string
  name: string
  subject: string
  design: CampaignEmailDesign
  createdAt: string
  updatedAt: string
}

export interface CampaignAudienceInput {
  segmentKind?: CampaignSegmentKind
  builtinSegment?: CustomerSegment | null
  customSegmentId?: string | null
}

export interface NormalizedCampaignAudience {
  segmentKind: CampaignSegmentKind
  builtinSegment: CustomerSegment | null
  customSegmentId: string | null
}

export interface CampaignAudiencePreview {
  channel: CampaignChannel
  totalCandidates: number
  eligibleRecipients: number
  skippedNoMarketingConsent: number
  skippedInvalidContact: number
  skippedDuplicateContact: number
  segmentLabel: string
}

export interface CampaignAudienceContactPage {
  contacts: Array<{ customerId: string; name: string | null; email: string }>
  totalEligible: number
  truncated: boolean
}

export type CampaignEmailDeliveryStatus =
  | 'pending'
  | 'processing'
  | 'accepted'
  | 'delivered'
  | 'delayed'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'suppressed'
  | 'failed'

export interface CampaignDeliveryLog {
  campaignId: string
  campaignName: string
  subject: string | null
  recipients: Array<{
    id: string
    customerId: string
    name: string | null
    email: string
    status: CampaignEmailDeliveryStatus
    providerMessageId: string | null
    sentAt: string | null
    lastEventAt: string | null
    openedAt: string | null
    clickedAt: string | null
    error: string | null
  }>
  total: number
  truncated: boolean
}

export interface CampaignSummary {
  id: string
  restaurantId: string
  name: string
  channel: CampaignChannel
  subject: string | null
  messageBody: string
  contentMode: CampaignEmailContentMode
  templateId: CampaignEmailTemplateId | null
  emailDesign: CampaignEmailDesign | null
  segmentKind: CampaignSegmentKind
  builtinSegment: CustomerSegment | null
  customSegmentId: string | null
  status: CampaignStatus
  recipientCount: number
  sentCount: number
  failedCount: number
  skippedCount: number
  sentAt: string | null
  createdAt: string
}

export type SendCampaignResult =
  | { ok: true; campaign: CampaignSummary; preview: CampaignAudiencePreview; replayed: boolean }
  | { ok: false; error: string; preview?: CampaignAudiencePreview }

export const BUILTIN_CUSTOMER_SEGMENTS: readonly CustomerSegment[] = ['new', 'frequent', 'lapsed', 'consented']
export const MAX_CAMPAIGN_SMS_CHARS = 459
export const MAX_CAMPAIGN_EMAIL_CHARS = 5_000
export const MAX_CAMPAIGN_EMAIL_HTML_CHARS = 100_000
export const MAX_CAMPAIGN_EMAIL_SUBJECT_CHARS = 150
export const EMAIL_CAMPAIGN_TEMPLATES: ReadonlyArray<{
  id: CampaignEmailTemplateId
  label: string
  description: string
}> = [
  { id: 'minimal', label: 'Minimal', description: 'Sade, metin odaklı duyurular' },
  { id: 'announcement', label: 'Duyuru', description: 'Markalı başlık ve güçlü içerik alanı' },
  { id: 'offer', label: 'Fırsat', description: 'Kampanya ve geri kazanım mesajları' },
]

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function sanitizeCampaignMessage(value: string, channel: CampaignChannel = 'sms'): string {
  if (channel === 'email') {
    return value.replaceAll('\u0000', '').replace(/\r\n?/g, '\n').trim().slice(0, MAX_CAMPAIGN_EMAIL_CHARS)
  }
  return cleanText(value, MAX_CAMPAIGN_SMS_CHARS)
}

export function normalizeCampaignEmailContent(input: {
  contentMode?: CampaignEmailContentMode | null | undefined
  templateId?: CampaignEmailTemplateId | null | undefined
}): { contentMode: CampaignEmailContentMode; templateId: CampaignEmailTemplateId | null } {
  if (input.contentMode === 'html') return { contentMode: 'html', templateId: null }
  if (input.contentMode === 'builder') return { contentMode: 'builder', templateId: null }
  if (input.contentMode === 'plain') return { contentMode: 'plain', templateId: null }
  const templateId = EMAIL_CAMPAIGN_TEMPLATES.some((template) => template.id === input.templateId)
    ? input.templateId!
    : 'announcement'
  return { contentMode: 'template', templateId }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const SAFE_EMAIL_URL = /^https:\/\/[^\s]+$/i
const FONT_STACKS: Record<CampaignEmailFontFamily, string> = {
  arial: 'Arial,Helvetica,sans-serif',
  georgia: 'Georgia,Times New Roman,serif',
  trebuchet: 'Trebuchet MS,Arial,sans-serif',
  courier: 'Courier New,monospace',
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function boundedText(value: unknown, max: number): string {
  return String(value ?? '').replaceAll('\u0000', '').trim().slice(0, max)
}

function color(value: unknown, fallback: string): string {
  const candidate = String(value ?? '').trim()
  return HEX_COLOR.test(candidate) ? candidate.toLowerCase() : fallback
}

function integer(value: unknown, min: number, max: number, fallback: number): number {
  const candidate = Math.round(Number(value))
  return Number.isFinite(candidate) ? Math.min(max, Math.max(min, candidate)) : fallback
}

function alignment(value: unknown): CampaignEmailAlignment {
  return value === 'center' || value === 'right' ? value : 'left'
}

function safeUrl(value: unknown): string {
  const candidate = boundedText(value, 2_000)
  return SAFE_EMAIL_URL.test(candidate) ? candidate : ''
}

function normalizeCampaignEmailBlock(value: unknown, index: number): CampaignEmailBlock | null {
  const input = record(value)
  const id = boundedText(input['id'], 80).replace(/[^a-z0-9_-]/gi, '') || `block-${index + 1}`
  if (input['type'] === 'heading') return {
    id, type: 'heading', text: boundedText(input['text'], 300), level: input['level'] === 2 ? 2 : 1,
    align: alignment(input['align']), color: color(input['color'], '#171719'),
  }
  if (input['type'] === 'text') return {
    id, type: 'text', text: boundedText(input['text'], 5_000), align: alignment(input['align']),
    color: color(input['color'], '#303238'), fontSize: integer(input['fontSize'], 12, 24, 16),
  }
  if (input['type'] === 'image') return {
    id, type: 'image', src: safeUrl(input['src']), alt: boundedText(input['alt'], 200),
    href: safeUrl(input['href']), borderRadius: integer(input['borderRadius'], 0, 32, 12),
  }
  if (input['type'] === 'button') return {
    id, type: 'button', label: boundedText(input['label'], 120), href: safeUrl(input['href']),
    align: alignment(input['align']), backgroundColor: color(input['backgroundColor'], '#171719'),
    textColor: color(input['textColor'], '#ffffff'), borderRadius: integer(input['borderRadius'], 0, 32, 10),
  }
  if (input['type'] === 'divider') return {
    id, type: 'divider', color: color(input['color'], '#e5e5e7'), thickness: integer(input['thickness'], 1, 8, 1),
  }
  if (input['type'] === 'spacer') return { id, type: 'spacer', height: integer(input['height'], 8, 96, 24) }
  if (input['type'] === 'grid') {
    const items = Array.isArray(input['items']) ? input['items'].slice(0, 3).map((item) => {
      const gridItem = record(item)
      return {
        title: boundedText(gridItem['title'], 160), text: boundedText(gridItem['text'], 600),
        imageUrl: safeUrl(gridItem['imageUrl']), href: safeUrl(gridItem['href']),
      }
    }) : []
    return { id, type: 'grid', columns: input['columns'] === 3 ? 3 : 2, items }
  }
  return null
}

export const DEFAULT_CAMPAIGN_EMAIL_DESIGN: CampaignEmailDesign = {
  version: 1,
  backgroundColor: '#f5f5f4',
  contentBackgroundColor: '#ffffff',
  textColor: '#171719',
  accentColor: '#171719',
  fontFamily: 'arial',
  maxWidth: 640,
  borderRadius: 18,
  blocks: [
    { id: 'welcome-heading', type: 'heading', text: '{{restaurant_name}}', level: 1, align: 'center', color: '#171719' },
    { id: 'welcome-text', type: 'text', text: 'Size özel fırsatlarımızı keşfedin.', align: 'center', color: '#303238', fontSize: 16 },
    { id: 'welcome-button', type: 'button', label: 'Menüyü incele', href: '', align: 'center', backgroundColor: '#171719', textColor: '#ffffff', borderRadius: 10 },
  ],
}

export function normalizeCampaignEmailDesign(value: unknown): CampaignEmailDesign {
  const input = record(value)
  const fontFamily: CampaignEmailFontFamily = ['arial', 'georgia', 'trebuchet', 'courier'].includes(String(input['fontFamily']))
    ? String(input['fontFamily']) as CampaignEmailFontFamily
    : 'arial'
  const blocks = (Array.isArray(input['blocks']) ? input['blocks'] : DEFAULT_CAMPAIGN_EMAIL_DESIGN.blocks)
    .slice(0, 40)
    .map(normalizeCampaignEmailBlock)
    .filter((block): block is CampaignEmailBlock => block !== null)
  return {
    version: 1,
    backgroundColor: color(input['backgroundColor'], DEFAULT_CAMPAIGN_EMAIL_DESIGN.backgroundColor),
    contentBackgroundColor: color(input['contentBackgroundColor'], DEFAULT_CAMPAIGN_EMAIL_DESIGN.contentBackgroundColor),
    textColor: color(input['textColor'], DEFAULT_CAMPAIGN_EMAIL_DESIGN.textColor),
    accentColor: color(input['accentColor'], DEFAULT_CAMPAIGN_EMAIL_DESIGN.accentColor),
    fontFamily,
    maxWidth: integer(input['maxWidth'], 480, 720, DEFAULT_CAMPAIGN_EMAIL_DESIGN.maxWidth),
    borderRadius: integer(input['borderRadius'], 0, 32, DEFAULT_CAMPAIGN_EMAIL_DESIGN.borderRadius),
    blocks,
  }
}

function linkWrap(content: string, href: string): string {
  return href ? `<a href="${escapeEmailHtml(href)}" target="_blank" style="color:inherit;text-decoration:none">${content}</a>` : content
}

export function campaignEmailDesignToPlainText(value: unknown): string {
  const design = normalizeCampaignEmailDesign(value)
  return design.blocks.flatMap((block) => {
    if (block.type === 'heading' || block.type === 'text') return [block.text]
    if (block.type === 'button') return [block.label, block.href]
    if (block.type === 'image') return [block.alt]
    if (block.type === 'grid') return block.items.flatMap((item) => [item.title, item.text])
    return []
  }).filter(Boolean).join('\n\n').slice(0, MAX_CAMPAIGN_EMAIL_CHARS)
}

export function renderCampaignBuilderEmail(input: {
  design: unknown
  restaurantName: string
}): string {
  const design = normalizeCampaignEmailDesign(input.design)
  const restaurantName = escapeEmailHtml(input.restaurantName)
  const replaceName = (value: string) => escapeEmailHtml(value).replaceAll('{{restaurant_name}}', restaurantName)
  const blocks = design.blocks.map((block) => {
    if (block.type === 'heading') {
      const tag = block.level === 2 ? 'h2' : 'h1'
      const size = block.level === 2 ? 24 : 32
      return `<${tag} style="color:${block.color};font-size:${size}px;line-height:1.2;margin:0 0 18px;text-align:${block.align}">${replaceName(block.text)}</${tag}>`
    }
    if (block.type === 'text') return `<p style="color:${block.color};font-size:${block.fontSize}px;line-height:1.65;margin:0 0 18px;text-align:${block.align}">${replaceName(block.text).replaceAll('\n', '<br>')}</p>`
    if (block.type === 'image') {
      if (!block.src) return ''
      const image = `<img src="${escapeEmailHtml(block.src)}" alt="${escapeEmailHtml(block.alt)}" width="100%" style="display:block;width:100%;height:auto;border-radius:${block.borderRadius}px;margin:0 0 20px">`
      return linkWrap(image, block.href)
    }
    if (block.type === 'button') {
      const button = `<span style="background-color:${block.backgroundColor};border-radius:${block.borderRadius}px;color:${block.textColor};display:inline-block;font-size:16px;font-weight:700;padding:13px 22px">${replaceName(block.label)}</span>`
      return `<div style="margin:4px 0 22px;text-align:${block.align}">${linkWrap(button, block.href)}</div>`
    }
    if (block.type === 'divider') return `<hr style="border:0;border-top:${block.thickness}px solid ${block.color};margin:24px 0">`
    if (block.type === 'spacer') return `<div style="height:${block.height}px;line-height:${block.height}px">&nbsp;</div>`
    const width = `${Math.floor(100 / block.columns)}%`
    const cells = block.items.slice(0, block.columns).map((item) => {
      const image = item.imageUrl ? `<img src="${escapeEmailHtml(item.imageUrl)}" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:10px;margin:0 0 12px">` : ''
      const card = `${image}<p style="color:${design.textColor};font-size:16px;font-weight:700;line-height:1.35;margin:0 0 6px">${replaceName(item.title)}</p><p style="color:${design.textColor};font-size:13px;line-height:1.5;margin:0">${replaceName(item.text)}</p>`
      return `<td width="${width}" valign="top" style="padding:8px">${linkWrap(card, item.href)}</td>`
    }).join('')
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 -8px 20px"><tbody><tr>${cells}</tr></tbody></table>`
  }).join('')
  return `<div style="background-color:${design.backgroundColor};padding:28px 12px;font-family:${FONT_STACKS[design.fontFamily]};color:${design.textColor}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${design.maxWidth}px;margin:0 auto;background-color:${design.contentBackgroundColor};border-radius:${design.borderRadius}px"><tbody><tr><td style="padding:32px 28px">${blocks}${campaignComplianceFooterHtml()}</td></tr></tbody></table></div>`
}

function escapeEmailHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function campaignComplianceFooterHtml(): string {
  return '<hr style="border:0;border-top:1px solid #e5e5e7;margin:28px 0 16px"><p style="color:#62656d;font-size:12px;line-height:1.5;margin:0">Bu e-posta, pazarlama iletişimine izin verdiğiniz işletme tarafından Masabu üzerinden gönderildi. Pazarlama izninizi Masabu hesabınızdaki izinler bölümünden kapatabilirsiniz.</p>'
}

export function renderCampaignTemplateEmail(input: {
  templateId: CampaignEmailTemplateId | null
  content: string
  restaurantName: string
}): string {
  const restaurantName = escapeEmailHtml(input.restaurantName)
  const content = input.content
    .split(/\n{2,}/)
    .map((part) => `<p style="margin:0 0 16px">${escapeEmailHtml(part).replaceAll('\n', '<br>')}</p>`)
    .join('')
  const footer = campaignComplianceFooterHtml()
  if (!input.templateId || input.templateId === 'minimal') {
    return `<div style="font-family:Arial,sans-serif;color:#171719;font-size:16px;line-height:1.6;max-width:640px;margin:auto"><p style="font-weight:700;margin:0 0 24px">${restaurantName}</p>${content}${footer}</div>`
  }
  if (input.templateId === 'offer') {
    return `<div style="background-color:#f5f5f4;padding:28px 12px;font-family:Arial,sans-serif;color:#171719"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:18px"><tbody><tr><td style="background-color:#171719;color:#ffffff;padding:28px;text-align:center;border-radius:18px 18px 0 0"><p style="font-size:13px;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px">Size özel</p><h1 style="font-size:28px;line-height:1.2;margin:0">${restaurantName}</h1></td></tr><tr><td style="padding:32px 28px;font-size:16px;line-height:1.6">${content}${footer}</td></tr></tbody></table></div>`
  }
  return `<div style="background-color:#f5f5f4;padding:28px 12px;font-family:Arial,sans-serif;color:#171719"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:18px"><tbody><tr><td style="padding:30px 28px 20px;border-bottom:1px solid #e5e5e7"><p style="color:#62656d;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px">Duyuru</p><h1 style="font-size:26px;line-height:1.2;margin:0">${restaurantName}</h1></td></tr><tr><td style="padding:28px;font-size:16px;line-height:1.6">${content}${footer}</td></tr></tbody></table></div>`
}

export function sanitizeCampaignSubject(value: string): string {
  return cleanText(value, MAX_CAMPAIGN_EMAIL_SUBJECT_CHARS)
}

export function sanitizeCampaignName(value: string, now = new Date(), channel: CampaignChannel = 'sms'): string {
  const cleaned = cleanText(value, 80)
  if (cleaned) return cleaned
  return `${channel === 'email' ? 'E-posta' : 'SMS'} ${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function normalizeCampaignAudience(input: CampaignAudienceInput = {}): NormalizedCampaignAudience {
  if (input.segmentKind === 'builtin' && input.builtinSegment && BUILTIN_CUSTOMER_SEGMENTS.includes(input.builtinSegment)) {
    return { segmentKind: 'builtin', builtinSegment: input.builtinSegment, customSegmentId: null }
  }
  if (input.segmentKind === 'custom' && input.customSegmentId) {
    return { segmentKind: 'custom', builtinSegment: null, customSegmentId: input.customSegmentId }
  }
  return { segmentKind: 'all', builtinSegment: null, customSegmentId: null }
}
