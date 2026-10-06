# @havayolu/tools

Yalnızca geliştirme ve test araçları. Uygulamalar bu pakete bağımlı olmadığından üretim imajına girmez. Replay, senaryolar ve canlı araçlar yalnızca `APP_ENV=development|test` iken çalışır; `production` ya da başka bir değerde başlamaz (D-073, D-094). Commit'li referans verisi için bkz. [`fixtures/README.md`](fixtures/README.md).

## Senaryolar (`src/scenarios`)
Zamanın saf fonksiyonudur: aynı an her zaman aynı readsb `aircraft.json` karesini verir; rastgelelik ve saat okuması yoktur.

- **`cruise`:**
  - Varsayılan 8 seyir uçağı (`--count` ile 0–90). Havalimanı çiftleri arasında (IST–ESB, IST–AYT, SAW–ADB, ESB–VAN, ADB–TZX, AYT–ESB, IST–DIY, SAW–ERZ) büyük daire üzerinde gidip gelir; 35.000 ft, ≈ 450 kt (441–462), iz gerçek yöndedir.
  - LTFM 35L'ye 12 NM'den 3° süzülüşle döngüsel son yaklaşma yapan bir uçak (`ff0091`).
  - LTFM'de yerde 15 kt ile taksi turu atan bir uçak (`ff0092`).
- **Kimlikler açıkça sentetiktir:** hex `ff0001`…, çağrı kodu `HYS001`…, tescil `TC-SYN01`…, `dbFlags` 0, kaynak `adsb_icao`, `seen_pos` 0,5 sn.

## Replay alıcısı (`src/replay-receiver`)
Senaryoyu ya da kayıtlı kareleri `http://127.0.0.1:<port>/data/aircraft.json` (ve `/aircraft.json`) adresinde sunar. Worker onu `LOCAL_RECEIVER_URLS` ile gerçek bir alıcı gibi okur. Yanıtın `now` değeri sunulduğu anın saatidir: ayrıştırıcı 60 sn'den fazla kayan yanıtı reddeder.

```bash
# Kökte: alıcı + pnpm dev (web, API, worker); dış servis isteği kapalı
pnpm dev:replay
pnpm dev:replay --count 20
pnpm dev:replay --recording kayit.jsonl   # çok kareli kayıt: döngüyle sunulur
# Tek kare döngüye alınmaz: uçaklar yerinde durur, 60 sn içinde bayatlar
pnpm dev:replay --recording tools/fixtures/adsblol/point-ltfm-40nm.json

# Yalnızca alıcı (adres ekrana yazılır)
pnpm --filter @havayolu/tools replay -- --scenario cruise --count 12
```

- **Port:** `REPLAY_RECEIVER_PORT`, varsayılan 4300. Değer sırayla süreç ortamından, kökteki `.env`'den ve `.env.example`'dan okunur.
- **`pnpm dev:replay`:** `LOCAL_RECEIVER_URLS`'i alıcının adresine ayarlar ve `EXTERNAL_PROVIDERS_DISABLED=true`'yu zorlar. Ctrl+C ikisini birlikte kapatır.
- **Kayıt biçimleri** (`--recording`):
  - readsb `aircraft.json` karesi (`now` saniye, `aircraft`) ya da adsb.lol v2 yanıtı (`now` ms, `ac`)
  - tek kare, kare dizisi, `{"frames": [...]}` ya da satır başına bir kare (JSON Lines)
- **Oynatma:** Kareler zamanı kaydırılarak sunulur: ilk kare alıcının açıldığı ana denk gelir. Döngünün tek bir turu içinde aynı kare tekrar okunursa `seen_pos` ve `seen` geçen süre kadar artar (ikisi de yoksa yaş `seen` olarak eklenir); böylece örnek zamanı değişmez ve aynı konum yeni bir örnek gibi görünmez. Döngü başa sarınca ilk kare yeni zamanla yeniden sunulur.
  - **Döngü** için en az iki farklı zamanlı kare gerekir. Döngünün süresi son karenin göreli zamanı ile kareler arasındaki tipik (medyan) aralığın toplamıdır.
  - **Tek kare** (ör. `tools/fixtures/adsblol/point-ltfm-40nm.json`) ya da hepsi aynı anlı kareler döngüye alınmaz. Kare donmuş bir alıcı gibi sunulur: uçaklar yerinde durur ve 60 sn içinde bayatlar, sonra ayrıştırıcı onları reddeder. Ayrıştırıcıyı ve alıcı bağlantısını denemek için yeterlidir; hareket için senaryo ya da çok kareli kayıt kullanılır.
