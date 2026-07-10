# P2 Audit — Müşteri Auth → Supabase Auth Geçişi (audit-first, kod değişikliği yok)

*Tarih: 2026-07-10 · Kapsam: apps/menu + packages/db · P1 (auth_user_id şeması + user_type token hook + Send Email Hook/Resend + Google provider) DEV'de canlı.*

---

## 1. Mevcut auth akışının haritası

### JoinScreen / MemberSheet (`apps/menu/app/[slug]/components/MemberSheet.tsx`)
Tek dosyada üç fazlı state makinesi: `useState<'join' | 'otp' | 'home'>` (satır 644).

| Parça | Satır | Davranış |
|---|---|---|
| `JoinScreen` | 144 | Ad + **telefon** + KVKK checkbox → `onSubmit` |
| `sendOtp()` | 655–657 | `POST /api/loyalty/request-otp` (`{phone}`) → dev'de `devCode` echo |
| `OTPScreen` | 216 | 6-kutu kod girişi, 60 sn resend cooldown, dev-kod auto-fill |
| verify | 682–690 | `POST /api/loyalty/verify-otp` (`{phone, code, name, restaurantId, consent, marketingConsent}`) → başarıda `setPhase('home')` |
| `MemberHome` | — | bakiye/tier kartı; "Üyelikten çık" → `POST /api/loyalty/logout` |

**P2 planı:** `JoinScreen` yerini Email-OTP + Google (+ gizli Apple) provider seçimine bırakır; `OTPScreen` 6-kutu component'i **aynen yeniden kullanılır** (Supabase email OTP da 6 hane); `MemberHome` değişmez.

### `packages/db/src/session.ts` (tamamı ~50 satır — P3'te emekli)
- `CUSTOMER_SESSION_COOKIE = 'gl_member'` (satır 13)
- `signCustomerSession({customerId, phone})` → jose HS256 JWT: `sub=customerId`, `phone` claim, `iss='garsonless-menu'`, `aud='garsonless-customer'`, **TTL 60 gün**
- `verifyCustomerSession(token)` (satır 37) → `{customerId, phone} | null` (expiry/tamper → null)
- Secret: `CUSTOMER_SESSION_SECRET` (satır 21–22, yoksa throw)

### `otp_codes` tablosu (`20260614000000_loyalty_phase1.sql`)
```
id uuid PK · phone text · code_hash text (sha256, asla düz metin) · ip text
attempts int · expires_at (5 dk) · consumed_at (tek kullanım) · created_at
RLS: ENABLED, SIFIR policy → yalnız service-role. İki index (phone, ip).
```
**Tek kullanım yeri:** `packages/db/src/loyalty.ts` (`requestOtp` satır 51–112: 3/15dk + 60sn cooldown + 10/15dk IP + P1.3 send-first-persist-on-success; `verifyOtp` satır 118–167: 5 deneme kilidi + `consumed_at` + `customers` upsert). Başka hiçbir modül dokunmuyor → **geçiş sonrası tablo temiz DROP edilebilir**.

### `gl_member` cookie — set/read/clear haritası
| İşlem | Yer |
|---|---|
| **SET** | `api/loyalty/verify-otp/route.ts:69` (httpOnly, secure-prod, lax, path=/, 60g) |
| **CLEAR** | `api/loyalty/logout/route.ts:9` (boş değer + maxAge 0) |
| **READ** | 6 tüketici (aşağıda §2) — hepsi `cookies().get(CUSTOMER_SESSION_COOKIE)` |

### `CUSTOMER_SESSION_SECRET` kullanım yerleri
1. `packages/db/src/session.ts:21` — imzalama/doğrulama (asıl kullanıcı)
2. ⚠️ **`packages/db/src/sms.ts:134` — P1.1 `assertSmsConfig` bunu da zorunlu kılıyor** (+ `sms.test.ts` 3 test + `apps/menu/instrumentation.ts` boot yorumu). **Retirement tuzağı:** secret P3'te silinirse `assertSmsConfig` prod boot'u patlatır — P3'te bu kontrol de kaldırılmalı/koşullanmalı.
3. Env: `apps/menu/.env.local`, `apps/menu/.env.example`, `.env.production.example`, `apps/dashboard/.env.production` (❗bu dosya git'te DEĞİL — `git ls-files` yalnız `.env.example`'ları izliyor, sızıntı yok).

---

## 2. `verifyCustomerSession` çağrılarının tam listesi (6 tüketici)

| # | Dosya:satır | Context | Session'dan ne okur |
|---|---|---|---|
| 1 | `apps/menu/app/[slug]/page.tsx:45` | SSR — üye chip'i + `getMemberBalances(customerId, restaurantId)` | `customerId` |
| 2 | `apps/menu/app/api/orders/route.ts:78` | Sipariş → `orders.customer_id` bağı (**sadakat kazanımının tek kaynağı**); guest'te redeem/stamp/catalog kapanır | `customerId` |
| 3 | `apps/menu/app/api/loyalty/balances/route.ts:23` | Cookie-scoped bakiye okuma (IDOR yok) | `customerId` |
| 4 | `apps/menu/app/api/loyalty/preview-discount/route.ts:41` | Üye fiyat önizlemesi | `customerId` |
| 5 | `apps/menu/app/api/loyalty/consent/route.ts:30` | KVKK consent toggle (session yoksa 401) | `customerId` |
| 6 | `apps/menu/app/api/split/create/route.ts:77` | `payment_shares.customer_id` **opsiyonel atıf** (`?? null` — authz DEĞİL) | `customerId` |

