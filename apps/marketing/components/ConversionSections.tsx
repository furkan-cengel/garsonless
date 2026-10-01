import Image from 'next/image'

export function MenuInformationSection() {
  return <section className="conversion-section conversion-section--after-hero story-section" aria-labelledby="menu-information-title">
    <div className="story-container conversion-info">
      <div className="story-heading conversion-heading">
        <span>Açık bilgi, bilinçli seçim</span>
        <h2 id="menu-information-title">Misafiriniz ne yediğini bilsin.</h2>
        <p>Ürün içerikleri, alerjenler, besin değerleri ve diyet tercihleri menüde açıkça gösterilebilir. Böylece müşteri her ürün için personele tekrar tekrar soru sormak zorunda kalmaz.</p>
        <ul className="conversion-details">
          <li>Gluten, süt ve diğer alerjenler</li><li>Kalori ve makro besin bilgileri</li>
          <li>Diyet tercihleri</li><li>Ayrı çapraz bulaşma uyarıları</li>
        </ul>
        <a className="conversion-text-link" href="/menu-alerjen-zorunlulugu">Menü bilgilendirme gerekliliklerini incele <span aria-hidden="true">→</span></a>
      </div>
      <Image src="/illustrations/menu-regulation-details.svg" alt="Ürün içeriği, gluten ve süt alerjenleri ile çapraz bulaşma uyarısını ayrı gösteren örnek menü çizimi" width={640} height={480} sizes="(max-width: 800px) 100vw, 50vw" />
    </div>
  </section>
}

export function SetupSupport() {
  return <aside className="conversion-support" aria-label="Kurulum desteği">
    <div><h3>Kurulumda yalnız değilsiniz.</h3><p>İlk kurulum sürecinde size yardımcı oluyoruz. Profesyonel kurulum ve menü aktarımı ek hizmet olarak ayrıca değerlendirilir.</p></div>
    <a className="conversion-demo-link" data-conversion-context="pricing" href="/iletisim?subject=business#satis-formu" data-conversion-event="demo_request_click">Demo Talep Et <span aria-hidden="true">→</span></a>
  </aside>
}
