# İşletim el kitabı

Üretimde bir şey ters gittiğinde izlenecek adımlar. Ajan üretim DB'sine ve Dokploy ayarlarına kendiliğinden dokunmaz (CLAUDE.md DUR-SOR 4). Aşağıdaki adımları kullanıcı yapar ya da ajana açıkça izin verir. Parça 4 bu dosyayı tamamlar.

## adsb.lol API anahtarı istemeye başladı (401/403)
**Belirti:** admin Servisler'de "Canlı veri · adsb.lol" satırı "Çalışmıyor"; devre "yapılandırma hatası". hy-worker-rt logunda `adsblol config error` satırı var.

**Ne olur:** 401/403 kısıtlama değil politika ya da yapılandırma hatasıdır. Worker devreyi kalıcı açar ve süreç yeniden başlayana kadar adsb.lol'e istek atmaz (D-073). Harita son veriyi 120 sn tutar, sonra boşalır.

1. **Duyuruyu kontrol et:** https://status.adsb.lol ve https://github.com/adsblol/api. Anahtar zorunluluğu mu geldi, yoksa User-Agent'ımız mı reddediliyor?
2. **User-Agent:** Dokploy Environment'ta `CONTACT_EMAIL` dolu mu? User-Agent `Airline.live/<sürüm> (+https://airline.live; <CONTACT_EMAIL>)` biçiminde gider (`APP_NAME` ve `WEB_HOST`'tan; D-112). Boş ya da `node` UA 403 alır.
3. **Anahtar istendiyse:**
   - adsb.lol anahtarı besleyicilere verir (kendi alıcımız yok, D-006). Seçenekler: alıcı kurup beslemek ya da info@adsb.lol'e yazmak.
   - Anahtar alınınca Dokploy'a `ADSBLOL_API_KEY` ve istenen başlık adıyla `ADSBLOL_API_KEY_HEADER` girilir.
4. **Yeniden başlat:** Dokploy'da hy-worker-rt yeniden başlatılır ya da yeniden deploy edilir; devre açılışta kapanır.
5. **Doğrula:** 2 dk içinde admin satırı "Çalışıyor" olur. Sağlık kaydı dakikada bir yazıldığı için "Son başarılı yanıt" bir dakikaya kadar eski görünebilir.

Başka bir canlı kaynağa geçmek DUR-SOR'dur (lisans kaydı, data-sources.md).

## Sağlayıcı kesintisi ve 429 fırtınası
**Belirti:** admin satırı "Sorunlu" (429/5xx oranı > %20 ya da tazelik > 40 sn) ya da "Çalışmıyor" (60 sn boyunca başarılı yanıt yok). "429 oranı (1 sa)" yükseliyor.

**Ne olur (otomatik):**
- 429/420'de istek hızı yarıya iner (alt sınır 0,05 istek/sn) ve üstel bekleme (15 → 300 sn) başlar.
- 5xx ve ağ hatası 5 kez üst üste gelirse devre 60 sn açılır, sonra tek deneme yapılır.
- Temiz geçen her 10 dk'da hız %10 toparlanır (üst sınır 0,2).
- Olay motoru geldiğinde (Parça 2), muhtemel iniş tespiti kesinti boyunca bastırılır (domain.md → Kesinti bastırma).

**Kontrol:**
1. https://status.adsb.lol: genel bir kesinti var mı?
2. **Tek taraflı kısıtlama:** Genel kesinti yoksa sorun VPS IP'sine özgü olabilir. Başka bir ağdan tek istekle denenir:

   ```bash
   curl -s -o /dev/null -w '%{http_code}' -A 'Airline.live/test (+https://airline.live)' https://api.adsb.lol/v2/point/41.27/28.73/5
   ```

   Bu canlı bir istektir; yalnızca kullanıcı çalıştırır.
3. **Süreklilik:** 429 oranı saatlerce %20'nin üstünde kalırsa `ADSBLOL_RPS` düşürülebilir (en az 0,05); Dokploy env'i değişir ve worker yeniden başlar. Hızı 0,2'nin üstüne çıkarmak yalnızca 24 saatlik ölçüm ve DECISIONS kaydıyla yapılır (data-sources.md).
4. **Kapsama raporu:** Kesinti uzarsa M7 kapsama raporu o saatleri ayrı gösterir; iniş kalitesi yorumlanırken dikkate alınır.

