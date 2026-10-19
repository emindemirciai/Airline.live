/**
 * Ülke adlarının yeri ve ilk sığma yakınlaştırması (D-096, D-099, D-100): `COUNTRY_LABEL_PLACEMENTS`'ı
 * ve `COUNTRY_LABEL_AREAS_KM2`'yi Natural Earth fixture'ından (bütün dünya: ISO 3166-1 kodlu her
 * birim) ve haritada pini çizilen havalimanlarından (listelenenler, askerî hava üsleri hariç; D-103)
 * hesaplar. Çevrimdışıdır ve belirlenimcidir; aynı fixture'lar ve adlar her
 * zaman aynı tabloyu verir (placement.test.ts commit'li tabloyla karşılaştırır).
 *
 * Çapa kuralı (D-099), ülke başına tek ortak nokta (dört bileşim: Türkçe/İngilizce × geniş/dar
 * harita; ad dil ya da genişlik değişince yer değiştirmez). Başkent rol oynamaz; tek istisna
 * kullanıcı kararıyla başkentte sabit olan KIBRIS'tır (`CAPITAL_ANCHORED_CODES`).
 * 1. Ülkenin içindeki sabit nokta ızgarasında (0,01°'nin katları; adım ülkenin uzun kenarının
 *    1/100'ü; yalnız 180° B–180° D arasındaki noktalar) her bileşimin ilk sığma düzeyi ve en erkeni
 *    (`best`) hesaplanır (D-096: kutu sınırın içinde). Ad boyu kademesi ülkenin yüzölçümündendir
 *    (D-095 tablosu, yoksa Natural Earth; `countryLabelTier`); Türkiye'den uzak ülkelerin km payı
 *    büyüktür (`FAR_SAFETY_KM`, D-100).
 * 2. **Çakışma:** adın görünür kutusuna (güvenlik payı yok) giren havalimanı pini ve kod kutusu
 *    (pin başının sağında ve solunda) sayısı (airport-pins.ts), dört bileşimde, adın ilk sığdığı
 *    yakınlaştırmadan silinmenin başladığı z7'ye 0,25 adımla toplanır.
 * 3. **Boş yer:** her bileşimde en erkenin en çok 1,5 kademe gerisinde sığan ve çakışması 0 olan
 *    noktalar varsa adaylar onlardır. Yoksa adaylar her bileşimde en erkenin en çok 0,25 kademe
 *    gerisinde sığan noktalardır: boş yer bulunamıyorsa gecikme bir şey kazandırmaz, ad geç gelmez.
 * 4. Adaylardan sırayla: çakışması en az; dört ilk sığma düzeyinin toplamı en küçük (en erken);
 *    ülkenin görsel merkezine (erişilmezlik kutbu: ızgarada sınıra en uzak nokta, Mercator'da) en
 *    yakın; eşitlikte kuzeydeki, sonra batıdaki.
 * 5. Dört bileşimde ortak aday yoksa her bileşim kendi çapasını aynı kuralla seçer (bugün hiçbir
 *    ülkede gerekmedi).
 * Çapası bir bölgeyle sınırlı ülkede (`COUNTRY_LABEL_ANCHOR_REGIONS`: RUSYA Urallar'ın batısında,
 * D-100) ızgara yalnız bölgenin içindedir (adım bölgedeki kutudan); en erken ve görsel merkez de
 * bölgenindir: görsel merkez bölgenin içinde ülkenin sınırına ve bölgenin kenarına en uzak noktadır.
 * Ad hiçbir noktada z7'den önce sığmıyorsa (ya da ızgaranın hiçbir noktası ülkenin içinde değilse:
 * dağınık küçük adalar) o bileşimde yazılmaz (`null`). Başkentte sabit adın
 * çapası başkentin kendisidir (ızgarada olmayabilir), ilk yakınlaştırması orada ilk sığdığı
 * düzeydir; adlar silinmeden önce başkentte hiç sığmazsa üretici durur.
 */
