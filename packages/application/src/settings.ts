import { type DashboardActorContext, type Result } from '@garsonless/domain'
import { authorizeDashboardFeatureRead } from './dashboard-feature-read-models'

/**
 * Settings page read contract. The application layer decides whether owner-only
 * data is requested; the DB adapter only performs the resulting projections.
 */
export interface DashboardSettingsReadModel<TStation, TTeamMember, TSecurityEvent> {
  hasKitchenAccess: boolean
  kitchenStations: TStation[]
  teamMembers: TTeamMember[]
  securityEvents: TSecurityEvent[]
}

export interface DashboardSettingsReadModelPort<TStation, TTeamMember, TSecurityEvent> {
  readSettings(input: {
    restaurantId: string
    userId: string
    includeOwnerData: boolean
    operation: 'settings.snapshot'
  }): Promise<Result<DashboardSettingsReadModel<TStation, TTeamMember, TSecurityEvent>>>
}

export async function readDashboardSettings<TStation, TTeamMember, TSecurityEvent>(
  context: DashboardActorContext,
  restaurantId: string,
  port: DashboardSettingsReadModelPort<TStation, TTeamMember, TSecurityEvent>,
): Promise<Result<DashboardSettingsReadModel<TStation, TTeamMember, TSecurityEvent>>> {
  const access = authorizeDashboardFeatureRead(context, restaurantId, 'settings.snapshot')
  return access.ok
    ? port.readSettings({
      restaurantId,
      userId: context.userId,
      includeOwnerData: context.isOwner === true,
      operation: 'settings.snapshot',
    })
    : access
}
