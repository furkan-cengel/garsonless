'use client'

import React from 'react'
import { ALLERGEN_CODES, ALLERGEN_LABELS, normalizeAllergenCodes, normalizeIngredients } from '@garsonless/db/order-client'
import type { AllergenCode, MenuIngredient } from '@garsonless/db/order-client'

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
  contains: AllergenCode[]      // DEFINITELY contains → contains_allergens
  traces: AllergenCode[]        // cross-contact → may_contain_allergens
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
      ? ings.map((i) => ({ id: i.id, name: i.name, amount: i.amount ?? '', removable: i.removable, allergen_codes: i.allergen_codes }))
      : [{ id: crypto.randomUUID(), name: '', amount: '', removable: false, allergen_codes: [] }],
    energyKcal: numStr(item?.energy_kcal),
    protein: numStr(item?.protein_g),
    carb: numStr(item?.carb_g),
    fat: numStr(item?.fat_g),
    contains: normalizeAllergenCodes(item?.contains_allergens),
    traces: normalizeAllergenCodes(item?.may_contain_allergens),
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
    .map((i) => ({ id: i.id, name: i.name.trim(), removable: i.removable, allergen_codes: i.allergen_codes, ...(i.amount.trim() ? { amount: i.amount.trim() } : {}) }))
  fd.set('ingredients', JSON.stringify(ingredients))
  fd.set('energy_kcal', s.energyKcal.trim())
  fd.set('protein_g', s.protein.trim())
  fd.set('carb_g', s.carb.trim())
  fd.set('fat_g', s.fat.trim())
  fd.set('contains_allergens', JSON.stringify(s.contains))
  fd.set('may_contain_allergens', JSON.stringify(s.traces))
  fd.set('contains_alcohol', String(s.alcohol))
  fd.set('contains_pork', String(s.pork))
  fd.set('is_vegetarian', String(s.vegetarian))
  fd.set('is_vegan', String(s.vegan))
  fd.set('is_halal', String(s.halal))
  fd.set('food_info_reviewed', String(s.reviewed))
}

export function nutritionComplete(s: NutritionState): boolean {
  return s.ingredients.some((i) => i.name.trim()) && s.energyKcal.trim() !== '' && s.reviewed
}

export function applyNutritionPatch(
  current: NutritionState,
  patch: Partial<NutritionState>,
): NutritionState {
  const explicitlySetsReview = Object.prototype.hasOwnProperty.call(patch, 'reviewed')
  return {
    ...current,
    ...patch,
    ...(explicitlySetsReview ? {} : { reviewed: false }),
  }
}

