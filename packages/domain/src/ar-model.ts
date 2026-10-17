// 3D/AR model files: browser-safe type mapping and structural validation.
//
// GLB (glTF 2.0 binary) serves 3D view and Android AR; USDZ serves iOS Quick
// Look. Files must be self-contained: no external URIs and no extensions that
// need a decoder fetched from a CDN (Draco, Basis/KTX2), because the menu's
// CSP and the native AR viewers cannot load them.

export const AR_MODEL_MAX_BYTES = 10 * 1024 * 1024
export const AR_MODEL_TARGET_BYTES = 5 * 1024 * 1024

export const AR_MODEL_MIME = {
  glb: 'model/gltf-binary',
  usdz: 'model/vnd.usdz+zip',
} as const
export type ArModelFormat = keyof typeof AR_MODEL_MIME
export type ArModelMime = (typeof AR_MODEL_MIME)[ArModelFormat]

export function isArModelMime(mime: string): mime is ArModelMime {
  return mime === AR_MODEL_MIME.glb || mime === AR_MODEL_MIME.usdz
}

/** Browsers often report an empty type for .glb/.usdz; map by extension instead. */
export function arModelMimeFromName(name: string): ArModelMime | null {
  const extension = name.trim().toLowerCase().split('.').pop()
  if (extension === 'glb') return AR_MODEL_MIME.glb
  if (extension === 'usdz') return AR_MODEL_MIME.usdz
  return null
}

export type ArModelInspection =
  | { ok: true; format: ArModelFormat }
  | { ok: false; reason: ArModelRejection }

export type ArModelRejection =
  | 'too_large'
  | 'not_glb'
  | 'unsupported_gltf_version'
  | 'corrupt'
  | 'external_resource'
  | 'unsupported_extension'
  | 'not_usdz'
  | 'usdz_compressed'
  | 'usdz_unsafe_entry'
  | 'usdz_too_many_entries'
  | 'usdz_too_large_unpacked'

export const AR_MODEL_REJECTION_COPY: Record<ArModelRejection, string> = {
  too_large: 'Dosya en fazla 10 MB olabilir. Dışa aktarırken daha düşük kalite seçin.',
  not_glb: 'Bu dosya GLB değil. Uygulamadan “GLB” (glTF binary) olarak dışa aktarın.',
  unsupported_gltf_version: 'Yalnız glTF 2.0 GLB dosyaları destekleniyor.',
  corrupt: 'Dosya bozuk görünüyor. Uygulamadan yeniden dışa aktarıp tekrar deneyin.',
  external_resource: 'Model, dosyanın dışındaki doku veya veriye bağlı. Tüm dokuları dosyanın içine gömerek dışa aktarın.',
  unsupported_extension: 'Model, menüde açılamayan bir sıkıştırma kullanıyor (Draco veya KTX2). Sıkıştırmasız GLB olarak dışa aktarın.',
  not_usdz: 'Bu dosya USDZ değil. iPhone için “USDZ” olarak dışa aktarın.',
  usdz_compressed: 'USDZ içindeki dosyalar sıkıştırılmış; Quick Look bunu açamaz. Uygulamadan yeniden USDZ olarak dışa aktarın.',
  usdz_unsafe_entry: 'USDZ arşivinde geçersiz bir dosya yolu var.',
  usdz_too_many_entries: 'USDZ arşivinde çok fazla dosya var.',
  usdz_too_large_unpacked: 'USDZ açıldığında çok büyük. Daha düşük doku kalitesiyle dışa aktarın.',
}

// Extensions model-viewer renders without fetching a decoder from a CDN.
const SUPPORTED_GLTF_EXTENSIONS = new Set([
  'KHR_materials_emissive_strength',
  'KHR_materials_clearcoat',
  'KHR_materials_ior',
  'KHR_materials_sheen',
  'KHR_materials_specular',
  'KHR_materials_transmission',
  'KHR_materials_unlit',
  'KHR_materials_volume',
  'KHR_mesh_quantization',
  'KHR_texture_transform',
  'KHR_lights_punctual',
])

const GLB_MAGIC = 0x46546c67 // "glTF"
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

