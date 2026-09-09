import type { MetadataRoute } from 'next'
import { BLOG_POSTS } from '../lib/blog'

const PUBLIC_PATHS = [
  '', '/hakkimizda', '/fiyatlar', '/blog', '/iletisim',
  '/qr-menu', '/dijital-adisyon', '/qr-siparis', '/mutfak-ekrani',
] as const
const LEGAL_PATHS = [
  '/yasal',
  '/yasal/kvkk-aydinlatma-metni', '/yasal/gizlilik-politikasi',
  '/yasal/cerez-politikasi', '/yasal/kvkk-basvuru-yontemleri',
  '/yasal/abonelik-hizmet-sozlesmesi', '/yasal/mesafeli-hizmet-sozlesmesi',
  '/yasal/veri-isleme-eki', '/yasal/iptal-iade-ve-dijital-teslimat',
] as const

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPaths = [...PUBLIC_PATHS, ...LEGAL_PATHS]
  return [
    ...staticPaths.map((path) => ({
      url: `https://masabu.co${path}`,
    })),
    ...BLOG_POSTS.map((post) => ({
      url: `https://masabu.co/blog/${post.slug}`,
      lastModified: new Date(post.updatedAt),
    })),
  ]
}
