'use client'

import { useState } from 'react'

export interface ModifierOption {
  name: string
  price_delta: number
}

export interface ModifierGroup {
  name: string
  required: boolean
  options: ModifierOption[]
}

interface Props {
  value: ModifierGroup[]
  onChange: (groups: ModifierGroup[]) => void
}

const sm: React.CSSProperties = {
  height: 30, padding: '0 8px', border: '1px solid var(--border)',
  borderRadius: 6, background: 'var(--surface)',
  color: 'var(--text)', fontSize: 12.5, outline: 'none',
  boxSizing: 'border-box',
}

export default function ModifierGroupBuilder({ value, onChange }: Props) {
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set())

  function toggleOpen(i: number) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function addGroup() {
    const next = [...value, { name: '', required: false, options: [] }]
    onChange(next)
    setOpenGroups(prev => new Set([...prev, next.length - 1]))
  }

  function updateGroup(index: number, updates: Partial<ModifierGroup>) {
    onChange(value.map((g, i) => (i === index ? { ...g, ...updates } : g)))
  }

  function removeGroup(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function addOption(groupIndex: number) {
    const group = value[groupIndex]
    if (!group) return
    updateGroup(groupIndex, { options: [...group.options, { name: '', price_delta: 0 }] })
  }

  function updateOption(groupIndex: number, optIndex: number, updates: Partial<ModifierOption>) {
    const group = value[groupIndex]
    if (!group) return
    updateGroup(groupIndex, {
      options: group.options.map((o, i) => (i === optIndex ? { ...o, ...updates } : o)),
    })
  }

  function removeOption(groupIndex: number, optIndex: number) {
    const group = value[groupIndex]
    if (!group) return
    updateGroup(groupIndex, { options: group.options.filter((_, i) => i !== optIndex) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {value.map((group, gi) => (
        <div key={gi} style={{
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--surface-2)', overflow: 'hidden',
        }}>
          {/* Group header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 8px', borderBottom: openGroups.has(gi) ? '1px solid var(--divider)' : 'none',
          }}>
            <button
              type="button"
              onClick={() => toggleOpen(gi)}
              style={{
                width: 18, height: 18, border: 'none', background: 'transparent',
                color: 'var(--text-3)', cursor: 'pointer', fontSize: 11, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
              }}
            >
              {openGroups.has(gi) ? '▾' : '▸'}
            </button>
            <input
              type="text"
              placeholder="Grup adı (ör. Boyut, Ekstralar)"
              value={group.name}
              onChange={(e) => updateGroup(gi, { name: e.target.value })}
              style={{ ...sm, flex: 1 }}
            />
            <label style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11.5, color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0,
            }}>
              <input
                type="checkbox"
                checked={group.required}
                onChange={(e) => updateGroup(gi, { required: e.target.checked })}
                style={{ margin: 0 }}
              />
              Zorunlu
            </label>
            <button
              type="button"
              onClick={() => removeGroup(gi)}
              style={{
                height: 22, padding: '0 7px', border: '1px solid var(--critical-bg)',
                background: 'var(--critical-bg)', color: 'var(--critical)',
                borderRadius: 5, fontSize: 11, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Sil
            </button>
          </div>

          {/* Options */}
          {openGroups.has(gi) && (
            <div style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {group.options.map((opt, oi) => (
                <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <input
                    type="text"
                    placeholder="Seçenek adı"
                    value={opt.name}
                    onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                    style={{ ...sm, flex: 1 }}
                  />
                  <input
                    type="number"
                    placeholder="+₺0"
                    value={opt.price_delta}
                    min={0}
                    step={0.5}
                    onChange={(e) => updateOption(gi, oi, { price_delta: Number(e.target.value) })}
                    style={{ ...sm, width: 72 }}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(gi, oi)}
                    style={{
                      width: 22, height: 22, border: 'none', background: 'transparent',
                      color: 'var(--text-4)', cursor: 'pointer', fontSize: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOption(gi)}
                style={{
                  marginTop: 2, height: 27, border: 'none', background: 'transparent',
                  color: 'var(--text-3)', fontSize: 12, cursor: 'pointer',
                  textAlign: 'left', padding: '0 2px',
                }}
              >
                + Seçenek ekle
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addGroup}
        style={{
          height: 32, border: '1px dashed var(--border-strong)',
          background: 'transparent', color: 'var(--text-3)',
          borderRadius: 7, fontSize: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}
      >
        + Modifier grubu ekle
      </button>
    </div>
  )
}
