---
paths:
  - "apps/web/**"
  - "packages/i18n/**"
---

# Web arayüz kuralları

- `docs/DESIGN.md` varsa (Parça 3'ten itibaren) renk, tipografi ve bileşen token'ları oradan gelir. Token'ların kaynağı `packages/shared/design-tokens`'tır.
- Sabit metin yoktur; tüm metinler `packages/i18n`'dedir (tr varsayılan, en ikinci). Tahmini bilgi "tahmini" etiketi taşır.
- MapLibre GL JS v6 ESM-only'dir (`import * as maplibregl from 'maplibre-gl'`; default import yok) ve WebGL2 gerektirir; yalnızca client component'te yüklenir. `setData` ikinci argüman almaz. `styleimagemissing` yalnızca bildirimdir; eksik ikonlar `setMissingStyleImageResolver` ya da önceden `addImage` ile eklenir. `map.transform` kaldırıldı.
- Uçak katmanı tek bir symbol katmanıdır. Stil JSON'u `packages/shared`'dadır ve mobille ortaktır.
- Next.js 16: `publicRuntimeConfig` yoktur, `middleware` yerine `proxy` kullanılır, `next lint` yoktur. Ortama özgü yapılandırma çalışma zamanında sunucudan okunur; `NEXT_PUBLIC_*` kullanılmaz.
- Atıflar (ADSB.lol ODbL bağlantılı, OpenMapTiles/OSM) haritada her zaman görünür.
- Erişilebilirlik WCAG 2.1 AA'dır; panolarda gerçek `<table>` yapısı kullanılır.
- Terimler domain.md'deki gibidir: "Takip/Takibe al" yalnızca bildirim aboneliğidir, kamera için "Uçağı ortala" denir. Tek başına "eşik" yazılmaz ("uyarı mesafesi" ya da "pist eşiği"). Uygulama içi liste "bildirim merkezi"dir.
- Sade görünümde kısaltma kullanılmaz: tahmini varış, havalimanı merkezi, yerden yükseklik. "Meydan" yerine "havalimanı" yazılır.
- Analiz script'i yalnızca kullanıcı onayıyla yüklenir (infra.md → Analiz). Service worker harita stil/karo/glif/sprite önbelleğe almaz.
- Playwright testleri `reuseExistingServer: false` ve yerel port 3100 ile çalışır (3000–3003 bu makinede başka projenindir).
- Dil adrestedir (D-076): Türkçe kökte, İngilizce `/en` altında; dil `getLocale()` ile proxy'nin istek başlığından okunur, çerez yoktur. İç bağlantılar `localePath(locale, path)` ile kurulur, sabit `href="/…"` yazılmaz. Dil anahtarı `<Link>` değil düz `<a hreflang lang>`dır.
- Her genel sayfa üst verisini `pageMetadata` ile yazar (canonical, hreflang, Open Graph, robots); kök düzen `alternates` ve `openGraph.images` yazmaz. Dizine eklenen yeni sayfa site haritasına (`lib/seo/sitemap.ts`) girer; `noindex, follow` sayfalar (durum, uçuş sayfası, operasyon panosu, adı doğrulanmamış, tarifesiz ve istasyon olmayan yeni havalimanı kaydı; D-076, D-084) girmez; askerî hava üsleri listede yoktur, sayfaları 404'tür (D-107). OurAirports bayrakları (tarifeli sefer, pist ışıklandırması) kaynağa atfedilir; "evet" değilse "kayıtlı değil" yazılır, "yok" denmez. Canlı haritada uçak vaat eden metin kapsama planına (`@havayolu/geo/coverage`) bakar (D-076). JSON-LD `components/json-ld.tsx` ile ve yalnızca sayfada görünen değerlerle yazılır.
- Env ya da veri okuyan metadata rotaları ve route handler'lar önce `await connection()` çağırır (build'e değer gömülmez). `notFound()` ve yönlendirmeler Suspense sınırından önce yapılır; bu bölümlerde `loading.tsx` yoktur (yumuşak 404 olmaz). `next/og` görsellerinde yalnızca `assets/og-fonts` yazı tipleri kullanılır; eksik harf Google Fonts'tan indirilirdi.
