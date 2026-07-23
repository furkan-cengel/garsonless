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
| `MAS-DEP-011` | Release çalışma ağacı temiz değil |
| `MAS-DEP-012` | App public origin'i onaylı topolojiyle uyuşmuyor |
| `MAS-DEP-013` | Paylaşılan Supabase/worker değeri app'ler arasında farklı |
| `MAS-DEP-014` | Worker endpoint URL'si gerçek route ile uyuşmuyor |
| `MAS-DEP-015` | Topolojide tanımlı route dosyası repoda yok |
| `MAS-DEP-016` | Release yanlış git branch'inden üretiliyor |
| `MAS-DEP-017` | HEAD ile yerel origin branch ref'i eşleşmiyor |
| `MAS-DEP-018` | Runtime sözleşmesi repo/function/migration kaynağıyla uyuşmuyor |
| `MAS-DEP-019` | Runtime/release kanıtı yanlış, eski veya bütünlüğü bozuk |
| `MAS-DEP-020` | Edge Function veya Auth Hook deployment'ı uyuşmuyor |
| `MAS-DEP-021` | Cron job aktifliği, schedule veya command uyuşmuyor |
| `MAS-DEP-022` | Vault/capability/secret metadata eksik veya kanıt secret içeriyor |
| `MAS-DEP-023` | Güvenli post-deploy probe beklenen sonucu vermiyor |
| `MAS-DEP-024` | Release identity ile runtime manifest aynı release'e bağlı değil |
| `MAS-DEP-025` | Smoke sözleşmesi/kanıtı geçersiz, eski veya yanlış ortama ait |
| `MAS-DEP-026` | Etkin capability için zorunlu smoke kontrolü eksik ya da başarısız |
| `MAS-DEP-027` | Smoke assertion seti eksik, fazla veya false sonuç içeriyor |
| `MAS-DEP-028` | Smoke kanıtı tekrarlı, bilinmeyen veya izin verilmeyen alan içeriyor |
| `MAS-DEP-W01` | Capability bilinçli olarak bu turda kapalı |
| `MAS-DEP-W02` | Remote migration geçmişi ayrıca doğrulanmalı |
| `MAS-DEP-W03` | Deploy planında uygulanmayı bekleyen migration var |
| `MAS-DEP-W04` | Pre-deploy runtime farkı rollout planında kapatılmalı |
| `MAS-DEP-W05` | İş-kritik smoke kontrolü deploy sonrası tamamlanmayı bekliyor |

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

## Cross-app deployment topolojisi

`config/production-topology.json`, mevcut runtime bağlantılarının tek
kaynağıdır: dashboard, menu ve kitchen origin'leri; dashboard/menu/marketing
binding'leri; altı worker consumer endpoint'i; Supabase ve outbox shared-value
grupları. Validator değerleri bellekte karşılaştırır fakat credential
değerlerini çıktıya yazmaz.

```bash
corepack pnpm prod:topology -- \
  --project-ref <PROD_PROJECT_REF> \
  --env dashboard=apps/dashboard/.env.production \
  --env menu=apps/menu/.env.production \
  --env kitchen=apps/kitchen/.env.production \
  --env marketing=apps/marketing/.env.production \
  --env platform-admin=apps/platform-admin/.env.production \
  --env outbox-worker=/tmp/outbox-worker.production.env
```

Kontrol; tüm Supabase URL/anon/service-role değerlerinin aynı projeye,
dashboard-menu-kitchen linklerinin onaylı origin'lere ve Edge worker URL'lerinin
repoda gerçekten bulunan route'lara bağlandığını kanıtlar. Edge Function
runtime sözleşmesi `SUPABASE_URL` kullanır; `NEXT_PUBLIC_SUPABASE_URL` worker
değeri değildir.

## Edge Function, Vault ve cron runtime kapısı

`config/production-runtime.json`, iki Edge Function'ın kaynak ve `verify_jwt`
sözleşmesini, yalnız **isimleri** tutulan secret bağımlılıklarını, Auth Send
Email Hook'u, Vault metadata'sını ve dört kanonik cron işini version'lar. Eski
30 dakikalık sweep migration'ı kanonik değildir; son migration'ın komutu
`sweep_fully_paid_idle_sessions(180)` olmalıdır.

