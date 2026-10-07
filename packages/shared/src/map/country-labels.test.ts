import { describe, expect, it } from 'vitest'
import {
  COUNTRY_AREA_OVERRIDES_KM2,
  UNLABELLED_COUNTRIES,
  countryLabelTier,
  type CountryLabelTier,
} from '../reference/country-label-set'
import { countryLabelText } from '../reference/countries'
import { MAP_COLORS } from './colors'
import {
  COUNTRY_LABEL_AREAS_KM2,
  COUNTRY_LABEL_PLACEMENT_PARAMS,
  COUNTRY_LABEL_PLACEMENTS,
} from './country-label-placements'
import { countryLabelPoints } from './country-label-points'
import {
  COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX,
  COUNTRY_LABEL_CONNECTORS,
  COUNTRY_LABEL_FADE_START_ZOOM,
  COUNTRY_LABEL_FIT_ZOOM_STEP,
  COUNTRY_LABEL_FONT,
  COUNTRY_LABEL_HALO_ALPHA,
  COUNTRY_LABEL_HALO_BLUR_SHARE,
  COUNTRY_LABEL_HALO_TRANSITION,
  COUNTRY_LABEL_HALO_WIDTH_SHARE,
  COUNTRY_LABEL_LAYER_IDS,
  COUNTRY_LABEL_LAYER_KEYS,
  COUNTRY_LABEL_MAX_WIDTH_EM,
  COUNTRY_LABEL_MAX_ZOOM,
  COUNTRY_LABEL_MIN_ZOOM,
  COUNTRY_LABEL_SIZES,
  COUNTRY_LABEL_SOURCE_ID,
  COUNTRY_LABEL_SOURCE_MAX_ZOOM,
  COUNTRY_LABEL_TEXT_ALPHA,
  COUNTRY_LABEL_TIERS,
  GLYPH_SDF_REACH_EM,
  HALO_BLUR_FACTOR,
  SDF_EDGE_GAMMA_PX,
  countryLabelFitZooms,
  countryLabelHalo,
  countryLabelHaloCurve,
  countryLabelLayerId,
  countryLabelLayers,
  countryLabelLines,
  countryLabelOpacityAt,
  countryLabelOpacityStops,
  countryLabelSizeAt,
  countryLabelTextSize,
  interpolateStops,
} from './country-labels'
import type { StyleExpression, TextSymbolLayerStyle } from './layers'

/** `['interpolate', ['linear'], ['zoom'], z0, v0, …]` durakları. */
function stops(value: unknown): [number, number][] {
  const expression = value as StyleExpression
  expect(expression.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']])
  const rest = expression.slice(3) as number[]
  expect(rest.length % 2).toBe(0)
  const pairs: [number, number][] = []
  for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i] ?? NaN, rest[i + 1] ?? NaN])
  return pairs
}

const MODES = [false, true] as const
const layerOf = (layers: TextSymbolLayerStyle[], tier: CountryLabelTier, fitZoom: number) => {
  const layer = layers.find((l) => l.id === countryLabelLayerId(tier, fitZoom))
  if (!layer) throw new Error(`layer ${tier} ${fitZoom} missing`)
  return layer
}