/* ── allergen glyphs (mapped to the EU codes) ──────────────────────────── */
const G = (d: React.ReactNode) => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)
const ALLERGEN_GLYPH: Partial<Record<AllergenCode, React.ReactElement>> = {
  gluten: G(<path d="M12 3v18M12 7c-2-1.5-4-1-4-1s.5 2.5 2.5 3.5M12 7c2-1.5 4-1 4-1s-.5 2.5-2.5 3.5M12 12c-2-1.5-4-1-4-1s.5 2.5 2.5 3.5M12 12c2-1.5 4-1 4-1s-.5 2.5-2.5 3.5" />),
  milk: G(<path d="M8 3h8l-1 4v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7L8 3ZM8 9h8" />),
  eggs: G(<ellipse cx="12" cy="13" rx="6" ry="8" />),
  tree_nuts: G(<path d="M12 4c4 0 7 3 7 8s-3 8-7 8-7-3-7-8 3-8 7-8ZM9 9c2 2 4 2 6 0M9 14c2 2 4 2 6 0" />),
  peanuts: G(<path d="M12 3a4 4 0 0 1 0 8 4 4 0 0 0 0 8 4 4 0 0 1 0-8 4 4 0 0 0 0-8Z" />),
  soy: G(<path d="M5 19c8 1 14-5 14-14C11 4 5 11 5 19ZM9 15c2-3 4-5 7-6" />),
  fish: G(<path d="M3 12c4-5 11-6 16-3-2 2-2 4 0 6-5 3-12 2-16-3ZM6 12h.01" />),
  crustaceans: G(<path d="M12 7v10M9 9c-3-1-5-3-5-5M15 9c3-1 5-3 5-5M8 13c-3 0-5 1-6 3M16 13c3 0 5 1 6 3M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />),
  sesame: G(<><ellipse cx="9" cy="10" rx="2" ry="3" /><ellipse cx="15" cy="14" rx="2" ry="3" /></>),
  celery: G(<path d="M12 21V8M12 8c-1-3-3-4-5-4 0 3 2 5 5 5M12 8c1-3 3-4 5-4 0 3-2 5-5 5" />),
  mustard: G(<path d="M12 3c-3 4-5 7-5 11a5 5 0 0 0 10 0c0-4-2-7-5-11Z" />),
  sulphites: G(<path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM12 12v6M9 21h6" />),
  molluscs: G(<path d="M12 20c5 0 8-4 8-8 0-3-2-5-4-5-1.5 0-2.5 1-4 1s-2.5-1-4-1c-2 0-4 2-4 5 0 4 3 8 8 8ZM12 7v13" />),
  lupin: G(<><circle cx="12" cy="8" r="3" /><circle cx="9" cy="14" r="3" /><circle cx="15" cy="14" r="3" /></>),
}
const AllergenGlyph = ({ code }: { code: AllergenCode }) => ALLERGEN_GLYPH[code] ?? G(<circle cx="12" cy="12" r="7" />)

const icDrag = <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></svg>
const icX = <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
const icPlus = <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
const icCheck = (sz = 11) => <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4.5 4.5L19 7" /></svg>

/* ── sub-pieces ────────────────────────────────────────────────────────── */
function NSection({ title, hint, right, first, children }: { title: string; hint?: string; right?: React.ReactNode; first?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 16px', borderTop: first ? 'none' : '1px solid var(--divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{title}</span>
        {hint && <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>{hint}</span>}
        {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
      </div>
      {children}
    </div>
  )
}

function MacroInput({ label, value, onChange, suffix, accent }: { label: string; value: string; onChange: (v: string) => void; suffix: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 9, padding: '7px 10px', background: 'var(--surface)' }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 600 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
        <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))} placeholder="—"
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontFamily: "'Geist Mono', monospace", fontSize: 15, fontWeight: 700, color: accent ? 'var(--accent)' : 'var(--text)', padding: 0 }} />
        <span style={{ fontSize: 10, color: 'var(--text-4)', flexShrink: 0 }}>{suffix}</span>
      </div>
    </div>
  )
}

function AllergenChip({ code, on, variant, onClick }: { code: AllergenCode; on: boolean; variant: 'contains' | 'trace'; onClick: () => void }) {
  const contains = variant === 'contains'
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px 5px 9px', borderRadius: 999,
      fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
      background: on ? (contains ? 'var(--warning-bg)' : 'var(--surface-2)') : 'var(--surface)',
      color: on ? (contains ? 'var(--warning)' : 'var(--text-2)') : 'var(--text-3)',
      border: on ? (contains ? '1px solid var(--warning)' : '1px dashed var(--warning)') : '1px solid var(--border)',
      transition: 'all .12s ease',
    }}>
      <span style={{ display: 'flex', opacity: on ? 1 : 0.7 }}><AllergenGlyph code={code} /></span>
      {ALLERGEN_LABELS[code]}
    </button>
  )
}

function FlagRow({ icon, label, desc, on, onToggle, tone }: { icon: React.ReactNode; label: string; desc: string; on: boolean; onToggle: () => void; tone: 'critical' | 'positive' | 'accent' }) {
  const c = { critical: { bg: 'var(--critical-bg)', fg: 'var(--critical)' }, positive: { bg: 'var(--positive-bg)', fg: 'var(--positive)' }, accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)' } }[tone]
  return (
    <button type="button" onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 10, cursor: 'pointer',
      background: on ? c.bg : 'var(--surface)', border: '1px solid ' + (on ? 'transparent' : 'var(--border)'), transition: 'background .12s ease',
    }}>
      <span style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, display: 'grid', placeItems: 'center', background: on ? '#fff' : 'var(--surface-3)', color: on ? c.fg : 'var(--text-3)' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: on ? c.fg : 'var(--text)' }}>{label}</span>
        <span style={{ display: 'block', fontSize: 10.5, color: on ? c.fg : 'var(--text-3)', opacity: on ? 0.85 : 1 }}>{desc}</span>
      </span>
      <span style={{ width: 18, height: 18, borderRadius: 6, flexShrink: 0, border: '2px solid ' + (on ? c.fg : 'var(--border-strong)'), background: on ? c.fg : 'transparent', color: '#fff', display: 'grid', placeItems: 'center' }}>{on && icCheck(11)}</span>
    </button>
  )
}

const flagIcon = (d: React.ReactNode) => <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">{d}</svg>

