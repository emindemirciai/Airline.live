# Yenilikler / Changelog

> Bu dosya `packages/shared/src/changelog/entries.ts` kaynağından `pnpm changelog` ile üretilir; elle düzenleme.
> Aynı içerik uygulamada **Yenilikler** (`/yenilikler`) sayfasında görünür.
>
> *Generated from `packages/shared/src/changelog/entries.ts` by `pnpm changelog`; do not edit by hand.*
> *The same content appears in the app’s **What’s new** (`/yenilikler`) page.*

---

## v0.14.1 — 2026-10-03

### Türkçe
**Rüzgâr renkleri ve rüzgâr kesmesi uyarısı**

- Rüzgârlı havalimanları artık renkli: ortalama rüzgâr 31 km/sa’i (17 kt) ya da hamle 46 km/sa’i (25 kt) geçince rüzgâr satırı turuncu olur ve “Sert rüzgâr” ya da “Hamleli rüzgâr” yazar; daha güçlüsü yine “Kuvvetli rüzgâr”, “Fırtına” … diye adlandırılır. Bütün havalimanlarının canlı verisiyle denetlendi; önceden renksiz kalan 12 rüzgârlı havalimanı artık renkli.
- Hafif rüzgâr (10 km/sa ve altı, sakin dahil) açık yeşil satırla ve “Hafif rüzgâr” etiketiyle gösterilir; arası normal renkte kalır.
- METAR’da bildirilen rüzgâr kesmesi (wind shear) artık rüzgâr satırında yazılır ve vurgulanır: “Rüzgâr kesmesi bildirildi: pist 34”.

Dene: [Havalimanları](/havalimanlari) · [Haritada İstanbul](/?havalimani=LTFM)

### English
**Wind colours and wind shear warnings**

- Windy airports are now highlighted: when the mean wind reaches 31 km/h (17 kt) or gusts reach 46 km/h (25 kt), the wind row turns amber and says “Fresh wind” or “Gusty wind”; stronger winds are still named “Strong wind”, “Gale” and so on. Checked against live data from every airport; 12 windy airports that were not highlighted before now are.
- Light wind (10 km/h or less, calm included) is shown with a light green row and a “Light wind” tag; winds in between keep the normal colour.
- Wind shear reported in the METAR is now shown and highlighted in the wind row: “Wind shear reported: runway 34”.

Try it: [Airports](/havalimanlari) · [Istanbul on the map](/?havalimani=LTFM)

---

## v0.14.0 — 2026-10-03

### Türkçe
**Doğru havalimanı adları, haritada ad etiketi ve yurt dışında yerel saat**

- Askerî havalimanları artık Türkçe sayfalarda Türkçe, İngilizce sayfalarda İngilizce adıyla görünüyor: İncirlik, Afyon, Bandırma, Eskişehir ve Çiğli Hava Üssü (Incirlik … Air Base). Etimesgut’un yeni resmî adı “Ankara (Etimesgut) Havalimanı” olarak yazılıyor.
- Haritadaki “Etiketler” menüsüne Havalimanları seçeneği geldi: Gizle, Kod ya da Kod ve ad. Kod ve ad seçilince yakınlaşınca “IST İstanbul” gibi kısa adlar görünür. Gizle yalnız yazıları kaldırır; kırmızı iğneler her zaman haritada kalır ve tıklanır.
- Türkiye dışındaki havalimanlarında yerel saat UTC farkıyla yazılıyor: “Yerel saat 23:05 (UTC+2)”. Havalimanı sayfasında gün doğumu ve batımı geri geldi; gözlem, tahmin ve METAR/TAF kaydı saatleri havalimanının kendi saatiyle. Saat dilimleri IANA saat dilimi veritabanından (kamu malı).

Dene: [Atina Havalimanı yerel saat](/istasyon/LGAV) · [Havalimanları](/havalimanlari) · [Haritada etiketler](/?havalimani=LTFM)

### English
**Correct airport names, name labels on the map and local time abroad**

- Military airfields now show their Turkish names on Turkish pages and English names on English pages: İncirlik, Afyon, Bandırma, Eskişehir and Çiğli Air Base. Etimesgut appears under its new official name, “Ankara (Etimesgut) Airport”.
- The map’s “Labels” menu has a new Airports option: Hide, Code or With name. With name shows short names such as “IST Istanbul” when you zoom in. Hide removes only the text; the red pins always stay on the map and remain clickable.
- Airports outside Türkiye now show local time with the UTC offset: “Local time 23:05 (UTC+2)”. Their pages show sunrise and sunset again, and observation, forecast and METAR/TAF log times are in the airport’s own time. Time zones come from the IANA time zone database (public domain).