import {
  COUNTRY_AREA_OVERRIDES_KM2,
  COUNTRY_LABEL_ANCHOR_REGIONS,
  COUNTRY_LABEL_CAPITAL_ANCHORS,
  COUNTRY_LABEL_FADE_START_ZOOM,
  COUNTRY_LABEL_FIT_ZOOM_STEP,
  countryLabelLines,
  countryLabelTier,
  type CountryLabelAnchorRegion,
  type CountryLabelCapitalAnchor,
  type CountryLabelTier,
  type Locale,
} from '@havayolu/shared'
import type {
  CountryLabelPlacement,
  CountryLabelPlacementRow,
} from '@havayolu/shared/country-label-placements'
import {
  AIRPORT_CHIP_MIN_ZOOM,
  OBSTACLE_PIN_MIN_ZOOM,
  worldBoxAt,
  type AirportObstacles,
} from './airport-pins'
import {
  latitudeOf,
  mercatorX,
  mercatorY,
  ProjectedShape,
  WORLD_SIZE,
  type MultiPolygon,
} from './geometry'
import {
  FAR_SAFETY_KM,
  LabelFitter,
  SAFETY_KM,
  SAFETY_PX,
  type GlyphBox,
  type LabelLayout,
} from './label-model'
import { NATURAL_EARTH_PARAMS, NATURAL_EARTH_SOURCE } from './natural-earth'

/** Izgaranın uzun kenarındaki en çok adım sayısı (adım en az 0,01°). */
export const LATTICE_STEPS = 100
/** Boş (çakışmasız) yer için ad, her bileşimde en erkenin en çok bu kadar kademe gerisinde sığabilir. */
export const CLEAR_MAX_DELAY_ZOOMS = 1.5
/** Boş yer yoksa ad, her bileşimde en erkenin en çok bu kadar kademe gerisinde sığar. */
export const CROWDED_MAX_DELAY_ZOOMS = 0.25
/** Çakışmanın sayıldığı son yakınlaştırma: adların silinmeye başladığı z7 (dahil). */
export const OVERLAP_LAST_ZOOM = COUNTRY_LABEL_FADE_START_ZOOM
/**
 * Yeri kullanıcı kararıyla başkentte sabit olan ülkeler: boş yer kuralı uygulanmaz, çapa
 * `COUNTRY_LABEL_CAPITAL_ANCHORS`'taki başkenttir. KIBRIS / CYPRUS bölünmüş başkent Lefkoşa'da yazılır (D-095:
 * "Kıbrıs Lefkoşa'da", kullanıcının kararı). Boş yer kuralı adı Lefkoşa'nın ~30 km batı-güneybatısına,
 * z6'dan sonra tamamen Yeşil Hat'ın güneyine taşıyordu (D-099). Ercan (LCEN) pini ve kodu adın
 * kutusunda kalır; pinler adların üstünde çizilir (TÜRKİYE gibi).
 */
export const CAPITAL_ANCHORED_CODES: readonly string[] = Object.keys(COUNTRY_LABEL_CAPITAL_ANCHORS)

/** Ülkenin çapa bölgesi (`COUNTRY_LABEL_ANCHOR_REGIONS`); yoksa undefined (bütün ülke). */
export function anchorRegionOf(code: string): CountryLabelAnchorRegion | undefined {
  return Object.hasOwn(COUNTRY_LABEL_ANCHOR_REGIONS, code)
    ? COUNTRY_LABEL_ANCHOR_REGIONS[code]
    : undefined
}

/** Mercator'un sonlu kaldığı enlem sınırı: bölgenin bundan öteki kenarı dünyayı kesmez. */
const REGION_EDGE_MAX_LAT = 85

/**
 * Noktanın bölgenin dünyayı kesen kenarlarına (±180°'de ve ±85°'nin ötesinde olmayanlar) en kısa
 * uzaklığı, z0 izdüşüm birimi; bölge yoksa Infinity.
 */
export function regionEdgeDistance(
  region: CountryLabelAnchorRegion | undefined,
  lon: number,
  lat: number,
): number {
  if (!region) return Infinity
  const [west, south, east, north] = region
  const x = mercatorX(lon)
  const y = mercatorY(lat)
  let distance = Infinity
  if (west > -180) distance = Math.min(distance, x - mercatorX(west))
  if (east < 180) distance = Math.min(distance, mercatorX(east) - x)
  if (north < REGION_EDGE_MAX_LAT) distance = Math.min(distance, y - mercatorY(north))
  if (south > -REGION_EDGE_MAX_LAT) distance = Math.min(distance, mercatorY(south) - y)
  return distance
}

