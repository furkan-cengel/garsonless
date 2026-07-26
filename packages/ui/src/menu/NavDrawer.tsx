'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { MenuActionPlacements, ThemePageBlock } from '@garsonless/design-engine'
import { getSectionDefinitionId, resolveMenuActionPlacements } from '@garsonless/design-engine'
import { AppIcons as I } from '../icons'
import type { MenuCategory } from './types'
import type { StoreInfo } from '../themes/types'
import { formatTRY } from './formatCurrency'
import type { ServiceRequestType } from '@garsonless/domain/tables'
import { useTheme } from './ThemeContext'

export const DRAWER_SECTION_IDS = new Set(['hours', 'wifi-info', 'request-buttons'])

type CategoryMeta = Record<string, { itemCount?: number }>

interface NavDrawerProps {
  open: boolean
  onClose: () => void
  restaurantName: string
  categories?: MenuCategory[] | undefined
  categoryMeta?: CategoryMeta | undefined
  tableId?: string | null | undefined
  tableName?: string | null | undefined
  billSummary?: { total: number; count: number } | null | undefined
  onOpenBill?: (() => void) | undefined
  storeInfo?: StoreInfo | null | undefined
  pageBlocks?: ThemePageBlock[] | undefined
  sectionSettings?: Record<string, Record<string, string>> | undefined
  onCategorySelect?: ((categoryId: string) => void) | undefined
  cartSummary?: { count: number; subtotal: number } | undefined
  onOpenCart?: (() => void) | undefined
  memberSummary?: { name: string | null } | null | undefined
  onOpenMember?: (() => void) | undefined
  onServiceRequest?: ((type: ServiceRequestType) => Promise<boolean>) | undefined
  onOpenServiceRequests?: (() => void) | undefined
  placements?: MenuActionPlacements | undefined
  editorExpandedSectionId?: string | null | undefined
}

