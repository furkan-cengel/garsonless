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
| `MAS-DEP-029` | Release policy veya integrity-bound artifact geçersiz |
| `MAS-DEP-030` | Release/rehearsal/capability kanıt bağları uyuşmuyor |
| `MAS-DEP-031` | Operatör attestation'ı eksik, eski veya izin verilmeyen alan içeriyor |
| `MAS-DEP-032` | Final release kapısında allowlist dışı uyarı veya blokaj var |
| `MAS-DEP-033` | Release bundle yanlış ref/CI olayı veya operatör niyetiyle başlatıldı |
| `MAS-DEP-034` | Release bundle eksik, kirlenmiş ya da hash/iç bağ bütünlüğünü kaybetmiş |
| `MAS-DEP-035` | Backup/restore kanıtı release kimliğiyle bağlı değil veya bütünlüğü bozuk |
| `MAS-DEP-036` | Backup/restore provası eksik, eski ya da güvenli alan sözleşmesini ihlal ediyor |
| `MAS-DEP-037` | Release candidate freeze/provenance kanıtı release veya bundle kimliğiyle bağlı değil |
| `MAS-DEP-038` | Candidate freeze eksik, eski ya da rollback artifact envanteri doğrulanmamış |
| `MAS-DEP-039` | Execution planı bundle/go-to-deploy kimliğiyle bağlı değil veya bütünlüğü bozuk |
| `MAS-DEP-040` | Adım makbuzu sırası, attempt veya hash zinciri geçersiz |
| `MAS-DEP-041` | Execution tamamlanmamış, süreyi aşmış veya post-deploy karar bağı uyuşmuyor |
| `MAS-DEP-042` | Recovery kaynağı başarısız execution/candidate kimliğiyle bağlı değil |
| `MAS-DEP-043` | Recovery receipt sırası, attempt veya hash zinciri geçersiz |
| `MAS-DEP-044` | Recovery/incident kapanışı eksik, süreyi aşmış veya bütünlüğü bozuk |
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
`send-email-hook`, `send-sms-hook`. Tam liste
`corepack pnpm prod:preflight -- --list` ile
alınır.

## Capability'ler

Provider hazır olmayan özellikler core deploy kontrolünü engellemez; ancak
özellik açılacağı zaman ilgili capability ayrıca ve eksiksiz doğrulanmalıdır:

```bash
# Restoran müşterisinin online kart ödemesi
--capability order-card-payments

# Masabu SaaS abonelik tahsilatı
--capability saas-billing

# Platform-admin abonelik iade/iptal para hareketi
--capability subscription-refunds

# Dashboard Nilvera mali belge dispatch'i
--capability accounting

# Menu telefon OTP + Supabase Send SMS Hook
--capability customer-phone-auth

# Browser push fan-out
--capability web-push

# Kampanya SMS'i
--capability sms
```

`customer-phone-auth` iki ayrı runtime sözleşmesidir: `menu` scope'u
`CUSTOMER_AUTH_PHONE_OTP_ENABLED` ile uygulama/CAPTCHA değerlerini,
`send-sms-hook` scope'u ise hook imzası ve Netgsm secret'larını doğrular. Edge
secret'ları menu `.env.production` dosyasına kopyalanmaz; iki scope kendi güvenli
env kaynağıyla ayrı çalıştırılır.

Preflight, capability seçilmediğinde `SAAS_BILLING_SALES_ENABLED`,
`SAAS_BILLING_FINANCIAL_OPS_ENABLED`, `ACCOUNTING_DISPATCH_ENABLED` ve
`CUSTOMER_AUTH_PHONE_OTP_ENABLED` değerlerini açıkça `false` ister. Legacy
`SAAS_BILLING_ENABLED` uygulama geçişi için fallback olsa da production
preflight'ta yeni satış bayrağının yerini tutmaz. Capability açılırken yalnız
ilgili bayrak `true` yapılır; diğer para hareketi ve dispatch kapıları bağımsız
kalır.