/** Tabloya yazılan değişkenler (`COUNTRY_LABEL_PLACEMENT_PARAMS`). */
export function placementParams(obstacles: AirportObstacles) {
  return {
    naturalEarth: `${NATURAL_EARTH_SOURCE.version} 1:10m`,
    worldAtlas: NATURAL_EARTH_SOURCE.package.split('@')[1] ?? '',
    simplifyKm: NATURAL_EARTH_PARAMS.simplifyKm,
    farSimplifyKm: NATURAL_EARTH_PARAMS.farSimplifyKm,
    farFromKm: NATURAL_EARTH_PARAMS.farFromKm,
    safetyPx: SAFETY_PX,
    safetyKm: SAFETY_KM,
    farSafetyKm: FAR_SAFETY_KM,
    latticeSteps: LATTICE_STEPS,
    clearMaxDelayZooms: CLEAR_MAX_DELAY_ZOOMS,
    crowdedMaxDelayZooms: CROWDED_MAX_DELAY_ZOOMS,
    airportPins: obstacles.airports.length,
    airportPinMinZoom: OBSTACLE_PIN_MIN_ZOOM,
    airportCodeMinZoom: AIRPORT_CHIP_MIN_ZOOM,
    airportCodeSides: ['right', 'left'],
    capitalAnchored: [...CAPITAL_ANCHORED_CODES],
    anchorRegions: Object.fromEntries(
      Object.entries(COUNTRY_LABEL_ANCHOR_REGIONS).map(([code, region]) => [code, [...region]]),
    ),
    fitZoomStep: COUNTRY_LABEL_FIT_ZOOM_STEP,
  }
}

export interface PlacementCombo {
  locale: Locale
  layout: LabelLayout
}

/** Bileşimler, sırayla. */
export const PLACEMENT_COMBOS: readonly PlacementCombo[] = [
  { locale: 'tr', layout: 'regular' },
  { locale: 'tr', layout: 'compact' },
  { locale: 'en', layout: 'regular' },
  { locale: 'en', layout: 'compact' },
]

export type PlacementTable = Record<Locale, Record<string, CountryLabelPlacementRow>>

/**
 * Ülkenin yerleşim türü: `clear` boş yerde ortak nokta (çakışma 0); `crowded` boş yer yok, en az
 * çakışan ortak nokta; `capital` kullanıcı kararıyla başkentte (`CAPITAL_ANCHORED_CODES`);
 * `per-combination` bileşim başına çapa; `hidden` ad hiçbir bileşimde sığmaz.
 */
export type PlacementKind = 'clear' | 'crowded' | 'capital' | 'per-combination' | 'hidden'

/** Ülkenin yerleşim ayrıntısı (özet ve testler için). */
export interface CountryPlacementDetail {
  code: string
  kind: PlacementKind
  /** Bileşim başına ızgaradaki en erken sığma (Infinity: hiç). */
  bestFitZooms: number[]
  /** Bileşim başına çapa ve ilk yakınlaştırma. */
  placements: CountryLabelPlacement[]
  /** Bileşim başına çakışma: ilk yakınlaştırmadan z7'ye pin ve kod kutusu sayısı (yazılmazsa 0). */
  overlaps: number[]
  /** Görsel merkez (erişilmezlik kutbu, ızgarada): [boylam, enlem]; ızgara boşsa null. */
  pole: readonly [lon: number, lat: number] | null
  /** Izgara adımı, 0,01°. */
  latticeStep: number
}

/** Adın kaynağı: üretimde `countryLabelText` (Intl), sürüklenme testinde commit'li tablo. */
export type NameSource = (code: string, locale: Locale) => string

interface LatticePoint {
  /** 0,01° tamsayı. */
  lon100: number
  lat100: number
}

/**
 * Ülkenin sabit ızgarası: sınır kutusundaki, ülkenin içindeki noktalar (kuzeyden, batıdan). Adım
 * bütün ülkenin kutusundandır (çapa bölgesi varsa kutunun bölgedeki kısmından); noktalar yalnız
 * 180° B–180° D arasındadır (ve bölgenin içindedir): çapa haritanın asıl kopyasındadır, kutusu 180.
 * meridyeni aşabilir (ülke orada sürekli).
 */
