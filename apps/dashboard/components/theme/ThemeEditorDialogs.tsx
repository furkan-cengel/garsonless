'use client'

import type { KeyboardEvent, ReactNode, RefObject } from 'react'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { I } from '../../lib/ui'

export type ThemeTemplateOption = {
  id: string
  name: string
  THEME_DEFAULTS: GarsonlessTheme
}

export type ThemeSectionOption = {
  id: string
  group: string
  label: string
  sub: string
  icon: keyof typeof I
  plan: 'free' | 'pro'
}

interface TemplatePickerDialogProps {
  closeRef: RefObject<HTMLButtonElement | null>
  templateId: string
  previewTheme: GarsonlessTheme
  templates: readonly ThemeTemplateOption[]
  onSelect: (templateId: string) => void
  onClose: () => void
  renderPreview: (templateId: string, theme: GarsonlessTheme, title: string) => ReactNode
}

export function TemplatePickerDialog({
  closeRef,
  templateId,
  previewTheme,
  templates,
  onSelect,
  onClose,
  renderPreview,
}: TemplatePickerDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Şablonlar"
      onKeyDown={trapDialogFocus}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={templateOverlayStyle}
    >
      <div style={{
        width: 'min(1160px, calc(100vw - 96px))',
        height: 'min(790px, calc(100vh - 72px))',
        borderRadius: 18,
        background: 'var(--surface)',
        boxShadow: '0 28px 74px rgba(0,0,0,.22)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '22px 28px 20px',
          borderBottom: '1px solid var(--divider)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 18,
        }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, lineHeight: 1.05, fontWeight: 850 }}>
              Şablonlar
            </h2>
            <p style={{ margin: '8px 0 0', color: 'var(--text-3)', fontSize: 14 }}>
              {templates.length} hazır tasarım · aktif tasarımın en başta görünür
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{
              height: 38,
              borderRadius: 999,
              background: 'var(--surface-3)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 14px 0 10px',
              color: 'var(--text-2)',
              fontSize: 13,
              fontWeight: 650,
            }}>
              <span style={{
                height: 24,
                minWidth: 54,
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--positive-bg)',
                color: 'var(--positive)',
                fontSize: 13,
                fontWeight: 850,
              }}>
                FREE
              </span>
              planındasın
            </div>
            <DialogCloseButton closeRef={closeRef} onClose={onClose} />
          </div>
        </div>

        <div style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: 'var(--surface-inset)',
          padding: '28px 28px 34px',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 20,
            alignItems: 'start',
          }}>
            {templates.map((template) => {
              const isCurrent = template.id === templateId
              const theme = isCurrent ? previewTheme : template.THEME_DEFAULTS
              const copy = getTemplateCardCopy(template.id, template.name)
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onSelect(template.id)}
                  style={{
                    textAlign: 'left',
                    border: `1.5px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 14,
                    background: 'var(--surface)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    padding: 0,
                    boxShadow: isCurrent
                      ? '0 0 0 4px var(--accent-soft), 0 18px 40px rgba(20,25,31,.12)'
                      : '0 2px 8px rgba(20,25,31,.06)',
                  }}
                >
                  <div style={{ position: 'relative', height: 390, borderBottom: '1px solid var(--divider)', background: 'linear-gradient(180deg,#fff 0%,#fbfbfc 100%)' }}>
                    {renderPreview(template.id, theme, template.name)}
                    <span style={{
                      position: 'absolute',
                      left: 18,
                      top: 18,
                      borderRadius: 999,
                      padding: '7px 12px',
                      background: copy.tier === 'PRO' ? '#fff3df' : 'var(--positive-bg)',
                      color: copy.tier === 'PRO' ? '#b86408' : 'var(--positive)',
                      fontSize: 13,
                      fontWeight: 850,
                      letterSpacing: '.02em',
                    }}>
                      {copy.tier}
                    </span>
                    {isCurrent && (
                      <span style={{
                        position: 'absolute',
                        right: 18,
                        top: 18,
                        height: 32,
                        borderRadius: 999,
                        padding: '0 13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 850,
                        boxShadow: '0 10px 22px rgba(20,25,31,.14)',
                      }}>
                        <span style={{ width: 7, height: 7, borderRadius: 999, background: '#fff' }} />
                        Aktif seçili
                      </span>
                    )}
                  </div>

                  <div style={{ padding: '17px 18px 19px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--text)', fontSize: 18, fontWeight: 850, lineHeight: 1.15 }}>
                          {copy.title}
                        </div>
                        <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 13.5, lineHeight: 1.35 }}>
                          {copy.description}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, flexShrink: 0, paddingTop: 3 }}>
                        {[theme.accent, theme.bg, theme.cta, theme.accentSoft].map((color, index) => (
                          <span
                            key={`${template.id}-${color}-${index}`}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              background: color,
                              border: '1px solid rgba(20,25,31,.10)',
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{
                      marginTop: 14,
                      paddingTop: 13,
                      borderTop: '1px solid var(--divider)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                    }}>
                      <span style={{
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--text-3)',
                        fontSize: 12.5,
                      }}>
                        {copy.meta}
                      </span>
                      <span style={{
                        flexShrink: 0,
                        minWidth: 96,
                        height: 32,
                        borderRadius: 9,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isCurrent ? 'var(--accent-soft)' : 'var(--text)',
                        color: isCurrent ? 'var(--accent)' : '#fff',
                        fontSize: 12,
                        fontWeight: 800,
                      }}>
                        {isCurrent ? 'Düzenleniyor' : 'Şablonu aç'}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter onClose={onClose}>
          Her şablon kendi özel componentleriyle gelir; uyguladıktan sonra renk, font ve detayları sağ panelden ayarlayabilirsin.
        </DialogFooter>
      </div>
    </div>
  )
}

interface SectionPickerDialogProps {
  closeRef: RefObject<HTMLButtonElement | null>
  search: string
  activeGroup: string
  groups: readonly string[]
  sections: readonly ThemeSectionOption[]
  visibleSections: readonly ThemeSectionOption[]
  activeSectionIds: readonly string[]
  onSearchChange: (value: string) => void
  onGroupChange: (group: string) => void
  onAddSection: (sectionId: string) => void
  onClose: () => void
  renderPreview: (sectionId: string) => ReactNode
}

export function SectionPickerDialog({
  closeRef,
  search,
  activeGroup,
  groups,
  sections,
  visibleSections,
  activeSectionIds,
  onSearchChange,
  onGroupChange,
  onAddSection,
  onClose,
  renderPreview,
}: SectionPickerDialogProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bölüm ekle"
      onKeyDown={trapDialogFocus}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={sectionOverlayStyle}
    >
      <div style={{
        width: 'min(1360px, calc(100vw - 64px))',
        height: 'min(820px, calc(100vh - 64px))',
        borderRadius: 18,
        background: 'var(--surface)',
        boxShadow: '0 30px 80px rgba(0,0,0,.24)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '24px 28px 22px',
          borderBottom: '1px solid var(--divider)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 18,
        }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, lineHeight: 1.1, fontWeight: 800 }}>
              Bölüm ekle
            </h2>
            <p style={{ margin: '10px 0 0', color: 'var(--text-3)', fontSize: 15 }}>
              {sections.length} hazır komponent · {groups.length - 1} kategori
            </p>
          </div>
          <DialogCloseButton closeRef={closeRef} onClose={onClose} />
        </div>

        <div style={{
          padding: '16px 28px',
          borderBottom: '1px solid var(--divider)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          overflow: 'hidden',
        }}>
          <div style={{
            width: 270,
            flexShrink: 0,
            height: 42,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 14px',
            background: 'var(--surface-3)',
            borderRadius: 10,
            color: 'var(--text-3)',
          }}>
            <I.search size={17} />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Komponent ara..."
              aria-label="Eklenecek bölüm ara"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 3 }}>
            {groups.map((group) => {
              const count = group === 'Tümü'
                ? sections.length
                : sections.filter((section) => section.group === group).length
              const active = activeGroup === group
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => onGroupChange(group)}
                  style={{
                    flexShrink: 0,
                    height: 38,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 15px',
                    borderRadius: 999,
                    border: active ? 'none' : '1px solid var(--border)',
                    background: active ? 'var(--text)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-2)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 750,
                  }}
                >
                  {group}
                  <span style={{
                    minWidth: 22,
                    height: 22,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 999,
                    background: active ? 'rgba(255,255,255,.18)' : 'var(--surface-3)',
                    color: active ? '#fff' : 'var(--text-3)',
                    fontSize: 12,
                  }}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: 'var(--surface-inset)',
          padding: 28,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 18,
          }}>
            {visibleSections.map((section) => {
              const exists = activeSectionIds.includes(section.id)
              const SectionIcon = I[section.icon]
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => onAddSection(section.id)}
                  style={{
                    textAlign: 'left',
                    border: '1px solid var(--border)',
                    borderRadius: 14,
                    background: 'var(--surface)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    opacity: exists ? 0.82 : 1,
                    boxShadow: '0 1px 2px rgba(20,25,31,.05)',
                    padding: 0,
                    position: 'relative',
                  }}
                >
                  <div style={{ padding: 10, borderBottom: '1px solid var(--divider)', background: 'var(--surface-2)', position: 'relative' }}>
                    {renderPreview(section.id)}
                    <PlanBadge plan={section.plan} />
                  </div>
                  <div style={{ padding: '16px 16px 18px' }}>
                    {exists && (
                      <div style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 750, marginBottom: 7 }}>
                        Eklendi
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <span style={{ width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
                        <SectionIcon size={17} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--text)', fontSize: 17, fontWeight: 850, lineHeight: 1.18, letterSpacing: '-0.01em' }}>
                          {section.label}
                        </div>
                        <div style={{ marginTop: 5, color: 'var(--text-3)', fontSize: 13.5, lineHeight: 1.35 }}>
                          {section.sub}
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter onClose={onClose}>
          Her component eklendikten sonra sağ panelden detaylı olarak özelleştirilebilir.
        </DialogFooter>
      </div>
    </div>
  )
}

function DialogCloseButton({
  closeRef,
  onClose,
}: {
  closeRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  return (
    <button
      ref={closeRef}
      type="button"
      aria-label="Kapat"
      onClick={onClose}
      style={{
        width: 34,
        height: 34,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-3)',
        cursor: 'pointer',
        fontSize: 28,
        lineHeight: 1,
      }}
    >
      ×
    </button>
  )
}

function DialogFooter({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div style={{
      minHeight: 58,
      borderTop: '1px solid var(--divider)',
      background: 'var(--surface)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    }}>
      <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{children}</span>
      <button
        type="button"
        onClick={onClose}
        style={{
          height: 38,
          padding: '0 18px',
          borderRadius: 9,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 650,
        }}
      >
        Vazgeç
      </button>
    </div>
  )
}

function PlanBadge({ plan }: { plan: 'free' | 'pro' }) {
  const meta = plan === 'pro'
    ? { label: 'PRO', bg: '#fff2d9', fg: '#b66400' }
    : { label: 'FREE', bg: '#e6f7ef', fg: '#177a4b' }
  return (
    <span style={{
      position: 'absolute',
      top: 14,
      left: 14,
      height: 24,
      padding: '0 12px',
      borderRadius: 999,
      background: meta.bg,
      color: meta.fg,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: '.03em',
      boxShadow: '0 1px 0 rgba(255,255,255,.75) inset',
      zIndex: 2,
    }}>
      {plan === 'pro' && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
        </svg>
      )}
      {meta.label}
    </span>
  )
}

function getTemplateCardCopy(id: string, name: string) {
  const copy: Record<string, { title: string; description: string; meta: string; tier: 'FREE' | 'PRO' }> = {
    default: { title: 'Classic', description: 'Aktif klasik menü tasarımı · kategori pilleri, ürün kartları ve sabit sepet', meta: 'Kafe · Restoran · Masa siparişi', tier: 'FREE' },
    spain: { title: 'Taste of Spain', description: 'Mediterranean digital menu · zengin giriş, yatay menüler ve fotoğraflı ürün akışı', meta: 'Fine dining · Tapas · Çoklu menü', tier: 'FREE' },
    obsidian: { title: 'Obsidian', description: 'Kontrast siyah sahne · premium ürün kartları ve güçlü marka vurgusu', meta: 'Bar · Steakhouse · Gece konsepti', tier: 'PRO' },
    kiosk: { title: 'Kiosk Express', description: 'Hızlı seçim · büyük CTA ve self servis akışı', meta: 'Quick service · Kiosk · Yoğun operasyon', tier: 'FREE' },
    shio: { title: 'Shio Minimal', description: 'Dingin yüzeyler · sade listeleme ve premium boşluk', meta: 'Sushi · Ramen · Modern restoran', tier: 'FREE' },
    sofra: { title: 'Sofra Sıcak', description: 'Yumuşak tonlar · okunaklı kategori ve ürün düzeni', meta: 'Aile restoranı · Kahvaltı · Yerel mutfak', tier: 'FREE' },
    midnight: { title: 'Midnight Club', description: 'Koyu sahne · neon vurgu ve güçlü sepet aksiyonu', meta: 'Lounge · Kokteyl · Gece menüsü', tier: 'PRO' },
    bloom: { title: 'Bloom Patisserie', description: 'Canlı pembe tonlar · tatlı ve butik kafe deneyimi', meta: 'Patisserie · Coffee shop · Butik', tier: 'FREE' },
  }
  return copy[id] ?? {
    title: name,
    description: `${name} teması · kendi renk, tipografi ve bileşen yapısıyla gelir`,
    meta: 'Özelleştirilebilir şablon',
    tier: 'FREE' as const,
  }
}

const templateOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 210,
  background: 'rgba(17,17,19,.48)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
} as const

const sectionOverlayStyle = { ...templateOverlayStyle, zIndex: 200, backdropFilter: 'blur(9px)', WebkitBackdropFilter: 'blur(9px)' } as const

function trapDialogFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) =>
    !element.hasAttribute('disabled') &&
    element.getAttribute('aria-hidden') !== 'true' &&
    element.offsetParent !== null,
  )
  if (focusable.length === 0) return
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
