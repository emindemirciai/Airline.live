# Parça 3 — Web ürününün tamamı

**Başlatma:** `@docs/prompts/parca-3.md dosyasındaki Parça 3'e başla`
**Önce oku:** Parça 1–2 raporları, `docs/spec/domain.md` (terimler, "v1 sınırları", takip ve bildirim kuralları), `docs/spec/infra.md` ("Analiz"). `.claude/rules/web-ui.md`, `apps/web` altındaki bir dosya okununca yüklenir.

## Hedef
Bu parça bittiğinde web tarafı herkese açık bir ürün olarak eksiksiz çalışır:
- kayıt, takip ve bildirimler
- canlı harita, uçuş sayfası ve geçmiş oynatma
- istasyon sayfası ve **tam ekran operasyon panosu**
- admin paneli, yasal sayfalar ve açık veri sayfası
- CSP ve güvenlik başlıkları

## M1 — Tasarım sistemi (`p3/m1-design`) — önce plan, sonra DUR
**`docs/DESIGN.md` içeriği:**
- 4–6 renklik, adlandırılmış palet (açık ve koyu tema; WCAG AA kontrastı hesaplanmış)
- tipografi rolleri, yerleşim ilkesi, bileşen token'ları

Token'lar `packages/shared/design-tokens` içinde platformdan bağımsız JSON olarak tutulur; mobil de aynı token'ları kullanır.

Plan şu soruyla gözden geçirilir: "Bu, benzer her projede de çıkacak varsayılan bir çözüm mü?" Varsayılan kalan kısımlar değiştirilir ve nedeni yazılır.

**Görsel dil konunun kendisinden gelsin:**
- seyrüsefer haritası renkleri ve yaklaşma çemberleri
- meydan levhalarının sarı-siyahı (durum etiketlerinde ölçülü)
- koyu temada kokpit navigasyon ekranının renk anlamları

**Kaçınılacak kalıplar:**
- krem zemin + kiremit vurgu
- siyah zemin + tek asit yeşili vurgu
- her şeyi aynı yuvarlak kartlara bölen SaaS görünümü
- başlıkların üstüne BÜYÜK HARF etiketler
- dekoratif gradyanlar

**Tipografi** (doğrulandı 2026-09-25; D-017):
- B612 Türkçe glifleri (ğ Ğ ş Ş ı İ) içermez, kullanılmaz.
- Arayüz fontu **Overpass**'tır (Highway Gothic esinli levha karakteri, OFL). Alternatifi Atkinson Hyperlegible Next.
- Veri fontu (saat, irtifa, hız) **IBM Plex Mono**'dur. Tabular rakamlar için `font-variant-numeric: tabular-nums` kullanılır.
- Fontlar self-host edilir (`@fontsource`), `latin-ext` alt kümesi dahil.
- Sayfalarda doğru `lang` verilir: TR sayfalarda `lang="tr"`, EN sayfalarda `lang="en"`. CSS `text-transform` İ/ı dönüşümünü `lang`'a göre yapar; fontun `locl` özelliği yalnızca glif biçimini etkiler. JS'te arayüz metni için `toLocaleUpperCase('tr-TR')` kullanılır.
- `scripts/check-glyphs.mts` font dosyalarının cmap'inde `ğĞşŞıİçÇöÖüÜ` karakterlerinin hepsini arar; eksik varsa başarısız olur. CI'da çalışır.

**Hareket:**
- Dikkat çekici animasyon yalnızca bir yerde kullanılır: istasyonun yaklaşma çemberi ve teker koyma anı.
- Arayüzün geri kalanı sakindir. `prefers-reduced-motion` ayarına uyulur.

**Erişilebilirlik (WCAG 2.1 AA):**
- yeterli kontrast
- klavyeyle tam kullanım ve görünür odak
- ekran okuyucu etiketleri
- panolarda gerçek tablo yapısı

