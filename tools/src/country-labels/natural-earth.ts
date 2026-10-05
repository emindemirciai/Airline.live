/**
 * Natural Earth ülke poligonları (D-096): `world-atlas@2.0.2` paketindeki Natural Earth 4.1.0
 * 1:10m TopoJSON'undan haritadaki 59 ülkenin sadeleşmiş, kırpılmış poligonları. Yalnızca çevrimdışı
 * üretici (`pnpm country-labels:fixture`) ve testler kullanır; geometri haritada çizilmez, hiçbir şey
 * indirilmez. Çıktı `tools/fixtures/naturalearth/countries.json`'dır (commit'li, yalnızca test).
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { COUNTRY_CAPITALS } from '@havayolu/shared'
import type * as TopojsonClient from 'topojson-client'
import {
  clipRing,
  ringAreaKm2,
  ringContains,
  shiftRingWest,
  simplifyArc,
  unwrapLongitudes,
  type LonLat,
  type LonLatBox,
  type MultiPolygon,
  type Polygon,
  type Ring,
} from './geometry'

const require = createRequire(import.meta.url)
const topojson = require('topojson-client') as typeof TopojsonClient

/** Kaynak: paket, dosya ve Natural Earth sürümü. */
export const NATURAL_EARTH_SOURCE = {
  dataset: 'Natural Earth Admin 0 – Countries',
  version: '4.1.0',
  package: 'world-atlas@2.0.2',
  file: 'countries-10m.json',
} as const

/** Fixture'ın üretim değişkenleri. */
export const NATURAL_EARTH_PARAMS = {
  /** Douglas–Peucker toleransı, km. */
  simplifyKm: 0.5,
  /** Koordinatların yuvarlandığı adım, derece. */
  quantumDeg: 0.001,
  /** Kırpma kutusu: [batı, güney, doğu, kuzey]. 90° D'nun doğusundaki Rusya ve Arktik adaları düşer. */
  roi: [-20, 8, 90, 72] as LonLatBox,
  /** Bundan küçük parçalar (adalar) düşer; başkenti içeren parça kalır. */
  minPartKm2: 100,
} as const

/**
 * Her ülkenin Natural Earth birimleri: sayısal ISO kodu (`id`) ya da kimliksiz birimin adı
 * (`properties.name`). Kıbrıs adanın tamamıdır (KIBRIS / CYPRUS bir ad); yalnız Kıbrıs + K. Kıbrıs
 * alınsa ara bölgedeki Lefkoşa poligonun dışında kalırdı. Kazakistan Baykonur'la birlikte; Kosova
 * ayrı birimdir, Sırbistan (688) Kosova'sızdır. İsrail ve Filistin adlandırılmaz, tabloda yoktur.
 */
export const NATURAL_EARTH_UNITS: Readonly<Record<string, readonly string[]>> = {
  AE: ['784'],
  AF: ['004'],
  AL: ['008'],
  AM: ['051'],
  AT: ['040'],
  AZ: ['031'],
  BA: ['070'],
  BE: ['056'],
  BG: ['100'],
  BH: ['048'],
  BY: ['112'],
  CH: ['756'],
  CY: ['196', 'N. Cyprus', 'Cyprus U.N. Buffer Zone', 'Akrotiri', 'Dhekelia'],
  CZ: ['203'],
  DE: ['276'],
  DK: ['208'],
  DZ: ['012'],
  EE: ['233'],
  EG: ['818'],
  ES: ['724'],
  FR: ['250'],
  GE: ['268'],
  GR: ['300'],
  HR: ['191'],
  HU: ['348'],
  IQ: ['368'],
  IR: ['364'],
  IT: ['380'],
  JO: ['400'],
  KW: ['414'],
  KZ: ['398', 'Baikonur'],
  LB: ['422'],
  LT: ['440'],
  LU: ['442'],
  LV: ['428'],
  LY: ['434'],
  MD: ['498'],
  ME: ['499'],
  MK: ['807'],
  MT: ['470'],
  NL: ['528'],
  OM: ['512'],
  PL: ['616'],
  QA: ['634'],
  RO: ['642'],
  RS: ['688'],
  RU: ['643'],
  SA: ['682'],
  SD: ['729'],
  SE: ['752'],
  SI: ['705'],
  SK: ['703'],
  SY: ['760'],
  TM: ['795'],
  TN: ['788'],
  TR: ['792'],
  UA: ['804'],
  UZ: ['860'],
  XK: ['Kosovo'],
}

/** world-atlas'ın TopoJSON'u (kullanılan alanlar). */
export interface WorldAtlasTopology {
  type: 'Topology'
  arcs: (readonly (readonly [number, number])[])[]
  transform: { scale: [number, number]; translate: [number, number] }
  objects: { countries: { type: 'GeometryCollection'; geometries: WorldAtlasGeometry[] } }
}

