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
| M6e.1 | Pencere hizası (yama) | `p1/m6e1-popup-align` | [k] kod bitti; üretimde pencerenin görülmesi bekliyor | #19 |
| M6f | Adlar ve saat: askerî ve sivil havalimanı adları TR/EN, haritada havalimanı adı etiketi, yurt dışında yerel saat ve UTC farkı | `p1/m6f-names-time` | [ ] | — |
| M6g | Türkiye dışındaki havalimanları, 2. halka (≤ 1.000 km) | `p1/m6g-ring2` | [ ] | — |
| M7a | Canlı araçlar: `smoke:live`, `record` | `p1/m7a-live-tools` | [ ] | — |
| M6h | 3. halka (≤ 2.000 km) | `p1/m6h-ring3` | [ ] | — |
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

## M7 — Canlı araçlar ve kapsama raporu
Ayrıntılar `docs/prompts/parca-1.md`'dedir. Başlarken bu dosyaya dizinler ve kabul komutları eklenir.