**DUR:** Kullanıcıya DESIGN.md, token dosyası ve 3 örnek ekran sunulur.
- Ekranlar üretim sayfalarından değil, `tools/design-preview/` altındaki statik önizleme sayfalarından alınır. Bunlar üretim imajına girmez; veri `tools/fixtures/` ve replay'den gelir.
- Harita ekranı, Parça 1 haritasının token'larla yeniden stillenmiş hâlidir.
- Boyutlar 390×844 ve 1440×900, açık + koyu tema. Kayıt yeri `docs/reports/screens/parca-3/`.

Onay gelmeden sayfa yapımına geçilmez.

## M2 — Arayüz metinleri ve dil yönlendirmesi (`p3/m2-copy`)
- **Yazım kuralları:**
  - Metinler Türkçedir ve etken çatıyla yazılır. Yalnızca ilk kelimenin baş harfi büyüktür: "Takibe al", "Bildirimi kapat". Aynı eylem her ekranda aynı adı taşır.
  - Terimler domain.md'deki gibidir: "uyarı mesafesi" ya da "pist eşiği" (tek başına "eşik" yazılmaz), "bildirim merkezi", "Uçağı ortala".
  - Sade görünümde kısaltma kullanılmaz: tahmini varış, havalimanı merkezi, yerden yükseklik.
- **Hata ve boş ekranlar:** Hata mesajları özür dilemez; ne olduğunu ve nasıl düzeltileceğini söyler. Boş ekranlar kullanıcıya bir sonraki adımı söyler. Örnek: "Henüz takip ettiğin uçuş yok. Sefer numarası ya da tescil ile ara."
- **Tahmini bilgi:** Her zaman "tahmini" etiketi taşır. Muhtemel iniş, kesin inişten görsel ve metinsel olarak ayrışır.
- **Dil yönlendirmesi: Parça 1 M6b'ye taşındı** (kullanıcı kararı 2026-09-29, D-076). TR kökte (`/`), EN `/en/...` altındadır; hreflang (`x-default` İngilizce), canonical ve dil anahtarı orada yapıldı, çerez tabanlı geçiş kaldırıldı. Bu kilometre taşında yeni eklenen her genel sayfa aynı yapıya uyar: iç bağlantılar `localePath` ile kurulur, üst veri `pageMetadata` ile yazılır, dizine eklenen sayfa site haritasına girer.
- **Kabul:**
  - `pnpm i18n:check` geçer: tr/en anahtar kümeleri eşittir, kullanılmayan anahtar yoktur.
  - `apps/web/src`'de sabit metin kontrolü (`i18next/no-literal-string` ya da eşdeğeri) 0 hata verir.

## M3a — Harita, arama ve görünümler (`p3/m3a-map`)
- **Arama:** sefer no, çağrı kodu, tescil, hex, havalimanı. Harfli numaralı çağrı kodlu seferlerde canlı adaylar tescil ve tahmini rotayla gösterilir.
- **Filtreler:** havayolu, tip, irtifa bandı, yerde/havada, kategori.
- **Katmanlar:** etiketler, irtifaya göre renklenen iz, istasyon yaklaşma çemberleri.
- **Sade / Uzman anahtarı:**
  - **Sade:** durum, tahmini varış saati, rota.
  - **Uzman:** Sade'dekilere ek olarak:
    - squawk, dikey hız, IAS/TAS/Mach, rüzgâr, OAT, seçili irtifa, `nav_modes`
    - pist, QNH, AGL yöntemi
    - veri kaynağı ve konum kaynağı (ADS-B/MLAT), tazelik

    Kısaltmalar üzerine gelince açıklanır.
- **Kabul:** E2E: filtreler görünen uçaklar tablosunu değiştirir; sefer no araması canlı adayı bulur; Uzman görünüm alanları görünür.

