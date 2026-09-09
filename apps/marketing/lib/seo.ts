import type { Metadata } from 'next'
import { LEGAL_IDENTITY } from './legal-identity'

export const SITE_ORIGIN = 'https://masabu.co'
export const SITE_TITLE = 'QR Menü ve Restoran Yönetim Sistemi | masabu'
export const SITE_DESCRIPTION = 'Kafe ve restoranınızda QR menü, dijital adisyon, masadan sipariş ve mutfak ekranını tek sistemde yönetin. 14 gün Pro özelliklerini ücretsiz deneyin.'
export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`
export const SOCIAL_IMAGE = { url: `${SITE_ORIGIN}/og-image.png`, width: 1200, height: 630, alt: 'masabu — QR menüden restoran operasyonuna' }

export function marketingMetadata(input: {
  title: string
  description: string
  canonical: string
  article?: { publishedAt: string; updatedAt: string }
}): Metadata {
  const { title, description, canonical, article } = input
  const url = new URL(canonical, SITE_ORIGIN).toString()
  return {
    title, description,
    alternates: { canonical },
    openGraph: {
      title, description, url, siteName: 'masabu', locale: 'tr_TR',
      images: [SOCIAL_IMAGE],
      ...(article ? { type: 'article', publishedTime: article.publishedAt, modifiedTime: article.updatedAt } : { type: 'website' }),
    },
    twitter: { card: 'summary_large_image', title, description, images: [SOCIAL_IMAGE] },
  }
}

export function organizationGraph() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': ORGANIZATION_ID,
        name: LEGAL_IDENTITY.brand, legalName: LEGAL_IDENTITY.proprietor,
        url: SITE_ORIGIN, description: SITE_DESCRIPTION,
        logo: `${SITE_ORIGIN}/android-chrome-512x512.png`,
        email: LEGAL_IDENTITY.generalEmail,
        ...(LEGAL_IDENTITY.phone ? { telephone: LEGAL_IDENTITY.phone } : {}),
        // Add sameAs only after ownership of each public profile is verified.
      },
      { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, name: 'masabu', url: SITE_ORIGIN, inLanguage: 'tr-TR', publisher: { '@id': ORGANIZATION_ID } },
    ],
  }
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
