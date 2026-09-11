import Link from 'next/link'
import { Fragment } from 'react'
import { ChevronRight, House } from 'lucide-react'
import { SITE_ORIGIN, serializeJsonLd } from '../lib/seo'

export type Breadcrumb = { name: string; path: string }

export function Breadcrumbs({ items }: { items: readonly Breadcrumb[] }) {
  const trail = [{ name: 'Ana sayfa', path: '/' }, ...items]
  const data = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem', position: index + 1, name: item.name,
      item: new URL(item.path, SITE_ORIGIN).toString(),
    })),
  }
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
    <nav aria-label="Sayfa yolu" data-slot="breadcrumb" className="container seo-breadcrumbs">
      <ol data-slot="breadcrumb-list">{trail.map((item, index) => <Fragment key={item.path}>
        {index > 0 && <li data-slot="breadcrumb-separator" role="presentation" aria-hidden="true"><ChevronRight /></li>}
        <li data-slot="breadcrumb-item">
          {index === trail.length - 1
            ? <span data-slot="breadcrumb-page" aria-current="page">{item.name}</span>
            : <Link data-slot="breadcrumb-link" href={item.path}>{index === 0 && <House aria-hidden="true" />}{item.name}</Link>}
        </li>
      </Fragment>)}</ol>
    </nav>
  </>
}
