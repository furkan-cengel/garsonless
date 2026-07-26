import React from 'react'
import type { SVGProps } from 'react'

export const CHEF_SECTION_ICON_OPTIONS = [
  { value: 'catal-kasik', label: 'Çatal kaşık' },
  { value: 'sef-sapkasi', label: 'Şef şapkası' },
  { value: 'sef-bicagi', label: 'Şef bıçağı' },
  { value: 'servis-kapagi', label: 'Servis kapağı' },
  { value: 'siparis-zili', label: 'Sipariş zili' },
  { value: 'tabaklama', label: 'Tabaklama' },
  { value: 'ates', label: 'Ateş' },
  { value: 'tava', label: 'Tava' },
  { value: 'tencere', label: 'Tencere' },
  { value: 'firin', label: 'Fırın' },
  { value: 'cirpici', label: 'Çırpıcı' },
  { value: 'oklava', label: 'Oklava' },
  { value: 'kesme-tahtasi', label: 'Kesme tahtası' },
  { value: 'malzemeler', label: 'Malzemeler' },
  { value: 'tarif', label: 'Tarif' },
  { value: 'zamanlayici', label: 'Zamanlayıcı' },
] as const

export type ChefSectionIconName = (typeof CHEF_SECTION_ICON_OPTIONS)[number]['value']

export function isChefSectionIconName(value: string): value is ChefSectionIconName {
  return CHEF_SECTION_ICON_OPTIONS.some((option) => option.value === value)
}

export function ChefSectionIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: ChefSectionIconName }) {
  const common = {
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
    focusable: false,
    ...props,
  } as const

  switch (name) {
    case 'ates': return <svg {...common}><path d="M13 2.5c1 4-2 5-1 8 1.5-1 2.5-2.5 2-4 4 2.5 6 6 4.5 10A7 7 0 0 1 5 15c-.6-3.2 1.2-6 4-8-.3 2 .2 3.5 1.5 4.5-.5-4 1-6.5 2.5-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 13c2 2 2 4 0 6-2-1-3-4 0-6Z" fill="currentColor"/></svg>
    case 'catal-kasik': return <svg {...common}><path d="M6 3v6a3 3 0 0 0 3 3V3M7.5 3v17M16.5 20v-8M16.5 12c-2 0-3.5-1.8-3.5-4s1.5-5 3.5-5S20 5.8 20 8s-1.5 4-3.5 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    case 'cirpici': return <svg {...common}><path d="m6 19 5-7M8 20l4-7M6.5 19.5l-2 2M11 12c-2-4-1-8 1-9 1.5 2.5 2 5.5 0 10M12 13c3-2 5-5 5-8-3 0-6 3-6 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
    case 'firin': return <svg {...common}><rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M4 8.5h16" stroke="currentColor" strokeWidth="1.8"/><circle cx="8" cy="6" r="1" fill="currentColor"/><circle cx="12" cy="6" r="1" fill="currentColor"/><rect x="7" y="12" width="10" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg>
    case 'kesme-tahtasi': return <svg {...common}><rect x="5" y="3.5" width="14" height="17" rx="3" stroke="currentColor" strokeWidth="1.8"/><circle cx="15.5" cy="7" r="1.3" fill="currentColor"/><path d="M8 17 16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    case 'malzemeler': return <svg {...common}><path d="M5 10h14l-1.5 10h-11L5 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 10C7 7 8 4.5 11 3c.5 3-1 5.5-3 7ZM13 10c0-2.5 2-4.5 5-5-.2 3-2 4.5-5 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
    case 'oklava': return <svg {...common}><path d="m6.5 17.5 11-11M5 19l-2 2M19 5l2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><rect x="6.5" y="6" width="11" height="5" rx="2.5" transform="rotate(-45 6.5 6)" stroke="currentColor" strokeWidth="1.8"/></svg>
    case 'sef-bicagi': return <svg {...common}><path d="M4 14 18.5 3.5c1.4 5.5-1.2 10.5-7 12.5L4 14Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="m4 14-1.5 3 4.5 4.5 3-1.5-6-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>
    case 'sef-sapkasi': return <svg {...common}><path d="M7 10a4 4 0 0 1 1.5-7.7A4.5 4.5 0 0 1 16 3.5 3.5 3.5 0 0 1 17 10v7H7v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M7 14h10M9.5 17v-4M14.5 17v-4M7 20h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    case 'servis-kapagi': return <svg {...common}><path d="M4 16a8 8 0 0 1 16 0H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M2.5 19h19M10 7h4M12 7V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    case 'siparis-zili': return <svg {...common}><path d="M4 16a8 8 0 0 1 16 0H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M2.5 19h19M10 7h4M12 7V5M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    case 'tabaklama': return <svg {...common}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6" opacity=".65"/><path d="m9.5 13.5 2-3 3 1.5-1 3-4-1.5Z" fill="currentColor" opacity=".3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
    case 'tarif': return <svg {...common}><path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M15 3.5V8h4M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/></svg>
    case 'tava': return <svg {...common}><circle cx="9" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.8"/><path d="m13.5 8.5 5-5a1.4 1.4 0 0 1 2 2l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="9" cy="12" r="2" fill="currentColor" opacity=".25"/></svg>
    case 'tencere': return <svg {...common}><path d="M5 9h14l-1 10H6L5 9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M3 10h2M19 10h2M8 6h8M12 6V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
    case 'zamanlayici': return <svg {...common}><circle cx="12" cy="13" r="7.5" stroke="currentColor" strokeWidth="1.8"/><path d="M9 3h6M12 3v2.5M17.5 7.5 19 6M12 9v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
}
