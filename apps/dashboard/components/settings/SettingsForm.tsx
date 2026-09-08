'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LockKeyhole } from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@garsonless/db/types'
import dynamic from 'next/dynamic'
import type { SecurityEventView } from './AdvancedSections'
import type { TeamMember } from '@garsonless/db/types'
import type { TeamAuditEventView } from './AccountSections'
import type { SubscriptionBillingSettings } from '@garsonless/application/billing'
import type { BillingPlanPrices } from '../../lib/billing/subscription-billing-request'
import type { IntegrationHealth } from '@garsonless/application/settings'

import { SettingsSectionLoading as SectionLoading } from './SettingsLoadingFrame'
const SettingsPlanLock = dynamic(() => import('./SettingsPlanLock'), { loading: SectionLoading })
const KitchenAccessSection   = dynamic(() => import('./KitchenAccessSection'), { loading: SectionLoading })
const LoyaltySettingsSection = dynamic(() => import('./LoyaltySettingsSection'), { loading: SectionLoading })
const WorkspaceSection       = dynamic(() => import('./WorkspaceSection'), { loading: SectionLoading })
const ProfileSection         = dynamic(() => import('./AccountSections').then(m => ({ default: m.ProfileSection })), { loading: SectionLoading })
const TeamSection            = dynamic(() => import('./AccountSections').then(m => ({ default: m.TeamSection })), { loading: SectionLoading })
const StoreSection           = dynamic(() => import('./StoreSections').then(m => ({ default: m.StoreSection })), { loading: SectionLoading })
const HoursSection           = dynamic(() => import('./StoreSections').then(m => ({ default: m.HoursSection })), { loading: SectionLoading })
const TaxSection             = dynamic(() => import('./StoreSections').then(m => ({ default: m.TaxSection })), { loading: SectionLoading })
const LanguagesSection       = dynamic(() => import('./StoreSections').then(m => ({ default: m.LanguagesSection })), { loading: SectionLoading })
const PaymentsSection        = dynamic(() => import('./BusinessSections').then(m => ({ default: m.PaymentsSection })), { loading: SectionLoading })
const NotificationsSection   = dynamic(() => import('./BusinessSections').then(m => ({ default: m.NotificationsSection })), { loading: SectionLoading })
const ApiSection             = dynamic(() => import('./AdvancedSections').then(m => ({ default: m.ApiSection })), { loading: SectionLoading })
const SecuritySection        = dynamic(() => import('./AdvancedSections').then(m => ({ default: m.SecuritySection })), { loading: SectionLoading })
const PrivacySection         = dynamic(() => import('./AdvancedSections').then(m => ({ default: m.PrivacySection })), { loading: SectionLoading })
const BillingSection         = dynamic(() => import('./BillingSection'), { loading: SectionLoading })
import PageTopBar from '../layout/PageTopBar'
const UnsavedChangesDialog = dynamic(() => import('../overlays/UnsavedChangesDialog'))
import { useShell } from '../../lib/shell-context'
import { I, S, Tag } from '../../lib/ui'
import { SETTINGS_DIRTY_EVENT, SETTINGS_SAVED_EVENT, SETTINGS_CONFIRM_DISCARD_EVENT, type SettingsConfirmDiscardDetail, type SettingsDirtyEventDetail } from './settings-dirty-state'
import {
  canAccessSettingsSection,
  resolveSettingsSection,
  type SettingsSectionsAccess,
  type SettingsSectionId,
} from './settings-sections'
import styles from './SettingsForm.module.css'
import { Alert, AlertDescription } from '../ui/alert'
import { Button } from '../ui/button'
import { useSettingsRevision } from './use-settings-revision'
import { SETTINGS_CONFLICT_EVENT, type SettingsConflictEventDetail } from './settings-conflict-state'
import SettingsConflictDialog from './SettingsConflictDialog'

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
  privacy: <I.eyeOff size={16} />,
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
      { id: 'privacy',  label: 'Gizlilik',        desc: 'Dışa aktarma ve talepler', icon: SI.privacy },
    ],
  },
]