function latticeOf(
  shape: ProjectedShape,
  region: CountryLabelAnchorRegion | undefined,
): { step: number; rows: LatticePoint[][] } {
  const [minX, minY, maxX, maxY] = shape.bbox
  let lonMin = (minX / WORLD_SIZE) * 360 - 180
  let lonMax = (maxX / WORLD_SIZE) * 360 - 180
  let latMax = latitudeOf(minY)
  let latMin = latitudeOf(maxY)
  if (region) {
    const [west, south, east, north] = region
    lonMin = Math.max(lonMin, west)
    lonMax = Math.min(lonMax, east)
    latMin = Math.max(latMin, south)
    latMax = Math.min(latMax, north)
  }
  const span = Math.max(lonMax - lonMin, latMax - latMin) * 100
  const step = Math.max(1, Math.ceil(span / LATTICE_STEPS))
  const west = Math.max(lonMin, -180) * 100
  const east = Math.min(lonMax, 180) * 100
  const rows: LatticePoint[][] = []
  for (let j = Math.floor((latMax * 100) / step); j * step >= latMin * 100; j--) {
    const row: LatticePoint[] = []
    const lat100 = j * step
    for (let i = Math.ceil(west / step); i * step <= east; i++) {
      const lon100 = i * step
      if (shape.contains(mercatorX(lon100 / 100), mercatorY(lat100 / 100))) {
        row.push({ lon100, lat100 })
      }
    }
    rows.push(row)
  }
  return { step, rows }
}

const capitalOf = (code: string): CountryCapital => {
  const capital = COUNTRY_LABEL_CAPITAL_ANCHORS[code]
  if (!capital) throw new Error(`no capital anchor for ${code}`)
  return capital
}

type CountryCapital = CountryLabelCapitalAnchor

/** Ülkenin yerleşim girdileri: ad boyu kademesi ve km payı. */
export interface CountryPlacementInput {
  tier: CountryLabelTier
  safetyKm: number
}

/**
 * Kademe ve km payının kaynağı: yüzölçümü (D-095 tablosu, yoksa fixture'ın Natural Earth alanı) ve
 * fixture'ın uzak ülkeleri.
 */
export interface CountrySizes {
  areasKm2: Readonly<Record<string, number>>
  farCodes: readonly string[]
}

/** Ülkenin kademe ve sıra için kullanılan yüzölçümü: D-095 tablosu, yoksa Natural Earth. */
export function labelAreaKm2(code: string, sizes: CountrySizes): number {
  const area = Object.hasOwn(COUNTRY_AREA_OVERRIDES_KM2, code)
    ? COUNTRY_AREA_OVERRIDES_KM2[code]
    : sizes.areasKm2[code]
  if (area === undefined) throw new Error(`no area for ${code}`)
  return area
}

/** Ülkenin yerleşim girdileri. */
export function placementInput(code: string, sizes: CountrySizes): CountryPlacementInput {
  return {
    tier: countryLabelTier({ code, areaKm2: labelAreaKm2(code, sizes) }),
    safetyKm: sizes.farCodes.includes(code) ? FAR_SAFETY_KM : SAFETY_KM,
  }
}

/** Seçilen nokta: ızgaradaki dizini ve bileşimlerin toplam çakışması. */
interface Choice {
  index: number
  overlap: number
}

