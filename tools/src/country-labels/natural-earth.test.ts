import { distanceKm } from '@havayolu/geo'
import {
  COUNTRY_LABEL_CAPITAL_ANCHORS,
  UNLABELLED_COUNTRIES,
  countryName,
  type Locale,
} from '@havayolu/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  geodesicAreaKm2,
  mercatorX,
  mercatorY,
  ProjectedShape,
  ringGeodesicAreaKm2,
  type Polygon,
} from './geometry'
import { SAFETY_BUDGET } from './label-model'
import {
  buildFixture,
  countryGeometries,
  countryParts,
  countryPolygons,
  decodeFixture,
  FAR_REFERENCE,
  fixtureTolerance,
  NATURAL_EARTH_CODES,
  NATURAL_EARTH_LATITUDE_SPLITS,
  NATURAL_EARTH_PARAMS,
  NATURAL_EARTH_PART_SPLITS,
  NATURAL_EARTH_SOURCE,
  NATURAL_EARTH_UNASSIGNED,
  NATURAL_EARTH_UNITS,
  readFixture,
  readWorldAtlas,
  unitMatches,
  type NaturalEarthFixture,
  type WorldAtlasTopology,
} from './natural-earth'

let topology: WorldAtlasTopology
let fixture: NaturalEarthFixture
let raw: Record<string, Polygon[]>

beforeAll(() => {
  topology = readWorldAtlas()
  fixture = readFixture()
  raw = countryParts(topology, 0)
}, 60_000)

const shapes = () => {
  const decoded = decodeFixture(fixture)
  return new Map(
    Object.entries(decoded).map(([code, geometry]) => [code, new ProjectedShape(geometry)]),
  )
}

const containsPoint = (shape: ProjectedShape, lon: number, lat: number) =>
  shape.contains(mercatorX(lon), mercatorY(lat))

