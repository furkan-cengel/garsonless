'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  PLATFORM_MEMBER_CONFIRMATION, PLATFORM_UNBAN_CONFIRMATION,
  type PlatformAccountOperation, type PlatformTenantAccount, type PlatformTenantAccounts,
} from '@garsonless/application/platform-admin-tenant-accounts'
import type { Result } from '@garsonless/domain/result'
import { activateTenantAccount, reconcileTenantAccount, revealTenantAccounts } from './account-actions'

const MEMBERSHIP_LABELS = { active: 'Aktif üyelik', invited: 'Davet bekleniyor', disabled: 'Ekip erişimi kapalı' }
const PERMISSION_LABELS: Record<string, string> = {
  dashboard: 'Pano', menu: 'Menü', tables: 'Masalar', orders: 'Siparişler', theme: 'Tema', customers: 'Müşteriler', analytics: 'Raporlar', settings: 'Ayarlar', team: 'Ekip', kitchen: 'Mutfak', campaigns: 'Kampanyalar', reports: 'Raporlar', billing: 'Faturalama',
}
function date(value: string | null) {
  return value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Istanbul' }).format(new Date(value)) : 'Yok'
}
function Detail({ label, value }: { label: string; value: string | null }) {
  return <div><dt>{label}</dt><dd>{value || 'Belirtilmemiş'}</dd></div>
}

