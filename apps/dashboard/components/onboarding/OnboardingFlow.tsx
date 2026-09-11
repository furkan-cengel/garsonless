'use client'

import Image from 'next/image'
import Link from 'next/link'
import { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  CircleHelp,
  Download,
  ExternalLink,
  FileSpreadsheet,
  ImagePlus,
  LogOut,
  Plus,
  Store,
  Upload,
  UtensilsCrossed,
} from 'lucide-react'
import type { OnboardingSnapshot, OnboardingTargetPlan } from '@garsonless/application/onboarding'
import type { MenuBulkImportRow } from '../../lib/menu-import-validation'
import {
  createOnboardingMenuItem,
  createOnboardingRestaurant,
  importOnboardingCsvMenu,
  saveOnboardingBranding,
  saveOnboardingMenuDraft,
} from '../../lib/actions/onboarding'
import { checkSlugAvailable } from '../../lib/actions/restaurant'
import { uploadLogo } from '../../lib/dashboard-media-upload-client'
import { slugify } from '../../lib/utils'
import {
  normalizeDetectedTimezone,
  planLabel,
  publicMenuUrl,
  stepIndex,
  trialDaysRemaining,
} from './onboarding-model'
import styles from './OnboardingFlow.module.css'
import { menuSetupEvents, trackOnboardingEvent } from './onboarding-analytics'

const MENU_BASE_URL = process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'
const MENU_DISPLAY_HOST = (() => {
  try { return new URL(MENU_BASE_URL).host } catch { return 'masabu.co' }
})()
const DEFAULT_PREVIEW_ACCENT = '#2e7d52'
const STEP_META = [
  { label: 'İşletme', description: 'Ad, adres, saat dilimi', Icon: Store },
  { label: 'Marka', description: 'İsteğe bağlı logo', Icon: ImagePlus },
  { label: 'Menü', description: 'İlk ürünleri ekle', Icon: UtensilsCrossed },
]

interface Props {
  initialSnapshot: OnboardingSnapshot | null
  initialBusinessName: string
  requestedPlan: OnboardingTargetPlan
  requestedInterval?: 'monthly' | 'yearly'
  needsTerms?: boolean
  adminName: string
  adminEmail: string
}

interface CsvRowView {
  row: MenuBulkImportRow
  error: string | null
}

function stableRequest(ref: React.MutableRefObject<string | null>) {
  ref.current ??= crypto.randomUUID()
  return ref.current
}

function money(value: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value || 0)
}

function Field({ label, hint, error, children }: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldTop}>
        <span>{label}</span>
        {hint && <span className={styles.fieldHint}>{hint}</span>}
      </span>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </label>
  )
}

