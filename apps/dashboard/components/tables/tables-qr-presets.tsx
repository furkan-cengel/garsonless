import type { QRConfig } from './tables-builder-types'

/* Ready-made QR looks. Applying one keeps the logo, frame and label and only swaps colors and shapes. */
export const QR_PRESETS = [
  { id: 'classic',  name: 'Klasik',     fg: '#111113', bg: '#ffffff', dots: 'square',          ef: 'square',        eb: 'square', grad: false },
  { id: 'soft',     name: 'Yumuşak',    fg: '#111113', bg: '#ffffff', dots: 'rounded',         ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'dotty',    name: 'Noktalı',    fg: '#111113', bg: '#ffffff', dots: 'dots',            ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'amber',    name: 'Kehribar',   fg: '#8a4a1c', bg: '#fdf6ec', dots: 'classy-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'emerald',  name: 'Zümrüt',     fg: '#1b5b3e', bg: '#eaf3ed', dots: 'extra-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
  { id: 'midnight', name: 'Gece',       fg: '#0e0e10', bg: '#f3f3f5', dots: 'rounded',         ef: 'square',        eb: 'square', grad: true, gradTo: '#3b3b40' },
  { id: 'sunset',   name: 'Gün batımı', fg: '#b8551c', bg: '#fff6ef', dots: 'extra-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: true, gradTo: '#a13b7a' },
  { id: 'mint',     name: 'Nane',       fg: '#0e8a64', bg: '#edf9f4', dots: 'classy-rounded',  ef: 'extra-rounded', eb: 'dot',    grad: false },
] as const

export type QRPreset = typeof QR_PRESETS[number]

export function applyQRPreset(qr: QRConfig, preset: QRPreset): QRConfig {
  return {
    ...qr,
    fg: preset.fg, bg: preset.bg,
    dotsType: preset.dots, eyeFrame: preset.ef, eyeBall: preset.eb,
    colorType: preset.grad ? 'gradient' : 'single',
    fg2: ('gradTo' in preset ? preset.gradTo : qr.fg2) as string,
    _presetId: preset.id,
  }
}

export function QRPresetSwatch({ preset, size = 20 }: { preset: QRPreset; size?: number }) {
  const icon = Math.round(size * .7)
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 6, background: preset.bg, boxShadow: 'inset 0 0 0 1px rgba(17,17,19,.08)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={icon} height={icon} viewBox="0 0 14 14">
        {preset.dots === 'dots'
          ? ([2, 5, 8, 11] as number[]).flatMap((x) => ([2, 5, 8, 11] as number[]).map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill={preset.fg} />))
          : <>
            <rect x="1" y="1" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
            <rect x="10" y="1" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
            <rect x="1" y="10" width="3" height="3" rx={preset.dots === 'rounded' ? 1 : 0} fill={preset.fg} />
            {([[5, 2], [7, 4], [9, 6], [5, 7], [6, 9], [8, 9], [9, 11]] as [number, number][]).map(([x, y], index) => (
              <rect key={index} x={x} y={y} width="1.6" height="1.6" rx={preset.dots === 'rounded' ? .5 : 0} fill={preset.fg} />
            ))}
          </>}
      </svg>
    </span>
  )
}
