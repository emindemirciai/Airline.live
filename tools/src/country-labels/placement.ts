/**
 * Ülke adlarının yeri ve ilk sığma yakınlaştırması (D-096): `COUNTRY_LABEL_PLACEMENTS`'ı Natural
 * Earth fixture'ından hesaplar. Çevrimdışıdır ve belirlenimcidir; aynı fixture ve adlar her zaman
 * aynı tabloyu verir (placement.test.ts commit'li tabloyla karşılaştırır).
 *
 * Çapa kuralı, ülke başına (dört bileşim: Türkçe/İngilizce × geniş/dar harita):
 * 1. Her bileşimde adın başkentteki ilk sığma yakınlaştırması ve ülkenin içindeki sabit bir nokta
 *    ızgarasında (0,01°'nin katları; adım ülkenin boyuna göre) en erken sığma (`best`) hesaplanır.
 * 2. Başkent her bileşimde en erkenin en çok 0,5 kademe gerisindeyse ad başkentte ortalıdır.
 * 3. Değilse dört bileşimin hepsinde en erkenin en çok 0,25 kademe gerisinde sığan ızgara
 *    noktalarından başkente en yakını seçilir (eşitlikte kuzeydeki, sonra batıdaki): ad dil ya da
 *    harita genişliği değişince yer değiştirmez.
 * 4. Böyle ortak bir nokta yoksa her bileşim kendi çapasını aynı kuralla seçer.
 * Ad hiçbir noktada z7'den önce sığmıyorsa o bileşimde yazılmaz (`null`).
 */
import { distanceKm } from '@havayolu/geo'
import {
  COUNTRY_CAPITALS,
  COUNTRY_LABEL_FIT_ZOOM_STEP,
  countryLabelLines,
  countryLabelTier,
  type CountryCapital,
  type CountryLabelPlacement,
  type CountryLabelPlacementRow,
  type Locale,
} from '@havayolu/shared'
import {
  latitudeOf,
  mercatorX,
  mercatorY,
  ProjectedShape,
  WORLD_SIZE,
  type MultiPolygon,
} from './geometry'
import { LabelFitter, SAFETY_KM, SAFETY_PX, type LabelLayout } from './label-model'
import { NATURAL_EARTH_PARAMS, NATURAL_EARTH_SOURCE } from './natural-earth'

/** Izgaranın uzun kenarındaki en çok adım sayısı (adım en az 0,01°). */
export const LATTICE_STEPS = 100
/** Başkent, en erken sığmanın bu kadar kademe gerisine kadar tercih edilir. */
export const CAPITAL_PREFERENCE_ZOOMS = 0.5
/** Başkent dışı aday, en erken sığmanın en çok bu kadar kademe gerisindedir. */
export const CANDIDATE_TOLERANCE_ZOOMS = 0.25

/** Tabloya yazılan değişkenler (`COUNTRY_LABEL_PLACEMENT_PARAMS`). */
export const PLACEMENT_PARAMS = {
  naturalEarth: `${NATURAL_EARTH_SOURCE.version} 1:10m`,
  worldAtlas: NATURAL_EARTH_SOURCE.package.split('@')[1] ?? '',
  simplifyKm: NATURAL_EARTH_PARAMS.simplifyKm,
  safetyPx: SAFETY_PX,
  safetyKm: SAFETY_KM,
  latticeSteps: LATTICE_STEPS,
  capitalPreferenceZooms: CAPITAL_PREFERENCE_ZOOMS,
  candidateToleranceZooms: CANDIDATE_TOLERANCE_ZOOMS,
  fitZoomStep: COUNTRY_LABEL_FIT_ZOOM_STEP,
} as const

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

