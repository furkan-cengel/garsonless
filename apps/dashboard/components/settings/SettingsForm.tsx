'use client'

import { useState, useTransition } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@garsonless/db'
import { updateRestaurant, uploadLogo } from '../../lib/actions/restaurant'
import dynamic from 'next/dynamic'
import { DEFAULT_TIERS, type LoyaltyTier, type CatalogReward } from './loyalty-config'
import type { SecurityEventView } from './AdvancedSections'

const KitchenAccessSection   = dynamic(() => import('./KitchenAccessSection'))
const LoyaltySection         = dynamic(() => import('./LoyaltySection'))
const ProfileSection         = dynamic(() => import('./AccountSections').then(m => ({ default: m.ProfileSection })))
const TeamSection            = dynamic(() => import('./AccountSections').then(m => ({ default: m.TeamSection })))
const StoreSection           = dynamic(() => import('./StoreSections').then(m => ({ default: m.StoreSection })))
const HoursSection           = dynamic(() => import('./StoreSections').then(m => ({ default: m.HoursSection })))
const TaxSection             = dynamic(() => import('./StoreSections').then(m => ({ default: m.TaxSection })))
const LanguagesSection       = dynamic(() => import('./StoreSections').then(m => ({ default: m.LanguagesSection })))
const PaymentsSection        = dynamic(() => import('./BusinessSections').then(m => ({ default: m.PaymentsSection })))
const NotificationsSection   = dynamic(() => import('./BusinessSections').then(m => ({ default: m.NotificationsSection })))
const ApiSection             = dynamic(() => import('./AdvancedSections').then(m => ({ default: m.ApiSection })))
const SecuritySection        = dynamic(() => import('./AdvancedSections').then(m => ({ default: m.SecuritySection })))
const BillingSection         = dynamic(() => import('./AdvancedSections').then(m => ({ default: m.BillingSection })))
import PageTopBar from '../layout/PageTopBar'
import { I, S, Tag, btnPrimary, btnGhost } from '../../lib/ui'

/* ============================================================
   NAV STRUCTURE
   ============================================================ */
type SectionId =
  | 'workspace' | 'profile' | 'team'
  | 'store' | 'hours' | 'tax' | 'languages'
  | 'payments' | 'loyalty' | 'kitchen' | 'notifications'
  | 'api' | 'billing' | 'security'

interface NavItem {
  id: SectionId
  label: string
  desc: string
  icon: React.ReactNode
  badge?: string
  tone?: 'positive' | 'neutral'
}

interface NavGroup { title: string; items: NavItem[] }

const SI: Record<string, React.ReactNode> = {
  user: <I.user size={16} />,
  home: <I.home size={16} />,
  users: <I.users size={16} />,
  store: <I.store size={16} />,
  clock: <I.clock size={16} />,
  receipt: <I.receipt size={16} />,
  globe: <I.globe size={16} />,
  card: <I.card size={16} />,
  sparkles: <I.sparkles size={16} />,
  cutlery: <I.cutlery size={16} />,
  bell: <I.bell size={16} />,
  code: <I.code size={16} />,
  invoice: <I.invoice size={16} />,
  shield: <I.shield size={16} />,
  gift: <I.gift size={16} />,
}

