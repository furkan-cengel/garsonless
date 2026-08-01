import type { CSSProperties } from 'react'

interface MenuMorphIconProps {
  open: boolean
  size?: number
}

const lineBase: CSSProperties = {
  transformBox: 'fill-box',
  transformOrigin: 'center',
  transitionProperty: 'transform',
  transitionTimingFunction: 'cubic-bezier(.4, 0, .2, 1)',
}

/**
 * A single control state that morphs from menu to close and back. The middle
 * stroke retracts towards the right on open, then redraws right-to-left on
 * close so the motion follows the drawer's travel direction.
 */
export function MenuMorphIcon({ open, size = 22 }: MenuMorphIconProps) {
  const diagonalTransition: CSSProperties = {
    ...lineBase,
    transitionDuration: '260ms',
    transitionDelay: open ? '65ms' : '0ms',
  }
  const middleTransition: CSSProperties = {
    ...lineBase,
    transformOrigin: 'right center',
    transitionDuration: open ? '150ms' : '170ms',
    transitionDelay: open ? '0ms' : '90ms',
  }

  return (
    <svg
      data-menu-morph-icon
      data-open={open}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <line
        x1="4"
        y1="7"
        x2="20"
        y2="7"
        style={{
          ...diagonalTransition,
          transform: open ? 'translateY(5px) rotate(45deg)' : 'translateY(0) rotate(0)',
        }}
      />
      <line
        x1="4"
        y1="12"
        x2="20"
        y2="12"
        style={{
          ...middleTransition,
          transform: open ? 'scaleX(0)' : 'scaleX(1)',
        }}
      />
      <line
        x1="4"
        y1="17"
        x2="20"
        y2="17"
        style={{
          ...diagonalTransition,
          transform: open ? 'translateY(-5px) rotate(-45deg)' : 'translateY(0) rotate(0)',
        }}
      />
    </svg>
  )
}
