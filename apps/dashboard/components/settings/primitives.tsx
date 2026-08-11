'use client'

import { cloneElement, isValidElement, useId, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '../ui/field'
import { Switch } from '../ui/switch'

export function inputStyle(overrides?: CSSProperties): CSSProperties {
  return {
    height: 30, padding: '0 10px',
    border: '1px solid var(--border-strong)', borderRadius: 6,
    background: 'var(--surface)', fontSize: 12.5, outline: 'none',
    color: 'var(--text)', fontFamily: 'inherit',
    ...overrides,
  }
}

// Controlled when `onChange` is provided (the parent owns the value); otherwise
// falls back to internal state (back-compat for display-only toggles).
export function Toggle({ on: initialOn, onChange, disabled, ariaLabel = 'Ayarı aç veya kapat' }: { on?: boolean; onChange?: (v: boolean) => void; disabled?: boolean; ariaLabel?: string }) {
  const [internal, setInternal] = useState(initialOn ?? false)
  const on = onChange ? (initialOn ?? false) : internal
  return (
    <Switch
      checked={on}
      disabled={disabled}
      aria-label={ariaLabel}
      onCheckedChange={(checked) => {
        if (onChange) onChange(checked)
        else setInternal(checked)
      }}
    />
  )
}

export function SCard({ title, subtitle, children, footer, style }: {
  title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; style?: CSSProperties
}) {
  return (
    <Card size="sm" className="gap-0 py-0" style={style}>
      <CardHeader className="border-b py-3">
        <CardTitle>{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
      {footer && <CardFooter className="flex-wrap justify-between gap-3">{footer}</CardFooter>}
    </Card>
  )
}

export function FormRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const generatedControlId = useId()
  const hintId = useId()
  const nativeControl = isValidElement(children)
    && typeof children.type === 'string'
    && ['input', 'select', 'textarea'].includes(children.type)
  const componentControl = isValidElement(children)
    && typeof children.type !== 'string'
    && 'value' in (children.props as Record<string, unknown>)
  const labelledControl = nativeControl || componentControl
  const control = labelledControl
    ? cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
      id: (children.props as { id?: string }).id ?? generatedControlId,
      'aria-describedby': [
        (children.props as { 'aria-describedby'?: string })['aria-describedby'],
        hint ? hintId : undefined,
      ].filter(Boolean).join(' ') || undefined,
    })
    : children
  const controlId = labelledControl
    ? ((children.props as { id?: string }).id ?? generatedControlId)
    : undefined

  return (
    <Field orientation="horizontal" className="flex-wrap border-b px-4 py-3 last:border-b-0 sm:flex-nowrap">
      <FieldContent className="min-w-0">
        {controlId
          ? <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
          : <FieldTitle>{label}</FieldTitle>}
        {hint && <FieldDescription id={hintId}>{hint}</FieldDescription>}
      </FieldContent>
      <div className="w-full min-w-0 sm:w-auto sm:flex-none">{control}</div>
    </Field>
  )
}
