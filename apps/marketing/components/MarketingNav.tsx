'use client'

import { type MouseEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, ArrowUpRight, ChevronDown, Leaf, Menu, Monitor, QrCode, ReceiptText, Smartphone, X } from 'lucide-react'
import styles from './MarketingNav.module.css'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'
const PENDING_SECTION_KEY = 'masabu:pending-section'
const SECTIONS = ['özellikler', 'demo', 'menu-ozellestirme', 'fiyatlandırma', 'sss']
const PRODUCTS = [
  { label: 'QR Menü', href: '/qr-menu', description: 'Menünüzü dijitale taşıyın.', Icon: QrCode },
  { label: 'Dijital Adisyon', href: '/dijital-adisyon', description: 'Masa ve hesabı tek yerden yönetin.', Icon: ReceiptText },
  { label: 'QR Sipariş', href: '/qr-siparis', description: 'Masadan sipariş alın.', Icon: Smartphone },
  { label: 'Mutfak Ekranı', href: '/mutfak-ekrani', description: 'Siparişleri anlık takip edin.', Icon: Monitor },
] as const
const GROUPS = {
  products: { label: 'Ürünler', links: PRODUCTS },
  resources: { label: 'Kaynaklar', links: [
    { label: 'Blog', href: '/blog', description: 'Restoranınız için fikirler ve rehberler.' },
    { label: 'Alerjen bilgilendirme rehberi', href: '/menu-alerjen-zorunlulugu', description: 'Menü bilgilendirme gerekliliklerini inceleyin.' },
    { label: 'Sık sorulan sorular', href: '/#sss', description: 'Masabu hakkında merak ettikleriniz.' },
  ] },
  company: { label: 'Şirket', links: [
    { label: 'Hakkımızda', href: '/hakkimizda', description: 'Masabu’yu yakından tanıyın.' },
    { label: 'İletişim', href: '/iletisim', description: 'İşletmeniz için birlikte konuşalım.' },
  ] },
}
type Group = keyof typeof GROUPS

