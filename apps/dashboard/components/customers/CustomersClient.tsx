'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type {
  CampaignAudienceInput,
  CampaignAudiencePreview,
  CampaignSummary,
  CustomerSegmentDefinition,
  RestaurantCustomer,
  RestaurantCustomersPage,
  SavedCustomerSegment,
} from '@garsonless/db'
import {
  createCustomerSegmentAction,
  deleteCustomerSegmentAction,
  listCustomers,
  updateCustomerSegmentAction,
} from '../../lib/actions/customers'
import {
  previewCampaignAudienceAction,
  sendCampaignAction,
  sendCampaignTestAction,
} from '../../lib/actions/campaigns'
import { formatCurrency } from '../../lib/utils'
import { I, S, btnGhost, btnPrimary } from '../../lib/ui'
import PageTopBar from '../layout/PageTopBar'

const SEGMENTS: { id: string; label: string }[] = [
  { id: '', label: 'Tümü' },
  { id: 'new', label: 'Yeni üyeler' },
  { id: 'frequent', label: 'Sık gelenler' },
  { id: 'lapsed', label: 'Uzun süredir gelmeyen' },
  { id: 'consented', label: 'İzinli' },
]
const SORTS: { id: string; label: string }[] = [
  { id: 'last_seen', label: 'Son görülme' },
  { id: 'spend', label: 'En çok harcayan' },
  { id: 'visits', label: 'En çok ziyaret' },
  { id: 'points', label: 'En yüksek puan' },
  { id: 'joined', label: 'Katılım' },
]
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

function relTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Bugün'
  if (days === 1) return 'Dün'
  if (days < 30) return `${days} gün önce`
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86_400_000)
}

function initials(name: string | null): string {
  const parts = (name || 'İsimsiz').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
  return (parts[0] ?? 'M').slice(0, 2).toUpperCase()
}

function softForTier(color: string): string {
  const map: Record<string, string> = {
    '#b87333': '#f3e7dc',
    '#8a9099': '#eceef0',
    '#c8922a': '#f6ecd6',
    '#5b7a86': '#e3edf0',
  }
  return map[color.toLowerCase()] ?? 'var(--surface-3)'
}

function tagsForCustomer(c: RestaurantCustomer): string[] {
  const tags: string[] = [c.authLinked ? 'Bağlı hesap' : 'Bağlantısız kayıt']
  const firstDays = daysSince(c.firstSeen)
  const lastDays = daysSince(c.lastSeen)
  if (firstDays !== null && firstDays <= 30) tags.push('Yeni üye')
  if (c.visits >= 3) tags.push('Sık gelen')
  if (c.tierIndex >= 2) tags.push('VIP')
  if (lastDays !== null && lastDays >= 60) tags.push('Uzun süredir gelmeyen')
  if (!c.hasConsent) tags.push('İzin yok')
  return tags.slice(0, 3)
}

