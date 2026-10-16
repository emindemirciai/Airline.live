# Parça 1 — Yayın hattı, tüm servisler, canlı veri ve harita

**Başlatma:** Claude Code'da `@docs/prompts/parca-1.md dosyasındaki Parça 1'e başla` yaz.
**Önce oku:** `docs/spec/infra.md`, `docs/spec/data-sources.md`, `docs/spec/domain.md` (terimler, birimler, uçuş kaydı, Saklama). CLAUDE.md zaten yüklüdür.

## Hedef
1. **Yayın hattı:** Ajan kilometre taşını bitirir, PR açar, CI yeşilse birleştirir. İmajlar GHCR'a gider, Dokploy yayına alır ve workflow yayını doğrular.
2. **Tüm servisler tek seferde:** Üretimde bütün servisler ilk yayından itibaren tanımlıdır. Kullanıcı Dokploy'u, domain'leri ve env'leri **bir kez** kurar; sonraki parçalar yalnızca kod ekler. Bu projenin servisleri: web, API (WS), admin (ayrı domain, aynı web konteyneri), iki worker, migrate, Postgres, iki Redis. Analiz, kullanıcının kendi uygulamasıyla (Siteni Analiz Et) ayrı bir Dokploy uygulaması olarak aynı kurulumda bağlanır.
3. **Canlı harita:** `https://WEB_HOST` açıldığında Türkiye üzerindeki canlı uçaklar haritada hareket eder. Bir uçak aranıp bulunur, harita onu ortalar ve uçağın bağlantısı paylaşılabilir.
4. **Kapsama ölçümü:** adsb.lol'ün IST çevresindeki gerçek kapsaması üretim verisinden ölçülür ve Parça 2'ye girdi olur.

Hesaplar, olay motoru ve bildirimler sonraki parçalarda gelir. Bu parçada onlar için kullanıcıya görünen ekran, buton ya da boş sayfa eklenmez.

## Kilometre taşları
Her kilometre taşı ayrı bir dal ve PR'dır (CLAUDE.md → Git ve yayın). Planı `docs/plans/parca-1.md`'ye bu başlıklarla yaz ve onay al.

### M0 — Repo iskeleti ve yerel test ortamı (`p1/m0-skeleton`)
- **Monorepo:** pnpm workspaces + Turborepo. Görevler: `dev`, `lint`, `typecheck`, `test`, `build`. Kök script'ler: `ci:local` (format + lint + typecheck + test + build), `ci:full`, `check:eol`, `changelog`, `changelog:check`, `stats`, `backup`.
- **Lint ve format:** Ortak ESLint, Prettier ve tsconfig (`strict`, `noUncheckedIndexedAccess`). ESLint kuralları: `no-warning-comments: error`, `--max-warnings 0` ve üretim kodundan `tools/`, fixture ya da test import'unu yasaklayan `no-restricted-imports`.
- **Windows:** `.gitattributes`, `.gitignore` ve `README.md` zaten repodadır; yeniden yazma. `pnpm-workspace.yaml` içinde `shellEmulator: true` ve `allowBuilds`. Script'ler kabuktan bağımsızdır.
- **Paketler:** Gerçek içerikle başlayanlar: `packages/shared` (locale, changelog, yol haritası), `i18n` (tr/en), `geo` (mesafe/yön/birim), `providers` (lisans kaydı). `engine` ve `db` ilk kullanıldıkları kilometre taşında oluşturulur; boş paket açılmaz.
- **`apps/api`:** Fastify; `/health` ve `/version`; zod env doğrulaması; düzgün kapanış.
- **`apps/web`:** Next.js. İki gerçek sayfa vardır; kök `/`, harita gelene kadar (M6) `/durum`'a yönlenir.
  - `/durum`: uygulama sürümü, `GIT_SHA`, API sağlık durumu, yol haritası ilerlemesi.
  - `/yenilikler`: changelog kaynağından TR/EN sürüm notları ve "Dene →" bağlantıları.

  TR/EN geçişi çerezle çalışır.
