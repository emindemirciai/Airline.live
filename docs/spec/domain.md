# Alan tanımları, eşikler ve birimler

Olay motoru, bildirimler ve arayüz bu dosyadaki tanımlara uyar. **Motorun bütün eşikleri burada yazılıdır**; parça prompt'ları bu dosyaya başvurur. Bir tanımı değiştirmek DUR-SOR gerektirir.

## Terimler (metinlerde tek anlamla kullanılır)
- **İstasyon:** Takip edilen havalimanı. Tohumlar IST (LTFM), SAW (LTFJ), ESB (LTAC), ADB (LTBJ), AYT (LTAI). Birincil istasyon IST'dir.
- **Havalimanı merkezi (ARP):** OurAirports `latitude_deg/longitude_deg`. Sade görünümde "havalimanı merkezi" yazılır.
- **Pist eşiği:** Pistte inişin başladığı nokta.
  - OurAirports `le_/he_` koordinatı `displaced_threshold_ft × 0,3048` m pist yönünde kaydırılarak bulunur.
  - Koordinat yoksa ARP kullanılır, toleranslar genişler ve olay verisine `thresholdSource: 'arp_fallback'` yazılır.
- **Uyarı mesafesi:** Kullanıcının seçtiği yaklaşma bildirimi mesafesi (ör. 10 km; kodda `threshold_key`). Metinlerde "eşik" kelimesi tek başına kullanılmaz; her zaman "uyarı mesafesi" ya da "pist eşiği" yazılır.
- **Konum örneği:** Tek bir ADS-B ölçümü (sample). "Örnek" kelimesi yalnızca bunun için kullanılır.
- **Uçuş kaydı (flight instance):** Aynı hex'in kesintisiz bir uçuşu (`flights` tablosu, `flight_id`). Şu durumlardan biri yeni kayıt başlatır: 30 dk veri boşluğu, çağrı kodu değişimi, yerde 20 dk bekleme.
- **İniş (üst terim):** Ya teker koymadır (`touchdown`; kesin, doğrudan görüldü) ya da muhtemel iniştir (`probable_landing`; çıkarım). Arayüzde tek bir "İniş" seçeneği vardır; hangisinin olduğunu bildirim metni söyler. "Teker koydu" yalnızca kesin iniş için kullanılır.
- **Harfli numaralı çağrı kodu:** Havayolu önekinden sonraki kısmında harf bulunan çağrı kodu (ör. THY4KN, THY1KQ).
- **Bildirim merkezi:** Uygulama içindeki bildirim listesi; web ve mobilde aynı adı taşır. "Gelen kutusu" denmez.
- **Takip / Takibe al:** Yalnızca bildirim aboneliği için kullanılır. Haritada kamerayı uçağa kilitlemek "Uçağı ortala"dır.

## Birimler ve zaman
- **Arayüz varsayılanı metriktir** (kullanıcı kararı 2026-09-28, D-072):
  - yükseklik m, hız km/sa, dikey hız m/dk, mesafe km
  - Ayarlardan "havacılık birimleri" seçilebilir: ft, kt, ft/dk, NM.
  - EN arayüzde metrik birim kısaltmaları m, km/h, m/min'dir.
- **Veri, API ve motor havacılık birimlerinde kalır:** DB sütunları ve `AircraftState` ft, kt, ft/dk taşır. Bu dosyadaki motor eşikleri ft ile yazılıdır; dönüşüm yalnızca gösterimde yapılır. Bildirim metinleri kullanıcının birim tercihiyle yazılır.
- 1 NM = 1,852 km; 1 kt = 1,852 km/sa; 1 ft = 0,3048 m; 10 km ≈ 5,4 NM.
- DB'de tüm zamanlar UTC'dir (`timestamptz`). Arayüzde yerel saat ya da UTC ("Z" ekiyle) seçilebilir.
  - **Yerel saat** bir havalimanının saatinde o havalimanının kendi saat dilimidir (D-084, `airportTimeZone`): Türkiye'de Europe/Istanbul, yurt dışında havalimanının IANA dilimi. Yurt dışında UTC farkı da yazılır (ör. "Yerel saat 23:05 (UTC+2)"; gösterim D-084'tedir). Tanım bir havalimanına bağlı her saate uygulanır (havalimanı penceresi ve sayfası; sonraki parçalarda uçuş sayfası ve bildirim metinleri de). Bildirim sayımındaki "Gün" tanımı (Europe/Istanbul takvim günü, aşağıda) ayrıdır.
  - Dilimi bilinmeyen havalimanında saat tahmin edilmez: UTC ya da Türkiye saati (Europe/Istanbul) yazılır ve öyle etiketlenir ("Saatler Türkiye saatidir"). Başka bir ülkenin saati Türkiye saatiyle "yerel saat" diye gösterilmez.