const LOCKED_CONTINUITY_SECTIONS = new Set<SectionId>(['workspace', 'profile', 'billing', 'security', 'privacy'])

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
  privacy:       { label: 'Gizlilik',        desc: 'Veri dışa aktarma ve hesap veya işletme kapatma talepleri.',        group: 'Gelişmiş' },
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

function SettingsNav({ active, onSelect, isOwner, productLocked, sectionsAccess }: { active: SectionId; onSelect: (id: SectionId) => void; isOwner: boolean; productLocked: boolean; sectionsAccess: SettingsSectionsAccess }) {
  const activeItemRef = useRef<HTMLButtonElement>(null)
  const groups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => canSeeSection(item.id, isOwner) && (!productLocked || LOCKED_CONTINUITY_SECTIONS.has(item.id))) }))
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
                locked={!sectionsAccess[item.id].allowed}
                requiredPlanLabel={sectionsAccess[item.id].requiredPlanLabel}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function NavRow({ item, active, onClick, buttonRef, locked, requiredPlanLabel }: {
  item: NavItem
  active: boolean
  onClick: () => void
  buttonRef?: React.Ref<HTMLButtonElement>
  locked: boolean
  requiredPlanLabel: string | null
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      ref={buttonRef}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      aria-label={locked ? `${item.label}, ${requiredPlanLabel ?? 'üst paket'} gerekir` : undefined}
      className={`${styles.navRow}${active ? ` ${styles.navRowActive}` : ''}`}
      data-settings-section={item.id}
    >
      <span className={styles.navRowIcon}>{item.icon}</span>
      <span className={styles.navRowCopy}>
        <span className={styles.navRowLabel}>{item.label}</span>
        <span className={styles.navRowDescription}>{locked ? `${requiredPlanLabel ?? 'Üst paket'} gerekir` : item.desc}</span>
      </span>
      {locked
        ? <span className={styles.navRowLock} aria-hidden="true"><LockKeyhole size={15} strokeWidth={1.8} /></span>
        : item.badge && <Tag tone={item.tone ?? 'neutral'}>{item.badge}</Tag>}
    </Button>
  )
}

/* ============================================================
   CONTENT WRAPPER
   ============================================================ */
