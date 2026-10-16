# Veri kaynakları — doğrulanmış ayrıntılar

Doğrulama tarihi: **2026-09-25**. Canlı istekler ve kaynak kodu/doküman okumasıyla doğrulandı; ham notlar `docs/research/` altındadır. Buradaki bir bilgi gerçekle çelişirse DUR-SOR: önce yeniden doğrula, sonra bu dosyayı güncelle.

## Lisans kaydı
`packages/providers` içindeki her sağlayıcı şu 7 alanı taşır:
- `commercialUse`
- `attribution`
- `shareAlike`
- `rateLimit`
- `b2cDisplayAllowed`
- `mixingWithOtherRealtimeAllowed`
- `maxRawStorageDays`

`DATA_USAGE_MODE=commercial` iken `commercialUse:false` olan bir sağlayıcı başlatılamaz.

## 1. adsb.lol — tek canlı kaynak

**Erişim ve şartlar**
- **Anahtar:** Şu an anahtarsızdır. Şartlarda şu yazar: "In the future, you will require an API key which you can get by feeding to adsb.lol". Opsiyonel `ADSBLOL_API_KEY` ve `ADSBLOL_API_KEY_HEADER` env'leri şimdiden desteklenir.
- **İletişim:** Şartlar, üretimde kullanmadan önce işletmeciyle iletişime geçilmesini istiyor ("please contact me so I do not break your application"). Adres: info@adsb.lol. Bu, üretim ingest'inden (Parça 1 M4 yayını) önce yapılacak bir ACTIVATION adımıdır.
- **User-Agent zorunludur.** Boş UA ve Node'un varsayılan `node` UA'sı HTTP 403 ("User-Agent too generic") alır.
  - Biçim: `Airline.live/<sürüm> (+https://airline.live; <CONTACT_EMAIL>)` (`APP_NAME` ve `WEB_HOST` env'lerinden; D-112). `APP_NAME` RFC 9110 token'ıdır (boşluk yok; worker başka adı reddeder); `.` token karakteridir.
  - `WEB_HOST` boşsa (yerel): `Airline.live/<sürüm> (+mailto:<CONTACT_EMAIL>)`.
  - `CONTACT_EMAIL` boşsa ingest başlamaz.
- **CORS yoktur:** Tarayıcı ve mobil istemci doğrudan çağıramaz; yalnızca worker çağırır. Sunucusuz çıkışların (Cloudflare Workers) ilk istekte 429 aldığı raporlandı (işletmeci doğrulamadı); kullanılmaz.
- **SLA yoktur** ("as is"). Durum sayfası: https://status.adsb.lol

**Lisans: ODbL 1.0** (ticari kullanıma izin verir)
- **Atıf** harita, uçuş sayfası, mobil "Veri kaynakları" ekranı ve ATTRIBUTION.md'de yer alır: "Canlı uçuş verisi: [ADSB.lol](https://adsb.lol) — [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)". Bağlantılar zorunludur.
- **Türetilmiş veritabanı:** Saklanan konum ve iz tabloları *Derivative Database*'tir. Herkese açık kullanıldıkları için ODbL altında kalırlar. v1'de `/acik-veri` sayfası, md. 4.6(b) uyarınca türetme yöntemini anlatan makine okunur belgeyi ücretsiz sunar: filtreler, örnekleme, saklama, olay kuralları. Günlük döküm v1'de yoktur.
- **Ayrı tutulan veri:** Kullanıcı, takip ve fatura tabloları ayrı şemadadır ve hiçbir dökümde yer almaz (*Collective Database*, md. 4.5a).
- **Kullanım koşulları:** Koşullarımız ADS-B türevi verinin yeniden kullanımını yasaklayamaz (md. 4.7). Ücret veriye değil özelliklere alınır.

**Uç noktalar** (şema: `https://api.adsb.lol/api/openapi.json`; `/docs` JS ile oluşur, okunamaz)
- `GET /v2/point/{lat}/{lon}/{radius}`: radius **NM** cinsinden, tamsayı, en fazla **250**. Yanıt `dst` (NM) ve `dir` (derece) alanlarını da içerir.
- `GET /v2/hex/{h1,h2,...}`: çoklu değer çalışır. Çağrı başına en fazla 500 hex, URL ≤ 4 KB.
- `GET /v2/callsign/{cs1,cs2}` ve `GET /v2/reg/{reg}` çoklu değer destekler. `/v2/type/{t}` ve `/v2/sqk/{s}` de vardır.
- `/v2/mil`, `/v2/ladd` ve `/v2/pia` tüm dünyayı döndürür; zamanlanmış çekimde kullanılmaz. `/v2/all` kapalıdır (503).
- Değerlerde yalnızca `a-zA-Z0-9,=_.-` karakterlerine izin verilir.
- **Kullanılmaz:**
  - `POST /api/0/routeset`: Referer kontrolü yapar; üçüncü tarafa 201 + boş gövde döner.
  - Gizli `GET /api/0/route/...`: önbellekte olmayan çağrı kodlarında 500 döner ve verilen konumu yok sayar.

**Hız limiti** (belgelenmemiş, "dinamik"; 2026-09-25 ölçümleri)
- **Gözlem:**
  - 429 yanıtı nginx HTML gövdesiyle gelir ve **Retry-After taşımaz**; RateLimit-* başlığı da yoktur.
  - Bir kez gövdesiz 420 görüldü (doğrulanamadı); 420 de 429 gibi ele alınır.
  - 10 sn'de bir istekte bile 429 görüldü. Güvenli varsayım: tek IP'den **10 sn'de bir istek ya da daha yavaş**.
  - VPS'in veri merkezi IP'si ölçülmedi; daha sert sınırlanabilir.
- **Hız kontrolü (AIMD):**
  - Başlangıç `ADSBLOL_RPS=0.1`, alt sınır 0,05, üst sınır 0,2. Üst sınır ancak VPS'ten yapılan 24 saatlik ölçümde 429 oranı %5'in altındaysa ve DECISIONS kaydıyla yükseltilir.
  - 429 ya da 420 gelince hız yarıya iner ve tam jitter'lı üstel bekleme uygulanır (15 → 30 → 60 … en fazla 300 sn). `Retry-After` yalnızca varsa kullanılır.
  - Temiz geçen her 10 dk'da hız %10 artar.
  - 5xx'te jitter'lı geri çekilme ve devre kesici devreye girer.
  - **401/403 kısıtlama değildir; politika ya da yapılandırma hatasıdır.** Devre açılır, döngüde yeniden denenmez, ADMIN_EMAIL'e uyarı gider → RUNBOOK "adsb.lol API anahtarı istemeye başladı (401/403)".
- **Yanıt işleme:** Hata gövdesi HTML ya da düz metin olabilir. JSON ayrıştırmadan önce durum kodu kontrol edilir.
- **Canlı araçlar (M7a, D-094):** `pnpm smoke:live` (gerçek ingest, 5 dk) ve `pnpm record` (tek istasyonun `/v2/point` kareleri, en çok 60 dk) geliştirici denetimleridir.
  - **Kim çalıştırır:** yalnızca kullanıcı, kendi terminalinde, `--confirm` ile ve ara sıra. Ajan oturumunda, CI'da ve kabukta `EXTERNAL_PROVIDERS_DISABLED=true` iken canlı istek atmazlar. Önce 1. ACTIVATION adımı (info@adsb.lol) yapılır.
  - **Aynı kurallar:** istemci worker'ınkidir (`createAdsbLolClient`). Hız kovası `AdaptiveRateController`'dır (başlangıç `ADSBLOL_RPS`, en çok 0,2 istek/sn); smoke'ta ingest'in kendi kovası çalışır. 429/420, 5xx ve 401/403 kuralları yukarıdaki gibidir; 401/403'te araç hemen durur.
  - **Ek bekçi:** yalnızca `GET /v2/point/...`, yönlendirme izlenmez, User-Agent zorunludur. İki isteğin başlangıcı arası en az 5 sn'dir (250 ms saat payıyla). İhlal aracı durdurur.
  - **User-Agent:** ürün adı ve iletişim adresi üretimdekiyle aynıdır. Kullanıcının `.env`'indeki `WEB_HOST` genel bir host ise duyurulan biçim kullanılır (`(+https://<host>; <CONTACT_EMAIL>)`); yerelse `(+mailto:<CONTACT_EMAIL>)` gider.
  - **İkinci IP:** bu denetimler kullanıcının ev bağlantısından, yani VPS'ten farklı ikinci bir IP'den gelebilir (≤ 0,2 istek/sn, smoke 5 dk, `record` ≤ 60 dk). Bu, 1. ACTIVATION adımındaki e-postada belirtilir. M7c'nin kapsama ölçümü (`coverage:probe`, henüz yok; D-098) de aynı IP'den gelebilir: bir kez, ≈24,5 saat, sabit 0,1 istek/sn, aynı UA ve yalnızca üretim ingest'i kapalıyken (iki IP aynı anda çekmez); e-posta taslağı bunu da söyler.

**Sağlayıcı durumu** (WS mesajları, durum şeridi ve kesinti bastırma bu tanımı kullanır)
- `ok`: son 60 sn'de en az bir başarılı yanıt var ve birincil istasyon tazeliği ≤ hedef × 2.
- `degraded`: son 60 sn'de 429/420/5xx oranı > %20 ya da birincil istasyon tazeliği > hedef × 2.
- `down`: 60 sn boyunca başarılı yanıt yok ya da devre açık (401/403 dahil).

Durum geçişleri `provider_health`'e yazılır.

**Kapsama planı ve öncelikler**
- **Öncelik sınıfları:**
  - **P0** istasyon çemberleri: her etkin istasyon için ARP merkezli 60 NM.
  - **P1** takip listesi.
  - **P2** Türkiye taban kapsaması: birleşik batı çemberi (merkez 39,5K 29,5D) ve Doğu Türkiye çemberi (39,2K 38,8D); ikisi de 250 NM.
  - **P3** izleyici bölgeleri: varsayılan **kapalı**. Kapsama dışı alan haritada açıkça belirtilir.
- **Planlayıcı:** P0 çemberlerini kapsayan en az sayıda ≤ 250 NM çemberi hesaplar ve P2 Doğu çemberini her zaman ekler. Tek batı çemberi beş tohum istasyonun P0 çemberlerini kapsar; en uzak nokta AYT'dir (167,8 + 60 = 227,8 NM). Birincil istasyon için ek bir ≈ 40 NM çember dönüşümlü çekilir.
- **Tazelik hedefleri** (tazelik = ölçüm anı − `sampleTime`; adsb.lol yanıt süresi ve `seen_pos` dahil):
  - birincil istasyon p95 ≤ 20 sn
  - diğer istasyonlar ≤ 30 sn
  - Doğu çemberi ≤ 90 sn

  Gerçekleşen tazelik `provider_health`'e yazılır ve arayüzde gösterilir.
- **P1 karşılama:** Takip listesi önce kapsama çemberlerinden karşılanır. Kapsama dışındakiler 30 sn'de bir toplu `/v2/hex/...` ile çekilir. Takip listesindeki her uçak en geç 30 sn'de bir güncellenir.
- **Bütçe yetmezse:** önce P3, sonra Doğu çemberi, sonra diğer istasyonların tazeliği düşer. Birincil istasyon ve P1 en son etkilenir.

**Yanıt biçimi** (readsb `jv2` / ADSBx v2 uyumlu)
- **Zarf:** `{ ac: [], msg, now, total, ctime, ptime }`. **`now` epoch milisaniyedir (tamsayı).**
- **Zaman:** `seen_pos` ve `seen` **saniyedir** (ondalıklı).
  - adsb.lol: `sampleTime_ms = now − round(seen_pos × 1000)`.
  - readsb `aircraft.json` (yerel alıcı; `now` **saniye**, ondalıklı): `sampleTime_ms = round((now − seen_pos) × 1000)`.
  - Birim kontrolü: `now > 1e12` ise ms'dir.
  - `seen_pos` yoksa örnek zamanı `seen`'den, o da yoksa `now`'dan hesaplanır. Ham `seen_pos` ayrıca olduğu gibi (kırpılmadan) `AircraftState.seenPosS`'e ve iz tablolarının `seen_pos_s` sütununa geçer; gelmediyse null'dır, `seen` yerine konmaz (D-097).
- **Alan kuralları:**
  - Veri yoksa anahtar hiç gelmez; zod şemasında her alan opsiyoneldir.
  - `flight` 8 karaktere boşlukla doldurulur. Kırpılır; boş kalırsa `null` olur.
  - `alt_baro` `"ground"` olabilir. O zaman `onGround=true`, `altBaroFt=null` olur. Yerdeki uçakta `gs` ve `true_heading` bazen gelmez.
  - `hex` `~` ile başlıyorsa ICAO dışı bir adrestir (TIS-B).
  - lat/lon 60 sn'den eskiyse gelmez; yerine `lastPosition {lat, lon, nic, rc, seen_pos}` gelir. Bu yalnızca bayat uçağı göstermek içindir, **olay tespitinde kullanılmaz**. `rr_lat`/`rr_lon` atılır.
  - `type` konum kaynağını söyler: `adsb_icao`, `adsb_icao_nt`, `mlat`, `tisb_*`, `adsr_*`, `adsc`, `mode_s`, `other`.
  - `squawk` string'dir.
  - `dbFlags` yoksa 0'dır; bitler 1 askeri, 2 ilginç, 4 PIA, 8 LADD (ör. 3 = askeri + ilginç). Bit testiyle okunur.
- **Ek alanlar** (Uzman görünüm ve motor için): `ias`, `tas`, `mach`, `wd`, `ws`, `oat`, `tat`, `nav_qnh` (hPa), `nav_altitude_mcp`, `nav_modes` (ör. `approach`), `baro_rate`, `geom_rate`, `track`, `true_heading`, `category`, `emergency`.

## 2. Kendi alıcı (opsiyonel; kullanıcı şu an kurmuyor, D-006)
- `LOCAL_RECEIVER_URLS`: virgülle ayrılmış readsb/tar1090 `aircraft.json` adresleri, opsiyonel token ile. Tanımlı değilse adaptör kapalıdır. Geliştirmede replay alıcısı bu yoldan bağlanır.
- **Birleştirme:** Aynı hex için en yeni `sampleTime` kazanır; yerel veri daha tazeyse yerel veri tercih edilir.
- **Faydası:** Alıcı adsb.lol'e veri beslerse ileride API anahtarı sağlar. Alçak irtifa kapsamasıyla kesin teker koyma tespitini de mümkün kılar.

## 3. OurAirports — havalimanı ve pist
- **Kaynak:** `https://davidmegginson.github.io/ourairports-data/airports.csv` ve `.../runways.csv`. Her gece yenilenir. Lisans kamu malıdır (Unlicense).
- **İçe aktarım:** Günlük, `If-Modified-Since` ya da ETag ile. Değişmeyen satır yeniden yazılmaz, hatalı satır atlanır ve loglanır. Testte ve `EXTERNAL_PROVIDERS_DISABLED` iken `tools/fixtures/ourairports/` altındaki commit'li alt küme kullanılır: Türkiye, birkaç uzak büyük havalimanı, M6d'den beri 1. halkanın 75 havalimanı ile 89 açık pisti, M6g'den beri 2. halkanın 89 havalimanı ile 123 açık pisti M6h'den beri 3. halkanın 275 yeni havalimanı ile 389 açık pisti (Frankfurt, Dubai ve Doha Hamad 3. halkadadır, uzak örnek olarak zaten dosyadaydı) ve M6i.1'den beri 4. halkanın 716 yeni havalimanı ile 854 açık pisti (Londra Heathrow, Paris CDG, Amsterdam ve Madrid 4. halkadadır, uzak örnek olarak zaten dosyadaydı; D-101). 4. halka M6i.2'den beri açıktır (D-102). M6j.1'den beri 5. halkanın 2.030 yeni havalimanı ile 3.000 açık pisti (New York JFK 5. halkadadır, uzak örnek olarak zaten dosyadaydı) ve iki dışlama örneği: Paris-Le Bourget (LFPB; büyük, tarifesiz, üç pisti var: aday değildir) ve Thohoyandou (FATH; küçük, tarifesiz, IATA THY: içe aktarılmaz) (D-109). 5. halka henüz kapalıdır (`ENABLED_AIRPORT_RING` 4).
- **Fixture yenilemesi (M6d, D-080; M6g, D-088; M6h, D-090; M6i.1, D-101; M6j.1, D-109):** 1.–5. halka satırları kullanıcının onayladığı **tek** indirmeden alındı (2026-10-01T23:03:49Z, yukarıdaki iki CSV adresi; sonraki halkalar için yeniden indirilmedi). Satırlar mevcut fixture'ın sonuna, kaynaktaki biçimle (bütün alanlar tırnaklı), halka halka eklendi; mevcut halka satırları ve sıraları değişmedi (`scripts/make-reference-fixtures.mts` aynı baytları üretir; son halkanın sınırı sonsuzdur, `FIXTURE_RINGS_KM = [500, 1000, 2000, 5000, ∞]`). M6j.1'de iki dışlama örneği (LFPB, FATH) taban satırlarına kaynak sırasıyla girdi. M6i.3'te (D-110) halka bloklarından sonra kapanış bloğu geldi: kapanış tablosunun OurAirports'ta tarifesiz 23 havalimanı ve 28 açık pisti, aynı indirmeden, dosyaların sonunda (önceki satırlar bayt bayt aynı). Fixture 3.647 havalimanı ve 4.632 pist satırıdır; bütün halkalar fixture'dadır. Daha yeni veri gerekirse yeni indirme DUR-SOR 6'ya tabidir (kullanıcı onayı). Canlı içe aktarım (üretim) bu fixture'dan bağımsızdır; OurAirports kullanımı ve lisansı değişmedi.
  - **Ham dosyaların kalıcı kopyası (D-101):** `C:/PROJELER/havayolu-data/ourairports-2026-10-01/` (repo dışında, kullanıcının makinesinde; repoya ve imaja girmez). Fixture o klasörden ağsız yeniden üretilir: `pnpm exec tsx scripts/make-reference-fixtures.mts C:/PROJELER/havayolu-data/ourairports-2026-10-01 <geçici-klasör>` commit'li `airports.csv`, `runways.csv` ve `vrs/airlines.csv` ile bayt bayt aynıdır (2026-10-05). Bütünlük: o klasörde `sha256sum -c SHA256SUMS`. SHA-256 değerleri:
    - `airports.csv` (12.734.002 B): `7a3fe6ee4a451469cb3197d43ad71838b587dc4bca8bef98728d779d2a475722`
    - `runways.csv` (3.966.684 B): `9c9ea5b93b9a1b0eee6d64b1f4249b4a470ad9b7b36cbf51ce1a2f6dcea36a4c`
    - VRS `airlines.csv` (248.664 B): `933d86f5628aa021245c93f39737b617e95b38986012d7788e2c32a5ff846826`
    - `ring4-append/ring4-airports.csv` (716 satır): `093517d1474611592976e8903e2211fd882b4f18354e9718fb4fef13f4130116`
    - `ring4-append/ring4-runways.csv` (854 satır): `6f2ff2a0a711e2fbb3d0aa5b793fca537615069c39126280265b858f4d3cfcb3`
    - 5. halka ekleri (M6j.1, D-109; fixture'ın halka bloklarının son satırları, M6j araştırmasının ek dosyalarıyla bayt bayt aynı): `ring5-append/ring5-airports.csv` (2.030 satır, 492.779 B) `784f4711432731e622253275c6d624308d8b4cd9b23d7a211b9a3d29c9328e38`; `ring5-append/ring5-runways.csv` (3.000 satır, 467.356 B) `b569d99d00e2f8f2b8efe6dedde36ddcf9bc05624d3cea4b29bfbcc56e21f6d1`. Kalıcı kopya M6j.1'de değiştirilmedi; iki dosyayı ve `SHA256SUMS` satırlarını kullanıcı ekler (ACTIVATION). Repo kökünde denetim (D-110'dan beri dosyaların sonunda kapanış bloğu durur): `head -n 3625 tools/fixtures/ourairports/airports.csv | tail -n 2030 | sha256sum`, `head -n 4605 tools/fixtures/ourairports/runways.csv | tail -n 3000 | sha256sum`.
    - Kapanış bloğu (M6i.3, D-110; fixture'ın son satırları): kapanış tablosunun OurAirports'ta tarifesiz 23 havalimanı (6.686 B) `29582f1efd2dbe9a4746d9056f0dcef6970f5abe58bfbdf66f01910cd6e04624`, açık pistleri (28 satır, 4.589 B) `5700479c2d1198aeb3f7246932e833f1f5bfcd58ca618fd3707718773fa2f6d9`. Kalıcı kopya değiştirilmedi; `war-closures-append/` kullanıcının isteğe bağlı adımıdır (ACTIVATION). Denetim: `tail -n 23 tools/fixtures/ourairports/airports.csv | sha256sum`, `tail -n 28 tools/fixtures/ourairports/runways.csv | sha256sum`.
- **Filtre:** `type IN (large_airport, medium_airport)` ya da `scheduled_service = yes`; ayrıca Türkiye'nin 3 harfli IATA kodlu küçük alanları (`iso_country = TR`, `type = small_airport`; 2026-10-01'de tarifesiz 5 alan: Gökçeada, Selçuk-Efes, Bodrum-İmsık, Aydın Çıldır, Adana Şakirpaşa). Bu küçük alanlar yalnızca yurt dışı havalimanlarının Türkiye'ye uzaklığının referansıdır (D-080); listelenmez, sayfaları ve hava durumları yoktur. Süzgeç değişince kaynak dosya değişmemiş olsa da (304) içerik yeniden yazılmalıdır: bir veri migration'ı OurAirports kaynaklarının doğrulayıcılarını sıfırlar (`0005_ourairports_reimport`), worker açılışta dosyayı koşulsuz indirir. Anahtar sırası `icao_code` → `gps_code` → `ident`. `closed = 1` olan pistler atlanır.
- **Listelenen havalimanları (D-080):** İçe aktarılan her havalimanı gösterilmez. Sayfalar, harita ve hava durumu IATA kodlu Türkiye havalimanlarını ve açık halkalardaki yabancı adayları (`large_airport`/`medium_airport`, `scheduled_service = yes` ya da savaş nedeniyle kapalı havalimanlarının kapanış tablosunda (D-110), 3 harfli IATA kodu ve M6i.1'den beri 4 karakterli kanonik ICAO, `^[A-Z0-9]{4}$`, D-101; IATA kodlu en yakın Türkiye havalimanına, listelenmeyen küçük alanlar dahil, büyük daire mesafesi; M6i.2'den beri 4. halka açık, ≤ 5.000 km, D-102; listelenen 56 + 77 + 104 + 283 + 720 = 1.240) kullanır. Beş askerî hava üssü (İncirlik, Afyon, Bandırma, Eskişehir, Çiğli; D-084) listelenmez ve uzaklık referansı sayılmaz (D-107; D-103'te yalnız haritadan kalkmışlardı); 5. halkada adı yalnız askerî üç alan (Wake PWAK, Oakey YBOK, Kwajalein Bucholz PKWA; OurAirports'ta tarifeli orta havalimanı) aynı listeye girdi ve halka açılınca da listelenmez (D-109; ortak sivil-askerî Ascension FHAW ve MidAmerica KBLV listelenir, D-103): satırları içe aktarılır ve veritabanında kalır, süzme okurken yapılır (`@havayolu/db` `MILITARY_AIRFIELD_ICAOS`; ayrıntı `docs/spec/domain.md`). Sayfaları, API kayıtları ve hava durumları yoktur (404), haritada ve uçak listesinin konumunda görünmezler. ICAO koşulu `icao_code` ve `gps_code` taşımayan, kimliği OurAirports ident'i olan satırı dışarıda bırakır (Kihihi "Savannah Airstrip", UG-0002, IATA KHX; 4. halkada): sayfa yolu, API kodu ve hava durumu istasyonu 4 karakter ister. 4. halkada 720 adayın 719'u listelenir (kapanış tablosuyla Bukavu dahil 720); 1.–3. halkada her aday zaten 4 karakterlidir. 5. halkada (M6j.3'te açılır) 2.031 adayın 2.029'u 4 karakterlidir (Aleknagik 5A8/WKK ve Leshan CN-0249/LSG dışarıda), askerî liste dışında 2.026'sı listelenir (bütün halkalarla 3.266; D-110'dan önce 3.243). **Adres takma adı (D-109):** OurAirports `ident`'i kanonik ICAO'dan farklı, 4 karakterli ve hiçbir satırın kanonik ICAO'su olmayan havalimanının eski kodu (`identAlias`: Özbekistan UTSS → UZSS, Lima SPIM → SPJC, Palm Beach KPBI → KDJT; fixture'da 1.–4. halkada 29, 5. halkada 23) `GET /v1/airports/<kod>`'da ve `/istasyon/<kod>`'da (308) kanonik kayda gider; başka bir satırın ICAO'su olan kimlik takma ad değildir ve takma ad listelenmeyen bir havalimanına yönlenmez. Veritabanındaki satırlar dinamik denetlenir; liste, ülke listeleri ve tek havalimanı ucu aynı kümeye bakar (`listedFilter`'in her ülkeden satırları). İçe aktarılmayan satırlar için `IDENT_ALIAS_EXCLUSIONS` vardır; fixture üreticisi listeyi tam dosyayla sayar ve karşılaştırır (2026-10-01'de WABP: Timika WAYY'nin kimliği, Burumeso ID-0394'ün ICAO'su; WIOD: Tanjung Pandan WIKT'nin kimliği, Singkawang ID-0290'ın ICAO'su; WRLB: Long Bawan WAQJ'nin kimliği, Dagai ID-0041'in GPS kodu). Hava durumu uçları kodu aynı kuralla çözer. **Savaş nedeniyle kapalı havalimanları (D-110; D-090'ın yerine):** normal şartlarda sivil yolcu seferi alan ama savaş nedeniyle sivil uçuşa kapalı havalimanları küratörlü kapanış tablosundadır (`CIVIL_FLIGHT_CLOSURES`, `@havayolu/shared`; db kopyası `CIVIL_FLIGHT_CLOSURE_ICAOS`; 35 kayıt) ve aday kuralında tarifeli sayılır: OurAirports'ta tarifesiz görünen 23'ü (Ukrayna 16, Kırım dahil; Rusya 6; Bukavu) listeye girer, tarifeli görünen 12'si (Voronej, Goma, Taiz, Lazkiye, Kamışlı, Sana, El Faşir, Nyala, El-Obeid, Aksum, Gao, Mopti) zaten listededir. Sayfa, harita penceresi ve havalimanı listesi "Savaş nedeniyle sivil uçuşlara kapalı (<yıl>’den beri)" (kesin, 26) ya da "… kapalı olabilir (…)" (belirsiz, 9) notunu gösterir; ölçüt, not türü, kaldırma kuralı ve kaynaklar D-110'dadır. Yeniden açılan Krasnodar, Gelencik ve Elista tablodan silindi; OurAirports'ta tarifeli oldukları için listede kalırlar. Tabloda olsa da küçük alan, IATA'sız satır ve askerî alan listelenmez. API'nin `scheduled` alanı OurAirports değeridir (eklenenlerde false); kapanış alanı yoktur, istemciler tabloyu ortak paketten okur. Üretim içe aktarımı büyük ve orta havalimanlarının hepsini zaten alır (`isImportedAirport`): migration yoktur. Türkiye listesi eski kuralıyla (IATA kodlu büyük, orta ya da tarifeli alan) değişmez, askerî üsler hariç: 56 (D-107'den önce 61). Ülke OurAirports `iso_country`'dir; tek istisna gösterimdedir: Ercan (LCEN) KKTC olarak yazılır.
- **Kaynak düzeltmeleri (D-088):** OurAirports satırları veritabanında ve fixture'da kaynaktaki gibi kalır; bilinen hatalar okurken, belgeli tablolarla ve yalnız yanlış değer durdukça düzeltilir (kaynak düzeltirse kendiliğinden devre dışı kalır). İskenderiye: `ident` HEBA, `icao_code`/`gps_code` HEAX (kapanan El Nouzha'nın kodu) → uygulamada HEBA (`OURAIRPORTS_ICAO_CORRECTIONS`, `@havayolu/shared` ve `@havayolu/db`). Taba 04/22, Cluj-Napoca 08/26, Linz 07H/25H ve Voronej 18/36: uzunluğu, genişliği ve koordinatı olmayan yinelenen pist satırları gösterilmez (`HIDDEN_RUNWAY_IDS`). Karşı ucu (`he_ident`) olmayan satır pist değildir, gösterilmez (genel kural, D-090; Stuttgart'ın H-NORTH ve H-SOUTH helikopter alanları). M6i.1'den beri (D-101): Hassi Messaoud (DAUH) "01/19", Beauvais (LFOB) "13R/31L" ve Bujumbura (HBBA) "02/20" de `HIDDEN_RUNWAY_IDS`'tedir; kayıtlı uzunluğu 100 ft'ten kısa satır pist değildir (genel kural; Pamplona LEPP "03/21", 2 ft); uçlar arası uzaklık hem kayıtlı uzunluğun 2 katından hem 1 km'den fazlaysa uç koordinatları içe aktarımda kullanılmaz: yön `heading_degT` alanından, eşikler havalimanı merkezinden (`arp_fallback`) gelir, ham koordinatlar satırda kalır (genel kural; Amravati VAAM 08/26, uçlar 74,5 km arayla, kayıtlı 1.850 m). Ham kaplama kodları `runwaySurfaceKey` (`@havayolu/shared`) ile türe çevrilir; 4. halkanın 13 yeni kodu (BIT, BITUM, MACADAM, MAC, HARD, PAVED, COM, COMPOSITE, GRADED HARDCORE, LAT, UNPAVED, SAN, SAND) M6i.1'de eklendi, kum için yeni `sand` türüyle (D-101). **5. halka (M6j.1, D-109):** yinelenen boş pist satırını genel kural gizler (uzunluğu, genişliği ve iki ucunun koordinatı yok, aynı havalimanında uzunluğu bilinen ve satır kurallarıyla gizlenmeyen bir satır var; `visibleRunways`); kural `HIDDEN_RUNWAY_IDS` tablosunun yerini aldı, tablonun yedi satırını ve 5. halkanın 13 satırını tutar, 1.–4. halkada başka satır gizlemez; satır doldurulursa yeniden görünür (D-088'in anlamı). Kaplaması OurAirports düzenleyicisinin silme işaretiyle başlayan satır ("DELETE", "Delete duplicate"; Hamilton NZHN'nin iki satırı) dolu olsa da gizlenir. Langzhong'un (ZULA) adsız 11.811 ft'lik satırı karşı ucu olmadığı için gizli kalır (D-090; havalimanı pistsiz görünür). FAA kaplama kodlarının durum eki (-E, -G, -F, -P: ASPH-G, CONC-F, GRVL-DIRT-G) atılıp kod yeniden aranır; 15 yeni kod tabloya girdi (GRVL, SAND/GRAVEL, CRUSHED ROCK, TREATED GRAVEL, GRVL-DIRT → çakıl; ASP/CONC, COP → karışık; CONCRETE-GROOVED, CONCRETE/GROOVED, CEMENT, CEM → beton; ASPHALT CONCRETE, ASPH 71/F/C/X/T → asfalt; GRASSED BLACK CLAY → çim; CLA → toprak; COP'un anlamı çevrimdışı doğrulanamadı, "composite" sayıldı). Uç uzaklığı kuralı 5. halkada Pueblo'nun (KPUB) 241424 08L/26R satırını da yakalar (uçlar 3,14 km arayla, kayıtlı 4.690 ft). Görünür pistler: 1.–4. halka 1.541, 5. halka 2.978; görünür pisti olmayan 5. halka havalimanları 14. Adlarda art arda boşluk teke iner (Bacău) ve tek başına duran küçük harfli "airport" "Airport" olur (1.–3. halkada dokuz, 4. halkada yedi Fransız havalimanı; fixture'da 16; D-090, D-101). Özbekistan'ın beş havalimanında OurAirports `ident`'i UTxx, `icao_code`'u UZxx'tir; genel ICAO kuralıyla UZxx kullanılır (AWC raporu eski kodla yayımlıyorsa hava durumu gelmez; yayından sonra denetlenir, ACTIVATION).
- **İçe aktarım kayması (D-109):** gece içe aktarımı başarısız olmadıkça worker bir günlük satırı yazar (`referans verisi kayması`): listelenen havalimanı sayısı, saat dilimi kuralı olmayan, tanınmayan kaplama kodu taşıyan, IATA kodu iki kez geçen ve küratörlü adı olmayan listelenen havalimanları, listede olmayan küratörlü adlar ve kanonik ICAO çakışmaları (aynı ICAO'yu taşıyan ikinci aday satır). Sapma yoksa info, varsa warn; okuma RUNBOOK'tadır. Satır takma ad çakışmasını ve bölge varsayılanıyla yanlış dilim alan yeni havalimanını saymaz (D-109 "Bilinen sınırlar"). 2026-10-01 kopyasında açık halka (4) sapmasızdır; 5. halka açık bağlamla yalnız 2.026 ad eksiktir (M6j.3).
- **Eşik ve yükseklik:** Eşik hesabı domain.md'de tanımlıdır. Türkiye'de (LT*) 118 pistin 105'inde uç koordinatı vardır. Alan yüksekliği `le_elevation_ft`'ten, yoksa `elevation_ft`'ten alınır. Admin için pist düzeltme tablosu vardır.
- **Resmî Türkçe adlar (D-076):** OurAirports adları İngilizcedir. Havalimanı sayfalarındaki resmî Türkçe adlar ve İngilizce görünen adlar elle derlenmiş bir tablodadır (`packages/shared/src/reference/airport-names.ts`). Kaynaklar DHMİ'nin havalimanı listesi ve DHMİ dışındaki işletmecilerin resmî siteleridir (REFERENCES.md, erişim 2026-09-30); bu siteler çalışma zamanında çekilmez. Doğrulanamayan ad OurAirports adıyla kalır. Eski SHGM listesi (`havlist.pdf`, 2006) kullanılmaz.

## 4. VRS standing-data — havayolu ve rota (CC0)
- **Kaynaklar:**
  - Havayolları: `github.com/vradarserver/standing-data` → `airlines/schema-01/airlines.csv` (raw, ETag). Aynada yoktur.
  - Rotalar ve havalimanları: `https://vrs-standing-data.adsb.lol/routes.csv.gz` (~4,5 MB) ve `airports.csv.gz` (~1 MB), CORS açık.
- **Şemalar:**
  - `airlines.csv`: Code, Name, ICAO, IATA, PositioningFlightPattern, CharterFlightPattern. AJet (TKJ/VF) dahil güncel.
  - `routes/schema-01`: Callsign, Code, Number, AirlineCode, AirportCodes. AirportCodes tireyle ayrılmış ICAO listesidir ve ara durak içerebilir.
- **İçe aktarım:** Havayolları Parça 1 M2'de (sefer no araması için), rotalar Parça 2'de gelir. İkisi de günlük, ETag ile.
- **Rota uygunluğu:** yerelde hesaplanır. Konum, her bacağın büyük daire hattına en fazla max(50 NM, bacak uzunluğunun %20'si) uzaklıkta olmalıdır. Uymayan rota düşük güvenli sayılır. Sonuç her yerde "tahmini" gösterilir.
- **IATA kodları tekil değildir.** TK1985 → THY1985 dönüşümünde **şu an uçan** havayolunun ICAO kodu tercih edilir. Belirsizlik admin düzeltme tablosuyla ya da canlı çağrı kodu kanıtıyla çözülür.
- **Kapsam dışı ve atıf:** Telsiz çağrı adları (TURKISH, SUNTURK) v1'de yoktur. **OpenFlights kullanılmaz:** 2017'den beri güncellenmiyor ve ODbL share-alike yükü getiriyor. CC0 atıf gerektirmez; yine de ATTRIBUTION.md'de nezaketen anılır.

## 5. aviationweather.gov — METAR/TAF
Doğrulama: 2026-10-01 (OpenAPI şeması v4.0, Data API sayfası, help/data, değişiklik günlüğü, weather.gov/disclaimer; canlı istek atılmadı). Parça 1 M6c'den beri kullanılır (D-078).

**Erişim ve şartlar**
- **Base URL:** `https://aviationweather.gov/api/data`. Yalnızca HTTPS; `www` alt alan adı kullanılmaz (belgenin talimatı).
- **CORS yoktur** ("Cross-origin resource sharing is not permitted"). Yalnızca worker (`hy-worker-bg`, `jobs` rolü) çağırır; web ve mobil kendi API'mizi kullanır.
- **Sınır:** dakikada 100 istek; çoğu uç nokta yanıt başına en çok 400 kayıt döndürür. **Aşımda erişim engellenir.** Özel User-Agent önerilir (zorunlu olduğu yazmaz); mevcut `providerUserAgent` gönderilir.
- **Yeniden deneme:** NWS yönergesi: hizmet yanıt vermiyorsa denemeler en az 1 dk arayla yapılır. Engellenen kullanıcı sdm@noaa.gov'a yazar (RUNBOOK).
- **SLA yoktur**, hizmet "olduğu gibi"dir. Son geçerli rapor veritabanında kalır ve yaşıyla gösterilir.
- **Önbellek başlığı belgelenmemiştir.** 2026-09-25'teki canlı denetimde `Cache-Control: max-age=60` görüldü (`docs/research/2026-09-25-kaynak-dogrulama.md`, R1); belgeli bir taahhüt değildir, sabit yazılmaz.

**Uç noktalar ve parametreler**
- **METAR:** `GET /metar` — `ids` (virgülle ayrılmış ICAO kodları) ya da `bbox=lat0,lon0,lat1,lon1` (önce enlem) zorunlu; `format` (`raw|decoded|json|geojson|xml|iwxxm`, **varsayılan `raw`**, bu yüzden `format=json` her zaman gönderilir); `taf` (boolean); `hours` (geriye bakılan saat, **varsayılan 1,5**; biz 2 gönderiyoruz); `date` (`yyyymmdd_hhmm` ya da ISO). Geçmiş en çok 30 gün geriye gider.
- **TAF:** `GET /taf` — `ids`/`bbox`, `format` (`raw|json|geojson|xml|iwxxm`), `metar` (boolean), `time=valid|issue`, `date`. **`hours` parametresi yoktur.**
- **`metar?taf=true` kullanılmaz:** METAR JSON şemasında TAF alanı tanımlı değildir; çözümlenmiş TAF (`fcsts[]`) yalnızca `/taf`'tan gelir. İki ayrı istek atılır.
- **Belgelenmemiş parametre yasaktır:** "Undocumented query parameter requests are restricted and will result in an error" (değişiklik günlüğü v4.26, 2026-08-13). Önbellek kırıcı sorgu parametresi de eklenmez.
- **İstek düzenimiz:** listelenen havalimanları (D-080, D-088, D-090, D-102, D-107, D-110; 4. halkayla 56 + 77 + 104 + 283 + 720 = 1.240, savaş nedeniyle kapalı 23 havalimanı dahil; askerî hava üsleri hariç; aşağıdaki istek sayıları 1.217 istasyonla ölçüldü, 1.240'ta METAR olağan isteği yine 16'dır, 80 × 15 + 40). Savaş nedeniyle kapalı havalimanlarının çoğunun METAR'ı yoktur; yayından sonraki ilk çalışmada 23 yeni istasyon "yeni istasyon, 24 saat" yoluyla 4 ayrı istekle istenir. İstasyonlar baştan gruplara bölünür: METAR'da bir istek 400 kayıt sınırının altında kalacak kadar istasyon taşır (istasyon başına saatte en çok 2,5 rapor varsayımıyla 2 saatlik olağan istekte 80 istasyon: 1.217 istasyon = 16 METAR isteği, 80 × 15 + 17, `ids=<80 kod>&format=json&hours=2`, ~400 karakter; 3. halkada 498 istasyon 7 istekti, D-107'den önce 503); her istekte en çok 200 istasyon (`AWC_MAX_IDS`): TAF 7 istektir (200 × 6 + 17; 3. halkada 200 + 200 + 98; istasyon başına birden çok geçerli TAF dönerse grup 400 kayda ulaşıp bölünebilir, en kötü grup başına 7 istek). İki isteğin başlangıcı arasında en az 700 ms geçer (`AWC_MIN_REQUEST_INTERVAL_MS`, D-090): herhangi bir 60 saniyede en çok 86 istek başlar. Kodlar düz virgülle birleşir (AWC'nin kendi METAR sayfası da öyle gönderir). Yanıt yine de 400 kayda ulaşırsa grup ikiye bölünür, en çok 2 düzey. METAR 5 dk'da, TAF 15 dk'da bir: 4. halkayla saatte ~192 METAR ve 28 TAF isteği (~220; 1. halkada ~28, 2. halkada ~44, 3. halkada ~96); olağan çalışma METAR 16, TAF 7 istek, aralıkla METAR ~11 sn (D-078, D-080, D-088, D-090, D-102); askerî üslerin çıkması olağan istek sayısını değiştirmez (D-107). Kesintiden sonra METAR geriye bakışı son başarılı denetimi kapsayacak kadar uzar (en çok 24 saat; istasyonlar istek başına 400 kayıt sınırına göre gruplanır); ilk açılışta 24 saat istenir. Listeye yeni giren (yeni halka) ya da son 24 saatte hiç METAR'ı saklanmamış istasyonlar, worker süreci başına bir kez, ayrı bir istekle 24 saat istenir (6'şarlı gruplar; 1. halkanın 75 istasyonu için 13, 2. halkanın 89 istasyonu için 15, 3. halkanın 278 istasyonu için 47, 4. halkanın 719 istasyonu için 120 istek; 4. halkanın yayınından sonraki ilk METAR çalışması kaydı olan 498 istasyonun olağan 7 isteğiyle birlikte 127 istek, aralıkla en az ~88 sn; üretimde METAR'ı olmayan ~40 eski istasyon da istendiği için ~133; 3. halkanın yayınında 50; bütün 1.217 istasyonun 24 saatlik doldurması 203 istek, ~2,4 dk); kayıtları ilk günden doludur (D-080). Bu iki çalışma aralık olmasaydı dakikada 100 sınırını aşardı (429 → 10 dk engel). **5. halka (D-111; M6j.3 açar):** 3.264 istasyonla (3.266 listelenen, D-110) olağan çalışma METAR 41 (80 × 40 + 64), TAF 17 (200 × 16 + 64) istek, saatte 560 (dakikada en çok 86); halkanın yayınından sonraki ilk METAR çalışması kaydı olmayan ~2.087 istasyonu 24 saatle (6'şarlı 348 istek) ve kalanları olağan gruplarla (15 istek) ister: ~363 istek, aralıkla ~254 sn (D-110'dan önce 3.241 istasyonla ~2.064, 359 istek, ~251 sn). Doldurmanın sınırı yoktur: bir sınır, denetlenen istasyonları süreç belleğinde "denetlendi" saydığı için kalanları hiç doldurmazdı. Çalışma 5 dk'yı aşarsa sonraki METAR işi bekler (kuyruk tek eşzamanlı, zamanlayıcı başına tek sıradaki iş); TAF işi de o çalışmanın ardından gelir. AWC'nin toplu önbellek dosyaları (aşağıda) kalıcı 429'da yedek olarak kalır. `/taf` `hours` almadığı için kesintide yayımlanıp yerini yenisine bırakan TAF'lar alınamaz (D-078). Her çalışmanın sonucu ve günlük satırı atılan istek sayısını taşır (`requests`, M6i.1, D-101; bölünmeler ve doldurma dahil): yukarıdaki sayılar üretimde oradan doğrulanır (RUNBOOK).

**Yanıt kodları**
- **200:** JSON dizi.
- **204:** geçerli istek, veri yok, **gövde boş**; JSON ayrıştırmadan önce durum kodu denetlenir. Başarı sayılır, eldeki raporlar silinmez.
- **400:** geçersiz parametre ya da değer; `format=json` ile gövde `{status:"error", error:string}`. Bizim hatamızdır.
- **403:** uç nokta kısıtlı ya da güvenlik duvarı engeli. Kaynağın davranışı değişti demektir (DUR-SOR 3): worker 1 sa durur, admin satırı "Çalışmıyor" olur.
- **404:** bulunamadı.
- **429:** çok fazla istek. `Retry-After` belgelenmemiştir; varsa okunur, yoksa en az 10 dk beklenir.
- **500, 502, 504:** sunucu hatası ya da geçici kesinti; 60 sn sonra bir kez yeniden denenir.

**METAR JSON alanları** (her alan boş gelebilir; zod şeması her alanı isteğe bağlı ve boş olabilir sayar, bilinmeyen anahtarları atar)
- **Kimlik ve zaman:** `icaoId`; `obsTime` (epoch **saniye**, tamsayı); `reportTime` ve `receiptTime` (metin, `"yyyy-mm-dd hh:mm:ss.sssZ"`); `metarType` (`METAR|SPECI|…`); `rawOb` (ham rapor); `name`; `lat`, `lon`; `elev` (**metre**; OurAirports'taki feet değil).
- **Değerler:** `temp`, `dewp` (°C; `temp`'in şema varsayılanı `0`'dır); `wdir` (gerçek kuzeye göre derece **ya da `"VRB"`**); `wspd`, `wgst` (kt); `visib` (**kara mili**, sayı ya da metin; `"6+"`/`"10+"` "daha fazla" demektir, Türkiye'deki `9999` `"6+"` gelir); `vertVis` (ft); `altim` (hPa, belgeli); `slp`; `wxString` (kodlu hava olayı, ör. `-RA`); `fltCat` (ABD uçuş kategorisi VFR/MVFR/IFR/LIFR).
- **Bulut:** `clouds[{cover, base, top}]`; `cover` `CLR|CAVOK|FEW|SCT|BKN|OVC|OVX` (AWC'nin kendi kodu NSC ve SKC'yi de tanır); `base` ve `top` **ft, yerden** (AGL). OVX dikey görüş demektir; Eylül 2025'ten beri tabanı dikey görüş değeridir. CB/TCU türü JSON'da **yoktur**. Belgelenmemiş bir üst düzey `cover` alanı da gelebilir.
- ABD'ye özgü alanlar (`precip`, `snow`, `maxT`…) Türkiye istasyonlarında boştur.
- Eğilim (NOSIG, BECMG, TEMPO), son hava olayı (`RE..`) ve rüzgâr kesmesi (`WS`) için alan yoktur; ham metinden okunur.

**TAF JSON alanları**
- **Üst düzey:** `icaoId`; `issueTime`, `bulletinTime`, `dbPopTime` (**metin**; boşluklu ya da `T`'li ISO biçimi, ikisi de okunur); `validTimeFrom`, `validTimeTo` (epoch saniye); `rawTAF`; `mostRecent` (0 ya da 1); `remarks`; `lat`, `lon`, `elev` (metre); `prior`; `name`.
- **`fcsts[]`:** `timeFrom`, `timeTo`, `timeBec` (epoch saniye; `timeBec` boş olabilir); `fcstChange` (`TEMPO|FM|BECMG|PROB` ya da temel dönem için boş; AWC'nin kendi kodu `PROB30`/`PROB40` de bekler, `/^PROB\d\d$/` kabul edilir); `probability`; `wdir` (derece ya da `"VRB"`); `wspd`, `wgst` (kt); `wshearHgt` (ft), `wshearDir`, `wshearSpd`; `visib` (kara mili, `"6+"`); `altim` (hPa); `vertVis` (ft); `wxString`; `notDecoded`; `clouds` (METAR'daki gibi, CB/TCU yok); `icgTurb[]`; `temp[]`. Türk TAF'larında sıcaklık grubu yoktur.

**Ham metinden çözümleme (D-078)**
- Görüş, bulut, sıcaklık, rüzgâr, hava olayları ve TAF dönemleri **ham metinden** (`rawOb`, `rawTAF`) çözümlenir; JSON alanları yalnızca zaman ve kimlik için kullanılır, testlerde çapraz denetimdir. Nedenleri: `9999` → `"6+"` kara mili kaybı; `clouds` NSC, NCD, SKC, VV ve CB/TCU'yu ayırmaz; `temp` varsayılanı `0`; birleşik `PROB30 TEMPO`'nun JSON'daki gösterimi belgelenmemiştir.
- Tavan = en alçak BKN/OVC tabanı ya da dikey görüş (VV, JSON'da OVX).
- Çözümleyici `packages/shared/src/weather/`'dadır (saf, IO yok).

**Saklama (D-078)**
- Her farklı rapor saklanır: METAR/SPECI `(istasyon, gözlem anı, tür)`, TAF `(istasyon, yayım anı)` anahtarıyla; aynı anahtarla gelen düzeltilmiş rapor (COR) metni değiştirir.
- **30 gün** tutulur; `weather-prune` işi günde bir budar. Listeden çıkan istasyonların satırları da silinir.
- Lisans kaydındaki `maxRawStorageDays: null`: kaynak bir sınır koymaz; 30 gün bizim seçimimizdir.

**Lisans kaydı** (§ "Lisans kaydı"ndaki 7 alan; `packages/providers/src/license.ts` → `aviationWeather`)
- `commercialUse`: `true`. NWS bilgisi aksi belirtilmedikçe kamu malıdır ve her yasal amaçla ücretsiz kullanılabilir (https://www.weather.gov/disclaimer).
- `attribution`: "NOAA Aviation Weather Center" → https://aviationweather.gov/. Yasal zorunluluk değil nezaket atfıdır; NWS adı ve logosu izin ister, logo kullanılmaz; NOAA/NWS onayı ya da bağlantısı ima edilmez; değiştirilmiş veri resmî gibi sunulmaz. Sayfada "otomatik çözümlenmiştir; resmî brifing yerine geçmez, uçuş planlamasında kullanılmaz" yazar.
- `shareAlike`: `none`.
- `rateLimit`: dakikada en çok 100 istek; çoğu uç noktada yanıt başına en çok 400 kayıt; aşımda erişim engellenir; özel User-Agent önerilir.
- `b2cDisplayAllowed`: `true`.
- `mixingWithOtherRealtimeAllowed`: `true` (kısıt bulunmadı).
- `maxRawStorageDays`: `null`.
- **Kaynağın kaynağı:** Türk METAR ve TAF'larını havalimanlarının meteoroloji birimleri (MGM; İncirlik'te ABD Hava Kuvvetleri) hazırlar, AWC uluslararası değişimle yeniden dağıtır ve üçüncü taraf verisi olarak işaretlemez. MGM'nin kendi şartları incelenmedi; risk düşüktür (D-078).

**Kullanılmayanlar ve kaldırılanlar**
- **Toplu önbellek dosyaları** (`/data/cache/metars.cache.csv.gz` ve `.xml.gz` dakikada bir, `tafs.cache.xml.gz` 10 dk'da bir, `stations.cache.json.gz` günde bir): bütün dünyayı içerir; METAR ve TAF için JSON yoktur; **XML'de basınç inHg'dir** (`altim_in_hg`), dönüştürme tuzağıdır. Yalnızca dünya çapında kapsama ya da kalıcı 429 sonrası yedek için anlamlıdır.
- **CSV:** ürün tablosu METAR için CSV yazar, ama `/metar`'ın biçim listesinde `csv` yoktur; CSV yalnızca `/api/data/dataserver` ve önbellek dosyasındadır. Kullanılmaz.
- **Kaldırılanlar:** Eylül 2025 yenilemesinde METAR'da `recent`, `order`, `vfr`, `output`, `filter`, `fields`, TAF'ta `fields` dışındakilerin aynısı; HTML çıktısı, TAF CSV'si ve `metar_id` kaldırıldı; `fltCat` ve bulut örtüsü eklendi. Son adımlar 2026'da geldi: v4.25 (2026-08-06) eski `/cgi-bin/` uyumluluğunu kaldırdı, v4.26 (2026-08-13) belgelenmemiş parametreleri yasakladı.

**Fixture'lar**
- `tools/fixtures/weather/`: AWC JSON biçiminde, **elle yazılmış ve "sentetik, kayıt değil" etiketli** METAR ve TAF dosyaları; canlı kayıt yapılmaz (kullanıcı kararı 2026-10-01, D-078). Vakalar (yağmur, kar, gök gürültüsü, sis, CAVOK, VRB, hamle, SPECI ve dolu, donan yağmur, gecikmiş ve eski gözlem, raporu olmayan istasyon, TAF'ta yerine geçme, AMD ve süresi dolmuş TAF) ve LTFM için en az 3 günlük METAR/TAF kaydı içerir. Ayrıntı `tools/fixtures/README.md`'dedir.
- Testte ve `EXTERNAL_PROVIDERS_DISABLED=true` iken worker bu dosyaları yükler; geliştirme ve testte (`APP_ENV` `development|test`) zamanlar tam saat kaydırılarak bugüne getirilir. Birim testleri sabit bir "şimdi" kullanır.

## 5a. IANA saat dilimi veritabanı (tzdb) — havalimanının yerel saati
Doğrulama: 2026-10-03 (tzdb 2026c `zone.tab`, `zone1970.tab`, `iso3166.tab`; Node 24 `Intl`, ICU 78, tz 2026b; canlı istek atılmadı). Parça 1 M6f'den beri kullanılır (D-084).

- **Ne için:** havalimanının yerel saati ve UTC farkı (harita penceresi ve havalimanı sayfası; gözlem, tahmin, gün doğumu ve batımı). OurAirports, VRS ve aviationweather.gov saat dilimi vermez.
- **Nasıl:** çalışma zamanında hiçbir yerden veri çekilmez. Kodda küçük bir tablo vardır (`packages/shared/src/reference/time-zones.ts`): tzdb `zone.tab`'da tek dilimi olan 216 ülke (ISO 3166-1 → IANA dilimi), çok dilimli ülkeler için ISO 3166-2 bölge kuralları ve havalimanına (ICAO) özgü kurallar. Yaz saati dahil farkı tarayıcının ve sunucunun `Intl`'i (ICU'nun tzdb kopyası) hesaplar; sabit fark kodda yoktur. Kuralı olmayan havalimanında dilim tahmin edilmez (null; saatler UTC etiketiyle yazılır, D-106 (c), D-109; M6j.1'den önce "Türkiye saati" etiketiyle). Kural sırası ve 1.–2. halka kuralları D-084'tedir; 3. halkanın 49 bölge kuralı (Almanya, İspanya, Kazakistan, Rusya, Özbekistan) D-090'dadır; 4. halkanın 93 bölge kuralı (Rusya, İspanya, Kazakistan, Kongo DC, Moğolistan, Portekiz, Özbekistan, Çin) ve 2 havalimanı kuralı (Grönland: BGCO `America/Scoresbysund`, BGKK `America/Godthab`) halka açılmadan M6i.1'de eklendi (D-101). Savaş nedeniyle kapalı havalimanları (D-110) 33 bölge kuralı (Ukrayna'nın 27 ISO kodu ve OurAirports'un Rivne kodu UA-19: Europe/Kiev, Kırım ve Sivastopol Europe/Simferopol; Belgorod, Bryansk, Kursk, Lipetsk Europe/Moscow; Güney Kivu Africa/Lubumbashi) ve 1 havalimanı kuralı (Harkiv UKHH, OurAirports bölgesi UA-U-A) ekledi; ad `Intl`'in yazımıdır (Europe/Kiev; tzdb Europe/Kyiv). 5. halkanın 308 bölge kuralı (21 ülke: ABD 51, Endonezya 34, Meksika 29, Brezilya 27, Çin 27, Arjantin 24, Papua Yeni Gine 19, Yeni Zelanda 15, Kanada 13, Şili 13, Ekvador 12, Malezya 12, Rusya'nın uzak doğusu 9, Avustralya 8, Grönland 4, Mikronezya 4, Kiribati 2, Kongo DC 2, Marshall Adaları, Moğolistan ve Fransız Polinezyası 1'er), 68 havalimanı kuralı (bölgesi farklı farklı dilimlere bölünen 54: ABD 21, Kanada 20, Meksika 5, Saha 6, Brezilya ve Avustralya 1'er; OurAirports bölgesi kaba 6: Paskalya, Chatham, Nuuk, Markiz ikisi, Gambier; bölge varsayılanıyla aynı farkları olan, tzdb'ye sadık 8) ve 30 ISO eşi (Çin 27, MX-DIF → MX-CMX, EC-25 → EC-SE, ID-PP → ID-PE) halka açılmadan M6j.1'de eklendi (D-109): 2.028 aday (askerî listedeki üçü hariç) 225 dilimde, her dilim ülkesinin `Intl` listesinde. Fransız Polinezyası'nın OurAirports bölgesi ISO'da olmayan `PF-U-A`'dır (anahtar testinin adlı istisnası). Tarayıcıların eski ICU'su için iki seçim: Aysén (CL-AI) `America/Coyhaique` yerine aynı farkları olan `America/Punta_Arenas`; Pickle Lake (CYPL) diskteki tzdb kaynaklarına göre Atikokan gibi bütün yıl EST (`America/Coral_Harbour`), Tabatinga (SBTT) Amazonas'ın varsayılanı (`America/Manaus`, UTC−4; tzdb onu doğu-batı ayrım çizgisinin ucu olarak anar, iki listede de saymaz; çevrimdışı kanıt iki yöne de yetmez, ACTIVATION'daki ¹ denetimi). Orta güvenli kurallar (¹): CYPL, CYAQ ve SBTT; izleme listesinde CYPN (ACTIVATION). Sincan, Tibet, Gansu ve Qinghai Pekin saatidir (`Asia/Shanghai`; tzdb'nin `Asia/Urumqi`'si resmî değildir). OurAirports bazı ülkelerde ISO 3166-2'den farklı bölge kodu kullanır: Çin'de eski sayısal kodlar (CN-54/62/63/65), Brandenburg'da DE-BR, Kazakistan'da kendi harf kodları (ISO'nun 2020 öncesi harf kodları; 2022'de kurulan üç bölge için ISO'da olmayan KZ-ABA, KZ-JET, KZ-ULY; Baykonur KZ-BAY). ISO 3166-2:KZ 2020'den beri sayısaldır (KZ-10 … KZ-79). Bu ülkelerde ISO kodu da aynı dilimle tablodadır (CN-XZ, CN-GS, CN-QH, CN-XJ, DE-BB ve Kazakistan'ın 20 sayısal kodu), kaynak kodlarını değiştirirse dilim kaybolmaz (D-101; Kazakistan'ın sayısal kodları ağ olmadan doğrulanamadı).
- **Tablonun denetimi:** birim testi ülke tablosunu Node'un `Intl.Locale#getTimeZones()` çıktısıyla (tzdb `zone.tab` ile birebir aynı) ve her dilimi `Intl.supportedValuesOf('timeZone')` ile karşılaştırır; listelenen her havalimanının (açık halkalar) ve fixture'daki 4. halkanın 720 adayının bir dilimi olmalıdır. **Sunucunun fark tablosu (D-109):** havalimanı sayfasında farkları sunucu hesaplar (`utcOffsetTable`: çizim anının saat başından ±48 saat, saat başı taranır, geçiş dakikasıyla) ve adaya verir; ada tabloyu kaydeder (`registerUtcOffsetTable`) ve aralıktaki bütün yerel saatleri UTC + farktan yazar. Böylece tarayıcının tz verisi eski olsa da (Kazakistan 2024'ten beri tek dilim, tzdata 2024a; Britanya Kolumbiyası 2026'dan beri bütün yıl UTC−7, tzdata 2026b; Paraguay, Grönland) ya da tarayıcı dilimi hiç tanımasa da (eski tarayıcıda `America/Ciudad_Juarez`) sayfa sunucunun saatini gösterir ve hidrasyon farkı olmaz. Bilinen sınır: tablonun dışında (sayfa 48 saatten uzun açık kalırsa) tarayıcının `Intl`'i kullanılır, dilimi tanımayan tarayıcıda tablonun kenar farkı; harita penceresi farkı yine tarayıcıda hesaplar (2024 öncesi tzdata'lı tarayıcı Kazakistan'ı 1 saat ileri gösterir; ICU 2018h'den eski tarayıcıda `Asia/Qostanay` yoktur). Adlar `Intl`'in yazdığı biçimdedir (`Asia/Calcutta`; tzdb'de `Asia/Kolkata`'ya bağlantı): eski tarayıcılar da tanır.
- **Kullanılmayanlar:** dilim poligonları (timezone-boundary-builder; veri ODbL, paylaşım şartı ve 100+ MB) ve onlardan türeyen paketler (geo-tz 74 MB, ODbL; tz-lookup ve @photostructure/tz-lookup, README'ye göre yerleşik alanlarda ~%10 yanlış dilim); dilimi çalışma zamanında bir CDN'den çeken browser-geo-tz ("harici servislere yalnızca worker erişir" kuralına aykırı). "Ülkedeki en yakın `zone.tab` noktası" yöntemi 1. halkada Kuzey Kafkasya'yı UTC+4 yapıyordu.
- Bir sağlayıcı (`packages/providers`) değildir: hiçbir şey indirilmez, `DATA_USAGE_MODE` kapısı yoktur. tzdb yükseltmesi çalışma zamanıyla (Node imajı, tarayıcı) gelir; ülkelerin dilim değişiklikleri (yeni dilim, bölünme) ülke tablosu testini kırar ve tablo o zaman güncellenir.

**Lisans kaydı** (§ "Lisans kaydı"ndaki 7 alan)
- `commercialUse`: `true`. tzdb kamu malıdır (`zone.tab` başlığı: "This file is in the public domain").
- `attribution`: zorunlu değil; ATTRIBUTION.md'de nezaketen anılır.
- `shareAlike`: `none`.
- `rateLimit`: yok (çalışma zamanında istek yoktur).
- `b2cDisplayAllowed`: `true`.
- `mixingWithOtherRealtimeAllowed`: `true`.
- `maxRawStorageDays`: `null` (ham veri saklanmaz; kodda yalnızca ülke ve bölge → dilim tablosu vardır).

## 5b. Ülke adları ve yüzölçümleri — haritadaki ülke adı
Doğrulama: 2026-10-06 (Node 24 `Intl`, ICU 78; canlı istek atılmadı). Parça 1 M6e.7'den beri kullanılır (D-095); M6e.11'den beri bütün ülkeler (D-100).

- **Ne için:** canlı haritada her ülkenin adı, kademeli boyla. Ülke kümesi ve yüzölçümü (ad boyunun kademesi ve katmanlardaki sıra) üretilen tablodadır (`COUNTRY_LABEL_PLACEMENTS`, `COUNTRY_LABEL_AREAS_KM2`; §5c). Adın yeri başkente bağlı değildir: çevrimdışı üretici ülkenin içinde havalimanı pinlerinden ve kodlarından uzak boş bir yer, eşitlikte ülkenin görsel merkezine en yakın noktayı seçer (D-099, §5c). Tek istisna KIBRIS'tır: ad kullanıcı kararıyla Lefkoşa'da yazılır (D-095). OurAirports, VRS ve aviationweather.gov başkent ya da ülke yüzölçümü vermez.
- **Nasıl:** çalışma zamanında hiçbir yerden veri çekilmez. Kodda elle tutulan küçük bir tablo vardır (`packages/shared/src/reference/country-label-set.ts`): D-095'in 59 ülkesinin iç sular dahil yüzölçümü (100 km²'ye yuvarlı; Fransa, Danimarka ve Hollanda yalnızca Avrupa'daki toprağıyla, Sırbistan Kosova'sız, Kıbrıs adanın tamamıyla; genel coğrafi bilgi), kademe eşikleri ve istisnaları (Irak 1; dar ya da dağınık Şili, Mozambik ve Endonezya 2, D-100), adı yazılmayan İsrail ve Filistin, KIBRIS'ın çapası (Lefkoşa, 0,01°), RUSYA'nın çapa bölgesi (60° D'nin batısı, Avrupa Rusyası; D-100). Öbür ülkelerin yüzölçümü Natural Earth poligonlarından hesaplanır (§5c; küre üzerindeki alan, km²'ye yuvarlı).
- **Adlar:** ülke adı tarayıcının ve Node'un CLDR verisinden gelir (`Intl.DisplayNames`, D-080) ve sayfanın dilinin büyük harf kuralıyla yazılır (`toLocaleUpperCase`; Türkçede "i" → "İ"). Haritadaki adlar üretilen tabloya üreticinin Node'unun (24.16, ICU 78.3 / CLDR 48) adlarıyla yazılır (D-096); havalimanı sayfalarındaki adı tarayıcının kendi `Intl`'i çalışma zamanında verir. Beş ülkenin adı CLDR'ınkinin yerine elle tutulur (`COUNTRY_NAME_OVERRIDES`, D-100): Kongo Demokratik Cumhuriyeti / Democratic Republic of the Congo, Kongo Cumhuriyeti / Republic of the Congo (CLDR'ın "Kongo - Kinşasa" ve "Kongo - Brazavil" biçimleri yerine), Fildişi Sahili (Türkçe CLDR'ın Fransızca adı yerine; İngilizce Côte d’Ivoire), Myanmar ("Myanmar (Burma)" yerine) ve Svalbard ("Svalbard ve Jan Mayen" yerine). Kural ülkeye bağlıdır; havalimanı sayfasındaki ad haritadakiyle aynıdır. Havalimanına bağlı KKTC görünümü ülke adında kullanılmaz: Kıbrıs Lefkoşa'da "KIBRIS" / "CYPRUS" yazılır.
- **Kapsam (D-100):** havalimanı olsun olmasın bütün ülkeler: Natural Earth'ün ISO 3166-1 kodlu 244 birimi (§5c), İsrail, Filistin ve Antarktika hariç; sınırının içine hiçbir yakınlaştırmada sığmayan 80 küçük ülke ve adanın adı yazılmaz. Birim testi, listelenen (4. halka açık, D-102) ve fixture'da açık halkalarda listelenebilecek her havalimanının ülkesinin tabloda olduğunu denetler. Fixture'ın 5. halka satırlarından (D-109) yalnız Christmas (CX) ve Cocos (CC) tabloda yoktur: Natural Earth'te tek birimdedirler (Hint Okyanusu Toprakları) ve adın sığamayacağı kadar küçüktürler (D-100); test ikisini adıyla bekler.
- Bir sağlayıcı (`packages/providers`) değildir: hiçbir şey indirilmez, `DATA_USAGE_MODE` kapısı yoktur.
- **Yazı tipi:** adlar sitenin Overpass 600'üyle çizilir; dosyalar `apps/web/public/fonts/`'tadır (SIL OFL 1.1, ATTRIBUTION.md). Harita glif sunucusundan (`.pbf`) yazı tipi istenmez.

**Lisans kaydı: Unicode CLDR** (§ "Lisans kaydı"ndaki 7 alan; haritadaki 244 × 2 ad CLDR'dan üretilen tabloya yazılır ve web paketine girer, D-100)
- `commercialUse`: `true` (Unicode License v3 kullanma, kopyalama, değiştirme, dağıtma ve satmaya izin verir; lisans metni bu oturumda açılmadı, ağ yok: REFERENCES.md'de "doğrulanmadı").
- `attribution`: telif ve izin bildirimi kopyalarla ya da ilgili belgelerde; ATTRIBUTION.md'de "Unicode CLDR" girdisi. Bildirimin birebir metni doğrulanınca oraya eklenir (plan M6e.11).
- `shareAlike`: `none`.
- `rateLimit`: yok (çalışma zamanında istek yoktur; adlar üretimde tabloya yazılır).
- `b2cDisplayAllowed`: `true`.
- `mixingWithOtherRealtimeAllowed`: `true`.
- `maxRawStorageDays`: `null`.

## 5c. Natural Earth — ülke poligonları (yalnızca çevrimdışı araç; haritada çizilmez)
Doğrulama: 2026-10-05 (yalnızca yerel `node_modules`'taki world-atlas ve topojson-client paketlerinin README ve LICENSE dosyaları; canlı istek atılmadı, naturalearthdata.com şartları açılmadı: REFERENCES.md'de "doğrulanmadı" olarak durur). Parça 1 M6e.8'den beri kullanılır (D-096); M6e.11'den beri bütün dünya (D-100).

- **Ne için:** haritadaki ülke adının görünür kutusunun ülkenin kara poligonunun içinde kalıp kalmadığını hesaplamak. Üretici her ülke, dil ve harita genişliği için adın yerini ve ilk sığdığı yakınlaştırmayı bulur; yer, havalimanı pinlerinden ve kodlarından uzak boş bir noktadır (D-099; KIBRIS kullanıcı kararıyla Lefkoşa'dadır). Engeller commit'li OurAirports fixture'ının (2026-10-01 kopyası) haritada pini çizilen 1.240 havalimanıdır (56 + 1.184; savaş nedeniyle kapalı 23 havalimanı dahil, D-110): üretimin liste kuralı bu kopyaya uygulanır (4. halka açık, D-102); askerî hava üsleri listede yoktur (D-107; `mapShownAirports` savunma süzgeci bir şey çıkarmaz, D-103); ağ yok. Üretim OurAirports'u her gece yeniler; listesi fixture'dan ayrılırsa yeni pinler tablo yeniden üretilene kadar engel sayılmaz (kullanıcının karşılaştırması ACTIVATION'da "Ülke adlarının engelleri"); sonuç `packages/shared/src/map/country-label-placements.ts`'teki tablodur (~46 KB, gzip ~10 KB; 244 ülkenin yeri, ilk yakınlaştırması ve yüzölçümü; web onu haritayla birlikte dinamik importla yükler, hiçbir sayfanın ilk paketinde değildir, D-100). Geometri haritada çizilmez: çizilen sınırlar OpenFreeMap/OSM'dir (D-092), kıyı uydu görüntüsüdür.
- **Nasıl:** Natural Earth 4.1.0 Admin 0 – Countries 1:10m, `world-atlas@2.0.2` paketinin `countries-10m.json` TopoJSON'undan (ISC; Natural Earth'ün nicelenmiş kopyası, boylamda ~0,0036°, enlemde ~0,0017°) `topojson-client@3.1.0` ile (ISC; bağımlılığı `commander@2.20.3`, MIT, yalnızca paketin komut satırı araçları için) okunur. İkisi de yalnızca `tools`'un geliştirme bağımlılığıdır; üretim imajına girmez, çalışma zamanında hiçbir şey indirilmez. `pnpm country-labels:fixture` sadeleşmiş alt kümeyi (`tools/fixtures/naturalearth/countries.json`, yalnızca test) üretir, `pnpm country-labels` tabloyu fixture'dan hesaplar; ikisi de çevrimdışıdır.
- **Birimler (D-100):** world-atlas'ın 255 biriminin her biri tam bir koda ya da gerekçesiyle hiçbir koda verilir (`NATURAL_EARTH_UNITS`, `NATURAL_EARTH_UNASSIGNED`): sayısal ISO kodu olan her birim kendi alpha-2 koduyla (CLDR eşlemesi, testte); Kıbrıs adanın tamamıdır (Kıbrıs, K. Kıbrıs, BM ara bölgesi, Ağrotur ve Dikelya: KIBRIS / CYPRUS tek ad, Lefkoşa'da; D-095, D-099), Kazakistan Baykonur'la, Küba Guantánamo'yla, Somali Somaliland'le birlikte, Kosova ayrı birim (XK), Sırbistan Kosova'sız, Avustralya'nın iki birimi adla seçilir. Fransa'nın deniz aşırı bölgeleri (GF, GP, MQ, RE, YT), Norveç'in Svalbard ve Jan Mayen'i (SJ) ve Bouvet'si (BV), Hollanda'nın Karayip parçası (BQ) kutuyla ayrılır (`NATURAL_EARTH_PART_SPLITS`). Fas (504) ile Batı Sahra (732) birleştirilip 27°40′ K'de yeniden bölünür (`NATURAL_EARTH_LATITUDE_SPLITS`; aşağıda). İsrail, Filistin, Antarktika, ISO kodu olmayan tartışmalı buzul ve resifler, Clipperton, Mercan Denizi Adaları ve Hint Okyanusu Toprakları alınmaz. Sonuç 244 kod; adları `Intl`'dendir (§5b).
- **Tartışmalı bölgeler:** Natural Earth 4.1.0 fiilî durumu çizer. **Kırım Rusya'nın poligonundadır** (Türkiye'nin tutumu Kırım'ın Ukrayna'ya ait olduğudur); bu geometri yalnızca testte kullanılır, çizilmez ve hiçbir ad orada yazılmaz (RUSYA Avrupa Rusyası'nda, 46,74° D, 59,04° K; UKRAYNA ülkenin ortasında, 32,49° D, 49,4° K; placement.test.ts Rusya ve Ukrayna adlarının kutusunun Kırım'a hiçbir yakınlaştırmada girmediğini denetler). Abhazya ve Güney Osetya Gürcistan'ın, Transdinyester Moldova'nın, Karabağ Azerbaycan'ın poligonundadır. **Batı Sahra:** Natural Earth 4.1.0 Berm'i sınır çizer: Fas'ın (504) poligonu Fas yönetimindeki batıyı (Layun, Semara, Dahla) içerir, Batı Sahra (732) yalnız Berm'in doğusudur (~91 bin km²). Fixture ikisini 27°40′ K'de yeniden böler (D-100): Batı Sahra ISO 3166-1'in ve BM'nin bölgesidir (EH, ~269 bin km²; altlık bu çizgiyi tartışmalı sınır olarak çizer, OurAirports Layun, Dahla ve Semara havalimanlarını EH sayar), Fas onsuzdur (~414 bin km²). BATI SAHRA / WESTERN SAHARA Intl'in coğrafi adıdır, siyasi bir tutum değildir; placement.test.ts FAS kutusunun 27°40′ K'nin güneyine, BATI SAHRA'nınkinin kuzeyine girmediğini denetler. Somaliland Somali'dedir; Tayvan TW'dir (TAYVAN / TAIWAN).
- **Sadeleştirme ve kırpma (bütün dünya, D-100):** Douglas–Peucker 0,5 km; Türkiye'den uzak ülkelerde (sadeleşmemiş her noktası Ankara'ya ≥ 5.000 km olan ve yay paylaştığı her komşusu da bu uzaklık koşulunu sağlayan birimler; 106 kod; kural tek geçiştir, uzak ve yakın komşular sınır paylaşabilir, ülkelerin birbirine geçmediğini test denetler) 1 km, km payları 2,5 (yakınlarda 2). Ortak sınır iki komşuda aynı ve küçük toleransla sadeleşir. Yay sürekli kılınarak sadeleşir, uçları world-atlas'taki değerinde kalır; halkalar birleşince sürekli kılınır ve her ülke tek dünya kopyasına konur (Rusya 19,6–190,4° D, ABD 187,5° B–67° B, Fiji 177,3–180,2° D). Kırpma kutusu 200° B–200° D, 60° G–84° K: hiçbir ülkeyi kesmez, Mercator'u sonlu tutar. Küre üzerindeki alanı 100 km²'den küçük adalar, ülkenin en büyük parçası değilse düşer; koordinatlar 0,001°'ye yuvarlanır: 244 kod, 199.104 nokta, ~2,03 MB (her yerde 0,5 km olsa 2,38 MB). Fixture her ülkenin Natural Earth yüzölçümünü de taşır (`areasKm2`: bütün parçalar, sadeleşmeden, küre üzerinde). Testler ham 1:10m sınırın her noktasının fixture sınırına en çok kendi toleransı + 0,1 km uzak olduğunu ve ülkelerin örtüşmediğini (hiçbir sınır noktası başka bir ülkenin içinde değil) bütün dünyada denetler.
- Bir sağlayıcı (`packages/providers`) değildir: çalışma zamanında istek yoktur, `DATA_USAGE_MODE` kapısı gerekmez.

**Lisans kaydı** (§ "Lisans kaydı"ndaki 7 alan)
- `commercialUse`: `true`. Natural Earth verisi kamu malı olarak yayımlanır (naturalearthdata.com "Terms of Use"; bu oturumda ağ olmadığı için açılmadı, doğrulaması plan M6e.8'de açık iş). world-atlas README'si yalnızca Natural Earth 4.1.0'ın TopoJSON olarak yeniden dağıtımı olduğunu söyler; paketin kendi lisansı ISC'dir (`LICENSE`, Michael Bostock).
- `attribution`: zorunlu değil; ATTRIBUTION.md'de nezaketen "Made with Natural Earth".
- `shareAlike`: `none`.
- `rateLimit`: yok (çalışma zamanında istek yoktur).
- `b2cDisplayAllowed`: `true` (yalnızca türetilmiş tablo yayımlanır: ülke kümesi, ad konumları, ilk yakınlaştırmalar ve D-095 listesi dışındaki 185 ülkenin poligonlardan hesaplanan yüzölçümü; poligonlar yayımlanmaz).
- `mixingWithOtherRealtimeAllowed`: `true`.
- `maxRawStorageDays`: `null` (sadeleşmiş alt küme yalnızca `tools/fixtures`'ta, testler için).

## 6. Harita — OpenFreeMap
- **Şartlar:** Anahtar yok, ticari kullanım serbest, sayı limiti yok, **SLA yok**.
- **Stiller:** açık `https://tiles.openfreemap.org/styles/liberty`, koyu `.../styles/dark` (alternatif `fiord`). Env: `MAP_STYLE_URL`, `MAP_STYLE_URL_DARK`, `MAP_STYLE_FALLBACK_URL`. Testte yerel `test-style.json` kullanılır.
- **Atıf:** Zorunlu metin "© OpenMapTiles Data from OpenStreetMap"; "OpenFreeMap" ibaresi tavsiye edilir.
- **Önbellek yasağı:** Karo, stil, glif ve sprite'ların toplu indirilmesi ve service worker'da önbelleğe alınması yasaktır.
- **Hata durumu:** Stil 3 kez yüklenemezse yedek stile (`MAP_STYLE_FALLBACK_URL`) geçilir. O da yüklenemezse uçaklar sade bir arka planda çizilir ve "Harita altlığı yüklenemedi" şeridi çıkar. Uydu açıkken zincir: uydu → koyu stil → `MAP_STYLE_FALLBACK_URL` → sade arka plan (D-075). Altlık yüklenirken de uçaklar sade arka planda çizilir.
- **Self-host yedeği (RUNBOOK):** Protomaps PMTiles bölgesel kesit. Tüm dünya dosyası ~120 GB'tır ve KVM 2 diskine sığmaz. Kod BSD, karolar ODbL (OSM atfı zorunlu).
- MapTiler Free ticari kullanıma kapalıdır.
- **Uydu anahtarı yokken:** Harita koyu stille açılır ve yollar gizlenir: `source-layer`'ı `transportation` ya da `transportation_name` olan katmanlar kapanır, `aeroway` kalır (D-075).
- **Ülke sınırları (D-092; doğrulama 2026-10-04: openfreemap.org ana sayfa ve ToS, OpenFreeMap README, openfreemap-styles deposu, openmaptiles.org/schema ve OpenMapTiles `layers/boundary`):**
  - **Uydu üstünde:** Esri görüntüsünde sınır yoktur. Uyduya OpenFreeMap'in OpenMapTiles vektör karolarından ayrı bir kaynak eklenir. TileJSON `https://tiles.openfreemap.org/planet`'tır: OpenFreeMap stillerinin kullandığı adres. README `/planet/latest`'ı da belgeler; ikisi de son yayımlanan karo sürümüne gider.
  - **Süzgeç:** Katman `boundary`'dir. Yalnızca kara ülke sınırları çizilir: `admin_level = 2`, `maritime ≠ 1` ve `claimed_by` yok. `claimed_by`, bir ülkenin kendi iddiasına göre görmek istediği çizgidir. Karolar z0–z4'te Natural Earth, z5–z14'te OSM verisidir.
  - **Koyu stilde:** indirilen OpenMapTiles stilinde `boundary` katmanından çizilen bütün çizgi katmanları (ülke ve il sınırı) çıkar. Yerlerine uydudaki üç katman, stilin kendi kaynağıyla girer.
  - **Yerel stilde** (`EXTERNAL_PROVIDERS_DISABLED=true`) sınır kaynağı hiç eklenmez; dış istek gitmez.
  - **Aracı yok:** Karoları tarayıcı doğrudan çeker. Worker, API ve CDN aracılık etmez, sunucu önbelleği yoktur; service worker karo saklamaz (yukarıdaki önbellek yasağı ve Esri E204 §3.1d.2 aynı yolu ister).
  - **İstek hacmi:** Kaynağın `maxzoom`'u 10'dur; MapLibre'de stildeki değer TileJSON'daki 14'e üstün gelir.
    - z10'a kadar her yeni görünüm 512 px'lik karolar ister: 1920×1080'de ~9–20, telefonda ~4–6. Bu, Esri'nin 256 px'lik karolarının yaklaşık dörtte biridir.
    - z10'un üstünde 1–4 z10 karosu büyütülür; çoğu zaten tarayıcı önbelleğindedir. Sayfa açılışında bir de TileJSON isteği vardır.
    - MapLibre karonun bütün katmanlarını indirir (yalnızca `boundary`'yi değil); bu kabul edildi. Bayt hacmi yayından sonra ölçülür (ACTIVATION).
    - OpenFreeMap'in şartı: "there are no limits on the number of map views or requests". ToS izinsiz otomatik veri toplamayı yasaklar; her istek bir kullanıcının görünümüdür, toplu indirme yoktur. Referrer başına sınır 2025'te plan olarak duyurulmuştu; uygulandığı doğrulanamadı (2026-09-25 araştırması).
  - **Hata:** TileJSON ya da karo hatası altlık zincirini etkilemez (`NON_BASEMAP_SOURCES`). Uydu yerinde kalır; yalnızca sınırlar çizilmez ve OSM atfı şeritten düşer.
  - **Atıf:** Sınır kaynağı kendi atfını taşır (`OPENFREEMAP_ATTRIBUTION`; TileJSON'daki atfın yerine). MapLibre onu sınır katmanları çizilirken şeride koyar; katmanlar her yakınlaştırmada çizilir. Esri ve canlı veri atıfları değişmez, site künyesi ilk sıradadır (D-089).
  - **Esri ile birlikte:** E204 §3.1a.4, Esri çıktısının açık veritabanı lisansına bağlanmasını yasaklar. Sınır çizgileri ve görüntü yalnızca tarayıcıda üst üste çizilir. ODbL'nin üretilmiş eser kuralı (§4.3) yalnızca atıf ister; birleşik bir veritabanı oluşmaz ve Esri görüntüsü ODbL'ye girmez.

**Lisans kaydı** (§ "Lisans kaydı"ndaki 7 alan; `packages/providers/src/license.ts` → `openFreeMap`)
- `commercialUse`: `true`. SSS'deki "Is commercial usage allowed?" sorusunun yanıtı "Yes"tir.
- `attribution`: "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". OpenMapTiles ve OSM kısmı zorunludur, OpenFreeMap kısmı tavsiye edilir. Vektör altlıkta ve uydudaki sınırlar çizilirken haritada görünür.
- `shareAlike`: `none`. OSM verisi ODbL'dir ama paylaşım şartı türetilmiş veritabanı içindir. Karolar yalnızca tarayıcıda çizilir (üretilmiş eser); saklanmaz ve hiçbir veritabanımıza girmez.
- `rateLimit`: Sayı sınırı yok, SLA yok, toplu indirme yasak.
- `b2cDisplayAllowed`: `true`.
- `mixingWithOtherRealtimeAllowed`: `true`. Canlı uçaklar ve uydu görüntüsüyle birlikte gösterilmesini yasaklayan bir şart bulunmadı.
- `maxRawStorageDays`: `null`. Kaynak bir sınır koymaz; biz hiç saklamayız (karo ve stil yalnızca tarayıcının standart önbelleğindedir).

## 6a. Uydu altlığı — Esri World Imagery
Doğrulama: 2026-09-28 (Esri'nin fiyat sayfası, E204 sözleşmesi ve geliştirici belgeleri; D-075). Kullanıcı ücretsiz katmanı seçti (2026-09-28).

**Erişim**
- **Hizmet:** ArcGIS Location Platform, ücretsiz katman. Ayda 2 milyon temel harita karosu verir. Kullandıkça öde açılmadıkça kota dolunca servis durur, fatura çıkmaz. Kotadan sonrası 1.000 karo başına 0,15 $'dır.
- **Karo adresi:** `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=<ESRI_API_KEY>`. Karolar 256 px'tir, en büyük yakınlaştırma 19'dur. Sıra `{z}/{y}/{x}`'tir (satır önce).
- **Anahtar:** API anahtarını kullanıcı kendi hesabında üretir (ACTIVATION); env `ESRI_API_KEY`, isteğe bağlıdır. Anahtar yalnızca "Basemaps" yetkisini taşır. İzinli referrer'lar üretim alan adlarıdır, süre en çok 1 yıldır ve her yıl yenilenir. Anahtar karo adresinde tarayıcıya görünür; bu kaçınılmazdır (D-075).
- **Anahtarsız uç nokta yasak:** Örneklerde sık görülen `server.arcgisonline.com/.../World_Imagery/...` adresi bu kullanım için lisanslı değildir. Hiçbir yerde kullanılmaz.
- **Görüntü:** LTFM'de 0,34 m, 2025-05-23 (Vantor "Vivid Advanced"); İstanbul merkezinde 0,46 m.

**Lisans kaydı** (§ "Lisans kaydı"ndaki 7 alan)
- `commercialUse`: `true`. E204 §3.1c.1 gelir getiren uygulamalara izin verir.
- `attribution`: "Powered by Esri" ve hizmetin telif metni "Esri, Vantor, Earthstar Geographics, and the GIS User Community" (§3.1d.4; §3.1a.3 atfın kaldırılmasını ya da gizlenmesini yasaklar). Harita atıf kutusunda her zaman görünür.
- `shareAlike`: `none`. Ters yönde bir kısıt vardır: §3.1a.4'e göre Esri çıktısı açık veritabanı lisansına bağlanamaz. Görüntü yalnızca gösterilir, ODbL altındaki iz veritabanına girmez.
- `rateLimit`: Ayda 2 milyon karo (ücretsiz katman). Kota dolunca servis ay sonuna kadar durur ve harita vektör altlığa geçer.
- `b2cDisplayAllowed`: `true`. Yalnızca görselleştirme için ve yalnızca kendi uygulamamızda gösterilir (§3.1d.3).
- `mixingWithOtherRealtimeAllowed`: `true`. Başka kaynaklı verinin bu altlık üstünde gösterilmesini yasaklayan bir madde bulunmadı.
- `maxRawStorageDays`: `0`. Karo saklanmaz. Tarayıcı önbelleği yalnızca HTTP başlıklarının izin verdiği kadardır (§3.1d.6A).

**Şartlar** (E204 ArcGIS Location Platform Agreement, rev. 2025-11-21)
- **§3.1c.1:** Ticari (gelir getiren) uygulamaya izin verilir.
- **§3.1d.2:** Bir isteğin çıktısı yalnızca tek bir kullanıcıya hizmet eder. Proxy ve paylaşılan önbellek yoktur: karoyu worker, API ya da CDN aracılığıyla değil, tarayıcı doğrudan çeker.
- **§3.1d.6:** Kazıma, toplu indirme ve saklama yasaktır. Önbelleğe alma yalnızca HTTP önbellek başlıklarının izin verdiği kadardır. Service worker karo önbelleği, çevrimdışı ve mobil karo paketi yoktur.
- **§3.1d.1:** Çıktı yeniden markalanamaz ve üçüncü taraflara dağıtılamaz.
- **§3.1c.5:** Uygulama kullanıcılarının Esri şartlarına uymasını isteyen bir madde kullanım koşullarında yer almalıdır. M6'dan beri geçici kullanım koşulları (`/kullanim-kosullari`) bu maddeyi taşır: haritayı kullanan Esri'nin geçerli şartlarına (E204 ve ürüne özgü şartlar E300, bağlantılı) uymayı kabul eder; karolar indirilemez, kazınamaz, saklanamaz ve dağıtılamaz. Bağlantı harita atıf satırında ve site alt bilgisinde her zaman görünür. Metin geçicidir; Parça 3 M6a'da genişletilir, hukukçu incelemesi ACTIVATION'dadır (D-075).
- **§3.1b.5:** Esri ürünleriyle rekabet eden ürüne katılım yasaktır. Herkese açık uçuş takibi için büyük olasılıkla sorun değildir; kesin değildir (D-075).

**Kaynaklar** (erişim 2026-09-28)
- Fiyatlar: https://location.arcgis.com/pricing/
- E204 sözleşmesi: https://www.esri.com/content/dam/esrisites/en-us/media/legal/platform/platform-legal.pdf
- Ürüne özgü kullanım şartları (E300; ArcGIS Location Platform maddeleri dahil): https://www.esri.com/content/dam/esrisites/en-us/media/legal/product-specific-terms-of-use/e300.pdf
- Statik temel harita karoları: https://developers.arcgis.com/rest/static-basemap-tiles/
- Anahtar güvenliği: https://developers.arcgis.com/documentation/security-and-authentication/security-best-practices/

## 7. Ticari seçenekler (v1'de yok; Parça 5 için)
| Sağlayıcı | Ne verir | Giriş fiyatı (2026-09) | Kritik şart |
|---|---|---|---|
| AeroDataBox | tarife, FIDS, kapı, durum | ~19 $/ay (direct) | B2C uygulamada gösterim izinli; ham veriyi üçüncü tarafa açmak yasak |
| AirLabs | tarife/pano (kapı, rötar), webhook (beta) | 49–99 $/ay | "As is" yeniden satış yasak; yazılı onay alınmalı |
| Aviationstack | tarife, kapı, rötar | 49,99–149,99 $/ay | ücretli planlarda ticari kullanım; B2C gösterim için yazılı onay |
| FlightAware AeroAPI Standard | tarife, kapı, rötar, `on`/`in` webhook alarmı | en az 100 $/ay | adsb.lol verisiyle birlikte kullanım FlightAware'in **yazılı iznini** gerektirir (md. 10); ham veri ≤ 30 gün; "commercial aircraft situational displays" kullanımı yasak (md. 8) |
| Flightradar24 API | konum, özet (tarife yok) | 9 / 90 / 900 $/ay | **kullanılamaz:** rakip ürün ve başka kaynağı tamamlama yasak (ToS 6.3.1) |
| Cirium (FlightStats) | tarife ve durum; havalimanı panosu/FIDS/alarm yalnızca sözleşmeli Premium'da | Commercial plan kredi kartıyla, kullandıkça öde (standart API'ler) | Track/Flights Near API'leri "Powered by FlightRadar24" |
| OAG | tarife (15 dk'da bir), durum, kapı; Flight Info Alerts; konum yok | ücretsiz keşif katmanı (aylık sınırlı); ücretli katmanlar teklifle | abonelik şartları incelenmeli |
| ADSBx Enterprise | yalnızca konum/operasyon; tarife yok | teklifle, yıllık asgari taahhüt | Community API (10 $) ticari kullanıma kapalı |