describe('Natural Earth fixture (D-096, D-100)', { timeout: 120_000 }, () => {
  it('commit’li fixture, node_modules’taki world-atlas 2.0.2’den yeniden üretilenle aynı (ağ yok)', () => {
    expect(fixture.source).toEqual(NATURAL_EARTH_SOURCE)
    expect(fixture.source).toMatchObject({ version: '4.1.0', file: 'countries-10m.json' })
    expect(fixture.params).toEqual({
      simplifyKm: 0.5,
      farSimplifyKm: 1,
      farFromKm: 5000,
      quantumDeg: 0.001,
      roi: [-200, -60, 200, 84],
      minPartKm2: 100,
    })
    expect(buildFixture(topology)).toEqual(fixture)
  })

  it('244 kod: ISO 3166-1 kodlu her birim ve bölünen deniz aşırı parçalar; İsrail, Filistin ve Antarktika yok', () => {
    const codes = Object.keys(fixture.countries)
    expect(codes).toHaveLength(244)
    expect(codes).toEqual(NATURAL_EARTH_CODES)
    expect(Object.keys(fixture.areasKm2)).toEqual(codes)
    for (const code of [...UNLABELLED_COUNTRIES, 'AQ']) expect(codes).not.toContain(code)
    for (const code of ['XK', 'EH', 'TW', 'GL', 'PR', 'NC', 'FO', 'GF', 'SJ', 'BQ', 'SS']) {
      expect(codes, code).toContain(code)
    }
  })

  it('her kodun adı Intl’de iki dilde var (kodun kendisi değil)', () => {
    for (const code of NATURAL_EARTH_CODES) {
      for (const locale of ['tr', 'en'] as Locale[]) {
        expect(countryName(code, locale), `${code} ${locale}`).not.toBe(code)
      }
    }
  })

  it('birim tablosu: her birim tam bir geometri; her geometri bir koda ya da gerekçeli olarak hiçbir koda', () => {
    const used = new Map<object, string>()
    const assign = (code: string, unit: string) => {
      const matches = topology.objects.countries.geometries.filter((g) => unitMatches(unit, g))
      expect(matches, `${code} ${unit}`).toHaveLength(1)
      const geometry = matches[0] as object
      expect(used.get(geometry), `${code} ${unit}`).toBeUndefined()
      used.set(geometry, code)
    }
    for (const [code, units] of Object.entries(NATURAL_EARTH_UNITS)) {
      for (const unit of units) assign(code, unit)
    }
    for (const unit of Object.keys(NATURAL_EARTH_UNASSIGNED)) assign('-', unit)
    expect(used.size).toBe(topology.objects.countries.geometries.length)
    expect(NATURAL_EARTH_UNITS.CY).toEqual([
      '196',
      'N. Cyprus',
      'Cyprus U.N. Buffer Zone',
      'Akrotiri',
      'Dhekelia',
    ])
    expect(NATURAL_EARTH_UNITS.KZ).toEqual(['398', 'Baikonur'])
    expect(NATURAL_EARTH_UNITS.CU).toEqual(['192', 'USNB Guantanamo Bay'])
    expect(NATURAL_EARTH_UNITS.SO).toEqual(['706', 'Somaliland'])
    expect(NATURAL_EARTH_UNITS.XK).toEqual(['Kosovo'])
    expect(NATURAL_EARTH_UNITS.RS).toEqual(['688'])
    expect(NATURAL_EARTH_UNITS.AU).toEqual(['Australia', 'Ashmore and Cartier Is.'])
    expect(Object.keys(NATURAL_EARTH_UNASSIGNED)).toEqual(
      expect.arrayContaining(['010', '275', '376']),
    )
  })

  it('kod, sayısal ISO kodunun CLDR’daki alpha-2 karşılığı (kimliksiz birimler adıyla)', () => {
    for (const [code, units] of Object.entries(NATURAL_EARTH_UNITS)) {
      const numeric = units.filter((unit) => /^\d{3}$/.test(unit))
      for (const unit of numeric) {
        expect(new Intl.Locale(`und-${unit}`).region, `${code} ${unit}`).toBe(code)
      }
      if (numeric.length === 0) expect(['AU', 'XK'], code).toContain(code)
    }
  })

  it('bölünen parçalar: Fransa, Norveç ve Hollanda Avrupa’da; deniz aşırı bölgeler kendi kodlarında', () => {
    const byCode = shapes()
    const inside = (code: string, lon: number, lat: number) =>
      containsPoint(byCode.get(code) as ProjectedShape, lon, lat)
    const box = (code: string) => (byCode.get(code) as ProjectedShape).bbox
    for (const [parent, children] of Object.entries(NATURAL_EARTH_PART_SPLITS)) {
      for (const child of Object.keys(children)) {
        expect(fixture.countries[child]?.length, `${parent} ${child}`).toBeGreaterThan(0)
      }
    }
    // Avrupa'daki topraklar: FR 5° B–10° D, NL 3–8° D, NO Svalbard'sız (en kuzeyi 71,2° K).
    const [frWest, , frEast] = box('FR')
    expect([frWest > mercatorX(-6), frEast < mercatorX(10)]).toEqual([true, true])
    expect(box('NO')[1]).toBeGreaterThan(mercatorY(71.5))
    expect(box('NL')[0]).toBeGreaterThan(mercatorX(3))
    expect(inside('GF', -52.5, 4.5)).toBe(true)
    expect(inside('SJ', 15.63, 78.22)).toBe(true)
    expect(inside('NO', 15.63, 78.22)).toBe(false)
    expect(inside('RE', 55.5, -21.1)).toBe(true)
    expect(inside('FR', 2.35, 48.86)).toBe(true)
  })

  it('Lefkoşa KIBRIS’ta; Kıbrıs tek ada; Sırbistan Kosova’sız; Kırım Natural Earth’teki gibi Rusya’da', () => {
    const byCode = shapes()
    const lefkosa = COUNTRY_LABEL_CAPITAL_ANCHORS.CY
    if (!lefkosa) throw new Error('CY')
    expect(containsPoint(byCode.get('CY') as ProjectedShape, lefkosa.lon, lefkosa.lat)).toBe(true)
    expect(fixture.countries.CY).toHaveLength(1)
    const pristina = { lon: 21.17, lat: 42.66 }
    expect(containsPoint(byCode.get('RS') as ProjectedShape, pristina.lon, pristina.lat)).toBe(
      false,
    )
    expect(containsPoint(byCode.get('XK') as ProjectedShape, pristina.lon, pristina.lat)).toBe(true)
    // Natural Earth 4.1.0 Kırım'ı Rusya'ya verir (fiilî durum; D-096'da yazılı, haritada çizilmez).
    const simferopol = { lon: 34.1, lat: 44.95 }
    expect(containsPoint(byCode.get('RU') as ProjectedShape, simferopol.lon, simferopol.lat)).toBe(
      true,
    )
    expect(containsPoint(byCode.get('UA') as ProjectedShape, simferopol.lon, simferopol.lat)).toBe(
      false,
    )
  })

  it('Batı Sahra (D-100): Fas ve Batı Sahra 27°40′ K’de bölünür; Layun, Semara ve Dahla Batı Sahra’da, Rabat ve Tantan Fas’ta; ortak kenar aynı', () => {
    const lat = 27 + 40 / 60
    expect(NATURAL_EARTH_LATITUDE_SPLITS).toEqual([{ north: 'MA', south: 'EH', lat }])
    const byCode = shapes()
    const inside = (code: string, lon: number, lat: number) =>
      containsPoint(byCode.get(code) as ProjectedShape, lon, lat)
    // Natural Earth 4.1.0'da (Berm sınırı) bunların ilk dördü Fas'tadır.
    for (const [name, [lon, at]] of Object.entries({
      laayoune: [-13.2, 27.15],
      smara: [-11.66, 26.74],
      boujdour: [-14.49, 26.13],
      dakhla: [-15.6, 24.0],
      birLahlou: [-9.57, 26.35],
      tifariti: [-10.57, 26.09],
    } as const)) {
      expect(inside('EH', lon, at), name).toBe(true)
      expect(inside('MA', lon, at), name).toBe(false)
    }
    for (const [name, [lon, at]] of Object.entries({
      rabat: [-6.84, 34.02],
      tanTan: [-11.1, 28.44],
    } as const)) {
      expect(inside('MA', lon, at), name).toBe(true)
      expect(inside('EH', lon, at), name).toBe(false)
    }
    const decoded = decodeFixture(fixture)
    const lats = (code: string) => (decoded[code] ?? []).flat(2).map(([, y]) => y)
    expect(Math.min(...lats('MA'))).toBe(27.667)
    expect(Math.max(...lats('EH'))).toBe(27.667)
    // Bölünmüş iki ülke: Fas ~414 bin, Batı Sahra ~269 bin km²; ikisi de kademe 2.
    expect(fixture.areasKm2.MA).toBeGreaterThan(400_000)
    expect(fixture.areasKm2.MA).toBeLessThan(430_000)
    expect(fixture.areasKm2.EH).toBeGreaterThan(260_000)
    expect(fixture.areasKm2.EH).toBeLessThan(280_000)
    // Ortak kenar: Fas'ın 27,667° K'deki noktaları Batı Sahra'nınkilerle aynı.
    const edge = (code: string) =>
      (decoded[code] ?? [])
        .flat(2)
        .filter(([, y]) => y === 27.667)
        .map(([x]) => x)
        .toSorted((a, b) => a - b)
    expect(edge('MA')).toEqual(edge('EH'))
    expect(edge('MA').length).toBeGreaterThanOrEqual(2)
  })

  it('küçük adalar küre üzerindeki alanla elenir (D-100): Shetland’in ana adası (917 km²) Birleşik Krallık’ta, Mansel Adası Kanada’da', () => {
    const byCode = shapes()
    expect(containsPoint(byCode.get('GB') as ProjectedShape, -1.3, 60.3)).toBe(true)
    expect(containsPoint(byCode.get('CA') as ProjectedShape, -80, 62)).toBe(true)
  })

  it('180. meridyen: ülkeler tek dünya kopyasında sürekli; en uzun kenar ABD–Kanada sınırı (49° K)', () => {
    // world-atlas yayları 180. meridyende −180'den 180'e sıçrar; sürekli kılınmasa Rusya'nın halkası
    // bütün haritayı kesen kenarlar bırakırdı. Yaylar dikilmeden önce world-atlas'ın aralığına dönmese
    // Uzak Doğu Çukotka'dan Kore sınırına uzanan tek bir kenarla kapanırdı (49° boylam).
    const edges: [number, string][] = []
    const spans = new Map<string, [number, number]>()
    for (const [code, geometry] of Object.entries(decodeFixture(fixture))) {
      let west = Infinity
      let east = -Infinity
      for (const polygon of geometry) {
        for (const ring of polygon) {
          for (const [i, [lon, lat]] of ring.entries()) {
            west = Math.min(west, lon)
            east = Math.max(east, lon)
            const [next] = ring[(i + 1) % ring.length] as readonly [number, number]
            if (Math.abs(next - lon) > 6) edges.push([Math.abs(next - lon), `${code} ${lat}`])
          }
        }
      }
      spans.set(code, [west, east])
    }
    edges.sort((a, b) => b[0] - a[0])
    expect(edges.map(([span, where]) => [Math.round(span * 10) / 10, where])).toEqual([
      [27.6, 'CA 48.993'],
      [27.6, 'US 48.993'],
      [6.3, 'EG 21.994'],
      [6.3, 'SD 21.996'],
    ])
    expect(spans.get('RU')).toEqual([19.611, 190.357])
    expect(spans.get('US')).toEqual([-187.524, -66.977])
    expect(spans.get('FJ')).toEqual([177.253, 180.184])
    expect(spans.get('NZ')).toEqual([165.888, 183.83])
    const byCode = shapes()
    const ru = byCode.get('RU') as ProjectedShape
    const us = byCode.get('US') as ProjectedShape
    // Rusya: Çukotka, 180. meridyenin doğusu da (172° B = 188° D), Rusya'da; İskandinavya ve deniz
    // değil.
    for (const [name, [lon, lat]] of Object.entries({
      chukotka: [172, 66.5],
      bilibino: [166.4, 68.06],
      chukotkaEast: [188, 66],
      murmansk: [33.08, 68.97],
      pechora: [57.2, 65.12],
      khabarovsk: [135.07, 48.48],
      primorye: [133, 45],
      yakutsk: [129.7, 62.0],
    } as const)) {
      expect(containsPoint(ru, lon, lat), name).toBe(true)
    }
    for (const [name, [lon, lat]] of Object.entries({
      kiruna: [20.22, 67.85],
      rovaniemi: [25.73, 66.5],
      norwegianSea: [5, 67],
      seaOfJapan: [135, 40],
      beringSea: [185, 58],
    } as const)) {
      expect(containsPoint(ru, lon, lat), name).toBe(false)
    }
    // ABD: Attu (173,2° D) Alaska'nın batısında, 186,8° B'da.
    expect(containsPoint(us, -186.8, 52.88)).toBe(true)
    expect(containsPoint(us, -98, 40)).toBe(true)
  })

  it('ülkeler örtüşmez: hiçbir ülkenin sınır noktası başka bir ülkenin 10 m’den derin içinde değil', () => {
    const byCode = shapes()
    const decoded = decodeFixture(fixture)
    const entries = [...byCode.entries()]
    let checked = 0
    for (const [code, geometry] of Object.entries(decoded)) {
      const own = byCode.get(code) as ProjectedShape
      const others = entries.filter(([other, shape]) => {
        if (other === code) return false
        const [ax1, ay1, ax2, ay2] = own.bbox
        const [bx1, by1, bx2, by2] = shape.bbox
        return ax1 <= bx2 && bx1 <= ax2 && ay1 <= by2 && by1 <= ay2
      })
      for (const polygon of geometry) {
        for (const ring of polygon) {
          for (const [lon, lat] of ring) {
            for (const [other, shape] of others) {
              if (!containsPoint(shape, lon, lat)) continue
              checked++
              expect(
                shape.distanceToBoundaryKm(lon, lat),
                `${code} in ${other} ${lon},${lat}`,
              ).toBeLessThan(0.01)
            }
          }
        }
      }
    }
    // Ortak sınırın noktaları komşunun sınırının üstündedir (çift-tek kuralı yarısını içeride sayar).
    expect(checked).toBeGreaterThan(1_000)
  })

  it('halkalar binde bir derece tamsayı, en az üç nokta; kırpma kutusu hiçbir şeyi kesmez', () => {
    const [west, south, east, north] = NATURAL_EARTH_PARAMS.roi
    for (const [code, geometry] of Object.entries(decodeFixture(fixture))) {
      for (const polygon of geometry) {
        for (const ring of polygon) {
          expect(ring.length, code).toBeGreaterThanOrEqual(3)
          for (const [lon, lat] of ring) {
            expect(Math.round(lon * 1000) / 1000).toBe(lon)
            // Kutunun kenarında nokta yok: kırpma yapay kenar eklemedi.
            expect(lon > west && lon < east && lat > south && lat < north, code).toBe(true)
          }
        }
      }
    }
    for (const parts of Object.values(fixture.countries)) {
      for (const rings of parts) {
        for (const ring of rings)
          for (const value of ring) expect(Number.isInteger(value)).toBe(true)
      }
    }
  })

  it('uzak ülkeler (D-100): her noktası Ankara’ya ≥ 5.000 km ve kara komşuları da öyle; ABD, Japonya, Arjantin uzak; Rusya, Çin, Grönland yakın; Hong Kong ve Kuzey Kore (Çin’in komşusu) ile Brezilya (Fransız Guyanası’nın komşusu) ≥ 5.000 km olduğu hâlde yakın', () => {
    expect(fixture.farCodes).toHaveLength(106)
    expect(fixture.farCodes).toEqual(fixture.farCodes.toSorted())
    for (const code of ['US', 'AU', 'JP', 'ZA', 'CA', 'NZ', 'KR', 'AR']) {
      expect(fixture.farCodes, code).toContain(code)
    }
    // Fransız Guyanası Fransa biriminin parçasıdır: Fransa yakın, o da yakın (aynı yaylar); onunla
    // sınırı olan Brezilya da yakın sayılır.
    for (const code of ['RU', 'CN', 'IN', 'GL', 'NO', 'SJ', 'TR', 'ET', 'GF', 'BR', 'HK', 'KP']) {
      expect(fixture.farCodes, code).not.toContain(code)
    }
    const nearestKm = (code: string) => {
      let nearest = Infinity
      for (const polygon of raw[code] ?? []) {
        for (const [lon, lat] of polygon[0] ?? []) {
          nearest = Math.min(nearest, distanceKm(FAR_REFERENCE, { lat, lon }))
        }
      }
      return nearest
    }
    for (const code of fixture.farCodes) expect(nearestKm(code), code).toBeGreaterThanOrEqual(5000)
    // Uzak olduğu hâlde yakın sayılanlar: yakın bir birimle kara sınırı var (Hong Kong ve Kuzey Kore
    // Çin'le, Brezilya Fransa'nın Guyana'sıyla). Ülkelerin örtüşmediğini yukarıdaki test denetler.
    for (const code of ['HK', 'KP', 'BR'])
      expect(nearestKm(code), code).toBeGreaterThanOrEqual(5000)
    // Komşu koşulu doğrudan (farCodes'un 2. kuralı): uzak bir birimle yay paylaşan her birimin
    // (deniz aşırı parçalarıyla) her noktası da Ankara'ya ≥ 5.000 km.
    const arcsOf = (unit: string) => {
      const arcs = new Set<number>()
      const visit = (value: unknown): void => {
        if (typeof value === 'number') arcs.add(value < 0 ? ~value : value)
        else if (Array.isArray(value)) for (const item of value) visit(item)
      }
      for (const geometry of countryGeometries(topology, unit)) visit(geometry.arcs)
      return arcs
    }
    const units = Object.keys(NATURAL_EARTH_UNITS)
    const unitArcs = new Map(units.map((unit) => [unit, arcsOf(unit)]))
    const family = (unit: string) => [unit, ...Object.keys(NATURAL_EARTH_PART_SPLITS[unit] ?? {})]
    let pairs = 0
    for (const unit of units.filter((candidate) => fixture.farCodes.includes(candidate))) {
      const arcs = unitArcs.get(unit) ?? new Set<number>()
      for (const other of units) {
        if (other === unit || ![...(unitArcs.get(other) ?? [])].some((arc) => arcs.has(arc)))
          continue
        pairs++
        for (const code of family(other)) {
          expect(nearestKm(code), `${unit}–${other}`).toBeGreaterThanOrEqual(5000)
        }
      }
    }
    expect(pairs).toBeGreaterThan(50)
  })

  it('yüzölçümü: bütün parçaların küre üzerindeki alanı; Türkiye D-095 tablosundan %1 içinde', () => {
    for (const code of NATURAL_EARTH_CODES) {
      expect(fixture.areasKm2[code], code).toBe(Math.round(geodesicAreaKm2(raw[code] ?? [])))
    }
    expect(Math.abs((fixture.areasKm2.TR as number) / 783_600 - 1)).toBeLessThan(0.01)
    expect(Math.abs((fixture.areasKm2.BR as number) / 8_515_800 - 1)).toBeLessThan(0.01)
    expect(Math.abs((fixture.areasKm2.AU as number) / 7_692_000 - 1)).toBeLessThan(0.01)
  })

  it('sapma bütçesi: ham 1:10m sınırın her noktası fixture sınırına en çok kendi toleransı + yuvarlama kadar uzak', () => {
    const rawClipped = countryPolygons(topology, 0)
    const tolerance = fixtureTolerance(fixture.farCodes)
    const byCode = shapes()
    let checked = 0
    let worstNear = 0
    let worstFar = 0
    for (const code of NATURAL_EARTH_CODES) {
      const shape = byCode.get(code) as ProjectedShape
      const limit = tolerance(code) + SAFETY_BUDGET.fixtureQuantumKm
      const single = (raw[code] ?? []).length === 1
      for (const polygon of rawClipped[code] ?? []) {
        const outer = polygon[0]
        if (!outer) continue
        // Eşiğe yakın küçük adalar sayılmaz: ham ve sade alanı farklı düşebilir, küçük adalardan
        // oluşan ülkede en büyüğü sadeleşince başka ada olabilir (Marshall Adaları).
        if (!single && ringGeodesicAreaKm2(outer) < 1.5 * NATURAL_EARTH_PARAMS.minPartKm2) continue
        for (const ring of polygon) {
          // world-atlas'ın nicelemesinde alanı sıfıra inen halka (Vatikan deliği) fixture'da yoktur.
          if (ringGeodesicAreaKm2(ring) < 0.01) continue
          for (const [lon, lat] of ring) {
            const distance = shape.distanceToBoundaryKm(lon, lat)
            if (fixture.farCodes.includes(code)) worstFar = Math.max(worstFar, distance)
            else worstNear = Math.max(worstNear, distance)
            checked++
            expect(distance, `${code} ${lon},${lat}`).toBeLessThanOrEqual(limit)
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(400_000)
    expect(worstNear).toBeGreaterThan(NATURAL_EARTH_PARAMS.simplifyKm * 0.8)
    expect(worstFar).toBeGreaterThan(NATURAL_EARTH_PARAMS.farSimplifyKm * 0.8)
  }, 300_000)
})
