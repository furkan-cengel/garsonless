'use client'

import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import type { MenuCategory, MenuItem } from '@garsonless/ui/menu'
import type { StoreInfo } from '@garsonless/ui/themes'
import { Header } from '@garsonless/ui/menu/Header'
import { MenuFooter } from '@garsonless/ui/menu/MenuFooter'
import { ThemeProvider, useTheme } from '@garsonless/ui/menu/ThemeContext'
import { readStoreInfo } from '@garsonless/ui/themes/storeInfo'
import { AppIcons as I } from '@garsonless/ui/icons'
import type { GarsonlessTheme, HomeSurfaceSection } from '@garsonless/design-engine'
import type { MemberBalances } from '@garsonless/db/types'
import type { PublicRestaurant } from '../../lib/queries'
import type { CustomerAuthOAuthProvider } from '../../lib/customer-auth-contract'
import { buildHomeMenuHref } from '../../lib/home-menu-href'
import { HomeV2Block } from './HomeV2Block'

const HomeHeroVideo = dynamic(() => import('./HomeHeroVideo').then((module) => module.HomeHeroVideo))
const MemberSheet = dynamic(() => import('./components/MemberSheet'), { ssr: false })

export function HomePageRenderer({
  restaurant,
  categories,
  items,
  theme,
  initialMember = null,
  initialMemberBalances = null,
  customerAuthProviders = [],
  guestOrderingEnabled = false,
  customerAccountsEnabled = false,
  isPreview = false,
}: {
  restaurant: PublicRestaurant
  categories: MenuCategory[]
  items: MenuItem[]
  theme: GarsonlessTheme
  initialMember?: { name: string | null } | null
  initialMemberBalances?: MemberBalances | null
  customerAuthProviders?: readonly CustomerAuthOAuthProvider[]
  guestOrderingEnabled?: boolean
  customerAccountsEnabled?: boolean
  isPreview?: boolean
}) {
  return <ThemeProvider initialTheme={theme} isPreview={isPreview} initialRestaurantName={restaurant.name} initialLogoUrl={restaurant.logo_url ?? null}>
    <LiveHomePage restaurant={restaurant} categories={categories} items={items} initialMember={initialMember} initialMemberBalances={initialMemberBalances} customerAuthProviders={customerAuthProviders} guestOrderingEnabled={guestOrderingEnabled} customerAccountsEnabled={customerAccountsEnabled} />
  </ThemeProvider>
}

function LiveHomePage({
  restaurant,
  categories,
  items,
  initialMember,
  initialMemberBalances,
  customerAuthProviders,
  guestOrderingEnabled,
  customerAccountsEnabled,
}: {
  restaurant: PublicRestaurant
  categories: MenuCategory[]
  items: MenuItem[]
  initialMember: { name: string | null } | null
  initialMemberBalances: MemberBalances | null
  customerAuthProviders: readonly CustomerAuthOAuthProvider[]
  guestOrderingEnabled: boolean
  customerAccountsEnabled: boolean
}) {
  const { theme, isPreview } = useTheme()
  return theme.surfaces?.home.compositionVersion === 2 && theme.surfaces.home.blocks
    ? <HomeV2 restaurant={restaurant} categories={categories} items={items} theme={theme} initialMember={initialMember} initialMemberBalances={initialMemberBalances} customerAuthProviders={customerAuthProviders} guestOrderingEnabled={guestOrderingEnabled} customerAccountsEnabled={customerAccountsEnabled} isPreview={isPreview} />
    : <LegacyHomePageRenderer restaurant={restaurant} categories={categories} items={items} theme={theme} isPreview={isPreview} />
}