describe('ülke adı katmanları (D-095, D-096)', () => {
  it('her (kademe, ilk yakınlaştırma) için bir katman: 40 katman, alttan üste kademe 3, 2, 1', () => {
    expect(COUNTRY_LABEL_SOURCE_ID).toBe('hy-country-labels')
    expect(COUNTRY_LABEL_SOURCE_MAX_ZOOM).toBe(7)
    expect(COUNTRY_LABEL_TIERS).toEqual([3, 2, 1])
    expect(COUNTRY_LABEL_FIT_ZOOM_STEP).toBe(0.25)
    expect(countryLabelFitZooms(1)).toEqual([
      3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75,
    ])
    expect(countryLabelFitZooms(2)).toHaveLength(14)
    expect(countryLabelFitZooms(3)).toEqual([4.5, 4.75, 5, 5.25, 5.5, 5.75, 6, 6.25, 6.5, 6.75])
    expect(COUNTRY_LABEL_LAYER_IDS).toHaveLength(40)
    expect(new Set(COUNTRY_LABEL_LAYER_IDS).size).toBe(40)
    expect(COUNTRY_LABEL_LAYER_IDS[0]).toBe('hy-country-labels-3-450')
    expect(COUNTRY_LABEL_LAYER_IDS[10]).toBe('hy-country-labels-2-350')
    expect(COUNTRY_LABEL_LAYER_IDS.at(-1)).toBe('hy-country-labels-1-675')
    for (const compact of MODES) {
      const layers = countryLabelLayers({ compact })
      expect(layers.map((l) => l.id)).toEqual(COUNTRY_LABEL_LAYER_IDS)
      for (const [index, [tier, fitZoom]] of COUNTRY_LABEL_LAYER_KEYS.entries()) {
        const layer = layers[index]
        expect(layer?.type).toBe('symbol')
        expect(layer?.source).toBe(COUNTRY_LABEL_SOURCE_ID)
        expect(layer?.filter).toEqual([
          'all',
          ['==', ['get', 'tier'], tier],
          ['==', ['get', 'fitZoom'], fitZoom],
        ])
        // Katman adın ilk sığdığı yakınlaştırmada açılır (MapLibre kesirli z'de denetler).
        expect([layer?.minzoom, layer?.maxzoom]).toEqual([fitZoom, COUNTRY_LABEL_MAX_ZOOM])
      }
    }
  })

  it('yazı boyu: kademe eğrileri (z5’te 34 / 22 / 14 px; dar haritada 27 / 18 / 14), yalnızca yakınlaştırmaya bağlı', () => {
    expect(COUNTRY_LABEL_COMPACT_MAX_WIDTH_PX).toBe(767)
    expect(COUNTRY_LABEL_SIZES.regular).toEqual({
      1: [
        [3, 20],
        [4, 27],
        [5, 34],
        [7, 39],
      ],
      2: [
        [3.5, 15],
        [4, 17],
        [5, 22],
        [7, 25],
      ],
      3: [
        [3, 11],
        [5, 14],
        [7, 16],
      ],
    })
    expect(COUNTRY_LABEL_SIZES.compact[1]).toEqual([
      [3, 17],
      [4, 22],
      [5, 27],
      [7, 31],
    ])
    expect(COUNTRY_LABEL_SIZES.compact[3]).toEqual(COUNTRY_LABEL_SIZES.regular[3])
    expect([1, 2, 3].map((t) => countryLabelSizeAt(t as CountryLabelTier, false, 5))).toEqual([
      34, 22, 14,
    ])
    expect([1, 2, 3].map((t) => countryLabelSizeAt(t as CountryLabelTier, true, 5))).toEqual([
      27, 18, 14,
    ])
    for (const compact of MODES) {
      const layers = countryLabelLayers({ compact })
      for (const [tier, fitZoom] of COUNTRY_LABEL_LAYER_KEYS) {
        const layer = layerOf(layers, tier, fitZoom)
        expect(layer.layout['text-size']).toEqual(countryLabelTextSize(tier, compact))
        expect(stops(layer.layout['text-size'])).toEqual(
          COUNTRY_LABEL_SIZES[compact ? 'compact' : 'regular'][tier],
        )
      }
    }
  })

  it('yazı: Overpass 600, 0,32 em, satır 1, ortalı, kaymasız; adlar birbirini silmez, yer adlarını iter', () => {
    expect(COUNTRY_LABEL_FONT).toBe('Overpass SemiBold')
    expect(COUNTRY_LABEL_MAX_WIDTH_EM).toBe(24)
    for (const compact of MODES) {
      for (const layer of countryLabelLayers({ compact })) {
        expect(layer.layout).toEqual({
          'text-field': ['get', 'label'],
          'text-font': [COUNTRY_LABEL_FONT],
          'text-size': layer.layout['text-size'],
          'text-letter-spacing': 0.32,
          'text-line-height': 1,
          'text-max-width': 24,
          'text-anchor': 'center',
          'text-justify': 'center',
          'text-padding': 6,
          'text-allow-overlap': true,
          'text-ignore-placement': false,
          'text-rotation-alignment': 'viewport',
          'text-pitch-alignment': 'viewport',
          'symbol-sort-key': ['get', 'rank'],
          visibility: 'visible',
        })
      }
    }
  })

  it('renk (D-099, daha belirgin): beyaz 0,85 ve koyu hale 0,9; saydamlık renkte, MAP_COLORS opak', () => {
    expect([COUNTRY_LABEL_TEXT_ALPHA, COUNTRY_LABEL_HALO_ALPHA]).toEqual([0.85, 0.9])
    expect(MAP_COLORS.countryLabel).toBe('#FFFFFF')
    expect(MAP_COLORS.countryLabelHalo).toBe('#000000')
    for (const layer of countryLabelLayers({ compact: false })) {
      expect(layer.paint['text-color']).toBe('rgba(255, 255, 255, 0.85)')
      expect(layer.paint['text-halo-color']).toBe('rgba(0, 0, 0, 0.9)')
    }
  })

  it('hale: boyla orantılı, yalnızca yakınlaştırmaya bağlı; dış ucu glif SDF payını hiçbir durakta aşmaz', () => {
    expect(GLYPH_SDF_REACH_EM).toBe(1 / 8)
    expect([SDF_EDGE_GAMMA_PX, HALO_BLUR_FACTOR]).toEqual([0.84, 1.19])
    for (const compact of MODES) {
      for (const [tier, fitZoom] of COUNTRY_LABEL_LAYER_KEYS) {
        const layer = layerOf(countryLabelLayers({ compact }), tier, fitZoom)
        expect(layer.paint['text-halo-width']).toEqual(
          countryLabelHaloCurve(tier, compact, 'width'),
        )
        expect(layer.paint['text-halo-blur']).toEqual(countryLabelHaloCurve(tier, compact, 'blur'))
        // Geçiş yok: dar haritaya geçerken hale boyla birlikte küçülür (varsayılan 300 ms'de
        // küçülseydi küçük glifin payını aşıp glif kutusunda kesilirdi).
        expect(layer.paint['text-halo-width-transition']).toEqual({ duration: 0, delay: 0 })
        expect(layer.paint['text-halo-blur-transition']).toEqual({ duration: 0, delay: 0 })
        const sizes = stops(layer.layout['text-size'])
        const widths = stops(layer.paint['text-halo-width'])
        const blurs = stops(layer.paint['text-halo-blur'])
        expect(widths.map(([z]) => z)).toEqual(sizes.map(([z]) => z))
        for (const [i, [zoom, size]] of sizes.entries()) {
          const width = widths[i]?.[1] ?? NaN
          const blur = blurs[i]?.[1] ?? NaN
          const where = `${layer.id} ${compact ? 'compact' : 'regular'} z${zoom}`
          expect(width, where).toBeGreaterThan(0)
          expect(blur, where).toBeGreaterThanOrEqual(0)
          expect(width + HALO_BLUR_FACTOR * blur + SDF_EDGE_GAMMA_PX, where).toBeLessThanOrEqual(
            size / 8,
          )
        }
      }
    }
    // D-099: payın 0,85'i genişlik, 0,1'i yumuşaklık (en koyu hale; D-095'te 0,65 ve 0,3).
    expect([COUNTRY_LABEL_HALO_WIDTH_SHARE, COUNTRY_LABEL_HALO_BLUR_SHARE]).toEqual([0.85, 0.1])
    expect(countryLabelHalo(34)).toEqual({ width: 2.89, blur: 0.28 })
    expect(countryLabelHalo(22)).toEqual({ width: 1.62, blur: 0.16 })
    expect(countryLabelHalo(14)).toEqual({ width: 0.77, blur: 0.07 })
    expect(countryLabelHalo(4)).toEqual({ width: 0, blur: 0 })
    expect(COUNTRY_LABEL_HALO_TRANSITION).toEqual({ duration: 0, delay: 0 })
  })

  it('saydamlık: ilk yakınlaştırmada 0, yarım kademe sonra (en geç z7’de) tam, z7–8 silinir', () => {
    expect([COUNTRY_LABEL_FADE_START_ZOOM, COUNTRY_LABEL_MAX_ZOOM]).toEqual([7, 8])
    expect(countryLabelOpacityStops(3)).toEqual([
      [3, 0],
      [3.5, 1],
      [7, 1],
      [8, 0],
    ])
    expect(countryLabelOpacityStops(6.5)).toEqual([
      [6.5, 0],
      [7, 1],
      [8, 0],
    ])
    expect(countryLabelOpacityStops(6.75)).toEqual([
      [6.75, 0],
      [7, 1],
      [8, 0],
    ])
    expect(countryLabelOpacityAt(3, 2.9)).toBe(0)
    expect(countryLabelOpacityAt(3, 3)).toBe(0)
    expect(countryLabelOpacityAt(3, 3.25)).toBeCloseTo(0.5, 9)
    expect(countryLabelOpacityAt(3, 3.5)).toBe(1)
    expect(countryLabelOpacityAt(5.25, 5.2)).toBe(0)
    expect(countryLabelOpacityAt(5.25, 5.75)).toBe(1)
    expect(countryLabelOpacityAt(6.75, 6.875)).toBeCloseTo(0.5, 9)
    expect(countryLabelOpacityAt(3, 7.5)).toBeCloseTo(0.5, 9)
    expect(countryLabelOpacityAt(3, 8)).toBe(0)
    for (const [tier, fitZoom] of COUNTRY_LABEL_LAYER_KEYS) {
      const layer = layerOf(countryLabelLayers({ compact: false }), tier, fitZoom)
      expect(stops(layer.paint['text-opacity'])).toEqual(countryLabelOpacityStops(fitZoom))
    }
    expect(interpolateStops([], 3)).toBe(0)
  })

  it('Gizle: 40 katman visibility none', () => {
    const layers = countryLabelLayers({ compact: false, visible: false })
    expect(layers).toHaveLength(40)
    for (const layer of layers) expect(layer.layout.visibility).toBe('none')
  })

  it('katmanlar düz JSON', () => {
    for (const layer of countryLabelLayers({ compact: true })) {
      expect(JSON.parse(JSON.stringify(layer)), layer.id).toEqual(layer)
    }
  })
})

