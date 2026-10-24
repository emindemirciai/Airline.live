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
- **Rüzgâr şiddetinin adları (D-116; kullanıcı, 2026-10-15: "fırtınamsı, rüzgarımsı vs kullanma"):** sade ve sıralıdır; eşikler MGM Beaufort ıskalasından gelir; adların çoğu MGM'nin Beaufort adlarıdır, dördü sade ifade için değişti (Hafif-orta rüzgâr, Çok kuvvetli rüzgâr, Şiddetli fırtına, Kasırga şiddetinde rüzgâr). Hafif rüzgâr < Hafif-orta rüzgâr < Orta rüzgâr < Sert rüzgâr < Kuvvetli rüzgâr < Çok kuvvetli rüzgâr < Fırtına < Kuvvetli fırtına < Şiddetli fırtına < Çok şiddetli fırtına < Kasırga şiddetinde rüzgâr; hamlede "Hamleli rüzgâr" ve "Kuvvetli hamle". "-msı/-msi" ekli sözcük ("fırtınamsı"), "Tatlı rüzgâr", "Tam fırtına", "Harikeyn", "Orkan" ve yalın "Kasırga" Türkçe metinlerde kullanılmaz (ek ve eski dört ad `packages/i18n` testinde denetlenir). "Fırtına" gök gürültüsü için hiç kullanılmaz (D-078).

## Birimler ve zaman
- **Arayüz varsayılanı metriktir** (kullanıcı kararı 2026-09-28, D-072):
  - yükseklik m, hız km/sa, dikey hız m/dk, mesafe km
  - Ayarlardan "havacılık birimleri" seçilebilir: ft, kt, ft/dk, NM.
  - EN arayüzde metrik birim kısaltmaları m, km/h, m/min'dir.
