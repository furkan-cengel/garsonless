'use client'

import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, useState, useTransition } from 'react'
import { saveLoyaltyConfig, getRewardItemChoices } from '../../lib/actions/restaurant'
import {
  MAX_TIERS,
  TIER_PERK_DEFAULTS,
  type LoyaltyConfig,
  type CatalogReward,
  type LoyaltyTier,
} from './loyalty-config'
import { I as AppI } from '../../lib/ui'
import { notifySettingsSaved, useSettingsDirtyState } from './settings-dirty-state'
import {
  mergeCanonicalSettings,
  prepareSettingsMutationAttempt,
  type SettingsMutationAttempt,
} from './settings-save-contract'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { notifySettingsConflict } from './settings-conflict-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import {
  Field as ShadcnField,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import NumberField from './LoyaltyNumberField'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { LoyaltyCardShell, LoyaltyStampGrid } from '@garsonless/ui/menu'
import { CouponManager } from './CouponManager'

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

function Toggle({ on, onChange, size = 'md', ariaLabel = 'Ayarı aç veya kapat' }: { on: boolean; onChange: (on: boolean) => void; size?: 'md' | 'lg'; ariaLabel?: string }) {
  return (
    <Switch
      role="switch"
      aria-label={ariaLabel}
      checked={on}
      onCheckedChange={onChange}
      size={size === 'lg' ? 'default' : 'sm'}
    />
  )
}

function TextField({
  value,
  onChange,
  placeholder,
  maxLength,
  ariaLabel,
  ariaDescribedBy,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  maxLength?: number
  ariaLabel?: string
  ariaDescribedBy?: string
}) {
  return (
    <Input
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      value={value}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9"
    />
  )
}

function SelectField({
  value,
  onChange,
  options,
  ariaLabel,
  ariaDescribedBy,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  ariaLabel?: string
  ariaDescribedBy?: string
}) {
  return (
    <NativeSelect
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full"
    >
      {options.map((o) => <NativeSelectOption key={o.value} value={o.value}>{o.label}</NativeSelectOption>)}
    </NativeSelect>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  ariaDescribedBy,
}: {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; label: string; desc: string }>
  ariaLabel?: string
  ariaDescribedBy?: string
}) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(values) => {
        const next = values[0] as T | undefined
        if (next) onChange(next)
      }}
      variant="outline"
      spacing={2}
      role="group"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      className="grid w-full"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <ToggleGroupItem
            key={opt.value}
            value={opt.value}
            aria-pressed={active}
            className="h-auto min-w-0 flex-col items-start gap-0.5 px-3 py-2.5 text-left data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground"
          >
            <span className="font-medium">{opt.label}</span>
            <span className="text-xs opacity-70">{opt.desc}</span>
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const hintId = useId()
  const labelledChild = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ ariaLabel?: string; ariaDescribedBy?: string }>, {
      ariaLabel: label,
      ariaDescribedBy: hint ? hintId : undefined,
    })
    : children
  return (
    <ShadcnField>
      <FieldLabel>{label}</FieldLabel>
      {labelledChild}
      {hint && <FieldDescription id={hintId}>{hint}</FieldDescription>}
    </ShadcnField>
  )
}

function Module({
  icon,
  title,
  desc,
  on,
  onToggle,
  alwaysOn,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  on: boolean
  onToggle?: (on: boolean) => void
  alwaysOn?: boolean
  children: React.ReactNode
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className={on ? 'border-b py-4' : 'py-4'}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={on ? 'flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary' : 'flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'}>{icon}</div>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              {title}
              {on && !alwaysOn && <Badge variant="positive">Aktif</Badge>}
            </CardTitle>
            <CardDescription>{desc}</CardDescription>
          </div>
        </div>
        <CardAction className="self-center">
        {alwaysOn ? (
          <Badge variant="secondary">Her zaman açık</Badge>
        ) : (
          <Toggle on={on} onChange={onToggle ?? (() => undefined)} size="lg" ariaLabel={`${title} ${on ? 'açık' : 'kapalı'}`} />
        )}
        </CardAction>
      </CardHeader>
      {on && <CardContent className="py-5">{children}</CardContent>}
    </Card>
  )
}

function SummaryChip({ on, icon, label }: { on: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Badge variant={on ? 'outline' : 'secondary'} className="h-8 gap-1.5 px-3">
      <span className={on ? 'inline-flex' : 'inline-flex opacity-40'}>{icon}</span>{label}
    </Badge>
  )
}

