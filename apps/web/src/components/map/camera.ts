/**
 * Haritanın kamera sabitleri ve görünüm tipi. MapLibre'ye bağlı değildir: sayfa bileşeni
 * (live-map.tsx) bunları harita kütüphanesi yüklenmeden kullanır (maplibre-loader.ts).
 */
import type { Bbox } from '@havayolu/shared'

/**
 * Açılış görünümü (kullanıcı isteği 2026-10-01, D-079): birincil istasyon IST/LTFM'nin havalimanı
 * referans noktası. Her ilk açılışta ve yenilemede harita burada açılır; `?hex=` ve `?havalimani=`
 * önceliklidir (o hedefe gidilir).
 */
export const PRIMARY_AIRPORT_VIEW = { icao: 'LTFM', lat: 41.2753, lon: 28.7519 } as const

/** Açılışta görünümün kısa kenarının kapsadığı yaklaşık mesafe (yaklaşma alanı), m. */
export const INITIAL_SPAN_M = 100_000
/** Açılış yakınlaştırmasının sınırları: geniş ekranda 8,5; telefonda kısa kenara göre daha uzak. */
export const INITIAL_MAX_ZOOM = 8.5
export const INITIAL_MIN_ZOOM = 7

/** Ekvator çevresi, m (Web Mercator; MapLibre'de z0'da dünya 512 px'tir). */
const EARTH_CIRCUMFERENCE_M = 40_075_016.686
const TILE_PX = 512

/**
 * Açılış yakınlaştırması: görünümün kısa kenarı yaklaşık `INITIAL_SPAN_M` (100 km) kapsasın;
 * en çok 8,5 (masaüstü), en az 7. Ondalık bir basamağa yuvarlanır. 375 px genişlikte ~7,8.
 */
export function initialZoom(width: number, height: number): number {
  const side = Math.max(1, Math.min(width, height))
  const latitude = (PRIMARY_AIRPORT_VIEW.lat * Math.PI) / 180
  const metersPerPixelAtZoom0 = (EARTH_CIRCUMFERENCE_M * Math.cos(latitude)) / TILE_PX
  const zoom = Math.log2((metersPerPixelAtZoom0 * side) / INITIAL_SPAN_M)
  const clamped = Math.min(INITIAL_MAX_ZOOM, Math.max(INITIAL_MIN_ZOOM, zoom))
  return Math.round(clamped * 10) / 10
}

/**
 * Harita kurulmadan (MapLibre iniyor, WebGL2 yok) canlı veri aboneliğinin kutusu: açılış
 * görünümünü geniş ekranda da kapsayan IST çevresi (~±1,4° boylam, ±0,7° enlem). Harita kurulunca
 * abonelik gerçek görünümü izler.
 */
export const INITIAL_BOUNDS: Bbox = {
  minLon: PRIMARY_AIRPORT_VIEW.lon - 1.4,
  minLat: PRIMARY_AIRPORT_VIEW.lat - 0.7,
  maxLon: PRIMARY_AIRPORT_VIEW.lon + 1.4,
  maxLat: PRIMARY_AIRPORT_VIEW.lat + 0.7,
}

/** Search, tablo ve `?hex=` seçiminde en az bu yakınlaştırmaya uçulur. */
export const SELECT_MIN_ZOOM = 8

/** `?havalimani=` ile açılışta havalimanı merkezine en az bu yakınlaştırmayla gidilir (pistler görünür). */
export const AIRPORT_MIN_ZOOM = 10

export interface MapViewport {
  bounds: Bbox
  center: { lat: number; lon: number }
  zoom: number
}
