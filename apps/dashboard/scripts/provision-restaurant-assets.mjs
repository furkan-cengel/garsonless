/** Read-only by default. Use --create-missing to provision an empty media bucket. */
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const projectRef = process.argv.find((arg) => arg.startsWith('--project-ref='))?.split('=')[1]
assert.match(projectRef ?? '', /^[a-z0-9]{20}$/, 'An explicit --project-ref is required')
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, `https://${projectRef}.supabase.co`, 'Environment and requested project must match')
assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY, 'Server service role is required')
const bucketId = process.argv.includes('--staging') ? 'restaurant-media-staging' : 'restaurant-assets'
const configuration = {
  public: bucketId === 'restaurant-assets',
  fileSizeLimit: 8 * 1024 * 1024,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm'],
}
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})
// Bucket operations belong to the Storage API, not SQL inserts into storage tables.
const { data: buckets, error: listError } = await client.storage.listBuckets()
assert.ifError(listError)
const existing = buckets.find((bucket) => bucket.id === bucketId)
if (!existing) {
  assert.ok(process.argv.includes('--create-missing'), `${bucketId} is missing. Re-run with --create-missing to provision it.`)
  const { error } = await client.storage.createBucket(bucketId, configuration)
  assert.ifError(error)
  console.log(`Created missing ${bucketId} bucket. No policies or existing files changed.`)
}
const { data: bucket, error } = await client.storage.getBucket(bucketId)
assert.ifError(error)
assert.equal(bucket.public, configuration.public, 'Bucket visibility differs from the required public/private boundary')
assert.equal(bucket.file_size_limit, configuration.fileSizeLimit, 'Bucket size limit differs; review existing configuration manually')
assert.deepEqual([...bucket.allowed_mime_types ?? []].sort(), [...configuration.allowedMimeTypes].sort(), 'Bucket MIME allowlist differs; review existing configuration manually')
console.log(`Storage configuration PASS (${projectRef}); existing configuration is never overwritten.`)
