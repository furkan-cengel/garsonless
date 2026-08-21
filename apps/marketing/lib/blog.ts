import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type BlogPost = {
  slug: string
  title: string
  description: string
  category: string
  publishedAt: string
  updatedAt: string
  readingTime: string
  sourceFile: string
}

export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: 'qr-menu-kurulum-rehberi',
    title: 'QR menü nasıl kurulur? Restoranlar için başlangıç rehberi',
    description: 'Ürün hazırlığından masa QR’larına ve yayına kadar sürdürülebilir bir dijital menü kurulum akışı.',
    category: 'Rehber',
    publishedAt: '2026-08-15',
    updatedAt: '2026-08-15',
    readingTime: '7 dk',
    sourceFile: 'qr-menu-kurulum-rehberi.mdx',
  },
  {
    slug: 'menu-muhendisligi-urun-fiyat-yonetimi',
    title: 'Menü mühendisliği: ürün, fiyat ve seçenekleri yönetmek',
    description: 'Menüyü yalnız bir fiyat listesi değil, karar vermeyi kolaylaştıran canlı bir işletme aracı olarak düzenlemek.',
    category: 'Menü yönetimi',
    publishedAt: '2026-08-15',
    updatedAt: '2026-08-15',
    readingTime: '8 dk',
    sourceFile: 'menu-muhendisligi-urun-fiyat-yonetimi.mdx',
  },
  {
    slug: 'siparisten-mutfaga-operasyon-akisi',
    title: 'Siparişten mutfağa: dağınık restoran akışını toparlamak',
    description: 'Masa, sipariş, hazırlık ve tahsilat durumlarını tek kayıt etrafında birleştiren operasyon yaklaşımı.',
    category: 'Operasyon',
    publishedAt: '2026-08-15',
    updatedAt: '2026-08-15',
    readingTime: '7 dk',
    sourceFile: 'siparisten-mutfaga-operasyon-akisi.mdx',
  },
] as const

export function getBlogPost(slug: string): BlogPost | null {
  return BLOG_POSTS.find((post) => post.slug === slug) ?? null
}

export async function readBlogPostSource(post: BlogPost): Promise<string> {
  const directory = path.join(process.cwd(), 'content', 'blog')
  const target = path.join(directory, post.sourceFile)
  if (!target.startsWith(`${directory}${path.sep}`)) throw new Error('Blog source path is invalid')
  return readFile(target, 'utf8')
}