export default function CustomersClient({
  restaurantId,
  restaurantName,
  initial,
  initialSegments,
  initialCampaigns,
}: {
  restaurantId: string
  restaurantName: string
  initial: RestaurantCustomersPage
  initialSegments: SavedCustomerSegment[]
  initialCampaigns: CampaignSummary[]
}) {
  const router = useRouter()
  const [data, setData] = useState<RestaurantCustomersPage>(initial)
  const [savedSegments, setSavedSegments] = useState<SavedCustomerSegment[]>(initialSegments)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('')
  const [customSegmentId, setCustomSegmentId] = useState<string | null>(null)
  const [sort, setSort] = useState('last_seen')
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState<SegmentEditorState | null>(null)
  const [campaignOpen, setCampaignOpen] = useState(false)
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>(initialCampaigns)
  const [segmentError, setSegmentError] = useState<string | null>(null)
  const [savingSegment, setSavingSegment] = useState(false)
  const [pending, startTransition] = useTransition()
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await listCustomers(restaurantId, { search, segment, customSegmentId, sort, page })
        if ('error' in res) setSegmentError(res.error)
        else {
          setData(res)
          setSegmentError(null)
        }
      })
    }, 250)
    return () => clearTimeout(t)
  }, [restaurantId, search, segment, customSegmentId, sort, page])

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const activeSavedSegment = customSegmentId
    ? savedSegments.find((sg) => sg.id === customSegmentId) ?? null
    : null
  const visibleSpend = data.customers.reduce((sum, c) => sum + c.spend, 0)
  const visiblePoints = data.customers.reduce((sum, c) => sum + c.points, 0)
  const consentedVisible = data.customers.filter((c) => c.hasConsent).length

  function countForBuiltIn(id: string): number {
    if (id === '') return data.total
    return data.customers.filter((c) => {
      if (id === 'new') {
        const d = daysSince(c.firstSeen)
        return d !== null && d <= 30
      }
      if (id === 'frequent') return c.visits >= 3
      if (id === 'lapsed') {
        const d = daysSince(c.lastSeen)
        return d !== null && d >= 60
      }
      if (id === 'consented') return c.hasConsent
      return false
    }).length
  }

  function applyBuiltInSegment(id: string) {
    setSegment(id)
    setCustomSegmentId(null)
    setPage(1)
  }

  function applySavedSegment(id: string) {
    setCustomSegmentId(id)
    setSegment('')
    setPage(1)
  }

  function openCreateFromCurrent() {
    const fromSaved = activeSavedSegment
    const builtIn = SEGMENTS.find((sg) => sg.id === segment)
    setSegmentError(null)
    setEditor({
      mode: 'create',
      name: fromSaved ? `${fromSaved.name} kopya` : builtIn?.id ? builtIn.label : 'Yeni segment',
      definition: fromSaved?.definition ?? definitionFromBuiltIn(segment),
    })
  }

  function openEditSegment(saved: SavedCustomerSegment) {
    setSegmentError(null)
    setEditor({
      mode: 'edit',
      segmentId: saved.id,
      name: saved.name,
      definition: saved.definition,
    })
  }

  async function handleSaveSegment(input: { name: string; definition: CustomerSegmentDefinition }) {
    if (!editor) return
    setSavingSegment(true)
    setSegmentError(null)
    const res = editor.mode === 'edit'
      ? await updateCustomerSegmentAction(restaurantId, editor.segmentId, input)
      : await createCustomerSegmentAction(restaurantId, input)
    setSavingSegment(false)
    if ('error' in res) {
      setSegmentError(res.error)
      return
    }
    setSavedSegments((prev) => {
      if (editor.mode === 'edit') return prev.map((sg) => sg.id === res.id ? res : sg)
      return [...prev, res]
    })
    setCustomSegmentId(res.id)
    setSegment('')
    setPage(1)
    setEditor(null)
  }

  async function handleDeleteSegment(saved: SavedCustomerSegment) {
    const ok = window.confirm(`"${saved.name}" segmenti silinsin mi?`)
    if (!ok) return
    setSegmentError(null)
    const res = await deleteCustomerSegmentAction(restaurantId, saved.id)
    if ('error' in res) {
      setSegmentError(res.error)
      return
    }
    setSavedSegments((prev) => prev.filter((sg) => sg.id !== saved.id))
    if (customSegmentId === saved.id) {
      setCustomSegmentId(null)
      setSegment('')
      setPage(1)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <PageTopBar restaurantName={restaurantName} title="Müşteriler" tag={<span style={{ ...S.caption }}>{data.total} kişi</span>} />

      <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)', minWidth: 0 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 32px 60px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: '-0.025em', margin: 0 }}>Müşteriler</h1>
              <p style={{ fontSize: 13.5, color: 'var(--text-2)', margin: '5px 0 0' }}>Üyeler, sadakat bakiyeleri ve ziyaret geçmişi</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setCampaignOpen(true)} style={{ ...btnGhost({ height: 38, padding: '0 16px', borderRadius: 9, fontSize: 13.5 }) }}>
                <I.bell size={14} />SMS kampanyası
              </button>
              <button type="button" onClick={openCreateFromCurrent} style={{ ...btnPrimary({ height: 38, padding: '0 16px', borderRadius: 9, fontSize: 13.5 }) }}>
                <I.plus size={13} />Filtreyi kaydet
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 22 }}>
            <MiniStat label="Toplam müşteri" value={data.total.toLocaleString('tr-TR')} icon={<I.users size={15} />} />
            <MiniStat label="İzinli üye" value={consentedVisible.toLocaleString('tr-TR')} icon={<I.check size={15} />} sub={`Bu sayfada ${data.customers.length ? Math.round((consentedVisible / data.customers.length) * 100) : 0}%`} />
            <MiniStat label="Görünen harcama" value={formatCurrency(visibleSpend)} icon={<I.card size={15} />} mono />
            <MiniStat label="Görünen puan" value={visiblePoints.toLocaleString('tr-TR')} icon={<I.star size={15} />} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-1)' }}>
              <span style={{ color: 'var(--text-3)', display: 'inline-flex' }}><I.search size={16} /></span>
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Ad veya telefon sonu (örn. 67)"
                style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5, color: 'var(--text)' }}
              />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Sırala</span>
              <select
                value={sort}
                onChange={(e) => { setSort(e.target.value); setPage(1) }}
                style={{ height: 40, padding: '0 32px 0 14px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)', fontSize: 13.5, fontWeight: 500, outline: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-1)' }}
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {SEGMENTS.map((sg) => {
              const active = !customSegmentId && segment === sg.id
              return (
                <button
                  key={sg.id}
                  type="button"
                  onClick={() => applyBuiltInSegment(sg.id)}
                  style={{
                    height: 34,
                    padding: '0 14px',
                    borderRadius: 99,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 650 : 500,
                    background: active ? 'var(--action)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--action)' : 'var(--border)'}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    transition: 'all 140ms',
                  }}
                >
                  {sg.label}
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: active ? 'rgba(255,255,255,.2)' : 'var(--surface-3)', color: active ? '#fff' : 'var(--text-3)' }}>
                    {countForBuiltIn(sg.id)}
                  </span>
                </button>
              )
            })}
          </div>

          {savedSegments.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 650, color: 'var(--text-3)', letterSpacing: '.04em' }}>KAYITLI</span>
              {savedSegments.map((saved) => {
                const active = customSegmentId === saved.id
                return (
                  <span key={saved.id} style={{ display: 'inline-flex', alignItems: 'center', height: 34, borderRadius: 99, border: `1px solid ${active ? 'var(--action)' : 'var(--border)'}`, background: active ? 'var(--action)' : 'var(--surface)', overflow: 'hidden', boxShadow: active ? 'none' : 'var(--shadow-1)' }}>
                    <button type="button" onClick={() => applySavedSegment(saved.id)} title={describeDefinition(saved.definition)}
                      style={{ height: 32, padding: '0 10px 0 14px', border: 'none', background: 'transparent', color: active ? '#fff' : 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {saved.name}
                    </button>
                    <button type="button" onClick={() => openEditSegment(saved)} aria-label={`${saved.name} düzenle`} style={segmentIconBtn(active)}><I.gear size={12} /></button>
                    <button type="button" onClick={() => { void handleDeleteSegment(saved) }} aria-label={`${saved.name} sil`} style={segmentIconBtn(active)}><I.trash size={12} /></button>
                  </span>
                )
              })}
            </div>
          )}

          {campaigns.length > 0 && (
            <CampaignStrip campaigns={campaigns.slice(0, 3)} onOpen={() => setCampaignOpen(true)} />
          )}

          {segmentError && <div style={{ marginBottom: 12, color: 'var(--critical)', fontSize: 12.5 }}>{segmentError}</div>}

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, boxShadow: 'var(--shadow-1)', overflow: 'hidden', opacity: pending ? 0.6 : 1, transition: 'opacity 120ms' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1.6fr 1.1fr .8fr 1.1fr .8fr 1.1fr', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--divider)', background: 'var(--surface-2)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.04em' }}>
              <span>MÜŞTERİ</span><span>TELEFON</span><span>SEVİYE</span><span style={{ textAlign: 'right' }}>ZİYARET</span><span style={{ textAlign: 'right' }}>HARCAMA</span><span style={{ textAlign: 'right' }}>PUAN</span><span style={{ textAlign: 'right' }}>SON GÖRÜLME</span>
            </div>
            {data.customers.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)', fontSize: 13.5 }}>Eşleşen müşteri yok</div>
            ) : (
              data.customers.map((c, i) => (
                <CustomerRow key={c.customerId} c={c} delay={i * 25} onClick={() => router.push(`/dashboard/${restaurantId}/customers/${c.customerId}`)} />
              ))
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12, textAlign: 'center' }}>
            {data.customers.length} müşteri gösteriliyor
          </div>

          {data.total > data.pageSize && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14, fontSize: 12.5, color: 'var(--text-2)' }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={pagerBtn(page <= 1)}>‹ Önceki</button>
              <span>{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={pagerBtn(page >= totalPages)}>Sonraki ›</button>
            </div>
          )}
        </div>
      </div>

      {editor && (
        <SegmentEditorModal
          state={editor}
          saving={savingSegment}
          error={segmentError}
          onClose={() => setEditor(null)}
          onSave={handleSaveSegment}
        />
      )}
      {campaignOpen && (
        <CampaignModal
          restaurantId={restaurantId}
          savedSegments={savedSegments}
          campaigns={campaigns.slice(0, 6)}
          initialTarget={customSegmentId ? `custom:${customSegmentId}` : segment ? `builtin:${segment}` : 'all'}
          onClose={() => setCampaignOpen(false)}
          onSent={(campaign) => setCampaigns((prev) => [campaign, ...prev.filter((c) => c.id !== campaign.id)])}
        />
      )}
    </div>
  )
}

