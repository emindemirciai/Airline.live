# Parça 1 planı — canlı ilerleme dosyası

Kaynak: `docs/prompts/parca-1.md`. Her kilometre taşı ayrı dal ve PR'dır.

Onay: 2026-09-25 (kullanıcı: "Proje + Parça 1'e başla")

Durumlar: `[ ]` başlamadı, `[~]` sürüyor, `[k]` kod bitti ve kullanıcı doğrulaması bekliyor, `[x]` tamam.

| # | Kilometre taşı | Dal | Durum | Birleşen PR |
|---|---|---|---|---|
| M0 | Repo iskeleti, yerel test ortamı, Durum ve Yenilikler | `p1/m0-skeleton` | [x] | #1 |
| M1a | İmajlar, bütün servisler, yönetici oturumu, admin Servisler paneli | `p1/m1a-images` | [k] birleşti; üretimde çalıştığının doğrulanması M1b yayınıyla | #2 |
| — | Marka geçişi: havayolu · havayolu.live (D-059) | `chore/havayolu-marka` | [x] | #3 |
| — | Birleştirme öncesi inceleme düzeltmeleri, açık repo ve `main` koruması (D-060…D-063) | `p1/m1a-hardening` | [x] | #4 |
| M1b | Yayın hattı (CI, deploy, rollback, DEPLOY_DOKPLOY.md) | `p1/m1b-deploy` | [k] kod bitti; ilk gerçek yayın kullanıcının Dokploy kurulumuna bağlı (ACTIVATION) | #6 |
| M2 | Veritabanı ve referans verisi | `p1/m2-db` | [x] | #7 |
| M3 | Sağlayıcılar | `p1/m3-providers` | [ ] | — |
| M4 | Ingest, replay ve senaryo araçları | `p1/m4-ingest` | [ ] | — |
| M5 | Canlı API | `p1/m5-live-api` | [ ] | — |
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

## M3–M7
Ayrıntılar `docs/prompts/parca-1.md`'dedir. Her kilometre taşına başlarken bu dosyaya dizinler ve kabul komutları eklenir.