export interface WorldAtlasGeometry {
  type: 'Polygon' | 'MultiPolygon'
  id?: string
  arcs: number[][] | number[][][]
  properties: { name: string }
}

/** Fixture dosyası: halka = ilk nokta mutlak, sonra farklar; değerler binde bir derece tamsayı. */
export interface NaturalEarthFixture {
  source: typeof NATURAL_EARTH_SOURCE
  params: { simplifyKm: number; quantumDeg: number; roi: number[]; minPartKm2: number }
  countries: Record<string, number[][][]>
}

/** world-atlas paketinin 1:10m dosyası (yerel `node_modules`; ağ yok). */
export function readWorldAtlas(): WorldAtlasTopology {
  const path = require.resolve(`world-atlas/${NATURAL_EARTH_SOURCE.file}`)
  return JSON.parse(readFileSync(path, 'utf8')) as WorldAtlasTopology
}

/** Birim, bir geometrinin kimliği ya da (kimliksizse) adı mı. */
export function unitMatches(unit: string, geometry: WorldAtlasGeometry): boolean {
  return geometry.id === unit || (geometry.id === undefined && geometry.properties.name === unit)
}

/** Ülkenin Natural Earth geometrileri; her birim tam bir geometriye karşılık gelmelidir. */
export function countryGeometries(
  topology: WorldAtlasTopology,
  code: string,
): WorldAtlasGeometry[] {
  const units = NATURAL_EARTH_UNITS[code]
  if (!units) throw new Error(`no Natural Earth units for ${code}`)
  return units.map((unit) => {
    const matches = topology.objects.countries.geometries.filter((g) => unitMatches(unit, g))
    if (matches.length !== 1) {
      throw new Error(`${code}: Natural Earth unit ${unit} matched ${matches.length} geometries`)
    }
    return matches[0] as WorldAtlasGeometry
  })
}

/** Geometrinin kullandığı yay dizinleri (negatif dizin ters yön: ~i). */
function arcIndices(geometry: WorldAtlasGeometry, into: Set<number>): void {
  const visit = (value: unknown): void => {
    if (typeof value === 'number') into.add(value < 0 ? ~value : value)
    else if (Array.isArray(value)) for (const item of value) visit(item)
  }
  visit(geometry.arcs)
}

/** Nicelenmiş (fark kodlu) yayı boylam/enleme açar. */
function decodeArc(
  arc: readonly (readonly [number, number])[],
  transform: WorldAtlasTopology['transform'],
): LonLat[] {
  const [sx, sy] = transform.scale
  const [tx, ty] = transform.translate
  let x = 0
  let y = 0
  return arc.map(([dx, dy]) => {
    x += dx
    y += dy
    return [x * sx + tx, y * sy + ty] as const
  })
}

const capitalOf = (code: string) => {
  const capital = COUNTRY_CAPITALS.find((candidate) => candidate.code === code)
  if (!capital) throw new Error(`no capital for ${code}`)
  return capital
}

/**
 * Ülkelerin poligonları, sadeleşmiş (`simplifyKm`; 0 ise sadeleşmez) ve kırpılmış; boylam/enlem,
 * yuvarlanmamış. Her ülkenin birimleri ortak yaylarından birleştirilir (`topojson.merge`). Dış
 * halkası `minPartKm2`'den küçük parça başkenti içermiyorsa düşer (Abu Dabi adası, Malta, Bahreyn
 * kalır).
 */
