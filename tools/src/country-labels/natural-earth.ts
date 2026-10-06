/**
 * Natural Earth ülke poligonları (D-096, D-100): `world-atlas@2.0.2` paketindeki Natural Earth 4.1.0
 * 1:10m TopoJSON'undan haritada adı yazılan bütün ülkelerin sadeleşmiş poligonları ve yüzölçümleri.
 * Yalnızca çevrimdışı üretici (`pnpm country-labels:fixture`) ve testler kullanır; geometri haritada
 * çizilmez, hiçbir şey indirilmez. Çıktı `tools/fixtures/naturalearth/countries.json`'dır (commit'li,
 * yalnızca test).
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { distanceKm } from '@havayolu/geo'
import type * as TopojsonClient from 'topojson-client'
import {
  clipRing,
  geodesicAreaKm2,
  placeOnOneWorldCopy,
  ringGeodesicAreaKm2,
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
  /** Douglas–Peucker toleransı, km (Türkiye'ye yakın ülkeler). */
  simplifyKm: 0.5,
  /**
   * Türkiye'den uzak ülkelerin Douglas–Peucker toleransı, km (D-100): bütün dünya 0,5 km'de ~2,38 MB
   * olurdu (bununla ~2,03 MB). Bu ülkelerin güvenlik payı da o kadar büyüktür (label-model.ts `FAR_SAFETY_KM`).
   */
  farSimplifyKm: 1,
  /**
   * Uzak ülke: bütün noktaları `FAR_REFERENCE`'a (Ankara) bundan uzak, km (4. halkanın sınırı), kara
   * komşuları da (`farCodes`).
   */
  farFromKm: 5000,
  /** Koordinatların yuvarlandığı adım, derece. */
  quantumDeg: 0.001,
  /**
   * Kırpma kutusu: [batı, güney, doğu, kuzey]. Bütün dünya: boylamda hiçbir şey kesmez (ülkeler 180.
   * meridyende sürekli, tek dünya kopyasındadır: Kiribati 191° B'dan, Rusya 191° D'ya); enlemde
   * yalnız Antarktika'yı keser (adı yazılmaz). Mercator'u sonlu tutar.
   */
  roi: [-200, -60, 200, 84] as LonLatBox,
  /** Bundan küçük parçalar (adalar) düşer; ülkenin en büyük parçası her zaman kalır. */
  minPartKm2: 100,
} as const

/**
 * Her ülkenin Natural Earth birimleri: sayısal ISO 3166-1 kodu (`id`) ya da birimin adı
 * (`properties.name`; kimliksiz ya da kimliği iki birimde olan birimler). Kod, Natural Earth
 * biriminin ISO 3166-1 alpha-2 kodudur (sayısal koddan; test CLDR'ın eşlemesiyle karşılaştırır).
 * - Kıbrıs adanın tamamıdır (KIBRIS / CYPRUS bir ad); yalnız Kıbrıs + K. Kıbrıs alınsa ara
 *   bölgedeki Lefkoşa poligonun dışında kalırdı.
 * - Kiralık üsler ülkelerinin içindedir: Baykonur Kazakistan'da, Guantánamo Küba'da.
 * - Somaliland Somali'dedir (ISO 3166-1'de ayrı kod yok).
 * - Kosova ayrı birimdir (XK, kullanıcı tanımlı kod); Sırbistan (688) Kosova'sızdır.
 * - Avustralya'nın iki birimi aynı sayısal kodu taşır (036): adla seçilir.
 * - Fas (504) ile Batı Sahra (732) birleştirilip 27°40′ K'de yeniden bölünür
 *   (`NATURAL_EARTH_LATITUDE_SPLITS`).
 * Adı yazılmayan birimler `NATURAL_EARTH_UNASSIGNED`'dadır; deniz aşırı parçaları ayrı ISO koduyla
 * yazılanlar `NATURAL_EARTH_PART_SPLITS`'tedir.
 */
