'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { assertOwner, assertRestaurantFeature } from '../auth/access'
import { getRestaurantById } from '../queries/restaurants'
import {
  previewCustomerCampaign,
  sendCustomerCampaign,
  sendCustomerCampaignTest,
} from '@garsonless/application/campaigns'
import {
  createCampaignApplicationPort,
  deleteCampaignEmailTemplate,
  getCampaignDeliveryLog,
  listCampaignAudienceContacts,
  listCampaignEmailTemplates,
  renderCampaignEmail,
  saveCampaignEmailTemplate,
} from '@garsonless/db/server'
import type {
  CampaignAudienceInput,
  CampaignAudienceContactPage,
  CampaignAudiencePreview,
  CampaignDeliveryLog,
  CampaignEmailContentMode,
  CampaignEmailDesign,
  CampaignEmailTemplateId,
  CampaignSummary,
  SavedCampaignEmailTemplate,
} from '@garsonless/domain/campaigns'
import type { CustomerSegment } from '@garsonless/domain/customers'

function campaignActor(restaurantId: string, userId: string) {
  return {
    actor: 'dashboard-member' as const,
    restaurantId,
    userId,
    permissions: ['customers'],
    isOwner: true,
  }
}

const builtInSegments = ['new', 'frequent', 'lapsed', 'consented'] as const
const audienceSchema = z.discriminatedUnion('segmentKind', [
  z.object({ segmentKind: z.literal('all') }),
  z.object({ segmentKind: z.literal('builtin'), builtinSegment: z.enum(builtInSegments) }),
  z.object({ segmentKind: z.literal('custom'), customSegmentId: z.string().uuid() }),
])
const messageSchema = z.string().trim().min(5).max(5_000)
const subjectSchema = z.string().trim().min(1).max(150)
const campaignSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  subject: subjectSchema,
  message: z.string().trim().min(5).max(100_000),
  contentMode: z.enum(['template', 'builder', 'html']),
  templateId: z.enum(['minimal', 'announcement', 'offer']).nullable(),
  emailDesign: z.unknown().nullable().optional(),
  audience: audienceSchema,
}).superRefine((value, context) => {
  if (value.contentMode === 'template' && !value.templateId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['templateId'], message: 'E-posta şablonu seçin' })
  }
  if (value.contentMode === 'html' && value.templateId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['templateId'], message: 'HTML modunda hazır şablon kullanılamaz' })
  }
  if (value.contentMode === 'builder' && value.templateId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['templateId'], message: 'Blok tasarımda hazır şablon kullanılamaz' })
  }
  if (value.contentMode === 'builder' && JSON.stringify(value.emailDesign ?? {}).length > 100_000) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['emailDesign'], message: 'E-posta tasarımı çok büyük' })
  }
})
const testSchema = z.object({
  phone: z.string().trim().min(8).max(32),
  message: messageSchema,
})
const emailPreviewSchema = z.object({
  contentMode: z.enum(['template', 'builder', 'html']),
  templateId: z.enum(['minimal', 'announcement', 'offer']).nullable(),
  content: z.string().min(5).max(100_000),
  emailDesign: z.unknown().nullable().optional(),
})
const savedEmailTemplateSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  subject: z.string().trim().max(150),
  design: z.unknown(),
}).superRefine((value, context) => {
  if (JSON.stringify(value.design).length > 100_000) context.addIssue({ code: z.ZodIssueCode.custom, path: ['design'], message: 'E-posta tasarımı çok büyük' })
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
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
  const audience = normalizeAudience(input)
  if (!audience) return { error: 'Hedef segment geçersiz' }
  const result = await previewCustomerCampaign(
    campaignActor(restaurantId, gate.userId),
    { restaurantId, channel: 'email', audience },
    createCampaignApplicationPort(),
  )
  return result.ok ? result.value : { error: result.error }
}

export async function listCampaignAudienceContactsAction(
  restaurantId: string,
  input: unknown,
): Promise<{ error: string } | CampaignAudienceContactPage> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
  const audience = normalizeAudience(input)
  if (!audience) return { error: 'Hedef segment geçersiz' }
  try {
    return await listCampaignAudienceContacts(restaurantId, audience)
  } catch {
    return { error: 'Alıcı e-postaları yüklenemedi' }
  }
}

export async function getCampaignDeliveryLogAction(
  restaurantId: string,
  campaignId: string,
): Promise<{ error: string } | CampaignDeliveryLog> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
  if (!z.string().uuid().safeParse(campaignId).success) return { error: 'Kampanya geçersiz' }
  try {
    const log = await getCampaignDeliveryLog(restaurantId, campaignId)
    return log ?? { error: 'Kampanya bulunamadı' }
  } catch {
    return { error: 'Gönderim günlüğü yüklenemedi' }
  }
}

