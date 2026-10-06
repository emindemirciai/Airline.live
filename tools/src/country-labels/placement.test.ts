/**
 * Ülke adlarının yerleşim tablosu (D-096, D-099, D-100): commit'li `COUNTRY_LABEL_PLACEMENTS` ve
 * `COUNTRY_LABEL_AREAS_KM2` fixture'lardan yeniden hesaplanır (sürüklenme); her yazılan adın görünür kutusu, ilk yakınlaştırmasından z8'e
 * kadar her yakınlaştırmada kendi ülkesinin içindedir; adlar örtüşmez; çapa kuralı tutar ve
 * TÜRKİYE ile başkentte sabit KIBRIS dışında hiçbir adın altına havalimanı pini ya da kodu (pin
 * başının sağında ya da solunda) girmez (boş yer); e2e'nin beklentileri tabloyla uyuşur.
 */
import { readFileSync } from 'node:fs'
import { distanceKm } from '@havayolu/geo'
import {
  COUNTRY_AREA_OVERRIDES_KM2,
  COUNTRY_LABEL_AREAS_KM2,
  COUNTRY_LABEL_CAPITAL_ANCHORS,
  COUNTRY_LABEL_FADE_START_ZOOM,
  COUNTRY_LABEL_MAX_ZOOM,
  COUNTRY_LABEL_MIN_ZOOM,
  COUNTRY_LABEL_PLACEMENT_PARAMS,
  COUNTRY_LABEL_PLACEMENTS,
  countryLabelLines,
  countryLabelSizeAt,
  type CountryLabelPlacement,
  type Locale,
} from '@havayolu/shared'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  IKA_PIN_Z5,
  IRAN_Z5_BOX,
  TEHRAN_COUNTRY_LABELS,
} from '../../../e2e/country-label-expectations'
import {
  AirportObstacles,
  chipBoxPx,
  mapAirportPins,
  pinBoxPx,
  readOurAirportsFixture,
  worldBoxAt,
  worldBoxesOverlap,
  type AirportPin,
} from './airport-pins'
import { mercatorX, mercatorY, ProjectedShape } from './geometry'
import {
  labelInkBox,
  LabelFitter,
  visibleBoxPx,
  type GlyphBox,
  type LabelLayout,
} from './label-model'
import { FAR_SAFETY_KM, SAFETY_KM } from './label-model'
import { decodeFixture, readFixture, type NaturalEarthFixture } from './natural-earth'
import {
  CAPITAL_ANCHORED_CODES,
  CLEAR_MAX_DELAY_ZOOMS,
  computePlacements,
  CROWDED_MAX_DELAY_ZOOMS,
  namesFromTable,
  PLACEMENT_COMBOS,
  placementInput,
  placementParams,
  type CountryPlacementDetail,
} from './placement'

let result: ReturnType<typeof computePlacements>
let shapes: Map<string, ProjectedShape>
let pins: AirportPin[]
let obstacles: AirportObstacles
let fixture: NaturalEarthFixture

beforeAll(() => {
  fixture = readFixture()
  const geometries = decodeFixture(fixture)
  shapes = new Map(
    Object.entries(geometries).map(([code, geometry]) => [code, new ProjectedShape(geometry)]),
  )
  pins = mapAirportPins(readOurAirportsFixture())
  obstacles = new AirportObstacles(pins)
  result = computePlacements(
    geometries,
    namesFromTable(COUNTRY_LABEL_PLACEMENTS),
    obstacles,
    fixture,
  )
}, 120_000)

/** Ülkenin kademesi ve km payı (tablonun yüzölçümü, fixture'ın uzak ülkeleri). */
const inputOf = (code: string) => placementInput(code, fixture)
/** Tahran'ın şehir merkezi (e2e görünümü Mehrabad'dadır). */
const TEHRAN = { lat: 35.69, lon: 51.39 }

