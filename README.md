# havayolu

**[Türkçe](#türkçe) · [English](#english)**

![sürüm](https://img.shields.io/badge/s%C3%BCr%C3%BCm-v0.4.0-blue) ![lisans](https://img.shields.io/badge/lisans-MIT-green) ![durum](https://img.shields.io/badge/durum-geli%C5%9Ftirme-yellow)

---

## Türkçe

Türkiye odaklı sivil havacılık uçuş takip platformu. Canlı harita, uçuş, uçak ve istasyon takibi sunar. Uçak istasyona yaklaşınca (varsayılan 10 km) ve indiğinde bildirim gönderir. Önce web (PWA) gelir, ardından iOS ve Android uygulaması (Expo).

> **havayolu** · [havayolu.live](https://havayolu.live) — yönetim: `admin.havayolu.live`, API: `api.havayolu.live`, analiz: `analiz.havayolu.live` (yayın Parça 1 · M1b ile başlıyor).

> **Bilinen sınır:** Kendi ADS-B alıcımız olmadığı için İstanbul Havalimanı'nda iniş anı çoğunlukla doğrudan görülmez. İniş bildirimi çoğu uçuşta "muhtemelen indi (tahmini saat)" olarak ve son sinyalden 1–1,5 dk sonra gelir. Bazı uçuşlarda yalnızca "iniş verisi alınamadı" denebilir.

### Durum — v0.4.0
| Alan | Durum |
|---|---|
| Yol haritası, veri kaynakları, mimari | ✅ Hazır ve doğrulandı |
| Yerel test ortamı, Durum ve Yenilikler sayfaları | ✅ Parça 1 · M0 |
| Bütün servisler, yönetim paneli (Servisler ekranı), onaylı analiz | ✅ Parça 1 · M1a |
| Marka ve alan adı: havayolu · havayolu.live (DNS kayıtları girildi) | ✅ v0.3.1 |
| Güvenlik sertleştirmesi (ziyaretçi başına giriş sınırı, Redis kesintisine dayanıklılık), açık kaynak repo, korumalı `main` | ✅ v0.3.2 |
| Otomatik yayın hattı (GitHub Actions → GHCR → Dokploy), doğrulama ve geri alma | ✅ Parça 1 · M1b, sunucu kurulumu bekliyor ([rehber](docs/DEPLOY_DOKPLOY.md)) |
| Canlı harita ve arama | ⏳ Parça 1 · M6 |
| 10 km ve iniş bildirimi (web push) | ⏳ Parça 2 · M4 |
| Hesaplar, takip listesi, istasyon operasyon panosu | ⏳ Parça 2B / 3 |
| iOS ve Android uygulaması | ⏳ Parça 4 |

Sürüm geçmişi için [CHANGELOG.md](CHANGELOG.md) dosyasına bak. Uygulama içinde aynı içerik **Yenilikler** sayfasında görünecek.

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

`http://localhost:3100/durum` ve `http://localhost:3100/yenilikler` adreslerini aç. Yönetim paneli ve veritabanı için önce `pnpm dev:infra` (Docker) çalıştır; panel `http://localhost:3100/admin` adresindedir. Uygulama `.env.example`'daki varsayılanlarla eksiksiz açılır; `.env` gerekmez. Bu makinede 3000–3003 portları başka bir projenin olduğu için web 3100, API 4100 portunda çalışır. Ayrıntılı komutlar `CLAUDE.md` → Komutlar bölümündedir.

### Proje nasıl geliştiriliyor
- `docs/prompts/README.md`: başlamadan önce yapılacaklar ve parçaların Claude Code ile nasıl çalıştırılacağı
- `CLAUDE.md`: proje kuralları · `docs/spec/`: alan, veri kaynakları, altyapı
- `docs/ACTIVATION.md`: elle yapılacak dış adımlar ve **maliyet özeti**
- `docs/DEPLOY_DOKPLOY.md`: sunucu (Dokploy) kurulumu, bir kez
- `docs/DECISIONS.md`: kararlar ve gerekçeleri

### İstatistik (v0.4.0)
Git'te 165 dosya, **10.615 satır**. Bunun 6.280 satırı kod (TypeScript, TSX, CSS, JS), 2.561 satırı belgedir. Lockfile ve `docs/research/` hariç tutulur. Güncel değer için `pnpm stats` çalıştır.

| Alan | Satır |
|---|---|
| docs | 2.013 |
| apps/web | 1.741 |
| apps/api | 1.723 |
| scripts | 1.096 |
| packages/shared | 604 |
| apps/worker | 411 |
| packages/db | 372 |
| packages/i18n | 359 |
| packages/providers | 197 |
| packages/geo | 152 |
| diğer (kök, deploy, .claude, .github) | 1.947 |

### Lisans, veri ve atıflar
- Kod [MIT lisansı](LICENSE) ile lisanslanmıştır: © 2026 [emindemirciai](https://github.com/emindemirciai). Kodun tüm kopyaları ya da önemli bölümleri telif bildirimini ve lisans metnini içermek zorundadır; bunlar olmadan kopyalamak ya da dağıtmak lisans ve telif hakkı ihlalidir. **havayolu** adı ve logosu MIT kapsamında değildir, hakları saklıdır. Aynı bildirim sitenin sayfa kaynağında da yer alır.
- Canlı uçuş verisi [ADSB.lol](https://adsb.lol)'den gelir ve [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) lisansına tabidir.
- Harita: OpenFreeMap © OpenMapTiles, veriler © OpenStreetMap katkıcıları.
- Havalimanları OurAirports'tan (kamu malı), havayolu ve rota verisi VRS standing-data'dan (CC0), hava durumu NOAA Aviation Weather Center'dan gelir.
- Ziyaretçi analizi, onayla yüklenen kendi uygulamamız [Siteni Analiz Et](https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-) (MIT) ile yapılır.

---

## English

A Türkiye-focused civil aviation flight tracker. It offers a live map and lets you follow flights, aircraft and stations. You get an alert when an aircraft approaches a station (10 km by default) and when it lands. The web app (PWA) comes first, then iOS and Android apps (Expo).

> **havayolu** · [havayolu.live](https://havayolu.live) — admin: `admin.havayolu.live`, API: `api.havayolu.live`, analytics: `analiz.havayolu.live` (going live with Part 1 · M1b).

> **Known limitation:** Without our own ADS-B receiver, the moment of touchdown at Istanbul Airport is usually not observed directly. For most flights the landing alert says "probably landed (estimated time)" and arrives 1–1.5 minutes after the last signal. For some flights it can only say "landing data unavailable".

### Status — v0.4.0
| Area | Status |
|---|---|
| Roadmap, data sources, architecture | ✅ Done and verified |
| Local test environment, Status and What's new pages | ✅ Part 1 · M0 |
| All services, admin panel (Services screen), consent-based analytics | ✅ Part 1 · M1a |
| Brand and domain: havayolu · havayolu.live (DNS records added) | ✅ v0.3.1 |
| Security hardening (per-visitor sign-in limit, resilience to Redis outages), public repo, protected `main` | ✅ v0.3.2 |
| Automatic release pipeline (GitHub Actions → GHCR → Dokploy), verification and rollback | ✅ Part 1 · M1b, server setup pending ([guide](docs/DEPLOY_DOKPLOY.md)) |
| Live map and search | ⏳ Part 1 · M6 |
| 10 km and landing alerts (web push) | ⏳ Part 2 · M4 |
| Accounts, watchlist, station operations board | ⏳ Part 2B / 3 |
| iOS and Android apps | ⏳ Part 4 |

See [CHANGELOG.md](CHANGELOG.md) for release history. The same content will appear in the app's **What's new** page.

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

Then open `http://localhost:3100/durum` and `http://localhost:3100/yenilikler`. For the admin panel and the database, first run `pnpm dev:infra` (Docker); the panel is at `http://localhost:3100/admin`. The app starts with the defaults in `.env.example`; no `.env` is needed. On this machine ports 3000–3003 belong to another project, so the web app runs on 3100 and the API on 4100. Full command list: `CLAUDE.md` → Komutlar.

### How the project is built
- `docs/prompts/README.md`: one-time setup and how to run each part with Claude Code
- `CLAUDE.md`: project rules · `docs/spec/`: domain, data sources, infrastructure
- `docs/ACTIVATION.md`: manual external steps and the **cost summary**
- `docs/DEPLOY_DOKPLOY.md`: one-time server (Dokploy) setup
- `docs/DECISIONS.md`: decisions and rationale

### Stats (v0.4.0)
165 files and **10,615 lines** in git: 6,280 lines of code (TypeScript, TSX, CSS, JS) and 2,561 lines of documentation. The lockfile and `docs/research/` are excluded. Run `pnpm stats` for current numbers.

### License, data and attribution
- Code is licensed under the [MIT License](LICENSE): © 2026 [emindemirciai](https://github.com/emindemirciai). All copies or substantial portions of the code must include the copyright notice and license text; copying or distributing without them infringes the license and the copyright. The **havayolu** name and logo are not covered by the MIT License; rights reserved. The same notice appears in the page source of the site.
- Live flight data comes from [ADSB.lol](https://adsb.lol) and is subject to [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- Map: OpenFreeMap © OpenMapTiles, data © OpenStreetMap contributors.
- Airports come from OurAirports (public domain), airlines and routes from VRS standing-data (CC0), weather from NOAA Aviation Weather Center.
- Visitor analytics use our own app, [Siteni Analiz Et](https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-) (MIT), loaded only with consent.
