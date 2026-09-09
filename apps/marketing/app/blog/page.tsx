import type { Metadata } from 'next'
import { marketingMetadata } from '../../lib/seo'
import { MarketingPage, PageHero } from '../../components/MarketingPage'
import { BLOG_POSTS } from '../../lib/blog'

export const metadata: Metadata = marketingMetadata({
  title: 'Blog | masabu',
  description: 'QR menü, menü yönetimi ve restoran operasyonu hakkında uygulanabilir rehberler.',
  canonical: '/blog',
})
metadata.alternates = { ...metadata.alternates, types: { 'application/rss+xml': '/blog/rss.xml' } }

const dateFormatter = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function BlogPage() {
  return (
    <MarketingPage breadcrumbs={[{ name: 'Blog', path: '/blog' }]}>
      <PageHero
        eyebrow="Blog"
        title="Restoran operasyonu için uygulanabilir notlar."
        description="QR menü kurulumundan ürün ve sipariş akışına kadar, doğrudan işletmede kullanabileceğiniz rehberler."
      />
      <section className="editorial-section">
        <div className="container blog-grid">
          {BLOG_POSTS.map((post) => (
            <a className="blog-card" href={`/blog/${post.slug}`} key={post.slug}>
              <div className="blog-card__meta">
                <span>{post.category}</span><span>·</span><span>{post.readingTime}</span>
              </div>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
              <span className="blog-card__link">{dateFormatter.format(new Date(post.publishedAt))} · Oku →</span>
            </a>
          ))}
        </div>
      </section>
    </MarketingPage>
  )
}
