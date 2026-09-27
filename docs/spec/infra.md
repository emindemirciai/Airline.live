# Altyapı ve yayın sözleşmesi

Sunucu: Hostinger **KVM 2** (2 vCPU, 8 GB RAM, 100 GB NVMe). Üzerinde Dokploy çalışır ve **başka canlı projelerle paylaşılır**. 2026-09-25'te bellek kullanımı zaten %52'ydi (~3,8 GB boş). Bu projenin kalıcı bütçesi **≈ 2,6 GB**'tır. Bütçe tam kullanıldığında host ≈ %84 dolu olur.

## Bellek bütçesi (limitler env'den değiştirilebilir)
| Servis | Limit | Ayar |
|---|---|---|
| `hy-postgres` | 768 MB | `shared_buffers=192MB effective_cache_size=512MB work_mem=4MB maintenance_work_mem=64MB max_connections=40 max_parallel_workers_per_gather=0 wal_compression=on max_wal_size=1GB`, `shm_size: 128mb` |
| `hy-redis-queue` | 256 MB | `maxmemory 128mb`, `maxmemory-policy noeviction`, `appendonly yes`, `appendfsync everysec` (AOF yeniden yazımında bellek 2 katına çıkabilir; limit ≥ 2 × maxmemory) |
| `hy-redis-live` | 256 MB | `maxmemory 192mb`, `maxmemory-policy volatile-ttl`, `save ""`, `appendonly no` |
| `hy-web` | 320 MB | `NODE_OPTIONS=--max-old-space-size=224` |
| `hy-api` | 384 MB | `--max-old-space-size=270` |
| `hy-worker-rt` | 384 MB | `WORKER_ROLE=ingest,engine`, `--max-old-space-size=270` |
| `hy-worker-bg` | 256 MB | `WORKER_ROLE=notifier,jobs`, `--max-old-space-size=180`; yedek job'ı burada çalışır |
| `hy-migrate` | 256 MB | tek seferlik, `restart: "no"` |

- Kalıcı toplam 2.624 MB'tır (migrate hariç). Redis'te `maxmemory-policy noeviction` altında da TTL'li anahtarlar süresi dolunca silinir. BullMQ Worker bağlantıları `maxRetriesPerRequest: null` kullanır. api ve worker bağlantı havuzlarının toplamı ≤ 30'dur.
- **KVM 4'e geçiş eşiği** (herhangi biri):
  - bu projenin konteynerlerinin toplam RSS'i 7 gün boyunca bütçenin %90'ını aşar
  - host'ta kullanılabilir bellek 15 dk boyunca < 600 MB kalır
  - birincil istasyon tazeliği p95 > 30 sn

  Host yüzdesi tek başına tetikleyici değildir.
- Host'ta 2 GB swap ve `vm.overcommit_memory=1` önerilir. Bu ayar tüm projeleri etkiler; ACTIVATION'da kullanıcı adımıdır.

## Compose kuralları
- **`docker-compose.yml` (üretim):**
  - Uygulama servisleri (`hy-web`, `hy-api`, `hy-worker-rt`, `hy-worker-bg`, `hy-migrate`) şunu kullanır: `image: ghcr.io/emindemirciai/havayolu-{web|api|worker}:${IMAGE_TAG:-main}` ve `pull_policy: always`.
  - **Hiçbir serviste `build:` yoktur.** CI'daki `compose-guard` işi `docker compose -f docker-compose.yml config` çıktısında `build:` bulursa kırmızıya döner.
  - Owner her yerde küçük harfle yazılır; workflow'larda `github.repository_owner` küçük harfe çevrilir.
- **Diğer compose dosyaları:**
  - `docker-compose.build.yml` yerelde imaj derlemek içindir: her uygulama servisine `build:` ve `pull_policy: build` ekler.
  - `docker-compose.dev.yml` altyapıyı sağlar: PostGIS, iki Redis, Mailpit, MinIO; yerel portları CLAUDE.md'dekilerdir. Uygulamalar yerelde `pnpm dev` ile çalışır.
