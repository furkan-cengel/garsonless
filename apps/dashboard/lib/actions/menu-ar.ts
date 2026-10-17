'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  publishMenuItemAr,
  readMenuItemAr,
  saveMenuItemArDraft,
  unpublishMenuItemAr,
  type MenuArItemState,
} from '@garsonless/application/menu-ar'
import { createMenuArPort } from '@garsonless/db/server'
import type { DashboardActorContext } from '@garsonless/domain'
import { assertAccess } from '../auth/access'

type ActionResult<T> = { ok: true; value: T } | { ok: false; error: string }

const MESSAGES: Record<string, string> = {
  'Not authorized': 'Bu işlem için yetkiniz yok.',
  'AR access disabled': '3D ve AR bu işletmede henüz açık değil. Pilot için Masabu ekibiyle iletişime geçin.',
  'Invalid model selection': 'Seçilen 3D model kullanılamıyor. Yeniden seçin.',
  'Invalid model size': 'Ölçüler 1–100 cm arasında olmalı (yükseklik en az 0,5 cm).',
  'Portion note too long': 'Porsiyon notu en fazla 120 karakter olabilir.',
  'Invalid poster': 'Kapak görseli kullanılamıyor. Ürün görselini yeniden seçin.',
  menu_ar_invalid_item: 'Ürün bulunamadı. Sayfayı yenileyip tekrar deneyin.',
  menu_ar_invalid_glb: 'GLB dosyası bu işletmeye ait değil ya da hazır değil. Yeniden seçin.',
  menu_ar_invalid_usdz: 'USDZ dosyası bu işletmeye ait değil ya da hazır değil. Yeniden seçin.',
  menu_ar_invalid_poster: 'Kapak görseli bu işletmenin dosyalarından seçilmeli.',
  menu_ar_invalid_version: 'Bu taslak değişti. Sayfayı yenileyip tekrar deneyin.',
}

function message(code: string) {
  return MESSAGES[code] ?? 'İşlem tamamlanamadı. Yeniden deneyin.'
}

async function actor(restaurantId: string): Promise<DashboardActorContext | null> {
  const gate = await assertAccess(restaurantId, 'menu')
  if ('error' in gate) return null
  return {
    actor: 'dashboard-member',
    restaurantId,
    userId: gate.userId,
    permissions: gate.access.permissions,
    isOwner: gate.access.isOwner,
  }
}

const itemSchema = z.object({ restaurantId: z.string().uuid(), menuItemId: z.string().uuid() }).strict()
const mm = (min: number) => z.number().int().min(min).max(1000).nullable()
const draftSchema = itemSchema.extend({
  glbAssetId: z.string().uuid(),
  usdzAssetId: z.string().uuid().nullable(),
  posterUrl: z.string().max(2000).nullable(),
  widthMm: mm(10),
  depthMm: mm(10),
  heightMm: mm(5),
  portionNote: z.string().max(120).nullable(),
}).strict()
const versionSchema = itemSchema.extend({ versionId: z.string().uuid() }).strict()

function done(restaurantId: string) {
  revalidatePath(`/dashboard/${restaurantId}/menu`)
}

export async function readMenuItemArAction(input: z.infer<typeof itemSchema>): Promise<ActionResult<MenuArItemState>> {
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: message('menu_ar_invalid_item') }
  const context = await actor(parsed.data.restaurantId)
  if (!context) return { ok: false, error: message('Not authorized') }
  const result = await readMenuItemAr(context, parsed.data, createMenuArPort())
  return result.ok ? { ok: true, value: result.value } : { ok: false, error: message(result.error) }
}

export async function saveMenuItemArDraftAction(input: z.infer<typeof draftSchema>): Promise<ActionResult<{ versionId: string }>> {
  const parsed = draftSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: message('Invalid model size') }
  const context = await actor(parsed.data.restaurantId)
  if (!context) return { ok: false, error: message('Not authorized') }
  const result = await saveMenuItemArDraft(context, parsed.data, createMenuArPort())
  if (!result.ok) return { ok: false, error: message(result.error) }
  done(parsed.data.restaurantId)
  return { ok: true, value: result.value }
}

export async function publishMenuItemArAction(input: z.infer<typeof versionSchema>): Promise<ActionResult<null>> {
  const parsed = versionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: message('menu_ar_invalid_version') }
  const context = await actor(parsed.data.restaurantId)
  if (!context) return { ok: false, error: message('Not authorized') }
  const result = await publishMenuItemAr(context, parsed.data, createMenuArPort())
  if (!result.ok) return { ok: false, error: message(result.error) }
  done(parsed.data.restaurantId)
  return { ok: true, value: null }
}

export async function unpublishMenuItemArAction(input: z.infer<typeof itemSchema>): Promise<ActionResult<null>> {
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: message('menu_ar_invalid_item') }
  const context = await actor(parsed.data.restaurantId)
  if (!context) return { ok: false, error: message('Not authorized') }
  const result = await unpublishMenuItemAr(context, parsed.data, createMenuArPort())
  if (!result.ok) return { ok: false, error: message(result.error) }
  done(parsed.data.restaurantId)
  return { ok: true, value: null }
}
