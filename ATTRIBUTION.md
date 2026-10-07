# Atıflar

havayolu'nun kaynak kodu MIT lisanslıdır ([LICENSE](LICENSE)). Uygulamanın gösterdiği veriler, harita altlıkları ve bazı bileşenler kendi lisanslarına tabidir. Atıflar haritada ve ilgili sayfalarda da görünür; kullanıcıya dönük özet sitenin kullanım koşullarındadır (`/kullanim-kosullari`, geçici metin). Kaynakların doğrulanmış şartları: [docs/spec/data-sources.md](docs/spec/data-sources.md).

## Uçuş ve havacılık verisi
- **ADSB.lol:** Canlı uçak konumları. Lisans: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
  - Atıf: "Canlı uçuş verisi: [ADSB.lol](https://adsb.lol) — [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)".
  - Bu veriden türetilen konum ve iz tablolarımız ODbL anlamında türetilmiş veritabanıdır ve ODbL altında kalır.
- **OurAirports:** Havalimanı ve pist verisi. Kamu malı (Unlicense). Kaynak: https://ourairports.com/data/
- **Resmî havalimanı adları:** Havalimanı sayfalarındaki Türkçe adlar DHMİ'nin havalimanı listesinden ve DHMİ dışındaki işletmecilerin (İGA, ISG, Gazipaşa-Alanya, Zafer, Eskişehir Teknik Üniversitesi) sitelerinden, Ankara (Etimesgut) Havalimanı'nın adı Ulaştırma ve Altyapı Bakanlığı'ndan elle derlenmiştir. Kaynaklar [docs/REFERENCES.md](docs/REFERENCES.md)'dedir.
- **VRS standing-data:** Havayolu kodları; ileride rotalar da. Lisans CC0 1.0 olduğu için atıf zorunlu değildir, nezaketen anılır. Kaynak: https://github.com/vradarserver/standing-data
- **NOAA Aviation Weather Center (aviationweather.gov):** Havalimanı hava durumu (METAR ve TAF); v0.11.0'dan beri havalimanı sayfalarında ve haritadaki havalimanı penceresinde. ABD kamu verisidir (https://www.weather.gov/disclaimer); atıf nezaketendir, NOAA/NWS logosu kullanılmaz ve onay ima edilmez. Türk raporlarını havalimanlarının meteoroloji birimleri hazırlar, AWC yeniden dağıtır. Raporlar otomatik çözümlenir; resmî brifing yerine geçmez. Kaynak: https://aviationweather.gov/
- **Natural Earth** (kamu malı; Made with Natural Earth): 1:10m ülke poligonları, ülke adlarını sınırın içine yerleştirmek için çevrimdışı kullanılır; çizilmez (D-096). Haritaya yalnızca türetilmiş küçük bir tablo girer (adın yeri ve ilk göründüğü yakınlaştırma). Veri `world-atlas` 2.0.2 (ISC) paketinden `topojson-client` 3.1.0 (ISC) ile okunur; ikisi de yalnızca geliştirme aracıdır. Kaynak: https://www.naturalearthdata.com/
- **IANA saat dilimi veritabanı (tzdb):** Havalimanlarının yerel saati ve UTC farkı (v0.14.0'dan beri, Türkiye dışında da). Ülke ve bölge → saat dilimi tablosu tzdb'nin `zone.tab` dosyasından derlenmiştir; farkları tarayıcının ve sunucunun `Intl`'i hesaplar. Kamu malıdır; atıf zorunlu değildir, nezaketen anılır. Kaynak: https://www.iana.org/time-zones

## Harita altlıkları
- **OpenFreeMap, OpenMapTiles ve OpenStreetMap:** Vektör harita altlığı ve uydu haritasının üstündeki kesikli ülke sınırları (D-092).
  - Atıf: [OpenFreeMap](https://openfreemap.org) © [OpenMapTiles](https://www.openmaptiles.org/) Data from [OpenStreetMap](https://www.openstreetmap.org/copyright). Uydu haritasında sınırlar çizilirken Esri atfının yanında görünür.
  - OpenStreetMap verisi ODbL lisanslıdır. Karoları tarayıcı OpenFreeMap'ten doğrudan çeker; sunucularımız aracılık etmez, saklamaz.
- **Esri World Imagery:** Uydu görüntüsü; yalnızca Esri anahtarı tanımlıysa gösterilir.
  - Atıf: "Powered by Esri" ve "Esri, Vantor, Earthstar Geographics, and the GIS User Community".
  - Görüntü Esri'nin ArcGIS Location Platform şartlarına (E204) tabidir: yalnızca haritada gösterilir; saklanmaz, yeniden dağıtılmaz ve ODbL altındaki veritabanlarımıza girmez.
  - Haritayı kullananlar Esri'nin geçerli şartlarına uymayı kullanım koşullarında (`/kullanim-kosullari`) kabul eder (E204 §3.1c.5).

## Yazılım ve yazı tipleri
- **MapLibre GL JS:** BSD-3-Clause. Kaynak: https://github.com/maplibre/maplibre-gl-js
- **Overpass:** SIL Open Font License 1.1 (`@fontsource/overpass`). Sayfalarda ve paylaşım (Open Graph) görsellerinde kullanılır. Görseller için latin ve latin-ext alt kümelerinin 400 ve 800 ağırlıklı `.woff` dosyaları değiştirilmeden `apps/web/assets/og-fonts/`'a kopyalanmıştır; lisans metni yanlarındadır (`OFL.txt`). Haritadaki ülke adları (D-095) için latin ve latin-ext alt kümelerinin 600 ağırlıklı `.woff2` dosyaları da değiştirilmeden `apps/web/public/fonts/`'a kopyalanmıştır; lisans metni orada da yanlarındadır (`OFL.txt`). Kaynak: https://github.com/RedHatOfficial/Overpass
- **IBM Plex Mono:** SIL Open Font License 1.1 (`@fontsource/ibm-plex-mono`).

Diğer açık kaynak bağımlılıklar kendi lisanslarıyla `package.json` dosyalarında ve `pnpm-lock.yaml`'da listelenir. Uçak ikonları bu proje için çizilmiş özgün siluetlerdir; başka markaların ikon ve görselleri kullanılmaz.

## English summary
The havayolu source code is MIT licensed. Third-party data and components keep their own licences:
- **Live aircraft positions:** [ADSB.lol](https://adsb.lol), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Our stored position and track tables are a derivative database under the ODbL.
- **Reference data:**
  - OurAirports: public domain (Unlicense).
  - VRS standing-data: CC0 1.0, credited as a courtesy.
  - NOAA aviationweather.gov: US public data; airport weather (METAR and TAF) on airport pages and the map's airport popup since v0.11.0. Courtesy credit, no NOAA/NWS logo, no endorsement implied; reports are produced by the airports' meteorological offices and decoded automatically, not an official briefing.
  - Natural Earth (public domain; Made with Natural Earth): 1:10m country polygons, used offline to keep the country names on the map inside their borders; never drawn. Only a small derived table (each name's anchor and first zoom) ships. Read from `world-atlas` 2.0.2 (ISC) with `topojson-client` 3.1.0 (ISC), development tools only.
  - IANA time zone database (tzdb): public domain, credited as a courtesy; airport local time and UTC offset since v0.14.0 (country and region table from `zone.tab`, offsets computed by `Intl`).
- **Map base layers:**
  - OpenFreeMap © OpenMapTiles, data from OpenStreetMap (ODbL): the vector base map and the dashed country borders drawn over the satellite imagery; tiles are fetched by the browser directly, never proxied or stored by our servers.
  - Esri World Imagery: "Powered by Esri"; Esri, Vantor, Earthstar Geographics, and the GIS User Community. Shown only when an Esri API key is configured, never stored or redistributed, and not part of any ODbL database. Map users agree to Esri's applicable terms in our terms of use (`/kullanim-kosullari`, E204 §3.1c.5).
- **Software and fonts:** MapLibre GL JS (BSD-3-Clause), Overpass and IBM Plex Mono (SIL Open Font License 1.1). Unmodified Overpass latin and latin-ext `.woff` files (weights 400 and 800) are bundled in `apps/web/assets/og-fonts/` with their licence (`OFL.txt`) to render Open Graph images, and unmodified Overpass latin and latin-ext `.woff2` files (weight 600) are served from `apps/web/public/fonts/` with the same licence to draw the country names on the map.
- **Official airport names:** Turkish names follow DHMİ's airport list, the operators' own sites (İGA, ISG, Gazipaşa-Alanya, Zafer, Eskişehir Technical University) and, for Ankara (Etimesgut) Airport, the Ministry of Transport and Infrastructure; see `docs/REFERENCES.md`.
