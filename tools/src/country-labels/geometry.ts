/**
 * Ülke adlarının sınır içi yerleşimi için düzlem geometri (D-096): Web Mercator izdüşümü, yay
 * sadeleştirme (Douglas–Peucker), dikdörtgene kırpma (Sutherland–Hodgman) ve "dikdörtgen çokgenin
 * içinde mi" sorusu. Yalnızca çevrimdışı üretici ve testler kullanır; üretim koduna girmez.
 *
 * Birimler: boylam ve enlem derece; izdüşüm z0'da 512 birimlik dünya (MapLibre'nin 512 px'lik karosu,
 * z yakınlaştırmasında 1 birim = 2^z px); uzaklıklar km.
 */

/** Ekvator çevresi, km (WGS84 büyük yarı ekseni 6.378.137 m; MapLibre `earthRadius`). */
export const EARTH_CIRCUMFERENCE_KM = 40075.016686
/** z0'da dünyanın genişliği, izdüşüm birimi (MapLibre'nin karo boyu). */
export const WORLD_SIZE = 512

export type LonLat = readonly [lon: number, lat: number]
/** Kapalı halka: son nokta ilk noktanın aynısı değildir (kapanış örtüktür). */
export type Ring = readonly LonLat[]
/** Çokgen: dış halka, sonra delikler. */
export type Polygon = readonly Ring[]
/** Bir ülkenin geometrisi: çokgenler. */
export type MultiPolygon = readonly Polygon[]

const toRad = (deg: number) => (deg * Math.PI) / 180

export function mercatorX(lon: number): number {
  return ((lon + 180) / 360) * WORLD_SIZE
}

export function mercatorY(lat: number): number {
  const phi = toRad(lat)
  return (0.5 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI)) * WORLD_SIZE
}

/** İzdüşümün tersi: y → enlem. */
export function latitudeOf(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / WORLD_SIZE))) * 180) / Math.PI
}

/** İzdüşüm z0 birimi / km, enleme göre (Mercator ölçeği 1 / cos(enlem)). */
export function unitsPerKm(lat: number): number {
  return WORLD_SIZE / (EARTH_CIRCUMFERENCE_KM * Math.cos(toRad(lat)))
}

/** z yakınlaştırmasında 1 km kaç px. */
export function pxPerKm(lat: number, zoom: number): number {
  return unitsPerKm(lat) * 2 ** zoom
}

/**
 * İzdüşümde nokta ile parça arasındaki uzaklık, km (noktanın enlemindeki ölçekle).
 */
function segmentDistanceKm(
  px: number,
  py: number,
  lat: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  let t = lengthSquared === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lengthSquared
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(ax + t * dx - px, ay + t * dy - py) / unitsPerKm(lat)
}

/**
 * Douglas–Peucker: yayın uç noktaları sabit kalır, aradaki her nokta sadeleşmiş yaya en çok
 * `toleranceKm` uzaktadır. İki komşunun ortak sınırı tek yaydır; aynı biçimde sadeleşir, arada boşluk
 * ya da örtüşme oluşmaz. Kapalı yay (ilk nokta = son nokta) en uzak noktasından ikiye bölünür ve en
 * az üçgen olarak kalır.
 */