export async function listCampaignEmailTemplatesAction(
  restaurantId: string,
): Promise<{ error: string } | SavedCampaignEmailTemplate[]> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
  try {
    return await listCampaignEmailTemplates(restaurantId)
  } catch {
    return { error: 'Kayıtlı e-posta şablonları yüklenemedi' }
  }
}

export async function saveCampaignEmailTemplateAction(
  restaurantId: string,
  input: unknown,
): Promise<{ error: string } | { template: SavedCampaignEmailTemplate }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
  const parsed = savedEmailTemplateSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Şablon geçersiz' }
  try {
    const template = await saveCampaignEmailTemplate({
      id: parsed.data.id,
      restaurantId,
      name: parsed.data.name,
      subject: parsed.data.subject,
      design: parsed.data.design as CampaignEmailDesign,
      createdBy: gate.userId,
    })
    revalidatePath(`/dashboard/${restaurantId}/customers`)
    return { template }
  } catch {
    return { error: 'Şablon kaydedilemedi. Aynı adla başka bir şablon olabilir.' }
  }
}

export async function deleteCampaignEmailTemplateAction(
  restaurantId: string,
  templateId: string,
): Promise<{ error: string } | { success: true }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
  if (!z.string().uuid().safeParse(templateId).success) return { error: 'Şablon geçersiz' }
  try {
    if (!await deleteCampaignEmailTemplate(restaurantId, templateId)) return { error: 'Şablon bulunamadı' }
    revalidatePath(`/dashboard/${restaurantId}/customers`)
    return { success: true }
  } catch {
    return { error: 'Şablon silinemedi' }
  }
}

export async function previewCampaignEmailAction(
  restaurantId: string,
  input: unknown,
): Promise<{ error: string } | { html: string }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
  const parsed = emailPreviewSchema.safeParse(input)
  if (!parsed.success) return { error: 'E-posta tasarımı geçersiz' }
  if (parsed.data.contentMode === 'template' && !parsed.data.templateId) return { error: 'E-posta şablonu seçin' }
  if (parsed.data.contentMode !== 'template' && parsed.data.templateId) return { error: 'Bu tasarım modunda hazır şablon kullanılamaz' }
  if (JSON.stringify(parsed.data.emailDesign ?? {}).length > 100_000) return { error: 'E-posta tasarımı çok büyük' }
  const restaurant = await getRestaurantById(restaurantId)
  if (!restaurant) return { error: 'İşletme bulunamadı' }
  try {
    return {
      html: renderCampaignEmail({
        contentMode: parsed.data.contentMode,
        templateId: parsed.data.templateId,
        content: parsed.data.content,
        restaurantName: restaurant.name,
        emailDesign: parsed.data.emailDesign as CampaignEmailDesign | null | undefined,
      }),
    }
  } catch {
    return { error: 'HTML içeriği güvenli bir e-posta oluşturmadı' }
  }
}

export async function sendCampaignTestAction(
  restaurantId: string,
  input: { phone: string; message: string },
): Promise<{ error: string } | { success: true; messageId?: string }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
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
  input: {
    requestId: string
    name: string
    subject: string
    message: string
    contentMode: CampaignEmailContentMode
    templateId: CampaignEmailTemplateId | null
    emailDesign: CampaignEmailDesign | null
    audience: unknown
  },
): Promise<{ error: string; preview?: CampaignAudiencePreview } | { success: true; campaign: CampaignSummary; preview: CampaignAudiencePreview; replayed: boolean }> {
  const gate = await assertOwner(restaurantId)
  if ('error' in gate) return gate
  const planGate = await assertRestaurantFeature(restaurantId, 'campaigns')
  if ('error' in planGate) return planGate
  const parsed = campaignSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Kampanya geçersiz' }
  const audience = normalizeAudience(parsed.data.audience)
  if (!audience) return { error: 'Hedef segment geçersiz' }
  const res = await sendCustomerCampaign(campaignActor(restaurantId, gate.userId), {
    restaurantId,
    requestId: parsed.data.requestId,
    channel: 'email',
    name: parsed.data.name,
    subject: parsed.data.subject,
    message: parsed.data.message,
    contentMode: parsed.data.contentMode,
    templateId: parsed.data.templateId,
    emailDesign: parsed.data.emailDesign as CampaignEmailDesign | null | undefined,
    audience,
  }, createCampaignApplicationPort())
  if (!res.ok) return { error: res.error, ...(res.preview ? { preview: res.preview } : {}) }
  revalidatePath(`/dashboard/${restaurantId}/customers`)
  return { success: true, campaign: res.campaign, preview: res.preview, replayed: res.replayed }
}