- **Env:** Kökte açıklamalı `.env.example` bulunur. **Bütün parçaların** değişkenleri burada gruplu olarak baştan yer alır (hangi parçada kullanıldığı yazılır). Sonraki parçaların değişkenleri o parçaya kadar zod'da opsiyoneldir; kullanıcı Dokploy'a env'leri bir kez girer. Yerel portlar CLAUDE.md'deki gibidir: web 3100, api 4100.
- **`.claude/launch.json`:** Web dev sunucusunu tanımlar (port 3100).
- **`LICENSE`:** MIT (kod). Veri kendi lisansındadır (adsb.lol ODbL); README'de belirtilir. Her `package.json`'da `"license": "MIT"` yazar.
- **`.github/workflows/ci.yml`:** `checks` işi (format, lint, typecheck, test, build, `changelog:check`, `check:eol`), pnpm cache, PR'da iptal edilebilir.
- **Kabul:**
  - `pnpm install --frozen-lockfile` ve `pnpm ci:local` yeşil. `pnpm check:eol` yeşil.
  - `pnpm dev` ile `http://localhost:3100/yenilikler` ve `/durum` açılır; `/durum` API'yi "Çalışıyor" gösterir; TR/EN geçişi çalışır.
  - `pnpm stats` ve `pnpm backup` çalışır.

### M1a — İmajlar ve bütün servislerle yerel üretim compose'u (`p1/m1a-images`)
- **`packages/db`:** İlk migration `CREATE EXTENSION IF NOT EXISTS postgis;`'tir (drizzle `meta/_journal.json` dahil).
- **`apps/api`:**
  - Uç noktalar: `/ready` (DB + iki Redis), `/version`.
  - Altyapı: güvenlik başlıkları, `WEB_HOST`/`ADMIN_HOST` için CORS izin listesi, pino (redact), OpenAPI, `trustProxy` (infra.md).
- **`apps/worker`:** Sabit dizin düzeni `src/{ingest,engine,notifier,jobs}/`; `WORKER_ROLE` ayrıştırma; sağlık uç noktası (4200). Her rol modülü kendi işlerini kaydeder; bu kilometre taşında `jobs` rolü yalnızca kendi sağlık heartbeat'ini `redis-queue`'ya yazar. Bu, admin servis panelinin gerçek verisidir.
- **Yönetici oturumu (platform-admin sözleşmesi, `docs/spec/infra.md` → "Analiz"):**
  - `POST /api/auth/login` `{email, password}` → `{token}`. Bu parçada yalnızca `ADMIN_EMAIL` + `ADMIN_SETUP_TOKEN` kabul edilir (sabit zamanlı karşılaştırma, IP başına dakikada en fazla 5 deneme). Parça 2B'de gerçek admin hesabına bağlanır; sözleşme değişmez.
  - `GET /api/admin/session` (`Authorization: Bearer`): token geçerliyse 200, değilse 401.
  - `GET /api/auth/me`: `{user: {email, role: "ADMIN"}}` döndürür.
  - Token opak ve rastgeledir, `redis-queue`'da hash'li saklanır, 7 gün geçerlidir ve iptal edilebilir. Token loglanmaz. Env yoksa giriş kapalıdır.
  - Kendi admin panelimiz de, senin analiz uygulaman (Siteni Analiz Et) da aynı yönetici hesabıyla giriş yapar.
- **Admin host:** `hy-web`, `ADMIN_HOST` üzerinden gelen istekleri `/admin` altına yönlendirir (Next.js `proxy`); aynı konteyner, ayrı domain.
  - Giriş formu yukarıdaki API sözleşmesini kullanır; token web tarafında httpOnly/Secure çerezde tutulur.
  - İlk admin sayfası **Servisler**'dir. Gösterilenler:
    - web, api
    - worker-rt, worker-bg (heartbeat yaşı)
    - Postgres, iki Redis (bellek kullanımı ve maxmemory)
    - analiz uygulaması (`ANALYZE_URL/api/health`)

    Her birinin durumu, sürümü ve son kontrol zamanı listelenir.
- **Analiz (kullanıcının kendi uygulaması: `emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-`, MIT):**
  - Bu projenin compose'una **girmez**. Kendi README'sindeki modele göre ayrı bir Dokploy Compose uygulaması olarak `ANALYZE_HOST`'ta çalışır. Env bloğu `deploy/analiz.env.example`'da hazırdır (D-060):
    - `ANALYZE_AUTH_MODE=platform-admin`, `ANALYZE_AUTH_API_URL=https://${API_HOST}`
    - `ANALYZE_ALLOWED_ORIGINS=https://${WEB_HOST}`, `ANALYZE_EVENT_SITES=${WEB_HOST}`
    - `ANALYZE_GEO_LOOKUP=false`: açık kalırsa ziyaretçi IP'leri `ipwho.is` ve `ip-api.com`'a gider; ip-api'nin ücretsiz katmanı ticari kullanıma kapalıdır ve HTTP'dir. Konum yalnızca `cf-ipcountry` başlığından gelir.
  - Web, takip script'ini (`<script defer src="${ANALYZE_URL}/api/tracker" data-site="${ANALYZE_SITE_ID}">`) yalnızca `ANALYZE_URL` ve `ANALYZE_SITE_ID` tanımlıysa **ve kullanıcı analiz için onay verdiyse** yükler. Script `localStorage`'da kalıcı ziyaretçi kimliği tuttuğu için KVKK Çerez Rehberi gereği rıza aranır.
  - Onay bandı sade tutulur: "Kabul et" ve "Reddet" eşit ağırlıktadır; tercih `/gizlilik`'ten değiştirilebilir. Hukuki inceleme ACTIVATION'dadır.
  - CSP'ye analiz host'u `script-src` ve `connect-src` için eklenir.
