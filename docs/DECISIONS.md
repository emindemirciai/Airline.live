# Kararlar

Her karar tarih, gerekçe ve varsa alternatifiyle yazılır. En yeni karar en üsttedir.

## 2026-09-26 — Parça 1 M1b yayın hattı
- **D-065 Yerel altyapı portları 41xxx–49xxx aralığına taşındı.** Postgres 55432 → 45432, redis-queue 56379 → 46379, redis-live 56380 → 46380, Mailpit 58025/51025 → 48025/41025, MinIO 59000/59001 → 49000/49001.
  - Gerekçe: 2026-09-26 açılışında Windows 56336–56435 aralığını ayırdı (`excludedportrange`), iki Redis portu bağlanamadı ve dev altyapısı açılmadı. Bu ayrılmış aralıklar her açılışta Windows'un dinamik port bölgesinden (49152–65535) rastgele seçilir. O bölgenin altındaki portlar etkilenmez.
  - Alternatif `winnat` servisini yeniden başlatmaktı; sistem ayarı değiştirmek olduğu ve her açılışta yinelenebileceği için seçilmedi. Uygulama portları (3100, 4100, 4200) zaten bu bölgenin altındadır.
- **D-064 İmaj derleme ile `:main`'in taşınması ayrı işlerdir.**
  - Matris `build` işi yalnızca `sha-<7>` etiketini gönderir. `:main`, seri çalışan `release` işinde (`deploy-prod`) ve yalnızca commit hâlâ `main`'in ucundaysa `docker buildx imagetools create` ile taşınır.
  - Gerekçe: GitHub aynı eşzamanlılık grubunda bekleyen eski çalışmayı iptal eder ama paralel derlemeler farklı sürelerde biter. `:main`'i derleme işinde göndermek, geç biten eski bir derlemenin yenisinin üstüne yazmasına izin verirdi. Dokploy compose dosyasını da `main`'in ucundan klonladığı için imaj ile compose tutarlı kalır. Rollback aynı yeniden etiketleme yöntemini kullanır; yeniden derleme yoktur.
  - `main`'e her push yayın işini çalıştırır; "yalnızca belge ya da mobil değişti" kararı **canlıdaki sürüme** göre verilir (canlı `/version` ile bu commit arasındaki `git diff`). İlk tasarımda bu karar `dorny/paths-filter` ile son push'a göre veriliyordu. Birleştirme öncesi inceleme şu hatayı gösterdi: kod birleşmesi X'in arkasından belge birleşmesi Y gelirse X'in `release`'i daha yeni uç (Y) yüzünden atlanıyor, Y'nin CI'ı da "yalnızca belge" diye yayın yapmıyordu; X hiç yayınlanmıyor ve her şey yeşil görünüyordu. Canlı sürüm okunamazsa ya da fark hesaplanamazsa yayın yapılır.
  - `DEPLOY_ENABLED` `true` değilse yayın özetle atlanır, iş yeşildir. `true` iken eksik ayar ya da başarısız yayın işi kırmızıya çevirir; sessizce atlamak yanlış bir güven verirdi.
  - Deploy script'i (`scripts/deploy-dokploy.mts`) yeni deployment'ı "önceki listede olmayan ilk kimlik" olarak bulur. Başlık, git kaynaklarında Dokploy tarafından commit mesajıyla ezilir; kuyruk süresine izin verilir (Dokploy v0.30.7 doğrulaması, research/2026-09-25).
  - GitHub environment kullanılmaz: secrets repo düzeyindedir, yayın yalnızca `main` push'unda ve `release` işinin uç kontrolünden sonra çalışır.
  - Dokploy'un geçici hataları (ağ, zaman aşımı, 5xx, 429) deployment beklenirken tolere edilir: yayın sürerken tek bir 502 işi kırmızıya çevirip gereksiz ikinci bir yayına yol açmamalı.
  - `actionlint` Docker imajı digest'iyle sabitlenir. Üçüncü taraf action'lar commit SHA'sıyla sabitlenir (docker/*, pnpm/action-setup).
  - Kurulum rehberindeki güvenlik duvarı adımı Traefik için `ufw route allow` kurallarını içerir. İlk taslakta bunlar yoktu ve rehber izlenseydi paylaşılan VPS'teki bütün siteler düşerdi; bunu da inceleme yakaladı.

