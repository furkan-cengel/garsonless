import { z } from 'zod'
import { validateMenuImageMetadata } from './menu-image-policy'
import { isThemeMediaPurpose, validateThemeMediaMetadata, THEME_MEDIA_VIDEO_MAX_BYTES } from './theme-media-policy'

export const mediaPrepareSchema = z.object({
  restaurantId: z.string().uuid(),
  size: z.number().int().positive().max(8 * 1024 * 1024),
  type: z.string().max(64),
  entityId: z.string().uuid().optional(),
  kind: z.enum(['items', 'categories']).optional(),
  purpose: z.string().max(40).optional(),
}).strict()
export type MediaPrepareInput = z.infer<typeof mediaPrepareSchema>
export type LargeUploadKind = 'menu-image' | 'theme-image' | 'theme-video'
export function isLargeUploadKind(value: string): value is LargeUploadKind {
  return value === 'menu-image' || value === 'theme-image' || value === 'theme-video'
}
export function validateStagingMetadata(kind: LargeUploadKind, input: MediaPrepareInput): string | null {
  if (kind === 'menu-image') {
    if (!input.entityId || !input.kind || input.purpose) return 'Geçersiz görsel hedefi.'
    const result = validateMenuImageMetadata(input)
    return result.ok ? null : result.error
  }
  if (input.entityId || input.kind) return 'Geçersiz görsel hedefi.'
  if (kind === 'theme-image') {
    if (!input.purpose || !isThemeMediaPurpose(input.purpose)) return 'Geçersiz tema görseli hedefi.'
    const result = validateThemeMediaMetadata({ ...input, purpose: input.purpose })
    return result.ok ? null : result.error
  }
  if (input.purpose) return 'Geçersiz video hedefi.'
  if (input.size > THEME_MEDIA_VIDEO_MAX_BYTES) return 'Video en fazla 8 MB olabilir.'
  return ['video/mp4', 'video/webm'].includes(input.type) ? null : 'Yalnız MP4 veya WebM video yükleyin.'
}
