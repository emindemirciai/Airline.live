import type { ChangelogEntry } from './types'

/**
 * Kullanıcıya dönük sürüm notlarının TEK kaynağı. En yeni sürüm en üsttedir.
 * `pnpm changelog` bu listeden CHANGELOG.md üretir; web'deki /yenilikler sayfası da buradan okur.
 * Maddeler teknik ayrıntı değil, kullanıcının ne kazandığını anlatır.
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
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