function MiniStat({ label, value, icon, sub, mono }: { label: string; value: string; icon: ReactNode; sub?: string; mono?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', boxShadow: 'var(--shadow-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{label}</span>
        <span style={{ width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-4)' }}>{icon}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 750, marginTop: 6, letterSpacing: '-0.02em', ...(mono ? S.mono : {}) }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function CustomerRow({ c, onClick, delay }: { c: RestaurantCustomer; onClick: () => void; delay: number }) {
  const [hover, setHover] = useState(false)
  const tags = tagsForCustomer(c)
  const soft = softForTier(c.tier.color)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '2.2fr 1.6fr 1.1fr .8fr 1.1fr .8fr 1.1fr',
        gap: 12,
        width: '100%',
        padding: '14px 20px',
        border: 'none',
        borderBottom: '1px solid var(--divider)',
        alignItems: 'center',
        cursor: 'pointer',
        background: hover ? 'var(--surface-2)' : 'transparent',
        transition: 'background 120ms',
        textAlign: 'left',
        animation: 'rowIn 300ms ease both',
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 999, background: soft, color: c.tier.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 750, fontSize: 13, flexShrink: 0 }}>{initials(c.name)}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name || 'İsimsiz'}</div>
          {tags.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tags.join(' · ')}</div>}
        </div>
      </div>
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, ...S.mono }}>
        <span style={{ fontSize: 13, color: c.phoneMasked ? 'var(--text-3)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.phone}</span>
        <span style={{ fontSize: 11, color: c.emailMasked ? 'var(--text-4)' : 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.email}</span>
      </span>
      <span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: c.tier.color, background: soft, padding: '3px 10px', borderRadius: 99 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: c.tier.color }} />{c.tier.name}
        </span>
      </span>
      <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 500, color: c.visits ? 'var(--text)' : 'var(--text-4)' }}>{c.visits}</span>
      <span style={{ textAlign: 'right', fontSize: 13.5, fontWeight: 500, color: c.spend ? 'var(--text)' : 'var(--text-4)', ...S.mono }}>{formatCurrency(c.spend)}</span>
      <span style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#c8922a' }}>{c.points}</span>
      <span style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
        {relTime(c.lastSeen)}
        <span style={{ color: 'var(--text-4)', opacity: hover ? 1 : 0, transition: 'opacity 120ms' }}><I.chevRight size={11} /></span>
      </span>
    </button>
  )
}