export const NATURAL_EARTH_UNITS: Readonly<Record<string, readonly string[]>> = {
  AD: ['020'],
  AE: ['784'],
  AF: ['004'],
  AG: ['028'],
  AI: ['660'],
  AL: ['008'],
  AM: ['051'],
  AO: ['024'],
  AR: ['032'],
  AS: ['016'],
  AT: ['040'],
  AU: ['Australia', 'Ashmore and Cartier Is.'],
  AW: ['533'],
  AX: ['248'],
  AZ: ['031'],
  BA: ['070'],
  BB: ['052'],
  BD: ['050'],
  BE: ['056'],
  BF: ['854'],
  BG: ['100'],
  BH: ['048'],
  BI: ['108'],
  BJ: ['204'],
  BL: ['652'],
  BM: ['060'],
  BN: ['096'],
  BO: ['068'],
  BR: ['076'],
  BS: ['044'],
  BT: ['064'],
  BW: ['072'],
  BY: ['112'],
  BZ: ['084'],
  CA: ['124'],
  CD: ['180'],
  CF: ['140'],
  CG: ['178'],
  CH: ['756'],
  CI: ['384'],
  CK: ['184'],
  CL: ['152'],
  CM: ['120'],
  CN: ['156'],
  CO: ['170'],
  CR: ['188'],
  CU: ['192', 'USNB Guantanamo Bay'],
  CV: ['132'],
  CW: ['531'],
  CY: ['196', 'N. Cyprus', 'Cyprus U.N. Buffer Zone', 'Akrotiri', 'Dhekelia'],
  CZ: ['203'],
  DE: ['276'],
  DJ: ['262'],
  DK: ['208'],
  DM: ['212'],
  DO: ['214'],
  DZ: ['012'],
  EC: ['218'],
  EE: ['233'],
  EG: ['818'],
  EH: ['732'],
  ER: ['232'],
  ES: ['724'],
  ET: ['231'],
  FI: ['246'],
  FJ: ['242'],
  FK: ['238'],
  FM: ['583'],
  FO: ['234'],
  FR: ['250'],
  GA: ['266'],
  GB: ['826'],
  GD: ['308'],
  GE: ['268'],
  GG: ['831'],
  GH: ['288'],
  GI: ['292'],
  GL: ['304'],
  GM: ['270'],
  GN: ['324'],
  GQ: ['226'],
  GR: ['300'],
  GS: ['239'],
  GT: ['320'],
  GU: ['316'],
  GW: ['624'],
  GY: ['328'],
  HK: ['344'],
  HM: ['334'],
  HN: ['340'],
  HR: ['191'],
  HT: ['332'],
  HU: ['348'],
  ID: ['360'],
  IE: ['372'],
  IM: ['833'],
  IN: ['356'],
  IO: ['086'],
  IQ: ['368'],
  IR: ['364'],
  IS: ['352'],
  IT: ['380'],
  JE: ['832'],
  JM: ['388'],
  JO: ['400'],
  JP: ['392'],
  KE: ['404'],
  KG: ['417'],
  KH: ['116'],
  KI: ['296'],
  KM: ['174'],
  KN: ['659'],
  KP: ['408'],
  KR: ['410'],
  KW: ['414'],
  KY: ['136'],
  KZ: ['398', 'Baikonur'],
  LA: ['418'],
  LB: ['422'],
  LC: ['662'],
  LI: ['438'],
  LK: ['144'],
  LR: ['430'],
  LS: ['426'],
  LT: ['440'],
  LU: ['442'],
  LV: ['428'],
  LY: ['434'],
  MA: ['504'],
  MC: ['492'],
  MD: ['498'],
  ME: ['499'],
  MF: ['663'],
  MG: ['450'],
  MH: ['584'],
  MK: ['807'],
  ML: ['466'],
  MM: ['104'],
  MN: ['496'],
  MO: ['446'],
  MP: ['580'],
  MR: ['478'],
  MS: ['500'],
  MT: ['470'],
  MU: ['480'],
  MV: ['462'],
  MW: ['454'],
  MX: ['484'],
  MY: ['458'],
  MZ: ['508'],
  NA: ['516'],
  NC: ['540'],
  NE: ['562'],
  NF: ['574'],
  NG: ['566'],
  NI: ['558'],
  NL: ['528'],
  NO: ['578'],
  NP: ['524'],
  NR: ['520'],
  NU: ['570'],
  NZ: ['554'],
  OM: ['512'],
  PA: ['591'],
  PE: ['604'],
  PF: ['258'],
  PG: ['598'],
  PH: ['608'],
  PK: ['586'],
  PL: ['616'],
  PM: ['666'],
  PN: ['612'],
  PR: ['630'],
  PT: ['620'],
  PW: ['585'],
  PY: ['600'],
  QA: ['634'],
  RO: ['642'],
  RS: ['688'],
  RU: ['643'],
  RW: ['646'],
  SA: ['682'],
  SB: ['090'],
  SC: ['690'],
  SD: ['729'],
  SE: ['752'],
  SG: ['702'],
  SH: ['654'],
  SI: ['705'],
  SK: ['703'],
  SL: ['694'],
  SM: ['674'],
  SN: ['686'],
  SO: ['706', 'Somaliland'],
  SR: ['740'],
  SS: ['728'],
  ST: ['678'],
  SV: ['222'],
  SX: ['534'],
  SY: ['760'],
  SZ: ['748'],
  TC: ['796'],
  TD: ['148'],
  TF: ['260'],
  TG: ['768'],
  TH: ['764'],
  TJ: ['762'],
  TL: ['626'],
  TM: ['795'],
  TN: ['788'],
  TO: ['776'],
  TR: ['792'],
  TT: ['780'],
  TV: ['798'],
  TW: ['158'],
  TZ: ['834'],
  UA: ['804'],
  UG: ['800'],
  UM: ['581'],
  US: ['840'],
  UY: ['858'],
  UZ: ['860'],
  VA: ['336'],
  VC: ['670'],
  VE: ['862'],
  VG: ['092'],
  VI: ['850'],
  VN: ['704'],
  VU: ['548'],
  WF: ['876'],
  WS: ['882'],
  XK: ['Kosovo'],
  YE: ['887'],
  ZA: ['710'],
  ZM: ['894'],
  ZW: ['716'],
}

