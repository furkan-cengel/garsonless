'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ALLERGEN_CODES,
  ALLERGEN_LABELS,
  type AllergenCode,
  type MenuModifierGroup as ModifierGroup,
  type MenuModifierOption as ModifierOption,
} from '@garsonless/db/browser'
import { I } from '../../lib/ui'

function AllergenPicker({
  value,
  onChange,
  label = 'Alerjen ekle',
}: {
  value: AllergenCode[]
  onChange: (value: AllergenCode[]) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function toggle(code: AllergenCode) {
    onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code])
  }

  function toggleOpen() {
    if (!open) {
      const rect = rootRef.current?.getBoundingClientRect()
      setDropUp(Boolean(rect && rect.bottom + 245 > window.innerHeight - 12))
    }
    setOpen((current) => !current)
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', minWidth: 0 }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        style={{
          width: '100%', minHeight: 34, padding: value.length > 0 ? '5px 8px' : '0 10px',
          border: `1px solid ${open ? 'var(--text)' : 'var(--divider)'}`,
          borderRadius: 7, background: 'var(--surface)', color: 'var(--text)',
          display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
          cursor: 'pointer', boxShadow: open ? '0 0 0 2px rgba(17,17,19,.06)' : 'none',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {value.length === 0 ? (
            <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{label}</span>
          ) : value.map((code) => (
            <span key={code} style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              maxWidth: '100%', padding: '2px 6px', borderRadius: 5,
              background: 'var(--warning-bg)', color: 'var(--warning)',
              fontSize: 10.5, fontWeight: 600,
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ALLERGEN_LABELS[code]}</span>
              <span
                role="button"
                aria-label={`${ALLERGEN_LABELS[code]} seçimini kaldır`}
                onClick={(event) => { event.stopPropagation(); toggle(code) }}
                style={{ display: 'inline-flex', cursor: 'pointer', flexShrink: 0 }}
              >
                <I.close size={10} />
              </span>
            </span>
          ))}
        </span>
        <I.chevDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          style={{
            position: 'absolute', zIndex: 50, left: 0, right: 0,
            ...(dropUp ? { bottom: 'calc(100% + 5px)' } : { top: 'calc(100% + 5px)' }),
            maxHeight: 238, overflowY: 'auto', padding: 5,
            border: '1px solid var(--border-strong)', borderRadius: 8,
            background: 'var(--surface)', boxShadow: 'var(--shadow-pop)',
          }}
        >
          {ALLERGEN_CODES.map((code) => {
            const selected = value.includes(code)
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggle(code)}
                style={{
                  width: '100%', minHeight: 32, padding: '6px 8px',
                  border: 'none', borderRadius: 5, background: selected ? 'var(--surface-inset)' : 'transparent',
                  color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8,
                  textAlign: 'left', cursor: 'pointer', fontSize: 11.5,
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `1px solid ${selected ? 'var(--text)' : 'var(--border-strong)'}`,
                  background: selected ? 'var(--text)' : 'var(--surface)',
                  color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <I.check size={10} strokeWidth={3} />}
                </span>
                <span>{ALLERGEN_LABELS[code]}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function MenuModifierGroupEditor({
  groups,
  onChange,
}: {
  groups: ModifierGroup[]
  onChange: (groups: ModifierGroup[]) => void
}) {
  const inputSm: CSSProperties = {
    padding: '4px 8px', borderRadius: 5, border: '1px solid var(--divider)',
    background: 'var(--surface)', color: 'var(--text)', fontSize: 12, outline: 'none',
  }

  function addGroup() {
    onChange([...groups, {
      id: crypto.randomUUID(),
      name: '',
      selection_mode: 'multiple',
      required: false,
      min: 0,
      max: 1,
      options: [],
    }])
  }

  function deleteGroup(groupId: string) {
    onChange(groups.filter((group) => group.id !== groupId))
  }

  function updateGroup(groupId: string, patch: Partial<Omit<ModifierGroup, 'id' | 'options'>>) {
    onChange(groups.map((group) => group.id === groupId ? { ...group, ...patch } : group))
  }

  function addOption(groupId: string) {
    onChange(groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            max: Math.max(group.max, group.options.length + 1),
            options: [...group.options, {
              id: crypto.randomUUID(),
              name: '',
              price_delta: 0,
              calorie_delta: 0,
              is_default: false,
              allergen_codes: [],
            }],
          }
        : group,
    ))
  }

  function deleteOption(groupId: string, optionId: string) {
    onChange(groups.map((group) =>
      group.id === groupId
        ? { ...group, options: group.options.filter((option) => option.id !== optionId) }
        : group,
    ))
  }

  function updateOption(groupId: string, optionId: string, patch: Partial<Omit<ModifierOption, 'id'>>) {
    onChange(groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            options: group.options.map((option) => option.id === optionId ? { ...option, ...patch } : option),
          }
        : group,
    ))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {groups.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', paddingBottom: 4 }}>Henüz varyant grubu yok</div>
      )}

      {groups.map((group, groupIndex) => (
        <div key={group.id} style={{
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--surface-2)', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 7,
            padding: '8px 10px', borderBottom: group.options.length > 0 ? '1px solid var(--divider)' : 'none',
            background: 'var(--surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <input
                value={group.name}
                onChange={(event) => updateGroup(group.id, { name: event.target.value })}
                placeholder={`Grup ${groupIndex + 1} adı`}
                style={{ ...inputSm, flex: 1, minWidth: 0, height: 32, fontWeight: 600 }}
              />
              <button
                type="button"
                onClick={() => deleteGroup(group.id)}
                style={{
                  width: 30, height: 30, border: '1px solid var(--critical-bg)', borderRadius: 6, cursor: 'pointer',
                  background: 'var(--surface)', color: 'var(--critical)', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Grubu sil"
              >
                <I.trash size={13} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 6, alignItems: 'center' }}>
              <select
                value={group.selection_mode}
                onChange={(event) => updateGroup(group.id, {
                  selection_mode: event.target.value as ModifierGroup['selection_mode'],
                  max: event.target.value === 'single' ? 1 : Math.max(group.max, 1),
                })}
                style={{ ...inputSm, width: '100%', height: 30 }}
              >
                <option value="single">Tek seçim</option>
                <option value="multiple">Çoklu seçim</option>
                <option value="quantity">Adetli seçim</option>
              </select>
              <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 6, padding: 2, gap: 1 }}>
                {([true, false] as const).map((required) => (
                  <button
                    key={String(required)}
                    type="button"
                    onClick={() => updateGroup(group.id, {
                      required,
                      min: required ? Math.max(1, group.min) : 0,
                    })}
                    style={{
                      height: 24, padding: '0 7px', fontSize: 10, fontWeight: 600, borderRadius: 4,
                      border: 'none', cursor: 'pointer',
                      background: group.required === required ? 'var(--surface)' : 'transparent',
                      color: group.required === required ? 'var(--text)' : 'var(--text-3)',
                      boxShadow: group.required === required ? 'var(--shadow-1)' : 'none',
                    }}
                  >
                    {required ? 'Zorunlu' : 'Opsiyonel'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
                En az
                <input type="number" min={0} value={group.min} onChange={(event) => updateGroup(group.id, { min: Math.max(0, Number(event.target.value)) })} style={{ ...inputSm, width: '100%', height: 30, marginTop: 3 }} />
              </label>
              <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
                En fazla
                <input type="number" min={1} value={group.max} onChange={(event) => updateGroup(group.id, { max: Math.max(1, Number(event.target.value)) })} style={{ ...inputSm, width: '100%', height: 30, marginTop: 3 }} />
              </label>
            </div>
            {group.options.map((option) => (
              <div key={option.id} style={{
                padding: 8, border: '1px solid var(--divider)', borderRadius: 7,
                background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 7,
                minWidth: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                  <input
                    value={option.name}
                    onChange={(event) => updateOption(group.id, option.id, { name: event.target.value })}
                    placeholder="İşletmenin ekleyeceği seçenek"
                    style={{ ...inputSm, flex: 1, minWidth: 0, height: 31 }}
                  />
                  <button
                    type="button"
                    onClick={() => deleteOption(group.id, option.id)}
                    style={{
                      width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer',
                      background: 'var(--critical-bg)', color: 'var(--critical)', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    aria-label="Seçeneği sil"
                  >
                    <I.trash size={12} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    Fiyat farkı
                    <input
                      aria-label="Fiyat farkı"
                      type="number" min={0} value={option.price_delta}
                      onChange={(event) => updateOption(group.id, option.id, { price_delta: Math.max(0, Number(event.target.value)) })}
                      style={{ ...inputSm, width: '100%', height: 30, marginTop: 3, fontFamily: "'Geist Mono', monospace" }}
                    />
                  </label>
                  <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
                    Kalori farkı
                    <input
                      aria-label="Kalori farkı"
                      type="number" value={option.calorie_delta}
                      onChange={(event) => updateOption(group.id, option.id, { calorie_delta: Math.round(Number(event.target.value)) })}
                      style={{ ...inputSm, width: '100%', height: 30, marginTop: 3, fontFamily: "'Geist Mono', monospace" }}
                    />
                  </label>
                </div>
                <AllergenPicker
                  value={option.allergen_codes}
                  onChange={(codes) => updateOption(group.id, option.id, { allergen_codes: codes })}
                  label="Bu seçeneğe alerjen ekle"
                />
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: 'var(--text-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={option.is_default}
                    onChange={(event) => updateOption(group.id, option.id, { is_default: event.target.checked })}
                  />
                  Varsayılan seçenek
                </label>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addOption(group.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '4px 6px',
                border: '1px dashed var(--border)', background: 'transparent',
                color: 'var(--text-3)', borderRadius: 5, cursor: 'pointer',
                fontSize: 11.5, fontWeight: 500, marginTop: 2,
              }}
            >
              <I.plus size={10} />Seçenek ekle
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px',
          border: '1px dashed var(--border-strong)', background: 'transparent',
          color: 'var(--text-2)', borderRadius: 7, cursor: 'pointer',
          fontSize: 12.5, fontWeight: 500,
        }}
      >
        <I.plus size={13} />Yeni grup ekle
      </button>
    </div>
  )
}
