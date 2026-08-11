'use client'

import React, { createContext, useContext, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Field as ShadcnField, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Slider as SliderPrimitive } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

const MONO_STYLE = {
  fontFamily: "'Geist Mono', ui-monospace, monospace",
  fontVariantNumeric: 'tabular-nums' as const,
}

const FieldContext = createContext<{ labelledBy: string; label: string } | null>(null)

function useFieldAccessibility() {
  return useContext(FieldContext)
}

export function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'positive' }) {
  return <Badge variant={tone === 'positive' ? 'positive' : 'secondary'}>{children}</Badge>
}

export function Group({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-b">
      <CollapsibleTrigger render={<Button type="button" variant="ghost" className="h-11 w-full justify-between rounded-none px-4" />}>
        {title}<ChevronDown className={cn("transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent><div className="px-4 pb-4 pt-0.5">{children}</div></CollapsibleContent>
    </Collapsible>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <ShadcnField orientation="horizontal" className="tb-qr-field grid grid-cols-[90px_minmax(0,1fr)] items-center py-1.5">
      <FieldContent>
        <FieldLabel id={id}>{label}</FieldLabel>
        {hint && <FieldDescription>{hint}</FieldDescription>}
      </FieldContent>
      <FieldContext.Provider value={{ labelledBy: id, label }}><div className="min-w-0">{children}</div></FieldContext.Provider>
    </ShadcnField>
  )
}

export function Slider({ value, min, max, step = 1, onChange, onBegin, suffix }: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number, transient: boolean) => void
  onBegin?: () => void
  suffix?: string
}) {
  const dragging = useRef(false)
  const field = useFieldAccessibility()
  return (
    <div className="flex items-center gap-2">
      <SliderPrimitive
        aria-labelledby={field?.labelledBy}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onPointerDown={() => { dragging.current = true; onBegin?.() }}
        onPointerUp={() => { dragging.current = false }}
        onPointerCancel={() => { dragging.current = false }}
        onBlur={() => { dragging.current = false }}
        onValueChange={values => onChange((Array.isArray(values) ? values[0] : values) ?? value, dragging.current)}
      />
      <span className="min-w-10 text-right font-mono text-xs tabular-nums text-muted-foreground">{value}{suffix}</span>
    </div>
  )
}

