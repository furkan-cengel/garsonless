'use client'

import type { ThemeEditorSurface } from '@garsonless/design-engine'
import { I, type Icon } from '../../lib/ui'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'

const SURFACES: Array<{ id: ThemeEditorSurface; label: string; description: string; icon: Icon }> = [
  { id: 'home', label: 'Ana sayfa', description: 'Karşılama ve marka hikâyesi', icon: I.home },
  { id: 'menu', label: 'Menü', description: 'Kategori ve ürün deneyimi', icon: I.menuDish },
  { id: 'auth', label: 'Giriş', description: 'Üyelik, OTP ve OAuth', icon: I.userCircle },
  { id: 'account', label: 'Masabu Hesabım', description: 'Profil, sipariş ve sadakat', icon: I.userCircle },
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
      <SelectTrigger data-theme-surface-trigger data-theme-surface-selector className="h-9 min-w-40 border-transparent font-medium">
        <ActiveIcon className={`theme-surface-icon${active.id === 'menu' ? ' theme-surface-menu-dish' : ''}`} />
        <SelectValue>{active.label}</SelectValue>
        {value === 'home' && !homeEnabled && <Badge variant="secondary">Kapalı</Badge>}
      </SelectTrigger>
      <SelectContent align="center" className="w-72">
        <SelectGroup>
          <SelectLabel>Müşteri deneyimi</SelectLabel>
          {SURFACES.map((surface) => {
            const Icon = surface.icon
            return (
              <SelectItem key={surface.id} value={surface.id} data-theme-surface-option className="group/surface-option py-2">
                <Icon className={`theme-surface-icon${surface.id === 'menu' ? ' theme-surface-menu-dish' : ''}`} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="theme-surface-label flex items-center gap-2 font-medium">
                    {surface.label}
                    {surface.id === 'home' && !homeEnabled && (
                      <Badge variant="secondary" className="group-focus/surface-option:bg-background group-focus/surface-option:text-foreground!">
                        Kapalı
                      </Badge>
                    )}
                  </span>
                  <span className="theme-surface-description text-xs text-muted-foreground">{surface.description}</span>
                </span>
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
      <style>{`
        .theme-surface-icon {
          color: var(--text-2) !important;
        }
        .theme-surface-menu-dish {
          color: inherit;
        }
        .theme-surface-menu-dish path {
          stroke: currentColor;
          stroke-width: 28;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        [data-theme-surface-trigger]:hover,
        [data-theme-surface-trigger][data-popup-open] {
          background: var(--surface-3) !important;
          color: var(--text) !important;
        }
        [data-theme-surface-option]:focus,
        [data-theme-surface-option][data-highlighted],
        [data-theme-surface-option][data-selected] {
          background: var(--surface-3) !important;
          color: var(--text) !important;
        }
        [data-theme-surface-option]:focus *,
        [data-theme-surface-option][data-highlighted] *,
        [data-theme-surface-option][data-selected] * {
          color: inherit !important;
        }
        [data-theme-surface-option]:focus svg,
        [data-theme-surface-option][data-highlighted] svg,
        [data-theme-surface-option][data-selected] svg {
          color: var(--text-2) !important;
        }
        @media (hover: hover) and (pointer: fine) {
          [data-theme-surface-option]:hover {
            background: var(--surface-3) !important;
            color: var(--text) !important;
          }
          [data-theme-surface-option]:hover * {
            color: inherit !important;
          }
          [data-theme-surface-option]:hover svg {
            color: var(--text-2) !important;
          }
        }
        [data-theme-surface-option] .theme-surface-label {
          color: var(--text) !important;
        }
        [data-theme-surface-option] .theme-surface-description {
          color: var(--text-3) !important;
        }
      `}</style>
    </Select>
  )
}
