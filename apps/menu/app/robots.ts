import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const origin = (process.env.NEXT_PUBLIC_MENU_URL ?? 'https://menu.masabu.co').replace(/\/$/, '')
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/auth/'],
    }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