export function inspectGlb(bytes: Uint8Array): ArModelInspection {
  if (bytes.byteLength > AR_MODEL_MAX_BYTES) return { ok: false, reason: 'too_large' }
  if (bytes.byteLength < 20) return { ok: false, reason: 'not_glb' }
  const data = view(bytes)
  if (data.getUint32(0, true) !== GLB_MAGIC) return { ok: false, reason: 'not_glb' }
  if (data.getUint32(4, true) !== 2) return { ok: false, reason: 'unsupported_gltf_version' }
  if (data.getUint32(8, true) !== bytes.byteLength) return { ok: false, reason: 'corrupt' }

  const jsonLength = data.getUint32(12, true)
  if (data.getUint32(16, true) !== CHUNK_JSON || 20 + jsonLength > bytes.byteLength) return { ok: false, reason: 'corrupt' }
  let json: Record<string, unknown>
  try {
    json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as Record<string, unknown>
  } catch {
    return { ok: false, reason: 'corrupt' }
  }
  const asset = json['asset'] as { version?: unknown } | undefined
  if (!asset || asset.version !== '2.0') return { ok: false, reason: 'unsupported_gltf_version' }

  let offset = 20 + jsonLength
  let hasBin = false
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) return { ok: false, reason: 'corrupt' }
    const length = data.getUint32(offset, true)
    const type = data.getUint32(offset + 4, true)
    if (offset + 8 + length > bytes.byteLength) return { ok: false, reason: 'corrupt' }
    if (type === CHUNK_BIN) hasBin = true
    offset += 8 + length
  }

  const buffers = Array.isArray(json['buffers']) ? json['buffers'] as Array<{ uri?: unknown }> : []
  const images = Array.isArray(json['images']) ? json['images'] as Array<{ uri?: unknown }> : []
  for (const entry of [...buffers, ...images]) {
    if (entry.uri === undefined) continue
    if (typeof entry.uri !== 'string' || !entry.uri.startsWith('data:')) return { ok: false, reason: 'external_resource' }
  }
  if (buffers.some((buffer) => buffer.uri === undefined) && !hasBin) return { ok: false, reason: 'corrupt' }

  const required = Array.isArray(json['extensionsRequired']) ? json['extensionsRequired'] as unknown[] : []
  const used = Array.isArray(json['extensionsUsed']) ? json['extensionsUsed'] as unknown[] : []
  for (const name of [...required, ...used]) {
    if (typeof name !== 'string') return { ok: false, reason: 'corrupt' }
    if (name === 'KHR_draco_mesh_compression' || name === 'KHR_texture_basisu' || name === 'EXT_meshopt_compression') {
      return { ok: false, reason: 'unsupported_extension' }
    }
    if (required.includes(name) && !SUPPORTED_GLTF_EXTENSIONS.has(name)) return { ok: false, reason: 'unsupported_extension' }
  }
  return { ok: true, format: 'glb' }
}

const USDZ_MAX_ENTRIES = 2000
const USDZ_MAX_UNPACKED = 64 * 1024 * 1024
const USDZ_ALLOWED_EXTENSIONS = new Set(['usdc', 'usda', 'usd', 'png', 'jpg', 'jpeg', 'exr', 'avif', 'm4a', 'mp3', 'wav'])

/**
 * USDZ is an uncompressed ZIP whose first entry is the root USD layer. The
 * central directory is read without inflating anything, so a hostile archive
 * cannot spend CPU or memory here.
 */
export function inspectUsdz(bytes: Uint8Array): ArModelInspection {
  if (bytes.byteLength > AR_MODEL_MAX_BYTES) return { ok: false, reason: 'too_large' }
  if (bytes.byteLength < 30) return { ok: false, reason: 'not_usdz' }
  const data = view(bytes)
  if (data.getUint32(0, true) !== 0x04034b50) return { ok: false, reason: 'not_usdz' }

  // End of central directory: last 22 bytes plus up to 64 KiB of comment.
  let eocd = -1
  for (let index = bytes.byteLength - 22; index >= Math.max(0, bytes.byteLength - 22 - 0xffff); index -= 1) {
    if (data.getUint32(index, true) === 0x06054b50) { eocd = index; break }
  }
  if (eocd < 0) return { ok: false, reason: 'corrupt' }
  const entries = data.getUint16(eocd + 10, true)
  const directorySize = data.getUint32(eocd + 12, true)
  const directoryOffset = data.getUint32(eocd + 16, true)
  if (entries === 0 || entries === 0xffff || directoryOffset === 0xffffffff) return { ok: false, reason: 'corrupt' }
  if (entries > USDZ_MAX_ENTRIES) return { ok: false, reason: 'usdz_too_many_entries' }
  if (directoryOffset + directorySize > eocd) return { ok: false, reason: 'corrupt' }

  let offset = directoryOffset
  let unpacked = 0
  for (let index = 0; index < entries; index += 1) {
    if (offset + 46 > eocd || data.getUint32(offset, true) !== 0x02014b50) return { ok: false, reason: 'corrupt' }
    const method = data.getUint16(offset + 10, true)
    const uncompressed = data.getUint32(offset + 24, true)
    const nameLength = data.getUint16(offset + 28, true)
    const extraLength = data.getUint16(offset + 30, true)
    const commentLength = data.getUint16(offset + 32, true)
    if (offset + 46 + nameLength > eocd) return { ok: false, reason: 'corrupt' }
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (method !== 0) return { ok: false, reason: 'usdz_compressed' }
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some((part) => part === '..' || part === '')) {
      return { ok: false, reason: 'usdz_unsafe_entry' }
    }
    const extension = name.toLowerCase().split('.').pop() ?? ''
    if (!USDZ_ALLOWED_EXTENSIONS.has(extension)) return { ok: false, reason: 'usdz_unsafe_entry' }
    if (index === 0 && !['usdc', 'usda', 'usd'].includes(extension)) return { ok: false, reason: 'not_usdz' }
    unpacked += uncompressed
    if (unpacked > USDZ_MAX_UNPACKED) return { ok: false, reason: 'usdz_too_large_unpacked' }
    offset += 46 + nameLength + extraLength + commentLength
  }
  return { ok: true, format: 'usdz' }
}

export function inspectArModel(bytes: Uint8Array, mime: string): ArModelInspection {
  if (mime === AR_MODEL_MIME.glb) return inspectGlb(bytes)
  if (mime === AR_MODEL_MIME.usdz) return inspectUsdz(bytes)
  return { ok: false, reason: 'corrupt' }
}