- **dbFlags:** adsb.lol karesinde eksik `dbFlags` 0 yazılır, çünkü orada yokluk 0 demektir. readsb karesinde eksik bırakılır; yerel alıcıda bu "bilinmiyor" demektir ve uçak gizli sayılır (D-071).

## Canlı araçlar (`src/live`)
`pnpm smoke:live` ve `pnpm record` canlı adsb.lol'e istek atar (D-094). Bu bir DUR-SOR 6 durumudur: araçları yalnızca kullanıcı kendi terminalinde çalıştırır. Ajan bu komutları hiçbir biçimde (plan ve `--help` dahil) çalıştırmaz: ikisi de `.claude/settings.json`'da `ask` listesindedir ve etkileşimsiz oturumda onay beklerken takılır. Plan ve yardım davranışı birim testleriyle doğrulanır. Ajan oturumunda (`CLAUDECODE` ya da `AI_AGENT` dolu) `--confirm` ayrıca reddedilir; plan bu reddi listeler. Önce ACTIVATION 1. adımı (info@adsb.lol) yapılır; `CONTACT_EMAIL` kökteki `.env`'de olmalıdır.

```bash
# Kökte. --confirm yoksa yalnızca plan yazılır, istek atılmaz (çıkış 2)
pnpm smoke:live
pnpm smoke:live --confirm                              # 5 dk gerçek ingest; önce pnpm dev:infra
pnpm record --station LTFM --minutes 30 --confirm      # ≈199 istek → tools/recordings/tmp/
pnpm record --station LTFM --minutes 30 --fixture --confirm   # commit'lenecek kayıt
pnpm dev:replay --recording tools/recordings/tmp/LTFM-20261004T1200Z.jsonl
```

