# ADR-0004 — Platform Admin Uygulaması ve Destek Erişim Politikası

- **Durum:** Kabul edildi (2026-07-21)
- **Karar sahibi:** Ürün sahibi (Furkan)
- **Bağımlılık:** ADR-0002 (billing operasyonu), ADR-0003 (lifecycle müdahaleleri)

## Bağlam

İşletme yönetimi, ödeme takibi ve destek operasyonu bugün manuel SQL/service-role
kullanımı gerektiriyor. Bu sürdürülemez ve denetlenemez. Platform yönetimi
restaurant dashboard'una owner yetkisi olarak EKLENMEYECEK.

## Karar

### Ayrı uygulama, ayrı aktör modeli

- Yeni app: **`apps/platform-admin`** (ayrı Next.js app, ayrı auth yüzeyi).
- Aktör modeli restaurant aktörlerinden tamamen ayrıdır:

```ts
type PlatformActorContext = {
  actor: 'platform-admin'
  userId: string
  role: 'support' | 'ops' | 'finance' | 'superadmin'
}
```

- **Restaurant owner rolü hiçbir koşulda platform admin yetkisi kazanmaz**;
  iki kimlik uzayı arasında rol mirası yoktur. Mevcut `is_staff_user` /
  restoran RLS zinciri platform admin'e uygulanmaz — platform admin erişimi
  kendi service-boundary'sinden geçer.

### Rol yetki matrisi (v1)

| Yetki | support | ops | finance | superadmin |
|---|---|---|---|---|
| Tenant liste/arama, sağlık görünümü | ✅ | ✅ | ✅ | ✅ |
| Read-only impersonation (süreli) | ✅ | ✅ | — | ✅ |
| Suspend/reactivate/manual hold | — | ✅ | — | ✅ |
| Entitlement override (süreli, gerekçeli) | — | ✅ | — | ✅ |
| Invoice/dunning müdahalesi, muafiyet | — | — | ✅ | ✅ |
| Plan/feature katalog yönetimi | — | — | — | ✅ |
| Veri export/silme operasyonu | — | — | — | ✅ |

### Admin özellikleri (kapsam)

Tenant liste/arama/filtre; plan + subscription state + kullanım + son ödeme +
hata sağlığı özeti; invoice/payment attempt + provider event timeline;
bildirim delivery timeline; dunning yeniden başlatma/muafiyet; QR/ops güvenlik
görünümü; global error dashboard (`error_events`/fingerprints); KVKK
export/silme talepleri için kontrollü operasyon ekranı.

### Güvenlik kuralları (pazarlık edilemez)

1. Platform admin girişinde **MFA zorunlu**dur.
2. Her aksiyon audit edilir: `reason + actor + before/after + request ID`.
   Gerekçesiz mutasyon UI'dan gönderilemez.
3. Provider secret'ları/credential'lar ekranda **asla** gösterilmez (maskeli
   son-4 en fazla).
4. Support impersonation: **süreli** (maks. 60 dk), **read-only**, gerekçeli;
   başlangıç/bitiş audit'lenir; impersonation altında mutasyon API'ları
   reddeder.
5. PII varsayılan **gizli**dir; açılması role + reason kaydı gerektirir ve
   audit'e düşer.
6. Manuel billing müdahalesi provider webhook akışından ayrı audit kategorisi
   taşır (ADR-0002 kural 6 ile tutarlı).

## Sonuçlar

- Faz 6 implementasyonu bu aktör modeli ve rol matrisiyle başlar; rol matrisi
  genişletilirse ADR revize edilir.
- Platform admin gelene kadar zorunlu operasyonlar (suspend vb.) yalnız
  belgelenmiş runbook + service-role script'le ve bu ADR'nin audit ruhuna
  uygun kayıtla yapılır; alışkanlık hâline getirilmez.
