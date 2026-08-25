export const MEDIA_UPLOAD_PURPOSES = [
  'logo',
  'menu-image',
  'theme-image',
  'theme-video',
] as const

export type MediaUploadPurpose = (typeof MEDIA_UPLOAD_PURPOSES)[number]

export type MediaUploadFinalization =
  | { success: true; url: string; width?: number; height?: number; mime?: string; durationSeconds?: number }
  | { success: false; error: string }

export interface MediaUploadIntent {
  purpose: MediaUploadPurpose
  requestId: string
  restaurantId: string
}