const GROUPS: NavGroup[] = [
  {
    title: 'Hesap',
    items: [
      { id: 'profile',   label: 'Profil',         desc: 'Ad, e-posta',            icon: SI.user },
      { id: 'workspace', label: 'Çalışma Alanı',  desc: 'Ad, slug, logo',         icon: SI.home },
      { id: 'team',      label: 'Ekip & İzinler', desc: 'Üyeler ve roller',       icon: SI.users },
    ],
  },
  {
    title: 'Mağaza',
    items: [
      { id: 'store',     label: 'Mağaza Bilgisi', desc: 'Adres, iletişim',        icon: SI.store },
      { id: 'hours',     label: 'Çalışma Saatleri', desc: 'Gün ve saat aralıkları', icon: SI.clock },
      { id: 'tax',       label: 'Vergi & Fatura', desc: 'KDV, stopaj',            icon: SI.receipt },
      { id: 'languages', label: 'Diller',         desc: 'TR · EN · AR',           icon: SI.globe },
    ],
  },
  {
    title: 'İşletme',
    items: [
      { id: 'payments',      label: 'Ödeme Yöntemleri', desc: 'iyzico aktif',          icon: SI.card },
      { id: 'loyalty',       label: 'Sadakat',          desc: 'Damga, puan, üyelik',   icon: SI.gift },
      { id: 'kitchen',       label: 'Mutfak Ekranı',    desc: 'KDS erişim kodu',       icon: SI.cutlery },
      { id: 'notifications', label: 'Bildirimler',      desc: 'E-posta, SMS, push',    icon: SI.bell },
    ],
  },
  {
    title: 'Gelişmiş',
    items: [
      { id: 'api',      label: 'API & Webhooks',  desc: 'Geliştirici erişimi',    icon: SI.code },
      { id: 'billing',  label: 'Faturalama',      desc: 'Pro plan',               icon: SI.invoice },
      { id: 'security', label: 'Güvenlik',        desc: '2FA & oturum',           icon: SI.shield, tone: 'positive' },
    ],
  },
]

const SECTION_META: Record<SectionId, { label: string; desc: string; group: string }> = {
  workspace:     { label: 'Çalışma Alanı',  desc: 'Restoranın adını, kısa URL\'ini ve logosunu buradan düzenle.',       group: 'Hesap' },
  profile:       { label: 'Profil',         desc: 'Hesap bilgilerini ve profil fotoğrafını güncelle.',                  group: 'Hesap' },
  team:          { label: 'Ekip & İzinler', desc: 'Ekip üyelerini ekle veya çıkar, rolleri düzenle.',                  group: 'Hesap' },
  store:         { label: 'Mağaza Bilgisi', desc: 'Adres, iletişim bilgileri ve sosyal medya.',                         group: 'Mağaza' },
  hours:         { label: 'Çalışma Saatleri', desc: 'Haftalık gün ve saat aralıklarını ayarla.',                       group: 'Mağaza' },
  tax:           { label: 'Vergi & Faturalama', desc: 'KDV oranı, stopaj ve e-fatura sağlayıcısı.',                    group: 'Mağaza' },
  languages:     { label: 'Diller',         desc: 'Müşteri menüsünde görünecek dilleri seç.',                          group: 'Mağaza' },
  payments:      { label: 'Ödeme Yöntemleri', desc: 'Müşterilerin sipariş ekranında görebileceği ödeme yöntemlerini seç.', group: 'İşletme' },
  loyalty:       { label: 'Sadakat',        desc: 'Damga ve puan programını, kapsamı ve kazanım kurallarını ayarla.',  group: 'İşletme' },
  kitchen:       { label: 'Mutfak Ekranı',  desc: 'Mutfak ekranı erişim kodunu yönet.',                                group: 'İşletme' },
  notifications: { label: 'Bildirimler',    desc: 'E-posta, SMS ve push bildirim tercihlerini ayarla.',                group: 'İşletme' },
  api:           { label: 'API & Webhooks', desc: 'Geliştirici API anahtarları ve webhook URL\'leri.',                 group: 'Gelişmiş' },
  billing:       { label: 'Faturalama',     desc: 'Plan detayları, fatura geçmişi ve ödeme yöntemi.',                  group: 'Gelişmiş' },
  security:      { label: 'Güvenlik',       desc: 'İki faktörlü doğrulama ve aktif oturumlar.',                        group: 'Gelişmiş' },
}

/* ============================================================
   LEFT NAV
   ============================================================ */
