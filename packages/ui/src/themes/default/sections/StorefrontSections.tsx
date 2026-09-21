'use client'

import { useMenuReaders } from '../../../menu/MenuLocaleContext'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AppIcons as I } from '../../../icons'
import type { MenuCategory } from '../../../menu/types'
import { makeReaders } from '../lib/sectionHelpers'
import type { MemberOpenTarget } from '../../types'
import { resolveVideoHero, type ResolvedVideoHero, type VideoHeroPreviewMode } from './videoHeroModel'

export interface StorefrontMemberSummary {
  authenticated: boolean
  name?: string | null
  points?: number
  stamps?: number
  pointsEnabled?: boolean
  stampEnabled?: boolean
}

export interface StoreStatusPresentation {
  label: string
  tone: 'open' | 'closed' | 'unknown'
}

interface StorefrontSectionProps {
  config: Record<string, string>
  restaurantName: string
  categories?: MenuCategory[]
  menuHref: string
  memberSummary?: StorefrontMemberSummary | null
  onOpenMember?: (target?: MemberOpenTarget) => void
  storeStatus?: StoreStatusPresentation
}

export function StorefrontHeroSection(props: StorefrontSectionProps & { previewMode?: VideoHeroPreviewMode }) {
  const mediaType = makeReaders(props.config).text('mediaType', props.config.videoUrl ? 'video' : props.config.imageUrl ? 'image' : 'none')
  if (mediaType === 'video') {
    const hero = resolveVideoHero(props.config, {
      ...(props.previewMode ? { previewMode: props.previewMode } : {}),
      restaurantName: props.restaurantName,
    })
    if (hero.isModern) return <ModernStorefrontVideoHero {...props} hero={hero} />
  }
  return <LegacyStorefrontHeroSection {...props} />
}

