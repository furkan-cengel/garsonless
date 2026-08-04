export interface DashboardProfileViewModel {
  displayName: string
  initials: string
  avatarUrl: string | null
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function safeProfileAvatarUrl(value: unknown): string | null {
  const candidate = cleanText(value, 2_048)
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

export function profileInitials(displayName: string): string {
  const parts = displayName.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toLocaleUpperCase('tr-TR')
  }
  return (parts[0] ?? 'U').slice(0, 2).toLocaleUpperCase('tr-TR')
}

export function createDashboardProfileViewModel(input: {
  email: string
  metadata: Record<string, unknown> | null | undefined
}): DashboardProfileViewModel {
  const emailLocal = cleanText(input.email.split('@')[0], 100)
  const metadata = input.metadata ?? {}
  const displayName = cleanText(metadata['display_name'], 100)
    || cleanText(metadata['full_name'], 100)
    || cleanText(metadata['name'], 100)
    || emailLocal
    || 'Kullanıcı'
  const avatarUrl = safeProfileAvatarUrl(metadata['avatar_url'])
    ?? safeProfileAvatarUrl(metadata['picture'])

  return {
    displayName,
    initials: profileInitials(displayName),
    avatarUrl,
  }
}
