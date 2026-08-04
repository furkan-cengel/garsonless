# Dashboard Spinner Audit — Senaryo Matrisi

**Karar:** NO-GO — runtime verification pending
**Statik remediation:** PASS
**Browser durumu:** Backend listesi boş; gerçek UI hücreleri `NOT RUN`.

## Route sözleşme matrisi

| Route / yüzey | Tek loading sözleşmesi | A11y/busy | Error/retry | Reduced motion | Statik |
|---|---|---|---|---|---|
| Ortak shell | Pass | Pass | 10 sn recovery | Pass | PASS |
| Pano | Pass | Pass | Pass | Pass | PASS |
| Menü | Pass | Pass | Pass | Pass | PASS |
| Masalar | Pass | Pass | Pass | Pass | PASS |
| QR Studio | Pass | Pass | Preview/export recovery | Pass | PASS |
| Tema | Pass | Pass | Pass | Pass | PASS |
| Siparişler | Pass | Pass | Pass | Pass | PASS |
| Müşteriler/detay | Pass | Pass | Pass | Pass | PASS |
| Raporlar | Pass | Pass | Pass | Pass | PASS |
| Ayarlar | Pass | Pass | Pass | Pass | PASS |

## Viewport ve hareket matrisi

| Senaryo | 1440×1000 | 820×1000 | 390×844 | %200 zoom |
|---|---|---|---|---|
| Her nav route ilk giriş | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Route'lar arası geçiş | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Skeleton → içerik layout shift | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Spinner hizalama/kırpılma/taşma | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Modal/drawer pending ve kapatma | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Normal motion | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Reduced motion | NOT RUN | NOT RUN | NOT RUN | NOT RUN |

## Ağ ve navigation lifecycle

| Senaryo | Otomatik sözleşme | Browser |
|---|---|---|
| Hızlı geçiş `<300 ms` flash etmez | PASS | NOT RUN |
| Yavaş geçiş `2–3 s` tek gösterge açar | PASS | NOT RUN |
| Query-only completion | PASS | NOT RUN |
| Aynı URL / hash-only | PASS | NOT RUN |
| Guard iptali başlamaz | PASS — başlangıç yalnız onaydan sonra | NOT RUN |
| Offline/başarısız geçiş | PASS — 10 sn bounded recovery | NOT RUN |
| Ardışık iki navigasyon | PASS — son operation kazanır | NOT RUN |
| Geri/ileri temizliği | PASS — URL-key completion | NOT RUN |
| Retry ve dismiss | PASS | NOT RUN |
| Unmount timer cleanup | PASS | NOT RUN |

## İşlem matrisi

| Alan | Pending etiketi | Disabled/double-submit | Error/retry | Browser |
|---|---|---|---|---|
| Pano onayı/grafik | PASS | PASS | PASS | NOT RUN |
| Menü save/delete/import/upload | PASS | PASS | PASS | NOT RUN |
| Masalar CRUD/layout | PASS | PASS | PASS | NOT RUN |
| Tahsilat/split/anormal kapatma | PASS | PASS | PASS | NOT RUN |
| QR export/mobile preview | PASS | PASS | PASS | NOT RUN |
| Tema preview/upload/save | PASS | PASS | PASS | NOT RUN |
| Sipariş history/actions | PASS | PASS | PASS | NOT RUN |
| Müşteri refresh/timeline | PASS | PASS | PASS | NOT RUN |
| Rapor lazy load/refresh | PASS | PASS | PASS | NOT RUN |
| Ayarlar save/upload/billing | PASS | PASS | PASS | NOT RUN |

## Runtime kanıt adlandırması

`evidence/<viewport>/<route>-<scenario>-<motion>.png`

Browser açıldığında en az hızlı/yavaş/offline/error navigation, query/back-forward, iframe timeout/retry ve bir güvenli pending→success ile pending→error senaryosu her ana yüzey için kaydedilmelidir.
