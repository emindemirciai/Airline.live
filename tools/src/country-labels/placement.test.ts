/**
 * Ülke adlarının yerleşim tablosu (D-096): commit'li `COUNTRY_LABEL_PLACEMENTS` fixture'dan yeniden
 * hesaplanır (sürüklenme); her yazılan adın görünür kutusu, ilk yakınlaştırmasından z8'e kadar her
 * yakınlaştırmada kendi ülkesinin içindedir; adlar örtüşmez; çapa kuralı tutar; e2e'nin beklentileri
 * tabloyla uyuşur.
 */
import { readFileSync } from 'node:fs'
import { distanceKm } from '@havayolu/geo'
import {
  COUNTRY_CAPITALS,
  COUNTRY_LABEL_FADE_START_ZOOM,
  COUNTRY_LABEL_MAX_ZOOM,
  COUNTRY_LABEL_MIN_ZOOM,
  COUNTRY_LABEL_PLACEMENT_PARAMS,
  COUNTRY_LABEL_PLACEMENTS,
  countryLabelLines,
  countryLabelSizeAt,
  countryLabelTier,
  type CountryLabelPlacement,
  type Locale,
} from '@havayolu/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  IKA_PIN_Z5,
  IRAN_Z5_BOX,
  TEHRAN_COUNTRY_LABELS,
} from '../../../e2e/country-label-expectations'
import { mercatorX, mercatorY, ProjectedShape } from './geometry'
import { labelInkBox, LabelFitter, ONE_EM, visibleBoxPx, type LabelLayout } from './label-model'
import { decodeFixture, readFixture } from './natural-earth'
import {
  CANDIDATE_TOLERANCE_ZOOMS,
  CAPITAL_PREFERENCE_ZOOMS,
  computePlacements,
  namesFromTable,
  PLACEMENT_COMBOS,
  PLACEMENT_PARAMS,
  type CountryPlacementDetail,
} from './placement'

let result: ReturnType<typeof computePlacements>
let shapes: Map<string, ProjectedShape>

beforeAll(() => {
  const geometries = decodeFixture(readFixture())
  shapes = new Map(
    Object.entries(geometries).map(([code, geometry]) => [code, new ProjectedShape(geometry)]),
  )
  result = computePlacements(geometries, namesFromTable(COUNTRY_LABEL_PLACEMENTS))
}, 60_000)

const capitalOf = (code: string) => {
  const capital = COUNTRY_CAPITALS.find((candidate) => candidate.code === code)
  if (!capital) throw new Error(code)
  return capital
}

interface Shown {
  code: string
  locale: Locale
  layout: LabelLayout
  name: string
  lines: string[]
  lon: number
  lat: number
  fitZoom: number
}

/** Bir bileşimde yazılan adlar. */
function shownLabels(locale: Locale, layout: LabelLayout): Shown[] {
  const shown: Shown[] = []
  for (const [code, row] of Object.entries(COUNTRY_LABEL_PLACEMENTS[locale])) {
    const placement = row[layout]
    if (!placement) continue
    const [lon, lat, fitZoom] = placement
    shown.push({
      code,
      locale,
      layout,
      name: row.name,
      lines: countryLabelLines(row.name, locale),
      lon,
      lat,
      fitZoom,
    })
  }
  return shown
}

const ALL_SHOWN = PLACEMENT_COMBOS.flatMap(({ locale, layout }) => shownLabels(locale, layout))

const fitterFor = (label: Shown) =>
  new LabelFitter(
    shapes.get(label.code) as ProjectedShape,
    label.lines,
    countryLabelTier(capitalOf(label.code)),
    label.layout,
  )

type Box = readonly [x1: number, y1: number, x2: number, y2: number]

/** Görünür kutu (güvenlik payı yok), z'deki dünya pikseliyle. */
function worldBox(label: Shown, zoom: number): Box {
  const tier = countryLabelTier(capitalOf(label.code))
  const box = visibleBoxPx(
    labelInkBox(label.lines),
    countryLabelSizeAt(tier, label.layout === 'compact', zoom),
  )
  const scale = 2 ** zoom
  const x = mercatorX(label.lon) * scale
  const y = mercatorY(label.lat) * scale
  return [x + box.left, y + box.top, x + box.right, y + box.bottom]
}

