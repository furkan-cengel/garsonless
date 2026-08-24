import { type DashboardActorContext, type Result } from '@garsonless/domain'
import { authorizeDashboardFeatureRead } from './dashboard-feature-read-models'

/**
 * Settings page read contract. The application layer decides whether owner-only
 * data is requested; the DB adapter only performs the resulting projections.
 */
export interface DashboardSettingsReadModel<TStation, TTeamMember, TSecurityEvent, TTeamAuditEvent> {
  hasKitchenAccess: boolean
  kitchenStations: TStation[]
  teamMembers: TTeamMember[]
  /** Owner-visible, restaurant-scoped history of team administration. */
  teamAuditEvents: TTeamAuditEvent[]
  securityEvents: TSecurityEvent[]
}

export interface DashboardSettingsReadModelPort<TStation, TTeamMember, TSecurityEvent, TTeamAuditEvent> {
  readSettings(input: {
    restaurantId: string
    userId: string
    includeOwnerData: boolean
    scopes: DashboardSettingsReadScope[]
    operation: 'settings.snapshot'
  }): Promise<Result<DashboardSettingsReadModel<TStation, TTeamMember, TSecurityEvent, TTeamAuditEvent>>>
}

export type DashboardSettingsReadScope = 'team' | 'kitchen' | 'security'

export type SettingsSectionSnapshot<TValue = unknown> = {
  section: string
  revision: number
  value: TValue
}

export type SettingsSectionMutation<TValue = unknown> = {
  section: string
  expectedRevision: number
  requestId: string
  value: TValue
}

export type SettingsConflict<TValue = unknown> = {
  section: string
  serverRevision: number
  canonicalValue: TValue
  draftValue: TValue
}

export type IntegrationHealth = {
  provider: 'iyzico' | 'resend'
  mode: 'platform' | 'sandbox' | 'live'
  state: 'unconfigured' | 'untested' | 'healthy' | 'error'
  lastCheckedAt: string | null
  lastSuccessAt: string | null
  errorCode: string | null
}

export type TenantPrivacyOperationType = 'export' | 'account_deletion_request' | 'restaurant_deletion_request'

export type TenantPrivacyOperation = {
  id: string
  operationType: TenantPrivacyOperationType
  status: 'requested' | 'processing' | 'ready' | 'completed' | 'rejected'
  duplicate: boolean
}

export type SensitiveActionIntent = {
  action: 'member_remove' | 'subscription_cancel' | 'kitchen_credential_rotate' | 'privacy_request'
  target: string
  requestId: string
}

export async function readDashboardSettings<TStation, TTeamMember, TSecurityEvent, TTeamAuditEvent>(
  context: DashboardActorContext,
  restaurantId: string,
  port: DashboardSettingsReadModelPort<TStation, TTeamMember, TSecurityEvent, TTeamAuditEvent>,
  scopes: DashboardSettingsReadScope[] = ['team', 'kitchen', 'security'],
): Promise<Result<DashboardSettingsReadModel<TStation, TTeamMember, TSecurityEvent, TTeamAuditEvent>>> {
  const access = authorizeDashboardFeatureRead(context, restaurantId, 'settings.snapshot')
  return access.ok
    ? port.readSettings({
      restaurantId,
      userId: context.userId,
      includeOwnerData: context.isOwner === true,
      scopes,
      operation: 'settings.snapshot',
    })
    : access
}