Deploy öncesi secretsiz runtime manifesti üretilir:

```bash
corepack pnpm prod:runtime-manifest -- \
  --project-ref <PROD_PROJECT_REF> \
  --output /tmp/masabu-runtime-manifest.json
```

Remote kanıt JSON'u secret **değeri**, token, Authorization header'ı veya API
key içeremez. Yalnız function/secret isimleri, configured boolean'ı, public
URL'ler, cron schedule/command ve güvenli HTTP probe durumları tutulur. Cron ve
Vault isimleri aşağıdaki salt-okunur sorgularla alınabilir. Tam güvenli şema
`docs/operations/production-runtime-evidence.example.json` dosyasındadır:

```sql
select extname from pg_extension where extname in ('pg_cron', 'pg_net');
select nspname from pg_namespace where nspname = 'vault';
select jobname, schedule, command, active
from cron.job
where jobname in (
  'domain-outbox-worker-every-minute',
  'sweep-fully-paid-idle-sessions',
  'dashboard-query-observation-retention-daily',
  'platform-error-event-retention-daily'
)
order by jobname;
select name from vault.secrets
where name in ('outbox_worker_url', 'outbox_worker_secret')
order by name;
```

Kanıt üst seviyede `schemaVersion: 1`, doğru `projectRef` ve son 24 saate ait
`capturedAt` taşır. `edgeFunctions`, `authHooks`, `vaultSecrets`, `cronJobs`
ve `probes` listeleri runtime manifestindeki adlarla eşleşir. Pre-deploy farkı
planlanabilir uyarı olarak görünür; post-deploy aynı farkı release hatası yapar:

```bash
corepack pnpm prod:runtime-verify -- \
  --project-ref <PROD_PROJECT_REF> \
  --evidence /tmp/prod-runtime-evidence.json \
  --mode pre-deploy

corepack pnpm prod:runtime-verify -- \
  --project-ref <PROD_PROJECT_REF> \
  --evidence /tmp/prod-runtime-evidence-after.json \
  --mode post-deploy \
  --output /tmp/prod-runtime-verification.json
```

Post-deploy probe seti yalnız yan etkisiz kontrollerden oluşur: worker doğru
secret ile health GET'te `200`, secretsiz çağrıda `401`; e-posta hook'u geçersiz
imzada `401`. Gerçek e-posta ve outbox teslimatı ayrıca iş-kritik smoke
matrisinde doğrulanır.

## İş-kritik smoke matrisi

`config/production-smoke.json`, route smoke'tan farklı olarak gerçek ürün
invariant'larını version'lar. Sekiz çekirdek kontrol her release için
zorunludur: auth sınırı, public menü/masa tokenı, guest sipariş, üye siparişi ve
sadakat, KDS transition/tenant sınırı, outbox-inbox-e-posta fan-out,
platform-admin AAL2 ve operasyonel gözlemlenebilirlik. Kart ödemesi ile SaaS
billing kontrolleri yalnız ilgili capability production'da etkinse zorunlu
olur.

Önce kaynak dosya hash'lerini ve topoloji hedeflerini taşıyan secretsiz manifest
üretilir:

```bash
corepack pnpm prod:smoke-manifest -- \
  --project-ref <PROD_PROJECT_REF> \
  --output /tmp/masabu-smoke-manifest.json
```

Release sonrası dedicated smoke tenant ve throwaway kayıtlarla matris
çalıştırılır. Test sonunda fixture sayısı sıfır olmalı; gerçek müşteri/işletme
verisi değiştirilmez. Kanıt dosyasına e-posta, telefon, IP, user/order/table ID,
token, header, body veya provider cevabı konmaz. Yalnız exact boolean assertion,
kontrol süresi ve release kimlikleri kabul edilir. Örnek güvenli şema
`docs/operations/production-smoke-evidence.example.json` dosyasındadır.

