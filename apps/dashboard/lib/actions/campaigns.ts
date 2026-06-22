'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createDashboardServerClient } from '../supabase-server'
import {
  listCampaigns,
  previewCampaignAudience,
  sendCampaign,
  sendCampaignTest,
  type CampaignAudienceInput,
  type CampaignAudiencePreview,
  type CampaignSummary,
  type CustomerSegment,
} from '@garsonless/db'

async function assertOwner(restaurantId: string): Promise<{ userId: string } | { error: string }> {
  const supabase = await createDashboardServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!data) return { error: 'Not authorized' }
  return { userId: user.id }
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

export async function listCampaignsAction(
  restaurantId: string,
): Promise<{ error: string } | CampaignSummary[]> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  try {
    return await listCampaigns(restaurantId)
  } catch {
    return { error: 'Kampanyalar yüklenemedi' }
  }
}

export async function previewCampaignAudienceAction(
  restaurantId: string,
  input: unknown,
): Promise<{ error: string } | CampaignAudiencePreview> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const audience = normalizeAudience(input)
  if (!audience) return { error: 'Hedef segment geçersiz' }
  try {
    return await previewCampaignAudience(restaurantId, audience)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Alıcı sayısı hesaplanamadı' }
  }
}

export async function sendCampaignTestAction(
  restaurantId: string,
  input: { phone: string; message: string },
): Promise<{ error: string } | { success: true; messageId?: string }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const parsed = testSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Test SMS geçersiz' }
  const res = await sendCampaignTest({
    restaurantId,
    phone: parsed.data.phone,
    message: parsed.data.message,
    createdBy: gate.userId,
  })
  if (!res.ok) return { error: res.error }
  return { success: true, ...(res.messageId ? { messageId: res.messageId } : {}) }
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
  const res = await sendCampaign({
    restaurantId,
    name: parsed.data.name,
    message: parsed.data.message,
    audience,
    createdBy: gate.userId,
  })
  if (!res.ok) return { error: res.error, ...(res.preview ? { preview: res.preview } : {}) }
  revalidatePath(`/dashboard/${restaurantId}/customers`)
  return { success: true, campaign: res.campaign, preview: res.preview }
}