export function simplifyArc(points: readonly LonLat[], toleranceKm: number): LonLat[] {
  const count = points.length
  if (count <= 2 || toleranceKm <= 0) return [...points]
  const xs = new Float64Array(count)
  const ys = new Float64Array(count)
  for (let i = 0; i < count; i++) {
    const [lon, lat] = points[i] as LonLat
    xs[i] = mercatorX(lon)
    ys[i] = mercatorY(lat)
  }
  const keep = new Uint8Array(count)
  keep[0] = 1
  keep[count - 1] = 1
  const first = points[0] as LonLat
  const last = points[count - 1] as LonLat
  const stack: [number, number][] = []
  const closed = first[0] === last[0] && first[1] === last[1]
  if (closed) {
    let far = 1
    let farDistance = -1
    for (let i = 1; i < count - 1; i++) {
      const distance = Math.hypot(
        (xs[i] as number) - (xs[0] as number),
        (ys[i] as number) - (ys[0] as number),
      )
      if (distance > farDistance) {
        farDistance = distance
        far = i
      }
    }
    keep[far] = 1
    stack.push([0, far], [far, count - 1])
  } else {
    stack.push([0, count - 1])
  }
  const distanceOf = (i: number, a: number, b: number) =>
    segmentDistanceKm(
      xs[i] as number,
      ys[i] as number,
      (points[i] as LonLat)[1],
      xs[a] as number,
      ys[a] as number,
      xs[b] as number,
      ys[b] as number,
    )
  const refine = () => {
    while (stack.length > 0) {
      const [a, b] = stack.pop() as [number, number]
      let worst = -1
      let worstDistance = 0
      for (let i = a + 1; i < b; i++) {
        const distance = distanceOf(i, a, b)
        if (distance > worstDistance) {
          worstDistance = distance
          worst = i
        }
      }
      if (worst >= 0 && worstDistance > toleranceKm) {
        keep[worst] = 1
        stack.push([a, worst], [worst, b])
      }
    }
  }
  refine()
  // Kapalı yay en az üçgen kalır: küçük bir delik (Vatikan) iki noktaya inip kaybolmasın.
  if (closed && count > 4 && keep.reduce((sum, value) => sum + value, 0) === 3) {
    let far = -1
    for (let i = 0; i < count; i++) if (i > 0 && i < count - 1 && keep[i] === 1) far = i
    let extra = -1
    let extraDistance = 0
    for (let i = 1; i < count - 1; i++) {
      if (i === far) continue
      const distance = i < far ? distanceOf(i, 0, far) : distanceOf(i, far, count - 1)
      if (distance > extraDistance) {
        extraDistance = distance
        extra = i
      }
    }
    if (extra > 0) {
      keep[extra] = 1
      if (extra < far) stack.push([0, extra], [extra, far])
      else stack.push([far, extra], [extra, count - 1])
      refine()
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/**
 * Boylamı nokta dizisi boyunca sürekli kılar. Küresel halkalar (world-atlas) 180. meridyeni
 * geçerken −180'den 180'e sıçrar; düzlemde bu sıçrama bütün haritayı kesen bir kenardır. Art arda
 * iki nokta arasındaki 180°'den büyük fark ±360° ile kapatılır: Çukotka 180° D'nun doğusunda
 * (180–191°) kalır. İlk noktanın boylamı değişmez.
 */
export function unwrapLongitudes(points: readonly LonLat[]): LonLat[] {
  let offset = 0
  let previous = Number.NaN
  return points.map(([lon, lat]) => {
    const step = lon + offset - previous
    if (step > 180) offset -= 360
    else if (step < -180) offset += 360
    previous = lon + offset
    return [previous, lat] as const
  })
}

/**
 * Halkayı 360°'nin katı kadar kaydırır: en batıdaki boylamı [west, west + 360) aralığına düşer.
 * Sürekli kılınmış halka hangi noktadan başlarsa başlasın aynı yere gelir (Rusya 19–191° D).
 */
export function shiftRingWest(ring: Ring, west: number): LonLat[] {
  let min = Infinity
  for (const [lon] of ring) min = Math.min(min, lon)
  const turns = Math.floor((min - west) / 360)
  if (!Number.isFinite(turns) || turns === 0) return [...ring]
  return ring.map(([lon, lat]) => [lon - turns * 360, lat] as const)
}

/** Boylam/enlem dikdörtgeni: [batı, güney, doğu, kuzey]. */
export type LonLatBox = readonly [west: number, south: number, east: number, north: number]

/**
 * Halkayı dikdörtgene kırpar (Sutherland–Hodgman, boylam/enlem düzleminde). Kırpma kenarındaki
 * yapay parçalar sınır sayılır: sığma sınamasını yalnızca sıkılaştırır.
 */
export function clipRing(ring: Ring, box: LonLatBox): LonLat[] | null {
  const [west, south, east, north] = box
  const inside = [
    (p: LonLat) => p[0] >= west,
    (p: LonLat) => p[0] <= east,
    (p: LonLat) => p[1] >= south,
    (p: LonLat) => p[1] <= north,
  ]
  const cut = [
    (a: LonLat, b: LonLat): LonLat => [
      west,
      a[1] + ((b[1] - a[1]) * (west - a[0])) / (b[0] - a[0]),
    ],
    (a: LonLat, b: LonLat): LonLat => [
      east,
      a[1] + ((b[1] - a[1]) * (east - a[0])) / (b[0] - a[0]),
    ],
    (a: LonLat, b: LonLat): LonLat => [
      a[0] + ((b[0] - a[0]) * (south - a[1])) / (b[1] - a[1]),
      south,
    ],
    (a: LonLat, b: LonLat): LonLat => [
      a[0] + ((b[0] - a[0]) * (north - a[1])) / (b[1] - a[1]),
      north,
    ],
  ]
  let points: LonLat[] = [...ring]
  for (let edge = 0; edge < 4; edge++) {
    const test = inside[edge] as (p: LonLat) => boolean
    const intersect = cut[edge] as (a: LonLat, b: LonLat) => LonLat
    const out: LonLat[] = []
    for (let i = 0; i < points.length; i++) {
      const current = points[i] as LonLat
      const previous = points[(i + points.length - 1) % points.length] as LonLat
      const currentIn = test(current)
      const previousIn = test(previous)
      if (currentIn) {
        if (!previousIn) out.push(intersect(previous, current))
        out.push(current)
      } else if (previousIn) {
        out.push(intersect(previous, current))
      }
    }
    points = out
    if (points.length === 0) return null
  }
  return points.length >= 3 ? points : null
}

/** Halkanın yaklaşık alanı, km² (yerel eşdikdörtgen; küçük parçaları elemek için). */
export function ringAreaKm2(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as LonLat
    const b = ring[(i + 1) % ring.length] as LonLat
    const scale = Math.cos(toRad((a[1] + b[1]) / 2))
    sum += a[0] * scale * b[1] - b[0] * scale * a[1]
  }
  const kmPerDegree = EARTH_CIRCUMFERENCE_KM / 360
  return (Math.abs(sum) / 2) * kmPerDegree * kmPerDegree
}

/** Nokta halkanın içinde mi (çift-tek kuralı, boylam/enlem düzleminde). */
export function ringContains(ring: Ring, lon: number, lat: number): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as LonLat
    const [xj, yj] = ring[j] as LonLat
    if (yi > lat !== yj > lat && lon < xi + ((lat - yi) * (xj - xi)) / (yj - yi)) inside = !inside
  }
  return inside
}