const overlaps = (a: Box, b: Box) => a[0] <= b[2] && a[1] <= b[3] && a[2] >= b[0] && a[3] >= b[1]

/** Çapanın görünüm merkezine göre px konumu. */
function screenOffset(
  lon: number,
  lat: number,
  centre: { lon: number; lat: number },
  zoom: number,
) {
  const scale = 2 ** zoom
  return {
    x: (mercatorX(lon) - mercatorX(centre.lon)) * scale,
    y: (mercatorY(lat) - mercatorY(centre.lat)) * scale,
  }
}

/** Görünümde (merkez, genişlik × yükseklik) çapası olan ve z'de yazılan adların kodları. */
function visibleCodes(
  locale: Locale,
  layout: LabelLayout,
  centre: { lon: number; lat: number },
  zoom: number,
  width: number,
  height: number,
): string[] {
  return shownLabels(locale, layout)
    .filter((label) => {
      const offset = screenOffset(label.lon, label.lat, centre, zoom)
      return (
        label.fitZoom <= zoom && Math.abs(offset.x) <= width / 2 && Math.abs(offset.y) <= height / 2
      )
    })
    .map((label) => label.code)
    .sort()
}

const ZOOM_EPSILON = 1e-9

describe('yerleşim tablosu (D-096)', () => {
  it('sürüklenme: commit’li tablo, commit’li fixture ve adlarından yeniden hesaplananla aynı', () => {
    expect(result.table).toEqual(COUNTRY_LABEL_PLACEMENTS)
    expect(PLACEMENT_PARAMS).toEqual(COUNTRY_LABEL_PLACEMENT_PARAMS)
    expect(COUNTRY_LABEL_PLACEMENT_PARAMS).toMatchObject({
      naturalEarth: '4.1.0 1:10m',
      worldAtlas: '2.0.2',
      safetyPx: 3,
      safetyKm: 2,
      capitalPreferenceZooms: CAPITAL_PREFERENCE_ZOOMS,
      candidateToleranceZooms: CANDIDATE_TOLERANCE_ZOOMS,
    })
  })

  it('hiç sığmayan adlar dört bileşimde de Bahreyn, Lüksemburg ve Malta', () => {
    for (const { locale, layout } of PLACEMENT_COMBOS) {
      const never = Object.entries(COUNTRY_LABEL_PLACEMENTS[locale])
        .filter(([, row]) => row[layout] === null)
        .map(([code]) => code)
      expect(never, `${locale} ${layout}`).toEqual(['BH', 'LU', 'MT'])
      expect(shownLabels(locale, layout)).toHaveLength(56)
    }
  })

  it('değerler: ilk yakınlaştırma 0,25 ızgarasında, [kademenin en küçüğü, 7); çapa 0,01°', () => {
    for (const label of ALL_SHOWN) {
      const tier = countryLabelTier(capitalOf(label.code))
      const where = `${label.code} ${label.locale} ${label.layout}`
      expect(label.fitZoom * 4, where).toBe(Math.round(label.fitZoom * 4))
      expect(label.fitZoom, where).toBeGreaterThanOrEqual(COUNTRY_LABEL_MIN_ZOOM[tier])
      expect(label.fitZoom, where).toBeLessThan(COUNTRY_LABEL_FADE_START_ZOOM)
      expect(Math.round(label.lon * 100) / 100, where).toBe(label.lon)
      expect(Math.round(label.lat * 100) / 100, where).toBe(label.lat)
    }
  })

  it('içerme ve süreklilik: her adın kutusu ilk yakınlaştırmasından z7,95’e kadar (0,05 adım) ülkesinin içinde', () => {
    let checks = 0
    for (const label of ALL_SHOWN) {
      const fitter = fitterFor(label)
      for (let zoom = label.fitZoom; zoom < COUNTRY_LABEL_MAX_ZOOM - ZOOM_EPSILON; zoom += 0.05) {
        checks++
        expect(
          fitter.fitsAtZoom(label.lon, label.lat, zoom),
          `${label.code} ${label.locale} ${label.layout} z${zoom.toFixed(2)}`,
        ).toBe(true)
      }
    }
    expect(checks).toBeGreaterThan(10_000)
  })

  it('en küçüklük: ilk yakınlaştırma kademenin en küçüğü değilse ad bir adım önce sığmaz', () => {
    for (const label of ALL_SHOWN) {
      const tier = countryLabelTier(capitalOf(label.code))
      if (label.fitZoom <= COUNTRY_LABEL_MIN_ZOOM[tier]) continue
      expect(
        fitterFor(label).fitsAtZoom(label.lon, label.lat, label.fitZoom - 0.25),
        `${label.code} ${label.locale} ${label.layout}`,
      ).toBe(false)
    }
  })

  it('çapa kuralı: başkent her bileşimde en erkenin ≤ 0,5 gerisindeyse başkent; değilse dört bileşimde de en erkenin ≤ 0,25 gerisinde, başkente en yakın ortak nokta', () => {
    const byKind = (kind: CountryPlacementDetail['kind']) =>
      result.details.filter((detail) => detail.kind === kind).map((detail) => detail.code)
    for (const detail of result.details) {
      const capital = capitalOf(detail.code)
      const capitalOk = detail.capitalFitZooms.map(
        (zoom, k) =>
          detail.bestFitZooms[k] === Infinity ||
          zoom <= (detail.bestFitZooms[k] as number) + CAPITAL_PREFERENCE_ZOOMS,
      )
      const anchors = detail.placements.filter(
        (placement): placement is NonNullable<CountryLabelPlacement> => placement !== null,
      )
      if (detail.kind === 'capital') {
        expect(capitalOk.every(Boolean), detail.code).toBe(true)
        for (const [lon, lat] of anchors) expect([lon, lat]).toEqual([capital.lon, capital.lat])
      } else {
        expect(capitalOk.every(Boolean), detail.code).toBe(false)
        const keys = new Set(anchors.map(([lon, lat]) => `${lon},${lat}`))
        expect(keys.size, detail.code).toBe(1)
        expect(keys.has(`${capital.lon},${capital.lat}`), detail.code).toBe(false)
        for (const [k, placement] of detail.placements.entries()) {
          if (!placement) continue
          expect(placement[2], `${detail.code} ${k}`).toBeLessThanOrEqual(
            (detail.bestFitZooms[k] as number) + CANDIDATE_TOLERANCE_ZOOMS,
          )
        }
      }
    }
    expect(byKind('per-combination')).toEqual([])
    expect(byKind('capital')).toEqual([
      'AM',
      'BE',
      'BH',
      'CY',
      'CZ',
      'ES',
      'FR',
      'GE',
      'KZ',
      'LU',
      'MT',
      'RU',
      'SD',
      'SI',
      'UA',
    ])
  })

  it('başkentten kayma: ortanca ve en uzak (km)', () => {
    const moves = result.details
      .filter((detail) => detail.kind === 'shared')
      .map((detail) => {
        const anchor = detail.placements.find((placement) => placement !== null)
        if (!anchor) throw new Error(detail.code)
        return distanceKm({ lon: anchor[0], lat: anchor[1] }, capitalOf(detail.code))
      })
      .sort((a, b) => a - b)
    expect(moves).toHaveLength(44)
    expect(moves[Math.floor(moves.length / 2)]).toBeLessThan(120)
    expect(moves.at(-1)).toBeLessThan(700)
  })

  it('örtüşme yok: bir bileşimde yazılan adların görünür kutuları her yakınlaştırmada ayrık', () => {
    for (const { locale, layout } of PLACEMENT_COMBOS) {
      const labels = shownLabels(locale, layout)
      for (let zoom = 3; zoom < COUNTRY_LABEL_MAX_ZOOM; zoom += 0.25) {
        const boxes = labels
          .filter((label) => label.fitZoom <= zoom)
          .map((label) => [label.code, worldBox(label, zoom)] as const)
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const [a, boxA] = boxes[i] as (typeof boxes)[number]
            const [b, boxB] = boxes[j] as (typeof boxes)[number]
            expect(overlaps(boxA, boxB), `${a}/${b} ${locale} ${layout} z${zoom}`).toBe(false)
          }
        }
      }
    }
  })

  it('Kırım: Rusya ve Ukrayna adlarının kutusu hiçbir yakınlaştırmada Kırım’a girmez', () => {
    // Natural Earth 4.1.0 Kırım'ı Rusya'ya verir; ad orada yazılmaz (D-096).
    for (const label of ALL_SHOWN.filter((candidate) => ['RU', 'UA'].includes(candidate.code))) {
      for (let zoom = label.fitZoom; zoom < COUNTRY_LABEL_MAX_ZOOM; zoom += 0.25) {
        const scale = 2 ** zoom
        const crimea: Box = [
          mercatorX(32.4) * scale,
          mercatorY(46.3) * scale,
          mercatorX(36.7) * scale,
          mercatorY(44.3) * scale,
        ]
        expect(overlaps(worldBox(label, zoom), crimea), `${label.code} z${zoom}`).toBe(false)
      }
    }
  })
})