## aviationweather.gov 403 ya da 429 (hava durumu)
**Belirti:** admin Servisler'de "Hava durumu · aviationweather.gov" satırı "Sorunlu" (429 engeli, son denetimden yeni hata ya da taze gözlemli istasyon yok) ya da "Çalışmıyor" (METAR denetimi 2 sa'ten eski ya da 403 engeli). Ayrıntıda hata ve engelin bitiş saati yazar. hy-worker-bg logunda `weather` satırları var.

**Ne olur (otomatik, D-078):**
- **429:** İş içinde yeniden denenmez. Worker `max(Retry-After, 10 dk)` boyunca istek atmaz; zamanlanmış çalışmalar istek göndermeden atlanır, sonra kendiliğinden devam eder.
- **403:** Worker 1 sa istek atmaz, satır "Çalışmıyor" olur. Bu bir kısıtlama değil, kaynağın davranışının değiştiği anlamına gelir (DUR-SOR 3): ajan kendiliğinden bir şey değiştirmez, kullanıcıya bildirir.
- **5xx, zaman aşımı:** 60 sn sonra bir kez yeniden denenir; sonraki zamanlanmış çalışma yine dener.
- Sayfa ve harita son geçerli raporu yaşıyla göstermeye devam eder; 3 sa'ten eski rapor "Eski gözlem", 12 sa'ten eskisi "güncel rapor yok" olur. Hiçbir rapor uydurulmaz ya da başka havalimanından alınmaz.
- **Engel bitince kayıt dolar:** ilk başarılı METAR isteği son başarılı denetimden bu yana geçen süreyi (+1 sa, en çok 24 sa) ister; METAR/TAF kaydında delik kalmaz. İstasyonlar listelenen havalimanlarıdır (5. halkayla 3.266 listelenen, dört harfli olmayan CAJ4 ve CAT4 hariç 3.264 istasyon; savaş nedeniyle kapalı 23 havalimanı dahil, D-110; askerî hava üsleri hariç; D-080, D-088, D-090, D-102, D-107, D-118): bu istek onları geriye bakışa göre gruplara böler (24 saatlik doldurmada istek başına 6 istasyon, 544 istek; 4. halkada 1.240 istasyonla 207), sonra olağan 41 METAR isteğine (80 × 40 + 64 istasyon) döner. İki isteğin başlangıcı arasında en az 700 ms geçer (`AWC_MIN_REQUEST_INTERVAL_MS`): 544 isteklik doldurma ~6,3 dk sürer (543 × 0,7 ≈ 380 sn; sonraki METAR işi bekler) ve dakikada 100 sınırının altında kalır (herhangi bir dakikada en çok 86). Listeye yeni giren ya da son 24 saatte hiç METAR'ı saklanmamış istasyon da worker süreci başına bir kez 24 saatle istenir (yeni halka yayını, worker yeniden başlatması). 24 saatten uzun kesintinin en eski kısmı ve kesintide yerini yenisine bırakan TAF'lar alınamaz.

