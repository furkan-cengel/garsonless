'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet, FieldTitle } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import React from 'react'
import { ALLERGEN_CODES, ALLERGEN_LABELS, normalizeAllergenCodes, normalizeIngredients } from '@garsonless/db/browser'
import type { AllergenCode, MenuIngredient } from '@garsonless/db/browser'
import { applyReviewInvalidatingPatch, moveListItem, normalizeMenuNumericText, toggleAllergenDeclaration } from '@garsonless/domain/menu'
import { AllergenIcon } from '@garsonless/ui/menu'
import { I } from '../../lib/ui'

/* ============================================================
   Shared nutrition / allergen / dietary editor — used by the
   product details panel AND the new-product drawer. Controlled
   via (state, onChange). Real allergen codes; persists through
   menu.ts createItem/updateItem.
   ============================================================ */

export interface NutritionIngredient {
  id: string
  name: string
  amount: string
  removable: boolean
  allergen_codes: AllergenCode[]
}

export interface NutritionState {
  ingredients: NutritionIngredient[]
  energyKcal: string
  protein: string
  carb: string
  fat: string
  contains: AllergenCode[] // DEFINITELY contains → contains_allergens
  traces: AllergenCode[] // cross-contact → may_contain_allergens
  allergenNote: string
  crossContactNote: string
  alcohol: boolean
  pork: boolean
  vegetarian: boolean
  vegan: boolean
  halal: boolean
  reviewed: boolean
}

type RawItem = {
  ingredients?: unknown
  energy_kcal?: number | null
  protein_g?: number | null
  carb_g?: number | null
  fat_g?: number | null
  contains_allergens?: unknown
  may_contain_allergens?: unknown
  allergen_note?: string | null
  cross_contact_note?: string | null
  contains_alcohol?: boolean | null
  contains_pork?: boolean | null
  is_vegetarian?: boolean | null
  is_vegan?: boolean | null
  is_halal?: boolean | null
  food_info_reviewed_at?: string | null
}

const numStr = (v: number | null | undefined) => (v == null ? '' : String(v))

export function nutritionFromItem(item: RawItem | null): NutritionState {
  const ings = normalizeIngredients(item?.ingredients) as MenuIngredient[]
  return {
    ingredients: ings.length
      ? ings.map((i) => ({
          id: i.id,
          name: i.name,
          amount: i.amount ?? '',
          removable: i.removable,
          allergen_codes: i.allergen_codes,
        }))
      : [
          {
            id: crypto.randomUUID(),
            name: '',
            amount: '',
            removable: false,
            allergen_codes: [],
          },
        ],
    energyKcal: numStr(item?.energy_kcal),
    protein: numStr(item?.protein_g),
    carb: numStr(item?.carb_g),
    fat: numStr(item?.fat_g),
    contains: normalizeAllergenCodes(item?.contains_allergens),
    traces: normalizeAllergenCodes(item?.may_contain_allergens),
    allergenNote: item?.allergen_note ?? '',
    crossContactNote: item?.cross_contact_note ?? '',
    alcohol: item?.contains_alcohol ?? false,
    pork: item?.contains_pork ?? false,
    vegetarian: item?.is_vegetarian ?? false,
    vegan: item?.is_vegan ?? false,
    halal: item?.is_halal ?? false,
    reviewed: item?.food_info_reviewed_at != null,
  }
}

/** Append the nutrition state to a FormData for createItem/updateItem. */
export function appendNutritionToFormData(fd: FormData, s: NutritionState): void {
  const ingredients = s.ingredients
    .filter((i) => i.name.trim())
    .map((i) => ({
      id: i.id,
      name: i.name.trim(),
      removable: i.removable,
      allergen_codes: i.allergen_codes,
      ...(i.amount.trim() ? { amount: i.amount.trim() } : {}),
    }))
  fd.set('ingredients', JSON.stringify(ingredients))
  fd.set('energy_kcal', s.energyKcal.trim())
  fd.set('protein_g', s.protein.trim())
  fd.set('carb_g', s.carb.trim())
  fd.set('fat_g', s.fat.trim())
  fd.set('contains_allergens', JSON.stringify(s.contains))
  fd.set('may_contain_allergens', JSON.stringify(s.traces))
  fd.set('allergen_note', s.allergenNote.trim())
  fd.set('cross_contact_note', s.crossContactNote.trim())
  fd.set('contains_alcohol', String(s.alcohol))
  fd.set('contains_pork', String(s.pork))
  fd.set('is_vegetarian', String(s.vegetarian))
  fd.set('is_vegan', String(s.vegan))
  fd.set('is_halal', String(s.halal))
  fd.set('food_info_reviewed', String(s.reviewed))
}

