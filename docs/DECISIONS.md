# Kararlar

Her karar tarih, gerekçe ve varsa alternatifiyle yazılır. En yeni karar en üsttedir.

## 2026-10-01 — Ortak teslim ve tam yedek standardı
- **D-077 Kullanıcının ortak teslim standardı projeye eklendi** (kullanıcı kararı 2026-10-01).
  - **Dosyalar:** repo kökünde `push-and-backup.ps1`, `run-backup.cmd`, `BACKUP-STANDARD.md`, `PROJECT-BACKUP-RULES.md`, `AI-PROMPT.md`. Adları ve içerikleri kullanıcınındır. Yalnızca üç `.md` dosyasının satır sonları repo kuralı (`.gitattributes`, `pnpm check:eol`) gereği LF'ye çevrildi; `.ps1` ve `.cmd` CRLF kalır.
  - **Akış:** kontroller yeşil → kilometre taşı dalında commit → `push-and-backup.ps1` (dalı push eder, ardından repo kökünün filtresiz ZIP'ini Google Drive'a yazar, son 30'u tutar). ZIP şifrelenmez ve `.env` dosyalarını da içerir; bu, kullanıcının kendi Drive'ı için bilinçli tercihidir. Ajan `.env` içeriğini okumaz; betik dosyaları olduğu gibi paketler.
  - **Mevcut kurallarla birlikte:**
    - README her işte güncellenmeye devam eder (D-022). Standarttaki "README'ye dokunma" kuralı, standart kurulurken README'nin üzerine yazılmaması olarak yorumlandı; kullanıcı bunu onayladı.
    - İki yedek birlikte alınır: masaüstündeki küçük `git archive` zip'i (kullanıcıya dosya olarak gönderilir) ve Drive'daki tam ZIP.
    - Betik o anki dalı push ettiği için `main`'de çalıştırılmaz; PR ve merge commit akışı değişmez.
  - **Gizli dosya denetimi:** betik, adı `credentials.*` olan izlenen her dosyayı hassas sayar. Yönetici girişini doğrulayan kaynak dosya `apps/api/src/auth/credentials.ts` bu yüzden `verify-login.ts` adını aldı (içerik aynı; sır yoktur). Denetim gevşetilmedi.

## 2026-09-30 — Parça 1 M6b havalimanı sayfaları ve keşfedilebilirlik (SEO, GEO)
- **D-076 Dil adreste, havalimanı sayfaları, arama motorları ve yapay zekâ tarayıcıları.**
  - **Kullanıcı kararları (2026-09-29, sohbette; kaynak düzeltmesi 2026-09-30):**
    1. Plan değişikliği onaylandı: M6b Parça 1'e eklendi. Parça 3 M2'nin dil yönlendirmesi (TR `/`, EN `/en/...`, hreflang) öne alındı. Yeni genel adresler: `/havalimanlari`, `/istasyon/<ICAO>`, `/hakkinda`. Adresteki ICAO büyük harflidir.
    2. Yapay zekâ tarayıcıları: arama, yanıt ve eğitim tarayıcılarının hepsine izin verilir; yalnızca `Bytespider` engellenir.
    3. Havalimanı adları: resmî Türkçe adlar ve İngilizce görünen adlar. Resmî ad doğrulanamazsa OurAirports adı kullanılır (aşağıda "Resmî havalimanı adları").
    4. hreflang `x-default` İngilizce adrestir. Türkçe ve İngilizce dışındaki ziyaretçiye (ör. Almanca, Rusça) hizmet eder; Google: "match any language not explicitly listed". Geri alınabilir; TR'yi göstermek de geçerlidir.
    5. `/durum`: `noindex, follow`, site haritasında yok.
    6. Sorulmadan alınan varsayılanlar: veritabanındaki 61 havalimanı (içe aktarma filtresi değişmedi); IndexNow şimdilik yok; OurAirports `wikipedia_link` içe aktarılmaz; FAQPage, Dataset, SoftwareApplication ve SearchAction JSON-LD'si yok.
    7. `/kullanim-kosullari` (M6) de genel sayfadır: `/en/kullanim-kosullari` ikizi, canonical ve hreflang, site haritası kaydı ve `WebPage` JSON-LD'si vardır. D-075'teki "dil çerezden gelir; adres iki dilde aynıdır" notu bununla değişti.
  - **Dil yönlendirmesi: seçenek A (proxy yeniden yazma + istek başlığı).**
    - `app/[lang]` bölümü yoktur. `proxy.ts`, `/en` ve `/en/*` isteğini öneksiz yola yeniden yazar. Dili `x-hy-locale`, sorgulu mantıksal yolu `x-hy-path` başlığıyla sayfaya iletir. İki başlık her istekte ezilir; istemci taklit edemez. Kurallar saf `apps/web/src/lib/locale-routing.ts` modülündedir (`localePath`, `stripLocale`, `alternatesFor`, `localeRouting`).
    - `/tr` ve `/tr/*` öneksiz adrese 308 ile gider; sorgu korunur. `/en/admin*`, `/en/api/*`, `/en/dil` ve `/en/` + kök dosya (robots.txt, sitemap.xml, llms.txt, manifest, ikonlar, paylaşım görseli) 404 döner. `/english` önek sayılmaz.
    - **Kök dosyalar proxy'den geçer** (eşleyici yalnızca `/_next/static` ve `/_next/image`'ı dışarıda bırakır). Böylece www → kök alan adı 308'i ve admin host'unun `X-Robots-Tag: noindex, nofollow`'u onlara da uygulanır; dil kararı onları olduğu gibi geçirir. Admin host'unda `robots.txt` (`Disallow: /`), uygulama simgeleri ve manifest geçer (admin sayfaları kullanır); site haritası, llms.txt ve paylaşım görseli web sitesinindir, admin host'unda `/admin`'e yönlenir. İlk sürümde eşleyici kök dosyaları dışarıda bırakıyordu; www ve admin host'u onları yönlendirmesiz ve başlıksız sunuyordu (inceleme, 2026-10-01).
    - Yollar `/en` altında da Türkçedir (`/en/havalimanlari`): sayfa başına tek yol ve basit hreflang çiftleri.
    - **Neden A:**
      - Fark küçüktür, rota dosyaları taşınmaz, M6 dosyalarıyla çakışma azdır.
      - Mevcut `not-found.tsx` çalışır.
      - Statik çizimden kaybedilen bir şey yoktur: sayfalar zaten dinamiktir (onay çerezi, çalışma zamanı env'i D-075; Docker build'inde env ve API yok).
    - **Bilinen tuzaklar ve önlemleri:**
      - Kök düzen istemci geçişinde yeniden kullanılır. Bu yüzden dil anahtarı `<Link>` değil, düz `<a hreflang lang>`dır; dil değişimi tam sayfa yüklemesidir.
      - `usePathname` yeniden yazmada sunucuda ve istemcide farklı döner (Next.js `use-pathname.md`, "Avoid hydration mismatch with rewrites"). Anahtarın ilk adresi sunucuda `x-hy-path`'ten gelir; istemci yüklenince ve her geçişten sonra `window.location`'dan yeniden hesaplar.
      - Sorgu korunur: `/?hex=ff0001` → `/en?hex=ff0001`. Harita `?hex=` yazarken `/en` önekini korur.
    - **Seçenek B, gelecek hedefi:** `app/[lang]` + varsayılan dili gizleyen yeniden yazma. Yalnızca `cacheComponents`'e geçilirse anlamlıdır (statik kabuk); o geçişle birlikte yeniden değerlendirilir. Bedeli: bütün rotalar taşınır, admin kendi kök düzenini ister, eşleşmeyen adreslerin 404'ü için deneysel `global-not-found` ya da `[...rest]` gerekir, dosya tabanlı görsel adreslerinde `/tr/` görünür.
    - **Dil çerezi emekliye ayrıldı (D-050'nin yerini alır):**
      - `getLocale()` başlığı okur; admin'de her zaman `tr` döner. Admin öneksiz ve yalnızca Türkçedir; önceden çerezle gelen İngilizcesi kalktı (tek kullanıcılı panel için kabul edilir).
      - Eski `/dil?to=&next=` bağlantıları `safeNextPath(localePath(to, safeLogicalPath(next)))` adresine 308 ile gider (`apps/web/src/app/dil/route.ts`). `safeLogicalPath` hedefi önek ayrılmadan önce ve sonra denetler, `/en` ya da `/tr` önekini ayırır, `localePath` hedef dilin önekini ekler; son adres bir kez daha denetlenir ve `Location` başlığı yalnızca Latin-1 taşıdığı için yüzde kodlanır (`encodeURI`; önceden "ş" gibi bir karakter 500 döndürüyordu). Eski `lang` çerezi silinir (`Max-Age=0`), yanıt `X-Robots-Tag: noindex` taşır.
      - **Açık yönlendirme düzeltmesi (inceleme, 2026-10-01):** İlk sürüm `next`'i yalnızca önek ayrılmadan önce denetliyordu. `/en//evil.example` tek `/` ile başladığı için geçiyor, önek ayrılınca `//evil.example` oluyordu; tarayıcı bunu şemasız dış adres sayar. Artık önek ayrıldıktan sonraki yol da son adres de yeniden denetlenir. Proxy'de `/tr//…` ve `/en//…` (önek ayrılınca `//` ile başlayan yol) 404 alır; Next bu yolları proxy'den önce zaten normalleştirir (`resolve-routes.js`, yinelenen bölü → 308), denetim buna bel bağlamaz. Birim testleri (`safe-path`, `dil/route`, `locale-routing`, `proxy`) kodlu ve kodsuz biçimleri dener.
      - Accept-Language ya da çerezle otomatik yönlendirme yoktur. Google her dil için ayrı adres ister ve dili tahmin etmeyi önermez (localized-versions, locale-adaptive-pages). Çerezle İngilizce seçmiş kullanıcı bir kez Türkçe köke düşer; bilinçli bir tercihtir.
  - **Üst veri (`apps/web/src/lib/seo/metadata.ts` → `pageMetadata`):**
    - Canonical, sorgusuz mantıksal yoldur: `/?hex=` ve `/?havalimani=` adreslerinin canonical'ı `/`'dır.
    - hreflang `tr`, `en` ve `x-default` (= `en`). Her dil sürümü kendini ve diğerini listeler.
    - Open Graph: `og:url`, `og:locale` (`tr_TR`, `en_US`), site görseli. Havalimanı sayfası kendi klasöründeki görseli kullanır.
    - Adresleri kök düzendeki `metadataBase` mutlak yapar. `metadataBase` çalışma zamanında `WEB_HOST`'tan kurulur: yerel host (`localhost`, `127.0.0.1`, `[::1]`) http, diğerleri https; tanımsızsa `http://localhost:3100`. `WEB_HOST` artık web env şemasındadır ve `APP_ENV=production`'da zorunludur.
    - Kök düzen `alternates` ve `openGraph.images` yazmaz. Üst veri birleştirmesi sığdır: alt sayfalar canonical `/`'ı miras alırdı. Sayfa düzeyindeki `openGraph` de üst düzeyin dosya tabanlı görsellerini düşürür (`next/dist/lib/metadata/resolve-metadata.js` → `mergeStaticMetadata`); site görseli bu yüzden `pageMetadata` içinde açıkça verilir.
    - Sayfa düzeyindeki `robots` kök düzeninkini tümüyle ezer. Dizine eklenen sayfalar önizleme yönergelerini (`max-image-preview:large`, `max-snippet:-1`) kendileri yazar.
    - **`htmlLimitedBots: /.*/`** (`apps/web/next.config.ts`): Sayfalar dinamik olduğundan Next.js başlığı, canonical'ı ve hreflang'ı listesindeki botlar dışında herkes için `<body>`'ye akıtır. Varsayılan liste (`next/dist/shared/lib/router/utils/html-bots.js`) GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot ve TelegramBot'u kapsamaz. Artık üst veri her istemci için `<head>`'de, akış beklenerek yazılır. Bedeli küçüktür, çünkü üst veri önbellekli veriden gelir. Alternatifi, varsayılan listeyi kopyalayıp bu botları eklemekti; yeni botlar geldikçe bakım isterdi.
  - **İndeksleme kuralları:**
    - **index:** `/`, `/havalimanlari`, `/hakkinda`, `/yenilikler`, `/kullanim-kosullari` ve arkasında durabildiğimiz veriye göre havalimanları (fixture'da 55). Hepsi TR ve EN. Havalimanı kuralı (`apps/web/src/lib/airports.ts` → `isIndexable`): OurAirports'ta tarifeli seferi kayıtlı **ya da** izlenen istasyon **ya da** resmî adı DHMİ ya da işletmeci kaynağından doğrulanmış sivil havalimanı (`airport-names.ts` → `source` `dhmi`/`operator`).
      - **Neden (inceleme, 2026-10-01):** OurAirports `scheduled_service` bayrağı bazı sivil havalimanlarında güncel değildir: Siirt (LTCL) "tarifeli değil" görünür ama AJet ve THY seferleri vardır; Kocaeli Cengiz Topel (LTBQ) de öyle. İlk kural bu yüzden DHMİ'nin işlettiği sivil havalimanlarını `noindex` yapıyordu. Kuraldaki yeni koşulla Siirt, Kocaeli, Uşak ve İstanbul Atatürk dizine girer.
      - **Bayrakların yazımı:** OurAirports bayrakları doğrulanmış bilgi gibi sunulmaz. Tarifeli sefer kaynağa atfedilir ("OurAirports kaydına göre tarifeli havayolu seferi yapılıyor" / "OurAirports kaydında tarifeli havayolu seferi görünmüyor; bu bilgi güncel olmayabilir"; sütun ve satır başlığı "Tarifeli sefer (OurAirports)"). Pist ışıklandırmasında `lighted=0` "kaynakta belirtilmemiş" demektir, "ışık yok" değil (Sabiha Gökçen 06R/24L ILS'li ve ışıklıdır ama 0 görünür). İki bayrakta da "evet" değilse "Kayıtlı değil" yazılır, "Yok" denmez.
    - **`noindex, follow`:**
      - `/durum`: operasyoneldir ve sık değişir.
      - Resmî adı doğrulanamayan, OurAirports'ta tarifeli seferi kayıtlı olmayan ve istasyon olmayan havalimanları (fixture'da 6 askerî üs: LTAD, LTAG, LTAH, LTBG, LTBI, LTBL). Sayfa açılır, site haritasında ve llms.txt'de yoktur. Liste tablosu OurAirports'ta tarifeli seferi kayıtlı olmayan satırları (10) soluk zeminle gösterir.
      - Parça 3 kuralı: `/ucus/<id>` ve `/istasyon/<ICAO>/operasyon` da `noindex, follow` olur ve site haritasına girmez; giriş sayfası havalimanı sayfası kalır.
    - **`noindex, nofollow`:** admin. Admin düzeninin üst verisiyle ve admin host'undaki her yanıtta `X-Robots-Tag` ile uygulanır.
    - **`X-Robots-Tag: noindex`:** web'in `/api/*` ve `/dil` yanıtları, API host'unun bütün yanıtları (Fastify `onSend`).
    - **Gerçek 404:** Havalimanı sayfasında adres normalleştirmesi akış başlamadan, Suspense sınırından önce yapılır: küçük harf ICAO ya da IATA kodu `permanentRedirect` ile büyük harfli ICAO'ya gider, bilinmeyen kod `notFound()` alır. Bu bölümlerde `loading.tsx` yoktur. Akış başladıktan sonra durum kodu 200'e kilitlenir ve yumuşak 404 olurdu.
      - Bilinen Next.js 16.3 davranışı: sayfa çiziminde fırlatılan `notFound()` sunucu HTML'inde 404 durumu, `noindex` ve 404 başlığıyla boş bir hata kabuğu (`<html id="__next_error__">`, `lang` yok) döndürür; 404 sayfasını sitenin düzeniyle istemci çizer (`next/dist/server/app-render/app-render.js` → `getErrorRSCPayload`). Eşleşmeyen adresler (`/en/zzz`) ise sunucuda tam 404 sayfası alır. Arama motorları için belirleyici olan 404 durumudur; E2E ham yanıtta durum, `noindex` ve başlığı, tarayıcıda `<html lang>`'ı denetler.
  - **robots.txt (`apps/web/src/app/robots.ts`, istek anında):**
    - Tek `*` grubu: `Allow: /`; `Disallow: /admin`, `/api/`, `/dil`; Yandex için `Clean-param: hex&havalimani /` ve utm parametreleri (Next.js 16.3 `rules[].other`).
    - Adlandırılmış grup yalnızca engellenen tarayıcı içindir: `User-agent: Bytespider` / `Disallow: /`.
    - **Neden tek grup:** Google ve RFC 9309 bir tarayıcıya yalnızca en özel grubu uygular. İzinli bir bota ayrı "Allow" grubu yazılsaydı `Disallow: /admin` o bot için sessizce kaybolurdu. Yandex de kendi grubu varsa `*`'ı yok sayar.
    - `/_next/` engellenmez: Google sayfayı çizmek için JS ve CSS'e ihtiyaç duyar.
    - `Google-Extended` engellenmez: Gemini uygulamalarındaki dayanak kullanımını da kapatır, Aramayı etkilemez.
    - Bytespider engeli semboliktir; robots.txt'ye uymadığı yalnızca ikincil kaynaklarda yazar. Kullanıcının başlattığı getiriciler (ChatGPT-User, Perplexity-User, Google'ın kullanıcı tetiklemeli getiricileri) robots.txt'ye uymayabilir; bu politika onları denetleyemez.
    - Eğitim kullanımı kapatılmak istenirse: GPTBot, ClaudeBot, CCBot, Applebot-Extended ve meta-externalagent için birer `Disallow: /` grubu eklenir. OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, YandexBot ve DuckAssistBot `*` ile açık kalır.
    - `Sitemap:` satırı `WEB_HOST` tanımlıysa mutlak adresle yazılır. Admin host'unda `Disallow: /`. API host'unda Fastify `GET /robots.txt` → `Disallow: /`.
    - `apps/web/public/robots.txt` silindi: üretimde `app/robots.ts`'yi gölgelerdi, geliştirmede çakışma (500) verirdi.
    - Tarama yükü ~120 indekslenebilir adresle küçüktür. Traefik'te hız sınırı bir Dokploy değişikliği olurdu (DUR-SOR 4); gerekmedi.
  - **Site haritası (`apps/web/src/app/sitemap.ts`):**
    - Dizine eklenen her sayfa TR ve EN olarak yer alır. Her kayıt tr, en ve x-default karşılıklarını mutlak adresle listeler.
    - `lastmod` yalnızca doğrulanabilir tarihse yazılır; `new Date()` kullanılmaz. Google lastmod'u yalnızca "tutarlı ve doğrulanabilir biçimde doğru" ise kullanır.
      - havalimanı: `dataUpdatedAt`, yani havalimanı, pistleri ve pist düzeltmelerindeki en yeni `updated_at`. `updated_at` yalnızca `row_hash` değişince oynar (D-066).
      - `/havalimanlari`: bütün havalimanlarının en yenisi
      - `/yenilikler`: en yeni sürümün tarihi
      - `/kullanim-kosullari`: yürürlük tarihi
      - diğerleri: yazılmaz
    - noindex sayfalar ve admin yoktur. Yandex dil sürümlerini site haritasından okumaz; HTML'deki hreflang etiketleri bu yüzden zorunludur, site haritasındaki karşılıklar Google içindir.
  - **Metadata rotaları ve build:**
    - Env ya da veri okuyan her metadata rotası (`robots`, `sitemap`, `manifest`, `llms.txt`, `/og/site`, havalimanı paylaşım görseli) önce `await connection()` çağırır. Yoksa build sırasında önceden çizilirdi; Docker build'inde `WEB_HOST` ve API yoktur. `dynamic = 'force-dynamic'` kullanılmaz.
    - İkonlar (`app/icon.tsx` 192 ve 512 px, `app/apple-icon.tsx` 180 px) yalnızca şekilden çizilir, yazı tipi gerekmez; build'de bir kez üretilir.
    - `app/favicon.ico` (16, 32, 48 px) `scripts/gen-favicon.mts` ile üretilip commit'lenir; yeni bağımlılık yoktur.
    - Manifest `display: browser`'dır. Service worker gelince (Parça 3 M5) `standalone` olur.
    - Varsayılan site açıklaması (`meta.description`) değişti: eski metin henüz olmayan yaklaşma ve iniş bildirimlerini vaat ediyordu. Manifest ve Organization açıklaması `seo.home.description`'ı kullanır.
  - **Paylaşım (OG) görselleri:**
    - Site görseli: `app/og/site/route.ts`, 1200×630, sabit adres (`/og/site`). Brief'teki `force-static` yerine dinamiktir: `APP_NAME` ve `WEB_HOST` yalnızca çalışma zamanında vardır. Görsel süreç başına bir kez çizilip bellekte tutulur, `Cache-Control: public, max-age=86400`.
    - Havalimanı görseli: `app/istasyon/[icao]/opengraph-image.tsx`, dilden bağımsız (dosya tabanlı görsel adresi iç yoldan gelir; TR ve EN aynı görseli gösterir). Özel `Cache-Control: public, max-age=86400` dinamik görsel rotasında korunur (Next 16.3.6 kaynağında ve yerelde curl ile doğrulandı). `alt` metni sabit uygulama adıdır: havalimanına özel alt metin `generateImageMetadata` ister, Next o zaman build sırasında API'ye istek atabilecek bir `generateStaticParams` ekler.
    - **Yazı tipleri:** `next/og` (Satori) WOFF2 okumaz. Verilen yazı tiplerinde olmayan bir harfi çalışma anında fonts.googleapis.com'dan indirir; bu canlı dış istek proje kurallarına aykırıdır. `@fontsource/overpass`'ın latin alt kümesinde ğ, İ ve ş yoktur.
      - Bu yüzden latin ve latin-ext 400/800 `.woff` dosyaları `apps/web/assets/og-fonts/`'a kopyalandı; OFL-1.1 lisans metni (`OFL.txt`) yanlarındadır.
      - latin-ext ayrı aile adıyla (`Overpass Ext`) harf başına yedektir.
      - Dosyalar çalışma anında diskten okunur ve standalone çıktıya `outputFileTracingIncludes` ile girer.
      - Görsel metinlerinde emoji ve ₺ kullanılmaz. Birim testi, görsel çizilirken `fetch`'in hiç çağrılmadığını doğrular.
  - **Yapılandırılmış veri (JSON-LD):**
    - Sayfa başına tek `<script type="application/ld+json">`, sayfanın üst düzey çiziminde (Suspense içinde değil); `<` karakteri `\u003c` kaçış dizisiyle yazılır (`JSON.stringify(…).replace(/</g, '\\u003c')`, `apps/web/src/components/json-ld.tsx`). Betik sayfa gövdesinde (`<main>`) durur: React satır içi JSON-LD betiğini `<head>`'e taşımaz. Google yapılandırılmış veriyi gövdede de okur; E2E yalnızca ayrıştırılabilirliği ve gövdede olduğunu denetler.
    - Ana sayfa: `WebSite` (`inLanguage` tr ve en, publisher) ve `Organization` (logo 512 px ikon). `SearchAction` yok: Google site içi arama kutusunu 2024-11-21'de kaldırdı. `sameAs` yok: repo gizli, lisans ve repo adresleri 404 döner.
    - `/havalimanlari`: `CollectionPage`, `ItemList` (her havalimanı) ve `BreadcrumbList`.
    - Havalimanı: `WebPage` (`dateModified` = `dataUpdatedAt`), `Airport` (IATA, ICAO, `geo` enlem, boylam ve metre cinsinden yalın sayı olarak rakım, adres, `hasMap` canlı harita) ve `BreadcrumbList` (havayolu › Havalimanları › ad).
    - `/hakkinda`: `AboutPage`. `/yenilikler` ve `/kullanim-kosullari`: `WebPage`. `/durum`'da JSON-LD yoktur.
    - İşaretlenen her değer sayfada da görünür (Google'ın yapılandırılmış veri kuralı).
    - FAQPage, Dataset ve SoftwareApplication yoktur. SoftwareApplication puan ister; puan uydurulmaz.
  - **llms.txt (`apps/web/src/app/llms.txt/route.ts`):**
    - llmstxt.org önerisi (2024-09-03). Sayfalarla aynı i18n metinlerinden ve aynı havalimanı verisinden kurulur; ikisi ayrışamaz.
    - Dizine eklenen her havalimanı için bir satır. E-posta ve kişisel veri yoktur.
    - `llms-full.txt` ve sayfaların `.md` kopyaları eklenmez. Google Search bu dosyaları kullanmaz ("doesn't use them", AI optimization guide). Dosya ucuz ve zararsız olduğu için sunulur.
  - **Havalimanı verisi:**
    - Web tek toplu istek yapar: `GET /v1/airports?country=TR&include=runways`, `revalidate: 3600`, `tags: ['airports']`, React `cache()`. Sayfa, üst veri, site haritası, llms.txt ve paylaşım görseli bu listeden türer.
    - İstemci IP başlıkları bu isteğe eklenmez: Next.js fetch önbelleğinin anahtarı istek başlıklarını içerir (`incremental-cache/index.js` → `generateCacheKey`); eklenseydi önbellek ziyaretçi başına bölünürdü.
    - Saatte ~1 istekle web konteynerinin API hız kovası (dakikada 60, D-060) risk altında değildir; dağıtımdan hemen sonra bütün sayfaları gezen bir tarayıcı da bunu değiştirmez.
    - API kapalıysa önbellekteki eski liste sunulur. Önbellek boşken API kapalıysa sayfa 500 döner, yumuşak 404 değil.
    - **Boş liste (inceleme, 2026-10-01):** İlk kurulumda içe aktarım bitmeden alınan boş liste saatlik kayıtta kalabilir. İlk sürüm o durumda her çizimde önbelleksiz bir istek daha atıyordu; bir saat boyunca her sayfa, OG görseli, site haritası ve llms.txt API'ye gidiyor, web konteynerinin tek hız kovası (dakikada 60) dolunca sayfalar 500 veriyordu. Artık saatlik kayıttaki liste boşsa **dakikalık** ikinci bir önbellek kaydına bakılır (`AIRPORTS_EMPTY_REVALIDATE_S = 60`). Next veri önbelleğinin anahtarı `revalidate`'i içermez, istek başlıklarını içerir; iki kayıt `x-hy-cache-window` başlığıyla ayrılır (API bu başlığı okumaz). Hiçbir çizim önbelleksiz istek atmaz; API'ye en çok dakikada bir istek gider ve içe aktarım bitince sayfalar bir dakika içinde dolar.
    - API: `GET /v1/airports/:code` (4 harfli ICAO ya da 3 harfli IATA, büyük-küçük harf duyarsız; 400 biçim hatası, 404 bilinmeyen kod) API ve mobil istemciler içindir. İki uç nokta da mevcut dakikada 60 sınırını, 10 dk süreç içi önbelleği ve `Cache-Control: public, max-age=300`'ü kullanır.
    - Pist yönü `true_bearing_deg`'den gelir, `heading_degT`'den değil (LTFM'nin 4 pistinde yanlış; D-066). `runway_overrides` alan alan `COALESCE` ile uygulanır.
    - İl adları ISO 3166-2:TR kodundan gelir (`packages/shared/src/reference/tr-provinces.ts`); OurAirports `municipality` çoğu zaman ilçedir (Gaziemir, Tarsus). Bu alan serbest metindir ve İstanbul kayıtlarında İngilizce ya da biçimsizdir ("Istanbul(Bakırköy)", "Pendik, Istanbul", ille aynı "Istanbul"). "Hizmet verdiği yerleşim" satırı ve JSON-LD `addressLocality` bu yüzden ham değeri değil `airportDistrict`'i kullanır: tek bir yer adıysa ve ilden farklıysa (büyük-küçük harf ve Türkçe harf farkı yok sayılarak) gösterilir, değilse satır ve alan yazılmaz. İlçe tablosu tutulmaz: doğrulanmış kaynak olmadan uydurma olurdu (Milas-Bodrum Milas'tadır, OurAirports "Bodrum" yazar; alan "hizmet verdiği yerleşim"dir). Pist kaplaması `runway-surface.ts`'dedir; `PEM` "karışık kaplama" olarak yazılır (DAFIF kodu, OurAirports belgesinde yok).
  - **Resmî havalimanı adları (`packages/shared/src/reference/airport-names.ts`):**
    - ICAO → Türkçe resmî ad, İngilizce görünen ad ve kaynak (`dhmi`, `operator` ya da `ourairports`). Kaynaklar ve erişim tarihleri REFERENCES.md'dedir.
    - Kaynaklar: DHMİ'nin "Havalimanları Web Siteleri" listesi ve havalimanı sayfaları; DHMİ dışındaki işletmecilerin resmî siteleri (İGA, ISG, Gazipaşa-Alanya, Zafer, Eskişehir Teknik Üniversitesi).
    - Brief'te önerilen SHGM listesi (`web.shgm.gov.tr/doc2/havlist.pdf`) 2006 tarihli bir tablo dışa aktarımıdır ve İstanbul Havalimanı'ndan (2018) eskidir; kullanılmadı.
    - 61 havalimanının 50'si DHMİ'den, 5'i işletmeciden (LTFM İGA, LTFJ, LTFG, LTBZ, LTBY Eskişehir Teknik Üniversitesi) gelir. Kaynaklardaki büyük harfli adlar Türkçe başlık biçimine çevrildi ("MİLAS - BODRUM" → "Milas-Bodrum").
    - **İngilizce adlar çeviridir, kaynaktan alınmaz** (inceleme, 2026-10-01): "Havalimanı" → "Airport", "Uluslararası" → "International"; İstanbul ve İzmir noktasız yazılır, diğer Türkçe harfler korunur. DHMİ'nin İngilizce listesi (https://www.dhmi.gov.tr/Sayfalar/EN/DefaultEN.aspx, erişim 2026-10-01) tutarsızdır ("DALAMAN AIRPORT", "MUS AIRPORT", "CUKUROVA AİRPORT", "MUĞLA-MİLAS BODRUM AIRPORT") ve kullanılmadı. Kaynak (`source`) yalnızca Türkçe adın kaynağıdır. İngilizce sayfa bu yüzden "Official Turkish name: <Türkçe ad> (DHMİ); the English name is a translation." yazar; ilk sürüm yalnızca "Official name: DHMİ" diyordu.
    - Resmî adı doğrulanamayan 6 askerî alan OurAirports adıyla kalır (kaynak `ourairports`): LTAD Etimesgut, LTAG İncirlik, LTAH Afyon, LTBG Bandırma, LTBI Eskişehir, LTBL Çiğli. Hiçbiri DHMİ listesinde değildir; hepsi `noindex, follow`'dur.
  - **Kapsama ve yöntem metinleri (inceleme, 2026-10-01):**
    - Kapsama planı (`coveragePlan`, batı/Doğu çemberleri, `PRIMARY_EXTRA_RADIUS_NM`) worker'dan `packages/geo/src/coverage.ts`'e taşındı (`@havayolu/geo/coverage`); worker'ın `plan.ts`'i yeniden dışa açar, zamanlayıcı worker'da kalır. Web aynı planı havalimanı listesindeki etkin istasyonlardan kurar (`liveCoveragePlan`, `isInLiveCoverage`). Listede olmayan istasyonlar (Türkiye dışı ya da IATA kodsuz) hesaba girmez.
    - Havalimanı sayfası canlı haritada çevredeki uçakları yalnızca havalimanı merkezi plandaki bir çemberin içindeyse vaat eder; değilse "canlı veri çekim alanının dışında" der (sayfa ve arama açıklaması). Tohum istasyonlarla dışarıda kalan tek havalimanı Hakkari Yüksekova'dır (LTCW, Doğu çemberinin ~24 NM dışında). `/hakkinda` çekim alanı dışındaki havalimanlarını veriden listeler.
    - Birincil istasyon cümlesi en sık güncellenen alanı 40 NM'lik birincil çember olarak yazar (`PRIMARY_EXTRA_RADIUS_NM`); 40–60 NM halkası 30 sn'lik istasyon hedefiyle batı çemberinden gelir (D-073).
    - `/hakkinda` ve llms.txt'ten "hesaplanan ya da tahmin edilen her değer 'tahmini' etiketi taşır" cümlesi kaldırıldı: pist yönleri, mesafeler ve çağrı kodundan türetilen sefer no etiketsizdir; "tahmini" etiketi domain.md'de yalnızca henüz olmayan tahmini varış ve rota tahmini içindir.
    - Durum satırı cümlesi koda göre düzeltildi: satır birincil istasyonun çevresindeki veri yaşını gösterir, o yoksa en yeni verinin yaşını (`status-strip.tsx` → `dataAgeSeconds`); bakılan bölgenin yaşı farklı olabilir.
  - **Klavye odak halkası (inceleme, 2026-10-01):** `--focus` token'ı: açık temada `#1f5fd1` (zemine karşı 5,4:1), koyu temada ve haritada işaret sarısı. Sarı halka açık zeminde 1,6:1 kalıyor, WCAG 2.1 SC 1.4.11'in 3:1'ini karşılamıyordu. `a`, `.button` ve `.table-wrap` odakları bu token'ı kullanır; E2E iki temada kontrastı ölçer.
  - **Doğrulama env'leri:** `GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION` (`msvalidate.01`) ve `YANDEX_VERIFICATION`. İsteğe bağlıdır, biçimi `^[A-Za-z0-9_-]{1,128}$`'dir; boşsa etiket yazılmaz. Hesapları ve değerleri kullanıcı oluşturur (ACTIVATION); ajan hesap açmaz, değer uydurmaz.
  - **IndexNow şimdilik yok:** Worker'dan yeni bir dış uç noktaya istek ve kullanıcının tutacağı bir anahtar ister. İstenirse ayrı PR'dır (ACTIVATION'daki not).
  - **Riskler ve önlemleri:**
    - 61 şablon sayfada kapı sayfası ya da ölçekli içerik riski (Google spam politikaları; Bing'in birbirine çok benzeyen şablonlar uyarısı). İçerik blokları veriden kurulur, ortak bir giriş metni yoktur. Tarifesiz alanlar noindex'tir. İl ve anahtar kelime listesi yoktur. Tarife, rötar ya da METAR iddiası yoktur; METAR Parça 2 M2'de gelir, o zamana kadar hiçbir başlık ve açıklama METAR'dan söz etmez.
    - Başlık uzunluğu yumuşak bir hedeftir. "İstanbul Sabiha Gökçen Uluslararası Havalimanı" gibi uzun adlarda 60 karakter aşılabilir; kodlar başta kalır.
    - OurAirports veri kalitesi: İngilizce adlar, ilçe düzeyindeki `municipality`, kaplama kodları ve heading tutarsızlıkları yukarıdaki tablolarla karşılanır.
  - **E2E:** `e2e/tests/seo.spec.ts`, `airports.spec.ts` ve `language.spec.ts` çoğunlukla ham yanıtı `request` ile denetler, çünkü tarayıcılar JavaScript çalıştırmadan okur. GPTBot User-Agent'ıyla başlık, canonical ve hreflang `<head>` içinde aranır. Kurulum, web sayfaları istenmeden önce API'nin fixture'daki 61 havalimanını döndürmesini bekler. Admin host'u yolu e2e ortamında yoktur (`ADMIN_HOST` boş); birim testleriyle kapsanır.

## 2026-09-29 — Parça 1 M6 web canlı harita
- **D-075 Harita altlığı, istemci veri yolu, etiketler, geçici kullanım koşulları ve E2E.**
  - **Uydu altlığı (kullanıcı kararı 2026-09-28, D-072'deki DUR-SOR'un sonucu):**
    - Kaynak: Esri World Imagery, ArcGIS Location Platform'un ücretsiz katmanıyla. Ayda 2 milyon karo. Kullandıkça öde açılmadığı için kota dolunca servis ay sonuna kadar durur, fatura çıkmaz.
    - Karoyu tarayıcı doğrudan çeker: `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=<ESRI_API_KEY>`, 256 px, en büyük yakınlaştırma 19.
    - Atıf: "Powered by Esri" ve "Esri, Vantor, Earthstar Geographics, and the GIS User Community".
    - Anahtarsız `server.arcgisonline.com` uç noktası bu kullanım için lisanslı değildir; hiçbir yerde kullanılmaz.
    - Anahtarı kullanıcı üretir (ACTIVATION). Env `ESRI_API_KEY` isteğe bağlıdır; yoksa harita OpenFreeMap'in koyu stiliyle, yollar gizli açılır. Lisans kaydı ve şartlar: data-sources.md §6a.
    - Görüntü kalitesi: LTFM'de 0,34 m, Mayıs 2025 (Vantor "Vivid Advanced"; 2026-09-28 metadata sorgusu).
    - Karşılaştırılan diğer seçenekler:
      - Mapbox: ücretsiz kota 750 bin karo, ölçekte karo başına en pahalısı.
      - MapTiler: Free planı ticari kullanıma kapalı.
      - Google: Google dışı bir haritayla aynı ekranda kullanılamaz, yedek zincir kurulamaz.
      - Stadia: uydu yalnızca ayda 80 $'lık planda.
      - Sentinel-2: 10 m, havalimanı ölçeğinde bulanık.
      - EOX: ticari kullanıma açık tek sürümü (2016) LTFM'den eskidir.
  - **Karolar sunucudan geçmez:** E204 §3.1d.2'ye göre bir isteğin çıktısı yalnızca tek bir kullanıcıya hizmet edebilir. §3.1d.6 önbelleğe almaya yalnızca HTTP önbellek başlıklarının izin verdiği kadar izin verir; toplu indirme ve çevrimdışı paket yoktur. Bu yüzden worker ya da API aracılığı, CDN ve service worker önbelleği kullanılmaz. "Harici servislere yalnızca worker erişir" kuralının istisnası harita karolarıdır; OpenFreeMap'te de karoyu tarayıcı çeker.
  - **Anahtar tarayıcıda görünür.** Karo adresi anahtarı taşır, istemcide gizlenemez. Önlemler:
    - Anahtar yalnızca "Basemaps" yetkisini taşır.
    - İzinli referrer'lar `https://havayolu.live/*` ve `https://www.havayolu.live/*`'dır. Referrer taklit edilebilir; bu tam bir koruma değildir.
    - Süre en çok 1 yıldır ve anahtar her yıl yenilenir.
    - Kötüye kullanımın en kötü sonucu kotanın bitmesidir: ücretsiz katmanda fatura çıkmaz, karolar hata verir ve harita aşağıdaki zincirle vektör altlığa geçer.
  - **Kota:** Etkileşimli oturum başına ~300 karo varsayımıyla ayda ~6.700 oturum eder (tahmin). Büyümede Esri'nin "basemap session" faturalaması denenir; karar kullanıcıya aittir (ücretli bağımlılık, DUR-SOR 5).
  - **Açık konular:**
    - E204 §3.1c.5, uygulama kullanıcılarının Esri şartlarına uymasını isteyen bir maddenin kullanım koşullarında yer almasını ister. Anahtar üretimde tanımlı olduğundan madde beklemez: M6'da geçici kullanım koşulları yayımlanır (aşağıda "Kullanım koşulları"). Kapsamlı metin Parça 3 M6a'dadır.
    - §3.1b.5 Esri ürünleriyle "rekabet eden" ürünü yasaklar. Herkese açık bir uçuş takipçisi için büyük olasılıkla sorun değildir, ama kesin değildir.
    - §3.1a.4'e göre Esri çıktısı açık veritabanı lisansına bağlanamaz. Görüntü yalnızca gösterilir; ODbL altındaki iz veritabanına hiçbir zaman girmez.
  - **Altlık zinciri (`resolveMapConfig`, `apps/web/src/lib/map-config.ts`):**
    1. `MAP_STYLE_URL` `/` ile başlıyorsa ya da `EXTERNAL_PROVIDERS_DISABLED=true` ise yerel stil kullanılır: `MAP_STYLE_URL` göreliyse o, değilse `/test-style.json`. Yerel geliştirme, testler ve CI bu yoldadır; dışarıya karo isteği gitmez.
    2. Değilse ve `ESRI_API_KEY` varsa uydu kullanılır. Stil kodda kurulur: arka plan ve raster katman.
    3. Hiçbiri yoksa vektör kullanılır: `MAP_STYLE_URL_DARK` (yoksa `MAP_STYLE_URL`), yedek `MAP_STYLE_FALLBACK_URL`. Yüklenince `source-layer`'ı `transportation` ya da `transportation_name` olan katmanlar gizlenir; `aeroway` kalır.
  - **Hata davranışı (data-sources.md §6):**
    - Stil ya da karolar 3 kez yüklenemezse sonraki adıma geçilir.
    - Uydunun yedeği, dış servisler açıksa vektör zinciridir: önce koyu stil (`MAP_STYLE_URL_DARK`, yoksa `MAP_STYLE_URL`), sonra `MAP_STYLE_FALLBACK_URL` (varsa; ör. kendi barındırdığımız Protomaps yedeği, kendi atfıyla). Anahtarsız vektör zincirindeki yedekle aynıdır.
    - O da yüklenemezse kodda kurulan düz arka plan (`#0B1016`) çizilir ve "Harita altlığı yüklenemedi" şeridi çıkar.
    - Uçaklar her durumda çizilmeye devam eder. Harita koddaki düz arka plan stiliyle açılır ve kendi katmanlarımız hemen eklenir. Altlık stili indirilirken, yanıt vermeyen sunucu için 3 × 20 sn beklenirken ya da yeniden denenirken uçaklar bu arka planda (ya da ekrandaki eski altlıkta) çizilir ve seçilebilir. Katmanlar yalnızca `setStyle` anında kısa süre kalkar, yeni stil yüklenince yeniden eklenir.
  - **İstemci API'ye doğrudan bağlanır:**
    - REST adresi `API_HOST` `localhost`, `127.0.0.1` ya da `[::1]` ile başlıyorsa `http://<API_HOST>`, değilse `https://<API_HOST>`'tur.
    - WebSocket adresi aynı kuralla `ws`/`wss` ve `/v1/ws`'dir.
    - API'nin CORS ve WS `Origin` denetimi `WEB_HOST`'u zaten tanır (D-074). Web sunucusu canlı veriyi aktarmaz.
  - **Etiket satırları (v1):**
    - Tam etiket iki satırdır. 1. satır sefer no; yoksa gri çağrı kodu, yoksa gri tescil (tasarım tuvalindeki "TC-JVI" gibi), o da yoksa gri büyük harfli hex. Bilgi kartı başlığı, tablo ve arama sonucu aynı sırayı kullanır. 3. satır "431 km/sa · 333 m"; uçak yerdeyse "yerde".
    - 2. satır (güzergâh) ve 4. satır (pist), verisi gelince eklenir: güzergâh Parça 2 M2'de, pist hizası Parça 2 motorunda. Her uçakta "Güzergâh ?" yazmak gürültü olurdu.
    - Kısa etiket yalnızca 1. satırdır.
    - Yer bulamayan etiket çizilmez. Yalnızca seçili uçağın etiketi (ayarı Gizle değilse) gerekirse çakışarak yerleşir; seçim yokken en öncelikli etiket de diğer simgelerin üstüne zorla konmaz ("Etiketler üst üste binmez", domain.md).
  - **Örnek yaşı ve ara değerleme:**
    - Örnek zamanı `t` sunucu saatiyle yazılır ve hiçbir zaman istemci saatiyle (`Date.now()`) karşılaştırılmaz; iki saat arasındaki kayma bilinmez.
    - Sunucu saati her WebSocket mesajından tahmin edilir. Mesajdaki en yeni örnek + `status.newestAgeS` sunucu saatinin alt sınırıdır, çünkü sunucunun en yeni örneği mesajdakilerden eski olamaz. En sıkı alt sınır, alındığı andaki istemci saatiyle tutulur ve istemci saatiyle ileri taşınır. Daha gevşek sınır (ör. yalnızca eski uçakların olduğu sakin görünüm) tahmini geri almaz.
    - Bir örneğin yaşı = tahmini sunucu saati − `t`. İki değer de sunucu saatindendir, kayma etkilemez. Hata yalnızca ağ gecikmesi kadardır ve yaşı küçük gösterir, büyük göstermez.
    - Her uçak için `receivedAt` (istemciye ilk ulaştığı an) ve `sampledAt` (örneğin alındığı anın istemci saatindeki tahmini; en çok `receivedAt`) tutulur. Sunucu önbelleği uçağı son örnekten 120 sn sonrasına kadar tuttuğundan görünüme yeni giren uçağın örneği dakikalık olabilir (ör. alçakta sinyali kesilen iniş). "Son görülme", tahminin ufku ve istemcideki budama (120 sn) `sampledAt`'e dayanır: eski örnekli uçak "0 sn önce" görünmez ve sunucuyla aynı anda düşer. Sunucu saati bilinmeden eklenen örnek (WebSocket'ten önce gelen arama sonucu), aynı örnek bir tam görüntüyle yeniden gelince düzelir.
    - Konum, `sampledAt`'ten bu yana yer hızı ve yönle ileri hesaplanır; örnekten en çok 10 sn sonrasına gidilir. Sinyali çoktan kesilmiş uçak ilerliyormuş gibi gösterilmez.
    - Yeni örnek gelince (ya da örnek zamanı tahmini düzelince) gösterilen konumdan yeni tahmine 1 sn'de geçilir.
    - Eldekinden eski örnek (arama isteği yoldayken gelen yeni fark) yok sayılır; iz ve simge geri sıçramaz.
    - İstemci içindeki bütün süreler geri gitmeyen saatle ölçülür (`performance.timeOrigin + performance.now()`): çizim döngüsü, seyreltmeler, alınma zamanları ve saniyelik saat. Sistem saati geri alınsa da (uykudan dönüşte eşitleme, elle değişiklik) döngü durmaz; abonelik ve tablo güncellenmeye devam eder.
    - Çizim döngüsü ~15 kare/sn'dir. Kaynağa `setData` yalnızca küme, depo sürümü, seçim ya da ayar değişince ya da bir simge son yüklemeden bu yana ekranda en az 0,5 px kayınca verilir; Türkiye görünümünde seyirdeki uçak ~0,25 px/sn kayar. "Uçağı ortala" da kamerayı ancak uçak ortadan 0,5 px uzaklaşınca oynatır.
    - `fadeDuration: 0`: uçak simgeleri yerleşime katılmadığından sembol geçişinin görsel etkisi yoktur, yalnızca çizimi her karede sürdürürdü. Etiketler haritanın her `render` olayında yeniden çizilir.
  - **Görünüm aboneliği:**
    - Sunucu her abonelikte tam görüntü gönderir, farkları ise 2°'lik hücreler hâlinde, görünümle kesişen bütün hücreler için yollar (D-074). Abonelik kutusu bu yüzden dışa doğru hücre sınırlarına yuvarlanır; üst kenar sınırın hemen altındadır, fazladan hücre sırası yoktur. Tam görüntü farklarla aynı uçakları taşır ve kutu, görünüm yeni bir hücreye taşmadıkça değişmez.
    - Yeniden abonelik yalnızca iki durumda yapılır: görünüm eldeki kutunun dışına taşınca ya da kutu gerekenin 4 katından büyükken (yakınlaşma). API'nin en geniş kutusundan (60° × 40°) büyük görünümde kutu, hücreye yuvarlanmış merkezin etrafında kurulur.
    - "Uçağı ortala" haritayı her turda kaydırır. Önceden bu, saniyede iki abonelik ve istemci başına saniyede bir tam görüntü demekti; iki sekme IP başına dakikada 120 aboneliklik bütçeyi tüketiyordu. Şimdi abonelik, uçak bir hücre sınırını geçtiğinde (dakikalar) yenilenir.
    - Açık bağlantıda 30 sn hiç mesaj gelmezse aynı abonelik yeniden gönderilir (`lastSeq` olmadan). Sunucu yalnızca görünümde değişiklik olunca mesaj gönderir; sakin bir görünümde (ya da veri akışı durunca) sağlayıcı durumu başka türlü tazelenmez. Sunucu sağlayıcı kaydını 30 sn'de bayat sayar. Bedeli, sakin görünümde dakikada en çok iki küçük tam görüntüdür.
  - **Veri yaşı (durum şeridi):**
    - Değer sunucunun son durum mesajındaki `primaryAgeS`'tir (birincil istasyon tazeliği; yoksa `newestAgeS`).
    - Son durumda sağlayıcılar `ok` ise (data-sources.md → Sağlayıcı durumu: son 60 sn'de başarılı yanıt, istasyon tazeliği hedefte) değer olduğu gibi gösterilir. Mesaj gelmemesi yalnızca görünümde hareket olmadığını gösterir; sakin bölgede sayaç yanıltıcı biçimde artmaz.
    - Sağlayıcı `degraded`, `down` ya da yoksa besleme gecikiyor demektir; mesajdan bu yana geçen süre eklenir.
    - 30 sn'lik sessizlik yenilemesi sayesinde gösterilen `ok` durumu en çok ~30 sn eskidir.
  - **İz:**
    - Yalnızca istemcide tutulur: sayfa açıldığından beri alınan konumlar, uçak başına son 600 nokta, yalnızca konum değişince.
    - Yalnızca seçili uçak için çizilir: havadaki bölüm düz amber (`#FFB300`), yerdeki bölüm düz camgöbeği (`#22D3EE`), opaklık 1.
    - M6'da sunucudan iz geçmişi alınmaz.
  - **Havalimanları (`GET /v1/airports?country=TR`):**
    - OurAirports referans verisinden IATA kodu olan büyük, orta ve küçük havalimanları döner. ICAO kodu `icao_code`, yoksa `gps_code`, o da yoksa `ident`'tir.
    - IP başına dakikada 60 istek. Ülke başına 10 dk süreç içi önbellek; boş liste 60 sn tutulur, çünkü ilk kurulumda içe aktarma API açıldıktan sonra biter. Yanıt `cache-control: public, max-age=300` taşır.
    - Hatalar: `bad_country` (400) ve `airports_unavailable` (503: veritabanı yok ya da okuma başarısız ve eldeki kopya yok). Okuma başarısızsa eldeki eski kopya sunulur ve veritabanı 60 sn yeniden denenmez.
    - Harita listeyi açılışta bir kez alır; alınamazsa harita havalimanları olmadan çalışır. IATA kodları etiket tuvalinde, yakınlaştırma 5 ve üstünde yazılır.
    - Tuval uçak katmanının üstünde olduğundan kod hiçbir uçak simgesini (seçili uçağınkini hale payıyla) ve seçili uçağın izini örtmez: bunlara değen konum denenmez, dört konum da doluysa kod yazılmaz. Pistte ve önlükte, havalimanı noktasının yanındaki yer hareketi böylece görünür kalır. Glif gerektiren bir GL sembol katmanı seçilmedi, çünkü uydu ve yerel stillerde glif adresi yoktur.
  - **MapLibre yüklemesi (`maplibre-loader.ts`):**
    - MapLibre sayfa paketinde değildir. Arama, tablo ve paneller kütüphaneyi beklemeden çizilir; WebGL2 olmayan tarayıcı onu hiç indirmez.
    - v6 üç ESM dosyasıdır: ana modül, çizim işçisi ve ikisinin içe aktardığı ortak modül (~516 KB). Üçü `new URL(…, import.meta.url)` ile statik varlık olarak yayınlanır. Turbopack'te `import.meta.url` tarayıcıda `file:///ROOT/…` olduğu için kütüphane işçiyi kendisi bulamaz; özetli dosya adları yüzünden de göreli `./maplibre-gl-shared.mjs` içe aktarımı çözülemez.
    - Ana modül ve işçi kaynağı indirilir, bu içe aktarım mutlak adrese çevrilir ve ikisi blob adresi olarak açılır: ana modül `import()` ile, işçi `setWorkerUrl` ile. Ana modülün ad alanı nesnesi `import * as maplibregl`'inkiyle aynıdır.
    - Ortak modül böylece bir kez iner: `modulepreload` ile erken istenir, işçi HTTP önbelleğinden alır. Önceden paketlenmiş ana modül ortak kodu kendi içine alıyor, işçi aynı kodu ikinci kez indiriyordu.
    - Blob aynı kökendendir. İleride CSP eklenirse `script-src blob:` ve `worker-src blob:` gerekir.
  - **Harita hazır:** "Harita yükleniyor" metni ilk `style.load`'da (koddaki düz arka plan), kendi katmanlarımız eklenince kalkar. MapLibre'nin `load` olayı beklenmez: bütün kaynakların yüklenmiş olmasını ister, uçak kaynağı ise sık `setData` aldığından yoğun trafikte gecikebilir.
  - **Seçim ve bilgi kartı:**
    - Seçim yalnızca kartın Kapat düğmesiyle kalkar; boş haritaya tıklamak seçimi değiştirmez.
    - Seçili uçak görünümün dışına çıkıp abonelikten düşerse kart son bilinen durumla açık kalır ("Son görülme" ilerler).
    - Dar ekranda (768 px altı) kart alttan açılır. Kartın yüksekliği haritaya alt boşluk (`padding`) olarak verilir; seçili uçak ve "Uçağı ortala" kartın üstündeki görünür bölgede kalır.
    - Harita düz ve kuzeyi yukarıdadır (döndürme ve eğim kapalı); etiket yerleşimi ve simge yönü bunu varsayar.
    - "Uçağı ortala" açıkken fare tekerleği ve kıstırma yakınlaştırması ekranın ortasına göre yapılır. MapLibre 6'da `scrollZoom.enable` açık denetimde seçeneği yok sayar; bu yüzden önce kapatılır. İki parmakla başlayan hareket kaydırma sayılmaz; "Uçağı ortala"yı yalnızca tek parmakla ya da fareyle sürükleme kapatır.
    - Paylaşılan bağlantı (`/?hex=`): uçak önce `/v1/search` ile aranır. Arama bulamaz ya da hata verirse (açılıştan hemen sonra 503, 429) ilk tam görüntü beklenir; uçak görünümdeyse depodan seçilir. Orada da yoksa arama bir kez yinelenir; yine yoksa arama alanında spec'teki "bulunamadı" metni çıkar. Uçak sonra görünüme girerse yine seçilir. Kullanıcı kendisi bir seçim yapınca süreç biter.
  - **Atıf:**
    - Canlı veri atfı data-sources.md §1'deki biçimdedir ("Canlı uçuş verisi: ADSB.lol — ODbL 1.0", iki bağlantı). MapLibre atıf kutusunun `customAttribution`'ında durur ve küçük ekranda da katlanmaz.
    - Harita yokken (yükleniyor, WebGL2 yok, harita kurulamadı) arama, tablo ve kart yine canlı veri gösterir. Aynı atıf ve bağlantılar o zaman bir React öğesiyle aynı köşede gösterilir.
    - Altlığın atfı stilin kendi kaynağından gelir; yalnızca o altlık görünürken çıkar. İngilizce altlık atıfları (Esri, OpenFreeMap) `lang="en"` taşır (WCAG 3.1.2).
    - Canlı veri atfı ile "Koşullar" bağlantısı tek bir `customAttribution` girdisidir. MapLibre girdileri uzunluğa göre sıralar; ayrı girdi olsa bağlantı atfın başına düşerdi.
    - Atıf satırı panellerin üstündedir. Dar ekranda uzun altlık atfı (Esri, 320 px'te 3 satır) kırılınca alt panellerin bıraktığı yükseklik (`--map-attrib-space`, en az 36 px) ölçülen satır yüksekliğine göre büyür; liste düğmesi ve denetimler atfın altında kalmaz.
  - **Kullanım koşulları (`/kullanim-kosullari`, kullanıcı kararı 2026-09-29):**
    - Neden şimdi: E204 §3.1c.5 kullanım koşullarında Esri şartlarına uyma maddesi ister. Esri anahtarı üretimde tanımlı, uydu altlığı M6 yayınıyla açılır. Kapsamlı metni (Parça 3 M6a) beklemek maddesiz yayın demekti. Seçenekler: anahtarı M6a'ya kadar kaldırmak ya da kısa bir geçici metin yayımlamak. Kullanıcı geçici metni seçti.
    - İçerik kısa ve olgusaldır, hukuki iddia eklenmez:
      - yürürlük tarihi 29 Eylül 2026; metnin geçici olduğu ve kapsamlı koşullarla gizlilik politikasının yakında yayımlanacağı açıkça yazar
      - hizmet: herkese açık, ücretsiz, ADS-B'ye dayalı, bilgi amaçlı; operasyonel, seyrüsefer ve emniyet kararları için değil; doğruluk, eksiksizlik ve erişilebilirlik garantisi yok, "olduğu gibi"
      - veri: ADSB.lol (ODbL 1.0) ve koşulların ADS-B türevi veri üzerindeki ODbL haklarını kısıtlamadığı (ODbL 4.7, Parça 3 M6a); OurAirports (kamu malı)
      - harita: uydu gösterilince görüntü Esri'nindir, haritayı kullanan Esri'nin geçerli şartlarına uymayı kabul eder (E204 ve E300 bağlantılı); karolar indirilemez, kazınamaz, tarayıcının standart önbelleği dışında saklanamaz ve dağıtılamaz; vektör altlıkta OpenFreeMap, OpenMapTiles ve OpenStreetMap (ODbL)
      - kullanım: API'nin bildirdiği istek sınırlarını aşan otomatik toplu toplama ve hizmeti aksatma girişimi yok
      - gizlilik: askeri uçak gösterilmez, PIA/LADD tescili gösterilmez
      - kod MIT'tir; ad ve logo MIT kapsamında değildir (`legal.brand` metni yeniden kullanılır)
      - koşullar güncellenebilir, güncellenince tarih değişir
    - İletişim satırı yoktur (`CONTACT_EMAIL` tanımsız). `/hakkinda` henüz olmadığı için bağlantı verilmez.
    - Metinler `packages/i18n` → `terms`'tedir (TR/EN). Sayfa sunucu bileşenidir, dil çerezden gelir; adres iki dilde aynıdır. Yürürlük tarihi ve belge adresleri `apps/web/src/lib/terms.ts`'tedir.
    - Bağlantı her zaman görünür: site alt bilgisinde ("Kullanım koşulları") ve haritanın atıf satırında ("Koşullar"; harita yokken sayfadaki atıf öğesinde de). Harita sayfasında alt bilgi gizli olduğundan atıf satırı tek görünür yerdir.
    - Hukukçu incelemesi ACTIVATION'dadır (Parça 3). Parça 3 M6a metni genişletir ve gizlilik politikasını ekler.
  - **Analiz onayı:** Harita sayfasında alt bilgi gizlidir. Analiz açıksa "Analiz tercihleri" düğmesi harita denetimlerinde, "Etiketler"in üstünde durur. Onay, verildiği sayfada geri alınabilir (KVKK; GDPR md. 7/3).
  - **E2E:**
    - Playwright testleri kökteki `e2e/` klasöründedir. Chromium SwiftShader'la çalışır (WebGL2 GPU'suz). Web sunucusu `pnpm dev:replay`'dir, `reuseExistingServer: false`. Harita yerel test stiliyle açılır.
    - Testler uçakları WebGL tuvalinden değil, erişilebilir tablodan okur.
    - M1a'dan kalan onay bandı testi de eklendi. Analiz adresi yerel ve sahtedir (`http://127.0.0.1:4390`); takip script'i isteği `page.route` ile tarayıcıda yanıtlanır, dışarıya istek gitmez.
    - Web sunucusunun ortamında Next.js ve Turborepo telemetrisi kapalıdır.
    - CI'da web, API ve worker günlükleri (`stdout`) iş çıktısına aktarılır; başarısız koşu buradan incelenir. Yerelde yalnızca hata çıktısı gösterilir.
  - **E2E'nin CI bedeli:**
    - CI'daki `e2e` işi her PR'da ve `main` push'unda çalışır. infra.md yalnızca ilgili dosyalar değişince çalışmasını öngörüyordu, ama henüz `changes` işi yok. `deploy` de `e2e`'yi bekler.
    - Bedeli Actions dakikasıdır. İş başına tahmin 6–8 dk'dır (kurulum, Chromium önbelleği, altyapı, ilk derleme ve testler); PR ile birleşme birlikte ~12–16 dk ekler. Gizli repoda ayda 2.000 dakika vardır.
    - Dakikalar daralırsa `dorny/paths-filter` ile bir `changes` işi eklenir; e2e yalnızca `apps/`, `packages/`, `tools/`, `e2e/`, lockfile ya da workflow değişince çalışır. `deploy` bu durumda atlanan işi başarı sayacak biçimde bağlanır.

## 2026-09-28 — Parça 1 M5 canlı API
- **D-074 Canlı API'nin spec'te açık kalan ayrıntıları.**
  - **Veri yolu:** API, `redis-live`'ı saniyede bir yoklar ve bellekte gizlilik uygulanmış bir önbellek tutar; REST, arama ve WebSocket bu önbellekten okur. Her turda `hy:ac:seen`'den son 120 sn'deki hex'ler skorlarıyla okunur; yalnızca skoru değişenlerin hash'i çekilir. Pencere son yoklamaya değil yaşa göredir: adsb.lol örneğinin `sampleTime`'ı yazıldığı andan saniyeler önce olabilir, "son turdan beri" penceresi bu örnekleri kaçırırdı. Sağlayıcı kaydı 30 sn'den eskiyse sağlayıcı `down` sayılır (worker durmuş). Bu süreçte görülmüş bir sağlayıcının kaydı kaybolursa (worker 180 sn'den uzun durdu, TTL doldu) ya da API kayıtları 30 sn'dir okuyamıyorsa (redis-live erişilemez) sağlayıcı yanıttan düşmez, `down` görünür. Worker yapılandırdığı sağlayıcıların listesini `hy:ingest:providers`'a yazar (TTL 7 gün); API bu listedeki sağlayıcıyı da görülmüş sayar. Böylece worker çökükken yeniden başlayan API de sağlayıcıyı `down` gösterir, yanıttan düşürmez. Ne listede olan ne de görülmüş sağlayıcı yanıtta yer almaz. Pub/sub'daki kompakt kayıtta etiket alanları yoktur. Silinme olayı da yayınlanmaz; silinme, 120 sn'yi aşan kaydın önbellekten budanmasıyla anlaşılır.
  - **`seq`:** API sürecinin kendi sayacıdır, yalnızca değişen turda artar. Son 120 turun farkı tutulur. `lastSeq` bu tamponun dışındaysa tam görüntü gönderilir. Sayaç sürecin başlangıç anından (epoch ms) başlar. Tur en sık 250 ms'de bir olduğundan önceki sürecin her `seq` değeri yeni tabanın altında kalır: yeniden başlayan API'ye eski `lastSeq` ile gelen istemci yanlış süreçten fark değil tam görüntü alır.
  - **Kapsama:** Worker plan çemberlerini `hy:ingest:coverage`'a yazar (TTL 600 sn). `/v1/live` istenen kutunun 5×5 noktasının (köşeler dahil) hepsi bir çemberin içindeyse `full` döner. Hiçbir çember kutuya değmiyorsa `none` döner; bu karar örnek noktalarla değil, çember merkezinin kutuya en kısa uzaklığıyla verilir (geniş görünümde çember noktaların arasına sığabilir). Arası `partial`, plan okunamıyorsa `unknown`'dır.
  - **Kayıt biçimi:**
    - `PublicAircraft` (`apps/api/src/live/types.ts`); birimler ft, kt, ft/dk (D-072).
    - Rakamlı çağrı kodundan sefer no çıkarılır (THY974 → TK 974); ICAO→IATA eşlemesi `airlines` ve `airline_overrides` tablolarından gelir.
    - Güzergâh ve pist alanları Parça 2'de eklenir.
  - **Gizlilik:** Askeri ve bayrağı bilinmeyen uçak (D-071) hiçbir yanıtta yoktur; PIA/LADD'de tescil ve tescile eşit çağrı kodu gizlenir.
  - **Engel listesi:** `redis-queue`'da `hy:blocklist:hex` kümesidir; API 30 sn'de bir okur. API kapalı başlar: liste ilk kez başarıyla okunana kadar (5 sn'de bir denenir) önbellek başlamaz, `/v1/live` ve arama 503 `live_unavailable`, WS 1013 `live_unavailable` döner; engelli uçak açılışta bir an bile görünmez. Sonraki okuma hataları son iyi listeyi korur. `redis-queue` tanımsızsa liste tutulamaz ve yönetilemez; boş sayılır. Yönetimi şimdilik yalnızca admin API'sindedir (`/v1/admin/blocklist`); admin arayüzü sonraki parçada gelir.
  - **WebSocket:**
    - JSON metin çerçeveleri kullanılır. İzgara 2°'lik hücrelerden oluşur. Her turda dokunulan hücrenin parçası bir kez serileştirilir; istemci mesajı bu ortak Buffer'ların birleşimidir.
    - En fazla saniyede bir fark gönderilir.
    - İstemci bir farkı şöyle uygular: önce bütün hücrelerin `removed` listeleri, sonra `added` ve `updated` kayıtları (ikisi de "ekle ya da güncelle"). Hücre değiştiren uçak eski hücrede `removed`, yenisinde `added` olarak gelir.
    - `lastSeq` yalnızca bağlantının ilk aboneliğinde ve aynı görünüm için geçerlidir; sonraki her abonelik tam görüntü alır. Devam farkı son turun değil o anın durumunu (`status`) taşır.
    - Abonelik (tam görüntü ya da `lastSeq` farkı) soket başına saniyede bir, IP (/64) başına dakikada 120'dir (`/v1/live` sınırı; IP'nin bütün soketleri paylaşır, GCRA kovası). Fazlası atılmaz: ertelenir ve en son istenen görünüm ilk uygun anda işlenir. Kova son soket kapansa da dolana kadar tutulur; yeniden bağlanmak bütçeyi sıfırlamaz.
    - Geri basınç: 1 MiB'ta farklar atlanır ve bir sonraki uygun turda tam görüntü gönderilir; 4 MiB'ta bağlantı hemen koparılır (`terminate`). Merkez geneli bütçe 64 MiB'tır (hy-api `mem_limit` 384m, heap 270m; tamponlar heap dışındadır). Soket sınırı tek başına yetmez: 2.000 yavaş istemci 2 GiB tutabilir. Her turda istemcilerin tampon toplamı bütçeyi aşarsa en çok biriktirenler, toplam bütçenin altına inene kadar koparılır. `close()` yerine `terminate()` kullanılır, çünkü `ws` okumayan istemcinin tamponunu kapanış el sıkışması boyunca (en geç 30 sn) tutar ve bağlantı sayaçları da o süre dolu kalır. Koparılan istemci 1006 görür ve geri çekilmeyle yeniden bağlanır.
    - Ping 25 sn'de bir atılır; iki pong kaçıran bağlantı kapatılır.
    - Sınırlar: IP (/64) başına 10 bağlantı; toplam `WS_MAX_CONNECTIONS`.
    - `Origin` başlığı varsa web host'larından biri olmalıdır; başlığı olmayan yerel uygulama kabul edilir.
    - Sıkıştırma kapalıdır, en büyük istemci mesajı 16 KiB'tır.
    - SIGTERM'de her istemciye `{type:'reconnect', afterMs: 1–10 sn}` gönderilir ve bağlantı 1012 ile kapatılır.
  - **Hız sınırları (IP başına):** `/v1/live` 120/dk, `/v1/search` 60/dk, WS el sıkışması 30/dk, WS aboneliği 120/dk; diğer yollar genel 300/dk.

## 2026-09-28 — Parça 1 M4 ingest; metrik birimler ve harita etiketleri
- **D-073 Ingest'in spec'te açık kalan ayrıntıları.** Spec'in (data-sources.md §1, parca-1.md M4) sayı vermediği yerlerde standart ve güvenli seçenek alındı.
  - **Hız kovası (adsb.lol):**
    - Kapasite 1 jetondur, patlama yoktur: araştırmada 15 isteklik patlama 5. istekte 429 aldı.
    - `ADSBLOL_RPS` 0,05–0,2 dışındaysa env hatasıdır; sessizce kırpılmaz.
    - **429/420:** Hız yarıya iner (alt sınır 0,05). Bekleme: Retry-After varsa o, yoksa tam jitter'lı üstel merdiven (15, 30, 60, 120, 240, 300 sn). Kovanın kendi aralığı (1/hız) da korunur.
    - **Toparlanma:** Temiz 10 dk, 429/420/5xx/ağ hatası olmayan 10 dk demektir. Her temiz 10 dk'da hız %10 artar, üst sınır 0,2'dir. Her hata sayacı sıfırlar.
    - **Devre kesici:** 5xx, ağ ve bozuk yanıt 5 kez üst üste gelirse devre 60 sn açılır. Sonra yarı açık tek deneme yapılır; o da başarısızsa süre ikiye katlanır (en fazla 10 dk).
    - **401/403:** Devre `config` durumunda kalıcı açılır ve süreç yeniden başlayana kadar istek atılmaz. E-posta uyarısı SMTP gelince (Parça 2) bağlanır; o zamana kadar durum admin Servisler panelinde "Çalışmıyor" görünür ve log `error` yazar. RUNBOOK'ta adımı vardır.
  - **Durum hesabı** (data-sources.md tanımı):
    - `down`, `degraded`'dan önce gelir.
    - Hata oranının paydası son 60 sn'deki bütün isteklerdir; payı 429/420/5xx'tir.
    - **Tazelik:** Bir bölgenin veri zamanı, onu kapsayan son başarılı çekimdeki uçakların medyan `sampleTime`'ıdır; bölgede uçak yoksa yanıtın `now` değeri kullanılır. Birincil istasyonun yaşı saniyede bir örneklenir ve p95 son 5 dk üzerinden hesaplanır.
  - **Kapsama ve zamanlayıcı:**
    - P0 çemberlerini içeren batı çemberi, sığmayan istasyonlar için ayrı çember, birincil istasyon için ARP merkezli 40 NM çember ve her zaman Doğu çemberi.
    - Her slotta, kaçırılmak üzere olan hedefler arasından en önemlisi seçilir (erken son tarih). Hedefler: birincil 20 sn, takip listesi 30 sn, diğer istasyonlar 30 sn, Doğu 90 sn. Önem sırası data-sources.md'deki gibidir: önce Doğu, sonra diğer istasyonlar düşer.
    - **Takip listesi:** Uçağın son konumu 30 sn hedefli bir çemberin içindeyse, o çember son 30 sn'de çekildiyse ve uçak o yanıtta geldiyse `/v2/hex` atılmaz. Kapsama dışındaki, kapsayan çemberin son yanıtında gelmeyen ya da hiç görülmeyen uçaklar toplu `/v2/hex` ile istenir.
    - **Takip işinin son tarihi:** son örnek ile son `/v2/hex` isteğinin büyüğü + 30 sn. Uçak susunca son tarih geçmişte donmaz; `/v2/hex` 30 sn'de en çok bir kez atılır.
    - **Eşit önem:** Eşit önemli işlerde son tarihini hâlâ tutturabilecek olan, kaçırmış olandan önce gelir.
    - **Kalıcı kapsama dışı:** Kapsama dışında kalan ya da hiç görülmeyen bir takip uçağı 0,1 istek/sn'de boş slotları alır. Doğu çemberi bu sürede düşer; önem sırası gereği buna izin verilir.
    - P3 kapalıdır.
  - **Yerel alıcı:** 1 sn'de bir okunur. Hız kovası yoktur; adsb.lol'den bağımsızdır. CONTACT_EMAIL olmadan da çalışır: dış istek değildir ve replay bu yoldan gelir.
  - **Birleştirme:** Hex başına yalnızca daha yeni `sampleTime` kabul edilir; eşit zaman aynı örnektir, bir kez yazılır. Bayrağı `null` gelen örnek, aynı hex'in son 24 saatte bilinen bayrağını taşır (D-071).
  - **Canlı durum (`redis-live`):** Anahtarlar projenin `hy:` önekini taşır:
    - `hy:ac:{hex}` hash'i: `d` alanında `AircraftState` JSON'u, `t` alanında `sampleTime`; TTL 120 sn
    - `hy:ac:geo` (GEO) ve `hy:ac:seen` (son görülme zaman kümesi); süpürme bu kümeyle yapılır
    - `hy:ac:updates` stream'i, `MAXLEN ~ 50000`
    - `hy:ac:batch` pub/sub
    - `hy:provider:{id}` sağlayıcı anlık durumu
    - `hy:ingest:regions` bölge tazeliği

    İndeks anahtarlarına her turda 600 sn TTL verilir. `volatile-ttl` bellek dolunca onları da atabilir; sonraki tur yeniden kurar.
  - **Uçuş kaydı:**
    - Yeni kayıt: 30 dk'dan uzun boşluk ya da iki dolu çağrı kodu arasında değişim. Çağrı kodunun boşalıp dolması yeni kayıt değildir.
    - **Yerde 20 dk:** Önceki kayıt kapanır ve yeni kayıt yer beklemesinin 20. dakikasında başlar. Aynı yer beklemesinde ikinci kez bölünmez; park eden uçak saatte üç kayıt üretmez.
    - Durum bellekte tutulur. Açılışta son 30 dk'da görülen `active` kayıtlar yüklenir, daha eskileri `ended` yapılır.
    - **Açılışta yer bekleme durumu:** Kaydın `track_points_sampled` satırlarının sonundaki yerde dizisinden kurtarılır (`loadTrailingGroundStart`). Kayıt yerde başladıysa ya da bekleme 20 dk'yı aştıysa bölünme yapılmış sayılır. Bu yüzden yeniden başlatma fazladan kayıt üretmez. Kalan sınır: yeniden başlatmadan 20 dk'dan kısa süre önce yerde başlayan kayıt bölünmüş sayılır ve o bekleme bir kez bölünmeyebilir.
  - **İz örnekleme:**
    - `track_points_sampled`: uçuş kaydı başına 30 sn'de bir örnek.
    - `track_points_fine`, geçici kural: herhangi bir etkin istasyonun ARP'ına ≤ 30 km ve (yerde ya da `alt_baro − alan yüksekliği < 10.000 ft`), ya da takip listesinde. Alan yüksekliği yoksa 0 alınır; irtifası bilinmeyen havadaki uçak yazılmaz.
    - Yerde son yazılan noktadan 20 m'den az kıpırdayan örnek iki tabloya da yazılmaz.
    - Yazma 1,5 sn'de bir, `ON CONFLICT DO NOTHING` ile yapılır. Açılışta partition'lar `ensureTrackPartitions` ile garanti edilir.
  - **Kaynak kodu:** `track_points.source = sağlayıcı (adsbLol 0, localReceiver 1) × 16 + PositionSource sırası`.
  - **Sağlık kaydı:**
    - `provider_health`: rps, devre, bekleme sonu, tazelik p95, 60 sn hata oranı sütunları eklendi.
    - `provider_health_hourly`: saatlik sayaçlar; M7'de 24 saatlik 429 oranı buradan hesaplanır. Admin'deki "1 sa" ve "24 sa" oranları pencere başlangıcını içeren saat kovasını da sayar: saat başında oran kaybolmaz, "1 sa" 1–2 saati kapsar.
    - `provider_status_changes`: durum geçişleri.
    - DB'ye dakikada bir ve durum değişince yazılır; `redis-live`'a her turda yazılır.
  - **Araçlar:** `tools/` artık `@havayolu/tools` workspace paketidir; lint, tip ve test kapsamına girer. Uygulamalar ona bağımlı olmadığından imaja girmez. Replay alıcısı ve `pnpm dev:replay` `APP_ENV=production`'da başlamaz. Replay yanıtının `now` değeri sunulduğu anın saatidir, çünkü ayrıştırıcı 60 sn'den fazla kayan yanıtı reddeder. Replay portu 4300'dür (`REPLAY_RECEIVER_PORT`).
  - **Loglar:** Yeni ingest logları İngilizce ve ASCII'dir (CLAUDE.md). Her tur `debug`, dakikalık özet `info` yazılır. Tekrarlayan uyarılar tür başına dakikada birle sınırlıdır. adsb.lol hata logu yalnızca tür, durum kodu ve çember kimliğini taşır; adres, e-posta ve anahtar yazılmaz.
  - **Çalışma düzeni:**
    - **Sıra:** Gelen veri önce Redis'e, sonra uçuş kaydı ve ize yazılır; Postgres yavaşlasa da canlı durum güncel kalır.
    - **`redis-live` işlemeyi bekletmez:** Canlı yazım beklenmeden kuyruğa alınır. Aynı anda tek yazım yolda olur, biriken örnekler hex başına en yenisiyle birleşir, her yazım en çok 1 sn beklenir. İstemci `enableOfflineQueue=false` ve `commandTimeout=2000` ile kurulur; Redis kesintisi DB'ye yazımı ve adsb.lol çekimini yavaşlatmaz.
    - **Yerel alıcılar:** Her alıcının kendi döngüsü vardır; yanıt vermeyen biri diğerini yavaşlatmaz.
    - **Bozuk veri:** DB sınırında temizlenir: int4 ve float4 aralığı dışındaki sayı null yazılır, metinden NUL ve eşsiz vekil karakter çıkarılır. Biçimi bozuk hex (`~?[0-9a-f]{6}` dışı) hiç işlenmez. Yazıcı veri hatasını (SQLSTATE 22/23) geçici hatadan ayırır: veri hatasında parçayı ikiye bölerek yalnızca bozuk satırı atar, sayar, tekrar kuyruğa almaz. Uçuş kaydı açmadaki veri hatası diğer uçakları 10 sn bekletmez.
    - **Tek işleme kuyruğu:** Bütün kaynaklar tek kuyruktan geçer; iki kaynak aynı hex için iki kayıt açamaz.
    - **DB kesintisi:** Uçuş kaydı açılamazsa yeni kayıt denemeleri 10 sn durur, böylece DB kesintisi işlemeyi kilitlemez. İz yazıcı en çok 50.000 satır tutar, fazlasında en eskiyi atar ve sayar.
    - **İstasyon listesi:** Liste boşken 60 sn'de, doluyken 10 dk'da bir yeniden okunur; değişirse plan yeniden kurulur.
    - **Sağlık satırları:** Açılışta bu süreçte yapılandırılmamış sağlayıcıların `provider_health` satırı silinir. Admin 180 sn'den eski satırı "Çalışmıyor" gösterir; bu yüzden her yapılandırılmış sağlayıcının satırı devre açıkken de dakikada bir yazılır.
    - **Admin'deki hata metni:** Sabit kısa Türkçe metinlerden gelir (ör. "HTTP 429 (kısıtlama)", "CONTACT_EMAIL tanımlı değil"); ham hata metni gösterilmez.
    - **Kapanış:** Açık adsb.lol isteği en çok 8 sn beklenir, son yazma en çok 4 sn sürer (compose `stop_grace_period` 30 sn).
  - **Drizzle ve ham SQL:** `createDb()` aynı postgres-js istemcisini drizzle'a verdiği için tarih ve JSON serileştiricileri değişir. Ham SQL bu istemcide JS `Date` göndermez; `packages/db/src/ingest.ts` zamanı ISO metni ve `::timestamptz` ile gönderir.
- **D-072 Metrik birimler ve harita etiketleri (kullanıcı kararı).**
  - **Birimler:** Arayüz varsayılanı metriktir: yükseklik m, hız km/sa, dikey hız m/dk, mesafe km. Ayarlardan havacılık birimleri (ft, kt, ft/dk, NM) seçilebilir. Veri, API ve motor ft/kt'de kalır; dönüşüm yalnızca gösterimdedir. Biçimleyiciler `packages/i18n/src/units.ts`'tedir.
  - **Harita etiketleri:** Kullanıcının `/design` isteğiyle belirlendi (domain.md → "Harita etiketleri"). Sefer no tireyle yazılır (TK-4). Etiket dört satırdır: sefer no, güzergâh, hız · yükseklik, pist. Seçili uçak ve diğer uçaklar için ayrı ayrı Gizle, Kısa ya da Tam seçilir; varsayılan Tam'dır.
  - **Uydu zemini:** Kullanıcı uydu zemini ve yolsuz harita istedi. Tasarımda Esri World Imagery tek seferlik kullanıldı (kullanıcı onayı, 78 karo). Üründe hangi uydu kaynağının kullanılacağı, lisans ve maliyetiyle birlikte M6'da kullanıcıya sorulacak (DUR-SOR 5).

## 2026-09-27 — Parça 1 M3 sağlayıcılar
- **D-071 Canlı sağlayıcı katmanının kuralları.**
  - **Model:** `AircraftState` (packages/providers). Bilinmeyen değer `null`dır, hiçbir alan uydurulmaz. `emergency: 'none'` null olur. Konumu yalnızca `lat`/`lon` verir: `lastPosition` ve `rr_lat`/`rr_lon` kullanılmaz, yalnızca bayat konumu olan uçak "konum yok" nedeniyle atılır.
  - **Temizlik** yanıtın ölçüm anına (`now`) göre yapılır: `seen_pos` > 60 sn, hız > 800 kt, |dikey hız| > 10.000 fpm, geçersiz koordinat atılır; neden (`RejectReason`) döner. Zamanın birimi `now > 1e12` ile ayrılır (adsb.lol ms, readsb saniye). Zarfta `ac` (adsb.lol) ya da `aircraft` (readsb) kabul edilir.
  - **Gizlilik** yardımcıları modeldedir (`isHiddenByDefault`, `withPrivacy`). Uygulama yeri API/WS/aramadır (M5); ayrıştırıcı askeri uçağı atmaz, çünkü motor ve saklama kuralları ayrı karar verir.
  - **İstemci** her çağrıda tek istek atar; hız sınırı (AIMD) çağıranın kovasındadır (M4). 500'den fazla hex için istemci gizlice birden çok istek atmaz: çağıran `chunkHexes` ile böler. ICAO dışı (`~`) adresler sorgulanamaz, atlanır. Hata türleri: `config` (401/403, yeniden denenmez), `rate_limit` (429/420; Retry-After yalnızca varsa), `server` (5xx), `network`, `response`, `request`. Gövde, durum kodu 200 değilse JSON olarak okunmaz.
  - **User-Agent** tek üreticiden gelir (`providerUserAgent`): `havayolu/<sürüm> (+https://<WEB_HOST>; <CONTACT_EMAIL>)`, WEB_HOST boşsa `(+mailto:…)`. Referans indirmeleri de bunu kullanır. `CONTACT_EMAIL` yoksa adsb.lol istemcisi kurulmaz (ingest başlamaz).
  - **API anahtarı:** `ADSBLOL_API_KEY` verilirse başlık adı da (`ADSBLOL_API_KEY_HEADER`) zorunludur. adsb.lol'ün gelecekteki başlık adı bilinmediği için varsayılan uydurulmaz.
  - **Yerel alıcı:** `LOCAL_RECEIVER_URLS` = `url[|token]` listesi (Bearer). Adreste kullanıcı adı ve parola reddedilir; sağlık kaydı token taşımaz. Alıcılar paralel okunur, biri düşse de diğerleri döner.
  - **Birleştirme öncesi inceleme** (3 açı + çürütmeye çalışan doğrulayıcılar): 23 bulgu, 2'si çürütüldü. Düzeltilenler:
    - **Gizlilik:** Tescilini çağrı kodu olarak yayınlayan PIA/LADD uçağında tescil gizlense de çağrı kodunda açıkta kalıyordu. Fixture'daki TC-OIL uçağı, LADD bayraklı ve çağrı kodu "TCOIL", bunu gösterdi. Artık tescile eşit çağrı kodu da gizlenir; havayolu çağrı kodları görünür kalır.
    - **Bilinmeyen bayrak kapalı varsayılır:** \`dbFlags\` artık \`number | null\`. Veritabanısız yerel alıcı bayrak göndermez; bu \`null\` olur ve gizli sayılır. M4 aynı hex'in bilinen bayraklarını taşır. Alan var ama bozuksa kayıt reddedilir.
    - **Konum kaynağı:** readsb'nin \`mlat\`/\`tisb\` alan listeleri konumun oradan geldiğini söylüyorsa \`type\` adsb_icao olsa da kaynak \`mlat\`/\`tisb_other\` olur. GPS karıştırmada bu gerçekten yaşanıyor; fixture'da da görüldü.
    - **Saat:** Yanıtın saati alınma anından 60 sn'den fazla saparsa (donmuş aircraft.json, saati kaymış alıcı) yanıt reddedilir. Negatif \`seen_pos\` 0'a çekilir.
    - **İstemci:**
      - Gövde okunurken kopan bağlantı artık \`network\` hatasıdır.
      - Yönlendirme izlenmez; anahtar ya da token başka adrese gitmez.
      - Gövde boyutu sınırlıdır: adsb.lol 32 MB, alıcı 8 MB.
      - \`Retry-After\` HTTP tarihi biçiminde de okunur ve en fazla 300 sn kabul edilir.
      - Geçersiz başlık, istemci kurulurken yapılandırma hatası verir.
      - Bozuk hex bütün çağrıyı düşürmez.
      - Alıcı hata ve sağlık metinleri sabit bir sözlükten gelir; token ya da ham hata metni taşımaz.
    - **Kayıt betiği:** 200 dışı ilk yanıtta durur.
    - **Bilinçli olarak bırakılan:** İmkânsız hız ya da dikey hız bütün örneği düşürür. M3 kuralı böyle; yalnızca o alanı boşaltmak, bozuk konumun motora girmesine izin verirdi.
  - **Kapsama gözlemi:** Fixture anında (2026-09-27 08:49 UTC, İstanbul'da yoğun saat) LTFM'nin 40 NM çevresinde adsb.lol yalnızca 18 uçak gösterdi, hiçbiri yerde değildi. Ücretsiz kaynağın bölgedeki alçak irtifa ve yer kapsaması sınırlı görünüyor. D-006'daki "iniş çoğunlukla muhtemel iniş olarak bildirilir" beklentisiyle tutarlı; M7'deki kapsama raporu ölçecek.

## 2026-09-27 — Üretimde ilk günün düzeltmeleri (v0.5.1–v0.5.2)
- **D-070 Yayın, Dokploy Autodeploy ile `release` dalından tetiklenir (kullanıcı kararı; D-064'ün tetik kısmını değiştirir).** Kullanıcı Autodeploy'un açık kalmasını istedi. Autodeploy `main`'i izleseydi push anında, imajlar henüz derlenmemişken tetiklenir ve her seferinde bir önceki sürümü yayınlardı (2026-09-27'de görüldü: #8 birleşince Dokploy v0.5.0'ı yeniden çekti).
  - Dokploy `release` dalını izler (Autodeploy açık). CI'nın `release` işi `:main`'i taşıdıktan sonra `release` dalına, ağacı bu commit'inkiyle aynı yeni bir commit gönderir (`git commit-tree` + fast-forward push; force push yok, `main`'e dokunulmaz, commit yazarı `github-actions[bot]`). Geri alma aynı yolu eski commit'in ağacıyla izler. Dal, yayın geçmişinin kaydı olur.
  - Doğrulama değişmedi: `/version`, `/api/version` yeni SHA'yı, `/ready` 200'ü verene kadar en fazla 15 dk. "Yalnızca belge değişti" kararı da aynı; o durumda dala bir şey gönderilmez.
  - Dokploy API anahtarı ve üç secret gerekmez (`DEPLOY_TRIGGER=api` seçeneği korunur, stub testleri geçer). CI'nın `deploy` ve rollback işleri `contents: write` taşır.
  - İlk denemede (2026-09-27 08:21 UTC) CI'nın push'u GitHub App'e teslim edildi, ama Dokploy'a ulaşmadı. Kullanıcı ~08:05'te Dokploy panel adresini `dokploy.havayolu.live` yaptı; GitHub App'in bildirim adresi eski panel adresinde kaldı ve Dokploy o adresin Traefik yönlendirmesini kaldırdı. 08:10'dan itibaren bütün teslimatlar Traefik'ten 404 aldı (Recent Deliveries: 10:59 TSİ'ye kadar 200, 11:10'dan sonra hepsi 404). Düzeltme: App'in bildirim adresini yeni panel adresine çevirmek (DEPLOY_DOKPLOY.md §1). Tasarım hatası değil; `GITHUB_TOKEN` push'ları GitHub App'lere teslim ediliyor.
- **D-069 Yönetici anahtarı en az 12 karakter; hatalı yönetici ayarı API'yi kapatmaz (kullanıcı talebi).** Kullanıcı Dokploy'da 32 karakterden kısa bir `ADMIN_SETUP_TOKEN` girdi; API her açılışta env hatasıyla çıktı ve site (web'in API'ye bağlı bölümleri, `api.havayolu.live`) kapandı. Kullanıcı 32 karakteri fazla buldu.
  - Alt sınır 12'dir; 16 ve üzeri önerilir, yalnızca `[A-Za-z0-9_-]` (D-063). Gerekçe: anahtar yalnızca bu yönetici girişini açar ve giriş denemeleri ziyaretçi başına sınırlıdır (D-060). Parça 2B'de gerçek yönetici hesabı gelince anahtar devreden çıkar.
  - Yönetici ayarı hatalıysa (biri boş, e-posta geçersiz, anahtar kısa) API açılır, yalnızca yönetici girişi kapanır ve nedeni hata seviyesinde loglanır. Genel ayar hataları (veritabanı, Redis, proxy ağları) açılışı durdurmaya devam eder: onlar olmadan API zaten çalışamaz.
  - Aynı gün paketler gizli yapıldı ve Dokploy'a `read:packages` PAT'li GHCR Registry kaydı eklendi; yayın bununla imaj çekiyor (D-068).

## 2026-09-27 — Parça 1 M2 veritabanı ve referans verisi
- **D-068 Repo yeniden gizli (kullanıcı kararı; D-061'in yerini alır).** Kullanıcı 2026-09-27'de repoyu gizli yaptı.
  - Etkiler (GitHub Free): `main-koruma` kural seti kayıtlı ama uygulanmıyor (API 403 "Upgrade to GitHub Pro or make this repository public"). Gizli bilgi taraması ve push koruması yok. Actions ayda 2.000 dakika. Releases yalnızca repo erişimi olanlara görünür.
  - Kurallar süreçle uygulanır (CLAUDE.md): `main`'e doğrudan push, force push ve dal silme yok; yalnızca PR + merge commit; `checks` ve `test-integration` yeşil olmadan birleştirme yok; commit'ten önce değişiklik sır ve kişisel veri açısından taranır.
  - GHCR paketleri herkese açık kaldı (paket görünürlüğü repodan bağımsız; 2026-09-27 anonim çekme 200). Dokploy bu yüzden PAT'siz çekiyor. İmajlar derlenmiş kodu ve kaynak haritalarını taşıdığı için kod bu yolla okunabilir. Paketleri gizlemek kullanıcının kararıdır; gizlenirse aynı anda Dokploy'a `read:packages` PAT'li Registry kaydı eklenmelidir (DEPLOY_DOKPLOY.md §4, ACTIVATION).
  - Alternatifler: GitHub Pro (4 $/ay; gizli repoda kural seti ve dal koruması gelir) ya da yeniden herkese açık repo.
- **D-067 Her sürüm GitHub Releases'ta yayımlanır (kullanıcı talebi).** Kullanıcı "GitHub'a push'larken sürümü GitHub'a da ver" dedi; repo sayfası "No releases published" gösteriyordu.
  - CI'daki `github-release` işi `main`'e her push'ta, `deploy` işi yeşil bittikten sonra çalışır. Kök `package.json` sürümü için `v<sürüm>` release'i yoksa, o commit'i hedefleyen etiketi ve release'i oluşturur, "latest" yapar. Varsa (ör. sürüm artırmayan belge birleşmesi) bir şey yapmaz.
  - Başlık ve not `packages/shared/src/changelog/entries.ts`'ten gelir (`tsx scripts/changelog.mts --release <sürüm>`; TR + EN). "Dene" bağlantıları `WEB_URL` variable'ıyla mutlak adrese çevrilir; alan adı koda gömülmez.
  - Yetki yalnızca bu işte `contents: write`'tır; etiketler `main-koruma` kural setinin kapsamı dışındadır.
  - Yayın başarısız olursa release oluşturulmaz: release, yayına çıkan sürümü gösterir.
  - Geçmiş sürümler (v0.1.0–v0.4.0) `main`'deki birleşme commit'lerine bir kez elle eklendi.
- **D-066 Pist verisinin yorumlanması ve referans içe aktarımı.** Birleştirme öncesi çok ajanlı inceleme (veritabanı, worker/BullMQ, ayrıştırıcılar, admin paneli, CI açıları; her açıya çürütmeye çalışan bir doğrulayıcı) 18 bulgu verdi, hiçbiri çürütülmedi; aşağıdaki maddelerin bir kısmı bu düzeltmelerdir.
  - **Pist yönü koordinatlardan gelir.** İki uç koordinatı varsa gerçek yön uçlardan hesaplanır, yoksa OurAirports `*_heading_degT` alanı kullanılır (`bearing_source`). Gerekçe: LTFM'de 16L/16R/17L/17R için alan 174° diyor, uç koordinatları ~179,2° veriyor (pistler kuzey–güney). 1°'den büyük sapma `heading_mismatch` ile işaretlenir. M2 kabulündeki "eşikten eşiğe yön = `le_heading_degT` (±1°)" maddesi bu dört pistte kaynak hatası yüzünden sağlanamaz. Test, tutarlı pistlerde alanı, tutarsızlarda koordinat yönünü doğrular ve tutarsız pistlerin tam olarak bu dördü olduğunu denetler.
  - **Uçlar zaten eşikse yeniden kaydırılmaz.** Bazı kayıtlarda uç koordinatı fiziksel pist ucu değil, kaydırılmış eşiktir (ör. LTAC 03L: uçlar arası 3.387 m, uzunluk 3.750 m, kaydırma 350 m). Uçlar arası mesafe "uzunluk − kaydırmalar"a "uzunluk"tan daha yakınsa ve 50 m içindeyse koordinatlar eşik sayılır (`ends_are_thresholds`). Bilgi yetmezse domain.md'deki varsayım (fiziksel uç, kaydırılır) geçerlidir.
  - **Geoid ondülasyonu yalnızca LTFM için tohumlanır** (37,05 m, domain.md). Diğer istasyonlarda boş kalır; AGL yöntemi sıradakine düşer. Değer uydurulmaz.
  - **Filtre ayrıştırma sırasında uygulanır.** Tam `airports.csv` ~85 bin satırdır (12,7 MB); yalnızca büyük/orta havalimanları ve tarifeli sefer alanlar tutulur (~6.350), filtre dışı satırlar doğrulanmadan sayılır. CSV ayrıştırıcı satırları tek tek üretir. Tam veriyle ölçüm: heap zirvesi ~58 MB (worker-bg sınırı 180 MB). Kapalı pistler (`closed = 1`) ve içe aktarılmayan havalimanlarının pistleri alınmaz; bu yüzden `runways` tablosunda `closed` sütunu yoktur.
  - **İki ucu aynı noktaya yazılmış pistte yön kayıttaki alandan gelir.** Uçlar 100 m'den ya da kayıtlı uzunluğun %10'undan yakınsa koordinat yönü kullanılmaz (tam veride LHTL, MDLR, EFPR, FBSW); aynı iki noktadan yön 0° çıkar ve kaydırılmış eşik pistin dışına düşerdi.
  - **`airports.ident` tekil kısıt taşımaz, yalnızca indekslidir.** Kaynakta tekildir, ama bir kod başka kayda geçtiğinde (eski kayıt kapanır ya da kod değiştirir, yeni kayıt eski kodu alır) güncelleme sırasında geçici çakışma olur ve tekil kısıtla içe aktarım her gün başarısız olurdu. Tam anlık görüntü yazıldığı için sonuç yine tekildir.
  - **Kaynaktan kalkan satır silinir; yarım kaynak reddedilir.** Yeni satır sayısı mevcudun yarısının altındaysa ya da kaynak boşsa hiçbir şey yazılmaz (`ReferenceGuardError`). Havalimanı ve pist tek işlemde yazılır; havalimanı silinince pistleri de gider. Yöneticinin düzeltmeleri (`airline_overrides`, `runway_overrides`) içe aktarımdan etkilenmez.
  - **Değişmeyen satır yazılmaz.** `ON CONFLICT DO UPDATE ... WHERE row_hash IS DISTINCT FROM excluded.row_hash`; eklenen/güncellenen ayrımı PostgreSQL 18'in `RETURNING old.*` özelliğiyle yapılır.
  - **Koşullu indirme.** ETag / Last-Modified yalnızca başarılı içe aktarımdan sonra saklanır. Havalimanı ve pist dosyalarından biri değiştiyse diğeri koşulsuz indirilir: pist eşiği havalimanı merkezine düşebilir ve pistler havalimanına bağlıdır. `EXTERNAL_PROVIDERS_DISABLED=true` iken yalnızca üretim dışında `tools/fixtures` okunur (ETag = içerik özeti); üretim imajında fixture yoktur ve içe aktarım kapalı kalır.
  - **Zamanlama.** BullMQ job scheduler'ları (`upsertJobScheduler`, UTC): iz partition bakımı 00:15 (03:15 TSİ), referans içe aktarımı 04:40 (07:40 TSİ). Kuyruk öneki `hy:bull`. Başarısız kaynak işi başarısız sayar; BullMQ geri çekilmeyle 3 kez dener, hata `reference_sources.last_error`'a yazılır.
    - Tanımı değişmeyen zamanlayıcıya açılışta dokunulmaz (`SCHEDULE_REVISION`): upsert, zamanı geçmiş ama henüz işlenmemiş işi silip ertesi güne atıyordu; worker o saatte kapalıysa (yayın, yeniden başlatma) o günün işi kaçıyordu (inceleme, Redis'e karşı yeniden üretildi).
    - Açılışta telafi: partition bakımı her açılışta bir kez çalışır (ucuz, idempotent); referans içe aktarımı tablolar boşsa ya da son başarılı kontrol 24 saatten eskiyse hemen istenir (tekilleştirme kimliğiyle).
    - Kapanış en fazla 8 sn bekler, sonra Redis bağlantıları kesilir: Redis erişilemezken BullMQ'nun kapanışı sonsuza dek bekleyebiliyordu (D-060'taki "kapanışta takılmaz" kuralı).
    - Worker'da `EXTERNAL_PROVIDERS_DISABLED` tanımsızsa `true` sayılır (güvenli taraf). Üretim şablonu `false`'u açıkça verir; unutulursa admin paneli referans verisini "Sorunlu" gösterir. Yerel üretim denemesinde (`--env-file .env.example` yalnızca compose değişkenlerini doldurur) worker dış kaynağa istek atmaz.
  - **Migrate sonrası adımlar.** `hy-migrate` migration'lardan sonra, aynı advisory lock altında günlük partition'ları açar ve tohum istasyonlarını ekler (ikisi de idempotent). Yerelde `pnpm db:migrate` aynısını yapar. Partition açılamazsa yayın durmaz (uyarı loglanır, günlük iş yeniden dener); migration hatası ise yayını durdurur.
  - **DEFAULT partition'a düşen satır bakımı kilitlemez.** Açılacak güne ait satır DEFAULT'tayken PostgreSQL partition'ı açmaz (23514); ilk tasarımda bu hem günlük işi hem `hy-migrate`'i her seferinde düşürür, yayınları durdururdu (inceleme, PG 18'de yeniden üretildi). Artık satırlar aynı işlemde yeni partition'a taşınır. Saklama süresi dolmuş DEFAULT satırları (hiç açılmamış eski günler) silinir. Açma, silme ve taşıma `lock_timeout=5s` ile çalışır, kilit alınamazsa geri çekilmeyle yeniden denenir. Panelin DEFAULT sayımı 10.000 satırla sınırlıdır.
  - **Özel migration'lar `packages/db/drizzle/` altındadır.** infra.md `packages/db/sql/` diyordu; `drizzle-kit generate --custom` dosyayı migration klasörüne yazar ve migrator yalnızca o klasörü okur. infra.md buna göre düzeltildi.
  - **Admin Servisler paneline iki veri satırı eklendi.** "Referans verisi" (satır sayıları, son kontrolün yaşı, kaynak, son hata; 36 saatten eski kontrol "Sorunlu") ve "İz tabloları" (kaç gün ileri açık, en eski gün, DEFAULT'taki satır; DEFAULT'ta satır ya da 6 günden az ileri partition "Sorunlu"). infra.md'nin "DEFAULT'a satır düşerse admin uyarısı" maddesi böyle karşılanır.
  - **Pist düzeltme tablosu (`runway_overrides`)** data-sources.md §3 gereği şimdiden vardır; anahtar OurAirports pist kimliğidir ve yabancı anahtar taşımaz (pist kaynaktan kalksa da düzeltme kaybolmaz). Motor bu tabloyu Parça 1 M4+'ta okur.
  - **CI.** `pnpm db:check` (`checks`): `drizzle-kit check` + `generate` boş fark. drizzle-kit 0.31, yeniden adlandırma sorusunda (TTY yok) ve şema yüklenemediğinde hiçbir şey yazmadan 0 ile çıktığı için çıkış koduna değil çıktıdaki başarı iletisine bakılır; kasıtlı bir sütun yeniden adlandırmasıyla kırmızıya döndüğü denendi. `pnpm test:migration-upgrade` (`test-integration`): temel commit'in migration'ları, üstüne test edilen commit'inkiler. Temel CI'da `HEAD^1`'dir (PR'da `main`'in ucu, `main` push'unda bir önceki `main`); `origin/main` kullanılsaydı `main` push'unda test edilen commit'ten daha yeni bir `main`'le karşılaştırılabilirdi. Yayınlanmış migration'ın içeriği ya da sırası değişmişse kırmızı (migrator uygulanmış migration'ı yeniden çalıştırmaz, değişiklik üretimde sessizce kaybolurdu). `tools/fixtures/**` turbo'nun genel bağımlılıklarındadır; fixture değişince önbellekteki test sonucu kullanılmaz.
  - **`msgpackr-extract` derleme script'i çalıştırılmaz** (`allowBuilds: false`). BullMQ'nun msgpackr'ı için isteğe bağlı yerel hızlandırıcıdır; saf JS yolu yeterli, imajda derleme aracı gerekmez.
  - **GHCR imajları anonim çekilebiliyor.** Repo herkese açık olduğu için paketler de herkese açık; Dokploy'da Registry kaydı yalnızca paketler gizliye çevrilirse gerekir (DEPLOY_DOKPLOY.md §4 güncellendi). 2026-09-27'de üç imajın `:main` manifest'i anonim token'la 200 döndü.

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
- **D-050 Dil tercihi M0'da çerezle tutulur.** URL tabanlı `/en/...` yönlendirmesi Parça 3 M2'de gelir. **Değişti:** D-076 (Parça 1 M6b) ile dil adrese taşındı, çerez emekliye ayrıldı.

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
