import { BLOG_POSTS } from '../../../lib/blog'

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

export function GET() {
  const items = BLOG_POSTS.map((post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>https://masabu.co/blog/${post.slug}</link>
      <guid>https://masabu.co/blog/${post.slug}</guid>
      <description>${escapeXml(post.description)}</description>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(post.category)}</category>
    </item>`).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0"><channel>
    <title>Masabu Blog</title>
    <link>https://masabu.co/blog</link>
    <description>QR menü ve restoran operasyonu rehberleri.</description>
    <language>tr-TR</language>${items}
  </channel></rss>`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
