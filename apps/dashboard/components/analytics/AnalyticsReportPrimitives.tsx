import type { CSSProperties, ReactNode } from 'react'
import { Badge } from '../ui/badge'
import {
  Card as UiCard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'

const mono = { fontFamily: "'Geist Mono', ui-monospace, monospace" } as CSSProperties

export function AnalyticsKpi({
  label,
  value,
  delta,
  down,
  direction,
  tone,
  hint,
}: {
  label: string
  value: string
  delta: string
  down?: boolean
  direction?: 'up' | 'down' | 'flat'
  tone?: 'positive' | 'critical' | 'neutral'
  hint?: string
}) {
  const resolvedTone = tone ?? (down === undefined ? 'neutral' : down ? 'critical' : 'positive')
  const resolvedDirection = direction ?? (delta === '—' || down === undefined ? 'flat' : down ? 'down' : 'up')
  const neutral = resolvedTone === 'neutral'
  const positive = resolvedTone === 'positive'
  return (
    <UiCard size="sm">
      <CardHeader className="gap-1">
        <CardDescription className="text-[11px] font-medium uppercase tracking-[0.05em]">{label}</CardDescription>
        <CardTitle style={mono} className="text-2xl font-bold tracking-tight tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-5 items-center gap-1.5">
        <Badge variant={neutral ? 'secondary' : positive ? 'positive' : 'destructive'}>
          {resolvedDirection === 'up' ? '↑ ' : resolvedDirection === 'down' ? '↓ ' : ''}{delta}
        </Badge>
        {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
      </CardContent>
    </UiCard>
  )
}

export function AnalyticsCard({
  title,
  subtitle,
  children,
  style,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <UiCard size="sm" className="gap-0 py-0" style={style}>
      <CardHeader className="border-b py-3">
        <CardTitle>{title}</CardTitle>
        {subtitle && <CardDescription className="text-xs">{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </UiCard>
  )
}
