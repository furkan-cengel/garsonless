import type { CustomerSegment } from './customers'

export type CampaignSegmentKind = 'all' | 'builtin' | 'custom'
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed' | 'cancelled'

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
  totalCandidates: number
  eligibleRecipients: number
  skippedNoMarketingConsent: number
  skippedInvalidPhone: number
  skippedDuplicatePhone: number
  segmentLabel: string
}

export interface CampaignSummary {
  id: string
  restaurantId: string
  name: string
  messageBody: string
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

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

export function sanitizeCampaignMessage(value: string): string {
  return cleanText(value, MAX_CAMPAIGN_SMS_CHARS)
}

export function sanitizeCampaignName(value: string, now = new Date()): string {
  const cleaned = cleanText(value, 80)
  if (cleaned) return cleaned
  return `SMS ${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}`
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
