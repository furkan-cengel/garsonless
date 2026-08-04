'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AppIcons as I } from '../../../icons'
import type { MenuCategory } from '../../../menu/types'
import { makeReaders } from '../lib/sectionHelpers'

export interface StorefrontMemberSummary {
  authenticated: boolean
  name?: string | null
  points?: number
  stamps?: number
  pointsEnabled?: boolean
  stampEnabled?: boolean
}

interface StorefrontSectionProps {
  config: Record<string, string>
  restaurantName: string
  categories?: MenuCategory[]
  menuHref: string
  memberSummary?: StorefrontMemberSummary | null
  onOpenMember?: () => void
  storeStatus?: string
}

export function StorefrontHeroSection({ config, restaurantName, menuHref, storeStatus }: StorefrontSectionProps) {
  const { text, number, bool } = makeReaders(config)
  const mediaType = text('mediaType', config.videoUrl ? 'video' : config.imageUrl ? 'image' : 'none')
  const imageUrl = text('imageUrl', '')
  const videoUrl = text('videoUrl', '')
  const posterUrl = text('posterUrl', '')
  const alignValue = text('align', 'left')
  const align: 'left' | 'center' | 'right' = alignValue === 'center' || alignValue === 'right' ? alignValue : 'left'
  const position = resolvePosition(text('imagePosition', 'center'))
  const overlay = Math.min(80, Math.max(0, number('overlay', 42))) / 100
  const height = Math.min(820, Math.max(420, number('height', 640)))
  const contentWidth = Math.min(760, Math.max(320, number('contentWidth', 620)))
  const defaultPositionX = align === 'center' ? 50 : align === 'right' ? 100 : 0
  const contentPositionX = Math.min(100, Math.max(0, number('contentPositionX', defaultPositionX)))
  const contentPositionY = Math.min(100, Math.max(0, number('contentPositionY', 100)))
  const textColor = text('textColor', '#ffffff')
  const title = text('title', '').trim() || restaurantName
  const body = text('body', '').trim() || 'Mutfağımızı, hikâyemizi ve öne çıkan lezzetlerimizi keşfedin.'
  const eyebrow = text('eyebrow', 'HOŞ GELDİNİZ')
  const showStatus = bool('showStatus', true)
  const showEyebrow = bool('showEyebrow', true)
  const showTitle = bool('showTitle', true)
  const showBody = bool('showBody', true)
  const showCta = bool('showCta', true)

  return (
    <section data-component="home:storefront-hero" data-home-hero style={{ minHeight: height, position: 'relative', display: 'grid', alignItems: 'end', overflow: 'hidden', background: 'linear-gradient(145deg,var(--p-accent),color-mix(in srgb,var(--p-accent) 58%,#111318))', color: textColor }}>
      {mediaType === 'image' && imageUrl ? <img src={imageUrl} alt="" fetchPriority="high" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover', objectPosition: position, background: 'var(--p-text)' }} /> : null}
      {mediaType === 'video' && videoUrl && posterUrl ? <StorefrontVideo src={videoUrl} poster={posterUrl} fit={text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover'} position={position} /> : null}
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `linear-gradient(0deg,rgba(8,10,13,${Math.min(.92, overlay + .28)}),rgba(8,10,13,${Math.max(.08, overlay - .2)}) 72%)` }} />
      <div data-home-hero-content-layer style={{ position: 'absolute', inset: 0, zIndex: 2, padding: 'clamp(28px,5vw,64px) max(var(--p-pad),clamp(20px,7vw,92px))', boxSizing: 'border-box', pointerEvents: 'none' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 1240, marginInline: 'auto' }}>
          <div
            data-home-hero-content
            data-position-x={contentPositionX}
            data-position-y={contentPositionY}
            style={{
              position: 'absolute',
              left: `${contentPositionX}%`,
              top: `${contentPositionY}%`,
              width: `min(${contentWidth}px,100%)`,
              maxWidth: '100%',
              transform: `translate(-${contentPositionX}%,-${contentPositionY}%)`,
              textAlign: align,
              pointerEvents: 'auto',
            }}
          >
            {showStatus && storeStatus ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 30, marginBottom: 16, padding: '0 11px', border: '1px solid rgba(255,255,255,.28)', borderRadius: 999, background: 'rgba(0,0,0,.28)', fontSize: 11.5, fontWeight: 800 }}><span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: storeStatus === 'Şu an açık' ? '#58d68d' : '#ff9a8a' }} />{storeStatus}</span> : null}
            {showEyebrow && eyebrow && <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 850, letterSpacing: '.15em' }}>{eyebrow}</p>}
            {showTitle && <h1 style={{ margin: 0, fontFamily: 'var(--p-display)', fontSize: 'clamp(44px,8vw,88px)', lineHeight: .98, letterSpacing: '-.045em', textWrap: 'balance' }}>{title}</h1>}
            {showBody && body && <p style={{ maxWidth: 590, margin: align === 'center' ? '22px auto 0' : align === 'right' ? '22px 0 0 auto' : '22px 0 0', color: 'color-mix(in srgb,currentColor 78%,transparent)', fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.58 }}>{body}</p>}
            {showCta && <MenuCta href={menuHref} label={text('cta', 'Menüyü Gör')} />}
          </div>
        </div>
      </div>
    </section>
  )
}