## M3b — Uçuş sayfası, geçmiş oynatma ve takip akışı (`p3/m3b-flight`)
- **Seçili uçak paneli:** kimlik bilgileri, tahmini rota, canlı değerler, varışa mesafe ve tahmini varış, olay zaman çizelgesi, son 30 dakikanın irtifa/hız grafiği.
- **"Takibe al" akışı:** Tek dokunuşla varsayılanlarla takip kurulur: 10 km uyarısı + iniş, açık olan bütün kanallar. Uyarı mesafesi, mesafenin ölçüleceği nokta (havalimanı merkezi ya da pist eşiği), ek olaylar ve kanallar "Ayrıntılı ayarlar" altında kapalı gelir. Sefer no takibinde eşleşme uyarısı gösterilir (domain.md).
- **Uçuş sayfası** (`/ucus/<flightId>`, paylaşılabilir): iz, grafikler, olaylar. Geçmiş oynatma: zaman çubuğu ve 1×–60× hız. İz verisi saklama süresini aştıysa sayfa zaman çizelgesini ve özeti gösterir ve "iz verisi saklama süresini aştı (N gün)" der.
- **Bildirim yönlendirmesi:** Bildirimler artık `/ucus/<flightId>`'ye gider (CLAUDE.md URL şeması).
- **Arama motorları (D-076):** Uçuş sayfası `noindex, follow`'dur ve site haritasına girmez; `/en/ucus/<flightId>` ikizi, canonical ve hreflang `pageMetadata` ile yazılır.
- **Kabul:** E2E: arama → takibe al (tek dokunuş) → replay senaryosu → bildirim merkezinde doğru olaylar ve web push gönderim kaydı. Geçmiş oynatma testi de geçer.

## M4 — İstasyon sayfası ve operasyon panosu (`p3/m4-station`)
`/istasyon/<ICAO>` Parça 1 M6b'den beri havalimanı bilgi sayfasıdır (pistler, konum, canlı harita bağlantısı; dizine eklenir, D-076). Bu kilometre taşı varış panosunu ve aşağıdaki bölümleri o sayfaya ekler; adres, canonical ve JSON-LD aynı kalır. Operasyon panosu `noindex, follow`'dur ve site haritasına girmez; arama motorları için giriş sayfası havalimanı sayfasıdır.

**Varış panosu:**
- Sütunlar: sefer/çağrı kodu, tescil, tip, nereden (tahmini), mesafe, tahmini varış, durum.
- Durumlar: yolda / yaklaşmada / alçakta sinyal kaybı / teker koydu (saatiyle) / muhtemelen indi (tahmini saat + güven) / pas geçti / yerde.
- Panonun altındaki not: "Canlı konumdan hesaplanır; tarife verisi içermez."

**Diğer bölümler:**
- son 2 saatin inişleri ve kalkışları (pist ve saatle)
- çözümlenmiş METAR/TAF (yaşıyla birlikte): Parça 1 M6c'den beri havalimanı sayfasında ve harita penceresinde var (D-078); pano aynı API'yi kullanır
- yaklaşma haritası
- kapsama kalitesi göstergesi ve %70 altı uyarısı (domain.md)
- filtreli istasyon takibi (saatlik bildirim tahminiyle)

**Operasyon panosu** (`/istasyon/<icao>/operasyon`) — tam ekran, otomatik yenilenen, istasyon operasyonu için:
- Havayolu ve tip filtreli varış tablosu. Her satırda 10 km ve iniş durumu görünür.
- Büyük tipografi ve yüksek kontrast; uzaktan okunabilir.
- Kiosk modu (imleç ve kenar çubuğu gizli).
- Veri tazeliği ve sağlayıcı durumu köşede sürekli görünür.
- Gerçek tablo yapısıdır; ekran okuyucu uyumludur.

**Kabul:** E2E: panoda durum geçişleri (muhtemel inişin kesin inişle doğrulanması dahil); operasyon panosu filtresi ve otomatik yenileme.

## M5 — Kullanıcı sayfaları, onay ve PWA (`p3/m5-account-pwa`)
- **Kimlik sayfaları:** kayıt, doğrulama, giriş, şifre sıfırlama.
  - `TURNSTILE_*` tanımlıysa kayıtta bot koruması açılır: siteverify yalnızca sunucuda yapılır, token 300 sn geçerli ve tek kullanımlıktır, `idempotency_key` kullanılır.
  - Testte Turnstile stub'ı kullanılır.