function HomeV2({
  restaurant,
  categories,
  items,
  theme,
  initialMember,
  initialMemberBalances,
  customerAuthProviders,
  guestOrderingEnabled,
  customerAccountsEnabled,
  isPreview,
}: {
  restaurant: PublicRestaurant
  categories: MenuCategory[]
  items: MenuItem[]
  theme: GarsonlessTheme
  initialMember: { name: string | null } | null
  initialMemberBalances: MemberBalances | null
  customerAuthProviders: readonly CustomerAuthOAuthProvider[]
  guestOrderingEnabled: boolean
  customerAccountsEnabled: boolean
  isPreview: boolean
}) {
  const home = theme.surfaces!.home
  const menuHref = buildHomeMenuHref(restaurant.slug, { preview: isPreview })
  const [member, setMember] = useState(initialMember)
  const [memberOpen, setMemberOpen] = useState(false)
  const storeInfo = useMemo(() => readStoreInfo(restaurant.settings), [restaurant.settings])
  const storeStatus = useMemo(() => resolveStoreStatus(storeInfo?.hours, restaurant.timezone), [restaurant.timezone, storeInfo?.hours])
  const categoryMeta = useMemo(() => Object.fromEntries(categories.map((category) => [category.id, { imageUrl: category.image_url ?? null, itemCount: items.filter((item) => item.category_id === category.id).length }])), [categories, items])
  const visibleBlocks = useMemo(() => home.blocks?.filter((block) => block.enabled) ?? [], [home.blocks])
  const homeOverride = home.override ?? {}
  const homeBlockStyle = {
    '--p-bg': homeOverride.background ?? theme.bg,
    '--p-card': homeOverride.surface ?? theme.cardColor ?? '#ffffff',
    '--p-text': homeOverride.text ?? theme.textColor ?? '#1c1d20',
    '--p-text-2': homeOverride.mutedText ?? theme.mutedTextColor ?? '#6c6f76',
    '--p-accent': homeOverride.accent ?? theme.accent,
    '--p-accent-soft': homeOverride.accentSoft ?? theme.accentSoft,
    '--p-cta': homeOverride.cta ?? theme.cta,
    '--p-cta-text': homeOverride.ctaText ?? theme.ctaTextColor ?? '#ffffff',
  } as React.CSSProperties
  const memberSummary = member ? {
    authenticated: true,
    name: member.name,
    points: initialMemberBalances?.points ?? 0,
    stamps: initialMemberBalances?.stamps ?? 0,
    pointsEnabled: initialMemberBalances?.pointsEnabled ?? false,
    stampEnabled: initialMemberBalances?.stampEnabled ?? false,
  } : { authenticated: false, name: null }
  const navigate = (href: string) => { window.location.assign(href) }
  const logout = async (scope: 'device' | 'all' = 'device') => {
    await fetch('/api/account/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scope }) })
    setMember(null)
    setMemberOpen(false)
  }
  return <main data-home-experience-v2 style={{ minHeight: '100dvh', background: 'var(--p-bg)', color: 'var(--p-text)', fontFamily: 'var(--p-body)' }}>
    <Header
      categories={categories}
      categoryMeta={categoryMeta}
      onCategorySelect={(categoryId) => navigate(buildHomeMenuHref(restaurant.slug, { preview: isPreview, categoryId }))}
      {...(guestOrderingEnabled ? {
        cartSummary: { count: 0, subtotal: 0 },
        onOpenCart: () => navigate(buildHomeMenuHref(restaurant.slug, { preview: isPreview, openCart: true })),
      } : {})}
      {...(customerAccountsEnabled ? { memberSummary, onOpenMember: () => setMemberOpen(true) } : {})}
      storeInfo={storeInfo}
    />
    <div data-home-blocks style={homeBlockStyle}>
      {visibleBlocks.map((block) => {
        const config = theme.sectionSettings?.[block.id] ?? {}
        return <HomeV2Block
          key={block.id}
          block={block}
          config={config}
          theme={theme}
          restaurantName={restaurant.name}
          pageDescription={theme.pageDescription}
          categories={categories}
          items={items}
          menuHref={menuHref}
          memberSummary={memberSummary}
          {...(storeStatus ? { storeStatus } : {})}
          {...(customerAccountsEnabled ? { onOpenMember: () => setMemberOpen(true) } : {})}
          onOpenProduct={(item) => navigate(buildHomeMenuHref(restaurant.slug, { preview: isPreview, itemId: item.id }))}
          storeInfo={storeInfo}
        />
      })}
    </div>
    <div id="home-shared-footer"><MenuFooter storeInfo={storeInfo} /></div>
    <StickyMenuCta href={menuHref} />
    {customerAccountsEnabled && memberOpen ? <MemberSheet
      onClose={() => setMemberOpen(false)}
      authenticated={Boolean(member)}
      memberName={member?.name ?? null}
      balances={member ? initialMemberBalances : null}
      restaurantId={restaurant.id}
      restaurantSlug={restaurant.slug}
      restaurantName={restaurant.name}
      authSurface="menu"
      oauthProviders={customerAuthProviders}
      onVerified={(nextMember) => setMember(nextMember)}
      {...(member ? { onLogout: logout } : {})}
    /> : null}
  </main>
}

function StickyMenuCta({ href }: { href: string }) {
  const [footerVisible, setFooterVisible] = useState(false)
  useEffect(() => {
    const footer = document.getElementById('home-shared-footer')
    if (!footer) return
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(Boolean(entry?.isIntersecting)), { threshold: .05 })
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])
  return <a href={href} data-home-sticky-menu-cta data-hidden={footerVisible ? 'true' : 'false'} aria-hidden={footerVisible} tabIndex={footerVisible ? -1 : undefined} style={{ position: 'fixed', left: 16, right: 16, bottom: 'calc(14px + env(safe-area-inset-bottom,0px))', zIndex: 18, minHeight: 52, display: 'none', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: 'var(--p-radius)', background: 'var(--p-cta)', color: 'var(--p-cta-text)', textDecoration: 'none', fontSize: 14, fontWeight: 850, boxShadow: '0 18px 42px rgba(12,18,24,.25)', opacity: footerVisible ? 0 : 1, pointerEvents: footerVisible ? 'none' : 'auto', transition: 'opacity 160ms ease' }}>Menüyü Gör<I.arrow size={17} /><style>{'@media(max-width:720px){[data-home-sticky-menu-cta]{display:flex!important}[data-home-sticky-menu-cta][data-hidden="true"]{display:none!important}}@media(prefers-reduced-motion:reduce){[data-home-sticky-menu-cta]{transition:none!important}}'}</style></a>
}

