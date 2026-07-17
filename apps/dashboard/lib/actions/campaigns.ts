'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertAccess } from '../auth/access'
import {
  previewCustomerCampaign,
  sendCustomerCampaign,
  sendCustomerCampaignTest,
} from '@garsonless/application/campaigns'
import { createCampaignApplicationPort } from '@garsonless/db/server'
import type {
  CampaignAudienceInput,
  CampaignAudiencePreview,
  CampaignSummary,
} from '@garsonless/domain/campaigns'
import type { CustomerSegment } from '@garsonless/domain/customers'

// Phase 3: campaigns live in the Customers CRM → owner OR a member with 'customers'.
async function assertOwner(restaurantId: string): Promise<{ userId: string } | { error: string }> {
  return assertAccess(restaurantId, 'customers')
}

function campaignActor(restaurantId: string, userId: string) {
  return {
    actor: 'dashboard-member' as const,
    restaurantId,
    userId,
    permissions: ['customers'],
  }
}

const builtInSegments = ['new', 'frequent', 'lapsed', 'consented'] as const
const audienceSchema = z.discriminatedUnion('segmentKind', [
  z.object({ segmentKind: z.literal('all') }),
  z.object({ segmentKind: z.literal('builtin'), builtinSegment: z.enum(builtInSegments) }),
  z.object({ segmentKind: z.literal('custom'), customSegmentId: z.string().uuid() }),
])
const messageSchema = z.string().trim().min(5).max(459)
const campaignSchema = z.object({
  name: z.string().trim().min(1).max(80),
  message: messageSchema,
  audience: audienceSchema,
})
const testSchema = z.object({
  phone: z.string().trim().min(8).max(32),
  message: messageSchema,
})

function normalizeAudience(input: unknown): CampaignAudienceInput | null {
  const parsed = audienceSchema.safeParse(input)
  if (!parsed.success) return null
  if (parsed.data.segmentKind === 'builtin') {
    return { segmentKind: 'builtin', builtinSegment: parsed.data.builtinSegment as CustomerSegment }
  }
  if (parsed.data.segmentKind === 'custom') {
    return { segmentKind: 'custom', customSegmentId: parsed.data.customSegmentId }
  }
  return { segmentKind: 'all' }
}

export async function previewCampaignAudienceAction(
  restaurantId: string,
  input: unknown,
): Promise<{ error: string } | CampaignAudiencePreview> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const audience = normalizeAudience(input)
  if (!audience) return { error: 'Hedef segment geçersiz' }
  const result = await previewCustomerCampaign(
    campaignActor(restaurantId, gate.userId),
    { restaurantId, audience },
    createCampaignApplicationPort(),
  )
  return result.ok ? result.value : { error: result.error }
}

export async function sendCampaignTestAction(
  restaurantId: string,
  input: { phone: string; message: string },
): Promise<{ error: string } | { success: true; messageId?: string }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const parsed = testSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Test SMS geçersiz' }
  const res = await sendCustomerCampaignTest(campaignActor(restaurantId, gate.userId), {
    restaurantId,
    phone: parsed.data.phone,
    message: parsed.data.message,
  }, createCampaignApplicationPort())
  if (!res.ok) return { error: res.error }
  return { success: true, ...(res.value.messageId ? { messageId: res.value.messageId } : {}) }
}

export async function sendCampaignAction(
  restaurantId: string,
  input: { name: string; message: string; audience: unknown },
): Promise<{ error: string; preview?: CampaignAudiencePreview } | { success: true; campaign: CampaignSummary; preview: CampaignAudiencePreview }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const parsed = campaignSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Kampanya geçersiz' }
  const audience = normalizeAudience(parsed.data.audience)
  if (!audience) return { error: 'Hedef segment geçersiz' }
  const res = await sendCustomerCampaign(campaignActor(restaurantId, gate.userId), {
    restaurantId,
    name: parsed.data.name,
    message: parsed.data.message,
    audience,
  }, createCampaignApplicationPort())
  if (!res.ok) return { error: res.error, ...(res.preview ? { preview: res.preview } : {}) }
  revalidatePath(`/dashboard/${restaurantId}/customers`)
  return { success: true, campaign: res.campaign, preview: res.preview }
}
