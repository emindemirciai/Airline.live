import type { ChangelogEntry } from './types'

/**
 * Kullanıcıya dönük sürüm notlarının TEK kaynağı. En yeni sürüm en üsttedir.
 * `pnpm changelog` bu listeden CHANGELOG.md üretir; web'deki /yenilikler sayfası da buradan okur.
 * Maddeler teknik ayrıntı değil, kullanıcının ne kazandığını anlatır.
 *
 * `releasedAt` (D-091): yeni sürüm onsuz eklenir; bir sonraki sürümün yayın adımında önceki sürümün
 * GitHub Release `publishedAt` değeri yazılır (`gh release view v<sürüm> --json publishedAt`).
 * v0.5.0'dan önceki sürümlerin release'leri sonradan toplu açıldığından onlarda `main`'e giriş anı
 * (birleştirme commit'inin saati; v0.1.0'da ilk commit) yazılıdır.
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '0.26.0',
    date: '2026-10-15',
    title: {
      tr: 'Uçak gizliliği maddesi yenilendi',
      en: 'Aircraft privacy wording updated',
    },
    items: [
      {
        tr: 'Kullanım koşullarındaki ve Hakkında sayfasındaki uçak gizliliği maddesi yenilendi. Canlı harita açıldığında önce yalnız havayolu çağrı koduyla uçan uçaklar görünecek; askerî, devlet ve özel uçakları tespit kurallarımızla göstermemeye çalışıyoruz ve bu kuralların kusursuz olmadığını açıkça yazıyoruz.',
        en: 'The aircraft privacy section of the terms of use and the About page has new wording. When the live map opens, it will first show only aircraft flying under an airline callsign; we use detection rules to try to keep military, state and private aircraft off the site, and we now say plainly that these rules are not perfect.',
      },
      {
        tr: 'Canlı uçaklar henüz açık değil; açılış için hazırlıklar sürüyor.',
        en: 'Live aircraft are not switched on yet; preparations for opening continue.',
      },
      {
        tr: 'API’nin canlı uçak yanıtları artık verinin lisansını (ODbL 1.0) ve kaynağını (ADSB.lol) da yazıyor.',
        en: 'The API’s live aircraft responses now also state the data licence (ODbL 1.0) and source (ADSB.lol).',
      },
      {
        tr: 'Yöneticiler canlı uçak katmanını panelden tek dokunuşla kapatıp açabiliyor.',
        en: 'Admins can switch the live aircraft layer off and on with one tap in the panel.',
      },
    ],
    tryLinks: [
      { path: '/kullanim-kosullari', label: { tr: 'Kullanım koşulları', en: 'Terms of use' } },
      { path: '/hakkinda', label: { tr: 'Hakkında', en: 'About' } },
    ],
  },
  {
    version: '0.25.2',
    date: '2026-10-15',
    title: {
      tr: 'Daha dayanıklı canlı veri sunucusu',
      en: 'A sturdier live data server',
    },
    items: [
      {
        tr: 'Canlı veri sunucusu beklenmedik bağlantı isteklerini artık düzgün bir hata yanıtıyla geri çeviriyor. Bu istekler sunucuyu yeniden başlatamıyor; canlı haritanın bağlantısı kopmadan sürüyor.',
        en: 'The live data server now turns away unexpected connection requests with a proper error response. They can no longer restart the server, so the live map stays connected.',
      },
    ],
  },
  {
    version: '0.25.1',
    date: '2026-10-15',
    releasedAt: '2026-10-15T04:25:20Z',
    title: {
      tr: 'Savaş nedeniyle kapalı havalimanları da listede',
      en: 'Airports closed by war are now listed',
    },
    items: [
      {
        tr: 'Normalde yolcu seferi alan ama savaş nedeniyle sivil uçuşlara kapalı 23 havalimanı listeye girdi: Ukrayna’nın 16 havalimanı (Kiev Borispil, Lviv ve Odessa dahil), Rusya’nın 6 havalimanı (Rostov ve Anapa dahil) ve Kongo DC’de Bukavu. Listede artık 1.240 havalimanı var.',
        en: 'We added 23 airports that normally have passenger flights but are closed to civil flights because of war: 16 in Ukraine (Kyiv Boryspil, Lviv and Odesa among them), 6 in Russia (Rostov and Anapa among them) and Bukavu in DR Congo. The list now has 1,240 airports.',
      },
      {
        tr: 'Bu havalimanlarının ve savaştan etkilenen 12 havalimanının daha sayfasında, harita penceresinde ve havalimanı listesinde bir not var. Kapanışı resmî bir kaynak doğruluyorsa not “Savaş nedeniyle sivil uçuşlara kapalı”, doğrulamıyorsa “… kapalı olabilir” der; yanında kapanışın yılı yazar.',
        en: 'These airports, and 12 more affected by war, carry a note on their page, in the map popup and in the airport list. Where an official source confirms the closure, it reads “Closed to civil flights because of the war”; where none does, “May be closed …”; the year it began is shown too.',
      },
      {
        tr: 'Yeniden açılan Krasnodar, Gelencik ve Elista’nın notu kalktı.',
        en: 'Krasnodar, Gelendzhik and Elista have reopened, so their note is gone.',
      },
    ],
    tryLinks: [
      { path: '/istasyon/UKBB', label: { tr: 'Kiev Borispil', en: 'Kyiv Boryspil' } },
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
    ],
  },
  {
    version: '0.25.0',
    date: '2026-10-15',
    releasedAt: '2026-10-15T03:24:33Z',
    title: {
      tr: 'Yeni adımız Airline.live',
      en: 'Our new name is Airline.live',
    },
    items: [
      {
        tr: 'Sitenin adı artık Airline.live, adresi airline.live. Eski adresteki her sayfa, yer imleri ve paylaşılmış bağlantılar dahil, kendiliğinden yeni adresteki aynı sayfaya gider; Türkçe sayfalar kökte, İngilizceleri /en altında kalır.',
        en: 'The site is now called Airline.live and lives at airline.live. Every page on the old address, bookmarks and shared links included, takes you to the same page at the new address; Turkish pages stay at the root and English ones under /en.',
      },
      {
        tr: 'Yeni adreste analiz onayı bir kez yeniden sorulur ve haritanın etiket ve liste ayarları varsayılana döner; istediğin gibi yeniden seçebilirsin. Yöneticiler panele yeni adresten bir kez yeniden giriş yapar.',
        en: 'On the new address the analytics consent banner asks once more, and the map’s label and list settings go back to their defaults; you can pick them again. Admins sign in to the panel once more at the new address.',
      },
      {
        tr: 'Eski adreste açık kalmış bir sekmede canlı uçaklar durursa sayfayı bir kez yenile; sayfa yeni adreste açılır ve akış sürer.',
        en: 'If live aircraft stop moving in a tab left open on the old address, reload the page once; it opens at the new address and the feed carries on.',
      },
    ],
    tryLinks: [
      { path: '/', label: { tr: 'Canlı harita', en: 'Live map' } },
      { path: '/kullanim-kosullari', label: { tr: 'Kullanım koşulları', en: 'Terms of use' } },
    ],
  },
  {
    version: '0.24.0',
    date: '2026-10-14',
    releasedAt: '2026-10-14T17:57:58Z',
    title: {
      tr: '5. halkaya hazırlık: saat dilimleri ve eski kodlar',
      en: 'Getting ready for ring 5: time zones and old codes',
    },
    items: [
      {
        tr: 'Kodu değişmiş havalimanlarının eski adresleri artık doğru sayfaya gider: örneğin /istasyon/UTSS Semerkant’ın sayfasını açar. Haritadaki arama da eski kodları tanır.',
        en: 'Old addresses of airports whose code changed now lead to the right page: for example /istasyon/UTSS opens Samarkand’s page. The map search recognises old codes too.',
      },
      {
        tr: 'Havalimanı sayfalarındaki yerel saat ve UTC farkı artık sunucudan gelir; eski tarayıcılarda da doğru görünür. Saat dilimi bilinmeyen bir havalimanında saatler UTC olarak yazılır.',
        en: 'Local time and UTC offset on airport pages now come from the server, so they are right on older browsers too. Where an airport’s time zone is unknown, times are shown in UTC.',
      },
      {
        tr: 'Dünyanın geri kalanındaki yaklaşık 2.000 havalimanının pist, kaplama ve saat dilimi verisi hazırlandı; haritada henüz bir değişiklik yok.',
        en: 'Runway, surface and time-zone data for about 2,000 airports in the rest of the world is ready; nothing changes on the map yet.',
      },
    ],
    tryLinks: [
      {
        path: '/istasyon/UTSS',
        label: { tr: 'Eski kodla Semerkant', en: 'Samarkand by its old code' },
      },
    ],
  },
  {
    version: '0.23.0',
    date: '2026-10-08',
    releasedAt: '2026-10-08T02:24:22Z',
    title: {
      tr: '4. halka: 719 havalimanı daha, 5.000 km’ye kadar',
      en: 'Ring 4: 719 more airports, up to 5,000 km',
    },
    items: [
      {
        tr: 'Listeye 719 havalimanı daha eklendi; artık 1.217 havalimanı var. Londra, Delhi, Ulan Batur, Nairobi, Lagos, Reykjavik ve Novosibirsk gibi 5.000 km’ye kadar olan havalimanlarının sayfası, pistleri, yerel saati ve hava durumu hazır; 55 ülke ilk kez listede.',
        en: '719 more airports are listed, 1,217 in total. Airports up to 5,000 km away such as London, Delhi, Ulaanbaatar, Nairobi, Lagos, Reykjavik and Novosibirsk now have their page, runways, local time and weather; 55 countries appear for the first time.',
      },
      {
        tr: 'Havalimanı adları ve şehirleri Türkçe ve İngilizce derlendi (Londra Heathrow, Yeni Delhi Indira Gandhi, Ulan Batur Cengiz Han). Haritadaki arama da yeni havalimanlarını bulur: “Londra” Londra’nın altı havalimanını listeler.',
        en: 'Airport names and cities are written in Turkish and English (London Heathrow, New Delhi Indira Gandhi, Ulaanbaatar Chinggis Khaan). The map search finds the new airports too: “London” lists London’s six airports.',
      },
      {
        tr: 'Canlı uçak verisi şimdilik Türkiye ve çevresinden çekildiği için bu havalimanlarının çoğunun çevresindeki uçaklar haritada görünmez; sayfalarında bu yazar. Çok havalimanı olan Hindistan ve Nijerya’nın adı uzaktan bakınca birkaç havalimanı işaretiyle örtüşebilir.',
        en: 'Live aircraft data is still fetched only over Türkiye and the surrounding area, so aircraft around most of these airports do not appear on the map; their pages say so. With many airports, the INDIA and NIGERIA names can touch a few pins when zoomed far out.',
      },
    ],
    tryLinks: [
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
      { path: '/istasyon/EGLL', label: { tr: 'Londra Heathrow', en: 'London Heathrow' } },
    ],
  },
  {
    version: '0.22.5',
    date: '2026-10-08',
    releasedAt: '2026-10-07T21:01:27Z',
    title: {
      tr: 'Bütün ülkelerin adları haritada',
      en: 'Every country named on the map',
    },
    items: [
      {
        tr: 'Haritayı uzaklaştırınca artık havalimanı listemizde olmayan ülkelerin adları da yazılır: dünyada 164 ülke ve bölge, her biri kendi sınırının içinde ve havalimanı işaretlerinden uzak bir yerde. Sığmayan çok küçük ada ülkeleri yazılmaz.',
        en: 'Zoomed out, the map now names countries that have no airport in our list too: 164 countries and territories worldwide, each inside its own borders and away from airport pins. Very small island countries that do not fit are left out.',
      },
      {
        tr: 'Bazı ülke adları sadeleşti: Fildişi Sahili, Kongo Demokratik Cumhuriyeti, Kongo Cumhuriyeti ve Myanmar. RUSYA adı Avrupa Rusyası’nda kalır.',
        en: 'Some country names are simpler: Côte d’Ivoire, Democratic Republic of the Congo, Republic of the Congo and Myanmar. The RUSSIA label stays in European Russia.',
      },
      {
        tr: 'Ülke adları ilk açılışta indirilmez, gerektiğinde yüklenir; sayfa biraz daha hızlı açılır.',
        en: 'Country names are no longer part of the first download; they load when needed, so pages open a little faster.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.22.4',
    date: '2026-10-07',
    releasedAt: '2026-10-07T20:09:13Z',
    title: {
      tr: 'Global bir uçuş takip sitesi',
      en: 'A global flight tracking site',
    },
    items: [
      {
        tr: 'Site artık Türkiye’ye özgü bir harita gibi sunulmuyor: başlıklar ve açıklamalar “Canlı uçuş takibi ve uçak haritası” der; İstanbul Havalimanı önceliğimiz olmaya devam ediyor.',
        en: 'The site is no longer presented as a Türkiye-only map: titles and descriptions now read “Live flight tracker and aircraft map”, with Istanbul Airport still our top priority.',
      },
      {
        tr: 'Canlı uçak verisinin şimdilik Türkiye ve çevresinden çekildiği Hakkında sayfasında ve havalimanı sayfalarında açıkça yazıyor; bu alanın dışındaki havalimanlarının sayfa başlığı bunu belirtir.',
        en: 'The About page and airport pages state plainly that live aircraft data is for now fetched over Türkiye and the surrounding area; airports outside that area say so in their page title.',
      },
      {
        tr: 'Havalimanları listesinde Türkiye dışındaki tablo “Diğer ülkelerdeki havalimanları” oldu; yabancı havalimanı sayfalarındaki “Türkiye’deki en yakın havalimanı” satırı ve “Türkiye’ye uzaklık” sütunu kaldırıldı. Yenilikler sayfasındaki yayın saatleri UTC farkıyla yazılır.',
        en: 'In the airport list the second table is now “Airports in other countries”; the “nearest airport in Türkiye” row and the “distance to Türkiye” column are gone. Release times on What’s new show the UTC offset.',
      },
    ],
    tryLinks: [
      { path: '/hakkinda', label: { tr: 'Hakkında', en: 'About' } },
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
    ],
  },
  {
    version: '0.22.3',
    date: '2026-10-07',
    releasedAt: '2026-10-07T19:24:54Z',
    title: {
      tr: 'Haritada havalimanı araması',
      en: 'Airport search on the map',
    },
    items: [
      {
        tr: 'Sol üstteki arama kutusu artık havalimanlarını da bulur: IATA ya da ICAO kodu (IST, LTFM), adı ya da şehri (Sabiha Gökçen, Londra, Heathrow) yazınca öneriler yazarken çıkar. Türkçe harfler ve aksanlar fark etmez.',
        en: 'The search box at the top left now finds airports too: type an IATA or ICAO code (IST, LTFM), a name or a city (Sabiha Gökçen, London, Heathrow) and suggestions appear as you type. Turkish letters and accents do not matter.',
      },
      {
        tr: 'Bir havalimanı seçince harita oraya gider ve havalimanının penceresi açılır. Uçak araması (sefer no, çağrı kodu, tescil, hex) eskisi gibi çalışır; ikisi birlikte eşleşirse liste havalimanlarını ve uçakları ayrı gösterir.',
        en: 'Picking an airport flies the map there and opens its window. Aircraft search (flight number, callsign, registration, hex) works as before; when both match, the list shows airports and aircraft separately.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.22.2',
    date: '2026-10-07',
    releasedAt: '2026-10-07T14:31:41Z',
    title: {
      tr: 'Askerî hava üsleri sitenin hiçbir yerinde yok',
      en: 'Air force bases removed from the whole site',
    },
    items: [
      {
        tr: 'Askerî hava üsleri artık yalnız haritada değil, sitenin hiçbir yerinde gösterilmez: havalimanları listesinde, havalimanı sayfalarında, yakın havalimanları satırlarında ve hava durumunda yoklar. Türkiye listesinde 56 sivil havalimanı var.',
        en: 'Air force bases are no longer shown anywhere on the site, not just on the map: they are gone from the airport list, the airport pages, the nearby-airports rows and the weather. The Türkiye list has 56 civil airports.',
      },
      {
        tr: 'Atina, Sakız ve Kalamata sayfalarındaki “Türkiye’deki en yakın havalimanı” satırı artık İzmir Adnan Menderes’i gösterir.',
        en: 'The “nearest airport in Türkiye” row on the Athens, Chios and Kalamata pages now shows İzmir Adnan Menderes.',
      },
    ],
    tryLinks: [{ path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } }],
  },
  {
    version: '0.22.1',
    date: '2026-10-06',
    releasedAt: '2026-10-06T13:34:14Z',
    title: {
      tr: 'Askerî üsler haritadan kalktı, harita biraz daha uzaktan açılır',
      en: 'Air bases off the map, and a slightly wider opening view',
    },
    items: [
      {
        tr: 'Beş askerî hava üssü (İncirlik, Afyon, Bandırma, Eskişehir, Çiğli) artık canlı haritada ve haritanın “Havalimanları” listesinde gösterilmez. Havalimanları sayfasında ve kendi sayfalarında yerinde durur.',
        en: 'The five air force bases (Incirlik, Afyon, Bandırma, Eskişehir, Çiğli) no longer appear on the live map or in its “Airports” list. They stay on the airports page and on their own pages.',
      },
      {
        tr: 'Harita bilgisayarda biraz daha uzaktan açılır: İstanbul Havalimanı ortada, Çorlu’dan Kocaeli’ne kadar bölge ilk bakışta görünür. Telefonda açılış değişmedi.',
        en: 'On computers the map opens a little further out: Istanbul Airport in the middle, with the area from Çorlu to Kocaeli in view at first glance. The opening view on phones is unchanged.',
      },
      {
        tr: 'Uzaktan bakınca TÜRKİYE adı ülkenin ortasına, Kırşehir yakınına kaydı.',
        en: 'Zoomed far out, the TÜRKIYE name moved to the middle of the country, near Kırşehir.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.22.0',
    date: '2026-10-06',
    releasedAt: '2026-10-06T00:41:12Z',
    title: {
      tr: '4. halkaya hazırlık: daha hafif harita',
      en: 'Getting ready for ring 4: a lighter map',
    },
    items: [
      {
        tr: 'Harita sayfası ilk açılışta yaklaşık 17 KB daha az veri indirir: havalimanı penceresi ve havalimanları listesi ancak açıldıklarında yüklenir. Bağlantı koparsa pencere boş kalmaz, sayfayı yenileme düğmesi gösterilir.',
        en: 'The map page downloads about 17 KB less on first load: the airport window and the airport list load only when opened. If the connection drops, a reload button is shown instead of an empty window.',
      },
      {
        tr: 'Bir sonraki sürümde eklenecek yaklaşık 720 havalimanı (Türkiye’ye 5.000 km’ye kadar) için pist, kaplama ve saat dilimi verileri hazırlandı; uçuş durumu hesabı ve hava durumu bu ölçeğe göre hızlandırıldı. Haritada şimdilik bir değişiklik yok.',
        en: 'Runway, surface and time-zone data for the roughly 720 airports coming in the next release (up to 5,000 km from Türkiye) are ready; flight-status calculation and weather were sped up for that scale. Nothing changes on the map yet.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.21.1',
    date: '2026-10-06',
    releasedAt: '2026-10-05T23:42:57Z',
    title: {
      tr: 'Ülke adları daha belirgin, boş yerlerde',
      en: 'Clearer country names in empty spots',
    },
    items: [
      {
        tr: 'Ülke adları aynı boyutta ama daha belirgin: yazı daha az saydam, koyu kenarı daha güçlü; açık renkli uydu zemininde de okunur.',
        en: 'Country names keep their size but are more prominent: less transparent letters with a stronger dark edge, readable on bright satellite ground too.',
      },
      {
        tr: 'Adlar artık havalimanı işaretlerinin ve kodlarının arasına değil, ülkenin içinde boş bir yere yazılır; örneğin İTALYA ve RUSYA işaret kümelerinden uzaklaştı. Türkiye’de 61 havalimanı olduğu için TÜRKİYE adı uzaktan bakınca birkaç işaretle örtüşebilir.',
        en: 'Names now sit in an empty spot inside the country instead of among airport pins and codes; for example ITALY and RUSSIA moved away from pin clusters. With 61 airports, the TÜRKIYE name can still touch a few pins when zoomed far out.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.21.0',
    date: '2026-10-05',
    releasedAt: '2026-10-05T18:53:30Z',
    title: {
      tr: 'Kapsama raporu',
      en: 'Coverage report',
    },
    items: [
      {
        tr: 'Yönetim panelinde yeni “Kapsama” sayfası: son 6 saatten 7 güne kadar seçilen pencerede her istasyon için kaç varış görüldüğünü, bunların ne kadarının yerde de görüldüğünü (güven aralığıyla), son havadaki örneğin yüksekliğini ve piste uzaklığını, veri gecikmesini ve sağlayıcı kesintilerini rapor eder. Rapor indirilebilir; iniş bildirimi kuralları bu ölçümlere göre ayarlanacak.',
        en: 'A new “Coverage” page in the admin panel: for a window from 6 hours to 7 days it reports, per station, how many arrivals were seen, how many of them were also seen on the ground (with a confidence interval), the height and runway distance of the last airborne sample, data age and provider outages. The report can be downloaded; the landing alert rules will be tuned on these measurements.',
      },
      {
        tr: 'Her istasyonun son 7 gündeki yerde görülen varış oranı her gece kendiliğinden hesaplanır.',
        en: 'Each station’s share of arrivals seen on the ground over the last 7 days is now computed every night.',
      },
    ],
  },
  {
    version: '0.20.0',
    date: '2026-10-05',
    releasedAt: '2026-10-05T07:45:13Z',
    title: {
      tr: 'Kapsama ölçümüne hazırlık',
      en: 'Groundwork for coverage measurement',
    },
    items: [
      {
        tr: 'Uçuş izlerine iki ölçüm alanı eklendi: her konum örneğinin alıcıya ulaşma gecikmesi ve uçağın barometrik alçalma hızı. Sonraki sürümdeki kapsama raporu, İstanbul ve öbür istasyonlarda inişlerin ne kadarının yerde görüldüğünü bu alanlarla ölçecek. Sitede görünen bir değişiklik yok.',
        en: 'Flight tracks now store two more measurements: how old each position report is and the aircraft’s barometric descent rate. The coverage report in the next release will use them to measure how many landings at Istanbul and the other stations are seen on the ground. Nothing changes on the site.',
      },
    ],
  },
  {
    version: '0.19.1',
    date: '2026-10-05',
    releasedAt: '2026-10-05T05:51:51Z',
    title: {
      tr: 'Ülke adları sınırların içinde',
      en: 'Country names stay inside their borders',
    },
    items: [
      {
        tr: 'Ülke adları artık ülkenin sınırlarından ya da kıyısından dışarı taşmaz: ad, ülkenin içine sığdığı yakınlaştırmada görünür. Ad başkentte sığıyorsa orada, sığmıyorsa başkente en yakın uygun yerde durur ve yakınlaştırırken yerinden oynamaz.',
        en: 'Country names no longer spill over their borders or coastline: a name appears at the zoom level where it fits inside the country. It stays at the capital when it fits there, otherwise at the nearest suitable spot, and it does not move while you zoom.',
      },
      {
        tr: 'Birden çok kelimeli adlar alt alta yazılır: SUUDİ / ARABİSTAN, KUZEY / MAKEDONYA, BOSNA / HERSEK.',
        en: 'Multi-word names are written one word per line: SAUDI / ARABIA, NORTH / MACEDONIA, BOSNIA AND / HERZEGOVINA.',
      },
      {
        tr: 'Uzaktan bakınca artık daha az ülke adı görünür; küçük ülkelerin adları yakınlaştırınca çıkar. Bahreyn, Lüksemburg ve Malta, adlar silinmeden önce hiçbir yakınlaştırmada sığmadığı için gösterilmez.',
        en: 'Fewer country names show when zoomed out; smaller countries get their names as you zoom in. Bahrain, Luxembourg and Malta never fit before the names fade out, so they are not labelled.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.19.0',
    date: '2026-10-05',
    releasedAt: '2026-10-05T02:25:50Z',
    title: {
      tr: 'Canlı veri için ölçüm ve kayıt araçları',
      en: 'Measurement and recording tools for live data',
    },
    items: [
      {
        tr: 'Canlı uçuş verisinin kalitesini ölçmek için iki geliştirici aracı eklendi: biri canlı veri akışını 5 dakika çalıştırıp Türkiye üzerindeki uçak sayısını, İstanbul Havalimanı verisinin tazeliğini ve sağlayıcı durumunu denetler; öbürü bir havalimanının çevresindeki gerçek uçuşları sonradan yeniden oynatılabilecek biçimde kaydeder. Araçlar istek hızı kurallarına uyar ve yalnızca elle çalıştırılır. Sitede görünen bir değişiklik yok; bu ölçümler sonraki iniş bildirimi kurallarının girdisi olacak.',
        en: 'Two developer tools for measuring live flight data: one runs the live data feed for 5 minutes and checks the number of aircraft over Türkiye, the freshness of Istanbul Airport data and the provider status; the other records real flights around an airport so they can be replayed later. Both respect the request-rate rules and run only by hand. Nothing changes on the site; these measurements will feed the upcoming landing alert rules.',
      },
    ],
  },
  {
    version: '0.18.2',
    date: '2026-10-05',
    releasedAt: '2026-10-05T01:08:09Z',
    title: {
      tr: 'Haritada ülke adları',
      en: 'Country names on the map',
    },
    items: [
      {
        tr: 'Haritayı uzaklaştırınca ülke adları başkentlerinin üstünde büyük, aralıklı ve yarı saydam harflerle görünür; büyük ülkelerin adı daha iri yazılır. Uçaklar, havalimanı işaretleri ve kodları her zaman adların üstünde kalır. Havalimanı çevresine yaklaşınca ülke adları silinir.',
        en: 'Zoom out and country names appear over their capitals in large, spaced, semi-transparent letters; larger countries get larger names. Aircraft, airport pins and codes always stay on top. Zoom in to an airport and the country names fade away.',
      },
      {
        tr: 'Haritadaki “Etiketler” düğmesinde yeni “Ülke adları” seçeneği: Göster ya da Gizle; seçim tarayıcıda hatırlanır.',
        en: 'A new “Country names” option in the map’s “Labels” button: Show or Hide; the choice is remembered in your browser.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.18.1',
    date: '2026-10-04',
    releasedAt: '2026-10-04T20:32:07Z',
    title: {
      tr: 'Daha az veri, daha hızlı harita',
      en: 'Less data, a faster map',
    },
    items: [
      {
        tr: 'Sunucunun gönderdiği veriler artık sıkıştırılıyor: haritanın yüklediği havalimanı ve pist listesi 440 KB yerine yaklaşık 76 KB, havalimanı sayfasındaki 24 saatlik METAR/TAF kaydı 65 KB yerine yaklaşık 3 KB. Harita ve sayfalar özellikle mobil bağlantıda daha hızlı açılır.',
        en: 'Data sent by the server is now compressed: the airport and runway list the map loads is about 76 KB instead of 440 KB, and the 24-hour METAR/TAF history on an airport page about 3 KB instead of 65 KB. The map and pages open faster, especially on mobile connections.',
      },
    ],
    tryLinks: [
      { path: '/', label: { tr: 'Canlı harita', en: 'Live map' } },
      { path: '/istasyon/LTFM', label: { tr: 'İstanbul Havalimanı', en: 'Istanbul Airport' } },
    ],
  },
  {
    version: '0.18.0',
    date: '2026-10-04',
    releasedAt: '2026-10-04T19:45:30Z',
    title: {
      tr: '3. halka: 2.000 km’ye kadar 278 havalimanı daha',
      en: 'Ring 3: 278 more airports up to 2,000 km',
    },
    items: [
      {
        tr: 'Türkiye’deki en yakın havalimanına 1.000 ile 2.000 km arasındaki 278 havalimanı eklendi: Moskova, Viyana, Roma, Berlin, Frankfurt, Varşova, Prag, Münih, Milano, Dubai, Doha, Riyad, Cidde, Cezayir ve diğerleri. Her birinin Türkçe adı, sayfası, pistleri, canlı hava durumu ve yerel saati var. Listede artık 503 havalimanı var.',
        en: 'Added 278 airports between 1,000 and 2,000 km from the nearest airport in Türkiye: Moscow, Vienna, Rome, Berlin, Frankfurt, Warsaw, Prague, Munich, Milan, Dubai, Doha, Riyadh, Jeddah, Algiers and others. Each has its page, runways, live weather and local time. The list now holds 503 airports.',
      },
      {
        tr: '2022’den beri sivil uçuşlara kapalı olduğu bilinen ama kaynakta hâlâ tarifeli görünen havalimanlarında (Krasnodar, Gelencik, Elista, Voronej) sayfada ve pencerede “Sivil uçuşlara kapalı olabilir (2022’den beri)” notu yazar.',
        en: 'Airports known to be closed to civil flights since 2022 but still listed as scheduled in the source (Krasnodar, Gelendzhik, Elista, Voronezh) show the note “May be closed to civil flights (since 2022)” on their page and in the map window.',
      },
      {
        tr: 'Haritadaki havalimanı penceresi artık yalnızca o havalimanının hava durumunu yükler; sayfa ve pencere daha hızlı açılır.',
        en: 'The map’s airport window now loads only that airport’s weather, so it opens faster.',
      },
    ],
    tryLinks: [
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
      { path: '/istasyon/LOWW', label: { tr: 'Viyana Havalimanı', en: 'Vienna Airport' } },
    ],
  },
  {
    version: '0.17.2',
    date: '2026-10-04',
    releasedAt: '2026-10-04T19:03:24Z',
    title: {
      tr: 'Haritada kesikli ülke sınırları',
      en: 'Dashed country borders on the map',
    },
    items: [
      {
        tr: 'Uydu haritasında ülke sınırları beyaz kesikli çizgiyle ve koyu bir kenarla belirgin; tartışmalı sınırlar noktalı. Deniz sınırları ve il sınırları çizilmez. Sınır verisi OpenStreetMap’ten (OpenFreeMap) gelir; atıfı haritanın alt şeridindedir.',
        en: 'Country borders now stand out on the satellite map as white dashed lines with a dark edge; disputed borders are dotted. Sea and province borders are not drawn. Border data comes from OpenStreetMap (OpenFreeMap), credited in the strip at the bottom of the map.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.17.1',
    date: '2026-10-04',
    releasedAt: '2026-10-04T18:36:55Z',
    title: {
      tr: 'Yeniliklerde yayın tarihi ve saati',
      en: 'Release date and time on What’s new',
    },
    items: [
      {
        tr: 'Yenilikler sayfasında her sürümün yanında yayın tarihi ve saati yazıyor: “4 Ekim 2026, 20:27 (Türkiye saati)”. Saatler sürümün canlıya çıkıp doğrulandığı andır; yayındaki son sürümde sunucunun açıldığı an gösterilir.',
        en: 'The What’s new page shows each version’s release date and time: “4 October 2026, 20:27 (UTC+3)”. The time is when the version went live and was verified; for the version currently running it is when the server started.',
      },
    ],
    tryLinks: [{ path: '/yenilikler', label: { tr: 'Yenilikler', en: 'What’s new' } }],
  },
  {
    version: '0.17.0',
    date: '2026-10-04',
    releasedAt: '2026-10-04T17:27:12Z',
    title: {
      tr: '2. halka: 1.000 km’ye kadar 89 havalimanı daha',
      en: 'Ring 2: 89 more airports up to 1,000 km',
    },
    items: [
      {
        tr: 'Türkiye’deki en yakın havalimanına 500 ile 1.000 km arasındaki 89 havalimanı eklendi: Kahire, İskenderiye, Belgrad, Budapeşte, Bükreş, Kişinev, Tiran, Korfu, Kuveyt, Tahran ve diğerleri. Her birinin Türkçe adı, sayfası, pistleri, canlı hava durumu ve yerel saati var. Listede artık 225 havalimanı var.',
        en: 'Added 89 airports between 500 and 1,000 km from the nearest airport in Türkiye: Cairo, Alexandria, Belgrade, Budapest, Bucharest, Chișinău, Tirana, Corfu, Kuwait, Tehran and others. Each has its page, runways, live weather and local time. The list now holds 225 airports.',
      },
      {
        tr: 'Liste sayfasındaki başlık artık “Türkiye dışındaki havalimanları”. İskenderiye’nin kaynaktaki hatalı kodu düzeltildi (HEBA), boş yinelenen pist satırları gösterilmiyor.',
        en: 'The list page heading is now “Airports outside Türkiye”. Alexandria’s wrong code in the source data is corrected (HEBA), and empty duplicate runway rows are hidden.',
      },
      {
        tr: 'Haritanın alt köşesindeki atıf şeridi artık sitenin adı ve sürümüyle başlıyor; tıklayınca Yenilikler açılır. Uydu görüntüsü (Esri) ve canlı uçuş verisi (ADSB.lol) atıfları lisans gereği yerinde kalıyor.',
        en: 'The attribution strip at the bottom of the map now starts with the site name and version, linking to What’s new. The satellite imagery (Esri) and live flight data (ADSB.lol) credits stay, as their licences require.',
      },
      {
        tr: 'Havalimanı sayfasının uzman bölümünde yalnızca yürürlükteki TAF tahminleri gösterilir; eskileri METAR/TAF kaydında kalır.',
        en: 'The expert section of the airport page shows only TAFs still in force; older ones remain in the METAR/TAF log.',
      },
    ],
    tryLinks: [
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
      { path: '/istasyon/HECA', label: { tr: 'Kahire Havalimanı', en: 'Cairo Airport' } },
    ],
  },
  {
    version: '0.16.1',
    date: '2026-10-04',
    releasedAt: '2026-10-04T14:25:25Z',
    title: {
      tr: 'Derecelendirilmiş rüzgâr renkleri',
      en: 'Graded wind colours',
    },
    items: [
      {
        tr: 'Rüzgâr varsa rüzgâr satırı her zaman renkli ve şiddetinin adıyla yazılır: 10 km/sa’e kadar yeşil (Hafif rüzgâr), 11–19 km/sa yeşil-sarı (Tatlı rüzgâr), 20–30 km/sa sarı (Orta rüzgâr), 31 km/sa’ten ya da 46 km/sa hamleden itibaren kehribar (Sert / Hamleli rüzgâr), MGM uyarı eşiğinden (37 km/sa ya da 56 km/sa hamle) itibaren turuncu (Kuvvetli rüzgâr, Fırtınamsı rüzgâr), 63 km/sa’ten itibaren kırmızı (Fırtına ve üstü). Pencerede ve havalimanı sayfasında aynı.',
        en: 'Whenever there is wind, the wind row is coloured and names its strength: green up to 10 km/h (Light wind), lime 11–19 km/h (Gentle breeze), yellow 20–30 km/h (Moderate wind), amber from 31 km/h or 46 km/h gusts (Fresh / Gusty wind), orange from the Turkish aerodrome warning threshold of 37 km/h or 56 km/h gusts (Strong wind, Near gale), red from 63 km/h (Gale and above). The same in the map window and on the airport page.',
      },
    ],
    tryLinks: [
      { path: '/?havalimani=LTFM', label: { tr: 'Haritada İstanbul', en: 'Istanbul on the map' } },
    ],
  },
  {
    version: '0.16.0',
    date: '2026-10-04',
    releasedAt: '2026-10-04T13:40:19Z',
    title: {
      tr: 'Uçak listesi sağ üstte; kuyruk tescili, konum ve durum',
      en: 'Aircraft list at the top right with tail number, location and status',
    },
    items: [
      {
        tr: '“Haritada görünen uçaklar” listesi geniş ekranda sağ üst köşeye taşındı; solda yalnızca arama ve seçili uçağın kartı kalıyor. Liste en çok haritanın yarısı kadar uzar ve içinde kayar; başlığındaki düğmeyle uçak sayısını gösterecek kadar küçülür, tercih hatırlanır. Telefonda alttaki düğme aynı kaldı.',
        en: 'The “Aircraft on the map” list now sits at the top right on wide screens; the left side keeps only the search and the selected aircraft’s card. The list grows to at most half the map and scrolls inside; the button in its header collapses it to the aircraft count and the choice is remembered. On phones the bottom button is unchanged.',
      },
      {
        tr: 'Sütunlar: Sefer, Kuyruk (tescil), Yükseklik ve Konum ve durum. Durum en yakın havalimanına göre yazılır: “Yerde IST”, “İnişte IST, pist 35L”, “Yaklaşmada IST, 18 km” ya da uçuştaki uçak için “IST, 45 km kuzeyinde”. Durumlar ADS-B verisinden yapılan tahmindir; tescili yayınlanmayan uçakta “—” yazar. Tip ve hız uçağa tıklayınca açılan kartta.',
        en: 'Columns: Flight, Tail (registration), Altitude and Location and status. The status is written relative to the nearest airport: “On ground IST”, “Landing IST, runway 35L”, “Approaching IST, 18 km” or, for aircraft en route, “45 km north of IST”. Statuses are estimates from ADS-B data; aircraft that do not broadcast a registration show “—”. Type and speed are on the card that opens when you click an aircraft.',
      },
      {
        tr: 'Havalimanı penceresi ve seçili uçağın etiketi listenin, aramanın ve sağ alttaki düğmelerin altında kalmaz.',
        en: 'The airport window and the selected aircraft’s label no longer end up under the list, the search box or the bottom-right buttons.',
      },
      {
        tr: 'Haritadaki havalimanı etiketlerinde yalnızca kod gösterilir; “Kod ve ad” seçeneği kaldırıldı. Ad ve ayrıntılar havalimanına tıklayınca açılan pencerede. Etiketler menüsünde Havalimanları için Gizle ya da Kod seçilir; kırmızı iğneler her zaman haritada kalır.',
        en: 'Airport labels on the map show only the code; the “With name” option was removed. The name and details are in the window that opens when you click the airport. In the Labels menu, Airports can be Hide or Code; the red pins always stay on the map.',
      },
    ],
    tryLinks: [{ path: '/?havalimani=LTFM', label: { tr: 'Canlı harita', en: 'Live map' } }],
  },
  {
    version: '0.15.0',
    date: '2026-10-03',
    releasedAt: '2026-10-03T17:25:49Z',
    title: {
      tr: 'Yeni logo: halkanın içinden geçen uçak',
      en: 'New logo: a plane flying through the ring',
    },
    items: [
      {
        tr: 'Sitenin yeni logosu: turkuaz halkanın içinden 45° açıyla geçen, yukarıdan görünen çift motorlu bir yolcu uçağı. Sitenin başlığında, tarayıcı sekmesinde, telefona eklenen uygulama simgesinde ve paylaşım görsellerinde aynı logo var; küçük boyutlarda turkuaz daire içinde beyaz uçak olarak sadeleşir.',
        en: 'The site has a new logo: a top-down twin-engine airliner flying at 45° through the turquoise ring. The same logo appears in the site header, the browser tab, the app icon on your phone and share images; at small sizes it simplifies to a white plane in a turquoise disc.',
      },
    ],
    tryLinks: [{ path: '/', label: { tr: 'Ana sayfa', en: 'Home' } }],
  },
  {
    version: '0.14.1',
    date: '2026-10-03',
    releasedAt: '2026-10-03T16:55:39Z',
    title: {
      tr: 'Rüzgâr renkleri ve rüzgâr kesmesi uyarısı',
      en: 'Wind colours and wind shear warnings',
    },
    items: [
      {
        tr: 'Rüzgârlı havalimanları artık renkli: ortalama rüzgâr 31 km/sa’i (17 kt) ya da hamle 46 km/sa’i (25 kt) geçince rüzgâr satırı turuncu olur ve “Sert rüzgâr” ya da “Hamleli rüzgâr” yazar; daha güçlüsü yine “Kuvvetli rüzgâr”, “Fırtına” … diye adlandırılır. Bütün havalimanlarının canlı verisiyle denetlendi; önceden renksiz kalan 12 rüzgârlı havalimanı artık renkli.',
        en: 'Windy airports are now highlighted: when the mean wind reaches 31 km/h (17 kt) or gusts reach 46 km/h (25 kt), the wind row turns amber and says “Fresh wind” or “Gusty wind”; stronger winds are still named “Strong wind”, “Gale” and so on. Checked against live data from every airport; 12 windy airports that were not highlighted before now are.',
      },
      {
        tr: 'Hafif rüzgâr (10 km/sa ve altı, sakin dahil) açık yeşil satırla ve “Hafif rüzgâr” etiketiyle gösterilir; arası normal renkte kalır.',
        en: 'Light wind (10 km/h or less, calm included) is shown with a light green row and a “Light wind” tag; winds in between keep the normal colour.',
      },
      {
        tr: 'METAR’da bildirilen rüzgâr kesmesi (wind shear) artık rüzgâr satırında yazılır ve vurgulanır: “Rüzgâr kesmesi bildirildi: pist 34”.',
        en: 'Wind shear reported in the METAR is now shown and highlighted in the wind row: “Wind shear reported: runway 34”.',
      },
    ],
    tryLinks: [
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
      { path: '/?havalimani=LTFM', label: { tr: 'Haritada İstanbul', en: 'Istanbul on the map' } },
    ],
  },
  {
    version: '0.14.0',
    date: '2026-10-03',
    releasedAt: '2026-10-03T16:36:36Z',
    title: {
      tr: 'Doğru havalimanı adları, haritada ad etiketi ve yurt dışında yerel saat',
      en: 'Correct airport names, name labels on the map and local time abroad',
    },
    items: [
      {
        tr: 'Askerî havalimanları artık Türkçe sayfalarda Türkçe, İngilizce sayfalarda İngilizce adıyla görünüyor: İncirlik, Afyon, Bandırma, Eskişehir ve Çiğli Hava Üssü (Incirlik … Air Base). Etimesgut’un yeni resmî adı “Ankara (Etimesgut) Havalimanı” olarak yazılıyor.',
        en: 'Military airfields now show their Turkish names on Turkish pages and English names on English pages: İncirlik, Afyon, Bandırma, Eskişehir and Çiğli Air Base. Etimesgut appears under its new official name, “Ankara (Etimesgut) Airport”.',
      },
      {
        tr: 'Haritadaki “Etiketler” menüsüne Havalimanları seçeneği geldi: Gizle, Kod ya da Kod ve ad. Kod ve ad seçilince yakınlaşınca “IST İstanbul” gibi kısa adlar görünür. Gizle yalnız yazıları kaldırır; kırmızı iğneler her zaman haritada kalır ve tıklanır.',
        en: 'The map’s “Labels” menu has a new Airports option: Hide, Code or With name. With name shows short names such as “IST Istanbul” when you zoom in. Hide removes only the text; the red pins always stay on the map and remain clickable.',
      },
      {
        tr: 'Türkiye dışındaki havalimanlarında yerel saat UTC farkıyla yazılıyor: “Yerel saat 23:05 (UTC+2)”. Havalimanı sayfasında gün doğumu ve batımı geri geldi; gözlem, tahmin ve METAR/TAF kaydı saatleri havalimanının kendi saatiyle. Saat dilimleri IANA saat dilimi veritabanından (kamu malı).',
        en: 'Airports outside Türkiye now show local time with the UTC offset: “Local time 23:05 (UTC+2)”. Their pages show sunrise and sunset again, and observation, forecast and METAR/TAF log times are in the airport’s own time. Time zones come from the IANA time zone database (public domain).',
      },
    ],
    tryLinks: [
      {
        path: '/istasyon/LGAV',
        label: { tr: 'Atina Havalimanı yerel saat', en: 'Athens Airport local time' },
      },
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
      { path: '/?havalimani=LTFM', label: { tr: 'Haritada etiketler', en: 'Labels on the map' } },
    ],
  },
  {
    version: '0.13.1',
    date: '2026-10-03',
    releasedAt: '2026-10-03T15:09:35Z',
    title: {
      tr: 'Havalimanı penceresi hizalı tablo oldu',
      en: 'The airport window is now a neatly aligned table',
    },
    items: [
      {
        tr: 'Ortalı düzen yamuk göründüğü için haritadaki havalimanı penceresi tek bir hizalı tabloya döndü: bütün satırlarda simgeler, etiketler ve değerler aynı sütunda başlıyor; başlık, hava durumu başlığı, gözlem satırı ve bağlantı da aynı kenardan.',
        en: 'The centred layout looked uneven, so the map’s airport window is now a single aligned table: icons, labels and values start in the same column on every row, and the title, weather headline, observation line and link share the same edge.',
      },
      {
        tr: 'Rakım, pistler ve yerel saat satırlarının da simgesi var.',
        en: 'The elevation, runways and local time rows now have icons too.',
      },
    ],
    tryLinks: [
      {
        path: '/?havalimani=LTFM',
        label: { tr: 'Haritada İstanbul penceresi', en: 'Istanbul window on the map' },
      },
    ],
  },
  {
    version: '0.13.0',
    date: '2026-10-03',
    releasedAt: '2026-10-02T23:47:09Z',
    title: {
      tr: 'Rüzgâr knot ile, şimşek ve yıldırım uyarısı, ortalı havalimanı penceresi',
      en: 'Wind in knots, lightning warnings and a centred airport window',
    },
    items: [
      {
        tr: 'Rüzgâr hızı km/sa’nın yanında knot olarak da yazılıyor: “Kuzeydoğudan 48 km/sa (26 kt), hamle 59 km/sa (32 kt)”. Pencerede, havalimanı sayfasında, tahminlerde ve METAR/TAF kaydında aynı biçim kullanılıyor.',
        en: 'Wind speed is now given in knots as well as km/h: “From the northeast 48 km/h (26 kt), gusts 59 km/h (32 kt)”. The same format is used in the map window, on the airport page, in forecasts and in the METAR/TAF log.',
      },
      {
        tr: 'Etkili rüzgâr her havalimanında belirtiliyor: ortalama rüzgâr 20 knotu ya da hamle 30 knotu geçince (MGM’nin meydan uyarı ölçütü) rüzgâr satırı renkli ve kalın yazılıyor, şiddeti de adıyla söyleniyor: “Kuvvetli rüzgâr”, “Fırtınamsı rüzgâr”, “Fırtına” … Yalnızca hamle güçlüyse “Kuvvetli hamle”. Tahmin özeti de dönemin en güçlü rüzgârını gösteriyor.',
        en: 'Significant wind is flagged at every airport: when the mean wind reaches 20 knots or gusts reach 30 knots (the Turkish aerodrome warning threshold), the wind row is coloured and bold and the strength is named: “Strong wind”, “Near gale”, “Gale” … If only the gusts are strong it says “Strong gusts”. The forecast summary now shows the strongest wind of the period.',
      },
      {
        tr: 'Şimşek ve yıldırım uyarısı: havalimanında gök gürültüsü varsa “şimşek ve yıldırım tehlikesi”, çevresinde varsa “yıldırım havalimanına da düşebilir” yazıyor. Kümülonimbüs (oraj bulutu) yağışla birlikteyse tehlike, yağışsızsa olasılık olarak belirtiliyor. Yıldırım yağmurun dışına, fırtınadan kilometrelerce uzağa da düşebildiği için uyarı yağmur yokken de gösteriliyor.',
        en: 'Lightning warnings: a thunderstorm at the airport shows “lightning danger”, one nearby shows “lightning can strike the airport too”. Cumulonimbus (thunderstorm cloud) with precipitation is shown as a danger, without precipitation as a possibility. Lightning can strike well away from the rain and kilometres from the storm, so the warning also appears when it is not raining.',
      },
      {
        tr: 'Haritadaki havalimanı penceresinde bütün yazılar ortalı; sayılar birimlerinden ayrılmıyor.',
        en: 'All text in the map’s airport window is centred, and numbers no longer break away from their units.',
      },
    ],
    tryLinks: [
      {
        path: '/?havalimani=LTFM',
        label: { tr: 'Haritada İstanbul penceresi', en: 'Istanbul window on the map' },
      },
      {
        path: '/istasyon/LTFM',
        label: { tr: 'İstanbul Havalimanı hava durumu', en: 'Istanbul Airport weather' },
      },
    ],
  },
  {
    version: '0.12.0',
    date: '2026-10-02',
    releasedAt: '2026-10-02T20:46:59Z',
    title: {
      tr: 'Yakın ülkelerdeki havalimanları ve yeni turkuaz görünüm',
      en: 'Airports in nearby countries and a new turquoise look',
    },
    items: [
      {
        tr: 'Türkiye’deki en yakın havalimanına 500 km’den yakın 75 yabancı havalimanı eklendi: Yunanistan, Bulgaristan, Kıbrıs, Gürcistan, Ermenistan, Azerbaycan, İran, Irak, Suriye, Lübnan ve diğer komşu ülkelerden. Her birinin Türkçe adı, sayfası, pistleri ve canlı hava durumu var; haritada kırmızı iğneyle görünür. Ercan Havalimanı KKTC’de gösterilir. Uzak ülkeler sonraki sürümlerde halka halka gelecek.',
        en: 'Added 75 airports abroad that lie within 500 km of the nearest airport in Türkiye: in Greece, Bulgaria, Cyprus, Georgia, Armenia, Azerbaijan, Iran, Iraq, Syria, Lebanon and other neighbouring countries. Each has its page, runways and live weather, and appears on the map with a red pin. Ercan Airport is shown in the TRNC. More distant countries will follow ring by ring in later releases.',
      },
      {
        tr: 'Site yeni, açık turkuaz bir görünüme geçti. Bütün yazılar okunabilirlik ölçütünü karşılıyor; telefonun karanlık modu açıkken de site aynı görünür.',
        en: 'The site has a new light turquoise look. All text meets the readability contrast guidelines, and the site looks the same when your phone is in dark mode.',
      },
      {
        tr: 'Hava durumu daha kolay okunuyor: sıcaklık başlığın yanında ayrı bir kutucukta; rüzgâr, yağmur, kar, gök gürültüsü, sis ve görüş satırlarının başında simge var. O an yağmur, kar, gök gürültüsü ya da sis varsa satırı renkli ve kalın yazılır. Haritadaki havalimanı penceresinden gün doğumu ve batımı kaldırıldı; havalimanı sayfasında duruyor.',
        en: 'Weather is easier to read: the temperature sits in its own badge next to the headline, and the wind, rain, snow, thunderstorm, fog and visibility rows have icons. If rain, snow, a thunderstorm or fog is happening right now, its row is coloured and bold. Sunrise and sunset were removed from the map’s airport window; they remain on the airport page.',
      },
      {
        tr: 'Sayıların önünde artık eksi gibi okunabilecek “·” işareti yok: uçak etiketleri “431 km/sa, 333 m”, hava durumu “Kuzeydoğudan 33 km/sa, hamle 59 km/sa” biçiminde.',
        en: 'Numbers are no longer preceded by a “·” that could be read as a minus sign: aircraft labels read “431 km/h, 333 m” and weather reads “From the northeast 33 km/h, gusts 59 km/h”.',
      },
      {
        tr: 'Telefonda havalimanı penceresinin “Havalimanı sayfası” bağlantısı kaydırmadan görünüyor, arama kutusunun ipucu kesilmiyor. Beklenmedik bir hatada artık sitenin kendi Türkçe ve İngilizce hata sayfası açılıyor.',
        en: 'On phones, the airport window’s “Airport page” link is visible without scrolling, and the search box hint is no longer cut off. Unexpected errors now show the site’s own error page in Turkish and English.',
      },
    ],
    tryLinks: [
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
      { path: '/istasyon/LGAV', label: { tr: 'Atina Havalimanı', en: 'Athens Airport' } },
      { path: '/?havalimani=LTFM', label: { tr: 'Haritada İstanbul', en: 'Istanbul on the map' } },
    ],
  },
  {
    version: '0.11.0',
    date: '2026-10-02',
    releasedAt: '2026-10-01T23:17:49Z',
    title: {
      tr: 'Havalimanlarında canlı hava durumu ve haritada havalimanı penceresi',
      en: 'Live airport weather and an airport window on the map',
    },
    items: [
      {
        tr: 'Her havalimanı sayfasında canlı hava durumu var: sıcaklık, rüzgâr (yön, hız ve hamle), görüş, bulut, nem ve basınç. Yağmur, kar, gök gürültüsü ve sis her zaman ayrı ayrı yazılır; belirlenemiyorsa “Belirlenemedi” denir. Gözlem saati, yerel saat, gün doğumu ve batımı ile önümüzdeki saatlerin tahmini de sade bir dille gösterilir. Veri aviationweather.gov’dan beş dakikada bir alınır.',
        en: 'Every airport page now shows live weather: temperature, wind (direction, speed and gusts), visibility, cloud, humidity and pressure. Rain, snow, thunderstorms and fog are always listed separately; if they cannot be determined, the page says so. The observation time, local time, sunrise and sunset, and a plain-language forecast for the coming hours are shown too. Data comes from aviationweather.gov every five minutes.',
      },
      {
        tr: 'METAR/TAF kaydı: havalimanı sayfasında son 24 saatte yayımlanan bütün METAR ve TAF raporları ham metni ve kısa bir özetiyle listelenir. Raporlar 30 gün saklanır.',
        en: 'METAR/TAF log: the airport page lists every METAR and TAF issued in the last 24 hours with its raw text and a short summary. Reports are kept for 30 days.',
      },
      {
        tr: 'Haritada havalimanları kırmızı bir iğneyle işaretleniyor; iğnenin ucu havalimanının tam yerini gösterir. İğneye ya da koda tıklayınca küçük bir pencere açılır: hava durumu, kodlar, rakım, pistler, yerel saat, gün doğumu ve batımı ile havalimanı sayfasının bağlantısı. Klavyeyle “Havalimanları” düğmesinden açılır.',
        en: 'Airports are marked on the map with a red pin whose tip shows the exact location. Clicking the pin or the code opens a small window with the weather, codes, elevation, runways, local time, sunrise and sunset, and a link to the airport page. Keyboard users can open it from the “Airports” button.',
      },
      {
        tr: 'Harita açılışta ve her yenilemede İstanbul Havalimanı’na ortalanıyor. Haritadaki yazılar biraz küçüldü.',
        en: 'The map now opens centred on Istanbul Airport, also after every reload. Map labels are slightly smaller.',
      },
      {
        tr: 'Sefer sayısı, rötar ve iptal bilgisi henüz yok; havalimanı sayfası bunu açıkça yazıyor. “Tarifeli sefer” ve “İzlenen istasyon” bilgileri sayfalardan kaldırıldı.',
        en: 'Flight counts, delays and cancellations are not available yet, and the airport page says so plainly. The “scheduled service” and “monitored station” details were removed from the pages.',
      },
    ],
    tryLinks: [
      {
        path: '/istasyon/LTFM',
        label: { tr: 'İstanbul Havalimanı hava durumu', en: 'Istanbul Airport weather' },
      },
      { path: '/', label: { tr: 'Canlı harita', en: 'Live map' } },
    ],
  },
  {
    version: '0.10.0',
    date: '2026-10-01',
    releasedAt: '2026-09-30T22:49:10Z',
    title: {
      tr: 'Havalimanı sayfaları ve İngilizce adresler',
      en: 'Airport pages and English addresses',
    },
    items: [
      {
        tr: 'Türkiye’deki 61 havalimanının listesi ve her biri için ayrı bir sayfa geldi: resmî adı, IATA ve ICAO kodları, il, rakım, havalimanı merkezinin koordinatları, pistler (uzunluk, genişlik, kaplama, yön) ve en yakın üç havalimanı. Sivil havalimanlarının resmî adları DHMİ’nin ve işletmecilerin güncel listelerinden alındı.',
        en: 'A list of the 61 airports in Türkiye, with a page for each: official name, IATA and ICAO codes, province, elevation, airport reference point coordinates, runways (length, width, surface, heading) and the three nearest airports. Official names of civil airports come from the current DHMİ and operator lists.',
      },
      {
        tr: 'Havalimanı sayfasındaki “Canlı haritada aç” bağlantısı haritayı o havalimanına ortalar. Havalimanı canlı veri kapsamının dışındaysa sayfa bunu açıkça söyler.',
        en: 'The “Open on the live map” link on an airport page centres the map on that airport. If the airport is outside live data coverage, the page says so clearly.',
      },
      {
        tr: 'Her sayfanın İngilizce sürümü artık kendi adresinde: örneğin /en/havalimanlari. Dil düğmesi aynı sayfanın diğer diline geçer ve paylaştığın bağlantı hep aynı dilde açılır.',
        en: 'Every page now has its English version at its own address, for example /en/havalimanlari. The language button switches to the same page in the other language, and a link you share always opens in the same language.',
      },
      {
        tr: 'Yeni “Hakkında” sayfası sitenin ne gösterip ne göstermediğini, veri kaynaklarını ve lisanslarını, gizlilik kurallarını ve verinin ne kadar taze olduğunu anlatıyor.',
        en: 'The new About page explains what the site does and does not show, the data sources and their licences, the privacy rules and how fresh the data is.',
      },
      {
        tr: 'Site arama motorlarında ve yapay zekâ yanıtlarında daha iyi bulunacak: site haritası, dil eşleştirmeleri, yapılandırılmış veri, paylaşım görselleri ve sitenin kısa bir özeti eklendi.',
        en: 'The site is now easier to find in search engines and AI answers: a sitemap, language alternates, structured data, share images and a short summary of the site were added.',
      },
    ],
    tryLinks: [
      { path: '/havalimanlari', label: { tr: 'Havalimanları', en: 'Airports' } },
      { path: '/istasyon/LTFM', label: { tr: 'İstanbul Havalimanı', en: 'Istanbul Airport' } },
      { path: '/hakkinda', label: { tr: 'Hakkında', en: 'About' } },
    ],
  },
  {
    version: '0.9.0',
    date: '2026-09-30',
    releasedAt: '2026-09-30T20:50:22Z',
    title: {
      tr: 'Ana sayfa artık canlı uçuş haritası',
      en: 'The home page is now a live flight map',
    },
    items: [
      {
        tr: 'Uçaklar uydu görüntüsü üzerinde, yönlerine dönük olarak görünüyor; yollar gösterilmiyor. Türk Hava Yolları uçakları kırmızı-beyaz, seçtiğin uçak turuncu. Türkiye’deki IATA kodlu havalimanları haritada kodlarıyla yer alıyor.',
        en: 'Aircraft appear on satellite imagery, pointing in their direction of travel; roads are not shown. Turkish Airlines aircraft are red and white, and the aircraft you select is amber. Airports in Türkiye with an IATA code are shown on the map with their codes.',
      },
      {
        tr: 'Her uçağın etiketinde önce sefer numarası (TK-974), altında hız ve yükseklik (km/sa, m) yazıyor. “Etiketler” düğmesiyle seçili uçak ve diğer uçaklar için Gizle, Kısa ya da Tam seçebilirsin; tercihin bu cihazda saklanır.',
        en: 'Each aircraft label shows the flight number first (TK-974), with speed and altitude (km/h, m) below it. With the “Labels” button you can choose Hide, Short or Full for the selected aircraft and for other aircraft; your choice is saved on this device.',
      },
      {
        tr: 'Uçağı sefer numarası, çağrı kodu, tescil ya da hex koduyla arayabilirsin; harita uçağa yakınlaşır ve bilgi kartı açılır. “Uçağı ortala” uçağı ekranın ortasında tutar, seçtiğin uçağın izi haritada kalır (yerdeki hareketi ayrı renkte). Adres çubuğundaki bağlantıyı paylaşırsan karşı taraf da aynı uçağı açar.',
        en: 'You can search for an aircraft by flight number, callsign, registration or hex code; the map zooms to it and its info card opens. “Centre on aircraft” keeps it in the middle of the screen, and the selected aircraft leaves a trail on the map (ground movement in a different colour). Share the link in the address bar and the other person opens the same aircraft.',
      },
      {
        tr: 'Haritanın yanında görünen uçakların listesi var (ekran okuyucularla da okunabilir). Üstteki durum şeridi verinin kaç saniyelik olduğunu, veri kaynağının durumunu ve bölgenin kapsama dışında olup olmadığını söylüyor. Canlı veri kaynağı, kaynağa bildirim yapıldıktan sonra açılacak; o zamana kadar haritada uçak görünmez ve şerit bunu açıkça yazar.',
        en: 'Next to the map there is a list of the aircraft in view (also readable with screen readers). The status strip at the top shows how many seconds old the data is, the status of the data source and whether the area is outside coverage. The live data source will be switched on after the provider has been notified; until then no aircraft appear on the map and the strip says so.',
      },
      {
        tr: 'Kullanım koşulları sayfası eklendi: hizmetin kapsamı, veri ve harita lisansları. Bu metin geçicidir; kapsamlı hâli sonraki sürümlerde gelecek.',
        en: 'A terms of use page has been added: what the service covers, and the data and map licences. This text is interim; the full version will come in a later release.',
      },
    ],
    tryLinks: [
      { path: '/', label: { tr: 'Canlı harita', en: 'Live map' } },
      { path: '/kullanim-kosullari', label: { tr: 'Kullanım koşulları', en: 'Terms of use' } },
    ],
  },
  {
    version: '0.8.0',
    date: '2026-09-29',
    releasedAt: '2026-09-28T21:32:45Z',
    title: {
      tr: 'Canlı uçuş verisi artık uygulamalara akıyor',
      en: 'Live flight data now flows to the apps',
    },
    items: [
      {
        tr: 'Harita ve mobil uygulama için canlı veri servisi hazır: görünen alandaki uçaklar anlık alınır, sonra her saniye yalnızca değişenler gönderilir. Bağlantı koparsa kaldığı yerden devam eder.',
        en: 'The live data service for the map and the mobile app is ready: aircraft in the visible area are fetched at once, then only changes are sent every second. If the connection drops, it resumes where it left off.',
      },
      {
        tr: 'Uçak sefer numarasıyla (TK-974), çağrı koduyla, tescille ya da hex koduyla aranabiliyor. Harfli çağrı kodu kullanan seferlerde sefer no eşleşmesi garanti değildir.',
        en: 'Aircraft can be searched by flight number (TK-974), callsign, registration or hex code. For flights using alphanumeric callsigns, flight-number matching is not guaranteed.',
      },
      {
        tr: 'Gizlilik: askeri uçaklar hiçbir yerde gösterilmiyor; gizlilik programındaki (PIA, LADD) uçakların tescili gizleniyor. Yönetici istediği uçağı listeden tamamen çıkarabiliyor.',
        en: 'Privacy: military aircraft are never shown, and the registration of aircraft in privacy programmes (PIA, LADD) is hidden. The administrator can remove any aircraft from all listings.',
      },
      {
        tr: 'Her yanıt verinin ne kadar taze olduğunu ve veri kaynağının durumunu söylüyor; bir bölge kapsama dışındaysa bu açıkça belirtiliyor.',
        en: 'Every response states how fresh the data is and the status of the data source; if an area is outside coverage, this is stated clearly.',
      },
    ],
  },
  {
    version: '0.7.1',
    date: '2026-09-28',
    releasedAt: '2026-09-28T19:49:31Z',
    title: {
      tr: 'Durum sayfasında taşan yazılar düzeltildi',
      en: 'Overflowing text on the status page fixed',
    },
    items: [
      {
        tr: 'Durum sayfasında derleme kimliği artık kutusundan taşmıyor; kısa hâli görünüyor, tamamı üzerine gelince okunuyor.',
        en: 'On the status page the build ID no longer spills out of its box; the short form is shown and the full ID appears on hover.',
      },
    ],
    tryLinks: [{ path: '/durum', label: { tr: 'Durum sayfası', en: 'Status page' } }],
  },
  {
    version: '0.7.0',
    date: '2026-09-28',
    releasedAt: '2026-09-28T06:58:50Z',
    title: {
      tr: 'Türkiye üzerindeki uçaklar sürekli izleniyor',
      en: 'Aircraft over Türkiye are tracked continuously',
    },
    items: [
      {
        tr: 'Türkiye semalarındaki uçakların konumunu düzenli aralıklarla toplayan ve her uçuşu ayrı bir kayıt olarak saklayan veri toplayıcı hazır; veri kaynağına bildirim yapıldıktan sonra açılacak. Hedef: İstanbul Havalimanı çevresinde en geç 20, diğer büyük havalimanlarında 30, doğu illerinde 90 saniyede bir taze veri. Harita bu veriyi sonraki sürümlerde gösterecek.',
        en: 'A data collector that gathers the positions of aircraft over Türkiye at regular intervals and stores each flight as its own record is ready; it will be switched on once the data source has been notified. Target: fresh data at least every 20 seconds around Istanbul Airport, every 30 seconds at the other major airports and every 90 seconds over eastern Türkiye. The map will show this data in upcoming versions.',
      },
      {
        tr: 'Havalimanlarının çevresinde uçuş izi tam çözünürlükle, diğer yerlerde 30 saniyede bir saklanıyor. Pistte ve apronda durup bekleyen uçak gereksiz kayıt üretmiyor.',
        en: 'Around airports, flight tracks are stored at full resolution; elsewhere, every 30 seconds. An aircraft standing still on the runway or apron does not create needless records.',
      },
      {
        tr: 'Veri kaynağı yavaşlarsa istek hızı kendiliğinden düşüyor, kaynak toparlanınca yeniden artıyor. Böylece kaynağın kurallarına uyuluyor ve veri kesilmeden akıyor.',
        en: 'If the data source slows down, the request rate drops on its own and rises again once the source recovers. This keeps us within the source’s rules and the data keeps flowing.',
      },
      {
        tr: 'Yükseklik ve hız varsayılan olarak metrik birimlerle (m, km/sa) gösterilecek; ayarlardan ft ve kt seçilebilecek. Uçak etiketleri sefer numarası, güzergâh, hız ve yükseklik ile ineceği pisti gösterecek ve açılıp kapatılabilecek.',
        en: 'Altitude and speed will be shown in metric units (m, km/h) by default, with ft and kt available in settings. Aircraft labels will show the flight number, route, speed and altitude, and the landing runway, and can be switched on and off.',
      },
    ],
    tryLinks: [{ path: '/durum', label: { tr: 'Yol haritası', en: 'Roadmap' } }],
  },
  {
    version: '0.6.0',
    date: '2026-09-27',
    releasedAt: '2026-09-27T09:24:58Z',
    title: {
      tr: 'Canlı uçuş verisinin altyapısı',
      en: 'Groundwork for live flight data',
    },
    items: [
      {
        tr: 'Canlı uçuş verisi kaynağı (ADSB.lol) ve ileride kurulabilecek kendi ADS-B alıcımız için bağlantılar hazır. Veri bir sonraki sürümde akmaya başlayacak.',
        en: 'Connections to the live flight data source (ADSB.lol) and to our own ADS-B receiver, should we set one up, are ready. Data will start flowing in the next version.',
      },
      {
        tr: 'Gelen veri temizleniyor: konumu olmayan, bir dakikadan eski ya da imkânsız hız ve tırmanış değerleri taşıyan kayıtlar kullanılmıyor.',
        en: 'Incoming data is cleaned: records with no position, older than a minute, or with impossible speed or climb values are not used.',
      },
      {
        tr: 'Gizlilik kuralları uygulanıyor: askeri uçaklar varsayılan olarak gösterilmeyecek; gizlilik programındaki (PIA, LADD) uçakların tescili gizlenecek.',
        en: 'Privacy rules are in place: military aircraft will be hidden by default, and the registration of aircraft in privacy programmes (PIA, LADD) will be hidden.',
      },
      {
        tr: 'Onaylanan her değişiklik artık birleştiği anda, elle müdahale gerekmeden yayına çıkıyor.',
        en: 'Every approved change now goes live on its own once it is merged, with no manual step.',
      },
    ],
  },
  {
    version: '0.5.2',
    date: '2026-09-27',
    releasedAt: '2026-09-27T08:30:24Z',
    title: {
      tr: 'Onaylanan her değişiklik kendiliğinden yayında',
      en: 'Every approved change goes live on its own',
    },
    items: [
      {
        tr: 'Yeni sürüm hazırlanır hazırlanmaz Dokploy’un otomatik yayını tetikleniyor; önceki sürümün yanlışlıkla yeniden yayınlanması bitti. Yayından sonra sitenin yeni sürümle açıldığı yine kontrol ediliyor.',
        en: 'Dokploy’s automatic deploy now starts as soon as the new version is ready, so the previous version is no longer redeployed by mistake. After each release the site is still checked to be running the new version.',
      },
    ],
  },
  {
    version: '0.5.1',
    date: '2026-09-27',
    releasedAt: '2026-09-27T07:59:22Z',
    title: {
      tr: 'Yönetici anahtarı kuralı ve daha dayanıklı sunucu',
      en: 'Admin key rule and a sturdier server',
    },
    items: [
      {
        tr: 'Yönetici giriş anahtarı artık en az 12 karakter olabilir (önceden 32); 16 ve üzeri önerilir.',
        en: 'The admin sign-in key can now be as short as 12 characters (previously 32); 16 or more is recommended.',
      },
      {
        tr: 'Yönetici ayarı hatalı girildiğinde site artık kapanmıyor: yalnızca yönetici girişi kapanıyor ve nedeni sunucu kaydına yazılıyor.',
        en: 'A wrong admin setting no longer takes the site down: only admin sign-in is turned off, and the reason is written to the server log.',
      },
    ],
  },
  {
    version: '0.5.0',
    date: '2026-09-27',
    releasedAt: '2026-09-27T07:37:53Z',
    title: {
      tr: 'Havalimanı, pist ve havayolu verisi',
      en: 'Airport, runway and airline data',
    },
    items: [
      {
        tr: 'Türkiye’deki ve dünyadaki büyük ve orta havalimanlarının, tarifeli sefer alan diğer alanların konumları ve pistleri artık sistemde. Pist eşikleri, kaydırılmış eşikler dahil hesaplanıyor; yaklaşma ve iniş bildirimleri bu verinin üstüne kurulacak.',
        en: 'Locations and runways of large and medium airports, and of other airfields with scheduled service, in Türkiye and worldwide are now in the system. Runway thresholds are calculated, displaced thresholds included; approach and landing alerts will be built on this data.',
      },
      {
        tr: 'Kaynak veride yanlış yazılmış pist yönleri pist uçlarının koordinatlarından düzeltiliyor. Örneğin İstanbul Havalimanı’ndaki dört pistin yönü kayıtta 5° kaymış.',
        en: 'Runway headings recorded wrongly in the source data are corrected from the coordinates of the runway ends. For example, four runways at Istanbul Airport are off by 5° in the record.',
      },
      {
        tr: 'Havayolu listesi, AJet dahil güncel ICAO ve IATA kodlarıyla, sefer numarasıyla arama için hazır.',
        en: 'The airline list, with current ICAO and IATA codes including AJet, is ready for flight number search.',
      },
      {
        tr: 'Veriler her gün kendiliğinden güncelleniyor ve yalnızca değişen kayıtlar yazılıyor. Kaynak bozuk ya da yarım gelirse eldeki veri korunuyor.',
        en: 'The data updates itself every day and only changed records are written. If a source arrives broken or incomplete, the existing data is kept.',
      },
      {
        tr: 'Uçuş izlerinin saklanacağı yer hazır: 30 saniyelik iz 7 gün, tam çözünürlüklü iz 30 gün tutulacak. Süresi dolan günler her gece kendiliğinden siliniyor.',
        en: 'Storage for flight tracks is ready: the 30-second track will be kept for 7 days and the full-resolution track for 30 days. Expired days are deleted automatically every night.',
      },
      {
        tr: 'Yönetim panelindeki Servisler sayfası artık referans verisinin ve iz tablolarının durumunu da gösteriyor.',
        en: 'The Services page in the admin panel now also shows the status of the reference data and the track tables.',
      },
      {
        tr: 'Yönetim panelinin adresi doğrudan açıldığında hata veriyordu; artık giriş sayfasına yönlendiriyor.',
        en: 'Opening the admin panel address directly showed an error; it now redirects to the sign-in page.',
      },
      {
        tr: 'Her sürüm artık GitHub’daki Releases bölümünde de sürüm notlarıyla yayımlanıyor; önceki sürümler de eklendi.',
        en: 'Every version is now also published with its release notes under Releases on GitHub; earlier versions were added too.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-09-27',
    releasedAt: '2026-09-27T05:45:46Z',
    title: {
      tr: 'Otomatik ve doğrulanan yayın hattı',
      en: 'Automatic, verified release pipeline',
    },
    items: [
      {
        tr: 'Onaylanan her değişiklik testlerden geçtikten sonra kendiliğinden yayına çıkacak: uygulama derlenir, sunucuya gönderilir ve yeni sürümün gerçekten açıldığı kontrol edilir. Açılmazsa yayın başarısız sayılır ve haber verilir.',
        en: 'Every approved change will go live on its own once the tests pass: the app is built, sent to the server, and the new version is checked to be actually running. If it is not, the release is marked failed and reported.',
      },
      {
        tr: 'Bir sorun olursa önceki sürüme tek komutla dönülebiliyor; veriler korunuyor.',
        en: 'If something goes wrong, the previous version can be restored with a single command; data is kept.',
      },
      {
        tr: 'Sunucu kurulum rehberi hazır. Kurulum tamamlanınca site yayına açılacak.',
        en: 'The server setup guide is ready. The site goes live once the setup is done.',
      },
    ],
  },
  {
    version: '0.3.2',
    date: '2026-09-25',
    releasedAt: '2026-09-25T18:19:24Z',
    title: {
      tr: 'Daha güvenli giriş, daha sağlam sunucu, açık kaynak',
      en: 'Safer sign-in, sturdier server, open source',
    },
    items: [
      {
        tr: 'Yönetici girişi artık başka birinin yanlış denemeleriyle kilitlenemiyor: deneme sınırı herkes için ayrı tutuluyor. Durum sayfası çok ziyaret edildiğinde sunucu diğer kullanıcılara kapanmıyor.',
        en: "Admin sign-in can no longer be locked by someone else's failed attempts: the attempt limit is kept per visitor. The server no longer shuts out other users when the status page gets heavy traffic.",
      },
      {
        tr: 'Sunucu, geçici bir önbellek kesintisinde de çalışmaya devam ediyor; ilk kurulumda veritabanı hazır olmadan başlamıyor.',
        en: 'The server keeps running through a brief cache outage and no longer starts before the database is ready on first setup.',
      },
      {
        tr: 'Yönetim panelinde dil değiştirme düğmesi düzeldi.',
        en: 'The language switch now works in the admin panel.',
      },
      {
        tr: 'Kaynak kodu herkese açık ve MIT lisanslı. Sayfa kaynağında sahiplik ve lisans bildirimi yer alıyor; sitenin adı ve logosu lisans kapsamı dışında, hakları saklı.',
        en: 'The source code is public under the MIT License. The page source carries an ownership and license notice; the site’s name and logo are outside the license, rights reserved.',
      },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-09-25',
    releasedAt: '2026-09-25T18:19:09Z',
    title: {
      tr: 'Sitenin adı ve adresi belirlendi',
      en: 'The site’s name and address are set',
    },
    items: [
      {
        tr: 'Uygulamanın adı ve alan adı belirlendi. Web sitesi, yönetim paneli, sunucu ve analiz paneli bu alan adının altında yayına alınacak.',
        en: 'The app’s name and domain are set. The website, the admin panel, the server and the analytics panel will go live under this domain.',
      },
      {
        tr: 'Adresin www ile başlayan biçimine gelen ziyaretçiler otomatik olarak sitenin ana adresine yönlendirilir.',
        en: 'Visitors to the www address are redirected to the site’s main address automatically.',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-09-25',
    releasedAt: '2026-09-25T18:18:53Z',
    title: {
      tr: 'Bütün servisler, yönetim paneli ve onaylı ziyaret analizi',
      en: 'All services, admin panel and consent-based visit analytics',
    },
    items: [
      {
        tr: 'Uygulamanın bütün parçaları hazır: web, sunucu (API), iki arka plan çalışanı, veritabanı ve iki önbellek. Sunucuya tek seferde kurulacak şekilde paketlendi; aynı kurulum bilgisayarda birebir çalıştırılıp denendi.',
        en: 'Every part of the app is ready: web, server (API), two background workers, the database and two caches. They are packaged to be set up on the server in one go, and the same setup was run and tested on a computer.',
      },
      {
        tr: 'Yönetim paneli: kendi alan adında açılır, yönetici girişiyle korunur. Servisler ekranı her servisin durumunu, sürümünü, gecikmesini, bellek kullanımını ve arka plan çalışanlarının son sinyalini gösterir.',
        en: 'Admin panel: it opens on its own domain and is protected by admin sign-in. The Services screen shows the status, version, latency and memory use of each service, and the last signal from the background workers.',
      },
      {
        tr: 'Kendi analiz uygulamamız (Siteni Analiz Et) bağlandı; analiz paneline de aynı yönetici hesabıyla girilir.',
        en: 'Our own analytics app (Siteni Analiz Et) is connected; its panel uses the same admin account.',
      },
      {
        tr: 'Ziyaret istatistikleri yalnızca onay verirsen ölçülür. Kararını sayfanın altındaki “Analiz tercihleri” ile istediğin zaman değiştirebilirsin.',
        en: 'Visit statistics are measured only if you consent. You can change your choice at any time with “Analytics preferences” at the bottom of the page.',
      },
      {
        tr: 'Güvenlik: güvenlik başlıkları, istek sınırları ve deneme sınırlı yönetici girişi. Oturum anahtarları sunucuda açık hâliyle tutulmaz.',
        en: 'Security: security headers, request limits and rate-limited admin sign-in. Session keys are never stored in plain form on the server.',
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-09-25',
    releasedAt: '2026-09-25T18:16:07Z',
    title: {
      tr: 'İlk yerel test ortamı: Durum ve Yenilikler sayfaları',
      en: 'First local test environment: Status and What’s new pages',
    },
    items: [
      {
        tr: 'Uygulama artık bilgisayarında tek komutla (pnpm dev) açılıyor. Deploy’u beklemeden her değişikliği yerelde görebilirsin.',
        en: 'The app now starts on your computer with a single command (pnpm dev), so you can see every change locally without waiting for a deploy.',
      },
      {
        tr: 'Durum sayfası: uygulama sürümü, sunucu (API) bağlantısı ve yol haritasındaki ilerleme tek ekranda.',
        en: 'Status page: app version, server (API) connection and roadmap progress on one screen.',
      },
      {
        tr: 'Yenilikler sayfası: her sürümde neler geldiği ve o sürümde deneyebileceğin sayfalara doğrudan bağlantılar.',
        en: 'What’s new page: what arrived in each version, with direct links to the pages you can try in that version.',
      },
      {
        tr: 'Türkçe ve İngilizce arasında tek tıkla geçiş. Seçimin hatırlanır.',
        en: 'One-click switch between Turkish and English. Your choice is remembered.',
      },
      {
        tr: 'Açık ve koyu tema, sistem ayarına otomatik uyar.',
        en: 'Light and dark themes follow your system setting automatically.',
      },
      {
        tr: 'Proje kodu MIT lisansıyla yayımlandı. Uçuş verisi kendi lisansında (ADSB.lol, ODbL) kalıyor.',
        en: 'The project code is released under the MIT license. Flight data keeps its own license (ADSB.lol, ODbL).',
      },
    ],
    tryLinks: [
      { path: '/durum', label: { tr: 'Durum sayfası', en: 'Status page' } },
      { path: '/yenilikler', label: { tr: 'Yenilikler sayfası', en: 'What’s new page' } },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-09-25',
    releasedAt: '2026-09-25T15:07:08Z',
    title: {
      tr: 'Proje kuruldu ve yol haritası netleşti',
      en: 'Project set up and roadmap defined',
    },
    items: [
      {
        tr: 'Uçuş verisinin nereden geleceği belirlendi: canlı konumlar ADSB.lol’den (ücretsiz, ticari kullanıma açık), havalimanı ve pist bilgisi OurAirports’tan, havayolu ve rota tahmini VRS standing-data’dan, hava durumu NOAA’dan.',
        en: 'Data sources chosen: live positions from ADSB.lol (free, commercial use allowed), airports and runways from OurAirports, airlines and estimated routes from VRS standing-data, weather from NOAA.',
      },
      {
        tr: 'Bütün veri kaynakları ve lisansları 2026-09-25 itibarıyla tek tek doğrulandı. Ticari kullanıma izin vermeyen kaynaklar ve Flightradar24’ün resmi API’si kapsam dışı bırakıldı.',
        en: 'Every data source and its license was verified as of 2026-09-25. Sources that forbid commercial use, and the official Flightradar24 API, are excluded.',
      },
      {
        tr: 'Yayın düzeni tasarlandı: GitHub’a gönderilen kod otomatik test edilir, sonra Dokploy üzerinden yayına alınır.',
        en: 'Release pipeline designed: code pushed to GitHub is tested automatically, then deployed through Dokploy.',
      },
      {
        tr: 'Geliştirme 5 parçaya ve kilometre taşlarına bölündü. İlk hedefler sırasıyla canlı harita, “uçağım istasyona 10 km yaklaştı” ve “indi” bildiriminin telefonuna gelmesi, ardından mobil uygulama.',
        en: 'Development split into 5 parts with milestones. First goals, in order: the live map, then the “my aircraft is 10 km from the station” and “landed” alerts reaching your phone, then the mobile app.',
      },
      {
        tr: 'Bilinen sınır açıkça yazıldı: kendi ADS-B alıcımız olmadığı için inişler çoğu zaman “muhtemelen indi (tahmini saat)” olarak bildirilecek.',
        en: 'Known limitation stated up front: without our own ADS-B receiver, landings will often be reported as “probably landed (estimated time)”.',
      },
    ],
  },
]