/** Parça kapalı dikdörtgene değiyor mu (Liang–Barsky; kenara değmek de değmektir). */
export function segmentTouchesRect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): boolean {
  let t0 = 0
  let t1 = 1
  const dx = bx - ax
  const dy = by - ay
  const p = [-dx, dx, -dy, dy]
  const q = [ax - x1, x2 - ax, ay - y1, y2 - ay]
  for (let i = 0; i < 4; i++) {
    const pi = p[i] as number
    const qi = q[i] as number
    if (pi === 0) {
      if (qi < 0) return false
    } else {
      const t = qi / pi
      if (pi < 0) {
        if (t > t1) return false
        if (t > t0) t0 = t
      } else {
        if (t < t0) return false
        if (t < t1) t1 = t
      }
    }
  }
  return true
}

/** Izgara hücre sayısı (bir kenar boyunca). */
const GRID_CELLS = 64

/**
 * İzdüşümde bir ülkenin kenarları, 64 × 64 ızgarada dizinli. Halkaların hepsi (dış, delik, adalar)
 * aynı kenar kümesidir: çift-tek kuralı delikleri ve ayrı parçaları doğru sayar.
 */
export class ProjectedShape {
  /** Kenarlar: ax, ay, bx, by (z0 izdüşüm birimi). */
  readonly segments: Float64Array
  readonly bbox: readonly [minX: number, minY: number, maxX: number, maxY: number]
  private readonly cellWidth: number
  private readonly cellHeight: number
  private readonly cellStart: Uint32Array
  private readonly cellItems: Uint32Array
  private readonly stamp: Uint32Array
  private tick = 0