Try it: [Athens Airport local time](/istasyon/LGAV) · [Airports](/havalimanlari) · [Labels on the map](/?havalimani=LTFM)

---

## v0.13.1 — 2026-10-03

### Türkçe
**Havalimanı penceresi hizalı tablo oldu**

- Ortalı düzen yamuk göründüğü için haritadaki havalimanı penceresi tek bir hizalı tabloya döndü: bütün satırlarda simgeler, etiketler ve değerler aynı sütunda başlıyor; başlık, hava durumu başlığı, gözlem satırı ve bağlantı da aynı kenardan.
- Rakım, pistler ve yerel saat satırlarının da simgesi var.

Dene: [Haritada İstanbul penceresi](/?havalimani=LTFM)

### English
**The airport window is now a neatly aligned table**

- The centred layout looked uneven, so the map’s airport window is now a single aligned table: icons, labels and values start in the same column on every row, and the title, weather headline, observation line and link share the same edge.
- The elevation, runways and local time rows now have icons too.

Try it: [Istanbul window on the map](/?havalimani=LTFM)

---

## v0.13.0 — 2026-10-03

### Türkçe
**Rüzgâr knot ile, şimşek ve yıldırım uyarısı, ortalı havalimanı penceresi**

- Rüzgâr hızı km/sa’nın yanında knot olarak da yazılıyor: “Kuzeydoğudan 48 km/sa (26 kt), hamle 59 km/sa (32 kt)”. Pencerede, havalimanı sayfasında, tahminlerde ve METAR/TAF kaydında aynı biçim kullanılıyor.
- Etkili rüzgâr her havalimanında belirtiliyor: ortalama rüzgâr 20 knotu ya da hamle 30 knotu geçince (MGM’nin meydan uyarı ölçütü) rüzgâr satırı renkli ve kalın yazılıyor, şiddeti de adıyla söyleniyor: “Kuvvetli rüzgâr”, “Fırtınamsı rüzgâr”, “Fırtına” … Yalnızca hamle güçlüyse “Kuvvetli hamle”. Tahmin özeti de dönemin en güçlü rüzgârını gösteriyor.
- Şimşek ve yıldırım uyarısı: havalimanında gök gürültüsü varsa “şimşek ve yıldırım tehlikesi”, çevresinde varsa “yıldırım havalimanına da düşebilir” yazıyor. Kümülonimbüs (oraj bulutu) yağışla birlikteyse tehlike, yağışsızsa olasılık olarak belirtiliyor. Yıldırım yağmurun dışına, fırtınadan kilometrelerce uzağa da düşebildiği için uyarı yağmur yokken de gösteriliyor.
- Haritadaki havalimanı penceresinde bütün yazılar ortalı; sayılar birimlerinden ayrılmıyor.

Dene: [Haritada İstanbul penceresi](/?havalimani=LTFM) · [İstanbul Havalimanı hava durumu](/istasyon/LTFM)

### English
**Wind in knots, lightning warnings and a centred airport window**

- Wind speed is now given in knots as well as km/h: “From the northeast 48 km/h (26 kt), gusts 59 km/h (32 kt)”. The same format is used in the map window, on the airport page, in forecasts and in the METAR/TAF log.
- Significant wind is flagged at every airport: when the mean wind reaches 20 knots or gusts reach 30 knots (the Turkish aerodrome warning threshold), the wind row is coloured and bold and the strength is named: “Strong wind”, “Near gale”, “Gale” … If only the gusts are strong it says “Strong gusts”. The forecast summary now shows the strongest wind of the period.
- Lightning warnings: a thunderstorm at the airport shows “lightning danger”, one nearby shows “lightning can strike the airport too”. Cumulonimbus (thunderstorm cloud) with precipitation is shown as a danger, without precipitation as a possibility. Lightning can strike well away from the rain and kilometres from the storm, so the warning also appears when it is not raining.
- All text in the map’s airport window is centred, and numbers no longer break away from their units.

Try it: [Istanbul window on the map](/?havalimani=LTFM) · [Istanbul Airport weather](/istasyon/LTFM)

