# Kararlar

Her karar tarih, gerekçe ve varsa alternatifiyle yazılır. En yeni karar en üsttedir.

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
- **D-050 Dil tercihi M0'da çerezle tutulur.** URL tabanlı `/en/...` yönlendirmesi Parça 3 M2'de gelir.

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
