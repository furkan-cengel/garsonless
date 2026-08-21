import React from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AppIcons as I } from '../icons'

export interface LoyaltyCardShellProps {
  children: ReactNode
  background?: string
  foreground?: string
  accent?: string
  className?: string
  style?: CSSProperties
  onClick?: () => void
  ariaLabel?: string
}

export function LoyaltyCardShell({
  children,
  background = 'var(--p-accent, #1f5642)',
  foreground = '#fffdf7',
  accent = '#d7b06a',
  className,
  style,
  onClick,
  ariaLabel,
}: LoyaltyCardShellProps) {
  const shellStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    boxSizing: 'border-box',
    width: '100%',
    border: `1px solid color-mix(in srgb, ${accent} 70%, transparent)`,
    borderRadius: 20,
    background,
    color: foreground,
    boxShadow: `inset 0 0 0 5px ${background}, inset 0 0 0 6px color-mix(in srgb, ${accent} 72%, transparent)`,
    fontFamily: 'var(--p-body, inherit)',
    ...style,
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        data-loyalty-card-shell
        aria-label={ariaLabel}
        onClick={onClick}
        style={{ ...shellStyle, display: 'block', padding: 0, textAlign: 'left', cursor: 'pointer' }}
      >
        {children}
      </button>
    )
  }

  return <div className={className} data-loyalty-card-shell style={shellStyle}>{children}</div>
}

export interface LoyaltyStampGridProps {
  earnedStamps: number
  stampGoal: number
  rewardUnlocked?: boolean
  foreground?: string
  filledBackground?: string
  filledForeground?: string
  rewardColor?: string
  compact?: boolean
  className?: string
}

export function LoyaltyStampGrid({
  earnedStamps,
  stampGoal,
  rewardUnlocked = earnedStamps >= stampGoal,
  foreground = '#fffdf7',
  filledBackground = '#fffdf7',
  filledForeground = '#1f5642',
  rewardColor = '#d7b06a',
  compact = false,
  className,
}: LoyaltyStampGridProps) {
  const goal = Math.max(1, Math.floor(stampGoal))
  const earned = Math.max(0, Math.floor(earnedStamps))
  const filled = Math.min(goal, earned)
  const slotSize = compact ? 28 : 42
  const gap = compact ? 5 : 8

  return (
    <div
      className={className}
      role="list"
      aria-label={`${filled} / ${goal} sadakat damgası${rewardUnlocked ? ', ödül hazır' : ''}`}
      data-loyalty-stamp-grid
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(5, goal + 1)}, minmax(${compact ? 26 : 36}px, 1fr))`,
        gap,
      }}
    >
      {Array.from({ length: goal }, (_, index) => {
        const isFilled = index < filled
        const isNewest = isFilled && index === filled - 1 && !rewardUnlocked
        return (
          <span
            key={`stamp-${index}`}
            role="listitem"
            aria-label={`${index + 1}. damga: ${isFilled ? 'kazanıldı' : 'boş'}`}
            data-stamp-state={isFilled ? 'filled' : 'empty'}
            data-newest={isNewest ? 'true' : undefined}
            style={{
              width: '100%',
              maxWidth: slotSize,
              aspectRatio: '1',
              justifySelf: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              color: isFilled ? filledForeground : foreground,
              background: isFilled ? filledBackground : 'transparent',
              border: isFilled ? `1px solid color-mix(in srgb, ${filledBackground} 82%, transparent)` : `1.5px dashed color-mix(in srgb, ${foreground} 52%, transparent)`,
              boxShadow: isNewest ? `0 0 0 3px color-mix(in srgb, ${rewardColor} 55%, transparent)` : 'none',
              boxSizing: 'border-box',
            }}
          >
            {isFilled ? <I.coffee size={compact ? 13 : 19} strokeWidth={2.1} /> : <I.coffee size={compact ? 12 : 17} strokeWidth={1.6} style={{ opacity: .5 }} />}
          </span>
        )
      })}
      <span
        role="listitem"
        aria-label={`Ödül: ${rewardUnlocked ? 'hazır' : 'kilitli'}`}
        data-stamp-state={rewardUnlocked ? 'reward-ready' : 'reward-locked'}
        style={{
          width: '100%',
          maxWidth: slotSize,
          aspectRatio: '1',
          justifySelf: 'center',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          color: rewardUnlocked ? filledForeground : rewardColor,
          background: rewardUnlocked ? rewardColor : `color-mix(in srgb, ${rewardColor} 12%, transparent)`,
          border: `1.5px ${rewardUnlocked ? 'solid' : 'dashed'} color-mix(in srgb, ${rewardColor} 82%, transparent)`,
          boxShadow: rewardUnlocked ? `0 5px 16px color-mix(in srgb, ${rewardColor} 34%, transparent)` : 'none',
          boxSizing: 'border-box',
        }}
      >
        {rewardUnlocked ? <I.gift size={compact ? 13 : 19} strokeWidth={2.2} /> : <I.lock size={compact ? 12 : 17} strokeWidth={1.8} />}
      </span>
    </div>
  )
}
