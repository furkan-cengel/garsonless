'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { AppIcons } from '@garsonless/ui/icons'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    const desktop = window.matchMedia('(min-width: 901px)')
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', closeOnDesktop)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', closeOnDesktop)
    }
  }, [])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <nav className="marketing-nav" data-menu-open={mobileMenuOpen} style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: scrolled || mobileMenuOpen ? 'rgba(253, 250, 245, .94)' : 'transparent',
      backdropFilter: scrolled || mobileMenuOpen ? 'blur(14px)' : 'none',
      WebkitBackdropFilter: scrolled || mobileMenuOpen ? 'blur(14px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--line)' : '1px solid transparent',
      transition: 'all 200ms',
    }}>
      <div className="container marketing-nav__inner" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'var(--ink)' }}>
          <Image src="/brand/masabu-logo-transparent.svg" alt="Masabu" width={93} height={20} priority style={{ display: 'block', width: 'auto', height: 20 }} />
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

        <button
          type="button"
          className="marketing-nav__menu-toggle"
          aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={mobileMenuOpen}
          aria-controls="marketing-mobile-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? <AppIcons.close size={26} /> : <AppIcons.menu size={28} />}
        </button>
      </div>


      <div
        id="marketing-mobile-menu"
        className="marketing-nav__mobile-panel"
        aria-hidden={!mobileMenuOpen}
      >
        <div className="container marketing-nav__mobile-content">
          <div className="marketing-nav__mobile-links">
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                data-active={active === link.label}
                onClick={closeMobileMenu}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="marketing-nav__mobile-actions">
            <a
              className="marketing-nav__mobile-login"
              href={`${DASHBOARD_URL}/login`}
              onClick={closeMobileMenu}
            >
              Giriş yap
            </a>
            <a
              className="marketing-nav__mobile-trial"
              href={`${DASHBOARD_URL}/signup`}
              onClick={closeMobileMenu}
            >
              <span>14 gün ücretsiz dene</span>
              <AppIcons.arrow size={19} />
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
