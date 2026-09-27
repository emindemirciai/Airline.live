# Yenilikler / Changelog

> Bu dosya `packages/shared/src/changelog/entries.ts` kaynağından `pnpm changelog` ile üretilir; elle düzenleme.
> Aynı içerik uygulamada **Yenilikler** (`/yenilikler`) sayfasında görünür.
>
> *Generated from `packages/shared/src/changelog/entries.ts` by `pnpm changelog`; do not edit by hand.*
> *The same content appears in the app’s **What’s new** (`/yenilikler`) page.*

---

## v0.4.0 — 2026-09-26

### Türkçe
**Otomatik ve doğrulanan yayın hattı**

- Onaylanan her değişiklik testlerden geçtikten sonra kendiliğinden yayına çıkacak: uygulama derlenir, sunucuya gönderilir ve yeni sürümün gerçekten açıldığı kontrol edilir. Açılmazsa yayın başarısız sayılır ve haber verilir.
- Bir sorun olursa önceki sürüme tek komutla dönülebiliyor; veriler korunuyor.
- Sunucu kurulum rehberi hazır. Kurulum tamamlanınca havayolu.live yayına açılacak.

### English
**Automatic, verified release pipeline**

- Every approved change will go live on its own once the tests pass: the app is built, sent to the server, and the new version is checked to be actually running. If it is not, the release is marked failed and reported.
- If something goes wrong, the previous version can be restored with a single command; data is kept.
- The server setup guide is ready. havayolu.live goes live once the setup is done.

---

## v0.3.2 — 2026-09-25

### Türkçe
**Daha güvenli giriş, daha sağlam sunucu, açık kaynak**

- Yönetici girişi artık başka birinin yanlış denemeleriyle kilitlenemiyor: deneme sınırı herkes için ayrı tutuluyor. Durum sayfası çok ziyaret edildiğinde sunucu diğer kullanıcılara kapanmıyor.
- Sunucu, geçici bir önbellek kesintisinde de çalışmaya devam ediyor; ilk kurulumda veritabanı hazır olmadan başlamıyor.
- Yönetim panelinde dil değiştirme düğmesi düzeldi.
- Kaynak kodu herkese açık ve MIT lisanslı. Sayfa kaynağında sahiplik ve lisans bildirimi yer alıyor; havayolu adı ve logosu lisans kapsamı dışında, hakları saklı.

### English
**Safer sign-in, sturdier server, open source**

- Admin sign-in can no longer be locked by someone else's failed attempts: the attempt limit is kept per visitor. The server no longer shuts out other users when the status page gets heavy traffic.
- The server keeps running through a brief cache outage and no longer starts before the database is ready on first setup.
- The language switch now works in the admin panel.
- The source code is public under the MIT License. The page source carries an ownership and license notice; the havayolu name and logo are outside the license, rights reserved.

---

## v0.3.1 — 2026-09-25

### Türkçe
**Yeni adımız havayolu, adresimiz havayolu.live**

- Uygulamanın adı havayolu oldu. Web sitesi havayolu.live, yönetim paneli admin.havayolu.live, sunucu api.havayolu.live, analiz paneli analiz.havayolu.live adresinde yayına alınacak.
- www.havayolu.live adresine gelen ziyaretçiler otomatik olarak havayolu.live adresine yönlendirilir.

### English
**Our new name is havayolu, at havayolu.live**

- The app is now called havayolu. The website will go live at havayolu.live, the admin panel at admin.havayolu.live, the server at api.havayolu.live and the analytics panel at analiz.havayolu.live.
- Visitors to www.havayolu.live are redirected to havayolu.live automatically.

---

## v0.3.0 — 2026-09-25

### Türkçe
**Bütün servisler, yönetim paneli ve onaylı ziyaret analizi**

- Uygulamanın bütün parçaları hazır: web, sunucu (API), iki arka plan çalışanı, veritabanı ve iki önbellek. Sunucuya tek seferde kurulacak şekilde paketlendi; aynı kurulum bilgisayarda birebir çalıştırılıp denendi.
- Yönetim paneli: kendi alan adında açılır, yönetici girişiyle korunur. Servisler ekranı her servisin durumunu, sürümünü, gecikmesini, bellek kullanımını ve arka plan çalışanlarının son sinyalini gösterir.
- Kendi analiz uygulamamız (Siteni Analiz Et) bağlandı; analiz paneline de aynı yönetici hesabıyla girilir.
- Ziyaret istatistikleri yalnızca onay verirsen ölçülür. Kararını sayfanın altındaki “Analiz tercihleri” ile istediğin zaman değiştirebilirsin.
- Güvenlik: güvenlik başlıkları, istek sınırları ve deneme sınırlı yönetici girişi. Oturum anahtarları sunucuda açık hâliyle tutulmaz.