/** Bir ülkenin dört bileşimdeki yeri. */
export function placeCountry(
  code: string,
  geometry: MultiPolygon,
  names: NameSource,
  obstacles: AirportObstacles,
  { tier, safetyKm }: CountryPlacementInput,
): CountryPlacementDetail {
  const shape = new ProjectedShape(geometry)
  const fitters = PLACEMENT_COMBOS.map(
    ({ locale, layout }) =>
      new LabelFitter(
        shape,
        countryLabelLines(names(code, locale), locale),
        tier,
        layout,
        safetyKm,
      ),
  )
  const zooms = fitters[0]?.zooms ?? []
  const count = zooms.length
  const firstZoom = zooms[0] ?? COUNTRY_LABEL_FADE_START_ZOOM
  /** Düzeyin yakınlaştırması; `count` düzeyi z7'dir (çakışmanın son yakınlaştırması). */
  const zoomAt = (level: number) => firstZoom + level * COUNTRY_LABEL_FIT_ZOOM_STEP
  const lastLevel = Math.round((OVERLAP_LAST_ZOOM - firstZoom) / COUNTRY_LABEL_FIT_ZOOM_STEP)
  const zoomOf = (level: number) => (level < count ? zoomAt(level) : Infinity)
  const region = anchorRegionOf(code)
  const lattice = latticeOf(shape, region)
  const points = lattice.rows.flat()
  if (points.length === 0) {
    if (CAPITAL_ANCHORED_CODES.includes(code)) throw new Error(`${code}: empty lattice`)
    return {
      code,
      kind: 'hidden',
      bestFitZooms: fitters.map(() => Infinity),
      placements: fitters.map(() => null),
      overlaps: fitters.map(() => 0),
      pole: null,
      latticeStep: lattice.step,
    }
  }
  const levels = fitters.map((fitter) => {
    const result = new Uint8Array(points.length)
    let index = 0
    let rowStart = count - 1
    for (const row of lattice.rows) {
      let guess = rowStart
      for (const [column, point] of row.entries()) {
        const level = fitter.firstFitLevel(point.lon100 / 100, point.lat100 / 100, guess, true)
        result[index++] = level
        guess = level
        if (column === 0) rowStart = level
      }
    }
    return result
  })
  const best = levels.map((combo) => {
    let min = count
    for (const level of combo) if (level < min) min = level
    return min
  })
  let poleIndex = 0
  let poleDistance = -Infinity
  for (const [index, point] of points.entries()) {
    const lon = point.lon100 / 100
    const lat = point.lat100 / 100
    const distance = Math.min(
      shape.distanceToBoundary(lon, lat),
      regionEdgeDistance(region, lon, lat),
    )
    if (distance > poleDistance) {
      poleDistance = distance
      poleIndex = index
    }
  }
  const pole = points[poleIndex] as LatticePoint
  const poleX = mercatorX(pole.lon100 / 100)
  const poleY = mercatorY(pole.lat100 / 100)
  const xs = Float64Array.from(points, (point) => mercatorX(point.lon100 / 100))
  const ys = Float64Array.from(points, (point) => mercatorY(point.lat100 / 100))
  const boxes: GlyphBox[][] = fitters.map((fitter) =>
    Array.from({ length: lastLevel + 1 }, (_, level) => fitter.visibleBoxAt(zoomAt(level))),
  )
  /** k. bileşimde (lon, lat) çapasının çakışması: `level`den z7'ye; `limit`e ulaşınca durur. */
  const overlapAt = (
    k: number,
    lon: number,
    lat: number,
    level: number,
    limit = Infinity,
  ): number => {
    let total = 0
    for (let l = level; l <= lastLevel && total < limit; l++) {
      const zoom = zoomAt(l)
      const box = worldBoxAt(lon, lat, (boxes[k] as GlyphBox[])[l] as GlyphBox, zoom)
      total += obstacles.hits(box, zoom, limit - total)
    }
    return total
  }
  /** k. bileşimde ızgara noktasının çakışması: ilk sığmadan z7'ye; `limit`e ulaşınca durur. */
  const overlapOf = (k: number, index: number, limit = Infinity): number => {
    const point = points[index] as LatticePoint
    const level = (levels[k] as Uint8Array)[index] as number
    return overlapAt(k, point.lon100 / 100, point.lat100 / 100, level, limit)
  }
  /**
   * Adaylar: `combos`'un her birinde sığan ve en erkenin en çok `maxDelayZooms` gerisinde olan
   * noktalar; `clearOnly` ise yalnızca çakışması 0 olanlar. Sıra: çakışma, düzey toplamı, görsel
   * merkeze uzaklık; eşitlikte ızgara sırası (kuzey, batı).
   */
  const choose = (
    combos: readonly number[],
    maxDelayZooms: number,
    clearOnly: boolean,
  ): Choice | null => {
    const delay = Math.round(maxDelayZooms / COUNTRY_LABEL_FIT_ZOOM_STEP)
    let chosen: Choice | null = null
    let chosenSum = Infinity
    let chosenDistance = Infinity
    for (let index = 0; index < points.length; index++) {
      let sum = 0
      let fits = true
      for (const k of combos) {
        const level = (levels[k] as Uint8Array)[index] as number
        if (level >= count || level > (best[k] as number) + delay) {
          fits = false
          break
        }
        sum += level
      }
      if (!fits) continue
      const distance = Math.hypot((xs[index] as number) - poleX, (ys[index] as number) - poleY)
      const beatsTie = sum < chosenSum || (sum === chosenSum && distance < chosenDistance)
      // Seçilenin çakışması 0'sa daha az çakışan olamaz: eşitliği bozamayan nokta sayılmaz.
      if (chosen && chosen.overlap === 0 && !beatsTie) continue
      const limit = clearOnly ? 1 : (chosen?.overlap ?? Infinity) + 1
      let overlap = 0
      for (const k of combos) {
        overlap += overlapOf(k, index, limit - overlap)
        if (overlap >= limit) break
      }
      if (clearOnly && overlap > 0) continue
      if (chosen && (overlap > chosen.overlap || (overlap === chosen.overlap && !beatsTie))) {
        continue
      }
      chosen = { index, overlap }
      chosenSum = sum
      chosenDistance = distance
    }
    return chosen
  }
  const shown = fitters.map((_, k) => k).filter((k) => (best[k] as number) < count)
  const pointPlacement = (k: number, index: number): CountryLabelPlacement => {
    const point = points[index] as LatticePoint
    const level = (levels[k] as Uint8Array)[index] as number
    return level < count ? [point.lon100 / 100, point.lat100 / 100, zoomOf(level)] : null
  }
  const detail = (kind: PlacementKind, anchors: (number | null)[]): CountryPlacementDetail => ({
    code,
    kind,
    bestFitZooms: best.map(zoomOf),
    placements: anchors.map((index, k) => (index === null ? null : pointPlacement(k, index))),
    overlaps: anchors.map((index, k) => (index === null ? 0 : overlapOf(k, index))),
    pole: [pole.lon100 / 100, pole.lat100 / 100],
    latticeStep: lattice.step,
  })
  const anchorsFor = (index: number | null) =>
    fitters.map((_, k) => (shown.includes(k) ? index : null))
  if (shown.length === 0) return detail('hidden', anchorsFor(null))
  if (CAPITAL_ANCHORED_CODES.includes(code)) {
    const { lon, lat } = capitalOf(code)
    const capitalLevels = fitters.map((fitter, k) => {
      if (!shown.includes(k)) return null
      const level = fitter.firstFitLevel(lon, lat, count - 1, true)
      if (level >= count) {
        const combo = PLACEMENT_COMBOS[k]
        throw new Error(
          `${code}: the name never fits at the capital (${combo?.locale} ${combo?.layout})`,
        )
      }
      return level
    })
    return {
      code,
      kind: 'capital',
      bestFitZooms: best.map(zoomOf),
      placements: capitalLevels.map((level) => (level === null ? null : [lon, lat, zoomAt(level)])),
      overlaps: capitalLevels.map((level, k) =>
        level === null ? 0 : overlapAt(k, lon, lat, level),
      ),
      pole: [pole.lon100 / 100, pole.lat100 / 100],
      latticeStep: lattice.step,
    }
  }
  const clear = choose(shown, CLEAR_MAX_DELAY_ZOOMS, true)
  if (clear) return detail('clear', anchorsFor(clear.index))
  const crowded = choose(shown, CROWDED_MAX_DELAY_ZOOMS, false)
  if (crowded) return detail('crowded', anchorsFor(crowded.index))
  return detail(
    'per-combination',
    fitters.map((_, k) => {
      if (!shown.includes(k)) return null
      const own =
        choose([k], CLEAR_MAX_DELAY_ZOOMS, true) ?? choose([k], CROWDED_MAX_DELAY_ZOOMS, false)
      return own?.index ?? null
    }),
  )
}