export default function LoyaltySection({
  restaurantId,
  timeZone,
  featureAllowed,
  initial,
  initialSettings,
}: {
  restaurantId: string
  timeZone: string
  featureAllowed: boolean
  initial: LoyaltyConfig
  initialSettings: Record<string, unknown>
}) {
  const hasLoyaltyAccess = featureAllowed
  const settingsSnapshotRef = useRef(initialSettings)
  const mutationAttemptRef = useRef<SettingsMutationAttempt | null>(null)
  const initialConfigRef = useRef(initial)
  const [cfg, setCfg] = useState<LoyaltyConfig>(initial)
  const [rewardChoices, setRewardChoices] = useState<Array<{ id: string; name: string }>>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initialConfigRef.current)
  useSettingsDirtyState('loyalty:config', dirty)

  const itemOptions = useMemo(
    () => [
      { value: '', label: '- Ürün seç -' },
      ...rewardChoices.map((it) => ({ value: it.id, label: it.name })),
    ],
    [rewardChoices],
  )
  const itemName = (id: string | null | undefined) =>
    rewardChoices.find((it) => it.id === id)?.name ?? (id ? 'Seçili ürün' : 'Ürün seçilmedi')

  const patch = (p: Partial<LoyaltyConfig>) => {
    setCfg((c) => ({ ...c, ...p }))
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
    if (!(e.currentTarget as HTMLFormElement).reportValidity() || !tiersValid) return
    setError('')
    setSuccess(false)
    const settingsPatch = { loyalty: cfg as unknown as Record<string, unknown> }
    const attempt = prepareSettingsMutationAttempt(mutationAttemptRef.current, {
      patch: settingsPatch,
      expectedSettings: settingsSnapshotRef.current,
    })
    mutationAttemptRef.current = attempt
    startTransition(async () => {
      let result
      try {
        result = await saveLoyaltyConfig(restaurantId, cfg as unknown as Record<string, unknown>, {
          expectedSettings: settingsSnapshotRef.current,
          requestId: attempt.requestId,
        })
      } catch {
        setError('Bağlantı kesildi. Taslağın korundu; tekrar deneyebilirsin.')
        return
      }
      if ('error' in result) {
        if (result.code === 'CONFLICT') {
          mutationAttemptRef.current = null
          const canonicalSettings = result.canonicalSettings ?? {}
          notifySettingsConflict({
            source: 'loyalty:config', canonicalSettings, draft: settingsPatch,
            prepareReapply: () => { settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, canonicalSettings) },
          })
        }
        setError(result.error)
        return
      }
      settingsSnapshotRef.current = mergeCanonicalSettings(settingsSnapshotRef.current, result.canonicalSettings)
      mutationAttemptRef.current = null
      const canonicalLoyalty = result.canonicalSettings['loyalty']
      if (canonicalLoyalty && typeof canonicalLoyalty === 'object' && !Array.isArray(canonicalLoyalty)) {
        const canonicalConfig = canonicalLoyalty as unknown as LoyaltyConfig
        initialConfigRef.current = canonicalConfig
        setCfg(canonicalLoyalty as unknown as LoyaltyConfig)
      } else {
        initialConfigRef.current = cfg
      }
      setSuccess(true)
      notifySettingsSaved('loyalty:config')
    })
  }

  const maxTierDiscount = Math.max(0, ...cfg.tiers.map((t) => Number(t.discountPct) || 0))
  const hasTierDiscount = maxTierDiscount > 0
  const hasPriorityTier = cfg.tiers.some((t) => t.priorityService)
  const hasBonusStamps = cfg.tiers.some((t) => (t.bonusStamps ?? 0) > 0)

  if (!hasLoyaltyAccess) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{I.crown}</div>
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">Sadakat programı <Badge>Pro</Badge></CardTitle>
              <CardDescription className="mt-1 max-w-xl">
                Damga, puan, üyelik indirimi ve hoş geldin bonusu Pro pakette çalışır. Kaydedilmiş
                ayarlarınız korunur; Pro&apos;ya geçtiğinizde tekrar etkinleştirebilirsiniz.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <SummaryChip on={cfg.stamp_enabled} icon={<AppI.stamp size={14} />} label={cfg.stamp_enabled ? `Damga · ${cfg.stamp_goal} hedef` : 'Damga kapalı'} />
        <SummaryChip on={cfg.points_enabled} icon={<AppI.star size={14} />} label={cfg.points_enabled ? `Puan · ${cfg.points_per_lira}p/₺` : 'Puan kapalı'} />
        <SummaryChip on={hasTierDiscount || cfg.member_discount_pct > 0} icon={<AppI.card size={14} />} label={hasTierDiscount ? `Seviye indirimi max %${maxTierDiscount}` : cfg.member_discount_pct > 0 ? `Üye indirimi %${cfg.member_discount_pct}` : 'İndirim yok'} />
        <SummaryChip on={cfg.welcome_bonus_points > 0} icon={<AppI.gift size={14} />} label={cfg.welcome_bonus_points > 0 ? `Hoş geldin +${cfg.welcome_bonus_points}p` : 'Bonus kapalı'} />
        <SummaryChip on={hasBonusStamps} icon={<AppI.plus size={14} />} label={hasBonusStamps ? 'Bonus damga aktif' : 'Bonus damga yok'} />
        <SummaryChip on={hasPriorityTier} icon={<AppI.crown size={14} />} label={hasPriorityTier ? 'Öncelikli servis' : `${cfg.tiers.length} seviye`} />
      </div>

      <CouponManager restaurantId={restaurantId} timeZone={timeZone} />

      <form onSubmit={handleSubmit} aria-busy={isPending} className="flex flex-col gap-5">

      <Module
        icon={I.stamp}
        title="Damga Kartı"
        desc={'"9 al 1 bedava" tarzı - her uygun siparişte +1 damga'}
        on={cfg.stamp_enabled}
        onToggle={(on) => patch({ stamp_enabled: on })}
      >
        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex flex-col gap-5">
            <Field label="Hedef damga sayısı" hint="Ödül için gereken ücretli uygun ürün adedi (örn. 9 = 9 ürün al, sonraki ürün ödül)">
              <NumberField value={cfg.stamp_goal} min={2} max={50} onChange={(stamp_goal) => patch({ stamp_goal: Math.floor(stamp_goal) })} />
            </Field>
            <Field label="Ödül metni" hint="Müşteriye gösterilecek ödül açıklaması">
              <TextField value={cfg.stamp_reward_text} maxLength={80} onChange={(stamp_reward_text) => patch({ stamp_reward_text })} placeholder="8. kahve bizden" />
            </Field>
            <Field label="Bedava ödül ürünü" hint="Kart dolunca müşteri bu üründen 1 adet bedava alır (sepete eklerse)">
              <SelectField value={cfg.reward_item_id ?? ''} onChange={(value) => patch({ reward_item_id: value || null })} options={itemOptions} />
            </Field>
          </div>

          <LoyaltyCardShell background="#1f5642" foreground="#fffdf7" accent="#d7b06a" style={{ padding: 18, alignSelf: 'flex-start', position: 'sticky', top: 0 }}>
            <div style={{ fontSize: 10.5, opacity: 0.75, letterSpacing: '.1em', fontWeight: 700 }}>ÖNİZLEME · DAMGA KARTI</div>
            <div style={{ fontSize: 16, fontWeight: 750, marginTop: 6 }}>{cfg.stamp_reward_text || `${cfg.stamp_goal} ürün al, 1 ödül kazan`}</div>
            <div style={{ marginTop: 14 }}>
              <LoyaltyStampGrid
                earnedStamps={Math.min(6, cfg.stamp_goal)}
                stampGoal={cfg.stamp_goal}
                foreground="#fffdf7"
                filledBackground="#fffdf7"
                filledForeground="#1f5642"
                rewardColor="#d7b06a"
              />
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.82, marginTop: 12 }}>
              {Math.min(6, cfg.stamp_goal)} / {cfg.stamp_goal} ücretli ürün · {Math.max(cfg.stamp_goal - 6, 0)} kaldı
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.82, marginTop: 4 }}>{itemName(cfg.reward_item_id)}</div>
          </LoyaltyCardShell>
        </div>
      </Module>

      <Module
        icon={I.star}
        title="Puan Programı"
        desc="Harcamadan puan kazanımı (₺ → puan)"
        on={cfg.points_enabled}
        onToggle={(on) => patch({ points_enabled: on })}
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
          <div className="overflow-hidden rounded-xl border">
            <div style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr) 110px 130px 44px', gap: 10, padding: '9px 14px', background: 'var(--surface-2)', borderBottom: '1px solid var(--divider)', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '.03em' }}>
              <span /><span>ÜRÜN</span><span style={{ textAlign: 'center' }}>PUAN</span><span>ETİKET</span><span />
            </div>
            {catalog.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0, 1fr) 110px 130px 44px', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--divider)', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-4)', display: 'flex' }}>{I.drag}</span>
                <SelectField ariaLabel={`Ödül ${i + 1} ürünü`} value={r.itemId} onChange={(itemId) => updateCatalogReward(i, { itemId })} options={itemOptions} />
                <NumberField ariaLabel={`Ödül ${i + 1} puan bedeli`} width="100%" min={1} value={r.pointCost} onChange={(pointCost) => updateCatalogReward(i, { pointCost: Math.max(1, Math.floor(pointCost)) })} />
                <TextField ariaLabel={`Ödül ${i + 1} etiketi`} value={r.tag ?? ''} maxLength={24} onChange={(tag) => updateCatalogReward(i, { tag })} placeholder="etiket" />
                <Button type="button" variant="destructive" size="icon" onClick={() => removeCatalogReward(i)} aria-label={`Ödül ${i + 1} kaldır`}>
                  <AppI.x data-icon="inline-start" />
                </Button>
              </div>
            ))}
            {catalog.length === 0 && (
              <Empty className="border-0 py-5">
                <EmptyHeader>
                  <EmptyMedia variant="icon">{I.gift}</EmptyMedia>
                  <EmptyTitle>Henüz puan ödülü eklenmedi</EmptyTitle>
                  <EmptyDescription>Ürün ve puan bedelini tanımlayarak ilk ödülü ekleyin.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            <div className="border-t bg-muted/40 p-2">
              <Button type="button" variant="ghost" className="w-full" onClick={addCatalogReward}>
                <AppI.plus data-icon="inline-start" /> Ödül ekle
              </Button>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 9, lineHeight: 1.5 }}>Puanla alınabilen bedava ürünler. Üye yeterli puana sahipse, sepetteki bu üründen 1 adet bedava olur; serbest puan indirimi ile aynı siparişte birlikte kullanılamaz.</div>
        </div>
      </Module>

      <Module icon={I.crown} title="Üyelik & Seviyeler" desc="Kapsam, kazanım kuralları, seviye eşikleri ve ayrıcalıklar" on alwaysOn>
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
                { value: 'paid', label: 'Ödeme alınınca', desc: 'Ödeme tamamlandığında' },
                { value: 'served', label: 'Servis edilince', desc: 'Sipariş servis edildiğinde' },
              ] as const}
            />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 4 }}>
          <Field label="Standart üye indirimi (%)" hint="Seviyelere özel indirim tanımlamadığınızda tüm üyelere uygulanır.">
            <NumberField width="100%" value={cfg.member_discount_pct} min={0} max={100} suffix="%" onChange={(member_discount_pct) => patch({ member_discount_pct: Math.floor(member_discount_pct) })} />
          </Field>
          <Field label="Hoş geldin bonusu (puan)" hint="Üye olunca bir defaya mahsus verilir (0 = kapalı)">
            <NumberField width="100%" value={cfg.welcome_bonus_points} min={0} onChange={(welcome_bonus_points) => patch({ welcome_bonus_points: Math.floor(welcome_bonus_points) })} />
          </Field>
        </div>

        <Separator className="my-1" />

        <section className="flex flex-col gap-4" aria-labelledby="loyalty-tier-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="loyalty-tier-heading" className="text-sm font-medium">Seviye eşikleri</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ömür boyu kazanılan puana göre belirlenir; kullanılan puan seviyeyi düşürmez.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addTier} disabled={cfg.tiers.length >= MAX_TIERS}>
              <AppI.plus data-icon="inline-start" /> Seviye ekle
            </Button>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {cfg.tiers.map((tier, i) => {
              const err = tierRowError(tier, i)
              const priorityId = `loyalty-tier-priority-${i}`
              return (
                <Card key={i} size="sm" className={cn('gap-0 py-0', err && 'ring-destructive/50')}>
                  <CardHeader className="border-b py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <label
                        className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg ring-1 ring-foreground/10"
                        style={{ backgroundColor: tier.color }}
                        title="Seviye rengini değiştir"
                      >
                        <input
                          type="color"
                          aria-label={`${tier.name || `Seviye ${i + 1}`} rengi`}
                          value={tier.color}
                          onChange={(e) => setTier(i, { color: e.target.value })}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        <AppI.crown size={16} color="#fff" strokeWidth={2} />
                      </label>
                      <div className="min-w-0">
                        <CardTitle className="flex items-center gap-2">
                          {tier.name || `Seviye ${i + 1}`}
                          {i === 0 && <Badge variant="secondary">Taban</Badge>}
                        </CardTitle>
                        <CardDescription>{i === 0 ? 'Tüm üyeler bu seviyeden başlar' : `${tier.min} puan ve üzeri`}</CardDescription>
                      </div>
                    </div>
                    <CardAction className="self-center">
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeTier(i)} disabled={i === 0} aria-label="Seviyeyi kaldır">
                        <AppI.trash data-icon="inline-start" />
                      </Button>
                    </CardAction>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-4 py-4">
                    <FieldGroup className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                      <ShadcnField data-invalid={Boolean(err)}>
                        <FieldLabel>Seviye adı</FieldLabel>
                        <TextField ariaLabel={`Seviye ${i + 1} adı`} value={tier.name} maxLength={24} onChange={(name) => setTier(i, { name })} placeholder={`Seviye ${i + 1}`} />
                      </ShadcnField>
                      <ShadcnField data-invalid={Boolean(err)}>
                        <FieldLabel>Başlangıç puanı</FieldLabel>
                        <NumberField ariaLabel={`Seviye ${i + 1} minimum puanı`} value={tier.min} width="100%" min={0} step={50} onChange={(min) => setTier(i, { min: i === 0 ? 0 : Math.floor(min) })} />
                      </ShadcnField>
                    </FieldGroup>

                    <FieldGroup className="grid grid-cols-3 gap-3">
                      <ShadcnField>
                        <FieldLabel>İndirim</FieldLabel>
                        <NumberField ariaLabel={`${tier.name} indirim yüzdesi`} value={tier.discountPct} min={0} max={100} width="100%" suffix="%" onChange={(discountPct) => setTier(i, { discountPct: Math.floor(discountPct) })} />
                      </ShadcnField>
                      <ShadcnField>
                        <FieldLabel>Puan çarpanı</FieldLabel>
                        <NumberField ariaLabel={`${tier.name} puan çarpanı`} value={tier.pointsMultiplier} min={0.1} max={10} step={0.1} width="100%" suffix="×" onChange={(pointsMultiplier) => setTier(i, { pointsMultiplier })} />
                      </ShadcnField>
                      <ShadcnField>
                        <FieldLabel>Bonus damga</FieldLabel>
                        <NumberField ariaLabel={`${tier.name} bonus damgası`} value={tier.bonusStamps} min={0} max={20} width="100%" onChange={(bonusStamps) => setTier(i, { bonusStamps: Math.floor(bonusStamps) })} />
                      </ShadcnField>
                    </FieldGroup>

                    <ShadcnField orientation="horizontal" className="rounded-lg border bg-muted/40 p-3">
                      <FieldContent>
                        <FieldLabel htmlFor={priorityId}>Öncelikli servis</FieldLabel>
                        <FieldDescription>Bu seviyedeki siparişleri servis akışında öne çıkarır.</FieldDescription>
                      </FieldContent>
                      <Switch
                        id={priorityId}
                        checked={tier.priorityService}
                        onCheckedChange={(priorityService) => setTier(i, { priorityService })}
                        aria-label={`${tier.name || `Seviye ${i + 1}`} için öncelikli servis ${tier.priorityService ? 'açık' : 'kapalı'}`}
                      />
                    </ShadcnField>
                  </CardContent>

                  <CardFooter className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary">{i === 0 ? 'Her zaman' : `${tier.min}+ puan`}</Badge>
                    <span>{tier.discountPct > 0 ? `%${tier.discountPct} indirim` : 'İndirim yok'}</span>
                    <span>·</span>
                    <span>{tier.pointsMultiplier}× puan</span>
                    <span>·</span>
                    <span>+{tier.bonusStamps} damga</span>
                    {err && <FieldError className="basis-full">{err}</FieldError>}
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </section>
      </Module>

      {!tiersValid && <Alert variant="destructive"><AlertDescription>Seviye merdiveni geçersiz - eşikler artan sırada ve isimler benzersiz olmalı.</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert><AlertDescription>Sadakat ayarları kaydedildi.</AlertDescription></Alert>}

      <Card className="sticky bottom-3 z-20 isolate gap-0 bg-card py-0 shadow-xl ring-1 ring-foreground/15">
        <CardFooter className="flex flex-wrap justify-between gap-3 border-t-0 bg-card py-3">
          <span role="status" aria-live="polite" aria-atomic="true" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span aria-hidden="true" className={dirty ? 'size-2 rounded-full bg-[var(--warning)]' : 'size-2 rounded-full bg-[var(--positive)]'} />
            {isPending ? 'Sadakat ayarları kaydediliyor…' : dirty ? 'Kaydedilmemiş değişiklikler var' : success ? 'Tüm değişiklikler kaydedildi' : 'Değişiklik yok'}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => { setCfg(initialConfigRef.current); setError(''); setSuccess(false) }} disabled={isPending || !dirty}>
              Geri al
            </Button>
            <Button type="submit" disabled={isPending || !tiersValid || !dirty}>
              {isPending ? <Spinner data-icon="inline-start" /> : <AppI.check data-icon="inline-start" />}
              {isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </CardFooter>
      </Card>
      </form>
    </div>
  )
}