export function Segmented({ value, onChange, options }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  const field = useFieldAccessibility()
  return (
    <ToggleGroup value={[value]} onValueChange={values => { const next = values[0]; if (next) onChange(next) }} spacing={1} size="sm" className="grid w-full grid-flow-col" aria-labelledby={field?.labelledBy}>
      {options.map(option => (
        <ToggleGroupItem key={option.value} value={option.value}>{option.label}</ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function ColorField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const field = useFieldAccessibility()
  return (
    <div className="flex items-center gap-2">
      <label className="relative grid size-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md border">
        <span aria-hidden="true" className="size-full" style={{ background: value }} />
        <input aria-label={`${field?.label ?? 'QR'} renk seçici`} type="color" value={value} onChange={event => onChange(event.target.value)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
      </label>
      <Input aria-label={`${field?.label ?? 'QR'} hex renk değeri`} value={value} onChange={event => onChange(event.target.value)} className="min-w-0 flex-1 font-mono" />
    </div>
  )
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (value: boolean) => void }) {
  const field = useFieldAccessibility()
  return <Switch aria-labelledby={field?.labelledBy} checked={on} onCheckedChange={onChange} />
}

export function TextInput({ value, onChange, placeholder, prefix }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  prefix?: React.ReactNode
}) {
  const field = useFieldAccessibility()
  return (
    <InputGroup>
      {prefix && <InputGroupAddon>{prefix}</InputGroupAddon>}
      <InputGroupInput aria-labelledby={field?.labelledBy} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </InputGroup>
  )
}

export function Swatches({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return (
    <ToggleGroup value={[value]} onValueChange={values => { const next = values[0]; if (next) onChange(next) }} spacing={1} className="flex-wrap" aria-label={label}>
      {options.map(color => (
        <ToggleGroupItem key={color} value={color} aria-label={`${color} rengini seç`} className="size-8 p-1">
          <span className="size-full rounded-sm border" style={{ background: color }} />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function StylePicker({ value, onChange, options, renderPreview, label }: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  renderPreview: (value: string) => React.ReactNode
  label: string
}) {
  return (
    <ToggleGroup value={[value]} onValueChange={values => { const next = values[0]; if (next) onChange(next) }} spacing={2} className="grid w-full grid-cols-3" aria-label={label}>
      {options.map(option => (
        <ToggleGroupItem key={option.value} value={option.value} className="h-auto min-w-0 flex-col gap-1.5 py-2.5">
          <span className="grid size-10 place-items-center">{renderPreview(option.value)}</span>
          <span className="truncate text-xs">{option.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function DotPreview({ kind }: { kind: string }) {
  const cells = [[1, 1, 0, 1], [1, 0, 1, 1], [0, 1, 1, 0], [1, 1, 0, 1]]
  const size = 8
  const gap = 1.2
  return (
    <svg width="40" height="40" viewBox="0 0 40 40">
      {cells.flatMap((row, y) => row.map((value, x) => {
        if (!value) return null
        const cx = 4 + x * (size + gap) + size / 2
        const cy = 4 + y * (size + gap) + size / 2
        if (kind === 'dots') return <circle key={`${x}-${y}`} cx={cx} cy={cy} r={size / 2 - 0.4} fill="#111113" />
        if (kind === 'rounded') return <rect key={`${x}-${y}`} x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx="2" fill="#111113" />
        if (kind === 'extra-rounded') return <rect key={`${x}-${y}`} x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx="3.5" fill="#111113" />
        if (kind === 'classy') return <path key={`${x}-${y}`} d={`M${cx - size / 2} ${cy - size / 2}h${size}v${size}h-${size / 2}a${size / 2} ${size / 2} 0 0 1-${size / 2} -${size / 2}Z`} fill="#111113" />
        if (kind === 'classy-rounded') return <path key={`${x}-${y}`} d={`M${cx - size / 2 + 2} ${cy - size / 2}h${size - 2}q2 0 2 2v${size - 2}h-${size - 2}q-2 0-2-2Z`} fill="#111113" />
        return <rect key={`${x}-${y}`} x={cx - size / 2} y={cy - size / 2} width={size} height={size} fill="#111113" />
      }))}
    </svg>
  )
}

export function EyeFramePreview({ kind }: { kind: string }) {
  const radius = kind === 'extra-rounded' ? 8 : kind === 'dot' ? 18 : 0
  return <svg width="40" height="40" viewBox="0 0 40 40"><rect x="3" y="3" width="34" height="34" rx={radius} fill="none" stroke="#111113" strokeWidth="6" /></svg>
}

export function EyeBallPreview({ kind }: { kind: string }) {
  if (kind === 'dot') return <svg width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="11" fill="#111113" /></svg>
  return <svg width="40" height="40" viewBox="0 0 40 40"><rect x="9" y="9" width="22" height="22" fill="#111113" /></svg>
}

export function FramePreview({ kind }: { kind: string }) {
  if (kind === 'none') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="14" y="6" width="16" height="20" fill="#cbcdd3" rx="2" /></svg>
  if (kind === 'card') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="6" y="3" width="32" height="26" fill="#fff" stroke="#111113" strokeWidth="1.4" rx="3" /><rect x="14" y="7" width="16" height="16" fill="#111113" rx="1" /></svg>
  if (kind === 'banner') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="3" y="3" width="38" height="26" fill="#111113" rx="3" /><rect x="14" y="6" width="16" height="16" fill="#fff" rx="1" /><rect x="11" y="24" width="22" height="2.5" fill="#fff" rx="1" /></svg>
  if (kind === 'speech') return <svg width="44" height="32" viewBox="0 0 44 32"><path d="M5 5h34v18H26l-3 4-3-4H5z" fill="#fff" stroke="#111113" strokeWidth="1.4" /><rect x="14" y="8" width="16" height="12" fill="#111113" rx="1" /></svg>
  if (kind === 'phone') return <svg width="44" height="32" viewBox="0 0 44 32"><rect x="14" y="2" width="16" height="28" fill="#fff" stroke="#111113" strokeWidth="1.4" rx="3" /><rect x="17" y="7" width="10" height="10" fill="#111113" rx="1" /><circle cx="22" cy="26" r="1.2" fill="#111113" /></svg>
  return null
}

export { MONO_STYLE }