/* ── main ──────────────────────────────────────────────────────────────── */
export default function NutritionFields({ s, set, firstBorderless }: { s: NutritionState; set: (patch: Partial<NutritionState>) => void; firstBorderless?: boolean }) {
  const updIng = (id: string, patch: Partial<NutritionIngredient>) => set({ ingredients: s.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  const addIng = () => set({ ingredients: [...s.ingredients, { id: crypto.randomUUID(), name: '', amount: '', removable: false, allergen_codes: [] }] })
  const rmIng = (id: string) => set({ ingredients: s.ingredients.filter((i) => i.id !== id) })
  const moveIng = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= s.ingredients.length) return
    const ingredients = [...s.ingredients]
    const current = ingredients[index]
    const adjacent = ingredients[target]
    if (!current || !adjacent) return
    ingredients[index] = adjacent
    ingredients[target] = current
    set({ ingredients })
  }
  const toggleContains = (code: AllergenCode) => set({
    contains: s.contains.includes(code) ? s.contains.filter((x) => x !== code) : [...s.contains, code],
    traces: s.traces.filter((x) => x !== code),
  })
  const toggleTrace = (code: AllergenCode) => {
    if (s.contains.includes(code)) return
    set({ traces: s.traces.includes(code) ? s.traces.filter((x) => x !== code) : [...s.traces, code] })
  }
  const ingredientCount = s.ingredients.filter((i) => i.name.trim()).length

  return (
    <>
      <NSection first={firstBorderless} title="İçindekiler ve enerji"
        right={ingredientCount > 0 ? <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontFamily: "'Geist Mono', monospace" }}>{ingredientCount} bileşen</span> : undefined}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {s.ingredients.map((ing, index) => (
            <div key={ing.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--text-4)', flexShrink: 0, display: 'flex' }} aria-hidden="true">{icDrag}</span>
              <input value={ing.name} onChange={(e) => updIng(ing.id, { name: e.target.value })} placeholder="Bileşen adı"
                style={{ flex: 1, minWidth: 0, height: 32, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', fontSize: 12.5, background: 'var(--surface)', fontFamily: 'inherit' }} />
              <input value={ing.amount} maxLength={40} onChange={(e) => updIng(ing.id, { amount: e.target.value })} placeholder="miktar"
                style={{ width: 64, flexShrink: 0, height: 32, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 8, outline: 'none', fontSize: 12, textAlign: 'center', background: 'var(--surface)', color: 'var(--text-2)', fontFamily: 'inherit' }} />
              <button type="button" title="Müşteri çıkarabilir" onClick={() => updIng(ing.id, { removable: !ing.removable })}
                style={{ width: 30, height: 32, flexShrink: 0, borderRadius: 7, fontSize: 9.5, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (ing.removable ? 'var(--accent)' : 'var(--border)'), background: ing.removable ? 'var(--accent-soft)' : 'var(--surface)', color: ing.removable ? 'var(--accent)' : 'var(--text-4)' }}>çıkar</button>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button
                  type="button"
                  aria-label={`${ing.name.trim() || `Bileşen ${index + 1}`} yukarı taşı`}
                  disabled={index === 0}
                  onClick={() => moveIng(index, -1)}
                  style={{ width: 24, height: 15, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-2)', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.35 : 1, fontSize: 10, lineHeight: 1 }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`${ing.name.trim() || `Bileşen ${index + 1}`} aşağı taşı`}
                  disabled={index === s.ingredients.length - 1}
                  onClick={() => moveIng(index, 1)}
                  style={{ width: 24, height: 15, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-2)', cursor: index === s.ingredients.length - 1 ? 'default' : 'pointer', opacity: index === s.ingredients.length - 1 ? 0.35 : 1, fontSize: 10, lineHeight: 1 }}
                >
                  ↓
                </button>
              </span>
              <button type="button" onClick={() => rmIng(ing.id)} disabled={s.ingredients.length <= 1}
                style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 7, display: 'grid', placeItems: 'center', color: s.ingredients.length > 1 ? 'var(--text-3)' : 'var(--text-4)', background: 'transparent', border: 'none', cursor: s.ingredients.length > 1 ? 'pointer' : 'default', opacity: s.ingredients.length > 1 ? 1 : 0.4 }}>{icX}</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addIng} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '7px 11px', fontSize: 11.5, fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-soft)', border: 'none', borderRadius: 8, cursor: 'pointer' }}>{icPlus}Bileşen ekle</button>

        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <MacroInput label="Enerji" value={s.energyKcal} onChange={(v) => set({ energyKcal: v })} suffix="kcal" accent />
          <MacroInput label="Protein" value={s.protein} onChange={(v) => set({ protein: v })} suffix="g" />
          <MacroInput label="Karbon." value={s.carb} onChange={(v) => set({ carb: v })} suffix="g" />
          <MacroInput label="Yağ" value={s.fat} onChange={(v) => set({ fat: v })} suffix="g" />
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 7 }}>Porsiyon başına. Enerji müşteriye gösterilir; makrolar işletme içi kalır.</div>
      </NSection>

      <NSection title="Alerjenler"
        right={s.contains.length > 0 ? <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--warning)', background: 'var(--warning-bg)', padding: '2px 8px', borderRadius: 999 }}>{s.contains.length} içerir</span> : undefined}>
        <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600, marginBottom: 7 }}>İçerir</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALLERGEN_CODES.map((code) => (
            <AllergenChip key={code} code={code} variant="contains" on={s.contains.includes(code)} onClick={() => toggleContains(code)} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 7 }}>
          <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>Eser miktar</span>
          <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>· olası çapraz temas</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALLERGEN_CODES.filter((code) => !s.contains.includes(code)).map((code) => (
            <AllergenChip key={code} code={code} variant="trace" on={s.traces.includes(code)} onClick={() => toggleTrace(code)} />
          ))}
        </div>
      </NSection>

      <NSection title="Özel içerik & diyet">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <FlagRow tone="critical" on={s.alcohol} onToggle={() => set({ alcohol: !s.alcohol })}
            icon={flagIcon(<path d="M8 22h8M12 15v7M5 3h14l-6 10H11L5 3ZM7.5 7h9" />)} label="Alkol içerir" desc="Müşteri detayında içerik uyarısı gösterilir" />
          <FlagRow tone="critical" on={s.pork} onToggle={() => set({ pork: !s.pork })}
            icon={flagIcon(<path d="M5 11a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5v-2ZM3 10l2 1M21 10l-2 1M11 12h.01M15 12h.01" />)} label="Domuz kaynaklı bileşen içerir" desc="Helal beyanıyla birlikte seçilemez" />
          <FlagRow tone="positive" on={s.vegetarian} onToggle={() => set({ vegetarian: !s.vegetarian, vegan: false })}
            icon={flagIcon(<path d="M5 19c8 1 14-5 14-14C11 4 5 11 5 19ZM9 15c2-3 4-5 7-6" />)} label="Vejetaryen" desc="Et içermez" />
          <FlagRow tone="positive" on={s.vegan} onToggle={() => set({ vegan: !s.vegan, vegetarian: s.vegan ? s.vegetarian : true })}
            icon={flagIcon(<path d="M5 19c8 1 14-5 14-14C11 4 5 11 5 19Z" />)} label="Vegan" desc="Hayvansal ürün içermez" />
          <FlagRow tone="accent" on={s.halal} onToggle={() => set({ halal: !s.halal })}
            icon={flagIcon(<path d="M12 3 4 7v5c0 4 3.5 7 8 9 4.5-2 8-5 8-9V7l-8-4ZM9 12l2 2 4-4" />)} label="Helal onaylı" desc="İşletmenin ürün beyanıdır" />
        </div>
      </NSection>

      <NSection title="Kontrol">
        <button type="button" onClick={() => set({ reviewed: !s.reviewed })} style={{
          display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '12px 13px', borderRadius: 12, cursor: 'pointer',
          background: s.reviewed ? 'var(--positive-bg)' : 'var(--surface-2)', border: '1px solid ' + (s.reviewed ? 'transparent' : 'var(--border)'),
        }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, border: '2px solid ' + (s.reviewed ? 'var(--positive)' : 'var(--border-strong)'), background: s.reviewed ? 'var(--positive)' : 'transparent', color: '#fff', display: 'grid', placeItems: 'center' }}>{s.reviewed && icCheck(13)}</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: s.reviewed ? 'var(--positive)' : 'var(--text)' }}>İçerik, enerji ve alerjen bilgilerini gözden geçirdim</span>
            <span style={{ display: 'block', fontSize: 11, color: s.reviewed ? 'var(--positive)' : 'var(--text-3)', marginTop: 1 }}>{s.reviewed ? 'Onaylandı' : 'İşletme beyanını kaydeder'}</span>
          </span>
        </button>
      </NSection>
    </>
  )
}

export function NutritionStatusPill({ s }: { s: NutritionState }) {
  const done = nutritionComplete(s)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: done ? 'var(--positive-bg)' : 'var(--warning-bg)', color: done ? 'var(--positive)' : 'var(--warning)' }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: done ? 'var(--positive)' : 'var(--warning)' }} />
      {done ? 'Bilgi tam' : 'Bilgi eksik'}
    </span>
  )
}