function ContentArea({ active, children }: { active: SectionId; children: React.ReactNode }) {
  const meta = SECTION_META[active]
  return (
    <div className={styles.contentArea} data-settings-content>
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
export interface SettingsFormProps {
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
  productLocked: boolean
  sectionsAccess: SettingsSectionsAccess
  integrationHealth: IntegrationHealth[]
  sectionLoadError: string | null
}

export default function SettingsForm({
  restaurant, user, hasKitchenAccess, kitchenStations, securityEvents, renderedAt,
  isOwner, teamMembers, teamAuditEvents, billing, billingLoadError,
  billingPlanPrices, initialSection, billingCheckoutState,
  featureAccess, productLocked, integrationHealth, sectionLoadError,
  sectionsAccess,
}: SettingsFormProps) {
  const router = useRouter()
  const sectionInUrl = useSearchParams().get('section')
  const { setNavigationGuard } = useShell()
  // A non-owner 'settings' member lands on a section they can see (workspace is owner-only).
  const [active, setActive] = useState<SectionId>(initialSection)
  const [dirtySources, setDirtySources] = useState<Set<string>>(() => new Set())
  const hasUnsavedChanges = dirtySources.size > 0
  const blockingSources = useRef(new Set<string>())
  const lastContent = useRef<ReactNode>(null)
  const historySession = useRef<string | null>(null)
  const historyPosition = useRef(0)
  const restoringHistory = useRef(false)
  const allowHistory = useRef(false)
  const pendingHistoryDelta = useRef(0)
  const pendingHistorySection = useRef<SectionId | null>(null)
  const settingsRevision = useSettingsRevision(restaurant.id, hasUnsavedChanges)
  const [pendingSection, setPendingSection] = useState<SectionId | null>(null)
  const [pendingFromHistory, setPendingFromHistory] = useState(false)
  const [conflict, setConflict] = useState<SettingsConflictEventDetail | null>(null)

  useEffect(() => {
    setActive(resolveSettingsSection(sectionInUrl, isOwner))
  }, [sectionInUrl, isOwner])

  useEffect(() => {
    // A history-cache restore can update the URL before its section payload.
    // Fetch the matching payload instead of leaving the loading guard stranded.
    if (resolveSettingsSection(sectionInUrl, isOwner) === active && initialSection !== active) router.refresh()
  }, [sectionInUrl, active, initialSection, isOwner, router])



  useEffect(() => {
    setNavigationGuard(hasUnsavedChanges
      ? 'Bu ayar bölümünde kaydedilmemiş değişiklikler var. Çıkarsan değişiklikler kaybolacak.'
      : null)
    return () => setNavigationGuard(null)
  }, [hasUnsavedChanges, setNavigationGuard])

  useEffect(() => {
    const source = (event: Event) => (event as CustomEvent<SettingsDirtyEventDetail>).detail?.source ?? 'active-section'
    const onSaved = (event: Event) => setDirtySources(current => {
      const next = new Set(current)
      next.delete(source(event))
      blockingSources.current.delete(source(event))
      return next
    })
    const onDirty = (event: Event) => setDirtySources(current => {
      const next = new Set(current)
      next.add(source(event))
      if ((event as CustomEvent<SettingsDirtyEventDetail>).detail?.blocking) blockingSources.current.add(source(event))
      else blockingSources.current.delete(source(event))
      return next
    })
    window.addEventListener(SETTINGS_SAVED_EVENT, onSaved)
    window.addEventListener(SETTINGS_DIRTY_EVENT, onDirty)
    return () => {
      window.removeEventListener(SETTINGS_SAVED_EVENT, onSaved)
      window.removeEventListener(SETTINGS_DIRTY_EVENT, onDirty)
    }
  }, [])

  useEffect(() => {
    const onConflict = (event: Event) => setConflict((event as CustomEvent<SettingsConflictEventDetail>).detail)
    window.addEventListener(SETTINGS_CONFLICT_EVENT, onConflict)
    return () => window.removeEventListener(SETTINGS_CONFLICT_EVENT, onConflict)
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
    if (initialSection !== active || 'navigation' in window) return
    // Next owns its history state. Preserve it and add only our traversal marker.
    const existing = window.history.state?.masabuSettings
    if (!historySession.current) historySession.current = existing?.session ?? crypto.randomUUID()
    if (existing?.session === historySession.current && existing.section === initialSection) {
      historyPosition.current = existing.position
    } else {
      window.history.replaceState({...window.history.state, masabuSettings:{session:historySession.current,position:historyPosition.current,section:initialSection}}, '', window.location.href)
    }
  }, [initialSection, active])

  useEffect(() => {
    // Cancel traversal before the URL changes when the browser supports it.
    // This avoids a transient route render while a draft confirmation is open.
    const navigation = (window as Window & { navigation?: EventTarget & { currentEntry: { index: number } | null } }).navigation
    if (!navigation) return
    const onNavigate = (event: Event) => {
      const traversal = event as Event & { navigationType: string; destination: {url: string; index: number} }
      if (traversal.navigationType !== 'traverse' || !event.cancelable || allowHistory.current) return
      const destination = new URL(traversal.destination.url)
      if (destination.pathname !== window.location.pathname) return
      const next = resolveSettingsSection(destination.searchParams.get('section'), isOwner)
      if (next === active || (!hasUnsavedChanges && !blockingSources.current.size)) return
      event.preventDefault()
      if (blockingSources.current.size) return
      pendingHistoryDelta.current = traversal.destination.index - (navigation.currentEntry?.index ?? traversal.destination.index)
      confirmSectionChange(next, true)
    }
    navigation.addEventListener('navigate', onNavigate)
    return () => navigation.removeEventListener('navigate', onNavigate)
  })

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (restoringHistory.current) {
        event.stopImmediatePropagation()
        restoringHistory.current = false
        historyPosition.current = event.state?.masabuSettings?.position ?? historyPosition.current
        if (pendingHistorySection.current && !blockingSources.current.size) {
          confirmSectionChange(pendingHistorySection.current, true)
        }
        pendingHistorySection.current = null
        return
      }
      const next = resolveSettingsSection(new URL(window.location.href).searchParams.get('section'), isOwner)
      if (allowHistory.current) { allowHistory.current = false; return }
      if (next === active) return
      const marker = event.state?.masabuSettings
      if ((hasUnsavedChanges || blockingSources.current.size) && marker?.session === historySession.current) {
        const delta = marker.position - historyPosition.current
        if (delta !== 0) {
          // Capture before Next suspends/unmounts the section, then restore the
          // current entry while the user decides. Both Back and Forward work.
          event.stopImmediatePropagation()
          pendingHistoryDelta.current = delta
          restoringHistory.current = true
          pendingHistorySection.current = next
          window.history.go(-delta)
          return
        }
      }
      // Next restores its URL first; sectionInUrl then updates the selected view.
    }
    window.addEventListener('popstate', onPopState, true)
    return () => window.removeEventListener('popstate', onPopState, true)
  })

  function sectionUrl(section: SectionId): string {
    const url = new URL(window.location.href)
    url.searchParams.set('section', section)
    if (section !== 'billing') {
      url.searchParams.delete('checkout')
      url.searchParams.delete('plan')
      url.searchParams.delete('interval')
    }
    return `${url.pathname}${url.search}${url.hash}`
  }

  function commitSectionChange(next: SectionId, mode: 'push' | 'replace' = 'push') {
    const url = sectionUrl(next)
    setActive(next)
    if (mode === 'replace') router.replace(url)
    else { historyPosition.current++; router.push(url) }
  }

  function discardSectionChange(next: SectionId, fromHistory: boolean) {
    if (blockingSources.current.size) return
    setDirtySources(new Set())
    if (fromHistory) { allowHistory.current = true; window.history.go(pendingHistoryDelta.current) }
    else commitSectionChange(next)
    setPendingFromHistory(false)
    setPendingSection(null)
  }

  function confirmSectionChange(next: SectionId, fromHistory: boolean) {
    const event = new CustomEvent<SettingsConfirmDiscardDetail>(SETTINGS_CONFIRM_DISCARD_EVENT, {
      cancelable: true, detail: {onDiscard: () => discardSectionChange(next, fromHistory)},
    })
    window.dispatchEvent(event)
    if (!event.defaultPrevented) {
      setPendingFromHistory(fromHistory)
      setPendingSection(next)
    }
  }

  function requestSectionChange(next: SectionId) {
    if (next === active || blockingSources.current.size) return
    if (hasUnsavedChanges) {
      confirmSectionChange(next, false)
      return
    }
    commitSectionChange(next)
  }

  function renderContent() {
    if (active !== initialSection) return <SectionLoading />
    // Defense in depth: never render an owner-only sub-section for a member.
    if (!canSeeSection(active, isOwner)) return null
    const sectionAccess = sectionsAccess[active]
    if (!sectionAccess.allowed) {
      return (
        <SettingsPlanLock feature={active === 'notifications' ? 'browser_notifications' : sectionAccess.feature ?? 'qr_menu'}
          label={SECTION_META[active].label} requiredPlanLabel={sectionAccess.requiredPlanLabel}
          isOwner={isOwner} onBilling={() => requestSectionChange('billing')} />
      )
    }
    switch (active) {
      case 'workspace':     return <WorkspaceSection restaurant={restaurant} />
      case 'loyalty':       return <LoyaltySettingsSection restaurant={restaurant} featureAllowed={featureAccess.loyalty} />
      case 'kitchen':       return <KitchenSectionWrapper restaurantId={restaurant.id} featureAllowed={featureAccess.kitchenDisplay} hasKitchenAccess={hasKitchenAccess} kitchenStations={kitchenStations} />
      case 'profile':       return <ProfileSection user={user} onOpenSecurity={() => requestSectionChange('security')} />
      case 'team':          return isOwner ? <TeamSection restaurantId={restaurant.id} ownerEmail={user?.email ?? ''} members={teamMembers} auditEvents={teamAuditEvents} /> : null
      case 'store':         return <StoreSection restaurant={restaurant} isOwner={isOwner} />
      case 'hours':         return <HoursSection restaurant={restaurant} />
      case 'tax':           return <TaxSection restaurant={restaurant} />
      case 'languages':     return <LanguagesSection />
      case 'payments':      return <PaymentsSection restaurantId={restaurant.id} health={integrationHealth.find(item => item.provider === 'iyzico') ?? null} />
      case 'notifications': return <NotificationsSection restaurant={restaurant} featureAllowed={featureAccess.browserNotifications} />
      case 'api':           return <ApiSection resendHealth={integrationHealth.find(item => item.provider === 'resend') ?? null} />
      case 'security':      return <SecuritySection events={securityEvents} renderedAt={renderedAt} userEmail={user?.email ?? ''} authProvider={typeof user?.app_metadata?.provider === 'string' ? user.app_metadata.provider : null} />
      case 'privacy':       return isOwner ? <PrivacySection restaurantId={restaurant.id} restaurantName={restaurant.name} /> : null
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

  const content = active === initialSection ? renderContent() : hasUnsavedChanges ? lastContent.current : <SectionLoading />
  useEffect(() => { if (active === initialSection) lastContent.current = content })

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
        <SettingsNav active={active} onSelect={requestSectionChange} isOwner={isOwner} productLocked={productLocked} sectionsAccess={sectionsAccess} />
        <ContentArea active={active}>
          {settingsRevision.hasRemoteRevision && (
            <Alert className="mb-4 border-[var(--warning-bg)] text-[var(--warning)]">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>Bu ayarlar başka bir oturumda güncellendi. Taslağınız korunuyor; sunucudaki sürümü almak taslağınızı siler.</span>
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setDirtySources(new Set())
                  settingsRevision.refreshFromServer()
                }}>Sunucudaki sürümü al</Button>
              </AlertDescription>
            </Alert>
          )}
          {productLocked && (
            <Alert className="mb-4 border-[var(--warning-bg)] text-[var(--warning)]">
              <AlertDescription>
                Ürün erişimi kilitli. Verileriniz korunur; profil, çalışma alanı, güvenlik ve faturalama araçlarına erişmeye devam edebilirsiniz.
              </AlertDescription>
            </Alert>
          )}
          {sectionLoadError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                <span>Bu bölümün verileri yüklenemedi: {sectionLoadError}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>Tekrar dene</Button>
              </AlertDescription>
            </Alert>
          )}
          {content}
        </ContentArea>
      </div>
      {pendingSection && <UnsavedChangesDialog
          description="Bu ayar bölümünde kaydedilmemiş değişiklikler var. Geçersen değişiklikler kaybolacak."
          discardLabel="Değişiklikleri sil ve geç"
          onKeepEditing={() => {
            setPendingFromHistory(false)
            setPendingSection(null)
          }}
          onDiscard={() => {
            if (pendingSection) discardSectionChange(pendingSection, pendingFromHistory)
          }}
        />}
      {conflict && <SettingsConflictDialog conflict={conflict} onClose={() => setConflict(null)} />}
    </div>
  )
}
