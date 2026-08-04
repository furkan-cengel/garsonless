import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getRestaurantBySlug } from '../../../lib/queries'
import { renderMenuExperience } from '../_menu-experience'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { slug } = await params
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) notFound()
  const origin = (process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011').replace(/\/$/, '')
  return {
    title: `${restaurant.name} Menü`,
    alternates: { canonical: `${origin}/${encodeURIComponent(slug)}/menu` },
  }
}

export default async function PermanentMenuPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  return renderMenuExperience({ slug, sp })
}