function nutritionComplete(s: NutritionState): boolean {
  return s.ingredients.some((i) => i.name.trim()) && s.energyKcal.trim() !== '' && s.reviewed
}

export function applyNutritionPatch(current: NutritionState, patch: Partial<NutritionState>): NutritionState {
  return applyReviewInvalidatingPatch(current, patch)
}

/* ── sub-pieces ────────────────────────────────────────────────────────── */
function NSection({ title, hint, right, first, children, anchor }: { title: string; hint?: string; right?: React.ReactNode; first?: boolean; children: React.ReactNode; anchor?: string }) {
  return (
    <div
      data-menu-field={anchor}
      style={{
        padding: '14px 16px',
        borderTop: first ? 'none' : '1px solid var(--divider)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 11,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '.07em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
          }}
        >
          {title}
        </span>
        {hint && <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>{hint}</span>}
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      {children}
    </div>
  )
}

function MacroInput({ label, value, onChange, suffix, accent, anchor }: { label: string; value: string; onChange: (v: string) => void; suffix: string; accent?: boolean; anchor?: string }) {
  const id = React.useId()
  return (
    <Field data-menu-field={anchor} className="nutrition-macro-field gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
      <FieldLabel htmlFor={id} className="text-[10px] font-semibold uppercase tracking-[.05em] text-[var(--text-3)]">
        {label}
      </FieldLabel>
      <InputGroup className="h-7 border-0 bg-transparent shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0">
        <InputGroupInput
          id={id}
          className="nutrition-macro-input"
          aria-label={label}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(normalizeMenuNumericText(e.target.value))}
          placeholder="-"
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: "'Geist Mono', monospace",
            fontSize: 15,
            fontWeight: 700,
            color: accent ? 'var(--accent)' : 'var(--text)',
            padding: '0 2px',
          }}
        />
        <InputGroupAddon align="inline-end" className="pr-1">
          <InputGroupText className="text-[10px] font-normal text-[var(--text-4)]">{suffix}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}

function AllergenChip({ code, on, variant, onClick }: { code: AllergenCode; on: boolean; variant: 'contains' | 'trace'; onClick: () => void }) {
  const contains = variant === 'contains'
  return (
    <Button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px 5px 9px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        background: on ? (contains ? 'var(--warning-bg)' : 'var(--surface-2)') : 'var(--surface)',
        color: on ? (contains ? 'var(--warning)' : 'var(--text-2)') : 'var(--text-3)',
        border: on ? (contains ? '1px solid var(--warning)' : '1px dashed var(--warning)') : '1px solid var(--border)',
        transition: 'all .12s ease',
      }}
    >
      <span style={{ display: 'flex', opacity: on ? 1 : 0.7 }}>
        <AllergenIcon code={code} size={14} decorative />
      </span>
      {ALLERGEN_LABELS[code]}
    </Button>
  )
}

function FlagRow({
  icon,
  label,
  desc,
  on,
  onToggle,
  tone,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  on: boolean
  onToggle: () => void
  tone: 'critical' | 'positive' | 'accent'
}) {
  const id = React.useId()
  return (
    <FieldLabel htmlFor={id} className="nutrition-choice-card" data-tone={tone}>
      <Field orientation="horizontal" className="min-w-0 gap-2.5 p-2.5">
        <span className={cn('nutrition-choice-icon grid size-7 shrink-0 place-items-center rounded-md bg-[var(--surface-3)] text-[var(--text-3)]', on && 'is-selected')}>
          {icon}
        </span>
        <FieldContent className="min-w-0 gap-0">
          <FieldTitle className="w-full whitespace-normal text-[12.5px] leading-4">{label}</FieldTitle>
          <FieldDescription className="w-full whitespace-normal text-[10.5px] leading-4">{desc}</FieldDescription>
        </FieldContent>
        <Checkbox id={id} checked={on} onCheckedChange={onToggle} aria-label={label} />
      </Field>
    </FieldLabel>
  )
}

