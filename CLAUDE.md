# havayolu — proje kuralları

Bu dosya her oturumda otomatik yüklenir; yalnızca her zaman geçerli kuralları içerir. Ayrıntılar: `docs/spec/` (alan, veri kaynakları, altyapı), `.claude/rules/` (dizine özel kurallar), `docs/prompts/` (parça görevleri), `docs/REFERENCES.md` (doğrulanmış URL'ler).

## Değerler
- **Marka:** `havayolu` · **Domain:** `havayolu.live` (D-059). Ad `APP_NAME` env'inden okunur (varsayılan `havayolu`); alan adları koda gömülmez.
- **Host'lar** (ayrı env'ler; `api.` öneki türetilmez):
  - web `https://havayolu.live` (`WEB_HOST`); `www.havayolu.live` kalıcı yönlendirmeyle köke gider
  - API ve WS `https://api.havayolu.live` (`API_HOST`)
  - admin `https://admin.havayolu.live` (`ADMIN_HOST`)
  - analiz `https://analiz.havayolu.live` (`ANALYZE_URL`; kullanıcının Siteni Analiz Et uygulaması)
- **GITHUB_REPO:** `emindemirciai/havayolu`. Repo **herkese açık** (kullanıcı kararı, D-061), plan GitHub Free. `main` kural setiyle korunur: silme ve force push yasak, yalnızca PR + merge commit, `checks` ve `test-integration` yeşil olmalı. Gizli bilgi taraması ve push koruması açık. GHCR imaj adları küçük harflidir: `ghcr.io/emindemirciai/havayolu-{web,api,worker}`.
- **Birincil istasyon:** IST (LTFM). Tohum istasyonlar: IST, SAW, ESB, ADB, AYT.
- **URL şeması:**
  - canlı uçak `/?hex=<hex>`
  - uçuş sayfası `/ucus/<flightId>` (EN: `/en/ucus/<flightId>`)
  - istasyon `/istasyon/<icao>`, operasyon panosu `/istasyon/<icao>/operasyon`
  - durum `/durum`, yenilikler `/yenilikler`

  Bildirimler uçuş sayfasına gider; uçuş sayfası gelene kadar (Parça 3) `/?hex=` kullanılır.

## Ürün (özet)
Türkiye odaklı, herkese açık, ileride ücretli olacak sivil havacılık uçuş takip platformu. Önce web (PWA) gelir, sonra aynı backend'i kullanan Expo iOS/Android uygulaması.

Kullanıcı bir uçuşu (sefer no / çağrı kodu), bir uçağı (tescil / hex) ya da bir istasyonun varış akışını (havayolu/tip filtreli) takip eder. Uçak istasyona yaklaştığında (varsayılan 10 km, havalimanı merkezine göre) ve indiğinde kullanıcı bildirim alır. **Tek uçuş takibi ve istasyon operasyonu eşit önemdedir.**

FR24 premium benzeri derinlik: canlı harita, uçuş detayı, grafikler, geçmiş oynatma, istasyon panosu. Varsayılan görünüm sadedir, "Uzman" görünüm ayrıntıyı açar. Arayüz TR önceliklidir, EN ikinci dildir. ADS-B'nin sınırları kullanıcıya dürüstçe söylenir (`docs/spec/domain.md` → "v1 sınırları").

