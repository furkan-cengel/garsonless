import type { GarsonlessTheme } from '@garsonless/design-engine'

export const TAG_SHIMMER_SCOPE_CLASS = 'garsonless-tag-shimmer-enabled'
export const TAG_SHIMMER_TARGET_CLASS = 'garsonless-tag-shimmer-target'

type TagShimmerTheme = Pick<GarsonlessTheme, 'motion' | 'tagShimmer'>

export function tagShimmerScopeClass(theme?: TagShimmerTheme): string | undefined {
  return theme?.tagShimmer === true && theme.motion !== 'none'
    ? TAG_SHIMMER_SCOPE_CLASS
    : undefined
}

/** One shared, decorative sweep for every promotional tag surface. */
export const TAG_SHIMMER_CSS = `
  @keyframes garsonless-tag-shimmer-sweep {
    0%, 58% {
      opacity: 0;
      transform: translate3d(-185%, 0, 0) skewX(-18deg);
    }
    64% { opacity: .3; }
    74% { opacity: .92; }
    86%, 100% {
      opacity: 0;
      transform: translate3d(360%, 0, 0) skewX(-18deg);
    }
  }
  .${TAG_SHIMMER_SCOPE_CLASS} .${TAG_SHIMMER_TARGET_CLASS} {
    position: relative;
    isolation: isolate;
    overflow: hidden;
  }
  .${TAG_SHIMMER_SCOPE_CLASS} .${TAG_SHIMMER_TARGET_CLASS}::after {
    content: '';
    position: absolute;
    z-index: 2;
    top: -55%;
    bottom: -55%;
    left: -34%;
    width: 34%;
    border-radius: inherit;
    background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,.12) 24%, rgba(255,255,255,.86) 50%, rgba(255,255,255,.14) 76%, transparent 100%);
    filter: blur(.35px);
    mix-blend-mode: screen;
    pointer-events: none;
    animation: garsonless-tag-shimmer-sweep 3.6s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .${TAG_SHIMMER_SCOPE_CLASS} .${TAG_SHIMMER_TARGET_CLASS}::after {
      display: none;
      animation: none !important;
    }
  }
`
