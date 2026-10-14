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
  - *Havacılık Meteorolojisi 1* (Ankara, 2018; METAR/TAF kodları, Türkiye'de TAF düzeni V.3.7, meydan uyarı eşikleri VI.1.2, alçak seviye rüzgâr sheari (kesmesi) grubu `WS RDRDR` / `WS ALL RWY` IV.1.3.9.4): https://www.mgm.gov.tr/FILES/genel/kitaplar/havacilikmeteorolojisi.pdf
  - Beaufort rüzgâr ıskalası (Türkçe adlar ve kt aralıkları: 5 Sert rüzgâr 17–21 kt, 7 Fırtınamsı rüzgâr 28–33 kt …; D-083): https://mgm.gov.tr/FILES/genel/sss/beaufort.pdf
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

## Ülke sınırları (OpenFreeMap vektör karoları, erişim 2026-10-04; D-092)
- OpenFreeMap ana sayfa (atıf metni, sayı sınırı yok, ticari kullanım) ve kullanım şartları: https://openfreemap.org/ · https://openfreemap.org/tos/
- OpenFreeMap README (TileJSON `/planet` ve `/planet/latest`, karo adresi, önbellek süreleri): https://github.com/hyperknot/openfreemap
- OpenFreeMap stilleri (vektör kaynak `https://tiles.openfreemap.org/planet`; koyu stilin `boundary` katmanları): https://github.com/hyperknot/openfreemap-styles
- OpenMapTiles şeması, `boundary` katmanı (`admin_level`, `maritime`, `disputed`, `claimed_by`; z0–z4 Natural Earth, z5–z14 OSM): https://openmaptiles.org/schema/ · genelleme toleransları: https://github.com/openmaptiles/openmaptiles/blob/master/layers/boundary/boundary.sql

## Ülke poligonları (Natural Earth, 2026-10-05; D-096)
- Yerelde okunan (ağ yok): `tools/node_modules/world-atlas/README.md` ve `LICENSE` (Natural Earth 4.1.0'ın TopoJSON yeniden dağıtımı; ISC), `tools/node_modules/topojson-client/README.md` ve `LICENSE` (ISC); paket sürümleri `pnpm-lock.yaml`'da.
- **Doğrulanmadı (2026-10-05, ağ yok):** Natural Earth kullanım şartları https://www.naturalearthdata.com/about/terms-of-use/ · world-atlas deposu https://github.com/topojson/world-atlas (plan M6e.8'de açık iş).

## Ülke adları (Unicode CLDR, 2026-10-06; D-100)
- Adlar üreticinin Node'unun `Intl.DisplayNames` verisidir (Node 24.16.0, ICU 78.3, CLDR 48; `process.versions`); yerel Node kurulumunda lisans metni yoktur.
- **Doğrulanmadı (2026-10-06, ağ yok):** Unicode License v3 metni https://www.unicode.org/license.txt (ATTRIBUTION'a eklenecek bildirimin birebir metni; plan M6e.11'de açık iş).

## Resmî havalimanı adları (erişim 2026-09-30; D-076)
- DHMİ "Havalimanları Web Siteleri" listesi (resmî Türkçe adlar; `airport-names.ts` → `source: 'dhmi'`): https://www.dhmi.gov.tr/Sayfalar/HavalimaniListesi.aspx · bağlandığı sayfa: https://www.dhmi.gov.tr/Sayfalar/Havalimanlari.aspx · havalimanı sayfaları `https://www.dhmi.gov.tr/Sayfalar/Havalimani/<Ad>/AnaSayfa.aspx` biçimindedir
- DHMİ İngilizce sitesi: https://www.dhmi.gov.tr/Sayfalar/EN/DefaultEN.aspx · havalimanı listesi https://www.dhmi.gov.tr/Sayfalar/EN/Airports.aspx (erişim 2026-10-01). İngilizce görünen adların kaynağı **değildir**: liste tutarsızdır ("DALAMAN AIRPORT", "MUS AIRPORT", "CUKUROVA AİRPORT", "MUĞLA-MİLAS BODRUM AIRPORT"). `airport-names.ts`'teki İngilizce adlar resmî Türkçe adın çevirisidir; İngilizce sayfalar resmî Türkçe adı ve kaynağını ayrıca yazar (D-076).
- İşletmeci siteleri (`source: 'operator'`):
  - İstanbul Havalimanı (İGA, LTFM): https://www.istairport.com/
  - İstanbul Sabiha Gökçen (ISG, LTFJ): https://www.sabihagokcen.aero/anasayfa
  - Gazipaşa-Alanya (LTFG): http://www.gzpairport.com/tr-TR/
  - Zafer (LTBZ): http://www.zafer.aero/
  - Eskişehir Hasan Polatkan (Eskişehir Teknik Üniversitesi, LTBY): https://hph.eskisehir.edu.tr/
- **Bakanlık (`source: 'ministry'`, erişim 2026-10-03; D-084):** Ankara Havalimanı'nın (eski Etimesgut, LTAD, ANK) 2026-06-15'te açılışı, UAB: https://www.uab.gov.tr/haberler/cumhurbaskani-erdogan-ankara-havalimani-ve-baglanti-yollarini-hizmete-acti/ · AA 2026-06-13: https://www.aa.com.tr/tr/ekonomi/ankaradaki-etimesgut-havalimani-yeni-adiyla-15-haziranda-acilacak/3965894 · AA 2026-06-14: https://www.aa.com.tr/tr/ekonomi/bakan-uraloglu-15-haziranda-acilacak-ankara-havalimanina-iliskin-detaylari-paylasti/3966087 (DHMİ listesinde henüz yok)
- **Askerî hava üsleri (D-084'teki `source: 'military'`, erişim 2026-10-03).** D-107'den beri (v0.22.2) üsler sitenin hiçbir yerinde gösterilmez; adları ad tablosundan ve `military` ad kaynağı silindi (istemci paketlerine girmesinler diye). Aşağıdaki kaynaklar D-084'teki adların dayanağı olarak tarihsel kayıttır; üslerin listesi `packages/shared/src/reference/military-airfields.ts`'tedir. Resmî adları birlik adıdır; görünen ad "<yer> Hava Üssü" biçimindedir (AA kullanımı: https://www.aa.com.tr/tr/turkiye/incirlik-hava-ussunde-hareketlilik/1617329):
  - İncirlik (LTAG), 10'uncu Ana Jet Üs Komutanlığı, MSB 2024-04-19 (DefenceTurk aracılığıyla): https://www.defenceturk.net/10uncu-tanker-us-komutanliginin-ismi-degistirildi
  - Afyon (LTAH), 17'nci Hava ve Füze Savunma Üs Komutanlığı: https://ssbulten.com.tr/gundem/detay/17nci-us-afyon-18inci-us-yalova--3600 · https://www.sabah.com.tr/gundem/2026/09/16/milli-savunma-bakani-yasar-guler-afyonkarahisarda-birlikleri-denetledi
  - Bandırma (LTBG), 6. Ana Jet Üs Komutanlığı: https://www.bandirma.gov.tr/6-ana-jet-us-komutanligina-atanan-hv-plt-tugg-levent-egrene-ziyaret
  - Eskişehir (LTBI), 1. Ana Jet Üs Komutanlığı: https://www.eskisehir.gov.tr/1ana-jet-us-komutanligi---bina-isleri-yaptirilacaktir2
  - Çiğli (LTBL), 2. Ana Jet Üs Komutanlığı: https://www.izmir.gov.tr/vali-ayyildiz-cigli-2anajet-us-komutanligindaki-devir-teslim-torenine-katildi
  - hvkk.tsk.tr sayfaları açılamadı (yönlendirme döngüsü, 2026-10-03).
- **Kullanılmaz:** SHGM listesi https://web.shgm.gov.tr/doc2/havlist.pdf. 2006 tarihli bir tablo dışa aktarımıdır ("HAVAALANLARI TABLOSU.xls", 2006-11-20) ve İstanbul Havalimanı'ndan (2018) eskidir.
- OurAirports veri sözlüğü (pist kaplama kodları; `runway-surface.ts`): https://ourairports.com/help/data-dictionary.html

## Savaş kapanışları (D-110; okunma 2026-10-08, A1, A2, A11, A12 ve A14 2026-10-15'te yeniden)
Kapanış tablosunun (`CIVIL_FLIGHT_CLOSURES`) kaynakları; etiketler `docs/research/2026-10-08-savas-kapanislari/` raporlarınındır. Bakım: RUNBOOK → "Savaş kapanışları tablosu". Uçuş verisi API'si değildir, yalnız okunur.
- **Ukrayna:**
  - U1 EASA CZIB-2022-01R14 (resmî; revizyon 2026-07-24, 2027-01-31'e kadar): https://www.easa.europa.eu/en/domains/air-operations/czibs/czib-2022-01r14
  - U2 Ukrayna Dışişleri Bakanlığı, 2022-02-24 (resmî): https://www.kmu.gov.ua/news/rekomendaciyi-mzs-gromadyanam-ukrayini-u-zvyazku-iz-zakrittyam-povitryanogo-prostoru-ukrayini
  - U3 NOTAM UKBV A0081/26 (2026-09-22 ile 2026-12-21 arası), SafeAirspace aktarımı: https://safeairspace.net/ukraine/
  - U4 Obozrevatel, 2026-09-30 (bakan Kalashnyk): https://www.obozrevatel.com/ukr/section-ekonomika-glavnaya/economy/news-ukrayina-hotuyetsya-vidkryty-nebo-shche-do-zavershennya-viyny-koly-mozhut-povernutysya-tsyvilni-reysy-30-09-2026.html
  - U5 Glavkom, 2025-12-17 (Devlet Havacılık Servisi): https://glavcom.ua/country/incidents/derzhaviasluzhba-pojasnila-koli-zapratsjujut-aeroporti-pislja-vijni-1093465.html
  - U6 Ukrayna'nın en işlek havalimanları (2019 yolcu tablosu): https://en.wikipedia.org/wiki/List_of_the_busiest_airports_in_Ukraine
  - U8 Zaxid, 2021-10-28 (Windrose seferleri): https://zaxid.net/aviakompaniya_windrose_vidminyaye_regulyarni_reysi_kiyiv__uzhgorod_n1529179
  - U9 Bakanlar Kurulu, 2021-08-06 (Cherkasy; resmî): https://www.kmu.gov.ua/news/premyer-ministr-aeroport-u-cherkasah-maye-stati-poshtovhom-do-rozvitku-turizmu-v-misti
- **Rusya:**
  - R1 AEX, 2026-05-28 (Rosaviatsiya'nın sekiz havalimanı listesi): https://www.aex.ru/news/2026/5/28/296012/
  - R2 Rosaviatsiya, 2024-04-26 (Elista; resmî): https://favt.gov.ru/novosti-novosti/?id=11535
  - R3 Rosaviatsiya, 2025-09-23 (üç açılış; resmî): https://favt.gov.ru/novosti-novosti/?id=16840
  - R4 news.ru, 2025-07-10 (Gelencik): https://news.ru/society/situaciya-v-aeroportah-rossii-segodnya-10-iyulya-chto-v-saratove-gelendzhike
  - R5 Mintrans, 2025-09-11 (Krasnodar; resmî): https://mintrans.gov.ru/eye/press-center/news/12108
  - R9 www1.ru, 2026-01-06 (Simferopol): https://www1.ru/en/news/2026/01/06/otkrytie-iuznyx-aeroportov-v-rf-naxoditsia-pod-voprosom.amp.html
  - R10 93.ru, 2026-02-27 (Anapa): https://93.ru/text/gorod/2026/02/27/76285824/
  - R11 travelto.ru, 2026-09-17 güncel (Anapa ve Rostov kapalı): https://travelto.ru/blog/aeroport-anapa-rabotaet/ , https://travelto.ru/blog/aeroport-rostov-rabotaet/
  - R12 profile.ru, 2025-10-10 (Platov açılış haberinin yalanlanması): https://profile.ru/news/society/rosaviaciya-oprovergla-otkrytie-aeroporta-rostova-na-donu-1766079/amp/
  - R13 travelto.ru, 2026-09-09 güncel ("8 kapalı"): https://travelto.ru/blog/kakie-aeroport-zakryty-v-rossii/
  - R14 Kommersant, 2026-06-16 (Lipetsk, Kursk): https://www.kommersant.ru/doc/8738652
  - R15 AviaPort, 2026-03-18 (Voronej): https://www.aviaport.ru/news/rosaviatsiya-rasskazala-kogda-otkroyut-aeroport-v-voronezhe/
- **Orta Doğu:**
  - M1 CAMA Yemen (Taiz; resmî): https://cama.gov.ye/en/news/meeting-headed-by-al-sami-i-discusses-attacks-on-taiz-airport-s-campus
  - M2 Saba, 2026-02-01 (Muha; resmî): https://www.sabanew.net/story/en/141652
  - M3 SANA, 2026-08-09 (Lazkiye; resmî): https://sana.sy/locals/2549078/
  - M4 Arab News PK, 2026-09-28: https://www.arabnews.pk/middle-east/syria-moves-to-restore-latakia-international-airport-after-russian-handover-agreement-3002600
  - M5 ch-aviation, 2024-12-16: https://www.ch-aviation.com/news/148216-syria-reopens-airspace-airports-stay-closed
  - M6 SANA EN, ~2026-09-08 (Kamışlı, onarım son aşamada; resmî): https://sana.sy/en/syria/2341201/
  - M7 SyriacPress, 2026-09-08: https://syriacpress.com/blog/2026/09/08/delegation-reviews-final-stages-of-qamishli-international-airport-rehabilitation
  - M8 Shafaq, 2026-02-21: https://shafaq.com/en/Middle-East/First-civilian-flight-lands-at-Qamishli-Airport-under-SDF-Damascus-deal
  - Kamışlı yeniden bakışı (2026-10-15): Rudaw https://www.rudaw.net/english/middleeast/syria/210220261 ; Enab Baladi https://english.enabbaladi.net/archives/2026/02/syrian-government-delegation-at-qamishli-airport-ahead-of-reopening/
  - M9 The Media Line, 2025-05-28: https://themedialine.org/headlines/israeli-strike-destroys-yemens-last-commercial-jet-at-sanaa-airport/
  - M10 Petra, 2026-07-17: https://petra.gov.jo/en/news/jordan-to-launch-regular-ammansanaa-flights
  - M11 Al Jazeera, 2026-07-13: https://www.aljazeera.com/news/2026/7/13/yemen-govt-says-its-forces-attacked-sanaa-airport
  - M12 Arab News, 2026-10-07: https://www.arabnews.com/middle-east/houthis-strike-aden-airport-as-number-of-people-displaced-by-latest-yemen-fighting-tops-200000-3005104
- **Afrika:**
  - A1 FCDO Etiyopya, 2026-10-07 (resmî): https://www.gov.uk/foreign-travel-advice/ethiopia
  - A2 aerocorner, 2026-09-24: https://aerocorner.com/news/ethiopian-airlines-mekelle-axum-shire-flights-suspended/
  - A3 Radio Okapi, 2026-03-28 (MONUSCO, BM Güvenlik Konseyi 2026-03-26): https://www.radiookapi.net/2026/03/28/actualite/politique/new-york-la-monusco-appelle-la-reouverture-des-aeroports-de-goma-et
  - A4 africanews, 2025-02-14 (Bukavu): https://www.africanews.com/amp/2025/02/14/m23-rebels-seize-key-airport-in-eastern-congo/
  - A5 Kavumu Airport (savaş öncesi hatlar): https://en.wikipedia.org/wiki/Kavumu_Airport
  - A6 actualite.cd, 2026-04-23 (Goma pisti mayınlı): https://actualite.cd/2026/04/23/goma-selon-lafcm23-kinshasa-qui-avait-ferme-lespace-aerien-detient-la-cle-de-reouverture
  - A7 Goma International Airport: https://en.wikipedia.org/wiki/Goma_International_Airport
  - A8 El Fasher Airport ve allafrica, 2025-10-28: https://en.wikipedia.org/wiki/El_Fasher_Airport , https://allafrica.com/stories/202510280552.html
  - A9 Darfur24, 2026-08-11: https://darfur24.com/en/2026/08/11/increased-air-traffic-at-nyala-airport/
  - A10 El Obeid Airport (2026-08-26 düzenlemesi): https://en.wikipedia.org/wiki/El_Obeid_Airport
  - A11 africanews, 2026-10-09 ve 2026-10-12 (Mekele açıldı; Aksum ve Şire askıda): https://www.africanews.com/2026/10/09/ethiopian-airlines-to-resume-flights-to-tigrays-capital-from-sunday/ , https://www.africanews.com/2026/10/12/flights-to-mekelle-resume-after-ethiopian-forces-recapture-of-tigray-capital/
  - A12 afriquinfos, 2026-04-28 (Sky Mali Gao ve Mopti'yi askıya aldı): https://afriquinfos.com/sky-mali-justifie-la-suspension-temporaire-de-ses-vols-domestiques-securite-en-rouge-sur-bamako/
  - A13 ch-aviation, 2026-05-12: https://www.ch-aviation.com/news/167046-sky-mali-halts-flights-amid-security-crisis
  - A14 Prensa Latina, 2026-04-28 (2026-10-15'te dönüş haberi bulunamadı): https://www.prensa-latina.cu/2026/04/28/aerolinea-de-mali-anuncia-suspension-de-vuelos/
  - A15 Koaci, 2026-09-15 (Sévaré üssüne saldırı): https://www.koaci.com/article/2026/09/15/mali/politique/mali-la-base-aerienne-de-sevare-visee-par-une-attaque-attribuee-au-jnim_200561.html
  - A16 CCAA, 2026-05-07 (Bamenda; resmî): https://www.ccaa.aero/index.php/en/espace-informations-nouvelles-de-la-ccaa-en/1859-modernization-of-bamenda-airport-towards-international-standards

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
