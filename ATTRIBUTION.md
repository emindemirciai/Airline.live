# Atıflar

havayolu'nun kaynak kodu MIT lisanslıdır ([LICENSE](LICENSE)). Uygulamanın gösterdiği veriler, harita altlıkları ve bazı bileşenler kendi lisanslarına tabidir. Atıflar haritada ve ilgili sayfalarda da görünür; kullanıcıya dönük özet sitenin kullanım koşullarındadır (`/kullanim-kosullari`, geçici metin). Kaynakların doğrulanmış şartları: [docs/spec/data-sources.md](docs/spec/data-sources.md).

## Uçuş ve havacılık verisi
- **ADSB.lol:** Canlı uçak konumları. Lisans: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
  - Atıf: "Canlı uçuş verisi: [ADSB.lol](https://adsb.lol) — [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)".
  - Bu veriden türetilen konum ve iz tablolarımız ODbL anlamında türetilmiş veritabanıdır ve ODbL altında kalır.
- **OurAirports:** Havalimanı ve pist verisi. Kamu malı (Unlicense). Kaynak: https://ourairports.com/data/
- **Resmî havalimanı adları:** Havalimanı sayfalarındaki Türkçe adlar DHMİ'nin havalimanı listesinden ve DHMİ dışındaki işletmecilerin (İGA, ISG, Gazipaşa-Alanya, Zafer, Eskişehir Teknik Üniversitesi) sitelerinden elle derlenmiştir; kaynaklar [docs/REFERENCES.md](docs/REFERENCES.md)'dedir.
- **VRS standing-data:** Havayolu kodları; ileride rotalar da. Lisans CC0 1.0 olduğu için atıf zorunlu değildir, nezaketen anılır. Kaynak: https://github.com/vradarserver/standing-data
- **NOAA Aviation Weather Center (aviationweather.gov):** METAR ve TAF; ileride (Parça 2) kullanılacak. ABD kamu verisidir. Kaynak: https://aviationweather.gov/

## Harita altlıkları
- **OpenFreeMap, OpenMapTiles ve OpenStreetMap:** Vektör harita altlığı.
  - Atıf: [OpenFreeMap](https://openfreemap.org) © [OpenMapTiles](https://www.openmaptiles.org/) Data from [OpenStreetMap](https://www.openstreetmap.org/copyright).
  - OpenStreetMap verisi ODbL lisanslıdır.
- **Esri World Imagery:** Uydu görüntüsü; yalnızca Esri anahtarı tanımlıysa gösterilir.
  - Atıf: "Powered by Esri" ve "Esri, Vantor, Earthstar Geographics, and the GIS User Community".
  - Görüntü Esri'nin ArcGIS Location Platform şartlarına (E204) tabidir: yalnızca haritada gösterilir; saklanmaz, yeniden dağıtılmaz ve ODbL altındaki veritabanlarımıza girmez.
  - Haritayı kullananlar Esri'nin geçerli şartlarına uymayı kullanım koşullarında (`/kullanim-kosullari`) kabul eder (E204 §3.1c.5).

## Yazılım ve yazı tipleri
- **MapLibre GL JS:** BSD-3-Clause. Kaynak: https://github.com/maplibre/maplibre-gl-js
- **Overpass:** SIL Open Font License 1.1 (`@fontsource/overpass`). Sayfalarda ve paylaşım (Open Graph) görsellerinde kullanılır. Görseller için latin ve latin-ext alt kümelerinin 400 ve 800 ağırlıklı `.woff` dosyaları değiştirilmeden `apps/web/assets/og-fonts/`'a kopyalanmıştır; lisans metni yanlarındadır (`OFL.txt`). Kaynak: https://github.com/RedHatOfficial/Overpass
- **IBM Plex Mono:** SIL Open Font License 1.1 (`@fontsource/ibm-plex-mono`).

Diğer açık kaynak bağımlılıklar kendi lisanslarıyla `package.json` dosyalarında ve `pnpm-lock.yaml`'da listelenir. Uçak ikonları bu proje için çizilmiş özgün siluetlerdir; başka markaların ikon ve görselleri kullanılmaz.

## English summary
The havayolu source code is MIT licensed. Third-party data and components keep their own licences:
- **Live aircraft positions:** [ADSB.lol](https://adsb.lol), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Our stored position and track tables are a derivative database under the ODbL.
- **Reference data:**
  - OurAirports: public domain (Unlicense).
  - VRS standing-data: CC0 1.0, credited as a courtesy.
  - NOAA aviationweather.gov: US public data; used from Part 2.
- **Map base layers:**
  - OpenFreeMap © OpenMapTiles, data from OpenStreetMap (ODbL).
  - Esri World Imagery: "Powered by Esri"; Esri, Vantor, Earthstar Geographics, and the GIS User Community. Shown only when an Esri API key is configured, never stored or redistributed, and not part of any ODbL database. Map users agree to Esri's applicable terms in our terms of use (`/kullanim-kosullari`, E204 §3.1c.5).
- **Software and fonts:** MapLibre GL JS (BSD-3-Clause), Overpass and IBM Plex Mono (SIL Open Font License 1.1). Unmodified Overpass latin and latin-ext `.woff` files (weights 400 and 800) are bundled in `apps/web/assets/og-fonts/` with their licence (`OFL.txt`) to render Open Graph images.
- **Official airport names:** Turkish names follow DHMİ's airport list and the operators' own sites (İGA, ISG, Gazipaşa-Alanya, Zafer, Eskişehir Technical University); see `docs/REFERENCES.md`.
