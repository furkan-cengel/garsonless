export const PLATFORM_ADMIN_ROLES = ['support', 'ops', 'finance', 'superadmin'] as const
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number]

export const PLATFORM_ADMIN_CAPABILITIES = [
  'tenants.read',
  'impersonation.read',
  'tenant.lifecycle.manage',
  'entitlements.override',
  'billing.manage',
  'catalog.manage',
  'data.manage',
] as const
export type PlatformAdminCapability = (typeof PLATFORM_ADMIN_CAPABILITIES)[number]

export type PlatformAdminActorContext = {
  actor: 'platform-admin'
  userId: string
  role: PlatformAdminRole
  /** Platform admin requests are valid only after a verified second factor. */
  aal: 'aal2'
}

/**
 * Operational access is deliberately independent from billing state. A tenant
 * can be placed on manual hold while an invoice is paid, and a billing retry
 * must never silently clear a platform safety hold.
 */
export const TENANT_SERVICE_STATUSES = ['active', 'suspended', 'manual_hold'] as const
export type TenantServiceStatus = (typeof TENANT_SERVICE_STATUSES)[number]

export function isTenantServiceStatus(value: unknown): value is TenantServiceStatus {
  return TENANT_SERVICE_STATUSES.includes(value as TenantServiceStatus)
}

const ROLE_CAPABILITIES: Readonly<Record<PlatformAdminRole, readonly PlatformAdminCapability[]>> = {
  support: ['tenants.read', 'impersonation.read'],
  ops: ['tenants.read', 'impersonation.read', 'tenant.lifecycle.manage', 'entitlements.override'],
  finance: ['tenants.read', 'billing.manage'],
  superadmin: PLATFORM_ADMIN_CAPABILITIES,
}

export function isPlatformAdminRole(value: unknown): value is PlatformAdminRole {
  return PLATFORM_ADMIN_ROLES.includes(value as PlatformAdminRole)
}

export function platformAdminCapabilities(role: PlatformAdminRole): readonly PlatformAdminCapability[] {
  return ROLE_CAPABILITIES[role]
}

export function platformAdminCan(
  actor: PlatformAdminActorContext,
  capability: PlatformAdminCapability,
): boolean {
  return actor.aal === 'aal2' && ROLE_CAPABILITIES[actor.role].includes(capability)
}
