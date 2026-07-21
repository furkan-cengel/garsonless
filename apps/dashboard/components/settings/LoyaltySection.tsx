'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { saveLoyaltyConfig, getRewardItemChoices } from '../../lib/actions/restaurant'
import { canUseFeature } from '@garsonless/domain'
import {
  MAX_TIERS,
  TIER_PERK_DEFAULTS,
  type LoyaltyConfig,
  type CatalogReward,
  type LoyaltyTier,
} from './loyalty-config'
import { I as AppI } from '../../lib/ui'
import { notifySettingsDirty, notifySettingsSaved } from './settings-dirty-state'

const TIER_COLORS = ['#b87333', '#8a9099', '#c8922a', '#5b7a86', '#3b82f6', '#a855f7']

const I = {
  stamp: <AppI.stamp size={18} />,
  star: <AppI.star size={18} />,
  crown: <AppI.crown size={18} />,
  card: <AppI.card size={16} />,
  gift: <AppI.gift size={16} />,
  check: <AppI.check size={13} />,
  plus: <AppI.plus size={14} />,
  x: <AppI.x size={14} />,
  drag: <AppI.drag size={14} />,
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function numberFrom(value: string, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    height: 38,
    padding: '0 12px',
    border: '1px solid var(--border-strong)',
    borderRadius: 9,
    background: 'var(--surface)',
    color: 'var(--text)',
    fontSize: 14,
    outline: 'none',
    width: '100%',
    ...extra,
  }
}

function Toggle({ on, onChange, size = 'md', ariaLabel = 'Ayarı aç veya kapat' }: { on: boolean; onChange: (on: boolean) => void; size?: 'md' | 'lg'; ariaLabel?: string }) {
  const w = size === 'lg' ? 42 : 34
  const h = size === 'lg' ? 24 : 20
  const k = h - 4
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      onClick={() => onChange(!on)}
      style={{
        width: w,
        height: h,
        borderRadius: 999,
        background: on ? 'var(--accent)' : 'var(--border-strong)',
        border: 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 160ms',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: on ? w - k - 2 : 2,
        width: k,
        height: k,
        borderRadius: 999,
        background: '#fff',
        transition: 'left 160ms cubic-bezier(.3,.8,.4,1)',
        boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  )
}

function NumberField({
  value,
  onChange,
  suffix,
  min = 0,
  max,
  step = 1,
  width = 120,
}: {
  value: number
  onChange: (value: number) => void
  suffix?: string
  min?: number
  max?: number
  step?: number
  width?: number | string
}) {
  return (
    <div style={{ position: 'relative', width, flexShrink: 0 }}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = numberFrom(e.target.value, value)
          onChange(max === undefined ? Math.max(min, n) : clamp(n, min, max))
        }}
        style={inputStyle({
          width: '100%',
          textAlign: 'center',
          fontWeight: 650,
          paddingRight: suffix ? 30 : 12,
        })}
      />
      {suffix && (
        <span style={{
          position: 'absolute',
          right: 12,
          top: 0,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          fontSize: 13,
          color: 'var(--text-3)',
          pointerEvents: 'none',
        }}>{suffix}</span>
      )}
    </div>
  )
}

