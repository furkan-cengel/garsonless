const SYSTEM_FONTS = new Set([
  'Arial',
  'Helvetica',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Bodoni 72',
  'sans-serif',
  'serif',
  'cursive',
  'monospace',
])

export function extractFontName(fontFamily: string): string {
  const parts = fontFamily.replace(/['"]/g, '').split(',')
  return (parts[0] ?? '').trim()
}

export function buildGoogleFontsUrl(fontNames: string[]): string {
  const unique = [...new Set(fontNames.filter((f) => f && !SYSTEM_FONTS.has(f)))]
  if (unique.length === 0) return ''
  const params = unique
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join('&')
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}
