# Parça 1 planı — canlı ilerleme dosyası

Kaynak: `docs/prompts/parca-1.md`. Her kilometre taşı ayrı dal ve PR'dır.

Onay: 2026-09-25 (kullanıcı: "Proje + Parça 1'e başla")

Durumlar: `[ ]` başlamadı, `[~]` sürüyor, `[k]` kod bitti ve kullanıcı doğrulaması bekliyor, `[x]` tamam.

| # | Kilometre taşı | Dal | Durum | Birleşen PR |
|---|---|---|---|---|
| M0 | Repo iskeleti, yerel test ortamı, Durum ve Yenilikler | `p1/m0-skeleton` | [x] | #1 |
| M1a | İmajlar, bütün servisler, yönetici oturumu, admin Servisler paneli | `p1/m1a-images` | [k] üretimde yayında (2026-09-27); admin Servisler panelinde bütün servislerin çalıştığını kullanıcı doğrulayacak | #2 |
| — | Marka geçişi: havayolu · havayolu.live (D-059) | `chore/havayolu-marka` | [x] | #3 |
| — | Birleştirme öncesi inceleme düzeltmeleri, açık repo ve `main` koruması (D-060…D-063) | `p1/m1a-hardening` | [x] | #4 |
| M1b | Yayın hattı (CI, deploy, rollback, DEPLOY_DOKPLOY.md) | `p1/m1b-deploy` | [x] otomatik yayın zinciri 2026-09-27'de doğrulandı (CI → `release` dalı → Dokploy Autodeploy → `/version`, D-070) | #6, #9 |
| M2 | Veritabanı ve referans verisi | `p1/m2-db` | [x] | #7 |
| M3 | Sağlayıcılar | `p1/m3-providers` | [x] | #10 |
| M4 | Ingest, replay ve senaryo araçları | `p1/m4-ingest` | [k] kod bitti; üretimde adsb.lol çekimi kullanıcının iki ACTIVATION adımından (info@adsb.lol bildirimi, ardından `CONTACT_EMAIL`) sonra açılır | #11 |
| M5 | Canlı API | `p1/m5-live-api` | [x] tamam; üretimde 5 dk boşta WS bağlantısı doğrulandı (2026-09-29) | #13 |
| M6 | Web canlı harita | `p1/m6-map` | [x] tamam; üretimde uydu altlığı doğrulandı (2026-09-30) | #14 |
| M6b | Havalimanı sayfaları, dil adreste (`/en`), SEO ve GEO | `p1/m6b-seo` | [k] kod bitti; Search Console, Bing ve Yandex doğrulaması kullanıcıda (ACTIVATION) | #15 |
| M6c | Havalimanı hava durumu (METAR/TAF), METAR/TAF kaydı, haritada havalimanı penceresi | `p1/m6c-weather` | [x] tamam; üretimde gerçek METAR/TAF doğrulandı (2026-10-02) | #16 |
| M6d | Türkiye dışındaki havalimanları, 1. halka (≤ 500 km, 75 havalimanı), açık turkuaz tema, hava durumu sunumu | `p1/m6d-ring1` | [x] tamam; üretimde 136 havalimanı, 122 istasyonda METAR (68'i yurt dışı) doğrulandı (2026-10-02) | #17 |
| M6e | Hava durumu: pencere ortalı, rüzgâr km/sa ve kt, kuvvetli rüzgâr vurgusu, kümülonimbüs ve yıldırım uyarısı | `p1/m6e-weather-wind` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.13.0): IST penceresinde "Kuzeydoğudan 37 km/sa (20 kt)", kehribar "Kuvvetli rüzgâr" | #18 |
| M6e.1 | Pencere hizası (yama) | `p1/m6e1-popup-align` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.13.1): IST penceresinin 9 satırında simge x=13, değer x=147 | #19 |
| M6f | Adlar ve saat: askerî ve sivil havalimanı adları TR/EN, haritada havalimanı adı etiketi, yurt dışında yerel saat ve UTC farkı | `p1/m6f-names-time` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.14.0): İncirlik Hava Üssü / Incirlik Air Base, Ankara (Etimesgut), /istasyon/LGAV "Yerel saat 19:37 (UTC+3)" | #20 |
| M6e.2 | Rüzgâr renkleri ve rüzgâr kesmesi (yama, v0.14.1) | `p1/m6e2-wind-colors` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.14.1): UGTB, UGKO, LGMK kehribar, LGKP ve LRCK açık yeşil | #21 |
| M6l | Logo: A · Halka | `p1/m6l-logo` | [x] tamam; üretimde doğrulandı (2026-10-03, v0.15.0): başlıkta yeni işaret, /icon/512 ve /icon/maskable, 512 px simgede kuyruk kırıntısı yok | #22 |
| M6k | Uçak listesi sağ üstte: sefer, kuyruk, yükseklik, konum ve durum | `p1/m6k-aircraft-list` | [k] kod bitti; üretimde listenin ve durumların görülmesi bekliyor (ACTIVATION) | #23 |
| M6e.3 | Derecelendirilmiş rüzgâr renkleri (yama, v0.16.1) | `p1/m6e3-wind-scale` | [x] tamam; üretimde doğrulandı (2026-10-04, v0.16.1): LTFM, LTBA, LGAV kehribar, LTAC sarı, UGTB yeşil-sarı, LTAI yeşil | #24 |
| M6g | Türkiye dışındaki havalimanları, 2. halka (≤ 1.000 km); haritanın atıf şeridinde site künyesi | `p1/m6g-ring2` | [k] kod bitti; üretimde 225 havalimanı ve HEBA hava durumunun görülmesi bekliyor (ACTIVATION) | #25 |
| M6e.4 | Yeniliklerde yayın tarihi ve saati (yama, v0.17.1) | `p1/changelog-time` | [k] kod bitti; üretimde yayın saatinin görülmesi bekliyor | #26 |
| M6e.5 | Haritada kesikli ülke sınırları (yama, v0.17.2) | `p1/map-borders` | [~] | — |
| M6h | 3. halka (≤ 2.000 km) — kullanıcı isteğiyle M7a'nın önüne alındı (2026-10-04) | `p1/m6h-ring3` | [ ] | — |
| M7a | Canlı araçlar: `smoke:live`, `record` | `p1/m7a-live-tools` | [ ] | — |
| M7b | Kapsama ölçümü ve raporu (`coverage:probe`, `coverage:report`) | `p1/m7b-coverage` | [ ] | — |
| M6i | 4. halka (≤ 5.000 km); haritada görünür alana göre havalimanı yükleme, AWC toplu dosyası | `p1/m6i-ring4` | [ ] | — |
| M6j | 5. halka (dünyanın geri kalanı, ABD dahil) | `p1/m6j-ring5` | [ ] | — |

## M0 — Repo iskeleti ve yerel test ortamı
**Dizinler:**
- kök yapılandırma
- `packages/{shared,i18n,geo,providers}`
- `apps/{web,api}`
- `scripts/`
- `.github/workflows/ci.yml`
- `.claude/launch.json`
- `.env.example`
- `LICENSE`

**Kabul komutları:**
- `pnpm install --frozen-lockfile`
- `pnpm ci:local`
- `pnpm check:eol`
- `pnpm changelog:check`
- `pnpm stats`
- `pnpm backup`
- `pnpm dev` → `http://localhost:3100/durum` API'yi "Çalışıyor" gösterir; `/yenilikler` açılır; TR/EN geçişi çalışır

**Notlar:**
- TypeScript 6.0.x'e sabitlendi (D-021).
- `engine` ve `db` paketleri ilk kullanıldıkları kilometre taşında oluşturulur.

**Çıktı kaydı (2026-09-25):**
- `pnpm install` → 258 paket, pnpm 12.6.0. turbo 2.11.3 ve vitest 5.0.1'e sabitlendi (2.11.4 ve 5.0.2 24 saatten yeni; `minimumReleaseAge` istisnası eklenmedi).
- `pnpm ci:local` → format ✓, EOL ✓, changelog v0.2.0 ✓, scripts typecheck ✓. turbo: 20/20 görev başarılı (lint 6, typecheck 6, test 6 paket / 27 test, build 2).
- `pnpm dev` → web :3100, api :4100. `/durum` 200, API "Çalışıyor", `/version` → `version:"0.2.0"`; `/dil?to=en` → `/yenilikler` İngilizce; konsol hatası yok.
- `pnpm stats` → 90 dosya, 4.828 satır (2.062 kod).

## M1a — Bütün servisler, yönetici oturumu, Servisler paneli
**Çıktı kaydı (2026-09-25):**
- `turbo run lint typecheck test build` → 28/28 görev; birim testleri: api 28, worker 7, web 5, shared 5, i18n 4, geo 7, providers 4.
- `pnpm dev:infra` → PostGIS 18-3.6, Redis 8.10.2 ×2, Mailpit v1.31.2 healthy.
- `pnpm test:integration` → db 2/2 (migration + eşzamanlı advisory lock), api 3/3 (Redis oturum deposu, heartbeat, gerçek /ready + giriş).
- `pnpm compose:guard` → 8 servis, kurallar tamam.
- Yerel üretim compose (imajlar kaynaktan): 7 servis healthy, migrate servisi 0 ile çıktı; PostGIS 3.6.4; PGDATA `/var/lib/postgresql/18/docker`; isimsiz volume yok; web → api iç ağ ✓; iki worker heartbeat'i Redis'te; boşta toplam ~270 MB. İmajlar: web 387 MB, api 341 MB, worker 336 MB.
- Tarayıcı: `/admin` → giriş ekranına yönlendirme ✓; Servisler paneli bütün servisleri gerçek veriyle gösterdi (curl + oturum çereziyle); onay bandı: onaysız script yok, "Kabul et" → script doğru `src` ve `data-site` ile yüklendi, "Reddet" → yüklenmedi; admin sayfalarında bant yok.
- Not: onay akışının otomatik E2E testi Playwright ile M6'da eklenir (bu kilometre taşında elle doğrulandı).

## Marka geçişi — havayolu · havayolu.live (v0.3.1)
**Çıktı kaydı (2026-09-25):**
- Paketler `@havayolu/*`, konteynerler `hy-*`, imajlar `ghcr.io/emindemirciai/havayolu-{web,api,worker}`; Redis anahtar öneki `hy:`, çerezler `hy_admin` / `hy_consent`.
- `www.havayolu.live` → `havayolu.live` kalıcı yönlendirme (308, `proxy.ts`), birim testiyle.
- `pnpm ci:local` → 28/28 görev, 62 birim testi.
- Eski adlı yerel altyapı silindi; `pnpm dev:infra` → `havayolu-dev` 4 servis healthy. `pnpm test:integration` → 5/5. `pnpm compose:guard` → 8 servis ✓.
- DNS kayıtları Hostinger'da girildi; alan adı bugün kaydedildiği için bu makineden henüz çözümlenmiyor (yayılma bekleniyor).
- `pnpm stats` → 149 dosya, 8.400 satır (4.884 kod).

