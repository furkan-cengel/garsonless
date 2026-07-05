'use client'

import { useMemo, useState } from 'react'
import { useTheme } from '../../menu/ThemeContext'
import { AnnouncementBar } from '../../menu/AnnouncementBar'
import type { ThemeMenuPageProps } from '../types'
import type { MenuCategory } from '../../menu/types'
import type { CSSProperties, ReactNode } from 'react'

const CATEGORY_COLORS = ['#d0e4ff', '#ffdad2', '#fff2cc', '#e5e2e1', '#d8eadf']
const CUSTOM_SECTION_IDS = new Set([
  'hero-banner',
  'promo-strip',
  'combo-ribbon',
  'discount-badge',
  'featured-scroll',
  'chef-pick',
  'daily-special',
  'reviews',
  'hours',
  'allergens',
  'gallery',
  'request-buttons',
  'wifi-info',
  'social-block',
  'footer',
])

export function SpainMenuPage({ categories, renderItems, menuFilters, filterEmptyState, tableId, tableLabel: tableName }: ThemeMenuPageProps) {
  const { restaurantName, theme } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const displayName = restaurantName || 'Taste of Spain'
  const tableLabel = tableName ?? (tableId ? `Table ${tableId.slice(0, 4).toUpperCase()}` : 'Table 12')
  const textureStyle: CSSProperties =
    theme.texture === 'grid'
      ? {
          backgroundImage: 'linear-gradient(rgba(28,28,25,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(28,28,25,.035) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }
      : theme.texture === 'noise'
        ? {
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(28,28,25,.05) 1px, transparent 0)',
            backgroundSize: '13px 13px',
          }
        : {}
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const pageBlocks = useMemo(() => {
    const stored = theme.pageBlocks?.filter((block) =>
      block.type === 'nav' ||
      (block.type === 'section' && CUSTOM_SECTION_IDS.has(block.id)) ||
      (block.type === 'category' && categoryById.has(block.id)),
    ) ?? []

    if (stored.length > 0) {
      return stored.some((block) => block.type === 'nav')
        ? stored
        : [{ type: 'nav' as const, id: 'category-nav' }, ...stored]
    }

    return [
      { type: 'nav' as const, id: 'category-nav' },
      ...(theme.sections ?? []).filter((id) => CUSTOM_SECTION_IDS.has(id)).map((id) => ({ type: 'section' as const, id })),
      ...categories.map((category) => ({ type: 'category' as const, id: category.id })),
    ]
  }, [categories, categoryById, theme.pageBlocks, theme.sections])

  function showToast() {
    setToastVisible(true)
    window.setTimeout(() => setToastVisible(false), 3000)
  }

  function renderCategoryCard(category: MenuCategory, index: number) {
    const minimal = theme.catnavStyle === 'segmented'
    const outlined = theme.catnavStyle === 'outlined'
    return (
      <a
        key={category.id}
        href={`#section-${category.id}`}
        data-component="category-card"
        style={{
          flex: '0 0 256px',
          height: 128,
          borderRadius: theme.radius,
          background: minimal ? 'rgba(255,255,255,.72)' : outlined ? 'var(--p-bg)' : CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          color: 'var(--p-text)',
          border: outlined ? '1px solid var(--p-accent-soft)' : 'none',
          boxShadow: minimal ? '0 1px 8px rgba(28,28,25,.06)' : 'none',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
          textDecoration: 'none',
          transition: 'transform 120ms ease',
        }}
      >
        {theme.catnavShowIcons && <MenuIcon />}
        <div>
          <p style={{ margin: 0, fontSize: 16, lineHeight: '24px', opacity: 0.6 }}>Menü</p>
          <h4 style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 600 }}>
            {category.name}
          </h4>
        </div>
        {theme.catnavShowCount && (
          <span style={{
          position: 'absolute',
          right: 20,
          bottom: 18,
          fontSize: 24,
          lineHeight: '32px',
          opacity: 0.26,
        }}>
          {String(index + 1).padStart(2, '0')}
          </span>
        )}
      </a>
    )
  }

  function renderCategoryNav() {
    return (
      <section key="category-nav" data-component="categoryNav" style={{ marginBottom: 32 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}>
          <h3 style={{
            margin: 0,
            fontSize: 14,
            lineHeight: '20px',
            letterSpacing: '0.05em',
            fontWeight: 650,
            color: '#444748',
            textTransform: 'uppercase',
          }}>
            Menüler
          </h3>
          {theme.headerShowLang && (
            <button type="button" style={{
              border: 'none',
              background: 'transparent',
              color: '#444748',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 14,
              lineHeight: '20px',
              fontWeight: 600,
              padding: 0,
            }}>
              English
              <ChevronDownIcon />
            </button>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 'var(--p-gap)',
            overflowX: 'auto',
            marginInline: -24,
            paddingInline: 24,
            scrollbarWidth: 'none',
          }}
        >
          {categories.map(renderCategoryCard)}
        </div>
      </section>
    )
  }

  function renderCategorySection(category: MenuCategory, index: number) {
    return (
      <section
        key={category.id}
        id={`section-${category.id}`}
        data-component="section"
        style={{ marginBottom: 'var(--p-section-gap)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          {index === 0 ? <BookIcon /> : <MenuIcon />}
          <h3 style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 600, color: '#000' }}>
            {category.name}
          </h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--p-gap)' }}>
          {renderItems(category.id)}
        </div>
      </section>
    )
  }

  function renderCustomSection(sectionId: string) {
    const config = theme.sectionSettings?.[sectionId] ?? {}
    const text = (key: string, fallback: string) => config[key]?.trim() || fallback
    const number = (key: string, fallback: number) => {
      const parsed = Number(config[key])
      return Number.isFinite(parsed) ? parsed : fallback
    }
    const targetHref = () => {
      const targetType = text('targetType', 'none')
      const targetId = text('targetId', '')
      const targetUrl = text('targetUrl', '')
      if (targetType === 'category' && targetId) return `#section-${targetId}`
      if (targetType === 'product' && targetId) return `#product-${targetId}`
      if (targetType === 'link' && targetUrl) return targetUrl
      return '#'
    }
    const shell: CSSProperties = { marginBottom: 'var(--p-section-gap)' }

    if (sectionId === 'hero-banner') {
      const imageUrl = text('imageUrl', '')
      const overlay = number('overlay', imageUrl ? 25 : 0) / 100
      const bgStart = text('bgStart', 'var(--p-accent)')
      const bgEnd = text('bgEnd', '#d97757')
      return (
        <section key={sectionId} data-component="custom-section" style={shell}>
          <div style={{
            minHeight: number('height', 172),
            borderRadius: 20,
            padding: number('padding', 22),
            color: text('textColor', '#ffffff'),
            background: imageUrl
              ? `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), url("${imageUrl}") center/cover`
              : `linear-gradient(135deg, ${bgStart}, ${bgEnd})`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.86 }}>
              {text('eyebrow', 'Gün özel')}
            </p>
            <h2 style={{ margin: 0, fontFamily: 'var(--p-display)', fontSize: 34, lineHeight: 1.1, fontWeight: 650 }}>
              {text('title', displayName)}
            </h2>
            <p style={{ margin: '12px 0 0', maxWidth: 320, fontSize: 16, lineHeight: 1.45, opacity: 0.84 }}>
              {text('body', 'Favorilerinizi keşfedin, siparişinizi masanızdan kolayca oluşturun.')}
            </p>
            <a href={targetHref()} style={{
              marginTop: 18,
              alignSelf: 'flex-start',
              borderRadius: 999,
              background: text('buttonBg', '#ffffff'),
              color: text('buttonText', 'var(--p-accent)'),
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 850,
              textDecoration: 'none',
            }}>
              {text('cta', 'Sipariş ver')}
            </a>
          </div>
        </section>
      )
    }

    if (sectionId === 'promo-strip') {
      const message = text('title', 'İLK SİPARİŞE %20 İNDİRİM')
      const repeatText = text('repeatText', 'BUGÜNE ÖZEL · MASADAN HIZLI SİPARİŞ')
      const speed = number('speed', 18)
      return (
        <section key={sectionId} data-component="custom-section" style={shell}>
          <style>{`
            @keyframes garsonless-spain-promo-marquee {
              from { transform: translateX(0); }
              to { transform: translateX(-50%); }
            }
          `}</style>
          <a href={targetHref()} style={{
            height: number('height', 40),
            borderRadius: 12,
            background: text('bgColor', '#1c1c19'),
            color: text('textColor', '#f4d494'),
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.04em',
          }}>
            <span style={{
              display: 'inline-flex',
              minWidth: '200%',
              gap: 28,
              paddingLeft: 18,
              animation: `garsonless-spain-promo-marquee ${speed}s linear infinite`,
            }}>
              {[0, 1, 2, 3].map((item) => (
                <span key={item}>
                  <span style={{ color: text('accentColor', '#ffffff') }}>{message}</span>
                  <span> · {repeatText}</span>
                </span>
              ))}
            </span>
          </a>
        </section>
      )
    }

    if (sectionId === 'combo-ribbon') {
      const comboCount = Math.min(3, Math.max(1, number('comboCount', 3)))
      const combos = [
        { c: text('combo1Color', '#1cb6a8'), icons: [text('combo1Icon1', '🍔'), text('combo1Icon2', '🍟'), text('combo1Icon3', '')].filter(Boolean), title: text('combo1Title', 'Burger + Patates + İçecek'), price: text('combo1Price', '189'), old: text('combo1OldPrice', '270'), off: text('combo1Badge', '-30%'), badge: text('combo1RibbonBottom', 'COMBO') },
        { c: text('combo2Color', '#ff3b1c'), icons: [text('combo2Icon1', '☕'), text('combo2Icon2', '🥐'), text('combo2Icon3', '')].filter(Boolean), title: text('combo2Title', 'Kahve + Kruvasan + Reçel'), price: text('combo2Price', '145'), old: text('combo2OldPrice', '180'), off: text('combo2Badge', '-20%'), badge: text('combo2RibbonBottom', 'COMBO') },
        { c: text('combo3Color', '#ffc91a'), icons: [text('combo3Icon1', '🍰'), text('combo3Icon2', '☕'), text('combo3Icon3', '')].filter(Boolean), title: text('combo3Title', 'Cheesecake + Filtre Kahve'), price: text('combo3Price', '165'), old: text('combo3OldPrice', '195'), off: text('combo3Badge', '-15%'), badge: text('combo3RibbonBottom', 'COMBO') },
      ].slice(0, comboCount)
      return (
        <section key={sectionId} data-component="custom-section" style={shell}>
          <div style={{ borderRadius: 22, background: text('bgColor', '#fff3a8'), padding: 18 }}>
            <h3 style={{ margin: '0 0 14px', color: '#1c1c19', fontFamily: 'var(--p-display)', fontSize: 28, lineHeight: 1.1 }}>
              {text('title', '🔥 Komboları Kaçırma')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {combos.map((combo, index) => (
                <div key={`${combo.title}-${index}`} style={{
                  minHeight: 104,
                  borderRadius: 18,
                  background: combo.c,
                  color: '#fff',
                  display: 'grid',
                  gridTemplateColumns: '94px 1fr auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '16px 14px',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <span style={{
                    position: 'absolute',
                    top: 0,
                    left: 18,
                    padding: '6px 12px 10px',
                    background: index === 1 ? '#ffc91a' : '#ff3b1c',
                    color: index === 1 ? '#1c1c19' : '#fff',
                    clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%)',
                    fontSize: 11,
                    fontWeight: 950,
                    lineHeight: 1,
                    textAlign: 'center',
                  }}>
                    {combo.badge}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 28, paddingTop: 16 }}>
                    {combo.icons.map((icon, iconIndex) => <span key={`${icon}-${iconIndex}`}>{icon}</span>)}
                  </span>
                  <span>
                    <strong style={{ display: 'block', fontSize: 18, lineHeight: 1.25 }}>{combo.title}</strong>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                      <b style={{ fontSize: 28 }}>₺{combo.price.replace(/^₺/, '')}</b>
                      <span style={{ textDecoration: 'line-through', opacity: 0.68 }}>₺{combo.old.replace(/^₺/, '')}</span>
                    </span>
                  </span>
                  <span style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
                    <b style={{ borderRadius: 12, background: 'rgba(255,255,255,.22)', padding: '8px 10px', fontSize: 22 }}>{combo.off}</b>
                    <a href={targetHref()} style={{ borderRadius: 999, background: '#1c1c19', color: '#fff', padding: '8px 14px', fontSize: 13, fontWeight: 850, textDecoration: 'none' }}>
                      {text('cta', 'Ekle')}
                    </a>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (sectionId === 'discount-badge') {
      return (
        <section key={sectionId} data-component="custom-section" style={shell}>
          <div style={{
            minHeight: 150,
            borderRadius: 24,
            border: `1.5px solid ${text('textColor', '#5a0d1f')}`,
            background: text('bgColor', '#b5f53d'),
            color: text('textColor', '#5a0d1f'),
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}>
            <div style={{
              width: 96,
              height: 96,
              borderRadius: 999,
              border: `1.5px solid ${text('textColor', '#5a0d1f')}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, fontWeight: 850, letterSpacing: '.1em' }}>FALL</span>
              <span style={{ fontSize: 30, fontWeight: 950 }}>{text('offer', '2x1')}</span>
              <span style={{ fontSize: 9, fontWeight: 850, letterSpacing: '.1em' }}>OFFER</span>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em' }}>{text('eyebrow', 'SINIRLI SÜRE')}</div>
              <h3 style={{ margin: '6px 0', fontFamily: 'var(--p-display)', fontSize: 28, lineHeight: 1.05 }}>
                {text('title', 'İkincisi bizden!')}
              </h3>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.78 }}>{text('body', 'Tüm seçili ürünlerde · bugün')}</p>
            </div>
          </div>
        </section>
      )
    }

    return (
      <section key={sectionId} data-component="custom-section" style={shell}>
        <div style={{
          borderRadius: 18,
          background: 'var(--p-card)',
          border: '1px solid var(--p-border)',
          boxShadow: 'var(--p-shadow)',
          padding: 18,
        }}>
          <h3 style={{ margin: 0, color: 'var(--p-text)', fontSize: 18, fontWeight: 800 }}>
            {text('title', customSectionTitle(sectionId))}
          </h3>
          <p style={{ margin: '6px 0 0', color: '#444748', fontSize: 13, lineHeight: 1.45 }}>
            {text('body', 'Bu bölüm Taste of Spain içinde de sayfa akışına göre gösterilir.')}
          </p>
        </div>
      </section>
    )
  }

  return (
    <div
      data-component="page"
      style={{
        minHeight: '100dvh',
        background: 'var(--p-bg)',
        color: 'var(--p-text)',
        paddingBottom: theme.cartStyle === 'fab' ? 112 : theme.cartStyle === 'pill' ? 132 : 172,
        fontFamily: 'var(--p-body)',
        ...textureStyle,
      }}
    >
      <AnnouncementBar />
      <header
        data-component="header"
        style={{
          position: theme.stickyHeader ? 'fixed' : 'relative',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          background: `${theme.headerBg}d9`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: theme.headerBorder ? '1px solid rgba(196, 199, 199, 0.34)' : 'none',
          padding: '12px 24px',
        }}
      >
        <div style={{
          maxWidth: 430,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          {theme.headerShowMenu ? (
            <button type="button" aria-label="Menü" onClick={() => setDrawerOpen(true)} style={iconButtonStyle}>
              <MenuLinesIcon />
            </button>
          ) : <span style={{ width: 40 }} />}
          <h1 style={{
            margin: 0,
            fontSize: theme.headerNameSize,
            lineHeight: '34px',
            fontWeight: theme.headerLogoStyle === 'wordmark' ? 650 : 750,
            fontFamily: theme.headerLogoStyle === 'display' ? 'var(--p-display)' : 'var(--p-body)',
            letterSpacing: 0,
            textAlign: 'center',
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayName}
          </h1>
          {theme.headerTableBadge ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#444748', fontSize: 13, minWidth: 40 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: '#7eb928' }} />
              Açık
            </span>
          ) : (
            <button type="button" aria-label="Hesap" style={iconButtonStyle}>
              <AccountIcon />
            </button>
          )}
        </div>
      </header>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
          <button
            type="button"
            aria-label="Kapat"
            onClick={() => setDrawerOpen(false)}
            style={{
              position: 'absolute',
              inset: 0,
              border: 'none',
              background: 'rgba(0,0,0,.2)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />
          <aside style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 320,
            maxWidth: '84vw',
            height: '100%',
            background: '#fdf9f4',
            boxShadow: '0 18px 50px rgba(28,28,25,.18)',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#e6e2dd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000',
              }}>
        {theme.catnavShowIcons && <MenuIcon />}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 600 }}>{tableLabel}</h2>
                <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: '#444748' }}>
                  Philip, George + 2 more
                </p>
              </div>
            </div>
            <DrawerButton active icon={<MenuIcon />} label="Menu" />
            <DrawerButton icon={<ReceiptIcon />} label="My Orders" />
            <DrawerButton icon={<PaymentIcon />} label="Split Bill" />
            <DrawerButton icon={<BellIcon />} label="Call Staff" onClick={showToast} />
          </aside>
        </div>
      )}

      <main style={{ maxWidth: 430, margin: '0 auto', padding: theme.stickyHeader ? '96px 24px 0' : '24px 24px 0' }}>
        <section data-component="welcome" style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', marginBottom: 12 }}>
            {['#c7d9f1', '#f7c8b7', '#d7ead8'].map((color, index) => (
              <div
                key={color}
                style={{
                  width: 40,
                  height: 40,
                  marginLeft: index === 0 ? 0 : -8,
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  background: `linear-gradient(135deg, ${color}, #ffffff)`,
                  boxShadow: '0 1px 2px rgba(28,28,25,.08)',
                }}
              />
            ))}
            <div style={{
              width: 40,
              height: 40,
              marginLeft: -8,
              borderRadius: '50%',
              border: '2px solid #fff',
              background: '#e6e2dd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 650,
              color: '#444748',
            }}>
              +2
            </div>
          </div>
          {theme.pageDescription !== 'hidden' && (
            <p style={{ margin: '0 0 8px', fontSize: 16, lineHeight: '24px', color: '#444748' }}>
              {theme.pageDescription === 'short'
                ? 'Welcome to'
                : theme.pageDescription === 'table'
                  ? `${tableLabel} · Philip, George + 2 more`
                  : 'Welcome Philip, George + 2 more to'}
            </p>
          )}
          <h2 style={{
            margin: 0,
            fontSize: theme.headerLogoStyle === 'image' ? 34 : 40,
            lineHeight: '48px',
            letterSpacing: 0,
            fontWeight: 650,
            color: '#000',
          }}>
            {displayName}
          </h2>
        </section>

        {pageBlocks.map((block) => {
          if (block.type === 'section') return renderCustomSection(block.id)
          if (block.type === 'nav') {
            return (
              <div key="category-nav">
                {renderCategoryNav()}
                <div style={{ marginInline: -24 }}>{menuFilters}</div>
                {filterEmptyState}
              </div>
            )
          }

          const category = categoryById.get(block.id)
          if (!category) return null
          const categoryIndex = categories.findIndex((item) => item.id === category.id)
          return renderCategorySection(category, categoryIndex)
        })}
      </main>

      <div style={{
        position: 'fixed',
        top: 96,
        right: 16,
        zIndex: 60,
        transform: toastVisible ? 'translateX(0)' : 'translateX(120%)',
        opacity: toastVisible ? 1 : 0,
        transition: 'transform 300ms ease, opacity 300ms ease',
      }}>
        <div style={{
          width: 256,
          borderRadius: 16,
          padding: 16,
          background: 'rgba(255,255,255,.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,.42)',
          boxShadow: '0 16px 34px rgba(28,28,25,.14)',
          display: 'flex',
          gap: 16,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: '#408575',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <BellIcon />
          </div>
          <div>
            <h5 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1c1c19' }}>Staff notified</h5>
            <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.45, color: '#444748' }}>
              Staff will be at your table shortly.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function DrawerButton({ active = false, icon, label, onClick }: {
  active?: boolean
  icon: ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 48,
        border: 'none',
        borderRadius: 8,
        padding: '0 16px',
        background: active ? '#1c1b1b' : 'transparent',
        color: active ? '#858383' : '#444748',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        fontSize: 15,
        fontWeight: active ? 700 : 500,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

const iconButtonStyle = {
  width: 32,
  height: 32,
  border: 'none',
  background: 'transparent',
  color: '#1c1c19',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  flexShrink: 0,
} satisfies CSSProperties

function customSectionTitle(sectionId: string) {
  const titles: Record<string, string> = {
    'featured-scroll': 'Öne çıkanlar',
    'chef-pick': "Şef'in seçimi",
    'daily-special': 'Günün özeli',
    reviews: 'Misafir yorumları',
    hours: 'Çalışma saatleri',
    allergens: 'Alerjen bilgileri',
    gallery: 'Galeri',
    'request-buttons': 'Hızlı istekler',
    'wifi-info': 'Wi-Fi bilgisi',
    'social-block': 'Sosyal medya',
    footer: 'İletişim',
  }
  return titles[sectionId] ?? 'Özel bölüm'
}

function MenuLinesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function AccountIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  )
}

function ReceiptIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h10l2 2v16l-3-2-3 2-3-2-3 2-2-1.4V5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  )
}

function PaymentIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3v18M10 3v6a4 4 0 0 1-4 4M17 3v18M14 3h6" />
    </svg>
  )
}

function BookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" />
      <path d="M4 5.5v16M8 7h8M8 11h7" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}