**Kontrol:**
1. https://aviationweather.gov/data/api/ ve https://aviationweather.gov/data/feed/changelog.json: yeni bir kısıt, parametre değişikliği ya da duyuru var mı? Belgelenmemiş parametreler 400 döner (v4.26).
2. Sıklık: worker olağan durumda saatte ~560 istek atar (5. halkayla 3.264 istasyon, D-111, D-118; 4. halkada 1.240 istasyonla ~220, 3. halkada 498 istasyonla ~96): METAR 5 dk'da bir 41 istek (saatte 492), TAF 15 dk'da bir 17 istek (saatte 68); iki isteğin başlangıcı arasında en az 700 ms vardır (herhangi bir dakikada en çok 86 istek); sınır dakikada 100'dür. Sayılar istasyon kümesiyle değişir; güncel hâli data-sources.md §5 → "İstek düzenimiz"dedir. **Gerçek sayı günlüktedir** (D-101): hy-worker-bg'nin `hava durumu güncellendi` satırının `result.requests` alanı o çalışmada AWC'ye atılan istek sayısıdır (gruplar, 400 kayıt sınırındaki bölünmeler ve 24 saatlik doldurma dahil; `job` METAR için `weather-metar`, TAF için `weather-taf`). Olağan değer METAR 41, TAF 17'dir (4. halkada 16 ve 7, 3. halkada 7 ve 3). TAF'ta 7'den büyük değer grupların 400 kayıt sınırında bölündüğünü gösterir (grup başına en çok 7 istek); sıklaşırsa TAF grubu 200'den 100'e indirilir (D-090). Yeni halka yayınından ya da worker yeniden başlatmasından sonraki ilk METAR çalışması daha büyüktür: son 24 saatte METAR'ı saklanmamış her istasyon 6'şarlı gruplarla 24 saat istenir. 5. halkanın yayınında (D-118) kaydı olmayan ~2.087 istasyon 348 istek, kaydı olanlar olağan 15 istek: ilk çalışma ~363 istek, ~254 sn (D-111). 4. halkanın yayınında 719 yeni istasyon 120 istek, kaydı olan eski istasyonlar olağan gruplarla (498'in hepsinin kaydı varsa 7 istek): ilk çalışma 127; üretimde 3. halkanın 503 istasyonundan ~40'ının METAR'ı yoktur (M6h doğrulaması: METAR'lı 463/503), onlar da istenir ve ilk çalışma ~133 olur (6 + 127; 3. halkanın yayınında 50). Sonraki her worker açılışında METAR'ı olmayan istasyonlar yine bir kez istenir. Yeni rapor yazılmayan çalışma yalnız `debug` düzeyinde (`hava durumu kontrol edildi`) yazılır, üretim günlüğünde görünmez. `hava durumu: yanıt 400 kayıt sınırında` uyarısı da `requests` taşır. 429 sürüyorsa aynı IP'den başka bir uygulamanın AWC'ye istek atıp atmadığına bak (sunucu başka projelerle paylaşılır).
3. User-Agent: `Airline.live/<sürüm> (+https://airline.live; <CONTACT_EMAIL>)` biçiminde gider. AWC özel User-Agent önerir.
4. **Engel kalkmıyorsa:** NWS yönergesi engellenen kullanıcının sdm@noaa.gov'a yazmasıdır. Bu e-postayı kullanıcı gönderir; içerik: uygulamanın tanımı, istek sıklığı (olağan durumda saatte ~560 istek: 3.264 istasyon, METAR 5 dk'da bir 41 istekte, TAF 15 dk'da bir 17 istekte; kesintiden sonra bir kez 24 saatlik doldurma, 544 istek; iki istek arasında en az 700 ms), User-Agent ve VPS IP'si. Göndermeden önce sayıları data-sources.md §5'le karşılaştır.
5. Tek istekle elle deneme canlı bir istektir; yalnızca kullanıcı çalıştırır:

   ```bash
   curl -s -o /dev/null -w '%{http_code}' -A 'Airline.live/test (+https://airline.live)' 'https://aviationweather.gov/api/data/metar?ids=LTFM&format=json'
   ```

Toplu önbellek dosyalarına (`/data/cache/…`) ya da başka bir hava durumu kaynağına geçmek DUR-SOR'dur (lisans kaydı, data-sources.md §5; önbellek XML'inde basınç inHg'dir).

## İçe aktarım kayması (`referans verisi kayması`, D-109)
**Belirti:** hy-worker-bg günlüğünde gece OurAirports içe aktarımından sonra `referans verisi kayması` satırı **warn** düzeyinde. Satır her içe aktarımdan sonra (yeni veri ya da "değişmedi") bir kez yazılır; sapma yoksa info düzeyindedir. İçe aktarım başarısızsa satır yazılmaz; okuma başarısızsa yalnız `referans verisi kayması ölçülemedi` uyarısı vardır, içe aktarım etkilenmez.