## Mimari (gerekçesiz değiştirme → DUR-SOR + `docs/DECISIONS.md`)
- **Monorepo:** pnpm workspaces + Turborepo, TypeScript `strict` + `noUncheckedIndexedAccess`, ESM. Paketler `@havayolu/*` adını taşır.
- **`apps/web`:** Next.js App Router (`output: 'standalone'`), MapLibre GL JS, PWA + Web Push, admin paneli.
- **`apps/api`:** Fastify, REST (OpenAPI) + WebSocket.
- **`apps/worker`:** tek imaj, `WORKER_ROLE` ⊆ `ingest,engine,notifier,jobs`. Dizin düzeni sabittir: `apps/worker/src/{ingest,engine,notifier,jobs}/`. Üretimde iki servis vardır: `hy-worker-rt` (`ingest,engine`) ve `hy-worker-bg` (`notifier,jobs`).
- **`apps/mobile`:** Expo (development build, Expo Router), `@maplibre/maplibre-react-native`, expo-notifications, EAS.
- **Veri:** PostgreSQL + PostGIS (Drizzle). İki Redis: `redis-queue` (BullMQ, kalıcı) ve `redis-live` (anlık durum, kalıcı değil).
- **Paketler:**
  - `shared`: tipler, zod, changelog, yol haritası, harita katman stilleri, tasarım token'ları
  - `i18n`, `geo`, `providers`
  - `db`: veri depoları: PostgreSQL (Drizzle, migration) ve Redis istemcisi, heartbeat
  - `engine`: saf, IO yok
  - `tools/`: yalnızca dev/test
- **Yayın:** GitHub Actions imajları derler → GHCR → Dokploy (Hostinger KVM 2, **başka projelerle paylaşılır**) yalnızca imaj çeker. VPS'te build yapılmaz.

