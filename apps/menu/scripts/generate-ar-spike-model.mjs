// Generates the AR technical-spike test model (GLB for Android/WebXR, USDZ for
// iOS Quick Look) at real-world scale: a 26 cm plate with a small dessert.
// Units are metres, so AR "fixed scale" shows the true portion size.
//
//   corepack pnpm --filter menu ar-spike:model
//
// Output: apps/menu/public/ar-spike/test-plate.{glb,usdz}
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { USDZExporter } from 'three/examples/jsm/exporters/USDZExporter.js'

// GLTFExporter reads Blobs through FileReader, which Node does not provide.
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer()
    this.onloadend?.()
  }
  async readAsDataURL(blob) {
    const base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
    this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`
    this.onloadend?.()
  }
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ar-spike')
mkdirSync(out, { recursive: true })

const scene = new THREE.Scene()
const material = (color, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })

// Plate: 26 cm diameter, 1.6 cm tall, slightly raised rim.
const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.016, 64), material(0xf4f1ea, 0.3))
plate.name = 'Plate'
plate.position.y = 0.008
scene.add(plate)

// Dessert: 9 cm round cake, 5 cm tall, with a cream top and a berry.
const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 48), material(0x8b5a2b, 0.7))
cake.name = 'Cake'
cake.position.y = 0.016 + 0.025
scene.add(cake)
const cream = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.008, 48), material(0xfff8ec, 0.6))
cream.name = 'Cream'
cream.position.y = 0.016 + 0.05 + 0.004
scene.add(cream)
const berry = new THREE.Mesh(new THREE.SphereGeometry(0.009, 24, 16), material(0xc0182b, 0.35))
berry.name = 'Berry'
berry.position.y = 0.016 + 0.05 + 0.008 + 0.008
scene.add(berry)

scene.updateMatrixWorld(true)

const glb = await new GLTFExporter().parseAsync(scene, { binary: true })
writeFileSync(join(out, 'test-plate.glb'), Buffer.from(glb))

const usdz = await new USDZExporter().parseAsync(scene)
writeFileSync(join(out, 'test-plate.usdz'), Buffer.from(usdz))

console.log('wrote', join(out, 'test-plate.glb'), glb.byteLength, 'bytes')
console.log('wrote', join(out, 'test-plate.usdz'), usdz.byteLength, 'bytes')
