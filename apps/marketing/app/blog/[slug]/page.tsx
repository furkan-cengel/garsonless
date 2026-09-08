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
  return {
    title: `${post.title} | masabu`,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: `https://masabu.co/blog/${post.slug}`,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
  }
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
    publisher: { '@type': 'Organization', name: 'masabu', url: 'https://masabu.co' },
    mainEntityOfPage: `https://masabu.co/blog/${post.slug}`,
  }

  return (
    <MarketingPage>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <PageHero
        eyebrow={`${post.category} · ${post.readingTime}`}
        title={post.title}
        description={post.description}
      />
      <section className="blog-article-section">
        <article className="container blog-article">
          <MDXRemote source={source} />
        </article>
      </section>
    </MarketingPage>
  )
}