  constructor(geometry: MultiPolygon) {
    const coords: number[] = []
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const polygon of geometry) {
      for (const ring of polygon) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i] as LonLat
          const b = ring[(i + 1) % ring.length] as LonLat
          const ax = mercatorX(a[0])
          const ay = mercatorY(a[1])
          coords.push(ax, ay, mercatorX(b[0]), mercatorY(b[1]))
          minX = Math.min(minX, ax)
          maxX = Math.max(maxX, ax)
          minY = Math.min(minY, ay)
          maxY = Math.max(maxY, ay)
        }
      }
    }
    this.segments = Float64Array.from(coords)
    this.bbox = [minX, minY, maxX, maxY]
    this.cellWidth = (maxX - minX) / GRID_CELLS || 1e-9
    this.cellHeight = (maxY - minY) / GRID_CELLS || 1e-9
    const count = this.segments.length / 4
    const counts = new Uint32Array(GRID_CELLS * GRID_CELLS + 1)
    const forEachCell = (k: number, visit: (cell: number) => void) => {
      const s = this.segments
      const x0 = this.column(Math.min(s[k] as number, s[k + 2] as number))
      const x1 = this.column(Math.max(s[k] as number, s[k + 2] as number))
      const y0 = this.row(Math.min(s[k + 1] as number, s[k + 3] as number))
      const y1 = this.row(Math.max(s[k + 1] as number, s[k + 3] as number))
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) visit(y * GRID_CELLS + x)
    }
    for (let i = 0; i < count; i++)
      forEachCell(i * 4, (cell) => (counts[cell + 1] = (counts[cell + 1] as number) + 1))
    for (let c = 1; c < counts.length; c++)
      counts[c] = (counts[c] as number) + (counts[c - 1] as number)
    this.cellStart = counts
    this.cellItems = new Uint32Array(counts[counts.length - 1] as number)
    const fill = counts.slice(0, GRID_CELLS * GRID_CELLS)
    for (let i = 0; i < count; i++) {
      forEachCell(i * 4, (cell) => {
        this.cellItems[fill[cell] as number] = i
        fill[cell] = (fill[cell] as number) + 1
      })
    }
    this.stamp = new Uint32Array(count)
  }

  private column(x: number): number {
    return Math.max(0, Math.min(GRID_CELLS - 1, Math.floor((x - this.bbox[0]) / this.cellWidth)))
  }

  private row(y: number): number {
    return Math.max(0, Math.min(GRID_CELLS - 1, Math.floor((y - this.bbox[1]) / this.cellHeight)))
  }

  private nextTick(): number {
    this.tick++
    if (this.tick === 0xffffffff) {
      this.stamp.fill(0)
      this.tick = 1
    }
    return this.tick
  }

  /** İzdüşüm noktası ülkenin içinde mi (çift-tek kuralı; +x yönünde ışın). */
  contains(px: number, py: number): boolean {
    const [minX, minY, maxX, maxY] = this.bbox
    if (px < minX || px > maxX || py < minY || py > maxY) return false
    const tick = this.nextTick()
    const s = this.segments
    const row = this.row(py)
    let inside = false
    for (let x = this.column(px); x < GRID_CELLS; x++) {
      const cell = row * GRID_CELLS + x
      for (let c = this.cellStart[cell] as number; c < (this.cellStart[cell + 1] as number); c++) {
        const i = this.cellItems[c] as number
        if (this.stamp[i] === tick) continue
        this.stamp[i] = tick
        const k = i * 4
        const ay = s[k + 1] as number
        const by = s[k + 3] as number
        if (ay > py !== by > py) {
          const ax = s[k] as number
          const bx = s[k + 2] as number
          if (ax + ((py - ay) * (bx - ax)) / (by - ay) > px) inside = !inside
        }
      }
    }
    return inside
  }

  /**
   * Kapalı dikdörtgen [x1, y1, x2, y2] ülkenin içinde mi: dikdörtgenin içindeki (cx, cy) noktası
   * ülkenin içinde ve hiçbir kenar dikdörtgene değmiyor. Deniz, komşu, delik ya da başka bir ada
   * dikdörtgene girerse bir kenar dikdörtgeni keser. `centreInside` verilirse nokta yeniden
   * sınanmaz.
   */
  containsRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    cx: number,
    cy: number,
    centreInside?: boolean,
  ): boolean {
    const [minX, minY, maxX, maxY] = this.bbox
    if (x1 < minX || x2 > maxX || y1 < minY || y2 > maxY) return false
    if (!(centreInside ?? this.contains(cx, cy))) return false
    const tick = this.nextTick()
    const s = this.segments
    const gx0 = this.column(x1)
    const gx1 = this.column(x2)
    const gy0 = this.row(y1)
    const gy1 = this.row(y2)
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const cell = gy * GRID_CELLS + gx
        for (
          let c = this.cellStart[cell] as number;
          c < (this.cellStart[cell + 1] as number);
          c++
        ) {
          const i = this.cellItems[c] as number
          if (this.stamp[i] === tick) continue
          this.stamp[i] = tick
          const k = i * 4
          if (
            segmentTouchesRect(
              s[k] as number,
              s[k + 1] as number,
              s[k + 2] as number,
              s[k + 3] as number,
              x1,
              y1,
              x2,
              y2,
            )
          ) {
            return false
          }
        }
      }
    }
    return true
  }

  /** Noktanın en yakın kenara uzaklığı, z0 izdüşüm birimi (haritadaki uzaklık; görsel merkez). */
  distanceToBoundary(lon: number, lat: number): number {
    return this.distanceToBoundaryKm(lon, lat) * unitsPerKm(lat)
  }

  /** Noktanın en yakın kenara uzaklığı, km (noktanın enlemindeki ölçekle). */
  distanceToBoundaryKm(lon: number, lat: number): number {
    const px = mercatorX(lon)
    const py = mercatorY(lat)
    const s = this.segments
    let best = Infinity
    const cx = Math.floor((px - this.bbox[0]) / this.cellWidth)
    const cy = Math.floor((py - this.bbox[1]) / this.cellHeight)
    const perKm = unitsPerKm(lat)
    for (let radius = 0; radius <= GRID_CELLS * 2; radius++) {
      // Halkanın en yakın hücresi bile en iyi uzaklıktan uzaksa dur.
      const ringDistance = (radius - 1) * Math.min(this.cellWidth, this.cellHeight)
      if (radius > 0 && ringDistance / perKm > best) break
      for (let gy = cy - radius; gy <= cy + radius; gy++) {
        for (let gx = cx - radius; gx <= cx + radius; gx++) {
          if (Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) !== radius) continue
          if (gx < 0 || gy < 0 || gx >= GRID_CELLS || gy >= GRID_CELLS) continue
          const cell = gy * GRID_CELLS + gx
          for (
            let c = this.cellStart[cell] as number;
            c < (this.cellStart[cell + 1] as number);
            c++
          ) {
            const k = (this.cellItems[c] as number) * 4
            const distance = segmentDistanceKm(
              px,
              py,
              lat,
              s[k] as number,
              s[k + 1] as number,
              s[k + 2] as number,
              s[k + 3] as number,
            )
            if (distance < best) best = distance
          }
        }
      }
    }
    return best
  }
}
