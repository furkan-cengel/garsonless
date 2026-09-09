import { marketingMetadata, ORGANIZATION_ID, SOCIAL_IMAGE, serializeJsonLd } from '../../../lib/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { MarketingPage, PageHero } from '../../../components/MarketingPage'
import { BLOG_POSTS, getBlogPost, readBlogPostSource } from '../../../lib/blog'

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPost((await params).slug)
  if (!post) return {}
  return marketingMetadata({ title: `${post.title} | masabu`, description: post.description, canonical: `/blog/${post.slug}`, article: post })
}

export default async function BlogPostPage({ params }: Props) {
  const post = getBlogPost((await params).slug)
  if (!post) notFound()
  const source = await readBlogPostSource(post)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: 'tr-TR',
    author: { '@type': 'Organization', name: 'masabu' },
    publisher: { '@type': 'Organization', '@id': ORGANIZATION_ID, name: 'masabu', url: 'https://masabu.co' },
    image: SOCIAL_IMAGE.url,
    mainEntityOfPage: `https://masabu.co/blog/${post.slug}`,
  }

  return (
    <MarketingPage breadcrumbs={[{ name: 'Blog', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }]}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      <PageHero
        eyebrow={`${post.category} · ${post.readingTime}`}
        title={post.title}
        description={post.description}
      />
      <section className="blog-article-section">
        <article className="container blog-article">
          <p>masabu editör ekibi · Güncelleme: {new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(post.updatedAt))}</p>
          <MDXRemote source={source} />
        </article>
      </section>
    </MarketingPage>
  )
}
