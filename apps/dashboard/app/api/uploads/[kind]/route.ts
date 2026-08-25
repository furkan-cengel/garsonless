import { NextResponse } from 'next/server'
import { uploadMenuImage } from '../../../../lib/actions/menu'
import { uploadLogo } from '../../../../lib/actions/restaurant'
import { uploadThemeMedia, uploadThemeVideo } from '../../../../lib/actions/theme'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = {
  logo: 2 * 1024 * 1024 + 64 * 1024,
  'menu-image': 5 * 1024 * 1024 + 64 * 1024,
  'theme-image': 8 * 1024 * 1024 + 64 * 1024,
  'theme-video': 8 * 1024 * 1024 + 64 * 1024,
} as const

type UploadKind = keyof typeof MAX_BODY_BYTES

function isUploadKind(value: string): value is UploadKind {
  return Object.hasOwn(MAX_BODY_BYTES, value)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params
  if (!isUploadKind(kind)) return NextResponse.json({ error: 'Geçersiz yükleme hedefi.' }, { status: 404 })
  if (request.headers.get('content-type')?.split(';')[0] !== 'multipart/form-data') {
    return NextResponse.json({ error: 'Geçersiz içerik türü.' }, { status: 415 })
  }
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: 'Geçersiz istek kaynağı.' }, { status: 403 })
  }
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (!Number.isSafeInteger(declaredLength) || declaredLength <= 0 || declaredLength > MAX_BODY_BYTES[kind]) {
    return NextResponse.json({ error: 'Dosya boyutu izin verilen sınırı aşıyor.' }, { status: 413 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) return NextResponse.json({ error: 'Yükleme verisi okunamadı.' }, { status: 400 })

  const result = kind === 'logo'
    ? await uploadLogo(String(formData.get('restaurantId') ?? ''), formData)
    : kind === 'menu-image'
      ? await uploadMenuImage(formData)
      : kind === 'theme-video'
        ? await uploadThemeVideo(formData)
        : await uploadThemeMedia(formData)
  return NextResponse.json(result, { status: 'error' in result ? 400 : 200 })
}