---

## v0.12.0 — 2026-10-02

### Türkçe
**Yakın ülkelerdeki havalimanları ve yeni turkuaz görünüm**

- Türkiye’deki en yakın havalimanına 500 km’den yakın 75 yabancı havalimanı eklendi: Yunanistan, Bulgaristan, Kıbrıs, Gürcistan, Ermenistan, Azerbaycan, İran, Irak, Suriye, Lübnan ve diğer komşu ülkelerden. Her birinin Türkçe adı, sayfası, pistleri ve canlı hava durumu var; haritada kırmızı iğneyle görünür. Ercan Havalimanı KKTC’de gösterilir. Uzak ülkeler sonraki sürümlerde halka halka gelecek.
- Site yeni, açık turkuaz bir görünüme geçti. Bütün yazılar okunabilirlik ölçütünü karşılıyor; telefonun karanlık modu açıkken de site aynı görünür.
- Hava durumu daha kolay okunuyor: sıcaklık başlığın yanında ayrı bir kutucukta; rüzgâr, yağmur, kar, gök gürültüsü, sis ve görüş satırlarının başında simge var. O an yağmur, kar, gök gürültüsü ya da sis varsa satırı renkli ve kalın yazılır. Haritadaki havalimanı penceresinden gün doğumu ve batımı kaldırıldı; havalimanı sayfasında duruyor.
- Sayıların önünde artık eksi gibi okunabilecek “·” işareti yok: uçak etiketleri “431 km/sa, 333 m”, hava durumu “Kuzeydoğudan 33 km/sa, hamle 59 km/sa” biçiminde.
- Telefonda havalimanı penceresinin “Havalimanı sayfası” bağlantısı kaydırmadan görünüyor, arama kutusunun ipucu kesilmiyor. Beklenmedik bir hatada artık sitenin kendi Türkçe ve İngilizce hata sayfası açılıyor.

Dene: [Havalimanları](/havalimanlari) · [Atina Havalimanı](/istasyon/LGAV) · [Haritada İstanbul](/?havalimani=LTFM)

### English
**Airports in nearby countries and a new turquoise look**

- Added 75 airports abroad that lie within 500 km of the nearest airport in Türkiye: in Greece, Bulgaria, Cyprus, Georgia, Armenia, Azerbaijan, Iran, Iraq, Syria, Lebanon and other neighbouring countries. Each has its page, runways and live weather, and appears on the map with a red pin. Ercan Airport is shown in the TRNC. More distant countries will follow ring by ring in later releases.
- The site has a new light turquoise look. All text meets the readability contrast guidelines, and the site looks the same when your phone is in dark mode.
- Weather is easier to read: the temperature sits in its own badge next to the headline, and the wind, rain, snow, thunderstorm, fog and visibility rows have icons. If rain, snow, a thunderstorm or fog is happening right now, its row is coloured and bold. Sunrise and sunset were removed from the map’s airport window; they remain on the airport page.
- Numbers are no longer preceded by a “·” that could be read as a minus sign: aircraft labels read “431 km/h, 333 m” and weather reads “From the northeast 33 km/h, gusts 59 km/h”.
- On phones, the airport window’s “Airport page” link is visible without scrolling, and the search box hint is no longer cut off. Unexpected errors now show the site’s own error page in Turkish and English.

Try it: [Airports](/havalimanlari) · [Athens Airport](/istasyon/LGAV) · [Istanbul on the map](/?havalimani=LTFM)

---

## v0.11.0 — 2026-10-02

### Türkçe
**Havalimanlarında canlı hava durumu ve haritada havalimanı penceresi**