**Kritik teyit:** 6'sının hiçbiri `phone` claim'ini okumuyor → Email/Google session'ında phone olmaması hiçbir tüketiciyi kırmaz. Swap = tek helper (`getCustomerSession()`: `auth.getUser()` → service-role `customers.auth_user_id` lookup → `customerId`).

---

## 3. Menu app yapısı

- **App Router** ✓ (`apps/menu/app/`), **middleware YOK** (❗dashboard'dakinin aksine — P2'de token-refresh middleware'i sıfırdan eklenecek; dashboard'un cookie-propagation-race fix'i (`redirectTo()` cookie kopyalama, commit `077cf8b`) desen olarak taşınmalı).
- **Paketler:** `@supabase/ssr@^0.5.2` **zaten dependency'de** (kurulu ama menu'de hiç kullanılmıyor) + `@supabase/supabase-js@^2.47.2`.
- **Mevcut Supabase kullanımı:** yalnız **anon** client'lar:
  - `apps/menu/lib/supabase.ts` → `createMenuBrowserClient()` (browser, realtime)
  - `apps/menu/lib/queries.ts` → `createClient()` (`@garsonless/db`, anon, SSR menü okumaları)
  - Server route'lar → `createServiceClient()` (service-role)
  - **Customer-auth'lu Supabase client'ı YOK** — P2'nin ekleyeceği şey bu.

---

## 4. `customers` tablosu — şu anki durum (gerçek DEV sorgusu)

**2 satır** (P1 migration'ı sonrası birebir korunmuş):

| id | phone | email | auth_user_id | verified | created |
|---|---|---|---|---|---|
| `9174ecec…` | `+905072***` | null | **null** | 2026-06-16 | 2026-06-16 |
| `559b5795…` | `+905308***` | null | **null** | 2026-06-18 | 2026-06-14 |

- P1 kolonları (`auth_user_id`, `email`) **tümünde null** — henüz hiçbir Supabase-Auth bağlantısı yok (beklenen; linking P2'nin işi).
- **Satırlar nasıl doğuyor:** üretimde TEK yol `verifyOtp`'un `customers.upsert(payload, {onConflict:'phone'})`'u (`loyalty.ts:155–163`). Diğer `from('customers')` kullanımları salt-okuma (campaigns telefon çekimi :229, SSR ad okuması :574).
- Google smoke-test kullanıcısı (`sutlacgullac@gmail.com`, `auth.users 1b8c18d3…`) **auth.users'ta var ama customers'ta YOK** — `ensureCustomerForAuthUser` henüz yok; P2 linking testinin hazır fixture'ı.

---

## 5. Riskli noktalar

| Risk | Durum | Not |
|---|---|---|
| **RLS'in customer kimliğine bağımlılığı** | ✅ YOK | Migration taramasında `customer_id`/`auth_user_id` içeren tek bir policy/using/check yok. `customers`/`otp_codes`/`consents` sıfır-policy (service-role-only) — P2'de **RLS'e dokunulmayacak** (kilitli karar). |
| **Realtime'ın session bağımlılığı** | ✅ YOK | Menu'deki 4 kanal (`shares-*`, `splitorders-*`, `order-*`, `bill-*`) **anon** client'la, `tableSessionId`/`orderId` filtreli — customer session'dan tamamen bağımsız. Tek dolaylı bağ: sipariş realtime'ı balances **refetch**'ini tetikler; refetch cookie'li `/api/loyalty/balances`'a gider → swap sonrası otomatik yeni yola biner. |
| **Sipariş akışı implicit bağı** | ⚠️ VAR (bilinen) | `/api/orders` → `customer_id` → **sadakat kazanımı**. Swap hatası sessizce "herkes guest" üretir (para değil, sadakat kaybı). P2 verify matrisinde açık test şart. |
| **Split-pay atıfı** | ⚠️ Düşük | `customer_id` opsiyonel atıf (`?? null`); yanlış mapping sessiz guest-atıf üretir. Aynı matriste test. |
| **`assertSmsConfig` ↔ secret kelepçesi** | ⚠️ P3 tuzağı | §1'de: `CUSTOMER_SESSION_SECRET` silinmeden `sms.ts:134` güncellenmezse prod boot ölür. |
| **60 günlük eski cookie'ler** | ℹ️ Geçiş penceresi | Cutover'da mevcut `gl_member` sahipleri (yalnız 2 test müşterisi) sessizce guest'e döner — gerçek müşteri yok, kabul edilebilir; yine de P2'de logout/yeni-giriş UX'i düşünülmeli. |
| **`/api/split/pay` session-gate'siz** | ℹ️ Ayrı iş | SMS audit'inden taşınan bayrak — split epic follow-up'ı, P2 kapsamı dışı ama unutulmasın. |
| **JWT `iss/aud` + localStorage** | ✅ Dokunma | `garsonless-menu/-customer` + `garsonless-cart` vb. bilinçli out-of-scope (rebrand kararı) — session.ts zaten komple emekli olacak. |

---

## P2 için hazır zemin (P1'den canlı)
`customers.auth_user_id/email` şeması ✓ · `customer_access_token_hook` kayıtlı + iki kitle için gerçek JWT kanıtlı (`staff`/`customer`) ✓ · Google provider gerçek girişle smoke-test'li ✓ · Send Email Hook + Resend uçtan uca çalışır (gerçek `signInWithOtp` → 200) ✓ · `@supabase/ssr` menu'de kurulu, kullanılmayı bekliyor ✓.
