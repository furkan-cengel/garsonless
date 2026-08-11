'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@garsonless/db/types'
import { updateRestaurant, uploadLogo } from '../../lib/actions/restaurant'
import dynamic from 'next/dynamic'
import { DEFAULT_TIERS, type LoyaltyTier, type CatalogReward } from './loyalty-config'
import type { SecurityEventView } from './AdvancedSections'
import type { TeamMember } from '@garsonless/db/types'
import type { TeamAuditEventView } from './AccountSections'
import type { SubscriptionBillingSettings } from '@garsonless/application/billing'
import type { BillingPlanPrices } from '../../lib/billing/subscription-billing-request'

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
const BillingSection         = dynamic(() => import('./BillingSection'))
import PageTopBar from '../layout/PageTopBar'
import UnsavedChangesDialog from '../overlays/UnsavedChangesDialog'
import { useShell } from '../../lib/shell-context'
import { I, S, Tag } from '../../lib/ui'
import { notifySettingsSaved, SETTINGS_DIRTY_EVENT, SETTINGS_SAVED_EVENT } from './settings-dirty-state'
import {
  canAccessSettingsSection,
  resolveSettingsSection,
  type SettingsSectionId,
} from './settings-sections'
import styles from './SettingsForm.module.css'
import { Alert, AlertDescription } from '../ui/alert'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import { FormRow, SCard } from './primitives'
import {
  Attachment,
  AttachmentMedia,
} from '../ui/attachment'

/* ============================================================
   NAV STRUCTURE
   ============================================================ */
type SectionId = SettingsSectionId

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
      { id: 'tax',       label: 'Vergi & Fatura', desc: 'KDV, firma',             icon: SI.receipt },
      { id: 'languages', label: 'Diller',         desc: 'TR varsayılan',          icon: SI.globe },
    ],
  },
  {
    title: 'İşletme',
    items: [
      { id: 'payments',      label: 'Ödeme Yöntemleri', desc: 'İyzico ve tahsilat',    icon: SI.card },
      { id: 'loyalty',       label: 'Sadakat',          desc: 'Damga, puan, üyelik',   icon: SI.gift },
      { id: 'kitchen',       label: 'Mutfak Ekranı',    desc: 'KDS güvenli oturumu',   icon: SI.cutlery },
      { id: 'notifications', label: 'Bildirimler',      desc: 'Sipariş ve masa uyarıları', icon: SI.bell },
    ],
  },
  {
    title: 'Gelişmiş',
    items: [
      { id: 'api',      label: 'API & Webhooks',  desc: 'Geliştirici erişimi',    icon: SI.code },
      { id: 'billing',  label: 'Faturalama',      desc: 'Plan özeti',             icon: SI.invoice },
      { id: 'security', label: 'Güvenlik',        desc: 'Şifre ve güvenlik',      icon: SI.shield, tone: 'positive' },
    ],
  },
]

