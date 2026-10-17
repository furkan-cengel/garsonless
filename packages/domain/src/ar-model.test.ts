import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { AR_MODEL_MAX_BYTES, arModelMimeFromName, inspectArModel, inspectGlb, inspectUsdz } from './ar-model'

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../../../apps/menu/public/ar-spike/${name}`, import.meta.url)))

function glb(json: Record<string, unknown>, bin = new Uint8Array(4)): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json))
  const jsonLength = Math.ceil(text.length / 4) * 4
  const total = 12 + 8 + jsonLength + 8 + bin.length
  const out = new Uint8Array(total)
  const data = new DataView(out.buffer)
  data.setUint32(0, 0x46546c67, true); data.setUint32(4, 2, true); data.setUint32(8, total, true)
  data.setUint32(12, jsonLength, true); data.setUint32(16, 0x4e4f534a, true)
  out.set(text, 20); out.fill(0x20, 20 + text.length, 20 + jsonLength)
  data.setUint32(20 + jsonLength, bin.length, true); data.setUint32(24 + jsonLength, 0x004e4942, true)
  out.set(bin, 28 + jsonLength)
  return out
}

function zip(entries: Array<{ name: string; method?: number; size?: number }>): Uint8Array {
  const encoder = new TextEncoder()
  const local: number[] = []
  const central: number[] = []
  const u16 = (arr: number[], v: number) => arr.push(v & 0xff, (v >> 8) & 0xff)
  const u32 = (arr: number[], v: number) => arr.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff)
  for (const entry of entries) {
    const name = [...encoder.encode(entry.name)]
    const offset = local.length
    u32(local, 0x04034b50); u16(local, 20); u16(local, 0); u16(local, entry.method ?? 0); u32(local, 0); u32(local, 0)
    u32(local, 0); u32(local, 0); u32(local, 0); u16(local, name.length); u16(local, 0); local.push(...name)
    u32(central, 0x02014b50); u16(central, 20); u16(central, 20); u16(central, 0); u16(central, entry.method ?? 0)
    u32(central, 0); u32(central, 0); u32(central, 0); u32(central, entry.size ?? 0); u16(central, name.length)
    u16(central, 0); u16(central, 0); u16(central, 0); u16(central, 0); u32(central, 0); u32(central, offset); central.push(...name)
  }
  const end: number[] = []
  u32(end, 0x06054b50); u16(end, 0); u16(end, 0); u16(end, entries.length); u16(end, entries.length)
  u32(end, central.length); u32(end, local.length); u16(end, 0)
  return new Uint8Array([...local, ...central, ...end])
}

const base = { asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] }

test('the generated spike models pass', () => {
  assert.deepEqual(inspectGlb(fixture('test-plate.glb')), { ok: true, format: 'glb' })
  assert.deepEqual(inspectUsdz(fixture('test-plate.usdz')), { ok: true, format: 'usdz' })
  assert.deepEqual(inspectArModel(fixture('test-plate.glb'), 'model/gltf-binary'), { ok: true, format: 'glb' })
})

test('GLB structure, version and length are checked', () => {
  assert.deepEqual(inspectGlb(glb(base)), { ok: true, format: 'glb' })
  assert.equal((inspectGlb(new TextEncoder().encode('not a model at all, just text')) as { reason: string }).reason, 'not_glb')
  assert.equal((inspectGlb(glb({ asset: { version: '1.0' } })) as { reason: string }).reason, 'unsupported_gltf_version')
  const truncated = glb(base).subarray(0, 40)
  assert.equal((inspectGlb(truncated) as { reason: string }).reason, 'corrupt')
})

test('GLB must be self-contained and decodable without a CDN', () => {
  assert.equal((inspectGlb(glb({ ...base, images: [{ uri: 'https://cdn.example.com/a.png' }] })) as { reason: string }).reason, 'external_resource')
  assert.equal((inspectGlb(glb({ ...base, buffers: [{ uri: 'model.bin', byteLength: 4 }] })) as { reason: string }).reason, 'external_resource')
  assert.deepEqual(inspectGlb(glb({ ...base, images: [{ uri: 'data:image/png;base64,AA==' }] })), { ok: true, format: 'glb' })
  assert.equal((inspectGlb(glb({ ...base, extensionsUsed: ['KHR_draco_mesh_compression'], extensionsRequired: ['KHR_draco_mesh_compression'] })) as { reason: string }).reason, 'unsupported_extension')
  assert.equal((inspectGlb(glb({ ...base, extensionsUsed: ['KHR_texture_basisu'] })) as { reason: string }).reason, 'unsupported_extension')
  assert.deepEqual(inspectGlb(glb({ ...base, extensionsUsed: ['KHR_texture_transform'], extensionsRequired: ['KHR_texture_transform'] })), { ok: true, format: 'glb' })
})

test('USDZ must be an uncompressed archive rooted at a USD layer with safe paths', () => {
  assert.deepEqual(inspectUsdz(zip([{ name: 'model.usdc' }, { name: 'textures/a.png' }])), { ok: true, format: 'usdz' })
  assert.equal((inspectUsdz(zip([{ name: 'textures/a.png' }, { name: 'model.usdc' }])) as { reason: string }).reason, 'not_usdz')
  assert.equal((inspectUsdz(zip([{ name: 'model.usdc', method: 8 }])) as { reason: string }).reason, 'usdz_compressed')
  assert.equal((inspectUsdz(zip([{ name: 'model.usdc' }, { name: '../evil.png' }])) as { reason: string }).reason, 'usdz_unsafe_entry')
  assert.equal((inspectUsdz(zip([{ name: 'model.usdc' }, { name: 'run.sh' }])) as { reason: string }).reason, 'usdz_unsafe_entry')
  assert.equal((inspectUsdz(zip([{ name: 'model.usdc', size: 70 * 1024 * 1024 }])) as { reason: string }).reason, 'usdz_too_large_unpacked')
  assert.equal((inspectUsdz(new Uint8Array(40)) as { reason: string }).reason, 'not_usdz')
})

test('size cap and extension-based type mapping', () => {
  assert.equal((inspectGlb(new Uint8Array(AR_MODEL_MAX_BYTES + 1)) as { reason: string }).reason, 'too_large')
  assert.equal(arModelMimeFromName('Serpme Kahvaltı.GLB'), 'model/gltf-binary')
  assert.equal(arModelMimeFromName('tatli.usdz'), 'model/vnd.usdz+zip')
  assert.equal(arModelMimeFromName('photo.png'), null)
})
