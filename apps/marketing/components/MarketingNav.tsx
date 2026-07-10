'use client'

import { useState, useEffect } from 'react'
import { MI } from '../lib/icons'
import { PrimaryButton } from './ui/Buttons'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

const LINKS = [
  { label: 'Özellikler',      href: '/#özellikler' },
  { label: 'Çözümler',        href: '/solutions' },
  { label: 'Fiyatlandırma',   href: '/#fiyatlandırma' },
  { label: 'Kaynaklar',       href: '/resources' },
  { label: 'Şirket',          href: '/company' },
]

interface Props {
  active?: string
}

export function MarketingNav({ active }: Props) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: scrolled ? 'rgba(253, 250, 245, .85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
      transition: 'all 200ms',
    }}>
      <div className="container marketing-nav__inner" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <img src="/brand/masabu-logo-transparent.svg" alt="Masabu" style={{ height: 20, width: 'auto', display: 'block' }} />
        </a>

        <div className="marketing-nav__links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} style={{
              padding: '8px 14px', fontSize: 14,
              fontWeight: active === l.label ? 600 : 500,
              color: active === l.label ? 'var(--ink)' : 'var(--ink-2)',
              textDecoration: 'none', borderRadius: 7,
              background: active === l.label ? 'var(--bg-2)' : 'transparent',
            }}>{l.label}</a>
          ))}
        </div>

        <div className="marketing-nav__actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a className="marketing-nav__login" href={`${DASHBOARD_URL}/login`} style={{
            padding: '8px 12px', fontSize: 14, fontWeight: 500,
            color: 'var(--ink-2)', textDecoration: 'none',
          }}>Giriş yap</a>
          <a href={`${DASHBOARD_URL}/signup`} style={{ textDecoration: 'none' }}>
            <PrimaryButton size="sm" className="marketing-nav__trial">
              <span className="marketing-nav__trial-full">14 gün ücretsiz dene</span>
              <span className="marketing-nav__trial-short">Dene</span>
              <MI.arrow />
            </PrimaryButton>
          </a>
        </div>
      </div>
    </nav>
  )
}
