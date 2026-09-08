import { emailHtmlToText, escapeEmailHtml, renderBrandEmail } from '@garsonless/domain/email-brand'
import sanitizeHtml from 'sanitize-html'
import type {
  CampaignEmailContentMode,
  CampaignEmailDesign,
  CampaignEmailTemplateId,
} from '@garsonless/domain/campaigns'
import {
  campaignComplianceFooterHtml,
  renderCampaignBuilderEmail,
  renderCampaignTemplateEmail,
} from '@garsonless/domain/campaigns'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type CampaignEmailIdentity = {
  senderName: string
  replyTo: string | null
}

export class CampaignEmailDeliveryUnavailableError extends Error {
  constructor(message = 'E-posta gönderimi yapılandırılmadı') {
    super(message)
    this.name = 'CampaignEmailDeliveryUnavailableError'
  }
}

export function getCampaignEmailDeliveryAvailability(): { enabled: boolean } {
  return {
    enabled: Boolean(
      process.env['RESEND_API_KEY']
      && configuredSenderMailbox(process.env['RESEND_FROM_EMAIL']),
    ),
  }
}

export function normalizeCampaignEmail(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('en-US')
  if (normalized.length < 3 || normalized.length > 320) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null
  return normalized
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeSenderName(value: string | null | undefined): string {
  const printable = Array.from(String(value ?? ''))
    .map((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character)
    .join('')
  return printable
    .replace(/[<>"\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

function configuredSenderMailbox(value: string | null | undefined): string | null {
  const configured = String(value ?? '').trim()
  const bracketed = configured.match(/<([^<>]+)>\s*$/)?.[1]
  return normalizeCampaignEmail(bracketed ?? configured)
}

export function campaignSenderAddress(
  configuredFrom: string,
  senderName: string | null | undefined,
): string {
  const mailbox = configuredSenderMailbox(configuredFrom)
  if (!mailbox) throw new CampaignEmailDeliveryUnavailableError()
  const normalizedName = normalizeSenderName(senderName)
  return normalizedName ? `${normalizedName} <${mailbox}>` : mailbox
}

export function readCampaignEmailIdentity(
  restaurantName: string,
  settings: unknown,
): CampaignEmailIdentity {
  const contact = record(record(settings)['contact'])
  return {
    senderName: normalizeSenderName(restaurantName) || 'masabu işletmesi',
    replyTo: normalizeCampaignEmail(typeof contact['email'] === 'string' ? contact['email'] : null),
  }
}

const safeStyleValue = /^(?!.*(?:url\s*\(|expression\s*\(|javascript:|data:))[-#(),.%\w\s'"/]+$/i
const allowedStyleProperties = [
  'background-color', 'border', 'border-bottom', 'border-color', 'border-radius',
  'border-style', 'border-width', 'color', 'display', 'font-family', 'font-size',
  'font-style', 'font-weight', 'height', 'letter-spacing', 'line-height', 'margin',
  'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'max-width',
  'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top',
  'text-align', 'text-decoration', 'text-transform', 'vertical-align', 'white-space',
  'width',
] as const

export function sanitizeCampaignHtml(value: string): string {
  const allowedStyles = Object.fromEntries(
    allowedStyleProperties.map((property) => [property, [safeStyleValue]]),
  )
  return sanitizeHtml(value.slice(0, 100_000), {
    allowedTags: [
      'a', 'b', 'blockquote', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'hr', 'i',
      'img', 'li', 'ol', 'p', 'span', 'strong', 'table', 'tbody', 'td', 'th',
      'thead', 'tr', 'u', 'ul',
    ],
    allowedAttributes: {
      '*': ['align', 'style'],
      a: ['href', 'target', 'title'],
      img: ['alt', 'height', 'src', 'title', 'width'],
      table: ['cellpadding', 'cellspacing', 'role', 'width'],
      td: ['colspan', 'height', 'rowspan', 'valign', 'width'],
      th: ['colspan', 'height', 'rowspan', 'valign', 'width'],
    },
    allowedStyles: { '*': allowedStyles },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https'], a: ['http', 'https', 'mailto'] },
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
      }),
    },
  }).trim()
}

function campaignFooter(): string {
  return campaignComplianceFooterHtml()
}

export function renderCampaignEmail(input: {
  contentMode: CampaignEmailContentMode
  templateId: CampaignEmailTemplateId | null
  content: string
  restaurantName: string
  emailDesign?: CampaignEmailDesign | null
}): string {
  if (input.contentMode === 'html') {
    const personalized = input.content.replaceAll('{{restaurant_name}}', escapeEmailHtml(input.restaurantName))
    const customHtml = sanitizeCampaignHtml(personalized)
    if (customHtml.length < 5) throw new Error('invalid_campaign_html')
    return renderBrandEmail({ merchantName: input.restaurantName, category: 'İşletmenizden', preheader: `${input.restaurantName} işletmesinden bir mesajınız var.`, bodyHtml: customHtml + campaignFooter(), footer: `${input.restaurantName} · Sizi yeniden ağırlamaktan mutluluk duyarız.` })
  }
  if (input.contentMode === 'builder') {
    return renderCampaignBuilderEmail({
      design: input.emailDesign,
      restaurantName: input.restaurantName,
    })
  }
  return renderCampaignTemplateEmail({
    templateId: input.contentMode === 'plain' ? null : input.templateId,
    content: input.content,
    restaurantName: input.restaurantName,
  })
}

export function campaignMessageHtml(message: string): string {
  return renderCampaignEmail({
    contentMode: 'plain',
    templateId: null,
    content: message,
    restaurantName: 'masabu işletmesi',
  })
}

export async function sendCampaignEmail(input: {
  to: string
  subject: string
  message: string
  html?: string
  senderName: string
  replyTo?: string | null
}): Promise<{ provider: 'resend'; messageId?: string }> {
  const apiKey = process.env['RESEND_API_KEY']
  const from = process.env['RESEND_FROM_EMAIL']
  const to = normalizeCampaignEmail(input.to)
  if (!apiKey || !from) throw new CampaignEmailDeliveryUnavailableError()
  if (!to) throw new Error('invalid_recipient')
  const replyTo = normalizeCampaignEmail(input.replyTo)

  const html = input.html ?? campaignMessageHtml(input.message)
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: campaignSenderAddress(from, input.senderName),
      to: [to],
      subject: input.subject,
      html,
      text: emailHtmlToText(html),
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  })
  const payload = await response.json().catch(() => ({})) as { id?: string }
  if (!response.ok) throw new Error('provider_rejected')
  return { provider: 'resend', ...(payload.id ? { messageId: payload.id } : {}) }
}
