import type { GarsonlessTheme } from '@garsonless/design-engine'

export function rgbFromHex(hex: string) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ] as const
}

export function contrastRatio(foreground: string, background: string) {
  if (!rgbFromHex(foreground) || !rgbFromHex(background)) return 1
  const luminance = (hex: string) => {
    const rgb = rgbFromHex(hex)
    if (!rgb) return 0
    const channels = rgb.map((channel) => {
      const value = channel / 255
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
    const [red = 0, green = 0, blue = 0] = channels
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  }
  const first = luminance(foreground)
  const second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

export function deriveSoftColor(accent: string) {
  const rgb = rgbFromHex(accent)
  if (!rgb) return '#f1f2f3'
  const mixed = rgb.map((channel) => Math.round(channel * 0.12 + 255 * 0.88))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function resolveCartTriggerPatch({
  fieldId,
  value,
  headerStyle,
  footerStyle,
}: {
  fieldId: string
  value: unknown
  headerStyle: NonNullable<GarsonlessTheme['cartHeaderTriggerStyle']>
  footerStyle: NonNullable<GarsonlessTheme['cartFooterTriggerStyle']>
}): Partial<GarsonlessTheme> | null {
  if (fieldId === 'cartHeaderTriggerStyle') {
    const nextHeader = value as GarsonlessTheme['cartHeaderTriggerStyle']
    return {
      cartHeaderTriggerStyle: nextHeader,
      cartFooterTriggerStyle: nextHeader !== 'none'
        ? 'none'
        : footerStyle === 'none' ? 'pill' : footerStyle,
    }
  }
  if (fieldId === 'cartFooterTriggerStyle') {
    const nextFooter = value as GarsonlessTheme['cartFooterTriggerStyle']
    return {
      cartFooterTriggerStyle: nextFooter,
      cartHeaderTriggerStyle: nextFooter !== 'none'
        ? 'none'
        : headerStyle === 'none' ? 'icon' : headerStyle,
    }
  }
  return null
}

export function sanitizePropertyControlId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}