## 2026-09-25 — Birleştirme öncesi inceleme ve repo koruması (v0.3.2)
- **D-063 Dokploy şablonunda boş alanlar `ANAHTAR=#talimat#` biçimindedir (kullanıcı talebi).** Docker Compose bu metni yorum değil değer olarak okur; `ANAHTAR= #talimat#` de aynıdır (Docker 29 ile ölçüldü). Yalnızca bir değerden sonra gelen `#` yorumdur. Bu yüzden:
  - api, worker ve web `#…#` biçimindeki değeri tanımsız sayar (`packages/shared` → `withoutEnvPlaceholders`). "Boş bırak" satırları olduğu gibi kalabilir.
  - Parolalar compose'da bağlantı adreslerine gömülür. Adreste `#` kalırsa (üretilen sırlarda `#` olmaz) API açılmayı reddeder ve hangi parolanın doldurulmadığını yazar.
  - `compose:guard`, sır satırlarında `#…#` dışında değer bulunmadığını ve talimatların `$` içermediğini denetler.
  - Bilinen sınır: Postgres parolası ilk açılışta volume'a yazılır; ilk deploy'dan önce girilmezse volume yeniden oluşturulmalıdır (veri yokken).
- **D-062 Analiz env adları `ANALYZE_` önekiyle yazılır (kullanıcı kararı).** Kullanıcının diğer projelerinde `ANALYTICS_` adları hataya yol açtı; Siteni Analiz Et uygulamasının kendi değişkenleri de `ANALYZE_` önekli. Web ve API `ANALYZE_URL` ile `ANALYZE_SITE_ID`'yi okur (değer, analiz uygulamasının `ANALYZE_SITE_ID`'siyle aynıdır); belgelerdeki host adı `ANALYZE_HOST`'tur. Henüz yayın olmadığı için eski adlar için geçiş desteği tutulmaz.
- **D-060 İstemci IP'si, hız sınırı ve üretim env sözleşmesi.** Çok ajanlı inceleme (4 açı + çürütmeye çalışan doğrulayıcılar) şunu gösterdi: web API'yi iç ağdan çağırdığı için bütün ziyaretçiler tek bir hız sayacına düşüyordu. Dakikada 5 yanlış giriş yöneticiyi kilitliyordu, ~150 `/durum` açılışı API'yi 429'a sokuyordu.
  - Web, ziyaretçinin `X-Forwarded-For` ve `CF-Connecting-IP` başlıklarını iletir. API yalnızca `TRUSTED_PROXY_CIDRS`'teki adreslerden gelen zincire güvenir; üretimde bu değişken zorunludur, compose boşsa Docker'ın özel ağlarını verir. Ön koşul: uygulama konteynerleri dışarıya port açmaz. Kabul edilen sınır: Dokploy alan adı olan her servisi paylaşılan `dokploy-network`'e bağlar; VPS'teki diğer projelerin konteynerleri de bu özel ağlardadır ve kendi hız sınırı anahtarlarını seçebilir. Traefik aynı alt ağda olduğu için IP ile ayırt edilemez; diğer projeler aynı sahibindir.
  - `CF-Connecting-IP` yalnızca isteği ileten adres Cloudflare'in yayımlanmış ağlarındaysa kullanılır (liste koda gömülü, kaynak cloudflare.com/ips). Alternatif (yalnızca `X-Forwarded-For`) Traefik'in Cloudflare'e güvenmesini gerektirirdi; Dokploy ayarına bağımlı olmamak için seçilmedi.
  - `/health`, `/version`, `/openapi.json` hız sınırı dışında; `/ready` veritabanına dokunduğu için sınır içinde. Sayaç deposu hatasında istek geçer (`skipOnError`); aksi hâlde redis-queue kesintisi API'yi sağlıksız sayıp trafikten düşürüyordu.
  - `.env.example` Dokploy'a olduğu gibi kopyalanmaz (D-027'nin "hepsini gir" kısmını değiştirir): geliştirme parolaları, localhost host'ları ve `EXTERNAL_PROVIDERS_DISABLED=true` üretime taşınırdı. `GIT_SHA` dosyadan çıkarıldı (env_file imajdaki değeri eziyordu, boşsa servisler çöküyordu); üç şema da boş değeri tolere eder. `EXPECTED_WORKERS` üretimde compose'da sabittir. Üretim env bloğu `deploy/dokploy.env.example`'dadır (analiz uygulaması: `deploy/analiz.env.example`). `pnpm compose:guard` şunları denetler: compose'un okuduğu her değişken şablondadır, şablondaki her anahtar `.env.example`'da açıklanmıştır, compose/imaj anahtarları şablona yazılmaz, sır değerleri boştur, yerel değer yoktur.
  - Diğer düzeltmeler: Postgres sağlık kontrolü TCP ile yapılır (PostGIS ilk kurulumunda geçici sunucu yalnızca soketi dinler; CI ve ilk deploy yarışı); `/ready` sürücü hata metnini vermez; admin alan adında `/dil` çalışır; worker Redis kesintisinde kapanışta takılmaz; web `build` görevi `typecheck`'ten sonra çalışır (`.next/types` yarışı).
  - Çürütülen bulgu: migrate'in `lock_timeout=5s` değerinin advisory lock beklemesini de sınırlaması tasarım gereğidir (tek migrate servisi, hızlı başarısızlık).
