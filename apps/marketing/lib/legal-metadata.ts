import type { Metadata } from 'next'
import { marketingMetadata } from './seo'

export function legalMetadata(title: string, description: string, canonical: string): Metadata {
  return { ...marketingMetadata({ title: `${title} | masabu`, description, canonical }), robots: { index: true, follow: true } }
}
