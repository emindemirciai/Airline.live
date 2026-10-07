/**
 * Havalimanı ad tablolarını kullanan üç modülün ortak tembel girişi (D-101, D-108): havalimanı
 * penceresi, "Havalimanları" paneli ve havalimanı aramasının dizini. Üçü de yalnız buradan, dinamik
 * importla yüklenir (`live-map.tsx`, `panels/airport-list-control.tsx`, `panels/search-box.tsx`;
 * hiçbiri bu dosyayı statik import etmez) ve harita hazır olunca birlikte boşta istenir.
 *
 * Ayrı girişlerle paketleyici ad tablolarının birimini her parça grubuna ayrı kopyalıyordu; aramanın
 * kullandığı `airportLocality` şehir ve il tablolarını her kopyaya taşıyordu (boşta 44,6 KB gzip).
 * Tek girişle tablolar bir kez gelir. Her tüketici kendi yedeğini (`withChunkFallback`,
 * `withImportFallback`) korur.
 */
export { AirportPopup } from './airport-popup'
export { AirportListPanel } from './panels/airport-list-panel'
export { buildAirportSearch } from './panels/airport-search-index'