function SettingsNav({ active, onSelect }: { active: SectionId; onSelect: (id: SectionId) => void }) {
  return (
    <div style={{
      width: 'var(--nav)', flexShrink: 0,
      borderRight: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Ayarlar</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>Mağaza ve hesap yönetimi</div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px 12px' }}>
        {GROUPS.map((g, gi) => (
          <div key={gi} style={{ marginTop: gi === 0 ? 4 : 12 }}>
            <div style={{ ...S.label, padding: '6px 8px' }}>{g.title}</div>
            {g.items.map(item => (
              <NavRow
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => onSelect(item.id)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function NavRow({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: '7px 8px', marginBottom: 1,
        background: active ? 'var(--surface-inset)' : (hov ? 'var(--surface-3)' : 'transparent'),
        border: 'none', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <span style={{ color: active ? 'var(--text)' : 'var(--text-3)', display: 'inline-flex' }}>{item.icon}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: 'var(--text)' }}>{item.label}</span>
        <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.desc}</span>
      </span>
      {item.badge && <Tag tone={item.tone ?? 'neutral'}>{item.badge}</Tag>}
    </button>
  )
}

/* ============================================================
   CONTENT WRAPPER
   ============================================================ */
function ContentArea({ active, children }: { active: SectionId; children: React.ReactNode }) {
  const meta = SECTION_META[active]
  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', minWidth: 0 }}>
      <div style={{ maxWidth: active === 'loyalty' ? 880 : 760, margin: '0 auto', padding: '32px 32px 60px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-3)', marginBottom: 6 }}>
            <span>{meta.group}</span>
            <I.chevRight size={11} />
            <span style={{ color: 'var(--text)' }}>{meta.label}</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{meta.label}</h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5, marginBottom: 0 }}>{meta.desc}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

/* ============================================================
   SECTION: WORKSPACE
   ============================================================ */
function WorkspaceSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const [name, setName] = useState(restaurant.name)
  const [slug, setSlug] = useState(restaurant.slug)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const fd = new FormData()
      fd.append('id', restaurant.id)
      fd.append('name', name)
      fd.append('slug', slug)
      const result = await updateRestaurant(fd)
      if ('error' in result) { setError(result.error); return }
      setSaved(true)
    })
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadLogo(restaurant.id, fd)
    if ('error' in result) setError(result.error)
  }

  const inp: React.CSSProperties = {
    height: 36, padding: '0 10px', width: '100%',
    border: '1px solid var(--border-strong)', borderRadius: 6,
    background: 'var(--surface)', fontSize: 13, outline: 'none',
    color: 'var(--text)', fontFamily: 'inherit',
  }

  return (
    <form onSubmit={handleSave}>
      <SettingsCard title="Mağaza kimliği" subtitle="Müşterilere ve sisteme gösterilen temel bilgiler">
        <SettingsRow label="Mağaza adı" hint="Müşteri menüsü ve faturalarda görünür">
          <input value={name} onChange={e => setName(e.target.value)} style={inp} required />
        </SettingsRow>
        <SettingsRow label="URL slug" hint={`menu.garsonless.app/${slug}`}>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))}
            style={{ ...inp, fontFamily: "'Geist Mono', monospace" }}
            required
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Logo" subtitle="PNG veya SVG, en az 256×256" style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 12,
            background: 'var(--surface-3)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
          }}>
            {restaurant.logo_url
              ? <img src={restaurant.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ color: 'var(--text-4)', display: 'inline-flex' }}><I.cutlery size={24} /></span>}
          </div>
          <div>
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              ...btnGhost(), cursor: 'pointer',
            }}>
              <I.image size={13} />Logo değiştir
              <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
            </label>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 6 }}>PNG, JPG veya SVG · max 2 MB</div>
          </div>
        </div>
      </SettingsCard>

      {error && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--critical-bg)', color: 'var(--critical)', borderRadius: 7, fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{
        marginTop: 20, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10,
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {saved ? '✓ Kaydedildi' : 'Kaydetmek için değişiklik yap'}
        </span>
        <button type="submit" disabled={isPending} style={btnPrimary()}>
          <I.check size={13} />{isPending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </form>
  )
}

/* ============================================================
   SECTION: LOYALTY (wrapper)
   ============================================================ */