### English
**All services, admin panel and consent-based visit analytics**

- Every part of the app is ready: web, server (API), two background workers, the database and two caches. They are packaged to be set up on the server in one go, and the same setup was run and tested on a computer.
- Admin panel: it opens on its own domain and is protected by admin sign-in. The Services screen shows the status, version, latency and memory use of each service, and the last signal from the background workers.
- Our own analytics app (Siteni Analiz Et) is connected; its panel uses the same admin account.
- Visit statistics are measured only if you consent. You can change your choice at any time with “Analytics preferences” at the bottom of the page.
- Security: security headers, request limits and rate-limited admin sign-in. Session keys are never stored in plain form on the server.

---

## v0.2.0 — 2026-09-25

### Türkçe
**İlk yerel test ortamı: Durum ve Yenilikler sayfaları**

- Uygulama artık bilgisayarında tek komutla (pnpm dev) açılıyor. Deploy’u beklemeden her değişikliği yerelde görebilirsin.
- Durum sayfası: uygulama sürümü, sunucu (API) bağlantısı ve yol haritasındaki ilerleme tek ekranda.
- Yenilikler sayfası: her sürümde neler geldiği ve o sürümde deneyebileceğin sayfalara doğrudan bağlantılar.
- Türkçe ve İngilizce arasında tek tıkla geçiş. Seçimin hatırlanır.
- Açık ve koyu tema, sistem ayarına otomatik uyar.
- Proje kodu MIT lisansıyla yayımlandı. Uçuş verisi kendi lisansında (ADSB.lol, ODbL) kalıyor.

Dene: [Durum sayfası](/durum) · [Yenilikler sayfası](/yenilikler)

### English
**First local test environment: Status and What’s new pages**

- The app now starts on your computer with a single command (pnpm dev), so you can see every change locally without waiting for a deploy.
- Status page: app version, server (API) connection and roadmap progress on one screen.
- What’s new page: what arrived in each version, with direct links to the pages you can try in that version.
- One-click switch between Turkish and English. Your choice is remembered.
- Light and dark themes follow your system setting automatically.
- The project code is released under the MIT license. Flight data keeps its own license (ADSB.lol, ODbL).

Try it: [Status page](/durum) · [What’s new page](/yenilikler)

---

## v0.1.0 — 2026-09-25

### Türkçe
**Proje kuruldu ve yol haritası netleşti**

- Uçuş verisinin nereden geleceği belirlendi: canlı konumlar ADSB.lol’den (ücretsiz, ticari kullanıma açık), havalimanı ve pist bilgisi OurAirports’tan, havayolu ve rota tahmini VRS standing-data’dan, hava durumu NOAA’dan.
- Bütün veri kaynakları ve lisansları 2026-09-25 itibarıyla tek tek doğrulandı. Ticari kullanıma izin vermeyen kaynaklar ve Flightradar24’ün resmi API’si kapsam dışı bırakıldı.
- Yayın düzeni tasarlandı: GitHub’a gönderilen kod otomatik test edilir, sonra Dokploy üzerinden yayına alınır.
- Geliştirme 5 parçaya ve kilometre taşlarına bölündü. İlk hedefler sırasıyla canlı harita, “uçağım istasyona 10 km yaklaştı” ve “indi” bildiriminin telefonuna gelmesi, ardından mobil uygulama.
- Bilinen sınır açıkça yazıldı: kendi ADS-B alıcımız olmadığı için inişler çoğu zaman “muhtemelen indi (tahmini saat)” olarak bildirilecek.

### English
**Project set up and roadmap defined**

- Data sources chosen: live positions from ADSB.lol (free, commercial use allowed), airports and runways from OurAirports, airlines and estimated routes from VRS standing-data, weather from NOAA.
- Every data source and its license was verified as of 2026-09-25. Sources that forbid commercial use, and the official Flightradar24 API, are excluded.
- Release pipeline designed: code pushed to GitHub is tested automatically, then deployed through Dokploy.
- Development split into 5 parts with milestones. First goals, in order: the live map, then the “my aircraft is 10 km from the station” and “landed” alerts reaching your phone, then the mobile app.
- Known limitation stated up front: without our own ADS-B receiver, landings will often be reported as “probably landed (estimated time)”.

