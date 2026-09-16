import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const ref = readFileSync(
  new URL('../supabase/.temp/project-ref', import.meta.url),
  'utf8',
).trim()
if (ref !== 'yxsegwkzyiscrxiwdeuf')
  throw new Error('Verifier requires the linked dev project')
const cli = new URL('../node_modules/.bin/supabase', import.meta.url).pathname
const result = spawnSync(
  cli,
  [
    'db',
    'query',
    '--linked',
    '--file',
    new URL('./verify-one-time-add-ons.sql', import.meta.url).pathname,
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      SEND_SMS_HOOK_SECRETS: `v1,whsec_${Buffer.alloc(32).toString('base64')}`,
    },
  },
)
if (result.status !== 0) process.exit(result.status ?? 1)