function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
}) {
  return (
    <input
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle()}
    />
  )
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle({ appearance: 'auto', cursor: 'pointer', fontWeight: 500 })}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: string; desc: string }>
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 8 }}>
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              textAlign: 'left',
              padding: '13px 15px',
              borderRadius: 11,
              cursor: 'pointer',
              background: active ? 'var(--accent)' : 'var(--surface)',
              color: active ? '#fff' : 'var(--text)',
              border: `1.5px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              transition: 'all 140ms',
              boxShadow: active ? '0 4px 12px -4px rgba(47,111,78,.4)' : 'none',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 650 }}>{opt.label}</span>
              {active && (
                <span style={{ width: 18, height: 18, borderRadius: 999, background: 'rgba(255,255,255,.25)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.check}</span>
              )}
            </span>
            <span style={{ display: 'block', fontSize: 12, marginTop: 3, color: active ? 'rgba(255,255,255,.8)' : 'var(--text-3)' }}>{opt.desc}</span>
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 650, marginBottom: 7 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 7, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function Module({
  icon,
  title,
  desc,
  on,
  onToggle,
  accent = 'var(--accent)',
  accentSoft = 'var(--accent-soft)',
  alwaysOn,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  on: boolean
  onToggle?: (on: boolean) => void
  accent?: string
  accentSoft?: string
  alwaysOn?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', boxShadow: 'var(--shadow-1)', overflow: 'hidden', marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: on ? '1px solid var(--divider)' : 'none' }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: on ? accentSoft : 'var(--surface-3)', color: on ? accent : 'var(--text-4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 200ms' }}>{icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 16, fontWeight: 650, letterSpacing: '-0.01em' }}>{title}</span>
            {on && !alwaysOn && <span style={{ fontSize: 10.5, fontWeight: 700, color: accent, background: accentSoft, padding: '2px 8px', borderRadius: 999, letterSpacing: '.02em' }}>AKTİF</span>}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{desc}</div>
        </div>
        {alwaysOn ? (
          <span style={{ fontSize: 11.5, color: 'var(--text-4)', fontWeight: 500 }}>Her zaman açık</span>
        ) : (
          <Toggle on={on} onChange={onToggle ?? (() => undefined)} size="lg" ariaLabel={`${title} ${on ? 'açık' : 'kapalı'}`} />
        )}
      </div>
      {on && <div style={{ padding: 20 }}>{children}</div>}
    </div>
  )
}

function SummaryChip({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      padding: '7px 13px',
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 500,
      background: on ? 'var(--surface)' : 'var(--surface-3)',
      border: `1px solid ${on ? 'var(--border)' : 'transparent'}`,
      color: on ? 'var(--text)' : 'var(--text-4)',
      boxShadow: on ? 'var(--shadow-1)' : 'none',
    }}>
      <span style={{ width: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.4 }}>{icon}</span>{label}
    </span>
  )
}

function Perk({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--text-2)' }}>
      <span style={{ whiteSpace: 'nowrap' }}>{label}</span>
      {children}
    </label>
  )
}

export default function LoyaltySection({
  restaurantId,
  plan,
  initial,
}: {
  restaurantId: string
  plan: unknown
  initial: LoyaltyConfig
}) {
  const hasLoyaltyAccess = canUseFeature(plan, 'loyalty')
  const [cfg, setCfg] = useState<LoyaltyConfig>(initial)
  const [rewardChoices, setRewardChoices] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [isPending, startTransition] = useTransition()

  const itemOptions = useMemo(
    () => [
      { value: '', label: '— Ürün seç —' },
      ...rewardChoices.map((it) => ({ value: it.id, label: it.name })),
    ],
    [rewardChoices],
  )
  const itemName = (id: string | null | undefined) =>
    rewardChoices.find((it) => it.id === id)?.name ?? (id ? 'Seçili ürün' : 'Ürün seçilmedi')

  const patch = (p: Partial<LoyaltyConfig>) => {
    setCfg((c) => ({ ...c, ...p }))
    setDirty(true)
    notifySettingsDirty()
    setSuccess(false)
    setError('')
  }

  useEffect(() => {
    if (!hasLoyaltyAccess || (!cfg.stamp_enabled && !cfg.points_enabled) || rewardChoices.length > 0) return
    let cancelled = false
    void getRewardItemChoices(restaurantId).then((res) => {
      if (!cancelled && 'items' in res) setRewardChoices(res.items)
    })
    return () => { cancelled = true }
  }, [cfg.stamp_enabled, cfg.points_enabled, hasLoyaltyAccess, restaurantId, rewardChoices.length])

  const setTier = (i: number, p: Partial<LoyaltyTier>) =>
    patch({ tiers: cfg.tiers.map((t, k) => (k === i ? { ...t, ...p } : t)) })
  const addTier = () => {
    if (cfg.tiers.length >= MAX_TIERS) return
    const last = cfg.tiers[cfg.tiers.length - 1]
    patch({
      tiers: [...cfg.tiers, {
        name: `Seviye ${cfg.tiers.length + 1}`,
        min: (last?.min ?? 0) + 500,
        color: TIER_COLORS[cfg.tiers.length % TIER_COLORS.length]!,
        ...TIER_PERK_DEFAULTS,
      }],
    })
  }
  const removeTier = (i: number) => { if (i > 0) patch({ tiers: cfg.tiers.filter((_, k) => k !== i) }) }

  const lowerNames = cfg.tiers.map((t) => t.name.trim().toLowerCase())
  const dupNames = new Set(lowerNames.filter((n, i) => n && lowerNames.indexOf(n) !== i))
  const tierRowError = (t: LoyaltyTier, i: number): string | null => {
    if (!t.name.trim()) return 'İsim boş olamaz'
    if (dupNames.has(t.name.trim().toLowerCase())) return 'İsim benzersiz olmalı'
    if (i > 0 && t.min <= (cfg.tiers[i - 1]?.min ?? -1)) return 'Bir üst seviyeden büyük olmalı'
    return null
  }
  const tiersValid = cfg.tiers.every((t, i) => tierRowError(t, i) === null)

  const catalog = cfg.reward_catalog ?? []
  const addCatalogReward = () => patch({ reward_catalog: [...catalog, { itemId: '', pointCost: 100 }] })
  const updateCatalogReward = (i: number, p: Partial<CatalogReward>) =>
    patch({ reward_catalog: catalog.map((r, k) => (k === i ? { ...r, ...p } : r)) })
  const removeCatalogReward = (i: number) =>
    patch({ reward_catalog: catalog.filter((_, k) => k !== i) })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tiersValid) return
    setError('')
    setSuccess(false)
    startTransition(async () => {
      const result = await saveLoyaltyConfig(restaurantId, cfg as unknown as Record<string, unknown>)
      if ('error' in result) { setError(result.error); return }
      setDirty(false)
      setSuccess(true)
      notifySettingsSaved()
    })
  }

  const maxTierDiscount = Math.max(0, ...cfg.tiers.map((t) => Number(t.discountPct) || 0))
  const hasTierDiscount = maxTierDiscount > 0
  const hasPriorityTier = cfg.tiers.some((t) => t.priorityService)
  const hasBonusStamps = cfg.tiers.some((t) => (t.bonusStamps ?? 0) > 0)

  if (!hasLoyaltyAccess) {
    return (
      <section style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 28,
        boxShadow: 'var(--shadow-1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'grid',
            placeItems: 'center',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            flexShrink: 0,
          }}>{I.crown}</div>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, letterSpacing: '-0.01em' }}>Sadakat programı Pro pakette</h3>
            <p style={{ margin: '7px 0 0', color: 'var(--text-3)', fontSize: 13.5, lineHeight: 1.55, maxWidth: 560 }}>
              Damga, puan, üyelik indirimi ve hoş geldin bonusu yalnızca Pro pakette işler.
              Kaydedilmiş ayarlarınız korunur; Pro&apos;ya geçtiğinizde tekrar etkinleştirebilirsiniz.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <SummaryChip on={cfg.stamp_enabled} icon={<AppI.stamp size={14} />} label={cfg.stamp_enabled ? `Damga · ${cfg.stamp_goal} hedef` : 'Damga kapalı'} />
        <SummaryChip on={cfg.points_enabled} icon={<AppI.star size={14} />} label={cfg.points_enabled ? `Puan · ${cfg.points_per_lira}p/₺` : 'Puan kapalı'} />
        <SummaryChip on={hasTierDiscount || cfg.member_discount_pct > 0} icon={<AppI.card size={14} />} label={hasTierDiscount ? `Seviye indirimi max %${maxTierDiscount}` : cfg.member_discount_pct > 0 ? `Üye indirimi %${cfg.member_discount_pct}` : 'İndirim yok'} />
        <SummaryChip on={cfg.welcome_bonus_points > 0} icon={<AppI.gift size={14} />} label={cfg.welcome_bonus_points > 0 ? `Hoş geldin +${cfg.welcome_bonus_points}p` : 'Bonus kapalı'} />
        <SummaryChip on={hasBonusStamps} icon={<AppI.plus size={14} />} label={hasBonusStamps ? 'Bonus damga aktif' : 'Bonus damga yok'} />
        <SummaryChip on={hasPriorityTier} icon={<AppI.crown size={14} />} label={hasPriorityTier ? 'Öncelikli servis' : `${cfg.tiers.length} seviye`} />
      </div>

      <Module
        icon={I.stamp}
        title="Damga Kartı"
        desc={'"9 al 1 bedava" tarzı — her uygun siparişte +1 damga'}
        on={cfg.stamp_enabled}
        onToggle={(on) => patch({ stamp_enabled: on })}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 28 }}>
          <div>
            <Field label="Hedef damga sayısı" hint="Ödül için gereken damga (örn. 10 = 10. sipariş bedava)">
              <NumberField value={cfg.stamp_goal} min={2} max={50} onChange={(stamp_goal) => patch({ stamp_goal: Math.floor(stamp_goal) })} />
            </Field>
            <Field label="Ödül metni" hint="Müşteriye gösterilecek ödül açıklaması">
              <TextField value={cfg.stamp_reward_text} maxLength={80} onChange={(stamp_reward_text) => patch({ stamp_reward_text })} placeholder="8. kahve bizden" />
            </Field>
            <Field label="Bedava ödül ürünü" hint="Kart dolunca müşteri bu üründen 1 adet bedava alır (sepete eklerse)">
              <SelectField value={cfg.reward_item_id ?? ''} onChange={(value) => patch({ reward_item_id: value || null })} options={itemOptions} />
            </Field>
          </div>

          <div style={{ background: 'linear-gradient(135deg, #1f5642, #2f6f4e)', borderRadius: 16, padding: 18, color: '#fff', alignSelf: 'flex-start', position: 'sticky', top: 0 }}>
            <div style={{ fontSize: 10.5, opacity: 0.75, letterSpacing: '.1em', fontWeight: 700 }}>ÖNİZLEME · DAMGA KARTI</div>
            <div style={{ fontSize: 16, fontWeight: 750, marginTop: 6 }}>{cfg.stamp_reward_text || 'Ödülünü topla'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7, marginTop: 14 }}>
              {Array.from({ length: Math.min(Math.max(cfg.stamp_goal || 1, 1), 12) }).map((_, i) => {
                const filled = i < Math.min(6, cfg.stamp_goal)
                const isReward = i === Math.min(Math.max(cfg.stamp_goal, 1), 12) - 1
                return (
                  <div key={i} style={{
                    aspectRatio: '1',
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    background: filled ? 'rgba(255,255,255,.95)' : 'transparent',
                    border: filled ? 'none' : '1.5px dashed rgba(255,255,255,.4)',
                  }}>{filled ? <AppI.stamp size={13} /> : isReward ? <AppI.gift size={13} /> : null}</div>
                )
              })}
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.82, marginTop: 12 }}>
              {Math.min(6, cfg.stamp_goal)} / {cfg.stamp_goal} damga · {Math.max(cfg.stamp_goal - 6, 0)} kaldı
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.82, marginTop: 4 }}>{itemName(cfg.reward_item_id)}</div>
          </div>
        </div>
      </Module>

      <Module
        icon={I.star}
        title="Puan Programı"
        desc="Harcamadan puan kazanımı (₺ → puan)"
        on={cfg.points_enabled}
        onToggle={(on) => patch({ points_enabled: on })}
        accent="#c8922a"
        accentSoft="#f6ecd6"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 4 }}>
          <Field label="₺ başına puan" hint="1 ₺ harcama kaç puan kazandırır">
            <NumberField width="100%" value={cfg.points_per_lira} min={0} step={0.1} onChange={(points_per_lira) => patch({ points_per_lira })} />
          </Field>
          <Field label="Kaç puan = ₺1 indirim" hint="Sepette puanla indirim oranı">
            <NumberField width="100%" value={cfg.points_redeem_rate} min={1} onChange={(points_redeem_rate) => patch({ points_redeem_rate: Math.floor(points_redeem_rate) })} />
          </Field>
        </div>

        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ color: '#c8922a' }}>{I.gift}</span>
            <span style={{ fontSize: 13.5, fontWeight: 650 }}>Ödül kataloğu</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>· {catalog.length} ödül</span>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr) 110px 130px 34px', gap: 10, padding: '9px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--divider)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.03em' }}>
              <span /><span>ÜRÜN</span><span style={{ textAlign: 'center' }}>PUAN</span><span>ETİKET</span><span />
            </div>
            {catalog.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr) 110px 130px 34px', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--divider)', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-4)', display: 'flex' }}>{I.drag}</span>
                <SelectField value={r.itemId} onChange={(itemId) => updateCatalogReward(i, { itemId })} options={itemOptions} />
                <NumberField width="100%" min={1} value={r.pointCost} onChange={(pointCost) => updateCatalogReward(i, { pointCost: Math.max(1, Math.floor(pointCost)) })} />
                <TextField value={r.tag ?? ''} maxLength={24} onChange={(tag) => updateCatalogReward(i, { tag })} placeholder="etiket" />
                <button type="button" onClick={() => removeCatalogReward(i)} aria-label="Ödülü kaldır" style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{I.x}</button>
              </div>
            ))}
            {catalog.length === 0 && (
              <div style={{ padding: '18px 14px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>Henüz puan ödülü eklenmedi.</div>
            )}
            <button type="button" onClick={addCatalogReward} style={{ width: '100%', padding: '11px', background: 'var(--surface-2)', border: 'none', borderTop: '1px solid var(--divider)', color: 'var(--accent)', fontSize: 13, fontWeight: 650, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{I.plus} Ödül ekle</button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 9, lineHeight: 1.5 }}>Puanla alınabilen bedava ürünler. Üye yeterli puana sahipse, sepetteki bu üründen 1 adet bedava olur; serbest puan indirimi ile aynı siparişte birlikte kullanılamaz.</div>
        </div>
      </Module>

      <Module icon={I.crown} title="Üyelik & Seviyeler" desc="Kapsam, kazanım kuralları, seviye eşikleri ve ayrıcalıklar" on alwaysOn accent="#5b7a86" accentSoft="#e3edf0">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Field label="Kapsam" hint="Bakiye yalnızca bu restoranda mı, yoksa tüm ağ genelinde mi geçerli">
            <Segmented
              value={cfg.scope}
              onChange={(scope) => patch({ scope })}
              options={[
                { value: 'restaurant', label: 'Bu restoran', desc: 'Yalnızca burada' },
                { value: 'network', label: 'Ağ geneli', desc: 'Tüm şubeler' },
              ] as const}
            />
          </Field>
          <Field label="Kazanım tetikleyici" hint="Damga/puan ne zaman verilsin">
            <Segmented
              value={cfg.earn_trigger}
              onChange={(earn_trigger) => patch({ earn_trigger })}
              options={[
                { value: 'paid', label: 'Ödeme alınınca', desc: 'paid_at' },
                { value: 'served', label: 'Servis edilince', desc: 'served' },
              ] as const}
            />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 4 }}>
          <Field label="Üye indirimi fallback (%)" hint="Tüm seviye indirimleri 0 ise legacy üyelik indirimi olarak kullanılır. Seviye indirimi girildiğinde kayıt sırasında fallback pasifleşir.">
            <NumberField width="100%" value={cfg.member_discount_pct} min={0} max={100} suffix="%" onChange={(member_discount_pct) => patch({ member_discount_pct: Math.floor(member_discount_pct) })} />
          </Field>
          <Field label="Hoş geldin bonusu (puan)" hint="Üye olunca bir defaya mahsus verilir (0 = kapalı)">
            <NumberField width="100%" value={cfg.welcome_bonus_points} min={0} onChange={(welcome_bonus_points) => patch({ welcome_bonus_points: Math.floor(welcome_bonus_points) })} />
          </Field>
        </div>

        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
            <div style={{ fontSize: 13.5, fontWeight: 650 }}>Seviye eşikleri</div>
            <button type="button" onClick={addTier} disabled={cfg.tiers.length >= MAX_TIERS}
              style={{ height: 30, padding: '0 12px', borderRadius: 8, border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 650, cursor: cfg.tiers.length >= MAX_TIERS ? 'not-allowed' : 'pointer', opacity: cfg.tiers.length >= MAX_TIERS ? 0.5 : 1 }}>
              {I.plus} Seviye ekle
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>Seviye, üyenin ömür boyu kazandığı puana göre belirlenir; harcanan puan seviyeyi düşürmez.</div>

          <div style={{ position: 'relative', paddingLeft: 8 }}>
            <div style={{ position: 'absolute', left: 15, top: 18, bottom: 18, width: 2, background: 'var(--divider)' }} />
            {cfg.tiers.map((tier, i) => {
              const err = tierRowError(tier, i)
              return (
                <div key={i} style={{ position: 'relative', padding: '8px 0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '18px minmax(92px, 1fr) 150px 52px', alignItems: 'center', gap: 14 }}>
                    <input
                      type="color"
                      aria-label="Seviye rengi"
                      value={tier.color}
                      onChange={(e) => setTier(i, { color: e.target.value })}
                      style={{ width: 18, height: 18, borderRadius: 999, padding: 0, border: 'none', background: tier.color, zIndex: 1, boxShadow: '0 0 0 4px var(--surface)', cursor: 'pointer' }}
                    />
                    <TextField value={tier.name} maxLength={24} onChange={(name) => setTier(i, { name })} placeholder={`Seviye ${i + 1}`} />
                    <NumberField value={tier.min} width={150} min={0} step={50} onChange={(min) => setTier(i, { min: i === 0 ? 0 : Math.floor(min) })} />
                    <button type="button" onClick={() => removeTier(i)} disabled={i === 0} aria-label="Seviyeyi kaldır" style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: i === 0 ? 'not-allowed' : 'pointer', opacity: i === 0 ? 0.35 : 1 }}>{I.x}</button>
                  </div>
                  <div style={{ marginLeft: 32, marginTop: 9, padding: 10, border: `1px solid ${err ? 'var(--critical)' : 'var(--border)'}`, borderRadius: 12, background: 'var(--surface-2)' }}>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Perk label="İndirim %">
                        <NumberField value={tier.discountPct} min={0} max={100} width={70} onChange={(discountPct) => setTier(i, { discountPct: Math.floor(discountPct) })} />
                      </Perk>
                      <Perk label="Puan ×">
                        <NumberField value={tier.pointsMultiplier} min={0.1} max={10} step={0.1} width={70} onChange={(pointsMultiplier) => setTier(i, { pointsMultiplier })} />
                      </Perk>
                      <Perk label="Bonus damga">
                        <NumberField value={tier.bonusStamps} min={0} max={20} width={70} onChange={(bonusStamps) => setTier(i, { bonusStamps: Math.floor(bonusStamps) })} />
                      </Perk>
                      <Perk label="Öncelikli servis">
                        <Toggle on={tier.priorityService} onChange={(priorityService) => setTier(i, { priorityService })} ariaLabel={`${tier.name || `Seviye ${i + 1}`} için öncelikli servis ${tier.priorityService ? 'açık' : 'kapalı'}`} />
                      </Perk>
                    </div>
                    {err && <div style={{ fontSize: 11.5, color: 'var(--critical)', marginTop: 8 }}>{err}</div>}
                    {!err && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 8 }}>
                        {i === 0 ? 'Taban seviye · her zaman' : `${tier.min} puan ve üzeri`} · {tier.discountPct > 0 ? `%${tier.discountPct} indirim` : 'fallback indirim'} · {tier.pointsMultiplier}× puan · +{tier.bonusStamps} damga
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Module>

      {!tiersValid && <p style={{ fontSize: 12.5, color: 'var(--critical)', margin: '0 0 12px' }}>Seviye merdiveni geçersiz — eşikler artan sırada ve isimler benzersiz olmalı.</p>}
      {error && <p style={{ fontSize: 12.5, color: 'var(--critical)', margin: '0 0 12px' }}>{error}</p>}
      {success && <p style={{ fontSize: 12.5, color: 'var(--positive)', margin: '0 0 12px' }}>Sadakat ayarları kaydedildi.</p>}

      <div style={{ position: 'sticky', bottom: 0, zIndex: 2, marginTop: 8, padding: '14px 18px', background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: 'var(--shadow-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ fontSize: 12.5, color: dirty ? 'var(--warning)' : 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: dirty ? 'var(--warning)' : 'var(--positive)' }} />
          {dirty ? 'Kaydedilmemiş değişiklikler var' : success ? 'Tüm değişiklikler kaydedildi' : 'Değişiklik yok'}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => { setCfg(initial); setDirty(false); setError(''); setSuccess(false) }} disabled={isPending}
            style={{ height: 38, padding: '0 16px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 13.5, fontWeight: 500, cursor: isPending ? 'not-allowed' : 'pointer' }}>
            Geri al
          </button>
          <button type="submit" disabled={isPending || !tiersValid}
            style={{ height: 38, padding: '0 20px', borderRadius: 9, border: 'none', background: 'var(--action)', color: '#fff', fontSize: 13.5, fontWeight: 650, cursor: (isPending || !tiersValid) ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: (isPending || !tiersValid) ? 0.55 : 1 }}>
            {I.check}{isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </form>
  )
}