**Alanlar** (`drift`; her sayım `{ count, examples }`, örnekler sıralı ve en çok 10):
- `listed`: listelenen havalimanları (açık halkalar). M6j.3'ten beri bütün halkalar açık: 2026-10-01 kopyasıyla 3.266 (D-118; 4. halkada 1.240, savaş nedeniyle kapalı 23 havalimanıyla, D-110; önce 1.217); üretim gece yenilendiği için birkaç havalimanı farklı olabilir.
- `withoutTimeZone`: saat dilimi kuralı olmayan listelenen havalimanları (OurAirports yeni bir bölge kodu getirdi). Sayfada saatler UTC'dir ("Saatler UTC’dir…"); kullanıcıya yanlış saat gösterilmez (yalnız dilimsizler; bölge varsayılanı yanlış olan yeni havalimanı burada değil `withoutCuratedName`'de görünür). Çözüm: `packages/shared/src/reference/time-zones.ts`'e kural (bölge, gerekirse havalimanı), birim testi ve yayın.
- `unknownSurfaces`: görünen pistlerdeki tanınmayan dolu kaplama kodları (UNK hariç). Sayfa "bilinmiyor" yazar. Çözüm: `runway-surface.ts` tablosu.
- `duplicateIata`: iki listelenen havalimanında geçen IATA kodu. `/istasyon/<IATA>` ve `GET /v1/airports/<IATA>` küçük ICAO'lu olana gider; diğeri yalnız ICAO'suyla açılır. Kaynakta düzelmezse ad ve kod tablosu kararı (DECISIONS).
- `withoutCuratedName`: küratörlü Türkçe/İngilizce adı olmayan listelenen havalimanları; OurAirports adıyla gösterilir ("Airport" → "Havalimanı"). 5. halka açılmadan önce sıfırdır; halka açılınca adlar halkayla gelir (M6j.3). Sonradan gelen her örnek yeni ya da kodu değişmiş bir havalimanıdır; bölge varsayılanıyla yanlış dilim alan havalimanının tek işareti budur (`withoutTimeZone` yalnız dilimsizleri sayar). Çözüm: ad tablosuna satır ekle; havalimanının ülkesi `COUNTRY_TIME_ZONES`'ta yoksa (ABD, Kanada, Meksika, Rusya, Brezilya, Avustralya …) bölge varsayılanının o havalimanının saati olduğunu denetle (ör. Florida Panhandle'ı ve batı Kentucky Central'dır, varsayılan Eastern; Kansas'ın Goodland'ı ve Oregon'un Ontario'su Mountain). Varsayılan yanlışsa `packages/shared/src/reference/time-zones.ts` `AIRPORT_TIME_ZONES`'a satır ve birim testi ekle.
- `curatedNotListed`: ad tablosunda olup listelenmeyen havalimanları (OurAirports tarifeli bayrağını kaldırdı, havalimanı kapandı ya da kodu değişti). Savaş kapanışları tablosundaki bir havalimanının türünü OurAirports `closed` ya da `small_airport` yaparsa havalimanı listeden düşer ve burada görünür (D-110; aşağıda "Savaş kapanışları tablosu"). Kodu değişmişse adres takma adı eski kodu yine yönlendirir (D-109); tabloyu temizlemek ayrı bir küçük iştir.
- `icaoCollisions`: aynı kanonik ICAO'yu taşıyan ikinci aday satır (`listedEntries` en küçük kimliklisini gösterir, öbürü görünmez). Kaynak düzeltmesi (`OURAIRPORTS_ICAO_CORRECTIONS`) gerekebilir.

**Kontrol:** hiçbiri acil değildir; kullanıcıya dönük her durumun güvenli bir yedeği vardır; tek istisna, çok dilimli bir ülkede yeni listelenen havalimanının bölge varsayılanıyla yanlış dilim almasıdır (`withoutCuratedName` örneklerini dilim için de denetle). Satır takma ad çakışmasını da saymaz: `IDENT_ALIAS_EXCLUSIONS` fixture tazelenirken üreticinin sayımıyla denetlenir (D-109). Satırı haftada bir oku; sayı büyürse (özellikle 5. halka açıldıktan sonra) kuralı ekleyen küçük bir yama aç. Kodda yeni kural eklemek üretim verisine dokunmayı gerektirmez.

