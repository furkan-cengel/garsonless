# Production readiness runbook

Bu belge PROD'a deploy komutu değildir. Uygulama, secret ve migration
kontratlarını deploy öncesinde fail-closed doğrulamak için kullanılır. Komut
hiçbir Supabase projesine bağlanmaz, migration uygulamaz ve secret değerlerini
çıktıya yazmaz.

## Hata kodları

| Kod | Anlamı |
|---|---|
| `MAS-DEP-001` | Zorunlu dosya veya değer eksik |
| `MAS-DEP-002` | Placeholder değer kullanılıyor |
| `MAS-DEP-003` | HTTPS olmayan veya local URL |
| `MAS-DEP-004` | DEV/yanlış Supabase proje hedefi |
| `MAS-DEP-005` | Zayıf/kısa secret |
| `MAS-DEP-006` | Geçersiz argüman veya kapalı sözleşme değeri |
| `MAS-DEP-007` | Çakışan migration timestamp'i |
| `MAS-DEP-008` | Remote geçmiş append-only local zincirle uyuşmuyor |
| `MAS-DEP-009` | Deploy sonrası remote'da eksik migration var |
| `MAS-DEP-010` | Remote kanıt metadata'sı eksik veya okunamıyor |
| `MAS-DEP-W01` | Capability bilinçli olarak bu turda kapalı |
| `MAS-DEP-W02` | Remote migration geçmişi ayrıca doğrulanmalı |
| `MAS-DEP-W03` | Deploy planında uygulanmayı bekleyen migration var |

## App preflight

Her gerçek `.env.production` gitignore altında kalır. Aşağıdaki komutlar
değerleri ekrana basmadan yalnız anahtar adlarını ve güvenli hata kodlarını
raporlar:

```bash
corepack pnpm prod:preflight -- \
  --env-file apps/dashboard/.env.production \
  --scope dashboard \
  --project-ref <PROD_PROJECT_REF>

corepack pnpm prod:preflight -- \
  --env-file apps/menu/.env.production \
  --scope menu \
  --project-ref <PROD_PROJECT_REF>

corepack pnpm prod:preflight -- \
  --env-file apps/platform-admin/.env.production \
  --scope platform-admin \
  --project-ref <PROD_PROJECT_REF>
```

Diğer scope'lar: `kitchen`, `marketing`, `outbox-worker`,
`send-email-hook`. Tam liste `corepack pnpm prod:preflight -- --list` ile
alınır.

## Capability'ler

Provider hazır olmayan özellikler core deploy kontrolünü engellemez; ancak
özellik açılacağı zaman ilgili capability ayrıca ve eksiksiz doğrulanmalıdır:

```bash
# Restoran müşterisinin online kart ödemesi
--capability order-card-payments

# Masabu SaaS abonelik tahsilatı
--capability saas-billing

# Browser push fan-out
--capability web-push

# Kampanya SMS'i
--capability sms
```

İyzico capability'leri sandbox origin ile production preflight'tan geçmez.
SaaS billing, şirket ve sanal POS hesabı hazır olana kadar `MAS-DEP-W01`
olarak açıkça ertelenir; sessizce etkin kabul edilmez.

## Deploy sırası

1. Release commit/tag sabitlenir; `pnpm check` temiz olmalıdır.
2. PROD backup/PITR durumu ve rollback sahibi doğrulanır.
3. Yerel migration envanteri ile PROD `supabase migration list` çıktısı ayrı
   kanıt olarak karşılaştırılır. Preflight bunu ağ üzerinden yapmaz.
4. Migration'lar uygulama kodundan önce, sıralı ve tek operatörle uygulanır.
5. Supabase hook/worker deploy edilir; Edge secret'lar girilir.
6. Dashboard, menu, kitchen, marketing ve platform-admin app'leri deploy edilir.
7. Auth e-posta, guest/member sipariş, KDS, ödeme callback/reconciliation,
   outbox/inbox/e-posta fan-out ve platform AAL2 smoke matrisi çalıştırılır.
8. Hata merkezi, dead-letter/outbox gecikmesi, billing reconciliation ve
   dunning sayaçları gözlenir; başarısızlıkta rollout durdurulur.

## Migration release manifesti ve drift kanıtı

Release adayı sabitlendikten sonra deterministik migration manifesti üretilir.
Manifest SQL içeriğinin SHA-256 değerini de taşıdığı için aynı version altında
dosya değiştirilmesi release artifact karşılaştırmasında görünür olur:

```bash
corepack pnpm prod:migration-manifest -- --output /tmp/masabu-migrations.json
```

Remote kontrol ağ erişimi veya migration mutation'ı yapmaz. Operatör doğru
linked PROD projesinde `supabase migration list` çıktısını alır ve kanıta
secret olmayan iki metadata satırı ekler:

```text
# masabu-project-ref: <PROD_PROJECT_REF>
# masabu-captured-at: 2026-07-23T12:00:00Z
   Local          | Remote         | Time (UTC)
   ... supabase migration list çıktısı ...
```

Deploy öncesinde remote geçmiş local zincirin append-only prefix'i olmalıdır;
bekleyen migration'lar `MAS-DEP-W03` ile plan olarak listelenir:

```bash
corepack pnpm prod:migration-drift -- \
  --remote-list /tmp/prod-migration-list.txt \
  --project-ref <PROD_PROJECT_REF> \
  --mode pre-deploy
```

Migration uygulandıktan sonra aynı kontrol `--mode post-deploy` ile tekrar
alınır. Bu mod local/remote tam eşit değilse `MAS-DEP-009` ile başarısız olur.
Yanlış/DEV project ref, remote-only version, sırası değişmiş geçmiş veya farklı
local snapshot fail-closed reddedilir. Bu araç migration uygulamaz.

## Şimdiki açık blokajlar

- SaaS abonelik İyzico canlı merchant/plan referansları hazır değil.
- PROD migration geçmişi ve remote cron/Vault durumu henüz doğrulanmadı.
- Platform-admin desktop/mobile ekran görüntülü son görsel smoke, bağlı Codex
  browser olmadığı için ertelendi.
- PROD'a migration, Edge secret veya app deploy'u bu fazda yapılmaz.
