import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ArSpikeClient from './ArSpikeClient'

// AR technical spike (work package 1): one static test model, no tenant data.
// Closed on production unless explicitly switched on, open on previews and locally.
export const metadata: Metadata = {
  title: '3D / AR teknik deneme',
  robots: { index: false, follow: false },
}

export default function ArSpikePage() {
  if (process.env['VERCEL_ENV'] === 'production' && process.env['AR_SPIKE_ENABLED'] !== '1') notFound()
  return <ArSpikeClient />
}
