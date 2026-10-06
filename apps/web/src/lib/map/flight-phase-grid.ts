/**
 * Uçuş evresinin havalimanı araması için 1°'lik enlem-boylam ızgarası (D-101). Uçak örneği başına
 * bütün havalimanlarını taramak 4. halkada (~1.222 havalimanı) 500 uçakta tam güncellemeyi ~25 ms'ye
 * çıkarıyordu; ızgara aynı sonucu ~4 ms'de verir (`flight-phase-grid.test.ts`: doğrusal taramayla
 * özellik testi).
 *
 * Sonuçlar doğrusal taramanın birebir aynısıdır:
 * - `nearest`: eşdikdörtgen yaklaşık uzaklıkta en yakın nokta; eşitlikte giriş sırasında önce gelen
 *   (en küçük dizin). Halkalar hâlinde genişler; r. halkadaki her noktanın uzaklığı en az
 *   `(r − 1) × cosMin` derecedir (`cosMin`: noktaların en küçük enlem kosinüsü; ENSB 78° K ile
 *   ~0,2). Kayan nokta payı için en iyi adaydan sonra bir halka fazla taranır.
 * - `within`: enlem farkı ve (kendi `cosLat`'ıyla) boylam farkı sınırın içindeki noktalar, giriş
 *   sırasıyla.
 * Boylam ±180'de sarılır (180. boylamı geçen iki nokta komşudur). Bakılacak hücre sayısı nokta
 * sayısını aşarsa (kutba çok yakın nokta `cosMin`'i sıfıra indirir ya da uçak bütün noktalardan çok
 * uzaktadır) doğrudan doğrusal taramaya geçilir: ızgara hiçbir zaman taramadan çok daha yavaş olmaz.
 * Konumu sonlu sayı olmayan nokta ya da uçak için sonuç yoktur (doğrulanmış veride olmaz).
 */
import { EARTH_RADIUS_KM, type LatLon } from '@havayolu/geo'

/** Bir enlem derecesi, km. */
export const KM_PER_DEG = (Math.PI * EARTH_RADIUS_KM) / 180

/** Izgaraya konan nokta: merkezi ve enleminin kosinüsü. */
export interface GridPoint {
  readonly arp: LatLon
  readonly cosLat: number
}

/** Boylam farkı [−180, 180]: 180. boylamı geçen çiftte de küçük fark. */
export function lonDelta(a: number, b: number): number {
  return ((((a - b) % 360) + 540) % 360) - 180
}

/** Eşdikdörtgen yaklaşık uzaklık, km (en yakını bulmak için; gösterilen uzaklık haversine'dir). */
export function approxKm(p: LatLon, point: GridPoint): number {
  return (
    Math.hypot(p.lat - point.arp.lat, lonDelta(p.lon, point.arp.lon) * point.cosLat) * KM_PER_DEG
  )
}

/** Boylam hücreleri (1°): −180…179. */
const LON_CELLS = 360
/** Enlem hücreleri (1°): −90…90 (90 kendi hücresindedir). */
const LAT_CELLS = 181
/** Hücre sınırlarında kayan nokta payı, derece. */
const EDGE_DEG = 1e-9
/** Doğrusal taramaya geçmeden bakılabilecek en az hücre sayısı (nokta sayısı daha büyükse o). */
const MIN_CELL_BUDGET = 256

const lonCell = (lon: number) => ((Math.floor(lon) % LON_CELLS) + LON_CELLS + 180) % LON_CELLS
const latCell = (lat: number) => Math.floor(lat) + 90
const cellKey = (lat: number, lon: number) => lat * LON_CELLS + lon
const finite = (p: LatLon) => Number.isFinite(p.lat) && Number.isFinite(p.lon)

export class PointGrid<T extends GridPoint> {
  private readonly cells = new Map<number, number[]>()
  /** Izgaradaki noktalar (konumu sonlu), giriş sırasıyla. */
  private readonly indexed: number[] = []
  /** Noktaların en küçük enlem kosinüsü (boylam yönünde bir derecenin en kısa hâli). */
  private readonly cosMin: number
  /** Bir aramada bakılacak en çok hücre; aşılırsa doğrusal tarama. */
  private readonly cellBudget: number

