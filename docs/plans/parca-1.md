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
| M5 | Canlı API | `p1/m5-live-api` | [k] kod bitti; üretimde 5 dk boşta WS bağlantısı kullanıcı doğrulaması bekliyor | #13 |
| M6 | Web canlı harita | `p1/m6-map` | [ ] | — |
| M7 | Canlı araçlar ve kapsama raporu | `p1/m7-tools` | [ ] | — |

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
  - `plan.ts` (kapsama planı ve istek zamanlayıcı)
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
- **Kullanıcıya bağlı (`[k]`):** `wss://api.havayolu.live/v1/ws` üzerinden 5 dk boşta bağlantı kopmaz.

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

## M6–M7
Ayrıntılar `docs/prompts/parca-1.md`'dedir. Her kilometre taşına başlarken bu dosyaya dizinler ve kabul komutları eklenir.