function LegacyStorefrontHeroSection({ config, restaurantName, menuHref, storeStatus }: StorefrontSectionProps) {
  const { text, number, bool } = useMenuReaders(config)
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
            {showStatus && storeStatus ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 30, marginBottom: 16, padding: '0 11px', border: '1px solid rgba(255,255,255,.28)', borderRadius: 999, background: 'rgba(0,0,0,.28)', fontSize: 11.5, fontWeight: 800 }}><span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: storeStatus.tone === 'open' ? '#58d68d' : storeStatus.tone === 'closed' ? '#ff9a8a' : '#d5d7dc' }} />{storeStatus.label}</span> : null}
            {showEyebrow && eyebrow && <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 850, letterSpacing: '.15em' }}>{eyebrow}</p>}
            {showTitle && <h1 style={{ margin: 0, fontFamily: mediaType === 'video' ? 'var(--p-body)' : 'var(--p-display)', fontSize: 'clamp(44px,8vw,88px)', lineHeight: .98, letterSpacing: '-.045em', textWrap: 'balance' }}>{title}</h1>}
            {showBody && body && <p style={{ maxWidth: 590, margin: align === 'center' ? '22px auto 0' : align === 'right' ? '22px 0 0 auto' : '22px 0 0', color: textColor, opacity: .82, fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.58 }}>{body}</p>}
            {showCta && mediaType !== 'video' ? <MenuCta href={menuHref} label={text('cta', 'Menüyü Gör')} /> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function ModernStorefrontVideoHero({ hero, storeStatus }: StorefrontSectionProps & { hero: ResolvedVideoHero }) {
  if (hero.previewMode === 'public' && hero.mediaState !== 'ready') return null
  if (hero.previewMode === 'editor' && hero.mediaState !== 'ready') {
    const missing = hero.mediaState === 'poster-missing'
      ? 'Poster eksik'
      : hero.mediaState === 'video-missing'
        ? 'Video eksik'
        : 'Video ve poster gerekli'
    return <section data-component="home:storefront-hero" data-video-hero-version="2" data-video-hero-state={hero.mediaState} className="garsonless-video-hero-setup" style={{ '--video-hero-min-height': `${Math.min(hero.height, 520)}px` } as CSSProperties}>
      <span className="garsonless-video-hero-setup__icon" aria-hidden><I.play size={28} /></span>
      <strong>{missing}</strong>
      <span>İçerik sekmesinden gerekli medyayı yüklediğinizde canlı önizleme burada görünecek.</span>
      <style>{videoHeroStyles}</style>
    </section>
  }

  const effectiveStatus = storeStatus ?? (hero.previewMode === 'catalog' ? { label: 'Şu an açık', tone: 'open' as const } : null)
  const overlay = hero.overlay / 100
  return (
    <section
      data-component="home:storefront-hero"
      data-home-hero
      data-video-hero-version="2"
      data-video-hero-state={hero.mediaState}
      className="garsonless-video-hero"
      style={{
        '--video-hero-min-height': `${hero.height}px`,
        '--video-hero-content-width': `${hero.contentWidth}px`,
        '--video-hero-text': hero.textColor,
        '--video-hero-scrim': hero.scrimColor,
        '--video-hero-overlay-bottom': Math.min(.92, overlay + .28),
        '--video-hero-overlay-top': Math.max(.08, overlay - .2),
      } as CSSProperties}
    >
      <span className="garsonless-video-hero__overlay" aria-hidden />
      <div className="garsonless-video-hero__layer">
        <div className="garsonless-video-hero__frame" data-placement={hero.placement}>
          <div className="garsonless-video-hero__content">
            {hero.showStatus && effectiveStatus ? <span className="garsonless-video-hero__status"><span aria-hidden data-tone={effectiveStatus.tone} />{effectiveStatus.label}</span> : null}
            {hero.showEyebrow && hero.eyebrow ? <p className="garsonless-video-hero__eyebrow">{hero.eyebrow}</p> : null}
            {hero.showTitle && hero.title ? <h1>{hero.title}</h1> : null}
            {hero.showBody && hero.body ? <p className="garsonless-video-hero__body">{hero.body}</p> : null}
          </div>
        </div>
      </div>
      {hero.mediaState === 'catalog' ? <div className="garsonless-video-hero__catalog-media" aria-hidden><span><I.play size={28} /></span><b>Örnek video</b></div> : null}
      {hero.mediaState === 'ready' ? <StorefrontVideo src={hero.videoUrl} poster={hero.posterUrl} fit={hero.imageFit} position={hero.imagePosition} /> : null}
      {hero.showExplore ? <button type="button" className="garsonless-video-hero__explore" data-animate={hero.animateExplore ? 'true' : 'false'} aria-label={`${hero.exploreLabel}: sonraki bölüme git`} onClick={(event) => scrollPastVideoHero(event.currentTarget)}>
        <span>{hero.exploreLabel}</span>
        <I.chevDown size={20} />
      </button> : null}
      <style>{videoHeroStyles}</style>
    </section>
  )
}

function scrollPastVideoHero(trigger: HTMLElement) {
  const hero = trigger.closest<HTMLElement>('[data-home-hero]')
  if (!hero) return
  const blockList = hero.closest<HTMLElement>('[data-home-blocks]')
  const nextBlock = hero.nextElementSibling
  const afterBlocks = blockList?.nextElementSibling
  const target = nextBlock instanceof HTMLElement
    ? nextBlock
    : afterBlocks instanceof HTMLElement ? afterBlocks : null
  if (!target) return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
}

export function StorefrontStorySection({ config }: StorefrontSectionProps) {
  const { text } = useMenuReaders(config)
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
  const { text, number } = useMenuReaders(config)
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
  const { text } = useMenuReaders(config)
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
      <div><p style={{ margin: '0 0 10px', fontSize: 10.5, fontWeight: 850, letterSpacing: '.14em' }}>{text('eyebrow', 'masabu HESABI')}</p><h2 style={{ margin: 0, font: '700 clamp(30px,5vw,52px)/1.04 var(--p-display)', letterSpacing: '-.035em' }}>{text('title', authenticated ? `Hoş geldin${memberSummary?.name ? `, ${memberSummary.name.split(' ')[0]}` : ''}` : 'Her ziyaretin değerli')}</h2><p style={{ maxWidth: 650, margin: '15px 0 0', color: palette.muted, lineHeight: 1.6 }}>{authenticated ? (details || text('memberBody', 'Avantajlarını ve geçmişini hesabından görüntüleyebilirsin.')) : text('guestBody', 'Favorilerini, siparişlerini ve avantajlarını tek yerde tut.')}</p></div>
      {onOpenMember ? <button type="button" onClick={() => onOpenMember()} style={{ minHeight: 48, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 9, border: 0, borderRadius: 'var(--p-radius)', background: palette.chip, color: 'inherit', font: '800 14px var(--p-body)', cursor: 'pointer' }}>{text('cta', authenticated ? 'Hesabımı aç' : 'Üye ol')}<I.arrow size={17} /></button> : null}
    </div>
    <style>{'@media(max-width:680px){[data-component="home:loyalty-teaser"]>div{grid-template-columns:1fr!important}[data-component="home:loyalty-teaser"] button{width:100%;justify-content:center}}'}</style>
  </section>
}

export function StorefrontMenuCtaSection({ config, menuHref }: StorefrontSectionProps) {
  const { text } = useMenuReaders(config)
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

function MenuCta({ href, label, className }: { href: string; label: string; className?: string }) {
  return <a href={href} className={className} style={{ minHeight: 50, marginTop: 26, padding: '0 20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 'var(--p-radius)', background: 'var(--p-cta)', color: 'var(--p-cta-text)', textDecoration: 'none', fontSize: 14, fontWeight: 850, boxShadow: '0 16px 32px -18px var(--p-cta)' }}>{label.trim() || 'Menüyü Gör'}<I.arrow size={17} /></a>
}

function StorefrontVideo({ src, poster, fit, position }: { src: string; poster: string; fit: 'cover' | 'contain'; position: string }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [sourceEnabled, setSourceEnabled] = useState(false)
  const [autoEligible, setAutoEligible] = useState(false)
  const [visible, setVisible] = useState(true)
  const [documentVisible, setDocumentVisible] = useState(true)
  const [failed, setFailed] = useState(false)
  const userPausedRef = useRef(false)
  const manualPlayRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    const eligible = !reduced && !saveData
    setAutoEligible(eligible)
    setSourceEnabled(eligible)
  }, [])

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), { threshold: .25 })
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const update = () => setDocumentVisible(document.visibilityState !== 'hidden')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  const play = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    try {
      await video.play()
      setPlaying(true)
      setFailed(false)
    } catch {
      setPlaying(false)
      setFailed(true)
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !sourceEnabled || failed) return
    if (!visible || !documentVisible) {
      if (!video.paused) video.pause()
      return
    }
    if (!userPausedRef.current && (autoEligible || manualPlayRef.current)) void play()
  }, [autoEligible, documentVisible, failed, play, sourceEnabled, visible])

  const toggle = () => {
    const video = videoRef.current
    if (failed || !sourceEnabled || !video) {
      userPausedRef.current = false
      manualPlayRef.current = true
      setFailed(false)
      setSourceEnabled(true)
      return
    }
    if (video.paused) {
      userPausedRef.current = false
      manualPlayRef.current = true
      void play()
    } else {
      userPausedRef.current = true
      video.pause()
      setPlaying(false)
    }
  }

  const label = failed ? 'Videoyu yeniden dene' : playing ? 'Videoyu duraklat' : 'Videoyu oynat'
  return <div ref={rootRef} className="garsonless-video-hero__media">
    <img src={poster} alt="" fetchPriority="high" decoding="async" onError={(event) => { event.currentTarget.style.display = 'none' }} style={{ objectFit: fit, objectPosition: position }} />
    {sourceEnabled && !failed ? <video ref={videoRef} src={src} poster={poster} muted loop playsInline preload="none" aria-hidden="true" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false) }} style={{ objectFit: fit, objectPosition: position, opacity: playing ? 1 : 0, transition: 'opacity 180ms ease' }} /> : null}
    <button className="garsonless-video-hero__playback" type="button" aria-label={label} onClick={toggle}>{playing ? <I.pause size={18} /> : <I.play size={18} />}</button>
    <span className="garsonless-video-hero__sr-status" role="status" aria-live="polite">{failed ? 'Video oynatılamadı; poster gösteriliyor.' : ''}</span>
  </div>
}