/** Ülkenin yerleşim ayrıntısı (özet ve testler için). */
export interface CountryPlacementDetail {
  code: string
  /** `capital`: başkent; `shared`: dört bileşimin ortak noktası; `per-combination`: bileşim başına. */
  kind: 'capital' | 'shared' | 'per-combination'
  /** Bileşim başına başkentteki ilk sığma yakınlaştırması (Infinity: hiç). */
  capitalFitZooms: number[]
  /** Bileşim başına en erken sığma (başkent ve ızgara; Infinity: hiç). */
  bestFitZooms: number[]
  /** Bileşim başına çapa ve ilk yakınlaştırma. */
  placements: CountryLabelPlacement[]
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

/** Ülkenin sabit ızgarası: sınır kutusundaki, ülkenin içindeki noktalar (kuzeyden, batıdan). */
function latticeOf(shape: ProjectedShape): { step: number; rows: LatticePoint[][] } {
  const [minX, minY, maxX, maxY] = shape.bbox
  const lonMin = (minX / WORLD_SIZE) * 360 - 180
  const lonMax = (maxX / WORLD_SIZE) * 360 - 180
  const latMax = latitudeOf(minY)
  const latMin = latitudeOf(maxY)
  const span = Math.max(lonMax - lonMin, latMax - latMin) * 100
  const step = Math.max(1, Math.ceil(span / LATTICE_STEPS))
  const rows: LatticePoint[][] = []
  for (let j = Math.floor((latMax * 100) / step); j * step >= latMin * 100; j--) {
    const row: LatticePoint[] = []
    const lat100 = j * step
    for (let i = Math.ceil((lonMin * 100) / step); i * step <= lonMax * 100; i++) {
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
  const capital = COUNTRY_CAPITALS.find((candidate) => candidate.code === code)
  if (!capital) throw new Error(`no capital for ${code}`)
  return capital
}

/** Bir ülkenin dört bileşimdeki yeri. */
export function placeCountry(
  code: string,
  geometry: MultiPolygon,
  names: NameSource,
): CountryPlacementDetail {
  const capital = capitalOf(code)
  const tier = countryLabelTier(capital)
  const shape = new ProjectedShape(geometry)
  const fitters = PLACEMENT_COMBOS.map(
    ({ locale, layout }) =>
      new LabelFitter(shape, countryLabelLines(names(code, locale), locale), tier, layout),
  )
  const count = fitters[0]?.zooms.length ?? 0
  const zoomOf = (level: number) =>
    level < count ? (fitters[0]?.zooms[level] as number) : Infinity
  const preference = Math.round(CAPITAL_PREFERENCE_ZOOMS / COUNTRY_LABEL_FIT_ZOOM_STEP)
  const tolerance = Math.round(CANDIDATE_TOLERANCE_ZOOMS / COUNTRY_LABEL_FIT_ZOOM_STEP)
  const capitalInside = shape.contains(mercatorX(capital.lon), mercatorY(capital.lat))
  const capitalLevels = fitters.map((fitter) =>
    capitalInside ? fitter.firstFitLevel(capital.lon, capital.lat, 0, true) : count,
  )
  const lattice = latticeOf(shape)
  const capitalPlacement = (k: number): CountryLabelPlacement => {
    const level = capitalLevels[k] as number
    return level < count ? [capital.lon, capital.lat, zoomOf(level)] : null
  }
  // Başkent her bileşimde kademenin ilk yarım kademesinde sığıyorsa ızgaraya gerek yok.
  if (capitalLevels.every((level) => level <= preference)) {
    return {
      code,
      kind: 'capital',
      capitalFitZooms: capitalLevels.map(zoomOf),
      bestFitZooms: capitalLevels.map(zoomOf),
      placements: fitters.map((_, k) => capitalPlacement(k)),
      latticeStep: lattice.step,
    }
  }
  const points = lattice.rows.flat()
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
  const best = fitters.map((_, k) => {
    let min = capitalLevels[k] as number
    for (const level of levels[k] as Uint8Array) if (level < min) min = level
    return min
  })
  // "Hiç" düzeyi (count) sonsuzdur: en erkene yakın sayılmaz.
  const capitalOk = (k: number) =>
    (best[k] as number) >= count ||
    ((capitalLevels[k] as number) < count &&
      (capitalLevels[k] as number) <= (best[k] as number) + preference)
  const detail = (
    kind: CountryPlacementDetail['kind'],
    placements: CountryLabelPlacement[],
  ): CountryPlacementDetail => ({
    code,
    kind,
    capitalFitZooms: capitalLevels.map(zoomOf),
    bestFitZooms: best.map(zoomOf),
    placements,
    latticeStep: lattice.step,
  })
  if (fitters.every((_, k) => capitalOk(k))) {
    return detail(
      'capital',
      fitters.map((_, k) => capitalPlacement(k)),
    )
  }
  const nearest = (accept: (index: number) => boolean): number => {
    let chosen = -1
    let chosenDistance = Infinity
    for (const [index, point] of points.entries()) {
      if (!accept(index)) continue
      const distance = distanceKm(
        { lat: point.lat100 / 100, lon: point.lon100 / 100 },
        { lat: capital.lat, lon: capital.lon },
      )
      const previous = points[chosen]
      if (
        distance < chosenDistance ||
        (distance === chosenDistance &&
          previous !== undefined &&
          (point.lat100 > previous.lat100 ||
            (point.lat100 === previous.lat100 && point.lon100 < previous.lon100)))
      ) {
        chosen = index
        chosenDistance = distance
      }
    }
    return chosen
  }
  const within = (k: number, index: number) => {
    const level = (levels[k] as Uint8Array)[index] as number
    return (
      (best[k] as number) >= count || (level < count && level <= (best[k] as number) + tolerance)
    )
  }
  const pointPlacement = (k: number, index: number): CountryLabelPlacement => {
    const point = points[index] as LatticePoint
    const level = (levels[k] as Uint8Array)[index] as number
    return level < count ? [point.lon100 / 100, point.lat100 / 100, zoomOf(level)] : null
  }
  const shared = nearest((index) => fitters.every((_, k) => within(k, index)))
  if (shared >= 0) {
    return detail(
      'shared',
      fitters.map((_, k) => pointPlacement(k, shared)),
    )
  }
  return detail(
    'per-combination',
    fitters.map((_, k) => {
      if (capitalOk(k)) return capitalPlacement(k)
      const own = nearest((index) => within(k, index))
      return own >= 0 ? pointPlacement(k, own) : null
    }),
  )
}

/** Bütün ülkelerin yeri: tablo ve ayrıntılar. */
export function computePlacements(
  geometries: Readonly<Record<string, MultiPolygon>>,
  names: NameSource,
): { table: PlacementTable; details: CountryPlacementDetail[] } {
  const table: PlacementTable = { tr: {}, en: {} }
  const details: CountryPlacementDetail[] = []
  for (const { code } of COUNTRY_CAPITALS) {
    const geometry = geometries[code]
    if (!geometry) throw new Error(`no geometry for ${code}`)
    const detail = placeCountry(code, geometry, names)
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
  return { table, details }
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
export function renderPlacementsModule(table: PlacementTable): string {
  const lines: string[] = [
    '/**',
    ' * Ülke adlarının yeri ve ilk sığma yakınlaştırması (D-096). ÜRETİLMİŞ DOSYA: elle düzenlenmez;',
    " * `pnpm country-labels` `tools/fixtures/naturalearth/countries.json`'dan üretir",
    " * (tools/src/country-labels). Tools testi tabloyu fixture'dan yeniden hesaplar ve fark olursa",
    ' * kırılır.',
    ' *',
    " * Satır: ülke kodu → ad (tek satır; `countryLabelText`, üretimdeki Node/ICU CLDR'ından; harita",
    ' * bu adı yazar) ve iki düzen: geniş ve dar (≤ 767 px) harita. Düzen değeri [boylam, enlem, ilk',
    ' * sığma yakınlaştırması] ya da `null` (ad o düzende hiçbir yakınlaştırmada sınırın içine sığmaz,',
    ' * yazılmaz). Çapa sığıyorsa başkenttir.',
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
    `export const COUNTRY_LABEL_PLACEMENT_PARAMS = ${JSON.stringify(PLACEMENT_PARAMS)} as const`,
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
