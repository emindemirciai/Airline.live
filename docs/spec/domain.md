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
- DB'de tüm zamanlar UTC'dir (`timestamptz`). Arayüzde yerel saat (Europe/Istanbul) ya da UTC ("Z" ekiyle) seçilebilir.
- Olay zamanları her zaman konum örneğinin `sampleTime`'ından alınır, sunucu saatinden alınmaz.
- Sade görünümde kısaltma kullanılmaz: ETA → "tahmini varış", ARP → "havalimanı merkezi", AGL → "yerden yükseklik".

## Harita etiketleri (kullanıcı tasarım kararı 2026-09-28, D-072)
- **Sefer no gösterimi:** Havayolu kodu ile numara arasında tire kullanılır: TK-4, TK-1985. Bu dosyadaki bildirim örnekleri de arayüzde bu biçimle yazılır. Aramada TK4, TK 4 ve TK-4 aynı sayılır.
- **Etiket alanları (Tam):**
  1. sefer no; bilinmiyorsa çağrı kodu gri yazılır
  2. güzergâh, IATA kodlarıyla (JFK-IST); tahminidir, bilinmiyorsa "Güzergâh ?"
  3. hız ve yükseklik (431 km/sa · 333 m); uçak yerdeyse yükseklik yerine "yerde"
  4. ineceği pist (Pist 35L); yalnızca bir piste hizalanmış yaklaşmada
- **Kısa:** yalnızca sefer no (yoksa çağrı kodu).
- **Göster/gizle:** Seçili uçak ve diğer uçaklar için ayrı ayrı Gizle, Kısa ya da Tam seçilir. Varsayılan ikisi için de Tam'dır. Ayar haritadaki "Etiketler" düğmesinden açılır ve cihazda saklanır.
- **Yerleşim:** Etiketler üst üste binmez; yer yoksa etiket yana kayar ve ince bir çizgiyle uçağa bağlanır. Etiket zemini opaktır.
- Tasarım: https://claude.ai/artifact/Tsu4WTeQu8CxqvyZXpTSYD (Parça 1 M6 ve Parça 3 bu tasarıma göre yapılır).

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
- **Kapsama kalitesi:** Son 7 günde en az bir yerde örneği görülen varışların oranıdır. `jobs` rolündeki günlük iş bunu `stations.coverage_ground_ratio_7d` alanına yazar. Oran %70'in altındaysa istasyon sayfasında, takip kurulurken ve istasyon akışı filtresinde şu uyarı gösterilir: "Bu istasyonda inişlerin çoğu muhtemel iniş olarak bildirilir." Gözlenen `touchdown` yine kesin olarak bildirilir.

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

Tahmini varış yalnızca havadaki uçak için konumdan hesaplanır ve "tahmini" etiketi taşır. Rota tahmini (VRS standing-data) de her yerde "tahmini" olarak gösterilir. Kendi alıcı olmadığı için inişlerin çoğu "muhtemelen indi" olarak ve son sinyalden 1–1,5 dk sonra bildirilir.

## Saklama
- **`track_points_sampled`:** 30 sn örnekleme, 7 gün.
- **`track_points_fine`:** tam çözünürlük, 30 gün. Şunlar yazılır:
  - (a) bu istasyon için varış ya da kalkış olarak sınıflanmış, ARP'a ≤ 30 km ve AGL < 10.000 ft olan uçaklar
  - (b) takip listesindeki uçaklar (konumdan bağımsız)
- **Özetler:** `flights` ve `events` en az 365 gün tutulur. İz verisi süresi dolan bir uçuş sayfası olay zaman çizelgesini göstermeye devam eder ve "iz verisi saklama süresini aştı" der.
- İz tabloları yedeğe girmez (infra.md → Yedekleme).