  constructor(readonly points: readonly T[]) {
    let cosMin = 1
    for (const [index, point] of points.entries()) {
      if (!finite(point.arp) || !Number.isFinite(point.cosLat)) continue
      const key = cellKey(latCell(point.arp.lat), lonCell(point.arp.lon))
      const list = this.cells.get(key)
      if (list) list.push(index)
      else this.cells.set(key, [index])
      this.indexed.push(index)
      cosMin = Math.min(cosMin, point.cosLat)
    }
    this.cosMin = Math.max(cosMin, 0)
    this.cellBudget = Math.max(MIN_CELL_BUDGET, this.indexed.length)
  }

  /** En yakın nokta (eşdikdörtgen); eşitlikte giriş sırasında önce gelen. Nokta yoksa null. */
  nearest(p: LatLon): T | null {
    if (this.indexed.length === 0 || !finite(p)) return null
    const la = latCell(p.lat)
    const lo = Math.floor(p.lon)
    let best = -1
    let bestKm = Infinity
    const visit = (lat: number, lon: number) => {
      if (lat < 0 || lat >= LAT_CELLS) return
      const list = this.cells.get(cellKey(lat, lonCell(lon)))
      if (list === undefined) return
      for (const index of list) {
        const km = approxKm(p, this.points[index] as T)
        if (km < bestKm || (km === bestKm && index < best)) {
          best = index
          bestKm = km
        }
      }
    }
    let visited = 0
    // r = 180 halkası bütün küreyi kapsar.
    for (let r = 0; r <= 180; r += 1) {
      // r. halkadaki her nokta en az (r − 1) × cosMin derece uzaktadır; bir halka pay bırakılır.
      if (best >= 0 && (r - 2) * this.cosMin * KM_PER_DEG > bestKm) break
      visited += r === 0 ? 1 : 8 * r
      if (visited > this.cellBudget) return this.linearNearest(p)
      for (let dLat = -r; dLat <= r; dLat += 1) {
        if (Math.abs(dLat) === r) {
          for (let dLon = -r; dLon <= r; dLon += 1) visit(la + dLat, lo + dLon)
        } else {
          visit(la + dLat, lo - r)
          if (r > 0) visit(la + dLat, lo + r)
        }
      }
    }
    return best < 0 ? null : (this.points[best] as T)
  }

  /**
   * Enlem farkı en çok `deg` ve boylam farkı × kendi `cosLat`'ı en çok `deg` olan noktalar, giriş
   * sırasıyla (doğrusal ön elemeyle aynı koşul).
   */
  within(p: LatLon, deg: number): T[] {
    if (this.indexed.length === 0 || !finite(p)) return []
    const latFrom = Math.max(0, latCell(p.lat - deg - EDGE_DEG))
    const latTo = Math.min(LAT_CELLS - 1, latCell(p.lat + deg + EDGE_DEG))
    const span = this.cosMin > 0 ? Math.min(deg / this.cosMin + EDGE_DEG, 180) : 180
    const lonFrom = Math.floor(p.lon - span)
    const lonTo = Math.min(Math.floor(p.lon + span), lonFrom + LON_CELLS - 1)
    const candidates =
      (latTo - latFrom + 1) * (lonTo - lonFrom + 1) > this.cellBudget
        ? this.indexed
        : this.cellsIn(latFrom, latTo, lonFrom, lonTo)
    const result: T[] = []
    for (const index of candidates) {
      const point = this.points[index] as T
      if (Math.abs(p.lat - point.arp.lat) > deg) continue
      if (Math.abs(lonDelta(p.lon, point.arp.lon)) * point.cosLat > deg) continue
      result.push(point)
    }
    return result
  }

  /** Hücre aralığındaki noktaların dizinleri, artan (giriş) sırada. */
  private cellsIn(latFrom: number, latTo: number, lonFrom: number, lonTo: number): number[] {
    const found: number[] = []
    for (let lat = latFrom; lat <= latTo; lat += 1) {
      for (let lon = lonFrom; lon <= lonTo; lon += 1) {
        const list = this.cells.get(cellKey(lat, lonCell(lon)))
        if (list) found.push(...list)
      }
    }
    return found.sort((a, b) => a - b)
  }

  /** Bütün noktaların taraması (bakılacak hücre çok olduğunda). */
  private linearNearest(p: LatLon): T | null {
    let best: T | null = null
    let bestKm = Infinity
    for (const index of this.indexed) {
      const point = this.points[index] as T
      const km = approxKm(p, point)
      if (km < bestKm) {
        best = point
        bestKm = km
      }
    }
    return best
  }
}
