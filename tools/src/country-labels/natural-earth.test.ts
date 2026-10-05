import { COUNTRY_CAPITALS, UNLABELLED_COUNTRIES } from '@havayolu/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import { mercatorX, mercatorY, ProjectedShape, ringAreaKm2, ringContains } from './geometry'
import { SAFETY_BUDGET } from './label-model'
import {
  buildFixture,
  countryPolygons,
  decodeFixture,
  NATURAL_EARTH_PARAMS,
  NATURAL_EARTH_SOURCE,
  NATURAL_EARTH_UNITS,
  readFixture,
  readWorldAtlas,
  unitMatches,
  type NaturalEarthFixture,
  type WorldAtlasTopology,
} from './natural-earth'

let topology: WorldAtlasTopology
let fixture: NaturalEarthFixture

beforeAll(() => {
  topology = readWorldAtlas()
  fixture = readFixture()
})

const shapes = () => {
  const decoded = decodeFixture(fixture)
  return new Map(
    Object.entries(decoded).map(([code, geometry]) => [code, new ProjectedShape(geometry)]),
  )
}

const containsPoint = (shape: ProjectedShape, lon: number, lat: number) =>
  shape.contains(mercatorX(lon), mercatorY(lat))

describe('Natural Earth fixture (D-096)', { timeout: 60_000 }, () => {
  it('commit’li fixture, node_modules’taki world-atlas 2.0.2’den yeniden üretilenle aynı (ağ yok)', () => {
    expect(fixture.source).toEqual(NATURAL_EARTH_SOURCE)
    expect(fixture.source).toMatchObject({ version: '4.1.0', file: 'countries-10m.json' })
    expect(fixture.params).toEqual({
      simplifyKm: 0.5,
      quantumDeg: 0.001,
      roi: [-20, 8, 90, 72],
      minPartKm2: 100,
    })
    expect(buildFixture(topology)).toEqual(fixture)
  }, 60_000)

  it('59 ülke, başkentlerin kodları; İsrail ve Filistin yok', () => {
    const codes = Object.keys(fixture.countries)
    expect(codes).toEqual(COUNTRY_CAPITALS.map((capital) => capital.code))
    expect(Object.keys(NATURAL_EARTH_UNITS)).toEqual(codes)
    for (const code of UNLABELLED_COUNTRIES) expect(codes).not.toContain(code)
  })

  it('birim tablosu: her birim tam bir Natural Earth geometrisi; hiçbir geometri iki kez kullanılmaz', () => {
    const used = new Map<object, string>()
    for (const [code, units] of Object.entries(NATURAL_EARTH_UNITS)) {
      for (const unit of units) {
        const matches = topology.objects.countries.geometries.filter((g) => unitMatches(unit, g))
        expect(matches, `${code} ${unit}`).toHaveLength(1)
        const geometry = matches[0] as object
        expect(used.get(geometry), `${code} ${unit}`).toBeUndefined()
        used.set(geometry, code)
      }
    }
    expect(NATURAL_EARTH_UNITS.CY).toEqual([
      '196',
      'N. Cyprus',
      'Cyprus U.N. Buffer Zone',
      'Akrotiri',
      'Dhekelia',
    ])
    expect(NATURAL_EARTH_UNITS.KZ).toEqual(['398', 'Baikonur'])
    expect(NATURAL_EARTH_UNITS.XK).toEqual(['Kosovo'])
    expect(NATURAL_EARTH_UNITS.RS).toEqual(['688'])
  })

  it('her başkent kendi ülkesinin poligonunda; Kıbrıs tek ada; Sırbistan Kosova’sız', () => {
    const byCode = shapes()
    for (const capital of COUNTRY_CAPITALS) {
      const shape = byCode.get(capital.code)
      if (!shape) throw new Error(capital.code)
      expect(containsPoint(shape, capital.lon, capital.lat), capital.code).toBe(true)
    }
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

  it('180. meridyen: hiçbir kenar 20° boylamdan uzun değil; Rusya İskandinavya’yı ve denizi içermez', () => {
    // world-atlas'ın küresel halkaları 180. meridyende −180'den 180'e sıçrar; sürekli kılınmasa
    // Rusya'nın halkası 90° D'da kırpılınca 20° B'ya uzanan bir şerit (65–69° K) ve Wrangel'den bir
    // dilim (71° K) bırakırdı. En uzun kenarlar Mısır–Sudan sınırı (22° K, 6,3°) ve Rusya'nın 72° K
    // kırpması (7,5°) kadardır.
    let longest = 0
    for (const [code, geometry] of Object.entries(decodeFixture(fixture))) {
      for (const polygon of geometry) {
        for (const ring of polygon) {
          for (const [i, [lon]] of ring.entries()) {
            const [next] = ring[(i + 1) % ring.length] as readonly [number, number]
            const span = Math.abs(next - lon)
            longest = Math.max(longest, span)
            expect(span, `${code} ${lon}`).toBeLessThan(20)
          }
        }
      }
    }
    expect(longest).toBeGreaterThan(5)
    const byCode = shapes()
    const ru = byCode.get('RU') as ProjectedShape
    const se = byCode.get('SE') as ProjectedShape
    const outside = {
      kiruna: [20.22, 67.85],
      rovaniemi: [25.73, 66.5],
      norwegianSea: [5, 67],
      barentsSea: [40, 71.2],
    } as const
    for (const [name, [lon, lat]] of Object.entries(outside)) {
      expect(containsPoint(ru, lon, lat), name).toBe(false)
    }
    expect(containsPoint(se, ...outside.kiruna)).toBe(true)
    const inside = {
      murmansk: [33.08, 68.97],
      pechora: [57.2, 65.12],
      vorkuta: [64, 67.5],
    } as const
    for (const [name, [lon, lat]] of Object.entries(inside)) {
      expect(containsPoint(ru, lon, lat), name).toBe(true)
    }
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
    expect(checked).toBeGreaterThan(100)
  }, 60_000)

  it('halkalar binde bir derece tamsayı, en az üç nokta; kırpma kutusunun içinde', () => {
    const [west, south, east, north] = NATURAL_EARTH_PARAMS.roi
    for (const [code, geometry] of Object.entries(decodeFixture(fixture))) {
      for (const polygon of geometry) {
        for (const ring of polygon) {
          expect(ring.length, code).toBeGreaterThanOrEqual(3)
          for (const [lon, lat] of ring) {
            expect(Math.round(lon * 1000) / 1000).toBe(lon)
            expect(lon >= west && lon <= east && lat >= south && lat <= north, code).toBe(true)
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

  it('sapma bütçesi: ham 1:10m sınırın her noktası fixture sınırına en çok sadeleştirme + yuvarlama kadar uzak', () => {
    const raw = countryPolygons(topology, 0)
    const byCode = shapes()
    const limit = NATURAL_EARTH_PARAMS.simplifyKm + SAFETY_BUDGET.fixtureQuantumKm
    let checked = 0
    let worst = 0
    for (const capital of COUNTRY_CAPITALS) {
      const shape = byCode.get(capital.code) as ProjectedShape
      for (const polygon of raw[capital.code] ?? []) {
        const outer = polygon[0]
        if (!outer) continue
        // Eşiğe yakın küçük adalar (ham ve sade alanı farklı düşebilir) sayılmaz.
        const kept =
          ringAreaKm2(outer) >= 1.5 * NATURAL_EARTH_PARAMS.minPartKm2 ||
          ringContains(outer, capital.lon, capital.lat)
        if (!kept) continue
        for (const ring of polygon) {
          // world-atlas'ın nicelemesinde alanı sıfıra inen halka (Vatikan deliği) fixture'da yoktur.
          if (ringAreaKm2(ring) < 0.01) continue
          for (const [lon, lat] of ring) {
            const distance = shape.distanceToBoundaryKm(lon, lat)
            worst = Math.max(worst, distance)
            checked++
            expect(distance, `${capital.code} ${lon},${lat}`).toBeLessThanOrEqual(limit)
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(50_000)
    expect(worst).toBeGreaterThan(NATURAL_EARTH_PARAMS.simplifyKm * 0.8)
  }, 120_000)
})
