'use client'

import { useState } from 'react'
import { MI } from '../lib/icons'
import { SectionHead } from './ui/SectionHead'

const FAQ_ITEMS = [
  { q: 'Kurulum ne kadar sürer?', a: "Ortalama 2 dakika. Mağazanı oluşturuyorsun, menünü yükleyebiliyor (CSV/Yemeksepeti/Trendyol'dan içe aktarma destekli) ve QR kodlarını yazdırıyorsun. Yardıma ihtiyacın olursa Türkçe ekibimiz 7/24 yanında." },
  { q: 'Mevcut POS sistemimle çalışır mı?', a: "Evet — iyzico, Vallet, Logo, Mikro ve Netsis ile direkt entegre. Webhook + API ile her POS'a bağlanabilirsin. Sipariş Tezgah'a düşer, hesabı garsonless üzerinden alabilirsin." },
  { q: 'Sipariş başı komisyon var mı?', a: "Yok. Bizden alınan tek ücret aylık abonelik. Ödeme komisyonu doğrudan iyzico'ya gider (kart için %1,8 + ₺2,5). Nakit ödemeler tamamen sizin." },
  { q: 'Müşterilerimin uygulama indirmesi gerekir mi?', a: "Hayır. QR'ı tarayınca tarayıcıda menü açılır. iOS, Android, hatta tuşlu telefonların tarayıcısında bile çalışır." },
  { q: 'Bir mağazadan fazla mı yöneteceğim?', a: "Pro plan 3'e kadar, Business sınırsız mağaza destekler. Tek kullanıcıyla hepsini geziniyor, hangi şubenin nasıl çalıştığını tek panoda görebiliyorsun." },
  { q: 'Verilerim güvende mi?', a: "Türkiye'de sunucularımızda barındırılır, KVKK uyumludur. SOC 2 Type II sertifikalıdır. Otomatik günlük yedek + 90 gün geri yükleme." },
  { q: 'İptal etmek istersem?', a: "Tek tıkla iptal et. Verilerini dışa aktarmak için 60 günün var. Hiç kalan sayfa yok — kredi kartınız basılan tutardan başka hiçbir şeyle silinmez." },
]

function FAQItem({ item, open, onClick }: { item: typeof FAQ_ITEMS[0]; open: boolean; onClick: () => void }) {
  return (
    <div style={{ background: open ? 'var(--surface)' : 'transparent', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', transition: 'background 200ms' }}>
      <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '20px 24px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>
        <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em' }}>{item.q}</span>
        <span style={{ width: 28, height: 28, borderRadius: 999, background: open ? 'var(--ink)' : 'var(--bg-2)', color: open ? '#fff' : 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 200ms', flexShrink: 0, marginLeft: 16 }}>
          {open ? <MI.x size={14} /> : <MI.plus size={14} />}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 24px 22px', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.65 }}>{item.a}</div>
      )}
    </div>
  )
}

export function FAQSection() {
  const [open, setOpen] = useState(0)

  return (
    <section style={{ padding: '120px 0', background: 'var(--bg)' }}>
      <div className="container" style={{ maxWidth: 880 }}>
        <SectionHead
          eyebrow="SSS"
          title={<>Aklındaki <em style={{ fontStyle: 'italic', color: 'var(--brand)' }}>sorular</em>.</>}
          sub="Burada cevabını bulamadın mı? Bize yaz — 5 dakikada dönelim."
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQ_ITEMS.map((item, i) => (
            <FAQItem key={i} item={item} open={open === i} onClick={() => setOpen(open === i ? -1 : i)} />
          ))}
        </div>
      </div>
    </section>
  )
}
