/**
 * Haritanın kamera sabitleri ve görünüm tipi. MapLibre'ye bağlı değildir: sayfa bileşeni
 * (live-map.tsx) bunları harita kütüphanesi yüklenmeden kullanır (maplibre-loader.ts).
 */
import type { Bbox } from '@havayolu/shared'

/** Açılış görünümü: Türkiye. Geniş ekranda ülke sınırlarına sığdırılır (D-075 sözleşmesi). */
export const TURKEY_BOUNDS: Bbox = { minLon: 25.5, minLat: 35.8, maxLon: 44.8, maxLat: 42.2 }
export const TURKEY_CENTER = { lat: 39, lon: 35 }
export const TURKEY_ZOOM = 5.3

/** Search, tablo ve `?hex=` seçiminde en az bu yakınlaştırmaya uçulur. */
export const SELECT_MIN_ZOOM = 8

export interface MapViewport {
  bounds: Bbox
  center: { lat: number; lon: number }
  zoom: number
}