/**
 * Natural Earth biriminde olup kendi ISO 3166-1 kodu olan deniz aşırı parçalar: parçanın dış halkası
 * kutulardan birinin içindeyse o koda gider, kalanlar birimin kodunda kalır. Fransa'nın deniz aşırı
 * bölgeleri (Fransız Guyanası, Guadeloupe, Martinik, Réunion, Mayotte), Norveç'in Svalbard ve Jan
 * Mayen'i ve Bouvet Adası, Hollanda'nın Karayip parçası. FRANSA, NORVEÇ ve HOLLANDA Avrupa'daki
 * topraklarında yazılır (yüzölçümleri de öyledir, D-095); bölünmeseler ad FRANSA için kaba bir
 * ızgarada, NORVEÇ için Mercator'da şişen Svalbard'da aranırdı.
 */
export const NATURAL_EARTH_PART_SPLITS: Readonly<
  Record<string, Readonly<Record<string, readonly LonLatBox[]>>>
> = {
  FR: {
    GF: [[-55, 2, -51, 6]],
    GP: [[-62, 15.8, -60.9, 16.6]],
    MQ: [[-61.5, 14.3, -60.7, 15]],
    RE: [[55, -21.5, 56, -20.8]],
    YT: [[44.9, -13.1, 45.4, -12.5]],
  },
  NL: { BQ: [[-69, 11.9, -62.8, 17.8]] },
  NO: {
    BV: [[3, -55, 4, -54]],
    SJ: [
      [-10, 70.5, -7.5, 71.5],
      [5, 74, 36, 81.5],
    ],
  },
}

/**
 * Natural Earth'ün fiilî sınırı yerine bir enlemde yeniden bölünen iki komşu birim: ikisi ortak
 * yaylarından birleştirilir, enlemin kuzeyi `north`, güneyi `south` koduna gider (iki parça aynı
 * halkadan kesildiğinden ortak kenarın noktaları aynıdır). Natural Earth 4.1.0 Fas'ı (504) Berm'e
 * kadar çizer: Layun, Semara ve Dahla Fas'tadır, Batı Sahra (732) yalnız Berm'in doğusudur (~91 bin
 * km²). Kod ISO 3166-1'in ve BM'nin Batı Sahra'sıdır (EH; bütün bölge, ~269 bin km²); Fas ile
 * sınırı 27°40′ K'dir: haritanın altlığı bu çizgiyi tartışmalı sınır olarak çizer ve OurAirports da
 * Layun (GMML), Dahla (GMMH) ve Semara (GMMA) havalimanlarını EH sayar (D-100; orkestratör
 * varsayılanı, siyasi bir tutum değildir).
 */
