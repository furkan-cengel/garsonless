'use client'

import type { ThemeEditorSurface } from '@garsonless/design-engine'
import { I, type Icon } from '../../lib/ui'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'

const SURFACES: Array<{ id: ThemeEditorSurface; label: string; description: string; icon: Icon }> = [
  { id: 'home', label: 'Ana sayfa', description: 'Karşılama ve marka hikâyesi', icon: I.home },
  { id: 'menu', label: 'Menü', description: 'Kategori ve ürün deneyimi', icon: I.cutlery },
  { id: 'auth', label: 'Giriş', description: 'Üyelik, OTP ve OAuth', icon: I.userCircle },
  { id: 'checkout', label: 'Checkout', description: 'Sepet ve ödeme akışı', icon: I.receipt },
]

const SURFACE_ITEMS = SURFACES.map((surface) => ({ value: surface.id, label: surface.label }))

export function ThemeExperienceSurfaceSelector({
  value,
  homeEnabled,
  onChange,
}: {
  value: ThemeEditorSurface
  homeEnabled: boolean
  onChange: (surface: ThemeEditorSurface) => void
}) {
  const active = SURFACES.find((surface) => surface.id === value) ?? SURFACES[1]!
  const ActiveIcon = active.icon

  return (
    <Select items={SURFACE_ITEMS} value={value} onValueChange={(next) => { if (next) onChange(next as ThemeEditorSurface) }}>
      <SelectTrigger data-theme-surface-trigger data-theme-surface-selector className="h-9 min-w-40 border-transparent font-semibold">
        <ActiveIcon />
        <SelectValue>{active.label}</SelectValue>
        {value === 'home' && !homeEnabled && <Badge variant="secondary">Kapalı</Badge>}
      </SelectTrigger>
      <SelectContent align="center" className="w-72">
        <SelectGroup>
          <SelectLabel>Müşteri deneyimi</SelectLabel>
          {SURFACES.map((surface) => {
            const Icon = surface.icon
            return (
              <SelectItem key={surface.id} value={surface.id} className="py-2">
                <Icon />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 font-medium">
                    {surface.label}
                    {surface.id === 'home' && !homeEnabled && <Badge variant="secondary">Kapalı</Badge>}
                  </span>
                  <span className="text-xs text-muted-foreground">{surface.description}</span>
                </span>
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