Henüz açılmamış capability için kontrol sessizce atlanamaz: capability `false`,
kontrol `deferred`, `reasonCode` ise tam olarak `CAPABILITY_DISABLED` olmalıdır.
Capability `true` olduğunda bütün assertion'lar `true` değilse release durur.
Kanıt en fazla dört saatlik olabilir ve commit + release + runtime + smoke
SHA'larının tamamına bağlıdır:

```bash
# Deploy öncesi: tamamlanacak çekirdek kontroller MAS-DEP-W05 olarak planlanır.
corepack pnpm prod:smoke-verify -- \
  --project-ref <PROD_PROJECT_REF> \
  --release-evidence /tmp/masabu-release-evidence.json \
  --evidence /tmp/prod-smoke-evidence.json \
  --mode pre-deploy

# Deploy sonrası: eksik/failed/deferred çekirdek kontrol release'i bloklar.
corepack pnpm prod:smoke-verify -- \
  --project-ref <PROD_PROJECT_REF> \
  --release-evidence /tmp/masabu-release-evidence.json \
  --evidence /tmp/prod-smoke-evidence.json \
  --mode post-deploy \
  --output /tmp/prod-smoke-verification.json
```

Bu doğrulayıcı smoke işlemlerini kendi başına çalıştırmaz ve PROD'a yazmaz;
operatörün kontrollü runtime turundan aldığı minimal kanıtı fail-closed
doğrular. `order-card-payments` ve `saas-billing`, canlı merchant hazır olana
kadar açıkça disabled/deferred kalır.

## Release identity artifact'ı

Tüm kapılar geçip release commit'i `main`e pushlandıktan sonra secret'sız ve
deterministik artifact üretilir:

```bash
corepack pnpm prod:release-evidence -- \
  --project-ref <PROD_PROJECT_REF> \
  --output /tmp/masabu-release-evidence.json
```

Komut dirty worktree, yanlış branch veya `HEAD != origin/main` durumunda
fail-closed durur. Artifact commit SHA, package manager, lockfile SHA-256,
migration manifest SHA-256, topology SHA-256, runtime SHA-256, iş-kritik smoke
manifest SHA-256 ve public endpoint
envanterini tek `artifactSha256` altında bağlar. Zaman damgası veya secret içermez; aynı
release girdileri aynı artifact kimliğini üretir. Bu artifact kalite
kontrollerinin yerine geçmez, hangi kaynakların doğrulandığını sabitler.

## Local release provası ve rollback matrisi

Release identity üretildikten sonra aşağıdaki komut deploy yapmadan adım
sırasını, mutasyon sınırlarını ve rollback kararlarını aynı commit/runtime/smoke
SHA'larına bağlar:

```bash
corepack pnpm prod:rehearse -- \
  --project-ref <PROD_PROJECT_REF> \
  --release-evidence /tmp/masabu-release-evidence.json \
  --output /tmp/masabu-release-rehearsal.json
```

Artifact her zaman `status: local-dry-run` ve
`productionMutationPerformed: false` taşır; PROD kanıtı yerine geçmez.
Migration sırasında down migration çalıştırılmaz: rollout durur ve forward-fix
hazırlanır. Function/secret hatasında önceki function sürümü/metadata geri
alınır ve etkilenen scheduler kapalı tutulur. App/smoke hatasında uygulama önceki
commit'e döner; geriye uyumlu DB şeması korunur. Scheduler yalnız worker'ın
güvensiz olduğu kanıtlanırsa devre dışı bırakılır.

## Şimdiki açık blokajlar

- SaaS abonelik İyzico canlı merchant/plan referansları hazır değil.
- PROD migration geçmişi ile remote Edge Function/cron/Vault/Auth Hook durumu
  henüz kanıtlanmadı.
- Platform-admin desktop/mobile ekran görüntülü son görsel smoke, bağlı Codex
  browser olmadığı için ertelendi.
- Platform-admin için nihai public domain ve Supabase Auth redirect allowlist
  kararı henüz topolojiye eklenmedi; kullanılmayan bir domain uydurulmadı.
- PROD'a migration, Edge secret veya app deploy'u bu fazda yapılmaz.