export function NavDrawer({
  open,
  onClose,
  restaurantName,
  categories = [],
  categoryMeta = {},
  tableId,
  tableName,
  billSummary,
  onOpenBill,
  storeInfo,
  pageBlocks = [],
  sectionSettings = {},
  onCategorySelect,
  cartSummary,
  onOpenCart,
  memberSummary,
  onOpenMember,
  onServiceRequest,
  onOpenServiceRequests,
  placements: projectedPlacements,
  editorExpandedSectionId,
}: NavDrawerProps) {
  const { theme, logoUrl } = useTheme()
  const drawerRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const [query, setQuery] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState(categories[0]?.id ?? '')
  const [expandedInfoId, setExpandedInfoId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null)

  const roots = useMemo(() => categories.filter((category) => !category.parent_id), [categories])
  const childrenByParent = useMemo(() => {
    const result = new Map<string, MenuCategory[]>()
    for (const category of categories) {
      if (!category.parent_id) continue
      result.set(category.parent_id, [...(result.get(category.parent_id) ?? []), category])
    }
    return result
  }, [categories])
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR')
  const visibleRoots = useMemo(() => {
    if (!normalizedQuery) return roots.length > 0 ? roots : categories
    return (roots.length > 0 ? roots : categories).filter((category) => {
      if (category.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery)) return true
      return (childrenByParent.get(category.id) ?? []).some((child) => child.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
    })
  }, [categories, childrenByParent, normalizedQuery, roots])
  const drawerSections = useMemo(() => pageBlocks.flatMap((block) => {
    const sectionId = getSectionDefinitionId(block)
    if (!sectionId || block.placement !== 'drawer' || !DRAWER_SECTION_IDS.has(sectionId)) return []
    return [{ block, sectionId, config: sectionSettings[block.id] ?? sectionSettings[sectionId] ?? {} }]
  }), [pageBlocks, sectionSettings])

  const tableLabel = tableName
    ? tableName
    : tableId
      ? `Masa ${tableId.slice(0, 4).toUpperCase()}`
      : null

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key === 'Tab' && drawerRef.current) {
        const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]'))
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (!first || !last) return
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
    // Only an actual open transition may claim focus. Theme editor keystrokes
    // rerender the iframe and can change callback identity without reopening it.
  }, [open])

  useEffect(() => {
    const sections = categories
      .map((category) => document.getElementById(`section-${category.id}`))
      .filter((section): section is HTMLElement => Boolean(section))
    if (sections.length === 0) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (visible) setActiveCategoryId(visible.target.id.replace('section-', ''))
    }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [categories])

  const navigateToCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId)
    if (onCategorySelect) onCategorySelect(categoryId)
    else document.getElementById(`section-${categoryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    onClose()
  }

  const copyValue = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      setCopied(null)
    }
  }

  const sendRequest = async (type: ServiceRequestType, successText: string) => {
    if (!onServiceRequest) return
    const ok = await onServiceRequest(type)
    setRequestFeedback(ok ? successText : 'İstek iletilemedi')
    window.setTimeout(() => setRequestFeedback(null), 2400)
  }

  const requestBlock = pageBlocks.find((block) => block.type === 'section' && getSectionDefinitionId(block) === 'request-buttons')
  const placements = projectedPlacements ?? resolveMenuActionPlacements(theme)
  const drawerBillEnabled = placements.bill === 'drawer' && Boolean(onOpenBill)
  const tableCardContent = tableLabel ? (
    <>
      <span data-table-icon><I.receipt size={18} /></span>
      <span>
        <b>{tableLabel}</b>
        <small>{drawerBillEnabled && billSummary?.count ? `${billSummary.count} kalem · adisyon açık` : 'Masanız açık'}</small>
      </span>
      {drawerBillEnabled && billSummary?.count ? <span data-table-total><b>{formatTRY(billSummary.total)}</b><small>güncel hesap</small></span> : null}
    </>
  ) : null
  useEffect(() => {
    if (!open || !editorExpandedSectionId) return
    const section = drawerSections.find(({ block, sectionId }) => block.id === editorExpandedSectionId || sectionId === editorExpandedSectionId)
    if (section && section.sectionId !== 'request-buttons') setExpandedInfoId(section.block.id)
  }, [drawerSections, editorExpandedSectionId, open])
  const drawerStyle = {
    '--drawer-width': `${theme.drawerWidth ?? 370}px`,
    '--drawer-radius': `${theme.drawerRadius ?? 22}px`,
    '--drawer-overlay-opacity': String((theme.drawerOverlayOpacity ?? 48) / 100),
    '--drawer-overlay-blur': `${theme.drawerOverlayBlur ?? 2}px`,
    '--drawer-top-font': `${theme.drawerTopFontSize ?? 14}px`,
    '--drawer-sub-font': `${theme.drawerSubFontSize ?? 13}px`,
  } as CSSProperties

  return (
    <>
      <div data-nav-drawer-scrim aria-hidden="true" onClick={onClose} data-open={open} data-position={theme.drawerPosition ?? 'full'} style={drawerStyle} />
      <div
        ref={drawerRef}
        data-nav-drawer
        data-open={open}
        data-position={theme.drawerPosition ?? 'full'}
        data-side={theme.drawerSide ?? 'left'}
        data-tone={theme.drawerTone ?? 'brand'}
        data-preset={theme.drawerPreset ?? 'modern'}
        data-density={theme.drawerDensity ?? 'comfortable'}
        data-icon-style={theme.drawerIconStyle ?? 'soft'}
        data-active-style={theme.drawerActiveStyle ?? 'bar'}
        data-font-role={theme.drawerFontRole ?? 'body'}
        data-text-case={theme.drawerTextCase ?? 'default'}
        data-shadow={theme.drawerShadow ?? 'strong'}
        role="dialog"
        aria-modal="true"
        aria-label="Navigasyon menüsü"
        aria-hidden={!open}
        inert={!open}
        tabIndex={-1}
        style={drawerStyle}
      >
        <header data-drawer-header data-visible={theme.drawerShowBrand ?? true}>
          <div data-drawer-brand>
            <span data-drawer-mark aria-hidden="true">{logoUrl ? <img src={logoUrl} alt="" /> : restaurantName.trim().charAt(0).toLocaleUpperCase('tr-TR') || 'M'}</span>
            <div>
              <h2>{restaurantName}</h2>
              {(theme.drawerShowStatus ?? true) && <span><i /> {todayHours(storeInfo)}</span>}
            </div>
            <button type="button" aria-label="Menüyü kapat" onClick={onClose}><I.close size={18} /></button>
          </div>
          {(theme.drawerShowTable ?? true) && tableLabel && (
            drawerBillEnabled ? (
              <button type="button" data-drawer-table onClick={() => { onClose(); onOpenBill?.() }}>
                {tableCardContent}
              </button>
            ) : (
              <div data-drawer-table data-static="true">{tableCardContent}</div>
            )
          )}
        </header>

        {(theme.drawerShowSearch ?? true) && <div data-drawer-search>
          <I.search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kategori ara" aria-label="Kategori ara" />
          {query && <button type="button" aria-label="Aramayı temizle" onClick={() => setQuery('')}><I.close size={14} /></button>}
        </div>}

        <nav data-drawer-nav aria-label="Menü kategorileri">
          <p data-drawer-group>Menü</p>
          {visibleRoots.map((category) => {
            const children = (childrenByParent.get(category.id) ?? []).filter((child) => !normalizedQuery || child.name.toLocaleLowerCase('tr-TR').includes(normalizedQuery))
            const isActive = activeCategoryId === category.id || children.some((child) => child.id === activeCategoryId)
            const itemCount = categoryMeta[category.id]?.itemCount
            return (
              <div key={category.id} data-category-group>
                <button type="button" data-drawer-row data-active={isActive} onClick={() => navigateToCategory(category.id)}>
                  {(theme.drawerShowIcons ?? true) && <span data-row-icon><I.cutlery size={18} /></span>}
                  <span data-row-copy><b>{category.name}</b>{(theme.drawerShowDescriptions ?? true) && <small>{children.length > 0 ? `${children.length} alt kategori` : 'Ürünleri görüntüle'}</small>}</span>
                  {(theme.drawerShowCounts ?? true) && typeof itemCount === 'number' && <span data-row-count>{itemCount}</span>}
                  <I.chevRight data-row-chevron size={16} />
                </button>
                {children.length > 0 && (
                  <div data-drawer-children>
                    {children.map((child) => (
                      <button type="button" key={child.id} data-active={activeCategoryId === child.id} onClick={() => navigateToCategory(child.id)}>
                        <i /><b>{child.name}</b>
                        {(theme.drawerShowCounts ?? true) && typeof categoryMeta[child.id]?.itemCount === 'number' && <span>{categoryMeta[child.id]?.itemCount}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {visibleRoots.length === 0 && <p data-drawer-empty>Bu aramayla eşleşen kategori yok.</p>}

          {drawerSections.length > 0 && <p data-drawer-group>İşletme bilgileri</p>}
          {drawerSections.map(({ block, sectionId, config }) => {
            if (sectionId === 'request-buttons') return null
            const expanded = expandedInfoId === block.id
            const label = sectionId === 'hours' ? 'Çalışma Saatleri' : 'Wi-Fi Bilgisi'
            const Icon = sectionId === 'hours' ? I.clock : I.globe
            return (
              <div key={block.id} data-drawer-info>
                <button type="button" data-drawer-row data-active={expanded} aria-expanded={expanded} onClick={() => setExpandedInfoId(expanded ? null : block.id)}>
                  <span data-row-icon><Icon size={18} /></span>
                  <span data-row-copy><b>{label}</b><small>{sectionId === 'hours' ? todayHours(storeInfo) : (config['networkName'] || 'Ağ bilgilerini görüntüle')}</small></span>
                  <I.chevDown data-row-chevron size={16} />
                </button>
                {expanded && sectionId === 'hours' && <HoursPanel storeInfo={storeInfo} />}
                {expanded && sectionId === 'wifi-info' && (
                  <WifiPanel config={config} copied={copied} onCopy={copyValue} />
                )}
              </div>
            )
          })}
        </nav>
        {(
          (placements.cart === 'drawer' && onOpenCart) ||
          (placements.member === 'drawer' && onOpenMember) ||
          (placements.service === 'drawer' && requestBlock && (onOpenServiceRequests || onServiceRequest))
        ) && (
          <footer data-drawer-footer>
            <div data-customer-links>
              {placements.member === 'drawer' && onOpenMember && (
                <button type="button" onClick={() => { onClose(); onOpenMember() }}><I.user size={17} />{memberSummary?.name || 'Üye ol'}</button>
              )}
              {placements.cart === 'drawer' && onOpenCart && (
                <button type="button" onClick={() => { onClose(); onOpenCart() }}><I.cart size={17} />Sepet{cartSummary?.count ? ` · ${cartSummary.count}` : ''}</button>
              )}
            </div>
            <div data-primary-actions>
              {placements.service === 'drawer' && requestBlock && (onOpenServiceRequests || onServiceRequest) && (
                <button type="button" onClick={() => { if (onOpenServiceRequests) { onClose(); onOpenServiceRequests() } else void sendRequest('waiter', 'Garson çağrıldı') }}><I.bell size={17} />Servis istekleri</button>
              )}
            </div>
            {requestFeedback && <div data-request-feedback role="status">{requestFeedback}</div>}
          </footer>
        )}
      </div>
      <style>{NAV_DRAWER_CSS}</style>
    </>
  )
}

const DAY_ENTRIES = [
  ['mon', 'Pazartesi'], ['tue', 'Salı'], ['wed', 'Çarşamba'], ['thu', 'Perşembe'],
  ['fri', 'Cuma'], ['sat', 'Cumartesi'], ['sun', 'Pazar'],
] as const

function todayHours(storeInfo?: StoreInfo | null) {
  const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]!
  const day = storeInfo?.hours?.[dayKey]
  if (!day) return 'Saat bilgisi yok'
  if (day.active === false) return 'Bugün kapalı'
  return day.open && day.close ? `Bugün ${day.open}–${day.close}` : 'Saatleri görüntüle'
}

function HoursPanel({ storeInfo }: { storeInfo?: StoreInfo | null | undefined }) {
  const hours = storeInfo?.hours ?? {}
  const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
  return (
    <div data-info-panel>
      {DAY_ENTRIES.map(([key, label]) => {
        const day = hours[key]
        return <div key={key} data-today={key === todayKey || undefined}><span>{label}</span><b>{!day || day.active === false ? 'Kapalı' : day.open && day.close ? `${day.open}–${day.close}` : 'Belirtilmedi'}</b></div>
      })}
    </div>
  )
}

function WifiPanel({ config, copied, onCopy }: { config: Record<string, string>; copied: string | null; onCopy: (key: string, value: string) => void }) {
  const networkName = config['networkName']?.trim()
  const password = config['password']?.trim()
  if (!networkName && !password) return <div data-info-panel data-info-empty>Wi-Fi bilgileri henüz eklenmedi.</div>
  return (
    <div data-info-panel>
      {networkName && <button type="button" onClick={() => onCopy('network', networkName)}><span><small>Ağ adı</small><b>{networkName}</b></span><span>{copied === 'network' ? 'Kopyalandı' : 'Kopyala'}</span></button>}
      {password && <button type="button" onClick={() => onCopy('password', password)}><span><small>Şifre</small><b>{password}</b></span><span>{copied === 'password' ? 'Kopyalandı' : 'Kopyala'}</span></button>}
      {config['note'] && <p>{config['note']}</p>}
    </div>
  )
}

const NAV_DRAWER_CSS = `
[data-nav-drawer-scrim]{position:fixed;inset:0;z-index:1198;background:rgba(15,17,20,var(--drawer-overlay-opacity));backdrop-filter:blur(var(--drawer-overlay-blur));opacity:0;pointer-events:none;transition:opacity .28s ease}
[data-nav-drawer-scrim][data-position="below-header"]{top:var(--p-header-sticky-height,64px)}
[data-nav-drawer-scrim][data-open="true"]{opacity:1;pointer-events:auto}
[data-nav-drawer]{position:fixed;z-index:1199;inset:0 auto 0 0;width:min(88vw,var(--drawer-width));background:var(--p-card,#fff);border-radius:0 var(--drawer-radius) var(--drawer-radius) 0;box-shadow:24px 0 64px -24px rgba(15,17,20,.56);display:flex;flex-direction:column;overflow:hidden;transform:translateX(-104%);transition:transform .38s cubic-bezier(.5,.1,.2,1);outline:none;font-family:var(--p-body)}
[data-nav-drawer][data-position="below-header"]{top:var(--p-header-sticky-height,64px)}
[data-nav-drawer][data-side="right"]{inset:0 0 0 auto;border-radius:var(--drawer-radius) 0 0 var(--drawer-radius);transform:translateX(104%)}
[data-nav-drawer][data-side="right"][data-position="below-header"]{top:var(--p-header-sticky-height,64px)}
[data-nav-drawer][data-shadow="soft"]{box-shadow:14px 0 38px -22px rgba(15,17,20,.4)}
[data-nav-drawer][data-shadow="none"]{box-shadow:none}
[data-nav-drawer][data-font-role="display"]{font-family:var(--p-display)}
[data-nav-drawer][data-text-case="uppercase"] [data-row-copy] b,[data-nav-drawer][data-text-case="uppercase"] [data-drawer-children] b{text-transform:uppercase;letter-spacing:.045em}
[data-nav-drawer][data-open="true"]{transform:none}
[data-drawer-header]{padding:20px 18px 16px;background:color-mix(in srgb,var(--p-accent) 82%,#111 18%);color:#fff}
[data-drawer-header][data-visible="false"] [data-drawer-brand]>:not(button){display:none}
[data-nav-drawer][data-tone="surface"] [data-drawer-header]{background:var(--p-card);color:var(--p-text);border-bottom:1px solid var(--p-border)}
[data-nav-drawer][data-tone="surface"] [data-drawer-brand] div span,[data-nav-drawer][data-tone="surface"] [data-drawer-table] small{color:var(--p-text-2)}
[data-nav-drawer][data-tone="surface"] [data-drawer-brand]>button{background:var(--p-accent-soft);color:var(--p-accent)}
[data-nav-drawer][data-tone="surface"] [data-drawer-table]{color:var(--p-text);border-color:var(--p-border);background:var(--p-bg)}
[data-nav-drawer][data-tone="dark"] [data-drawer-header]{background:#17191d;color:#fff}
[data-drawer-brand]{display:flex;align-items:center;gap:12px}
[data-drawer-mark]{width:46px;height:46px;border-radius:14px;background:#fff;color:var(--p-accent);display:grid;place-items:center;font:700 21px var(--p-display);flex:0 0 auto}
[data-drawer-mark] img{width:100%;height:100%;object-fit:cover;border-radius:inherit}
[data-drawer-brand]>div{flex:1;min-width:0}
[data-drawer-brand] h2{margin:0;font:700 19px/1.15 var(--p-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
[data-drawer-brand] div span{display:flex;align-items:center;gap:7px;margin-top:5px;font-size:11.5px;color:rgba(255,255,255,.74)}
[data-drawer-brand] div i{width:6px;height:6px;border-radius:50%;background:var(--p-cta);box-shadow:0 0 0 3px color-mix(in srgb,var(--p-cta) 30%,transparent)}
[data-drawer-brand]>button{width:34px;height:34px;border:0;border-radius:10px;background:rgba(255,255,255,.13);color:#fff;display:grid;place-items:center;cursor:pointer}
[data-drawer-table]{width:100%;margin-top:15px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.1);color:#fff;display:flex;align-items:center;gap:10px;text-align:left;font-family:inherit;cursor:pointer}
[data-drawer-table][data-static="true"]{cursor:default}
[data-table-icon]{width:34px;height:34px;border-radius:10px;background:var(--p-cta);display:grid;place-items:center;flex:0 0 auto}
[data-drawer-table]>span:nth-child(2){display:flex;flex-direction:column;gap:2px;min-width:0}
[data-drawer-table] b{font-size:13px}[data-drawer-table] small{font-size:10.5px;color:rgba(255,255,255,.64)}
[data-table-total]{margin-left:auto;text-align:right;display:flex;flex-direction:column;gap:2px;white-space:nowrap}
[data-table-total] b{font-size:13.5px}
[data-drawer-search]{height:42px;margin:14px 18px 8px;padding:0 12px;display:flex;align-items:center;gap:9px;border:1px solid var(--p-border);border-radius:11px;background:color-mix(in srgb,var(--p-bg) 78%,var(--p-card));color:var(--p-text-2);flex:0 0 auto}
[data-drawer-search] input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--p-text);font:500 13px var(--p-body)}
[data-drawer-search] input::placeholder{color:var(--p-text-2)}[data-drawer-search] button{border:0;background:transparent;color:var(--p-text-2);display:grid;place-items:center;cursor:pointer;padding:4px}
[data-drawer-nav]{flex:1;min-height:0;overflow-y:auto;padding:4px 12px 18px;scrollbar-width:thin}
[data-drawer-group]{margin:0;padding:12px 10px 6px;font:700 10px/1 var(--p-body);letter-spacing:.12em;text-transform:uppercase;color:var(--p-text-2)}
[data-drawer-row]{position:relative;width:100%;padding:10px 11px;border:0;border-radius:12px;background:transparent;color:var(--p-text);display:flex;align-items:center;gap:12px;text-align:left;font-family:inherit;cursor:pointer;transition:background .15s}
[data-nav-drawer][data-density="compact"] [data-drawer-row]{padding-block:7px}[data-nav-drawer][data-density="compact"] [data-row-icon]{width:32px;height:32px}
[data-drawer-row]:hover{background:color-mix(in srgb,var(--p-accent-soft) 48%,transparent)}
[data-drawer-row][data-active="true"]{background:var(--p-accent-soft)}
[data-drawer-row][data-active="true"]:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:0 3px 3px 0;background:var(--p-accent)}
[data-nav-drawer][data-active-style="soft"] [data-drawer-row][data-active="true"]:before,[data-nav-drawer][data-active-style="filled"] [data-drawer-row][data-active="true"]:before{display:none}
[data-nav-drawer][data-active-style="filled"] [data-drawer-row][data-active="true"]{background:var(--p-accent);color:#fff}
[data-row-icon]{width:38px;height:38px;border-radius:11px;background:color-mix(in srgb,var(--p-text) 7%,transparent);color:var(--p-text-2);display:grid;place-items:center;flex:0 0 auto}
[data-nav-drawer][data-icon-style="filled"] [data-row-icon]{background:var(--p-accent);color:#fff}[data-nav-drawer][data-icon-style="outline"] [data-row-icon]{background:transparent;border:1px solid var(--p-border)}
[data-drawer-row][data-active="true"] [data-row-icon]{background:var(--p-accent);color:#fff}
[data-row-copy]{flex:1;min-width:0}[data-row-copy] b{display:block;font-size:var(--drawer-top-font);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}[data-row-copy] small{display:block;margin-top:2px;color:var(--p-text-2);font-size:calc(var(--drawer-sub-font) - 2px)}
[data-row-count]{padding:3px 8px;border-radius:99px;background:color-mix(in srgb,var(--p-text) 7%,transparent);color:var(--p-text-2);font-size:10.5px;font-weight:700}
[data-row-chevron]{color:var(--p-text-2);transition:transform .15s}[data-drawer-row][aria-expanded="true"] [data-row-chevron]{transform:rotate(180deg)}
[data-drawer-children]{margin:2px 0 6px 27px;padding-left:13px;border-left:1.5px dashed var(--p-border)}
[data-drawer-children] button{width:100%;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:var(--p-text-2);display:flex;align-items:center;gap:9px;text-align:left;font-family:inherit;cursor:pointer}
[data-drawer-children] button:hover,[data-drawer-children] button[data-active="true"]{background:color-mix(in srgb,var(--p-accent-soft) 60%,transparent);color:var(--p-text)}
[data-drawer-children] i{width:7px;height:7px;border:2px solid var(--p-border);border-radius:50%;flex:0 0 auto}[data-drawer-children] b{flex:1;font-size:var(--drawer-sub-font)}[data-drawer-children] span{font-size:10.5px}
[data-info-panel]{margin:2px 4px 8px 50px;padding:10px 12px;border:1px solid var(--p-border);border-radius:11px;background:color-mix(in srgb,var(--p-bg) 72%,var(--p-card));font-size:11.5px;color:var(--p-text-2)}
[data-info-panel]>div{display:flex;justify-content:space-between;gap:12px;padding:5px 0}[data-info-panel]>div b{color:var(--p-text);font-weight:650}
[data-info-panel]>div[data-today="true"]{margin-inline:-6px;padding-inline:6px;border-radius:6px;background:var(--p-accent-soft);color:var(--p-accent)}
[data-info-panel]>button{width:100%;padding:7px 0;border:0;border-bottom:1px solid var(--p-border);background:transparent;color:var(--p-text);display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;font-family:inherit;cursor:pointer}
[data-info-panel]>button:last-of-type{border-bottom:0}[data-info-panel]>button>span:first-child{display:flex;flex-direction:column;gap:2px;min-width:0}[data-info-panel]>button small{color:var(--p-text-2)}[data-info-panel]>button b{overflow:hidden;text-overflow:ellipsis}[data-info-panel]>button>span:last-child{color:var(--p-accent);font-size:10.5px;font-weight:750}
[data-info-panel] p{margin:8px 0 0;line-height:1.45}[data-info-empty]{line-height:1.45}
[data-drawer-empty]{padding:18px 10px;color:var(--p-text-2);font-size:12.5px;text-align:center}
[data-drawer-footer]{flex:0 0 auto;padding:12px 14px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--p-border);background:color-mix(in srgb,var(--p-bg) 72%,var(--p-card));display:grid;gap:9px}
[data-customer-links],[data-primary-actions]{display:grid;grid-template-columns:1fr 1fr;gap:8px}
[data-customer-links]>button:only-child,[data-primary-actions]>button:only-child{grid-column:1/-1}
[data-drawer-footer] button{min-height:42px;border:1px solid var(--p-border);border-radius:11px;background:var(--p-card);color:var(--p-text);display:flex;align-items:center;justify-content:center;gap:7px;font:700 12.5px var(--p-body);cursor:pointer}
[data-drawer-footer] button[data-primary]{background:var(--p-accent);border-color:var(--p-accent);color:#fff}
[data-request-feedback]{padding:7px 9px;border-radius:8px;background:var(--p-accent-soft);color:var(--p-accent);font-size:11px;font-weight:700;text-align:center}
[data-nav-drawer][data-preset="minimal"] [data-row-icon]{display:none}[data-nav-drawer][data-preset="minimal"] [data-drawer-header]{padding-bottom:13px}[data-nav-drawer][data-preset="minimal"] [data-drawer-row]{border-radius:6px}
[data-nav-drawer][data-preset="editorial"] [data-row-copy] b{font-family:var(--p-display);font-weight:650}[data-nav-drawer][data-preset="editorial"] [data-drawer-group]{font-family:var(--p-display);letter-spacing:.08em}
@media(max-width:380px){[data-nav-drawer]{width:92vw}[data-drawer-header]{padding-inline:15px}[data-table-total]{display:none}}
@media(prefers-reduced-motion:reduce){[data-nav-drawer],[data-nav-drawer-scrim]{transition-duration:.01ms}}
`