/** Bütün ülkelerin yeri: tablo, yüzölçümleri (kademe ve sıra) ve ayrıntılar; koda göre sıralı. */
export function computePlacements(
  geometries: Readonly<Record<string, MultiPolygon>>,
  names: NameSource,
  obstacles: AirportObstacles,
  sizes: CountrySizes,
): { table: PlacementTable; areas: Record<string, number>; details: CountryPlacementDetail[] } {
  const table: PlacementTable = { tr: {}, en: {} }
  const areas: Record<string, number> = {}
  const details: CountryPlacementDetail[] = []
  for (const code of Object.keys(geometries).sort()) {
    const geometry = geometries[code] as MultiPolygon
    areas[code] = labelAreaKm2(code, sizes)
    const detail = placeCountry(code, geometry, names, obstacles, placementInput(code, sizes))
    details.push(detail)
    for (const locale of ['tr', 'en'] as const) {
      const at = (layout: LabelLayout) =>
        detail.placements[
          PLACEMENT_COMBOS.findIndex((combo) => combo.locale === locale && combo.layout === layout)
        ] ?? null
      table[locale][code] = {
        name: names(code, locale),
        regular: at('regular'),
        compact: at('compact'),
      }
    }
  }
  return { table, areas, details }
}

/** Commit'li tablonun adlarını okuyan ad kaynağı. */
export function namesFromTable(table: Readonly<PlacementTable>): NameSource {
  return (code, locale) => {
    const row = table[locale][code]
    if (!row) throw new Error(`no ${locale} name for ${code}`)
    return row.name
  }
}