function resolveStoreStatus(hours: StoreInfo['hours'] | undefined, timeZone: string) {
  if (!hours) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
    const weekday = parts.find((part) => part.type === 'weekday')?.value.toLocaleLowerCase('en-US')
    const hour = Number(parts.find((part) => part.type === 'hour')?.value)
    const minute = Number(parts.find((part) => part.type === 'minute')?.value)
    if (!weekday || !Number.isFinite(hour) || !Number.isFinite(minute)) return null
    const schedule = hours[weekday]
    if (!schedule || schedule.active !== true || !schedule.open || !schedule.close) return 'Şu an kapalı'
    const toMinutes = (value: string) => { const match = /^(\d{1,2}):(\d{2})$/.exec(value); return match ? Number(match[1]) * 60 + Number(match[2]) : null }
    const open = toMinutes(schedule.open); const close = toMinutes(schedule.close)
    if (open === null || close === null) return null
    const now = hour * 60 + minute
    const isOpen = close > open ? now >= open && now < close : now >= open || now < close
    return isOpen ? 'Şu an açık' : 'Şu an kapalı'
  } catch {
    return null
  }
}

function LegacyHomePageRenderer({
  restaurant,
  categories,
  items,
  theme,
  isPreview,
}: {
  restaurant: PublicRestaurant
  categories: MenuCategory[]
  items: MenuItem[]
  theme: GarsonlessTheme
  isPreview: boolean
}) {
  const home = theme.surfaces?.home
  if (!home) return null
  const override = home.override ?? {}
  const colors = {
    background: override.background ?? theme.bg,
    surface: override.surface ?? theme.cardColor ?? '#ffffff',
    text: override.text ?? theme.textColor ?? '#1c1d20',
    muted: override.mutedText ?? theme.mutedTextColor ?? '#6c6f76',
    accent: override.accent ?? theme.accent,
    accentSoft: override.accentSoft ?? theme.accentSoft,
    cta: override.cta ?? theme.cta,
    ctaText: override.ctaText ?? theme.ctaTextColor ?? '#ffffff',
  }
  const style = {
    '--home-bg': colors.background,
    '--home-surface': colors.surface,
    '--home-text': colors.text,
    '--home-muted': colors.muted,
    '--home-accent': colors.accent,
    '--home-accent-soft': colors.accentSoft,
    '--home-cta': colors.cta,
    '--home-cta-text': colors.ctaText,
    '--home-radius': `${override.radius ?? theme.radius}px`,
    '--home-body': override.bodyFont ?? theme.bodyFont,
    '--home-display': override.displayFont ?? theme.displayFont,
  } as React.CSSProperties

  return (
    <main data-home-experience style={style}>
      <style>{HOME_CSS}</style>
      {home.sections.filter((section) => section.enabled).map((section) => (
        <HomeSection
          key={section.id}
          section={section}
          restaurant={restaurant}
          categories={categories}
          items={items}
          isPreview={isPreview}
        />
      ))}
    </main>
  )
}