describe('countryLabelLines (D-096)', () => {
  it('her sözcük ayrı satırda; kısa çizgide kırılır, çizgi yazılmaz; bağlaç önceki sözcükle', () => {
    expect(countryLabelLines('TÜRKİYE', 'tr')).toEqual(['TÜRKİYE'])
    expect(countryLabelLines('SUUDİ ARABİSTAN', 'tr')).toEqual(['SUUDİ', 'ARABİSTAN'])
    expect(countryLabelLines('BOSNA-HERSEK', 'tr')).toEqual(['BOSNA', 'HERSEK'])
    expect(countryLabelLines('BİRLEŞİK ARAP EMİRLİKLERİ', 'tr')).toEqual([
      'BİRLEŞİK',
      'ARAP',
      'EMİRLİKLERİ',
    ])
    expect(countryLabelLines('BOSNIA AND HERZEGOVINA', 'en')).toEqual(['BOSNIA AND', 'HERZEGOVINA'])
    expect(countryLabelLines('ISLE OF MAN', 'en')).toEqual(['ISLE OF', 'MAN'])
    expect(countryLabelLines('TRINIDAD VE TOBAGO', 'tr')).toEqual(['TRINIDAD VE', 'TOBAGO'])
    // Bağlaç yalnızca o dilde bağlaçtır; baştaki bağlaç sonraki sözcüğe katılır.
    expect(countryLabelLines('ST VE', 'en')).toEqual(['ST', 'VE'])
    expect(countryLabelLines('THE GAMBIA', 'en')).toEqual(['THE GAMBIA'])
    expect(countryLabelLines('  KUZEY   MAKEDONYA ', 'tr')).toEqual(['KUZEY', 'MAKEDONYA'])
    expect(COUNTRY_LABEL_CONNECTORS).toEqual({ tr: ['VE'], en: ['AND', 'OF', 'THE'] })
  })

  it('D-095’in 59 × 2 adından yalnız BAE, Bosna-Hersek, Kuzey Makedonya ve Suudi Arabistan çok satırlı', () => {
    const multi: string[] = []
    for (const locale of ['tr', 'en'] as const) {
      for (const code of Object.keys(COUNTRY_AREA_OVERRIDES_KM2)) {
        const lines = countryLabelLines(countryLabelText(code, locale), locale)
        if (lines.length > 1) multi.push(`${locale} ${code} ${lines.join(' / ')}`)
      }
    }
    expect(multi).toEqual([
      'tr AE BİRLEŞİK / ARAP / EMİRLİKLERİ',
      'tr BA BOSNA / HERSEK',
      'tr MK KUZEY / MAKEDONYA',
      'tr SA SUUDİ / ARABİSTAN',
      'en AE UNITED / ARAB / EMIRATES',
      'en BA BOSNIA AND / HERZEGOVINA',
      'en MK NORTH / MACEDONIA',
      'en SA SAUDI / ARABIA',
    ])
  })

  it('bütün dünyanın adlarında (D-100): kısa çizgi, bağlaç önceki sözcükte; elle tutulan adlar', () => {
    expect(countryLabelLines(countryLabelText('US', 'tr'), 'tr')).toEqual([
      'AMERİKA',
      'BİRLEŞİK',
      'DEVLETLERİ',
    ])
    expect(countryLabelLines(countryLabelText('GW', 'en'), 'en')).toEqual(['GUINEA', 'BISSAU'])
    // Elle tutulan adlar (countries.ts `COUNTRY_NAME_OVERRIDES`): "of" ve "the" kendi satırında
    // kalmaz, önceki sözcükle yazılır.
    expect(countryLabelLines(countryLabelText('CD', 'tr'), 'tr')).toEqual([
      'KONGO',
      'DEMOKRATİK',
      'CUMHURİYETİ',
    ])
    expect(countryLabelLines(countryLabelText('CD', 'en'), 'en')).toEqual([
      'DEMOCRATIC',
      'REPUBLIC OF THE',
      'CONGO',
    ])
    expect(countryLabelLines(countryLabelText('CG', 'tr'), 'tr')).toEqual(['KONGO', 'CUMHURİYETİ'])
    expect(countryLabelLines(countryLabelText('CG', 'en'), 'en')).toEqual([
      'REPUBLIC OF THE',
      'CONGO',
    ])
    expect(countryLabelLines(countryLabelText('CI', 'tr'), 'tr')).toEqual(['FİLDİŞİ', 'SAHİLİ'])
    expect(countryLabelLines(countryLabelText('CI', 'en'), 'en')).toEqual(['CÔTE', 'D’IVOIRE'])
    for (const locale of ['tr', 'en'] as const) {
      expect(countryLabelLines(countryLabelText('MM', locale), locale)).toEqual(['MYANMAR'])
      expect(countryLabelLines(countryLabelText('SJ', locale), locale)).toEqual(['SVALBARD'])
    }
    // Hiçbir çok satırlı adda bağlaç tek başına satır değildir.
    for (const code of Object.keys(COUNTRY_LABEL_AREAS_KM2)) {
      for (const locale of ['tr', 'en'] as const) {
        const lines = countryLabelLines(countryLabelText(code, locale), locale)
        if (lines.length < 2) continue
        for (const line of lines) {
          expect(COUNTRY_LABEL_CONNECTORS[locale], `${code} ${locale}`).not.toContain(line)
        }
      }
    }
  })
})