export function StorefrontStorySection({ config }: StorefrontSectionProps) {
  const { text } = makeReaders(config)
  const imageUrl = text('imageUrl', '')
  const layout = text('layout', 'media-right')
  const textOnly = layout === 'text-only' || !imageUrl
  return <section data-component="home:story" style={{ padding: 'clamp(58px,8vw,104px) max(var(--p-pad),clamp(20px,7vw,92px))' }}>
    <div style={{ maxWidth: 1200, marginInline: 'auto', display: 'grid', gridTemplateColumns: textOnly ? 'minmax(0,760px)' : 'repeat(2,minmax(0,1fr))', gap: 'clamp(28px,6vw,76px)', alignItems: 'center' }}>
      <div style={{ order: layout === 'media-left' ? 2 : 1 }}>
        <HomeHeading eyebrow={text('eyebrow', 'BİZİ TANIYIN')} title={text('title', 'Hakkımızda')} body={text('body', 'İşletmemizi, mutfağımızı ve yaklaşımımızı yakından tanıyın.')} />
      </div>
      {!textOnly && <img src={imageUrl} alt="" loading="lazy" decoding="async" style={{ order: layout === 'media-left' ? 1 : 2, width: '100%', aspectRatio: '4/3', objectFit: text('imageFit', 'cover') === 'contain' ? 'contain' : 'cover', objectPosition: resolvePosition(text('imagePosition', 'center')), borderRadius: 'calc(var(--p-radius) * 1.6)', background: 'var(--p-soft)' }} />}
    </div>
    <style>{'@media(max-width:720px){[data-component="home:story"]>div{grid-template-columns:1fr!important}[data-component="home:story"] img{order:2!important}}'}</style>
  </section>
}