function HomeSection({
  section,
  restaurant,
  categories,
  items,
  isPreview,
}: {
  section: HomeSurfaceSection
  restaurant: PublicRestaurant
  categories: MenuCategory[]
  items: MenuItem[]
  isPreview: boolean
}) {
  const menuHref = buildHomeMenuHref(restaurant.slug, { preview: isPreview })
  const align = section.align ?? 'left'
  const toneClass = `home-tone-${section.tone ?? 'surface'}`

  if (section.type === 'announcement') {
    return <section data-component={`home:${section.id}`} className={`home-announcement ${toneClass}`} style={{ textAlign: align }}>{section.body}</section>
  }
  if (section.type === 'header') {
    return (
      <header data-component={`home:${section.id}`} className="home-header">
        <Link href={`/${encodeURIComponent(restaurant.slug)}`} className="home-brand" aria-label={`${restaurant.name} ana sayfa`}>
          {restaurant.logo_url && <Image src={restaurant.logo_url} alt="" width={42} height={42} unoptimized />}
          <span>{restaurant.name}</span>
        </Link>
        {section.showMenuCta && <MenuLink href={menuHref} label={section.buttonLabel} compact />}
      </header>
    )
  }
  if (section.type === 'hero' || section.type === 'hero-video') {
    const isVideo = section.type === 'hero-video' && Boolean(section.videoUrl && section.posterUrl)
    return (
      <section data-component={`home:${section.id}`} className={`home-hero ${toneClass} home-align-${align}`}>
        {(isVideo || section.imageUrl) && (
          <div className="home-hero-media">
            {isVideo
              ? <HomeHeroVideo src={section.videoUrl!} poster={section.posterUrl!} />
              : <Image src={section.imageUrl!} alt="" fill sizes="100vw" priority unoptimized />}
          </div>
        )}
        <div className="home-hero-overlay" />
        <div className="home-hero-content">
          {section.eyebrow && <p className="home-eyebrow">{section.eyebrow}</p>}
          <h1>{section.title || restaurant.name}</h1>
          {section.body && <p className="home-lead">{section.body}</p>}
          {section.showMenuCta && <MenuLink href={menuHref} label={section.buttonLabel} />}
        </div>
      </section>
    )
  }
  if (section.type === 'about') {
    return (
      <section data-component={`home:${section.id}`} className={`home-copy-section ${toneClass} home-align-${align}`}>
        <div className="home-copy-content">
          {section.eyebrow && <p className="home-eyebrow">{section.eyebrow}</p>}
          <h2>{section.title}</h2>
          {section.body && <p>{section.body}</p>}
        </div>
        {section.imageUrl && <Image src={section.imageUrl} alt="" width={1_200} height={900} loading="lazy" unoptimized />}
      </section>
    )
  }
  if (section.type === 'featured-categories') {
    const chosen = section.categoryIds?.length
      ? section.categoryIds.flatMap((id) => categories.find((category) => category.id === id) ?? [])
      : categories.slice(0, 4)
    return (
      <section data-component={`home:${section.id}`} className="home-section-shell">
        <SectionHeading section={section} />
        <div className="home-category-grid">
          {chosen.map((category) => (
            <Link key={category.id} href={buildHomeMenuHref(restaurant.slug, { preview: isPreview, categoryId: category.id })} className="home-category-card">
              {category.image_url && <Image src={category.image_url} alt="" fill sizes="(max-width: 760px) 50vw, 25vw" loading="lazy" unoptimized />}
              <span>{category.name}</span><I.arrow size={18} />
            </Link>
          ))}
        </div>
      </section>
    )
  }
  if (section.type === 'featured-products') {
    const chosen = section.menuItemIds?.length
      ? section.menuItemIds.flatMap((id) => items.find((item) => item.id === id) ?? [])
      : items.slice(0, 4)
    return (
      <section data-component={`home:${section.id}`} className="home-section-shell">
        <SectionHeading section={section} />
        <div className="home-product-grid">
          {chosen.map((item) => (
            <Link key={item.id} href={buildHomeMenuHref(restaurant.slug, { preview: isPreview, itemId: item.id })} className="home-product-card">
              {item.images[0] && <Image src={item.images[0]} alt="" width={800} height={600} loading="lazy" unoptimized />}
              <span><strong>{item.name}</strong><small>{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.price)}</small></span>
            </Link>
          ))}
        </div>
      </section>
    )
  }
  if (section.type === 'hours-location') {
    const settings = (restaurant.settings ?? {}) as Record<string, unknown>
    const address = section.address || (typeof settings.address === 'string' ? settings.address : '')
    const phone = section.phone || (typeof settings.phone === 'string' ? settings.phone : '')
    return (
      <section data-component={`home:${section.id}`} className="home-section-shell">
        <SectionHeading section={section} />
        <div className="home-info-grid">
          <Info icon={<I.clock size={20} />} title="Çalışma saatleri" body={section.hours || 'Güncel saatler için işletmeyle iletişime geçin.'} />
          <Info icon={<I.mapPin size={20} />} title="Konum" body={address || 'Konum bilgisi yakında.'} />
          <Info icon={<I.phoneCall size={20} />} title="İletişim" body={phone || 'İletişim bilgisi yakında.'} />
        </div>
      </section>
    )
  }
  if (section.type === 'social-links') {
    const links = [
      section.instagramUrl ? { label: 'Instagram', href: section.instagramUrl } : null,
      section.facebookUrl ? { label: 'Facebook', href: section.facebookUrl } : null,
      section.websiteUrl ? { label: 'Web sitesi', href: section.websiteUrl } : null,
    ].filter(Boolean) as Array<{ label: string; href: string }>
    if (links.length === 0) return null
    return <section data-component={`home:${section.id}`} className="home-social"><SectionHeading section={section} />{links.map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer">{link.label}<I.externalLink size={15} /></a>)}</section>
  }
  if (section.type === 'gallery' || section.type === 'promo-slider') {
    if (!section.imageUrls?.length) return null
    return <section data-component={`home:${section.id}`} className="home-section-shell"><SectionHeading section={section} /><div className={section.type === 'gallery' ? 'home-gallery' : 'home-promo-row'}>{section.imageUrls.map((url, index) => <Image key={`${url}-${index}`} src={url} alt="" width={840} height={630} loading="lazy" unoptimized />)}</div></section>
  }
  if (section.type === 'footer') {
    return <footer data-component={`home:${section.id}`} className={`home-footer ${toneClass}`}><div><strong>{restaurant.name}</strong><small>© {new Date().getFullYear()} · Masabu ile hazırlanmıştır</small></div>{section.showMenuCta && <MenuLink href={menuHref} label={section.buttonLabel} compact />}</footer>
  }
  return null
}