function CampaignStrip({ campaigns, onOpen }: { campaigns: CampaignSummary[]; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        width: '100%',
        margin: '0 0 16px',
        padding: '12px 14px',
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: 'var(--shadow-1)',
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>
        <I.bell size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>Son SMS kampanyaları</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12.5, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {campaigns.map((c) => `${c.name} (${c.sentCount}/${c.recipientCount})`).join(' · ')}
        </span>
      </span>
      <span style={{ color: 'var(--text-4)' }}><I.chevRight size={14} /></span>
    </button>
  )
}

type CampaignTargetValue = 'all' | `builtin:${string}` | `custom:${string}`

function targetToAudience(target: CampaignTargetValue): CampaignAudienceInput {
  if (target.startsWith('builtin:')) {
    const builtinSegment = target.slice('builtin:'.length)
    if (builtinSegment === 'new' || builtinSegment === 'frequent' || builtinSegment === 'lapsed' || builtinSegment === 'consented') {
      return { segmentKind: 'builtin', builtinSegment }
    }
  }
  if (target.startsWith('custom:')) return { segmentKind: 'custom', customSegmentId: target.slice('custom:'.length) }
  return { segmentKind: 'all' }
}

function CampaignModal({
  restaurantId,
  savedSegments,
  campaigns,
  initialTarget,
  onClose,
  onSent,
}: {
  restaurantId: string
  savedSegments: SavedCustomerSegment[]
  campaigns: CampaignSummary[]
  initialTarget: CampaignTargetValue
  onClose: () => void
  onSent: (campaign: CampaignSummary) => void
}) {
  const [target, setTarget] = useState<CampaignTargetValue>(initialTarget)
  const [name, setName] = useState('Geri kazanım SMS')
  const [message, setMessage] = useState('Merhaba, size özel fırsatlarımız hazır. Menüyü açıp ödüllerinizi kontrol edebilirsiniz.')
  const [testPhone, setTestPhone] = useState('')
  const [preview, setPreview] = useState<CampaignAudiencePreview | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let alive = true
    setPreviewing(true)
    setError(null)
    const timer = setTimeout(() => {
      void (async () => {
        const res = await previewCampaignAudienceAction(restaurantId, targetToAudience(target))
        if (!alive) return
        setPreviewing(false)
        if ('error' in res) {
          setPreview(null)
          setError(res.error)
        } else {
          setPreview(res)
        }
      })()
    }, 180)
    return () => { alive = false; clearTimeout(timer) }
  }, [restaurantId, target])

  const canSend = !sending && name.trim().length > 0 && message.trim().length >= 5 && Boolean(preview?.eligibleRecipients)

  async function handleTest() {
    setTesting(true)
    setError(null)
    setNotice(null)
    const res = await sendCampaignTestAction(restaurantId, { phone: testPhone, message })
    setTesting(false)
    if ('error' in res) setError(res.error)
    else setNotice('Test SMS gönderildi')
  }

  async function handleSend() {
    setSending(true)
    setError(null)
    setNotice(null)
    const res = await sendCampaignAction(restaurantId, { name, message, audience: targetToAudience(target) })
    setSending(false)
    if ('error' in res) {
      setError(res.error)
      if (res.preview) setPreview(res.preview)
      return
    }
    setPreview(res.preview)
    onSent(res.campaign)
    setNotice(`${res.campaign.sentCount} SMS gönderildi${res.campaign.failedCount ? `, ${res.campaign.failedCount} hata` : ''}`)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(17,17,19,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(940px, 100%)', maxHeight: 'min(760px, 92vh)', overflow: 'hidden', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.22)', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 300px' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', maxHeight: 'min(760px, 92vh)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--divider)' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 750, color: 'var(--text)' }}>SMS kampanyası</div>
              <div style={{ ...S.caption, marginTop: 3 }}>Yalnızca kampanya SMS izni açık müşteriler alıcı olur</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Kapat" style={{ ...btnGhost({ width: 30, padding: 0, justifyContent: 'center' }) }}><I.close size={14} /></button>
          </div>

          <div style={{ padding: 18, overflow: 'auto', display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={S.label}>Kampanya adı</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} style={fieldStyle()} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={S.label}>Hedef segment</span>
                <select value={target} onChange={(e) => setTarget(e.target.value as CampaignTargetValue)} style={fieldStyle()}>
                  <option value="all">Tüm müşteriler</option>
                  {SEGMENTS.filter((sg) => sg.id).map((sg) => <option key={sg.id} value={`builtin:${sg.id}`}>{sg.label}</option>)}
                  {savedSegments.map((sg) => <option key={sg.id} value={`custom:${sg.id}`}>Kayıtlı: {sg.name}</option>)}
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <AudienceBox label="Segment" value={previewing ? '...' : (preview?.totalCandidates ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="SMS izni açık" value={previewing ? '...' : (preview?.eligibleRecipients ?? 0).toLocaleString('tr-TR')} tone="positive" />
              <AudienceBox label="Hariç" value={previewing ? '...' : (preview?.skippedNoMarketingConsent ?? 0).toLocaleString('tr-TR')} />
            </div>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={S.label}>Mesaj</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 459))}
                rows={5}
                style={{ ...fieldStyle({ height: 'auto', minHeight: 132, padding: 12, resize: 'vertical', lineHeight: 1.5 }) }}
              />
              <span style={{ ...S.caption, textAlign: 'right' }}>{message.length}/459</span>
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={S.label}>Test telefon</span>
                <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="0555 123 45 67" style={fieldStyle()} />
              </label>
              <button type="button" disabled={testing || message.trim().length < 5} onClick={() => { void handleTest() }} style={btnGhost({ height: 38, opacity: testing ? 0.6 : 1 })}>
                <I.phone size={13} />{testing ? 'Gönderiliyor...' : 'Test gönder'}
              </button>
            </div>

            {(error || notice) && (
              <div style={{ borderRadius: 10, padding: '10px 12px', fontSize: 12.5, background: error ? 'var(--critical-bg)' : 'var(--positive-bg)', color: error ? 'var(--critical)' : 'var(--positive)' }}>
                {error ?? notice}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--divider)' }}>
            <button type="button" onClick={onClose} disabled={sending} style={btnGhost()}>Kapat</button>
            <button type="button" disabled={!canSend} onClick={() => { void handleSend() }} style={btnPrimary({ height: 36, padding: '0 15px', opacity: canSend ? 1 : 0.52, cursor: canSend ? 'pointer' : 'not-allowed' })}>
              <I.bell size={13} />{sending ? 'Gönderiliyor...' : 'Kampanyayı gönder'}
            </button>
          </div>
        </div>

        <aside style={{ borderLeft: '1px solid var(--divider)', background: 'var(--surface-2)', padding: 16, overflow: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--text-3)', letterSpacing: '.05em', marginBottom: 10 }}>SON GÖNDERİMLER</div>
          {campaigns.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.45 }}>Henüz SMS kampanyası yok.</div>
          ) : (
            <div style={{ display: 'grid', gap: 9 }}>
              {campaigns.map((campaign) => (
                <div key={campaign.id} style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', padding: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{campaign.name}</div>
                    <StatusPill status={campaign.status} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>
                    {campaign.sentCount}/{campaign.recipientCount} gönderildi
                    {campaign.failedCount ? ` · ${campaign.failedCount} hata` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function AudienceBox({ label, value, tone }: { label: string; value: string; tone?: 'positive' }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 11, background: tone === 'positive' ? 'var(--positive-bg)' : 'var(--surface-2)', padding: 12 }}>
      <div style={{ fontSize: 11, color: tone === 'positive' ? 'var(--positive)' : 'var(--text-3)', fontWeight: 700, letterSpacing: '.04em' }}>{label.toLocaleUpperCase('tr-TR')}</div>
      <div style={{ marginTop: 5, fontSize: 22, fontWeight: 780, color: tone === 'positive' ? 'var(--positive)' : 'var(--text)', ...S.mono }}>{value}</div>
    </div>
  )
}

function StatusPill({ status }: { status: CampaignSummary['status'] }) {
  const meta = status === 'sent'
    ? { label: 'Gönderildi', bg: 'var(--positive-bg)', fg: 'var(--positive)' }
    : status === 'failed'
      ? { label: 'Hata', bg: 'var(--critical-bg)', fg: 'var(--critical)' }
      : status === 'sending'
        ? { label: 'Gönderiliyor', bg: 'var(--warning-bg)', fg: 'var(--warning)' }
        : { label: status, bg: 'var(--surface-3)', fg: 'var(--text-3)' }
  return <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 7px', background: meta.bg, color: meta.fg, whiteSpace: 'nowrap' }}>{meta.label}</span>
}

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    height: 30,
    padding: '0 12px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-2)',
    fontSize: 12.5,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  }
}