- **`record`:**
  - **Sorgu:** tek ve sabit: `GET /v2/point/<enlem>/<boylam>/<yarıçap>`. Merkez istasyonun OurAirports fixture'ındaki ARP'ıdır (ICAO düzeltmeleriyle: UZSS bulunur, UTSS reddedilir). LTFM 40 NM → `/v2/point/41.2749/28.7321/40`.
  - **Argümanlar:** `--station <ICAO>` zorunlu; `--minutes` 1–60 (varsayılan 30); `--radius` 1–60 NM (varsayılan 40); `--out <dosya.jsonl>` ya da `--fixture`; `--confirm`; `-h`/`--help`.
  - **Hız:** worker'ın `AdaptiveRateController`'ı ve `createAdsbLolClient`'ı (başlangıç `ADSBLOL_RPS`, en çok 0,2 istek/sn, AIMD). Plandaki istek tahmini kovayı sahte saatle adımlayarak hesaplanır: 30 dk ve 0,1 istek/sn ile ≈199.
  - **Biçim:** JSON Lines; her başarılı yanıtın ham adsb.lol v2 gövdesi bir satırdır (LF). Replay alıcısı dosyayı olduğu gibi okur ve döngüyle oynatır.
  - **Çıktı:** varsayılan `tools/recordings/tmp/<ICAO>-<YYYYMMDD>T<HHmm>Z.jsonl` (gitignore'da). `--fixture` `tools/fixtures/replay/`'e yazar. `--out` verilen yola yazar; yol `.jsonl` ile biter, `tools/fixtures` altını gösteremez. Repo içinde yalnızca `tools/recordings/tmp` altı kabul edilir (ham kayıt commit'lenmesin diye); repo dışı yol serbesttir. Yanında `<ad>.meta.json` durur: kaynak, ODbL-1.0, atıf, yol, zamanlar ve sayılar; UA, e-posta ve host yoktur.
  - **Dosya güvenliği:** dosya, `.partial`'ı ya da meta'sı zaten varsa ret. Dosya ilk kareyle oluşur ve bitene kadar `.partial` adını taşır. Araç hiçbir dosya silmez. Bitişte dosya `loadRecording` ile yeniden okunur ve oynatma komutu yazılır. Bitiş başarısızsa (çıkış 4) ileti kalınan adımı ve öz denetimin satır ya da kare numaralı nedenini yazar.
- **`smoke:live`:**
  - **Ne çalışır:** worker'ın gerçek ingest'i (`startIngest`) süreç içinde 5 dk çalışır. Süre ingest başladıktan sonra sayılır; toplam ~6 dk, ~30 istek.
  - **Yalıtım:** `app_smoke_live` veritabanı her çalıştırmada yeniden kurulur (migration'lar, tohum istasyonları, fixture'dan içe aktarım; ağa çıkılmaz) ve inceleme için kalır. redis-live'ın 7 numaralı veritabanı başta ve sonda temizlenir.
  - **Ölçütler:** Türkiye bbox'ında (35–43 K, 25–45 D) ≥ 50 farklı uçak; LTFM veri yaşı p95 ≤ 20 sn (`provider_health.freshness_p95_s`); `provider_health`'te taze bir `adsbLol` satırı. Rapor Türkçedir ve yalnızca sayı taşır.
- **Kapılar** (ret çıkış 2'dir, istek atılmaz):
  - `--confirm` ile ajan oturumu (`CLAUDECODE` ya da `AI_AGENT` dolu) → ret
  - kabukta `CI` ya da `EXTERNAL_PROVIDERS_DISABLED=true` varsa ret (canlı adreste; testlerin 127.0.0.1 sunucusunda değil). Dosyalardaki değer okunmaz: `.env.example`'daki `true` engellemez
  - `APP_ENV` development ya da test; `CONTACT_EMAIL` dolu ve geçerli
  - `DATABASE_URL`, `REDIS_LIVE_URL` ve tanımlıysa `REDIS_QUEUE_URL` yalnızca `localhost`, `127.0.0.1` ya da `::1`
  - adsb.lol'den çeken başka bir ingest (`hy:provider:adsbLol`) ya da çalışan başka bir canlı araç (`hy:tools:live` kilidi) varsa ret. Kilit 30 sn'de bir yenilenir ve başka ingest yeniden denetlenir; kilit kaybolursa ya da başka ingest belirirse araç durur (çıkış 2). Önceki çalışmanın son isteğinden (`hy:tools:live:last`) en az `1000 / ADSBLOL_RPS` ms sonra ilk istek atılır. `record`'da Redis yoksa (PING 2 sn içinde yanıt vermezse) uyarı verilir ve kilitsiz devam edilir; PING'den sonra bir Redis komutu yanıt vermez ya da hata verirse ret (çıkış 2).
  - ortam okuma sırası: süreç ortamı > kökteki `.env` > `.env.example`
- **Bekçi:** yalnızca `https://api.adsb.lol` (testte `http://127.0.0.1:<port>`), yalnızca `GET /v2/point/...`, yönlendirme izlenmez, User-Agent zorunlu, iki istek başlangıcı arası en az 5 sn (250 ms payla). İhlal aracı durdurur (çıkış 4) ve sonraki her isteği keser.
- **Gizlilik:**
  - Yerel kayıt hamdır; oynatmada API ve WS süzgeçleri böylece sınanır.
  - `--fixture` kaydında askerî (bit 1) ve `dbFlags`'i bozuk kayıtlar atılır. PIA/LADD (4/8) kayıtlarından `r` ve `ownOp` silinir; tescille aynı çağrı kodu da silinir (`withPrivacy` ile aynı kural).
  - `CONTACT_EMAIL` ve `ADSBLOL_API_KEY` bütün çıktıda maskelenir. Konsolda hex, tescil ve çağrı kodu yazılmaz.
- **Çıkış kodları:**

  | Kod | Anlamı |
  |---|---|
  | 0 | tamam / GEÇTİ |
  | 1 | hiç kare yok / KALDI |
  | 2 | ret ya da ön koşul eksik (`--confirm` yok dahil) |
  | 3 | adsb.lol 401/403: dur ve bildir (DUR-SOR 3, RUNBOOK) |
  | 4 | bekçi ihlali, beklenmeyen yanıt, dosya hatası ya da iç hata |
  | 130 | Ctrl+C (`record` eldeki karelerle dosyayı kapatır). İkinci Ctrl+C hemen çıkar ve kilidi bırakmaz: kilit en çok 2 dk kalır, bu sürede yeni çalışma "Başka bir canlı araç" reddi alır |

## Kapsama raporu (`src/arrival-report`, D-098)
Kapsama raporunu (Parça 1 M7b.2) yerel veritabanında hesaplar ve örnek veriyi yazar. İkisi de ağa çıkmaz; ajan ve CI çalıştırabilir. Üretim raporu yalnızca admin panelindeki iştir (`/admin/kapsama`); bu araçlar üretim veritabanına bağlanmaz.

```bash
# Kökte. Önce pnpm dev:infra ve pnpm db:migrate; referans verisi bir kez içe aktarılmış olmalı (pnpm dev)
pnpm --filter @havayolu/tools arrival-fixture            # LTAI: 3 varış, 1'i yerde örneğiyle
pnpm coverage:report --hours 24                          # → tools/recordings/tmp/kapsama-<UTC>.md
pnpm --filter @havayolu/tools arrival-fixture --clean    # yalnızca fixture uçuşlarını siler
```

- **`coverage:report`:**
  - **Hesap:** worker'ın rapor işiyle aynı kod (`computeArrivalCoverage`, `renderArrivalCoverageMarkdown`; kaynak "yerel veritabanı"). Tanımlar `packages/shared/src/arrival-coverage.ts`'tedir.
  - **Pencere:** `[şimdi − 45 dk − saat, şimdi − 45 dk)`; yalnızca kaydı kapanmış uçuşlar (`last_seen_at ≤ şimdi − 30 dk`) sayılır.
  - **Argümanlar:** `--hours` 6, 12, 24, 48, 72 ya da 168 (varsayılan 24; admin sayfasıyla aynı liste), `-h`/`--help`. Saklama sınırı da işinkiyle aynıdır: `saat ≤ (TRACK_FINE_RETENTION_DAYS − 1) × 24`.
  - **Çıktı:** `tools/recordings/tmp/kapsama-<YYYYMMDD>T<HHmm>Z.md` (pencere sonu, UTC; gitignore'da). `wx` ile yazılır: var olan dosya ezilmez, dosya yalnızca rapor tamamlanınca oluşur. Konsola istasyon başına özet yazılır (varış, yerde örneği payı, medyanlar, iki kural).
  - **Kapı:** `DATABASE_URL` yalnızca `localhost`, `127.0.0.1` ya da `::1`; `APP_ENV` development ya da test. Ortam sırası canlı araçlarla aynıdır: süreç ortamı > kökteki `.env` > `.env.example`. Ret iletisi adres ya da parola yazmaz. Okumalar salt okunur işlemdedir; veritabanına yazılmaz.
  - **Çıkış:** 0 rapor yazıldı · 1 rapor hesaplanamadı (ör. penceredeki örneklerde `baro_rate` yok, saklama sınırı) · 2 ret, argüman, veritabanı ya da dosya hatası (şema eskiyse `pnpm db:migrate` önerilir) · 4 iç hata.
- **`arrival-fixture`:**
  - LTAI'ye (Antalya) üç kapanmış (`ended`) sentetik varış yazar: `e2e0a1` 3 sa önce 3° süzülüşle 18C'ye iner, pistte 8 yerde örneği vardır; `e2e0a2` (2 sa 40 dk önce) ve `e2e0a3` (2 sa 20 dk önce) eşiğe 1,5 ve 3 km kala alçakta kaybolur (`lost_low`).
  - Örnekler 5 sn arayla, ≈140 kt, −740 fpm; `alt_geom` geoid yedek tablosuyla (27,36 m), `seen_pos` dolu; çağrı kodu ve tescil yazılmaz. İstasyon, eşikler ve alan yüksekliği veritabanından okunur (raporun kendi okuyucusu).
  - Beklenen rapor: 3 varış, yerde örneği %33,3 (1/3) → kural 1 uygulanır (Wilson aralığı %70'i içerir: "sınırda"; 3 < 20: "az örnek"); medyan AGL ≈308 ft, eşiğe medyan ≈1,5 km → kural 2 uygulanmaz.
  - LTFM kullanılmaz: replay'in `cruise` senaryosu LTFM 35L'ye sonsuz son yaklaşma uçurur, bunlar yerde örneği olmayan varış sayılır.
  - Önce aynı hex'lerin uçuşları ve iki iz tablosundaki örnekleri silinir (idempotent); günlük iz partition'ları açılır. `--clean` yalnızca siler. e2e (`e2e/tests/admin-coverage.spec.ts`) başta yazar, sonda siler.

## Ülke adlarının sınır içi yerleşimi (`src/country-labels`, D-096, D-099)
Haritadaki her ülke adının görünür kutusunun ülkenin kara poligonunun içinde kaldığı ve havalimanı pinlerinden ve kodlarından uzak (boş) yeri ve ilk yakınlaştırmayı çevrimdışı hesaplar. İkisi de ağa çıkmaz:

```bash
# Kökte: node_modules/world-atlas'tan sadeleşmiş poligonlar → tools/fixtures/naturalearth/countries.json
pnpm country-labels:fixture
# Kökte: fixture'lardan (Natural Earth, OurAirports) yerleşim tablosu → packages/shared/src/map/country-label-placements.ts
pnpm country-labels
```

- **Dosyalar:** `geometry.ts` (Web Mercator, Douglas–Peucker, 180. meridyende sürekli kılma, kırpma, "dikdörtgen çokgenin içinde mi"), `natural-earth.ts` (Natural Earth birimleri, fixture), `label-model.ts` (MapLibre 6.11.2'nin yazıyı çizdiği kutunun modeli, güvenlik payı), `airport-pins.ts` (listelenen 503 havalimanı `tools/fixtures/ourairports/airports.csv`'nin 2026-10-01 kopyasından üretimin liste kuralıyla; engeller haritada pini çizilen 498'idir: askerî hava üsleri listelenmez, D-103, D-107; pin ve kodun pin başının sağındaki ve solundaki kutusu), `placement.ts` (boş yer çapa kuralı, başkentte sabit KIBRIS, tablo), `cli.ts` (`airports` alt komutu listenin (498, askerî üssüz) ICAO kodlarını yazar: kullanıcı onu üretimin `scope=listed` listesiyle karşılaştırır, ACTIVATION "Ülke adlarının engelleri").
- **Adlar** üreticinin çalıştığı Node'un CLDR'ından gelir ve tabloya yazılır; harita bu adı çizer. Node güncellemesi bir adı değiştirirse shared testi kırılır, `pnpm country-labels` yeniden çalıştırılır.
- **Testler** commit'li tabloyu fixture'lardan yeniden hesaplar (sürüklenme), her adın kutusunun ilk yakınlaştırmasından z8'e kadar ülkesinin içinde kaldığını ve (TÜRKİYE ile Lefkoşa'daki KIBRIS dışında) kutusuna pin ya da kod girmediğini, adların örtüşmediğini, fixture'ın world-atlas'tan yeniden üretilebildiğini ve model değerlerinin yazı tipi dosyalarıyla aynı olduğunu denetler. e2e beklentileri (`e2e/country-label-expectations.ts`) de burada tablodan doğrulanır.

## Testler

```bash
pnpm --filter @havayolu/tools test
pnpm --filter @havayolu/tools test:integration   # önce pnpm dev:infra
pnpm --filter @havayolu/tools typecheck
pnpm --filter @havayolu/tools lint
```

Testler ağa çıkmaz. Alıcı rastgele boş bir portta (`port: 0`) açılır ve yalnızca `127.0.0.1` üzerinden okunur.

- **Canlı araç testleri:** `vitest.setup.ts` her test dosyasından önce `fetch`'i yerel adreslerle sınırlar; başka bir host'a giden istek ağa çıkmadan hata verir. Sahte adsb.lol sunucusu (`src/live/test/adsblol-stub.ts`) 127.0.0.1'dedir. `record` testleri sahte saatle çalışır.
- **Entegrasyon** (`*.int.test.ts`, `vitest.integration.config.ts`): gerçek PostgreSQL ve redis-live kullanır. Smoke testi `app_test_tools_smoke` veritabanını ve redis-live'ın 4 ve 8 numaralı veritabanlarını, kilit testi 9 numarayı kullanır. Kapsama raporu testi `app_test_tools_arrival` veritabanını her koşuda yeniden kurar (migration'lar, tohum istasyonları, OurAirports fixture'ı), fixture'ı yazar ve raporu worker'ın koduyla hesaplar. Bağlantılar `TEST_DATABASE_ADMIN_URL` ve `TEST_REDIS_LIVE_URL`'den gelir. CI'da `test-integration` işi çalıştırır.