- **Veri, API ve motor havacılık birimlerinde kalır:** DB sütunları ve `AircraftState` ft, kt, ft/dk taşır. Bu dosyadaki motor eşikleri ft ile yazılıdır; dönüşüm yalnızca gösterimde yapılır. Bildirim metinleri kullanıcının birim tercihiyle yazılır.
- 1 NM = 1,852 km; 1 kt = 1,852 km/sa; 1 ft = 0,3048 m; 10 km ≈ 5,4 NM.
- DB'de tüm zamanlar UTC'dir (`timestamptz`). Arayüzde yerel saat ya da UTC ("Z" ekiyle) seçilebilir.
  - **Yerel saat** bir havalimanının saatinde o havalimanının kendi saat dilimidir (D-084, `airportTimeZone`): Türkiye'de Europe/Istanbul, yurt dışında havalimanının IANA dilimi. Yurt dışında UTC farkı da yazılır (ör. "Yerel saat 23:05 (UTC+2)"; gösterim D-084'tedir). Tanım bir havalimanına bağlı her saate uygulanır (havalimanı penceresi ve sayfası; sonraki parçalarda uçuş sayfası ve bildirim metinleri de). Bildirim sayımındaki "Gün" tanımı (Europe/Istanbul takvim günü, aşağıda) ayrıdır.
  - Dilimi bilinmeyen havalimanında saat tahmin edilmez: UTC yazılır ve öyle etiketlenir ("Saatler UTC’dir; havalimanının yerel saati farklı olabilir." / "Times are in UTC; the airport’s local time may differ."; uzman satırında "Gözlem zamanı: 12:50 UTC"; D-106 (c), D-109; M6j.1'den önce havalimanı sayfası Türkiye saatini yazıyordu). UTC "yerel saat" diye gösterilmez; yerel saat ile gün doğumu/batımı satırı çizilmez. Harita penceresi dilimsiz havalimanında gözlemi zaten UTC ile yazar.
  - **Yerel saatin kaynağı sunucudur (D-109):** havalimanı sayfasında dilimin farklarını sunucu çizim anının ±48 saati için hesaplar (`utcOffsetTable`), hava durumu ve METAR/TAF kaydı adası her yerel saati UTC + bu farktan yazar. Tarayıcının tz verisi sunucununkinden eskiyse (Britanya Kolumbiyası 2026'dan beri bütün yıl UTC−7, Kazakistan 2024'ten beri UTC+5) ya da tarayıcı dilimi tanımıyorsa da sayfa doğru saati gösterir ve hidrasyon farkı olmaz. Sayfa 48 saatten uzun açık kalırsa aralığın dışındaki saatleri tarayıcı hesaplar.
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
- **Havalimanları (D-084, D-114; kullanıcı, 2026-10-15: "havalimanı ikonlarını da gizlenebilir yap." ve "etiket kısmında Havalimanı simgeleri ve etiketlerini toplu halde bir yerde göster. aç kapa ayrı ayrı olmasın."):** Aynı panelin tek "Havalimanları" satırı havalimanı simgelerini (kırmızı pinler) ve kodlarını birlikte ayarlar: Gizle (ne pin ne kod), Simge (pinler görünür ve tıklanır, kod yok), Simge ve kod (varsayılan; pin ve IATA kodu, z ≥ 5). Haritada havalimanı adı yazılmaz: ad, pin ya da koda tıklanınca açılan havalimanı penceresindedir ("Kod ve ad" 2026-10-04'te kullanıcı isteğiyle kaldırıldı). Eski kayıtlar çevrilir: eski Gizle (yalnız kodları kaldırıyordu, pinler kalıyordu) Simge, eski Kod ve "Kod ve ad" Simge ve kod okunur. Gizle'de iki istisna vardır: açık havalimanı penceresinin havalimanı ("Havalimanları" listesinden, aramadan ya da Gizle'den önce pinle açılmış) pencere kapanana kadar ve `?havalimani=` hedefi parametre adresteyken pinle çizilir; kodları yazılmaz. "Havalimanları" listesi ve havalimanı araması ayardan bağımsız çalışır. Ülke adlarının yeri değişmez.
- **Askerî hava üsleri sitenin hiçbir yerinde yok (D-107; kullanıcı, 2026-10-06: "askeri havalimanlarını kaldır haritadan.", sonra "önceliğin askeri havalimanlarını kaldırmak olsun.!"):** İncirlik, Afyon, Bandırma, Eskişehir ve Çiğli hava üsleri (D-084) listelenmez: haritada pinleri, kodları, pencereleri ve "Havalimanları" listesinde satırları yoktur; `/havalimanlari`'da, site haritasında ve llms.txt'de yoktur; sayfaları (`/istasyon/<ICAO ya da IATA>`, iki dilde) 404'tür; API'nin liste, tek havalimanı ve hava durumu uçlarında yoktur (404); worker onların hava durumunu istemez. `?havalimani=<üs>` bilinmeyen kod gibidir: harita açılış görünümünde açılır. Uçak listesinin konumu en yakın sivil havalimanına göre yazılır (aşağıda). Yabancı havalimanının "Türkiye'deki en yakın havalimanı" hiçbir zaman üs değildir: uzaklık referansı da üssüzdür (halka üyeliği değişmedi; Atina, Sakız ve Kalamata İzmir Adnan Menderes'e, Mitiga Gökçeada'ya ölçülür). Kural sunucudadır (`@havayolu/db`); harita listeyi yüklerken ayrıca savunma süzgecinden geçirir (`mapShownAirports`, D-103). Ankara (Etimesgut) sivil adlıdır (kullanıcı kararı 2026-10-03) ve listededir; yurt dışındaki ortak sivil-askerî havalimanları (tarifeli sivil seferi olan: Bağdat, Podgorica, Cuxhaven/Nordholz; 4. halkada Karup, Agra, Port Harcourt City, Şigatse Barış; 5. halkada Ascension ve MidAmerica, Türkçe adlarında askerî sözcük olmadan) sivildir ve listededir. **5. halka (D-109):** OurAirports'ta tarifeli görünen ama adı yalnız askerî olan ve güvenilir sivil seferi olmayan üç alan (Wake Adası PWAK, Oakey Ordu Havacılık Merkezi YBOK, Kwajalein Bucholz PKWA) aynı listeye (`MILITARY_AIRFIELD_ICAOS`) girdi: 5. halka açılınca da listelenmez, sayfaları 404'tür, hava durumları istenmez.
- **Savaş nedeniyle kapalı havalimanları (D-110; kullanıcı, 2026-10-08: "normal şartlarda açık ama savaş nedeniyle kapalı olan örneğin ukraynadaki limanları, da ekle. ve not düş"):** normal şartlarda sivil yolcu seferi alan ama savaş ya da silahlı çatışma nedeniyle bugün sivil uçuşa kapalı havalimanları listelenir, OurAirports'ta tarifesiz görünseler de (küratörlü kapanış tablosu `CIVIL_FLIGHT_CLOSURES`, 35 kayıt; Ukrayna'nın 16 havalimanı, Kırım'daki Simferopol dahil, Rusya'nın 7'si, Kongo DC'de Goma ve Bukavu, Taiz, Sana, Lazkiye, Kamışlı, Sudan'da El Faşir, Nyala, El-Obeid, Aksum, Gao, Mopti). Havalimanı sayfasında başlığın altında, harita penceresinde başlığın altında ve `/havalimanlari`'nın yurt dışı tablosunda adın altında not durur: kesin kayıtta "Savaş nedeniyle sivil uçuşlara kapalı (2022’den beri)" / "Closed to civil flights because of the war (since 2022)", belirsiz kayıtta "Savaş nedeniyle sivil uçuşlara kapalı olabilir (2023’ten beri)" / "May be closed to civil flights because of the war (since 2023)" (yıl kaydın başlangıcından; kesinlik ölçütü D-110'da). Bu sayfaların başlığı canlı veri çekim alanının içinde olsalar da canlı trafik vaat etmez ("…: pistler ve havalimanı bilgileri"), arama sonucu açıklamasının son cümlesi nottur. Sayfalar dizine eklenir, haritada pinleri olağan görünümdedir (ayrı renk ya da simge yok). Askerî alanlar tabloda olsa da listelenmez (D-107); yeniden açılan havalimanı tablodan silinir (Krasnodar, Gelencik, Elista; resmî açılış duyurusuyla). Uçak listesinin tahmini durumu (D-085) OurAirports'ta tarifesiz olan kapalı havalimanlarına merkeze göre kuralları (hizasız İnişte ve Yaklaşmada) uygulamaz; diğer tarifesiz havalimanları gibi bir piste hizalı alçalan uçak onlara yine "Yaklaşmada" ya da "İnişte" görünebilir, konum metni de en yakın havalimanına göredir. OurAirports'ta tarifeli görünen kapalı havalimanları (12) bütün kurallara girer (D-110 → Seçilmeyenler e).
- **Ülke adları (D-095, D-096, D-099, D-100, D-102, D-103, D-107):** **Bütün ülkelerin adı yazılır, havalimanı olsun olmasın** (kullanıcı, 2026-10-05: "havalimanı olmayan ülke isimlerini eklemiyorsun."): Natural Earth 4.1.0'ın ISO 3166-1 kodlu 244 birimi (Fransız Guyanası, Svalbard gibi deniz aşırı bölgeler kendi kodlarıyla; Kosova, Tayvan, Batı Sahra Intl adlarıyla, Batı Sahra ISO 3166-1'deki gibi bütün bölge, Fas ile sınırı 27°40′ K; Somaliland Somali'de; adlar CLDR'dan, beş ülkede elle tutulan adla: KONGO DEMOKRATİK CUMHURİYETİ, KONGO CUMHURİYETİ, FİLDİŞİ SAHİLİ, MYANMAR, SVALBARD), İsrail, Filistin ve Antarktika hariç; dört bileşimde 164 ad. Etiketler → "Ülke adları" Gizle/Göster (varsayılan Göster); **ad ülkenin sınırının içinde kalır** (kullanıcı, 2026-10-05): adın görünür kutusu (bütün satırlar, harf aralığı, hale ve 3 px + 2 km güvenlik payı; Türkiye'den uzak ülkelerde 2,5 km) kara poligonunun (Natural Earth 1:10m) içine sığmadıkça ad çizilmez; kıyı da sınırdır. **Ad boş yerdedir** (kullanıcı, 2026-10-05: "boşlukta bir yerde yazsa da olur"): üreticinin modeline göre adın görünür kutusuna, yazıldığı hiçbir yakınlaştırmada, haritadaki bir havalimanının pini ya da (z5'ten) kodu girmez; ad bunun için en çok 1,5 kademe geç belirebilir. Model kodun pin başının sağındaki ve solundaki yerini sayar; haritada kod iki yana da sığmayıp pinin üstüne ya da altına geçerse adın üstüne düşebilir. Engeller commit'li OurAirports fixture'ının (2026-10-01) listelenen havalimanlarıdır (5. halkayla 3.266, savaş nedeniyle kapalı 23 havalimanı dahil; askerî üsler listede yok, D-102, D-103, D-107, D-110, D-118; model pini z4'ün altında z4 boyunda sayar, D-118); üretim OurAirports'u her gece yenilediğinden yeni listelenen bir havalimanı tablo yeniden üretilene kadar engel sayılmaz (kullanıcının karşılaştırması ACTIVATION'da). Boş yer bulunamayan ülkeler Türkiye (haritada 56 havalimanı), 4. halkayla Hindistan (105) ile Nijerya (24; D-102) ve 5. halkayla ABD'dir (501 havalimanı; D-118): ad en az çakışan noktadadır ve geç gelmez. ABD'nin adı kıta ABD'sinde aranır (çapa bölgesi [−125, 24, −66, 50], RUSYA gibi; −116,23° D, 41,89° K, Nevada'nın kuzeyi, z3'ten, Türkçe geniş haritada z3,25'ten): bölgesiz boş yer Alaska'nın kuzeyiydi ve ad kıta ABD'sine bakan hiçbir yakınlaştırmada görünmüyordu. TÜRKİYE görsel merkezinde (33,8° D, 39,4° K; Kaman yakını, Ankara'nın ~100 km güneydoğusu; z3,25'ten; z5'ten sonra kutusunda pin ya da kod yok); HİNDİSTAN z3,25'ten (İngilizcede z3), z5,15'ten sonra, NİJERYA z3,75'ten, z5'ten sonra kutusunda pin ya da kod yok. KIBRIS kullanıcı kararıyla Lefkoşa'dadır (D-095); Ercan pini adın üstündedir. Eşitlikte en erken sığan, sonra ülkenin görsel merkezine (erişilmezlik kutbu) en yakın yer seçilir; başkent rol oynamaz (çapa kuralı D-099; iki dilde ve iki genişlikte aynı nokta). Her sözcük ayrı satırda, ortalı (SUUDİ / ARABİSTAN, BİRLEŞİK / ARAP / EMİRLİKLERİ, BOSNA / HERSEK; bağlaç önceki sözcükle: BOSNIA AND / HERZEGOVINA), her genişlikte. Ad, sığdığı ilk yakınlaştırmada (0,25 adım, kademenin en küçüğünden önce değil: kademe 1 z3, 2 z3,5, 3 z4,5) belirmeye başlar, yarım kademede tam görünür; hiçbir yakınlaştırmada sığmayan 80 küçük ülke ve ada (Bahreyn, Lüksemburg, Malta, Karayip ve Pasifik adalarının çoğu) yazılmaz; RUSYA Urallar'ın batısında, Avrupa Rusyası'ndadır (çapa bölgesi, D-100): bölgenin görsel merkezinin (46,74° D, 59,04° K) iki ızgara adımı kuzeyinde, 59,86° K'de (4. halkanın Kirov (USKK) pini kutbun kutusuna girer, D-102), z3'ten; LÜBNAN z6,5'ten (İngilizcede z6,75). Bu yüzden z4–6'da az ad görünür (Türkiye görünümünde z4'te IRAK, İRAN, KAZAKİSTAN, SURİYE, TÜRKMENİSTAN, TÜRKİYE; z5'te TÜRKİYE ve SURİYE; GÜRCİSTAN z5,25'ten, BULGARİSTAN z5,5'ten, YUNANİSTAN z6,5'ten). Sayfanın dilinde büyük harf, Overpass 600, 0,32 em; beyaz 0,85, koyu hale 0,9 (glif SDF payının izin verdiği en kalın hâli, az yumuşak; D-099), zeminsiz; kademe boyları z5'te 34/22/14 px (dar ekranda 27/18/14), kademe yüzölçümündendir (700.000 ve 85.000 km² eşikleri; Irak 1, dar ya da dağınık Şili, Mozambik ve Endonezya 2, D-100); z7–8 arasında silinir, açılış görünümünde yoktur; adlar üst üste binmez (her biri kendi ülkesinde), pin, kod, uçak ve uçak etiketi her zaman üstte; İsrail ve Filistin yok, KIBRIS adanın üstünde, Lefkoşa'da. Kayma istisnası (Slovakya) yoktur. Tasarım: https://claude.ai/artifact/2Hu2UcsPVQw32MbWkAU83v (A · Sessiz büyük harf).
- **Yerleşim:** Etiketler üst üste binmez; yer yoksa etiket yana kayar ve ince bir çizgiyle uçağa bağlanır. Etiket zemini opaktır; ülke adlarının zemini yoktur.
- Tasarım: https://claude.ai/artifact/Tsu4WTeQu8CxqvyZXpTSYD (Parça 1 M6 ve Parça 3 bu tasarıma göre yapılır).

## Havalimanı adresi ve kodlar (D-076, D-109)
- Kanonik adres büyük harfli ICAO'dur (`/istasyon/LTFM`). IATA kodu ve küçük harfli biçimler 308 ile ona gider.
- **Adres takma adı (D-109):** kodu değişen havalimanının OurAirports kimliğinde (`ident`) kalan eski dört karakterli kod da 308 ile kanonik adrese gider (`/istasyon/UTSS` → `/istasyon/UZSS`, Semerkant; 5. halkada Lima SPIM → SPJC, Palm Beach KPBI → KDJT, Harare FVHA → FVRG). Kod başka bir havalimanının ICAO'suysa ICAO kazanır; başka bir OurAirports satırının ICAO'su olan kimlik (WABP, WIOD, WRLB) takma ad değildir; takma ad listelenmeyen bir havalimanına yönlenmez (halkası kapalı Lima'nın SPIM'i 5. halka açılana kadar 404). `GET /v1/airports/<takma ad>` ve hava durumu uçları kanonik kaydı verir; kayıt takma adı `identAlias` alanında taşır. Arama (D-108) takma adı tam kod olarak bulur ("UTSS" Semerkant'ı; önek olarak değil).

## Haritada arama (D-108)
- **Ne aranır:** sol üstteki kutu uçak (sefer no, çağrı kodu, tescil, hex; `GET /v1/search`, canlı önbellek) ve havalimanı arar. Havalimanı araması tarayıcıda, haritanın yüklediği listelenen havalimanları üzerindedir (açık halkalar, 5. halkayla 3.266, savaş nedeniyle kapalı havalimanları dahil, D-110, D-118; askerî hava üsleri yok, D-107); sunucuya istek gitmez. Dizin harita hazır olunca boşta, dilimlerle kurulur (D-118).
- **Alanlar:** IATA ve ICAO kodu, adres takma adı (yalnız tam kod, D-109: "UTSS" Semerkant); görünen ad (TR ve EN), resmî Türkçe ad, OurAirports adı; Türkiye'de il, şehir ve yerleşim, yurt dışında şehir (TR ve EN); ülke (kısa ve uzun, TR ve EN; Ercan için KKTC / TRNC). İki dil her sayfada aranır: "Atina" İngilizce sayfada, "Athens" Türkçe sayfada da Atina'yı bulur. Yalnız aranan, gösterilmeyen ek adlar: "Adana" Çukurova'yı, "Antep", "Urfa", "Maraş", "Afyon", "İzmit", "Fethiye" o şehrin havalimanını, "Sabiha Gökçen" (bütün adları "İstanbul" ile başlar) adın başı olarak Sabiha Gökçen'i, "Cappadocia" Kapadokya'yı, "Turkey" Türkiye'nin havalimanlarını bulur (D-108).
- **Katlama:** büyük-küçük harf, Türkçe harfler, aksanlar ve noktalama yok sayılır (İSTANBUL = Istanbul = ıstanbul; Iğdır = igdir; Łódź = lodz). "Havalimanı", "airport", "international" gibi dolgu sözcükleri sayılmaz ("antalya havalimanı" = "antalya"); sorgu hiçbir şey bulmazsa sondaki yarım yazılmış dolgu sözcüğü de sayılmaz ("antalya hava", "athens inter"): yazarken liste kapanmaz. Eşleşme yalnız sözcük başındadır: "port" hiçbir "Airport"u, "ist" Priştine'yi bulmaz. Çok sözcüklü sorguda her sözcük bir alanda geçmelidir ("adnan gaziemir", "atina yunanistan"). 3 harfli sorgu da sözcük başlarını önerir ("sab" ve "gok" Sabiha Gökçen'i, "ant" Antalya'yı); havayolu kodu biçimindeki "THY" de Sfaks Thyna'yı önerir, ama Enter onu açmaz (aşağıda).
- **Sıralama:** önce tam kod (yalnız İngilizce harf ve rakamla, 3–4 karakter; İ ve ı I ve i olur: "İST" IST'dir, "küt" Kutaisi'nin KUT kodu değildir), sonra adın ya da yerin başı, sonra sözcük başı (kod önekleri dahil: "LTF"), en son ülke adı (en az 3 harf, boşluk sayılmaz). Aynı basamakta İstanbul Havalimanı, Türkiye, tarifeli sefer, büyüklük, Türkiye'ye uzaklık ve ad sırası. Liste en çok 8 havalimanıdır; fazlası varsa durum satırı toplamı ve "aramayı daralt" der. Rakamlı ya da hex sorgu yalnız tam kod arar; tek harf hiçbir şey bulmaz.
- **Yazarken ve Enter:** yazarken yalnız havalimanı önerilir (ağ isteği yok, hiçbir öneri kendiliğinden seçilmez). Enter ya da "Ara" uçak aramasını da yapar: tek uçak (havalimanı eşleşmesi yoksa) seçilir; uçak yoksa tam kod eşleşmesi ("ESB", "LTAC", "ist") ya da en az 4 harfli sorguyla adla eşleşen tek havalimanı ("esenboğa") doğrudan açılır; yurt dışındaki bir havalimanının tam kodu, sorgu Türkiye'deki bir havalimanının adına ya da yerine de uyuyorsa açılmaz, liste gösterilir ("den": Denver ve Denizli, "sin": Singapur ve Sinop; D-118); ikisi de yoksa açıklayıcı metin; öbür durumlarda "Havalimanları" sonra "Uçaklar" gruplu tek liste ve kullanıcı seçer. Harfler aranan sorgununkidir: dolgu sözcükleri ve atılan yarım dolgu sözcüğü sayılmaz ("THY airport", "THY h" 3 harftir; "esenboğa hav" 8). 3 harfle tek ad eşleşmesi doğrudan açılmaz: "THY" (havayolu kodu) haritayı Sfaks Thyna'ya uçurmaz, "gok" Sabiha Gökçen'i tek satırlık listede gösterir. Ülke adıyla tek eşleşme de açılmaz: "turkish" ("Turkish Airlines" yazılırken) Ercan'ı (KKTC'nin İngilizce uzun adı "Turkish Republic of Northern Cyprus") tek satırlık listede gösterir. Türkçe harfli sorgu ("esenboğa") uçak aramaz; Türkçe klavyenin İ ve ı harfleri ("TC-JİA") uçak aramasında I ve i olur.
- **Havalimanı seçmek** pine tıklamakla aynıdır: harita en az z10 ile oraya uçar, havalimanı penceresi açılır (geniş ekranda pinin yanında, telefonda alttan), seçili uçak ve kartı kapanır. Adres değişmez: `?havalimani=` pencere açmayan giriş bağlantısıdır (D-079), paylaşılacak adres havalimanının sayfasıdır (`/istasyon/<ICAO>`). Pencere odağı alır; kapanınca odak arama kutusuna döner (klavye ve fare). Dokunarak seçilince telefon klavyesi kapanır ve pencere kapanınca odak haritaya gider (klavye yeniden açılmaz).
- **Klavye:** aşağı/yukarı ok listeyi açar ve gezer (etkin satır listenin görünen alanına kaydırılır), Enter seçer, Escape önce listeyi kapatır (odak kutuda ya da "Ara"dayken; açık pencere kapanmaz), Tab listeyi kapatır. "Ara" düğmesinden açılan listede odak kutuya döner.
- **Vurgulama yoktur:** eşleşen parça satırda işaretlenmez.
- **Hata durumları:** ad parçası yüklenemezse (yayından sonra açık kalan eski sekme, kesik bağlantı) havalimanı yalnız tam koduyla bulunur ve durum satırı bunu söyler; uçak araması hata verirse havalimanı sonuçları yine listelenir; havalimanı listesi yüklenemediyse yalnız uçak aranır (uçak olamayan sorguda "Arama şu an yapılamıyor" denir, "bulunamadı" değil). Havalimanı bulunamayınca metin kapsamayı da söyler: Türkiye dışında yalnız açık halkanın sınırına (M6i.2'den beri 5.000 km, D-102; v0.22.3'te 2.000 km) kadarki havalimanları aranır.

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
- Merkeze göre kurallar (hizasız İnişte ve Yaklaşmada) yalnızca tarifeli seferi olan havalimanlarında uygulanır (OurAirports `scheduled_service`). Tarifesiz havalimanında (ör. ISL Atatürk, USQ Uşak) durum yalnızca pist hizasından çıkar; konum metni yine en yakın havalimanına, tarifesiz olsa da, göredir.
- Havalimanı seçimi: merkeze göre birden çok aday varsa önce giriş koşuluna kendi başına uyan, sonra gösterilen havalimanı, sonra iz yönüne en yakın olan, sonra en yakın olan seçilir. Hizalı pist her zaman önce gelir.
- Hizalı pist: iz ile pist yönü farkı ≤ 15°, merkez hattına yanal sapma ≤ 1 km (motorun pist hizası) ve uçak pist eşiğinden önce en çok 15 km'de ya da eşiği en çok 0,3 km geçmiş; birden çok uç hizalıysa eşiği en yakın olan. Pist uçları listelenen havalimanlarının API kaydından gelir (kaydırılmış eşik dahil). Tırmanan uçak (kalkış, pas geçme) hizalı olsa da yaklaşmada sayılmaz.
- Dikey hız akışta yoksa irtifa değişiminden (en az 2 sn arayla) türetilir. İrtifası bilinmeyen havadaki uçak yalnızca konumla yazılır.
- Alçakta sinyal kaybı: yaklaşmada ya da inişteyken son örnek 30 sn'den eski, yerden yükseklik < 3.000 ft ve havalimanı merkezine ≤ 20 km.
- Kararlılık: çıkış eşikleri giriştekinden geniştir (35 km, 11.000 ft, iniş 1.800 ft ve 10 km; tırmanış > +300 ft/dk). Gösterilen havalimanı alçalma bitse de tutulur; uçak tırmanınca ya da havalimanı uçağın arkasında kalınca (iz ile havalimanı yönü farkı > 90°) yaklaşma biter. Yeni durum ya da havalimanı, örnek zamanıyla 5 sn sürünce gösterilir; o sürede gösterilen durumun uzaklığı yeni örnekle güncellenir. Yeni görülen uçağın ilk durumu beklemeden gösterilir. Önceki örnekten 30 sn'den uzun süre sonra gelen örnekte (seyrek veri, D-122) 5 sn'lik onay beklenmez, yeni durum hemen gösterilir. Yumuşatma, her yeni örnekte α = 0,5 üstel ortalamadır. Pist eşiğini geçen inişteki uçak pist adını korur.
- Havalimanından 6 km'den uzakta yerde görünen uçak "Yerde" rozetiyle en yakın havalimanına göre yönlü konumla yazılır. Havalimanları yüklenmemişse konum koordinattır.
- Konum: durumun havalimanı, yoksa en yakın listelenen havalimanı (askerî hava üsleri listede olmadığı için hiçbir zaman üs değildir, D-107; üssün yakınındaki uçak en yakın sivil havalimanına göre yazılır: "ADB, 25 km"), IATA koduyla: "IST, 18 km", "IST, pist 35L", "IST üzerinde" (3 km içinde), "IST, 45 km kuzeyinde" (8 yön). Uzaklık havalimanı merkezine yataydır.
- Liste altında "Durumlar tahminidir" notu durur (web-ui.md: tahmini bilgi "tahmini" etiketi taşır). Durumlar canlı bölge değildir; değişince ekran okuyucuya duyurulmaz.
- Bilinen sınır: güzergâh bilinmediği için başka bir havalimanına giderken tarifeli bir havalimanının önünden alçalarak geçen uçak (ör. Trakya'dan IST'ye gelirken Çorlu/TEQ'in yakınından) o havalimanının süzülüş zarfında kaldığı kısa süre (gözden geçirmedeki örnekte ~45 sn) ona "Yaklaşmada" görünebilir. Parça 2 motorunun tahmini rotası bunu çözer.
- Bilinen sınır (D-107): askerî hava üsleri listede olmadığı için üsse inen ya da üste yerde duran (askerî bayrağı olmayan) uçağın durumu yakındaki sivil havalimanına yazılır. Eskişehir Hava Üssü'nün (LTBI) pist eşikleri Hasan Polatkan'ın (AOE) merkezine 4,9 ve 7,5 km'dir (merkezler arası 6,2 km; pistler paralel ve ~2,9 km aralıklı, hizalı pist AOE'ye eşleşmez): üsse iki yönden inen uçak "Yaklaşmada" ve "İnişte" rozetiyle AOE'ye göre yazılır ("AOE, 4 km"); pistin batı yarısındaki yerdeki uçak "Yerde" rozeti ve yalnız "AOE" kodunu alır, yani AOE'de yerde görünür (v0.22.1'de üçünde de ESK). Çiğli'de (17 eşiği ADB merkezine 29,1 km) yalnız eşikten önceki son ~0,5 km "Yaklaşmada" rozetiyle ADB'ye göre yazılabilir; yerdeki uçak "ADB, 28 km kuzeybatısında" yazılır. İncirlik, Afyon ve Bandırma tarifeli bir havalimanına 30 km'den uzaktır (en yakın vaka İncirlik–COV, 33,8 km); durumları etkilenmez. Düzeltmek için üslerin konumu istemciye taşınmalıydı; D-107 kuralı tek yerde (sunucuda) tutar.

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

## Canlı yayın kapsamı ve canlı katman (D-115)
- **Kural (kalıcı, D-115; açılış aşamalıdır, kapsam genişlemez):** yalnız bilinen bir havayolu çağrı koduyla uçan uçaklar yayınlanır. Çağrı kodu üç harfli ICAO işletmeci kodu ve rakamla başlayan en çok dört karakterlik uçuş tanıtıcısıdır (THY974, PGT15UE); işletmeci kodu VRS'te bilinmeli, reddedilenler tablosunda (askerî, devlet, polis ve sınır, uçuş kontrolü, ambulans ve kurtarma, iş jeti ve VIP) olmamalı ve VRS'e göre bütün uçuşları charter ya da konumlandırma olan bir işletmecinin (`.*`, iş jeti ve şirket uçuşları) olmamalıdır. Askerî, ilginç, PIA ya da LADD bayraklı, bayrağı bilinmeyen, ICAO dışı adresli, helikopter, planör, İHA ve yer aracı kategorili uçaklar yayınlanmaz; IATA kodu olmayan işletmecinin A1/A2 (hafif ve küçük), kategorisi ya da tipi bilinmeyen uçağı da yayınlanmaz; iş jeti tipleri (Gulfstream, Global, Falcon, Citation …) işletmeciden bağımsız yayınlanmaz; tescilini çağrı kodu olarak gönderen uçak (UP-A2001 → UPA2001) tescil bilinmese de yayınlanmaz. Kural kapalı varsayımla çalışır: emin olunamayan uçak yayınlanmaz. Kuralın tam sırası ve tablolar D-115'tedir (`packages/providers/src/live-scope.ts`). Kapsam `LIVE_AIRCRAFT_SCOPE`'tur; üretimde her zaman `airline` (kalıcı kural; askerî, devlet, özel ve tanımsız uçaklar hiçbir zaman gösterilmez), geliştirme ve testte `all` (yalnız engel listesi ve askerî bit) seçilebilir.
- **Kaynakta süzme:** kural worker'da, örnek kabul edildikten hemen sonra uygulanır. Yayınlanmayan uçak `redis-live`'a, `flights`'a, iz tablolarına, olaylara ve bildirimlere hiç girmez; yalnız nedene göre anonim sayılar tutulur (hex, çağrı kodu ve tescil yok). Daha önce yayınlanmış bir uçak kuralı artık tutmazsa (ör. engel listesine eklendi) canlı durumdan silinir ve açık uçuş kaydı kapanır. Worker açılışta önceki süreçten kalan canlı uçakları siler (katman açık da olsa); kural tutanlar ilk turda geri gelir. Kapsama raporu (D-098) bu yüzden yalnız yayınlanan uçuşları sayar.
- **Bütün kanallar yayınlanmış veriyi okur:** harita, arama, REST, WS, takip listesi, ileride uçuş sayfası, geçmiş ve oynatma, bildirimler ve paylaşım görselleri. Olay motoru ve bildirimci (Parça 2) yalnız yayınlanmış örnekleri görür.
- **Canlı katman (admin anahtarı):** yönetici `/admin/canli-katman`'da katmanı kapatıp açar; durum PostgreSQL'dedir (`live_layer_state`, satır yoksa açık) ve her basış `admin_actions`'a yazılır. Kapalıyken worker hiçbir örneği yazmaz ve `redis-live`'daki canlı uçakları siler (veri çekimi ve sağlık kaydı sürer); API ve WS boş küme ve `status.layer: "off"` döner, harita bunu durum şeridinde söyler; olay motoru ve bildirimci hiçbir şey göndermez. Açılınca uçaklar bir sonraki çekimle gelir. Uygulanma süresi en çok ~5 sn'dir. v0.28.0'dan eski imajlar anahtarı ve yalnız-havayolu süzgecini tanımaz: `rollback.yml` böyle bir hedefi reddeder (DEPLOY_DOKPLOY §12).
- **İkinci hat:** API ayrıca askerî ve bayrağı bilinmeyen uçağı gizler, PIA/LADD tescilini gizler ve engel listesini uygular (D-071, D-074); havayolu kuralını yeniden çalıştırmaz.

## v1 sınırları (kullanıcıya açıkça söylenir)
ADS-B yalnızca konum, irtifa, hız ve kimlik verir. Tarife verisi olmadığından v1'de şunlar **yoktur**:
- tarifeli/tahmini kalkış ve varış saati
- rötar, kapı/terminal/bagaj, kod paylaşımı, iptaller
- kalkış öncesi kalkış panosu
- harfli numaralı çağrı kodlu seferlerde kalkıştan önce sefer no ile arama

Canlı uçak verisi şimdilik yalnızca Türkiye ve çevresinden çekilir (kapsama planı: data-sources.md §1, D-073); bu alanın dışında haritada yalnızca takip listesindeki uçaklar görünebilir (P1, `/v2/hex`, data-sources.md §1). Site metinleri ürünü Türkiye ile sınırlamaz, birincil istasyon İstanbul Havalimanı'dır; sınır kapsama metinlerinde (/hakkinda, /havalimanlari, havalimanı sayfaları, haritanın durum satırı) söylenir (D-106).

adsb.lol IP başına günde 500 istek kabul eder (D-122, v0.28.1). Worker bu bütçeyle Batı Türkiye'yi ~3–6 dk'da, Doğu Türkiye'yi ~9 dk'da bir sorgular; takip listesi (`/v2/hex`) bu kipte çekilmez. Harita aradaki hareketi tahmini konumla gösterir ve durum şeridinde "Canlı veri şu an seyrek …" yazar. Yukarıdaki olay kuralları (10 km yaklaşma, `LOW_ALT_LOST`, pas geçme, `probable_landing`) sık veriye göre yazıldı; bütçe kipinde güvenilir değildir (D-122 "API anahtarı ya da yüksek sınır gelince").

Tahmini varış yalnızca havadaki uçak için konumdan hesaplanır ve "tahmini" etiketi taşır. Rota tahmini (VRS standing-data) de her yerde "tahmini" olarak gösterilir. Kendi alıcı olmadığı için inişlerin çoğu "muhtemelen indi" olarak ve son sinyalden 1–1,5 dk sonra bildirilir.

## Saklama
- **`track_points_sampled`:** 30 sn örnekleme, 7 gün.
- **`track_points_fine`:** tam çözünürlük, 30 gün. Şunlar yazılır:
  - (a) bu istasyon için varış ya da kalkış olarak sınıflanmış, ARP'a ≤ 30 km ve AGL < 10.000 ft olan uçaklar
  - (b) takip listesindeki uçaklar (konumdan bağımsız)
- **İz satırı:** konum, irtifa (barometrik, geometrik), yer hızı, yön, görünen dikey hız (`vertical_rate_fpm`: barometrik, yoksa geometrik), yerde bayrağı, konum kaynağı kodu ve kapsama raporu için iki ham değer (D-097): `seen_pos_s` (kaynağın bildirdiği konum yaşı, sn) ve `baro_rate_fpm` (barometrik dikey hız). Kaynak göndermediyse ikisi de null'dır; yerlerine `seen` ya da geometrik hız konmaz. v0.20.0'dan önce yazılan satırlarda null'dır.
- **Özetler:** `flights` ve `events` en çok 30 gün tutulur (kullanıcı kararı K7, 2026-10-15: hiçbir kayıt 30 günden uzun tutulmaz; D-115). Budama işi K7 ile gelir ve canlı açılış kapısındadır (ACTIVATION 2. adım (g)). İz verisi süresi dolan bir uçuş sayfası olay zaman çizelgesini göstermeye devam eder ve "iz verisi saklama süresini aştı" der.
- İz tabloları yedeğe girmez (infra.md → Yedekleme).
- **Canlı katman ve işlem kaydı (D-115):** `live_layer_state` tek satırdır (son durum). `admin_actions` (kim, ne zaman, işlem, isteğe bağlı neden) en çok 30 gün tutulur (K7, D-115; budama `flights` ve `events`'inkiyle birlikte gelir): özen yükümlülüğünün kanıtıdır, kişisel veri olarak yalnız yöneticinin kendi adresini taşır, IP yazılmaz.
