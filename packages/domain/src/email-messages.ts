import { emailAction, emailCode, emailDetails, emailHtmlToText, emailLineItems, emailParagraph, renderBrandEmail, type BrandEmailInput } from './email-brand'

/** Add the brand to mailbox-only configuration; retain intentional sender names. */
export function brandEmailSender(value: string | undefined): string | undefined {
  if (!value || /[\r\n]/.test(value)) return undefined
  const sender = value.trim()
  const mailboxPattern = /^[^<>\s@,;]+@[^<>\s@,;]+$/
  if (mailboxPattern.test(sender)) return `masabu <${sender}>`
  const named = /^([^<>]*)<([^<>]+)>$/.exec(sender)
  if (!named || !mailboxPattern.test(named[2]!)) return undefined
  const name = named[1]!.trim().replace(/^"(.*)"$/, '$1')
  const mailbox = named[2]!
  return !name || name.toLowerCase() === mailbox.toLowerCase() || /^masabu$/i.test(name)
    ? `masabu <${mailbox}>`
    : sender
}

export function brandEmailMessage(subject: string, input: BrandEmailInput): { subject: string; html: string; text: string } {
  const html = renderBrandEmail(input)
  return { subject: subject.replace(/[\r\n]/g, ' '), html, text: emailHtmlToText(html) }
}

export function renderDeviceCodeEmail(code: string) {
  return brandEmailMessage('masabu · Giriş doğrulama kodunuz', {
    headerLabel: 'Hesap güvenliği', category: 'Yeni cihaz doğrulaması', tone: 'attention', title: 'Girişinizi doğrulayın',
    preheader: 'Girişinizi doğrulayın. Kodunuz 10 dakika geçerli.',
    bodyHtml: emailParagraph('masabu hesabınıza devam etmek için aşağıdaki kodu doğrulama ekranına girin.')
      + emailCode(code, '10 dakika geçerli')
      + emailParagraph('Kodunuz 10 dakika geçerlidir. Kodu kimseyle paylaşmayın.'),
    footer: 'Bu girişi siz başlatmadıysanız hesabınızın şifresini yenileyin. masabu ekibi sizden doğrulama kodunuzu istemez.',
  })
}

const SECTION_LABELS: Record<string, string> = { pano: 'Pano', orders: 'Siparişler', menu: 'Menü', tables: 'Masalar', customers: 'Müşteriler', analytics: 'Analizler', theme: 'Tasarım', settings: 'Ayarlar' }
export function renderTeamInviteEmail(input: { restaurantName: string; url: string; permissions: readonly string[] }) {
  return brandEmailMessage(`masabu · ${input.restaurantName} ekibine davet edildiniz`, {
    headerLabel: 'Ekip', category: 'Davet', title: `${input.restaurantName} ekibine davet edildiniz`,
    preheader: `${input.restaurantName} ekibine katılmak için davetinizi kabul edin.`,
    bodyHtml: emailParagraph(`${input.restaurantName}, işletmesini masabu üzerinden birlikte yönetmek için sizi davet ediyor.`)
      + emailAction('Daveti kabul et', input.url)
      + emailDetails([['İşletme', input.restaurantName], ['Erişebileceğiniz bölümler', input.permissions.map(key => SECTION_LABELS[key] ?? key).join(', ')], ['Davet süresi', '7 gün']]),
    footer: 'Bu daveti beklemiyorsanız e-postayı yok sayabilirsiniz. Daveti kabul etmeden ekibe katılımınız tamamlanmaz.',
  })
}

export function renderInvoiceEmail(input: { name: string; plan: string; reference: string; amountMinor?: number; periodStart?: string; periodEnd?: string; documentType?: string }) {
  const plan = ({ starter: 'Starter', plus: 'Plus', pro: 'Pro' } as Record<string, string>)[input.plan] ?? input.plan
  return brandEmailMessage(`masabu ${input.plan} abonelik faturanız`, {
    headerLabel: 'Faturalandırma', category: 'Fatura özeti', title: 'Abonelik faturanız hazır',
    preheader: 'masabu aboneliğinize ait faturanızı PDF olarak ekte bulabilirsiniz.',
    bodyHtml: emailParagraph(`Merhaba ${input.name},\nmasabu aboneliğinize ait faturanız hazır. PDF dosyasını bu e-postanın ekinden açıp saklayabilirsiniz.`)
      + (typeof input.amountMinor === 'number' && Number.isSafeInteger(input.amountMinor) && input.amountMinor >= 0 ? emailLineItems([], new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(input.amountMinor / 100), 'Fatura toplamı') : '')
      + emailDetails([['Abonelik', plan], ['Fatura referansı', input.reference], ...(input.periodStart && input.periodEnd && Number.isFinite(Date.parse(input.periodStart)) && Number.isFinite(Date.parse(input.periodEnd)) ? [['Dönem', `${new Date(input.periodStart).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })} – ${new Date(input.periodEnd).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' })}`] as const] : []), ['Ek', input.documentType === 'e_fatura' ? 'e-Fatura · PDF' : input.documentType === 'e_arsiv' ? 'e-Arşiv Fatura · PDF' : 'Abonelik faturası · PDF']])
      + emailParagraph('İşletmenizin yolculuğunda masabu’yu tercih ettiğiniz için teşekkür ederiz.'),
  })
}

export function renderStandRequestEmail(input: { restaurantName: string; contactName: string; email: string; phone: string; tableCount: number; standType: string; notes?: string | null }) {
  const label = ({ basic: 'Basic · Akrilik', premium: 'Premium · Metal', custom: 'İşletmeye özel tasarım' } as Record<string, string>)[input.standType] ?? input.standType
  return brandEmailMessage(`masabu · QR stand talebi · ${input.restaurantName}`, {
    headerLabel: 'Operasyon', category: 'QR stand talebi', title: 'Yeni bir stand talebi var',
    preheader: `${input.restaurantName} için QR stand talebinin ayrıntıları.`,
    bodyHtml: emailParagraph('İşletmenin stand talebini değerlendirmek ve iletişime geçmek için bilgiler aşağıda.')
      + emailDetails([['İşletme', input.restaurantName], ['İlgili kişi', input.contactName], ['E-posta', input.email], ['Telefon', input.phone], ['Masa sayısı', String(input.tableCount)], ['Stand', label], ...(input.notes ? [['Not', input.notes] as const] : [])]),
    footer: 'Bu bildirim masabu operasyon ekibi için oluşturuldu.',
  })
}

export function renderContactEmail(input: { name: string; email: string; topic: string; businessName?: string | null; phone?: string | null; branchCount: number | null; message: string }) {
  return brandEmailMessage(`masabu · ${input.topic} · ${input.businessName || input.name}`, {
    headerLabel: 'İletişim', category: input.topic, title: 'Yeni bir mesajınız var',
    preheader: `${input.name} · ${input.topic}`,
    bodyHtml: emailDetails([['Ad soyad', input.name], ['E-posta', input.email], ['Konu', input.topic], ...(input.businessName ? [['İşletme', input.businessName] as const] : []), ...(input.phone ? [['Telefon', input.phone] as const] : []), ...(input.branchCount !== null ? [['Şube sayısı', String(input.branchCount)] as const] : [])])
      + emailParagraph(input.message),
    footer: 'Bu e-postayı yanıtladığınızda yanıtınız formu gönderen kişiye iletilir.',
  })
}