İyzico capability'leri yalnız seçildiklerinde production origin ister; ertelenen
bir capability'nin boş/sandbox provider ayarı core deploy kontrolünü engellemez.
`saas-billing` açıldığında altı temel ve altı birleşik add-on ürünü olmak üzere
12 benzersiz provider referansı zorunludur. İyzico add-on netleri aylık/yıllık
`30000/288000`, Video Hero netleri `3900/37440` minor unit olmalı; her provider
brüt tutarı plan + add-on net toplamına tamsayı `INVOICE_VAT_RATE` uygulanmış
değerle bire bir eşleşmelidir. SaaS billing ve Nilvera doğrulaması tamamlanana
kadar ilgili capability'ler `MAS-DEP-W01` olarak açıkça ertelenir.

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

Remote kontrol migration mutation'ı yapmaz. Hedef korumalı komut doğru PROD
projesinden listeyi alır, secret olmayan iki metadata satırını ekler ve kanıtı
atomik olarak `0600` izinleriyle yazar. Komut bittiğinde aktif Supabase link'i
güvenli varsayılan olan DEV'e geri döner:

```bash
corepack pnpm --filter @garsonless/db db:status -- \
  --target prod --confirm-prod <PROD_PROJECT_REF> \
  --evidence-output /tmp/prod-migration-list.txt
```

Raw `supabase link`, `supabase db pull`, `supabase db push` ve linked type
üretimi release prosedürü değildir. Remote işlemler yalnız paket sarmalayıcısı
üzerinden yürütülür; `db:pull` ve `types:gen` sadece senkronize DEV hedefini
kabul eder. `db:pull` DEV şema farkı varsa yeni bir yerel migration üretir ve
DEV remote migration history tablosunu günceller; bu nedenle temiz worktree,
açık DEV hedefi ve çıktı incelemesi zorunludur:

Sarmalayıcı ortak linked-project durumunu süreçler arası kilitler; aynı anda
ikinci bir status/pull/types/backup/push işlemi fail-closed reddedilir. Eski
`scripts/migrate.mjs` doğrudan bağlantı yolu devre dışıdır ve uygulama/Vercel
environment'ına doğrudan Postgres bağlantı dizesi konmaz.
Stale görünümlü bir kilit yarış riski nedeniyle otomatik silinmez; hata
mesajındaki kilit dosyası ancak hiçbir target işleminin çalışmadığı operatörce
doğrulandıktan sonra elle kaldırılır.

```bash
corepack pnpm db:pull -- --target dev
corepack pnpm types:gen -- --target dev
```

PROD değişiklik penceresinden önce boş ve yeni bir dizine mantıksal yedek şu
hedef kilitli komutla alınır:

```bash
corepack pnpm db:backup -- \
  --target prod --confirm-prod <PROD_PROJECT_REF> \
  --backup-directory /tmp/masabu-prod-backup-<release-id>
```

Komut `schema.sql`, `roles.sql`, `data.sql` ve SHA-256 manifestini kısıtlı
izinlerle üretir; başarılı veya başarısız her uzak işlemden sonra paket linkini
DEV'e geri döndürür.

Üretilen biçim:

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

## Tekil go/no-go release kararı

`config/production-release-policy.json`, final karar için yedi runtime scope'u,
dört opsiyonel capability'yi, altı zorunlu operatör onayını, warning
allowlist'ini ve minimum rollback matrisi boyutunu version'lar. Karar aracı env
değerlerini yalnız bellekte doğrular; çıktı secret, e-posta, kişi adı, token,
header/body veya ham provider cevabı içermez.

Önce `production-release-attestation.example.json` kopyalanır. Kimlik alanları
release/prova artifact'larından doldurulur; capability'ler gerçekten PROD'da
açık olacak durumu taşır. Onaylar kişi adı değil yalnız boolean operasyon
durumu tutar ve en fazla 60 dakika geçerlidir.

