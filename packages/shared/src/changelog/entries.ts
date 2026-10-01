import type { ChangelogEntry } from './types'

/**
 * Kullanıcıya dönük sürüm notlarının TEK kaynağı. En yeni sürüm en üsttedir.
 * `pnpm changelog` bu listeden CHANGELOG.md üretir; web'deki /yenilikler sayfası da buradan okur.
 * Maddeler teknik ayrıntı değil, kullanıcının ne kazandığını anlatır.
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '0.11.0',
    date: '2026-10-02',
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
    date: '2026-09-29',
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
        tr: 'Yönetim panelindeki Servisler sayfası (admin.havayolu.live) artık referans verisinin ve iz tablolarının durumunu da gösteriyor.',
        en: 'The Services page in the admin panel (admin.havayolu.live) now also shows the status of the reference data and the track tables.',
      },
      {
        tr: 'Yönetim panelinin adresi (admin.havayolu.live) doğrudan açıldığında hata veriyordu; artık giriş sayfasına yönlendiriyor.',
        en: 'Opening the admin panel address (admin.havayolu.live) directly showed an error; it now redirects to the sign-in page.',
      },
      {
        tr: 'Her sürüm artık GitHub’daki Releases bölümünde de sürüm notlarıyla yayımlanıyor; önceki sürümler de eklendi.',
        en: 'Every version is now also published with its release notes under Releases on GitHub; earlier versions were added too.',
      },
    ],
  },
  {
    version: '0.4.0',
    date: '2026-09-26',
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
        tr: 'Sunucu kurulum rehberi hazır. Kurulum tamamlanınca havayolu.live yayına açılacak.',
        en: 'The server setup guide is ready. havayolu.live goes live once the setup is done.',
      },
    ],
  },
  {
    version: '0.3.2',
    date: '2026-09-25',
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
        tr: 'Kaynak kodu herkese açık ve MIT lisanslı. Sayfa kaynağında sahiplik ve lisans bildirimi yer alıyor; havayolu adı ve logosu lisans kapsamı dışında, hakları saklı.',
        en: 'The source code is public under the MIT License. The page source carries an ownership and license notice; the havayolu name and logo are outside the license, rights reserved.',
      },
    ],
  },
  {
    version: '0.3.1',
    date: '2026-09-25',
    title: {
      tr: 'Yeni adımız havayolu, adresimiz havayolu.live',
      en: 'Our new name is havayolu, at havayolu.live',
    },
    items: [
      {
        tr: 'Uygulamanın adı havayolu oldu. Web sitesi havayolu.live, yönetim paneli admin.havayolu.live, sunucu api.havayolu.live, analiz paneli analiz.havayolu.live adresinde yayına alınacak.',
        en: 'The app is now called havayolu. The website will go live at havayolu.live, the admin panel at admin.havayolu.live, the server at api.havayolu.live and the analytics panel at analiz.havayolu.live.',
      },
      {
        tr: 'www.havayolu.live adresine gelen ziyaretçiler otomatik olarak havayolu.live adresine yönlendirilir.',
        en: 'Visitors to www.havayolu.live are redirected to havayolu.live automatically.',
      },
    ],
  },
  {
    version: '0.3.0',
    date: '2026-09-25',
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
