'use client'

import { useEffect, useState } from 'react'

export default function ProfileAvatar({
  displayName,
  initials,
  avatarUrl,
  size,
  fontSize,
}: {
  displayName: string
  initials: string
  avatarUrl: string | null
  size: number
  fontSize: number
}) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => setImageFailed(false), [avatarUrl])

  const sharedStyle = {
    width: size,
    height: size,
    borderRadius: 999,
    flexShrink: 0,
  } as const

  if (avatarUrl && !imageFailed) {
    return (
      // OAuth avatar hosts are user-specific, so a fixed remote allowlist is not available.
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        onError={() => setImageFailed(true)}
        style={{ ...sharedStyle, display: 'block', objectFit: 'cover', background: 'var(--surface-3)' }}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      title={displayName}
      style={{
        ...sharedStyle,
        background: 'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
        color: '#5a2a14',
        fontWeight: 700,
        fontSize,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {initials}
    </span>
  )
}
