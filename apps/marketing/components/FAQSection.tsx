'use client'

import { useId, useState } from 'react'
import { MI } from '../lib/icons'

const FAQ_ITEMS = [
  {
    q: 'Misafirlerin uygulama indirmesi gerekir mi?',
    a: 'Hayır. Misafir masadaki QR kodu taradığında menü doğrudan telefonunun tarayıcısında açılır; ürünleri inceleyip sipariş akışını buradan tamamlar.',
  },
  {
    q: '14 günlük deneme nasıl çalışır?',
    a: 'Yeni işletme 14 gün boyunca Pro özelliklerini deneyebilir. Bu sürenin sonunda abonelik başlamazsa işletme ücretsiz plana döner ve menü ile işletme verileri korunur.',
  },
  {
    q: 'Mutfak ekranında neleri takip edebilirim?',
    a: 'Pro planda siparişleri istasyon ve hazırlık durumlarına göre izleyebilir; hazırlanan, hazır ve geciken siparişleri mutfak akışında takip edebilirsin.',
  },
  {
    q: 'Menüde ürünleri ne kadar özelleştirebilirim?',
    a: 'Ürün görselleri, varyant ve porsiyonlar, ekstra seçimleri, alerjen ve diyet bilgileri, ilgili ürün önerileri, kategori ve mutfak istasyonu gibi alanları panelden yönetebilirsin.',
  },
  {
    q: 'Hangi tahsilat akışları destekleniyor?',
    a: 'İyzico yapılandırıldığında çevrimiçi kart ödemesi alınabilir. Nakit, fiziksel POS ve ikram gibi personel tahsilatları ise masa kapatma akışında panel üzerinden işlenir.',
  },
  {
    q: 'Birden fazla işletmeyi yönetebilir miyim?',
    a: 'Çoklu işletme yönetimi plan kapsamına göre kullanılabilir. Her işletmenin menü, masa, ekip ve raporları kendi çalışma alanında tutulur.',
  },
  {
    q: 'Aboneliği sürdürmezsem verilerime ne olur?',
    a: 'İşletme ücretsiz plana döner; menü ve işletme verileri korunur. Pro özelliklerine erişim plan kapsamına göre kapanır.',
  },
]

function FAQItem({
  item,
  open,
  onClick,
}: {
  item: (typeof FAQ_ITEMS)[number]
  open: boolean
  onClick: () => void
}) {
  const id = useId()
  const panelId = `faq-panel-${id}`
  const buttonId = `faq-button-${id}`

  return (
    <article className="faq-item" data-open={open}>
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onClick}
        >
          <span>{item.q}</span>
          <i aria-hidden="true"><MI.plus size={15} /></i>
        </button>
      </h3>
      <div
        id={panelId}
        className="faq-item__answer"
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
      >
        <div className="faq-item__answer-inner">
          <p>{item.a}</p>
        </div>
      </div>
    </article>
  )
}

export function FAQSection() {
  const [open, setOpen] = useState(-1)

  return (
    <section id="sss" className="faq-section story-section">
      <div className="story-container story-container--narrow">
        <div className="story-heading story-heading--split">
          <div>
            <span>Sık sorulanlar</span>
            <h2 className="font-display">Başlamadan önce bilmeniz gerekenler.</h2>
          </div>
          <p>Ürün kapsamı, deneme süreci ve operasyon akışıyla ilgili net cevaplar.</p>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((item, index) => (
            <FAQItem
              key={item.q}
              item={item}
              open={open === index}
              onClick={() => setOpen(open === index ? -1 : index)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
