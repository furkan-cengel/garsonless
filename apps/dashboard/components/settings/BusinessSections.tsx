'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { I, S, Tag, btnGhost, btnPrimary } from '../../lib/ui'
import { Toggle, SelectInput, SCard, FormRow, TimeInput, inputStyle } from './primitives'
import {
  getPaymentCredentialsMeta,
  savePaymentCredentials,
  deletePaymentCredentials,
  testPaymentCredentials,
  type PaymentCredsMeta,
} from '../../lib/actions/payments'

/* ── PAYMENTS ─────────────────────────────────────── */
export function PaymentsSection({ restaurantId }: { restaurantId: string }) {
  const methods = [
    { id: 'card',     label: 'Kart ile öde',         desc: 'Tüm bankalar · taksit destekli', icon: <I.card size={18} />, active: true,  fee: '%1,8 + ₺2,5' },
    { id: 'wallet',   label: 'Dijital cüzdan',       desc: 'Apple Pay · Google Pay',         icon: <I.phone size={18} />, active: true,  fee: '%1,8 + ₺2,5' },
    { id: 'cash',     label: 'Kapıda nakit',          desc: 'Garson teslim alır',             icon: <I.receipt size={18} />, active: true,  fee: 'Ücretsiz' },
    { id: 'transfer', label: 'Banka transferi',      desc: 'FAST · IBAN ile',                 icon: <I.store size={18} />, active: false, fee: 'Ücretsiz' },
    { id: 'sodexo',   label: 'Yemek kartı (Sodexo)', desc: 'Multinet, Setcard, Sodexo',       icon: <I.gift size={18} />, active: false, fee: '%2,0' },
  ] satisfies Array<{ id: string; label: string; desc: string; icon: ReactNode; active: boolean; fee: string }>

  return (
    <>
      <IyzicoCredentialsCard restaurantId={restaurantId} />

      <SCard title="Aktif yöntemler" subtitle="Müşterilerin seçebileceği ödeme yöntemleri">
        {methods.map(m => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 18px', borderBottom: '1px solid var(--divider)',
            opacity: m.active ? 1 : 0.65,
          }}>
            <span style={{ color: 'var(--text-4)', cursor: 'grab' }}><I.drag size={14} /></span>
            <div style={{
              width: 40, height: 40, borderRadius: 8,
              background: 'var(--surface-3)', color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{m.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{m.desc}</div>
            </div>
            <span style={{ ...S.mono, fontSize: 11, color: 'var(--text-3)' }}>{m.fee}</span>
            <Toggle on={m.active} />
          </div>
        ))}
      </SCard>

      <SCard title="Ödeme akışı" subtitle="Müşteri deneyimi" style={{ marginTop: 16 }}>
        <FormRow label="Çıkışta ödeme zorunluluğu" hint="Müşteri masadan ayrılırken otomatik ödeme">
          <Toggle on={false} />
        </FormRow>
        <FormRow label="Bahşiş alanı göster" hint="%5 / %10 / %15 / Özel seçenekleri">
          <Toggle on={true} />
        </FormRow>
        <FormRow label="Bölüştürülmüş hesap" hint="Müşteri masadaki tutarı kişilere böler">
          <Toggle on={true} />
        </FormRow>
        <FormRow label="Servis ücreti" hint="Her hesaba otomatik eklenir">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input defaultValue="5" style={inputStyle({ width: 60, textAlign: 'right' })} />
            <span style={{ ...S.mono, fontSize: 12, color: 'var(--text-2)' }}>%</span>
          </div>
        </FormRow>
      </SCard>

      <SCard title="Makbuz & E-fatura" style={{ marginTop: 16 }}>
        <FormRow label="Makbuz dili">
          <SelectInput value="Müşteri tercihi" options={['Türkçe', 'English', 'Müşteri tercihi']} />
        </FormRow>
        <FormRow label="E-fatura sağlayıcısı">
          <SelectInput value="Logo" options={['Logo', 'Mikro', 'Netsis', 'Kullanma']} />
        </FormRow>
        <FormRow label="Otomatik gönderim" hint="Ödeme alınınca e-postaya gönder">
          <Toggle on={true} />
        </FormRow>
      </SCard>

      <div style={{
        marginTop: 32, padding: '12px 16px',
        background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>3 değişiklik kaydedildi · 14:22</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={btnGhost()}>Geri al</button>
          <button style={btnPrimary()}><I.check size={13} />Tümünü uygula</button>
        </div>
      </div>
    </>
  )
}

/* ── İYZİCO CREDENTIALS ───────────────────────────── */
function IyzicoCredentialsCard({ restaurantId }: { restaurantId: string }) {
  const [meta, setMeta] = useState<PaymentCredsMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [mode, setMode] = useState<'sandbox' | 'live'>('sandbox')
  const [busy, setBusy] = useState<'save' | 'test' | 'delete' | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    getPaymentCredentialsMeta(restaurantId).then((result) => {
      if (cancelled) return
      setLoading(false)
      if ('error' in result) {
        setFeedback({ ok: false, text: result.error })
        return
      }
      setMeta(result)
      setMode(result.mode)
    })
    return () => { cancelled = true }
  }, [restaurantId])

  async function handleSave() {
    setBusy('save')
    setFeedback(null)
    const result = await savePaymentCredentials(restaurantId, { apiKey, secretKey, mode })
    setBusy(null)
    if ('error' in result) {
      setFeedback({ ok: false, text: result.error })
      return
    }
    setMeta({
      configured: true,
      mode,
      apiKeyLast4: apiKey.trim().slice(-4),
      updatedAt: new Date().toISOString(),
    })
    setApiKey('')
    setSecretKey('')
    setEditing(false)
    setFeedback({ ok: true, text: 'Anahtarlar kaydedildi' })
  }

  async function handleTest() {
    setBusy('test')
    setFeedback(null)
    const result = await testPaymentCredentials(restaurantId)
    setBusy(null)
    setFeedback({ ok: result.ok, text: result.message })
  }

  async function handleDelete() {
    if (!window.confirm('İyzico anahtarları silinsin mi? Bu restoran için ödeme alınamaz hale gelir.')) return
    setBusy('delete')
    setFeedback(null)
    const result = await deletePaymentCredentials(restaurantId)
    setBusy(null)
    if ('error' in result) {
      setFeedback({ ok: false, text: result.error })
      return
    }
    setMeta({ configured: false, mode: 'sandbox', apiKeyLast4: null, updatedAt: null })
    setFeedback({ ok: true, text: 'Anahtarlar kaldırıldı' })
  }

  const configured = meta?.configured ?? false

  return (
    <div style={{
      padding: 16, marginBottom: 20,
      background: 'var(--surface)', borderRadius: 10,
      border: `1px solid ${configured ? 'var(--positive)' : 'var(--border)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10,
          background: 'linear-gradient(135deg, #6b46c1 0%, #d53f8c 100%)',
          color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '.04em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>iy</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>iyzico</span>
            {loading ? null : configured ? (
              <>
                <Tag tone="positive">
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />
                  Bağlandı
                </Tag>
                <Tag tone={meta?.mode === 'live' ? 'critical' : 'neutral'}>
                  {meta?.mode === 'live' ? 'CANLI' : 'SANDBOX'}
                </Tag>
              </>
            ) : (
              <Tag tone="neutral">Yapılandırılmadı</Tag>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, ...S.mono }}>
            {loading
              ? 'Yükleniyor…'
              : configured
                ? `API Key •••• son 4: ${meta?.apiKeyLast4 ?? '????'}`
                : 'Ödeme almak için İyzico API anahtarlarını girin'}
          </div>
        </div>
        {!loading && (
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {configured && (
              <>
                <button style={btnGhost()} onClick={handleTest} disabled={busy !== null}>
                  {busy === 'test' ? 'Test ediliyor…' : 'Bağlantıyı test et'}
                </button>
                <button style={btnGhost()} onClick={handleDelete} disabled={busy !== null}>
                  Kaldır
                </button>
              </>
            )}
            {!editing && (
              <button style={btnPrimary()} onClick={() => { setEditing(true); setFeedback(null) }}>
                {configured ? 'Değiştir' : 'Bağla'}
              </button>
            )}
          </div>
        )}
      </div>

      {editing && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--divider)' }}>
          <FormRow label="API Key">
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sandbox-..."
              autoComplete="off"
              style={inputStyle({ width: 320, fontFamily: 'monospace' })}
            />
          </FormRow>
          <FormRow label="Secret Key">
            <input
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder="sandbox-..."
              autoComplete="new-password"
              style={inputStyle({ width: 320, fontFamily: 'monospace' })}
            />
          </FormRow>
          <FormRow label="Ortam" hint="Sandbox: test ödemeleri · Canlı: gerçek tahsilat">
            <div style={{ display: 'inline-flex', background: 'var(--surface-3)', borderRadius: 7, padding: 3, gap: 2 }}>
              {(['sandbox', 'live'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    padding: '5px 14px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                    background: mode === m ? 'var(--surface)' : 'transparent',
                    color: mode === m ? 'var(--text)' : 'var(--text-2)',
                    boxShadow: mode === m ? 'var(--shadow-1)' : 'none',
                  }}
                >
                  {m === 'sandbox' ? 'Sandbox' : 'Canlı'}
                </button>
              ))}
            </div>
          </FormRow>
          <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'flex-end' }}>
            <button
              style={btnGhost()}
              onClick={() => { setEditing(false); setApiKey(''); setSecretKey(''); setFeedback(null) }}
              disabled={busy !== null}
            >Vazgeç</button>
            <button
              style={btnPrimary()}
              onClick={handleSave}
              disabled={busy !== null || apiKey.trim().length < 10 || secretKey.trim().length < 10}
            >
              {busy === 'save' ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 7, fontSize: 12.5,
          background: feedback.ok ? 'var(--positive-bg)' : 'var(--critical-bg)',
          color: feedback.ok ? 'var(--positive)' : 'var(--critical)',
        }}>
          {feedback.text}
        </div>
      )}
    </div>
  )
}

/* ── NOTIFICATIONS ────────────────────────────────── */
export function NotificationsSection() {
  const events = [
    { id: 'new_order',  label: 'Yeni sipariş',           email: true,  sms: false, push: true,  inapp: true,  desc: 'Müşteri sipariş verdiğinde' },
    { id: 'late_order', label: 'Geciken sipariş',        email: true,  sms: true,  push: true,  inapp: true,  desc: 'Hazırlama süresi aşıldığında' },
    { id: 'low_stock',  label: 'Düşük stok',             email: true,  sms: false, push: false, inapp: true,  desc: 'Stok %20 altına düşünce' },
    { id: 'review',     label: 'Yeni değerlendirme',     email: false, sms: false, push: true,  inapp: true,  desc: 'Müşteri puan verdiğinde' },
    { id: 'payment',    label: 'Ödeme alındı',           email: false, sms: false, push: false, inapp: true,  desc: 'Her başarılı ödemede' },
    { id: 'refund',     label: 'İade talebi',            email: true,  sms: true,  push: true,  inapp: true,  desc: 'Müşteri iade istediğinde' },
    { id: 'report',     label: 'Günlük rapor',           email: true,  sms: false, push: false, inapp: false, desc: "Her gün 23:00'da" },
    { id: 'system',     label: 'Sistem güncellemeleri', email: true,  sms: false, push: false, inapp: true,  desc: 'Yeni özellik & bakım' },
  ]

  return (
    <>
      <SCard title="Bildirim kanalları" subtitle="Hangi olayda nereden bildirim alacaksın">
        <div style={{ padding: '14px 18px', background: 'var(--surface-2)', borderBottom: '1px solid var(--divider)' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 60px',
            fontSize: 11, color: 'var(--text-3)', fontWeight: 500,
            letterSpacing: '.05em', textTransform: 'uppercase' as const,
            alignItems: 'center', gap: 8,
          }}>
            <span>Olay</span>
            <ChannelHead icon={<I.bell size={12} />} label="E-posta" />
            <ChannelHead icon={<I.phone size={12} />} label="SMS" />
            <ChannelHead icon={<I.monitor size={12} />} label="Push" />
            <ChannelHead icon={<I.bell size={12} />} label="Uyg." />
          </div>
        </div>
        {events.map((e, i) => (
          <div key={e.id} style={{
            padding: '14px 18px',
            display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 60px',
            alignItems: 'center', gap: 8,
            borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--divider)',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{e.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{e.desc}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={e.email} /></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={e.sms} /></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={e.push} /></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><Toggle on={e.inapp} /></div>
          </div>
        ))}
      </SCard>

      <SCard title="Sessiz saatler" subtitle="Push ve SMS bildirimleri sustur" style={{ marginTop: 16 }}>
        <FormRow label="Sessiz mod"><Toggle on={true} /></FormRow>
        <FormRow label="Saatler">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TimeInput value="23:00" />
            <span style={{ color: 'var(--text-3)' }}>—</span>
            <TimeInput value="08:00" />
          </div>
        </FormRow>
        <FormRow label="Kritik bildirimler" hint="Sessiz modda bile gönder">
          <Toggle on={true} />
        </FormRow>
      </SCard>
    </>
  )
}

function ChannelHead({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ height: 13, display: 'inline-flex', alignItems: 'center', color: 'var(--text-2)' }}>{icon}</span>
      <span style={{ fontSize: 9.5 }}>{label}</span>
    </div>
  )
}
