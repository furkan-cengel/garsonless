'use client'

import { useTheme } from './ThemeContext'

export function AnnouncementBar() {
  const { theme } = useTheme()
  const {
    announcementEnabled,
    announcementText,
    announcementBg,
    announcementColor,
    announcementStyle,
    announcementSpeed,
  } = theme

  if (!announcementEnabled) return null

  const duration = `${6 - announcementSpeed}s`

  const wrapperStyle: React.CSSProperties = {
    width: '100%',
    background: announcementBg,
    color: announcementColor,
    padding: '8px 16px',
    fontSize: 13,
    fontFamily: 'var(--p-body)',
    overflow: 'hidden',
    position: 'relative',
    boxSizing: 'border-box',
  }

  if (announcementStyle === 'static') {
    return (
      <div style={wrapperStyle}>
        <div style={{ textAlign: 'center' }}>{announcementText}</div>
      </div>
    )
  }

  if (announcementStyle === 'marquee') {
    return (
      <div style={wrapperStyle}>
        <div style={{
          display: 'flex',
          gap: 64,
          animation: `marquee ${duration} linear infinite`,
          width: 'max-content',
          whiteSpace: 'nowrap',
        }}>
          {[0, 1, 2].map(i => <span key={i}>{announcementText}</span>)}
        </div>
      </div>
    )
  }

  if (announcementStyle === 'fade') {
    return (
      <div style={wrapperStyle}>
        <div style={{ textAlign: 'center', animation: `fade-loop ${duration} ease-in-out infinite` }}>
          {announcementText}
        </div>
      </div>
    )
  }

  return (
    <div style={wrapperStyle}>
      <div style={{ textAlign: 'center', overflow: 'hidden' }}>
        <span style={{ display: 'inline-block', animation: `slide-up ${duration} ease-in-out infinite` }}>
          {announcementText}
        </span>
      </div>
    </div>
  )
}