export function StorefrontCategoriesSection({ config, categories = [], menuHref }: StorefrontSectionProps) {
  const { text, number } = makeReaders(config)
  const selectedIds = [1, 2, 3, 4].map((index) => text(`category${index}Id`, '')).filter(Boolean)
  const selected = selectedIds.length > 0
    ? selectedIds.flatMap((id) => categories.find((category) => category.id === id) ?? [])
    : categories.slice(0, 4)
  if (selected.length === 0) return null
  const columns = Math.min(4, Math.max(2, number('columns', 4)))
  const cardHeight = Math.min(300, Math.max(140, number('cardHeight', 210)))
  return <section data-component="home:featured-categories" style={{ padding: 'clamp(52px,8vw,96px) max(var(--p-pad),clamp(20px,7vw,92px))', background: 'var(--p-bg)' }}>
    <div style={{ maxWidth: 1200, marginInline: 'auto' }}>
      <HomeHeading eyebrow={text('eyebrow', 'MENÜDEN')} title={text('title', 'Menüden seçtiklerimiz')} body={text('body', 'Öne çıkan kategorileri keşfedin.')} />
      <div data-home-category-grid style={{ '--home-category-columns': columns, display: 'grid', gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`, gap: 14 } as CSSProperties}>
        {selected.map((category) => <a key={category.id} href={`${menuHref}#category-${encodeURIComponent(category.id)}`} style={{ minHeight: cardHeight, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-end', gap: 8, padding: 18, border: '1px solid var(--p-border)', borderRadius: 'calc(var(--p-radius) * 1.35)', background: 'var(--p-card)', color: category.image_url ? '#fff' : 'var(--p-text)', textDecoration: 'none', boxSizing: 'border-box' }}>
          {category.image_url ? <><img src={category.image_url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /><span aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.76))' }} /></> : null}
          <strong style={{ position: 'relative', zIndex: 1, flex: 1, fontSize: 17 }}>{category.name}</strong><I.arrow size={18} style={{ position: 'relative', zIndex: 1 }} />
        </a>)}
      </div>
    </div>
    <style>{'@media(max-width:760px){[data-home-category-grid]{grid-template-columns:repeat(2,minmax(0,1fr))!important}}'}</style>
  </section>
}

export function StorefrontLoyaltySection({ config, memberSummary, onOpenMember }: StorefrontSectionProps) {
  const { text } = makeReaders(config)
  const tone = text('tone', 'brand')
  const authenticated = memberSummary?.authenticated === true
  const details = authenticated
    ? [memberSummary?.pointsEnabled ? `${memberSummary.points ?? 0} puan` : null, memberSummary?.stampEnabled ? `${memberSummary.stamps ?? 0} damga` : null].filter(Boolean).join(' · ')
    : ''
  const palette = tone === 'dark'
    ? { background: '#15171b', color: '#fff', muted: 'rgba(255,255,255,.7)', chip: 'rgba(255,255,255,.1)' }
    : tone === 'surface'
      ? { background: 'var(--p-card)', color: 'var(--p-text)', muted: 'var(--p-text-2)', chip: 'var(--p-accent-soft)' }
      : { background: 'var(--p-accent)', color: '#fff', muted: 'rgba(255,255,255,.78)', chip: 'rgba(255,255,255,.14)' }
  return <section data-component="home:loyalty-teaser" style={{ padding: 'clamp(44px,7vw,82px) max(var(--p-pad),clamp(20px,7vw,92px))' }}>
    <div style={{ maxWidth: 1200, marginInline: 'auto', padding: 'clamp(26px,5vw,58px)', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 26, alignItems: 'center', borderRadius: 'calc(var(--p-radius) * 1.6)', background: palette.background, color: palette.color }}>
      <div><p style={{ margin: '0 0 10px', fontSize: 10.5, fontWeight: 850, letterSpacing: '.14em' }}>{text('eyebrow', 'MASABU HESABI')}</p><h2 style={{ margin: 0, font: '700 clamp(30px,5vw,52px)/1.04 var(--p-display)', letterSpacing: '-.035em' }}>{text('title', authenticated ? `Hoş geldin${memberSummary?.name ? `, ${memberSummary.name.split(' ')[0]}` : ''}` : 'Her ziyaretin değerli')}</h2><p style={{ maxWidth: 650, margin: '15px 0 0', color: palette.muted, lineHeight: 1.6 }}>{authenticated ? (details || text('memberBody', 'Avantajlarını ve geçmişini hesabından görüntüleyebilirsin.')) : text('guestBody', 'Favorilerini, siparişlerini ve avantajlarını tek yerde tut.')}</p></div>
      {onOpenMember ? <button type="button" onClick={onOpenMember} style={{ minHeight: 48, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 9, border: 0, borderRadius: 'var(--p-radius)', background: palette.chip, color: 'inherit', font: '800 14px var(--p-body)', cursor: 'pointer' }}>{text('cta', authenticated ? 'Hesabımı aç' : 'Üye ol')}<I.arrow size={17} /></button> : null}
    </div>
    <style>{'@media(max-width:680px){[data-component="home:loyalty-teaser"]>div{grid-template-columns:1fr!important}[data-component="home:loyalty-teaser"] button{width:100%;justify-content:center}}'}</style>
  </section>
}