```bash
corepack pnpm prod:release-decision -- \
  --mode pre-deploy \
  --project-ref <PROD_PROJECT_REF> \
  --release-evidence /tmp/masabu-release-evidence.json \
  --rehearsal /tmp/masabu-release-rehearsal.json \
  --migration-evidence /tmp/prod-migration-list.txt \
  --runtime-evidence /tmp/prod-runtime-evidence.json \
  --smoke-evidence /tmp/prod-smoke-evidence.json \
  --backup-restore-evidence /tmp/prod-backup-restore-evidence.json \
  --bundle-manifest /tmp/masabu-production-release/bundle-manifest.json \
  --release-candidate-evidence /tmp/prod-release-candidate-evidence.json \
  --attestation /tmp/prod-release-attestation.json \
  --env dashboard=apps/dashboard/.env.production \
  --env menu=apps/menu/.env.production \
  --env kitchen=apps/kitchen/.env.production \
  --env marketing=apps/marketing/.env.production \
  --env platform-admin=apps/platform-admin/.env.production \
  --env outbox-worker=/tmp/outbox-worker.production.env \
  --env send-email-hook=/tmp/send-email-hook.production.env \
  --output /tmp/prod-release-decision.json
```

`pre-deploy` yalnız `go-to-deploy` üretebilir; bu sonuç deployment yapıldığı
veya başarılı olduğu anlamına gelmez. Migration bekleyenleri `MAS-DEP-W03`,
runtime farklarını `MAS-DEP-W04` ve deploy sonrası çalışacak smoke adımlarını
`MAS-DEP-W05` olarak plan üzerinde tutar. Deployment sonrası aynı komut
`--mode post-deploy` ve yeni migration/runtime/smoke kanıtlarıyla tekrar
çalıştırılır. Post-deploy çağrısına ayrıca pre-deploy karar artifact'ı ve
tamamlanmış execution evidence eklenir:

```bash
  --pre-deploy-decision /tmp/prod-release-decision.json \
  --release-execution-evidence /tmp/prod-release-execution-evidence.json
```

Post-deploy attestation içindeki `releaseExecutionEvidenceSha256` alanı bu
dosyanın ham SHA-256 değerine çevrilir; pre-deploy attestation'da alan `null`
kalır. Yalnız bütün kapılar tam geçtiğinde `release-accepted` oluşur;
aksi durumda exit code 1 ve integrity-bound `no-go` artifact'ı üretilir.

Karar artifact'ı release, rehearsal, policy, backup/restore, release candidate
provenance ve operatör attestation SHA-256 kimliklerini; capability durumlarını; gate sonuçlarını ve yalnız güvenli
hata/uyarı kodlarını taşır. Araç migration/deploy/rollback çalıştırmaz ve her
zaman `productionMutationPerformed: false` yazar.

## Mutation-free release bundle

`pnpm prod:release-bundle`, aynı clean/pushlanmış `main` commit'ine bağlı
release identity, runtime manifest, smoke manifest, local rehearsal ve henüz
onay veremeyen attestation şablonunu tek dizinde üretir. Şablonun bütün
approval alanları `false`, `capturedAt` alanı `null` gelir; dolayısıyla paket
tek başına deploy veya `release-accepted` kararı veremez.

```bash
corepack pnpm prod:release-bundle -- build \
  --project-ref <PROD_PROJECT_REF> \
  --output /tmp/masabu-production-release

corepack pnpm prod:release-bundle -- verify \
  --input /tmp/masabu-production-release
```

`bundle-manifest.json`, migration manifesti dahil yedi dosyanın byte boyutu ve SHA-256 değerini; release,
rehearsal ve policy bağlarını; ayrıca operatörün sonradan toplaması gereken yedi
zorunlu PROD kanıtının ve yalnız başarısız execution'da oluşan koşullu recovery
kanıtının **yalnız dosya adlarını** taşır. Paket dizini 0700,
dosyalar 0600 yazılır; secret, e-posta, kişi adı, token, header/body veya
provider cevabı pakete alınmaz. Tanımsız ekstra dosya ya da tek byte değişiklik
`MAS-DEP-034` ile reddedilir. `verify`, yalnız paketin kendi hash'lerine
güvenmez; exact commit checkout'undaki lockfile, migration, runtime, smoke ve
policy kaynaklarından beklenen paketi yeniden üretip byte-byte karşılaştırır.

