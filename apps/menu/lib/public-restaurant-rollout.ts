type PublicRestaurantReadError = {
  code?: string
  message?: string
}

type PublicRestaurantReadResult<Row> = {
  data: Row | null
  error: PublicRestaurantReadError | null
}

const PUBLIC_CONTACT_KEYS = [
  'phone',
  'email',
  'website',
  'address',
  'district',
  'city',
  'zip',
  'instagram',
  'facebook',
  'tiktok',
  'whatsapp',
] as const

const PUBLIC_LOYALTY_KEYS = [
  'stamp_enabled',
  'stamp_goal',
  'stamp_reward_text',
  'points_enabled',
  'points_per_lira',
  'points_redeem_rate',
  'member_discount_pct',
  'reward_item_id',
  'welcome_bonus_points',
  'tiers',
  'reward_catalog',
  'scope',
  'earn_trigger',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stripObjectNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripObjectNulls)
  if (!isRecord(value)) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== null && entry !== undefined)
      .map(([key, entry]) => [key, stripObjectNulls(entry)]),
  )
}

function pickSettingsSection(
  settings: Record<string, unknown>,
  section: 'contact' | 'loyalty',
  keys: readonly string[],
): Record<string, unknown> | null {
  const value = settings[section]
  if (!isRecord(value)) return null
  return Object.fromEntries(
    keys
      .filter((key) => value[key] !== null && value[key] !== undefined)
      .map((key) => [key, stripObjectNulls(value[key])]),
  )
}

/** Mirrors the database RPC's public settings allowlist during its bounded
 * rolling-deploy window. Never return the rest of restaurants.settings. */
export function projectPublicRestaurantSettings(value: unknown): Record<string, unknown> {
  const settings = isRecord(value) ? value : {}
  const projected: Record<string, unknown> = {}
  const contact = pickSettingsSection(settings, 'contact', PUBLIC_CONTACT_KEYS)
  if (contact) projected['contact'] = contact
  const hours = settings['hours']
  if (isRecord(hours)) projected['hours'] = stripObjectNulls(hours)
  const loyalty = pickSettingsSection(settings, 'loyalty', PUBLIC_LOYALTY_KEYS)
  if (loyalty) projected['loyalty'] = loyalty
  if (typeof settings['address'] === 'string') projected['address'] = settings['address']
  if (typeof settings['phone'] === 'string') projected['phone'] = settings['phone']
  return projected
}

export function isMissingPublicRestaurantRpc(error: PublicRestaurantReadError | null): boolean {
  if (!error) return false
  if (error.code === 'PGRST202') return true
  return /could not find the function\s+(?:public\.)?read_public_restaurant_by_slug\b/i
    .test(error.message ?? '')
}

/** Uses the legacy anon base-table read only while the additive RPC migration
 * is absent. Permission, network, timeout and every other error stay fail-closed. */
export async function readPublicRestaurantWithRpcFallback<Row extends { settings: unknown }>(
  readRpc: () => Promise<PublicRestaurantReadResult<Row>>,
  readLegacyProjection: () => Promise<PublicRestaurantReadResult<Row>>,
): Promise<PublicRestaurantReadResult<Row> & { source: 'rpc' | 'legacy-projection' }> {
  const rpcResult = await readRpc()
  if (!isMissingPublicRestaurantRpc(rpcResult.error)) {
    return { ...rpcResult, source: 'rpc' }
  }

  const legacyResult = await readLegacyProjection()
  return {
    ...legacyResult,
    data: legacyResult.data
      ? { ...legacyResult.data, settings: projectPublicRestaurantSettings(legacyResult.data.settings) }
      : null,
    source: 'legacy-projection',
  }
}