const SECTION_META: Record<SectionId, { label: string; desc: string; group: string }> = {
  workspace:     { label: 'Çalışma Alanı',  desc: 'Restoranın adını, kısa URL\'ini ve logosunu buradan düzenle.',       group: 'Hesap' },
  profile:       { label: 'Profil',         desc: 'Hesap adını ve iletişim bilgilerini güncelle.',                      group: 'Hesap' },
  team:          { label: 'Ekip & İzinler', desc: 'Ekip üyelerini ekle veya çıkar, rolleri düzenle.',                  group: 'Hesap' },
  store:         { label: 'Mağaza Bilgisi', desc: 'Adres, iletişim bilgileri ve sosyal medya.',                         group: 'Mağaza' },
  hours:         { label: 'Çalışma Saatleri', desc: 'Haftalık gün ve saat aralıklarını ayarla.',                       group: 'Mağaza' },
  tax:           { label: 'Vergi & Faturalama', desc: 'Firma bilgileri ve varsayılan vergi oranı. E-fatura entegrasyonu yok.', group: 'Mağaza' },
  languages:     { label: 'Diller',         desc: 'Bu sürümde müşteri menüsü Türkçe çalışır; çeviri altyapısı yakında.', group: 'Mağaza' },
  payments:      { label: 'Ödeme Yöntemleri', desc: 'İyzico kart ödemesi ve personel tahsilatı akışlarını yönet.',      group: 'İşletme' },
  loyalty:       { label: 'Sadakat',        desc: 'Damga ve puan programını, kapsamı ve kazanım kurallarını ayarla.',  group: 'İşletme' },
  kitchen:       { label: 'Mutfak Ekranı',  desc: 'Mutfak ekranının güvenli oturumunu ve istasyonlarını yönet.',        group: 'İşletme' },
  notifications: { label: 'Bildirimler',    desc: 'Sipariş, masa ve tarayıcı bildirim tercihlerini ayarla.',           group: 'İşletme' },
  api:           { label: 'API & Webhooks', desc: 'Geliştirici API ve webhook altyapısı bu sürümde kapalı.',            group: 'Gelişmiş' },
  billing:       { label: 'Faturalama',     desc: 'Planını, fatura profilini ve abonelik ödemelerini yönet.',           group: 'Gelişmiş' },
  security:      { label: 'Güvenlik',       desc: 'Şifre değişimi ve hesap güvenliği.',                                group: 'Gelişmiş' },
}

/* ============================================================
   LEFT NAV
   ============================================================ */
// OWNER-ONLY settings sub-sections — a 'settings' member never sees these.
// (Profile + Security are per-user; store/hours/tax/languages/notifications are
// the member-editable store config.)
function canSeeSection(id: SectionId, isOwner: boolean): boolean {
  return canAccessSettingsSection(id, isOwner)
}