const flagIcon = (d: React.ReactNode) => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
)

/* ── main ──────────────────────────────────────────────────────────────── */
export default function NutritionFields({ s, set, firstBorderless }: { s: NutritionState; set: (patch: Partial<NutritionState>) => void; firstBorderless?: boolean }) {
  const allergenNoteId = React.useId()
  const crossContactNoteId = React.useId()
  const reviewId = React.useId()
  const updIng = (id: string, patch: Partial<NutritionIngredient>) =>
    set({
      ingredients: s.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })
  const addIng = () =>
    set({
      ingredients: [
        ...s.ingredients,
        {
          id: crypto.randomUUID(),
          name: '',
          amount: '',
          removable: false,
          allergen_codes: [],
        },
      ],
    })
  const rmIng = (id: string) => set({ ingredients: s.ingredients.filter((i) => i.id !== id) })
  const moveIng = (index: number, direction: -1 | 1) => {
    set({ ingredients: moveListItem(s.ingredients, index, direction) })
  }
  const toggleContains = (code: AllergenCode) => set(toggleAllergenDeclaration(s.contains, s.traces, code, 'contains'))
  const toggleTrace = (code: AllergenCode) => {
    set(toggleAllergenDeclaration(s.contains, s.traces, code, 'trace'))
  }
  const ingredientCount = s.ingredients.filter((i) => i.name.trim()).length

  return (
    <div className="nutrition-editor">
      <NSection
        first={firstBorderless}
        anchor="ingredients"
        title="İçindekiler ve enerji"
        right={
          ingredientCount > 0 ? (
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--text-3)',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {ingredientCount} bileşen
            </span>
          ) : undefined
        }
      >
        <FieldGroup className="gap-2">
          {s.ingredients.map((ing, index) => (
            <Field key={ing.id} className="nutrition-ingredient-card gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[.05em] text-[var(--text-3)]">Bileşen {index + 1}</span>
                <div className="flex items-center gap-0.5">
                  <Button
                    className="nutrition-ingredient-action"
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${ing.name.trim() || `Bileşen ${index + 1}`} yukarı taşı`}
                    disabled={index === 0}
                    onClick={() => moveIng(index, -1)}
                  >
                    <I.chevDown className="rotate-180" />
                  </Button>
                  <Button
                    className="nutrition-ingredient-action"
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${ing.name.trim() || `Bileşen ${index + 1}`} aşağı taşı`}
                    disabled={index === s.ingredients.length - 1}
                    onClick={() => moveIng(index, 1)}
                  >
                    <I.chevDown />
                  </Button>
                  <Button
                    className="nutrition-ingredient-action"
                    type="button"
                    variant="destructive"
                    size="icon-xs"
                    aria-label={`${ing.name.trim() || `Bileşen ${index + 1}`} sil`}
                    onClick={() => rmIng(ing.id)}
                    disabled={s.ingredients.length <= 1}
                  >
                    <I.trash />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                <InputGroup>
                  <InputGroupInput
                    aria-label={`Bileşen ${index + 1} adı`}
                    value={ing.name}
                    onChange={(e) => updIng(ing.id, { name: e.target.value })}
                    placeholder="Bileşen adı"
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupInput
                    aria-label={`${ing.name.trim() || `Bileşen ${index + 1}`} miktarı`}
                    value={ing.amount}
                    maxLength={40}
                    onChange={(e) => updIng(ing.id, { amount: e.target.value })}
                    placeholder="Miktar"
                    className="text-center"
                  />
                </InputGroup>
              </div>
              <Field orientation="horizontal" className="w-auto gap-2">
                <Switch
                  id={`ingredient-removable-${ing.id}`}
                  className="nutrition-removable-switch"
                  size="sm"
                  checked={ing.removable}
                  onCheckedChange={(checked) => updIng(ing.id, { removable: checked })}
                />
                <FieldLabel htmlFor={`ingredient-removable-${ing.id}`} className="text-[11px] font-normal text-[var(--text-2)]">
                  Müşteri çıkarabilir
                </FieldLabel>
              </Field>
            </Field>
          ))}
        </FieldGroup>
        <Button type="button" variant="positive" size="sm" className="mt-2" onClick={addIng}>
          <I.plus data-icon="inline-start" />
          Bileşen ekle
        </Button>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MacroInput anchor="energy" label="Enerji" value={s.energyKcal} onChange={(v) => set({ energyKcal: v })} suffix="kcal" accent />
          <MacroInput label="Protein" value={s.protein} onChange={(v) => set({ protein: v })} suffix="g" />
          <MacroInput label="Karbonhidrat" value={s.carb} onChange={(v) => set({ carb: v })} suffix="g" />
          <MacroInput label="Yağ" value={s.fat} onChange={(v) => set({ fat: v })} suffix="g" />
        </div>
        <div className="mt-2 text-[10.5px] leading-4 text-[var(--text-4)]">Porsiyon başına. Enerji müşteriye gösterilir; makrolar işletme içi kalır.</div>
      </NSection>

      <NSection
        title="Alerjenler"
        right={
          s.contains.length > 0 ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--warning)',
                background: 'var(--warning-bg)',
                padding: '2px 8px',
                borderRadius: 999,
              }}
            >
              {s.contains.length} içerir
            </span>
          ) : undefined
        }
      >
        <label
          style={{
            display: 'block',
            fontSize: 11,
            color: 'var(--text-2)',
            fontWeight: 600,
            marginBottom: 6,
          }}
          htmlFor={allergenNoteId}
        >
          İşletme açıklaması · içerir
        </label>
        <Textarea
          id={allergenNoteId}
          value={s.allergenNote}
          maxLength={500}
          onChange={(event) => set({ allergenNote: event.target.value })}
          placeholder="Örn. Süt ve fındık içerir. Aynı mutfakta susam kullanılmaktadır."
          style={{
            width: '100%',
            minHeight: 62,
            resize: 'vertical',
            padding: '9px 10px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 11.5,
            lineHeight: 1.45,
            outline: 'none',
          }}
        />
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--text-4)',
            marginTop: 5,
            marginBottom: 10,
          }}
        >
          Bu metin müşteriye aynen gösterilir. Kesin ve doğrulanmış bilgi girin.
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-2)',
            fontWeight: 600,
            marginBottom: 7,
          }}
        >
          Resmi alerjen etiketleri · içerir
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALLERGEN_CODES.map((code) => (
            <AllergenChip key={code} code={code} variant="contains" on={s.contains.includes(code)} onClick={() => toggleContains(code)} />
          ))}
        </div>
        {/* Cross-contact is the less common declaration: folded unless already used. */}
        <Collapsible defaultOpen={s.traces.length > 0 || s.crossContactNote.trim() !== ''} className="mt-3">
          <CollapsibleTrigger render={<Button type="button" variant="ghost" size="sm" className="-mx-2 w-[calc(100%+16px)] justify-between text-xs" />}>
            <span>Eser miktar · olası çapraz temas{s.traces.length > 0 ? ` · ${s.traces.length} seçili` : ''}</span>
            <I.chevDown size={13} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                color: 'var(--text-2)',
                fontWeight: 600,
                marginTop: 4,
                marginBottom: 6,
              }}
              htmlFor={crossContactNoteId}
            >
              İşletme açıklaması · eser miktarda
            </label>
            <Textarea
              id={crossContactNoteId}
              value={s.crossContactNote}
              maxLength={500}
              onChange={(event) => set({ crossContactNote: event.target.value })}
              placeholder="Örn. Üretim alanında yer fıstığı işlendiği için eser miktarda içerebilir."
              style={{
                width: '100%',
                minHeight: 62,
                resize: 'vertical',
                padding: '9px 10px',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 11.5,
                lineHeight: 1.45,
                outline: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 14,
                marginBottom: 7,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>Resmi alerjen etiketleri · eser miktar</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALLERGEN_CODES.filter((code) => !s.contains.includes(code)).map((code) => (
                <AllergenChip key={code} code={code} variant="trace" on={s.traces.includes(code)} onClick={() => toggleTrace(code)} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </NSection>

      <NSection title="Özel içerik & diyet">
        <FieldSet>
          <FieldLegend className="sr-only">Özel içerik ve diyet beyanları</FieldLegend>
          <FieldGroup data-slot="checkbox-group" className="gap-1.5">
            <FlagRow
              tone="critical"
              on={s.alcohol}
              onToggle={() => set({ alcohol: !s.alcohol })}
              icon={flagIcon(<path d="M8 22h8M12 15v7M5 3h14l-6 10H11L5 3ZM7.5 7h9" />)}
              label="Alkol içerir"
              desc="Müşteri detayında içerik uyarısı gösterilir"
            />
            <FlagRow
              tone="critical"
              on={s.pork}
              onToggle={() => set({ pork: !s.pork })}
              icon={flagIcon(<path d="M5 11a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5v-2ZM3 10l2 1M21 10l-2 1M11 12h.01M15 12h.01" />)}
              label="Domuz kaynaklı bileşen içerir"
              desc="Helal beyanıyla birlikte seçilemez"
            />
            <FlagRow
              tone="positive"
              on={s.vegetarian}
              onToggle={() => set({ vegetarian: !s.vegetarian, vegan: false })}
              icon={flagIcon(<path d="M5 19c8 1 14-5 14-14C11 4 5 11 5 19ZM9 15c2-3 4-5 7-6" />)}
              label="Vejetaryen"
              desc="Et içermez"
            />
            <FlagRow
              tone="positive"
              on={s.vegan}
              onToggle={() =>
                set({
                  vegan: !s.vegan,
                  vegetarian: s.vegan ? s.vegetarian : true,
                })
              }
              icon={flagIcon(<path d="M5 19c8 1 14-5 14-14C11 4 5 11 5 19Z" />)}
              label="Vegan"
              desc="Hayvansal ürün içermez"
            />
            <FlagRow
              tone="accent"
              on={s.halal}
              onToggle={() => set({ halal: !s.halal })}
              icon={flagIcon(<path d="M12 3 4 7v5c0 4 3.5 7 8 9 4.5-2 8-5 8-9V7l-8-4ZM9 12l2 2 4-4" />)}
              label="Helal onaylı"
              desc="İşletmenin ürün beyanıdır"
            />
          </FieldGroup>
        </FieldSet>
      </NSection>

      <NSection anchor="review" title="Kontrol">
        <FieldSet>
          <FieldLegend className="sr-only">Gıda bilgisi kontrolü</FieldLegend>
          <FieldLabel htmlFor={reviewId} className="nutrition-choice-card nutrition-review-card" data-tone="positive">
            <Field orientation="horizontal" className="min-w-0 gap-2.5 p-2.5">
              <FieldContent className="min-w-0 gap-0.5">
                <FieldTitle className="w-full whitespace-normal text-[12.5px] leading-[1.35]">İçerik, enerji ve alerjen bilgilerini gözden geçirdim</FieldTitle>
                <FieldDescription className="w-full whitespace-normal text-[10.5px] leading-4">
                  {s.reviewed ? 'Onaylandı' : 'İşletme beyanını kaydeder'}
                </FieldDescription>
              </FieldContent>
              <Checkbox
                id={reviewId}
                checked={s.reviewed}
                onCheckedChange={() => set({ reviewed: !s.reviewed })}
                aria-label="Gıda bilgilerini gözden geçirdim"
              />
            </Field>
          </FieldLabel>
        </FieldSet>
      </NSection>
    </div>
  )
}

export function NutritionStatusPill({ s }: { s: NutritionState }) {
  const done = nutritionComplete(s)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 9px',
        borderRadius: 999,
        background: done ? 'var(--positive-bg)' : 'var(--warning-bg)',
        color: done ? 'var(--positive)' : 'var(--warning)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: done ? 'var(--positive)' : 'var(--warning)',
        }}
      />
      {done ? 'Bilgi tam' : 'Bilgi eksik'}
    </span>
  )
}