- Olay zamanları her zaman konum örneğinin `sampleTime`'ından alınır, sunucu saatinden alınmaz.
- Sade görünümde kısaltma kullanılmaz: ETA → "tahmini varış", ARP → "havalimanı merkezi", AGL → "yerden yükseklik".

## Harita etiketleri (kullanıcı tasarım kararı 2026-09-28, D-072)
- **Sefer no gösterimi:** Havayolu kodu ile numara arasında tire kullanılır: TK-4, TK-1985. Bu dosyadaki bildirim örnekleri de arayüzde bu biçimle yazılır. Aramada TK4, TK 4 ve TK-4 aynı sayılır.
- **Etiket alanları (Tam):**
  1. sefer no; bilinmiyorsa çağrı kodu gri yazılır
  2. güzergâh, IATA kodlarıyla (JFK-IST); tahminidir, bilinmiyorsa "Güzergâh ?"
  3. hız ve yükseklik (431 km/sa, 333 m); uçak yerdeyse yükseklik yerine "yerde" (28 km/sa, yerde). Ayraç virgüldür: sayıdan önce "·" eksi gibi okunur (D-081)
  4. ineceği pist (Pist 35L); yalnızca bir piste hizalanmış yaklaşmada
- **Kısa:** yalnızca sefer no (yoksa çağrı kodu).
- **Göster/gizle:** Seçili uçak ve diğer uçaklar için ayrı ayrı Gizle, Kısa ya da Tam seçilir. Varsayılan ikisi için de Tam'dır. Ayar haritadaki "Etiketler" düğmesinden açılır ve cihazda saklanır.
- **Havalimanı etiketleri (D-084):** Aynı panelin "Havalimanları" grubunda Gizle ya da Kod seçilir; varsayılan Kod'dur (IATA kodu, z ≥ 5). Haritada havalimanı adı yazılmaz: ad, pin ya da koda tıklanınca açılan havalimanı penceresindedir ("Kod ve ad" 2026-10-04'te kullanıcı isteğiyle kaldırıldı; o seçenekle saklanmış ayar Kod okunur). Gizle yalnız yazıyı kaldırır: pinler her zaman görünür ve tıklanır kalır.
- **Askerî hava üsleri haritada gösterilmez (D-103; kullanıcı, 2026-10-06: "askeri havalimanlarını kaldır haritadan."):** İncirlik, Afyon, Bandırma, Eskişehir ve Çiğli hava üslerinin (D-084; "<yer> Hava Üssü") haritada pini, kodu, penceresi ve "Havalimanları" listesinde satırı yoktur. `?havalimani=<üssün ICAO kodu>` (havalimanı sayfasındaki "Canlı haritada aç") haritayı yine üssün yerinde açar; pencere açılmaz (`?havalimani=` hiçbir havalimanında pencere açmaz). Yalnız harita değişir: havalimanları listesi, istasyon sayfası ve API üsleri göstermeye devam eder; site haritası ve llms.txt değişmez (üsler `noindex, follow`'dur, D-084: oralarda hiç olmadılar). Uçak listesinin konum ve durumu üsleri de kullanır: üsse yaklaşan uçak doğru yere göre yazılır (aşağıda). Ankara (Etimesgut) sivil adlıdır (kullanıcı kararı 2026-10-03) ve haritadadır; yurt dışındaki ortak sivil-askerî havalimanları (tarifeli sivil seferi olan: Bağdat, Podgorica, Cuxhaven/Nordholz) sivildir ve haritadadır.
- **Ülke adları (D-095, D-096, D-099, D-103):** Etiketler → "Ülke adları" Gizle/Göster (varsayılan Göster); **ad ülkenin sınırının içinde kalır** (kullanıcı, 2026-10-05): adın görünür kutusu (bütün satırlar, harf aralığı, hale ve 3 px + 2 km güvenlik payı) kara poligonunun (Natural Earth 1:10m) içine sığmadıkça ad çizilmez; kıyı da sınırdır. **Ad boş yerdedir** (kullanıcı, 2026-10-05: "boşlukta bir yerde yazsa da olur"): üreticinin modeline göre adın görünür kutusuna, yazıldığı hiçbir yakınlaştırmada, haritadaki bir havalimanının pini ya da (z5'ten) kodu girmez; ad bunun için en çok 1,5 kademe geç belirebilir. Model kodun pin başının sağındaki ve solundaki yerini sayar; haritada kod iki yana da sığmayıp pinin üstüne ya da altına geçerse adın üstüne düşebilir. Engeller commit'li OurAirports fixture'ının (2026-10-01) listelenen havalimanlarıdır, haritada gösterilmeyen askerî üsler hariç (498; D-103); üretim OurAirports'u her gece yenilediğinden yeni listelenen bir havalimanı tablo yeniden üretilene kadar engel sayılmaz (kullanıcının karşılaştırması ACTIVATION'da). Boş yer bulunamayan tek ülke Türkiye'dir (haritada 56 havalimanı): TÜRKİYE en az çakışan noktada, görsel merkezinde (33,8° D, 39,4° K; Kaman yakını, Ankara'nın ~100 km güneydoğusu) ve geç gelmez (z3,25'ten; z5'ten sonra kutusunda pin ya da kod yok). KIBRIS kullanıcı kararıyla Lefkoşa'dadır (D-095); Ercan pini adın üstündedir. Eşitlikte en erken sığan, sonra ülkenin görsel merkezine (erişilmezlik kutbu) en yakın yer seçilir; başkent rol oynamaz (çapa kuralı D-099; iki dilde ve iki genişlikte aynı nokta). Her sözcük ayrı satırda, ortalı (SUUDİ / ARABİSTAN, BİRLEŞİK / ARAP / EMİRLİKLERİ, BOSNA / HERSEK; bağlaç önceki sözcükle: BOSNIA AND / HERZEGOVINA), her genişlikte. Ad, sığdığı ilk yakınlaştırmada (0,25 adım, kademenin en küçüğünden önce değil: kademe 1 z3, 2 z3,5, 3 z4,5) belirmeye başlar, yarım kademede tam görünür; hiçbir yakınlaştırmada sığmayan Bahreyn, Lüksemburg ve Malta yazılmaz; LÜBNAN z6,5'ten (İngilizcede z6,75). Bu yüzden z4–6'da az ad görünür (Türkiye görünümünde z4'te IRAK, İRAN, SURİYE, TÜRKMENİSTAN, TÜRKİYE; z5'te TÜRKİYE ve SURİYE; GÜRCİSTAN z5,25'ten, BULGARİSTAN z5,5'ten, YUNANİSTAN z6,5'ten). Sayfanın dilinde büyük harf, Overpass 600, 0,32 em; beyaz 0,85, koyu hale 0,9 (glif SDF payının izin verdiği en kalın hâli, az yumuşak; D-099), zeminsiz; kademe boyları z5'te 34/22/14 px (dar ekranda 27/18/14); z7–8 arasında silinir, açılış görünümünde yoktur; adlar üst üste binmez (her biri kendi ülkesinde), pin, kod, uçak ve uçak etiketi her zaman üstte; listelenen havalimanı olan ülkeler + Ukrayna, İsrail ve Filistin yok, KIBRIS adanın üstünde, Lefkoşa'da. Kayma istisnası (Slovakya) yoktur. Tasarım: https://claude.ai/artifact/2Hu2UcsPVQw32MbWkAU83v (A · Sessiz büyük harf).
- **Yerleşim:** Etiketler üst üste binmez; yer yoksa etiket yana kayar ve ince bir çizgiyle uçağa bağlanır. Etiket zemini opaktır; ülke adlarının zemini yoktur.
- Tasarım: https://claude.ai/artifact/Tsu4WTeQu8CxqvyZXpTSYD (Parça 1 M6 ve Parça 3 bu tasarıma göre yapılır).

## Haritadaki uçak listesi: tahmini durum (D-085)
Canlı haritanın "Haritada görünen uçaklar" listesi her uçağın durumunu ADS-B verisinden tahmin eder ve yalnızca gösterir; olay üretmez, bildirim göndermez. Motorun durum makinesi ve eşikleri değişmez; Parça 2 motoru istasyon durumlarını yayımlayınca liste onları gösterir.

| Liste durumu | TR | EN | Motor karşılığı |
|---|---|---|---|
| `onGround` | Yerde | On ground | ON_GROUND |
| `landing` | İnişte | Landing | APPROACHING'in son yaklaşma bölümü; teker koyma değildir |
| `approaching` | Yaklaşmada | Approaching | APPROACHING |
| `lowAltLost` | Alçakta sinyal kaybı | Signal lost at low altitude | LOW_ALT_LOST |
| `enRoute` | (yazılmaz; yalnızca konum) | — | EN_ROUTE |

- Sütunlar: Sefer, Kuyruk (tescil; PIA/LADD ya da bilinmeyen tescilde "—", ikisi istemcide ayırt edilemez), Yükseklik ("yerde" dahil), Konum ve durum. Liste 768 px ve üstünde sağ üsttedir, telefonda sol alttaki düğmeyle açılır.
- "Teker koydu" ve "Muhtemelen indi" listede kullanılmaz: ikisi de yerde doğrulama ya da güven kuralları ister (aşağıda).
- Yerden yükseklik `baro_tolerant` yöntemiyledir (QNH listede yoktur): `alt_baro − alan_yüksekliği_ft`, her üst sınıra +300 ft.
- Yerde: yerde bayrağı ve havalimanı merkezine ≤ 6 km.
- İnişte: yerden yükseklik < 1.000 ft, alçalıyor ve hizalı pist eşiğine ya da (tarifeli) havalimanı merkezine ≤ 8 km.
- Yaklaşmada: ya hizalı pist eşiğine ≤ 15 km, yerden yükseklik < 4.000 ft ve tırmanmıyor; ya da (tarifeli) havalimanı merkezine ≤ 30 km, yerden yükseklik < 10.000 ft, yumuşatılmış dikey hız ≤ −300 ft/dk, havalimanına doğru (iz ile havalimanı yönü farkı ≤ 45°; uzaklık yer hızının en az %71'iyle azalır) ve 3° süzülüş profilinin en çok iki katı yükseklikte (`max(3.000 ft, 2 × 318 ft/NM × uzaklık)`).
- Merkeze göre kurallar (hizasız İnişte ve Yaklaşmada) yalnızca tarifeli seferi olan havalimanlarında uygulanır (OurAirports `scheduled_service`). Tarifesiz havalimanında (ör. ISL Atatürk, hava üsleri) durum yalnızca pist hizasından çıkar; konum metni yine en yakın havalimanına, tarifesiz olsa da, göredir.
- Havalimanı seçimi: merkeze göre birden çok aday varsa önce giriş koşuluna kendi başına uyan, sonra gösterilen havalimanı, sonra iz yönüne en yakın olan, sonra en yakın olan seçilir. Hizalı pist her zaman önce gelir.
- Hizalı pist: iz ile pist yönü farkı ≤ 15°, merkez hattına yanal sapma ≤ 1 km (motorun pist hizası) ve uçak pist eşiğinden önce en çok 15 km'de ya da eşiği en çok 0,3 km geçmiş; birden çok uç hizalıysa eşiği en yakın olan. Pist uçları listelenen havalimanlarının API kaydından gelir (kaydırılmış eşik dahil). Tırmanan uçak (kalkış, pas geçme) hizalı olsa da yaklaşmada sayılmaz.
- Dikey hız akışta yoksa irtifa değişiminden (en az 2 sn arayla) türetilir. İrtifası bilinmeyen havadaki uçak yalnızca konumla yazılır.
- Alçakta sinyal kaybı: yaklaşmada ya da inişteyken son örnek 30 sn'den eski, yerden yükseklik < 3.000 ft ve havalimanı merkezine ≤ 20 km.
- Kararlılık: çıkış eşikleri giriştekinden geniştir (35 km, 11.000 ft, iniş 1.800 ft ve 10 km; tırmanış > +300 ft/dk). Gösterilen havalimanı alçalma bitse de tutulur; uçak tırmanınca ya da havalimanı uçağın arkasında kalınca (iz ile havalimanı yönü farkı > 90°) yaklaşma biter. Yeni durum ya da havalimanı, örnek zamanıyla 5 sn sürünce gösterilir; o sürede gösterilen durumun uzaklığı yeni örnekle güncellenir. Yeni görülen uçağın ilk durumu beklemeden gösterilir. Yumuşatma, her yeni örnekte α = 0,5 üstel ortalamadır. Pist eşiğini geçen inişteki uçak pist adını korur.
- Havalimanından 6 km'den uzakta yerde görünen uçak "Yerde" rozetiyle en yakın havalimanına göre yönlü konumla yazılır. Havalimanları yüklenmemişse konum koordinattır.
- Konum: durumun havalimanı, yoksa en yakın listelenen havalimanı (haritada gösterilmeyen askerî hava üsleri dahil, D-103), IATA koduyla: "IST, 18 km", "IST, pist 35L", "IST üzerinde" (3 km içinde), "IST, 45 km kuzeyinde" (8 yön). Uzaklık havalimanı merkezine yataydır.
- Liste altında "Durumlar tahminidir" notu durur (web-ui.md: tahmini bilgi "tahmini" etiketi taşır). Durumlar canlı bölge değildir; değişince ekran okuyucuya duyurulmaz.
- Bilinen sınır: güzergâh bilinmediği için başka bir havalimanına giderken tarifeli bir havalimanının önünden alçalarak geçen uçak (ör. Trakya'dan IST'ye gelirken Çorlu/TEQ'in yakınından) o havalimanının süzülüş zarfında kaldığı kısa süre (gözden geçirmedeki örnekte ~45 sn) ona "Yaklaşmada" görünebilir. Parça 2 motorunun tahmini rotası bunu çözer.

## Yaklaşma
- **Hazır uyarılar:**
  - mesafe: 50 / 30 / 20 / 10 / 5 km
  - süre: inişe 15 / 10 / 5 / 3 dk
  - varsayılan: **10 km**
- **Mesafe referansı:** Varsayılan olarak havalimanı merkezine yatay mesafe ölçülür. Uzman ayarında "hizalı pist eşiği" seçilebilir. Bildirim metni referansı yazar: "IST'ye 10 km" ya da "34L pist eşiğine 10 km".
- Her uyarı mesafesi aynı yaklaşma denemesinde bir kez tetiklenir. Pas geçmeden sonraki yeni denemede aynı uyarılar yeniden tetiklenebilir.
- P0 istasyon çemberi (veri çekimi için) ARP merkezli 60 NM'dir; yaklaşma uyarılarından bağımsızdır.

## Durum makinesi (kod değerleri İngilizce)
| Kod | TR etiket (i18n) |
|---|---|
| `EN_ROUTE` | Yolda |
| `APPROACHING` | Yaklaşmada |
| `TOUCHED_DOWN` | Teker koydu |
| `ON_GROUND` | Yerde |
| `GO_AROUND` | Pas geçti |
| `LOW_ALT_LOST` | Alçakta sinyal kaybı |
| `PROBABLE_LANDING` | Muhtemelen indi |

**Geçişler ve giriş koşulları:**
- `EN_ROUTE → APPROACHING`: uçak bu istasyon için varış olarak sınıflandı (aşağıda).
- `APPROACHING → TOUCHED_DOWN → ON_GROUND`: teker koyma gözlendi ve doğrulandı.
- `APPROACHING → GO_AROUND → APPROACHING`: yeni deneme, `attempt_no + 1`.
- `APPROACHING → LOW_ALT_LOST`: son örnekte AGL < 3.000 ft ve ARP'a ≤ 20 km iken 30 sn veri yok.
- `LOW_ALT_LOST → PROBABLE_LANDING`: güven kuralları sağlandı (aşağıda).
- `LOW_ALT_LOST` ya da `PROBABLE_LANDING` → `TOUCHED_DOWN`: uçak sonra yerde görüldü (doğrulama).
- İstasyonda yerde ilk görülen uçak `ON_GROUND` durumunda başlar. `ON_GROUND → EN_ROUTE`, yerde → havada geçişidir ve istasyonda `takeoff` olayı üretir.

## Tespit eşikleri (motor)
- **Pist hizası:** track ile pist yönü farkı ≤ 15° ve merkez hattından yanal sapma ≤ 1 km.
- **Varış sınıflandırması** (biri yeter):
  - Tahmini rotanın varış havalimanı bu istasyon ve rota uygunluğu düşük değil.
  - AGL < 10.000 ft, yumuşatılmış dikey hız < −300 fpm ve mesafe azalıyor.
  - 15 km içinde pist hizasında ve AGL < 4.000 ft.
  - `navModes` `approach` içeriyor ve ARP'a ≤ 30 km.
- **Kalkış ayrımı:** İstasyondan kalkan uçak 10 dk boyunca o istasyon için yaklaşma olayı üretmez.
- **`touchdown`:**
  - Koşul: havada → yerde geçişi; ARP'a ≤ 6 km ya da pist poligonunun 300 m tamponu içinde; gs < 180 kt.
  - Doğrulama: ilk yerde örneğinden sonra `max(15 sn, 2 × gözlenen örnekleme aralığı)` içinde ikinci bir yerde örneği ya da azalan gs.
  - ALDT: ilk yerde örneğinin `sampleTime`'ı. Hizalı pist belirlenir (ör. "34L").
- **`go_around`:** `APPROACHING` iken (ARP'a ≤ 10 km ya da finalde) iniş olmadan ≤ 60 sn içinde ≥ 400 ft tırmanış ve dikey hız > +500 fpm.
- **Konum kaynağı ağırlığı:** Konum kaynağı `mlat`, `tisb_*` ya da `other` ise olay tespitinde düşük ağırlık alır. `lastPosition` ve `rr_lat/rr_lon` hiç kullanılmaz.

## AGL (yerden yükseklik) yöntemi
Sırayla denenir; kullanılan yöntem olay verisine `aglMethod` olarak yazılır:
1. **`qnh`:** `alt_baro + (QNH − 1013,25) × 27 − alan_yüksekliği_ft`. QNH, istasyonun son METAR'ının ham `Qdddd` grubundan gelir (hPa; `weather_metar.qnh_hpa`, Parça 1 M6c, D-078). Yalnızca `observed_at` 90 dk'dan yeniyse kullanılır; değilse sonraki yönteme geçilir.
2. **`geoid`:** `alt_geom_ft − N_m × 3,28084 − alan_yüksekliği_ft`. N, istasyonun EGM96 geoid ondülasyonudur (LTFM ≈ 37,05 m).
3. **`baro_tolerant`:** `alt_baro − alan_yüksekliği_ft`, eşiklere ±300 ft tolerans eklenir.

## Olaylar
- `approach_threshold` — uyarı mesafesi başına bir kez.
- `touchdown` — kesin iniş.
- `probable_landing` — alçakta sinyal kaybından çıkarım. Güven düzeyi (`high | medium`) ve tahmini iniş saati taşır.
- `landing_unverified` — kesinti bastırması yüzünden doğrulanamayan olası iniş. Yalnızca bildirim merkezine yazılır, push gönderilmez.
- `go_around` — yaklaşmadaki uçağın inmeden yeniden tırmanması (pas geçme).
- `takeoff` — istasyonda yerde → havada geçişi.
- **İdempotensi anahtarı:** `(flight_id, station_id, event_type, threshold_key, attempt_no)`.
- **Doğrulama:** Bir `probable_landing` sonradan yerde görülürse satır korunur; `confirmed_touchdown_at`, ALDT ve pist alanları doldurulur. Ayrıca `touchdown` satırı `push_suppressed=true` ile yazılır: yeni push gitmez, bildirim merkezindeki kayıt güncellenir.

## İniş tespiti ve kapsama gerçeği
adsb.lol kitle kaynaklıdır. 2026-09-25 anlık ölçümünde IST çevresindeki 60 NM içinde **yerde hiçbir uçak görünmedi**. Kullanıcının kendi alıcısı yoktur. Bu yüzden inişlerin çoğu çıkarımla bildirilir. Bu yan yol değil, **birinci sınıf** bir yoldur.

- **`high` güven:** Son örnekte AGL ≤ 300 ft, hizalı pist eşiğine ≤ 3 km ve alçalıyor. Ardından ≥ 60 sn veri yok. Push gider.
- **`medium` güven:** Son örnekte AGL < 1.000 ft, ARP'a ≤ 8 km ve alçalıyor. Ardından ≥ 90 sn veri yok. Push gider.
- **`low`:** Son örnekte AGL < 3.000 ft, ARP'a ≤ 20 km, alçalıyor ve pist hizasında. Ardından ≥ 120 sn veri yok. `probable_landing` üretilmez ve push gönderilmez. Bildirim merkezine "TK1985 IST'ye inişe geçti; iniş anı görülmedi (tahmini 14:32)" yazılır.
- **Tahmini iniş saati** = son örnek zamanı + (pist eşiğine kalan mesafe ÷ yer hızı).
- **Sessizce kapanma yok:** Eşleşmiş bir takipte uçuş kaydı hiç iniş olayı üretmeden kapanırsa takip `landing_unknown` durumuyla kapanır. Kullanıcıya şu push gider: "TK1985 için iniş verisi alınamadı: uçak IST yakınında alçak irtifada kapsama dışına çıktı."
- **Gecikme:** Muhtemel iniş bildirimi tasarım gereği son sinyalden en az 60 sn (yüksek güven) ya da 90 sn (orta güven) sonra gider. Bu, ayarlar sayfasında yazılır.
- **Kesinti bastırma:** Aşağıdakilerden **herhangi biri** geçerliyken `LOW_ALT_LOST → PROBABLE_LANDING` geçişi yapılmaz:
  - (a) sağlayıcı durumu `degraded` ya da `down` (data-sources.md → "Sağlayıcı durumu")
  - (b) uçağın bulunduğu bölgede tazelik hedefin 2 katını aşmış
  - (c) worker açılalı henüz 120 sn olmamış

  Kaynak dönünce uçak yerde görülürse `touchdown` yazılır. Push yalnızca ilk yerde örneği ile kaynağın dönüşü arasındaki süre ≤ 5 dk ise gider; değilse bildirim merkezine "Kesinti sonrası doğrulandı" etiketiyle yazılır. Uçak görülmezse `landing_unverified` yazılır ve etiketi "Veri kesintisi: iniş doğrulanamadı" olur.
- **Kapsama kalitesi:** Son 7 günde en az bir yerde örneği görülen varışların oranıdır. `jobs` rolündeki günlük iş bunu `stations.coverage_ground_ratio_7d` alanına yazar. Oran %70'in altındaysa istasyon sayfasında, takip kurulurken ve istasyon akışı filtresinde şu uyarı gösterilir: "Bu istasyonda inişlerin çoğu muhtemel iniş olarak bildirilir." Gözlenen `touchdown` yine kesin olarak bildirilir. Varış, yerde örneği ve AGL'nin rapordaki tanımı ile günlük işin ayrıntıları: `packages/shared/src/arrival-coverage.ts` ve D-098 (kapsama raporu, Parça 1 M7b.2; tanım burada değişmez).

## Takip türleri ve eşleşme
- **Uçak:** tescil ya da hex ile. Süreklidir.
- **Uçuş:** sefer no (TK1985) ya da çağrı kodu (THY1985) ile, belirli bir gün ya da "bir sonraki uçuş" için.
  - Aday çağrı kodları = ICAO önek + numara + admin düzeltme tablosu.
  - Durumlar:
    - `pending`: kayıt anındaki durum.
    - `matched`: aday canlı görüldü ya da kullanıcı canlı adaylardan seçti.
    - `completed`: inişten 30 dk sonra.
    - `expired`: gün sonuna kadar eşleşme olmadı. Kullanıcıya bildirim gider ve tescil ile takip önerilir.
    - `landing_unknown`: eşleşti ama iniş verisi alınamadı.
  - "Gün", Europe/Istanbul takvim günüdür. "Bir sonraki uçuş", takip oluşturulduktan sonraki ilk eşleşmedir.
  - Harfli numaralı çağrı kodu kullanan seferlerde sefer no eşleşmesi garanti değildir. Takip kurulurken bu uyarı baştan gösterilir; havayolu tablosunda `usesAlphanumericCallsigns` bayrağı bulunur.
- **İstasyon akışı:** Bir istasyona gelen trafik; filtreler havayolu, tip ve çağrı kodu önekidir.
  - Filtreli akışta seçilen her olaya push gider.
  - Filtresiz akışta push yoktur. Yalnızca bildirim merkezi ve operasyon panosu çalışır; bu kullanıcıya açıkça söylenir.
  - Filtre kurulurken son 7 günün olaylarından hesaplanan "Bu filtre saatte yaklaşık N bildirim üretir" tahmini gösterilir.
- **Takip kurmak tek dokunuştur:** varsayılan olarak 10 km uyarısı + iniş, açık olan bütün kanallardan. Diğer seçenekler "Ayrıntılı ayarlar" altındadır.

## Bildirim sınırları
- **Saatlik push sınırı:** `free` planda varsayılan 60/saat, admin (proje sahibi) için sınırsız. Değerler config'tedir; kullanıcı kendi sınırını plan sınırına kadar değiştirebilir.
- Sınır aşılırsa fazla bildirimler bildirim merkezine yazılır ve özet push gönderilir.
- **İstisna:** Açıkça takip edilen uçuş ya da uçağın iniş bildirimleri (`touchdown`, `probable_landing`, `landing_unknown`) hiçbir zaman özete çevrilmez.
- **Sessiz saatler:** Push gönderilmez, bildirim merkezine yazılır. Kullanıcı "Takip ettiğim uçuşların iniş bildirimi sessiz saatlerde de gelsin" seçeneğini açabilir.

## v1 sınırları (kullanıcıya açıkça söylenir)
ADS-B yalnızca konum, irtifa, hız ve kimlik verir. Tarife verisi olmadığından v1'de şunlar **yoktur**:
- tarifeli/tahmini kalkış ve varış saati
- rötar, kapı/terminal/bagaj, kod paylaşımı, iptaller
- kalkış öncesi kalkış panosu
- harfli numaralı çağrı kodlu seferlerde kalkıştan önce sefer no ile arama

Canlı uçak verisi şimdilik yalnızca Türkiye ve çevresinden çekilir (kapsama planı: data-sources.md §1, D-073); bu alanın dışında haritada uçak görünmez. Site metinleri ürünü Türkiye ile sınırlamaz, birincil istasyon İstanbul Havalimanı'dır; sınır kapsama metinlerinde (/hakkinda, /havalimanlari, havalimanı sayfaları, haritanın durum satırı) söylenir (D-106).

Tahmini varış yalnızca havadaki uçak için konumdan hesaplanır ve "tahmini" etiketi taşır. Rota tahmini (VRS standing-data) de her yerde "tahmini" olarak gösterilir. Kendi alıcı olmadığı için inişlerin çoğu "muhtemelen indi" olarak ve son sinyalden 1–1,5 dk sonra bildirilir.

## Saklama
- **`track_points_sampled`:** 30 sn örnekleme, 7 gün.
- **`track_points_fine`:** tam çözünürlük, 30 gün. Şunlar yazılır:
  - (a) bu istasyon için varış ya da kalkış olarak sınıflanmış, ARP'a ≤ 30 km ve AGL < 10.000 ft olan uçaklar
  - (b) takip listesindeki uçaklar (konumdan bağımsız)
- **İz satırı:** konum, irtifa (barometrik, geometrik), yer hızı, yön, görünen dikey hız (`vertical_rate_fpm`: barometrik, yoksa geometrik), yerde bayrağı, konum kaynağı kodu ve kapsama raporu için iki ham değer (D-097): `seen_pos_s` (kaynağın bildirdiği konum yaşı, sn) ve `baro_rate_fpm` (barometrik dikey hız). Kaynak göndermediyse ikisi de null'dır; yerlerine `seen` ya da geometrik hız konmaz. v0.20.0'dan önce yazılan satırlarda null'dır.
- **Özetler:** `flights` ve `events` en az 365 gün tutulur. İz verisi süresi dolan bir uçuş sayfası olay zaman çizelgesini göstermeye devam eder ve "iz verisi saklama süresini aştı" der.
- İz tabloları yedeğe girmez (infra.md → Yedekleme).
