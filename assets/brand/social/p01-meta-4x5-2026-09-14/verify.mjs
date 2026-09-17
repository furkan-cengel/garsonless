import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'

const files = ['01-kapak.png', '02-qr-menu.png', '03-adisyon.png', '04-mutfak.png', '05-takip.png']
const results = []
for (const file of files) {
  const bytes = await readFile(new URL(file, import.meta.url))
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file}: PNG signature`)
  const width = bytes.readUInt32BE(16)
  const height = bytes.readUInt32BE(20)
  // Bounds quoted by the user's actual Meta Business Suite upload UI.
  const meetsVisibleMetaBounds = width * 5 >= height * 4 && width * 100 <= height * 191
  results.push({ file, width, height, aspectRatio: width / height, meetsVisibleMetaBounds, bytes: bytes.length })
}
const report = { allMeetVisibleMetaBounds: results.every(result => result.meetsVisibleMetaBounds), scope: 'PNG dimensions checked against 4:5–1.91:1 in the user-provided Meta UI. No actual upload or publication performed.', results }
await writeFile(new URL('verification.json', import.meta.url), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
assert.ok(report.allMeetVisibleMetaBounds, 'Do not deliver a failing set as Meta-compatible')