export function StorefrontMenuCtaSection({ config, menuHref }: StorefrontSectionProps) {
  const { text } = makeReaders(config)
  const align = text('align', 'center') === 'left' ? 'left' : 'center'
  const tone = text('tone', 'dark')
  const background = tone === 'brand' ? 'var(--p-accent)' : tone === 'surface' ? 'var(--p-card)' : '#15171b'
  const color = tone === 'surface' ? 'var(--p-text)' : '#fff'
  return <section data-component="home:menu-cta" style={{ padding: 'clamp(58px,9vw,112px) max(var(--p-pad),clamp(20px,7vw,92px))', background, color, textAlign: align }}>
    <div style={{ maxWidth: 820, marginInline: align === 'center' ? 'auto' : undefined }}><HomeHeading eyebrow={text('eyebrow', 'MASANIZ HAZIR')} title={text('title', 'Menüyü keşfetmeye hazır mısınız?')} body={text('body', 'Güncel ürünleri ve lezzetleri görüntüleyin.')} /><MenuCta href={menuHref} label={text('cta', 'Menüyü Gör')} /></div>
  </section>
}

function HomeHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div style={{ marginBottom: 28 }}>{eyebrow && <p style={{ margin: '0 0 11px', color: 'var(--p-accent)', fontSize: 10.5, fontWeight: 850, letterSpacing: '.14em' }}>{eyebrow}</p>}<h2 style={{ margin: 0, font: '700 clamp(32px,5vw,56px)/1.04 var(--p-display)', letterSpacing: '-.035em', textWrap: 'balance' }}>{title}</h2>{body && <p style={{ maxWidth: 660, margin: '16px 0 0', color: 'color-mix(in srgb,currentColor 68%,transparent)', fontSize: 16, lineHeight: 1.68 }}>{body}</p>}</div>
}

function MenuCta({ href, label }: { href: string; label: string }) {
  return <a href={href} style={{ minHeight: 50, marginTop: 26, padding: '0 20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 'var(--p-radius)', background: 'var(--p-cta)', color: 'var(--p-cta-text)', textDecoration: 'none', fontSize: 14, fontWeight: 850, boxShadow: '0 16px 32px -18px var(--p-cta)' }}>{label.trim() || 'Menüyü Gör'}<I.arrow size={17} /></a>
}

function StorefrontVideo({ src, poster, fit, position }: { src: string; poster: string; fit: 'cover' | 'contain'; position: string }) {
  const [canPlay, setCanPlay] = useState(false)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    setCanPlay(!reduced && !saveData)
  }, [])
  const toggle = async () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) { await video.play(); setPlaying(true) } else { video.pause(); setPlaying(false) }
  }
  return <div style={{ position: 'absolute', inset: 0 }}>
    <img src={poster} alt="" fetchPriority="high" style={{ width: '100%', height: '100%', objectFit: fit, objectPosition: position }} />
    {canPlay ? <video ref={videoRef} src={src} poster={poster} muted loop playsInline autoPlay onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, objectPosition: position }} /> : null}
    {canPlay ? <button type="button" aria-label={playing ? 'Videoyu duraklat' : 'Videoyu oynat'} onClick={() => void toggle()} style={{ position: 'absolute', right: 18, bottom: 18, zIndex: 4, width: 48, height: 48, display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,.4)', borderRadius: 999, background: 'rgba(0,0,0,.55)', color: '#fff', cursor: 'pointer' }}>{playing ? <I.pause size={18} /> : <I.play size={18} />}</button> : null}
  </div>
}

function resolvePosition(value: string) {
  return value === 'top' || value === 'bottom' || value === 'left' || value === 'right' ? value : 'center'
}
