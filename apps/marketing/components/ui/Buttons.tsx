'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Size = 'sm' | 'md' | 'lg'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  size?: Size
  dark?: boolean
}

export function PrimaryButton({ children, size = 'md', dark, style, ...rest }: PrimaryButtonProps) {
  const padding = size === 'lg' ? '14px 22px' : size === 'sm' ? '8px 14px' : '11px 18px'
  const fontSize = size === 'lg' ? 15.5 : size === 'sm' ? 13 : 14
  return (
    <button
      {...rest}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding, fontSize, fontWeight: 600,
        border: 'none', borderRadius: 999,
        background: dark ? 'var(--night)' : 'var(--ink)',
        color: dark ? 'var(--accent-2)' : '#fff',
        cursor: 'pointer', letterSpacing: '-0.005em',
        boxShadow: dark
          ? '0 1px 0 rgba(255,255,255,.06) inset, 0 6px 20px -8px rgba(0,0,0,.45)'
          : '0 1px 0 rgba(255,255,255,.1) inset, 0 4px 14px -4px rgba(28,24,20,.35)',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
        ...style,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {children}
    </button>
  )
}

interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  size?: Size
}

export function GhostButton({ children, size = 'md', style, ...rest }: GhostButtonProps) {
  const padding = size === 'lg' ? '14px 22px' : '11px 18px'
  const fontSize = size === 'lg' ? 15.5 : 14
  return (
    <button
      {...rest}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding, fontSize, fontWeight: 600,
        border: '1.5px solid var(--ink)',
        borderRadius: 999, background: 'transparent', color: 'var(--ink)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
