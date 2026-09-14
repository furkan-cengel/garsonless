import { ALLERGEN_CODES, ALLERGEN_LABELS, type AllergenCode } from '@garsonless/domain/menu'

/** Public, informational summary of the Turkish food information duty for
 * mass consumption venues. Dates follow the ministry compliance calendar; the
 * allergen vocabulary is the same one the product stores, so the page and the
 * menu editor can never drift apart. */

export const REGULATION_SOURCE = {
  name: 'Tarım ve Orman Bakanlığı — Güvenilir Gıda',
  url: 'https://guvenilirgida.tarimorman.gov.tr/Haber/Detay/17279',
} as const

/** Ministry guidance and its compliance periods, reproduced in the chamber's notice. */
export const COMPLIANCE_SOURCE = {
  name: 'İzmir Ticaret Borsası — Bakanlık kılavuzu uyum süreleri duyurusu',
  url: 'https://itb.org.tr/Duyuru/3155-turk-gida-kodeksi-gida-etiketleme-ve-tuketicileri-bilgilendirme-yonetmeligi-uyum-sureleri',
} as const

/** The declaration deadline that still applies to most venues. */
export const MAIN_DEADLINE_ISO = '2026-12-31'

export type ComplianceRow = {
  who: string
  scope: string
  deadline: string
  deadlineIso: string
}

export const COMPLIANCE_ROWS: readonly ComplianceRow[] = [
  {
    who: 'Ulusal zincirler',
    scope: 'Bileşen, alerjen ve enerji',
    deadline: '1 Temmuz 2026',
    deadlineIso: '2026-07-01',
  },
  {
    who: 'Yalnızca aynı ilde 3 ve üzeri şubesi olan işletmeler',
    scope: 'Bileşen, alerjen ve enerji',
    deadline: '31 Aralık 2026',
    deadlineIso: '2026-12-31',
  },
  {
    who: 'Diğer tüm toplu tüketim yerleri',
    scope: 'Bileşen bildirimi',
    deadline: '31 Aralık 2026',
    deadlineIso: '2026-12-31',
  },
  {
    who: 'Diğer tüm toplu tüketim yerleri',
    scope: 'Enerji (kalori)',
    deadline: '31 Aralık 2027',
    deadlineIso: '2027-12-31',
  },
]

/** Ministry-permitted presentation methods. Karekod is explicitly listed. */
export const DECLARATION_METHODS: readonly { label: string; highlight: boolean; note: string }[] = [
  { label: 'Karekod', highlight: true, note: 'Bilgi güncellendiğinde yeniden baskı gerekmez.' },
  { label: 'Menüler', highlight: false, note: 'Her fiyat veya içerik değişiminde yeniden basılır.' },
  { label: 'Yazı tahtaları', highlight: false, note: 'Sınırlı alan, elle güncelleme.' },
  { label: 'Broşür', highlight: false, note: 'Ayrı basım ve dağıtım yükü.' },
  { label: 'Dijital ekran', highlight: false, note: 'Donanım yatırımı gerektirir.' },
]

export const ALLERGENS: readonly { code: AllergenCode; label: string }[] = ALLERGEN_CODES.map(
  (code) => ({ code, label: ALLERGEN_LABELS[code] }),
)

export const REGULATION_FAQS: readonly { question: string; answer: string }[] = [
  {
    question: 'Bu zorunluluk benim işletmemi de kapsıyor mu?',
    answer:
      'Kafe, restoran ve benzeri toplu tüketim yerlerinde alerjen bildirimi zaten zorunlu. Genişletilen bilgilendirme için ulusal zincirlerin uyum tarihi 1 Temmuz 2026; yalnızca aynı ilde en az üç şubesi olanların 31 Aralık 2026. Diğer işletmelerin bileşen bildirimi tarihi 31 Aralık 2026, enerji bildirimi tarihi 31 Aralık 2027. İşletmenizin kapsamını il müdürlüğünüzle teyit edin.',
  },
  {
    question: 'Menüyü yeniden bastırmak zorunda mıyım?',
    answer:
      'Karekod, bilgilendirme için kabul edilen yöntemlerden biri. Menü bilgileri değiştiğinde aynı karekodu kullanabilirsiniz. Bilgiye karekodla erişilebildiğini ve cihazı olmayanlara talep halinde sunulacağını belirten görünür bir yazılı açıklama da bulundurmalısınız.',
  },
  {
    question: 'Tam olarak neyi bildirmem gerekiyor?',
    answer:
      'Sunduğunuz yiyecek ve içeceklerin bileşenlerini, 14 temel alerjenden içerdiklerini ve kapsamınıza göre enerji (kalori) değerini bildirmeniz gerekiyor. Bilgi, tüketicinin kolayca görebileceği ve açıkça okuyabileceği şekilde sunulmalı.',
  },
  {
    question: 'Kaç alerjen var ve hangileri?',
    answer:
      'Bakanlığın listesinde 14 temel alerjen bulunuyor: gluten, kabuklular, yumurta, balık, yer fıstığı, soya, süt, sert kabuklu meyveler, kereviz, hardal, susam, kükürt dioksit ve sülfitler, acı bakla ve yumuşakçalar. Bu sayfadaki liste, masabu menü düzenleyicisinde kullanılan listeyle birebir aynıdır.',
  },
  {
    question: 'Çapraz bulaşma bilgisi vermem gerekir mi?',
    answer:
      'Ürünün içeriğinde bulunmayan ama aynı mutfakta hazırlanması nedeniyle bulaşma ihtimali olan alerjenler için ayrı bir uyarı vermek, tüketici güvenliği açısından yaygın bir uygulamadır. masabu ürün kartında bunun için ayrı bir alan bulunur; içerik alerjeniyle karıştırılmaz.',
  },
  {
    question: 'masabu ile ne kadar sürede uyumlu olurum?',
    answer:
      'Menünüzü sisteme aktardıktan sonra her ürün için bileşen ve alerjen alanlarını doldurursunuz; eksik bilgi girilen ürünler panelde açıkça işaretlenir, böylece hiçbir ürün gözden kaçmaz. Masalarınıza asacağınız karekodlar QR Studio üzerinden hazırlanır. 14 gün boyunca Pro özelliklerini kart bilgisi vermeden deneyebilirsiniz.',
  },
]

const turkeyCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
})

/** Days remaining in the Turkish calendar, independent of the build server timezone. */
export function daysUntilDeadline(today: Date, deadlineIso: string = MAIN_DEADLINE_ISO): number {
  const deadline = Date.parse(`${deadlineIso}T00:00:00Z`)
  const start = Date.parse(`${turkeyCalendar.format(today)}T00:00:00Z`)
  return Math.max(0, Math.round((deadline - start) / 86_400_000))
}

/** The deadline remains available for the entire stated calendar day. */
export function hasDeadlinePassed(today: Date, deadlineIso: string): boolean {
  return turkeyCalendar.format(today) > deadlineIso
}