const videoHeroStyles = `
.garsonless-video-hero{position:relative;isolation:isolate;container-type:inline-size;display:grid;min-height:max(var(--video-hero-min-height),calc(100svh - var(--p-header-flow-height,var(--p-header-sticky-height,64px))));overflow:hidden;background:linear-gradient(145deg,var(--p-accent),color-mix(in srgb,var(--p-accent) 58%,#111318));color:var(--video-hero-text);font-family:var(--p-body,inherit);box-sizing:border-box}
.garsonless-video-hero__overlay{position:absolute;inset:0;z-index:1;background:linear-gradient(0deg,rgba(8,10,13,var(--video-hero-overlay-bottom)),rgba(8,10,13,var(--video-hero-overlay-top)) 72%);pointer-events:none}
.garsonless-video-hero__layer{position:relative;z-index:2;min-height:inherit;display:grid;padding:clamp(28px,5vw,64px) max(var(--p-pad),clamp(20px,7vw,92px));padding-bottom:max(104px,clamp(28px,5vw,64px));box-sizing:border-box;pointer-events:none}
.garsonless-video-hero__frame{width:100%;max-width:1240px;min-height:100%;margin-inline:auto;display:grid}.garsonless-video-hero__content{position:relative;isolation:isolate;width:min(var(--video-hero-content-width),100%);max-width:100%;pointer-events:auto;overflow-wrap:anywhere}
.garsonless-video-hero__content:before{content:"";position:absolute;z-index:-1;inset:clamp(-34px,-3vw,-18px);border-radius:32px;background:radial-gradient(ellipse at center,var(--video-hero-scrim),transparent 72%);pointer-events:none}
.garsonless-video-hero__frame[data-placement^="top"] .garsonless-video-hero__content{align-self:start}.garsonless-video-hero__frame[data-placement^="bottom"] .garsonless-video-hero__content{align-self:end}.garsonless-video-hero__frame[data-placement="center"] .garsonless-video-hero__content,.garsonless-video-hero__frame[data-placement^="center-"] .garsonless-video-hero__content{align-self:center}
.garsonless-video-hero__frame[data-placement$="left"] .garsonless-video-hero__content{justify-self:start;text-align:left}.garsonless-video-hero__frame[data-placement$="right"] .garsonless-video-hero__content{justify-self:end;text-align:right}.garsonless-video-hero__frame[data-placement$="center"] .garsonless-video-hero__content,.garsonless-video-hero__frame[data-placement="center"] .garsonless-video-hero__content{justify-self:center;text-align:center}
.garsonless-video-hero__status{display:inline-flex;align-items:center;gap:7px;min-height:30px;margin-bottom:16px;padding:0 11px;border:1px solid rgba(255,255,255,.3);border-radius:999px;background:rgba(0,0,0,.32);font-size:11.5px;font-weight:800}.garsonless-video-hero__status>span{width:7px;height:7px;border-radius:999px;background:#d5d7dc}.garsonless-video-hero__status>span[data-tone="open"]{background:#58d68d}.garsonless-video-hero__status>span[data-tone="closed"]{background:#ff9a8a}
.garsonless-video-hero__eyebrow{margin:0 0 12px;font-size:11px;font-weight:850;letter-spacing:.15em}.garsonless-video-hero h1{margin:0;font-family:var(--p-body,inherit);font-size:clamp(34px,7vw,76px);font-weight:700;line-height:1;letter-spacing:-.042em;text-wrap:balance;overflow-wrap:anywhere}.garsonless-video-hero__body{max-width:590px;margin:20px 0 0;color:var(--video-hero-text);opacity:.82;font-size:clamp(15px,2vw,20px);line-height:1.58}.garsonless-video-hero__frame[data-placement$="center"] .garsonless-video-hero__body,.garsonless-video-hero__frame[data-placement="center"] .garsonless-video-hero__body{margin-inline:auto}.garsonless-video-hero__frame[data-placement$="right"] .garsonless-video-hero__body{margin-left:auto}
.garsonless-video-hero__playback:focus-visible{outline:3px solid #fff;outline-offset:3px}
.garsonless-video-hero__media,.garsonless-video-hero__catalog-media{position:absolute;inset:0;z-index:0}.garsonless-video-hero__media>img,.garsonless-video-hero__media>video{position:absolute;inset:0;width:100%;height:100%;display:block}.garsonless-video-hero__playback{position:absolute;right:18px;bottom:18px;z-index:4;width:48px;height:48px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.42);border-radius:999px;background:rgba(0,0,0,.62);color:#fff;cursor:pointer}.garsonless-video-hero__playback:hover{background:rgba(0,0,0,.76)}
.garsonless-video-hero__explore{position:absolute;left:50%;bottom:14px;z-index:4;min-width:72px;min-height:54px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:4px 10px;border:0;background:transparent;color:#fff;font:800 11px/1.2 var(--p-body,inherit);letter-spacing:.08em;text-transform:uppercase;text-shadow:0 2px 12px rgba(0,0,0,.7);cursor:pointer}.garsonless-video-hero__explore svg{filter:drop-shadow(0 2px 6px rgba(0,0,0,.7))}.garsonless-video-hero__explore[data-animate="true"] svg{animation:garsonless-video-hero-explore 1.45s ease-in-out infinite}.garsonless-video-hero__explore[data-animate="true"]:hover svg{animation-duration:.85s}.garsonless-video-hero__explore:focus-visible{outline:3px solid #fff;outline-offset:2px;border-radius:12px}@keyframes garsonless-video-hero-explore{0%,100%{transform:translateY(0)}50%{transform:translateY(6px)}}
.garsonless-video-hero__catalog-media{display:grid;place-content:center;gap:8px;text-align:center;background:linear-gradient(135deg,color-mix(in srgb,var(--p-accent) 72%,#0b1014),#151a20)}.garsonless-video-hero__catalog-media span{width:64px;height:64px;display:grid;place-items:center;margin:auto;border:1px solid rgba(255,255,255,.34);border-radius:50%;background:rgba(0,0,0,.28)}.garsonless-video-hero__catalog-media b{font-size:11px;letter-spacing:.08em;text-transform:uppercase}
.garsonless-video-hero__sr-status{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.garsonless-video-hero-setup{min-height:var(--video-hero-min-height);padding:32px;display:grid;place-content:center;justify-items:center;gap:9px;text-align:center;background:color-mix(in srgb,var(--p-card) 92%,var(--p-accent) 8%);color:var(--p-text);font-family:var(--p-body,inherit);box-sizing:border-box}.garsonless-video-hero-setup__icon{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:var(--p-accent-soft);color:var(--p-accent)}.garsonless-video-hero-setup strong{font-size:18px}.garsonless-video-hero-setup>span:last-of-type{max-width:430px;color:var(--p-text-2);font-size:13px;line-height:1.5}
@container (max-width:520px){.garsonless-video-hero__layer{padding:34px max(20px,var(--p-pad));padding-bottom:104px}.garsonless-video-hero__content{width:100%}.garsonless-video-hero__content:before{inset:-20px}.garsonless-video-hero__playback{right:14px;bottom:14px}.garsonless-video-hero h1{font-size:clamp(32px,11vw,52px)}}
@media(prefers-reduced-motion:reduce){.garsonless-video-hero__media>video{transition:none!important}.garsonless-video-hero__explore svg{animation:none!important}}
`

function resolvePosition(value: string) {
  return value === 'top' || value === 'bottom' || value === 'left' || value === 'right' ? value : 'center'
}
