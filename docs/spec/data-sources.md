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
  - Biçim: `havayolu/<sürüm> (+https://havayolu.live; <CONTACT_EMAIL>)` (`APP_NAME` ve `WEB_HOST` env'lerinden).
  - `WEB_HOST` boşsa (yerel): `havayolu/<sürüm> (+mailto:<CONTACT_EMAIL>)`.
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
- **İçe aktarım:** Günlük, `If-Modified-Since` ya da ETag ile. Değişmeyen satır yeniden yazılmaz, hatalı satır atlanır ve loglanır. Testte ve `EXTERNAL_PROVIDERS_DISABLED` iken `tools/fixtures/ourairports/` altındaki commit'li alt küme kullanılır (Türkiye + birkaç büyük havalimanı).
- **Filtre:** `type IN (large_airport, medium_airport)` ya da `scheduled_service = yes`. Anahtar sırası `icao_code` → `gps_code` → `ident`. `closed = 1` olan pistler atlanır.
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
- **İstek düzenimiz:** 61 havalimanı tek METAR isteğinde (`ids=<61 kod>&format=json&hours=2`, ~330 karakter) ve tek TAF isteğinde. Kodlar düz virgülle birleşir (AWC'nin kendi METAR sayfası da öyle gönderir). Yanıt 400 kayda ulaşırsa kod listesi ikiye bölünür, en çok 2 düzey. METAR 5 dk'da, TAF 15 dk'da bir: saatte 16 istek (D-078). Kesintiden sonra METAR geriye bakışı son başarılı denetimi kapsayacak kadar uzar (en çok 24 saat; istasyonlar istek başına 400 kayıt sınırına göre gruplanır); ilk açılışta 24 saat istenir. `/taf` `hours` almadığı için kesintide yayımlanıp yerini yenisine bırakan TAF'lar alınamaz (D-078).

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

## 6. Harita — OpenFreeMap
- **Şartlar:** Anahtar yok, ticari kullanım serbest, sayı limiti yok, **SLA yok**.
- **Stiller:** açık `https://tiles.openfreemap.org/styles/liberty`, koyu `.../styles/dark` (alternatif `fiord`). Env: `MAP_STYLE_URL`, `MAP_STYLE_URL_DARK`, `MAP_STYLE_FALLBACK_URL`. Testte yerel `test-style.json` kullanılır.
- **Atıf:** Zorunlu metin "© OpenMapTiles Data from OpenStreetMap"; "OpenFreeMap" ibaresi tavsiye edilir.
- **Önbellek yasağı:** Karo, stil, glif ve sprite'ların toplu indirilmesi ve service worker'da önbelleğe alınması yasaktır.
- **Hata durumu:** Stil 3 kez yüklenemezse yedek stile (`MAP_STYLE_FALLBACK_URL`) geçilir. O da yüklenemezse uçaklar sade bir arka planda çizilir ve "Harita altlığı yüklenemedi" şeridi çıkar. Uydu açıkken zincir: uydu → koyu stil → `MAP_STYLE_FALLBACK_URL` → sade arka plan (D-075). Altlık yüklenirken de uçaklar sade arka planda çizilir.
- **Self-host yedeği (RUNBOOK):** Protomaps PMTiles bölgesel kesit. Tüm dünya dosyası ~120 GB'tır ve KVM 2 diskine sığmaz. Kod BSD, karolar ODbL (OSM atfı zorunlu).
- MapTiler Free ticari kullanıma kapalıdır.
- **Uydu anahtarı yokken:** Harita koyu stille açılır ve yollar gizlenir: `source-layer`'ı `transportation` ya da `transportation_name` olan katmanlar kapanır, `aeroway` kalır (D-075).

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