- **Docker dosyaları:** Dockerfile'lar, `docker-compose.yml` (üretim, yalnızca image), `docker-compose.build.yml`, `docker-compose.dev.yml` ve `hy-migrate`; tamamı infra.md'ye göre.
- **Kabul:**
  - `docker info` → `docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --wait --wait-timeout 300` ile tüm servisler healthy olur.
  - `curl` ile `/ready` 200 döner ve `/api/version` doğru `GIT_SHA`'yı gösterir.
  - Sözleşme testi: `POST /api/auth/login` doğru bilgiyle `{token}` döndürür; yanlış bilgide 401, 6. denemede 429 gelir. `/api/admin/session` geçerli token'da 200, geçersizde 401 döner. Bu testler analiz uygulamasının `platformAuth.ts` davranışına göre yazılır: token alanı, 404/405'te sonraki uç noktaya geçiş.
  - Onay verilmeden takip script'i yüklenmez (E2E).
  - `docker compose down` + `up -d --wait` sonrası seed korunur; `docker volume ls`'te isimsiz postgres volume'u yoktur.

### M1b — Yayın hattı (`p1/m1b-deploy`)
- **CI:** `ci.yml` tamamlanır: `changes`, `checks`, `compose-guard`, `actionlint`, `deploy` (infra.md). Henüz test olmayan `test-integration` ve `e2e` işleri, testler geldiği kilometre taşında açılır.
- **Deploy script'i:** `deploy.yml` ve `rollback.yml` (infra.md sözleşmesi) ile `scripts/deploy-dokploy.mts` yazılır. Stub testleri (sahte saat) geçer:
  - `freshVolumes` asla gönderilmez
  - deployment `error` → çıkış 1
  - `/version` 15 dk eski SHA → çıkış 1
  - `/ready` 503 → çıkış 1
  - başarı → çıkış 0