GitHub Actions'taki `Production Release Bundle` workflow'u yalnız manuel
`workflow_dispatch`, exact `main`, exact checkout SHA ve
`BUILD RELEASE BUNDLE` onayıyla çalışır. Önce tam CI + build kapılarını tekrar
koşar, sonra aynı paketle fail-closed candidate handoff şablonunu 14 günlük
artifact olarak yükler. Workflow hiçbir
GitHub Environment/secret istemez; Supabase'e bağlanmaz, migration/deploy
çalıştırmaz. İndirilen artifact, operatör kanıtları eklenmeden önce yukarıdaki
`verify` komutuyla tekrar doğrulanır.

## Operatör handoff ve backup/restore kapanışı

Bundle içindeki `backup-restore-evidence.template.json` doğrudan kullanıma
hazır değildir: `status=pending`, `capturedAt=null` ve bütün doğrulamalar
`false` gelir. Bu fail-closed şablon exact project, commit, release ve rehearsal
kimliklerine bağlıdır. Operatör PROD backup/PITR durumunu doğruladıktan ve
üretimden izole bir hedefte restore provası yaptıktan sonra ayrı bir kanıt
dosyası doldurur. Kanıt kişi adı/e-posta, proje erişim anahtarı, token, URL,
header/body, provider cevabı veya müşteri verisi içermez.

```bash
corepack pnpm prod:handoff -- template \
  --project-ref <PROD_PROJECT_REF> \
  --release-evidence /tmp/masabu-production-release/release-evidence.json \
  --rehearsal /tmp/masabu-production-release/release-rehearsal.json \
  --output /tmp/prod-backup-restore-evidence.template.json

corepack pnpm prod:handoff -- verify \
  --project-ref <PROD_PROJECT_REF> \
  --release-evidence /tmp/masabu-production-release/release-evidence.json \
  --rehearsal /tmp/masabu-production-release/release-rehearsal.json \
  --evidence /tmp/prod-backup-restore-evidence.json \
  --output /tmp/prod-handoff-verification.json
```

Doğrulama; PITR/recovery point/retention, izole restore ve cleanup, şema ve
tenant sınırı, kritik read-path smoke'u, önceki app/Edge artifact'ları,
scheduler stop ve forward-fix prosedürlerini exact boolean sözleşmesiyle arar.
Tek eksik kontrol, 24 saatten eski kanıt, PROD üzerinde restore mutasyonu veya
release SHA sapması `MAS-DEP-035/036` ile kapanır. Başarılı doğrulama yalnız
secretsiz `verified` artifact üretir; backup, restore, deploy veya rollback
çalıştırmaz.

Tamamlanan kanıtın ham dosya SHA-256 değeri
`prod-release-attestation.json.backupRestoreEvidenceSha256` alanına yazılır.
Final karar motoru aynı byte'ları yeniden hash'ler; attestation farklı bir
restore kanıtına işaret ederse release her durumda `no-go` olur. Örnek güvenli
şema `production-backup-restore-evidence.example.json` dosyasındadır.

## Release candidate freeze ve rollback artifact provenance

Kaynak-bound bundle doğrulandıktan sonra `prod:release-candidate`, candidate
commit'ini donduran ve önceki sürüme ait immutable rollback artifact'larını
kanıtlayan ayrı bir operatör sözleşmesi üretir. Varsayılan şablon `pending`,
tarihsiz ve bütün kontrolleri `false` gelir; deploy izni vermez.

```bash
corepack pnpm prod:release-candidate -- template \
  --project-ref <PROD_PROJECT_REF> \
  --release-evidence /tmp/masabu-production-release/release-evidence.json \
  --rehearsal /tmp/masabu-production-release/release-rehearsal.json \
  --bundle-manifest /tmp/masabu-production-release/bundle-manifest.json \
  --output /tmp/prod-release-candidate-evidence.template.json

corepack pnpm prod:release-candidate -- verify \
  --project-ref <PROD_PROJECT_REF> \
  --release-evidence /tmp/masabu-production-release/release-evidence.json \
  --rehearsal /tmp/masabu-production-release/release-rehearsal.json \
  --bundle-manifest /tmp/masabu-production-release/bundle-manifest.json \
  --evidence /tmp/prod-release-candidate-evidence.json \
  --output /tmp/prod-release-candidate-verification.json
```