function MenuLink({ href, label, compact = false }: { href: string; label?: string; compact?: boolean }) {
  return <Link href={href} className={`home-menu-cta${compact ? ' is-compact' : ''}`}>{label?.trim() || 'Menüyü Gör'}<I.arrow size={17} /></Link>
}
function SectionHeading({ section }: { section: HomeSurfaceSection }) { return <div className={`home-section-heading home-align-${section.align ?? 'left'}`}>{section.eyebrow && <p className="home-eyebrow">{section.eyebrow}</p>}<h2>{section.title}</h2>{section.body && <p>{section.body}</p>}</div> }
function Info({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <article className="home-info-card"><span>{icon}</span><div><h3>{title}</h3><p>{body}</p></div></article> }

const HOME_CSS = `
[data-home-experience]{min-height:100dvh;background:var(--home-bg);color:var(--home-text);font-family:var(--home-body),sans-serif}.home-announcement{padding:9px 18px;font-size:12px;font-weight:750;letter-spacing:.02em}.home-tone-brand{background:var(--home-accent);color:#fff}.home-tone-dark{background:#17191d;color:#fff}.home-tone-surface{background:var(--home-surface);color:var(--home-text)}.home-header{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:12px clamp(18px,5vw,72px);background:color-mix(in srgb,var(--home-surface) 92%,transparent);border-bottom:1px solid color-mix(in srgb,var(--home-text) 9%,transparent);position:relative;z-index:5}.home-brand{display:inline-flex;align-items:center;gap:11px;color:inherit;text-decoration:none;font-family:var(--home-display),serif;font-size:clamp(20px,2.5vw,28px);font-weight:800}.home-brand img{width:42px;height:42px;border-radius:calc(var(--home-radius)*.7);object-fit:cover}.home-menu-cta{min-height:48px;padding:0 20px;border-radius:max(10px,var(--home-radius));display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--home-cta);color:var(--home-cta-text);text-decoration:none;font-size:14px;font-weight:850;box-shadow:0 12px 30px color-mix(in srgb,var(--home-cta) 28%,transparent)}.home-menu-cta.is-compact{min-height:44px;padding:0 16px}.home-hero{min-height:min(720px,78dvh);position:relative;display:grid;align-items:center;overflow:hidden;padding:clamp(56px,10vw,130px) clamp(20px,8vw,120px);background:#191b20;color:#fff}.home-hero-media,.home-hero-media>img,.home-video,.home-video video{position:absolute;inset:0;width:100%;height:100%}.home-hero-media img,.home-video video{object-fit:cover}.home-hero-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,12,15,.82),rgba(10,12,15,.32) 60%,rgba(10,12,15,.14))}.home-hero-content{position:relative;z-index:2;max-width:720px}.home-align-center .home-hero-content{margin-inline:auto;text-align:center}.home-hero h1{max-width:13ch;margin:0;font-family:var(--home-display),serif;font-size:clamp(46px,8vw,92px);line-height:.98;letter-spacing:-.045em}.home-align-center .home-hero-content h1{margin-inline:auto}.home-eyebrow{margin:0 0 12px;text-transform:uppercase;letter-spacing:.14em;font-size:11px;font-weight:850}.home-lead{max-width:58ch;margin:22px 0 28px;font-size:clamp(16px,2vw,20px);line-height:1.58;color:rgba(255,255,255,.8)}.home-align-center .home-lead{margin-inline:auto}.home-video button{position:absolute;right:18px;bottom:18px;z-index:3;width:48px;height:48px;border:1px solid rgba(255,255,255,.35);border-radius:999px;background:rgba(0,0,0,.5);color:#fff;display:grid;place-items:center;cursor:pointer}.home-section-shell,.home-copy-section{padding:clamp(58px,8vw,110px) clamp(20px,8vw,120px)}.home-section-heading{max-width:720px;margin-bottom:30px}.home-section-heading.home-align-center{margin-inline:auto;text-align:center}.home-section-heading h2,.home-copy-section h2{margin:0;font-family:var(--home-display),serif;font-size:clamp(32px,5vw,56px);line-height:1.05;letter-spacing:-.035em}.home-section-heading>p:last-child,.home-copy-content>p:last-child{color:var(--home-muted);font-size:16px;line-height:1.7}.home-copy-section{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.9fr);gap:clamp(32px,6vw,90px);align-items:center}.home-copy-section>img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:calc(var(--home-radius)*1.6)}.home-category-grid,.home-product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.home-category-card,.home-product-card{min-height:180px;position:relative;overflow:hidden;border-radius:calc(var(--home-radius)*1.35);background:var(--home-surface);color:var(--home-text);text-decoration:none;border:1px solid color-mix(in srgb,var(--home-text) 9%,transparent)}.home-category-card{display:flex;align-items:flex-end;gap:8px;padding:18px;font-size:17px;font-weight:850}.home-category-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.home-category-card:has(img):after{content:"";position:absolute;inset:0;background:linear-gradient(transparent,rgba(0,0,0,.72))}.home-category-card:has(img)>span,.home-category-card:has(img)>svg{position:relative;z-index:2;color:#fff}.home-category-card>span{flex:1}.home-product-card{display:block}.home-product-card>img{width:100%;aspect-ratio:4/3;object-fit:cover}.home-product-card>span{display:flex;justify-content:space-between;gap:10px;padding:15px}.home-product-card small{color:var(--home-muted)}.home-info-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.home-info-card{display:flex;gap:13px;padding:20px;border-radius:calc(var(--home-radius)*1.2);background:var(--home-surface);border:1px solid color-mix(in srgb,var(--home-text) 9%,transparent)}.home-info-card>span{width:42px;height:42px;display:grid;place-items:center;border-radius:11px;background:var(--home-accent-soft);color:var(--home-accent)}.home-info-card h3{margin:0 0 6px;font-size:15px}.home-info-card p{margin:0;color:var(--home-muted);font-size:13px;line-height:1.55;white-space:pre-line}.home-social{text-align:center;padding:48px 20px}.home-social .home-section-heading{margin-inline:auto}.home-social>a{min-height:44px;display:inline-flex;align-items:center;gap:6px;margin:4px;padding:0 14px;border:1px solid color-mix(in srgb,var(--home-text) 12%,transparent);border-radius:999px;color:inherit;text-decoration:none}.home-gallery,.home-promo-row{display:flex;gap:12px;overflow:auto;scroll-snap-type:x mandatory}.home-gallery img,.home-promo-row img{width:min(70vw,420px);aspect-ratio:4/3;object-fit:cover;scroll-snap-align:start;border-radius:calc(var(--home-radius)*1.2)}.home-footer{padding:40px clamp(20px,8vw,120px);display:flex;align-items:center;justify-content:space-between;gap:20px}.home-footer strong,.home-footer small{display:block}.home-footer strong{font-family:var(--home-display),serif;font-size:24px}.home-footer small{margin-top:5px;opacity:.68;font-size:11px}@media(max-width:760px){.home-header{min-height:66px}.home-brand{font-size:19px}.home-brand img{width:36px;height:36px}.home-hero{min-height:72dvh;padding-top:74px;padding-bottom:74px}.home-hero-overlay{background:linear-gradient(0deg,rgba(10,12,15,.86),rgba(10,12,15,.18))}.home-hero-content{align-self:end}.home-copy-section{grid-template-columns:1fr}.home-category-grid,.home-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.home-info-grid{grid-template-columns:1fr}.home-footer{align-items:flex-start;flex-direction:column}}@media(max-width:420px){.home-header .home-menu-cta{padding-inline:12px}.home-category-grid,.home-product-grid{grid-template-columns:1fr 1fr}.home-category-card{min-height:145px;padding:14px}.home-product-card>span{display:block}.home-product-card small{display:block;margin-top:5px}}@media(prefers-reduced-motion:reduce){[data-home-experience] *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
`