## Sürüm pinleri (doğrulama 2026-09-25; yükseltme = ayrı PR)
- **Çalışma ortamı ve dil:** Node 24 (`.nvmrc` 24; Node 26 LTS'ye geçiş 2026-10-28 sonrası ayrı PR, kullanıcı onayıyla) · pnpm 12.6 (`packageManager`; corepack'e güvenme) · **typescript 6.0.x** (TS 7 native henüz yok: typescript-eslint `<6.1` istiyor) · zod 4.
- **Araçlar ve test:** eslint 10 + typescript-eslint 8.70 · turbo 2.11 (2.11.3) · vitest 5 (5.0.1) · @playwright/test 1.63.
- **Web ve backend:**
  - next 16.3 · **react 19.3 yalnızca web**: mobilde React sürümünü Expo SDK belirler, ortak paketler `react`'i yalnızca peer olarak alır
  - fastify 5.x (6-alpha değil) · @fastify/websocket 11
  - drizzle-orm 0.45 / drizzle-kit 0.31 (1.0-RC API'si yok)
  - maplibre-gl 6.x · bullmq 6.x + açık `ioredis` · redis 8
  - `postgis/postgis:18-3.6` (`latest` değil) · web-push 3.6.7
- **Mobil:** Expo SDK 57 (`expo` ≥ 57.0.17; 58 stabil çıktıysa DECISIONS ile) · @maplibre/maplibre-react-native ^11.4 (v11 API'si) · expo-server-sdk ^7.2.
- pnpm 11+ `minimumReleaseAge` varsayılanı 1440 dk'dır: 24 saatten yeni sürümler kurulmaz. Değiştirmek gerekirse `pnpm-workspace.yaml`'a açıkça yaz ve DECISIONS'a kaydet.

## Veri kaynakları — kesin kurallar (ayrıntı: `docs/spec/data-sources.md`)
- **İzinli:**
  - canlı veri: adsb.lol API (ODbL; tek canlı kaynak), opsiyonel kendi alıcımız (`LOCAL_RECEIVER_URLS`)
  - referans: OurAirports (kamu malı), VRS standing-data (CC0; havayolu + rota), aviationweather.gov (METAR/TAF)
  - harita: OpenFreeMap; Protomaps PMTiles yalnızca self-host harita yedeği
- **Yasak:**
  - airplanes.live, adsb.fi, OpenSky (her katman), ADS-B Exchange Community/RapidAPI
  - Flightradar24 ve FlightAware'den kazıma; **FR24 resmi API'si** (şartları rakip ürünü yasaklar)
  - adsb.lol `routeset` (Referer korumalı) ve gizli `route` (güvenilmez) uç noktaları
  - resmi olmayan uç noktalar ve kütüphaneler; başka markaların ikon ve görselleri
- **Harici servislere yalnızca worker erişir.** Web ve mobil istemci adsb.lol'e asla doğrudan istek atmaz.
- **Lisans kaydı:** `packages/providers` içindeki her sağlayıcı data-sources.md → "Lisans kaydı"ndaki 7 alanı taşır. `DATA_USAGE_MODE=commercial` (varsayılan) iken `commercialUse:false` olan bir sağlayıcı başlatılamaz.
- **Gizlilik:** `dbFlags` yoksa 0'dır ve bit testiyle okunur.
  - 1 askeri → varsayılan gizli (API, WS ve aramada dönmez).
  - 4 PIA ve 8 LADD → tescil ve sahip alanları gizlenir.
  - Admin'in hex engel listesi her kanalda uygulanır.
- **Ticari sağlayıcı entegrasyonu v1'de yoktur.** `ScheduleProvider` tip arayüzü Parça 1 M3'te tanımlanır; uygulaması Parça 5'tedir.

## DUR VE SOR — bu durumlarda çalışmayı durdur, kullanıcıya sor
1. Marka ya da alan adını değiştirmek: web push abonelikleri, PWA kurulumları, derin bağlantılar ve mağaza kayıtları etkilenir.
2. Bir sır, hesap ya da etkileşimli giriş gerekiyor: Dokploy, GHCR, SMTP, `gh`, EAS/Expo, Apple, Google, S3, Sentry.
   - **Değer uydurma.**
   - Sırları (VAPID, JWT, setup token) kullanıcı üretir; ajan üretim komutunu çalıştırmaz ve çıktısını görmez.
   - Özelliği env yokken temiz kapanacak şekilde bitir, adımı `docs/ACTIVATION.md`'ye yaz ve devam et.
3. Bir veri kaynağının lisansı, şartı ya da davranışı belirsiz veya değişmiş (ör. adsb.lol 401/403 dönmeye başladı).
4. Üretimi etkileyen, rutin yayın dışındaki her eylem: üretim DB'sine bağlanmak, Dokploy ayarı değiştirmek, VPS'e yük testi, DNS.
5. Mimari listesindeki bir seçimi değiştirmek ya da ücretli bir bağımlılık eklemek.
6. Canlı harici çağrı yapan araçlar (`smoke:live`, `record`, `coverage:probe`, fixture çekimi), repo dışında dosya silme.
7. Bir kabul kriteri 3 denemede geçmiyor. Hatayı, denenenleri ve seçenekleri özetle.

Listede olmayan küçük teknik belirsizliklerde standart ve güvenli seçeneği uygula, `docs/DECISIONS.md`'ye yaz.

## Git ve yayın
- **Temel kural:** `main` = üretim. Kilometre taşı dalları `p<N>/m<K>-<kisa-ad>` biçimindedir. Commit'ler Conventional Commits biçiminde ve İngilizce yazılır.
- **Yayın akışı (kullanıcı kararı 2026-09-25):**
  1. Kilometre taşı bitince yerel kontroller ve teslimatlar tamamlanır.
  2. Dal push edilir, `gh pr create --fill` ile PR açılır, CI izlenir.
  3. **CI yeşilse ajan PR'ı merge commit ile birleştirir** (`gh pr merge --merge`; squash ve rebase kullanılmaz).
  4. Ardından deploy izlenir ve yayın `/version` ile doğrulanır.
  5. CI kırmızıysa düzeltilir; kırmızı PR birleştirilmez.
- **Yeni dal:** Önce `git fetch origin` çalıştırılır. Önceki PR birleştiyse `main`'den açılır. Birleşmediyse önceki dalın üstünden açılır ve PR tabanı önceki dal olur (yığılmış dal).
- **Oturum başı:** `git branch --show-current` yazdırılır; plan dosyasının güncel hâli çalışılan daldadır.
- **Yasak:** `--force`, `--no-verify`, rebase ve geçmişi yeniden yazmak, `.env*` (`.env.example` hariç) commit etmek, `main`'e doğrudan push (ilk kuruluş push'u hariç, D-024).

## Çalışma döngüsü
1. **Oturum başı:** `docs/plans/parca-N.md` ve son raporu oku. Plan durumları:
   - `[ ]` başlamadı
   - `[~]` sürüyor
   - `[k]` kod bitti, kullanıcı doğrulaması bekliyor
   - `[x]` tamam

   İlk `[ ]` ya da `[~]` kilometre taşından devam et; `[k]` olanları atla.
2. **Yeni parça:** Önce planı yaz: kilometre taşları, dizinler, kabul komutları. Sonra DUR ve onay al. Onay alınınca plana `Onay: <tarih>` satırı yazılır; bu satır yoksa planı yeniden sun.
3. **Oturum başına iş:** Bir oturumda tek kilometre taşı bitirilir. Kabul komutlarının çıktısı plana eklenir.
4. **Kullanıcıya bağlı kabul maddeleri** (üretimde gerçek cihaz, gerçek varış, gerçek yedek, 24 saatlik ölçüm): ACTIVATION'a `[ ]` olarak yazılır, kilometre taşı `[k]` işaretlenir ve sonrakine geçilir. Parça, `[k]` maddeler kapanmadan `[x]` olmaz.
5. **Parça sonu:** `docs/reports/parca-N.md` yazılır: yapılanlar, komutlar ve sonuçları, ölçümler, bilinen sınırlar, ACTIVATION'a eklenenler.
6. **ACTIVATION:** `docs/ACTIVATION.md`, kullanıcının elle yapacağı dış adımların **tek ve canlı** listesidir.
7. **Doğrulama kaynakları:** Önce `docs/REFERENCES.md`'deki kaynaklar kullanılır.

## Her iş sonrası teslimatlar (kullanıcının kalıcı talebi, D-022)
Sıra: 1–4 commit'ten önce yapılır ve aynı commit'e girer. 5 commit'ten sonra çalışır. 6 push ve birleştirmeyle birlikte yapılır.
1. **Sürüm ve Yenilikler:**
   - Sürüm artırılır. 1.0 öncesinde birleşen her kilometre taşı MINOR, her düzeltme PATCH artışıdır. Kök `package.json` sürümü changelog'daki en yeni sürümle aynıdır (`pnpm changelog:check`).
   - Kullanıcıya dönük değişiklikler yalnızca `packages/shared/src/changelog/entries.ts`'e yazılır: TR/EN, tarih, maddeler, varsa "Dene →" bağlantıları.
   - `pnpm changelog` bu kaynaktan `CHANGELOG.md`'yi üretir. `/yenilikler` sayfası da aynı kaynaktan beslenir ve kullanıcının o sürümde test edebileceği sayfaların dizinidir.
2. **README:** `README.md` Türkçe ve İngilizce bölümleriyle güncellenir: sürüm, özellik durumu, yerelde çalıştırma, satır sayısı.
3. **Satır sayısı:** `pnpm stats` çalıştırılır (lockfile ve `docs/research/` hariç). Toplam ve dağılım kullanıcıya bildirilir.
4. **Yerel test:** `pnpm dev` arka planda başlatılır ve uygulama tarayıcı önizlemesinde (`.claude/launch.json`) kullanıcıya gösterilir.
5. **Yedek:** `pnpm backup` → `git archive` zip'i masaüstünde `havayolu-yedek\havayolu-v<sürüm>-<tarih>-<commit>.zip` olarak üretilir ve kullanıcıya gönderilir (D-059).
6. **CI ve yayın:** CI yeşil ve Dokploy deploy'u hatasız olmalıdır. Kırmızıysa iş bitmiş sayılmaz.

## Kalite çıtası
- **Üretim kodu** = üretim imajına giren her şey (`apps/*/src`, `packages/*/src`). Üretim kodunda TODO/FIXME, "sonra yapılacak" notu, sahte buton, placeholder sayfa, mock veri ve mock API yoktur (`no-warning-comments: error`, `--max-warnings 0`).
- **Testler** (`**/*.test.ts`, `**/test/**`, `e2e/`, `tools/`, `**/fixtures/**`) stub HTTP sunucusu, commit'li fixture, Mailpit, S3 emülatörü (Parça 2 M9'da seçilir) ve Turnstile stub'ını kullanabilir. Üretim kodu bunları import edemez (`no-restricted-imports`).
- **CI, testler ve `pnpm dev` canlı harici servise istek atmaz.** `EXTERNAL_PROVIDERS_DISABLED=true` (`.env.example` varsayılanı) şunları kapatır:
  - adsb.lol, OurAirports, VRS aynası, aviationweather
  - OpenFreeMap (testte yerel `test-style.json`)
  - Turnstile siteverify (testte stub)

  `LOCAL_RECEIVER_URLS` (localhost replay) açık kalır. Referans verisi testte `tools/fixtures/` altındaki commit'li dosyalardan gelir.