function segmentIconBtn(active: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 32,
    border: 'none',
    borderLeft: active ? '1px solid rgba(255,255,255,.2)' : '1px solid var(--divider)',
    background: 'transparent',
    color: active ? '#fff' : 'var(--text-3)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }
}

type RuleKey = 'last_seen_days' | 'visits' | 'spend' | 'points' | 'lifetime_points'
type SegmentEditorState =
  | { mode: 'create'; name: string; definition: CustomerSegmentDefinition }
  | { mode: 'edit'; segmentId: string; name: string; definition: CustomerSegmentDefinition }

const RULES: Array<{ key: RuleKey; label: string; unit?: string; integer?: boolean }> = [
  { key: 'last_seen_days', label: 'Son görülme', unit: 'gün', integer: true },
  { key: 'visits', label: 'Ziyaret', integer: true },
  { key: 'spend', label: 'Harcama' },
  { key: 'points', label: 'Puan', integer: true },
  { key: 'lifetime_points', label: 'Lifetime puan', integer: true },
]

function definitionFromBuiltIn(segment: string): CustomerSegmentDefinition {
  if (segment === 'frequent') return { visits: { op: '>=', value: 3 } }
  if (segment === 'lapsed') return { last_seen_days: { op: '>=', value: 60 } }
  if (segment === 'consented') return { consent: 'granted' }
  return {}
}