export function countryPolygons(
  topology: WorldAtlasTopology,
  simplifyKm: number = NATURAL_EARTH_PARAMS.simplifyKm,
): Record<string, Polygon[]> {
  const codes = Object.keys(NATURAL_EARTH_UNITS).sort()
  const used = new Set<number>()
  const selected = new Map<string, WorldAtlasGeometry[]>()
  for (const code of codes) {
    const geometries = countryGeometries(topology, code)
    selected.set(code, geometries)
    for (const geometry of geometries) arcIndices(geometry, used)
  }
  // Yay sadeleşmeden önce sürekli kılınır: 180. meridyendeki sıçrama Douglas–Peucker'in kirişini
  // bozmasın. Yaylar birleşince halka bir daha sürekli kılınır (yayların uçları ±360° farklı olabilir).
  const arcs = topology.arcs.map((arc, index) =>
    used.has(index)
      ? simplifyArc(unwrapLongitudes(decodeArc(arc, topology.transform)), simplifyKm)
      : [],
  )
  const simplified: TopojsonClient.Topology = {
    type: 'Topology',
    objects: topology.objects,
    arcs: arcs as (readonly (readonly [number, number])[])[],
  }
  const { roi, minPartKm2 } = NATURAL_EARTH_PARAMS
  const result: Record<string, Polygon[]> = {}
  for (const code of codes) {
    const capital = capitalOf(code)
    const merged = topojson.merge(simplified, selected.get(code) ?? [])
    const polygons: Polygon[] = []
    for (const polygon of merged.coordinates) {
      // Halkalar kırpılmadan önce sürekli kılınır ve dünyanın aynı kopyasına kaydırılır: dış halka
      // −180°'den, delikler dış halkanın batı ucundan başlayan 360°'ye.
      const [outerRaw, ...holesRaw] = polygon.map((ring) =>
        unwrapLongitudes(ring.slice(0, -1) as LonLat[]),
      )
      if (!outerRaw) continue
      const outerWhole = shiftRingWest(outerRaw, -180)
      const outerWest = outerWhole.reduce((west, [lon]) => Math.min(west, lon), Infinity)
      const outer = clipRing(outerWhole, roi)
      if (!outer) continue
      if (ringAreaKm2(outer) < minPartKm2 && !ringContains(outer, capital.lon, capital.lat))
        continue
      const rings: Ring[] = [outer]
      for (const hole of holesRaw) {
        const clipped = clipRing(shiftRingWest(hole, outerWest), roi)
        if (clipped) rings.push(clipped)
      }
      polygons.push(rings)
    }
    result[code] = polygons
  }
  return result
}

/** Halkayı binde bir dereceye yuvarlar, art arda yinelenen noktaları atar, fark kodlar. */
function encodeRing(ring: Ring, quantumDeg: number): number[] | null {
  const scale = Math.round(1 / quantumDeg)
  const points: [number, number][] = []
  for (const [lon, lat] of ring) {
    const x = Math.round(lon * scale)
    const y = Math.round(lat * scale)
    const last = points.at(-1)
    if (last && last[0] === x && last[1] === y) continue
    points.push([x, y])
  }
  while (points.length > 1) {
    const first = points[0] as [number, number]
    const last = points.at(-1) as [number, number]
    if (first[0] !== last[0] || first[1] !== last[1]) break
    points.pop()
  }
  if (points.length < 3) return null
  const flat: number[] = []
  let px = 0
  let py = 0
  for (const [x, y] of points) {
    flat.push(x - px, y - py)
    px = x
    py = y
  }
  return flat
}

/** Fixture'ı world-atlas topolojisinden üretir (çevrimdışı, belirlenimci). */
export function buildFixture(topology: WorldAtlasTopology): NaturalEarthFixture {
  const polygons = countryPolygons(topology)
  const { quantumDeg, simplifyKm, roi, minPartKm2 } = NATURAL_EARTH_PARAMS
  const countries: Record<string, number[][][]> = {}
  for (const code of Object.keys(polygons).sort()) {
    const parts: number[][][] = []
    for (const polygon of polygons[code] ?? []) {
      const [outer, ...holes] = polygon
      const encodedOuter = outer ? encodeRing(outer, quantumDeg) : null
      if (!encodedOuter) continue
      const rings = [encodedOuter]
      for (const hole of holes) {
        const encoded = encodeRing(hole, quantumDeg)
        if (encoded) rings.push(encoded)
      }
      parts.push(rings)
    }
    countries[code] = parts
  }
  return {
    source: NATURAL_EARTH_SOURCE,
    params: { simplifyKm, quantumDeg, roi: [...roi], minPartKm2 },
    countries,
  }
}

/** Fixture'daki ülke geometrileri, boylam/enlem. */
export function decodeFixture(fixture: NaturalEarthFixture): Record<string, MultiPolygon> {
  const scale = Math.round(1 / fixture.params.quantumDeg)
  const result: Record<string, MultiPolygon> = {}
  for (const [code, parts] of Object.entries(fixture.countries)) {
    result[code] = parts.map((rings) =>
      rings.map((flat) => {
        const ring: LonLat[] = []
        let x = 0
        let y = 0
        for (let i = 0; i + 1 < flat.length; i += 2) {
          x += flat[i] as number
          y += flat[i + 1] as number
          ring.push([x / scale, y / scale])
        }
        return ring
      }),
    )
  }
  return result
}

/** Commit'li fixture dosyasının yolu. */
export const FIXTURE_URL = new URL('../../fixtures/naturalearth/countries.json', import.meta.url)

/** Commit'li fixture'ı okur. */
export function readFixture(): NaturalEarthFixture {
  return JSON.parse(readFileSync(FIXTURE_URL, 'utf8')) as NaturalEarthFixture
}