- **D-061 Repo herkese açık, `main` korumalı (kullanıcı kararı; D-025'in yerini alır).** GitHub Free'de özel repoda kural seti ve dal koruması yoktur (API 403). Seçenekler: GitHub Pro (4 $/ay), herkese açık repo, yalnızca yerel koruma. Kullanıcı herkese açık repoyu seçti.
  - Açmadan önce bütün git geçmişi sır, anahtar, `.env` ve kişisel veri açısından tarandı; bulgu yok. VPS IP'si zaten DNS'te herkese açık.
  - Kural seti `main-koruma`: silme ve force push yasak, yalnızca PR ve yalnızca merge commit, zorunlu kontroller `checks` ve `test-integration`, bypass yok. Gizli bilgi taraması, push koruması ve bağımlılık uyarıları açık.
  - Sayfa kaynağında (HTML yorumu, `author`/`copyright` meta, `rel="license"`) sahiplik ve MIT bildirimi bulunur. MIT kopyalamaya izin verir; tek şartı kopyaların ve önemli bölümlerin telif bildirimini ve lisans metnini içermesidir, ihlal bunların olmadan kopyalamak ya da dağıtmaktır. "havayolu" adı ve logosu MIT kapsamında değildir; üçüncü taraf verileri kendi lisanslarındadır.

## 2026-09-25 — Marka ve alan adı
- **D-059 Marka `havayolu`, alan adı `havayolu.live` (kullanıcı kararı; D-001'in yerini alır).** Repo `emindemirciai/havayolu` (D-061 ile herkese açık). Host'lar: `havayolu.live` (web; `www` köke 308 ile yönlenir), `api.havayolu.live`, `admin.havayolu.live`, `analiz.havayolu.live`.
  - Adlar: paket kapsamı `@havayolu/*`, GHCR imajları `ghcr.io/emindemirciai/havayolu-{web,api,worker}`, compose servis öneki `hy-`, Redis/çerez/olay öneki `hy`.
  - Yerel klasör `C:\PROJELER\havayolu`. Yedek klasörü kullanıcı isteğiyle masaüstündedir (`<Masaüstü>\havayolu-yedek`); `pnpm backup` masaüstünün gerçek yolunu Windows'tan sorar, `BACKUP_DIR` ile değiştirilebilir.
  - Uçuş sayfası yolu `/ucus/<flightId>` markadan bağımsızdır (Türkçe "uçuş") ve kalır.
  - Eski kod adı kullanıcı isteğiyle repodaki bütün belgelerden, yerel klasörlerden, yedek adlarından ve Docker imajlarından kaldırıldı; her yerde yalnızca `havayolu` kullanılır.

## 2026-09-25 — Parça 1 M1a uygulama kararları
- **D-051 ioredis 6 RESP2 ile kullanılır (`protocol: 2`).** ioredis 6 varsayılan olarak RESP3'e geçti. BullMQ ve Lua script'leriyle yanıt biçimi öngörülebilir kalsın diye RESP2 seçildi.
- **D-052 MinIO geliştirme compose'una eklenmedi.** MinIO artık Docker Hub'da imaj yayımlamıyor. S3 emülatörü yalnızca yedek testleri için gerekiyor; Parça 2 M9'da güncel bir alternatif seçilecek.
- **D-053 Turbo `envMode: loose`.** Turbo 2'nin strict modu kabuktan verilen değişkenleri (ör. yerel `ADMIN_EMAIL`) geliştirme sunucularına aktarmıyordu. Önbellekli görevler (`build`) değişkenlerini zaten açıkça listeler.
- **D-054 API, worker ve migrate tek dosyaya paketlenir (esbuild, bağımlılıklar dahil).** Üretim imajları `node_modules` taşımaz; imajlar 336–387 MB, boşta toplam bellek ~270 MB.
- **D-055 `@havayolu/db` = veri depoları paketi.** PostgreSQL (Drizzle) ile birlikte Redis istemci fabrikası ve worker heartbeat yardımcılarını da içerir.
- **D-056 Yönetici oturumu:** opak rastgele token, Redis'te SHA-256 özetiyle, 7 gün geçerli. Web tarafında `hy_admin` çerezi httpOnly, SameSite=Strict ve yalnızca `/admin` yolunda gönderilir.
- **D-057 Beklenen worker listesi env'den gelir** (`EXPECTED_WORKERS`; üretimde `worker-rt,worker-bg`). Heartbeat'i olmayan beklenen worker panelde "Çalışmıyor" görünür.
- **D-058 Onay sabitleri ortak modüldedir (`lib/consent.ts`).** Next.js'te `'use client'` dosyasından sunucu bileşenine sabit import edilemez; değer yerine istemci referansı gelir.

## 2026-09-25 — Parça 1 M0 uygulama kararları
- **D-046 turbo 2.11.3 ve vitest 5.0.1'e sabitlendi.** 2.11.4 ve 5.0.2 24 saatten yeniydi; pnpm bunları `minimumReleaseAgeExclude` istisnasıyla kurmak istedi. Tedarik zinciri korumasını delmek yerine bir önceki sürümler seçildi.
- **D-047 API portu ortama göre varsayılır.** `API_PORT` boşsa üretimde 4000 (konteyner), yerelde 4100 kullanılır. Dinleme adresi `API_LISTEN_HOST`'tur; `API_HOST` genel alan adıdır.
- **D-048 Geliştirmede env yükleme sırası `.env` → `.env.example`.** Ajan `.env` okuyamaz ve yazamaz; uygulama `.env.example`'daki sır olmayan varsayılanlarla eksiksiz açılır.
- **D-049 `next-env.d.ts` git'e girmez.** `next typegen` üretir; biçim denetiminden de çıkarıldı.
- **D-050 Dil tercihi M0'da çerezle tutulur.** URL tabanlı `/en/...` yönlendirmesi Parça 3 M2'de gelir.

## 2026-09-25 — Dört açılı inceleme sonrası düzeltmeler ve yeni kullanıcı kararları
Yeniden yazılan prompt seti dört bağımsız inceleyiciden geçti: sadakat, tutarlılık, yürütülebilirlik, hedefe uygunluk ve dil. 129 bulgunun kabul edilenleri işlendi.

**Repo, yayın ve kaynaklar**
- **D-025 Repo özel, plan GitHub Free (kullanıcı kararı).** (D-061: repo herkese açık, `main` kural setiyle korunur; açık repoda CI dakika sınırı yok.)
  - Dal koruması ve environment yok. Secrets repo düzeyinde tutulur.
  - CI ayda 2.000 dk ile sınırlı: PR çalışmaları iptal edilebilir, imajlar yalnızca `main`'de derlenir.
  - Repoyu kullanıcı web'den açar; ilk push'u ajan yapar.
- **D-026 PR'ları ajan birleştirir (kullanıcı kararı).** CI yeşilse merge commit ile birleştirir (squash ve rebase yok), sonra yayını doğrular. Kırmızı PR birleştirilmez. D-019'daki "yalnızca kullanıcı birleştirir" kuralının yerini alır.
- **D-027 Bütün servisler Parça 1'de tanımlanır (kullanıcı talebi: "sonradan tek tek uğraşmayalım").**
  - Servisler: web, API (WS), admin (aynı web konteyneri, `ADMIN_HOST`), iki worker, migrate, Postgres, iki Redis.
  - `.env.example` bütün parçaların değişkenlerini baştan içerir; kullanıcı Dokploy'u bir kez kurar. (D-060: dosya Dokploy'a olduğu gibi kopyalanmaz; üretim bloğu `deploy/dokploy.env.example`'dadır.)
- **D-028 Analiz = kullanıcının kendi uygulaması (Siteni Analiz Et, MIT).** Umami değerlendirildi, kullanıcı kendi reposunu seçti.
  - Ayrı bir Dokploy Compose uygulamasıdır; bizim API'miz onun platform-admin giriş sözleşmesini karşılar (`/api/auth/login`, `/api/admin/session`, `/api/auth/me`).
  - Takip script'i kalıcı `localStorage` kimliği tuttuğu için yalnızca kullanıcı onayıyla yüklenir (KVKK Çerez Rehberi).
  - `ANALYZE_GEO_LOOKUP=false` önerilir: ip-api.com'un ücretsiz katmanı ticari kullanıma kapalıdır ve HTTP kullanır.
- **D-029 Lisans: kod MIT (kullanıcı talebi).** Veri kendi lisansındadır: adsb.lol ODbL, OurAirports kamu malı, VRS CC0, OSM ODbL.
- **D-030 Yerel portlar 3100/4100 vb.** Bu makinede 3000–3003 başka bir projenin konteynerlerinde. Konteyner içi üretim portları değişmez.
- **D-031 adsb.lol hız bütçesi yarıya indi.** Başlangıç 0,1 istek/sn, üst sınır 0,2. Tazelik hedefleri: IST ≤ 20 sn, diğer istasyonlar ≤ 30 sn, Doğu ≤ 90 sn. Doğrulanan ölçüm "10 sn'de bir ya da daha yavaş" diyordu; önceki 0,2/0,5 değerleri bunun iki katıydı.
- **D-032 Web ve API host'ları ayrı env'lerdir** (`WEB_HOST`, `API_HOST`, `ADMIN_HOST`, `ANALYZE_HOST`). `api.` öneki türetilmez. Kalıcı domain seçilene kadar geçici host kullanılır.
- **D-033 Dokploy secrets yokken deploy `DEPLOY_ENABLED` değişkeniyle atlanır.** İş özetine "YAYINLANMADI" yazılır (D-023'ün uygulaması).

**Veritabanı ve yedekleme**
- **D-034 Yedeği uygulamanın kendi job'ı alır (`hy-worker-bg`).** Dokploy Compose Backups kullanılmaz: komutu sabittir ve iz tablolarını dışlayamaz.
  - İz tabloları yedeğe girmez; v1'de partition arşivi ve günlük ODbL dökümü yoktur.
  - `/acik-veri` sayfası ODbL 4.6(b) uyarınca yöntem belgesi sunar.
- **D-035 Partition bakımında `DETACH … CONCURRENTLY` kullanılmaz** (DEFAULT partition varken PostgreSQL izin vermez). Silme gece yapılır: `lock_timeout` ile `DETACH` + `DROP`.
- **D-036 Drizzle ile partition:** Parent tablolar şemada `pgTable` olarak tanımlanır, üretilen SQL elle `PARTITION BY` ile düzenlenir, çocuklar özel SQL'dir. `drizzle-kit push` ve `pull` kullanılmaz.
- **D-037 PG 18 volume yolu `/var/lib/postgresql`'dir** (`/data` değil).

**Ürün ve iniş tespiti**
- **D-038 İniş tespitinde `low` güven ve `landing_unknown`.** Alıcı olmadığı için bazı uçaklar yüksekte kaybolur; takip asla sessizce bitmez, "iniş verisi alınamadı" bildirimi gider. `landing_unverified` olayı eklendi. Bütün motor eşikleri domain.md'de toplandı.
- **D-039 Kapsama raporu üretim verisinden çıkarılır** (`coverage:report`). Kullanıcının bilgisayarında 24 saat çalışan probe yalnızca yedek yoldur.
- **D-040 Proje sahibinin ilk bildirimi SMTP'ye bağlı değildir.** Giriş Parça 1'deki yönetici oturumuyla yapılır (`ADMIN_EMAIL` + `ADMIN_SETUP_TOKEN`). VAPID anahtarlarını kullanıcı üretir; ajan çıktıyı görmez.
- **D-041 Kilometre taşları bölündü ve `[k]` durumu eklendi.** Bölünenler: P1 M1a/M1b, P2 M8a/M8b, P3 M3a/M3b ve M6a/M6b, P4 M2a/M2b. `[k]` = kod bitti, kullanıcı doğrulaması bekliyor.
- **D-042 Replay ve senaryo araçları Parça 1 M4'e alındı.** M6 E2E testleri bunlara bağlıdır. Harita testleri canvas yerine erişilebilir "görünen uçaklar" tablosunu okur.
- **D-043 v1 kapsamı daraltıldı.** Çıkarılanlar: telsiz çağrı adları, iz partition arşivi, günlük ODbL dökümü, mobil CI ve OTA. Yük testi 200 WS istemcisiyle, performans testi 500 uçakla yapılır.
- **D-044 Saatlik push sınırı:** `free` planda 60, admin için sınırsız. Açıkça takip edilen uçuşun iniş bildirimi özete çevrilmez. Takip kurmak tek dokunuştur; ayrıntılar "Ayrıntılı ayarlar" altındadır.
- **D-045 Terimler sabitlendi.** "Uyarı mesafesi" / "pist eşiği" (tek başına "eşik" yazılmaz), "uçuş kaydı" (örnek değil), "iniş" üst terimi, "bildirim merkezi", "Uçağı ortala" (takip değil), "harfli numaralı çağrı kodu".

## 2026-09-25 — Kullanıcının kalıcı teslimat talepleri ve araç sürümleri
- **D-021 TypeScript 6.0.x'e sabitlendi.** npm `latest` TS 7.0 (native derleyici). typescript-eslint 8.70'in peer aralığı `typescript <6.1`. TS 7'ye geçiş, typescript-eslint desteği gelince ayrı PR ile yapılır.
- **D-022 Her iş sonrası teslimatlar (kullanıcı talebi):**
  - sürüm artırma ve Yenilikler: tek kaynak `packages/shared/src/changelog/entries.ts`; bundan `CHANGELOG.md` ve `/yenilikler` üretilir
  - TR/EN README
  - satır sayısı
  - yerel test ortamı
  - `git archive` zip yedeği
  - yeşil CI

  Sürümleme 1.0 öncesinde: birleşen kilometre taşı MINOR, düzeltme PATCH. v1.0.0 herkese açık lansmandır.
- **D-023 Dokploy kurulmadan deploy adımı atlanır, CI yeşil kalır.** Kullanıcı "Dokploy'da ve CI'da hata istemiyorum" dedi.
- **D-024 İlk kuruluş commit'i doğrudan `main`'e atıldı.** Bu, `main`'e yapılan tek doğrudan push olur. Sonraki işler kilometre taşı dalları ve PR'larla ilerler.

## 2026-09-25 — Proje kuruluşu ve prompt setinin revizyonu
İlk prompt seti (ortak bağlam + 4 parça, 5 dosya) 17 ajanlı bir doğrulamadan geçirildi: kaynak doğrulama, şüpheci ikinci kontrol ve üç açıdan eleştiri. Ham notlar `docs/research/` altındadır.

**Kapsam, kaynaklar ve lisanslar**
- **D-001 Ad ve domain boş bırakıldı.** Kullanıcı "touchdown" istedi; .com/.app/.io/.net/.dev/.live/.aero uzantılarının hepsi kayıtlı çıktı (RDAP). Proje geçici bir kod adıyla başladı; ad ve domain env'den okunur. D-059 ile ad `havayolu`, domain `havayolu.live` oldu.
- **D-002 İmajlar GitHub Actions'ta derlenir ve GHCR'a gönderilir; Dokploy yalnızca çeker.** VPS paylaşımlı; Dokploy'un kendi dokümanı sunucuda build'in sunucuyu dondurabileceğini söylüyor.
- **D-003 v1'de yalnızca ücretsiz veri kullanılır.** adsb.lol tek canlı kaynaktır. Ticari tarife sağlayıcısı Parça 5'e bırakıldı.
- **D-004 Birincil istasyon IST (LTFM).**
- **D-005 İki kullanım eşit:** tek uçuş takibi ve istasyon operasyonu (tam ekran operasyon panosu).
- **D-006 Kendi ADS-B alıcısı yok (kullanıcı kararı).** `probable_landing` birinci sınıf bir yoldur; `LOCAL_RECEIVER_URLS` desteği kodda hazır bekler.
- **D-007 adsb.lol gerçekleri:**
  - açık User-Agent zorunlu
  - CORS yok
  - hız limiti dinamik, 429'da Retry-After yok
  - istasyon başına ayrı çember yerine birleşik ≤ 250 NM çember
  - ileride API anahtarı gelecek (env hazır)

  Hız değerleri D-031 ile güncellendi.
- **D-008 Rota kaynağı VRS standing-data (CC0).** adsb.lol `routeset` Referer korumalıdır; gizli `route` güvenilmezdir.
- **D-009 Havayolu kaynağı VRS standing-data (CC0).** OpenFlights kullanılmaz.
- **D-010 FR24 resmi API'si yasak** (ToS 6.3.1). FlightAware AeroAPI ancak yazılı karıştırma izniyle kullanılabilir.
- **D-011 ODbL yükümlülükleri kabul edildi.** Kullanıcı verisi ayrı şemada tutulur. Ücret veriye değil özelliklere alınır.

**Mimari ve araçlar**
- **D-012 Redis ikiye bölündü:** `redis-queue` (BullMQ, AOF, noeviction) ve `redis-live` (kalıcı değil, volatile-ttl).
- **D-013 İz verisi iki tabloya bölündü:** sampled 7 gün, fine 30 gün.
- **D-014 Tek seferlik `hy-migrate` servisi** ve expand/contract migration kuralı.
- **D-015 Worker üretimde ikiye bölündü:** `hy-worker-rt` ve `hy-worker-bg`.
- **D-016 Doğrudan APNs yolu yazılmaz.** Expo push, `interruptionLevel: "time-sensitive"`'ı destekliyor.
- **D-017 Fontlar:** B612 Türkçe glif içermiyor. Arayüzde Overpass, veride IBM Plex Mono kullanılır.
- **D-018 Sürüm sabitleri CLAUDE.md'dedir.**

**Çalışma ve süreç**
- **D-019 Git akışı:** kilometre taşı dalları ve PR'lar; `main` = üretim. Birleştirme yetkisi D-026 ile ajana verildi.
- **D-020 Kilometre taşı sırası temel vaade göre düzenlendi.** Yayın hattı Parça 1 M1'de, proje sahibine ilk gerçek bildirim Parça 2 M4'te gelir. Yedekleme, kayıt üretimde açılmadan önce (Parça 2 M9) kurulur. M5–M8 sırasında üretimde yalnızca admin hesabı vardır (`REGISTRATION_ENABLED=false`).
