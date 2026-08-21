import type { Metadata } from 'next'

export function legalMetadata(title: string, description: string, canonical: string): Metadata {
  return {
    title: `${title} | Masabu`,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
  }
}