## Savaş kapanışları tablosu (D-110)
**Ne:** `packages/shared/src/reference/civil-closures.ts` → `CIVIL_FLIGHT_CLOSURES` (db kopyası `packages/db/src/airports.ts` → `CIVIL_FLIGHT_CLOSURE_ICAOS`; `apps/api/src/reference/rings.test.ts` eşitliği denetler). Normal şartlarda sivil yolcu seferi alan ama savaş nedeniyle sivil uçuşa kapalı havalimanları: tablodaki havalimanı aday kuralında tarifeli sayılır ve sayfası, harita penceresi ve havalimanı listesi notu gösterir (kesin ya da "olabilir"). Tablo durağandır; durum yayınlar arasında değişebilir (Mekele araştırmadan üç gün sonra açıldı).

**Ne zaman:** her havalimanı yayınında, ayda bir ve tarihli işaretlerde.
- Ukrayna NOTAM'ı A0081/26 2026-12-21'de biter; yerine geleni oku.
- EASA CZIB'lerinin yeni revizyonları: Suriye 2026-11-30, Ukrayna ve Rusya 2027-01-31.
- Rosaviatsiya'nın açılış duyuruları (favt.gov.ru haberleri; Rosaviatsiya uzatma duyurusu yayımlamaz, yalnız açılışları duyurur).
- Belirsiz kayıtların her birinde havayolu ve havalimanı duyuruları (Kamışlı, Sana, Taiz, El Faşir, Nyala, El-Obeid, Aksum, Gao, Mopti).

**Nasıl** (ajan web araştırması yapabilir, uçuş verisi API'si çağrılmaz; adresler `docs/REFERENCES.md` → "Savaş kapanışları (D-110)"):
1. Her kaydın durumunu resmî kaynaktan oku; okunma tarihini yaz.
2. Açılan kaydı sil; kesinleşen ya da belirsizleşen kaydın `certainty` değerini değiştir (ölçüt D-110 → "Not türü"). Silinen ya da eklenen kodu db kopyasında da değiştir.
3. D-110'a tarih ve kaynakla yaz.
4. Silinen havalimanı OurAirports'ta tarifesizse listeden çıkar: fixture yeniden üretilir (`scripts/make-reference-fixtures.mts`, kapanış bloğu), sayılar değişir (liste, halka sayıları, site haritası, pinler; `pnpm country-labels`).
5. PATCH yayını yap.

**Yeni kayıt** D-110'un ölçütüyle girer (savaş öncesi düzenli sivil sefer, kapanışın nedeni savaş ve bugün sürüyor, D-080'in öbür aday koşulları, askerî değil). Eklenen havalimanının Türkçe ve İngilizce adı ve şehri (`foreign-airport-names.ts` ya da `-r4.ts`) ve saat dilimi (`time-zones.ts`) de yazılır; tarifesizse fixture'ın kapanış bloğu yeniden üretilir.

## Dokploy env'i değişince bütün site kapandı (`hy-migrate`: "password authentication failed")
**Belirti:** Dokploy'da Environment değiştirilip yeniden deploy edildikten sonra her host (site, API, admin) Traefik'in `404 page not found` yanıtını verir. `hy-migrate` logunda `password authentication failed for user <ad>` var; ona bağlı servisler (`hy-api`, `hy-web`, iki worker) hiç açılmaz.

**Neden:** `POSTGRES_DB`, `POSTGRES_USER` ya da `POSTGRES_PASSWORD` değişti. Postgres bu değerleri yalnızca boş volume'u ilk açarken kullanır; sonradan değişen ad ya da parola mevcut veritabanında yoktur ve her bağlantı reddedilir. Servisler açılmadığı için Traefik'in yönlendireceği bir hedef kalmaz ve 404 döner. 2026-10-15'te marka geçişinde Environment'ta "havayolu" "airline" ile değiştirilince olan budur (D-112; site ~1 sa kapalı kaldı, veri kaybı olmadı).

