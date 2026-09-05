const SUPABASE_PROJECT_REF_PATTERN = /^[a-z0-9-]{1,80}$/

export function resolvePlatformAdminAuthCookieName(supabaseUrl: string): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]?.toLowerCase() ?? ''

  if (!SUPABASE_PROJECT_REF_PATTERN.test(projectRef)) {
    throw new Error('Invalid Supabase project URL')
  }

  return `sb-${projectRef}-platform-admin-auth-token`
}

export function getPlatformAdminAuthCookieName(): string {
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }

  return resolvePlatformAdminAuthCookieName(supabaseUrl)
}