- **Anahtarı olmayan entegrasyon:** stub'a karşı integration testi geçer, env yokken özellik temiz kapanır, adım ACTIVATION'a yazılır. Admin'e kısıtlı işlevsel bir kurulum sayfası placeholder sayılmaz.
- **Env:**
  - Tüm env değişkenleri zod ile doğrulanır ve `.env.example`'da açıklamalı olarak durur.
  - `.env.example` sır olmayan geliştirme varsayılanlarını içerir; `pnpm dev` onunla eksiksiz açılır. Kullanıcının `.env`'i varsa onu ezer.
  - Ajan `.env` dosyalarını okuyamaz ve yazamaz (izin kuralı).
  - Üretilen sırlar yalnızca `[A-Za-z0-9_-]` karakterlerinden oluşur (Compose `$`'ı yorumlar). Çok satırlı anahtarlar `*_BASE64` olarak verilir.
- **Replay ve simülasyon** yalnızca `APP_ENV=development|test` iken çalışır; açılışta doğrulanır.
- **Temizlik:** migration'lar temiz DB'de baştan sona çalışır, seed idempotenttir. Lint, typecheck ve testler sıfır hatayla geçer.
- **Adlandırma:**
  - Kod tanımlayıcıları, enum ve DB değerleri, loglar ve commit'ler İngilizce ve ASCII'dir (Yunan harfi de yoktur).
  - Arayüz metinleri yalnızca `packages/i18n`'dedir. Changelog ve yol haritası verisi TR/EN olarak `packages/shared`'dadır.
  - `docs/` Türkçedir.

## Geliştirici ortamı (Windows 11)
- **Repo:** `C:\PROJELER\havayolu` (ASCII, boşluksuz). `core.longpaths true`. `.gitattributes` LF'yi zorlar ve doğru yazılmıştır; yeniden yazma (gitattributes `{a,b}` sözdizimini desteklemez).
- **Script'ler:** `pnpm-workspace.yaml` içinde `shellEmulator: true`. package.json script'lerinde `rm -rf`, `export`, `VAR=x cmd` ve tek tırnak yasaktır; karmaşık işler `scripts/*.mts` olarak yazılır. `.sh` dosyaları yalnızca Linux konteynerinde çalışır.
- **Yerel portlar sabittir, env'den gelir.** Bu makinede 3000–3003 başka bir projenin konteynerlerindedir.
  - web 3100 · api 4100 · worker sağlık 4200
  - Postgres 45432 · redis-queue 46379 · redis-live 46380
  - Mailpit 48025/41025 · MinIO 49000/49001
  - Altyapı portları Windows'un dinamik port bölgesinin (49152+) altındadır; Hyper-V/WinNAT açılışta bu bölgeden rastgele aralık ayırır (`netsh interface ipv4 show excludedportrange protocol=tcp`, D-065).

  Konteyner içi portlar üretimde web 3000, api 4000'dir.
- **Uzun komutlar:** 2 dk'dan uzun sürebilecek her komut arka planda çalıştırılır: `pnpm dev`, `gh pr checks --watch --interval 30`, `gh run watch`, `pnpm record`, yük testi.
  - Compose her zaman `docker compose … up -d --wait --wait-timeout 300` ile başlatılır.
  - "no checks reported" hata sayılmaz; 1 dk sonra yeniden bakılır.
  - k6 kurulmaz; `docker run --rm -i grafana/k6` ile çalıştırılır.
- **Docker:** Docker gerektiren komutlardan önce `docker info` çalıştır. Hata verirse DUR ve kullanıcıdan Docker Desktop'ı açmasını iste.
- **Mobil:** Bu makinede iOS Simulator, Android SDK ve Maestro yoktur. iOS = EAS bulut build'i + gerçek cihaz. Android emülatörü ACTIVATION adımıdır.

## Bilinçli olarak kapsam dışı (v1)
Ödeme/abonelik ekranları, ticari veri sağlayıcı entegrasyonu (Parça 5), uçak fotoğrafları, hava radarı katmanı, 3B görünüm, ATC sesi, kilit ekranı canlı kartı/widget, konum tabanlı özellikler, telsiz çağrı adları, iz verisi arşivi, günlük ODbL dökümü (yerine yöntem belgesi), mobil OTA ve mobil CI.

## Komutlar
| Komut | İş |
|---|---|
| `pnpm install` | Bağımlılıkları kurar |
| `pnpm dev` | Web (3100) + API (4100) geliştirme sunucuları |
| `pnpm ci:local` | format + lint + typecheck + test + build |
| `pnpm ci:full` | `ci:local` + `test:integration` + `test:e2e` (ilgili testler eklendikçe; Docker gerekir) |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` | Tekil kontroller |
| `pnpm check:eol` | Depoda CRLF'li metin dosyası olmadığını doğrular |
| `pnpm typecheck:scripts` | `scripts/*.mts` tip denetimi |
| `pnpm dev:infra` · `pnpm dev:infra:down` | Yerel PostGIS, iki Redis ve Mailpit (Docker) |
| `pnpm test:integration` | Gerçek PostgreSQL/Redis testleri (önce `dev:infra`) |
| `pnpm compose:guard` | Üretim compose kurallarını denetler (Docker gerekir) |
| `pnpm format` | Prettier ile biçimlendirir |
| `pnpm changelog` · `pnpm changelog:check` | CHANGELOG.md üretir · sürüm ve changelog tutarlılığını denetler |
| `pnpm stats` | Satır sayısı |
| `pnpm backup` | Temiz zip yedek |
| `pnpm test:scripts` | Script testleri (deploy script'i: stub Dokploy, sahte saat) |
| `pnpm deploy:dokploy` | Yalnızca CI (`release`/`rollback` işleri) çalıştırır; yerelde çalıştırılmaz (canlı çağrı) |

Yerel üretim denemesi: `docker compose -p hy-localprod -f docker-compose.yml -f docker-compose.build.yml --env-file .env.example up -d --build --wait --wait-timeout 300` (sonra aynı komutla `down -v`).

Yayın ve geri alma: `docs/DEPLOY_DOKPLOY.md` (kurulum bir kez), `gh workflow run rollback.yml -f sha=<7>` (geri alma).

Sonraki kilometre taşları bu tabloya kendi komutlarını ekler: `dev:replay`, `test:e2e`, `db:migrate`, `db:seed`, `smoke:live`, `record`, `coverage:report`, `coverage:probe`.
