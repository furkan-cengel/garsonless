import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://masabu.co/sitemap.xml',
    host: 'https://masabu.co',
  }
}
