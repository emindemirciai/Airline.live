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
- AviationWeather Data API: https://aviationweather.gov/data/api/
- OpenFreeMap: https://openfreemap.org/ (SSS ve kullanım şartları)
- Protomaps (self-host yedek): https://docs.protomaps.com/

## Uydu altlığı (Esri World Imagery, erişim 2026-09-28)
- ArcGIS Location Platform fiyatları ve ücretsiz katman: https://location.arcgis.com/pricing/
- E204 ArcGIS Location Platform Agreement (rev. 2025-11-21; §3.1c–d kullanım, proxy ve önbellek): https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf
- E300 ürüne özgü kullanım şartları (ArcGIS Location Platform maddeleri; kullanım koşullarında bağlantılı): https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf
- Statik temel harita karoları (World Imagery karo adresi): https://developers.arcgis.com/rest/static-basemap-tiles/
- API anahtarı güvenliği (referrer kısıtı, yetki, süre): https://developers.arcgis.com/documentation/security-and-authentication/security-best-practices/

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