- Her havalimanı sayfasında canlı hava durumu var: sıcaklık, rüzgâr (yön, hız ve hamle), görüş, bulut, nem ve basınç. Yağmur, kar, gök gürültüsü ve sis her zaman ayrı ayrı yazılır; belirlenemiyorsa “Belirlenemedi” denir. Gözlem saati, yerel saat, gün doğumu ve batımı ile önümüzdeki saatlerin tahmini de sade bir dille gösterilir. Veri aviationweather.gov’dan beş dakikada bir alınır.
- METAR/TAF kaydı: havalimanı sayfasında son 24 saatte yayımlanan bütün METAR ve TAF raporları ham metni ve kısa bir özetiyle listelenir. Raporlar 30 gün saklanır.
- Haritada havalimanları kırmızı bir iğneyle işaretleniyor; iğnenin ucu havalimanının tam yerini gösterir. İğneye ya da koda tıklayınca küçük bir pencere açılır: hava durumu, kodlar, rakım, pistler, yerel saat, gün doğumu ve batımı ile havalimanı sayfasının bağlantısı. Klavyeyle “Havalimanları” düğmesinden açılır.
- Harita açılışta ve her yenilemede İstanbul Havalimanı’na ortalanıyor. Haritadaki yazılar biraz küçüldü.
- Sefer sayısı, rötar ve iptal bilgisi henüz yok; havalimanı sayfası bunu açıkça yazıyor. “Tarifeli sefer” ve “İzlenen istasyon” bilgileri sayfalardan kaldırıldı.

Dene: [İstanbul Havalimanı hava durumu](/istasyon/LTFM) · [Canlı harita](/)

### English
**Live airport weather and an airport window on the map**

- Every airport page now shows live weather: temperature, wind (direction, speed and gusts), visibility, cloud, humidity and pressure. Rain, snow, thunderstorms and fog are always listed separately; if they cannot be determined, the page says so. The observation time, local time, sunrise and sunset, and a plain-language forecast for the coming hours are shown too. Data comes from aviationweather.gov every five minutes.
- METAR/TAF log: the airport page lists every METAR and TAF issued in the last 24 hours with its raw text and a short summary. Reports are kept for 30 days.
- Airports are marked on the map with a red pin whose tip shows the exact location. Clicking the pin or the code opens a small window with the weather, codes, elevation, runways, local time, sunrise and sunset, and a link to the airport page. Keyboard users can open it from the “Airports” button.
- The map now opens centred on Istanbul Airport, also after every reload. Map labels are slightly smaller.
- Flight counts, delays and cancellations are not available yet, and the airport page says so plainly. The “scheduled service” and “monitored station” details were removed from the pages.

Try it: [Istanbul Airport weather](/istasyon/LTFM) · [Live map](/)

---

## v0.10.0 — 2026-10-01

### Türkçe
**Havalimanı sayfaları ve İngilizce adresler**

- Türkiye’deki 61 havalimanının listesi ve her biri için ayrı bir sayfa geldi: resmî adı, IATA ve ICAO kodları, il, rakım, havalimanı merkezinin koordinatları, pistler (uzunluk, genişlik, kaplama, yön) ve en yakın üç havalimanı. Sivil havalimanlarının resmî adları DHMİ’nin ve işletmecilerin güncel listelerinden alındı.
- Havalimanı sayfasındaki “Canlı haritada aç” bağlantısı haritayı o havalimanına ortalar. Havalimanı canlı veri kapsamının dışındaysa sayfa bunu açıkça söyler.
- Her sayfanın İngilizce sürümü artık kendi adresinde: örneğin /en/havalimanlari. Dil düğmesi aynı sayfanın diğer diline geçer ve paylaştığın bağlantı hep aynı dilde açılır.
- Yeni “Hakkında” sayfası sitenin ne gösterip ne göstermediğini, veri kaynaklarını ve lisanslarını, gizlilik kurallarını ve verinin ne kadar taze olduğunu anlatıyor.
- Site arama motorlarında ve yapay zekâ yanıtlarında daha iyi bulunacak: site haritası, dil eşleştirmeleri, yapılandırılmış veri, paylaşım görselleri ve sitenin kısa bir özeti eklendi.

Dene: [Havalimanları](/havalimanlari) · [İstanbul Havalimanı](/istasyon/LTFM) · [Hakkında](/hakkinda)

### English
**Airport pages and English addresses**

- A list of the 61 airports in Türkiye, with a page for each: official name, IATA and ICAO codes, province, elevation, airport reference point coordinates, runways (length, width, surface, heading) and the three nearest airports. Official names of civil airports come from the current DHMİ and operator lists.
- The “Open on the live map” link on an airport page centres the map on that airport. If the airport is outside live data coverage, the page says so clearly.
- Every page now has its English version at its own address, for example /en/havalimanlari. The language button switches to the same page in the other language, and a link you share always opens in the same language.
- The new About page explains what the site does and does not show, the data sources and their licences, the privacy rules and how fresh the data is.
- The site is now easier to find in search engines and AI answers: a sitemap, language alternates, structured data, share images and a short summary of the site were added.

