'use client'

import { useEffect, useState } from 'react'
import {
  customerRewardMessage,
  type CustomerRewardKind,
  type CustomerRewardParams,
  type CustomerRewardRule,
} from '@garsonless/domain/customers'
import { previewCustomerRewardRuleAction, saveCustomerRewardRuleAction } from '../../lib/actions/customers'
import PageTopBar from '../layout/PageTopBar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type RuleCopy = {
  title: string
  summary: (rule: CustomerRewardRule) => string
  param: keyof CustomerRewardParams
  paramLabel: string
  values: number[]
  label: (value: number) => string
  matchNote: string
}

const money = (value: number) => `₺${value.toLocaleString('tr-TR')}`

const COPY: Record<CustomerRewardKind, RuleCopy> = {
  birthday: {
    title: 'Doğum günü',
    summary: ({ points, params }) => `${points} puan · ${params.leadDays ? `doğum gününden ${params.leadDays} gün önce` : 'doğum günü sabahı'}`,
    param: 'leadDays',
    paramLabel: 'Ne zaman',
    values: [0, 3, 7],
    label: (value) => (value ? `${value} gün önce` : 'Aynı gün'),
    matchNote: 'Önümüzdeki 7 günde doğum günü olan müşteri. Doğum günü müşterinin QR menüde ya da senin profilde girdiği tarihtir.',
  },
  visit: {
    title: 'Ziyaret ödülü',
    summary: ({ points, params }) => `Her ${params.every}. ziyarette ${points} puan`,
    param: 'every',
    paramLabel: 'Kaçıncı ziyaret',
    values: [5, 8, 10, 15],
    label: (value) => `${value}. ziyaret`,
    matchNote: 'Bir sonraki ziyarette ödüle ulaşacak müşteri.',
  },
  spend: {
    title: 'Harcama ödülü',
    summary: ({ points, params }) => `${money(params.minimum ?? 0)} ve üzeri tek hesapta +${points} puan`,
    param: 'minimum',
    paramLabel: 'En az hesap tutarı',
    values: [500, 1000, 2000],
    label: money,
    matchNote: 'Son 30 günde bu tutarı tek hesapta geçen müşteri.',
  },
  winback: {
    title: 'Geri kazanma',
    summary: ({ points, params }) => `${params.inactiveDays} gündür gelmeyene ${points} puan`,
    param: 'inactiveDays',
    paramLabel: 'Kaç gündür gelmeyen',
    values: [30, 60, 90],
    label: (value) => `${value} gün`,
    matchNote: 'Bu süredir gelmeyen müşteri. Puan, sessizlik bu süreyi kural açıkken geçince bir kez verilir.',
  },
}
const POINT_OPTIONS = [100, 200, 300, 500]

/** Presets plus the saved value, so a value set elsewhere is never hidden. */
function withCurrent(values: number[], current: number | undefined): number[] {
  return current === undefined || values.includes(current) ? values : [...values, current].sort((a, b) => a - b)
}

const same = (a: CustomerRewardRule, b: CustomerRewardRule) => a.points === b.points && JSON.stringify(a.params) === JSON.stringify(b.params)

