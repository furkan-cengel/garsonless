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
    motion,
  } = theme

  const text = announcementText.trim()
  if (!announcementEnabled || !text) return null

  const safeSpeed = Math.min(8, Math.max(1, announcementSpeed))
  const duration = `${Math.max(4, 20 - safeSpeed * 2)}s`
  const effectiveStyle = motion === 'none' ? 'static' : announcementStyle

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

  if (effectiveStyle === 'static') {
    return (
      <section aria-label="İşletme duyurusu" style={wrapperStyle}>
        <div style={{ textAlign: 'center' }}>{text}</div>
      </section>
    )
  }

  if (effectiveStyle === 'marquee') {
    return (
      <section aria-label="İşletme duyurusu" style={wrapperStyle}>
        <div className="announcement-motion" style={{
          display: 'block',
          animation: `marquee ${motion === 'reduced' ? '24s' : duration} linear infinite`,
          width: 'max-content',
          minWidth: '100%',
          paddingLeft: '100%',
          whiteSpace: 'nowrap',
        }}>
          {text}
        </div>
      </section>
    )
  }

  if (effectiveStyle === 'fade') {
    return (
      <section aria-label="İşletme duyurusu" style={wrapperStyle}>
        <div className="announcement-motion" style={{ textAlign: 'center', animation: `fade-loop ${motion === 'reduced' ? '12s' : duration} ease-in-out infinite` }}>
          {text}
        </div>
      </section>
    )
  }

  return (
    <section aria-label="İşletme duyurusu" style={wrapperStyle}>
      <div style={{ textAlign: 'center', overflow: 'hidden' }}>
        <span className="announcement-motion" style={{ display: 'inline-block', animation: `slide-up ${motion === 'reduced' ? '12s' : duration} ease-in-out infinite` }}>
          {text}
        </span>
      </div>
    </section>
  )
}
