import type { ReactNode } from 'react'
import { requireSection } from '../../../../../lib/auth/access'

export default async function OrderStandsLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ restaurantId: string }>
}) {
  const { restaurantId } = await params
  await requireSection(restaurantId, 'tables')
  return children
}

