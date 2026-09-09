import Link from 'next/link'
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
    <nav aria-label="Sayfa yolu" className="container seo-breadcrumbs">
      <ol>{trail.map((item, index) => <li key={item.path}>
        {index === trail.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.path}>{item.name}</Link>}
      </li>)}</ol>
    </nav>
  </>
}
