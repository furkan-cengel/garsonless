'use client'
import type { MenuBulkOperation } from '@garsonless/domain/menu-bulk'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { profileInitials } from '@/lib/profile-view-model'
export function MenuBulkActor({ operation }: { operation: MenuBulkOperation }) {
  return <div className="flex min-w-0 items-center gap-3">
    <Avatar><AvatarFallback>{profileInitials(operation.actor_label)}</AvatarFallback></Avatar>
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{operation.actor_label}</span>{operation.actor_role && <Badge variant="outline">{operation.actor_role}</Badge>}</div>
      <span className="break-all text-xs text-muted-foreground">{operation.actor_email || `Kullanıcı ${operation.actor_id}`}</span>
    </div>
  </div>
}