/** Tablonun kodları: yüzölçümü tablosunun kodları, sıralı. */
const CODES = Object.keys(COUNTRY_LABEL_AREAS_KM2)
/** Hiçbir bileşimde yazılmayanlar (dört düzen de null). */
const NEVER = CODES.filter((code) =>
  (['tr', 'en'] as const).every((locale) => {
    const row = COUNTRY_LABEL_PLACEMENTS[locale][code]
    return row?.regular === null && row.compact === null
  }),
)
const tierOf = (code: string) =>
  countryLabelTier({ code, areaKm2: COUNTRY_LABEL_AREAS_KM2[code] ?? NaN })

describe('yerleşim tablosu (D-096, D-099, D-100)', () => {
  it('iki dilde aynı 244 kod (yüzölçümü tablosununkiler); İsrail, Filistin ve Antarktika yok; değerler ızgarada', () => {
    expect(CODES).toHaveLength(244)
    expect(CODES).toEqual(CODES.toSorted())
    for (const locale of ['tr', 'en'] as const) {
      const rows = COUNTRY_LABEL_PLACEMENTS[locale]
      expect(Object.keys(rows)).toEqual(CODES)
      for (const code of [...UNLABELLED_COUNTRIES, 'AQ']) expect(rows).not.toHaveProperty(code)
      for (const [code, row] of Object.entries(rows)) {
        const min = COUNTRY_LABEL_MIN_ZOOM[tierOf(code)]
        for (const placement of [row.regular, row.compact]) {
          if (placement === null) continue
          const [lon, lat, fitZoom] = placement
          expect(Math.round(lon * 100) / 100, code).toBe(lon)
          expect(Math.round(lat * 100) / 100, code).toBe(lat)
          expect(Math.abs(lon), code).toBeLessThanOrEqual(180)
          expect(fitZoom * 4, code).toBe(Math.round(fitZoom * 4))
          expect(fitZoom, code).toBeGreaterThanOrEqual(min)
          expect(fitZoom, code).toBeLessThan(COUNTRY_LABEL_FADE_START_ZOOM)
        }
      }
    }
    expect(COUNTRY_LABEL_PLACEMENT_PARAMS).toMatchObject({
      simplifyKm: 0.5,
      farSimplifyKm: 1,
      safetyPx: 3,
      safetyKm: 2,
      farSafetyKm: 2.5,
      clearMaxDelayZooms: 1.5,
      crowdedMaxDelayZooms: 0.25,
      airportPins: 498,
      airportCodeMinZoom: 5,
    })
  })

  it('ülke başına tek çapa (D-099): ad iki dilde ve iki genişlikte aynı yerde', () => {
    for (const code of CODES) {
      const anchors = new Set<string>()
      for (const locale of ['tr', 'en'] as const) {
        const row = COUNTRY_LABEL_PLACEMENTS[locale][code]
        for (const placement of [row?.regular, row?.compact]) {
          if (placement) anchors.add(`${placement[0]},${placement[1]}`)
        }
      }
      expect(anchors.size, code).toBe(NEVER.includes(code) ? 0 : 1)
    }
    // Hiç sığmayan 80 küçük ülke ve ada; D-095'in 59 ülkesinden yine Bahreyn, Lüksemburg ve Malta.
    expect(NEVER).toHaveLength(80)
    expect(NEVER.filter((code) => Object.hasOwn(COUNTRY_AREA_OVERRIDES_KM2, code))).toEqual([
      'BH',
      'LU',
      'MT',
    ])
  })

  it('tablodaki adlar bu Node’un CLDR’ıyla countryLabelText’in verdiğiyle aynı', () => {
    const changed: string[] = []
    for (const locale of ['tr', 'en'] as const) {
      for (const [code, row] of Object.entries(COUNTRY_LABEL_PLACEMENTS[locale])) {
        const current = countryLabelText(code, locale)
        if (current !== row.name) changed.push(`${locale} ${code}: ${row.name} → ${current}`)
      }
    }
    expect(
      changed,
      `CLDR name changed under Node ${process.versions.node} / ICU ${process.versions.icu}; run pnpm country-labels`,
    ).toEqual([])
  })
})