- **`docs/DEPLOY_DOKPLOY.md`** — kullanıcının **bir kez** izleyeceği adımlar, sırayla:
  1. **Dokploy:** ≥ v0.30.7'ye yükselt. Panele HTTPS domain bağla, 3000 portunu `ufw-docker` ile kapat (doğrulama: başka ağdan `curl -m 5 http://<IP>:3000` zaman aşımı). Let's Encrypt e-postasını gir.
  2. **Bellek:** `docker stats` ile mevcut kullanımı kontrol et; swap ve `vm.overcommit_memory` ayarlarını değerlendir (infra.md bütçesi).
  3. **GitHub bağlantısı:** GitHub sağlayıcısını bağla. Compose servisi oluştur: repo `emindemirciai/havayolu`, dal `main`, dosya `./docker-compose.yml`.
     - **Autodeploy'u açıkça KAPAT** (varsayılanı açıktır).
     - Advanced → Isolated Deployments kapalı kalır.
     - "Create env file" açık kalır.
  4. **Registry:** `ghcr.io` + classic PAT (`read:packages`).
  5. **Environment:** `deploy/dokploy.env.example` bloğunu gir (sırları doldurarak); sonraki parçaların değişkenleri boş kalabilir. `.env.example` **olduğu gibi kopyalanmaz** (D-060): içindeki `*_dev_only` parolalar, localhost host'ları ve `EXTERNAL_PROVIDERS_DISABLED=true` yereldir. `GIT_SHA` ve `BUILD_TIME` imaja gömülür, Dokploy'a girilmez. Sırları (`ADMIN_SETUP_TOKEN`, DB ve Redis parolaları) parola yöneticisinde üret; yalnızca `[A-Za-z0-9_-]` karakterlerini kullan.
  6. **Host'lar:** 4 host belirlenir: `WEB_HOST`, `API_HOST`, `ADMIN_HOST`, `ANALYZE_HOST`.
     - Değerler: `WEB_HOST=havayolu.live`, `API_HOST=api.havayolu.live`, `ADMIN_HOST=admin.havayolu.live`, analiz `analiz.havayolu.live`; ayrıca `www.havayolu.live` (web köke yönlendirir).
     - DNS A kayıtları VPS IP'sine yönlenir.
     - Cloudflare proxy kullanılırsa SSL modu "Full (Strict)" olur ve `EDGE_PROXY=cloudflare` girilir.
  7. **Domain'ler (Dokploy):**
     - `hy-web` → `havayolu.live`, `www.havayolu.live` ve `admin.havayolu.live` (port 3000)
     - `hy-api` → `api.havayolu.live` (port 4000)

     Hepsinde HTTPS + Let's Encrypt açıktır. Domain değişikliğinden sonra yeniden deploy edilir.
     - **2026-10-15 (D-112):** güncel değerler `airline.live`, `www.airline.live`, `api.airline.live`, `admin.airline.live`, `analiz.airline.live`; yukarıdaki dört havayolu.live alan adı 308'ler için Dokploy'da bağlı kalır (ACTIVATION → "Marka geçişi: Airline.live", DEPLOY_DOKPLOY.md §6). `POSTGRES_DB`/`POSTGRES_USER` iç addır ve değişmez.
  7b. **Analiz uygulaması:** Aynı Dokploy projesinde ikinci bir Compose uygulaması oluşturulur (kendi README'sindeki gibi): repo `emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-`, servis `analyze`, port 3000, domain `ANALYZE_HOST`. Env bloğu `deploy/analiz.env.example`'da bu projenin değerleriyle hazırdır:
      - `ANALYZE_SITE_ID=${WEB_HOST}`
      - `ANALYZE_AUTH_MODE=platform-admin`, `ANALYZE_AUTH_API_URL=https://${API_HOST}`
      - `ANALYZE_ALLOWED_ORIGINS=https://${WEB_HOST}`, `ANALYZE_EVENT_SITES=${WEB_HOST}`
      - `ANALYZE_GEO_LOOKUP=false`

      Bu uygulama Dokploy'da kaynaktan derlenir (kendi repo modeli). Build sırasında VPS'te kısa bir CPU/RAM artışı olur; çalışırken ~150–250 MB kullanır (host bütçesine eklenir).
  8. **API token:** Mümkünse yalnızca bu projeye erişimi olan bir "deploy-bot" üyesiyle, 90 gün süreli üretilir. Kapsamı doğrulanır (infra.md → Güvenlik).
  9. **GitHub:** Settings → Secrets and variables → Actions.
     - Secrets: `DOKPLOY_URL`, `DOKPLOY_API_TOKEN`, `DOKPLOY_COMPOSE_ID` (servis URL'sinden alınır).
     - Variables: `WEB_URL`, `API_URL`, `DEPLOY_ENABLED=false`.
     - Repo herkese açıktır ve `main` kural setiyle korunur (D-061). Fork PR'larına secrets verilmez.
  10. **Deneme:** `gh workflow run deploy.yml -f dry_run=true` ile imajlar derlenir. Sonra `DEPLOY_ENABLED=true` yapılır ve ilk yayın yapılır.
  11. **Doğrulama listesi:**
      - `curl ${API_URL}/version`
      - `${WEB_URL}/durum`
      - `${ADMIN_URL}` giriş ekranı ve Servisler paneli
      - `${ANALYZE_URL}/login` → yönetici hesabıyla giriş (platform-admin), `/api/health` 200
  12. **Not:** "Deploy sırasında birkaç saniyelik kesinti olur."
- **DUR:** Kullanıcı DEPLOY_DOKPLOY.md adımlarını uygulayana kadar deploy `DEPLOY_ENABLED=false` ile temiz biçimde atlanır; CI yeşil kalır. Ajan Dokploy API'sini kendisi çağırmaz. Kilometre taşı `[k]` olur ve M2'ye geçilir.
- **Kabul:**
  - Stub testleri yeşil; `actionlint` yeşil; PR'daki CI yeşil.
  - Kullanıcı kurulumu bitirdikten sonra: bir PR birleşir → deploy işi yeşil biter → `${WEB_URL}/api/version` yeni `GIT_SHA`'yı gösterir. Toplam süre rapora yazılır (hedef ≤ 20 dk).

### M2 — Veritabanı ve referans verisi (`p1/m2-db`)
- **Drizzle:** Drizzle + drizzle-kit kullanılır. Partition'lı tablolar infra.md → "Migration" bölümündeki yöntemle kurulur.
- **Tablolar:**
  - `airports`
  - `runways`: eşik koordinatları (kaydırılmış eşik dahil), gerçek yön, uzunluk, `threshold_source`
  - `stations`: etkin istasyonlar, `is_primary`, yaklaşma ayarları, `geoid_undulation_m`, `coverage_ground_ratio_7d`
  - `airlines`: VRS `airlines.csv`'den ICAO, IATA, ad; admin düzeltme tablosu
  - `flights`: uçuş kaydı (hex, çağrı kodu, tescil, tip, ilk/son görülme, durum)
  - `track_points_sampled` ve `track_points_fine`: `PARTITION BY RANGE (ts)`, günlük, PK `(flight_id, ts)`, ts üzerinde BRIN. Tipler: lat/lon `double precision`, gs/track `real`, irtifa ve dikey hız `integer`, source `smallint`. Geometry sütunu **yoktur**.
  - `provider_health`
- **Partition bakımı:** `jobs` rolünde BullMQ `upsertJobScheduler` kullanılır (`repeat` BullMQ v6'da kaldırıldı). Çalışma kuralları infra.md'dedir; saklama süreleri `TRACK_SAMPLED_RETENTION_DAYS` (7) ve `TRACK_FINE_RETENTION_DAYS` (30) env'lerinden gelir.
- **Seed:** idempotenttir; 5 istasyon eklenir, IST birincil olur.
- **Referans verisi:** OurAirports ve VRS `airlines.csv` ilk açılışta ve sonra günlük içe aktarılır (data-sources.md §3–4). `EXTERNAL_PROVIDERS_DISABLED` iken ve testte `tools/fixtures/` altındaki commit'li alt kümeler kullanılır.
- **Kabul:**
  - Temiz DB'de migrate çalışır; ardından `drizzle-kit generate` boş fark üretir. Yükseltme testi geçer.
  - Seed iki kez çalışınca kayıt yinelenmez.
  - Partition job integration testi (gerçek PostgreSQL, sahte saat, DEFAULT partition'lı şema) süresi dolan partition'ı siler ve 7 gün ilerisini açar.
  - LTFM fixture'ından her pist için:
    - eşikler arası mesafe = `length_ft × 0,3048` − kaydırmalar (±50 m)
    - eşikten eşiğe yön = `le_heading_degT` (±1°)
    - kaydırılmış eşik ham noktadan `displaced_threshold_ft × 0,3048` m (±1 m) uzakta

### M3 — Sağlayıcılar (`p1/m3-providers`)
- **`AircraftState` iç modeli:**
  - Kimlik: hex, callsign, registration, typeCode, category, dbFlags, positionSource
  - Konum: lat, lon, altBaroFt | null, onGround, altGeomFt, navQnhHpa
  - Hareket: gsKt, trackDeg, trueHeadingDeg, baroRateFpm, geomRateFpm
  - Uzman alanları: iasKt, tasKt, mach, windDirDeg, windSpeedKt, oatC, selAltFt, navModes
  - Durum: squawk, emergency
  - Meta: sampleTime (UTC ms), source
- **Ayrıştırıcı:** data-sources.md §1'deki "yanıt biçimi" kurallarının hepsini uygular. zod'da her alan opsiyoneldir.
- **`adsbLol` adaptörü:**
  - Sorgular: nokta/yarıçap, çoklu hex, çağrı kodu, tescil.
  - Zorunlu User-Agent gönderir (data-sources.md biçimi); opsiyonel API anahtarı başlığı desteklenir.
  - Durum kodu JSON ayrıştırmadan önce kontrol edilir. 401/403, 429/420 ve 5xx ayrı hata türleridir. gzip açıktır.
- **`localReceiver` adaptörü:** `LOCAL_RECEIVER_URLS` listesi, opsiyonel token, alıcı başına sağlık metriği.
- **Lisans ve temizlik:**
  - Lisans kaydında 7 alan bulunur (data-sources.md). `DATA_USAGE_MODE` denetimi yapılır.
  - Temizlik: geçersiz ya da eksik konum, 60 sn'den eski örnek ve imkânsız değerler (gs > 800 kt, |dikey hız| > 10.000 fpm) atılır.
- **`ScheduleProvider`:** yalnızca tip arayüzüdür (`resolveFlightNumber`, `getStationBoard`, lisans meta verisi).
- **Fixture'lar:** `tools/fixtures/adsblol/` altına gerçek birkaç yanıt örneği konur. **DUR:** `CONTACT_EMAIL` yoksa sor. Fixture'ları en fazla 5 istekle, istekler arasında ≥ 10 sn bırakarak, kullanıcı ya da onaylı ajan alır.
- **Kabul:** Unit testler geçer:
  - yerde irtifa, eksik alanlar, `lastPosition`
  - `now` ms/sn ayrımı, boş `flight`, `~` hex
  - `dbFlags` bitleri
  - 403 → yapılandırma hatası, 429 HTML gövdesi → kısıtlama hatası, 420 → kısıtlama

  Integration testler stub HTTP sunucusuna karşı geçer; canlı istek atılmaz.

### M4 — Ingest, replay ve senaryo araçları (`p1/m4-ingest`, worker `ingest` rolü)
- **Hız kontrolü:** AIMD token bucket (data-sources.md §1: başlangıç 0,1 rps, üst sınır 0,2). Sağlayıcı başına tek global kova vardır. Metrikler `provider_health`'e ve Redis'e yazılır. Sağlayıcı durumu (`ok | degraded | down`) data-sources.md'deki tanıma göre hesaplanır.
- **Kapsama planlayıcı:** P0+P2 batı çemberi, P2 Doğu çemberi ve birincil istasyon için ek ≈ 40 NM çember kullanılır.
  - P1 mekanizması `WATCH_HEX_LIST` env'iyle çalışır; Parça 2 M6'da DB'deki takiplerle değiştirilir.
  - P3 varsayılan kapalıdır.
- **Birleştirme:** Aynı hex için en yeni `sampleTime` kazanır. Aynı örnek iki çemberden gelirse bir kez yazılır.
- **Canlı durum (`redis-live`):**
  - `ac:{hex}` hash (TTL 120 sn)
  - GEO seti: her turda son görülmesi 120 sn'yi aşan üyeler silinir
  - `ac:updates` stream'i (`XADD MAXLEN ~ 50000`)
  - `ac:batch` pub/sub (kompakt dizi)
- **İz yazıcı:**
  - `track_points_sampled`'a 30 sn'de bir örnek yazılır.
  - `track_points_fine`'a şunlar yazılır; sınıflandırma olmadığından domain.md "Saklama" (a) yerine geçici kural uygulanır:
    - ARP'a ≤ 30 km ve `alt_baro − alan_yüksekliği < 10.000 ft` olan uçaklar
    - `WATCH_HEX_LIST`'teki uçaklar
  - Yerde konumu 20 m'den az değişen örnekler yazılmaz. Toplu insert 1–2 sn'de bir yapılır.
- **Uçuş kaydı ayrıştırma:** domain.md'deki kurallara göre yapılır.
- **Loglama:** başarılı turlar `debug`; `info` seviyesinde dakikada bir özet.
- **Araçlar** (üretimde başlatılamaz; açılışta doğrulanır):
  - `tools/scenarios`: deterministik sentetik seyir uçakları.
  - `tools/replay-receiver`: senaryo ya da kayıtlı kareleri `aircraft.json` olarak sunar ve `localReceiver`'ı besler.
  - `pnpm dev:replay` çalışır. CI yalnızca sentetik senaryoyu kullanır.
- **Kabul:**
  - Unit testler (sahte saat):
    - Retry-After'sız 429'da hız ≤ %50'ye iner ve beklemeye geçer; 10 dk temiz yanıttan sonra kademeli toparlanır.
    - 403'te devre açılır, yeniden deneme olmaz.
    - 5 tohum istasyonun P0 çemberleri tek batı çemberine sığar; Doğu çemberi planda her zaman bulunur.
    - 0,1 rps'de birincil istasyon p95 ≤ 20 sn; takip listesindeki her uçak en geç 30 sn'de bir güncellenir.
    - Örnekleme ve uçuş kaydı ayrıştırma.
  - Integration testleri: Redis canlı durum (GEO süpürme, stream sınırı) ve iz yazıcı (gerçek PostgreSQL). `test-integration` CI işi bu kilometre taşında açılır.
  - **Canlı ingest'in yayına alınmasından önce** info@adsb.lol'e bilgilendirme e-postası gönderilir (ACTIVATION, kullanıcı).

### M5 — Canlı API (`p1/m5-live-api`)
- **`GET /v1/live?bbox=…`:** Anlık görüntü döndürür. `bbox` kapsama dışındaysa yanıt bunu açıkça belirtir.
- **`GET /v1/search?q=`:** Çağrı kodu, tescil ve hex ile `redis-live`'daki canlı durumdan arar. Sefer no (TK1985) yazılırsa `airlines` tablosuyla ICAO karşılığına (THY1985) çevrilir. Harici çağrı yapılmaz.
- **Gizlilik:** `dbFlags & 1` (askeri) uçaklar `/v1/live`, WS ve aramada varsayılan olarak dönmez. `dbFlags & 4|8` (PIA/LADD) uçaklarda tescil ve sahip alanları yanıttan çıkarılır. Engel listesi uygulanır.
- **`WS /v1/ws`:**
  - `subscribe {viewport: bbox, zoom, lastSeq?}` gelince: `lastSeq` verilmişse ve fark tamponu yetiyorsa yalnızca eksik farklar, yoksa önce tam görüntü gönderilir. Sonra saniyede en fazla bir fark mesajı gider (eklendi / güncellendi / silindi).
  - Farklar **ızgara hücresi başına** bir kez serileştirilir ve o hücreye abone tüm istemcilere aynı Buffer gönderilir.
  - Her mesaj veri tazeliğini, sağlayıcı durumunu ve artan `seq`'i taşır.
  - 25 sn'de bir ping atılır; 2 pong kaçıran bağlantı kapatılır.
  - Geri basınç: `bufferedAmount > 1 MB` ise istemciye yalnızca son tam durum gönderilir; `> 4 MB` ise bağlantı kapatılır.
  - Sınırlar: IP başına 10 bağlantı, toplam `WS_MAX_CONNECTIONS` (varsayılan 2.000).
  - permessage-deflate varsayılan **kapalıdır**.
  - SIGTERM davranışı infra.md'de tanımlıdır.
- **Hız limiti:** IP bazlıdır; sayaçlar `redis-queue`'dadır.
- **Kabul:**
  - WS protokol integration testleri geçer: tam görüntü → fark, `lastSeq` ile devam, geri basınç, ping/pong, reconnect mesajı.
  - Farklı `X-Forwarded-For` değerleriyle gelen istekler ayrı hız sayaçlarına düşer; güvenilmeyen XFF yok sayılır.
  - Askeri uçak aramada ve canlı yanıtta görünmez.
  - Yayından sonra (kullanıcıya bağlı, `[k]`): `wss://API_HOST/v1/ws` üzerinden 5 dk boşta bağlantı kopmaz. Koparsa Traefik `readTimeout` notu DEPLOY_DOKPLOY.md'ye eklenir ve DUR-SOR (paylaşılan Traefik ayarıdır).

### M6 — Web canlı harita (`p1/m6-map`)
- **Kök ve kütüphane:** Kök `/` artık haritayı gösterir; `/durum` ve `/yenilikler` menüden erişilebilir kalır. MapLibre GL JS v6 kullanılır: `import * as maplibregl from 'maplibre-gl'`, yalnızca client component'te. Stil URL'leri çalışma zamanında sunucudan gelir; yedek stil davranışı data-sources.md §6'dadır.
- **Uçak katmanı:** Tek bir symbol katmanı, yöne göre döndürülmüş **özgün** kategori siluetleri (başka marka ikonu yok). Eksik ikonlar `setMissingStyleImageResolver` ya da önceden `addImage` ile eklenir. Katman stil JSON'u `packages/shared`'dadır.
- **Hareket:** Güncellemeler arasında yer hızı ve yöne göre `requestAnimationFrame` ile ara değerleme yapılır (en fazla 10 sn ileri).
- **Görünen uçaklar tablosu:** Haritanın yanında erişilebilir bir tablo vardır: en fazla 50 satır, gerçek `<table>`, ekran okuyucu için. E2E testleri de bu tabloyu okur.
- **Bilgi kartı:** çağrı kodu, tescil, tip, irtifa, hız, dikey hız, son görülme ve veri kaynağı. PIA/LADD uçakta tescil gizlenir.
- **Arama:** Hesap gerekmez. Sefer no, çağrı kodu, tescil ve hex kabul edilir. Harita bulunan uçağa yakınlaşır; "Uçağı ortala" düğmesi uçağı ekranın ortasında tutar. Seçili uçak URL'de tutulur (`/?hex=4bb26c`) ve paylaşılabilir. Bulunamazsa şu yazar: "Bu sefer şu an havada görünmüyor ya da farklı bir çağrı koduyla uçuyor; tescil ile arayabilirsin."
- **Durum şeridi ve atıflar:**
  - Sağlayıcı `degraded`/`down` iken açıklayıcı metin çıkar; veri tazeliği görünür.
  - Atıflar: ADSB.lol (ODbL, bağlantılı) ve OpenFreeMap/OpenMapTiles/OSM. Ayrıca `ATTRIBUTION.md` yazılır.
- **Metinler:** Tümü i18n'dedir. Tasarım sistemi Parça 3'te gelir.
- **Kabul:**
  - Playwright (`reuseExistingServer: false`, web 3100) Chromium'u `--use-angle=swiftshader --enable-unsafe-swiftshader` ile başlatır; stil `MAP_STYLE_URL=/test-style.json`. Test başlamadan `/api/version` yanıtındaki `app` alanı doğrulanır.
  - Akış: harita açılır → replay uçağı tabloda görünür ve 3 sn arayla konumu değişir → satıra tıklayınca bilgi kartı açılır → çağrı kodu araması uçağı bulur → `/?hex=` ile doğrudan açılış aynı uçağı seçer.
  - `e2e` CI işi bu kilometre taşında açılır.

### M7 — Canlı araçlar ve kapsama raporu (`p1/m7-tools`)
- **`pnpm record --station LTFM --minutes 30`:** Gerçek kareleri, hız kurallarına uyarak fixture'a kaydeder. **DUR-SOR** (canlı çağrı).
- **`pnpm smoke:live`** (5 dk, **DUR-SOR**) doğrular:
  - Türkiye bbox'ında (enlem 35–43, boylam 25–45) ≥ 50 uçak görülür
  - birincil istasyon veri yaşı p95 ≤ 20 sn
  - `provider_health` satırı yazılır
- **`pnpm coverage:report --hours 24`:** M4 yayına çıktıktan en az 24 saat sonra çalıştırılır. Üretim ingest'inin yazdığı `track_points_fine` ve `provider_health` verisinden istasyon başına şunları hesaplar:
  - görülen varış sayısı
  - en az bir yerde örneği olan varışların oranı
  - son havadaki örneğin medyan AGL'si ve pist eşiğine medyan mesafesi
  - `seen_pos` dağılımı
  - 429 oranı

  Çıktı `docs/reports/kapsama.md`'ye yazılır. Rapor, admin panelinden tetiklenen bir worker job'ıdır; ajan üretim DB'sine bağlanmaz. **DUR:** kullanıcı onayıyla çalışır.
- **Rapor tanımları:**
  - **Varış:** ARP'a ≤ 15 km'ye giren, o sırada `alt_baro ≤ alan yüksekliği + 3.000 ft` ve `baro_rate < −300 fpm` olan uçuş kaydı.
  - **Yerde örneği:** aynı kayıtta ARP'a ≤ 6 km içinde `alt_baro:"ground"`.
  - **AGL:** `alt_geom − geoid` (LTFM 37,05 m, SAW 37,61 m, AYT 27,36 m). `alt_geom` yoksa `alt_baro − alan yüksekliği` kullanılır ve ±300 ft belirsizlik rapora yazılır.
- **Yedek yol:** Üretim hazır değilse kullanıcı `pnpm coverage:probe --hours 24` komutunu bilgisayarında başlatır (aynı tanımlar, 0,1 rps, saatlik ara sonuç, `--resume`, yerel ingest kapalı).
- **Karar kuralları** (Parça 2'nin girdisi):
  1. Yerde örneği oranı %70'in altındaysa o istasyonda iniş varsayılan olarak "muhtemel" sunulur.
  2. Son havadaki örneğin medyan AGL'si 1.000 ft'in ya da eşiğe medyan mesafesi 8 km'nin üstündeyse DUR-SOR: `high`/`medium` kuralları o istasyonda inişlerin çoğunu yakalamaz. Dağılıma göre eşik önerisi kullanıcıya sunulur.

## Parça sonu
- `CLAUDE.md` → "Komutlar" tablosu güncellenir. `docs/reports/parca-1.md` yazılır.
- `docs/RUNBOOK.md` iki bölümle başlatılır: "adsb.lol API anahtarı istemeye başladı (401/403)" ve "sağlayıcı kesintisi ve 429 fırtınası". Parça 4 onu tamamlar.
- **Üretimin ilk 24 saatindeki 429 oranı ve tazelik:** Ajan üretim DB'sine bağlanmaz. Admin Servisler panelinde ya da kullanıcıya verilen SQL ile (Dokploy terminali) okunur. Kullanıcı sonucu yapıştırır, ajan rapora işler. Madde o zamana kadar `[k]` kalır.

## Tamamlanma kriterleri
- [ ] `pnpm ci:full` yeşil; PR'lardaki GitHub Actions yeşil ve birleştirilmiş.
- [ ] Migration'lar temiz DB'de çalışır, yükseltme testi yeşildir, seed idempotenttir.
- [ ] Yerelde üretim compose'u bütün servislerle healthy olur. Analiz uygulaması yönetici hesabıyla açılır. `[k]`: kullanıcının analiz uygulaması kurulumu.
- [ ] Push → CI → GHCR → Dokploy → `/version` doğrulaması uçtan uca çalışır; hata yolları stub testleriyle kanıtlanır. `[k]`: kullanıcının Dokploy kurulumu.
- [ ] Admin Servisler paneli bütün servislerin durumunu gösterir.
- [ ] `docs/reports/kapsama.md` 24 saatlik veriyle yazılmıştır. `[k]`
- [ ] `docs/DEPLOY_DOKPLOY.md`, `docs/ACTIVATION.md`, `docs/RUNBOOK.md` ve `docs/reports/parca-1.md` günceldir.
