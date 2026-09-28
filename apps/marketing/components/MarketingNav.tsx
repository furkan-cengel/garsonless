'use client'

import { type MouseEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { AppIcons } from '@garsonless/ui/icons'
import { MI } from '../lib/icons'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'
const PENDING_SECTION_KEY = 'masabu:pending-section'

const LINKS = [
  { label: 'Özellikler', href: '/#özellikler', sectionId: 'özellikler' },
  { label: 'Nasıl çalışır', href: '/#demo', sectionId: 'demo' },
  { label: 'Menü özelleştirme', href: '/#menu-ozellestirme', sectionId: 'menu-ozellestirme' },
  { label: 'Fiyatlar', href: '/#fiyatlandırma', sectionId: 'fiyatlandırma' },
  { label: 'SSS', href: '/#sss', sectionId: 'sss' },
]

export function MarketingNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuOpenRef = useRef(false)

  useEffect(() => {
    let lastScrollY = window.scrollY
    let frame = 0

    const updateNav = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollY
      setScrolled(currentScrollY > 8)

      if (mobileMenuOpenRef.current || currentScrollY <= 80) setNavHidden(false)
      else if (delta > 2) setNavHidden(true)
      else if (delta < -2) setNavHidden(false)

      lastScrollY = currentScrollY
      frame = 0
    }

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateNav)
    }

    updateNav()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen
    if (mobileMenuOpen) setNavHidden(false)
  }, [mobileMenuOpen])

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

  useEffect(() => {
    if (pathname !== '/') return

    const storedSection = window.sessionStorage.getItem(PENDING_SECTION_KEY)
    const hashSection = decodeURIComponent(window.location.hash.slice(1))
    const sectionId = storedSection ?? LINKS.find((link) => link.sectionId === hashSection)?.sectionId
    if (!sectionId) return

    let frame = 0
    let attempts = 0
    const scrollToPendingSection = () => {
      const section = document.getElementById(sectionId)
      if (!section && attempts < 10) {
        attempts += 1
        frame = window.requestAnimationFrame(scrollToPendingSection)
        return
      }

      window.sessionStorage.removeItem(PENDING_SECTION_KEY)
      if (!section) return

      section.scrollIntoView({ behavior: storedSection ? 'smooth' : 'auto', block: 'start' })
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
    }

    frame = window.requestAnimationFrame(scrollToPendingSection)
    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  const closeMobileMenu = () => setMobileMenuOpen(false)

  const navigateToSection = (event: MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return

    event.preventDefault()
    closeMobileMenu()

    const section = document.getElementById(sectionId)
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}`,
      )
      return
    }

    window.sessionStorage.setItem(PENDING_SECTION_KEY, sectionId)
    router.push('/', { scroll: false })
  }

  return (
    <nav
      aria-label="Ana navigasyon"
      className="marketing-nav"
      data-menu-open={mobileMenuOpen}
      data-scrolled={scrolled}
      data-hidden={navHidden && !mobileMenuOpen}
    >
      <div className="container marketing-nav__inner" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64,
      }}>
        <a className="marketing-nav__brand" href="/">
          <Image src="/brand/masabu-logo-transparent.svg" alt="masabu" width={93} height={20} priority style={{ display: 'block', width: 'auto', height: 20 }} />
        </a>

        <div className="marketing-nav__links" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {LINKS.map((l) => (
            <a key={l.label} href={l.href} onClick={(event) => navigateToSection(event, l.sectionId)}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="marketing-nav__actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a className="marketing-nav__login" href={`${DASHBOARD_URL}/auth/login`}>Giriş yap</a>
          <a className="marketing-nav__trial-link marketing-nav__trial" href={`${DASHBOARD_URL}/auth/signup`}>
              <span className="marketing-nav__trial-full">14 Gün Ücretsiz Dene</span>
              <span className="marketing-nav__trial-short">Dene</span>
              <MI.arrow />
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
                onClick={(event) => navigateToSection(event, link.sectionId)}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="marketing-nav__mobile-actions">
            <a
              className="marketing-nav__mobile-login"
              href={`${DASHBOARD_URL}/auth/login`}
              onClick={closeMobileMenu}
            >
              Giriş yap
            </a>
            <a
              className="marketing-nav__mobile-trial"
              href={`${DASHBOARD_URL}/auth/signup`}
              onClick={closeMobileMenu}
            >
              <span>14 Gün Ücretsiz Dene</span>
              <AppIcons.arrow size={19} />
            </a>
          </div>
        </div>
      </div>
    </nav>
  )
}
