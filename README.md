# havayolu

**[Türkçe](#türkçe) · [English](#english)**

![sürüm](https://img.shields.io/badge/s%C3%BCr%C3%BCm-v0.18.0-blue) ![lisans](https://img.shields.io/badge/lisans-MIT-green) ![durum](https://img.shields.io/badge/durum-geli%C5%9Ftirme-yellow)

---

## Türkçe

Türkiye odaklı sivil havacılık uçuş takip platformu. Canlı harita, uçuş, uçak ve istasyon takibi sunar. Uçak istasyona yaklaşınca (varsayılan 10 km) ve indiğinde bildirim gönderir. Önce web (PWA) gelir, ardından iOS ve Android uygulaması (Expo).

> **havayolu** · [havayolu.live](https://havayolu.live) — yönetim: `admin.havayolu.live`, API: `api.havayolu.live`, analiz: `analiz.havayolu.live` (yayında, 2026-09-27).

> **Bilinen sınır:** Kendi ADS-B alıcımız olmadığı için İstanbul Havalimanı'nda iniş anı çoğunlukla doğrudan görülmez. İniş bildirimi çoğu uçuşta "muhtemelen indi (tahmini saat)" olarak ve son sinyalden 1–1,5 dk sonra gelir. Bazı uçuşlarda yalnızca "iniş verisi alınamadı" denebilir.

### Durum — v0.18.0
| Alan | Durum |
|---|---|
| Yol haritası, veri kaynakları, mimari | ✅ Hazır ve doğrulandı |
| Yerel test ortamı, Durum ve Yenilikler sayfaları | ✅ Parça 1 · M0 |
| Bütün servisler, yönetim paneli (Servisler ekranı), onaylı analiz | ✅ Parça 1 · M1a |
| Marka ve alan adı: havayolu · havayolu.live (DNS kayıtları girildi) | ✅ v0.3.1 |
| Güvenlik sertleştirmesi (ziyaretçi başına giriş sınırı, Redis kesintisine dayanıklılık) | ✅ v0.3.2 |
| Canlı yayın: havayolu.live, api., admin. (Dokploy, Let's Encrypt) | ✅ 2026-09-27 |
| Otomatik yayın hattı (GitHub Actions → GHCR → Dokploy), doğrulama ve geri alma | ✅ Parça 1 · M1b, sunucu kurulumu sürüyor ([rehber](docs/DEPLOY_DOKPLOY.md)) |
| Veritabanı: havalimanı, pist (eşikler dahil) ve havayolu verisi, günlük güncelleme, iz tabloları ve bakım işleri | ✅ Parça 1 · M2 |
| Canlı veri sağlayıcıları (ADSB.lol, kendi alıcı), veri temizliği ve gizlilik kuralları | ✅ Parça 1 · M3 |
| Canlı veri akışı (ingest): kapsama planı, uyarlanır istek hızı, uçuş kaydı ve iz, sağlık izleme, replay aracı | ✅ Parça 1 · M4 (adsb.lol çekimi [ACTIVATION](docs/ACTIVATION.md) adımlarından sonra açılır) |
| Harita tasarımı: uydu zemini, metrik birimler, açılıp kapanan uçak etiketleri | ✅ Parça 1 · M6 (D-072) |
| Canlı API ve WebSocket: görünen alan, arama (sefer no, çağrı kodu, tescil, hex), saniyelik farklar, gizlilik ve engel listesi | ✅ Parça 1 · M5 |
| Canlı harita: uydu altlığı, yönlü uçak simgeleri, açılıp kapanan etiketler, arama, bilgi kartı, "Uçağı ortala", paylaşılabilir bağlantı, görünen uçaklar listesi, Türkiye havalimanları | ✅ Parça 1 · M6 (uçaklar, canlı veri kaynağı açılınca görünür) |
| Kullanım koşulları (geçici metin) | ✅ v0.9.0 |
| Havalimanı sayfaları (61 havalimanı, pistler, resmî adlar), Hakkında sayfası, İngilizce adresler (`/en/...`), arama motorları ve yapay zekâ aramaları için site haritası, yapılandırılmış veri ve `llms.txt` | ✅ Parça 1 · M6b |
| Havalimanlarında canlı hava durumu (METAR/TAF; rüzgâr, yağmur, kar, gök gürültüsü, sis), METAR/TAF kaydı, haritada kırmızı iğne ve havalimanı penceresi, IST merkezli açılış | ✅ Parça 1 · M6c |
| Yakın ülkelerdeki 75 havalimanı (Türkiye’deki en yakın havalimanına ≤ 500 km): sayfa, pistler, hava durumu, haritada iğne ve pencere; Ercan KKTC; açık turkuaz tema; hava durumu satırlarında simge ve vurgu | ✅ Parça 1 · M6d |
| Rüzgâr km/sa ve knot ile; etkili rüzgâr (MGM meydan uyarı ölçütü) ve şiddet adı; şimşek ve yıldırım uyarısı; hizalı havalimanı penceresi | ✅ Parça 1 · M6e, v0.13.1 |
| Askerî ve sivil havalimanı adları TR/EN; haritada havalimanı etiketi (Gizle / Kod); yurt dışında yerel saat ve UTC farkı | ✅ Parça 1 · M6f |
| Derecelendirilmiş rüzgâr renkleri (yeşilden kırmızıya, Beaufort adlarıyla) ve rüzgâr kesmesi uyarısı | ✅ v0.14.1, v0.16.1 |
| 2. halka: 1.000 km’ye kadar 89 havalimanı daha (toplam 225); haritanın atıf şeridinde site adı ve sürüm | ✅ Parça 1 · M6g |
| Yeniliklerde her sürümün yayın tarihi ve saati | ✅ v0.17.1 |
| Haritada kesikli ülke sınırları (OpenStreetMap) | ✅ v0.17.2 |
| 3. halka: 2.000 km’ye kadar 278 havalimanı daha (toplam 503); 2022’den beri kapalı olabilecek havalimanlarında not | ✅ Parça 1 · M6h |
| Yeni logo (halkanın içinden geçen uçak): başlık, sekme simgesi, uygulama simgeleri, paylaşım görselleri | ✅ Parça 1 · M6l |
| Uçak listesi sağ üstte: sefer, kuyruk tescili, yükseklik, konum ve tahmini durum (yerde, inişte, yaklaşmada) | ✅ Parça 1 · M6k |
| 10 km ve iniş bildirimi (web push) | ⏳ Parça 2 · M4 |
| Hesaplar, takip listesi, istasyon operasyon panosu | ⏳ Parça 2B / 3 |
| iOS ve Android uygulaması | ⏳ Parça 4 |

Sürüm geçmişi için [CHANGELOG.md](CHANGELOG.md) dosyasına ya da [GitHub Releases](https://github.com/emindemirciai/havayolu/releases) sayfasına bak. Uygulama içinde aynı içerik **Yenilikler** sayfasında görünecek.

### Telefonunda ne zaman ne görürsün
- **Parça 2A'dan itibaren:** Android'de Chrome ile, iPhone'da Safari'de "Ana Ekrana Ekle" yaptıktan sonra (iOS 16.4+) bildirim alırsın. Apple ya da Google geliştirici hesabı gerekmez.
- **Parça 4A:** Android uygulaması gelir. APK doğrudan kurulabilir; mağaza için Play hesabı (25 $) gerekir.
- **Parça 4B:** iOS uygulaması gelir. Apple Developer Program (99 $/yıl) gerekir.
- **Tazelik:** Haritadaki konumlar İstanbul çevresinde ~20 sn, diğer istasyonlarda ~30 sn, Doğu Türkiye'de ~90 sn gecikmeli olabilir (ücretsiz veri kaynağının hız sınırı).

### Yerelde çalıştırma
Gereken: Node 24, pnpm 12.6 (`npm i -g pnpm@12.6.0`).

```bash
pnpm install
pnpm dev
```

`http://localhost:3100/` (canlı harita), `/havalimanlari`, `/istasyon/LTFM`, `/hakkinda`, `/durum` ve `/yenilikler` adreslerini aç; İngilizce sürümler `/en` ile başlar (ör. `/en/havalimanlari`). Yerelde harita dış servislere çıkmadan düz koyu arka planla açılır; uydu görüntüsü yalnızca üretimde `ESRI_API_KEY` ile gelir. Yönetim paneli ve veritabanı için önce `pnpm dev:infra` (Docker), sonra bir kez `pnpm db:migrate` çalıştır (tabloları kurar, tohum istasyonlarını ekler). Worker açılınca havalimanı, pist ve havayolu verisini repodaki alt kümeden (`tools/fixtures`) kendisi yükler; hava durumu da elle yazılmış örnek METAR/TAF raporlarından gelir. İnternete çıkmaz. Panel `http://localhost:3100/admin` adresindedir. Canlı veri akışını internete çıkmadan görmek için `pnpm dev:replay` çalıştır: sentetik uçaklar sunan bir yerel alıcı (port 4300) açılır, worker veriyi oradan alır ve uçaklar haritada hareket eder. Uçtan uca testler `pnpm test:e2e` ile çalışır (Playwright; önce `pnpm dev:infra` ve `pnpm db:migrate`). Uygulama `.env.example`'daki varsayılanlarla eksiksiz açılır; `.env` gerekmez. Bu makinede 3000–3003 portları başka bir projenin olduğu için web 3100, API 4100 portunda çalışır. Ayrıntılı komutlar `CLAUDE.md` → Komutlar bölümündedir.

### Proje nasıl geliştiriliyor
- `docs/prompts/README.md`: başlamadan önce yapılacaklar ve parçaların Claude Code ile nasıl çalıştırılacağı
- `CLAUDE.md`: proje kuralları · `docs/spec/`: alan, veri kaynakları, altyapı
- `docs/ACTIVATION.md`: elle yapılacak dış adımlar ve **maliyet özeti**
- `docs/DEPLOY_DOKPLOY.md`: sunucu (Dokploy) kurulumu, bir kez
- `docs/DECISIONS.md`: kararlar ve gerekçeleri

### İstatistik (v0.17.2)
Git'te 559 dosya, **105.368 satır**. Bunun 96.039 satırı kod (TypeScript, TSX, CSS, JS), 6.115 satırı belgedir. Lockfile, `docs/research/` ve elle yazılmayan veri (fixture CSV ve JSON dosyaları, drizzle şema snapshot'ları) hariç tutulur. Güncel değer için `pnpm stats` çalıştır.

| Alan | Satır |
|---|---|
| apps/web | 24.646 |
| apps/api | 11.517 |
| apps/worker | 9.536 |
| packages/db | 6.971 |
| docs | 3.239 |
| packages/providers | 3.903 |
| packages/shared | 8.004 |
| tools | 2.192 |
| scripts | 2.019 |
| packages/i18n | 3.079 |
| packages/geo | 713 |
| diğer (kök, deploy, .claude, .github) | 6.110 |

### Lisans, veri ve atıflar
- Kod [MIT lisansı](LICENSE) ile lisanslanmıştır: © 2026 [emindemirciai](https://github.com/emindemirciai). Kodun tüm kopyaları ya da önemli bölümleri telif bildirimini ve lisans metnini içermek zorundadır; bunlar olmadan kopyalamak ya da dağıtmak lisans ve telif hakkı ihlalidir. **havayolu** adı ve logosu MIT kapsamında değildir, hakları saklıdır. Aynı bildirim sitenin sayfa kaynağında da yer alır.
- Canlı uçuş verisi [ADSB.lol](https://adsb.lol)'den gelir ve [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) lisansına tabidir.
- Harita: uydu görüntüsü Powered by Esri (Esri, Vantor, Earthstar Geographics, and the GIS User Community), kullanımı Esri koşullarına tabidir; vektör harita OpenFreeMap © OpenMapTiles, veriler © OpenStreetMap katkıcıları.
- Sitenin [kullanım koşulları](https://havayolu.live/kullanim-kosullari) geçici metindir. Bütün atıflar ve lisanslar: [ATTRIBUTION.md](ATTRIBUTION.md).
- Havalimanları OurAirports'tan (kamu malı), havayolu ve rota verisi VRS standing-data'dan (CC0), hava durumu NOAA Aviation Weather Center'dan gelir.
- Ziyaretçi analizi, onayla yüklenen kendi uygulamamız [Siteni Analiz Et](https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-) (MIT) ile yapılır.

---

## English

A Türkiye-focused civil aviation flight tracker. It offers a live map and lets you follow flights, aircraft and stations. You get an alert when an aircraft approaches a station (10 km by default) and when it lands. The web app (PWA) comes first, then iOS and Android apps (Expo).

> **havayolu** · [havayolu.live](https://havayolu.live) — admin: `admin.havayolu.live`, API: `api.havayolu.live`, analytics: `analiz.havayolu.live` (live since 2026-09-27).

> **Known limitation:** Without our own ADS-B receiver, the moment of touchdown at Istanbul Airport is usually not observed directly. For most flights the landing alert says "probably landed (estimated time)" and arrives 1–1.5 minutes after the last signal. For some flights it can only say "landing data unavailable".

### Status — v0.18.0
| Area | Status |
|---|---|
| Roadmap, data sources, architecture | ✅ Done and verified |
| Local test environment, Status and What's new pages | ✅ Part 1 · M0 |
| All services, admin panel (Services screen), consent-based analytics | ✅ Part 1 · M1a |
| Brand and domain: havayolu · havayolu.live (DNS records added) | ✅ v0.3.1 |
| Security hardening (per-visitor sign-in limit, resilience to Redis outages) | ✅ v0.3.2 |
| Live: havayolu.live, api., admin. (Dokploy, Let's Encrypt) | ✅ 2026-09-27 |
| Automatic release pipeline (GitHub Actions → GHCR → Dokploy), verification and rollback | ✅ Part 1 · M1b, server setup in progress ([guide](docs/DEPLOY_DOKPLOY.md)) |
| Database: airport, runway (thresholds included) and airline data, daily updates, track tables and maintenance jobs | ✅ Part 1 · M2 |
| Live data providers (ADSB.lol, own receiver), data cleaning and privacy rules | ✅ Part 1 · M3 |
| Live data ingest: coverage plan, adaptive request rate, flight records and tracks, health monitoring, replay tool | ✅ Part 1 · M4 (adsb.lol fetching starts after the [ACTIVATION](docs/ACTIVATION.md) steps) |
| Map design: satellite base, metric units, switchable aircraft labels | ✅ Part 1 · M6 (D-072) |
| Live API and WebSocket: visible area, search (flight number, callsign, registration, hex), per-second diffs, privacy and blocklist | ✅ Part 1 · M5 |
| Live map: satellite base, heading-aware aircraft icons, switchable labels, search, info card, "Centre on aircraft", shareable link, list of aircraft in view, airports in Türkiye | ✅ Part 1 · M6 (aircraft appear once the live data source is switched on) |
| Terms of use (interim text) | ✅ v0.9.0 |
| Airport pages (61 airports, runways, official names), About page, English addresses (`/en/...`), sitemap, structured data and `llms.txt` for search engines and AI search | ✅ Part 1 · M6b |
| Live airport weather (METAR/TAF; wind, rain, snow, thunderstorm, fog), METAR/TAF log, red map pins and airport window on the map, map opens on IST | ✅ Part 1 · M6c |
| 75 airports in nearby countries (within 500 km of the nearest airport in Türkiye): pages, runways, weather, map pins and window; Ercan in the TRNC; light turquoise theme; weather row icons and highlights | ✅ Part 1 · M6d |
| Wind in km/h and knots; significant wind (Turkish aerodrome warning threshold) with strength names; lightning warnings; aligned airport window | ✅ Part 1 · M6e, v0.13.1 |
| Military and civil airport names in TR/EN; airport labels on the map (Hide / Code); local time with UTC offset abroad | ✅ Part 1 · M6f |
| Graded wind colours (green to red, with Beaufort names) and wind shear warnings | ✅ v0.14.1, v0.16.1 |
| Ring 2: 89 more airports up to 1,000 km (225 in total); site name and version in the map attribution strip | ✅ Part 1 · M6g |
| Release date and time for every version on What’s new | ✅ v0.17.1 |
| Dashed country borders on the map (OpenStreetMap) | ✅ v0.17.2 |
| Ring 3: 278 more airports up to 2,000 km (503 in total); note on airports that may be closed since 2022 | ✅ Part 1 · M6h |
| New logo (a plane flying through the ring): header, tab icon, app icons, share images | ✅ Part 1 · M6l |
| Aircraft list at the top right: flight, tail number, altitude, location and estimated status (on ground, landing, approaching) | ✅ Part 1 · M6k |
| 10 km and landing alerts (web push) | ⏳ Part 2 · M4 |
| Accounts, watchlist, station operations board | ⏳ Part 2B / 3 |
| iOS and Android apps | ⏳ Part 4 |

See [CHANGELOG.md](CHANGELOG.md) or [GitHub Releases](https://github.com/emindemirciai/havayolu/releases) for release history. The same content will appear in the app's **What's new** page.

### What you'll see on your phone, and when
- **From Part 2A:** alerts on Android via Chrome, and on iPhone via Safari after "Add to Home Screen" (iOS 16.4+). No Apple or Google developer account is needed.
- **Part 4A:** the Android app. The APK can be installed directly; the store needs a Play account ($25).
- **Part 4B:** the iOS app. It needs the Apple Developer Program ($99/year).
- **Freshness:** positions may lag by ~20 s around Istanbul, ~30 s at other stations and ~90 s over eastern Türkiye (rate limit of the free data source).

### Run locally
Requires Node 24 and pnpm 12.6 (`npm i -g pnpm@12.6.0`).

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3100/` (live map), `/havalimanlari`, `/istasyon/LTFM`, `/hakkinda`, `/durum` and `/yenilikler`; English versions start with `/en` (e.g. `/en/havalimanlari`). Locally the map opens on a plain dark background without calling any external service; satellite imagery only appears in production with `ESRI_API_KEY`. For the admin panel and the database, first run `pnpm dev:infra` (Docker), then `pnpm db:migrate` once (creates the tables and seeds the stations). When the worker starts it loads airport, runway and airline data from the committed subset (`tools/fixtures`) by itself, and weather comes from hand-written sample METAR/TAF reports, without going online. The panel is at `http://localhost:3100/admin`. To see the live data flow without going online, run `pnpm dev:replay`: it starts a local receiver with synthetic aircraft (port 4300), the worker reads from it and the aircraft move on the map. End-to-end tests run with `pnpm test:e2e` (Playwright; run `pnpm dev:infra` and `pnpm db:migrate` first). The app starts with the defaults in `.env.example`; no `.env` is needed. On this machine ports 3000–3003 belong to another project, so the web app runs on 3100 and the API on 4100. Full command list: `CLAUDE.md` → Komutlar.

### How the project is built
- `docs/prompts/README.md`: one-time setup and how to run each part with Claude Code
- `CLAUDE.md`: project rules · `docs/spec/`: domain, data sources, infrastructure
- `docs/ACTIVATION.md`: manual external steps and the **cost summary**
- `docs/DEPLOY_DOKPLOY.md`: one-time server (Dokploy) setup
- `docs/DECISIONS.md`: decisions and rationale

### Stats (v0.17.2)
559 files and **105,368 lines** in git: 96,039 lines of code (TypeScript, TSX, CSS, JS) and 6,115 lines of documentation. The lockfile, `docs/research/` and generated data (fixture CSV and JSON files, drizzle schema snapshots) are excluded. Run `pnpm stats` for current numbers.

### License, data and attribution
- Code is licensed under the [MIT License](LICENSE): © 2026 [emindemirciai](https://github.com/emindemirciai). All copies or substantial portions of the code must include the copyright notice and license text; copying or distributing without them infringes the license and the copyright. The **havayolu** name and logo are not covered by the MIT License; rights reserved. The same notice appears in the page source of the site.
- Live flight data comes from [ADSB.lol](https://adsb.lol) and is subject to [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- Map: satellite imagery Powered by Esri (Esri, Vantor, Earthstar Geographics, and the GIS User Community), subject to Esri's terms; vector map OpenFreeMap © OpenMapTiles, data © OpenStreetMap contributors.
- The site's [terms of use](https://havayolu.live/kullanim-kosullari) are an interim text. All attributions and licences: [ATTRIBUTION.md](ATTRIBUTION.md).
- Airports come from OurAirports (public domain), airlines and routes from VRS standing-data (CC0), weather from NOAA Aviation Weather Center.
- Visitor analytics use our own app, [Siteni Analiz Et](https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-) (MIT), loaded only with consent.