**Çözüm:**
1. Dokploy → `havayolu` Compose → Environment'ta `POSTGRES_DB=havayolu` ve `POSTGRES_USER=havayolu` yaz; `POSTGRES_PASSWORD` ilk kurulumda girilen parola olmalı (parola yöneticinde).
2. O deploy'da başka satırlar da değiştiyse ve neyin bozduğu belli değilse onları da önceki değerlerine döndür (marka geçişinde: `APP_NAME`, `WEB_HOST`, `API_HOST`, `ADMIN_HOST`; `LEGACY_*` satırlarını sil).
3. Kaydet ve yeniden deploy et. `hy-migrate` bitince servisler açılır; doğrulama: `curl -s https://api.airline.live/version` (geçişten önce `https://api.havayolu.live/version`) ve admin → Servisler.
4. Volume'u silme: içinde üretim verisi var. DEPLOY_DOKPLOY §12'deki "volume'u sil" adımı yalnız henüz hiç veri yokken geçerlidir.

**Önlem:** `POSTGRES_*`, Redis parolaları, `ADMIN_SETUP_TOKEN`, `IMAGE_TAG` ve `MEM_LIMIT_*` satırları marka ya da alan adı değişince de aynen kalır; Environment'ta bul-değiştir yapılmaz (`deploy/dokploy.env.example` başlığı, ACTIVATION → "(b2) satır satır").

## `Upgrade` başlıklı istekler: API 405 ya da 404, site 502 (D-113)
**Belirti:** Bir izleme aracı ya da elle denenen `curl -I --http1.1 -H 'Upgrade: websocket' -H 'Connection: Upgrade' …` beklenmedik bir kod alıyor.

**API (`api.airline.live`, v0.25.2'den beri):** yalnızca canlı veri el sıkışması yükseltilir.

| İstek | Yanıt |
|---|---|
| `GET /v1/ws`, `Upgrade: websocket`, geçerli `Sec-WebSocket-Key` ve `Sec-WebSocket-Version: 13` | 101 (canlı veri) |
| aynısı, anahtar ya da sürüm eksik veya hatalı | 400 (`ws`'nin düz yanıtı, `Connection: close`) |
| `HEAD /v1/ws`, Upgrade'li ya da değil | 405, `Allow: GET` |
| Upgrade'siz `GET /v1/ws` ya da `Upgrade: h2c` | 404 |
| başka yol ya da yöntem, Upgrade'li | o yolun sıradan yanıtı (ör. `/health` 200), bağlantı keep-alive kalır |
| eski API host'u (`api.havayolu.live`) | 308 yeni host'a, bağlantı kapanır (D-112) |

API bunlardan birinde 500 veriyor ya da istekten sonra yeniden başlıyorsa önce `curl -s https://api.airline.live/version` ile sürüme bak. v0.25.1 ve öncesinde `HEAD /v1/ws` 500 veriyor ve API sürecini en geç 25 sn içinde çökertiyordu (D-113). 0.25.2 ve sonrasında bu bir hatadır: `hy-api` logundaki `"level":50` satırıyla incelenir.

**Site (`airline.live`, Next.js standalone):** site WebSocket sunmaz. Traefik isteği Next'e iletir ve Next'in kendi upgrade işleyicisi karar verir:
- **Eşleşen yol** (`/`, `/havalimanlari`, `/istasyon/LTFM` …): yanıt yazılmadan bağlantı kapanır. `curl` "Empty reply from server" der, Traefik **502 Bad Gateway** döner.
- **Eşleşmeyen yol** (`/olmayan-yol`, olmayan `/_next/static/…`): yanıt gelmez, bağlantı istemci ya da Traefik bırakana kadar açık kalır.

Bu Next 16'nın iç davranışıdır (`next/dist/server/lib/router-server.js` → `upgradeHandler`) ve yamalanmaz. Tarayıcılar site host'una Upgrade göndermez (canlı veri `wss://api.airline.live/v1/ws`), kullanıcı etkisi yoktur. Site için Upgrade'li isteğin 502'si alarm değildir; izleme aracı siteyi düz `GET` ya da `HEAD` ile denetler. `hy-web`'de açık bağlantı sayısı bu yüzden büyürse D-113'teki değerlendirilmiş seçenek (açılışta `shouldUpgradeCallback: () => false`) kullanıcı kararıyla uygulanır.