export const NATURAL_EARTH_LATITUDE_SPLITS: readonly {
  readonly north: string
  readonly south: string
  readonly lat: number
}[] = [{ north: 'MA', south: 'EH', lat: 27 + 40 / 60 }]

/**
 * Hiçbir ülkeye verilmeyen Natural Earth birimleri ve nedeni: İsrail ve Filistin'in adı yazılmaz
 * (D-095); Antarktika ülke değildir; kalanların ISO 3166-1 kodu yoktur (tartışmalı buzul ve
 * resifler, Clipperton) ya da iki kodu tek birimdedir (Hint Okyanusu Toprakları: Christmas ve
 * Cocos; ikisi de adın sığamayacağı kadar küçük).
 */
export const NATURAL_EARTH_UNASSIGNED: Readonly<Record<string, string>> = {
  '010': 'Antarctica: not a country',
  '275': 'Palestine: unlabelled (D-095)',
  '376': 'Israel: unlabelled (D-095)',
  'Bajo Nuevo Bank': 'disputed reef, no ISO 3166-1 code',
  'Clipperton I.': 'no ISO 3166-1 code',
  'Coral Sea Is.': 'no ISO 3166-1 code',
  'Indian Ocean Ter.': 'two ISO 3166-1 codes (CX, CC) in one unit; both too small to label',
  'Scarborough Reef': 'disputed reef, no ISO 3166-1 code',
  'Serranilla Bank': 'disputed reef, no ISO 3166-1 code',
  'Siachen Glacier': 'disputed glacier, no ISO 3166-1 code',
  'Spratly Is.': 'disputed islands, no ISO 3166-1 code',
}

/** Uzaklığın ölçüldüğü nokta: Ankara (şehir merkezi, 0,01°). */
export const FAR_REFERENCE = { lat: 39.93, lon: 32.86 } as const

/** Haritada adı yazılan bütün kodlar (birimler ve bölünen parçalar), sıralı. */
export const NATURAL_EARTH_CODES: readonly string[] = [
  ...Object.keys(NATURAL_EARTH_UNITS),
  ...Object.values(NATURAL_EARTH_PART_SPLITS).flatMap((children) => Object.keys(children)),
].sort()

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

/**
 * Fixture dosyası: halka = ilk nokta mutlak, sonra farklar; değerler binde bir derece tamsayı.
 * `areasKm2`: ülkenin bütün parçalarının (sadeleşmeden, düşen adalar dahil) küre üzerindeki alanı.
 * `farCodes`: Türkiye'den uzak (`farSimplifyKm` ile sadeleşen) ülkeler, sıralı.
 */
export interface NaturalEarthFixture {
  source: typeof NATURAL_EARTH_SOURCE
  params: {
    simplifyKm: number
    farSimplifyKm: number
    farFromKm: number
    quantumDeg: number
    roi: number[]
    minPartKm2: number
  }
  areasKm2: Record<string, number>
  farCodes: string[]
  countries: Record<string, number[][][]>
}

/** Douglas–Peucker toleransı, km: herkese aynı ya da koda göre. */
export type SimplifyTolerance = number | ((code: string) => number)

/** world-atlas paketinin 1:10m dosyası (yerel `node_modules`; ağ yok). */
export function readWorldAtlas(): WorldAtlasTopology {
  const path = require.resolve(`world-atlas/${NATURAL_EARTH_SOURCE.file}`)
  return JSON.parse(readFileSync(path, 'utf8')) as WorldAtlasTopology
}