describe('countryLabelPoints (D-096)', () => {
  it('yazılan adlar tablodan: Türkiye sıra 0; hiç sığmayanlar (Bahreyn, Lüksemburg, Malta…) yok', () => {
    for (const locale of ['tr', 'en'] as const) {
      for (const compact of MODES) {
        const points = countryLabelPoints(locale, compact)
        expect(points).toHaveLength(164)
        const codes = points.map((point) => point.properties.code)
        for (const code of [...NEVER, 'IL', 'PS']) expect(codes).not.toContain(code)
        expect(points[0]?.properties.code).toBe('TR')
        expect(points[0]?.properties.rank).toBe(0)
        for (const point of points) {
          const { code } = point.properties
          const row = COUNTRY_LABEL_PLACEMENTS[locale][code]
          const placement = row?.[compact ? 'compact' : 'regular']
          if (!row || !placement) throw new Error(code)
          expect([point.lon, point.lat, point.properties.fitZoom]).toEqual([...placement])
          expect(point.properties.name).toBe(row.name)
          expect(point.properties.label).toBe(countryLabelLines(row.name, locale).join('\n'))
          expect(point.properties.tier).toBe(tierOf(code))
        }
        const ranks = points.map((point) => point.properties.rank)
        expect(ranks).toEqual(ranks.toSorted((a, b) => a - b))
      }
    }
  })

  it('özellikler: kod, ad, satırlar, kademe, ilk yakınlaştırma, sıra; ad sayfanın dilinde', () => {
    const tr = countryLabelPoints('tr', false)
    const en = countryLabelPoints('en', false)
    const turkey = tr[0]
    expect(turkey?.properties).toEqual({
      code: 'TR',
      name: 'TÜRKİYE',
      label: 'TÜRKİYE',
      tier: 1,
      fitZoom: COUNTRY_LABEL_PLACEMENTS.tr.TR?.regular?.[2],
      rank: 0,
    })
    const ba = en.find((point) => point.properties.code === 'BA')
    expect(ba?.properties).toMatchObject({
      name: 'BOSNIA AND HERZEGOVINA',
      label: 'BOSNIA AND\nHERZEGOVINA',
    })
    expect(tr.find((point) => point.properties.code === 'BA')?.properties.label).toBe(
      'BOSNA\nHERSEK',
    )
    expect(en.find((point) => point.properties.code === 'TR')?.properties.name).toBe('TÜRKIYE')
    for (const point of [...tr, ...en]) expect(point.properties.name).not.toMatch(/\p{Ll}/u)
  })
})