export default function CustomerRewardsClient({
  restaurantId,
  restaurantName,
  initialRules,
  pointsEnabled,
}: {
  restaurantId: string
  restaurantName: string
  initialRules: CustomerRewardRule[]
  pointsEnabled: boolean
}) {
  const [saved, setSaved] = useState(initialRules)
  const [drafts, setDrafts] = useState(initialRules)
  const [selected, setSelected] = useState<CustomerRewardKind>(initialRules[0]?.kind ?? 'birthday')
  const [busy, setBusy] = useState<CustomerRewardKind | null>(null)
  const [errors, setErrors] = useState<Partial<Record<CustomerRewardKind, string>>>({})
  const [matching, setMatching] = useState<{ key: string; count: number | null } | null>(null)

  const draft = drafts.find((rule) => rule.kind === selected) ?? drafts[0]!
  const previewKey = `${draft.kind}:${JSON.stringify(draft.params)}`

  useEffect(() => {
    let live = true
    void previewCustomerRewardRuleAction(restaurantId, draft.kind, draft.params).then((result) => {
      if (live) setMatching({ key: previewKey, count: 'error' in result ? null : result.matching })
    })
    return () => { live = false }
    // previewKey carries kind and params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, previewKey])

  function edit(kind: CustomerRewardKind, change: Partial<CustomerRewardRule>) {
    setDrafts((rules) => rules.map((rule) => (rule.kind === kind ? { ...rule, ...change, params: { ...rule.params, ...change.params } } : rule)))
    setErrors((current) => ({ ...current, [kind]: undefined }))
  }

  async function save(rule: CustomerRewardRule, enabled: boolean) {
    setBusy(rule.kind)
    setErrors((current) => ({ ...current, [rule.kind]: undefined }))
    const result = await saveCustomerRewardRuleAction(restaurantId, { kind: rule.kind, enabled, points: rule.points, params: rule.params })
    setBusy(null)
    if ('error' in result) {
      setErrors((current) => ({ ...current, [rule.kind]: result.error }))
      return
    }
    setSaved((rules) => rules.map((r) => (r.kind === result.kind ? result : r)))
    setDrafts((rules) => rules.map((r) => (r.kind === result.kind ? result : r)))
  }

  const activeCount = saved.filter((rule) => rule.enabled).length
  const message = customerRewardMessage(draft.kind, draft.points)
  const count = matching?.key === previewKey ? matching.count : undefined

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageTopBar restaurantName={restaurantName} title="Ödüller ve doğum günü" backHref={`/dashboard/${restaurantId}/customers`} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-[1_1_320px]">
            <h1 className="text-xl font-semibold">Otomatik ödüller</h1>
            <p className="text-sm text-muted-foreground">
              Kurala uyan müşteriye puan kendiliğinden tanımlanır. Tek seferlik ödül için profilden “Puan ekle”yi kullan.
            </p>
          </div>
          <Badge variant={activeCount ? 'positive' : 'secondary'}>{activeCount} kural açık</Badge>
        </div>
        {!pointsEnabled && (
          <Alert>
            <AlertDescription>
              Puan sistemi kapalı olduğu için kurallar şu an puan tanımlamaz. Açmak için{' '}
              <a className="underline" href={`/dashboard/${restaurantId}/settings?section=loyalty`}>Ayarlar › Sadakat</a>’a git.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-3">
            {drafts.map((rule) => {
              const copy = COPY[rule.kind]
              const stored = saved.find((r) => r.kind === rule.kind)!
              const isSelected = rule.kind === selected
              const dirty = !same(rule, stored)
              const current = rule.params[copy.param] as number | undefined
              const paramOptions = withCurrent(copy.values, current)
              const pointOptions = withCurrent(POINT_OPTIONS, rule.points)
              return (
                <section
                  key={rule.kind}
                  aria-label={copy.title}
                  className={`rounded-xl border bg-card ${isSelected ? 'ring-2 ring-foreground' : ''}`}
                >
                  <div className="flex items-center gap-3 p-4">
                    <button type="button" className="min-w-0 flex-1 text-left" aria-expanded={isSelected} onClick={() => setSelected(rule.kind)}>
                      <strong className="block text-sm font-semibold">{copy.title}</strong>
                      <span className="text-xs text-muted-foreground">{stored.enabled ? copy.summary(stored) : 'Kapalı'}</span>
                    </button>
                    <Switch
                      aria-label={`${copy.title} kuralı`}
                      checked={stored.enabled}
                      disabled={busy !== null}
                      onCheckedChange={(checked) => { setSelected(rule.kind); void save(rule, checked) }}
                    />
                  </div>
                  {isSelected && (
                    <div className="flex flex-col gap-3 border-t p-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">{copy.paramLabel}</span>
                        <ToggleGroup
                          variant="outline"
                          size="sm"
                          aria-label={copy.paramLabel}
                          value={current === undefined ? [] : [String(current)]}
                          onValueChange={(values) => { if (values[0] !== undefined) edit(rule.kind, { params: { [copy.param]: Number(values[0]) } }) }}
                          className="flex-wrap"
                        >
                          {paramOptions.map((value) => <ToggleGroupItem key={value} value={String(value)}>{copy.label(value)}</ToggleGroupItem>)}
                        </ToggleGroup>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Ödül</span>
                        <ToggleGroup
                          variant="outline"
                          size="sm"
                          aria-label={`${copy.title} puanı`}
                          value={[String(rule.points)]}
                          onValueChange={(values) => { if (values[0] !== undefined) edit(rule.kind, { points: Number(values[0]) }) }}
                          className="flex-wrap"
                        >
                          {pointOptions.map((value) => <ToggleGroupItem key={value} value={String(value)}>{value.toLocaleString('tr-TR')} puan</ToggleGroupItem>)}
                        </ToggleGroup>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Kural açıldığı andan sonrasını sayar; geçmiş ziyaret ve hesaplar için toplu puan verilmez. Her müşteri aynı ödülü bir kez alır.
                      </p>
                      {(dirty || errors[rule.kind]) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {dirty && <Button size="sm" disabled={busy !== null} onClick={() => void save(rule, stored.enabled)}>{busy === rule.kind ? 'Kaydediliyor…' : 'Değişikliği kaydet'}</Button>}
                          {dirty && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => edit(rule.kind, { points: stored.points, params: stored.params })}>Vazgeç</Button>}
                          {errors[rule.kind] && <span role="alert" className="text-xs text-destructive">{errors[rule.kind]}</span>}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          <aside className="flex flex-col gap-3 lg:sticky lg:top-4" aria-label="Önizleme">
            <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Müşteri ne görür?</h2>
              <div className="rounded-lg bg-muted p-3">
                <span className="text-[11px] text-muted-foreground">{restaurantName} · QR menü</span>
                <strong className="mt-1 block text-sm">{message.title}</strong>
                <p className="text-sm">{message.body}</p>
              </div>
              <p className="text-xs text-muted-foreground">Müşteri QR menüyü açtığında kart olarak görür; puan hesabına hemen eklenir.</p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Bu kurala şu an uyan</h2>
              <strong className="font-mono text-2xl" aria-live="polite">
                {count === undefined ? '…' : count === null ? 'Hesaplanamadı' : `${count.toLocaleString('tr-TR')} müşteri`}
              </strong>
              <p className="text-xs text-muted-foreground">{COPY[draft.kind].matchNote}</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
