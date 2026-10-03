# Doğrulanmış referanslar

Bir şeyi doğrulaman gerekiyorsa önce buradaki kaynakları kullan. Yeni bir kaynak eklersen tarihiyle buraya yaz. Son toplu doğrulama: 2026-09-25.

## Veri kaynakları
- adsb.lol OpenAPI (makine okunur; `/docs` JS ile oluştuğu için okunamaz): https://api.adsb.lol/api/openapi.json
- adsb.lol API README: https://github.com/adsblol/api
- adsb.lol gizlilik ve lisans: https://www.adsb.lol/privacy-license/ · durum: https://status.adsb.lol
- adsb.lol feeder re-api (yalnızca besleyici IP'sinden): https://www.adsb.lol/docs/feeders-only/re-api/
- readsb JSON alanları: https://github.com/wiedehopf/readsb/blob/dev/README-json.md
- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- OurAirports verisi: https://ourairports.com/data/ · CSV: https://davidmegginson.github.io/ourairports-data/
- VRS standing-data: https://github.com/vradarserver/standing-data · ayna: https://vrs-standing-data.adsb.lol/
- FAA JO 7340.2 (Contractions, Bölüm 3 telsiz çağrı adları): https://www.faa.gov/air_traffic/publications/atpubs/cnt_html/
- AviationWeather Data API: https://aviationweather.gov/data/api/ (ayrıntı aşağıda, "Havacılık hava durumu")
- OpenFreeMap: https://openfreemap.org/ (SSS ve kullanım şartları)
- Protomaps (self-host yedek): https://docs.protomaps.com/

## Havacılık hava durumu: METAR/TAF (erişim 2026-10-01; D-078)
- **aviationweather.gov (NOAA Aviation Weather Center):**
  - Data API (sınırlar, yanıt kodları, önbellek dosyaları, `www` kullanılmaz, CORS yok): https://aviationweather.gov/data/api/
  - OpenAPI şeması (v4.0; METAR ve TAF parametreleri ve JSON alanları, birimler): https://aviationweather.gov/data/schema/openapi.yaml
  - XML şemaları (bulut tabanı AGL, CB/TCU `cloud_type`, inHg basınç): https://aviationweather.gov/data/schema/metar2_0.xsd · https://aviationweather.gov/data/schema/taf2_0.xsd
  - Veri yardımı (hava olayı kodları, bulut tabanı ft AGL, TAF rüzgârı gerçek kuzeye göre): https://aviationweather.gov/help/data/
  - SSS (Eylül 2025 API yenilemesi): https://aviationweather.gov/help/ · planlanan değişiklikler: https://aviationweather.gov/help/upcoming/ · test ortamının Eylül 2025 değişiklik listesi: https://testbed.aviationweather.gov/help/upcoming/
  - Değişiklik günlüğü (v4.25 `cgi-bin` kaldırıldı, v4.26 belgelenmemiş parametre yasağı, v4.30–v4.31 önbellek): https://aviationweather.gov/data/feed/changelog.json
  - METAR sayfası (kendi isteği: düz virgüllü `ids`, `/taf`'ta `hours` yok, 204 = veri yok): https://aviationweather.gov/data/metar/
- **NWS kullanım şartları** (kamu malı, onay ima etmeme, ad ve logo izni, yeniden deneme en az 1 dk arayla, engellenen kullanıcı sdm@noaa.gov): https://www.weather.gov/disclaimer
- **MGM:**
  - *Havacılık Meteorolojisi 1* (Ankara, 2018; METAR/TAF kodları, Türkiye'de TAF düzeni V.3.7, meydan uyarı eşikleri): https://www.mgm.gov.tr/FILES/genel/kitaplar/havacilikmeteorolojisi.pdf
  - Halka açık simge adları: https://www.mgm.gov.tr/site/yardim1.aspx?=Simgeler · "gök gürültülü" kullanımı: https://www.mgm.gov.tr/tahmin/gunluk-tahmin.aspx?b=15
  - Meteoroloji sözlüğü ("Kuru duman" ve "Kuru pus"): https://www.mgm.gov.tr/genel/meteorolojisozlugu.aspx?m=K&k=aa208 · https://www.mgm.gov.tr/genel/meteorolojisozlugu.aspx?m=K&k=aa213
- **WMO-No. 782** *Aerodrome Reports and Forecasts* (2020, ICAO Ek 3 Değişiklik 79 ile uyumlu; kod biçimleri ve örnekler): https://archiwum.imgw.pl/sites/default/files/2021-06/aerodromereportsandforecasts.pdf · WMO Teknik Düzenlemeler Cilt II'nin kaldırılması (Ek 3 başvuru kaynağıdır): https://community.wmo.int/en/activity-areas/aviation/resources/tech-regs-v2-discontinuation
- **DHMİ AIP AD 2** (meteoroloji biriminin çalışma saatleri ve TAF geçerliliği; `<ICAO>` havalimanı kodu): `https://www.dhmi.gov.tr/AIPDocuments/LT_AD_2_<ICAO>_en.pdf` · örnek: https://www.dhmi.gov.tr/AIPDocuments/LT_AD_2_LTCW_en.pdf
- **Gün doğumu ve batımı:** NOAA güneş hesaplayıcısı (test değerleri buradan, ±1 dk): https://gml.noaa.gov/grad/solcalc/ · hesap ayrıntıları (zenit 90,833°): https://gml.noaa.gov/grad/solcalc/calcdetails.html
- **Bağıl nem:** Lawrence, M. G. (2005), "The Relationship between Relative Humidity and the Dewpoint Temperature in Moist Air", *BAMS* 86(2), 225–233 (Magnus formülü, Alduchov–Eskridge katsayıları): https://doi.org/10.1175/BAMS-86-2-225
- **Tavan tanımı:** SKYbrary "Ceiling": https://skybrary.aero/articles/ceiling

## Saat dilimleri (erişim 2026-10-03; D-084)
- **IANA saat dilimi veritabanı (tzdb):** https://www.iana.org/time-zones · kaynak deposu ve `zone.tab` (ülke → dilim, kamu malı): https://github.com/eggert/tz · `theory.html` (adlandırma, bağlantılar): https://data.iana.org/time-zones/theory.html
- **ECMAScript Intl** (`Intl.Locale#getTimeZones`, `Intl.supportedValuesOf('timeZone')`; tablo testte bunlarla denetlenir): https://tc39.es/proposal-intl-locale-info/ · https://tc39.es/ecma402/#sec-intl.supportedvaluesof
- **Değerlendirilip kullanılmayan:** timezone-boundary-builder (dilim poligonları, veri ODbL): https://github.com/evansiroky/timezone-boundary-builder · geo-tz: https://github.com/evansiroky/node-geo-tz · @photostructure/tz-lookup: https://github.com/photostructure/tz-lookup

## Uydu altlığı (Esri World Imagery, erişim 2026-09-28)
- ArcGIS Location Platform fiyatları ve ücretsiz katman: https://location.arcgis.com/pricing/
- E204 ArcGIS Location Platform Agreement (rev. 2025-11-21; §3.1c–d kullanım, proxy ve önbellek): https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf
- E300 ürüne özgü kullanım şartları (ArcGIS Location Platform maddeleri; kullanım koşullarında bağlantılı): https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf
- Statik temel harita karoları (World Imagery karo adresi): https://developers.arcgis.com/rest/static-basemap-tiles/
- API anahtarı güvenliği (referrer kısıtı, yetki, süre): https://developers.arcgis.com/documentation/security-and-authentication/security-best-practices/

## Resmî havalimanı adları (erişim 2026-09-30; D-076)
- DHMİ "Havalimanları Web Siteleri" listesi (resmî Türkçe adlar; `airport-names.ts` → `source: 'dhmi'`): https://www.dhmi.gov.tr/Sayfalar/HavalimaniListesi.aspx · bağlandığı sayfa: https://www.dhmi.gov.tr/Sayfalar/Havalimanlari.aspx · havalimanı sayfaları `https://www.dhmi.gov.tr/Sayfalar/Havalimani/<Ad>/AnaSayfa.aspx` biçimindedir
- DHMİ İngilizce sitesi: https://www.dhmi.gov.tr/Sayfalar/EN/DefaultEN.aspx · havalimanı listesi https://www.dhmi.gov.tr/Sayfalar/EN/Airports.aspx (erişim 2026-10-01). İngilizce görünen adların kaynağı **değildir**: liste tutarsızdır ("DALAMAN AIRPORT", "MUS AIRPORT", "CUKUROVA AİRPORT", "MUĞLA-MİLAS BODRUM AIRPORT"). `airport-names.ts`'teki İngilizce adlar resmî Türkçe adın çevirisidir; İngilizce sayfalar resmî Türkçe adı ve kaynağını ayrıca yazar (D-076).
- İşletmeci siteleri (`source: 'operator'`):
  - İstanbul Havalimanı (İGA, LTFM): https://www.istairport.com/
  - İstanbul Sabiha Gökçen (ISG, LTFJ): https://www.sabihagokcen.aero/anasayfa
  - Gazipaşa-Alanya (LTFG): http://www.gzpairport.com/tr-TR/
  - Zafer (LTBZ): http://www.zafer.aero/
  - Eskişehir Hasan Polatkan (Eskişehir Teknik Üniversitesi, LTBY): https://hph.eskisehir.edu.tr/
- **Kullanılmaz:** SHGM listesi https://web.shgm.gov.tr/doc2/havlist.pdf. 2006 tarihli bir tablo dışa aktarımıdır ("HAVAALANLARI TABLOSU.xls", 2006-11-20) ve İstanbul Havalimanı'ndan (2018) eskidir.
- OurAirports veri sözlüğü (pist kaplama kodları; `runway-surface.ts`): https://ourairports.com/help/data-dictionary.html

## Arama motorları, yapay zekâ tarayıcıları ve yapılandırılmış veri (erişim 2026-09-29; D-076)
- **Google Search Central:**
  - Yerelleştirilmiş sürümler, hreflang, x-default, tam adres, kendini listeleme: https://developers.google.com/search/docs/specialty/international/localized-versions
  - Yerele göre uyarlanan sayfalar (dili tahmin etme, ayrı adres kullan): https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages
  - Google tarayıcıları ve Google-Extended: https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
  - robots.txt: https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt
  - Site haritası ve `lastmod`: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
  - Site içi arama kutusunun kaldırılması (2024-11-21): https://developers.google.com/search/blog/2024/10/sitelinks-search-box
  - Yapılandırılmış veri kuralları (görünmeyen içerik işaretlenmez): https://developers.google.com/search/docs/appearance/structured-data/sd-policies
  - Spam politikaları (kapı sayfaları, ölçekli içerik): https://developers.google.com/search/docs/essentials/spam-policies
  - Yapay zekâ özellikleri rehberi (llms.txt kullanılmaz): https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
  - Search Console: https://search.google.com/search-console
- **Yandex:**
  - Dil sürümleri (HTML hreflang ve x-default desteklenir; site haritasındaki dil sürümleri desteklenmez): https://yandex.com/support/webmaster/yandex-indexing/locale-pages.html
  - `Clean-param`: https://yandex.com/support/webmaster/robot-workings/clean-param.html
  - Yandex Webmaster: https://webmaster.yandex.com/
- Bing Webmaster Tools: https://www.bing.com/webmasters
- RFC 9309 Robots Exclusion Protocol (grup eşleştirme, §2.2.1): https://www.rfc-editor.org/rfc/rfc9309.html
- **Tarayıcı belgeleri:** OpenAI https://developers.openai.com/api/docs/bots · Anthropic https://support.claude.com/en/articles/8896518 · Perplexity https://docs.perplexity.ai/guides/bots · Apple https://support.apple.com/en-us/119829 · Meta https://developers.facebook.com/docs/sharing/webmasters/web-crawlers/ · Amazon https://developer.amazon.com/amazonbot · Common Crawl https://commoncrawl.org/ccbot
- schema.org: https://schema.org/Airport · https://schema.org/elevation (yalın sayı metre sayılır) · https://schema.org/BreadcrumbList · https://schema.org/ItemList
- llms.txt önerisi (2024-09-03): https://llmstxt.org/
- IndexNow (şimdilik kullanılmıyor): https://www.indexnow.org/documentation
- Türkiye arama motoru payları: https://gs.statcounter.com/search-engine-market-share/all/turkey
- **Next.js 16.3** (paketle gelen belgeler, `apps/web/node_modules/next/dist/docs/01-app/`): `03-api-reference/04-functions/use-pathname.md` (yeniden yazmada hidrasyon farkı), `03-api-reference/03-file-conventions/01-metadata/` (`robots.md` → `rules[].other`, `sitemap.md`, `opengraph-image.md`, `manifest.md`, `app-icons.md`), `02-guides/json-ld.md`, `03-api-reference/05-config/01-next-config-js/htmlLimitedBots.md`
- Overpass yazı tipi (OFL-1.1): https://github.com/RedHatOfficial/Overpass · paket: https://fontsource.org/fonts/overpass

## Yayın ve altyapı
- Dokploy API: https://docs.dokploy.com/docs/api · Compose referansı: https://docs.dokploy.com/docs/api/reference-compose
- Dokploy Compose domain'leri: https://docs.dokploy.com/docs/core/docker-compose/domains
- Dokploy Going Production (CI'da build önerisi): https://docs.dokploy.com/docs/core/applications/going-production
- Dokploy sürümleri: https://github.com/Dokploy/dokploy/releases

> **Dikkat:** Dokploy dokümanları v0.30.7'nin gerisindedir. Going Production sayfasındaki `dokploy/dokploy-action@v1` yoktur (404) ve action sürümleri eskidir. Domains sayfasındaki "diğer servislere dokploy-network ekle" talimatı v0.27.0'dan beri gereksizdir. Isolated Deployments v0.30.0'da deprecated'dır ve kapalı kalır. Çelişkide `docs/spec/infra.md` geçerlidir.

- GitHub Actions olayları: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- dorny/paths-filter: https://github.com/dorny/paths-filter
- GHCR kimlik doğrulama: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Git satır sonları: https://docs.github.com/en/get-started/git-basics/configuring-git-to-handle-line-endings
- Hostinger swap: https://support.hostinger.com/en/articles/8124185-how-to-set-up-swap-on-hostinger-vps

## Analiz
- Siteni Analiz Et (kullanıcının kendi uygulaması, MIT): https://github.com/emindemirciai/Analyze.Your.Site-Siteni-Analiz-Et-. Giriş sözleşmesi: `src/lib/platformAuth.ts`. Takip script'i: `src/app/api/tracker/route.ts`.
- KVKK Çerez Uygulamaları Hakkında Rehber: https://www.kvkk.gov.tr/

## Kütüphaneler
- Node sürüm takvimi: https://github.com/nodejs/Release
- pnpm ayarları: https://pnpm.io/settings
- Next.js output/standalone: https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Drizzle config ve özel migration: https://orm.drizzle.team/docs/drizzle-config-file · https://orm.drizzle.team/docs/kit-custom-migrations
- Drizzle partition desteği yok (izle): https://github.com/drizzle-team/drizzle-orm/issues/6235
- PostgreSQL partitioning: https://www.postgresql.org/docs/18/ddl-partitioning.html
- BullMQ üretim rehberi: https://docs.bullmq.io/guide/going-to-production · Job Schedulers: https://docs.bullmq.io/guide/job-schedulers
- ws (permessage-deflate uyarıları): https://github.com/websockets/ws
- @fastify/websocket: https://github.com/fastify/fastify-websocket
- MapLibre GL JS v6 değişiklikleri: https://github.com/maplibre/maplibre-gl-js/releases
- egm96-universal: https://www.npmjs.com/package/egm96-universal
- web-push: https://github.com/web-push-libs/web-push
- Turnstile test anahtarları: https://developers.cloudflare.com/turnstile/troubleshooting/testing/

## Mobil ve bildirim
- Expo push gönderimi (`interruptionLevel`, `channelId`, sınırlar): https://docs.expo.dev/push-notifications/sending-notifications/
- expo-server-sdk-node: https://github.com/expo/expo-server-sdk-node
- Expo development build: https://docs.expo.dev/develop/development-builds/create-a-build/
- EAS runtime versions: https://docs.expo.dev/eas-update/runtime-versions/
- Expo monorepo (pnpm): https://docs.expo.dev/guides/monorepos/
- iOS capability'leri: https://docs.expo.dev/build-reference/ios-capabilities/
- maplibre-react-native: https://github.com/maplibre/maplibre-react-native
- WebKit Web Push (iOS ana ekran PWA): https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Apple App Review Guidelines (5.1.1(v) hesap silme): https://developer.apple.com/app-store/review/guidelines/
- Google Play hesap silme şartı: https://support.google.com/googleplay/android-developer/answer/13327111
- Google Play 12 test kullanıcısı / 14 gün şartı: https://support.google.com/googleplay/android-developer/answer/14151465
- Maestro CLI: https://docs.maestro.dev/

## Claude Code
- Bellek ve `.claude/rules/`: https://code.claude.com/docs/en/memory
- İzinler: https://code.claude.com/docs/en/permissions