function LoyaltySectionWrapper({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const s = restaurant.settings as Record<string, unknown>
  const raw = (s['loyalty'] ?? {}) as Record<string, unknown>
  const str = (k: string, d: string) => (typeof raw[k] === 'string' ? (raw[k] as string) : d)
  const numv = (k: string, d: number) => (typeof raw[k] === 'number' ? (raw[k] as number) : d)
  const bool = (k: string, d: boolean) => (typeof raw[k] === 'boolean' ? (raw[k] as boolean) : d)
  const tiers = Array.isArray(raw['tiers']) && (raw['tiers'] as unknown[]).length > 0
    ? (raw['tiers'] as LoyaltyTier[])
    : DEFAULT_TIERS
  const rewardCatalog = Array.isArray(raw['reward_catalog']) ? (raw['reward_catalog'] as CatalogReward[]) : []
  return (
    <LoyaltySection
      restaurantId={restaurant.id}
      initial={{
        stamp_enabled: bool('stamp_enabled', false),
        stamp_goal: numv('stamp_goal', 10),
        stamp_reward_text: str('stamp_reward_text', ''),
        reward_item_id: typeof raw['reward_item_id'] === 'string' ? (raw['reward_item_id'] as string) : null,
        points_enabled: bool('points_enabled', false),
        points_per_lira: numv('points_per_lira', 1),
        points_redeem_rate: numv('points_redeem_rate', 100),
        scope: str('scope', 'restaurant') === 'network' ? 'network' : 'restaurant',
        earn_trigger: str('earn_trigger', 'paid') === 'served' ? 'served' : 'paid',
        member_discount_pct: numv('member_discount_pct', 0),
        welcome_bonus_points: numv('welcome_bonus_points', 0),
        tiers,
        reward_catalog: rewardCatalog,
      }}
    />
  )
}

/* ============================================================
   SECTION: KITCHEN (wrapper)
   ============================================================ */
function KitchenSectionWrapper({ restaurantId, kitchenToken }: { restaurantId: string; kitchenToken: string | null }) {
  return (
    <KitchenAccessSection
      restaurantId={restaurantId}
      existingToken={kitchenToken}
    />
  )
}

/* ============================================================
   SHARED CARD PRIMITIVES
   ============================================================ */
function SettingsCard({ title, subtitle, children, style }: {
  title: string
  subtitle?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12,
      border: '1px solid var(--border)', overflow: 'hidden',
      ...style,
    }}>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--divider)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div>{children}</div>
    </div>
  )
}

function SettingsRow({ label, hint, children }: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px', borderBottom: '1px solid var(--divider)',
    }}>
      <div style={{ width: 180, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{hint}</div>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

/* ============================================================
   MAIN
   ============================================================ */
interface Props {
  restaurant: Tables<'restaurants'>
  user: User | null
  /** GAP #1: kitchen token, fetched server-side from kitchen_credentials. */
  kitchenToken: string | null
  /** The signed-in user's own security events (RLS-scoped, fetched server-side). */
  securityEvents: SecurityEventView[]
}

export default function SettingsForm({ restaurant, user, kitchenToken, securityEvents }: Props) {
  const [active, setActive] = useState<SectionId>('workspace')

  function renderContent() {
    switch (active) {
      case 'workspace':     return <WorkspaceSection restaurant={restaurant} />
      case 'loyalty':       return <LoyaltySectionWrapper restaurant={restaurant} />
      case 'kitchen':       return <KitchenSectionWrapper restaurantId={restaurant.id} kitchenToken={kitchenToken} />
      case 'profile':       return <ProfileSection user={user} />
      case 'team':          return <TeamSection />
      case 'store':         return <StoreSection restaurant={restaurant} />
      case 'hours':         return <HoursSection restaurant={restaurant} />
      case 'tax':           return <TaxSection restaurant={restaurant} />
      case 'languages':     return <LanguagesSection restaurant={restaurant} />
      case 'payments':      return <PaymentsSection restaurantId={restaurant.id} />
      case 'notifications': return <NotificationsSection restaurant={restaurant} />
      case 'api':           return <ApiSection restaurant={restaurant} />
      case 'security':      return <SecuritySection events={securityEvents} userEmail={user?.email ?? ''} />
      case 'billing':       return <BillingSection />
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PageTopBar
        restaurantName={restaurant.name}
        title="Ayarlar"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--positive)', display: 'inline-block' }} />
              Otomatik kaydedildi
            </div>
          </div>
        }
      />

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <SettingsNav active={active} onSelect={setActive} />
        <ContentArea active={active}>
          {renderContent()}
        </ContentArea>
      </div>
    </div>
  )
}
