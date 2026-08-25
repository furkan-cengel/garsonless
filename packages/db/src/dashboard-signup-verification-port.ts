import { createServiceClient } from './service-client'

const REQUIRED_KEY = 'dashboard_signup_email_verification_required'
const VERIFIED_AT_KEY = 'dashboard_signup_email_verified_at'

async function updateSignupVerificationMetadata(
  userId: string,
  values: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false }> {
  const service = createServiceClient()
  const { data, error: readError } = await service.auth.admin.getUserById(userId)
  if (readError || !data.user) return { ok: false }

  const { error } = await service.auth.admin.updateUserById(userId, {
    app_metadata: { ...data.user.app_metadata, ...values },
  })
  return error ? { ok: false } : { ok: true }
}

export async function requireDashboardSignupEmailVerification(userId: string) {
  return updateSignupVerificationMetadata(userId, {
    [REQUIRED_KEY]: true,
    [VERIFIED_AT_KEY]: null,
  })
}

export async function completeDashboardSignupEmailVerification(userId: string) {
  return updateSignupVerificationMetadata(userId, {
    [REQUIRED_KEY]: false,
    [VERIFIED_AT_KEY]: new Date().toISOString(),
  })
}