## Birleştirme öncesi inceleme, açık repo ve `main` koruması (v0.3.2)
**Çıktı kaydı (2026-09-25):**
- Çok ajanlı inceleme (CI, güvenlik, backend, web+deploy açıları; her açıya çürütmeye çalışan bir doğrulayıcı): 12 bulgu, 11'i doğrulandı ya da muhtemel, 1'i çürütüldü. Düzeltmeler ve gerekçeler D-060'ta.
- Repo kullanıcı kararıyla herkese açık (D-061). Açmadan önce bütün geçmiş sır ve kişisel veri açısından tarandı; bulgu yok. `main-koruma` kural seti etkin (silme ve force push yasak, yalnızca PR + merge commit, zorunlu `checks`; `test-integration` PR #1 birleşince zorunlu kontrollere eklenir, çünkü M0'ın CI'ında bu iş yoktur); gizli bilgi taraması, push koruması ve bağımlılık uyarıları açık.
- Üretim env şablonu `deploy/dokploy.env.example` (60 anahtar) ve analiz uygulaması şablonu `deploy/analiz.env.example`; `pnpm compose:guard` şablonu da denetler (olumsuz denemede 4 hatanın dördünü de yakaladı).
- `pnpm ci:local` → 28/28 görev; birim testleri: api 37, web 10, worker 7, geo 7, shared 5, i18n 4, providers 4.
- `pnpm dev:infra` (TCP sağlık kontrolüyle) → 4 servis healthy; `pnpm test:integration` → 5/5; `pnpm compose:guard` → 8 servis ✓.
- Yerel üretim compose, boş volume'larla: 7 servis healthy, migrate 0 ile çıktı; `TRUSTED_PROXY_CIDRS` compose varsayılanından geldi; `/health` hız sınırı başlığı taşımıyor, `/ready` taşıyor; `/version` gömülü SHA'yı döndü; sayfa kaynağında iki dilli telif/lisans yorumu, `author`/`copyright` meta ve `rel="license"` var; boşta toplam ~290 MB.
- Tarayıcı (dev): bildirim DOM'da, gizli; hidrasyon uyarısı yok.
- İkinci çok ajanlı inceleme (düzeltme farkı; güvenlik, gerileme, env/belge/lisans): 10 bulgu, hiçbiri çürütülmedi. IPv6 /64 gruplama, `/0` reddi, MIT'e birebir lisans metni, güven sınırı belgesi ve belge tutarsızlıkları düzeltildi. Analiz env adları `ANALYZE_` (D-062), Dokploy şablonunda boş alanlar `#talimat#` (D-063).
- Son durum: `pnpm ci:local` 28/28 (api 39, web 10, shared 7 birim testi); `pnpm test:integration` 5/5; `pnpm compose:guard` ✓.
- `pnpm stats` → 159 dosya, 9.269 satır (5.495 kod).
- Birleştirme (2026-09-25): #1 → `main` (`ac71d28`), #2 (`15d2e64`), #3 (`e258b26`), #4 (`95e126a`), hepsi merge commit ve yeşil CI ile. `--delete-branch` taban dalını silince GitHub #2'yi kapattı; dal aynı commit'ten geri açılıp PR yeniden açıldı. Yığılmış PR'larda sıra: birleştir → sonraki PR'ın tabanını `main` yap → dalı sil. #1 birleştikten sonra `test-integration` da zorunlu kontrollere eklendi.

## M1b — Yayın hattı
**Dizinler ve dosyalar:**
- `.github/workflows/ci.yml` (+ `actionlint`, `deploy`), `deploy.yml`, `rollback.yml`
- `scripts/deploy-dokploy.mts` + stub testleri (`scripts/deploy-dokploy.test.mts`, `scripts/vitest.config.mts`)
- `docs/DEPLOY_DOKPLOY.md`

**Kabul komutları:**
- `pnpm test:scripts` → stub Dokploy + stub `/version` sunucusuna karşı sahte saatle: `freshVolumes` gönderilmez; deployment `error`/`cancelled` → 1; 15 dk eski SHA → 1; `/ready` 503 → 1; başarı → 0
- `actionlint` (CI işi; yerelde Docker ile) yeşil
- `pnpm ci:local`, `pnpm test:integration`, `pnpm compose:guard` yeşil; PR'da CI yeşil
- Kullanıcıya bağlı (ACTIVATION): DEPLOY_DOKPLOY.md kurulumu → bir PR birleşir → deploy işi yeşil → `${WEB_URL}/api/version` yeni `GIT_SHA`; toplam süre ≤ 20 dk

**Çıktı kaydı (2026-09-26):**
- Dış gerçekler kaynağından doğrulandı: Dokploy v0.30.7 API sözleşmesi (research/2026-09-25), action sürümleri ve commit SHA'ları GitHub API'den (checkout v7.0.1, setup-node v7.0.0, pnpm/action-setup v6.1.0, setup-buildx v4.4.1, login v4.6.0, metadata v6.2.0, build-push v7.4.0, paths-filter v4.0.3), actionlint 1.7.12 imaj digest'i Docker Hub'dan.
- `pnpm test:scripts` → 14/14 (başarı; freshVolumes gönderilmez; error, cancelled, kuyrukta 15 dk, eski SHA 15 dk, /ready 503, Dokploy 401 → 1; plan: atla / eksik ayar / https / SHA biçimi).
- Birleştirme öncesi çok ajanlı inceleme (Actions anlamı, deploy script'i, güvenlik, belge/operasyon; her açıya çürütmeye çalışan doğrulayıcı): 12 bulgu, 7'si doğrulandı. Düzeltilenler: belge birleşmesi kod yayınını yutuyordu → `main`'e her push yayın işini çalıştırır, "yayın gerekmedi" kararı canlı sürüme göre; rehberdeki ufw-docker adımı Traefik'i (VPS'teki bütün siteleri) kapatırdı → `ufw route allow` + sabitlenmiş, SHA-256'lı indirme; Dokploy'un geçici hataları artık yayını düşürmez; uç kontrolü `pipefail` ile; Postgres volume kurtarma adımları. Çürütülen 3'ü de ucuz sertleştirme olarak eklendi (rollback imaj ön kontrolü, anahtar biçimi, alan adı notu).
- Son durum: `pnpm test:scripts` → 23/23; `actionlint` temiz.
- `actionlint` (Docker, digest'li imaj) → temiz.
- `pnpm ci:local` → 28/28; `pnpm compose:guard` ✓.
- Yerel altyapı portları D-065 ile 41xxx–49xxx aralığına taşındı (Windows açılışta 56336–56435'i ayırmıştı); `pnpm dev:infra` → 4 servis healthy; `pnpm test:integration` → 5/5.
- `pnpm dev` → `/durum` v0.4.0, yol haritasında M1b "Sürüyor"; API `/ready` 200, worker sağlıklı.
- `pnpm stats` → 165 dosya, 10.615 satır (6.280 kod).

**Tasarım notu (D-064):** imajlar matris işinde yalnızca `sha-<7>` etiketiyle gönderilir. `:main` etiketi ancak seri çalışan `release` işinde, commit hâlâ `main`'in ucundaysa `docker buildx imagetools create` ile taşınır. Böylece eski bir derleme yenisinin üstüne yazılamaz; rollback da aynı yöntemi kullanır.

**Üretimde ilk gün (2026-09-27, v0.5.0–v0.5.2):**
- Site Dokploy'dan elle yayına alındı (v0.4.0). Paketler gizli yapıldı, Dokploy'a süresiz `read:packages` PAT'li Registry eklendi (D-068).
- #8 (v0.5.1): 32 karakterden kısa `ADMIN_SETUP_TOKEN` API'yi her açılışta düşürüyordu; alt sınır 12, hatalı yönetici ayarı artık yalnızca girişi kapatıyor (D-069).
- #9 (v0.5.2): Autodeploy `main`'i izlerken imajlardan önce tetikleniyor ve eski sürümü yayınlıyordu. Dokploy artık `release` dalını izliyor; CI imajları hazırlayınca dala yayın commit'i gönderiyor (D-070).
- **M1b kabulü:** #9 08:16:21 UTC'de birleşti; CI 4,7 dk sonra (08:21:05) `release` dalına yayın commit'ini gönderdi. Bu ilk denemede Dokploy tetiklenmedi: kullanıcı ~08:05'te panel adresini değiştirmişti, GitHub App'in bildirim adresi eski adreste kaldı ve teslimatlar Traefik'ten 404 aldı. Yayını kullanıcı elle yaptı; CI'daki doğrulama geçti. Bildirim adresi `https://dokploy.havayolu.live/api/deploy/github` yapıldıktan sonra 08:44:30'da `release`'e gönderilen test commit'i (`ca339ab`, ağacı canlıyla aynı) Dokploy yayınını başlattı; teslimat 200 (kullanıcı doğruladı). Tam otomatik ölçüm (#10, v0.6.0): 09:19:42 UTC birleşme → 09:23:53 `release` dalına yayın commit'i → 09:24:25 `api.havayolu.live/version` ve `havayolu.live/api/version` yeni SHA, `/ready` 200. **Birleşmeden canlıya 4 dk 43 sn**, elle müdahale yok (hedef ≤ 20 dk).
- Dokploy paneli `https://dokploy.havayolu.live` (Let's Encrypt). `http://72.62.53.122:3000` hâlâ açık; kapatmak kullanıcı adımı (ACTIVATION).

## M2 — Veritabanı ve referans verisi
**Dizinler ve dosyalar:**
- `packages/db`: `src/schema.ts`, `drizzle/0001_reference_and_tracks.sql` (iz tabloları elle `PARTITION BY RANGE ("ts")`), `drizzle/0002_track_default_partitions.sql` (özel migration), `src/partitions.ts`, `src/reference.ts`, `src/seed.ts`, `src/cli/migrate.ts` (migration sonrası partition + tohum)
- `packages/providers/src/reference/` (CSV, OurAirports, VRS), `packages/geo` (`runwayThreshold`)
- `apps/worker/src/jobs/` (`jobs` rolü: BullMQ zamanlayıcıları, referans içe aktarımı, partition bakımı)
- admin Servisler paneli: "Referans verisi" ve "İz tabloları" satırları
- `tools/fixtures/` (+ README), `scripts/make-reference-fixtures.mts`, `scripts/check-migrations.mts`, `scripts/test-migration-upgrade.mts`

**Kabul komutları:**
- `pnpm db:check` → `drizzle-kit check` + `drizzle-kit generate` boş fark (CI `checks`)
- `pnpm test:integration` → db: temiz DB'de 3 migration; partition işi sahte saatle (süresi dolanı siler, 7 gün ileriyi açar, kilit alınamazsa yeniden dener); seed iki kez → yinelenme yok; referans yazımı idempotent. worker: BullMQ zamanlayıcıları, ilk içe aktarım, partition işi, fixture içe aktarımı
- `pnpm test:migration-upgrade` → `origin/main` migration'ları + dalınkiler (CI `test-integration`)
- `pnpm --filter @havayolu/providers test` → LTFM ve diğer tohum istasyonlarının her pisti için eşikler arası mesafe (±50 m), eşikten eşiğe yön (±1°; D-066 sapması), kaydırılmış eşik (±1 m)
- `pnpm ci:local`, `pnpm compose:guard`, `actionlint`; PR'da CI yeşil

**Notlar:**
- LTFM'de 16L/16R/17L/17R için OurAirports heading alanı ~5° yanlış; yön uç koordinatlarından hesaplanır ve tutarsızlık işaretlenir (D-066).
- Tam OurAirports verisiyle ölçüm: 6.347 havalimanı ve 7.977 pist tutulur (79.787 havalimanı ve 40.301 pist filtre dışı, 0 hatalı satır); heap zirvesi ~58 MB.

**Çıktı kaydı (2026-09-27):**
- Fixture'lar kullanıcı onayıyla bir kez indirildi (OurAirports, VRS; `tools/fixtures/README.md`).
- `pnpm --filter @havayolu/providers test` → 50/50: 5 tohum istasyonunun iki ucu koordinatlı bütün pistlerinde (LTFM 6 pist) eşikler arası mesafe ±50 m, yön ±1°, kaydırılmış eşik ±1 m; LTFM'de heading alanı tutarsız pistler tam olarak 16L/16R/17L/17R; LTAC 03L uçları zaten eşik.
- `pnpm db:check` → boş fark; kasıtlı bir sütun yeniden adlandırması kırmızıya döndü.
- `pnpm test:integration` → db 14/14 (3 migration; partition işi sahte saatle; DEFAULT'taki satır taşınır, süresi dolan silinir; kilit yeniden denemesi; seed; referans yazımı idempotent, kod takası, yarım kaynak reddi), api 3/3, worker 5/5 (BullMQ zamanlayıcıları, açılış telafisi, yeniden başlatmada zamanlayıcıya dokunulmaması, fixture içe aktarımı, hata kaydı).
- `pnpm test:migration-upgrade` → 1 → 3 migration.
- `pnpm ci:local` → 28/28 görev; `pnpm compose:guard` ✓; `actionlint` temiz.
- `pnpm dev`: worker ilk açılışta fixture'dan 76 havalimanı, 115 pist, 5.964 havayolu yükledi; admin Servisler'de "Referans verisi" ve "İz tabloları" Çalışıyor (7 gün ileri, DEFAULT 0).
- Birleştirme öncesi çok ajanlı inceleme (5 açı + çürütmeye çalışan doğrulayıcılar): 18 bulgu, hiçbiri çürütülmedi, hepsi düzeltildi (D-066).
- Yerel üretim compose (imajlar kaynaktan): 7 servis healthy; `hy-migrate` 3 migration + 18 partition + 5 istasyon; worker-bg ~90 MB; dış istek kapalı olduğu için referans içe aktarımı beklendiği gibi atlandı; `/ready` hazır.
- GitHub Releases (kullanıcı talebi, D-067): CI'da `github-release` işi; v0.1.0–v0.4.0 geçmiş birleşme commit'lerine eklendi.
- `pnpm stats` → 185 dosya, 14.716 satır (10.032 kod). Fixture CSV'leri ve drizzle snapshot'ları artık sayılmaz (elle yazılmayan veri).

## M3 — Sağlayıcılar
**Dizinler ve dosyalar:**
- `packages/providers/src/aircraft.ts` (`AircraftState`, `dbFlags`, gizlilik yardımcıları)
- `packages/providers/src/live/`: `response.ts` (ayrıştırıcı ve temizlik), `adsblol.ts` (istemci, `providerUserAgent`, `chunkHexes`), `local-receiver.ts`
- `packages/providers/src/schedule.ts` (`ScheduleProvider`, yalnızca tip)
- `tools/fixtures/adsblol/`, `scripts/record-adsblol-fixtures.mts`

**Kabul komutları:**
- `pnpm --filter @havayolu/providers test` → yanıt biçimi kuralları (yerde irtifa, eksik alanlar, `lastPosition`, `now` ms/sn, boş `flight`, `~` hex, `dbFlags` bitleri), hata türleri (403 yapılandırma, 429 HTML ve 420 kısıtlama, 5xx, ağ), stub HTTP sunucusuna karşı istemciler (gzip, User-Agent, API anahtarı başlığı, yerel alıcı token'ı ve sağlık metriği)
- `pnpm ci:local`; PR'da CI yeşil

**Çıktı kaydı (2026-09-27):**
- Fixture: kullanıcı onayıyla adsb.lol'e 4 istek (aralarında 12 sn): LTFM 40 NM çevresi 18 uçak, 3 hex, 1 çağrı kodu, 1 tescil; hepsi 200. İletişim adresi yalnızca ortam değişkenindeydi.
- `pnpm --filter @havayolu/providers test` → 80/80 (yeni 30: ayrıştırıcı 17, istemciler 13). Birleştirme öncesi inceleme: 23 bulgu, 2 çürütüldü, düzeltmeler D-071.
- Kapsama gözlemi (D-071): yoğun saatte LTFM çevresinde 18 uçak, yerde hiç yok; M7 kapsama raporunda ölçülecek.
- `pnpm stats` → 194 dosya, 16.836 satır (11.988 kod); fixture JSON dosyaları da artık sayılmaz.

## M4 — Ingest, replay ve senaryo araçları
Spec boşlukları için alınan kararlar D-073'tedir; metrik birim kararı D-072'dir.

**Dizinler ve dosyalar:**
- **`packages/db`:**
  - `drizzle/0003_*`: `provider_health`'e sütunlar; `provider_health_hourly` ve `provider_status_changes` tabloları
  - `src/ingest.ts`: istasyon + ARP sorgusu, uçuş kaydı ve iz yazma, sağlayıcı sağlığı
  - `src/live.ts`: `redis-live` anahtarları (`hy:ac:*`) ve yazıcılar
- **`packages/geo`:** kt ↔ km/sa, ft/dk → m/dk, `distanceNm`, çember içerme
- **`packages/i18n/src/units.ts`:** metrik varsayılanlı birim ve sefer no biçimleyiciler (D-072)
- **`packages/providers/src/track-source.ts`:** `track_points.source` smallint kodu
- **`apps/worker/src/ingest/`:**
  - `rate.ts` (AIMD kova, geri çekilme, devre kesici)
  - `status.ts` (sağlayıcı durumu, tazelik p95)
  - `plan.ts` (kapsama planı ve istek zamanlayıcı; plan M6b'den beri `packages/geo/src/coverage.ts`'tedir, D-076)
  - `merge.ts`, `flights.ts`, `tracks.ts`
  - `writer.ts`, `index.ts` (döngüler, kapanış)
- **`tools/`:** artık `@havayolu/tools` workspace paketi; imaja girmez
  - `src/scenarios/`: deterministik sentetik seyir uçakları
  - `src/replay-receiver/`: `aircraft.json` sunar
- **`scripts/dev-replay.mts`**, kök `pnpm dev:replay`
- **Admin Servisler paneli:** "Canlı veri · adsb.lol" ve "Canlı veri · yerel alıcı" satırları (API `services.ts`, web `/admin`, i18n)

**Kabul komutları:**
- `pnpm --filter @havayolu/worker test` → sahte saatle:
  - 429 (Retry-After yok) → hız ≤ %50, bekleme; 10 dk temiz → kademeli toparlanma
  - 403 → devre açık, yeniden deneme yok
  - 5 tohum istasyonun P0'ı tek batı çemberinde, Doğu çemberi her planda
  - 0,1 rps benzetiminde birincil p95 ≤ 20 sn, takip listesi ≤ 30 sn
  - örnekleme (30 sn, ince iz kuralı, yerde 20 m) ve uçuş kaydı ayrıştırma
- `pnpm --filter @havayolu/tools test` → senaryo deterministik; replay yanıtı ayrıştırıcıdan geçer; üretimde başlamaz
- `pnpm test:integration` (önce `pnpm dev:infra`):
  - Redis canlı durum: GEO süpürme, stream sınırı
  - iz yazıcı ve uçuş kaydı (gerçek PostgreSQL)
  - sağlık tabloları
- `pnpm dev:replay` → replay alıcısı (4300) ve worker ingest; `redis-live`'da `hy:ac:*` anahtarları oluşur, `track_points_*` dolar
- `pnpm ci:local` ve `pnpm ci:full` yeşil; PR'da CI yeşil

**Notlar:**
- **Ağ:** Canlı adsb.lol isteği yalnızca üretimde (`EXTERNAL_PROVIDERS_DISABLED=false`) atılır. Yerelde ve CI'da veri replay alıcısından gelir.
- **Yayın öncesi:** CONTACT_EMAIL ve info@adsb.lol bildirimi ACTIVATION'dadır; ikisi tamamlanmadan üretimde adsb.lol çekimi başlamaz.

**Çıktı kaydı (2026-09-28):**
- **Yöntem:** Kod tabanı ve spec'ler 6 paralel okuyucuyla haritalandı. Arayüz sözleşmesi yazıldı; 6 paralel ajan ayrışık dosyalarda uyguladı, ardından tek ajan worker'a bağladı.
- **İnceleme:** 6 açıdan inceleme (spec, çalışma zamanı, veri, güvenlik, testler, araçlar ve belgeler) ve bulgu başına 3 çürütücü doğrulayıcı. 20 bulgu, 18 tekil, 11 doğrulandı (4 orta, 7 düşük), hepsi düzeltildi. Bağımsız denetimde çıkan 2 yeni kusur da düzeltildi (takip son tarihinin donması, bozuk hex'in kayıt açmayı kilitlemesi). Ayrıntı D-073'tedir.
- **Zamanlayıcı benzetimi** (0,1 istek/sn, 30 dk, tohum istasyonlar):
  - Takip listesi yokken: birincil p95 16 sn, istasyonlar ≤ 30 sn, Doğu ≤ 90 sn.
  - Takip uçağı kapsama içindeyken `/v2/hex` 0 (düzeltmeden önce isteklerin %27'siydi).
  - Kapsamaya girip çıkan ve susan uçakta birincil p95 ≤ 20 sn.
- `pnpm ci:full` → yeşil:
  - Birim testleri: worker 182, providers 88, tools 74, api 57, scripts 31, i18n 28, geo 20, web 10, shared 7, db 6 (toplam 503).
  - Entegrasyon testleri: db 40, worker 11, api 3 (toplam 54).
  - `compose:guard` yeşil; migration yükseltmesi 3 → 4.
- **`pnpm dev:replay` (yerel):**
  - `redis-live`: 10 sentetik uçak, 320 stream girdisi, hash TTL 120 sn.
  - DB: 10 aktif uçuş kaydı, 20 örneklenmiş ve 43 tam çözünürlüklü iz noktası.
  - `provider_health`'te `localReceiver` `ok`, 60 sn'de 60 istek.
- `pnpm stats` → 241 dosya, 29.228 satır (24.060 kod).
- **Kullanıcıya bağlı (`[k]`):** üretimde adsb.lol çekimi, admin "Canlı veri · adsb.lol" satırının "Çalışıyor" olması.

## Düzeltme — Durum sayfasında taşma (v0.7.1)
- **Belirti:** Üretimde /durum'daki "Derleme" ve "Sunucu sürümü" kutularında 40 haneli commit kimliği yandaki kutunun üstüne taşıyordu. Yerelde değer `dev` olduğu için görünmüyordu.
- **Neden:** `.facts` ızgarası kutuları 200 px'e kadar daraltıyor, ama boşluksuz kimlik ~400 px tutuyordu. Kırılma noktası olmayan metin kutudan dışarı taşıyordu.
- **Düzeltme:**
  - Kimliğin kısa hâli (`shortSha`, 7 hane) gösterilir, tamamı `title`'dadır. Admin'deki worker commit satırı da aynı yolla kısaltıldı.
  - `.facts` kutuları `min-width: 0`, değerler `overflow-wrap: anywhere` aldı; uzun metin kutu içinde kırılır.
- **Doğrulama:** Önizlemede 40 haneli kimlik 199 px'lik kutuda taşmadan 3 satıra kırıldı. 375 px mobil genişlikte sayfada yatay taşma yok.

## M5 — Canlı API
Spec boşlukları için alınan kararlar D-074'tedir.

**Dizinler ve dosyalar:**
- **`apps/api/src/live/`:**
  - `types.ts` (`PublicAircraft`, `LiveSource`)
  - `record.ts` (gizlilik, sefer no), `bbox.ts` (kutu, kapsama), `search.ts`
  - `cache.ts` (`redis-live` yoklaması, fark, `seq`), `routes.ts` (`/v1/live`, `/v1/search`)
  - `ws.ts` (`/v1/ws`)
- **`apps/api/src/admin/blocklist.ts`:** `/v1/admin/blocklist`
- **`packages/db/src/`:** `live.ts` (okuyucular, kapsama), `blocklist.ts`, `airlines.ts` (ICAO↔IATA)
- **`apps/worker/src/ingest/index.ts`:** kapsama çemberlerini `redis-live`'a yazar

**Kabul komutları:**
- `pnpm --filter @havayolu/api test`:
  - gizlilik: askeri ve bilinmeyen bayrak yok, PIA/LADD tescili yok
  - kutu ve kapsama; arama (hex, tescil, sefer no, çağrı kodu)
  - önbellek farkı ve `seq`; farklı `X-Forwarded-For` ayrı sayaç, güvenilmeyen XFF yok sayılır
  - WS birim: ortak hücre Buffer'ı, geri basınç, ping/pong, sınırlar, `Origin`
- `pnpm test:integration` (önce `pnpm dev:infra`):
  - `/v1/live` ve `/v1/search` gerçek `redis-live` ile; askeri uçak görünmez
  - WS: tam görüntü → fark, `lastSeq` ile devam, yeniden bağlanma mesajı ve 1012, IP sınırı
- `pnpm dev:replay` → `http://localhost:4100/v1/live?bbox=25,35,45,43` sentetik uçakları döner
- `pnpm ci:full` yeşil
- **Kullanıcıya bağlı (`[k]`):** `wss://api.havayolu.live/v1/ws` üzerinden 5 dk boşta bağlantı kopmaz. **2026-09-29 doğrulandı:** üretimde (v0.8.0) bağlantı 5 dk 30 sn boşta açık kaldı.

**Çıktı kaydı (2026-09-29):**
- **Yöntem:** Arayüz sözleşmesi (`types.ts`) önce yazıldı. Paralel ajanlar ayrışık dosyalarda uyguladı, tek ajan API ve worker'a bağladı.
- **İnceleme:** Çok açılı inceleme ve bulgu başına çürütücü doğrulayıcılar. 7 bulgu doğrulandı (6 orta, 1 düşük), hepsi düzeltildi:
  - WS tamponları için merkez geneli 64 MiB bütçe
  - engel listesi okunana kadar kapalı başlama
  - redis-live okunamazken sağlayıcının `down` görünmesi
  - `lastSeq` devam farkında güncel durum
  - abonelik hız sınırı
  - büyük kutuda `none` yerine tam çember–dikdörtgen kesişimi
  - worker 180 sn'den uzun durunca sağlayıcının yanıttan düşmemesi

  Bağımsız denetim iki düzeltmeyi yarım buldu, ikisi de tamamlandı. Tampon sınırında `close()` yerine `terminate()` kullanılıyor, çünkü `close()` tamponu 30 sn tutuyordu. Worker yapılandırdığı sağlayıcıları `hy:ingest:providers`'a yazıyor; böylece worker çökükken açılan API de sağlayıcıyı `down` gösteriyor. Ayrıntı D-074'tedir.
- **`pnpm ci:full` → yeşil:**
  - Birim testleri: worker 184, api 172, providers 88, tools 74, scripts 31, i18n 28, geo 20, db 19, web 10, shared 9 (toplam 635).
  - Entegrasyon testleri: db 58, api 15, worker 11 (toplam 84).
  - `compose:guard` yeşil; migration yükseltmesi 4 → 4 (M5'te migration yok).
- **`pnpm dev:replay` (yerel):**
  - `/v1/live?bbox=25,35,45,43` → 10 sentetik uçak; kapsama `partial`; `localReceiver` `ok`; en yeni örnek 1–2 sn.
  - `bbox=0,0,5,5` → `none`, 0 uçak; `bbox=bad` → 400; `/v1/search?q=HYS001` → çağrı kodu eşleşmesi.
  - `/v1/ws`: tam görüntü (10 uçak), ardından saniyede bir fark (4 hücre, 10 güncelleme).
- `pnpm stats` → 270 dosya, 36.182 satır (30.861 kod).

## M6 — Web canlı harita
Spec boşlukları için alınan kararlar D-075'tedir. Uydu altlığı kullanıcının seçimiyle Esri World Imagery'dir: ArcGIS Location Platform ücretsiz katmanı, anahtar ACTIVATION'da.

**Dizinler ve dosyalar:**
- **`packages/shared/src/`:**
  - `live.ts`: API ile istemcinin ortak tipleri (`PublicAircraft`, WebSocket mesajları, arama ve havalimanı yanıtları)
  - `map/`: harita renkleri, uçak kategorisi ve ikon kimlikleri, uçak/havalimanı/iz katman stilleri (mobille ortak), özgün siluetler (`silhouettes.ts`)
- **`packages/db/src/airports.ts`:** IATA kodlu havalimanları
- **`apps/api`:** `GET /v1/airports?country=TR` (10 dk bellek önbelleği)
- **`apps/web/src/lib/`:**
  - `env.ts` (harita env'leri), `map-config.ts` (altlık zinciri)
  - `live/`: `store`, `clock` (geri gitmeyen saat, sunucu saati tahmini), `interpolate`, `connection`, `subscription` (hücreye yuvarlanan abonelik), `api`, `visible`
  - `map/`: `label-text`, `label-layout`, `label-settings`, `url-state`, `shared-link` (`/?hex=` çözümü)
- **`apps/web/src/components/map/`:** `live-map.tsx`, harita görünümü ve denetleyicisi, `maplibre-loader.ts` (MapLibre'nin tembel yüklenmesi), `camera.ts`, ikonlar, `data-attribution.tsx`, `use-live.ts`; `panels/` (arama, bilgi kartı, tablo, durum şeridi, etiket ayarı)
- **`apps/web/src/app/page.tsx`:** kök `/` haritayı gösterir; menüde "Harita" ilk sıradadır
- **Geçici kullanım koşulları (kullanıcı kararı 2026-09-29, D-075):** `apps/web/src/app/kullanim-kosullari/page.tsx`, `components/terms-content.tsx`, `components/rich-text.tsx` (i18n metnine bağlantı yerleştirme), `lib/terms.ts` (yol, yürürlük tarihi, belge adresleri). Esri sözleşmesinin (E204 §3.1c.5) istediği Esri şartlarına uyma maddesi ve ODbL maddesi buradadır. Bağlantı site alt bilgisinde ve harita atıf satırındadır ("Koşullar")
- **`packages/i18n`:** `map` ve `terms` bölümleri (TR/EN)
- **`apps/web/public/test-style.json`:** yerel test stili (glif, sprite ve uzak adres yok)
- **`e2e/`:** Playwright yapılandırması ve testleri; kökte `pnpm test:e2e`, `typecheck:e2e`, `lint:e2e`
- **CI:** `e2e` işi; `deploy` onu da bekler
- **Belgeler:** D-075, data-sources.md §6a, `ATTRIBUTION.md`, ACTIVATION (Esri anahtarı; geçici kullanım koşullarının hukukçu incelemesi Parça 3 satırında)

**Kabul komutları:**
- `pnpm --filter @havayolu/web test`:
  - altlık zinciri (yerel, uydu, vektör; anahtar adrese kodlanarak yazılır)
  - uçak deposu (tam görüntü, fark, budama, iz en çok 600 nokta; örnek yaşı sunucu saatinden, eski örnek yok sayılır), ara değerleme (örnekten en çok 10 sn ileri), ekranda 0,5 px altı kaymada yükleme yok
  - bağlantı: yeniden bağlanma gecikmesi, `lastSeq`, `reconnect` mesajı, `refresh` (sahte WebSocket); abonelik planı ("Uçağı ortala" hücre içinde yeniden abone olmaz); 30 sn sessizlikte yenileme
  - etiket metni (sefer no → çağrı kodu → tescil → hex), etiket yerleşimi (500 etiket < 8 ms; yalnızca seçili etiket zorla yerleşir), havalimanı kodları uçak simgesini ve seçili izi örtmez, etiket ayarı, `?hex=` ayrıştırma ve paylaşılan bağlantı akışı
  - veri yaşı (sağlayıcı sağlıklıyken sakin bölgede artmaz), harita yokken atıf, MapLibre yükleyicisi (ortak modül bir kez)
  - atıf satırı: canlı veri atfı ve "Koşullar" bağlantısı tek girdi; harita yokken aynı metin
  - kullanım koşulları (TR ve EN): Esri maddesi, E204 ve E300 bağlantıları, ODbL maddesi, yürürlük tarihi, doldurulmamış yer tutucu yok
- `pnpm --filter @havayolu/i18n test` → TR ve EN anahtarları ve yer tutucuları aynı (`terms` dahil)
- `pnpm --filter @havayolu/shared test` → uçak kategorisi tablosu
- `pnpm --filter @havayolu/api test` → `/v1/airports` (önbellek, 400, 503, başlıklar)
- `pnpm test:integration` (önce `pnpm dev:infra`) → fixture'daki 61 IATA kodlu Türkiye havalimanı
- `pnpm test:e2e` (önce `pnpm dev:infra` ve `pnpm db:migrate`; `pnpm dev` kapalı):
  - `/api/version` → `app: havayolu`; replay uçağı API'de görünene kadar beklenir
  - harita açılır, ADSB.lol (ODbL) atfı ve veri yaşı görünür
  - replay uçağı `HYS001` tabloda görünür ve konumu 6 sn içinde değişir
  - satıra tıklayınca bilgi kartı açılır, adres `?hex=ff0001` olur; kart kapanınca `hex` silinir; satır klavyeyle de seçilir
  - arama `HYS001`'i bulur; bulunamayan sefer için spec'teki metin çıkar
  - `/?hex=ff0001` ile doğrudan açılış aynı uçağı seçer; canlı olmayan hex'te arama alanında "bulunamadı" metni çıkar
  - "Diğer uçaklar: Gizle" yeniden yüklemede korunur
  - 375 px genişlikte yatay kayma yok
  - analiz onay bandı (M1a'dan): onaysız script yok, "Kabul et" yükler, "Reddet" yüklemez, tercih alt bilgiden ve harita sayfasında harita denetimlerinden değişir, admin'de bant yok
  - `/kullanim-kosullari` 200 döner ve Esri maddesini içerir (E204 bağlantısı, ODbL); haritanın atıf satırındaki "Koşullar" bağlantısı sayfayı açar; site alt bilgisinde "Kullanım koşulları" bağlantısı var
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** Esri anahtarı girilince https://havayolu.live haritası uydu görüntüsü ve "Powered by Esri" atfı gösterir; atıf satırındaki "Koşullar" bağlantısı https://havayolu.live/kullanim-kosullari'yi açar (ACTIVATION). Geçici kullanım koşullarının hukukçu incelemesi Parça 3 ACTIVATION satırındadır. 2026-09-30 doğrulandı: üretimde (v0.9.0) uydu görüntüsü, 'Powered by Esri' atfı ve 'Koşullar' bağlantısı görünüyor; karolar 200.

**Çıktı kaydı (2026-09-29):**
- **Yöntem:** Arayüz sözleşmesi yazıldı; 5 paralel ajan ayrışık dosyalarda uyguladı (paylaşılan tipler ve `/v1/airports`, web mantık modülleri, MapLibre çizimi, paneller ve i18n, E2E/CI/belgeler), tek ajan birleştirdi.
- **İnceleme:** 6 açıdan inceleme (spec ve tasarım, çalışma zamanı, güvenlik/gizlilik/lisans, erişilebilirlik ve mobil, test/CI/belgeler, performans) ve bulgu başına 3 çürütücü doğrulayıcı. 35 bulgudan 23'ü çoğunlukla doğrulandı (tekilleştirilince 18 sorun), hepsi düzeltildi. Başlıcaları:
  - harita başlatılamadığında da görünen ADSB.lol atfı
  - havalimanı kutucuklarının uçakları örtmemesi
  - örnek yaşına göre "son görülme"
  - "Uçağı ortala"da seyrek abonelik
  - yarım pikselin altındaki hareketlerde veri yüklememe
  - altlık yüklenirken de çizilen uçaklar
  - uydu → koyu vektör → yedek → düz arka plan zinciri
  - haritada analiz tercihleri düğmesi
  - MapLibre'nin sayfa paketinden ayrılması

  Bağımsız denetim 23 bulgunun hepsini düzeltilmiş buldu; 10 kasıtlı hata denemesinin hepsi testlerce yakalandı. Denetimin küçük notları da düzeltildi (karo kuralı yalnızca Esri karolarına uygulanır, MLAT ibaresi, test anahtarı).
- **Kullanım koşulları:** Esri E204 §3.1c.5 gereği `/kullanim-kosullari` (geçici metin, TR/EN) eklendi; kullanıcı kararı 2026-09-29.
- **`pnpm ci:full` → yeşil** (önbelleksiz turbo çalıştırması dahil):
  - Birim testleri: web 245, worker 184, api 182, providers 89, tools 74, shared 34, i18n 31, scripts 31, db 26, geo 20.
  - Entegrasyon testleri: db 61, api 16, worker 11.
  - E2E: 17/17 (kurulum 1, onay 4, canlı harita 9, koşullar 3).
  - `compose:guard` yeşil; migration yükseltmesi 4 → 4 (M6'da migration yok).
- `pnpm stats` → 361 dosya, 49.569 satır (43.835 kod).

## M6b — Havalimanı sayfaları ve keşfedilebilirlik (SEO, GEO)
Onay: 2026-09-29 (kullanıcı isteği: SEO/GEO, kararlar sohbette)

Kararlar ve gerekçeler D-076'dadır. Kilometre taşı Parça 1'e sonradan eklendi. Parça 3 M2'nin dil yönlendirmesi buraya taşındı (`docs/prompts/parca-3.md`).

**Kapsam:**
- Dil adreste: Türkçe `/`, İngilizce `/en/...`; her genel sayfanın `/en` ikizi var. Dil çerezi emekliye ayrıldı; eski `/dil` bağlantıları önekli adrese 308 ile gider.
- Yeni genel sayfalar: `/havalimanlari` (61 havalimanı), `/istasyon/<ICAO>` (veritabanındaki gerçek veri), `/hakkinda` (veri kaynakları ve yöntem).
- Canonical ve hreflang (`x-default` İngilizce), robots.txt, site haritası, manifest, ikonlar, paylaşım (OG) görselleri, JSON-LD, `/llms.txt`, arama motoru doğrulama env'leri.
- Havalimanı ayrıntı API'si: `include=runways` ve `GET /v1/airports/:code`.
- Kapsam dışı: METAR/TAF (Parça 2 M2'den M6c'ye öne alındı, D-078), istasyon operasyon panosu (Parça 3 M4), uçuş sayfası (Parça 3 M3b), service worker (Parça 3 M5), IndexNow (ayrı PR, kullanıcı onayıyla).

**Dizinler ve dosyalar:**
- **`packages/shared/src/`:** havalimanı ayrıntı tipleri (`AirportDetail`, `RunwayDetail`); `reference/`: `tr-provinces.ts` (ISO 3166-2:TR), `airport-names.ts` (resmî adlar; kaynak DHMİ, işletmeci ya da OurAirports), `runway-surface.ts`
- **`packages/db/src/airports.ts`:** pistler, pist düzeltmeleri (alan alan `COALESCE`), istasyon bilgisi, `dataUpdatedAt`
- **`apps/api/src/`:** `reference/airports.ts` (`include=runways`, `GET /v1/airports/:code`); `app.ts` (`GET /robots.txt` → `Disallow: /`, her yanıtta `X-Robots-Tag: noindex`)
- **`apps/web/src/lib/`:**
  - dil: `locale-routing.ts`, `locale.ts`, `safe-path.ts`, `admin-host.ts`
  - `env.ts` (`WEB_HOST` üretimde zorunlu; üç doğrulama env'i), `airports.ts` (tek toplu istek, 1 saat önbellek)
  - `seo/`: `metadata.ts` (`pageMetadata`, `siteUrl`), `structured-data.ts`, `robots.ts`, `sitemap.ts`, `llms.ts`, OG yardımcıları ve yazı tipleri
- **`apps/web/src/proxy.ts`:** `/en/*` yeniden yazma, `/tr/*` → 308, dil ve yol başlıkları, `X-Robots-Tag`
- **`apps/web/src/app/`:**
  - sayfalar: `havalimanlari/page.tsx`, `istasyon/[icao]/page.tsx` + `opengraph-image.tsx`, `hakkinda/page.tsx`; mevcut sayfalarda `pageMetadata` ve JSON-LD; `admin/layout.tsx` (noindex, nofollow); `dil/route.ts` (308)
  - kök dosyalar: `robots.ts`, `sitemap.ts`, `manifest.ts`, `icon.tsx`, `apple-icon.tsx`, `favicon.ico`, `og/site/route.ts`, `llms.txt/route.ts`
  - `apps/web/public/robots.txt` silindi
- **`apps/web/src/components/`:** `language-toggle.tsx` (düz `<a hreflang lang>`), `json-ld.tsx`, `airports/`, `about/`; `map/` (`?havalimani=<ICAO>`, `/en` önekini koruyan `?hex=`)
- **`apps/web/`:** `next.config.ts` (`htmlLimitedBots: /.*/`, `outputFileTracingIncludes`), `assets/og-fonts/` (Overpass latin ve latin-ext `.woff`, OFL-1.1)
- **`scripts/gen-favicon.mts`:** `favicon.ico` üretimi (yeni bağımlılık yok)
- **`packages/i18n`:** `nav`, `seo`, `airports`, `airport`, `surface`, `about` (TR/EN)
- **`e2e/`:** `tests/seo.spec.ts`, `tests/airports.spec.ts`, `tests/language.spec.ts`, `html.ts` (ham HTML, robots, site haritası ayrıştırıcıları); kurulum API'de 61 havalimanını bekler ve yeni sayfaları derletir
- **Belgeler:** D-076; CLAUDE.md URL şeması; `docs/prompts/parca-3.md` M2 notu; ACTIVATION (Search Console, Bing Webmaster, Yandex Webmaster); REFERENCES; ATTRIBUTION (Overpass, paylaşım görselleri); `.env.example` ve `deploy/dokploy.env.example` (üç doğrulama env'i); `.claude/rules/web-ui.md`

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test`:
  - 81 il kodunun hepsi; fixture'daki her `iso_region` çözülür
  - fixture'daki 61 havalimanının her biri için ad kaydı ya da açık OurAirports yedeği
  - fixture'daki her pist kaplaması eşlenir
- `pnpm --filter @havayolu/api test`:
  - `GET /v1/airports/:code`: 400, 404, IATA ile arama, başlıklar, pist düzeltmeleri uygulanır, pistler sıralı
  - `include=runways`
  - API `GET /robots.txt` ve her yanıtta `X-Robots-Tag`
- `pnpm test:integration` (önce `pnpm dev:infra`) → 61 havalimanı, 51'i indekslenebilir; LTFM 6 pist; her havalimanında en az bir pist; LTFM yönleri uç koordinatlarından
- `pnpm --filter @havayolu/web test`:
  - dil: `localeRouting`'in her dalı (`/en`, `/en/x`, `/english`, `/tr/x`, `/en/admin`, `/en/robots.txt`), `localePath`, `alternatesFor` (kendisi, tr, en, x-default); admin host'unda `/robots.txt` geçer; dil anahtarı (`?hex=` korunur, `/en` ↔ `/`); `safe-path` `/en` yolları
  - env: doğrulama env'leri, üretimde `WEB_HOST` zorunlu
  - SEO: `pageMetadata`; her fixture havalimanının başlığı ve açıklaması (açıklama 70–170 karakter; "rötar", "gecikme", "kalkış saati", "METAR", "meydan" yok); `JsonLd` `<` kaçışı; Airport düğümünde `iataCode`, `icaoCode` ve sayısal `geo`
  - robots (web host'u politikası ve mutlak Sitemap, admin host'u `Disallow: /`), site haritası (adres sayısı = (indekslenebilir havalimanı + 5) × 2, mutlak, karşılıklı, noindex sayfa yok), llms.txt (`# havayolu` ile başlar, bağlantılar mutlak, indekslenebilir her havalimanı bir satır)
  - paylaşım görseli çizilirken `fetch` hiç çağrılmaz (Google Fonts yedeği yok)
- `pnpm --filter @havayolu/i18n test` → TR ve EN anahtarları ve yer tutucuları aynı
- `pnpm test:e2e` (önce `pnpm dev:infra` ve `pnpm db:migrate`; `pnpm dev` kapalı):
  - kurulum: API `/v1/airports?country=TR` 61 havalimanı döndürene kadar beklenir; `GET /v1/airports/ist` → LTFM, 6 pist
  - `/`, `/havalimanlari`, `/istasyon/LTFM`, `/hakkinda`, `/yenilikler`, `/kullanim-kosullari` ve `/en` ikizleri: 200, doğru `<html lang>`, beklenen başlık, tek ve kendini gösteren mutlak canonical, karşılıklı tr/en/x-default hreflang (x-default İngilizce), `og:url` ve `og:locale`; GPTBot User-Agent'ıyla hepsi `<head>` içinde
  - JSON-LD: her blok ayrıştırılır; ana sayfada `WebSite` + `Organization`, `SearchAction` yok; havalimanında `Airport` (IATA, ICAO, sayısal `geo`) ve sıralı `BreadcrumbList`; listede 61 öğelik sıralı `ItemList`; sayfa düğümünün `inLanguage` değeri `<html lang>` ile aynı
  - yönlendirme ve durum kodları: `/istasyon/ltfm`, `/istasyon/IST` ve `/istasyon/ist` → 308 → `/istasyon/LTFM`; `/en/istasyon/ist` → `/en/istasyon/LTFM`; `/tr/durum` → `/durum`; `/dil?to=en&next=/durum` → 308 → `/en/durum` (`X-Robots-Tag`, `lang` çerezi silinir, site dışı hedef reddedilir; `next=/en//evil.example` ve `next=/tr//evil.example` de site içinde kalır); `/istasyon/ZZZZ` gerçek 404; `/en/admin`, `/en/robots.txt`, `/english` 404
  - canonical ve noindex: `/?hex=ff0001` ve `/?havalimani=LTFM` canonical `/`; `/durum` ve resmî adı doğrulanamayan tarifesiz hava üssü (LTAG) `noindex, follow`; `/admin` ve `/admin/giris` `noindex, nofollow`
  - kök dosyalar: robots.txt (tek `*` grubu, `Disallow: /admin`, yalnızca Bytespider grubu, mutlak `Sitemap:`); sitemap.xml (120 adres, LTFM için `xhtml:link` karşılıkları, `/durum` ve LTAG yok, iki istekte aynı); llms.txt; manifest ve ikonlar (PNG boyutları); `favicon.ico`; OG görselleri 1200×630 PNG (havalimanı görseli TR ve EN'de aynı); web `/api/version` ve API host'unun yanıtları `X-Robots-Tag: noindex`
  - tarayıcı: dil anahtarı `/istasyon/LTFM` ↔ `/en/istasyon/LTFM` ve `lang` değişir; istemci geçişinden sonra anahtar yeni sayfayı gösterir; haritada `/?hex=ff0001` ↔ `/en?hex=ff0001`, seçim dil değişince korunur, EN haritada seçim adresi `/en?hex=`; EN sayfalardaki bütün site içi bağlantılar `/en` altında, TR sayfalarda hiçbiri
  - `/havalimanlari` tablosunda 61 satır, satır havalimanı sayfasını açar; havalimanı sayfasında görünür yol, 6 satırlı pist tablosu, yakın havalimanları ve `/hakkinda` bağlantısı; "Canlı haritada aç" haritayı LTFM'de açar (taksi uçağı görünür, Esenboğa–Van uçağı görünmez); 320 px'te yatay kayma yok; klavye odak halkası açık ve koyu temada zemine karşı ≥ 3:1
  - mevcut onay bandı, canlı harita ve kullanım koşulları testleri değişmeden geçer
- `pnpm build` → metadata rotaları dinamik (build'e `WEB_HOST` gömülmez); `.next/standalone/apps/web/assets/og-fonts` var
- `pnpm dev:replay` üzerinde elle: `curl` ile `/`, `/en`, `/havalimanlari`, `/en/havalimanlari`, `/istasyon/LTFM`, `/en/istasyon/LTFM`, `/istasyon/ist` (308), `/hakkinda`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/manifest.webmanifest`, `/icon/192`, OG görseli; `curl -A "GPTBot/1.2"` → başlık, canonical ve hreflang `<head>` içinde; API `GET /robots.txt` ve `X-Robots-Tag`
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):**
  - Yayından sonra `curl -A "GPTBot/1.2" https://havayolu.live/istasyon/LTFM` → canonical ve hreflang `<head>` içinde; `curl https://api.havayolu.live/robots.txt` → `Disallow: /`.
  - Google Search Console, Bing Webmaster Tools ve Yandex Webmaster doğrulaması ve site haritası gönderimi (ACTIVATION).

**Sonuçlar (2026-10-01, entegrasyon):**
- `pnpm ci:full` → yeşil: format, EOL, changelog, script ve e2e tip denetimi, e2e lint, `db:check`, `test:scripts` (31), lint, typecheck, build; `compose:guard` (8 servis, 64 anahtar); migration yükseltme (4 → 4).
- Birim testleri: shared 46, i18n 31, geo 20, providers 89, db 32, worker 184, tools 74, api 197, web 416 (45 dosya).
- `pnpm test:integration` → db 65, api 19, worker 11.
- `pnpm test:e2e` → 58/58 (3 kurulum + 55 test, ~48 sn).
- `pnpm build` → `robots.txt`, `sitemap.xml`, `manifest.webmanifest`, `llms.txt`, `/og/site`, `/istasyon/[icao]/opengraph-image` ve bütün sayfalar dinamik (ƒ); `/icon/192`, `/icon/512` (●), `/apple-icon` ve `favicon.ico` build'de üretilir. `.next/standalone/apps/web/assets/og-fonts` dört `.woff` ve `OFL.txt` ile var.
- Standalone üretim sunucusu (yan port 3190, `APP_ENV=production`, `WEB_HOST=localhost:3190`): `Sitemap:` satırı, site haritası ve canonical adresler çalışma zamanındaki `WEB_HOST`'u kullanır (build'e gömülmez); `/en/istasyon/LTFM` `lang="en"` ve EN canonical ile döner; havalimanı ve site OG görselleri `Cache-Control: public, max-age=86400`'ü korur.
- `pnpm dev:replay` üzerinde curl:
  - GPTBot User-Agent'ıyla `/`, `/en`, `/havalimanlari`, `/istasyon/LTFM`, `/hakkinda`, `/yenilikler`, `/kullanim-kosullari` ve EN ikizleri: 200, doğru `lang`; başlık, tek canonical, tr/en/x-default hreflang ve `og:url` `<head>` içinde; JSON-LD sayfa gövdesinde (`<main>`; React satır içi betiği `<head>`'e taşımaz, Google için yeri önemsizdir); `/durum`, `/en/durum` ve LTAG `noindex, follow`; `/?hex=ff0001` ve `/en?havalimani=LTFM` canonical `/` ve `/en`.
  - `/istasyon/ist` → 308 `/istasyon/LTFM`; `/en/istasyon/ltfm` → 308 `/en/istasyon/LTFM`; `/istasyon/ZZZZ` → 404 (`noindex`); `/en/admin`, `/en/robots.txt` → 404; `/tr/durum?x=1` → 308 `/durum?x=1`; `/dil?to=en&next=/durum` → 308 `/en/durum` (`X-Robots-Tag: noindex`, `lang` çerezi silinir; `next=//evil.com` → `/en`).
  - `/robots.txt` tek `*` grubu + Bytespider; `/sitemap.xml` geçerli XML, 112 adres, 336 `xhtml:link`; `/llms.txt` 51 havalimanı satırı; manifest, `/icon/192`, `/icon/512`, `/apple-icon`, `favicon.ico`, `/og/site` ve havalimanı OG görseli 200 ve doğru içerik türü; web `/api/version` `X-Robots-Tag: noindex`.
  - API: `GET /robots.txt` → `Disallow: /`; `/v1/airports/ist` 200, `zzzz` 404, `x1` 400; bütün yanıtlarda (404 dahil) `X-Robots-Tag: noindex`.
- Bilinen sınır: `/istasyon/<bilinmeyen>` 404'ünün sunucu HTML'i Next'in boş hata kabuğudur (`<html id="__next_error__">`); 404 sayfası tarayıcıda çizilir (D-076 → "Gerçek 404").

**İnceleme düzeltmeleri (2026-10-01; doğrulanan 20 bulgu, tekilleştirilince 16 sorun, hepsi düzeltildi, ayrıntı D-076):**
- `/dil` açık yönlendirmesi (`next=/en//evil.example` → `//evil.example`) kapatıldı; proxy'de `/tr//…` ve `/en//…` 404.
- Kök dosyalar yeniden proxy'den geçer: www'de 308, admin host'unda `X-Robots-Tag` ve `/admin` yönlendirmesi (site haritası, llms.txt, OG).
- Boş havalimanı listesi saatlik önbellekte kalırsa dakikalık ikinci kayıt okunur; önbelleksiz istek yok.
- Dizine ekleme: tarifeli ya da istasyon ya da resmî adı doğrulanmış sivil havalimanı (fixture'da 55; noindex 6 askerî üs). OurAirports tarifeli sefer ve pist ışıklandırması bayrakları kaynağa atfedilir, "Yok" denmez.
- Kapsama planı `packages/geo/src/coverage.ts`'e taşındı; çekim alanı dışındaki havalimanı (LTCW) canlı haritada uçak vaat etmez, `/hakkinda` onu veriden listeler.
- `/hakkinda` ve llms.txt: "her hesaplanan değer tahmini etiketlidir" cümlesi kaldırıldı; birincil çember 40 NM; durum satırı birincil istasyonun veri yaşını gösterir.
- İngilizce adlar çeviri olarak atfedilir; ham OurAirports yerleşimi (Istanbul(Bakırköy) vb.) sayfada ve JSON-LD'de yok; açık temada odak halkası `#1f5fd1` (5,4:1).
- Site haritası E2E'sindeki `lastmod` denetimi gün biçimli tarihlerde İstanbul takvimine göre kıyaslar (00:00–03:00 arası kırmızı olmaz).
- `pnpm ci:full` → yeşil. Birim testleri: shared 49, i18n 31, geo 31, providers 89, db 32, worker 175 (kapsama planı testleri geo'ya taşındı), tools 74, api 197, web 442 (46 dosya), scripts 31. `test:integration` → db 65, api 19, worker 11. Migration yükseltme 4 → 4. `compose:guard` 8 servis, 64 anahtar. `test:e2e` → 59/59 (3 kurulum + 56 test). Site haritası artık 120 adres, llms.txt 55 havalimanı satırı.
- **Bağımsız denetim:** 20 bulgunun hepsi düzeltilmiş bulundu. `/dil` için 53 düşmanca girdiyle (424 çağrı, 25 proxy yolu) atlatma denendi, site dışına giden yönlendirme yok. 16 mutasyonun 15'i testlerce yakalandı (16. satır başka denetimle zaten kapalı). Denetimin bulduğu, `main`'de de olan bir sorun düzeltildi: `next` "ş" gibi Latin-1 dışı karakter içerince `/dil` 500 dönüyordu; hedef artık yüzde kodlanır (test eklendi).
- `pnpm stats` → 434 dosya, 60.942 satır (54.417 kod).

## M6c — Havalimanı hava durumu, METAR/TAF kaydı ve harita penceresi
Onay: 2026-10-01 (kullanıcı isteği: havalimanı hava durumu, METAR/TAF kaydı, harita penceresi)

Kararlar ve gerekçeler D-078'dedir; düzeltme turundaki harita ek istekleri (pin, yazı boyu, açılış görünümü, tıklama önceliği) D-079'dadır. Kilometre taşı Parça 1'e sonradan eklendi; METAR/TAF Parça 2 M2'den öne alındı (`docs/prompts/parca-2.md`). Hedef sürüm 0.11.0, migration 0004.

**Kapsam:**
- Her havalimanı sayfasında (`/istasyon/<ICAO>`, TR ve EN) canlı hava durumu: rüzgâr (yön, hız, hamle), yağmur, kar, gök gürültüsü ve sis her zaman açıkça; görüş, bulut, sıcaklık, nem, basınç, gözlem saati ve yaşı, TAF tahmini, yerel saat, gün doğumu ve batımı. Sade görünüm metrik ve kodsuz; ayrıntı ve ham metin uzman `<details>`'inde.
- METAR/TAF kaydı: her farklı rapor 30 gün saklanır; sayfada son 24 saatin "METAR/TAF kaydı" listesi; API'den istek başına en çok 7 gün.
- Kaynak aviationweather.gov: worker METAR'ı 5 dk'da, TAF'ı 15 dk'da bir tek toplu istekle çeker; günlük budama.
- API: `GET /v1/weather?country=TR`, `GET /v1/airports/:code/weather`, `GET /v1/airports/:code/weather/history?hours=`.
- Canlı haritada havalimanına (pini ya da IATA kutucuğu) tıklayınca küçük pencere: ad, kodlar, il, rakım, pist özeti, yerel saat, gün doğumu ve batımı, güncel hava, havalimanı sayfası bağlantısı. Klavyeyle "Havalimanları" listesinden açılır.
- **Ek istekler (kullanıcı, 2026-10-01; D-079):**
  - havalimanı noktası yerine özgün kırmızı pin (ucu referans noktasında, beyaz kenar ve koyu hat, yakınlaştırmayla büyür); IATA kodu pinin yanında ya da üstünde, pini örtmez; pin ve kod tıklanır
  - harita yazıları ~1 px küçük (uçak etiketi 12/11 px, kod 11 px), çakışma düzeni yeni boyutlarla
  - açılış görünümü her açılışta ve yenilemede IST/LTFM merkezli, kısa kenar ~100 km (masaüstünde z8,5, telefonda ~7,8); `?hex=` ve `?havalimani=` önceliklidir; Türkiye görünümü kaldırıldı
  - tıklama önceliği: uçak etiketi > havadaki uçak > havalimanı kodu ya da pini > yerdeki uçak > dokunma payı; IST'nin kodu yerdeki uçakların üstüne yazılabilir
  - `/havalimanlari` kapsam cümlesindeki "OurAirports'ta tarifeli seferi kayıtlı" ifadesi kaldırıldı (yalın dahil etme cümlesi); `/hakkinda` tazelik listesi kalır
- "Tarifeli sefer (OurAirports)" ve "İzlenen istasyon" bilgileri her yerden kaldırıldı (dizine ekleme kuralı D-076'daki gibi kalır).
- Havalimanı sayfasında "Sefer sayısı, rötar ve iptal" bölümü: bu bilgilerin henüz olmadığını açıkça söyler.
- Admin Servisler'de "Hava durumu · aviationweather.gov" satırı.
- Kapsam dışı: rötar, iptal ve tarife (Parça 5, ücretli sağlayıcı, DUR-SOR 5); gözlenen günlük iniş ve kalkış sayıları ve pist kullanımı (Parça 2 motoru); `/havalimanlari` listesinde hava durumu; canlı fixture kaydı (kullanıcı kararı: fixture'lar elle yazılır).

**Dizinler ve dosyalar:**
- **`packages/shared/src/map/airport-pin.ts`, `layers.ts`, `colors.ts`:** pin geometrisi, pin symbol katmanı ve renkleri (D-079)
- **`packages/shared/src/weather/`:** zod sözleşmesi (`AirportWeatherSchema`, `WeatherBulkResponseSchema`, `WeatherHistoryResponseSchema`), METAR/SPECI ve TAF çözümleyicileri (ham metinden), türetilen değerler (başlık, tavan, bağıl nem, kuvvetli rüzgâr, yaş sınıfı), i18n anahtarı döndüren özetleyici, pusula yönü, gün doğumu ve batımı (NOAA), yerel saat; saf, IO yok
- **`packages/providers/src/weather/`:** aviationweather.gov istemcisi (HTTPS, User-Agent, `redirect: 'manual'`, gövde sınırı, 200/204/400/403/429/5xx, `Retry-After`) ve toleranslı AWC JSON şeması; `license.ts` → `aviationWeather` 7 alan
- **`tools/fixtures/weather/`:** elle yazılmış, "sentetik" etiketli METAR ve TAF fixture'ları; LTFM için en az 3 günlük kayıt
- **`packages/db`:** `weather_metar`, `weather_taf`, `weather_sources` (`drizzle/0004_weather.sql`); `src/weather.ts` (ekleme, son rapor, kayıt sorgusu, budama, kaynak durumu)
- **`apps/worker/src/jobs/`:** `weather-metar` (5 dk), `weather-taf` (15 dk), `weather-prune` (günlük); `EXTERNAL_PROVIDERS_DISABLED` iken geliştirme ve testte fixture (zamanlar tam saat kaydırılır), üretimde nedeniyle kapalı
- **`apps/api/src/`:** `reference/cache.ts` (`cachedReader` ayrıldı), `reference/weather.ts` (üç uç nokta, OpenAPI etiketi `weather`), `admin/services.ts` (hava durumu satırı), `app.ts` ve `index.ts` bağlantıları
- **`apps/web/src/`:**
  - `lib/weather.ts` (sunucu yükleyicisi; hata `null` döner), `lib/use-now.ts` (`components/map/`'ten taşındı)
  - `components/airports/`: hava durumu bölümü ve istemci yenileme adası, METAR/TAF kaydı listesi, sefer bilgisi bölümü, simgeler; kaldırılan iki bilgi
  - `app/istasyon/[icao]/page.tsx`, `app/havalimanlari/` (iki sütun kalktı), `app/llms.txt/` ve `lib/seo/` (kaldırılan satırlar)
  - `components/map/`: havalimanı penceresi (`airport-popup.tsx`), pin ve kutucuk isabet testi (`resolveHit`), konumlama, odak yönetimi, uçak kartıyla karşılıklı dışlama, tembel toplu hava isteği, "Havalimanları" listesi (`panels/airport-list-control.tsx`), pin bitmapi (`icons.ts`), IST açılış görünümü (`camera.ts`)
  - `lib/wall-clock.ts`: sunucu saatine bağlı duvar saati (hava durumu "şimdi"si)
  - `app/globals.css`: bölümlerin ve pencerenin stilleri
- **`packages/i18n`:** `weather.*` (satırlar, hava olayları, rüzgâr, bulut, yaş, TAF şablonları, kayıt listesi, uzman ayrıntısı, kaynak ve uyarı), `airport.schedule.*`, `map.airportPopup.*`, admin ve hakkında satırları; kaldırılan bilgilerin anahtarları silindi
- **`e2e/`:** `tests/weather.spec.ts`; kurulum (`app.setup.ts`) sayfaları derletmeden önce LTFM'nin METAR/TAF kaydının ve toplu yanıttaki son METAR'ın API'de görünmesini bekler; `support.ts`'te hava fixture değerleri (`PRIMARY_WEATHER`, `NO_WEATHER_AIRPORT`)
- **Belgeler:** D-078; `docs/spec/data-sources.md` §5; `docs/REFERENCES.md` (AWC, NWS, MGM, WMO-782, NOAA güneş hesabı); `docs/RUNBOOK.md` (AWC 429/403); `docs/spec/domain.md` (QNH kaynağı); `docs/prompts/parca-2.md` ve `parca-3.md` notları; `ATTRIBUTION.md`; `tools/fixtures/README.md`; `docs/ACTIVATION.md` (üretimde ilk gerçek METAR'ın doğrulanması)

**Kabul komutları:**
- `pnpm --filter @havayolu/db db:generate --name weather` ve `pnpm db:check` → şema ile migration tutarlı
- `pnpm --filter @havayolu/shared test`:
  - METAR/SPECI: yağmur, kar, gök gürültüsü, FZRA, VC, RE, CAVOK, NSC, NCD, SKC, VV, VRB, sakin, hamle, değişken yön aralığı, RVR, NOSIG/TEMPO/BECMG, AUTO, NIL, COR; tanınmayan parça → "belirlenemedi" (MGM ve WMO-782 örnekleri dahil)
  - TAF: PROB30 TEMPO, AMD, CNL, NIL, yerine geçme, ay dönümü; "… saatine kadar" olayın gerçek sonudur (yalnız rüzgârı değiştiren BECMG, MGM BCFG örneği, örtüşen iki TAF'ta da yağmur)
  - eğilim penceresi: taze gözlemde "önümüzdeki 2 saat", 30 dk–2 sa'te bitiş saatiyle, sonra yok
  - başlık sıralaması ("-DZ FG" sis başlığı alır), bağıl nem (20/15 → %75; 5/4 → %95), tavan, kuvvetli rüzgâr, yaş sınıfı, pusula sınırları
  - gün doğumu ve batımı LTFM için üç tarihte NOAA hesaplayıcısına ±1 dk
- `pnpm --filter @havayolu/providers test` → URL (düz virgül, belgelenmemiş parametre yok), 200, 204 (ayrıştırılmaz), 400, 403, 429 (`Retry-After` var ve yok), 5xx, 3xx, gövde sınırı, zaman aşımı, 400 kayıtta bölme; AWC şeması (`"VRB"`, `"6+"`, boş ve bilinmeyen alanlar); lisans kaydı
- `pnpm --filter @havayolu/worker test` → çalışma kipi (lisans engeli, uzak, fixture, kapalı), fixture kaydırma (epoch ve ham gruplar, ay dönümü), 429 → engel ve atlanan çalışmalar, 403, 204 satırları korur, zamanlama kalıpları; kesinti sonrası METAR geriye bakışı (5 sa önce son denetim → 6 sa, ilk açılış → 24 sa) ve uzun geriye bakışta istasyon gruplama (providers)
- `pnpm --filter @havayolu/api test` → üç uç nokta: ICAO ve IATA, 400/404/503, `Cache-Control`, `hours` 1–168, gövde 1 MB altında (168 saat dahil), OpenAPI etiketi ve şeması, okurken çözümleme; admin hava durumu satırının durumları; geçmiş önbelleği farklı saat ve istasyonlarla doldurulsa da anahtar ve bayt sınırında kalır; yayımlanan OpenAPI şemaları fixture yanıtlarını Ajv ile doğrular (null enum)
- `pnpm --filter @havayolu/web test` → duvar saati (uyku, yanlış cihaz saati), açılışta iki yanıtın da tazeliği, uzman tablosunda pist yüzeyi durumu ve renk durumu, "1 report", kuvvetli rüzgâr etiketinden önce ayraç, pencerede Escape kuralı ve kibar bildirim, görünümdeki havalimanları listesi, tıklama önceliği, pin geometrisi ve IST kodu kuralı, IST açılış yakınlaştırması; hava durumu bölümü her fixture vakası için (yağmur, kar, gök gürültüsü ve sis satırları hep var; CAVOK, VRB, hamle, SPECI ve dolu, FZRA, gecikmiş, eski, rapor yok, TAF yok, süresi dolmuş TAF, API yok), METAR/TAF kaydı listesi, sefer bilgisi bölümü, kaldırılan iki bilgi yok; harita penceresinin saf parçaları (konumlama, isabet testi, veri birleştirme); SEO yasak kelime testi aynen geçer, JSON-LD'de hava durumu anahtarı yok
- `pnpm --filter @havayolu/i18n test` → TR ve EN anahtarları ve yer tutucuları aynı
- `pnpm test:integration` (önce `pnpm dev:infra`) → hava tabloları: ekleme, COR değişimi, 30 günlük budama, istasyon budaması, kaynak durumu, en yeni rapor ve geçmiş sorgularının dizini sıralama adımı olmadan kullanması (EXPLAIN); 5 migration; worker zamanlayıcıları ve fixture'dan dolan `weather_metar`; API gerçek PostgreSQL'le
- `pnpm test:migration-upgrade` → 4 → 5
- `pnpm test:e2e` (önce `pnpm dev:infra` ve `pnpm db:migrate`; `pnpm dev` kapalı):
  - kurulum: `/v1/weather?country=TR` METAR'lı istasyon döndürene ve LTFM kaydı dolana kadar beklenir
  - API: toplu yanıtta 61 havalimanı (LTBQ'nun raporu yok), `/v1/airports/ist/weather` → LTFM, kayıt en yenisi önce ve METAR ile TAF içerir, 72 saat 24 saatten fazla döndürür, `hours=0`, `169` ve `abc` → 400, `ZZZZ` → 404
  - `/istasyon/LTFM` ve `/en/istasyon/LTFM`: hava durumu bölümü ve açık rüzgâr (hamle, kuvvetli rüzgâr), yağmur, kar, gök gürültüsü ve sis satırları; yerel saat, gün doğumu ve batımı; uzman ayrıntısında ham METAR; METAR/TAF kaydında en az fixture'daki kadar kayıt, en yenisi önce; sefer sayısı, rötar ve iptal bölümü; başlık, açıklama ve JSON-LD'de hava durumu yok; "Tarifeli sefer" ve "İzlenen istasyon" hiçbir yerde yok (liste, liste açıklaması ve llms.txt dahil); 320 px'te yatay kayma yok
  - harita: IST kutucuğuna tıklayınca pencere ad, kodlar, rakım, pistler, yerel saat, gün doğumu ve batımı, hava durumu ve "Havalimanı sayfası" bağlantısıyla açılır ve odak pencereye geçer; Escape kapatır ve odak haritaya döner; arama kutusundaki Escape kapatmaz; kapat düğmesi ve haritada boş yere tıklama kapatır; uçak seçmek pencereyi kapatır; bağlantı havalimanı sayfasını açar; 375 px'te pencere alttan açılan sayfadır; "Havalimanları" listesinden klavyeyle açılır ve hava durumu kibarca bildirilir; z10'da apronda IST kodu ve pini tıklanır
  - açılış görünümü IST merkezlidir (görünümdeki ilk havalimanı IST, LTFM'deki taksi uçağı tabloda), yenilemede de; Esenboğa sayfasındaki "Canlı haritada aç" ESB'de açar
  - mevcut onay bandı, canlı harita, dil, SEO, havalimanı ve kullanım koşulları testleri geçer
- `pnpm dev:replay` üzerinde elle: `curl` ile `/v1/weather?country=TR`, `/v1/airports/LTFM/weather`, `/v1/airports/IST/weather/history?hours=24`; tarayıcıda `/istasyon/LTFM`, `/en/istasyon/LTFM`, `/istasyon/LTCW` (eski gözlem), `/istasyon/LTBQ` (rapor yok), haritada IST penceresi, admin Servisler'de hava durumu satırı
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra üretimde gerçek METAR'ların geldiğinin doğrulanması (ACTIVATION). **2026-10-02 doğrulandı:** 61 havalimanının 54'ünde METAR, 55'inde TAF; IST geçmişi 48 rapor.

**Çıktı kaydı (2026-10-02):**
- **Yöntem:** Araştırma notu (AWC API'si, MGM/WMO terimleri, kod tabanı) üzerine sözleşme yazıldı. 6 paralel ajan ayrışık dosyalarda uyguladı: çözümleyici, sağlayıcı/DB/işler, API, havalimanı sayfaları ve i18n, harita penceresi, E2E ve belgeler. Ardından tek ajan birleştirdi.
- **İnceleme:** 6 açıdan inceleme ve bulgu başına 3 çürütücü doğrulayıcı. 16 bulgu doğrulandı; ilk turdaki dizin bulgusu da eklendi (migration yayımlanmadığı için 0004 yeniden üretildi). Hepsi düzeltildi. Başlıcaları:
  - geçmiş önbelleğiyle API belleğini tüketme açığı (yüksek önem)
  - ilgisiz BECMG ya da yeni TAF'ta süren olayı erken "bitiyor" gösteren TAF özeti
  - uykudan dönen cihazda kayan saat
  - klavyeyle açılamayan havalimanı penceresi
  - OpenAPI'de `null` kaybeden enum'lar
  - kesintiden sonra boşluk bırakan METAR kaydı
- **Kullanıcının ek istekleri** (aynı turda, D-079): kırmızı toplu iğne simgesi, küçük harita yazıları, açılışta ve yenilemede IST merkezli görünüm, tıklama önceliği (havadaki uçak > havalimanı iğnesi ve kodu > yerdeki uçak), `/havalimanlari` kapsam cümlesi.
- **Bağımsız denetim:**
  - Bütün maddeler düzeltilmiş bulundu.
  - Bellek açığına 6.160 isteklik saldırı denendi; heap ~30 MB'ta sabit kaldı.
  - 20 mutasyonun 19'u testlerce yakalandı.
  - Tarayıcıda IST açılışı, iğne ucunun konumu (0,5 px), yerdeki uçağın üstündeyken iğne ve kod tıklaması (5/5), Escape ve klavye yolu doğrulandı.
  - Denetimin bulduğu üç küçük sorun da düzeltildi: pencere kapanınca odak, pencere saati, birleştirilen rüzgârın en kuvvetli değeri. Bu düzeltmelerin 18 mutasyonundan 14'ü yakalandı.
- **Bilinen küçük boşluklar:** haritanın cihaz öncelikli saati kullandığını ve sekmeye dönüşte saatin yenilendiğini doğrulayan test yok; birleştirilen rüzgârda eşit hızda yön seçimi testsiz.
- **`pnpm ci:full` → yeşil** (turbo önbelleği kapalı):
  - Birim testleri: web 560, shared 380, api 236, worker 195, providers 118, tools 74, i18n 55, db 35, geo 31, scripts 31.
  - Entegrasyon testleri: db 77, api 22, worker 12.
  - Migration yükseltme 4 → 5; `compose:guard` 8 servis, 64 anahtar.
  - E2E 78/78.
- `pnpm stats` → 511 dosya, 81.929 satır (74.144 kod).

## M6d — Türkiye dışındaki havalimanları, 1. halka (≤ 500 km)
Onay: 2026-10-01 (kullanıcı: Türkiye dışı havalimanları halka halka, ABD ve ötesi dahil)

Kararlar ve gerekçeler D-080'dedir; site teması ve hava durumu sunumu D-081'dedir. Kilometre taşı Parça 1'e sonradan eklendi. Halkalar yakından uzağa ayrı sürümlerle açılır; bu kilometre taşı yalnızca 1. halkayı açar. Hedef sürüm 0.12.0; tek migration veri migration'ıdır (`0005_ourairports_reimport`: içe aktarım süzgeci değiştiği için OurAirports bir kez koşulsuz yeniden içe aktarılır; şema değişmez).

**Kapsam:**
- **Halkalar:** uzaklık, IATA kodlu en yakın Türkiye havalimanına büyük daire mesafesidir. 1 ≤ 500 km, 2 ≤ 1.000 km, 3 ≤ 2.000 km, 4 ≤ 5.000 km, 5 = dünyanın geri kalanı (ABD dahil). Sonraki halka yalnızca `ENABLED_AIRPORT_RING`'i büyütür.
- **Uzaklık referansı (entegrasyonda, D-080):** analizdeki gibi Türkiye'nin IATA kodlu 66 alanı. İçe aktarım tarifesiz 5 küçük alanı (Gökçeada, Selçuk-Efes, Bodrum-İmsık, Aydın Çıldır, Adana Şakirpaşa) yalnızca referans olarak alır; Türkiye listesi 61'de kalır. Onlarsız 1. halka 72'ye düşüyordu (Priştine, Preveze, Niş dışarıda). Ayrıntılı kayıt uzaklığın ölçüldüğü havalimanını taşır (`nearestTr`); sayfa onu yazar.
- **Aday:** OurAirports `large_airport`/`medium_airport`, tarifeli seferi kayıtlı, 3 harfli IATA kodlu; 1. halkada 75 havalimanı.
- **"Listelenen havalimanları" tek tanım:** IATA kodlu Türkiye havalimanları (61) + açık halkalardaki yabancı adaylar. Her biri `country`, `ring` (Türkiye 0) ve `distanceToTrKm` (Türkiye null) taşır; halka üyeliği sunucuda hesaplanır.
- **API:** `GET /v1/airports?scope=listed` (`include=runways` ile ve onsuz), `GET /v1/weather?scope=listed`. Varsayılan `country=TR` kalır; ikisi birlikte 400. Tek havalimanı ve hava durumu uç noktaları listelenen yabancı havalimanlarını da çözer.
- **Worker:** hava durumu istasyonları listelenen havalimanlarıdır (~136). AWC istemcisi istasyonları baştan gruplara böler: 400 kayıt sınırına göre olağan 2 saatlik METAR'da 80 istasyon (136 istasyon = 2 istek), her istekte en çok 200 istasyon; ikiye bölme yalnızca yedektir. Son 24 saatte METAR'ı saklanmamış (listeye yeni giren) istasyon, worker süreci başına bir kez ayrı bir istekle 24 saat istenir.
- **Harita:** listelenen havalimanları ve onların toplu havası; yabancı havalimanları da pin, IATA kodu ve pencereyle gösterilir. Pencere il yerine ülkeyi yazar (Ercan: KKTC). IST açılış görünümü ve performans kuralları değişmez.
- **Sayfalar:** `/havalimanlari`'da Türkiye tablosundan sonra "Yakın ülkelerdeki havalimanları" tablosu (ad, ülke, IATA, ICAO, Türkiye'ye uzaklık, en uzun pist; ülkeye sonra ada göre Türkçe sıralı). `/istasyon/<ICAO>` listelenen yabancı havalimanlarında aynı bölümlerle açılır; il satırı yerine şehir ve ülke (şehir küratörlü tablodan, sayfanın dilinde: "Selanik, Yunanistan"; OurAirports'un İngilizce yerleşimi gösterilmez). Listelenmeyen havalimanı 404.
- **SEO:** yabancı sayfalar dizine eklenir (TR/EN hreflang), site haritasına ve llms.txt'e (ayrı "Yakın ülkeler" listesi) girer; JSON-LD `addressCountry` LCEN'de yazılmaz.
- **Adlar ve ülkeler:** 75 havalimanının TR/EN adı ve şehri küratörlü tabloda (Türkçe yer adlarıyla); uzaklık referansı 5 küçük alanın adı ayrı tabloda ("Bodrum-İmsık Havalimanı"); ülke adı `Intl.DisplayNames` (XK ve LCEN istisnaları).
- **Fixture:** OurAirports'tan onaylı tek indirme (2026-10-01T23:03:49Z); 75 havalimanı ve 89 açık pist fixture'ın sonuna eklendi. LGAV, LCLK, LCEN, UGTB, LBSF ve LGTS için elle yazılmış hava durumu.
- **`/hakkinda`:** yakın ülkelerdeki havalimanlarının listelendiği ve canlı uçak kapsamasının Türkiye odaklı olduğu yazılır.
- **Tema A "Açık turkuaz" (kullanıcı kararı 2026-10-02, D-081):** koyu lacivert geçici temanın yerine tek tema; işletim sisteminin koyu tercihi rengi değiştirmez. Sayfalar, harita panelleri, havalimanı penceresi, etiket ve IATA kutuları (beyaz, #B9E2E6 kenar), paylaşım görselleri, uygulama simgeleri, manifest. Next'in yerleşik hata sayfası yerine temalı ve iki dilli `error.tsx` / `global-error.tsx`.
- **Hava durumu sunumu (kullanıcı istekleri 2026-10-02, D-081 ek):** pencerede gün doğumu ve batımı yok; sıcaklık başlığın yanında ayrı kutucuk (eksi U+2212); sayıdan önce "·" ya da "–" yok (hava durumu metinleri, uçak etiketi "431 km/sa, 333 m", arama sonucu, yönetim sayım satırı); satır simgeleri; var olan olayın satırı vurgulu. Düzeltme turunda: dar ekranda satır düzeni (etiket sütunu en çok 11rem, 480 px'te tek sütun), telefonda pencerenin "Havalimanı sayfası →" bağlantısı kaydırmadan görünür, arama ipucu 1280 ve 375 px'te kesilmez, liste tablosu başlıkları ("il adına göre sıralı").
- **Kapsam dışı:** 2–5. halkalar (ayrı sürümler); yakın ülkelerde canlı uçak verisi (kapsama planı değişmez).

**Dizinler ve dosyalar:**
- **`packages/shared`:** halka sabitleri ve işlevleri (`AIRPORT_RINGS_KM`, `ENABLED_AIRPORT_RING`, `airportRing`, `isForeignCandidate`), `reference/foreign-airport-names.ts` (75 havalimanının TR/EN adı ve şehri, `FOREIGN_AIRPORT_CITIES`), `reference/airport-names.ts` (`REFERENCE_AIRFIELD_NAMES`, `airportLocality`), ülke adları (`airportCountryName`, `countryName`), `AirportDetail`'e `country`, `ring`, `distanceToTrKm`; `map/colors.ts` (tema A etiket renkleri), `weather/phrase.ts` (virgül ayraç)
- **`tools/fixtures/`:** `ourairports/airports.csv` ve `runways.csv` (1. halka satırları sonda), `weather/` (altı 1. halka istasyonu), `README.md` (indirme anı)
- **`packages/db`, `apps/api/src/reference/`:** listelenen havalimanları okuyucusu (halka üyeliği, önbellek), `scope=listed`, OpenAPI
- **`packages/providers`, `apps/worker/src/jobs/`, `packages/db/src/weather.ts`:** hava durumu istasyon kümesi = listelenen havalimanları; 80 istasyonluk baştan gruplama (400 kayıt sınırı); yeni istasyonun 24 saatlik doldurması (`metarStationsSince`); içe aktarım süzgeci Türkiye'nin IATA kodlu küçük alanlarını da alır (uzaklık referansı)
- **`apps/web/src/`:**
  - `lib/airports.ts`, `lib/weather.ts`: `scope=listed`
  - `components/airports/`, `app/havalimanlari/`, `app/istasyon/[icao]/`: yakın ülkeler tablosu, yabancı havalimanı sayfası (şehir ve ülke, yakın havalimanları karışık)
  - `lib/seo/`: site haritası, llms.txt "Yakın ülkeler" listesi, JSON-LD ülke kodu
  - `components/map/`: `airport-data.ts` (`scope=listed`, `country`), `use-airport-weather.ts` (`scope=listed`), `airport-popup-model.ts` ve `airport-popup.tsx` (il yerine ülke; saat dilimi bilinmeyen havalimanında saat satırları yok, gözlem saati UTC)
  - `components/about/`: komşu ülkeler ve Türkiye odaklı kapsama
  - tema A: `app/globals.css`, `app/layout.tsx`, `app/manifest.ts`, `app/favicon.ico` (`scripts/gen-favicon.mts`), `lib/seo/brand.ts`, `lib/seo/og.tsx`, `components/map/labels.ts`; hata sayfaları `app/error.tsx`, `app/global-error.tsx`, `components/error-content.tsx`
  - hava durumu sunumu: `components/airports/weather-rows.ts`, `weather-row-list.tsx`, `weather-rows.css`, `weather-icon.tsx`, `weather-panel.tsx`, `weather-log.tsx`, `weather-expert.ts`; `components/map/airport-popup.tsx`, `airport-popup.css`, `airport-popup-model.ts`; `lib/map/label-text.ts`, `components/map/panels/panel-format.ts`
- **`packages/i18n`:** liste, havalimanı sayfası, hakkında ve llms.txt metinleri (TR/EN); hava durumu ayraçları; arama ipucu ve erişilebilir ad; hata sayfası metinleri (`src/error-page.ts`, `@havayolu/i18n/error-page`)
- **`e2e/`:** `tests/foreign-airports.spec.ts`; kurulum `scope=listed` havalimanı ve hava yanıtlarını bekler; `support.ts`'te 1. halka sabitleri; liste, site haritası ve llms.txt sayıları 136/130'a güncellendi; `airports.spec.ts` (odak halkası açık ve koyu tercihte), `weather.spec.ts` (hava durumu sunumu, IST kodunun tuvalde bulunması, telefonda pencere bağlantısı, dar ekranda satır düzeni), `live-map.spec.ts` (arama ipucu)
- **Belgeler:** D-080, D-081; D-078'in pencere bölümü ve örnekleri; `docs/spec/data-sources.md` §3 ve §5; `docs/RUNBOOK.md` (aviationweather.gov istek sayıları); `docs/ACTIVATION.md` (M6d yayın doğrulaması, web önbelleği); `tools/fixtures/README.md`

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → `airportRing` sınırları (500 dahil, 500,1 2. halka), `isForeignCandidate`; fixture'daki her 1. halka havalimanının küratörlü adı ve şehri var, listelenmeyen her Türkiye referansının adı var ("Bodrum-İmsık"); `airportLocality`; tema A palet ve karşıtlık testi (`map/layers.test.ts`); ülke adları (Yunanistan/Greece, Kosova, Ercan → KKTC/TRNC); tabloda olmayan ad için kural ("International Airport" → "Uluslararası Havalimanı")
- `pnpm --filter @havayolu/api test` → `scope=listed` (61 + 75, halka ve uzaklık), `include=runways` ile, `country` ile birlikte 400, OpenAPI; tek havalimanı ve hava durumu yabancı havalimanını çözer
- `pnpm --filter @havayolu/worker test` ve `@havayolu/providers` → istasyon kümesi listelenen havalimanları; 136 istasyonluk olağan istek iki isteğe (80 + 56) bölünür; istasyon listesi büyüyünce yeni istasyonlar ayrı istekte 24 saatle istenir
- `pnpm --filter @havayolu/i18n test` → hiçbir metinde sayıdan ya da yer tutucudan önce "·" ya da "–" yok; hata sayfası metinleri iki dilde
- `pnpm --filter @havayolu/web test` → liste tabloları, yabancı havalimanı sayfası, site haritası ve llms.txt; harita: `scope=listed` adresleri, ülke alanı (eski API'de bölge kodundan), pencerede il yerine ülke (Ercan KKTC), saat dilimi bilinmeyen havalimanında saat satırları yok ve gözlem saati UTC; yabancı sayfada yer satırı, yerleşim satırı, paylaşım görseli ve JSON-LD küratörlü şehri yazar ("Selanik, Yunanistan", "Athens, Greece"); uçak etiketi ve arama sonucu virgülle; hata sayfaları (`app/error.test.ts`); simgeler (`app-icons.test.ts`)
- `pnpm test:integration` → listelenen havalimanları gerçek PostgreSQL'le; `metarStationsSince`
- `pnpm test:e2e`:
  - kurulum: `/v1/airports?scope=listed` 136 havalimanı, `/v1/weather?scope=listed`'de LGAV'nin METAR'ı
  - API: `scope=listed` 61 + 75, yabancıların hepsi 1. halkada ve ≤ 500 km, EGLL yok, `country` + `scope` → 400; `/v1/airports/ath` → LGAV; toplu havada altı 1. halka istasyonunun METAR'ı
  - `/havalimanlari` ve `/en/havalimanlari`: iki tablo; yakın ülkeler tablosu 75 satır, ülkeye göre sıralı, Atina satırında Yunanistan/Greece ve km, Ercan satırında KKTC; ItemList 136
  - `/istasyon/LGAV` ve `/en/istasyon/LGAV`: ülke, hava durumu, harita bağlantısı, dizine eklenir, JSON-LD `addressCountry` GR; `/istasyon/LCEN` KKTC'yi gösterir, JSON-LD'de ülke kodu yok; `/istasyon/ath` → 308; `/istasyon/EGLL` ve `/istasyon/LHR` → 404
  - site haritası 130 havalimanı (LGAV ve LCEN dahil, EGLL yok); llms.txt 130 havalimanı satırı, yakın ülkeler ayrı başlık altında
  - harita: `?havalimani=LGAV` Atina'da açar, pin ve "Havalimanları"/"Airports" listesi pencereyi açar; pencerede Yunanistan/Greece ve hava durumu
  - mevcut testler geçer (IST açılışı, IST penceresi, M6c hava durumu)
  - tema ve sunum: odak halkası açık ve koyu tercihte ≥ 3:1, koyu tercihte de sayfa açık turkuaz; pencere ve sayfada sıcaklık kutucuğu, vurgulu yağmur satırı, gizli simgeler, sayıdan önce ayraç yok; IST kodu diğer uçak etiketleri görünürken de bulunur; 375×812'de pencerenin bağlantısı kaydırmadan görünür ve tıklanır; 412, 430 ve 560 px'te hava durumu satırlarında değer sütunu ≥ 150 px ve kuvvetli rüzgâr etiketi kutusunda; arama ipucu 1280 ve 375 px'te iki dilde kutuya sığar
- `pnpm dev:replay` üzerinde elle: `curl` ile `/v1/airports?scope=listed` (136), `/v1/weather?scope=listed`; tarayıcıda `/havalimanlari`, `/istasyon/LGAV`, `/istasyon/LCEN`, `/en/istasyon/UGTB`, haritada Atina ve Ercan pencereleri
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra üretimde `scope=listed` 136 havalimanı, yakın ülkeler tablosu 75 satır ve yabancı havalimanlarında gerçek METAR (ACTIVATION, "M6d yayın doğrulaması"). **2026-10-02 doğrulandı (v0.12.0):** 136 havalimanı (75 yurt dışı), 122 istasyonda METAR ve TAF (68'i yurt dışı), `/istasyon/LGAV` "Atina, Yunanistan", `/istasyon/LCEN` KKTC.

**Çıktı kaydı (2026-10-02):**
- **Yöntem:** Halka analizi (OurAirports'tan onaylı tek indirme) ve sözleşme üzerine 4 paralel ajan ayrışık dosyalarda uyguladı: shared/db/API, fixture ve worker, sayfalar/SEO/i18n, harita/E2E/belgeler. Ardından tek ajan birleştirdi; 75 ↔ 72 farkını uzaklık referansı kuralıyla çözdü (D-080). Kullanıcının 2026-10-02 istekleri (tema A, pencere ve hava durumu sunumu) iki paralel ajan ve bir birleştirici ile eklendi (D-081).
- **İnceleme:** 6 açıdan inceleme (referans verisi, API/worker, sayfalar/SEO, tema/erişilebilirlik, hava durumu sunumu, testler/belgeler) ve bulgu başına 3 çürütücü doğrulayıcı. 22 bulgunun 13'ü doğrulandı (11 ayrı madde), 9'u çürütüldü. Hepsi düzeltildi. Başlıcaları:
  - Türkçe sayfalarda OurAirports'un İngilizce şehir adı (küratörlü TR/EN şehir tablosu)
  - uzaklık referansı küçük alanların adı ("Bodrum-İmsık")
  - listeye yeni giren istasyonun yalnızca 2 saatlik METAR'la başlaması (24 saatlik tek seferlik doldurma)
  - Next'in koyu ve İngilizce yerleşik hata sayfası (temalı, iki dilli hata sayfaları)
  - 412–430 px telefonlarda sıkışan hava durumu satırları
  - RUNBOOK, D-078/D-080/D-081 ve ACTIVATION'daki eski sayılar ve web önbelleği notu
- **Düzenleyicinin ek düzeltmeleri:** uçak etiketi ve arama sonucunda sayıdan önce "·" yok (i18n testi bütün metinleri denetler), telefonda pencere bağlantısı kaydırmadan görünür, arama ipucu kesilmez, liste tablosu başlıkları, E2E'de IST kodunun tuvalde bulunması.
- **Bağımsız denetim:** bütün maddeler düzeltilmiş bulundu. 11 mutasyon grubunun hepsi testlerce yakalandı (560 px EN e2e vakası ayırt edici değil). Tarayıcıda (1280 ve 375 px, TR ve EN) IST açılışı, etiketler, IST penceresi, telefonda bağlantı, LTFM ve LGAV sayfaları, liste tabloları ve arama ipucu doğrulandı; konsol hatası yok.
- **`pnpm ci:full` → yeşil:**
  - Birim testleri: web 616, shared 403, api 251, worker 200, providers 120, tools 74, i18n 57, db 44, geo 31, scripts 31.
  - Entegrasyon testleri: db 82, api 26, worker 12.
  - Migration yükseltme 5 → 6; `compose:guard` 8 servis, 64 anahtar.
  - E2E 101/101.
- `pnpm stats` → 526 dosya, 88.430 satır (80.437 kod).

## M6e — Hava durumu: pencere ortalı, rüzgâr km/sa ve kt, kuvvetli rüzgâr, kümülonimbüs ve yıldırım uyarısı
Onay: 2026-10-03 (kullanıcı istekleri, üretimdeki Gazipaşa ve İstanbul pencerelerinin ekran görüntüleriyle; küçük sürüm, D-082)

Hedef sürüm 0.13.0. Kararlar D-083'tedir.

**Kapsam:**
- Haritadaki havalimanı penceresinde bütün yazılar ortalı.
- Rüzgâr hızı km/sa'nın yanında knot olarak da yazılır ("Kuzeyden 46 km/sa (25 kt)"); pencerede, sayfada ve tahminlerde.
- Etkili rüzgâr her havalimanında belirtilir: rüzgâr satırı eşiği geçince vurgulanır ve şiddeti adıyla yazılır.
- Kümülonimbüs bulutu ya da gök gürültüsü varsa şimşek ve yıldırım riski açıkça yazılır (yağmursuz durum araştırmayla belirlenir).
- **Araştırma sonucu (D-083):** yağmur yokken de yıldırım riski vardır (yağışsız oraj METAR'da tek başına `TS`; yıldırım çoğu zaman yağmurun dışına, 16–24 km'ye kadar düşer). Havalimanında TS → "şimşek ve yıldırım tehlikesi" (yağışlı ya da yağışsız), VCTS → "yıldırım havalimanına da düşebilir", CB ve havalimanında yağış → "şimşek ve yıldırım tehlikesi" (kullanıcının sözü, ikinci kontrol turunda düzeltildi), yağışsız CB → "şimşek ve yıldırım olabilir"; TCU ve yalnız son saatteki oraj için iddia yok; TAF ve eğilime ek cümle yok.
- **Rüzgâr şiddeti (D-083):** eşik MGM meydan uyarısı (ortalama ≥ 20 kt ya da hamle ≥ 30 kt) değişmez; şiddetin adı MGM Beaufort ıskalasından (Kuvvetli rüzgâr, Fırtınamsı rüzgâr, Fırtına … Harikeyn (orkan)), hamle Met Office karşılıklarıyla; yalnız hamle eşiği aşılınca "Kuvvetli hamle". Satır kehribar, şiddet etiketle; TAF öğesi şiddetin adıyla başlar.
- **Kapsam dışı:** pist yan rüzgâr bileşeni; yurt dışında yerel saat ve UTC farkı (M6f).

**Dizinler ve dosyalar:**
- **`packages/shared/src/weather/`:** `schema.ts` (`WIND_LEVELS`, `LIGHTNING_RISKS`; `Wind.speedKmh`/`gustKmh` isteğe bağlı), `groups.ts` (km/sa raporun biriminden), `derive.ts` (`windLevel`; `isStrongWind` = düzey var), `summary.ts` (`windLevel`, `lightning`, gök gürültüsü satırı, hız ölçüsünde km/sa, TAF öğesinde şiddet adı, birleşen dilimde hamlenin km/sa'sı), `phrase.ts` (`weather.wind.level.*`, `weather.thunder.*`, `weather.taf.strongWind` = level + wind; `weather.value.noneWithCb` kalktı), `index.ts`; testler `derive.test.ts`, `metar.test.ts`, `summary.test.ts`, `test/fake-text.ts`
- **`packages/i18n/src/`:** `messages/tr.ts`, `messages/en.ts` (`weather.thunder.*`, `weather.wind.level.*`, "{speed} ve üzeri", "{level}, {wind}"; `weather.value.noneWithCb` ve `weather.wind.strong` kalktı), `weather.ts` (`formatWindSpeedDual`; `formatWindSpeed` ve `formatWindSpeedBoth` raporun km/sa'sını alır), `weather.test.ts`
- **`apps/web/src/components/`:** `airports/weather-rows.ts` (rüzgâr ve gök gürültüsü vurgusu, şiddet etiketi), `airports/weather-rows.css` (kehribar rüzgâr, vurgulu satırda beyaz etiket, `wx-rows--center`), `airports/weather-row-list.tsx`, `airports/weather-expert.ts` (uzmanda raporun km/sa'sı), `map/airport-popup.tsx` ve `map/airport-popup.css` (bütün yazılar ortalı); testler `airports/airport-weather.test.ts`, `map/airport-popup.test.ts`, `map/airport-popup-model.test.ts`
- **`e2e/tests/weather.spec.ts`:** km/sa ve kt, rüzgâr ve gök gürültüsü vurgusu ve metni, LTAI ve LTAU'da yıldırım uyarısı (TR/EN), pencerede ortalı yazılar (1280, 430, 375, 320 px), "Kuvvetli hamle" etiketi (412, 430, 560 px). Fixture değişmedi (LTFM CB ve hamle, LTAI havalimanında oraj, LTAU çevrede oraj, LGTS kuvvetli rüzgâr, UGTB MPS zaten vardı).
- **Belgeler:** D-083; D-078 (madde 7, kelime seçimleri, TAF örneği) ve D-081 (ayraç örneği, vurgu kuralı) güncellendi. `docs/spec/domain.md` hava durumu sunum kuralı taşımadığı için değişmedi.

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → `windLevel` sınırları (19/20/27/28/33/34 kt, 19G29/19G30, 25G42/25G43, 10G52, 40G61, 50G69, 64 kt, P99, 20GP99, 11/10 MPS, sakin ve bilinmeyen), km/sa raporun biriminden (11 MPS = 40 km/sa); 20 gerçek biçimli METAR'da rüzgâr satırı, şiddet, gök gürültüsü satırı ve `lightning` (Gazipaşa `-TSRA` → `here`, İstanbul `04026KT … SCT030CB` → `strong` ve `cloud`, `TS` → `hereDry`, `VCSH TS` → `hereDry`, `VCTS` → `vicinity`, `RETSRA` → yok, CB + `RETSRA` → `cloud`, TCU → yok, NIL, belirlenemeyen + CB → `cloudUndetermined`); TAF öğesinde şiddet adı (kuvvetli rüzgâr, fırtınamsı rüzgâr, fırtına, kuvvetli hamle) ve MPS hamlesinin km/sa'sı. Kontrol turu: 26 METAR (belirlenemeyen raporda oraj `AUTO … TS //`, görüşü eksik `TS`, `TS XXRA` → `here` ve başlık `weather.wx.VCTS`; `P49MPS` ve `GP49MPS` → "ve üzeri", `33090GP99KT` yalnız hamlede); `offScaleWind`; TAF'ta sonra gelen daha güçlü rüzgâr seçilir (temel 20 kt + TEMPO 45G65 → tam fırtına; iki TEMPO 15G30 ve 50G70 → çok şiddetli fırtına; hava olayıyla PROB 40G55 → kuvvetli fırtına ikinci satırda; eşit şiddette en erken)
- `pnpm --filter @havayolu/i18n test` → yeni anahtarlar iki dilde aynı yer tutucularla; "33 km/sa (18 kt)", "40 km/sa (21 kt)" (MPS), "185 km/sa (100 kt) ve üzeri"; iki ekran görüntüsünün metinleri TR/EN; uyarılarda "güvenli" ya da "risk yok" yok, TS için "fırtına" yok; sayıdan önce "·" ya da "–" yok. Kontrol turu: hızda bölünmez boşluk ("48 km/sa (26 kt)" U+00A0 ile); "Batıdan 180 km/sa (97 kt) ve üzeri" (P49MPS); belirlenemeyen raporda başlık "Gök gürültüsü", satır "tehlikesi", "yağış yok" yok; TAF'ta "18:00 ile 21:00 arası ara ara tam fırtına …"
- `pnpm --filter @havayolu/web test` → sayfa ve pencerede rüzgâr satırı `data-tone="wind"` ve "Kuvvetli hamle"; CB ve yağışta (fixture IST) gök gürültüsü satırı `data-tone="thunder"` ve "Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi" (ilk uygulamada "Yok; … olabilir"); LTAU "düşebilir", LTAI ve LTBS "tehlikesi"; LGTS "Kuvvetli rüzgâr"; pencerede `wx-rows--center`; METAR/TAF kaydı özetinde kt. Kontrol turu: pencere ve sayfa HTML'inde hız bölünmez boşlukla; ölçek üstü rüzgâr (P49MPS, GP49MPS, P99KT, GP99KT) sade ve uzman görünümde aynı
- `pnpm --filter @havayolu/api test` → OpenAPI şeması (yeni isteğe bağlı alanlarla) Ajv ile derlenir, fixture yanıtları doğrulanır
- `pnpm test:e2e` → `weather.spec.ts`: sayfa ve pencerede km/sa ve kt, rüzgâr vurgusu ve şiddet etiketi, CB uyarısı; `/istasyon/LTAI` ve `/en/istasyon/LTAI`'de tehlike, LTAU'da "düşebilir"; pencerede başlık, bilgiler, hava başlığı, satırlar, gözlem satırı ve bağlantı ortalı (1280, 430, 375, 320 px), pencere genişliği 320 px, yatay taşma yok; 412, 430 ve 560 px'te etiket değerin kutusunda. Kontrol turu: hava başlığı satır satır ölçülür (öğeler bitişik ve satır eksende; eski `space-between` dört genişlikte kırmızı), rüzgâr hızı tek satırda (`Range.getClientRects`; bölünmez boşluk olmadan kırmızı), `speedDual` U+00A0 ister
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-03, uygulama; sürüm, changelog ve README yayın adımındadır):**
- **Yöntem:** araştırma (MGM, WMO, NWS/NOAA, FAA, Met Office; aviationweather.gov veri API'sine istek atılmadı) ve tek ajanla uygulama. Tarayıcıda (`pnpm dev:replay`, 1280 ve ~490 px) IST penceresi, `/istasyon/LTAI` ve `/en/istasyon/LGTS` denetlendi.
- **`pnpm ci:full` → yeşil:**
  - Birim testleri: web 616, shared 455 (+52), api 251, worker 200, providers 120, i18n 75 (+18), tools 74, db 44, geo 31, scripts 31.
  - Entegrasyon testleri: db 82, api 26, worker 12.
  - Migration yükseltme 6 → 6 (yeni migration yok); `compose:guard` 8 servis, 64 anahtar.
  - E2E 106/106 (+5: LTAI/LTAU yıldırım uyarısı TR ve EN, pencere 375, 320 ve 430 px). İlk koşuda dar ekran satır testi bir kez sıfır genişlik okudu (etiket hidrasyondan önce DOM'da değiştiriliyordu); test adanın hidrasyonunu bekler, ardından blok 8 kez tekrarla 48/48 ve `ci:full` yeniden yeşil.
- **Kontrol turu (2026-10-03, doğrulanmış 5 bulgu; ayrıntı D-083):**
  - Belirlenemeyen raporda oraj (`AUTO … TS //`, görüşü eksik rapor, çözülemeyen parça): gök gürültüsü satırı `here` ("… tehlikesi", "yağış yok" demez), hava başlığı "Gök gürültüsü" (`weather.wx.VCTS`); yağmur satırı "Belirlenemedi".
  - TAF özeti birden çok kuvvetli rüzgârdan şiddeti en büyük olanı yazar (eşitse en erken, sonra en kesin); sonra gelen TEMPO/PROB fırtınası artık görünür.
  - Ölçek üstü rüzgâr `offScaleWind` ile (sade ve uzman görünüm aynı): `P49MPS` "Batıdan 180 km/sa (97 kt) ve üzeri".
  - Rüzgâr hızında bölünmez boşluk (U+00A0): "48 km/sa (26 kt)" pencerenin dar değer sütununda iki satıra bölünmez.
  - e2e pencere ölçümü: hava başlığı satır satır ölçülür (öğeler bitişik, satır eksende), rüzgâr hızı tek satırda.
  - Her yeni test düzeltme geri alınınca kırmızı (denendi): `lightningRisk` 4, başlık 1, TAF seçimi 1, ölçek üstü 2 birim testi; bölünmez boşluk i18n testi ve e2e (dört genişlikte "33 km/sa (18 kt)" 2 satır); `justify-content: space-between` e2e'de dört genişlikte (öğeler arası 89–199 px).
  - **`pnpm ci:full` → yeşil:** birim testleri web 620 (+4), shared 465 (+10), api 251, worker 200, providers 120, i18n 80 (+5), tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 106/106 (test sayısı aynı, pencere testleri sıkılaştı).
- **İkinci kontrol turu (2026-10-03, 3 düzeltme; ayrıntı D-083):**
  - **Kümülonimbüs ve yağış (kullanıcının sözü):** "kümülonimbüs bulut aktivitesi varsa yağmurla beraber, şimşek ve yıldırım tehlikesi olduğunu belirt". Yeni `LIGHTNING_RISKS` değeri `cloudPrecip`: TS ve VCTS yok, CB var, havalimanında yağış grubu var → "Kümülonimbüs (oraj bulutu) ve yağış var; şimşek ve yıldırım tehlikesi" / "Cumulonimbus (thunderstorm cloud) and precipitation present; lightning danger", kehribar. Fixture IST (`-SHRA FEW025CB`) artık bunu yazar (önce "Yok; … olabilir"). Yağışsız CB `cloud`, tanınan yağışsız belirlenemeyen rapor `cloudUndetermined` kalır. API ve OpenAPI özeti taşımaz; değişmedi.
  - **Başlıkta çelişki:** `TS RA`, `TS -SHRA`, `TS GS` (oraj ve yağış ayrı gruplarda) başlığı "Gök gürültüsü ve şimşek, yağış yok" yerine "Gök gürültüsü" (`weather.wx.VCTS`); yağmur ve dolu satırı yağışı yazmaya devam eder.
  - **Pist uzunluğu kırılması:** penceredeki rakım ve en uzun pist sayı ile birim arasında U+00A0 ile (`formatAltitude(…, { nowrap: true })`, `NBSP` units.ts'te, rüzgâr hızıyla ortak). Yeni e2e: LTAI penceresi 1280 px'te ortalı ve "3.400 m" tek satırda; `expectPopupCentred` rakım ve pist uzunluğunun her "sayı birim" parçasını ölçer (U+00A0 ve tek satır).
  - Her yeni test düzeltme geri alınınca kırmızı (denendi): `cloudPrecip` olmadan shared 4 birim testi; başlık kuralı olmadan shared 1; bölünmez boşluk olmadan e2e 4/4 pencere testi (IST 1280, 375, 320, 430 px) ve yalnız yerleşim ölçümüyle LTAI'de "3.400 m" 2 satır. i18n ve web birim testleri yeni metni ve U+00A0'ı ister.
  - **`pnpm ci:full` → yeşil:** birim testleri web 620, shared 470 (+5), api 251, worker 200, providers 120, i18n 83 (+3), tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 107/107 (+1: LTAI penceresi), kararsız test yok.
- `pnpm stats` → 526 dosya, 90.247 satır (82.085 kod).
- **Yayından sonra:** üretimde IST penceresi (ortalı yazılar, km/sa ve kt, rüzgâr ve yıldırım vurgusu) tarayıcıda görülür; sonra satır `[x]` olur. **2026-10-03 doğrulandı (v0.13.0):** "Kuzeydoğudan 37 km/sa (20 kt)", kehribar "Kuvvetli rüzgâr". Kullanıcı ortalı düzeni yamuk buldu; hizalı tablo M6e.1'de (v0.13.1).

## M6e.1 — Pencere hizası (v0.13.1)
Onay: 2026-10-03 (kullanıcı geri bildirimi, üretimdeki İstanbul penceresinin ekran görüntüsüyle: "ortala yapınca olmadı yamuk yumuk oldu. hepsi hizalı olsun"; yama sürümü, D-082)

Hedef sürüm 0.13.1. Karar D-083'teki "2026-10-03 kullanıcı geri bildirimi" maddesidir; M6e'nin ortalı düzeninin yerine geçer.

**Kapsam:**
- Pencere tek hizalı tablodur: bütün yazılar sola yaslı ve aynı sol kenardan başlar (kodlar, ad, yer; kapat düğmesi sağda; "Hava durumu", hava başlığı ve sıcaklık kutucuğu, gözlem satırı, bağlantı).
- Bilgi satırları (rakım, pistler, yerel saat) ve hava durumu satırları aynı sütunlarda: simge, etiket ve değer her satırda aynı x'te (sabit etiket sütunu, 8rem).
- Bilgi satırlarına hava simgeleriyle aynı biçimde kendi simgeleri: rakım (dağ), pistler (pist şeridi), yerel saat (kadran).
- **Değişmeyenler:** pencere genişliği, odak, aria, kapat düğmesi, alt sayfa, bölünmez boşluklar, havalimanı sayfasının hava durumu bölümü.

**Dosyalar:**
- `apps/web/src/components/map/airport-popup.css`, `airport-popup.tsx`, `airport-popup-model.ts` (bilgi satırları `WeatherRow`), `airport-popup.test.ts`
- `apps/web/src/components/airports/weather-rows.css` (`wx-rows--center` yerine `wx-rows--popup`), `weather-row-list.tsx`, `weather-icon.tsx` (3 simge)
- `e2e/tests/weather.spec.ts` (`expectPopupCentred` yerine `expectPopupAligned`; IST ve LTAI, TR ve EN, 1280, 768, 430, 375 ve 320 px; kırılan etiket)
- `docs/DECISIONS.md` (D-083 alt maddesi)

**Kabul komutları:**
- `pnpm --filter @havayolu/web test` → iki liste `wx-rows--popup`, `wx-rows--center` yok; bilgi satırları sırası, simgeleri ve U+00A0'lı değerleri; her `<dt>` simge yuvasıyla başlar
- `pnpm test:e2e` → `weather.spec.ts`: IST ve LTAI pencerelerinde TR ve EN, 1280, 768, 430, 375 ve 320 px'te simge, etiket ve değer x'i her satırda eşit (±1 px), simge etiketin ilk satırının ortasında ve etiket ile değer aynı yükseklikte (kırılan "Diğer hava olayları" etiketinde de), başlık ve diğer yazılar simge sütununda, kapat düğmesi sağda, satır kutuları aynı kenarda, hız ve uzunluklar tek satırda, yatay taşma yok
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-03, uygulama; sürüm, changelog ve README yayın adımındadır):**
- Tarayıcıda (`pnpm dev:replay`, başsız Chromium) IST ve LTAI pencereleri TR ve EN, 1280, 430, 375 ve 320 px'te ölçüldü: simge, etiket yazısı ve değer yazısı her satırda aynı x'te (simge içerik kenarında, etiket +24 px, değer +134 px), başlık ve diğer yazılar simge sütununda, yatay taşma yok.
- e2e: `expectPopupCentred` yerine `expectPopupAligned`; LTAI 1280 px testi ve dar ekran döngüsü (375, 320, 430) havalimanı ve dil başına tek testte toplandı (sayfa bir kez yüklenir, genişlik pencere açıkken değişir; WebSocket el sıkışma sınırı, D-083). Ölçüm M6e'nin ortalı CSS'iyle 4/4 kırmızı (denendi).
- **`pnpm ci:full` → yeşil:** birim testleri web 621 (+1), shared 470, api 251, worker 200, providers 120, i18n 83, tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 107/107 (sayı aynı: 4 test kalktı, 4 test geldi).
- **Kontrol turu (2026-10-03):** 30 durumda (IST, AYT, ATH × TR, EN × 1280, 768, 430, 375, 320 px) hiza yeşil. Düzeltilen: iki satıra kırılan etiketin (TR "Diğer hava olayları") simgesi iki satırın ortasındaydı → `wx-rows--popup` satırında `<dt>` `align-items: flex-start`, simge ilk satırın yüksekliğinde ortalanır (`1lh`); tarayıcıda simgenin ortası ilk satırın ortasından 0,8 px (önce 9,5 px). e2e: `expectPopupAligned` dikeyi (simge ↔ etiketin ilk satırı ±2 px, etiket ↔ değer ±1 px) ve kapat düğmesini ölçer; testler sonda "Diğer hava olayları" satırını ekleyip 320 ve 1280 px'te ölçer (TR iki satır, EN tek satır); genişlik döngüsüne 768 px eklendi. Düzeltmesiz CSS'te 2 TR testi kırmızı (`other: simge etiketin ilk satırının ortasında`, 9,55 px; denendi), EN testleri yeşil (etiket kırılmıyor). `formatElevation` yorumunda değer sütunu ~160 px. LGAV e2e'ye eklenmedi (her test bir WebSocket el sıkışması; `WS_RATE_LIMIT`), kontrol turunda elle ölçüldü.
- **`pnpm ci:full` → yeşil (kontrol turundan sonra):** birim testleri web 621, shared 470, api 251, worker 200, providers 120, i18n 83, tools 74, db 44, geo 31, scripts 31 (turbo 31/31); entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 107/107 (1,9 dk).
- `pnpm stats` → 526 dosya, 90.568 satır (82.346 kod).

## M6f — Adlar ve saat: askerî ve sivil havalimanı adları TR/EN, haritada havalimanı adı etiketi, yurt dışında yerel saat ve UTC farkı
Onay: 2026-10-03 (kullanıcı istekleri ve aynı gün verilen kararlar: Ankara (Etimesgut) adı, etiket varsayılanı "Kod", Sohum'da Moskova saati; küçük sürüm, D-082)

Hedef sürüm 0.14.0. Kararlar D-084'tedir. Yarıda kesilen bir koşunun ara commit'inden (70a23a9, "save partial M6f work") sürdürüldü; bitmiş parçalar yeniden yazılmadı, gözden geçirilip tamamlandı.

**Kapsam:**
- **Adlar (istek 1):** "askerî havalimanları ve normal havalimanları türkçe ingilizce dil desteğine uygun olsun. hata var ise düzelt": Türkçe sayfalarda İngilizce OurAirports adıyla görünen LTAD, LTAG, LTAH, LTBG, LTBI ve LTBL (yabancı sayfaların "Türkiye'deki en yakın havalimanı" satırı dahil) iki dilde düzeltilir. LTAD "Ankara (Etimesgut) Havalimanı" / "Ankara (Etimesgut) Airport" (bakanlığın verdiği ad, kullanıcı kararı); beş askerî alan "<yer> Hava Üssü" / "<place> Air Base" (İncirlik EN "Incirlik"). Bütün yüzeyler aynı ad işlevinden okur: liste, sayfa (başlık, içerik yolu, `<title>`, ad kaynağı satırı), pencere, "Havalimanları" listesi, paylaşım görseli, JSON-LD, llms.txt, il cümlesi, yakın havalimanları ve en yakın Türkiye havalimanı satırı. Beş üs `noindex, follow` kalır; LTAD dizine girer. Yurt dışında Türkçe yazımlar: Gebele, Şehit Eşrefi İsfahani, Serdar Cengel.
- **Harita etiketi (istek 2):** "havalimanı isimleri de açılır kapanabilir olsun. etiketleri güncelle": "Etiketler" panelinde havalimanları için Gizle / Kod / Kod ve ad (EN Hide / Code / With name; varsayılan Kod, kullanıcı kararı). Kısa ad en çok 16 karakter, yalnız z ≥ 7'de; yer yoksa kod yalnız kalır, ad pin, kod, uçak simgesi ve iz örtmez. Gizle yalnız yazıyı kaldırır, pin görünür ve tıklanır. Ayar `hy:map:labels` kaydında; eski kayıt geçerli. Panel alçak ekranda kayar.
- **Yerel saat (istek 3):** "türkiye dışındaki havalimanlarının da utc olarak yerel saatlerini bulabilir miyiz? bulabilirsek onları da ekle": evet. Saat dilimi IANA tz veritabanından (kamu malı; ülke → dilim tablosu ve 1.–2. halka kuralları, poligon ve ODbL verisi yok, yeni bağımlılık yok). Pencerede her havalimanında "Yerel saat 23:05 (UTC+2)" (Türkiye'de "(UTC+3)"), gözlem saati yerel. Yabancı havalimanı sayfasında yerel saat ve UTC farkı, gün doğumu ve batımı geri gelir; gözlem, tahmin, TAF ve kayıt saatleri havalimanının yerel saatidir. Dilimi bilinmeyen havalimanında bugünkü davranış (UTC ya da "Türkiye saati" etiketi) sürer. Türkiye sayfaları değişmez.

**Dizinler ve dosyalar — adlar ve harita etiketi:**
- **`packages/shared/src/reference/`:** `airport-names.ts` (`ministry` ve `military` kaynakları, `official` alanı, `airportOfficialName`; tabloda `ourairports` kaydı kalmadı), `foreign-airport-names.ts` (Gebele, Şehit Eşrefi İsfahani, Serdar Cengel), `airport-map-names.ts` (`AIRPORT_MAP_NAMES`, `airportMapName`, `AIRPORT_MAP_NAME_MAX_LENGTH` 16), `index.ts`; testler `names.test.ts`, `reference.test.ts`
- **`packages/i18n/src/messages/`:** `tr.ts`, `en.ts` (`airport.nameSource.ministry` ve `military`, `airports.names`, `about.sources.names`, `map.labels.airports` ve `airportModes`, `map.labels.hint`)
- **`apps/web/src/`:** `lib/airports.ts` (`isIndexable`: `dhmi`, `operator`, `ministry`), `components/airports/airport-view.tsx` (ad kaynağı satırında resmî ad), `lib/map/label-settings.ts` (`airports` alanı, `copyLabelSettings`, `sameLabelSettings`), `components/map/use-label-settings.ts`, `components/map/map-controller.ts` (`sameViewState` bütün alanlar, ad yazı tipinin Türkçe alt kümesi), `components/map/labels.ts` (`nameOf`, `showsAirportChips`, `showsAirportNames`, `AIRPORT_NAME_MIN_ZOOM` 7), `components/map/panels/label-settings-control.tsx` (`LabelSettingsPanel`, `ModeGroup`), `app/globals.css` (panelde kaydırma; yükseklik `.live-map` kapsayıcı sorgusuyla haritadan, `--map-panel-top` telefonda arama kutusunun altı, `--map-controls-bottom`; açık panelin denetimleri aramanın üstünde; seçenek yazısı ortalı); testler `lib/airports.test.ts`, `lib/map/label-settings.test.ts`, `components/map/labels.test.ts`, `components/map/map-controller.test.ts`, `components/map/panels/panels.test.ts`, `components/airports/airport-view.test.ts`, `app/og/site/route.test.ts`
- **`e2e/`:** `label-canvas.ts` (etiket tuvalindeki havalimanı kutuları), `tests/live-map.spec.ts` (havalimanı etiketi), `tests/airports.spec.ts` (altı alanın adları, Atina'nın en yakını), `support.ts` (dizine eklenen 56), `tests/seo.spec.ts` (metinler)
- **Belgeler:** D-084 "Adlar" ve "Harita etiketi" maddeleri; `docs/spec/domain.md` (Harita etiketleri); `docs/REFERENCES.md` (bakanlık ve üs kaynakları); `ATTRIBUTION.md`

**Kabul komutları — adlar ve harita etiketi:**
- `pnpm --filter @havayolu/shared test` → `names.test.ts`: 61 + 5 + 75 havalimanının Türkçe adında İngilizce cins adı (Air Base, Airbase, Airport, International, National, Airfield, Heliport, Island), İngilizce adında Türkçe cins adı (Havalimanı, Havaalanı, Hava Üssü, Uluslararası, Ulusal) yok; hiçbir Türkiye havalimanı OurAirports adıyla görünmez; kısa ad listelenen her havalimanında iki dilde ≤ 16 karakter, büyük harfle başlar, dile uygun ve tekil; Türkiye'de görünen addaki yer adıdır. `reference.test.ts`: kaynak dağılımı 50 DHMİ, 5 işletmeci, 1 bakanlık, 5 askerî; altı alanın TR/EN adları; `airportOfficialName`
- `pnpm --filter @havayolu/i18n test` → yeni anahtarlar iki dilde aynı yer tutucularla
- `pnpm --filter @havayolu/web test` → `isIndexable`: gizli 5 üs, LTAD dizinde, 56 sayfa, tabloda olmayan Türkiye havalimanı (LTZZ) yalnız tarifeli ya da istasyonsa dizinde; sayfada altı alanın başlığı ve içerik yolu iki dilde, `lang` ile işaretli ögeler dışında öbür dilin cins adı yok, OurAirports adı `lang="en"` satırında; LTAD resmî ad satırı; Atina'nın en yakını "Çiğli Hava Üssü (IGL)" / "Çiğli Air Base (IGL)"; etiket ayarı kaydı (eski kayıt, geçersiz değer, yalnız bilinen alanlar), `sameViewState` havalimanı alanıyla; yerleşim: adlı kutu, sola geçme, sığmazsa kod, Kod ve ad hiçbir kodu kaybettirmez ve kutular çakışmaz, birincil istasyonda ad yerdeki uçakları örtmez (kod kısmı örtebilir, D-079); çizim: Gizle yazı ve kod tıklaması yok, Kod yalnız "IST", Kod ve ad z ≥ 7'de "IST" + "İstanbul"/"Istanbul" ve adın üstü tıklanır, z < 7 yalnız kod; panelde üç grup, ayrı radyo adları, TR/EN metinleri
- `pnpm test:e2e` → `live-map.spec.ts`: varsayılan Kod ve IST kodu tıklanır; Kod ve ad klavyeyle (ok tuşu) seçilir, kayıt `{selected, others, airports: 'name'}`, z10'da IST kutusu genişler ve adın üstü pencereyi açar; yenilemede ayar geri gelir; Gizle (diğer uçaklar da gizli) tuvalde hiçbir piksel bırakmaz, pin pencereyi açar; 375×560, 320×480 ve 812×340'ta açık Etiketler ve Havalimanları panelinin üstü haritanın içinde ve arama kutusunun altında, başlığı, grup adları ve her seçeneği tıklama noktasında kendisi. `airports.spec.ts`: altı alanın `/istasyon/<ICAO>` ve `/en/…` başlığı ve `<title>`'ı, sayfanın kendi dilindeki metinde öbür dilin cins adı yok; `/istasyon/LGAV` ve `/en/istasyon/LGAV`'de en yakın Türkiye havalimanı bağlantısı Çiğli. `seo.spec.ts`: site haritası 56 + 75 havalimanı, LTAG `noindex, follow`
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Dizinler ve dosyalar — yerel saat:**
- **`packages/shared/src/reference/`:** `time-zones.ts` (`COUNTRY_TIME_ZONES`: tzdb `zone.tab`'ın 216 tek dilimli ülkesi ve XK; `REGION_TIME_ZONES`: Rusya'nın Kuzey Kafkasya, Krasnodar, Rostov, Kalmukya → Moskova, Volgograd, Astrahan, Kazakistan Mangistav; `AIRPORT_TIME_ZONES`: LCEN, LCLK, LCPH, UGSS; `airportTimeZone`, `isSupportedTimeZone`), `index.ts`; test `time-zones.test.ts`. Uzak halkalar (5. halka dahil) yalnız bölge ve havalimanı kuralı ekler.
- **`packages/i18n/src/`:** `weather.ts` (`WeatherTextOptions.timeZone`; `formatClock`, `formatUtcOffset`, `formatDayMonth`, `formatDayTime`, `formatMeasure`, `weatherText` dilim alır, varsayılan Europe/Istanbul), `messages/tr.ts` ve `messages/en.ts` (`map.airportPopup.localTimeValue`, `weather.log.introLocal`), `weather.test.ts`
- **`apps/web/src/components/`:** `map/airport-popup-model.ts` (`popupTimeZone` = `airportTimeZone`, `formatLocalTime`), `map/airport-popup.tsx`, `airports/airport-weather.tsx`, `airports/airport-weather-live.tsx` (tarayıcının tanımadığı dilimde Türkiye saatine düşer), `airports/weather-panel.tsx`, `airports/weather-expert.ts`, `airports/weather-log.tsx` (`abroad` yerine `timeZone: string | null`); testler `map/airport-popup-model.test.ts`, `map/airport-popup.test.ts`, `airports/airport-weather.test.ts`
- **`e2e/tests/`:** `foreign-airports.spec.ts` (LGAV penceresi ve sayfası: Atina'nın saati UTC farkıyla, beklenen değer Node `Intl`'iyle o an için hesaplanır; gün doğumu, gün batımı, kaydın girişi), `weather.spec.ts` (LTFM sayfası ve penceresi "(UTC+3)")
- **Belgeler:** D-084 "Yerel saat" maddesi; D-080'in iki saat dilimi maddesi ve D-078'in gün doğumu maddesi D-084'e bağlandı; `docs/spec/domain.md` (Birimler ve zaman: yerel saat havalimanının kendi dilimi, dilimi bilinmeyende UTC ya da etiketli Türkiye saati); `docs/spec/data-sources.md` §5a (tzdb, 7 alanlı lisans kaydı); `docs/REFERENCES.md`; `ATTRIBUTION.md`

**Kabul komutları — yerel saat:**
- `pnpm --filter @havayolu/shared test` → `time-zones.test.ts`: her dilim `Intl.supportedValuesOf('timeZone')`'da; ülke tablosu `Intl.Locale#getTimeZones()` ile birebir (XK boş liste); bölge kuralları yalnız çok dilimli ülkelerde ve o ülkenin dilimleriyle; 1. ve 2. halkanın 164 havalimanı araştırmanın beklenen diliminde (2. halka scratch listesinden, Sohum Moskova, Volgograd kendi dilimi); kural sırası; kuralı olmayan çok dilimli ülke, bilinmeyen kod ve prototip anahtarı null; Atina 25 Ekim 2026 01:00 UTC'de UTC+3 → UTC+2, Tahran UTC+3:30, Astrahan UTC+4, Aktav UTC+5, Kahire 29 Ekim'e kadar UTC+3; fixture'daki Türkiye havalimanları Europe/Istanbul ve açık halkadaki her yabancı havalimanı beklenen dilimde
- `pnpm --filter @havayolu/i18n test` → Atina "23:05" ile "UTC+3"/"UTC+2", Tahran "UTC+3:30", New York "UTC−5" (U+2212), Londra "UTC"; "yarın" havalimanının takvimine göre; TAF geçerlilik sonu dilimde
- `pnpm --filter @havayolu/web test` → pencere: IST "16:00 (UTC+3)", ATH yazın "16:00 (UTC+3)" ve kışın "23:05 (UTC+2)", Tahran "16:30 (UTC+3:30)", Tiflis "(UTC+4)", Sohum ve Ercan "(UTC+3)"; gözlem yerel ("Gözlem 16:20"), ABD'de yerel saat satırı yok ve "12:50 UTC"; sayfa: LGAV'de "Yerel saat 15:00 (UTC+2)", gün doğumu 07:38, gün batımı 17:28, "Gözlem 14:50", "yarın 14:00", "Gözlem zamanı: 12:50 UTC (yerel saat 14:50)", kayıt girişi "şu an UTC+2"; dilimsiz yabancı havalimanında "Türkiye saati" etiketleri; tanınmayan dilimde ada Türkiye saatine düşer
- `pnpm test:e2e` → `foreign-airports.spec.ts`: `/?havalimani=LGAV` penceresinde (TR, EN) "Yerel saat" satırı Atina'nın o anki saati ve farkı ("HH:MM (UTC+2|3)"); `/istasyon/LGAV` ve `/en/istasyon/LGAV`'de yerel saat ve farkı, gün doğumu, gün batımı, kaydın girişi yerel saatle, "Türkiye saati" yok; `weather.spec.ts`: `/istasyon/LTFM` ve pencere "(UTC+3)", değişmedi
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

- **Kontrol (2026-10-03):** üç istek, kullanıcı kararları ve 4 doğrulanmış bulgu (IST ad kutusu yerdeki uçakları örtmez, küçük telefonda panel arama kutusunun altına girmez, D-084 dizin kuralı metni, domain.md yerel saat) tamam; 19 mutasyonun 17si birim testlerince, 1i e2e ile yakalandı, 1i (IST ad kutusunun yalnız kod kısmının uçak etiketlerini engellememesi) testsiz kaldı.
- **`pnpm ci:full` → yeşil:** birim testleri web 645, shared 494, api 251, worker 200, providers 120, i18n 85, tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 110/110.
- `pnpm stats` → 531 dosya, 93.235 satır (84.877 kod).

## M6e.2 — Rüzgâr renkleri ve rüzgâr kesmesi (v0.14.1)
Onay: 2026-10-03 (kullanıcı isteği, üretimdeki Konya penceresinin ekran görüntüsüyle: "rüzgar 10km ve altında ise açık yeşil yap. üzerinde ise normal renginde olmaya devam etsin. rüzgarlı limanlar var ama renkli değil. hataları analiz et. sadece 1 liman üzerinden gitme"; eşik kararı: ortalama ≥ 17 kt ya da hamle ≥ 25 kt; yama sürümü, D-082)

Hedef sürüm 0.13.2. Karar D-083'teki "2026-10-03 kullanıcı kararı: rüzgâr renkleri ve rüzgâr kesmesi" maddesidir.

**Kapsam:**
- Analiz tek havalimanı değil, üretimde METAR'ı olan 122 istasyondur: meydan uyarısı kuralı (20/30 kt) doğru uygulanıyordu; 17–19 kt esen 10 ve hamlesi 25–26 kt olan 2 istasyon eşiğin altında kalıp sade görünüyordu; LGMK'nin `WS R34` grubu sade görünümde yoktu.
- Rüzgâr satırı ortalama ≥ 17 kt ya da hamle ≥ 25 kt'de kehribar, yanında şiddetin adı: "Sert rüzgâr" (17–19 kt), "Hamleli rüzgâr" (hamle 25–29 kt); güçlü düzeylerin adları değişmedi.
- Gösterilen hız ≤ 10 km/sa (sakin dahil) açık yeşil; değer hızı yazıyorsa "Hafif rüzgâr" etiketi ("Sakin", "Hafif ve değişken yönlü" değerlerinde etiket yok). Arası sade.
- Rüzgâr kesmesi (`WS R34`, `WS RWY34`, `WS ALL RWY`) rüzgâr satırında değerin altında: "Rüzgâr kesmesi bildirildi: pist 34"; satır kehribar (rüzgâr hafif olsa da). Uzman görünümü grubu zaten yazıyordu.
- Pencere ve havalimanı sayfası aynı bileşendir (`phenomenonRows`).
- **Kontrol turu düzeltmeleri (D-083 "Kontrol turu"):** (1) TAF özeti zayıflatan BECMG'de eski koşulu (kuvvetli rüzgâr, hava olayı) değişim penceresinin başında değil sonunda bitirir (WMO-782; M6c'den beri pencerenin başındaydı: üretimde LTCG ve LTFO "önemli hava olayı yok" diyordu); (2) uzman görünümünde tekrarlanan `WS` grubunun her satırı yalnız kendi pistini söyler; (3) D-083'teki fixture listesine LTBS eklendi.
- **Değişmeyenler:** MGM meydan uyarısı eşiği (`isStrongWind`, API'deki `derived.strongWind`, OpenAPI), TAF'ın rüzgâr öğesinin eşiği (20/30 kt), pencere düzeni ve hizası.

**Dosyalar:**
- `packages/shared/src/weather/schema.ts` (`WIND_LEVELS` başına `gusty`, `fresh`; `LIGHT_WINDS`), `derive.ts` (`FRESH_WIND_MEAN_KT`, `GUSTY_WIND_GUST_KT`, `LIGHT_WIND_MAX_KMH`, `lightWind`, `isLightAndVariable`; `isStrongWind` açık eşikle), `summary.ts` (`windLight`, `windShear`, `windShearText`; `strongWind` = `isStrongWind`; `Prevailing.until`, `mergePrevailing` örtüşen dilimler), `phrase.ts` (3 kesme anahtarı), `index.ts`; `derive.test.ts`, `summary.test.ts`
- `packages/i18n/src/messages/tr.ts`, `en.ts` (`weather.wind.level.gusty`, `fresh`, `weather.wind.light`, `shearAll`, `shearRunway`, `shearRunways`), `weather.test.ts`
- `apps/web/src/components/airports/weather-rows.ts` (`windRow`, ton `calm`, `note`), `weather-row-list.tsx` (`.wx-note`), `weather-rows.css` (açık yeşil token'ları, etiket rengi satırın rengi), `weather-expert.ts` (`WS` satırı kendi grubundan); `airport-weather.test.ts`, `weather-expert.test.ts`, `components/map/airport-popup.test.ts`
- `e2e/tests/weather.spec.ts` (LTAI kehribar "Hamleli rüzgâr", LTAJ açık yeşil; pencere hizasında LTAI'nin vurgulu satırlarına rüzgâr)
- `docs/DECISIONS.md` (D-083 alt maddesi), `docs/REFERENCES.md` (MGM IV.1.3.9.4, Beaufort ıskalası)

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → düzeylerin ve hafif rüzgârın sınırları (16/17 kt, 24/25 kt hamle, 5/6 kt, MPS 2/3 m/s, KMH 10/11), 17 gerçek üretim METAR'ı, rüzgâr kesmesinin dört biçimi; zayıflatan BECMG (üretim LTCG ve LTFO TAF'ları, pencere içinde başlayan FM)
- `pnpm --filter @havayolu/i18n test` → iki dilde adlar, etiket ve kesme metinleri; sayıdan önce ayraç yok
- `pnpm --filter @havayolu/web test` → sayfada ve pencerede rüzgâr satırının tonu, etiketi ve kesme satırı; uzman görünümünde `WS R34` ve tekrarlanan grup (`WS R16 WS R34`); LTBS "Hamleli rüzgâr"
- `pnpm test:e2e` → `weather.spec.ts`: LTAI rüzgâr satırı kehribar ve "Hamleli rüzgâr"/"Gusty wind"; LTAJ açık yeşil (`rgb(220, 252, 231)` zemin, `rgb(22, 101, 52)` yazı) ve "Hafif rüzgâr"/"Light wind"; IST ve LTAI pencereleri tek hizalı
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-03, uygulama; sürüm, changelog ve README yayın adımındadır):**
- Üretim anlık görüntüsü (122 istasyon) yeni kurallarla arayüzün `phenomenonRows`'undan geçirildi: 36 açık yeşil (31'i "Hafif rüzgâr" etiketli, 5'i "Hafif ve değişken yönlü"), 65 sade, 21 kehribar (9 meydan uyarısı düzeyi, 10 "Sert rüzgâr", 2 "Hamleli rüzgâr"; LGMK'de "Rüzgâr kesmesi bildirildi: pist 34"). Önce 9 kehribar, 0 yeşil.
- Renk karşıtlığı (betikle): `#166534` yazı `#DCFCE7` zeminde 6,49:1, beyaz etikette 7,13:1.
- Birim testleri: `pnpm --filter @havayolu/shared test` → 519 (+49), `@havayolu/i18n` → 91 (+8), `@havayolu/web` → 625 (+4); API ve worker hava testleri (`reference/weather.test.ts` 35, `jobs/weather.test.ts` 25) değişmeden yeşil.
- **Kontrol turu (2026-10-03):** TAF özeti üretim anlık görüntüsünde (TAF'ı olan 122 istasyon) eski ve yeni kodla karşılaştırıldı: 9'u değişti (LTCG ve LTFO "önemli hava olayı yok" yerine kuvvetli rüzgâr 20G30, UGTB'de eksik fırtına öğesi geldi; LTBJ, LTAY, LTFC, LTBA, LTFM, LTBU'da bitiş BECMG penceresinin sonuna kaydı), öteki 113 aynı. Fixture'da (13:00Z) 10 istasyonun 5'i değişti (LTCE, LTAI, LTAC, LTCG, LBSF). Fixture METAR'larının rüzgâr tonu eski ve yeni kuralla karşılaştırıldı: 20 istasyonun 8'i değişti, D-083 listesi tamdır (LTBS eklendi). Eski kodla yeni BECMG testleri ve güncellenen 3 beklenti (6 test) kırmızı, eski uzman koduyla tekrarlanan `WS` testi kırmızıdır (denendi).
- Kontrol turundan sonra: `pnpm --filter @havayolu/shared test` → 522 (+3), `@havayolu/i18n` → 91 (bir beklenti güncellendi), `@havayolu/web` → 626 (+1; LTBS bir teste eklendi); API `reference/weather.test.ts` 35, worker `jobs/weather.test.ts` 25 yeşil. `pnpm --filter` shared, i18n, web `typecheck` ve `lint`, `pnpm format`, `pnpm check:eol`, `pnpm changelog:check` (v0.13.1) → yeşil.
- `pnpm typecheck --force` (9/9), `pnpm lint --force` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`, `pnpm changelog:check` (v0.13.1; sürüm yayın adımında) → yeşil.
- **Yayın adımı (2026-10-03):** dal v0.14.0 ile birleştirildi (plan çakışması iki bölüm korunarak çözüldü; testlerdeki eski `abroad` seçeneği M6f'nin `timeZone` seçeneğiyle değiştirildi). main CI'da bir kez kırmızı olan pencere hizası testi düzeltildi: 375 px'ten 320 px'e inince harita tuvalinin yeni genişliği beklenir (`expect.poll`).
- **`pnpm ci:full` → yeşil:** birim testleri web 650, shared 546, api 251, worker 200, providers 120, i18n 93, tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard`; E2E 110/110.
- `pnpm stats` → 531 dosya, 94.167 satır (85.714 kod).


## M6l — Logo (v0.15.0)
Onay: 2026-10-03 (kullanıcı seçimi: tasarım tuvalindeki "A · Halka"; B · Tırmanış, C · Rota ve A + B birleşik öneri reddedildi; küçük sürüm, D-082)

Hedef sürüm 0.15.0. Karar D-086'dadır.

**Kapsam:**
- Başlıktaki "◎" halka işaretinin yerine logo: halkanın içinden 45° ile sağ üste uçan, üstten görülen çift motorlu yolcu uçağı; burun, kanat uçları ve kuyruk halkayı keser. Şeritte beyaz (`currentColor`), yazının 1,5 katı (24 px), şerit uzamaz; işaret süstür (`aria-hidden`), bağlantının adı yalnızca yazı. Yazı marka değişmez (Overpass 800).
- Bütün yüzeyler tek geometri ve renk kaynağından çizer: başlık (site, yönetim, 404 ve hata sayfaları kök düzende), paylaşım görselleri (site ve havalimanı; açık zemin renkleri), uygulama simgeleri (192 ve 512 px köşeleri yuvarlatılmış; maskelenebilir simge `/icon/maskable` ve Apple 180 px tam kare), `favicon.ico` (16, 32, 48 px küçük işaret: turkuaz daire, beyaz uçak).
- **Değişmeyenler:** yazı marka ve boyutu, tema renkleri, manifest adı ve renkleri, paylaşım görsellerinin yazıları ve yazı tipleri.

**Dosyalar:**
- `apps/web/src/lib/brand/logo-geometry.ts` (uçak çizgisi, motorlar, halka, ölçekler, dönüşüm ve tersi), `lib/brand/logo-svg.tsx` (hook'suz SVG: `logoShapes`, `logoSvg`, `logoIconSvg`), `lib/seo/brand.ts` (`LOGO_COLORS`), `lib/seo/og.tsx` (`BrandMark`, `BrandIcon`), `lib/seo/og-site.tsx` ve `components/airports/airport-og.tsx` (işaret boyu)
- `apps/web/src/components/brand/brand-mark.tsx` (`useId` ile tekil maske), `components/brand/site-brand.tsx`, `app/layout.tsx`, `app/globals.css` (`.brand`, `.brand-mark`)
- `apps/web/src/app/icon.tsx` (`192`, `512`, `maskable`), `app/apple-icon.tsx`, `app/manifest.ts`, `app/favicon.ico` (`scripts/gen-favicon.mts` ile yeniden üretildi)
- Testler: `lib/brand/logo.test.ts`, `components/brand/brand.test.ts`, `app/app-icons.test.ts`, `lib/seo/test/png.ts` (test için PNG çözücü); `e2e/tests/airports.spec.ts` (başlıktaki logo)
- Belgeler: D-086; D-081 ve D-076'nın simge maddeleri D-086'ya bağlandı

**Kabul komutları:**
- `pnpm exec tsx scripts/gen-favicon.mts` → `favicon.ico` 16, 32, 48 px
- `pnpm --filter @havayolu/web test` → uçağın iki yolu tasarımdaki `planeTop` ile birebir; dönüşümler (0,98 ve 0,74, 45°), `toPlaneSpace` tersidir, burun sağ üstte; tam işarette burun, kanat uçları ve kuyruk halkanın dışında, küçük işarette uçak dairenin içinde, uygulama simgesinde işaret güvenli alanda; `LOGO_COLORS`; SVG: maske, halka, uçak sırası ve renkleri, küçük işaret maskesiz, simgede `rx="24"` ve `translate(12 12) scale(0.76)`; başlık bağlantısının erişilebilir adı yalnızca "havayolu" (bir kez), işaret `aria-hidden` ve `focusable="false"`, iki işaretin maske kimlikleri farklı ve her halka kendi maskesini kullanır; PNG pikselleri: 192/512 köşe saydam ve merkez beyaz, `maskable` köşeler dolu ve güvenli alanın dışı yalnızca zemin, Apple 180 tam kare, favicon köşe saydam, kenar turkuaz, merkez beyaz
- `pnpm test:e2e` → `airports.spec.ts`: başlıkta tek marka bağlantısı, adı "havayolu", işaret 24 × 24 px ve `aria-hidden`, halkanın maskesi belgede tek ve `<mask>`; `seo.spec.ts`: manifestteki üç simge (`/icon/maskable` dahil) ve `<link rel="icon">`'lar 200 ve PNG
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

- **Yayın adımı (2026-10-03):** dal v0.14.1 ile birleştirildi; maskeye kuyruk üçgeni eklendi (512 px önizlemede kuyrukta halka kırıntısı görüldü; D-086). Başlık logosu e2e testi, yol satırındaki "havayolu" bağlantısını saymasın diye başlıkla sınırlandı.
- **`pnpm ci:full` → yeşil:** birim testleri web 663, shared 546, api 251, worker 200, providers 120, i18n 93, tools 74, db 44, geo 31, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard`; E2E 111/111.
- `pnpm stats` → 538 dosya, 95.066 satır (86.551 kod).

## M6k — Uçak listesi sağ üstte (v0.16.0)
Onay: 2026-10-03 (kullanıcı isteği, üretimdeki haritanın ekran görüntüsüyle: "Haritada görünen uçakları ekranın sağ üst köşesine yerleştir. aranan uçaklar kalsın solda sadece. uçaklar listelenmeye başlayınca ekranın bir tarafı en azından kullanılabilsin. Sefer / Kuyruk(tescil-reg) / Yükseklik / Konum ve Durum (yaklaşıyorsa ya da inişte ise veya yerde ise bildir.)"; açık sorularda araştırmanın önerdiği varsayılanlar; küçük sürüm, D-082)

Hedef sürüm 0.16.0. Karar D-085'tedir.

**Kapsam:**
- **Yerleşim:**
  - 768 px ve üstünde liste sağ üstte: en çok 440 px genişlik, alt kenarı haritanın ortasının 12 px üstünde (yükseklik en çok yarısı eksi 24 px; 959 px ve altında 30 px, ortalanan seçili simge altında kalmaz); içinde kayar.
  - Seçili uçağın etiketi haritanın üstündeki panelleri (arama, kart, liste, sağ alttaki düğmeler; `data-map-panel`) örtmeyen konumu seçer (`layoutLabels` → `panels`).
  - Başlık düğmesiyle daralır ya da açılır, sayı rozeti ve ok vardır; hâl cihazda saklanır (`hy:map:list`, varsayılan açık).
  - Sol sütunda yalnızca arama ve bilgi kartı (kart sağ üstten aramanın altına taşındı). Sütun konumlandırılmamış (static) bir bloktur; haritanın öteki katmanları `position: absolute`'tur.
  - Durum şeridi 1180 px ve üstünde sütun ile liste arasında ortalı, altında arama ile kartın arasında.
  - Havalimanı penceresi listeyi, aramayı ve sağ alt düğmeleri örtmeyen yanı seçer (`placePopup` → `avoid`); hepsi örtüyorsa en az örteni.
  - Kart haritanın ortasını örtünce (768 px'e yakın) harita sola pay alır (`MapViewState.insets`: `bottom`, `left`; ölçü kökü `.live-map`).
  - Telefonda sol alt düğme ve alt liste kalır (kapalı başlar, saklanmaz).
- **Sütunlar:**
  - Sefer;
  - Kuyruk (tescil; PIA/LADD ya da bilinmeyen tescilde "—", notla; erişilebilir adı "Kuyruk tescili");
  - Yükseklik ("yerde"; sayı ve birim bölünmez);
  - Konum ve durum (rozet: Yaklaşmada, İnişte, Yerde, Alçakta sinyal kaybı; konum: "IST, 18 km", "IST, pist 35L", "IST üzerinde", "IST, 45 km kuzeyinde").
  - Tip ve Hız listeden çıkar (bilgi kartında kalır). Altta "Durumlar tahminidir" notu (`aria-describedby`).
- **Durum:** yalnızca gösterim. İstemcide, depo değiştikçe (WebSocket farkı), listelenen havalimanlarına ve pist uçlarına göre hesaplanır (domain.md → "Haritadaki uçak listesi: tahmini durum"). Motor eşikleri değişmez. Durumlar canlı bölge değildir, değişince duyurulmaz. Merkeze göre kurallar yalnızca tarifeli havalimanlarında, girişte 45° ve çıkışta 90° koniyle; kendi başına uyan aday önce gelir (gözden geçirme 2026-10-04: IST ve SAW varışları "Yaklaşmada ISL" görünüyordu).
- **Kapsam dışı:**
  - pas geçme ve kalkış durumları;
  - duruma göre sıralama (sıra değişmedi: görünüm ortasına uzaklık, ilk 50);
  - bilgi kartında durum satırı;
  - QNH ile yerden yükseklik;
  - mobil uygulama.
- **Bilinen sınırlar:**
  - 1280 × 720'de ~516 px'ten uzun IST penceresi solda açılır ve arama kutusunu birkaç piksel örtebilir (bütün yanlar bir paneli örtünce en az örten yan seçilir);
  - güzergâh bilinmediği için başka bir havalimanına giderken tarifeli bir havalimanının önünden alçalarak geçen uçak (ör. Trakya'dan IST'ye gelirken TEQ) kısa süre ona "Yaklaşmada" görünebilir;
  - seçili etiket, bütün yakın ve çizgili konumlar doluysa panelin üstüne gelebilir.
- **Ek (2026-10-04, kullanıcı isteği; v0.16.0 ile yayımlanır):** "Havalimanları etiketi kod ve ad ı kaldır. tıklayınca detaylı veri var. adına gerek yok orada": Etiketler → Havalimanları yalnız Gizle / Kod (varsayılan Kod); saklanmış "Kod ve ad" ayarı Kod okunur. Kısa ad tablosu (`airport-map-names.ts`), adlı kutu çizimi ve ilgili i18n metinleri kaldırıldı; pinler her zaman görünür ve tıklanır. Karar D-084'e tarihli madde olarak eklendi.

**Dizinler ve dosyalar:**
- **`packages/geo/src/`:** `index.ts` (`crossTrackKm`, `alongTrackKm`); test `geo.test.ts`
- **`packages/i18n/src/messages/`:** `tr.ts`, `en.ts`. `map.table`: `registration`, `registrationLabel`, `place`, `phase.*`, `placeDistance`, `placeRunway`, `placeOver`, `placeBearing`, `direction.*`, `note`. `type`, `speed` ve `position` kalktı. `units.ts`: `formatDistance` `nowrap` seçeneği (konum sütununda "45 km" bölünmez); test `units.test.ts`.
- **`apps/web/src/lib/map/`:** `flight-phase.ts` (`FlightPhaseTracker`, eşikler, `scheduled`), `list-settings.ts` (`hy:map:list`), `label-layout.ts` (`panels`, `ScreenRect`); testler `flight-phase.test.ts`, `list-settings.test.ts`, `label-layout.test.ts`
- **`apps/web/src/components/map/`:**
  - `live-map.tsx` (`.live-map__left`; `useFlightPhases`; `insets` ölçüsü kökü `.live-map`; `data-map-panel`);
  - `use-aircraft-list-open.ts`, `use-flight-phases.ts`, `use-map-panels.ts` (panel dikdörtgenleri, `ResizeObserver`);
  - `airport-data.ts` (pist uçları);
  - `popup-placement.ts` (`avoid`), `airport-popup.tsx` (`data-map-panel` dikdörtgenleri, `ResizeObserver`);
  - `map-view.tsx`, `map-controller.ts` (`MapInsets`, `NO_INSETS`, `mapPadding`, `panels`), `labels.ts` (seçili etiketin panelleri);
  - `panels/aircraft-table.tsx`, `panels/aircraft-place.ts`;
  - testler `panels/panels.test.ts`, `panels/aircraft-place.test.ts`, `popup-placement.test.ts`, `airport-data.test.ts`, `map-controller.test.ts`, `use-map-panels.test.ts`.
- **`apps/web/src/app/globals.css`:** sol sütun, sağ üst liste (`--map-left-width`, `--map-table-width`, `--map-table-clear`: 959 px ve altında 30 px), daraltma (`data-wide-open`, `data-phone-open`), durum şeridi boşluğu, durum rozeti, not, telefon kuralları.
- **`e2e/tests/live-map.spec.ts`, `e2e/support.ts`:**
  - yükseklik değişimi ve konumda IST;
  - liste yeri (12 px kenar, yarı yükseklik), çakışmasızlık, sütunlar, durumlar, daraltmanın saklanması;
  - pencerenin listeyi örtmemesi;
  - kartın solda olması; 1024 ve 768 px'te seçili etiketin listenin altında kalmaması, 768 px'te dolu listenin ortalanan simgenin üstünde bitmesi (`e2e/label-canvas.ts` → `selectedLabelPixels`);
  - telefonda düğme, dört sütun, yatay taşma yok.
- **`e2e/tests/weather.spec.ts`:** pencereyi kapatan "boş yere tıklama" merkezden 450 px batıya taşındı (pencere artık genellikle solda açılır; eski nokta, merkezin 150 px batısı, pencerenin içine düşerdi).
- **Belgeler:** D-085; `docs/spec/domain.md` (Haritadaki uçak listesi: tahmini durum); `docs/ACTIVATION.md` (M6k yayın doğrulaması). `docs/REFERENCES.md`'ye 3° süzülüş kaynağı (ör. FAA AIM 1-1-9 ya da ICAO PANS-OPS) adresi doğrulanınca eklenecek: doğrulama canlı istek ister, bu oturumda yapılmadı.

**Kabul komutları:**
- `pnpm --filter @havayolu/geo test` → çapraz ve boyuna sapma; kapsam ≥ %90.
- `pnpm --filter @havayolu/i18n test` → yeni anahtarlar iki dilde aynı yer tutucularla; sayıdan önce "·" ya da "–" yok.
- `pnpm --filter @havayolu/web test` →
  - durum kuralları (taksi Yerde; 35L'de 5 km İnişte ve "pist 35L"; 18 km Yaklaşmada; uzaklaşan, tırmanan ve süzülüş zarfının üstündeki uçak durumsuz; iki havalimanı arasında doğru seçim; VAN rakımı; 5 sn onay ve çıkış eşikleri; 30 sn'de Alçakta sinyal kaybı; havalimanı yokken koordinat);
  - havalimanı seçimi (tarifesiz Atatürk merkez kuralına girmez, pist hizasında görünür; 70° yandaki SAW yaklaşmada değil; arkada kalan havalimanı 5 sn'de düşer; kendi başına uyan ve iz yönüne yakın aday önce; SAW ve IST rüzgâr altı kollarında 2 sn örnekli uçuşta yalnızca hedef havalimanı);
  - seçili etiketin panelleri örtmemesi (`layoutLabels` → `panels`), panel dikdörtgenleri (`use-map-panels`);
  - TR/EN metinleri ve sekiz yön;
  - tablo sütunları ("Kuyruk tescili"), "—", not ve `aria-describedby`, canlı bölge yok, düğme durumları (geniş: açık ve daraltılmış; telefon: kapalı);
  - pencere yerleşiminde kaçınma (sağ → sol → alt; en az örtüşme; kenar boşluğu; kaçınma yokken eski sonuçlar);
  - panel payı (`insets.bottom`, `insets.left`);
  - pist uçlarının okunması;
  - `hy:map:list` kaydı (varsayılan açık, geçersiz değer açık, hata veren depolama).
- `pnpm test:e2e` → `live-map.spec.ts`:
  - 1280 px'te liste sağ üstte (12 px kenar, alt kenarı ortanın 12 px üstünde) ve arama, durum şeridi, sağ alttaki düğmeler ve atıfla çakışmaz;
  - sütun adları;
  - HYS092 "Yerde" ve "IST", kuyruk "TC-SYN92"; HYS091 yaklaşmada ya da inişte ve "IST"; seyirdeki uçaklar rozetsiz;
  - daraltma yenilemede kalır;
  - IST penceresi listeyle çakışmaz (arama kutusuyla çakışmazlık denetlenmez; bilinen sınırlar);
  - kart solda, aramanın altında; 1024 ve 768 px'te seçili uçağın etiketi ve simgesi listenin altında kalmaz;
  - 375 px'te liste kapalı başlar, açılınca dört sütun, atıfın üstünde, yatay taşma yok.
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil.
- **Yayından sonra (`[k]`):** üretimde 1280 px'te liste sağ üstte, IST'ye gelen en az bir uçakta "Yaklaşmada" ya da "İnişte" görülür (Atatürk değil), daraltma yenilemede kalır, 768/1024 px'te seçili uçak listenin altında kalmaz, 375 px'te düğme çalışır (ACTIVATION → "M6k yayın doğrulaması").

- **Yayın adımı (2026-10-04):** dal v0.15.0 (logo) ile birleştirildi; karar ve plan çakışmaları iki bölüm korunarak çözüldü.
- **`pnpm ci:full` → yeşil:** birim testleri web 724, shared 546, api 251, worker 200, providers 120, i18n 94, tools 74, db 44, geo 36, scripts 31; entegrasyon db 82, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard`; E2E 113/113.
- `pnpm stats` → 548 dosya, 98.374 satır (89.683 kod).
- **"Kod ve ad" kaldırıldı (2026-10-04, aynı sürüm):** bağımsız kontrol 6 mutasyonun 5ini birim testleriyle, 1ini e2e ile yakaladı; `pnpm ci:full` → yeşil: birim testleri web 718, shared 541, api 251, worker 200, providers 120, i18n 94, tools 74, db 44, geo 36, scripts 33; entegrasyon db 82, api 26, worker 12; E2E 113/113. `pnpm stats` → 547 dosya, 98.022 satır (89.302 kod).

## M6e.3 — Derecelendirilmiş rüzgâr renkleri (v0.16.1)
Onay: 2026-10-04 (kullanıcı isteği: "rüzgar için yeşil kod yaptık ya belli bir km/knot ta renk yok ama rüzgar var. derecelendirmeli yap. rüzgar varsa renkli belirt."; yama sürümü, D-082)

Hedef sürüm 0.16.1 (M6k'nin v0.16.0 dalının üstünden, `2323db0`). Karar D-083'teki "2026-10-04 kullanıcı isteği: derecelendirilmiş rüzgâr renkleri" maddesidir.

**Kapsam:**
- Rüzgâr varsa rüzgâr satırı her zaman renklidir ve basamağın adı metin olarak yazılır: ≤ 10 km/sa (sakin dahil) açık yeşil "Hafif rüzgâr" (değişmedi), 11–19 km/sa limon yeşili "Tatlı rüzgâr", 20 km/sa ve üstü (ortalama < 17 kt, hamle < 25 kt) sarı "Orta rüzgâr", ortalama 17–19 kt ya da hamle 25–29 kt kehribar (değişmedi), MGM meydan uyarısından 34 kt'ye turuncu, ortalama ≥ 34 kt ya da hamle ≥ 43 kt kırmızı.
- km/sa sınırları gösterilen değere göredir (ortalama ile hamlenin büyüğü), kt sınırları mevcut düzeylerinkidir; P99 en az kendi düzeyi; bilinmeyen hız ve NIL vurgusuz; VRB hafif rüzgâr açık yeşil, değeri değişmedi. Rüzgâr kesmesi satırı en az kehribar yapar (kesme basamağı yükselttiyse hafif, tatlı ve orta rüzgârın adı yazılmaz).
- Pencere ve havalimanı sayfası aynı satırlardır (`phenomenonRows`). Gök gürültüsü, dolu ve diğer olayların kehribarı, API `derived.strongWind`, TAF'ın rüzgâr öğesi değişmedi.

**Dosyalar:**
- `packages/shared/src/weather/schema.ts` (`WIND_TIERS`, `WindTier`), `derive.ts` (`BREEZE_WIND_MAX_KMH`, `windLevelTier`, `windTier`), `summary.ts` (`WeatherSummary.windTier`), `index.ts`; `derive.test.ts`, `summary.test.ts`
- `packages/i18n/src/messages/tr.ts`, `en.ts` (`weather.wind.breeze`, `weather.wind.moderate`), `weather.test.ts`
- `apps/web/src/components/airports/weather-rows.ts` (`WeatherTone` = basamaklar ve olaylar, `windRow`, `windTag`), `weather-row-list.tsx` (açıklama), `weather-rows.css` (dört yeni basamak rengi, kehribar ton adı `fresh`, `forced-colors` çerçeveleri); `airport-weather.test.ts`, `components/map/airport-popup.test.ts`, `components/map/airport-popup-model.test.ts`
- `e2e/tests/weather.spec.ts` (IST turuncu, LTAI `fresh`, LTDB limon yeşili, LTAC sarı; altı basamağın renkleri)
- `docs/DECISIONS.md` (D-083 alt maddesi)

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → basamak sınırları (10/11, 19/20, 30/31 km/sa ve 16/17 kt; KT, KMH, MPS), hamle 24/25, 29/30, 42/43 kt, ortalama 19/20, 33/34 kt, P99, bilinmeyen hız; her basamaktan üretim METAR'ı
- `pnpm --filter @havayolu/i18n test` → yeni adlar iki dilde, eşlik, sayıdan önce ayraç yok
- `pnpm --filter @havayolu/web test` → sayfa ve pencerede ton ve etiket; bütün fixture istasyonları; kesme
- `pnpm test:e2e` → `weather.spec.ts`: IST satırı turuncu (`rgb(255, 237, 213)` zemin, `rgb(154, 52, 18)` yazı), LTAI kehribar, LTDB limon yeşili "Tatlı rüzgâr", LTAC sarı "Orta rüzgâr", altı basamağın zemini ve yazısı
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-04, uygulama; sürüm, changelog ve README yayın adımındadır; e2e ve `ci:full` bu adımda çalıştırılmadı):**
- Üretim anlık görüntüsü (2026-10-03 16:56Z, METAR'ı olan 122 istasyon) çalışma ağacının çözücüsü ve arayüzün `phenomenonRows`'u ile: açık yeşil 51 (35 "Hafif rüzgâr", 14 "Hafif ve değişken yönlü", 2 "Sakin"), limon yeşili 37, sarı 22, kehribar 7, turuncu 5, kırmızı 0, vurgusuz 0. v0.14.1 kuralıyla 51 / 59 sade / 12 kehribar. 15:37Z görüntüsünde 36 / 44 / 21 / 12 / 9 / 0.
- Karşıtlık (betikle; yazı/zemin, yazı/beyaz etiket): açık yeşil 6,49 / 7,13; limon yeşili 6,52 / 7,08; sarı 6,12 / 6,64; kehribar 6,37 / 7,09; turuncu 6,38 / 7,31; kırmızı 6,80 / 8,31. Önerilen yellow-100 kehribardan CIEDE2000 ile yalnız 3,4 ayrıldığı için sarı `#FDF9B0` / `#715A00` seçildi (6,7).
- Birim testleri: `pnpm --filter @havayolu/shared test` → 614 (+68), `@havayolu/i18n` → 96 (+2), `@havayolu/web` → 726 (+2; mevcut testlerdeki ton beklentileri gerekçesiyle güncellendi).
- `pnpm typecheck` (9/9), `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol` → yeşil.

- **Yayın adımı (2026-10-04):** dal v0.16.0 ile çakışmasız birleşti. **`pnpm ci:full` → yeşil:** birim testleri web 720, shared 609, api 251, worker 200, providers 120, i18n 96, tools 74, db 44, geo 36, scripts 33; entegrasyon db 82, api 26, worker 12; E2E 113/113. `pnpm stats` → 547 dosya, 98.817 satır (90.015 kod).

## M6g — 2. halka (v0.17.0)
Onay: 2026-10-01 kullanıcı (halkalar, her halka ayrı sürüm) ve 2026-10-03 kararları (tablo başlığı "Türkiye dışındaki havalimanları" / "Airports outside Türkiye"; Sohum Moskova saati)

Hedef sürüm 0.17.0 (`main` `a8753e4` = v0.16.1'den). Kararlar D-088'dedir; kural D-080'in aynısıdır. Migration yoktur: üretim veritabanı 2. halkanın havalimanlarını zaten tutar.

**Kapsam:**
- **Halka:** `ENABLED_AIRPORT_RING` 1 → 2; listelenen havalimanları 136 → 225 (61 + 75 + 89), 14 yeni ülke. En yakını Ben Gurion (500,44 km → API'de 500, 2. halka), en uzağı Kuveyt (988 km).
- **Fixture:** 2026-10-01 indirmesinden (yeniden indirme yok) 89 havalimanı ve 123 açık pist dosyaların sonuna; üretici betik halkaları sırayla yazar ve aynı baytları üretir.
- **Adlar, şehirler, ülkeler:** 89 havalimanının TR/EN adı ve şehri (D-080 kuralları, belirsiz yazımlarda yalnız bugünkü Türkçe kullanım); ülke adları `Intl` (İngilizcede "&" → "and"); KKTC kuralı değişmez; saat dilimi kuralları yeterli (164 havalimanının dilimi testle).
- **Kaynak düzeltmeleri:** İskenderiye HEAX → HEBA (koşullu ICAO düzeltmesi, iki pakette, testli); Taba 04/22 ve Cluj 08/26 yinelenen boş pist satırları gizli; adda çift boşluk teke iner.
- **Hava durumu:** istasyon 225; METAR 3, TAF 2 istek; ilk çalışmada 89 yeni istasyon 15 istekle 24 saat. Toplu ve tek havalimanı yanıtı yalnız yürürlükteki TAF'ları taşır (özet değişmez, eski TAF'lar kayıtta); bütçe 225 istasyon için.
- **Sayfalar ve harita:** `/havalimanlari` yabancı tablosunun başlığı "Türkiye dışındaki havalimanları" / "Airports outside Türkiye" (tablo başlığı, özet, sayfa açıklaması, `/hakkinda`, llms.txt bölümü; "yakın ülkeler" ve "neighbouring" kalmaz); uzaklık sınırı "1.000 km" / "1,000 km"; ad kuralı cümlesi (exonym ya da yerel ad: Kahire; Iași, Timișoara). Tablo 164 satır; site haritası 450 adres, llms.txt 220 havalimanı satırı. 2. halka sayfaları ve pencere ülke ve yerel saatle; harita 225 pini ve kodu kare başına yeni iş olmadan çizer (z5'te 225 kodun yerleşimi ~1–2 ms).

**Dizinler ve dosyalar (veri ve backend):**
- `packages/shared/src/reference/`: `airport-rings.ts` (`ENABLED_AIRPORT_RING`), `airport-codes.ts` (yeni: `OURAIRPORTS_ICAO_CORRECTIONS`, `ourAirportsIcao`), `foreign-airport-names.ts` (164 ad ve şehir), `countries.ts` ("and"); testler `foreign.test.ts`, `names.test.ts`, `time-zones.test.ts`, `reference.test.ts`
- `packages/shared/src/weather/`: `summary.ts` (`inForceTafs`), `schema.ts` (belge); `summary.test.ts`
- `packages/db/src/airports.ts` (`OURAIRPORTS_ICAO_CORRECTIONS`, `ourAirportsIcao`, `cleanAirportName`, `HIDDEN_RUNWAY_IDS`, `isHiddenRunway`); `airports.test.ts`, `airports.int.test.ts`
- `apps/api/src/reference/`: `weather.ts` (yürürlükteki TAF'lar), `airports.ts` (açıklama); `weather.test.ts`, `weather.int.test.ts`, `rings.test.ts`, `airport-details.int.test.ts`
- `apps/worker/src/jobs/weather.ts`, `packages/providers/src/weather/aviationweather.ts` (açıklamalar); `weather.test.ts`, `jobs.int.test.ts`, `aviationweather.test.ts`, `packages/providers/src/reference/reference.test.ts`
- `tools/fixtures/ourairports/airports.csv`, `runways.csv`, `tools/fixtures/README.md`, `scripts/make-reference-fixtures.mts`

**Dizinler ve dosyalar (sayfalar ve testler):**
- `packages/i18n/src/messages/{tr,en}.ts`: liste (başlık, tablo başlığı, özet, ad kuralı cümlesi), sayfa açıklaması, `/hakkinda` (`shows.airports`, `method.abroad`); llms.txt bölüm başlığı aynı metinden
- `apps/web/src/`: `components/airports/airport-text.ts` ve `lib/weather.ts` (açıklamalar: 1.000 km, 225 sayfanın kayıt istekleri); `lib/test/ourairports-fixture.ts` (API'nin düzeltmeleri: `ourAirportsIcao`, ad boşluğu, gizli pistler)
- `apps/web/src/` testleri: `components/airports/airport-text.test.ts` (225, 75 + 89, Ben Gurion 500, ülkeler ve şehirler, 1.000 km), `airport-view.test.ts` (başlık, Arnavutluk/Albania, ad kuralı örnekleri, Kahire, Ben Gurion, Belgrad, Bingazi sayfaları), `airport-og.test.ts` (karakter örneklemi), `components/about/about-content.test.ts`, `app/llms.txt/route.test.ts`, `components/map/labels.test.ts` (z5'te 225 kod), `airport-popup-model.test.ts` (225 havalimanının yeri ve dilimi), `airport-popup.test.ts` (Kahire penceresi), `lib/seo/structured-data.test.ts`
- `e2e/`: `support.ts` (`RING1_AIRPORT_COUNT` 75, `RING2_AIRPORT_COUNT` 89, `FOREIGN_AIRPORT_COUNT` 164, `LISTED_AIRPORT_COUNT` 225, `INDEXABLE_LISTED_AIRPORT_COUNT` 220, `RING2_AIRPORT` HECA, `RING2_BOUNDARY_AIRPORT` LLBG, `RING_LIMITS_KM`), `tests/foreign-airports.spec.ts`, `tests/seo.spec.ts`, `tests/app.setup.ts`, `tests/airports.spec.ts` ve `tests/weather.spec.ts` (açıklamalar)
- Belgeler: D-088, `docs/spec/data-sources.md` §3 ve §5, `docs/RUNBOOK.md` (istek sayıları), `docs/ACTIVATION.md` ("M6g yayın doğrulaması")
- Birleştirmede: `apps/api/src/live/ws.ts` (`wsRateLimit`: üretim dışında dakikada 60 el sıkışması), `ws.test.ts`, `ws.int.test.ts`; `turbo.json` (`build` çıktılarından `.next/dev/**` hariç); `e2e/tests/weather.spec.ts` (açıklama)

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → halka sabitleri (2. halka açık), fixture'da 2. halka 89 ve 14 yeni ülke, 164 ad ve şehir kaydı, İngilizce ad kuralı (yalnız Bağdat ve Podgorica kısaltılmış), D-088 yazımları, HEAX → HEBA koşullu düzeltme, "Bosnia and Herzegovina", 164 havalimanının dilimi, `inForceTafs` ve özetin değişmemesi
- `pnpm --filter @havayolu/db test` ve `pnpm test:integration` → düzeltme, boşluk, gizli pist; 225 havalimanı, HEBA, Ben Gurion 500 km 2. halkada; API'de 61 + 164, HBE → HEBA, HEAX 404, Taba ve Cluj tek pist; worker istasyon listesi 225
- `pnpm --filter @havayolu/api test` → iki paketin ICAO kuralı aynı; toplu ve tek yanıtta aynı yürürlükteki TAF'lar, kayıtta hepsi; 225 istasyonun gövde bütçesi (1,8 MB en kötü, 1,2 MB tek TAF)
- `pnpm --filter @havayolu/worker test` ve `@havayolu/providers` → METAR 80 + 80 + 65, TAF 200 + 25, yayından sonra 89 yeni istasyon 15 istekte 24 saat
- `pnpm exec tsx scripts/make-reference-fixtures.mts <ham-klasör> <çıktı>` → commit'li iki OurAirports fixture'ıyla bayt bayt aynı
- `pnpm --filter @havayolu/web test` → fixture 225 (75 + 89, Ben Gurion 500/2. halka, HEBA, Taba ve Cluj tek pist); liste, `/hakkinda` ve llms.txt'te "Türkiye dışındaki havalimanları" ve "1.000 km", "yakın ülke"/"neighbouring" yok; ilk ülke Arnavutluk/Albania; Kahire (Mısır, Gazipaşa'ya bağlantı), Ben Gurion (Hatay, 500 km), Belgrad ve Bingazi (küçük alan) sayfaları; z5'te 225 kod örtüşmeden ve hızlı; pencerede 225 havalimanının yeri ve dilimi, Kahire'nin yaz ve kış saati; paylaşım görseli karakter örneklemi (33 görsel) ağsız
- `pnpm --filter @havayolu/i18n test`, `pnpm typecheck:e2e`, `pnpm lint:e2e`
- `pnpm test:e2e`:
  - kurulum: `/v1/airports?scope=listed` 225
  - API: `scope=listed` 61 + 164 (halka 1: 75, ≤ 500 km; halka 2: 89, 500–1.000 km), Kahire halka 2, Ben Gurion halka 2 ve 500 km, EGLL yok
  - `/havalimanlari` ve `/en/havalimanlari`: "Türkiye dışındaki havalimanları" / "Airports outside Türkiye" tablosu 164 satır, ülkeye göre sıralı; Kahire satırı (ad, Mısır/Egypt, 500 < km ≤ 1.000); ItemList 225
  - `/istasyon/HECA` ve `/en/istasyon/HECA`: ad, Mısır/Egypt, dizine eklenir, JSON-LD `addressCountry` EG, yerel saat Africa/Cairo; `/istasyon/cai` → 308
  - site haritası 450 adres (`/istasyon/HECA` dahil); llms.txt 220 havalimanı satırı, "## Türkiye dışındaki havalimanları / Airports outside Türkiye" başlığı altında Atina ve Kahire, "1.000 km" / "1,000 km", "yakın ülke"/"neighbouring" yok
  - harita: `?havalimani=HECA` Kahire'de açar; listeden açılan pencere Mısır'ı, Kahire'nin saatini ve sayfa bağlantısını gösterir
- `pnpm test:e2e` ve `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra `scope=listed` 225, İskenderiye'nin HEBA METAR'ı, istasyon sayısı 225, toplu hava gövdesinin boyutu (ACTIVATION → "M6g yayın doğrulaması")

**Çıktı kaydı (2026-10-04, veri ve backend; sürüm, changelog ve README yayın adımındadır):**
- Fixture: ham dosyalardan üretim commit'li `airports.csv` (601 satır) ve `runways.csv` (358 satır) ile bayt bayt aynı.
- Birim testleri: `@havayolu/shared` 616, `@havayolu/db` 47, `@havayolu/api` 254, `@havayolu/worker` 200, `@havayolu/providers` 121.
- Entegrasyon testleri: db 83, worker 12, api 26.
- `pnpm typecheck` (shared, db, api, worker, providers), `pnpm typecheck:scripts`, `pnpm lint` (aynı paketler), `pnpm check:eol` → yeşil.
- Sayfalar ve testler: birim testleri `@havayolu/web` 728, `@havayolu/i18n` 96; web ve i18n typecheck ve lint, `pnpm typecheck:e2e`, `pnpm lint:e2e` → yeşil. Paylaşım görseli testi 225 yerine 33 görsel çizer (~1,6 sn; hepsi ~9 sn sürerdi). e2e `ci:full`'da birleştirici çalıştırır.
- **Birleştirme (2026-10-04):** iki işin çakışan dosyası yoktu; sayılar her yerde 61 + 164 = 225 listelenen, 220 dizine eklenen sayfa, site haritası 450, llms.txt 220 satır. `docs/RUNBOOK.md`'deki saatlik istek sayısı (~28 → ~44) düzeltildi. İlk `ci:full`'da e2e 11 kırmızıydı: (1) web, 136 havalimanlı eski listeyi okuyordu: turbo'nun önbellekten geri yüklediği web derlemesi, Next 16 geliştirme sunucusunun veri önbelleğini (`.next/dev/cache/fetch-cache`) de geri yazıyordu; `turbo.json`'da `!.next/dev/**` (10 test). (2) `live-map.spec.ts`'te canlı veri kesildi ("Bağlantı koptu"): API günlüğünde `/v1/ws` 429, 60 sn'de 32 el sıkışması; geliştirme sunucusunda StrictMode her yüklemede iki el sıkışması açar, Kahire harita testi bütçeyi aştı; `wsRateLimit` üretim dışında 60 (D-088). **`pnpm db:migrate`** (0 yeni) ve **`pnpm ci:full` → yeşil:** birim testleri web 728, shared 616, api 255 (+1), worker 200, providers 121, i18n 96, tools 74, db 47, geo 36, scripts 33; entegrasyon db 83, api 26, worker 12; migration yükseltme 6 → 6; `compose:guard` 8 servis, 64 anahtar; E2E 116/116 (+3: Kahire sayfası TR ve EN, Kahire harita penceresi).

- **Yayın adımı (2026-10-04):** site künyesi dalı (`p1/attrib-version`, D-089) birleştirildi; gözden geçirmenin 6 bulgusunun hiçbiri doğrulanmadı (D-088 önbellek sınırı metni base64 ayrıntısıyla düzeltildi). **`pnpm ci:full` → yeşil:** birim testleri web 736, shared 616, api 255, worker 200, providers 121, i18n 96, tools 74, db 47, geo 36, scripts 33; entegrasyon db 83, api 26, worker 12; E2E 117/117. `pnpm stats` → 548 dosya, 100.712 satır (91.762 kod).

## M6e.4 — Yeniliklerde yayın saati (v0.17.1)
Onay: 2026-10-04 (kullanıcı isteği: "yeniliklerdeki yayın tarihine tarih ve saat ekle."; yama sürümü, D-082)

Hedef sürüm 0.17.1 (`main` `fb6e0cc` = v0.17.0'dan). Karar D-091'dedir.

**Kapsam:**
- `ChangelogEntry.releasedAt` (isteğe bağlı, ISO 8601 UTC); `date` kalır. Denetim: biçim, İstanbul'daki günü `date`, yeniden eskiye kesin azalan.
- Geriye dönük doldurma: v0.5.0 ve sonrası GitHub Release `publishedAt`; v0.1.0–v0.4.0 `main`'e giriş anı (release'leri sonradan toplu açıldı). v0.9.0 ve v0.4.0'ın günü düzeltildi.
- `/yenilikler` ve `/en/yenilikler`: "Yayın tarihi: 4 Ekim 2026, 20:27 (TSİ)" / "Released: 4 October 2026, 20:27 (UTC+3)", `<time datetime>` ISO anı. Yayın anı henüz yazılmamış çalışan sürümde web sunucusunun açılış anı, yayın anı olmayan diğer sürümlerde yalnızca gün.
- CHANGELOG.md başlığı ve GitHub Release notunun tarih satırı saati taşır ("2026-10-04 20:27 (UTC+3)").
- **Yayın adımı kuralı (D-091, bundan sonraki her sürüm):** yeni kayıt `releasedAt`'sız eklenir; aynı adımda önceki sürümün `releasedAt`'ı `gh release view v<önceki> --json publishedAt` ile yazılır, anın İstanbul'daki günü farklıysa `date` düzeltilir, `pnpm changelog` çalıştırılır. Birim testi en yeni sürüm dışında boş `releasedAt` bırakmaz.

**Dosyalar:**
- `packages/shared/src/changelog/`: `types.ts` (`releasedAt`), `entries.ts` (25 sürümün yayın anı, iki gün düzeltmesi), `index.ts` (`isReleasedAt`, `validateChangelog`, `releaseStamp`, markdown başlığı); `changelog.test.ts`
- `packages/shared/src/weather/time.ts` (`utcOffsetLabel`, i18n'in `formatUtcOffset`'i ve CHANGELOG.md ortak kullanır), `index.ts`; `time.test.ts`
- `packages/i18n/src/index.ts` (`formatReleaseTime`, `RELEASE_ZONE`), `weather.ts` (`formatUtcOffset` → `utcOffsetLabel`), `messages/{tr,en}.ts` (`changelog.releasedAtValue`); `i18n.test.ts`
- `apps/web/src/`: `app/yenilikler/page.tsx` (`connection()`, içerik bileşene taşındı), `components/changelog/changelog-content.tsx` (yeni), `components/changelog/release-time.ts` (yeni: `releaseTime`, `isoInstant`), `lib/server-start.ts` (yeni: `SERVER_STARTED_AT`); `components/changelog/changelog-content.test.ts` (yeni)
- `scripts/changelog.mts` (`releaseNotes` dışa açıldı, ana işlev koruması), `scripts/changelog.test.mts` (yeni); `CHANGELOG.md` (yeniden üretildi)
- `e2e/tests/changelog.spec.ts` (yeni)
- `docs/DECISIONS.md` (D-091)

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → `releasedAt` biçimi (salise, ofset, 31 Eylül, 24:00 reddedilir), İstanbul günü (21:00Z sınırı), kesin azalan sıra, gerçek veride en yeni dışında boş yok, v0.17.0/v0.9.0/v0.4.0/v0.1.0 değerleri, `releaseStamp`, markdown başlığı; `utcOffsetLabel`
- `pnpm --filter @havayolu/i18n test` → `formatReleaseTime` TR/EN, gece yarısı sonrası gün, 00:00, geçersiz an "—"; yer tutucu eşliği
- `pnpm --filter @havayolu/web test` → `releaseTime` üç kaynak (yayın anı, sunucu açılışı yalnızca çalışan sürümde, yalnızca gün), `<time dateTime>` ve metin TR/EN, "Güncel sürüm" yalnızca çalışan sürümde, gerçek changelog'un her sürümünde saat
- `pnpm test:scripts` → CHANGELOG.md kaynağından üretilmiş hâliyle aynı, başlıklarda saat, `--check` geçer, release notunun başlığı aynı ve tarih satırı saatli, `--release 0.17.0` ve bilinmeyen sürüm
- `pnpm changelog:check`, `pnpm typecheck`, `pnpm typecheck:scripts`, `pnpm lint`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`
- `pnpm test:e2e` → `changelog.spec.ts`: v0.17.0 "4 Ekim 2026, 20:27 (TSİ)" / "4 October 2026, 20:27 (UTC+3)", v0.11.0 "2 Ekim 2026, 02:17 (TSİ)", her kartta tek `<time>`, ISO anı ile metin aynı an, çalışan sürümün anı geçmişte ve yeniden yüklemede sabit
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil

**Çıktı kaydı (2026-10-04, uygulama; sürüm, v0.17.1 kaydı ve README yayın adımındadır):**
- Yayın anları `gh release list` (2026-10-04) ve `git log --first-parent origin/main -- package.json` ile doğrulandı; tablo D-091'de.
- Birim testleri: `@havayolu/shared` 624 (+8), `@havayolu/i18n` 97 (+1), `@havayolu/web` 745 (+9), `pnpm test:scripts` 39 (+6).
- `pnpm changelog` (25 sürüm) ve `pnpm changelog:check`, `pnpm typecheck` (9/9), `pnpm typecheck:scripts`, `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol` → yeşil.
- `pnpm test:e2e changelog language` → 18/18 (kurulum 4, `changelog.spec.ts` 3, `language.spec.ts` 11).
- `pnpm dev` önizlemesi: v0.17.0'ın `releasedAt`'ı geçici olarak silinince kart sunucunun açılış anını gösterdi ("4 Ekim 2026, 20:58 (TSİ)", `datetime` 17:58:06Z; ilk istekten ~8 sn önce, TR ve EN'de ve yeniden yüklemede aynı); geri konunca "4 Ekim 2026, 20:27 (TSİ)". Hidrasyon uyarısı yok.

- **Yayın adımı (2026-10-04):** Türkçe dilim etiketi "TSİ" yerine açık "Türkiye saati" (web-ui kuralı: sade görünümde kısaltma yok). Bağımsız denetim: 25 sürümün saati GitHub kayıtlarıyla birebir, 8 mutasyonun hepsi yakalandı. **`pnpm ci:full` → yeşil:** birim testleri web 745, shared 624, api 255, worker 200, providers 121, i18n 97, tools 74, db 47, geo 36, scripts 39; entegrasyon db 83, api 26, worker 12; E2E 120/120. `pnpm stats` → 554 dosya, 101.595 satır (92.544 kod).

## M6e.5 — Ülke sınırları (v0.17.2)
Onay: 2026-10-04 (kullanıcı isteği: "haritada ülke sınırları kesikli kesikli çizgilerle belirgin olmalı."; yama sürümü, D-082)

Hedef sürüm 0.17.2 (`main` `fb6e0cc` = v0.17.0'dan; v0.17.1 ayrı yamadadır). Karar D-092'dedir.

**Kapsam:**
- **Uydu:** Esri görüntüsünün üstüne OpenFreeMap'in vektör karolarından (TileJSON `https://tiles.openfreemap.org/planet`, kaynak `hy-country-borders`, `maxzoom` 10) kesikli ülke sınırları. Katman `boundary`; süzgeç `admin_level = 2`, `maritime ≠ 1`, `claimed_by` yok.
- **Görünüm:** beyaz kesikli çizgi (`[2, 3]` yuvarlak uçla, görünen 3:2; z3 1 px → z10+ 2,25 px), altında #0B2A33 0,6 saydamlıkta düz kenar (çizgiden 2–2,5 px geniş). Tartışmalı sınır (`disputed = 1`) aynı renk ve kenarla noktalı. Her yakınlaştırmada; görüntünün üstünde, pin, iz ve uçakların altında.
- **Koyu stil** (uydunun yedeği ve anahtarsız altlık): indirilen stilin `boundary` çizgi katmanları (ülke ve il) çıkar, aynı üç katman stilin kaynağıyla ilk sınır katmanının yerine (yer adlarının altına) girer.
- **Yerel test stili:** dokunulmaz; sınır kaynağı yok, dış istek yok.
- **Atıf:** sınırlar çizilirken şeritte "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" (sınır kaynağının atfı); künye ilk sırada (D-089), Esri ve ADSB.lol metinleri değişmez. `/hakkinda` ve `/kullanim-kosullari` harita kaynağı cümleleri uydudaki sınırları da anar.
- **Hata:** sınır kaynağının TileJSON ve karo hataları altlık zincirine sayılmaz; OpenFreeMap kesintisinde uydu kalır.

**Dosyalar:**
- `packages/shared/src/map/borders.ts` (yeni: kaynak ve katman kimlikleri, `COUNTRY_BORDER_FILTER`, kesikler, kalınlıklar, `countryBorderLayers`, `countryBorderSource`, `COUNTRY_BORDER_SOURCE_MAX_ZOOM`), `layers.ts` (tipler: `source-layer`, `filter`, `line-dasharray`, süzgeç ifadeleri), `colors.ts` (`border`, `borderCasing`), `index.ts`; `borders.test.ts`
- `apps/web/src/lib/map-config.ts` (`OPENFREEMAP_TILEJSON_URL`, `CountryBorders`, uydu altlığında `countryBorders`); `map-config.test.ts`
- `apps/web/src/components/map/basemap.ts` (`satelliteStyle(…, borders)`, `withCountryBorders`, `prepareFetchedStyle`, `BasemapStep.countryBorders`, `NON_BASEMAP_SOURCES`), `map-controller.ts` (hazırlık ve hata kaynağı kuralı); `basemap.test.ts`, `attribution.test.ts` (şerit sırası)
- `packages/i18n/src/messages/{tr,en}.ts` (`about.sources.vector`, `terms.map.vector`)
- `packages/providers/src/license.ts` (açıklama), `license.test.ts`
- `e2e/tests/live-map.spec.ts` (yerel stilde sınır kaynağı ve OpenFreeMap isteği yok, atıfta OSM yok)
- Belgeler: D-092, `docs/spec/data-sources.md` §6 (sınır katmanı, istek hacmi, 7 alanlı lisans kaydı), `docs/REFERENCES.md` (OpenFreeMap ve OpenMapTiles belgeleri), `ATTRIBUTION.md`, `docs/ACTIVATION.md` ("M6e.5 yayın doğrulaması")

**Kabul komutları:**
- `pnpm --filter @havayolu/shared test` → katman sırası ve kimlikler, süzgeç (kara/deniz/il/iddia/tartışmalı), görünen kesik 3:2 ve nokta, kenar ≥ 2 px geniş ve yarı saydam, kalınlık z3 1 px → z10+ 2–2,5 px, kaynak `maxzoom` 10
- `pnpm --filter @havayolu/web test` → uydu stilinde sınır kaynağı (TileJSON, z10, atıf) ve katmanlar görüntünün üstünde, canlı katmanların altında; OSM atfı yalnızca sınırlar açıkken; adım bayrakları (uydu ve vektör açık, yerel ve düz kapalı); koyu stilde `boundary` katmanlarının yerine aynı katmanlar; test stili ve Protomaps şeması değişmez; sınır kaynağının hataları uyduyu değiştirmez; yapılandırmada TileJSON adresi; MapLibre'nin uzunluk sıralamasıyla şerit iki dilde de Esri, OpenFreeMap, canlı veri (koyu stilde OpenFreeMap, canlı veri)
- `pnpm --filter @havayolu/providers test`, `pnpm --filter @havayolu/i18n test`
- `pnpm typecheck`, `pnpm lint`, `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol`
- `pnpm test:e2e` → `live-map.spec.ts` ilk test: `/test-style.json` istendi, OpenFreeMap/`.pbf`/`/planet` isteği yok, atıfta OpenStreetMap ve OpenMapTiles yok
- `pnpm ci:full` yeşil; PR'da CI (`e2e` dahil) yeşil
- **Kullanıcıya bağlı (`[k]`):** yayından sonra üretimde sınırların görünümü, atıf şeridi, istek ve bayt hacmi (ACTIVATION → "M6e.5 yayın doğrulaması")

**Çıktı kaydı (2026-10-04, uygulama; sürüm, changelog ve README yayın adımındadır; e2e ve `ci:full` bu adımda çalıştırılmadı, sunucu açılmadı):**
- Birim testleri: `@havayolu/shared` 625 (+9, `borders.test.ts`), `@havayolu/web` 748 (+12: `basemap.test.ts` +10, `map-config.test.ts` +1, `attribution.test.ts` +1: şerit sırası iki dilde), `@havayolu/providers` 122 (+1), `@havayolu/i18n` 96.
- Stil denetimi (geçici betik, MapLibre style-spec 26.4.4 `validateStyleMin`): sınırlı uydu stili, sınırları çevrilmiş koyu stil ve düz stil 0 hata. Süzgeçler aynı kütüphanenin `featureFilter`'ıyla: kara sınırı (`maritime` 0 ya da yok) kenar + kesikli; tartışmalı kenar + noktalı; deniz, il ve `claimed_by` çizgisi hiçbir katmanda.
- `pnpm typecheck` (9/9), `pnpm lint` (9/9), `pnpm typecheck:e2e`, `pnpm lint:e2e`, `pnpm format`, `pnpm check:eol` → yeşil.

## M7 — Canlı araçlar ve kapsama raporu
Ayrıntılar `docs/prompts/parca-1.md`'dedir. Başlarken bu dosyaya dizinler ve kabul komutları eklenir.