/** OurAirports fixture'ındaki havalimanının konumu. */
function airport(ident: string): { lat: number; lon: number } {
  const csv = readFileSync(
    new URL('../../fixtures/ourairports/airports.csv', import.meta.url),
    'utf8',
  )
  const line = csv.split('\n').find((row) => row.split(',')[1] === `"${ident}"`)
  if (!line) throw new Error(ident)
  const fields = line.split('","')
  return { lat: Number(fields[4]), lon: Number(fields[5]) }
}

describe('e2e beklentileri (e2e/country-label-expectations.ts)', () => {
  // Tuval 1280 px'ten dar, başlık yüzünden 720 px'ten alçak olabilir; çapa kenardan 40 px uzakta.
  const HALF_WIDTH = 600 - 40
  const HALF_HEIGHT = 280 - 40

  it('Tahran: z5 ve z4’te görünen adların çapası tuvalin içinde ve ilk yakınlaştırması ≤ z; gizli adlarınki > z', () => {
    const oiii = airport('OIII')
    const byName = new Map(shownLabels('tr', 'regular').map((label) => [label.name, label]))
    for (const [key, zoom] of [
      ['z5', 5],
      ['z4', 4],
    ] as const) {
      const { shown, hidden } = TEHRAN_COUNTRY_LABELS[key]
      for (const name of shown) {
        const label = byName.get(name)
        if (!label) throw new Error(name)
        const offset = screenOffset(label.lon, label.lat, oiii, zoom)
        expect(label.fitZoom, `${name} ${key}`).toBeLessThanOrEqual(zoom)
        expect(Math.abs(offset.x), `${name} ${key}`).toBeLessThanOrEqual(HALF_WIDTH)
        expect(Math.abs(offset.y), `${name} ${key}`).toBeLessThanOrEqual(HALF_HEIGHT)
      }
      for (const name of hidden) {
        const label = byName.get(name)
        if (!label) throw new Error(name)
        expect(label.fitZoom, `${name} ${key}`).toBeGreaterThan(zoom)
      }
    }
    // z5'te görünüp z4'te kaybolan ad katmanın kesirli `minzoom`'unu tarayıcıda sınar.
    expect(TEHRAN_COUNTRY_LABELS.z4.hidden).toContain('TÜRKMENİSTAN')
    expect(TEHRAN_COUNTRY_LABELS.z5.shown).toContain('TÜRKMENİSTAN')
  })

  it('İRAN’ın z5 kutusu ve IKA’nın pin ucu e2e’dekiyle ±0,5 px aynı; IKA pininin kesiti İRAN’ın harflerine değer (pin denetimi bunu ister)', () => {
    const placement = COUNTRY_LABEL_PLACEMENTS.tr.IR?.regular
    if (!placement) throw new Error('IR tr')
    const [lon, lat, fitZoom] = placement
    // Başkent tr geniş haritada z3,75'te, ortak nokta z3'te sığar: ad Tahran'ın 32 km güneyinde.
    expect([lon, lat]).toEqual([51.4, 35.4])
    expect(fitZoom).toBeLessThanOrEqual(5)
    expect(Math.round(distanceKm({ lon, lat }, capitalOf('IR')))).toBe(32)
    const oiii = airport('OIII')
    const anchor = screenOffset(lon, lat, oiii, 5)
    const size = countryLabelSizeAt(1, false, 5)
    const ink = labelInkBox(['İRAN'])
    const box = visibleBoxPx(ink, size)
    expect(Math.abs(anchor.x + box.left - IRAN_Z5_BOX.left)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(anchor.y + box.top - IRAN_Z5_BOX.top)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(anchor.x + box.right - IRAN_Z5_BOX.right)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(anchor.y + box.bottom - IRAN_Z5_BOX.bottom)).toBeLessThanOrEqual(0.5)
    const ikaAirport = airport('OIIE')
    const ika = screenOffset(ikaAirport.lon, ikaAirport.lat, oiii, 5)
    expect(Math.abs(ika.x - IKA_PIN_Z5.x)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(ika.y - IKA_PIN_Z5.y)).toBeLessThanOrEqual(0.5)
    // e2e'nin pin kesiti (`pinPixels`: uç ±8 px, −18…+1) yatayda İRAN'ın mürekkep kutusunun içinde,
    // dikeyde mürekkeple en az 15 satır örtüşür: kesitte harf ve hale çizilir.
    const scale = size / ONE_EM
    const inkPx = {
      left: anchor.x + ink.left * scale,
      top: anchor.y + ink.top * scale,
      right: anchor.x + ink.right * scale,
      bottom: anchor.y + ink.bottom * scale,
    }
    expect(ika.x - 8).toBeGreaterThan(inkPx.left)
    expect(ika.x + 8).toBeLessThan(inkPx.right)
    const rows = Math.min(ika.y + 1, inkPx.bottom) - Math.max(ika.y - 18, inkPx.top)
    expect(rows).toBeGreaterThanOrEqual(15)
  })

  it('İngilizce: IST’den uzaklaşınca (z4–5) TÜRKIYE yazılır ve görünümdedir', () => {
    const row = COUNTRY_LABEL_PLACEMENTS.en.TR
    const placement = row?.regular
    if (!placement) throw new Error('TR en')
    expect(row?.name).toBe('TÜRKIYE')
    expect(placement[2]).toBeLessThanOrEqual(3.75)
    const ltfm = airport('LTFM')
    for (const zoom of [4, 5]) {
      const offset = screenOffset(placement[0], placement[1], ltfm, zoom)
      expect(Math.abs(offset.x)).toBeLessThanOrEqual(HALF_WIDTH)
      expect(Math.abs(offset.y)).toBeLessThanOrEqual(HALF_HEIGHT)
    }
  })
})

