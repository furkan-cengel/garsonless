export { LEGAL_DOCUMENT_VERSION } from '@garsonless/domain/legal'

export const LEGAL_IDENTITY = {
  brand: 'Masabu',
  proprietor: 'Mustafa Furkan Çengel',
  publicName: 'Masabu markasıyla faaliyet gösteren Mustafa Furkan Çengel şahıs işletmesi',
  entityType: 'Şahıs işletmesi',
  taxOffice: 'Kartal Vergi Dairesi',
  taxNumber: '2420625143',
  address: 'Cevizli Mah. Zuhal Cad. A Blok No: 46 İç Kapı No: 50, Maltepe/İstanbul',
  generalEmail: 'bilgi@masabu.co',
  supportEmail: 'destek@masabu.co',
  privacyEmail: 'bilgi@masabu.co',
  phone: process.env['NEXT_PUBLIC_BUSINESS_PHONE']?.trim() || null,
  kep: process.env['NEXT_PUBLIC_BUSINESS_KEP']?.trim() || null,
} as const

export function missingLegalReleaseFields(): string[] {
  return [
    !LEGAL_IDENTITY.phone ? 'NEXT_PUBLIC_BUSINESS_PHONE' : null,
  ].filter((value): value is string => value !== null)
}

export const LEGAL_DOCS_APPROVED = process.env['LEGAL_DOCS_APPROVED'] === 'true'