function SettingsNav({ active, onSelect, isOwner }: { active: SectionId; onSelect: (id: SectionId) => void; isOwner: boolean }) {
  const activeItemRef = useRef<HTMLButtonElement>(null)
  const groups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => canSeeSection(item.id, isOwner)) }))
    .filter(g => g.items.length > 0)

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [active])

  return (
    <div className={styles.nav} data-settings-nav>
      <div className={styles.navHeader}>
        <div className={styles.navTitle}>Ayarlar</div>
        <div className={styles.navSubtitle}>Mağaza ve hesap yönetimi</div>
      </div>

      <div className={styles.navScroller}>
        {groups.map(g => (
          <div key={g.title} className={styles.navGroup}>
            <div className={styles.navGroupTitle} style={S.label}>{g.title}</div>
            {g.items.map(item => (
              <NavRow
                key={item.id}
                item={item}
                active={active === item.id}
                onClick={() => onSelect(item.id)}
                buttonRef={active === item.id ? activeItemRef : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function NavRow({ item, active, onClick, buttonRef }: {
  item: NavItem
  active: boolean
  onClick: () => void
  buttonRef?: React.Ref<HTMLButtonElement>
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      ref={buttonRef}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`${styles.navRow}${active ? ` ${styles.navRowActive}` : ''}`}
      data-settings-section={item.id}
    >
      <span className={styles.navRowIcon}>{item.icon}</span>
      <span className={styles.navRowCopy}>
        <span className={styles.navRowLabel}>{item.label}</span>
        <span className={styles.navRowDescription}>{item.desc}</span>
      </span>
      {item.badge && <Tag tone={item.tone ?? 'neutral'}>{item.badge}</Tag>}
    </Button>
  )
}

/* ============================================================
   CONTENT WRAPPER
   ============================================================ */
function ContentArea({ active, children, onChangeCapture }: { active: SectionId; children: React.ReactNode; onChangeCapture?: () => void }) {
  const meta = SECTION_META[active]
  return (
    <div onChangeCapture={onChangeCapture} className={styles.contentArea} data-settings-content>
      <div className={styles.contentInner} style={{ maxWidth: active === 'loyalty' ? 880 : 760 }}>
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
  const router = useRouter()
  const identitySnapshotRef = useRef({ name: restaurant.name, slug: restaurant.slug })
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(restaurant.name)
  const [slug, setSlug] = useState(restaurant.slug)
  const [logoUrl, setLogoUrl] = useState(restaurant.logo_url)
  const [error, setError] = useState('')
  const [logoFeedback, setLogoFeedback] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isLogoPending, startLogoTransition] = useTransition()
  const identityDirty = name !== identitySnapshotRef.current.name || slug !== identitySnapshotRef.current.slug

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
      identitySnapshotRef.current = { name, slug }
      setSaved(true)
      notifySettingsSaved()
    })
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setError('')
    setLogoFeedback('')
    startLogoTransition(async () => {
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadLogo(restaurant.id, fd)
      if ('error' in result) {
        setError(result.error)
        return
      }
      // Public storage URLs may retain an image cache after an overwrite. The
      // persisted value stays canonical; this preview-only version shows the
      // just-uploaded asset immediately.
      setLogoUrl(`${result.url}${result.url.includes('?') ? '&' : '?'}v=${Date.now()}`)
      setLogoFeedback('✓ Logo güncellendi')
      notifySettingsSaved()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSave} aria-busy={isPending || isLogoPending}>
      <SCard
        title="Mağaza kimliği"
        subtitle="Müşterilere ve sisteme gösterilen temel bilgiler"
        footer={(
          <>
            <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
              {isPending
                ? 'Mağaza bilgileri kaydediliyor…'
                : saved
                  ? '✓ Mağaza bilgileri güncellendi'
                  : identityDirty
                    ? 'Kaydedilmemiş değişiklik var'
                    : 'Mağaza bilgileri güncel'}
            </span>
            <Button type="submit" aria-busy={isPending} disabled={isPending || !identityDirty}>
              {isPending ? <Spinner data-icon="inline-start" /> : <I.check data-icon="inline-start" />}
              {isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        )}
      >
        <FormRow label="Mağaza adı" hint="Müşteri menüsü ve faturalarda görünür">
          <Input
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false) }}
            autoComplete="organization"
            className="w-72 max-w-full"
            required
          />
        </FormRow>
        <FormRow label="URL slug" hint={`menu.masabu.co/${slug}`}>
          <Input
            value={slug}
            onChange={e => { setSlug(e.target.value.replace(/[^a-z0-9-]/g, '')); setSaved(false) }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-72 max-w-full font-mono"
            required
          />
        </FormRow>
      </SCard>

      <SCard title="Mağaza logosu" subtitle="Müşteri menüsü ve QR ekranlarında görünür" style={{ marginTop: 16 }}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <Input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={handleLogoChange}
            disabled={isLogoPending}
          />
          <Attachment
            state={isLogoPending ? 'uploading' : logoUrl ? 'done' : 'idle'}
            size="sm"
            orientation="vertical"
            className="size-32 shrink-0 overflow-hidden p-0!"
            aria-busy={isLogoPending}
          >
            <AttachmentMedia variant={logoUrl ? 'image' : 'icon'} className="size-full! rounded-none! bg-background">
              {logoUrl
                ? <img src={logoUrl} alt="Mağaza logosu" className="size-full object-cover!" />
                : isLogoPending
                  ? <Spinner />
                  : <I.cutlery />}
            </AttachmentMedia>
          </Attachment>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">
                {isLogoPending ? 'Logo yükleniyor…' : logoFeedback || (logoUrl ? 'Logo yüklendi' : 'Henüz logo yüklenmedi')}
              </div>
              <div className="text-sm leading-relaxed text-muted-foreground">
                Logo önizleme alanını tamamen doldurur. Farklı oranlardaki görseller kenarlardan kırpılabilir. PNG, JPG veya WEBP · en fazla 2 MB.
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={isLogoPending}
              onClick={() => logoInputRef.current?.click()}
            >
              {isLogoPending ? <Spinner data-icon="inline-start" /> : <I.image data-icon="inline-start" />}
              {isLogoPending ? 'Yükleniyor…' : logoUrl ? 'Logoyu değiştir' : 'Logo yükle'}
            </Button>
          </div>
        </div>
      </SCard>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

    </form>
  )
}

/* ============================================================
   SECTION: LOYALTY (wrapper)
   ============================================================ */
function LoyaltySectionWrapper({ restaurant, featureAllowed }: { restaurant: Tables<'restaurants'>; featureAllowed: boolean }) {
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
      featureAllowed={featureAllowed}
      initialSettings={s}
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
function KitchenSectionWrapper({
  restaurantId,
  featureAllowed,
  hasKitchenAccess,
  kitchenStations,
}: {
  restaurantId: string
  featureAllowed: boolean
  hasKitchenAccess: boolean
  kitchenStations: Tables<'kitchen_stations'>[]
}) {
  return (
    <KitchenAccessSection
      restaurantId={restaurantId}
      featureAllowed={featureAllowed}
      initialHasAccess={hasKitchenAccess}
      initialStations={kitchenStations}
    />
  )
}

/* ============================================================
   MAIN
   ============================================================ */
interface Props {
  restaurant: Tables<'restaurants'>
  user: User | null
  /** Credential existence only; the secret remains server-side. */
  hasKitchenAccess: boolean
  kitchenStations: Tables<'kitchen_stations'>[]
  /** The signed-in user's own security events (RLS-scoped, fetched server-side). */
  securityEvents: SecurityEventView[]
  /** Server snapshot used for hydration-stable relative security-event labels. */
  renderedAt: string
  /** Whether the current user owns this restaurant (gates owner-only surfaces). */
  isOwner: boolean
  /** Team members (owner-only; empty for non-owners). */
  teamMembers: TeamMember[]
  /** Owner-only, restaurant-scoped team administration history. */
  teamAuditEvents: TeamAuditEventView[]
  /** Owner-only SaaS billing projection; provider references are excluded. */
  billing: SubscriptionBillingSettings | null
  billingLoadError: string | null
  billingPlanPrices: BillingPlanPrices
  initialSection: SectionId
  billingCheckoutState: 'success' | null
  featureAccess: {
    loyalty: boolean
    kitchenDisplay: boolean
    browserNotifications: boolean
  }
}

export default function SettingsForm({
  restaurant, user, hasKitchenAccess, kitchenStations, securityEvents, renderedAt,
  isOwner, teamMembers, teamAuditEvents, billing, billingLoadError,
  billingPlanPrices, initialSection, billingCheckoutState,
  featureAccess,
}: Props) {
  const { setNavigationGuard } = useShell()
  // A non-owner 'settings' member lands on a section they can see (workspace is owner-only).
  const [active, setActive] = useState<SectionId>(initialSection)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pendingSection, setPendingSection] = useState<SectionId | null>(null)
  const [pendingFromHistory, setPendingFromHistory] = useState(false)

  useEffect(() => {
    setNavigationGuard(hasUnsavedChanges
      ? 'Bu ayar bölümünde kaydedilmemiş değişiklikler var. Çıkarsan değişiklikler kaybolacak.'
      : null)
    return () => setNavigationGuard(null)
  }, [hasUnsavedChanges, setNavigationGuard])

  useEffect(() => {
    const onSaved = () => setHasUnsavedChanges(false)
    const onDirty = () => setHasUnsavedChanges(true)
    window.addEventListener(SETTINGS_SAVED_EVENT, onSaved)
    window.addEventListener(SETTINGS_DIRTY_EVENT, onDirty)
    return () => {
      window.removeEventListener(SETTINGS_SAVED_EVENT, onSaved)
      window.removeEventListener(SETTINGS_DIRTY_EVENT, onDirty)
    }
  }, [])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    const onPopState = () => {
      const requested = new URL(window.location.href).searchParams.get('section')
      const next = resolveSettingsSection(requested, isOwner)
      if (next === active) return
      if (hasUnsavedChanges) {
        setPendingFromHistory(true)
        setPendingSection(next)
        return
      }
      setActive(next)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [active, hasUnsavedChanges, isOwner])

  function sectionUrl(section: SectionId): string {
    const url = new URL(window.location.href)
    url.searchParams.set('section', section)
    if (section !== 'billing') url.searchParams.delete('checkout')
    return `${url.pathname}${url.search}${url.hash}`
  }

  function commitSectionChange(next: SectionId, mode: 'push' | 'replace' = 'push') {
    const url = sectionUrl(next)
    if (mode === 'replace') window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    setActive(next)
  }

  function requestSectionChange(next: SectionId) {
    if (next === active) return
    if (hasUnsavedChanges) {
      setPendingFromHistory(false)
      setPendingSection(next)
      return
    }
    commitSectionChange(next)
  }

  function renderContent() {
    // Defense in depth: never render an owner-only sub-section for a member.
    if (!canSeeSection(active, isOwner)) return null
    switch (active) {
      case 'workspace':     return <WorkspaceSection restaurant={restaurant} />
      case 'loyalty':       return <LoyaltySectionWrapper restaurant={restaurant} featureAllowed={featureAccess.loyalty} />
      case 'kitchen':       return <KitchenSectionWrapper restaurantId={restaurant.id} featureAllowed={featureAccess.kitchenDisplay} hasKitchenAccess={hasKitchenAccess} kitchenStations={kitchenStations} />
      case 'profile':       return <ProfileSection user={user} />
      case 'team':          return isOwner ? <TeamSection restaurantId={restaurant.id} ownerEmail={user?.email ?? ''} members={teamMembers} auditEvents={teamAuditEvents} /> : null
      case 'store':         return <StoreSection restaurant={restaurant} />
      case 'hours':         return <HoursSection restaurant={restaurant} />
      case 'tax':           return <TaxSection restaurant={restaurant} />
      case 'languages':     return <LanguagesSection />
      case 'payments':      return <PaymentsSection restaurantId={restaurant.id} />
      case 'notifications': return <NotificationsSection restaurant={restaurant} featureAllowed={featureAccess.browserNotifications} />
      case 'api':           return <ApiSection />
      case 'security':      return <SecuritySection events={securityEvents} renderedAt={renderedAt} userEmail={user?.email ?? ''} authProvider={typeof user?.app_metadata?.provider === 'string' ? user.app_metadata.provider : null} />
      case 'billing':       return <BillingSection
        restaurantId={restaurant.id}
        restaurantPlan={restaurant.plan}
        billing={billing}
        loadError={billingLoadError}
        planPrices={billingPlanPrices}
        checkoutState={billingCheckoutState}
      />
    }
  }

  return (
    <div className={styles.root} data-settings-root>
      <PageTopBar
        restaurantName={restaurant.name}
        title="Ayarlar"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-3)', fontSize: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--text-3)', display: 'inline-block' }} />
              Değişiklikler bölüm içinde kaydedilir
            </div>
          </div>
        }
      />

      <div className={styles.body}>
        <SettingsNav active={active} onSelect={requestSectionChange} isOwner={isOwner} />
        <ContentArea active={active} onChangeCapture={() => setHasUnsavedChanges(true)}>
          {renderContent()}
        </ContentArea>
      </div>
      {pendingSection && (
        <UnsavedChangesDialog
          description="Bu ayar bölümünde kaydedilmemiş değişiklikler var. Geçersen değişiklikler kaybolacak."
          discardLabel="Değişiklikleri sil ve geç"
          onKeepEditing={() => {
            if (pendingFromHistory) commitSectionChange(active, 'replace')
            setPendingFromHistory(false)
            setPendingSection(null)
          }}
          onDiscard={() => {
            const next = pendingSection
            setHasUnsavedChanges(false)
            if (pendingFromHistory) setActive(next)
            else commitSectionChange(next)
            setPendingFromHistory(false)
            setPendingSection(null)
          }}
        />
      )}
    </div>
  )
}
