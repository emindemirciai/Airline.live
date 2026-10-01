# Parça 2 — Olay motoru, ilk gerçek bildirim, hesaplar ve takip

**Başlatma:** `@docs/prompts/parca-2.md dosyasındaki Parça 2'ye başla`
**Önce oku:** `docs/reports/parca-1.md`, `docs/reports/kapsama.md`, `docs/spec/domain.md` (tamamı), `docs/spec/data-sources.md` §1 ve §4–5, `docs/spec/infra.md` ("Yedekleme", "Gözlem ve uyarı", "Analiz").

## Hedef
- **2A:** Proje sahibi (`ADMIN_EMAIL`), gerçek IST varışları için "10 km" ve iniş bildirimlerini kendi telefonunda alır. Hem tek uçuş takibi hem filtreli istasyon akışı denenir. Bu, ürünün temel vaadinin ilk gerçek kanıtıdır.
- **2B:** Kullanıcı hesap açar; bir uçuşu, uçağı ya da filtreli istasyon akışını takibe alır.
  - Olaylar üç kanaldan iletilir: web push, mobil push (gönderici hazır; uygulama Parça 4'te) ve bildirim merkezi.
  - Kullanıcı verisi üretime açılmadan önce yedekleme kurulur.

IST'de iniş bildiriminin hangi yoldan geleceğini `docs/reports/kapsama.md` belirler: kesin, muhtemel ya da düşük güven. `probable_landing` birinci sınıf bir yol olarak tasarlanır ve test edilir. **Motorun bütün eşikleri `docs/spec/domain.md`'dedir**; bu dosya onları tekrar etmez.

## 2A — Olay motoru ve proje sahibine ilk bildirim

### M1 — Geo ve saf motor (`p2/m1-engine`)
- **`packages/geo`:**
  - büyük daire mesafesi ve yön (mevcut)
  - eşiğe ve merkez hattına yanal sapma
  - pist hizası
  - yumuşatılmış yaklaşma hızı ve tahmini varış
  - kaydırılmış eşik hesabı
  - **AGL fonksiyonu:** domain.md → "AGL yöntemi"; üç yöntem, saf. QNH, geoid N ve alan yüksekliği girdi olarak verilir.
- **`packages/engine`** (saf, IO yok):
  - Her uçak için son N konum örneğini tutan halka tampon, uçuş kaydı ve aday istasyonlar tutulur.
  - Durumlar, geçişler, olaylar ve eşikler domain.md'deki gibidir: tespit eşikleri, `high/medium/low` güven, `landing_unverified`, `landing_unknown`, kesinti bastırma, idempotensi ve doğrulama.
  - Rota bilgisi girdi olarak verilir (VRS içe aktarımı M2'dedir).
  - Aynı örnek dizisi her zaman aynı olayları üretir. Sıra dışı gelen eski örnekler atlanır.
- **Senaryolar** (`tools/scenarios`, IST pistleri üzerinde; her biri beklenen olay listesi ve zaman toleransıyla test edilir):
  1. düz ILS yaklaşması, yerde örnekli iniş → `touchdown` (ALDT ±5 sn)
  2. düz yaklaşma, 250 ft'te sinyal kaybı → `probable_landing` `high`
  3. 800 ft'te sinyal kaybı → `probable_landing` `medium`
  4. pas geçme ve ikinci yaklaşmada iniş
  5. kalkış
  6. FL350'de üstten geçiş (olay yok)
  7. 20 km içinde bekleme paterni (yanlış yaklaşma uyarısı yok)
  8. 600 ft'te sinyal kaybı, sonra yerde görünme → `probable_landing` → doğrulama; ikinci push yok
  9. SAW'a iniş (IST için olay üretmemeli)
  10. rotası bilinmeyen varış
  11. IST finalinde 3 uçak varken sağlayıcı 120 sn `degraded` → sıfır `probable_landing`, 3 `landing_unverified`
  12. örnekleme aralığı 5, 10 ve 20 sn iken senaryo 1 ve 2 (teker koyma toleransı = aralık + 5 sn; doğrulama penceresi domain.md'deki gibi)
  13. 2.000 ft'te, eşiğe 12 km'de sinyal kaybı → push yok, `low` kaydı; takip `landing_unknown` ile kapanır ve "iniş verisi alınamadı" bildirimi üretilir
- **Kabul:**
  - `engine` ve `geo` paketlerinde vitest `coverage.thresholds.lines = 90` CI'da zorlanır.
  - Tüm senaryolar geçer. Senaryo 5, 6, 7, 9 ve 11'de yanlış push yoktur.

### M2 — Referans, rota ve METAR (`p2/m2-reference`)
- **VRS rota içe aktarımı** (data-sources.md §4): günlük, ETag ile. Havayolları Parça 1'de gelmiştir; bu kilometre taşında `usesAlphanumericCallsigns` bayrağı ve admin düzeltme tabloları eklenir.
- **Rota tahmini:** Çağrı kodundan rota bulunur ve uygunluk yerelde hesaplanır. Sonuç "tahmini" olarak işaretlenir. Negatif önbellek her günlük içe aktarımda tazelenir.
- **Sefer no → çağrı kodu adayı:** TK1985 → THY1985 (IATA tekil değildir; data-sources.md §4).
- **METAR/TAF:** Parça 1 M6c'de geldi (D-078): 61 havalimanı, METAR 5 dk'da, TAF 15 dk'da bir, 30 günlük kayıt, `weather_metar.qnh_hpa`, havalimanı sayfasında ve harita penceresinde çözümlenmiş hava durumu. Bu kilometre taşında yalnızca AGL bağlantısı kalır: QNH `weather_metar.qnh_hpa`'dan, `observed_at` 90 dk'dan yeniyse.
- **AGL girdileri:** M1'deki fonksiyon için METAR QNH'si ve istasyon geoid değeri sağlanır. Geoid değeri `egm96-universal` `meanSeaLevel(lat, lon)` ile istasyon başına bir kez hesaplanır ve `stations.geoid_undulation_m`'de saklanır. Paket yalnızca engine/worker'da kullanılır.
- **Kabul:**
  - Geoid birim testleri: LTFM ≈ 37,05 m, SAW ≈ 37,61 m, AYT ≈ 27,36 m (±0,5 m).
  - METAR ayrıştırıcısı commit'li fixture'larla test edilir.
  - VRS içe aktarımı idempotenttir; AJet (TKJ/VF) ve THY (THY/TK) doğru eşlenir.

### M3 — Motor worker'ı (`p2/m3-engine-worker`)
- **Tüketim:** Worker `engine` rolü `ac:updates` stream'ini tüketici grubuyla okur. `NOGROUP` hatasında grubu `XGROUP CREATE … MKSTREAM` ile yeniden kurar; askıdaki mesajları `XAUTOCLAIM` ile alır.
- **Durum:** Minimal durum `redis-queue`'da tutulur ve yeniden başlatmada geri yüklenir.
- **Yazım:** Olaylar `events` tablosuna yazılır, `flights` özeti güncellenir. Sınıflandırma geldiği için `track_points_fine` kuralı domain.md "Saklama"daki tam hâline daraltılır.
- **Performans:** `pnpm bench:engine`, `tools/fixtures/replay/LTFM-*.jsonl` varsa onu, yoksa `tools/scenarios` ile üretilen 3.000 uçaklık 10 dk'lık sentetik akışı tek çekirdekte besler. Hedef ≥ 2.000 güncelleme/sn. Kaynak, CPU modeli ve Node sürümü rapora yazılır.
- **Kabul:**
  - Bench hedefi karşılanır.
  - Yeniden başlatma testi: süreç ortada öldürülür; olaylar yinelenmez ve kaybolmaz. Açılıştan sonraki 120 sn içinde oluşan iniş adayları kesinti bastırma kuralına göre `landing_unverified` olur; bu kayıp sayılmaz ve testte beklenir.

### M4 — Proje sahibine ilk gerçek bildirim (`p2/m4-owner-push`)
- **Web Push:**
  - VAPID anahtarlarını **kullanıcı** üretir: `pnpm vapid:generate` (DUR; ajan çalıştırmaz ve çıktıyı görmez). Çıktı parola yöneticisine ve Dokploy Environment'a yazılır. Ajan env biçimini doğrulayan zod şemasını ve testini yazar.
  - Subject `mailto:` ya da https URL olmalı, localhost olamaz.
  - `web-push@3.6.7` kullanılır. 404/410 yanıtında abonelik silinir.
  - Yük **Declarative Web Push** biçimindedir: `{"web_push":8030,"notification":{title, body, navigate:"/?hex=…", …}}`. Service worker aynı JSON'u Chrome/Firefox/Android için ayrıştırır.
- **`notifier` rolü** bu kilometre taşında web push için başlatılır; M7 onu genişletir.
- **`follows` tablosu** ilk sürümüyle kurulur; M6 genişletir. Proje sahibinin takipleri buraya yazılır ve P1 toplu sorgusuna eklenir (`WATCH_HEX_LIST` yerine).
- **Kurulum sayfası:** Parça 1'deki admin alanına eklenir: `ADMIN_HOST/bildirim-kurulumu`. Giriş Parça 1'deki yönetici oturumuyla yapılır; SMTP gerekmez. Sayfada:
  - service worker kaydı
  - "Bildirimlere izin ver" düğmesi (izin yalnızca düğmeyle ve nedeni açıklanarak istenir)
  - iOS'ta Ana Ekrana Ekle yönergesi (standalone değilse)
  - hex, tescil ya da çağrı kodu ile takip ekleme
  - istasyon akışı ekleme: istasyon + havayolu/tip/çağrı kodu öneki filtresi
  - "Test bildirimi gönder"

  Parça 3 bu sayfayı tasarım sistemiyle yeniden yazar. Bu sayfa placeholder sayılmaz.
- **Şablonlar** (TR/EN, `packages/i18n`):
  - "TK1985 (TC-JJA) IST'ye 10 km — inişe yaklaşık 2 dk"
  - "TK1985 IST'de teker koydu — 14:32, pist 34L"
  - "TK1985 büyük olasılıkla IST'ye indi — tahmini 14:32 (iniş anı doğrudan görülmedi)" (`high`)
  - "TK1985 muhtemelen IST'ye indi — tahmini 14:32 (iniş anı doğrudan görülmedi)" (`medium`)
  - "TK1985 için iniş verisi alınamadı: uçak IST yakınında alçak irtifada kapsama dışına çıktı"
  - "TK1985 IST'de pas geçti"
- **Ölçüm:** İki gecikme raporlanır:
  - (a) motorun olayı yayınlaması → push sağlayıcısının 2xx yanıtı; hedef p95 < 3 sn
  - (b) örneğin `sampleTime`'ı → push sağlayıcısının kabulü; tazelik katmanı başına p50/p95
- **Kabul:**
  - Stub web push sunucusuna karşı zincir testi geçer: replay → olay → push.
  - Kullanıcıya bağlı `[k]`: gerçek dünya doğrulaması. Önkoşul: yayındaki `WEB_HOST` HTTPS ve iPhone'da PWA ana ekrana eklenmiş olmalıdır.
    - Proje sahibi en az 20 gerçek IST varışında bildirim alır: en az 10'u tek uçuş/uçak takibiyle, en az 10'u filtreli istasyon akışıyla (ör. IST + THY).
    - Gerçek iniş saatini havalimanının ya da havayolunun herkese açık uçuş durumu sayfasından elle not eder (kazıma yok).
    - Rapor her varış için şunları listeler: gelen bildirimler, `touchdown`/`probable_landing`/`low`, tahmini ile gerçek iniş saati arasındaki fark, kaçan ve yanlış olaylar.
    - Sonuç iyi değilse DUR-SOR (eşik ayarı gerekebilir).

## 2B — Hesaplar, takip, bildirim kanalları, yedekleme

### M5 — Hesaplar ve güvenlik (`p2/m5-auth`)
- **Kimlik doğrulama:**
  - e-posta + şifre (argon2id)
  - 6 haneli e-posta doğrulama kodu (15 dk geçerli)
  - şifre sıfırlama kodu
  - giriş denemesi sınırlaması (sayaçlar `redis-queue`'da, doğru istemci IP'siyle)
- **SMTP:** Ayarlar env'den gelir (`SMTP_URL`, `SMTP_FROM`); yerelde Mailpit kullanılır.
- **Oturum:**
  - 15 dk access JWT + 30 gün dönen refresh token.
  - Refresh token DB'de hash'li saklanır. Yeniden kullanım tespit edilirse o token ailesinin tamamı iptal edilir.
  - Web: httpOnly/Secure/SameSite=Lax çerez + CSRF koruması. `COOKIE_DOMAIN` env'den gelir (dev'de boş, host-only). `Secure` yalnızca üretimde zorunludur.
  - Mobil: bearer token + SecureStore.
- **Roller:** `user` ve `admin`. İlk admin seed komutuyla `ADMIN_EMAIL` üzerinden oluşturulur.
  - Parça 1'deki platform-admin sözleşmesi (`/api/auth/login`, `/api/admin/session`, `/api/auth/me`) artık gerçek admin hesabına bağlanır. Sözleşme ve 7 günlük opak token davranışı değişmez; analiz paneli çalışmaya devam eder.
  - `ADMIN_SETUP_TOKEN` girişi admin hesabı oluşturulunca kapanır.
- **KVKK ve mağaza gereklilikleri:**
  - Verilerimi indir (JSON).
  - Hesabımı sil: hesap anında pasifleştirilir. Kalıcı silme job'ı en geç 30 gün içinde kullanıcıyı, cihazları, push token'larını, takipleri ve bildirimleri siler ya da anonimleştirir. Yedeklerdeki kalış süresi belgelenir.
- **Plan altyapısı:** Tek plan `free`. Limitler config'ten gelir: en fazla 20 takip, 5 istasyon akışı, saatlik push sınırı (varsayılan 60; admin sınırsız, domain.md). Limitler sunucuda zorunlu tutulur. Ödeme arayüzü yoktur.
- **Kayıt anahtarları:**
  - `REGISTRATION_ENABLED`: üretimde varsayılan `false`. Açılma koşulları: yedek/geri yükleme testi yeşil (M9), yasal metinler yayında (Parça 3) ve kullanıcı onayı (DUR-SOR).
  - `REGISTRATION_ALLOWLIST`: virgülle ayrılmış e-posta listesi. Kayıt kapalıyken yalnızca bu adresler kayıt olabilir (Play/TestFlight test kullanıcıları için).
- **Veri ayrımı:** Kullanıcı verisi tabloları ayrı bir şemadadır; ODbL yöntem belgesinin ve olası dökümlerin dışında kalır.
- **Kabul:** Integration testleri geçer:
  - kayıt → Mailpit'ten kod → doğrulama → giriş
  - refresh rotasyonu ve yeniden kullanım tespiti
  - hesap silme job'ı
  - platform-admin sözleşmesi gerçek admin hesabıyla (analiz uygulamasının davranışına göre)

### M6 — Takip, kurallar ve eşleştirici (`p2/m6-follows`)
- **Takip türleri ve eşleşme:** Takip türleri, eşleşme durumları (`pending | matched | completed | expired | landing_unknown`) ve istasyon akışı kuralları domain.md'deki gibidir. "Gün" Europe/Istanbul'a göredir.
- **Kural içeriği:**
  - Olaylar: uyarı mesafesi seçimi, iniş, pas geçme, kalkış.
  - Mesafe referansı: havalimanı merkezi ya da hizalı pist eşiği (Uzman).
  - Kanallar: mobil push, web push, bildirim merkezi.
  - Sessiz saatler ("Takip ettiğim uçuşların iniş bildirimi sessiz saatlerde de gelsin" istisnasıyla).
  - iOS zamana duyarlı bildirim tercihi.
  - Varsayılanlar: tek dokunuşla takip = 10 km + iniş, açık olan bütün kanallar.
- **P1 toplu sorgusu:** takip listesinden beslenir.
- **Eşleştirici:** Olaylar abone indeksleriyle (hex, çağrı kodu, tescil, istasyon + filtre) eşlenir ve bildirim işleri üretilir.
- **Filtre tahmini:** Filtreli istasyon akışı kurulurken "saatte yaklaşık N bildirim" tahmini son 7 günün olaylarından hesaplanır.
- **Kabul:**
  - TK1985 takibi, uçak THY4KN olarak uçarken `pending` kalır. Arama canlı adayı gösterir; kullanıcı seçince takip `matched` olur.
  - "Gün" sınırı testi geçer.
  - `landing_unknown` kapanışı bildirim üretir.

### M7 — Bildirim kanalları (`p2/m7-notifier`, worker `notifier` rolü)
- **Kuyruk ve sınırlar:** BullMQ kullanılır. Saatlik sınır ve özet kuralları domain.md'deki gibidir; iniş bildirimleri özete çevrilmez.
- **Expo push** (`expo-server-sdk` ^7.2; ESM, Node ≥ 22.12):
  - Gönderim: 100'lük parçalar, `600/sn` sınırı, `TOO_MANY_REQUESTS`'te geri çekilme.
  - Mesaj alanları: `priority: "high"`, `sound: "default"`, `channelId: "flight-alerts"` (Android), `categoryId: "flight-event"`, `threadId: <flightId>` (iOS), `tag: <flightId>-<event>` (Android). Kullanıcı tercihi açıksa iOS için `interruptionLevel: "time-sensitive"`, değilse `"active"`.
  - Doğrudan APNs yolu yazılmaz.
  - Receipt kontrolü 15 dk sonra yapılır (en geç 24 saat). `DeviceNotRegistered` ticket'ta ya da receipt'te gelirse token silinir.
  - `EXPO_ACCESS_TOKEN` desteklenir.
- **Web Push:** M4'teki gönderici çok kullanıcılı hâle getirilir.
- **Bildirim merkezi (uygulama içi kanal):** DB'de tutulur ve WS ile anında iletilir. Muhtemel inişte güven düzeyi belirtilir. Kesinti sırasında kaçan olaylar domain.md'deki etiketlerle yazılır ("Veri kesintisi: iniş doğrulanamadı" / "Kesinti sonrası doğrulandı") ve sonradan push olarak gönderilmez.
- **Saat biçimi:** Kullanıcının tercihine göre (yerel ya da UTC "Z").
- **Kabul:**
  - Expo ve Web Push göndericilerinin stub sunuculara karşı integration testleri geçer: parçalama, receipt, `DeviceNotRegistered` temizliği, 410 temizliği.
  - Gecikme ölçümü (a) 500 olayda p95 < 3 sn.

### M8a — Hesap, takip ve bildirim uç noktaları (`p2/m8a-api-user`)
- **Hesap:** auth, `me`, ayarlar.
- **Cihaz kayıtları:** Expo token, web push aboneliği.
- **Takip:** takip ve kural CRUD, eşleşme durumu, uçuş bazında susturma (`POST /v1/follows/{id}/mute`, süre parametreli).
- **Bildirimler:** liste, okundu işaretleme.
- **WS kanalı:** bildirim merkezi (yetkili).
- **Kabul:**
  - `pnpm openapi:check`: üretilen şema commit'li olanla aynıdır.
  - Her uç nokta için integration testi: yetkisiz → 401, başka kullanıcının kaynağı → 404.
  - Yetkisiz WS aboneliği 4401 koduyla kapanır.

### M8b — Arama, uçuş, istasyon ve admin uç noktaları (`p2/m8b-api-data`)
- **Arama:** sefer no, çağrı kodu, tescil, hex, havalimanı.
- **Uçuş:** detay, iz, olaylar, tahmini rota.
- **İstasyon:**
  - liste
  - varış panosu: yaklaşanlar, mesafe, tahmini varış, durum, kapsama kalitesi
  - son 2 saatin inişleri ve kalkışları (pist ve saatle)
  - METAR/TAF (Parça 1 M6c'de geldi: `GET /v1/airports/:code/weather` ve `/weather/history`, D-078)
  - operasyon panosu için filtreli akış
  - kapsama kalitesi job'ı (domain.md → "Kapsama kalitesi")
- **Admin:** kullanıcılar, sağlayıcı sağlığı, bildirim kayıtları, engel listesi ve kaldırma talepleri, havayolu ve pist düzeltmeleri, limitler, disk kullanımı, `coverage:report` tetikleme.
- **WS kanalları:** uçak detayı, istasyon panosu.
- **Kabul:** M8a'daki kontrollerin aynısı bu uç noktalar için de geçer.

### M9 — Yedekleme ve üretim hazırlığı (`p2/m9-backup`)
- **Yedekleme:** infra.md → "Yedekleme" bölümüne göre `hy-worker-bg` içinde kurulur: iz tabloları hariç günlük `pg_dump`, S3, `backup_runs` tablosu, heartbeat, yerel sınırlı yedek. `scripts/restore.sh` yazılır ve CI'da geri yükleme testi koşar.
- **Hata takibi ve uyarılar:** `SENTRY_DSN` tanımlıysa hata takibi açılır. Uyarı job'ı ve heartbeat'ler infra.md → "Gözlem ve uyarı" bölümüne göre kurulur.
- **Kabul:**
  - Yedekten temiz bir DB'ye geri yükleme CI'da geçer.
  - Uyarı job'ı stub SMTP'ye doğru e-postaları gönderir.
  - `[k]`: kullanıcı S3 hedefini girdikten sonra bir gerçek yedek alınır ve bir kez geri yüklenir.

## Uçtan uca (API seviyesinde)
Kayıt → doğrulama → takibe alma → replay senaryosu → bildirim merkezinde doğru olaylar doğru sırayla görünür ve stub push sunucularında doğru mesajlar bulunur.

## Tamamlanma kriterleri
- [ ] Parça 1 kriterleri hâlâ yeşil.
- [ ] Tüm senaryolar geçer. Kalkış, üstten geçiş, bekleme, SAW ve kesinti senaryolarında yanlış push yoktur.
- [ ] `[k]` Proje sahibi gerçek IST varışlarında telefonuna bildirim aldı; 20 varışlık doğrulama rapora yazıldı.
- [ ] Motor performansı ve iki gecikme metriği ölçülüp raporlandı.
- [ ] Yedek alma ve geri yükleme test edildi; uyarılar çalışıyor.
- [ ] OpenAPI, `.env.example`, `docs/ACTIVATION.md` ve `docs/reports/parca-2.md` güncel.