- **Takip listem ve bildirim merkezi:** eşleşme durumları görünür (bekliyor / eşleşti / tamamlandı / süresi doldu / iniş verisi alınamadı).
- **Ayarlar:** dil, birimler, yerel/UTC saat, tema, kanallar, web push izni, sessiz saatler, saatlik push sınırı, analiz onayı. Muhtemel iniş gecikmesi burada açıklanır.
- **Hesap:** e-posta, şifre, verilerimi indir, hesabı sil.
- **Admin:** Parça 2'deki bildirim kurulum sayfası bu tasarıma taşınır.
- **Onay bandı** (KVKK Çerez Rehberi; infra.md "Analiz"):
  - İlk ziyarette "Analiz için onay" bandı çıkar; "Kabul et" ve "Reddet" eşit ağırlıktadır.
  - Onay yoksa analiz script'i yüklenmez. Tercih ayarlardan değiştirilebilir.
  - Zorunlu çerezler (oturum) onaydan bağımsızdır. Dil çerezde değil, adreste tutulur (D-076).
- **PWA:**
  - Manifest ve özgün ikon seti. Parça 1 M6b'de `app/manifest.ts` (`display: browser`) ve ikonlar (192/512, apple-icon, favicon) eklendi; service worker gelince `display: standalone` olur.
  - Service worker: push gösterimi, bildirime tıklanınca ilgili uçuşa derin bağlantı, çevrimdışı kabuk.
  - Harita stil, karo, glif ve sprite istekleri service worker'da **asla** önbelleğe alınmaz (OpenFreeMap şartları).
  - iOS'ta push anahtarı yalnızca standalone modda (`display-mode: standalone` / `navigator.standalone`) gösterilir. Değilse adım adım "Ana Ekrana Ekle" yönergesi çıkar.
  - Bildirim izni sayfa açılır açılmaz istenmez. İzin, kullanıcı ilk takip kuralını oluştururken, neden gerektiği bir cümleyle açıklanarak ve bir düğmeyle istenir.
- **Kabul:**
  - E2E: kayıt → Mailpit'ten kod → giriş; hesap silme (uygulama içi); onay reddedilince analiz script'i yüklenmez.
  - Manifest Lighthouse "installable" kontrolünü geçer.

## M6a — Yasal sayfalar ve açık veri (`p3/m6a-legal`)
Metinler uygulamanın gerçek veri akışlarını anlatır: ADSB.lol, analiz uygulaması, push servisleri, SMTP, yedek deposu. Hukuki inceleme dış aktivasyon adımıdır.
- KVKK aydınlatma metni ve gizlilik politikası (`/gizlilik`). Analiz: onaylı, `localStorage` kimliği, IP konum sorgusu kapalı.
- Kullanım koşulları: ADS-B türevi verinin yeniden kullanımını yasaklamaz (ODbL 4.7). Parça 1 M6'da yayımlanan geçici `/kullanim-kosullari` bu metinle genişletilir; adres, Esri şartlarına uyma maddesi (E204 §3.1c.5) ve harita atıf satırındaki bağlantı korunur (D-075).
- Veri kaynakları ve atıflar.
- Uçak gizliliği kaldırma talebi formu.
- **`/hesap-silme`** (giriş gerektirmez, TR/EN): uygulamanın adını anar, neyin silinip neyin tutulduğunu açıklar ve e-posta doğrulamasıyla silme talebi alır. Google Play Data safety formuna bu URL yazılır.
- **`/acik-veri`:** ODbL md. 4.6(b) uyarınca adsb.lol verisinden türetme yöntemini anlatan makine okunur belge (filtreler, örnekleme, saklama, olay kuralları). Günlük döküm v1'de yoktur. Kullanıcı verisi hiçbir zaman yer almaz.
- **Kabul:** E2E: `/hesap-silme` akışı çalışır. `/acik-veri` belgesi kullanıcı şemasından hiçbir alan içermez (test).