const detailOf = (code: string): CountryPlacementDetail => {
  const detail = result.details.find((candidate) => candidate.code === code)
  if (!detail) throw new Error(code)
  return detail
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

const fitterFor = (label: Shown) => {
  const { tier, safetyKm } = inputOf(label.code)
  return new LabelFitter(
    shapes.get(label.code) as ProjectedShape,
    label.lines,
    tier,
    label.layout,
    safetyKm,
  )
}

type Box = readonly [x1: number, y1: number, x2: number, y2: number]

/** Görünür kutunun px kutusu (güvenlik payı yok), çapaya göre. */
function visibleBoxOf(label: Shown, zoom: number) {
  const { tier } = inputOf(label.code)
  return visibleBoxPx(
    labelInkBox(label.lines),
    countryLabelSizeAt(tier, label.layout === 'compact', zoom),
  )
}

/** Görünür kutu (güvenlik payı yok), z'deki dünya pikseliyle. */
function worldBox(label: Shown, zoom: number): Box {
  const box = visibleBoxOf(label, zoom)
  const scale = 2 ** zoom
  const x = mercatorX(label.lon) * scale
  const y = mercatorY(label.lat) * scale
  return [x + box.left, y + box.top, x + box.right, y + box.bottom]
}

const overlaps = (a: Box, b: Box) => a[0] <= b[2] && a[1] <= b[3] && a[2] >= b[0] && a[3] >= b[1]

/**
 * Kodun pin başının solundaki kutusu (web labels.ts `layoutAirportChips`'in ikinci adayı:
 * `x - headRadius - AIRPORT_GAP - width`), sağdaki kutudan bağımsız yazılmış: sağdakinin sol
 * kenarı `headRadius + AIRPORT_GAP`, genişliği 30 px.
 */
function leftCodeBox(zoom: number): GlyphBox | null {
  const right = chipBoxPx(zoom)
  if (!right) return null
  const width = right.right - right.left
  return { left: -right.left - width, top: right.top, right: -right.left, bottom: right.bottom }
}

/**
 * Kaba tarama (dizinsiz): adın z'deki görünür kutusuna pini ya da kodu (pin başının sağında ya da
 * solunda) giren havalimanları (bir havalimanının pini ve iki kod kutusu ayrı sayılır).
 */
function airportHits(label: Shown, zoom: number): string[] {
  const box = worldBoxAt(label.lon, label.lat, visibleBoxOf(label, zoom), zoom)
  const parts = [pinBoxPx(zoom), chipBoxPx(zoom), leftCodeBox(zoom)].filter((part) => part !== null)
  // Pin ve kodlar noktadan en çok ~60 px uzanır: daha uzaktaki havalimanı kutuya giremez.
  const reach = 100 / 2 ** zoom
  const hits: string[] = []
  for (const pin of pins) {
    const x = mercatorX(pin.lon)
    const y = mercatorY(pin.lat)
    if (x < box[0] - reach || x > box[2] + reach || y < box[1] - reach || y > box[3] + reach) {
      continue
    }
    for (const part of parts) {
      if (worldBoxesOverlap(box, worldBoxAt(pin.lon, pin.lat, part, zoom))) hits.push(pin.icao)
    }
  }
  return hits.sort()
}

/** `from`'dan `to`'ya (hariç) 0,05 adımla yakınlaştırmalar; kayan nokta birikmesi yok. */
function zoomSteps(from: number, to: number): number[] {
  const zooms: number[] = []
  for (
    let hundredths = Math.round(from * 100);
    hundredths < Math.round(to * 100);
    hundredths += 5
  ) {
    zooms.push(hundredths / 100)
  }
  return zooms
}

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

/** Hiçbir bileşimde yazılmayan 80 küçük ülke ve ada (D-100). */
const NEVER = [
  ...['AD', 'AG', 'AI', 'AS', 'AW', 'AX', 'BB', 'BH', 'BL', 'BM', 'BN', 'BQ', 'BS', 'BV', 'CK'],
  ...['CV', 'CW', 'DM', 'FK', 'FM', 'FO', 'GD', 'GG', 'GI', 'GM', 'GP', 'GS', 'GU', 'HK', 'HM'],
  ...['IM', 'IO', 'JE', 'KI', 'KM', 'KN', 'KY', 'LC', 'LI', 'LU', 'MC', 'MF', 'MH', 'MO', 'MP'],
  ...['MQ', 'MS', 'MT', 'MU', 'MV', 'NC', 'NF', 'NR', 'NU', 'PF', 'PM', 'PN', 'PW', 'RE', 'SB'],
  ...['SC', 'SG', 'SH', 'SM', 'ST', 'SX', 'TC', 'TF', 'TO', 'TT', 'TV', 'UM', 'VA', 'VC', 'VG'],
  ...['VI', 'VU', 'WF', 'WS', 'YT'],
]

describe('yerleşim tablosu (D-096, D-099, D-100)', { timeout: 120_000 }, () => {
  it('sürüklenme: commit’li tablo, commit’li fixture’lar ve adlarından yeniden hesaplananla aynı', () => {
    expect(result.table).toEqual(COUNTRY_LABEL_PLACEMENTS)
    expect(result.areas).toEqual(COUNTRY_LABEL_AREAS_KM2)
    expect(placementParams(obstacles)).toEqual(COUNTRY_LABEL_PLACEMENT_PARAMS)
    expect(COUNTRY_LABEL_PLACEMENT_PARAMS).toMatchObject({
      naturalEarth: '4.1.0 1:10m',
      worldAtlas: '2.0.2',
      simplifyKm: 0.5,
      farSimplifyKm: 1,
      farFromKm: 5000,
      safetyPx: 3,
      safetyKm: 2,
      farSafetyKm: 2.5,
      clearMaxDelayZooms: CLEAR_MAX_DELAY_ZOOMS,
      crowdedMaxDelayZooms: CROWDED_MAX_DELAY_ZOOMS,
      airportPins: 498,
      airportCodeMinZoom: 5,
      airportCodeSides: ['right', 'left'],
      capitalAnchored: ['CY'],
    })
    expect([CLEAR_MAX_DELAY_ZOOMS, CROWDED_MAX_DELAY_ZOOMS]).toEqual([1.5, 0.25])
    expect(CAPITAL_ANCHORED_CODES).toEqual(['CY'])
  })

  it('244 ülkeden 164’ü dört bileşimde de yazılır; hiç sığmayan 80 küçük ülke ve ada (D-095’in 59 ülkesinden yine Bahreyn, Lüksemburg ve Malta)', () => {
    expect(Object.keys(COUNTRY_LABEL_PLACEMENTS.tr)).toHaveLength(244)
    expect(NEVER).toHaveLength(80)
    for (const { locale, layout } of PLACEMENT_COMBOS) {
      const never = Object.entries(COUNTRY_LABEL_PLACEMENTS[locale])
        .filter(([, row]) => row[layout] === null)
        .map(([code]) => code)
      expect(never, `${locale} ${layout}`).toEqual(NEVER)
      expect(shownLabels(locale, layout)).toHaveLength(164)
    }
    expect(NEVER.filter((code) => Object.hasOwn(COUNTRY_AREA_OVERRIDES_KM2, code))).toEqual([
      'BH',
      'LU',
      'MT',
    ])
  })

  it('havalimanı olmayan ülkeler de yazılır (D-100): HİNDİSTAN, ÇİN, ABD, GRÖNLAND, FRANSIZ GUYANASI; Kosova, Batı Sahra, Tayvan', () => {
    for (const code of ['IN', 'CN', 'US', 'GL', 'GF', 'XK', 'EH', 'TW', 'SJ', 'YE', 'PK']) {
      const row = COUNTRY_LABEL_PLACEMENTS.tr[code]
      expect(row?.regular, code).not.toBeNull()
      expect(row?.compact, code).not.toBeNull()
    }
    expect(COUNTRY_LABEL_PLACEMENTS.tr.IN?.regular).toEqual([80.4, 23.1, 3])
    expect(COUNTRY_LABEL_PLACEMENTS.en.US?.name).toBe('UNITED STATES')
    expect(COUNTRY_LABEL_PLACEMENTS.tr.US?.name).toBe('AMERİKA BİRLEŞİK DEVLETLERİ')
  })

  it('çapalar 180° B–180° D arasında (haritanın asıl kopyası); Türkiye’den uzak ülkelerin km payı 2,5', () => {
    for (const label of ALL_SHOWN) {
      expect(Math.abs(label.lon), label.code).toBeLessThanOrEqual(180)
    }
    expect(COUNTRY_LABEL_PLACEMENTS.tr.FJ?.regular?.[0]).toBe(177.96)
    expect(inputOf('US').safetyKm).toBe(FAR_SAFETY_KM)
    expect(inputOf('TR').safetyKm).toBe(SAFETY_KM)
    expect(inputOf('CN').safetyKm).toBe(SAFETY_KM)
    for (const code of Object.keys(COUNTRY_LABEL_AREAS_KM2)) {
      expect(inputOf(code).safetyKm, code).toBe(
        fixture.farCodes.includes(code) ? FAR_SAFETY_KM : SAFETY_KM,
      )
    }
  })

  it('değerler: ilk yakınlaştırma 0,25 ızgarasında, [kademenin en küçüğü, 7); çapa 0,01°', () => {
    for (const label of ALL_SHOWN) {
      const { tier } = inputOf(label.code)
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
    expect(checks).toBeGreaterThan(30_000)
  })

  it('en küçüklük: ilk yakınlaştırma kademenin en küçüğü değilse ad bir adım önce sığmaz', () => {
    for (const label of ALL_SHOWN) {
      const { tier } = inputOf(label.code)
      if (label.fitZoom <= COUNTRY_LABEL_MIN_ZOOM[tier]) continue
      expect(
        fitterFor(label).fitsAtZoom(label.lon, label.lat, label.fitZoom - 0.25),
        `${label.code} ${label.locale} ${label.layout}`,
      ).toBe(false)
    }
  })

  it('çapa kuralı: ülke başına tek ortak nokta; boş yerde en erkenin ≤ 1,5, boş yer yoksa ≤ 0,25 gerisinde; 162 ülke boş yerde, yalnız TÜRKİYE kalabalıkta, KIBRIS başkentte', () => {
    const byKind = (kind: CountryPlacementDetail['kind']) =>
      result.details.filter((detail) => detail.kind === kind).map((detail) => detail.code)
    expect(byKind('hidden')).toEqual(NEVER)
    expect(byKind('crowded')).toEqual(['TR'])
    expect(byKind('capital')).toEqual(['CY'])
    expect(byKind('per-combination')).toEqual([])
    expect(byKind('clear')).toHaveLength(162)
    // Izgarasının hiçbir noktası ülkenin içinde olmayan tek ülke Vatikan (kutbu yok).
    expect(result.details.filter((detail) => detail.pole === null).map((d) => d.code)).toEqual([
      'VA',
    ])
    for (const detail of result.details) {
      const anchors = detail.placements.filter(
        (placement): placement is NonNullable<CountryLabelPlacement> => placement !== null,
      )
      const shape = shapes.get(detail.code) as ProjectedShape
      if (detail.pole) {
        expect(
          shape.contains(mercatorX(detail.pole[0]), mercatorY(detail.pole[1])),
          detail.code,
        ).toBe(true)
      }
      if (detail.kind === 'hidden') {
        expect(anchors, detail.code).toEqual([])
        continue
      }
      expect(anchors, detail.code).toHaveLength(4)
      expect(new Set(anchors.map(([lon, lat]) => `${lon},${lat}`)).size, detail.code).toBe(1)
      // Başkentte sabit adın gecikmesi sınırsızdır; KIBRIS testinde ayrıca denetlenir.
      if (detail.kind === 'capital') continue
      const tolerance = detail.kind === 'clear' ? CLEAR_MAX_DELAY_ZOOMS : CROWDED_MAX_DELAY_ZOOMS
      for (const [k, placement] of detail.placements.entries()) {
        if (!placement) continue
        expect(placement[2], `${detail.code} ${k}`).toBeLessThanOrEqual(
          (detail.bestFitZooms[k] as number) + tolerance,
        )
      }
      if (detail.kind === 'clear') expect(detail.overlaps, detail.code).toEqual([0, 0, 0, 0])
    }
  })

  it('gecikme: boş yer için ad en çok 1,5 kademe geç belirir (İTALYA); 39 ülkede bir bileşim en erkenden geç', () => {
    const delays: Record<string, number> = {}
    for (const detail of result.details) {
      const delay = Math.max(
        0,
        ...detail.placements.map((placement, k) =>
          placement ? placement[2] - (detail.bestFitZooms[k] as number) : 0,
        ),
      )
      if (delay > 0) delays[detail.code] = delay
    }
    // D-099'un 25 ülkesi aynı gecikmeyle; yeni ülkelerden 14'ü (D-100) en çok 0,25 geç: çoğu
    // havalimanı engeli değil, ızgaradaki noktanın dört bileşimde ortak olması gecikmesidir.
    expect(delays).toEqual({
      AF: 0.25,
      AT: 0.5,
      BA: 0.75,
      BE: 0.25,
      BG: 0.5,
      BJ: 0.25,
      CF: 0.25,
      CG: 0.25,
      CH: 0.5,
      CL: 0.25,
      CU: 0.25,
      CY: 0.5,
      DE: 0.75,
      DJ: 0.25,
      EG: 0.5,
      GB: 0.25,
      GE: 0.75,
      GR: 0.5,
      HR: 0.5,
      HU: 0.75,
      IQ: 0.5,
      IT: 1.5,
      JO: 0.25,
      JP: 0.25,
      KG: 0.25,
      KW: 0.25,
      MW: 0.25,
      NA: 0.25,
      NG: 0.25,
      OM: 0.25,
      PL: 0.75,
      RO: 0.75,
      RS: 0.25,
      SA: 0.75,
      SK: 0.75,
      TJ: 0.25,
      TR: 0.25,
      UZ: 0.25,
      ZW: 0.25,
    })
  })

  it('boş yer: TÜRKİYE ve KIBRIS dışında hiçbir adın kutusuna, ilk yakınlaştırmasından z7,95’e (0,05 adım), haritadaki bir havalimanının pini ya da kodu (sağda ya da solda) girmez', () => {
    let checks = 0
    for (const label of ALL_SHOWN) {
      if (detailOf(label.code).kind !== 'clear') continue
      for (const zoom of zoomSteps(label.fitZoom, COUNTRY_LABEL_MAX_ZOOM)) {
        checks++
        expect(
          airportHits(label, zoom),
          `${label.code} ${label.locale} ${label.layout} z${zoom}`,
        ).toEqual([])
      }
    }
    expect(checks).toBeGreaterThan(30_000)
  })

  it('sol kod: web kodu sağa sığmayınca pin başının soluna koyar; TÜRKİYE ve KIBRIS dışında o kutu da hiçbir adın kutusuna girmez', () => {
    let nearby = 0
    for (const label of ALL_SHOWN) {
      if (detailOf(label.code).kind !== 'clear') continue
      for (const zoom of zoomSteps(Math.max(label.fitZoom, 5), COUNTRY_LABEL_MAX_ZOOM)) {
        const left = leftCodeBox(zoom)
        if (!left) throw new Error(`no code at z${zoom}`)
        const box = worldBoxAt(label.lon, label.lat, visibleBoxOf(label, zoom), zoom)
        // Adın kutusunun 60 px çevresindeki havalimanları: sol kod kutusu en çok ~45 px uzanır.
        const reach = 60 / 2 ** zoom
        for (const pin of pins) {
          const x = mercatorX(pin.lon)
          const y = mercatorY(pin.lat)
          if (
            x < box[0] - reach ||
            x > box[2] + reach ||
            y < box[1] - reach ||
            y > box[3] + reach
          ) {
            continue
          }
          nearby++
          expect(
            worldBoxesOverlap(box, worldBoxAt(pin.lon, pin.lat, left, zoom)),
            `${label.code} ${label.locale} ${label.layout} z${zoom} ${pin.icao}`,
          ).toBe(false)
        }
      }
    }
    // Test boş değil: adların yakınında çok sayıda havalimanı denetlenir.
    expect(nearby).toBeGreaterThan(1_000)
  })

  it('kullanıcının örnekleri: İTALYA ve RUSYA yazıldıkları her yakınlaştırmada pinlerden ve kodlardan uzak; RUSYA bütün Rusya’nın görsel merkezinde (D-100)', () => {
    for (const code of ['IT', 'RU']) {
      const labels = ALL_SHOWN.filter((label) => label.code === code)
      expect(labels).toHaveLength(4)
      for (const label of labels) {
        for (const zoom of zoomSteps(label.fitZoom, COUNTRY_LABEL_MAX_ZOOM)) {
          expect(
            airportHits(label, zoom),
            `${code} ${label.locale} ${label.layout} z${zoom}`,
          ).toEqual([])
        }
      }
      expect(detailOf(code).kind).toBe('clear')
    }
    // RUSYA Moskova'nın (altında UUWW, UUDD, UUBW) değil görsel merkezde: D-099'da fixture 90° D'da
    // kırpılıyordu, kutup Urallar'ın batısındaydı (57,51° D, 61,77° K); bütün dünyada (D-100) Orta
    // Sibirya'da (107,73° D, 63,27° K; ızgara adımı 1,71°). İTALYA Po ovası (LIMP) yerine Alpler'de
    // (Trentino): Orta İtalya'da Pescara'nın (PSR) sola geçen kodu adın köşesine değiyordu.
    expect(COUNTRY_LABEL_PLACEMENTS.tr.RU?.regular).toEqual([107.73, 63.27, 3])
    expect(detailOf('RU').pole).toEqual([107.73, 63.27])
    expect(detailOf('RU').latticeStep).toBe(171)
    expect(COUNTRY_LABEL_PLACEMENTS.tr.IT?.regular).toEqual([11.4, 46.2, 5.25])
    expect(COUNTRY_LABEL_PLACEMENTS.tr.IT?.compact).toEqual([11.4, 46.2, 5])
  })

  it('KIBRIS (D-095, kullanıcının kararı): dört bileşimde Lefkoşa’da; boş yer aranmaz, Ercan (LCEN) pini ve kodu adın kutusunda', () => {
    const detail = detailOf('CY')
    const lefkosa = COUNTRY_LABEL_CAPITAL_ANCHORS.CY
    if (!lefkosa) throw new Error('CY')
    expect([lefkosa.lon, lefkosa.lat]).toEqual([33.36, 35.17])
    expect(detail.kind).toBe('capital')
    expect(detail.placements).toEqual([
      [33.36, 35.17, 6.25],
      [33.36, 35.17, 6.25],
      [33.36, 35.17, 6.5],
      [33.36, 35.17, 6.5],
    ])
    expect(detail.overlaps).toEqual([12, 12, 9, 9])
    for (const label of ALL_SHOWN.filter((candidate) => candidate.code === 'CY')) {
      for (const zoom of zoomSteps(label.fitZoom, COUNTRY_LABEL_MAX_ZOOM)) {
        expect(
          [...new Set(airportHits(label, zoom))],
          `${label.locale} ${label.layout} z${zoom}`,
        ).toEqual(['LCEN'])
      }
    }
  })

  it('TÜRKİYE: haritadaki 56 havalimanı (askerî üsler pinsiz, D-103) arasında boş yer yok; en az çakışan nokta, görsel merkezde (z3,25’ten); z5,05’ten sonra kutuya pin ve kod girmez', () => {
    const detail = detailOf('TR')
    expect(detail.kind).toBe('crowded')
    expect(detail.overlaps).toEqual([50, 44, 50, 44])
    expect(detail.placements.map((placement) => placement?.[2])).toEqual([3.25, 3, 3.25, 3])
    // Askerî üsler engel değil (D-103): çapa 1° batıya, görsel merkeze kaydı (D-099'da 34,8° D,
    // 39,4° K; çakışma 57, 50, 57, 50). Bu noktanın kutusuna eskiden Afyon (LTAH) ve Eskişehir
    // (LTBI) üslerinin pinleri de giriyordu.
    expect(detail.placements[0]).toEqual([33.8, 39.4, 3.25])
    expect(detail.pole).toEqual([33.8, 39.4])
    expect(pins.filter((pin) => pin.ring === 0)).toHaveLength(56)
    for (const label of ALL_SHOWN.filter((candidate) => candidate.code === 'TR')) {
      const where = `${label.locale} ${label.layout}`
      // z5'te (kodlar yazılmaya başlar) Kayseri (LTAU) ve Nevşehir (LTAZ) geniş haritada kutuya değer.
      expect(airportHits(label, 5), where).toEqual(
        label.layout === 'regular' ? ['LTAU', 'LTAU', 'LTAZ', 'LTAZ'] : [],
      )
      for (const zoom of zoomSteps(5.05, COUNTRY_LABEL_MAX_ZOOM)) {
        expect(airportHits(label, zoom), `${where} z${zoom}`).toEqual([])
      }
    }
  })

  it('görsel merkez: D-095’in 59 ülkesinden 10’unun adı tam kutupta (TÜRKİYE dahil, D-103), çapanın kutba uzaklığı ortanca 27 km, en çok 478 km (UMMAN); bütün dünyada 35 ülke kutupta, ortanca 37 km, en çok 1.658 km (ŞİLİ)', () => {
    const all = result.details
      .filter((detail) => detail.kind !== 'hidden')
      .map((detail) => {
        const anchor = detail.placements.find((placement) => placement !== null)
        if (!anchor || !detail.pole) throw new Error(detail.code)
        const km = distanceKm(
          { lon: anchor[0], lat: anchor[1] },
          { lon: detail.pole[0], lat: detail.pole[1] },
        )
        return [detail.code, km] as const
      })
      .sort((a, b) => a[1] - b[1])
    expect(all).toHaveLength(164)
    expect(all.filter(([, km]) => km === 0)).toHaveLength(35)
    expect(Math.round(all[Math.floor(all.length / 2)]?.[1] ?? NaN)).toBe(37)
    // Uzun ve dar Şili'de ad kuzeyde, Atacama'da en erken sığar; kutup Patagonya'dadır.
    expect(all.at(-1)?.[0]).toBe('CL')
    expect(Math.round(all.at(-1)?.[1] ?? NaN)).toBe(1658)
    const distances = all.filter(([code]) => Object.hasOwn(COUNTRY_AREA_OVERRIDES_KM2, code))
    expect(distances).toHaveLength(56)
    expect(distances.filter(([, km]) => km === 0).map(([code]) => code)).toEqual([
      'AT',
      'CZ',
      'DZ',
      'ES',
      'KZ',
      'RU',
      'SD',
      'SE',
      'TR',
      'UA',
    ])
    expect(Math.round(distances[Math.floor(distances.length / 2)]?.[1] ?? NaN)).toBe(27)
    const [farthest, km] = distances.at(-1) ?? ['', NaN]
    expect([farthest, Math.round(km)]).toEqual(['OM', 478])
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

describe('e2e beklentileri (e2e/country-label-expectations.ts)', { timeout: 60_000 }, () => {
  // Tuval 1280 px'ten dar, başlık yüzünden 720 px'ten alçak olabilir; çapa kenardan 40 px uzakta.
  const HALF_WIDTH = 600 - 40
  const HALF_HEIGHT = 280 - 40

  it('Tahran: z5, z4 ve z3’te görünen adların çapası tuvalin içinde ve ilk yakınlaştırması ≤ z; gizli adlarınki > z; kesirli minzoom', () => {
    const oiii = airport('OIII')
    const byName = new Map(shownLabels('tr', 'regular').map((label) => [label.name, label]))
    const labelOf = (name: string) => {
      const label = byName.get(name)
      if (!label) throw new Error(name)
      return label
    }
    const inCanvas = (label: Shown, zoom: number) => {
      const offset = screenOffset(label.lon, label.lat, oiii, zoom)
      return Math.abs(offset.x) <= HALF_WIDTH && Math.abs(offset.y) <= HALF_HEIGHT
    }
    for (const [key, zoom] of [
      ['z5', 5],
      ['z4', 4],
      ['z3', 3],
    ] as const) {
      const { shown, hidden } = TEHRAN_COUNTRY_LABELS[key]
      for (const name of shown) {
        expect(labelOf(name).fitZoom, `${name} ${key}`).toBeLessThanOrEqual(zoom)
        expect(inCanvas(labelOf(name), zoom), `${name} ${key}`).toBe(true)
      }
      for (const name of hidden)
        expect(labelOf(name).fitZoom, `${name} ${key}`).toBeGreaterThan(zoom)
    }
    // Katmanın kesirli `minzoom`'u tarayıcıda: ÖZBEKİSTAN ve PAKİSTAN (4,5; PAKİSTAN'da bugün
    // listelenen havalimanı yok, D-100) z4'te, AFGANİSTAN, SURİYE (3,75) ve TÜRKİYE (3,25) z3'te
    // çapaları tuvalin içindeyken yazılmaz (kovaları o karoda hazırdır); son üçü bir kademe önce (z4)
    // yazılır.
    const fractional = [
      ['z4', 4, ['ÖZBEKİSTAN', 'PAKİSTAN']],
      ['z3', 3, ['AFGANİSTAN', 'SURİYE', 'TÜRKİYE']],
    ] as const
    for (const [key, zoom, names] of fractional) {
      for (const name of names) {
        const label = labelOf(name)
        expect(TEHRAN_COUNTRY_LABELS[key].hidden, name).toContain(name)
        expect(label.fitZoom, name).toBeLessThan(zoom + 1)
        expect(label.fitZoom % 1, name).not.toBe(0)
        expect(inCanvas(label, zoom), name).toBe(true)
        if (key === 'z3') expect(TEHRAN_COUNTRY_LABELS.z4.shown, name).toContain(name)
      }
    }
  })

  it('İRAN’ın z5 kutusu ve IKA’nın pin ucu e2e’dekiyle ±0,5 px aynı; IKA’nın pin kesiti ve hiçbir pin ya da kod İRAN’ın kutusuna değmez', () => {
    const placement = COUNTRY_LABEL_PLACEMENTS.tr.IR?.regular
    if (!placement) throw new Error('IR tr')
    const [lon, lat, fitZoom] = placement
    // Boş yer kuralı (D-099): İRAN Dest-i Kevir'de, Tahran'ın 428 km doğu-güneydoğusunda, z3'ten.
    expect([lon, lat, fitZoom]).toEqual([55.6, 34, 3])
    expect(Math.round(distanceKm({ lon, lat }, TEHRAN))).toBe(428)
    const oiii = airport('OIII')
    const anchor = screenOffset(lon, lat, oiii, 5)
    const size = countryLabelSizeAt(1, false, 5)
    const ink = labelInkBox(['İRAN'])
    const box = visibleBoxPx(ink, size)
    expect(Math.abs(anchor.x + box.left - IRAN_Z5_BOX.left)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(anchor.y + box.top - IRAN_Z5_BOX.top)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(anchor.x + box.right - IRAN_Z5_BOX.right)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(anchor.y + box.bottom - IRAN_Z5_BOX.bottom)).toBeLessThanOrEqual(0.5)
    // Kesit e2e'de tuvalin içinde (model kutusu + 12 px).
    expect(IRAN_Z5_BOX.right + 12).toBeLessThanOrEqual(HALF_WIDTH)
    expect(IRAN_Z5_BOX.bottom + 12).toBeLessThanOrEqual(HALF_HEIGHT)
    const ikaAirport = airport('OIIE')
    const ika = screenOffset(ikaAirport.lon, ikaAirport.lat, oiii, 5)
    expect(Math.abs(ika.x - IKA_PIN_Z5.x)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(ika.y - IKA_PIN_Z5.y)).toBeLessThanOrEqual(0.5)
    // e2e'nin pin kesiti (`pinPixels`: uç ±8 px, −18…+1) İRAN'ın görünür kutusundan ayrık: ad açıkken
    // ve kapalıyken kesitin pikselleri aynıdır.
    const kesit = { left: ika.x - 8, top: ika.y - 18, right: ika.x + 8, bottom: ika.y + 1 }
    const apart =
      kesit.right < IRAN_Z5_BOX.left ||
      kesit.left > IRAN_Z5_BOX.right ||
      kesit.bottom < IRAN_Z5_BOX.top ||
      kesit.top > IRAN_Z5_BOX.bottom
    expect(apart).toBe(true)
    const iran = shownLabels('tr', 'regular').find((label) => label.code === 'IR')
    if (!iran) throw new Error('IR')
    for (const zoom of zoomSteps(fitZoom, COUNTRY_LABEL_MAX_ZOOM)) {
      expect(airportHits(iran, zoom), `z${zoom}`).toEqual([])
    }
  })

  it('İngilizce, 375 px: IST’den dört kademe uzaklaşınca (z3,8) TÜRKIYE yazılır ve çapası görünümdedir', () => {
    // 375 px'te açılış z7,8'dir (web camera.ts `initialZoom`); e2e dört kademe uzaklaşır.
    const zoom = 7.8 - 4
    const row = COUNTRY_LABEL_PLACEMENTS.en.TR
    const placement = row?.compact
    if (!placement) throw new Error('TR en')
    expect(row?.name).toBe('TÜRKIYE')
    expect(placement[2]).toBeLessThanOrEqual(zoom)
    const ltfm = airport('LTFM')
    const offset = screenOffset(placement[0], placement[1], ltfm, zoom)
    expect(Math.round(offset.x)).toBe(100)
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(375 / 2 - 40)
    expect(Math.abs(offset.y)).toBeLessThanOrEqual(HALF_HEIGHT)
  })
})

describe(
  'Türkiye çevresinde görünen adlar (D-096’daki ödünleşim, D-099)',
  { timeout: 60_000 },
  () => {
    // 39° K, 35° D merkezli 1280 × 660 geniş harita ve 375 × 600 dar harita, Türkçe.
    const centre = { lat: 39, lon: 35 }

    it('geniş harita: z4’te 5, z4,5’te 4, z5’te 2 ad; dar haritada z5’te 2', () => {
      // D-096'da 8, 5, 3 ve 2'ydi: MISIR, LİBYA ve İRAN ülkelerinin ortasına, Türkiye görünümünün
      // dışına kaydı; İTALYA (z5,25), ROMANYA (z4,25) ve GÜRCİSTAN (z5,25) boş yer için geç belirir;
      // TÜRKMENİSTAN z4'ten görünür.
      expect(visibleCodes('tr', 'regular', centre, 4, 1280, 660)).toEqual([
        'IQ',
        'IR',
        'SY',
        'TM',
        'TR',
      ])
      expect(visibleCodes('tr', 'regular', centre, 4.5, 1280, 660)).toEqual([
        'IQ',
        'RO',
        'SY',
        'TR',
      ])
      expect(visibleCodes('tr', 'regular', centre, 5, 1280, 660)).toEqual(['SY', 'TR'])
      expect(visibleCodes('tr', 'compact', centre, 5, 375, 600)).toEqual(['SY', 'TR'])
    })

    it('komşuların ilk yakınlaştırması (Türkçe, geniş): BG 5,5; GR 6,5; AZ 5,5; AM 6; CY 6,25', () => {
      const fitZoom = (code: string) => COUNTRY_LABEL_PLACEMENTS.tr[code]?.regular?.[2]
      expect(['TR', 'SY', 'IQ', 'IR', 'GE', 'BG', 'GR', 'AZ', 'AM', 'CY'].map(fitZoom)).toEqual([
        3.25, 3.75, 4, 3, 5.25, 5.5, 6.5, 5.5, 6, 6.25,
      ])
    })
  },
)