describe('Türkiye çevresinde görünen adlar (D-096’daki ödünleşim)', () => {
  // 39° K, 35° D merkezli 1280 × 660 geniş harita ve 375 × 600 dar harita, Türkçe.
  const centre = { lat: 39, lon: 35 }

  it('geniş harita: z4’te 8, z4,5’te 5, z5’te 3 ad; dar haritada z5’te 2', () => {
    expect(visibleCodes('tr', 'regular', centre, 4, 1280, 660)).toEqual([
      'EG',
      'IQ',
      'IR',
      'IT',
      'LY',
      'RO',
      'SY',
      'TR',
    ])
    expect(visibleCodes('tr', 'regular', centre, 4.5, 1280, 660)).toEqual([
      'IQ',
      'IR',
      'RO',
      'SY',
      'TR',
    ])
    expect(visibleCodes('tr', 'regular', centre, 5, 1280, 660)).toEqual(['GE', 'SY', 'TR'])
    expect(visibleCodes('tr', 'compact', centre, 5, 375, 600)).toEqual(['SY', 'TR'])
  })

  it('komşuların ilk yakınlaştırması (Türkçe, geniş): BG 5,5; GR 6,25; AZ 5,75; AM ve CY 6,25', () => {
    const fitZoom = (code: string) => COUNTRY_LABEL_PLACEMENTS.tr[code]?.regular?.[2]
    expect(['TR', 'SY', 'IQ', 'IR', 'GE', 'BG', 'GR', 'AZ', 'AM', 'CY'].map(fitZoom)).toEqual([
      3.25, 4, 3.75, 3, 5, 5.5, 6.25, 5.75, 6.25, 6.25,
    ])
  })
})
