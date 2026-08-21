import {
  CUSTOMER_AUTH_OAUTH_PROVIDERS,
  type CustomerAuthCapabilities,
  type CustomerAuthOAuthProvider,
} from './customer-auth-contract.ts'

type ProviderSettingsFetcher = (
  input: string | URL,
  init?: RequestInit & { next?: { revalidate?: number } },
) => Promise<Response>

function configuredProviderSet(): ReadonlySet<CustomerAuthOAuthProvider> {
  // Production is deliberately fail-closed: a provider is exposed only after
  // its hosted setup has been verified and the deployment flag is explicit.
  const raw = process.env['CUSTOMER_AUTH_ENABLED_PROVIDERS']
    ?? (process.env.NODE_ENV === 'production' ? '' : 'google')
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is CustomerAuthOAuthProvider => (
        CUSTOMER_AUTH_OAUTH_PROVIDERS.some((provider) => provider === value)
      )),
  )
}

/**
 * Intersects the explicit app allowlist with Supabase's public provider flags.
 * A missing/invalid setting or an unavailable settings endpoint hides every
 * social provider; email OTP remains available independently.
 */
export async function availableCustomerAuthProviders(
  fetcher: ProviderSettingsFetcher = fetch,
): Promise<readonly CustomerAuthOAuthProvider[]> {
  const configured = configuredProviderSet()
  if (configured.size === 0) return []

  const baseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const anonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']
  if (!baseUrl || !anonKey) return []

  let settingsUrl: URL
  try {
    settingsUrl = new URL('/auth/v1/settings', baseUrl)
    if (settingsUrl.protocol !== 'https:' && settingsUrl.protocol !== 'http:') return []
  } catch {
    return []
  }

  try {
    const response = await fetcher(settingsUrl, {
      headers: { apikey: anonKey },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3_000),
    })
    if (!response.ok) return []
    const settings = await response.json() as { external?: Record<string, unknown> }
    return CUSTOMER_AUTH_OAUTH_PROVIDERS.filter((provider) => (
      configured.has(provider) && settings.external?.[provider] === true
    ))
  } catch {
    return []
  }
}

/** Server-owned capability projection. The phone flag is enabled only after
 * the Supabase/Netgsm smoke test has been completed for that deployment. */
export async function availableCustomerAuthCapabilities(
  fetcher: ProviderSettingsFetcher = fetch,
): Promise<CustomerAuthCapabilities> {
  const providers = await availableCustomerAuthProviders(fetcher)
  const phoneOtp = process.env['CUSTOMER_AUTH_PHONE_OTP_ENABLED'] === 'true'
  return {
    emailOtp: process.env['CUSTOMER_AUTH_EMAIL_OTP_ENABLED'] !== 'false',
    phoneOtp,
    oauth: {
      google: providers.includes('google'),
      apple: providers.includes('apple'),
    },
  }
}
