import type { Metadata } from 'next'

export function legalMetadata(title: string, description: string, canonical: string): Metadata {
  return {
    title: `${title} | masabu`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
  }
}
