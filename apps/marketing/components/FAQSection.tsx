'use client'

import { FAQAccordion } from './FAQAccordion'

const FAQ_ITEMS = [
  {
    question: 'Misafirlerin uygulama indirmesi gerekir mi?',
    answer: 'Hayır. Misafir masadaki QR kodu taradığında menü doğrudan telefonunun tarayıcısında açılır; ürünleri inceleyip sipariş akışını buradan tamamlar.',
  },
  {
    question: '14 günlük deneme nasıl çalışır?',
    answer: 'Yeni işletme 14 gün boyunca Pro özelliklerini deneyebilir. Deneme için kredi kartı gerekmez. Süre sonunda ücretli abonelik başlatılmazsa menü yayını ve abonelik gerektiren özellikler duraklatılır; işletme verileri korunur.',
  },
  {
    question: 'Mutfak ekranında neleri takip edebilirim?',
    answer: 'Pro planda siparişleri istasyon ve hazırlık durumlarına göre izleyebilir; hazırlanan, hazır ve geciken siparişleri mutfak akışında takip edebilirsin.',
  },
  {
    question: 'Menüde ürünleri ne kadar özelleştirebilirim?',
    answer: 'Ürün görselleri, varyant ve porsiyonlar, ekstra seçimleri, alerjen ve diyet bilgileri, ilgili ürün önerileri, kategori ve mutfak istasyonu gibi alanları panelden yönetebilirsin.',
  },
  {
    question: 'Hangi tahsilat akışları destekleniyor?',
    answer: 'İyzico yapılandırıldığında çevrimiçi kart ödemesi alınabilir. Nakit, fiziksel POS ve ikram gibi personel tahsilatları ise masa kapatma akışında panel üzerinden işlenir.',
  },
  {
    question: 'Birden fazla işletmeyi yönetebilir miyim?',
    answer: 'Çoklu işletme yönetimi plan kapsamına göre kullanılabilir. Her işletmenin menü, masa, ekip ve raporları kendi çalışma alanında tutulur.',
  },
  {
    question: 'Aboneliği sürdürmezsem verilerime ne olur?',
    answer: 'Menü yayını ve abonelik gerektiren özellikler duraklatılır; menü ve işletme verileri korunur. Ücretli abonelik başlattığında devam edebilirsin.',
  },
]

export function FAQSection() {
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
        <FAQAccordion items={FAQ_ITEMS} />
      </div>
    </section>
  )
}