## M6b — Admin paneli (`p3/m6b-admin`)
Tamamı `ADMIN_HOST` altındadır:
- Servisler (Parça 1'den; tasarım uygulanır)
- kullanıcılar
- sağlayıcı sağlığı: hız, 429 oranı, gecikme ve tazelik grafikleri; istasyon başına kapsama kalitesi; `coverage:report` tetikleme
- bildirim kayıtları
- engel listesi ve kaldırma talepleri
- havayolu ve pist düzeltmeleri
- limitler
- disk kullanımı ve "dolmaya kalan gün"
- yedek durumu (`backup_runs`)
- `REGISTRATION_ENABLED` durumu
- analiz paneline bağlantı

**Kabul:** E2E: engel listesine eklenen uçak haritadan kalkar. Admin olmayan kullanıcı admin host'unda 403 alır.

## M7 — Güvenlik ve performans (`p3/m7-hardening-web`)
- **CSP ve güvenlik başlıkları:** Nonce tabanlı CSP uygulanır.
  - `worker-src`: MapLibre v6'da CSP paketi kaldırıldı; harita worker'ının nasıl yüklendiğini (blob: ya da modül dosyası) doğrula ve buna göre ayarla (`'self' blob:` gerekebilir).
  - `connect-src`: `'self'`, `https://${API_HOST}`, `wss://${API_HOST}`, harita stil/karo/glif kaynakları, `${ANALYZE_URL}` (onay verildiyse script'in olay gönderimi), `SENTRY_DSN` host'u (tanımlıysa).
  - `script-src`: nonce, `${ANALYZE_URL}` (tanımlıysa), `challenges.cloudflare.com` (`TURNSTILE_*` tanımlıysa; `frame-src` de).
  - `img-src`: `'self' data: blob:` ve harita kaynakları.
  - Push servis uç noktaları CSP'ye eklenmez; onlara yalnızca worker sunucudan çıkar.
- **Performans:**
  - 500 uçaklık sentetik senaryo (Türkiye'de gözlenen en yüksek sayının ~3 katı), Playwright ile 30 sn: konsol hatası yok ve 1 sn'yi aşan uzun görev yok (CI, SwiftShader).
  - Kare süresi hedefi (medyan ≤ 20 ms) kullanıcının makinesinde, donanım GPU'suyla ve görünür tarayıcıda `pnpm perf:map` ile ölçülür.
  - Ana sayfa `pnpm lhci` (Lighthouse CI, varsayılan mobil kısıtlama, üretim build'i): 3 koşunun medyanında LCP < 2,5 sn.
  - Yöntemler: tek symbol katmanı, WS'den yalnızca farklar, `requestAnimationFrame` ile ara değerleme, rota bazlı kod bölme.
- **Erişilebilirlik:** Bileşen testleri ve axe kontrolleri bütün ana sayfalarda geçer.
- **Görsel kontrol:** Ana ekranların ekran görüntüleri alınır (M1'deki boyutlar ve temalar) ve DESIGN.md ile tutarlılıkları gözden geçirilir. TR/EN geçişi ve açık/koyu tema E2E'si geçer.

## Tamamlanma kriterleri
- [ ] Önceki parçaların kriterleri yeşil.
- [ ] Tüm E2E akışları, axe kontrolleri, glif kontrolü ve `i18n:check` geçiyor.
- [ ] Performans hedefleri ölçülüp raporlandı.
- [ ] Herkese açık duyuru öncesi kontrol listesi:
  - kalıcı domain seçildi (DUR-SOR 1)
  - günlük yedek alınıyor ve bir kez geri yüklendi
  - disk kullanımı admin panelinde görünüyor
  - 30 günlük iz hacmi ölçüldü
  - yasal metinler yayında ve hukuken incelendi

  `REGISTRATION_ENABLED=true` yalnızca kullanıcı onayıyla açılır.
- [ ] `docs/DESIGN.md` ve `docs/reports/parca-3.md` yazıldı.

## Dış aktivasyon adımları
- Yasal metinlerin ve onay bandının bir hukukçu tarafından incelenmesi.
- Opsiyonel: Turnstile anahtarları.
- Herkese açık duyurudan önce info@adsb.lol'e güncelleme e-postası (Parça 1'deki ilk bildirimin devamı).
