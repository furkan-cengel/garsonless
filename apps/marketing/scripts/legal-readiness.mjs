const releaseBuild = process.env.MASABU_RELEASE_BUILD === 'true' || process.env.VERCEL_ENV === 'production'
const required = [
  ['NEXT_PUBLIC_BUSINESS_PHONE', 'kamuya açık destek telefonu'],
]
const missing = required.filter(([name]) => !process.env[name]?.trim())

if (missing.length > 0) {
  const message = `Masabu yayın kapısı eksik: ${missing.map(([, label]) => label).join(', ')}`
  if (releaseBuild) {
    console.error(message)
    process.exit(1)
  }
  console.warn(`${message}. Yerel build devam ediyor.`)
}
