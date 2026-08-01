import {
  err,
  hasSameRestaurant,
  normalizeCampaignAudience,
  sanitizeCampaignMessage,
  sanitizeCampaignName,
  type CampaignAudienceInput,
  type CampaignAudiencePreview,
  type CampaignSummary,
  type DashboardActorContext,
  type Result,
  type SendCampaignResult,
} from '@garsonless/domain'

export interface CampaignApplicationPort {
  list(input: { restaurantId: string; limit: number }): Promise<Result<CampaignSummary[]>>
  preview(input: {
    restaurantId: string
    audience: CampaignAudienceInput
  }): Promise<Result<CampaignAudiencePreview>>
  sendTest(input: {
    restaurantId: string
    phone: string
    message: string
    createdBy: string
  }): Promise<Result<{ messageId?: string }>>
  send(input: {
    restaurantId: string
    requestId: string
    name: string
    message: string
    audience: CampaignAudienceInput
    createdBy: string
  }): Promise<SendCampaignResult>
}

function requireCampaignAccess(context: DashboardActorContext, restaurantId: string): Result<true> {
  // SMS delivery exposes recipient contact data and incurs an external cost.
  // CRM members may manage segments, but campaigns stay a restaurant-owner
  // capability until there is a separately auditable marketing role.
  return hasSameRestaurant(context, restaurantId) && context.isOwner === true
    ? { ok: true, value: true }
    : err('Not authorized')
}

export async function readCampaigns(
  context: DashboardActorContext,
  input: { restaurantId: string; limit?: number },
  port: CampaignApplicationPort,
): Promise<Result<CampaignSummary[]>> {
  const access = requireCampaignAccess(context, input.restaurantId)
  if (!access.ok) return access
  return port.list({
    restaurantId: input.restaurantId,
    limit: Math.min(50, Math.max(1, Math.floor(input.limit ?? 12))),
  })
}

export async function previewCustomerCampaign(
  context: DashboardActorContext,
  input: { restaurantId: string; audience: CampaignAudienceInput },
  port: CampaignApplicationPort,
): Promise<Result<CampaignAudiencePreview>> {
  const access = requireCampaignAccess(context, input.restaurantId)
  if (!access.ok) return access
  return port.preview({
    restaurantId: input.restaurantId,
    audience: normalizeCampaignAudience(input.audience),
  })
}

export async function sendCustomerCampaignTest(
  context: DashboardActorContext,
  input: { restaurantId: string; phone: string; message: string },
  port: CampaignApplicationPort,
): Promise<Result<{ messageId?: string }>> {
  const access = requireCampaignAccess(context, input.restaurantId)
  if (!access.ok) return access
  const message = sanitizeCampaignMessage(input.message)
  if (message.length < 5) return err('Mesaj çok kısa')
  return port.sendTest({
    restaurantId: input.restaurantId,
    phone: input.phone.trim(),
    message,
    createdBy: context.userId,
  })
}

export async function sendCustomerCampaign(
  context: DashboardActorContext,
  input: {
    restaurantId: string
    requestId: string
    name: string
    message: string
    audience: CampaignAudienceInput
  },
  port: CampaignApplicationPort,
): Promise<SendCampaignResult> {
  const access = requireCampaignAccess(context, input.restaurantId)
  if (!access.ok) return { ok: false, error: access.error }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) {
    return { ok: false, error: 'Geçersiz istek kimliği' }
  }
  const message = sanitizeCampaignMessage(input.message)
  if (message.length < 5) return { ok: false, error: 'Mesaj çok kısa' }
  return port.send({
    restaurantId: input.restaurantId,
    requestId: input.requestId,
    name: sanitizeCampaignName(input.name),
    message,
    audience: normalizeCampaignAudience(input.audience),
    createdBy: context.userId,
  })
}