- **Adlar ve ağ:**
  - Servis adları `hy-` önekiyle projeye özgüdür; paylaşılan `dokploy-network`'te ad çakışması olmaz.
  - **Traefik etiketi yazılmaz, `dokploy-network` tanımlanmaz.** Domain'ler Dokploy arayüzünden eklenir (`hy-web` → `WEB_HOST` port 3000, `hy-api` → `API_HOST` port 4000); etiketleri Dokploy ekler.
  - `ports` yerine `expose` kullanılır. Postgres ve Redis dışarı port açmaz.
- **Env:**
  - Her uygulama servisi `env_file: [{path: .env, required: false}]` kullanır; eksik değişkeni zod açılışta yakalar. Böylece CI'daki `docker compose config` `.env` olmadan çalışır.
  - Dokploy Compose'da "Create env file" anahtarı açık kalır (v0.30.0+). `${VAR}` interpolasyonu yalnızca imaj etiketi ve limitler için kullanılır.
- **Volume'lar:**
  - `hy_pgdata:/var/lib/postgresql` bağlanır. PG 18+ imajında PGDATA `/var/lib/postgresql/18/docker`'dır; `/var/lib/postgresql/data` **kullanılmaz**.
  - `hy_redisqueue` ayrı bir volume'dur.
  - Repo içine göreli bind mount yapılmaz (Dokploy her deploy'da yeniden klonlar).
- **Çalışma ayarları:**
  - Tüm servislerde `init: true`, `stop_grace_period: 30s` ve `restart: unless-stopped` (migrate hariç) bulunur.
  - `depends_on` sağlık koşuluna bağlıdır. api, web ve worker'lar `hy-migrate`'e `condition: service_completed_successfully` ile bağlıdır.
  - Log rotasyonu tüm servislerde uygulanır (x-logging anchor): `json-file`, `max-size: 10m`, `max-file: 5`.
- **Sağlık kontrolü:** `HEALTHCHECK` `node healthcheck.js` çalıştırır (curl'e bağımlı değildir); `--interval=5s --start-period=10s --retries=3`. CMD doğrudan `node …`'dır (`pnpm start` değil).

## Dockerfile kuralları
- **Genel:**
  - Çok aşamalı yapı; her Dockerfile `turbo prune <app> --docker` ile başlar. Mobil bağımlılıklar imaja girmez.
  - Taban `node:24-slim`. pnpm `npm i -g pnpm@<pin>` ile kurulur (corepack yok).
  - Root olmayan kullanıcı kullanılır. Mümkün olan yerde `read_only: true` + `tmpfs` kullanılır.
- **Worker imajı:** PGDG deposundan `postgresql-client-18` içerir (`pg_dump` sürümü sunucuyla aynı olmalıdır) ve `scripts/restore.sh`'i taşır.
- **Web imajı:** Next.js `output: 'standalone'`, `outputFileTracingRoot` repo kökünü gösterir. `public/` ve `.next/static` imaja kopyalanır.
- **Sürüm bilgisi:** `GIT_SHA` ve `BUILD_TIME` build-arg olarak imaja gömülür (ortama özgü değildir). `/version` ve `/api/version` bunları döndürür.
- **Ortama özgü değerler** build'e gömülmez. Web tarafı yapılandırmayı çalışma zamanında sunucudan okur; `NEXT_PUBLIC_*` kullanılmaz.

## Migration
- **Kim çalıştırır:** Üretimde migration'ları yalnızca `hy-migrate` çalıştırır (worker imajı + `node packages/db/dist/migrate.js`). drizzle-orm'un programatik migrator'ı kullanılır; drizzle-kit üretim imajında yoktur.
- **Güvenlik ayarları:** `pg_advisory_lock` alınır, `lock_timeout=5s` ve `statement_timeout=120s` uygulanır. Hata olursa sıfır olmayan kodla çıkılır ve deploy durur.
- **İlk migration:** `packages/db`'nin ilk migration'ı `CREATE EXTENSION IF NOT EXISTS postgis;`'tir (Parça 1 M1a).
- **Uyumluluk:** Migration'lar geriye uyumludur (expand → kodu yayınla → sonraki sürümde contract). Sütun silme ya da yeniden adlandırma tek deploy'da yapılmaz; yıkıcı migration DUR-SOR gerektirir.
- **Partition'lı tablolar:**
  - `track_points_sampled` ve `track_points_fine` parent tabloları tip güvenliği için Drizzle şemasında `pgTable` olarak tanımlanır.
  - `drizzle-kit generate`'in ürettiği `CREATE TABLE` SQL'i elle düzenlenerek `PARTITION BY RANGE (ts)` eklenir. Snapshot tabloyu içerdiği için sonraki `generate` boş fark verir.
  - Partition çocukları, DEFAULT partition ve bakım DDL'i şemada yer almaz; `packages/db/sql/` altında idempotent SQL olarak (`drizzle-kit generate --custom`) eklenir.
  - `drizzle-kit push` ve `pull` bu projede **kullanılmaz** (`pull` partitioned parent'ları düşürür, drizzle-orm #6093). `tablesFilter` ve `extensionsFilters` yalnızca push/pull'u etkiler.
- **Partition bakımı:**
  - migrate ve günlük job partition'ları 7 gün ileriye açar.
  - Bir DEFAULT partition bulunur ve her zaman boş tutulur; DEFAULT'a satır düşerse admin uyarısı verilir.
  - DEFAULT varken `DETACH … CONCURRENTLY` kullanılamaz. Süresi dolan partition'lar gece, `lock_timeout=5s` ile `DETACH PARTITION` (CONCURRENTLY olmadan) + `DROP TABLE` komutlarıyla silinir. Kilit alınamazsa jitter'lı yeniden deneme yapılır.
- **CI testleri:** Temiz DB'de baştan sona migration. Yükseltme testi: `origin/main`'deki migration'lar temiz DB'ye, üstüne dalın migration'ları uygulanır; main'de migration yoksa iş başarılı sayılır.

## CI/CD (herkese açık repo, GitHub Free)
**Kısıtlar ve korumalar (D-061)**
- Repo herkese açıktır. `main` bir kural setiyle (`main-koruma`) korunur ve kimse bu kuralları atlayamaz:
  - silme ve force push yasaktır
  - değişiklik yalnızca PR ile ve yalnızca merge commit olarak girer
  - zorunlu kontroller `checks` ve `test-integration` yeşil olmalıdır
- Gizli bilgi taraması ve push koruması açıktır: sır içeren bir push GitHub'da reddedilir. Bağımlılık güvenlik uyarıları açıktır.
- Secrets repo düzeyinde tutulur (Settings → Secrets and variables → Actions). Fork'tan gelen PR'lara secrets verilmez; deploy yalnızca `main` push'unda çalışır.
- Herkese açık repoda Actions dakikası sınırsızdır. Yine de gereksiz iş yapılmaz:
  - PR çalışmaları iptal edilebilir
  - imajlar yalnızca `main`'de derlenir
  - e2e yalnızca ilgili dosyalar değişince çalışır

**`.github/workflows/ci.yml`** (`pull_request` ve `push: main`)
- `concurrency: {group: ci-${{ github.ref }}, cancel-in-progress: ${{ github.event_name == 'pull_request' }}}`. `main` çalışmaları iptal edilmez; aksi hâlde çağrılan deploy işi yarıda kesilir.
- İşler:
  1. `checks`: format, lint, typecheck, unit test, build, `changelog:check`, `check:eol`, `compose:guard`, `test:scripts`.
  2. `test-integration`: dev compose'daki PostGIS, iki Redis ve Mailpit; gerçek veritabanı testleri.
  3. `e2e`: Playwright; ilgili testler eklendikçe açılır.
  4. `actionlint`.
  5. `deploy`: `uses: ./.github/workflows/deploy.yml`, `secrets: inherit`, `permissions: {contents: read, packages: write}` (çağrılan workflow izin yükseltemez), `needs: [tüm kontroller]`. Koşul: `if: github.event_name=='push' && github.ref=='refs/heads/main'`. **`main`'e her push'ta çalışır.** "Yalnızca belge değişti" kararı yol filtresiyle (son push'a göre) değil, `release` işinde canlıdaki sürüme göre verilir. Aksi hâlde bir kod birleşmesinin arkasından belge birleşmesi geldiğinde kod hiç yayınlanmazdı (D-064).
- Workflow düzeyinde `paths-ignore` ve `workflow_run` kullanılmaz.

**`.github/workflows/deploy.yml`** (`on: workflow_call` + `workflow_dispatch` [girdi `dry_run`, elle varsayılan `true`]; D-064)
- **`build` (matris: web, api, worker):** GHCR'a `GITHUB_TOKEN` ile giriş yapılır. İmajlar `docker/build-push-action` ile derlenir: `linux/amd64`, `cache-from/to: type=gha` (uygulama başına scope), build-arg `GIT_SHA=<tam sha>` ve `BUILD_TIME`. **Yalnızca `sha-<7>` etiketi** gönderilir.
- **`release`** (`dry_run` değilse; `concurrency: {group: deploy-prod, cancel-in-progress: false}`, rollback ile ortak):
  1. Commit hâlâ `main`'in ucunda mı bakılır (`git ls-remote`, `pipefail`; uç okunamazsa iş kırmızı). Değilse iş özetine "ATLANDI: daha yeni commit" yazılır. Her push kendi yayın işini çalıştırdığı için yeni ucun işi bu commit'i de kapsar. Böylece geç biten eski bir derleme yenisinin üstüne yazamaz.
  2. `docker buildx imagetools create` ile üç imajın `:main` etiketi `sha-<7>`'ye taşınır (yeniden derleme yok).
  3. `pnpm run deploy:dokploy` (`SKIP_UNCHANGED=true`, aşağıdaki sözleşme). Canlıdaki `/version` ve `/api/version` aynı commit'i gösteriyorsa ve o commit ile bu commit arasında yalnızca `docs/` ya da `apps/mobile/` değiştiyse Dokploy tetiklenmez ("YAYIN GEREKMEDİ"). Canlı sürüm okunamazsa ya da fark hesaplanamazsa yayın yapılır. Checkout tam geçmişle yapılır.
- **Deploy koşulu:** `vars.DEPLOY_ENABLED` `true` değilse script yayını atlar. İş yeşil kalır, iş özetine (`$GITHUB_STEP_SUMMARY`) "YAYINLANMADI: Dokploy kurulumu tamamlanmadı" yazılır; `:main` yine de taşınır.
  - Kurulum bitince kullanıcı `DEPLOY_ENABLED=true` yapar. `DEPLOY_ENABLED=true` iken secret ya da variable eksikse, adresler `https://` değilse ya da deploy başarısız olursa iş kırmızıya döner. Eksik ayarların yalnızca adları yazılır.
- **Deploy sözleşmesi** (`scripts/deploy-dokploy.mts`):
  1. Tetiklemeden önce `GET $DOKPLOY_URL/api/deployment.allByCompose?composeId=…` ile mevcut deployment id'leri kaydedilir.
  2. `POST $DOKPLOY_URL/api/compose.deploy` çağrılır. Başlıklar: `x-api-key: $DOKPLOY_API_TOKEN`, `Content-Type: application/json`. Gövde: `{"composeId":"…","title":"gh-<sha7>-<run_id>"}`.
  3. **`freshVolumes` asla gönderilmez** (volume'ları siler); bunu doğrulayan bir unit test vardır. `compose.redeploy` kullanılmaz.
  4. Çağrı asenkrondur ("Deployment queued"). Listede ilk görünen yeni id 10 sn arayla en fazla 15 dk izlenir; kuyrukta bekleme süresine izin verilir.
     - Beklerken ağ hatası, zaman aşımı, 5xx ve 429 geçicidir: süre dolana kadar beklenir, dolarsa son hata yazılır. 401/403/404 ve bozuk yanıt hemen çıkış 1'dir. İlk liste ve `compose.deploy` çağrısında hata hemen çıkış 1'dir; yayının kuyruğa girip girmediği bilinmediği için yeniden denenmez.
     - Dokploy son 10 kaydı tutar.
     - Başlık commit mesajıyla, `description` klonlama anındaki HEAD'in `Commit: <SHA>` değeriyle değişir; yalnızca bilgi olarak loglanır.
     - `error` ya da `cancelled` → çıkış 1. `errorMessage` çoğu zaman boştur.
  5. Ardından `${API_URL}/version` ve `${WEB_URL}/api/version` yeni `GIT_SHA`'yı döndürene ve `/ready` 200 verene kadar 10 sn arayla en fazla 15 dk yoklanır. Yayın sırasında ulaşılamamak bekleme sebebidir. Olmazsa çıkış 1.
  6. Hata yolları (error, cancelled, kuyrukta zaman aşımı, geçici ve kalıcı Dokploy hataları, eski SHA, 503, 401) ve "yayın gerekmedi" kararı stub Dokploy + stub `/version` sunucusuna karşı sahte saatle test edilir (`pnpm test:scripts`, CI `checks`). Üretimde bilerek bozuk imaj yayınlanmaz.
  7. Deploy API anahtarı hiçbir çıktıya yazılmaz; yazdırılabilir tek satırlık bir değer olduğu doğrulanır. İstek gövdesi yalnızca `composeId` ve `title` taşır.
- **GitHub secrets:** `DOKPLOY_URL` (HTTPS panel adresi; `http://IP:3000` değil), `DOKPLOY_API_TOKEN`, `DOKPLOY_COMPOSE_ID`. **GitHub variables:** `WEB_URL`, `API_URL`, `DEPLOY_ENABLED`.
- **Action sürümleri (node24):** `actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6`, `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `docker/metadata-action@v6`, `docker/build-push-action@v7`. Üçüncü taraf action'lar commit SHA ile sabitlenir.

**`rollback.yml`** (`workflow_dispatch`, girdi `sha`, 7–40 onaltılık karakter; girdi kabuğa yalnızca env ile geçer): önce üç `sha-<7>` imajının da var olduğunu doğrular (biri yoksa hiçbir etiket taşınmaz), sonra `docker buildx imagetools create` ile `:main` olarak yeniden etiketler ve aynı deploy ve doğrulama adımlarını her zaman yayın yaparak çalıştırır (`deploy-prod` sırasında; `SKIP_UNCHANGED` yok). Sonraki birleşme canlıdan farkı yayınlar; sorunlu değişiklik önce bir PR ile geri alınmalıdır. Beklenen SHA kısa verilebilir; doğrulama baş eşleşmesiyle yapılır. Migration'lar geri alınmaz. Dokploy compose dosyasını `main`'in ucundan klonlar, yani eski imajlar güncel compose ile çalışır.

**`actionlint`** (CI işi): `rhysd/actionlint:1.7.12` imajı digest'iyle sabitlenerek çalıştırılır; `run:` betikleri shellcheck'ten de geçer.

## Yayın davranışı ve kesinti
- Compose deploy'u **sıfır kesintili değildir.** web ve api için birkaç saniyelik kesinti kabul edilir ve DEPLOY_DOKPLOY.md'de açıkça yazılır.
- **SIGTERM davranışı:**
  - API yeni WS kabul etmez. İstemcilere `{type:'reconnect', afterMs: 1000–10000 rastgele}` gönderir ve bağlantıları 1012 koduyla kapatır.
  - Worker `worker.close()` çağırır, motor durumunu `redis-queue`'ya yazar ve açık ingest turunu bitirir.
- İstemciler 1–10 sn jitter ve üstel geri çekilmeyle yeniden bağlanır ve son `seq`'i gönderir.

## Analiz (kullanıcının kendi uygulaması)
- **Uygulama:** Ziyaretçi analizi için kullanıcının MIT lisanslı "Siteni Analiz Et" uygulaması kullanılır (`emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-`). Bu projenin compose'una girmez; ayrı bir Dokploy Compose uygulamasıdır. Bellek kullanımı ~150–250 MB'tır; host bütçesine eklenir, bu projenin 2,6 GB'ına dahil değildir.
- **Yönetici girişi (platform-admin sözleşmesi):** Analiz paneli girişi bizim API'mizle doğrular. API'nin karşılaması gerekenler (analiz uygulamasının `src/lib/platformAuth.ts` dosyasına göre):
  - `POST /api/auth/login`: gövde `{email, password}`; yanıt `{token}`. `accessToken` ya da `access_token` alanları ve `data`/`user` içine gömülü hâller de kabul edilir, ama biz `token` döndürürüz. Hata yanıtı `{message}` taşır.
  - `GET /api/admin/session`: `Authorization: Bearer <token>`. 200 = yetkili, 401/403 = değil. 404/405 dönerse panel `/api/auth/me`'ye geçer.
  - `GET /api/auth/me`: `{user: {email, role}}`; `role` `ADMIN` olmalıdır.
  - Panel token'ı 7 gün çerezde tutar ve her istekte doğrular. Bu yüzden token 7 gün geçerli, opak ve iptal edilebilirdir (`redis-queue`'da hash'li).
- **Takip script'i:** `<script defer src="${ANALYZE_URL}/api/tracker" data-site="${ANALYZE_SITE_ID}">`. Script `localStorage` (kalıcı ziyaretçi kimliği) ve `sessionStorage` kullanır. Bu yüzden web onu **yalnızca kullanıcı onay verdikten sonra** yükler (KVKK Çerez Rehberi; hukuki inceleme ACTIVATION'da).
- **Konum sorgusu:** `ANALYZE_GEO_LOOKUP=false` önerilir. Açıkken ziyaretçi IP'leri `ipwho.is` ve `ip-api.com`'a gönderilir; ip-api'nin ücretsiz katmanı ticari kullanıma kapalıdır ve HTTP kullanır.

## Gözlem ve uyarı (KVM 2'de Prometheus/Grafana çalıştırılmaz)
- **Uptime:** Dış bir uptime kontrolü dakikada bir `${WEB_URL}` ve `${API_URL}/ready` adreslerine yapılır (ör. UptimeRobot; ACTIVATION).
- **Heartbeat:** Dead-man's-switch ping'leri `HEARTBEAT_URL_INGEST`, `HEARTBEAT_URL_NOTIFIER` ve `HEARTBEAT_URL_BACKUP` adreslerine gider. Env yoksa özellik kapalıdır.
- **E-posta uyarıları:** Worker'daki uyarı job'ı ADMIN_EMAIL'e e-posta atar (aynı uyarı saatte en fazla bir kez). Tetikleyiciler:
  - sağlayıcı tazeliği 5 dk boyunca > 60 sn
  - 429 oranı > %20
  - 401/403
  - Redis belleği > %80
  - disk > %70
  - bildirim kuyruğu gecikmesi > 30 sn
  - DEFAULT partition'a satır düşmesi
- **Metrikler:** `/metrics` (Prometheus formatı) yalnızca token ile erişilebilir.
- **Dokploy bildirimleri:** Build Error ve Dokploy Restart olayları Telegram ya da e-posta ile iletilir.

## Yedekleme (Parça 2 M9'da kurulur)
- **Dokploy Compose Backups sekmesi bu projede kullanılmaz:** v0.30.7'de komutu sabittir (`pg_dump -Fc --no-acl --no-owner … | gzip`), tablo dışlayamaz ve yalnızca S3 hedefi kabul eder. Dokploy Volume Backup da çalışan Postgres için kullanılmaz.
- **Günlük yedek** `hy-worker-bg` (`jobs` rolü) içinde, 02:30 UTC'de alınır:
  - komut: `pg_dump -Fc --exclude-table-data='track_points_*'`
  - hedef: Hostinger dışındaki S3 uyumlu depo (`BACKUP_S3_*`; Backblaze B2 ya da Cloudflare R2); en az 7 günlük + 4 haftalık kopya
  - sonuç `backup_runs` tablosuna yazılır (admin "yedek durumu" buradan okunur) ve `HEARTBEAT_URL_BACKUP`'a ping atılır
- **İz tabloları yedeğe girmez.** v1'de iz verisi kaybı kabul edilir; partition arşivi yoktur.
- **S3 tanımlı değilse:** yerelde en fazla 2 kopya tutulur. Disk %70'in üstündeyse yerel yedek yazılmaz ve admin panelinde kırmızı uyarı gösterilir.
- **Geri yükleme:** `scripts/restore.sh` worker imajındadır ve `docker exec hy-worker-bg /app/scripts/restore.sh <dosya>` ile çalışır. CI'da geri yükleme testi koşar.
- **Hedefler:** RPO 24 saat (iz verisi hariç), RTO 1 saat. Ayda bir geri yükleme provası yapılır.
- **Sırlar:** Yeniden üretilemeyen sırlar (VAPID özel anahtarı, JWT imza anahtarı, `ADMIN_SETUP_TOKEN`, Dokploy env dökümü) parola yöneticisinde tutulur. **VAPID anahtarı kaybolursa tüm web push abonelikleri geçersiz olur.**

## Güvenlik
- **Dokploy sürümü:** ≥ v0.30.7; eski sürümlerde komut enjeksiyonu açıkları vardır.
- **Panel ve port 3000:**
  - Panel HTTPS domain'e bağlanır ve 3000 portu dışarıya kapatılır.
  - Docker yayınladığı portlar için iptables kurallarını ufw'nin önüne eklediğinden ufw tek başına yetmez; `ufw-docker` kurulur (sürüm 251123, commit ve SHA-256 ile sabitlenmiş indirme; DEPLOY_DOKPLOY.md). ufw'de yalnızca 22, 80 ve 443 açıktır.
  - `ufw-docker` konteyner portlarının hepsini kapatır; `ufw allow 80/443` Traefik konteynerine ulaşmaz. Traefik için `ufw route allow proto tcp from any to any port 80` ve `443` (HTTP/3 için `proto udp … port 443`) zorunludur, yoksa paylaşılan VPS'teki bütün siteler düşer. Diğer projelerin doğrudan yayınladığı portlara `ufw-docker allow <konteyner> <port>` ile tek tek izin verilir.
  - Doğrulama (başka bir ağdan): panel ve diğer sitelerin alan adları yanıt vermeye devam eder; `curl -m 5 http://<VPS_IP>:3000` zaman aşımına uğrar. SSH oturumu açık tutulur, geri dönüş `sudo ufw disable`'dır.
- **Let's Encrypt e-postası** Web Server ayarlarında girilir (varsayılan `test@localhost.com`'dur). Cloudflare proxy kullanılırsa SSL modu "Full (Strict)" olur ve `EDGE_PROXY=cloudflare` girilir.
- **Deploy API anahtarı:**
  - Mümkünse yalnızca bu projeye erişimi olan bir "deploy-bot" üyesiyle, 90 gün süreli üretilir.
  - Doğrulama: anahtarla başka bir projenin compose'unu okumayı dene; 401/403 beklenir. 200 dönerse DUR-SOR.
  - Bitiş tarihi ACTIVATION'a yazılır.
- **GHCR çekme kimliği:** classic PAT, yalnızca `read:packages` yetkisiyle.
- **Proxy güveni ve istemci IP'si (D-060):**
  - Fastify `trustProxy` yalnızca `TRUSTED_PROXY_CIDRS`'e güvenir. Üretimde zorunludur; compose boşsa Docker'ın özel ağlarını (`10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`) verir. Bu güvenin ön koşulu hiçbir uygulama konteynerinin dışarıya port açmamasıdır (yalnızca Traefik). Kabul edilen sınır: Dokploy alan adı olan her servisi paylaşılan `dokploy-network`'e bağlar; VPS'teki diğer projelerin konteynerleri de güvenilen ağdadır ve hız sınırı anahtarını seçebilir (Traefik aynı alt ağda olduğu için IP ile ayırt edilemez).
  - Anahtar, eklentinin normalleştirmesinden geçer: IPv6 adresleri /64 bloğa göre gruplanır (blok içinde adres değiştirerek sınır aşılamaz), IPv4-mapped adresler çözülür. `/0` ağı kabul edilmez.
  - Web sunucusu API'yi iç ağdan çağırırken ziyaretçinin `X-Forwarded-For` ve `CF-Connecting-IP` başlıklarını iletir; hız sınırı ziyaretçi başına tutulur.
  - Cloudflare önde ise (`EDGE_PROXY=cloudflare`) `CF-Connecting-IP`, yalnızca isteği ileten adres Cloudflare'in yayımlanmış ağlarındaysa kullanılır (liste `apps/api/src/net/client-ip.ts`'te). Sunucuya doğrudan gelen biri başlığı uyduramaz.
  - `/health`, `/version` ve `/openapi.json` hız sınırına girmez. Sayaç deposu (redis-queue) hata verirse sınır uygulanmaz, istek reddedilmez (`skipOnError`).
  - Bilinen sınır: Başka bir sunucu API'yi kendi adına çağırırsa (ör. analiz uygulamasının girişi) bütün istekleri o sunucunun IP'siyle tek sayaca düşer.
- **`/ready` yanıtı** herkese açıktır; sürücü hata metni yerine yalnızca `erişilemiyor` döner, ayrıntı loglanır. Ayrıntılı durum yalnızca oturumlu `/v1/admin/services`'tedir.
- **Log gizliliği:** pino `redact` ayarıyla authorization, cookie, `*.token` ve `*.password` alanları loglanmaz.