function describeDefinition(definition: CustomerSegmentDefinition): string {
  const parts: string[] = []
  if (definition.consent === 'granted') parts.push('Rıza var')
  if (definition.consent === 'missing') parts.push('Rıza yok')
  for (const rule of RULES) {
    const value = definition[rule.key]
    if (!value) continue
    if (rule.key === 'last_seen_days') parts.push(value.op === '<=' ? `Son ${value.value} gün` : `${value.value}+ gündür yok`)
    else {
      const rendered = rule.key === 'spend' ? formatCurrency(value.value) : String(value.value)
      parts.push(`${rule.label} ${value.op} ${rendered}`)
    }
  }
  return parts.length ? parts.join(' · ') : 'Tüm müşteriler'
}

function pruneDefinition(definition: CustomerSegmentDefinition): CustomerSegmentDefinition {
  const out: CustomerSegmentDefinition = {}
  if (definition.consent === 'granted' || definition.consent === 'missing') out.consent = definition.consent
  for (const rule of RULES) {
    const value = definition[rule.key]
    if (!value || !Number.isFinite(value.value) || value.value < 0) continue
    out[rule.key] = { op: value.op, value: rule.integer ? Math.floor(value.value) : Math.round(value.value * 100) / 100 }
  }
  return out
}

function SegmentEditorModal({
  state,
  saving,
  error,
  onClose,
  onSave,
}: {
  state: SegmentEditorState
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (input: { name: string; definition: CustomerSegmentDefinition }) => void | Promise<void>
}) {
  const [name, setName] = useState(state.name)
  const [definition, setDefinition] = useState<CustomerSegmentDefinition>(state.definition)

  function setRule(key: RuleKey, enabled: boolean) {
    setDefinition((prev) => {
      const next = { ...prev }
      if (enabled) next[key] = prev[key] ?? { op: key === 'last_seen_days' ? '<=' : '>=', value: 0 }
      else delete next[key]
      return next
    })
  }

  function updateRule(key: RuleKey, patch: Partial<{ op: '>=' | '<='; value: number }>) {
    setDefinition((prev) => {
      const current = prev[key] ?? { op: key === 'last_seen_days' ? '<=' : '>=', value: 0 }
      return { ...prev, [key]: { ...current, ...patch } }
    })
  }

  const canSave = name.trim().length > 0 && !saving

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(17,17,19,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: 'min(620px, 100%)', maxHeight: 'min(720px, 92vh)', overflowY: 'auto', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--divider)' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{state.mode === 'edit' ? 'Segmenti düzenle' : 'Segment kaydet'}</div>
            <div style={{ ...S.caption, marginTop: 3 }}>{describeDefinition(pruneDefinition(definition))}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" style={{ ...btnGhost({ width: 30, padding: 0, justifyContent: 'center' }) }}><I.close size={14} /></button>
        </div>

        <div style={{ padding: 16, display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={S.label}>Segment adı</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={fieldStyle()} placeholder="Örn. VIP geri kazanım" />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={S.label}>İletişim izni</span>
            <select value={definition.consent ?? ''} onChange={(e) => setDefinition((prev) => {
              const next = { ...prev }
              if (e.target.value === 'granted' || e.target.value === 'missing') next.consent = e.target.value
              else delete next.consent
              return next
            })} style={fieldStyle()}>
              <option value="">Farketmez</option>
              <option value="granted">Rıza var</option>
              <option value="missing">Rıza yok</option>
            </select>
          </label>

          <div style={{ display: 'grid', gap: 8 }}>
            {RULES.map((rule) => {
              const active = Boolean(definition[rule.key])
              const value = definition[rule.key] ?? { op: rule.key === 'last_seen_days' ? '<=' : '>=', value: 0 }
              return (
                <div key={rule.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1fr) 84px minmax(120px, 1fr)', gap: 8, alignItems: 'center', padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text)' }}>
                    <input type="checkbox" checked={active} onChange={(e) => setRule(rule.key, e.target.checked)} />
                    {rule.label}
                  </label>
                  <select disabled={!active} value={value.op} onChange={(e) => updateRule(rule.key, { op: e.target.value as '>=' | '<=' })} style={fieldStyle({ opacity: active ? 1 : 0.45 })}>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                  </select>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input disabled={!active} type="number" min={0} step={rule.integer ? 1 : 0.01} value={value.value} onChange={(e) => updateRule(rule.key, { value: Number(e.target.value) })} style={fieldStyle({ opacity: active ? 1 : 0.45, width: '100%' })} />
                    {rule.unit && <span style={{ ...S.caption, minWidth: 28 }}>{rule.unit}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {error && <div style={{ color: 'var(--critical)', fontSize: 12.5 }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--divider)' }}>
          <button type="button" onClick={onClose} disabled={saving} style={btnGhost()}>İptal</button>
          <button type="button" disabled={!canSave} onClick={() => { void onSave({ name: name.trim(), definition: pruneDefinition(definition) }) }} style={btnPrimary({ opacity: canSave ? 1 : 0.55, cursor: canSave ? 'pointer' : 'not-allowed' })}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

function fieldStyle(overrides?: React.CSSProperties): React.CSSProperties {
  return {
    height: 38,
    padding: '0 12px',
    borderRadius: 9,
    border: '1px solid var(--border-strong)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 13.5,
    outline: 'none',
    ...overrides,
  }
}