const placementSource = (placement: CountryLabelPlacement) =>
  placement === null ? 'null' : `[${placement.join(', ')}]`

/** Üretilen modülün kaynağı (Prettier sonra biçimler). */
export function renderPlacementsModule(
  table: PlacementTable,
  areas: Readonly<Record<string, number>>,
  params: ReturnType<typeof placementParams>,
): string {
  const lines: string[] = [
    '/**',
    ' * Ülke adlarının yeri ve ilk sığma yakınlaştırması (D-096, D-099, D-100). ÜRETİLMİŞ DOSYA: elle',
    " * düzenlenmez; `pnpm country-labels` `tools/fixtures/naturalearth/countries.json`'dan ve",
    " * `tools/fixtures/ourairports/airports.csv`'nin haritada pini çizilen havalimanlarından",
    ' * (listelenenler, askerî hava üsleri hariç; D-103) üretir (tools/src/country-labels). Tools testi',
    " * tabloyu fixture'lardan yeniden hesaplar ve fark olursa kırılır.",
    ' *',
    " * Satır: ülke kodu → ad (tek satır; `countryLabelText`, üretimdeki Node/ICU CLDR'ından; harita",
    ' * bu adı yazar) ve iki düzen: geniş ve dar (≤ 767 px) harita. Düzen değeri [boylam, enlem, ilk',
    ' * sığma yakınlaştırması] ya da `null` (ad o düzende hiçbir yakınlaştırmada sınırın içine sığmaz,',
    ' * yazılmaz). Çapa ülkenin içinde, havalimanı pinlerinden ve kodlarından (modelin saydığı',
    " * kutularla) uzak boş bir yerdedir (D-099); KIBRIS kullanıcı kararıyla Lefkoşa'dadır (D-095).",
    " * Ülkeler: Natural Earth 4.1.0'ın ISO 3166-1 kodlu bütün birimleri, İsrail, Filistin ve",
    ' * Antarktika hariç (D-100).',
    ' */',
    "import type { Locale } from '../locale'",
    '',
    '/** [boylam, enlem, ilk sığma yakınlaştırması] ya da null (yazılmaz). */',
    'export type CountryLabelPlacement = readonly [lon: number, lat: number, fitZoom: number] | null',
    '',
    'export interface CountryLabelPlacementRow {',
    '  readonly name: string',
    '  readonly regular: CountryLabelPlacement',
    '  readonly compact: CountryLabelPlacement',
    '}',
    '',
    '/** Tablonun üretim değişkenleri (tools/src/country-labels). */',
    `export const COUNTRY_LABEL_PLACEMENT_PARAMS = ${JSON.stringify(params)} as const`,
    '',
    '/**',
    ' * Ülke kodu → yüzölçümü, km²: ad boyu kademesi (`countryLabelTier`) ve katmanlardaki sıra. D-095',
    ' * tablosundaki 59 ülke orada yazan değerle (`COUNTRY_AREA_OVERRIDES_KM2`), öbürleri Natural Earth',
    ' * poligonlarının küre üzerindeki alanıyla.',
    ' */',
    'export const COUNTRY_LABEL_AREAS_KM2: Readonly<Record<string, number>> = {',
    ...Object.keys(areas)
      .sort()
      .map((code) => `  ${code}: ${areas[code]},`),
    '}',
    '',
    'export const COUNTRY_LABEL_PLACEMENTS: Readonly<',
    '  Record<Locale, Readonly<Record<string, CountryLabelPlacementRow>>>',
    '> = {',
  ]
  for (const locale of ['tr', 'en'] as const) {
    lines.push(`  ${locale}: {`)
    for (const code of Object.keys(table[locale]).sort()) {
      const row = table[locale][code] as CountryLabelPlacementRow
      lines.push(
        `    ${code}: { name: ${JSON.stringify(row.name)}, regular: ${placementSource(row.regular)}, compact: ${placementSource(row.compact)} },`,
      )
    }
    lines.push('  },')
  }
  lines.push('}', '')
  return lines.join('\n')
}
