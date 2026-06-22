#!/usr/bin/env node
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local from the repo root
config({ path: join(__dirname, '../../../apps/dashboard/.env.local') })

const dbUrl = process.env.SUPABASE_DB_URL
if (!dbUrl) {
  console.error('Error: SUPABASE_DB_URL is not set.')
  console.error('Add it to apps/dashboard/.env.local:')
  console.error('  SUPABASE_DB_URL=postgresql://postgres:[password]@db.yxsegwkzyiscrxiwdeuf.supabase.co:5432/postgres')
  console.error('\nGet the password from: Supabase dashboard → Settings → Database → Connection string')
  process.exit(1)
}

const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

async function main() {
  await client.connect()

  await client.query(`
    create table if not exists _migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const { rows: applied } = await client.query('select name from _migrations order by name')
  const appliedNames = new Set(applied.map((r) => r.name))

  const migrationsDir = join(__dirname, '../supabase/migrations')
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()

  let count = 0
  for (const file of files) {
    if (appliedNames.has(file)) {
      console.log(`  skip  ${file}`)
      continue
    }

    const sql = await readFile(join(migrationsDir, file), 'utf8')
    process.stdout.write(`  run   ${file} ... `)

    try {
      await client.query(sql)
      await client.query('insert into _migrations (name) values ($1)', [file])
      console.log('done')
      count++
    } catch (err) {
      console.log('FAILED')
      console.error(err.message)
      await client.end()
      process.exit(1)
    }
  }

  await client.end()
  console.log(`\n${count} migration(s) applied.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