/** Birim, bir geometrinin kimliği ya da adı mı. */
export function unitMatches(unit: string, geometry: WorldAtlasGeometry): boolean {
  return geometry.id === unit || geometry.properties.name === unit
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

/** Boylamı 360°'nin katı kadar kaydırıp [−180, 180] aralığına getirir; aralıktaki değer değişmez. */
const wrapLongitude = (lon: number) =>
  lon > 180
    ? lon - 360 * Math.ceil((lon - 180) / 360)
    : lon < -180
      ? lon + 360 * Math.ceil((-180 - lon) / 360)
      : lon

/**
 * Yayı sadeleştirir (D-100): sürekli kılınmış yayda Douglas–Peucker, sonra noktalar world-atlas'ın
 * [−180, 180] aralığına geri döner ve uç noktalar çözülen değerlerin tam kendisi olur.
 * `topojson.merge` yayları uç noktalarının eşitliğiyle halkaya diker (`stitch`); 180. meridyeni geçen
 * bir yayın sürekli kılınmış ucu komşusununkinden 360° farklı kalsaydı halka dikilemez, Rusya'nın
 * Uzak Doğu'su Çukotka'dan Kore sınırına uzanan tek bir kenarla kapanırdı (D-096'nın 90° D'daki
 * kırpması bunu gizliyordu).
 */
function simplifyWrappedArc(points: readonly LonLat[], toleranceKm: number): LonLat[] {
  const first = points[0]
  const last = points.at(-1)
  if (!first || !last || points.length <= 2) return [...points]
  const simple = simplifyArc(unwrapLongitudes(points), toleranceKm)
  return simple.map(([lon, lat], index) => {
    if (index === 0) return first
    if (index === simple.length - 1) return last
    return [wrapLongitude(lon), lat] as const
  })
}

/** Halka kutunun içinde mi (bütün noktaları). */
const ringWithin = (ring: Ring, [west, south, east, north]: LonLatBox) =>
  ring.every(([lon, lat]) => lon >= west && lon <= east && lat >= south && lat <= north)

/**
 * Bir birim kümesinin çokgenlerinden bölünen parçaları ayırır: dış halkası (en batısı [−180, 180)
 * aralığında) bir kutunun içinde olan çokgen o kodun, kalanlar ana kodundur.
 */
function splitParts(code: string, polygons: readonly Polygon[]): Map<string, Polygon[]> {
  const children = NATURAL_EARTH_PART_SPLITS[code] ?? {}
  const result = new Map<string, Polygon[]>([[code, []]])
  for (const child of Object.keys(children)) result.set(child, [])
  for (const polygon of polygons) {
    const outer = shiftRingWest(polygon[0] as Ring, -180)
    const owner =
      Object.entries(children).find(([, boxes]) =>
        boxes.some((box) => ringWithin(outer, box)),
      )?.[0] ?? code
    result.get(owner)?.push(polygon)
  }
  return result
}

/**
 * Ülkelerin bütün parçaları: sadeleşmiş (`simplify`; 0 ise sadeleşmez), 180. meridyende sürekli ve
 * tek dünya kopyasında (`placeOnOneWorldCopy`), kırpılmamış; boylam/enlem, yuvarlanmamış. Her ülkenin
 * birimleri ortak yaylarından birleştirilir (`topojson.merge`); bölünen birimlerin parçaları kendi
 * kodlarına ayrılır; enlemde yeniden bölünen çiftin (`NATURAL_EARTH_LATITUDE_SPLITS`) iki birimi
 * birleştirilip o enlemde kesilir. Ortak sınır tek yaydır ve onu kullanan birimlerin en küçük
 * toleransıyla bir kez sadeleşir: iki komşuda aynıdır, bir ülkenin sınırı kendi toleransından fazla
 * sapmaz. Bölünen birimin toleransı kodlarınınkilerin en küçüğüdür.
 */
export function countryParts(
  topology: WorldAtlasTopology,
  simplify: SimplifyTolerance = NATURAL_EARTH_PARAMS.simplifyKm,
): Record<string, Polygon[]> {
  const toleranceOf = typeof simplify === 'number' ? () => simplify : simplify
  const codes = Object.keys(NATURAL_EARTH_UNITS).sort()
  const arcTolerance = new Map<number, number>()
  const selected = new Map<string, WorldAtlasGeometry[]>()
  for (const code of codes) {
    const geometries = countryGeometries(topology, code)
    selected.set(code, geometries)
    const unitTolerance = Math.min(
      toleranceOf(code),
      ...Object.keys(NATURAL_EARTH_PART_SPLITS[code] ?? {}).map(toleranceOf),
    )
    const indices = new Set<number>()
    for (const geometry of geometries) arcIndices(geometry, indices)
    for (const index of indices) {
      arcTolerance.set(index, Math.min(arcTolerance.get(index) ?? Infinity, unitTolerance))
    }
  }
  // Yay sürekli kılınarak sadeleşir (180. meridyendeki sıçrama Douglas–Peucker'in kirişini bozmasın),
  // sonra world-atlas'ın aralığına döner; yaylar birleşince halka sürekli kılınır.
  const arcs = topology.arcs.map((arc, index) => {
    const tolerance = arcTolerance.get(index)
    return tolerance === undefined
      ? []
      : simplifyWrappedArc(decodeArc(arc, topology.transform), tolerance)
  })
  const simplified: TopojsonClient.Topology = {
    type: 'Topology',
    objects: topology.objects,
    arcs: arcs as (readonly (readonly [number, number])[])[],
  }
  const mergedPolygons = (geometries: readonly WorldAtlasGeometry[]): Polygon[] =>
    topojson
      .merge(simplified, [...geometries])
      .coordinates.map((polygon) =>
        polygon.map((ring) => unwrapLongitudes(ring.slice(0, -1) as LonLat[])),
      )
  const result: Record<string, Polygon[]> = {}
  for (const code of codes) {
    for (const [owner, parts] of splitParts(code, mergedPolygons(selected.get(code) ?? []))) {
      result[owner] = placeOnOneWorldCopy(parts)
    }
  }
  for (const { north, south, lat } of NATURAL_EARTH_LATITUDE_SPLITS) {
    const whole = mergedPolygons([...(selected.get(north) ?? []), ...(selected.get(south) ?? [])])
    result[north] = placeOnOneWorldCopy(clipPolygons(whole, [-180, lat, 180, 90]))
    result[south] = placeOnOneWorldCopy(clipPolygons(whole, [-180, -90, 180, lat]))
  }
  return result
}

/** Çokgenleri kutuya kırpar; dış halkası kutunun dışında kalan çokgen düşer. */
function clipPolygons(polygons: readonly Polygon[], box: LonLatBox): Polygon[] {
  const result: Polygon[] = []
  for (const [outer, ...holes] of polygons) {
    const clipped = outer ? clipRing(outer, box) : null
    if (!clipped) continue
    const rings: Ring[] = [clipped]
    for (const hole of holes) {
      const clippedHole = clipRing(hole, box)
      if (clippedHole) rings.push(clippedHole)
    }
    result.push(rings)
  }
  return result
}

/**
 * Ülkelerin poligonları, sadeleşmiş ve kırpılmış (`countryParts` + `roi`). Dış halkasının küre
 * üzerindeki alanı (`ringGeodesicAreaKm2`) `minPartKm2`'den küçük parça, ülkenin en büyük parçası
 * değilse düşer (Malta ve Bahreyn'in ana adası, Nauru, Shetland'in ana adası kalır; Abu Dabi adası
 * düşer).
 */
export function countryPolygons(
  topology: WorldAtlasTopology,
  simplify: SimplifyTolerance = fixtureTolerance(farCodes(topology, countryParts(topology, 0))),
): Record<string, Polygon[]> {
  const { roi, minPartKm2 } = NATURAL_EARTH_PARAMS
  const result: Record<string, Polygon[]> = {}
  for (const [code, parts] of Object.entries(countryParts(topology, simplify))) {
    const clipped = clipPolygons(parts, roi).map((polygon) => ({
      polygon,
      area: ringGeodesicAreaKm2(polygon[0] as Ring),
    }))
    const largest = clipped.reduce((max, part) => Math.max(max, part.area), 0)
    result[code] = clipped
      .filter((part) => part.area >= minPartKm2 || part.area === largest)
      .map((part) => part.polygon)
  }
  return result
}

/**
 * Ülkelerin yüzölçümü, km² (tam sayıya yuvarlı): bütün parçaların (sadeleşmeden, küçük adalar dahil)
 * küre üzerindeki alanı. Natural Earth'te göller ülke poligonunun içindedir.
 */
export function countryAreasKm2(
  rawParts: Readonly<Record<string, readonly Polygon[]>>,
): Record<string, number> {
  const areas: Record<string, number> = {}
  for (const [code, parts] of Object.entries(rawParts)) {
    areas[code] = Math.round(geodesicAreaKm2(parts))
  }
  return areas
}

/** Birimin kodu ve ondan bölünen parçaların kodları. */
const familyOf = (code: string) => [code, ...Object.keys(NATURAL_EARTH_PART_SPLITS[code] ?? {})]

/**
 * Türkiye'den uzak ülkeler, sıralı. Uzaklık Natural Earth birimine göredir (tolerans birimin
 * yaylarına uygulanır; bölünen parçalar birimlerinin uzaklığını taşır):
 * 1. birimin sadeleşmemiş bütün parçalarının her noktası `FAR_REFERENCE`'a (Ankara) `farFromKm`'den
 *    uzak (büyük daire; enlemde yeniden bölünen çiftte kodun kendi parçaları) ve
 * 2. yay paylaştığı her komşu birim de 1. koşulu sağlar. Uzaklıkla (1. koşulla) yakın bir ülkenin
 *    kara komşusu yakın sayılır: iki ülkenin ayrı kıyı yayları farklı toleransla sadeleşince dar bir
 *    koyda birbirine geçebilirdi (Hong Kong'un Shenzhen Körfezi kıyısı Çin'in kıyısını 0,4 km
 *    aşıyordu). Kural tek geçiştir: böyle yakın sayılan ülkenin komşusu uzak kalabilir (Kuzey Kore
 *    yakın, Güney Kore uzak; Tayland–Myanmar, Gambiya–Senegal, Guyana–Surinam gibi). Ülkelerin hiçbir
 *    yerde birbirine geçmediğini natural-earth.test.ts'nin "ülkeler örtüşmez" testi denetler.
 */
export function farCodes(
  topology: WorldAtlasTopology,
  rawParts: Readonly<Record<string, readonly Polygon[]>>,
): string[] {
  const units = Object.keys(NATURAL_EARTH_UNITS)
  const distant = new Set(
    units.filter((unit) =>
      familyOf(unit).every((code) => {
        for (const polygon of rawParts[code] ?? []) {
          for (const [lon, lat] of polygon[0] ?? []) {
            if (distanceKm(FAR_REFERENCE, { lat, lon }) < NATURAL_EARTH_PARAMS.farFromKm) {
              return false
            }
          }
        }
        return true
      }),
    ),
  )
  const owners = new Map<number, string[]>()
  for (const unit of units) {
    const indices = new Set<number>()
    for (const geometry of countryGeometries(topology, unit)) arcIndices(geometry, indices)
    for (const index of indices) owners.set(index, [...(owners.get(index) ?? []), unit])
  }
  const far = new Set(distant)
  for (const sharing of owners.values()) {
    if (sharing.some((unit) => !distant.has(unit))) {
      for (const unit of sharing) far.delete(unit)
    }
  }
  return [...far].flatMap(familyOf).sort()
}

/** Fixture'ın toleransı: uzak ülkeler `farSimplifyKm`, öbürleri `simplifyKm`. */
export function fixtureTolerance(far: readonly string[]): (code: string) => number {
  const set = new Set(far)
  return (code) =>
    set.has(code) ? NATURAL_EARTH_PARAMS.farSimplifyKm : NATURAL_EARTH_PARAMS.simplifyKm
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
  const raw = countryParts(topology, 0)
  const far = farCodes(topology, raw)
  const polygons = countryPolygons(topology, fixtureTolerance(far))
  const areas = countryAreasKm2(raw)
  const { quantumDeg, simplifyKm, farSimplifyKm, farFromKm, roi, minPartKm2 } = NATURAL_EARTH_PARAMS
  const countries: Record<string, number[][][]> = {}
  const areasKm2: Record<string, number> = {}
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
    areasKm2[code] = areas[code] ?? 0
  }
  return {
    source: NATURAL_EARTH_SOURCE,
    params: { simplifyKm, farSimplifyKm, farFromKm, quantumDeg, roi: [...roi], minPartKm2 },
    areasKm2,
    farCodes: far,
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