Try it: [Airports](/havalimanlari) · [Istanbul Airport](/istasyon/LTFM) · [About](/hakkinda)

---

## v0.9.0 — 2026-09-29

### Türkçe
**Ana sayfa artık canlı uçuş haritası**

- Uçaklar uydu görüntüsü üzerinde, yönlerine dönük olarak görünüyor; yollar gösterilmiyor. Türk Hava Yolları uçakları kırmızı-beyaz, seçtiğin uçak turuncu. Türkiye’deki IATA kodlu havalimanları haritada kodlarıyla yer alıyor.
- Her uçağın etiketinde önce sefer numarası (TK-974), altında hız ve yükseklik (km/sa, m) yazıyor. “Etiketler” düğmesiyle seçili uçak ve diğer uçaklar için Gizle, Kısa ya da Tam seçebilirsin; tercihin bu cihazda saklanır.
- Uçağı sefer numarası, çağrı kodu, tescil ya da hex koduyla arayabilirsin; harita uçağa yakınlaşır ve bilgi kartı açılır. “Uçağı ortala” uçağı ekranın ortasında tutar, seçtiğin uçağın izi haritada kalır (yerdeki hareketi ayrı renkte). Adres çubuğundaki bağlantıyı paylaşırsan karşı taraf da aynı uçağı açar.
- Haritanın yanında görünen uçakların listesi var (ekran okuyucularla da okunabilir). Üstteki durum şeridi verinin kaç saniyelik olduğunu, veri kaynağının durumunu ve bölgenin kapsama dışında olup olmadığını söylüyor. Canlı veri kaynağı, kaynağa bildirim yapıldıktan sonra açılacak; o zamana kadar haritada uçak görünmez ve şerit bunu açıkça yazar.
- Kullanım koşulları sayfası eklendi: hizmetin kapsamı, veri ve harita lisansları. Bu metin geçicidir; kapsamlı hâli sonraki sürümlerde gelecek.

Dene: [Canlı harita](/) · [Kullanım koşulları](/kullanim-kosullari)

### English
**The home page is now a live flight map**

- Aircraft appear on satellite imagery, pointing in their direction of travel; roads are not shown. Turkish Airlines aircraft are red and white, and the aircraft you select is amber. Airports in Türkiye with an IATA code are shown on the map with their codes.
- Each aircraft label shows the flight number first (TK-974), with speed and altitude (km/h, m) below it. With the “Labels” button you can choose Hide, Short or Full for the selected aircraft and for other aircraft; your choice is saved on this device.
- You can search for an aircraft by flight number, callsign, registration or hex code; the map zooms to it and its info card opens. “Centre on aircraft” keeps it in the middle of the screen, and the selected aircraft leaves a trail on the map (ground movement in a different colour). Share the link in the address bar and the other person opens the same aircraft.
- Next to the map there is a list of the aircraft in view (also readable with screen readers). The status strip at the top shows how many seconds old the data is, the status of the data source and whether the area is outside coverage. The live data source will be switched on after the provider has been notified; until then no aircraft appear on the map and the strip says so.
- A terms of use page has been added: what the service covers, and the data and map licences. This text is interim; the full version will come in a later release.

Try it: [Live map](/) · [Terms of use](/kullanim-kosullari)

---

## v0.8.0 — 2026-09-29

### Türkçe
**Canlı uçuş verisi artık uygulamalara akıyor**

- Harita ve mobil uygulama için canlı veri servisi hazır: görünen alandaki uçaklar anlık alınır, sonra her saniye yalnızca değişenler gönderilir. Bağlantı koparsa kaldığı yerden devam eder.
- Uçak sefer numarasıyla (TK-974), çağrı koduyla, tescille ya da hex koduyla aranabiliyor. Harfli çağrı kodu kullanan seferlerde sefer no eşleşmesi garanti değildir.
- Gizlilik: askeri uçaklar hiçbir yerde gösterilmiyor; gizlilik programındaki (PIA, LADD) uçakların tescili gizleniyor. Yönetici istediği uçağı listeden tamamen çıkarabiliyor.
- Her yanıt verinin ne kadar taze olduğunu ve veri kaynağının durumunu söylüyor; bir bölge kapsama dışındaysa bu açıkça belirtiliyor.

### English
**Live flight data now flows to the apps**