Kanıt; source commit'in pushlandığını, change-set'in dondurulduğunu, bundle
bütünlüğünün yeniden doğrulandığını ve rollback artifact envanterinin
toplandığını arar. Dashboard, menu, kitchen, marketing ve platform-admin ile
`outbox-worker`/`send-email-hook` için önceki commit SHA'sı, immutable artifact
SHA-256 değeri, erişilebilirlik ve restore prosedürü zorunludur. Önceki commit
candidate commit ile aynı olamaz. Kanıt dört saatten eskiyse, fazladan alan
taşıyorsa veya tek artifact eksikse `MAS-DEP-037/038` ile reddedilir.

Ham candidate evidence SHA-256 değeri attestation içindeki
`releaseCandidateEvidenceSha256` alanına yazılır. Final karar motoru hem bundle
manifestini hem candidate kanıtını yeniden doğrular; farklı byte'lara verilen
onay `no-go` olur. Çıktılar 0600, secretsiz ve mutation-free'dir. Güvenli örnek
`production-release-candidate-evidence.example.json` dosyasındadır.

## Yeniden başlatılabilir release execution journal

`go-to-deploy` kararı deploy'u kendi başına çalıştırmaz. Gerçek değişiklik
penceresi açıldığında `prod:release-execution`, exact bundle ve pre-deploy
kararına bağlı 0700 bir journal dizini oluşturur. Araç Supabase, deployment
provider veya uygulamalara bağlanmaz; yalnız dışarıda gerçekleştirilen adımların
secretsiz SHA-256 kanıt makbuzlarını 0600 ve write-once olarak kaydeder.

```bash
corepack pnpm prod:release-execution -- init \
  --project-ref <PROD_PROJECT_REF> \
  --bundle-manifest /tmp/masabu-production-release/bundle-manifest.json \
  --pre-deploy-decision /tmp/prod-release-decision.json \
  --output /tmp/masabu-release-execution

corepack pnpm prod:release-execution -- status \
  --input /tmp/masabu-release-execution

corepack pnpm prod:release-execution -- record \
  --input /tmp/masabu-release-execution \
  --step change-window-open \
  --status succeeded \
  --evidence-sha256 <64_HEX_SAFE_EVIDENCE_ARTIFACT_SHA256>

corepack pnpm prod:release-execution -- verify \
  --input /tmp/masabu-release-execution \
  --output /tmp/prod-release-execution-evidence.json
```

Kanonik sıra: change window, migration, Edge runtime, beş uygulama, runtime
health, iş-kritik smoke ve rollback hazırlığının tekrar doğrulanmasıdır. Her
makbuz önceki makbuz SHA'sını taşır. Sıra dışı adım, aynı sequence'e yarışan
ikinci yazım, tekrar kullanılan dış kanıt, monoton olmayan zaman veya değişmiş
tek byte `MAS-DEP-039/040` ile durur. Başarısız makbuz zinciri silmez; journal
aynı adımı artırılmış `attempt` ile bekler ve buradan güvenle devam eder.

Tam zincir policy'deki 180 dakikalık pencere içinde bitmedikçe verify
`completed` üretemez (`MAS-DEP-041`). Evidence gerçek mutating adımların
kaydedildiğini dürüstçe `recordedProductionMutationPerformed: true` ile gösterir;
journal aracının kendisi yine `toolProductionMutationPerformed: false` kalır.
Final post-deploy karar bu evidence'ı, ham dosya hash'ini ve ilk
`go-to-deploy` kararını yeniden doğrular. Güvenli şema örneği
`production-release-execution-evidence.example.json` dosyasındadır.

## Başarısız release abort/rollback journal'ı

Execution'ın son write-once receipt'i `failed` olduğunda normal journal
silinmez veya geriye sarılmaz. `prod:release-recovery`, exact execution planı,
başarısız son receipt'i ve frozen candidate içindeki önceki immutable artifact
envanterini yeniden doğrulayıp ayrı bir 0700 recovery journal'ı başlatır:

```bash
corepack pnpm prod:release-recovery -- init \
  --execution-journal /tmp/masabu-release-execution \
  --release-candidate-evidence /tmp/prod-release-candidate-evidence.json \
  --output /tmp/masabu-release-recovery

corepack pnpm prod:release-recovery -- status \
  --input /tmp/masabu-release-recovery

corepack pnpm prod:release-recovery -- record \
  --input /tmp/masabu-release-recovery \
  --step release-abort-declared \
  --status succeeded \
  --evidence-sha256 <64_HEX_SAFE_EVIDENCE_ARTIFACT_SHA256>

corepack pnpm prod:release-recovery -- verify \
  --input /tmp/masabu-release-recovery \
  --output /tmp/prod-release-recovery-evidence.json
```

Plan, execution'da gerçekten denenmiş katmanlardan türetilir. Henüz mutation
adımına gelmeden oluşan hata `abort-only` olur; trafik/app/Edge/database geri
alma adımları uydurulmaz. Migration, Edge veya uygulama deployment'ına
dokunulduysa `rollback-required` olur ve trafik containment ardından yalnız
gereken artifact/recovery adımları ters sırada eklenir. Migration geri alma
adımı bilinçli olarak “down migration” varsaymaz; operatörün doğrulanmış
PITR/restore veya forward-fix kararının dış kanıtını ister.

Recovery dizini başarısız execution planı/receipt'leri ile frozen candidate
kanıtının 0600 izinli, write-once kaynak kopyalarını da tutar. Her `status`,
`record` ve `verify` çağrısı recovery planını bu kopyalardan yeniden üretir;
kaynakta veya planda tek byte değişiklik yeni bir receipt yazılmadan önce
durdurulur.

Abort kararı, incident açılışı, koşullu mutating recovery adımları, runtime
health, business smoke, incident kapanışı ve change-window kapanışı ayrı
write-once/hash-zincirli receipt'lerdir. Başarısız recovery denemesi aynı adımın
artan attempt'iyle sürer; receipt silme/üzerine yazma yasaktır. Tam zincir
policy'deki 120 dakikalık pencere içinde kapanmadıkça `rolled-back` veya
`aborted-no-mutation` kanıtı üretilemez (`MAS-DEP-042/043/044`). Her iki sonuç
da `releaseAccepted: false` taşır; recovery hiçbir zaman başarısız release'i
kabul edilmiş release'e çeviremez.

Araç gerçek rollback, trafik değişikliği veya veritabanı restore'u çalıştırmaz;
yalnız dış işlemlerin secretsiz SHA-256 kanıtlarını kaydeder ve her zaman
`toolProductionMutationPerformed: false` kalır. Güvenli şema örneği
`production-release-recovery-evidence.example.json` dosyasındadır. Bu dosya
başarılı release'in zorunlu evidence setine dahil değildir; bundle manifestinde
koşullu evidence olarak listelenir.

## Şimdiki açık blokajlar

- İyzico hesabı aktif; SaaS abonelik canlı merchant/API değerleri ile altı aylık/yıllık
  plan referansı production secret store'a bağlanıp provider doğrulamasından geçirilmedi.
- PROD migration geçmişi ile remote Edge Function/cron/Vault/Auth Hook durumu
  henüz kanıtlanmadı.
- PROD backup/PITR doğrulaması ve izole restore provası henüz yapılmadı; bundle
  içindeki fail-closed şablon bu yüzden release onayı sayılamaz.
- Önceki PROD app/Edge artifact SHA-256 envanteri henüz alınmadı; candidate
  freeze şablonu bu yüzden `pending` kalmalı ve final karar `no-go` olmalıdır.
- Gerçek PROD execution journal henüz başlatılmadı; `go-to-deploy` kararı ve
  değişiklik penceresi olmadan execution evidence üretilemez.
- Gerçek PROD execution başarısızlığı olmadığı için recovery journal da
  başlatılmadı; örnek dosya rollback yapıldığına dair kanıt sayılmaz.
- Platform-admin desktop/mobile ekran görüntülü son görsel smoke, bağlı Codex
  browser olmadığı için ertelendi.
- Platform-admin için nihai public domain ve Supabase Auth redirect allowlist
  kararı henüz topolojiye eklenmedi; kullanılmayan bir domain uydurulmadı.
- PROD'a migration, Edge secret veya app deploy'u bu fazda yapılmaz.