export function MarketingNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [navHidden, setNavHidden] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopGroup, setDesktopGroup] = useState<Group | null>(null)
  const [mobileGroup, setMobileGroup] = useState<Group | null>('products')
  const navRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openedOnHover = useRef<Group | null>(null)
  openRef.current = mobileOpen || desktopGroup !== null

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }
  const closeMenus = () => {
    cancelClose()
    setDesktopGroup(null)
    setMobileOpen(false)
    openedOnHover.current = null
  }
  const openDesktop = (group: Group) => {
    cancelClose()
    setDesktopGroup(group)
    setNavHidden(false)
  }
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      if (!navRef.current?.contains(document.activeElement)) setDesktopGroup(null)
      openedOnHover.current = null
    }, 180)
  }

  useEffect(() => {
    let lastY = window.scrollY
    let frame = 0
    const update = () => {
      const y = window.scrollY
      setScrolled(y > 8)
      if (openRef.current || y <= 80) setNavHidden(false)
      else if (y - lastY > 2) setNavHidden(true)
      else if (y - lastY < -2) setNavHidden(false)
      lastY = y
      frame = 0
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  useEffect(() => {
    setDesktopGroup(null)
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    const onOutside = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) {
        setDesktopGroup(null)
        setMobileOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openRef.current) {
        const trigger = mobileOpen ? toggleRef.current : navRef.current?.querySelector<HTMLButtonElement>('[data-desktop-trigger][aria-expanded="true"]')
        setDesktopGroup(null)
        setMobileOpen(false)
        trigger?.focus()
      }
      if (event.key === 'Tab' && mobileOpen) {
        const focusable = Array.from(navRef.current?.querySelectorAll<HTMLElement>('a[href], button') ?? []).filter(el => el.getClientRects().length > 0)
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    const media = window.matchMedia('(min-width: 1101px)')
    const reset = () => { setDesktopGroup(null); setMobileOpen(false) }
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('keydown', onKey)
    media.addEventListener('change', reset)
    return () => {
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('keydown', onKey)
      media.removeEventListener('change', reset)
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Keep background page links out of keyboard and screen-reader navigation.
    const backgrounds = Array.from(document.body.querySelectorAll<HTMLElement>('main, footer'))
    const previousInert = backgrounds.map(el => el.inert)
    backgrounds.forEach(el => { el.inert = true })
    setNavHidden(false)
    return () => {
      document.body.style.overflow = previous
      backgrounds.forEach((el, index) => { el.inert = previousInert[index] ?? false })
    }
  }, [mobileOpen])

  useEffect(() => {
    if (pathname !== '/') return
    const stored = sessionStorage.getItem(PENDING_SECTION_KEY)
    let hash = ''
    try { hash = decodeURIComponent(window.location.hash.slice(1)) } catch { /* Ignore malformed fragment. */ }
    const sectionId = stored ?? SECTIONS.find(id => id === hash)
    if (!sectionId) return
    let frame = 0
    let attempts = 0
    const scroll = () => {
      const section = document.getElementById(sectionId)
      if (!section && attempts++ < 10) { frame = requestAnimationFrame(scroll); return }
      sessionStorage.removeItem(PENDING_SECTION_KEY)
      if (!section) return
      section.scrollIntoView({ behavior: stored && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto', block: 'start' })
      history.replaceState(history.state, '', `${location.pathname}${location.search}`)
    }
    frame = requestAnimationFrame(scroll)
    return () => cancelAnimationFrame(frame)
  }, [pathname])

  const onLink = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    closeMenus()
    if (!href.startsWith('/#')) return
    event.preventDefault()
    const sectionId = href.slice(2)
    const section = document.getElementById(sectionId)
    if (section) {
      section.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
      history.replaceState(history.state, '', `${location.pathname}${location.search}`)
    } else {
      sessionStorage.setItem(PENDING_SECTION_KEY, sectionId)
      router.push('/', { scroll: false })
    }
  }
  const guide = (
    <Link className={styles.guide} href="/menu-alerjen-zorunlulugu" onClick={closeMenus}>
      <Leaf size={23} aria-hidden="true" /><span className={styles.guideDesktop}>Menünüz alerjen bilgilendirmesine hazır mı?</span><span className={styles.guideMobile}>Alerjen bilgilendirme rehberi</span><span className={styles.guideAction}>Rehberi incele</span><ArrowRight size={20} aria-hidden="true" />
    </Link>
  )
  const productLinks = (mobile = false) => (mobile ? [PRODUCTS[0], PRODUCTS[2], PRODUCTS[1], PRODUCTS[3]] : PRODUCTS).map(({ label, href, description, Icon }) => (
    <Link key={href} href={href} className={styles.productLink} onClick={closeMenus} aria-current={pathname === href ? 'page' : undefined}>
      <span className={styles.icon}><Icon size={24} strokeWidth={1.8} aria-hidden="true" /></span><span><strong>{label}</strong><small>{description}</small></span>
    </Link>
  ))
  const desktopTrigger = (group: Group) => (
    <button type="button" id={`nav-trigger-${group}`} data-desktop-trigger aria-expanded={desktopGroup === group} aria-controls={`nav-panel-${group}`} className={styles.trigger}
      onPointerEnter={event => { if (event.pointerType === 'mouse' && desktopGroup !== group) { openedOnHover.current = group; openDesktop(group) } }}
      onClick={() => { if (openedOnHover.current === group) { openedOnHover.current = null; openDesktop(group) } else { setDesktopGroup(desktopGroup === group ? null : group); cancelClose() } }}
      onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); openDesktop(group); requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>(`#nav-panel-${group} a`)?.focus()) } }}>
      {GROUPS[group].label}<ChevronDown size={15} aria-hidden="true" />
    </button>
  )
  const mobileAccordion = (group: Group) => (
    <div className={styles.mobileGroup}>
      <button type="button" className={styles.mobileRow} aria-expanded={mobileGroup === group} aria-controls={`mobile-group-${group}`} onClick={() => setMobileGroup(mobileGroup === group ? null : group)}>{GROUPS[group].label}<ChevronDown size={21} aria-hidden="true" /></button>
      {mobileGroup === group && <div id={`mobile-group-${group}`} className={styles.mobileGroupContent}>
        {group === 'products' ? <>{productLinks(true)}{guide}</> : GROUPS[group].links.map(link => <Link key={link.href} href={link.href} onClick={event => onLink(event, link.href)} className={styles.smallLink}><strong>{link.label}</strong><small>{link.description}</small></Link>)}
      </div>}
    </div>
  )

  return (
    <nav ref={navRef} aria-label="Ana navigasyon" className={`marketing-nav ${styles.nav}`} data-scrolled={scrolled} data-menu-open={mobileOpen || !!desktopGroup} data-hidden={navHidden && !mobileOpen && !desktopGroup}
      onPointerLeave={scheduleClose} onPointerEnter={cancelClose} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDesktopGroup(null) }}>
      <div className={`container marketing-nav__inner ${styles.inner}`}>
        <Link className={styles.brand} href="/" onClick={closeMenus}><Image src="/brand/masabu-logo-transparent.svg" alt="Masabu ana sayfa" width={93} height={20} priority /></Link>
        <div className={styles.desktopLinks}>
          {desktopTrigger('products')}
          <Link href="/#demo" onPointerEnter={() => setDesktopGroup(null)} onClick={event => onLink(event, '/#demo')}>Nasıl çalışır</Link>
          <Link href="/fiyatlar" onPointerEnter={() => setDesktopGroup(null)} onClick={closeMenus} aria-current={pathname === '/fiyatlar' ? 'page' : undefined}>Fiyatlar</Link>
          {desktopTrigger('resources')}{desktopTrigger('company')}
        </div>
        <div className={styles.actions}><a href={`${DASHBOARD_URL}/auth/login`} className={styles.login}>Giriş yap</a><a href={`${DASHBOARD_URL}/auth/signup`} className={styles.trial}>14 Gün Ücretsiz Dene<ArrowRight size={18} aria-hidden="true" /></a></div>
        <button ref={toggleRef} type="button" className={styles.toggle} aria-label={mobileOpen ? 'Menüyü kapat' : 'Menüyü aç'} aria-expanded={mobileOpen} aria-controls="marketing-mobile-menu" onClick={() => { setMobileOpen(!mobileOpen); setMobileGroup('products') }}>{mobileOpen ? <X size={26} /> : <Menu size={27} />}</button>
      </div>
      {desktopGroup && <div className={`${styles.dropdown} ${desktopGroup !== 'products' ? styles.compact : ''}`} id={`nav-panel-${desktopGroup}`} aria-labelledby={`nav-trigger-${desktopGroup}`}>
        {desktopGroup === 'products' ? <><div className={styles.megaBody}><div className={styles.products}><p className={styles.eyebrow}>ÜRÜNLER</p><div className={styles.productGrid}>{productLinks()}</div></div><div className={styles.features}>
          <Link href="/qr-menu" onClick={closeMenus} className={styles.feature}><div className={styles.featureImage}><Image src="/navigation/guest.png" alt="Menemen ürününün tercihleri ve alerjen bilgileri" fill sizes="300px" className={styles.guestImage} /></div><span>Misafir deneyimi<ArrowUpRight size={20} aria-hidden="true" /></span></Link>
          <Link href="/mutfak-ekrani" onClick={closeMenus} className={styles.feature}><div className={styles.featureImage}><Image src="/navigation/operations.png" alt="Masa 5 için hazırlanan siparişin mutfak ekranı" fill sizes="300px" /></div><span>Restoran operasyonu<ArrowUpRight size={20} aria-hidden="true" /></span></Link>
        </div></div>{guide}</> : <div className={styles.compactLinks}>{GROUPS[desktopGroup].links.map(link => <Link key={link.href} href={link.href} className={styles.smallLink} onClick={event => onLink(event, link.href)} aria-current={pathname === link.href ? 'page' : undefined}><strong>{link.label}</strong><small>{link.description}</small></Link>)}</div>}
      </div>}
      {mobileOpen && <div id="marketing-mobile-menu" className={styles.mobilePanel}><div className={styles.mobileScroll}>
        {mobileAccordion('products')}
        <Link className={styles.mobileRow} href="/#demo" onClick={event => onLink(event, '/#demo')}>Nasıl çalışır<ArrowRight size={21} aria-hidden="true" /></Link>
        <Link className={styles.mobileRow} href="/fiyatlar" onClick={closeMenus}>Fiyatlar<ArrowRight size={21} aria-hidden="true" /></Link>
        {mobileAccordion('resources')}{mobileAccordion('company')}
      </div><div className={styles.mobileActions}><a href={`${DASHBOARD_URL}/auth/login`} className={styles.mobileLogin} onClick={closeMenus}>Giriş yap</a><a href={`${DASHBOARD_URL}/auth/signup`} className={styles.trial} onClick={closeMenus}>14 Gün Ücretsiz Dene<ArrowRight size={20} aria-hidden="true" /></a></div></div>}
    </nav>
  )
}
