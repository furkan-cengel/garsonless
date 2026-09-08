import { MarketingPage, PageHero } from '../../components/MarketingPage'
import { legalMetadata } from '../../lib/legal-metadata'

export const metadata = legalMetadata('Yasal Metinler', 'masabu KVKK, gizlilik, çerez, veri işleme, abonelik ve iptal/iade metinleri.', '/yasal')

const DOCUMENTS = [
  ['/yasal/kvkk-aydinlatma-metni', 'KVKK Aydınlatma Metni', 'Kişisel verilerin hangi amaçlarla ve hangi hukuki sebeplerle işlendiğini açıklar.'],
  ['/yasal/gizlilik-politikasi', 'Gizlilik Politikası', 'masabu web sitesi ve uygulamalarındaki veri güvenliği yaklaşımını açıklar.'],
  ['/yasal/cerez-politikasi', 'Çerez Politikası', 'Zorunlu depolama ve etkileşimli üçüncü taraf içeriklerini açıklar.'],
  ['/yasal/kvkk-basvuru-yontemleri', 'KVKK Başvuru Yöntemleri', 'İlgili kişi haklarının nasıl kullanılabileceğini ve gerekli başvuru içeriğini açıklar.'],
  ['/yasal/abonelik-hizmet-sozlesmesi', 'Abonelik Hizmet Sözleşmesi', 'İşletmelere sunulan B2B yazılım hizmetinin temel kullanım koşullarıdır.'],
  ['/yasal/veri-isleme-eki', 'Veri İşleme Eki', 'Restoranın veri sorumlusu, masabu’nun veri işleyen olduğu operasyonların koşullarını açıklar.'],
  ['/yasal/mesafeli-hizmet-sozlesmesi', 'Elektronik Abonelik ve Sipariş Özeti', 'Uzaktan kurulan B2B ücretli abonelikte gösterilen plan, dönem, fiyat ve kabul alanlarını açıklar.'],
  ['/yasal/iptal-iade-ve-dijital-teslimat', 'İptal, İade ve Dijital Teslimat', 'Aktivasyon, iptal ve ödeme iadesi süreçlerini açıklar.'],
] as const

export default function LegalIndexPage() {
  return (
    <MarketingPage>
      <PageHero
        eyebrow="Yasal"
        title="Açık, erişilebilir ve sürümlü metinler."
        description="masabu’nun veri işleme, abonelik ve dijital hizmet koşullarını bu sayfadan inceleyebilirsiniz."
      />
      <section className="editorial-section">
        <div className="container legal-index-grid">
          {DOCUMENTS.map(([href, title, description]) => (
            <a className="legal-index-card" href={href} key={href}>
              <h2>{title}</h2>
              <p>{description}</p>
              <span className="legal-index-card__link">Metni görüntüle →</span>
            </a>
          ))}
        </div>
      </section>
    </MarketingPage>
  )
}
