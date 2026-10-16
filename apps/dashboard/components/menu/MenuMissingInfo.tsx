'use client'

import type { Tables } from '@garsonless/db/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { focusMenuField, getMissingProductFields, type MissingProductField } from './menu-manager-utils'

/**
 * "N eksik" badge that names each gap and its consequence, with a button
 * that opens the product and jumps to the empty field.
 */
export function MenuMissingInfoBadge({ item, onOpenItem }: { item: Tables<'menu_items'>; onOpenItem?: () => void }) {
  const missing = getMissingProductFields(item)
  if (missing.length === 0) return null
  // Inside an already-clickable row a second button would nest; show the list as text.
  if (!onOpenItem) {
    return <Badge variant="warning" title={`Eksik: ${missing.map((entry) => entry.label).join(', ')}`}>{missing.length} eksik</Badge>
  }
  const fix = (field: MissingProductField) => {
    onOpenItem()
    focusMenuField(item.id, field)
  }
  return (
    <Popover>
      <PopoverTrigger
        render={<button type="button" className="menu-missing-info-trigger" style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer", borderRadius: 999 }} aria-label={`${item.name}: ${missing.length} eksik bilgi, ayrıntıları göster`} />}
        onClick={(event) => event.stopPropagation()}
      >
        <Badge variant="warning">{missing.length} eksik</Badge>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-1 text-sm" onClick={(event) => event.stopPropagation()}>
        <strong className="mb-1">{item.name} için eksik bilgiler</strong>
        <ul className="flex flex-col gap-2">
          {missing.map((entry) => (
            <li key={entry.field} className="flex items-start gap-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{entry.label}</span>
                <span className="text-xs text-muted-foreground">{entry.consequence}</span>
              </span>
              <Button type="button" size="xs" variant="outline" onClick={() => fix(entry.field)}>Düzelt</Button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
