import { MI } from '../lib/icons'
import { SectionHead } from './ui/SectionHead'

const STORIES = [
  {
    quote: 'Açtığımız ilk hafta personel 3 kişiydi, şimdi 2. Müşteri memnuniyeti arttı, biz daha çok mutfakla ilgileniyoruz.',
    name: 'Defne Aksoy', role: 'MAF Cafe Lounge · Kurucu', avatar: 'DA',
    color: 'linear-gradient(135deg, #ffd089 0%, #ff8b6b 100%)',
    metric: { label: 'Sipariş süresi', value: '−38%' },
    rating: 5, tint: '#fdf6ec',
  },
  {
    quote: 'Sıkışık günlerde sipariş kuyruğunda kaybolmayı bıraktık. Mutfak ekranı sayesinde herkes önceliği görüyor.',
    name: 'Burak Kaplan', role: 'Petra Coffee · İşletmeci', avatar: 'BK',
    color: 'linear-gradient(135deg, #a4f7c8 0%, #4caf7f 100%)',
    metric: { label: 'Aylık ciro', value: '+%24' },
    rating: 5, tint: '#eaf3ed',
  },
  {
    quote: "QR'ları yazdırıp koyduğumuz akşam sahnedeydim. Akşamın sonunda 'Bu nasıl bu kadar hızlı?' diye sordular.",
    name: 'Ayşegül Tan', role: 'Mor Köşe · Sahibe', avatar: 'AT',
    color: 'linear-gradient(135deg, #c4d0ff 0%, #6e87e5 100%)',
    metric: { label: 'Kurulum süresi', value: '12 dk' },
    rating: 5, tint: '#e7eef8',
  },
]

function StoryCard({ story }: { story: typeof STORIES[0] }) {
  return (
    <article style={{ background: 'var(--surface)', borderRadius: 18, padding: 28, border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: `radial-gradient(circle, ${story.tint}, transparent 65%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', gap: 2, position: 'relative' }}>
        {Array(story.rating).fill(0).map((_, i) => (
          <span key={i} style={{ color: '#f0b429' }}><MI.star size={16} /></span>
        ))}
      </div>
      <blockquote className="font-display" style={{ fontSize: 19, fontWeight: 500, fontStyle: 'italic', lineHeight: 1.4, letterSpacing: '-.01em', margin: 0, color: 'var(--ink)', flex: 1, position: 'relative' }}>
        &ldquo;{story.quote}&rdquo;
      </blockquote>
      <div style={{ padding: '14px 16px', background: 'var(--bg-2)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 500 }}>{story.metric.label}</span>
        <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 19, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.02em' }}>{story.metric.value}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        <div style={{ width: 40, height: 40, borderRadius: 999, background: story.color, color: 'var(--ink)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{story.avatar}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{story.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{story.role}</div>
        </div>
      </div>
    </article>
  )
}

export function TestimonialsSection() {
  return (
    <section id="hikayeler" style={{ padding: '120px 0', background: 'var(--bg-2)' }}>
      <div className="container">
        <SectionHead
          eyebrow="Hikayeler"
          title={<>&quot;Sayılarla değil, <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>yüzlerle</em> sevindik.&quot;</>}
          sub="2 400+ mekan kullanıyor — ve bize neden seçtiklerini paylaşıyorlar."
          tone="warm"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {STORIES.map((s, i) => <StoryCard key={i} story={s} />)}
        </div>
      </div>
    </section>
  )
}