- The live data service for the map and the mobile app is ready: aircraft in the visible area are fetched at once, then only changes are sent every second. If the connection drops, it resumes where it left off.
- Aircraft can be searched by flight number (TK-974), callsign, registration or hex code. For flights using alphanumeric callsigns, flight-number matching is not guaranteed.
- Privacy: military aircraft are never shown, and the registration of aircraft in privacy programmes (PIA, LADD) is hidden. The administrator can remove any aircraft from all listings.
- Every response states how fresh the data is and the status of the data source; if an area is outside coverage, this is stated clearly.

---

## v0.7.1 — 2026-09-28

### Türkçe
**Durum sayfasında taşan yazılar düzeltildi**

- Durum sayfasında derleme kimliği artık kutusundan taşmıyor; kısa hâli görünüyor, tamamı üzerine gelince okunuyor.

Dene: [Durum sayfası](/durum)

### English
**Overflowing text on the status page fixed**

- On the status page the build ID no longer spills out of its box; the short form is shown and the full ID appears on hover.

Try it: [Status page](/durum)

---

## v0.7.0 — 2026-09-28

### Türkçe
**Türkiye üzerindeki uçaklar sürekli izleniyor**

- Türkiye semalarındaki uçakların konumunu düzenli aralıklarla toplayan ve her uçuşu ayrı bir kayıt olarak saklayan veri toplayıcı hazır; veri kaynağına bildirim yapıldıktan sonra açılacak. Hedef: İstanbul Havalimanı çevresinde en geç 20, diğer büyük havalimanlarında 30, doğu illerinde 90 saniyede bir taze veri. Harita bu veriyi sonraki sürümlerde gösterecek.
- Havalimanlarının çevresinde uçuş izi tam çözünürlükle, diğer yerlerde 30 saniyede bir saklanıyor. Pistte ve apronda durup bekleyen uçak gereksiz kayıt üretmiyor.
- Veri kaynağı yavaşlarsa istek hızı kendiliğinden düşüyor, kaynak toparlanınca yeniden artıyor. Böylece kaynağın kurallarına uyuluyor ve veri kesilmeden akıyor.
- Yükseklik ve hız varsayılan olarak metrik birimlerle (m, km/sa) gösterilecek; ayarlardan ft ve kt seçilebilecek. Uçak etiketleri sefer numarası, güzergâh, hız ve yükseklik ile ineceği pisti gösterecek ve açılıp kapatılabilecek.

Dene: [Yol haritası](/durum)

### English
**Aircraft over Türkiye are tracked continuously**

- A data collector that gathers the positions of aircraft over Türkiye at regular intervals and stores each flight as its own record is ready; it will be switched on once the data source has been notified. Target: fresh data at least every 20 seconds around Istanbul Airport, every 30 seconds at the other major airports and every 90 seconds over eastern Türkiye. The map will show this data in upcoming versions.
- Around airports, flight tracks are stored at full resolution; elsewhere, every 30 seconds. An aircraft standing still on the runway or apron does not create needless records.
- If the data source slows down, the request rate drops on its own and rises again once the source recovers. This keeps us within the source’s rules and the data keeps flowing.
- Altitude and speed will be shown in metric units (m, km/h) by default, with ft and kt available in settings. Aircraft labels will show the flight number, route, speed and altitude, and the landing runway, and can be switched on and off.

Try it: [Roadmap](/durum)

---

## v0.6.0 — 2026-09-27

### Türkçe
**Canlı uçuş verisinin altyapısı**

- Canlı uçuş verisi kaynağı (ADSB.lol) ve ileride kurulabilecek kendi ADS-B alıcımız için bağlantılar hazır. Veri bir sonraki sürümde akmaya başlayacak.
- Gelen veri temizleniyor: konumu olmayan, bir dakikadan eski ya da imkânsız hız ve tırmanış değerleri taşıyan kayıtlar kullanılmıyor.
- Gizlilik kuralları uygulanıyor: askeri uçaklar varsayılan olarak gösterilmeyecek; gizlilik programındaki (PIA, LADD) uçakların tescili gizlenecek.
- Onaylanan her değişiklik artık birleştiği anda, elle müdahale gerekmeden yayına çıkıyor.

### English
**Groundwork for live flight data**

