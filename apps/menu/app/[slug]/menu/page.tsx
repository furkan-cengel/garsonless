import type { Metadata } from 'next'
import { menuSearchMetadata } from '../../../lib/search-metadata'
import { renderMenuExperience } from '../_menu-experience'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  return menuSearchMetadata((await params).slug, true)
}

export default async function PermanentMenuPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  return renderMenuExperience({ slug, sp })
}