function MenuPreview({
  name,
  logo,
  accent,
  category,
  item,
  price,
}: {
  name: string
  logo: string
  accent: string
  category: string
  item: string
  price: number
}) {
  return (
    <div className={styles.menuPreview} style={{ '--preview-accent': accent } as React.CSSProperties}>
      <div className={styles.previewScreen}>
        <div className={styles.previewHero}>
          <div className={styles.previewBrand}>
            {logo ? <img src={logo} alt="" /> : <span>{(name || 'M').slice(0, 1).toLocaleUpperCase('tr-TR')}</span>}
          </div>
          <div>
            <strong>{name || 'İşletmen'}</strong>
            <small>Dijital Menü</small>
          </div>
        </div>
        <div className={styles.previewPills}>
          <span className={styles.previewPillActive}>{category || 'Menü'}</span>
          <span>Popüler</span>
        </div>
        <div className={styles.previewSectionTitle}>{category || 'İlk kategorin'}</div>
        <div className={styles.previewProduct}>
          <div>
            <strong>{item || 'İlk ürünün burada görünecek'}</strong>
            <p>Taze hazırlanır, keyifle servis edilir.</p>
            <b>{price > 0 ? money(price) : '₺ -'}</b>
          </div>
          <div className={styles.previewProductImage}><UtensilsCrossed size={18} /></div>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingFlow({
  initialSnapshot,
  initialBusinessName,
  requestedPlan,
  requestedInterval = 'monthly',
  needsTerms = false,
  adminName,
  adminEmail,
}: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const initialDraft = initialSnapshot?.menuDraft
  const [name, setName] = useState(initialSnapshot?.restaurantName || initialBusinessName)
  const [slug, setSlug] = useState(initialSnapshot?.slug || slugify(initialBusinessName))
  const [slugEdited, setSlugEdited] = useState(Boolean(initialSnapshot?.slug))
  const [timezone, setTimezone] = useState('Europe/Istanbul')
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState(initialSnapshot?.logoUrl ?? '')
  const [menuMode, setMenuMode] = useState<'manual' | 'csv'>(initialDraft?.mode ?? 'manual')
  const [categoryName, setCategoryName] = useState(initialDraft?.categoryName ?? '')
  const [itemName, setItemName] = useState(initialDraft?.itemName ?? '')
  const [price, setPrice] = useState(initialDraft?.price ?? '')
  const [description, setDescription] = useState(initialDraft?.description ?? '')
  const [csvRows, setCsvRows] = useState<CsvRowView[]>((initialDraft?.csvRows ?? []).map(entry => ({
    row: { sourceRow: entry.sourceRow, category: entry.category, name: entry.name, description: entry.description, price: entry.price === '' ? Number.NaN : Number(entry.price), ingredients: [], energyKcal: null, mayContainAllergens: [], containsAlcohol: false, containsPork: false },
    error: entry.error,
  })))
  const [csvFileName, setCsvFileName] = useState(initialDraft?.csvFileName ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const createRequest = useRef<string | null>(null)
  const brandingRequest = useRef<string | null>(null)
  const menuRequest = useRef<string | null>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const draftRequest = useRef<{ payload: string; id: string } | null>(null)
  const savingDraft = useRef(false)
  const logoutPending = useRef(false)

  const step = snapshot?.status === 'completed' ? 3 : stepIndex(snapshot)
  const targetPlan = snapshot?.targetPlan ?? requestedPlan
  const targetBillingInterval = snapshot?.targetBillingInterval ?? requestedInterval
  const liveUrl = snapshot?.slug ? publicMenuUrl(snapshot.slug, MENU_BASE_URL) : ''
  const csvValidRows = csvRows.filter((entry) => !entry.error)
  const previewName = snapshot?.restaurantName || name
  const previewLogo = logoPreview || snapshot?.logoUrl || ''
  const previewAccent = snapshot?.accent ?? DEFAULT_PREVIEW_ACCENT

  useEffect(() => {
    setTimezone(normalizeDetectedTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone))
  }, [])

  useEffect(() => {
    if (step !== 0 || !slug) { setSlugAvailable(null); return }
    let active = true
    setSlugAvailable(null)
    const timer = window.setTimeout(() => {
      void checkSlugAvailable(slug).then(value => { if (active) setSlugAvailable(value) }).catch(() => { if (active) setSlugAvailable(null) })
    }, 400)
    return () => { active = false; window.clearTimeout(timer) }
  }, [slug, step])

  useEffect(() => {
    if (!logoFile) return
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  const adminInitial = (adminName || adminEmail || 'M').slice(0, 1).toLocaleUpperCase('tr-TR')
  const topError = error ? <div className={styles.errorSummary} role="alert">{error}</div> : null

  function changeName(value: string) {
    setName(value)
    createRequest.current = null
    if (!slugEdited) setSlug(slugify(value))
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (needsTerms && !termsAccepted) { setError('Devam etmek için hizmet sözleşmesini kabul et.'); return }
    if (!name.trim()) { setError('İşletme adını girin.'); return }
    if (!slug || slugAvailable === false) { setError('Kullanılabilir bir menü adresi seçin.'); return }
    setBusy(true)
    try {
      const result = await createOnboardingRestaurant({
        name, slug, timezone, targetPlan, targetBillingInterval, termsAccepted, termsVersion: LEGAL_DOCUMENT_VERSION, requestId: stableRequest(createRequest),
      })
      if ('error' in result) {
        setError(result.error)
        if (result.snapshot) setSnapshot(result.snapshot)
        return
      }
      if (!result.replayed) trackOnboardingEvent({ name: 'trial_started', plan: 'pro' })
      setSnapshot(result.snapshot)
    } catch {
      setError('Bağlantı kurulamadı. Bilgilerin korundu; tekrar deneyebilirsin.')
    } finally {
      setBusy(false)
    }
  }

  async function handleBranding(skip = false) {
    if (!snapshot?.restaurantId) return
    setBusy(true)
    setError('')
    try {
      let nextLogo = snapshot.logoUrl
      if (!skip && logoFile) {
        const data = new FormData()
        data.append('file', logoFile)
        const uploaded = await uploadLogo(snapshot.restaurantId, data)
        if ('error' in uploaded) {
          setError(uploaded.error)
          return
        }
        nextLogo = uploaded.url
        setLogoPreview(uploaded.url)
        setLogoFile(null)
      }
      const result = await saveOnboardingBranding({
        restaurantId: snapshot.restaurantId,
        expectedRevision: snapshot.revision,
        requestId: stableRequest(brandingRequest),
      })
      if ('error' in result) {
        setError(result.error)
        if (result.snapshot) setSnapshot({ ...result.snapshot, logoUrl: nextLogo })
        return
      }
      setSnapshot({ ...result.snapshot, logoUrl: nextLogo })
    } catch {
      setError('Bağlantı kurulamadı. Marka taslağın korundu; tekrar deneyebilirsin.')
    } finally {
      setBusy(false)
    }
  }

  async function handleManualMenu(event: React.FormEvent) {
    event.preventDefault()
    if (!snapshot?.restaurantId) return
    const parsedPrice = Number(price.replace(',', '.'))
    if (!categoryName.trim() || !itemName.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Kategori, ürün adı ve geçerli satış fiyatını girin.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await createOnboardingMenuItem({
        restaurantId: snapshot.restaurantId,
        expectedRevision: snapshot.revision,
        requestId: stableRequest(menuRequest),
        categoryName,
        itemName,
        price: parsedPrice,
        description: description || undefined,
      })
      if ('error' in result) {
        setError(result.error)
        if (result.snapshot) setSnapshot(result.snapshot)
        return
      }
      menuSetupEvents(result, snapshot.itemCount).forEach(trackOnboardingEvent)
      setSnapshot(result.snapshot)
    } catch {
      setError('Bağlantı kurulamadı. Ürün taslağın korundu; tekrar deneyebilirsin.')
    } finally {
      setBusy(false)
    }
  }

  async function parseCsv(file: File) {
    setError('')
    setCsvRows([])
    menuRequest.current = null
    if (!file.name.toLocaleLowerCase('tr-TR').endsWith('.csv')) { setError('Yalnızca .csv dosyaları desteklenir.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('CSV dosyası 5 MB sınırını aşıyor.'); return }
    const Papa = (await import('papaparse')).default
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const fields = new Set(result.meta.fields ?? [])
        const missing = ['Kategori', 'Ad', 'Fiyat'].filter((field) => !fields.has(field))
        if (missing.length > 0) { setError(`Eksik zorunlu sütun: ${missing.join(', ')}`); return }
        if (result.data.length === 0 || result.data.length > 1000) {
          setError(result.data.length > 1000 ? 'Tek seferde en fazla 1.000 ürün aktarılabilir.' : 'Dosyada ürün satırı bulunamadı.')
          return
        }
        const seen = new Set<string>()
        const rows = result.data.map((raw, index): CsvRowView => {
          const category = (raw['Kategori'] ?? '').trim()
          const item = (raw['Ad'] ?? '').trim()
          const parsedPrice = Number((raw['Fiyat'] ?? '').replace(',', '.'))
          const key = `${category.toLocaleLowerCase('tr-TR')}\u0000${item.toLocaleLowerCase('tr-TR')}`
          const issues = [
            !category ? 'Kategori boş' : '',
            !item ? 'Ürün adı boş' : '',
            !Number.isFinite(parsedPrice) || parsedPrice <= 0 ? 'Fiyat geçersiz' : '',
            seen.has(key) ? 'Dosyada tekrar ediyor' : '',
          ].filter(Boolean)
          seen.add(key)
          return {
            row: {
              sourceRow: index + 2,
              category,
              name: item,
              description: (raw['Açıklama'] ?? '').trim(),
              price: parsedPrice,
              ingredients: [],
              energyKcal: null,
              mayContainAllergens: [],
              containsAlcohol: false,
              containsPork: false,
            },
            error: issues.length ? issues.join(' · ') : null,
          }
        })
        setCsvFileName(file.name)
        setCsvRows(rows)
      },
      error: (parseError) => setError(`CSV okunamadı: ${parseError.message}`),
    })
  }

  function downloadTemplate() {
    const csv = '\uFEFFKategori,Ad,Açıklama,Fiyat\nKahveler,Latte,Taze süt ve espresso,120\nTatlılar,Sütlaç,Fırında hazırlanır,85'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'masabu-menu-sablonu.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleCsvImport() {
    if (!snapshot?.restaurantId || csvValidRows.length === 0) return
    setBusy(true)
    setError('')
    try {
      const result = await importOnboardingCsvMenu({
        restaurantId: snapshot.restaurantId,
        expectedRevision: snapshot.revision,
        requestId: stableRequest(menuRequest),
        rows: csvValidRows.map((entry) => entry.row),
      })
      if ('error' in result) {
        setError(result.error)
        if (result.snapshot) setSnapshot(result.snapshot)
        return
      }
      menuSetupEvents(result, snapshot.itemCount).forEach(trackOnboardingEvent)
      setSnapshot(result.snapshot)
    } catch {
      setError('Bağlantı kurulamadı. CSV önizlemen korundu; aynı dosyayı güvenle tekrar deneyebilirsin.')
    } finally {
      setBusy(false)
    }
  }

  async function pauseOnboarding() {
    if (!snapshot?.restaurantId || busy || savingDraft.current) return
    savingDraft.current = true
    setBusy(true)
    setError('')
    const draft = { mode: menuMode, categoryName, itemName, price, description, csvFileName, csvRows: csvRows.map(({ row, error: rowError }) => ({
      sourceRow: row.sourceRow, category: row.category, name: row.name, description: row.description ?? '', price: Number.isFinite(row.price) ? String(row.price) : '', error: rowError,
    })) }
    const payload = JSON.stringify({ draft, revision: snapshot.revision })
    if (draftRequest.current?.payload !== payload) draftRequest.current = { payload, id: crypto.randomUUID() }
    try {
      const result = await saveOnboardingMenuDraft({ restaurantId: snapshot.restaurantId, expectedRevision: snapshot.revision, requestId: draftRequest.current.id, draft })
      if ('error' in result) {
        setError(result.error)
        if (result.snapshot) { setSnapshot(result.snapshot); draftRequest.current = null }
        return
      }
      setSnapshot(result.snapshot)
      window.location.assign('/dashboard/' + snapshot.restaurantId + '/menu')
    } catch { setError('Taslak kaydedilemedi. Bilgilerin korundu; tekrar deneyebilirsin.') }
    finally { savingDraft.current = false; setBusy(false) }
  }

  async function logout() {
    if (logoutPending.current || busy) return
    logoutPending.current = true
    setBusy(true)
    setError('')
    const result = await import('../../lib/client-logout')
      .then(({ logoutCurrentBrowser }) => logoutCurrentBrowser())
      .catch(() => ({ error: 'Çıkış yapılamadı. Bağlantını kontrol edip tekrar dene.' }))
    if ('error' in result) {
      logoutPending.current = false
      setBusy(false)
      setError(result.error)
      return
    }
    window.location.replace('/auth/login')
  }

  return (
    <main className={styles.page} data-scope="onboarding">
      <div className={styles.progressTrack} aria-hidden="true"><span style={{ width: `${Math.min(100, (step / 3) * 100)}%` }} /></div>
      <header className={styles.topbar}>
        <div className={styles.brandBar}>
          <Image src="/brand/masabu-logo-transparent.svg" alt="masabu" width={96} height={21} priority />
          <i />
          <span>Kurulum</span>
        </div>
        <div className={styles.topActions}>
          <a href="mailto:destek@masabu.co" aria-label="Yardım"><CircleHelp size={15} /> <span>Yardım</span></a>
          <button type="button" aria-label="Çıkış" disabled={busy} onClick={() => void logout()}><LogOut size={15} /> <span>Çıkış</span></button>
          <i />
          <div className={styles.accountIdentity} aria-label={`Oturum: ${adminName || adminEmail}`}>
            <span>{adminInitial}</span>
            <div><strong>{adminName || 'Hesap sahibi'}</strong><small>{adminEmail}</small></div>
          </div>
        </div>
      </header>

      <div className={`${styles.shell} ${step === 3 ? styles.successShell : ''}`}>
        {step < 3 && (
          <aside className={styles.stepRail} aria-label="Kurulum adımları">
            <span className={styles.railLabel}>KURULUM</span>
            <ol>
              {STEP_META.map(({ label, description, Icon }, index) => (
                <li key={label} className={index === step ? styles.stepActive : index < step ? styles.stepDone : ''} aria-current={index === step ? 'step' : undefined}>
                  <span className={styles.stepMarker}>{index < step ? <Check size={12} /> : index + 1}</span>
                  <span className={styles.stepText}><b>{label}</b><small>{description}</small></span>
                  <Icon className={styles.mobileStepIcon} size={14} />
                </li>
              ))}
            </ol>
            <p>Kurulum yaklaşık 2 dakika sürer. Her bilgiyi daha sonra Ayarlar’dan değiştirebilirsin.</p>
          </aside>
        )}
        <section className={styles.formPane}>
          {step === 0 && (
            <form className={styles.card} onSubmit={(event) => void handleCreate(event)} noValidate>
              <div className={styles.cardHeading}>
                <h1>İşletme bilgileri</h1>
                <p>Menü adresin bu bilgilerden oluşturulur.</p>
              </div>
              <div className={styles.cardBody}>
                {topError}
                <Field label="İşletme adı" error={!name.trim() && error ? 'Bu alan zorunlu.' : undefined}>
                  <input value={name} onChange={(event) => changeName(event.target.value)} autoFocus maxLength={100} aria-invalid={!name.trim() && Boolean(error)} placeholder="Acımarka Kahve" />
                  <span className={styles.helpText}>Müşterilerinin menüde göreceği ad.</span>
                </Field>
                <Field label="Menü adresi" error={slugAvailable === false ? 'Bu adres kullanımda.' : undefined}>
                  <div className={styles.slugInput}>
                    <span>{MENU_DISPLAY_HOST}/</span>
                    <input value={slug} onChange={(event) => { setSlugEdited(true); setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); createRequest.current = null }} aria-invalid={slugAvailable === false} maxLength={50} />
                  </div>
                  {slug && slugAvailable !== null && <span className={slugAvailable ? styles.available : styles.unavailable}>{slugAvailable ? '✓ Bu adres müsait' : '× Bu adres kullanımda'}</span>}
                  <span className={styles.helpText}>QR kodların bu adrese yönlenir.</span>
                </Field>
                {needsTerms && <div className={styles.helpText}>
                  <label><input type="checkbox" checked={termsAccepted} onChange={event => setTermsAccepted(event.target.checked)} required/> <Link target="_blank" href="https://masabu.co/yasal/abonelik-hizmet-sozlesmesi">B2B Abonelik Hizmet Sözleşmesi’ni</Link> okudum ve kabul ediyorum.</label>
                  <p><Link target="_blank" href="https://masabu.co/yasal/kvkk-aydinlatma-metni">KVKK Aydınlatma Metni’ni</Link> inceleyebilirsin.</p>
                </div>}
                <div className={styles.trialCard}>
                  <div><strong>14 günlük Pro denemen hazır</strong><p>Hedef paketin: <b>{planLabel(targetPlan)}</b> · {targetBillingInterval === 'yearly' ? 'Yıllık' : 'Aylık'}. Deneme için kart gerekmez; yalnız ücretli abonelik başlatırken istenir.</p></div>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Adım 1 / 3</span>
                <button className={styles.primaryButton} type="submit" disabled={busy || slugAvailable === false}>{busy ? 'Oluşturuluyor…' : <>Devam <ArrowRight size={15} /></>}</button>
              </div>
            </form>
          )}

          {step === 1 && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <h1>Marka görünümü</h1>
                <p>Varsayılan menü görünümün otomatik hazırlanır. İstersen logonu şimdi ekleyebilirsin.</p>
              </div>
              <div className={`${styles.cardBody} ${styles.brandingGrid}`}>
                <div className={styles.brandingFields}>
                  {topError}
                  <Field label="Logo" hint="İsteğe bağlı">
                    <button type="button" className={styles.uploadZone} onClick={() => document.getElementById('onboarding-logo')?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setLogoFile(event.dataTransfer.files[0] ?? null); brandingRequest.current = null }}>
                      {previewLogo ? <img src={previewLogo} alt="Logo önizlemesi" /> : <><ImagePlus size={18} /><span><b>Dosya seç</b><small>PNG, JPG veya WebP · En fazla 2 MB</small></span></>}
                    </button>
                    <input id="onboarding-logo" className={styles.hiddenInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setLogoFile(event.target.files?.[0] ?? null); brandingRequest.current = null }} />
                    <span className={styles.helpText}>Yüklemezsen işletme adının baş harfi kullanılır.</span>
                  </Field>
                </div>
                <div className={styles.inlinePreview}>
                  <span>ÖNİZLEME</span>
                  <MenuPreview name={previewName} logo={previewLogo} accent={previewAccent} category="Kahve" item="Filtre Kahve" price={48} />
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Adım 2 / 3</span>
                <div><button className={styles.ghostButton} type="button" disabled={busy} onClick={() => void handleBranding(true)}>Bu adımı atla</button><button className={styles.primaryButton} type="button" disabled={busy} onClick={() => void handleBranding(false)}>{busy ? 'Kaydediliyor…' : <>Devam <ArrowRight size={15} /></>}</button></div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className={styles.card}>
              <div className={styles.cardHeading}>
                <h1>Menüyü nasıl kuralım?</h1>
                <p>İlk gerçek ürününü elle ekleyebilir veya CSV dosyandan aktarabilirsin.</p>
              </div>
              <div className={styles.cardBody}>
                {topError}
                <div className={styles.modeGrid}>
                  <button type="button" className={menuMode === 'manual' ? styles.modeActive : ''} onClick={() => { setMenuMode('manual'); setError(''); menuRequest.current = null }}><i /><span><Plus size={16} /></span><strong>Manuel oluştur<small>Kategori ve ilk ürününü elle ekle</small></strong><em>~2 dk</em></button>
                  <button type="button" className={menuMode === 'csv' ? styles.modeActive : ''} onClick={() => { setMenuMode('csv'); setError(''); menuRequest.current = null }}><i /><span><FileSpreadsheet size={16} /></span><strong>CSV yükle<small>Excel dosyanı CSV olarak dışa aktar</small></strong><em>Şablon mevcut</em></button>
                </div>
                <div className={styles.menuEditor}>
              {menuMode === 'manual' ? (
                <form onSubmit={(event) => void handleManualMenu(event)}>
                  <Field label="Kategori adı"><input value={categoryName} onChange={(event) => { setCategoryName(event.target.value); menuRequest.current = null }} maxLength={100} placeholder="Örn. Kahveler" /></Field>
                  <Field label="İlk ürün adı"><input value={itemName} onChange={(event) => { setItemName(event.target.value); menuRequest.current = null }} maxLength={100} placeholder="Örn. Latte" /></Field>
                  <div className={styles.twoFields}>
                    <Field label="Satış fiyatı"><div className={styles.priceInput}><span>₺</span><input inputMode="decimal" value={price} onChange={(event) => { setPrice(event.target.value.replace(/[^0-9.,]/g, '')); menuRequest.current = null }} placeholder="120" /></div></Field>
                    <Field label="Kısa açıklama" hint="Opsiyonel"><input value={description} onChange={(event) => { setDescription(event.target.value); menuRequest.current = null }} maxLength={500} placeholder="Taze süt ve espresso" /></Field>
                  </div>
                  <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? 'Ekleniyor…' : <>İlk ürünümü ekle <ArrowRight size={15} /></>}</button>
                </form>
              ) : (
                <div>
                  <input ref={csvInput} className={styles.hiddenInput} type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void parseCsv(file); event.target.value = '' }} />
                  <button type="button" className={styles.csvDrop} onClick={() => csvInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void parseCsv(file) }}><Upload size={23} /><strong>{csvFileName || 'CSV dosyanı seç veya buraya bırak'}</strong><small>Kategori, Ad ve Fiyat sütunları zorunludur · En fazla 1.000 ürün</small></button>
                  <button type="button" className={styles.templateLink} onClick={downloadTemplate}><Download size={14} /> Örnek CSV’yi indir</button>
                  {csvRows.length > 0 && (
                    <div className={styles.csvPreview}>
                      <div className={styles.csvSummary}><strong>{csvValidRows.length} hazır</strong><span>{csvRows.length - csvValidRows.length} hatalı satır</span></div>
                      <div className={styles.csvTable} role="table" aria-label="CSV ürün önizlemesi">
                        {csvRows.slice(0, 6).map(({ row, error: rowError }) => <div key={row.sourceRow} className={rowError ? styles.csvErrorRow : ''} role="row"><span>{row.category || '-'}</span><b>{row.name || '-'}</b><span>{Number.isFinite(row.price) ? money(row.price) : '-'}</span><small>{rowError || 'Hazır'}</small></div>)}
                      </div>
                    </div>
                  )}
                  <button className={styles.primaryButton} type="button" disabled={busy || csvValidRows.length === 0} onClick={() => void handleCsvImport()}>{busy ? 'Menü içe aktarılıyor…' : <>Menüyü içe aktar <ArrowRight size={15} /></>}</button>
                </div>
              )}
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Adım 3 / 3</span>
                <button type="button" className={styles.ghostButton} onClick={() => void pauseOnboarding()} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet ve sonra devam et'}</button>
              </div>
            </section>
          )}

          {step === 3 && snapshot?.restaurantId && (
            <section className={`${styles.card} ${styles.successCard}`}>
              <div className={styles.successHeader}>
                <div className={styles.successMark}><Check size={18} /></div>
                <div><h1>{snapshot.restaurantName} yayında</h1><p>Menü adresin çalışıyor. QR kodunu hazırlayıp müşterilerinle paylaşabilirsin.</p></div>
              </div>
              <div className={styles.successUrl}>
                <code>{liveUrl}</code>
                <a href={liveUrl} target="_blank" rel="noreferrer" onClick={() => trackOnboardingEvent({ name: 'menu_preview_click', placement: 'onboarding_complete' })}>Canlı menüyü gör <ExternalLink size={14} /></a>
              </div>
              <div className={styles.nextSteps}>
                <a href={`/dashboard/${snapshot.restaurantId}/menu`}><span><b>Menünü düzenle</b><small>Daha fazla kategori ve ürün ekle</small></span><ArrowRight size={15} /></a>
                <a href={`/dashboard/${snapshot.restaurantId}/tables`}><span><b>QR kodunu oluştur</b><small>Masaların için indirilebilir QR üret</small></span><ArrowRight size={15} /></a>
              </div>
              <div className={styles.successFooter}><span>Pro denemende {trialDaysRemaining(snapshot.trialEndsAt)} gün kaldı</span><a className={styles.primaryLink} href={`/dashboard/${snapshot.restaurantId}/menu`}>Panele git <ArrowRight size={15} /></a></div>
            </section>
          )}
          <footer className={styles.preferencesFooter}><button type="button" onClick={() => window.dispatchEvent(new Event('masabu:open-cookie-preferences'))}>Çerez yönetimi</button></footer>
        </section>
      </div>
    </main>
  )
}