- Connections to the live flight data source (ADSB.lol) and to our own ADS-B receiver, should we set one up, are ready. Data will start flowing in the next version.
- Incoming data is cleaned: records with no position, older than a minute, or with impossible speed or climb values are not used.
- Privacy rules are in place: military aircraft will be hidden by default, and the registration of aircraft in privacy programmes (PIA, LADD) will be hidden.
- Every approved change now goes live on its own once it is merged, with no manual step.

---

## v0.5.2 — 2026-09-27

### Türkçe
**Onaylanan her değişiklik kendiliğinden yayında**

- Yeni sürüm hazırlanır hazırlanmaz Dokploy’un otomatik yayını tetikleniyor; önceki sürümün yanlışlıkla yeniden yayınlanması bitti. Yayından sonra sitenin yeni sürümle açıldığı yine kontrol ediliyor.

### English
**Every approved change goes live on its own**

- Dokploy’s automatic deploy now starts as soon as the new version is ready, so the previous version is no longer redeployed by mistake. After each release the site is still checked to be running the new version.

---

## v0.5.1 — 2026-09-27

### Türkçe
**Yönetici anahtarı kuralı ve daha dayanıklı sunucu**

- Yönetici giriş anahtarı artık en az 12 karakter olabilir (önceden 32); 16 ve üzeri önerilir.
- Yönetici ayarı hatalı girildiğinde site artık kapanmıyor: yalnızca yönetici girişi kapanıyor ve nedeni sunucu kaydına yazılıyor.

### English
**Admin key rule and a sturdier server**

- The admin sign-in key can now be as short as 12 characters (previously 32); 16 or more is recommended.
- A wrong admin setting no longer takes the site down: only admin sign-in is turned off, and the reason is written to the server log.

---

## v0.5.0 — 2026-09-27

### Türkçe
**Havalimanı, pist ve havayolu verisi**

- Türkiye’deki ve dünyadaki büyük ve orta havalimanlarının, tarifeli sefer alan diğer alanların konumları ve pistleri artık sistemde. Pist eşikleri, kaydırılmış eşikler dahil hesaplanıyor; yaklaşma ve iniş bildirimleri bu verinin üstüne kurulacak.
- Kaynak veride yanlış yazılmış pist yönleri pist uçlarının koordinatlarından düzeltiliyor. Örneğin İstanbul Havalimanı’ndaki dört pistin yönü kayıtta 5° kaymış.
- Havayolu listesi, AJet dahil güncel ICAO ve IATA kodlarıyla, sefer numarasıyla arama için hazır.
- Veriler her gün kendiliğinden güncelleniyor ve yalnızca değişen kayıtlar yazılıyor. Kaynak bozuk ya da yarım gelirse eldeki veri korunuyor.
- Uçuş izlerinin saklanacağı yer hazır: 30 saniyelik iz 7 gün, tam çözünürlüklü iz 30 gün tutulacak. Süresi dolan günler her gece kendiliğinden siliniyor.
- Yönetim panelindeki Servisler sayfası (admin.havayolu.live) artık referans verisinin ve iz tablolarının durumunu da gösteriyor.
- Yönetim panelinin adresi (admin.havayolu.live) doğrudan açıldığında hata veriyordu; artık giriş sayfasına yönlendiriyor.
- Her sürüm artık GitHub’daki Releases bölümünde de sürüm notlarıyla yayımlanıyor; önceki sürümler de eklendi.

### English
**Airport, runway and airline data**

- Locations and runways of large and medium airports, and of other airfields with scheduled service, in Türkiye and worldwide are now in the system. Runway thresholds are calculated, displaced thresholds included; approach and landing alerts will be built on this data.
- Runway headings recorded wrongly in the source data are corrected from the coordinates of the runway ends. For example, four runways at Istanbul Airport are off by 5° in the record.
- The airline list, with current ICAO and IATA codes including AJet, is ready for flight number search.
- The data updates itself every day and only changed records are written. If a source arrives broken or incomplete, the existing data is kept.
- Storage for flight tracks is ready: the 30-second track will be kept for 7 days and the full-resolution track for 30 days. Expired days are deleted automatically every night.
- The Services page in the admin panel (admin.havayolu.live) now also shows the status of the reference data and the track tables.
- Opening the admin panel address (admin.havayolu.live) directly showed an error; it now redirects to the sign-in page.
- Every version is now also published with its release notes under Releases on GitHub; earlier versions were added too.

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