export function TenantAccounts({ restaurantId, canManage }: { restaurantId: string; canManage: boolean }) {
  const [data, setData] = useState<PlatformTenantAccounts | null>(null)
  const [notice, setNotice] = useState('')
  const [pending, startTransition] = useTransition()
  const revealButton = useRef<HTMLButtonElement>(null)

  // Personal data stays transient; it is not persisted in localStorage or URLs.
  useEffect(() => {
    if (!data) return
    const timer = setTimeout(() => { setData(null); setNotice('Bilgiler 10 dakika sonra otomatik gizlendi. Yeniden açabilirsiniz.') }, 10 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [data])

  function hide() { setData(null); revealButton.current?.focus() }
  async function reveal(form: FormData) {
    setNotice('')
    setData(null)
    startTransition(async () => {
      try {
        const result = await revealTenantAccounts(form)
        if (result.ok) setData(result.value)
        else setNotice(result.error)
      } catch { setNotice('Bilgiler yüklenemedi. Oturumunuzu kontrol edip tekrar deneyin.') }
    })
  }
  function changed(result: Result<PlatformAccountOperation>) {
    // Never keep showing stale permissions or offer a second activation from a stale row.
    setData(null)
    setNotice(!result.ok ? result.error : result.value.status === 'completed'
      ? 'İşlem tamamlandı ve denetim kaydı oluşturuldu. Güncel bilgileri yeniden görüntüleyebilirsiniz.'
      : result.value.status === 'pending'
        ? 'Giriş engelinin kaldırıldığı henüz doğrulanamadı. Bilgileri yeniden açıp “Sonucu kontrol et” seçeneğini kullanın; yeni açma isteği göndermeyin.'
        : 'Hesap açılmadı. İşlem başarısız olarak kaydedildi; güncel bilgileri yeniden kontrol edin.')
    revealButton.current?.focus()
  }

  return <article className="panel lifecycle-panel tenant-accounts-panel" aria-labelledby="tenant-accounts-heading">
    <div className="panel-heading billing-heading"><div><p className="eyebrow">Platform sahibi görünümü</p><h2 id="tenant-accounts-heading">İşletme sahibi, ekip ve fatura bilgileri</h2></div><span className="read-only">Süper yönetici</span></div>
    <form action={reveal} className="lifecycle-form">
      <input name="restaurantId" type="hidden" value={restaurantId} />
      <label className="reason-field"><span>Görüntüleme gerekçesi</span><input name="reason" minLength={10} maxLength={1000} required defaultValue="Platform sahibi işletme hesabını ve erişim durumunu inceliyor." /><small>Bu işletmenin sahip, ekip ve fatura iletişim bilgileri açılır. Görüntüleme denetim kaydına yazılır.</small></label>
      <div className="lifecycle-actions"><button ref={revealButton} className="button primary" disabled={pending} type="submit">{pending ? 'Bilgiler yükleniyor…' : data ? 'Bilgileri yenile' : 'Tüm hesap bilgilerini görüntüle'}</button>{data ? <button type="button" className="button" onClick={hide}>Bilgileri gizle</button> : null}</div>
    </form>
    {notice ? <p className="account-notice" role="status">{notice}</p> : null}
    {data ? <div className="account-details">
      <div className="account-grid">{data.accounts.map((account) => <section className="account-card" key={account.memberId ?? account.userId ?? account.email}>
        <div className="account-card-heading"><div><p className="eyebrow">{account.role === 'owner' ? 'İşletme sahibi' : 'Ekip üyesi'}</p><h3>{account.name || account.email || 'İsimsiz hesap'}</h3></div><span className="status" data-tone={account.membershipStatus === 'disabled' ? 'danger' : account.membershipStatus === 'active' ? 'success' : 'neutral'}>{MEMBERSHIP_LABELS[account.membershipStatus]}</span></div>
        <dl className="definition-list account-definition">
          <Detail label="Giriş e-postası" value={account.email} /><Detail label="Ad / soyad" value={account.name} /><Detail label="Hesap telefonu" value={account.phone} />
          <Detail label="Kullanıcı kimliği" value={account.userId} />
          <Detail label="Hesap oluşturulma" value={date(account.createdAt)} /><Detail label="Son giriş" value={date(account.lastSignInAt)} />
          <Detail label="E-posta doğrulaması" value={account.emailConfirmedAt ? date(account.emailConfirmedAt) : 'Doğrulanmamış'} />
          <Detail label="Giriş durumu" value={account.isDeleted ? 'Hesap silinmiş' : !account.userId ? 'Davet henüz kabul edilmemiş' : account.isBanned ? `Engelli · ${date(account.bannedUntil)} tarihine kadar` : 'Giriş engeli yok'} />
          <Detail label="Bölüm yetkileri" value={account.role === 'owner' ? 'İşletmenin tüm bölümleri (paket sınırları geçerlidir)' : account.permissions.map((key) => PERMISSION_LABELS[key] ?? key).join(', ') || 'Bölüm yetkisi yok'} />
        </dl>
        {canManage ? <AccountControls account={account} restaurantId={restaurantId} onChanged={changed} /> : null}
      </section>)}</div>
      <section className="account-card account-billing"><div className="account-card-heading"><div><p className="eyebrow">Fatura profili</p><h3>Firma ve fatura iletişim bilgileri</h3></div></div>
        {data.billing ? <dl className="definition-list account-definition">
          <Detail label="Yasal unvan" value={data.billing.legalName} /><Detail label="Yetkili kişi" value={data.billing.name} /><Detail label="Fatura e-postası" value={data.billing.email} /><Detail label="Telefon" value={data.billing.phone} />
          <Detail label="VKN / TCKN" value={data.billing.identityNumber} /><Detail label="Vergi dairesi" value={data.billing.taxOffice} /><Detail label="Adres" value={data.billing.address} /><Detail label="İlçe / Şehir" value={[data.billing.district, data.billing.city].filter(Boolean).join(' / ')} /><Detail label="Ülke / Posta kodu" value={[data.billing.country, data.billing.zipCode].filter(Boolean).join(' / ')} />
        </dl> : <p className="empty-inline">Bu işletme henüz fatura profili oluşturmamış.</p>}
      </section>
    </div> : null}
  </article>
}

function AccountControls({ account, restaurantId, onChanged }: { account: PlatformTenantAccount; restaurantId: string; onChanged: (result: Result<PlatformAccountOperation>) => void }) {
  const [pending, startTransition] = useTransition()
  const canUnban = account.isBanned && account.userId && !account.isDeleted && !account.isPlatformAdmin && !account.pendingUnlockRequestId
  const canReactivate = account.membershipStatus === 'disabled' && account.memberId && account.userId && account.acceptedAt && !account.isDeleted
  const action = (form: FormData) => startTransition(async () => {
    try { onChanged(await (account.pendingUnlockRequestId ? reconcileTenantAccount(form) : activateTenantAccount(form))) }
    catch { onChanged({ ok: false, error: 'İşlem sonucu alınamadı. Hesap bilgilerini yeniden açıp güncel durumu kontrol edin.' }) }
  })
  if (account.pendingUnlockRequestId) return <form action={action} className="account-operation">
    <input name="restaurantId" type="hidden" value={restaurantId} /><input name="operationId" type="hidden" value={account.pendingUnlockRequestId} />
    <p>Giriş açma isteğinin sonucu bekleniyor. Bu kontrol yeni bir açma isteği göndermez.</p><button className="button" disabled={pending} type="submit">{pending ? 'Kontrol ediliyor…' : 'Sonucu kontrol et'}</button>
  </form>
  if (!canUnban && !canReactivate) return null
  // When both locks exist, resolve Auth first; membership remains a separate explicit operation.
  const unban = Boolean(canUnban)
  const confirmation = unban ? PLATFORM_UNBAN_CONFIRMATION : PLATFORM_MEMBER_CONFIRMATION
  return <details className="account-operation"><summary>{unban ? 'Kullanıcı giriş engelini kaldır' : 'Ekip erişimini yeniden aç'}</summary>
    <form action={action} className="lifecycle-form">
      <input name="restaurantId" type="hidden" value={restaurantId} /><input name="targetId" type="hidden" value={unban ? account.userId! : account.memberId!} /><input name="kind" type="hidden" value={unban ? 'auth_unban' : 'member_reactivate'} />
      <p>{unban ? 'Bu işlem kullanıcının Masabu giriş engelini tüm işletmeler için kaldırır. Şifre, e-posta doğrulaması, cihaz doğrulaması, ekip yetkileri ve abonelik değişmez.' : 'Bu işletmedeki daha önce kabul edilmiş ekip üyeliği, mevcut bölüm yetkileri korunarak açılır. Giriş engeli ve paket kilidi değişmez.'}</p>
      <label className="reason-field"><span>İşlem gerekçesi</span><textarea name="reason" minLength={10} maxLength={1000} required placeholder="Destek talebini ve hesabın neden açılacağını yazın…" /></label>
      <label className="reason-field"><span>Onay için “{confirmation}” yazın</span><input name="confirmation" autoComplete="off" required /></label>
      <button className="button primary" disabled={pending} type="submit">{pending ? 'İşlem yapılıyor…' : unban ? 'Giriş engelini kaldır' : 'Ekip erişimini aç'}</button>
    </form>
  </details>
}
