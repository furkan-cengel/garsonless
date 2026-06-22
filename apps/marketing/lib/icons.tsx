import type { ReactNode, ReactElement } from 'react'

interface IcoProps {
  d: ReactNode
  size?: number
  sw?: number
  fill?: string
}

function MIco({ d, size = 18, sw = 1.6, fill = 'none' }: IcoProps) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {typeof d === 'string' ? <path d={d} /> : d}
    </svg>
  )
}

type IconComponent = (props?: { size?: number }) => ReactElement

function icon(d: ReactNode, defaults?: Partial<IcoProps>): IconComponent {
  return function Icon({ size }: { size?: number } = {}) {
    return <MIco d={d} size={size ?? defaults?.size ?? 18} sw={defaults?.sw ?? 1.6} fill={defaults?.fill ?? 'none'} />
  }
}

export const MI = {
  arrow:     icon('M5 12h14M13 6l6 6-6 6'),
  arrowDown: icon('M12 5v14M6 13l6 6 6-6'),
  check:     icon('m5 12 5 5 9-11', { sw: 2 }),
  x:         icon('m6 6 12 12M18 6 6 18'),
  play:      icon(<polygon points="6,4 20,12 6,20" fill="currentColor" stroke="none" />),
  star:      icon(<path d="m12 3 2.6 5.3 5.9.9-4.3 4.2 1 5.8L12 16.5 6.8 19.2l1-5.8L3.5 9.2l5.9-.9L12 3Z" fill="currentColor" stroke="none" />),
  qr:        icon(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM18 18h3v3h-3z" /></>),
  cutlery:   icon(<><path d="M5 3v8a2 2 0 0 0 2 2v8" /><path d="M9 3v8a2 2 0 0 1-2 2" /><path d="M16 3c-1.5 1.5-2.5 3.5-2.5 6 0 2 1 3 2.5 3v9" /></>),
  cart:      icon(<><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.5L20.5 8H6" /><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /></>),
  palette:   icon(<><circle cx="12" cy="12" r="9" /><circle cx="8.5" cy="10" r=".8" fill="currentColor" /><circle cx="12" cy="7.5" r=".8" fill="currentColor" /><circle cx="15.5" cy="10" r=".8" fill="currentColor" /><circle cx="16" cy="14" r=".8" fill="currentColor" /><path d="M12 21a3 3 0 0 1 0-6h1.5a2 2 0 0 0 0-4" /></>),
  chart:     icon(<><path d="M3 21h18" /><rect x="5" y="13" width="3" height="6" rx=".5" /><rect x="10.5" y="9" width="3" height="10" rx=".5" /><rect x="16" y="5" width="3" height="14" rx=".5" /></>),
  bolt:      icon(<path d="M13 2 4 14h7l-1 8 9-12h-7Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />),
  shield:    icon(<><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6Z" /><path d="m9 12 2 2 4-4" /></>),
  globe:     icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  sparkles:  icon('M12 3v3M12 18v3M3 12h3M18 12h3M6.5 6.5l2 2M15.5 15.5l2 2M6.5 17.5l2-2M15.5 8.5l2-2'),
  hand:      icon('M7 11V5a2 2 0 1 1 4 0v6M11 11V4a2 2 0 1 1 4 0v8M15 12V6a2 2 0 1 1 4 0v9a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-2l-2-3a2 2 0 0 1 3-2l3 4'),
  bell:      icon(<><path d="M6 10a6 6 0 0 1 12 0v3l1.5 3h-15L6 13Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>),
  phone:     icon(<><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>),
  layout:    icon(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 10h18M10 10v11" /></>),
  printer:   icon(<><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><rect x="7" y="15" width="10" height="6" /></>),
  zap:       icon('M13 2 4 14h7l-1 8 9-12h-7Z'),
  plus:      icon('M12 5v14M5 12h14', { sw: 2 }),
  menu:      icon('M4 7h16M4 12h16M4 17h16'),
  chevDown:  icon('m6 9 6 6 6-6'),
  chevR:     icon('m9 6 6 6-6 6'),
  ext:       icon('M14 4h6v6M10 14 20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6'),
  ig:        icon(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" /></>),
  tw:        icon(<path d="M4 4l7.5 9L4.5 20h2.5l5.5-5.7L17 20h3l-7.7-9.4L19.5 4H17l-5 5.4L8 4Z" fill="currentColor" stroke="none" />),
  lk:        icon(<><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M7 10v7M7 7v.01M11 10v7M11 13a2 2 0 0 1 4 0v4" /></>),
}
