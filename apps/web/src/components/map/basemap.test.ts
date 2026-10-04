import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  AIRCRAFT_LAYER_ID,
  AIRPORT_LAYER_ID,
  COUNTRY_BORDER_CASING_LAYER_ID,
  COUNTRY_BORDER_DASH,
  COUNTRY_BORDER_DISPUTED_LAYER_ID,
  COUNTRY_BORDER_FILTER,
  COUNTRY_BORDER_LAYER_ID,
  COUNTRY_BORDER_SOURCE_ID,
  DISPUTED_BORDER_DASH,
  LIVE_MAP_LAYERS,
  TRAIL_LAYER_ID,
  countryBorderLayers,
} from '@havayolu/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ESRI_ATTRIBUTION,
  OPENFREEMAP_ATTRIBUTION,
  OPENFREEMAP_TILEJSON_URL,
  resolveMapConfig,
  type Basemap,
} from '../../lib/map-config'
import {
  BASEMAP_MAX_FAILURES,
  BasemapController,
  NON_BASEMAP_SOURCES,
  SATELLITE_SOURCE_ID,
  STYLE_LOAD_TIMEOUT_MS,
  STYLE_RETRY_DELAY_MS,
  basemapSteps,
  fetchStyle,
  plainStyle,
  prepareFetchedStyle,
  roadLayerIds,
  satelliteStyle,
  withAttribution,
  withCountryBorders,
  type BasemapStep,
  type MapStyle,
} from './basemap'

const resolveUrl = (url: string) => new URL(url, 'http://localhost:3100/').href

const borders = { url: OPENFREEMAP_TILEJSON_URL, attribution: OPENFREEMAP_ATTRIBUTION }

const satellite = {
  kind: 'satellite',
  tilesUrl: 'https://tiles.example/{z}/{y}/{x}?token=k',
  attribution: ESRI_ATTRIBUTION,
  fallbackStyleUrl: 'https://tiles.openfreemap.org/styles/dark',
  vectorFallbackStyleUrl: null,
  hideRoads: true,
  countryBorders: borders,
} satisfies Basemap

describe('basemapSteps', () => {
  it('uydu: Esri raster stili, sonra koyu vektör yedek (yollar gizli), sonra düz arka plan', () => {
    const steps = basemapSteps(satellite, resolveUrl)
    expect(steps).toHaveLength(3)
    const [first, second, last] = steps
    expect(first?.style).toEqual(satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, borders))
    expect(first?.hideRoads).toBe(false)
    expect(second).toEqual({
      style: 'https://tiles.openfreemap.org/styles/dark',
      hideRoads: true,
      attribution: OPENFREEMAP_ATTRIBUTION,
      countryBorders: true,
      plain: false,
    })
    expect(last).toEqual({
      style: plainStyle(),
      hideRoads: false,
      attribution: null,
      countryBorders: false,
      plain: true,
    })
  })

  it('uydu: koyu vektör stilden sonra MAP_STYLE_FALLBACK_URL (kendi atfı, yollar gizli) denenir', () => {
    const steps = basemapSteps(
      { ...satellite, vectorFallbackStyleUrl: 'https://maps.example/protomaps.json' },
      resolveUrl,
    )
    expect(steps.map((step) => [step.style, step.hideRoads, step.attribution, step.plain])).toEqual(
      [
        [satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, borders), false, null, false],
        ['https://tiles.openfreemap.org/styles/dark', true, OPENFREEMAP_ATTRIBUTION, false],
        ['https://maps.example/protomaps.json', true, null, false],
        [plainStyle(), false, null, true],
      ],
    )
  })

  it('uydu yedeksizse doğrudan düz arka plana düşer', () => {
    const steps = basemapSteps({ ...satellite, fallbackStyleUrl: null }, resolveUrl)
    expect(steps.map((step) => step.plain)).toEqual([false, true])
  })

  it('vektör: stil (atıf yazılır), MAP_STYLE_FALLBACK_URL (kendi atfı), düz arka plan', () => {
    const steps = basemapSteps(
      {
        kind: 'vector',
        styleUrl: 'https://tiles.openfreemap.org/styles/dark',
        fallbackStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
        hideRoads: true,
        attribution: OPENFREEMAP_ATTRIBUTION,
      },
      resolveUrl,
    )
    expect(steps.map((step) => [step.style, step.hideRoads, step.attribution])).toEqual([
      ['https://tiles.openfreemap.org/styles/dark', true, OPENFREEMAP_ATTRIBUTION],
      ['https://tiles.openfreemap.org/styles/liberty', true, null],
      [plainStyle(), false, null],
    ])
  })

  it('yerel stil sayfaya göre mutlaklaşır; dış istek yoktur', () => {
    const config = resolveMapConfig({
      API_HOST: 'localhost:4100',
      MAP_STYLE_URL: '/test-style.json',
      EXTERNAL_PROVIDERS_DISABLED: true,
    })
    const steps = basemapSteps(config.basemap, resolveUrl)
    expect(steps.map((step) => step.style)).toEqual([
      'http://localhost:3100/test-style.json',
      plainStyle(),
    ])
    expect(steps[0]?.attribution).toBeNull()
  })

  it('uydu stili: 256 px raster karo, en fazla z19, atıf kaynakta; glif ve sprite yok', () => {
    const style = satelliteStyle('https://t/{z}/{y}/{x}', 'Powered by Esri', null)
    expect(style.sources.satellite).toEqual({
      type: 'raster',
      tiles: ['https://t/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Powered by Esri',
    })
    expect(style.layers.map((layer) => layer.type)).toEqual(['background', 'raster'])
    expect(style).not.toHaveProperty('glyphs')
    expect(style).not.toHaveProperty('sprite')
  })

  it('düz arka plan tek bir koyu katmandır', () => {
    expect(plainStyle()).toEqual({
      version: 8,
      sources: {},
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#0B1016' } }],
    })
  })
})

describe('roadLayerIds ve withAttribution', () => {
  it('yalnızca transportation ve transportation_name katmanlarını seçer (aeroway kalır)', () => {
    const layers = [
      { id: 'background', type: 'background' },
      { id: 'road_major', type: 'line', 'source-layer': 'transportation' },
      { id: 'road_label', type: 'symbol', 'source-layer': 'transportation_name' },
      { id: 'aeroway_runway', type: 'line', 'source-layer': 'aeroway' },
      { id: 'water', type: 'fill', 'source-layer': 'water' },
    ]
    expect(roadLayerIds(layers)).toEqual(['road_major', 'road_label'])
  })

  it('karo kaynaklarının atfını değiştirir, GeoJSON kaynağına dokunmaz', () => {
    const style: MapStyle = {
      version: 8,
      sources: {
        openmaptiles: { type: 'vector', url: 'https://t/planet', attribution: 'eski' },
        points: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      },
      layers: [],
    }
    const result = withAttribution(style, 'yeni')
    expect(result.sources.openmaptiles).toEqual({
      type: 'vector',
      url: 'https://t/planet',
      attribution: 'yeni',
    })
    expect(result.sources.points).toBe(style.sources.points)
    expect(style.sources.openmaptiles).toHaveProperty('attribution', 'eski')
  })
})

/** Yerel test stili (`apps/web/public/test-style.json`): geliştirme, testler ve CI bununla açılır. */
function testStyle(): MapStyle {
  const path = fileURLToPath(new URL('../../../public/test-style.json', import.meta.url))
  return JSON.parse(readFileSync(path, 'utf8')) as MapStyle
}

/**
 * OpenFreeMap koyu stilinin (`openfreemap-styles` deposu, `styles/dark/style.json`) katman düzeninin
 * özeti: il sınırı kesikli gri, ülke sınırı düz gri (iki yakınlaştırma aralığı), üstünde yer adları.
 */
function darkStyle(): MapStyle {
  const boundary = { type: 'line', source: 'openmaptiles', 'source-layer': 'boundary' } as const
  return {
    version: 8,
    sources: {
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
      {
        id: 'highway_major_inner',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
      },
      {
        ...boundary,
        id: 'boundary_state',
        filter: ['==', ['get', 'admin_level'], 4],
        paint: { 'line-color': 'hsl(0,0%,21%)', 'line-dasharray': [2, 2] },
      },
      {
        ...boundary,
        id: 'boundary_country_z0-4',
        maxzoom: 5,
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!', ['has', 'claimed_by']]],
        paint: { 'line-color': 'hsl(0,0%,23%)' },
      },
      {
        ...boundary,
        id: 'boundary_country_z5-',
        minzoom: 5,
        filter: ['==', ['get', 'admin_level'], 2],
        paint: { 'line-color': 'hsl(0,0%,23%)' },
      },
      {
        id: 'place_country_major',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        layout: { 'text-field': '{name}' },
      },
    ],
  }
}

const BORDER_LAYER_IDS = [
  COUNTRY_BORDER_CASING_LAYER_ID,
  COUNTRY_BORDER_LAYER_ID,
  COUNTRY_BORDER_DISPUTED_LAYER_ID,
]

/** Stilin karo kaynaklarının atıfları (MapLibre şeride, kaynağı kullanan katman görünürken koyar). */
function sourceAttributions(style: MapStyle): string[] {
  return Object.values(style.sources).flatMap((source) =>
    'attribution' in source && typeof source.attribution === 'string' ? [source.attribution] : [],
  )
}

describe('ülke sınırları (D-092)', () => {
  it('uydu stili: OpenFreeMap TileJSON’undan ayrı vektör kaynak, en büyük karo z10, atıf kaynakta', () => {
    const style = satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, borders)
    expect(Object.keys(style.sources)).toEqual([SATELLITE_SOURCE_ID, COUNTRY_BORDER_SOURCE_ID])
    expect(style.sources[COUNTRY_BORDER_SOURCE_ID]).toEqual({
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
      maxzoom: 10,
      attribution: OPENFREEMAP_ATTRIBUTION,
    })
    expect(OPENFREEMAP_TILEJSON_URL).toBe('https://tiles.openfreemap.org/planet')
    // Raster kaynak değişmedi; glif ve sprite yine yok (sınır katmanları metin çizmez).
    expect(style.sources[SATELLITE_SOURCE_ID]).toEqual(
      satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, null).sources[SATELLITE_SOURCE_ID],
    )
    expect(style).not.toHaveProperty('glyphs')
    expect(style).not.toHaveProperty('sprite')
  })

  it('uydu stili: kenar, kesikli ve noktalı katman görüntünün hemen üstünde, boundary süzgeciyle', () => {
    const style = satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, borders)
    expect(style.layers.map((layer) => layer.id)).toEqual([
      'background',
      SATELLITE_SOURCE_ID,
      ...BORDER_LAYER_IDS,
    ])
    expect(style.layers.slice(2)).toEqual(countryBorderLayers(COUNTRY_BORDER_SOURCE_ID))
    for (const layer of style.layers.slice(2)) {
      expect(layer).toMatchObject({
        type: 'line',
        source: COUNTRY_BORDER_SOURCE_ID,
        'source-layer': 'boundary',
      })
      expect(JSON.stringify((layer as { filter?: unknown }).filter)).toContain(
        JSON.stringify(COUNTRY_BORDER_FILTER),
      )
    }
    const [casing, line, disputed] = style.layers.slice(2) as {
      paint: Record<string, unknown>
    }[]
    expect(casing?.paint).not.toHaveProperty('line-dasharray')
    expect(casing?.paint['line-opacity']).toBeLessThan(1)
    expect(line?.paint['line-dasharray']).toEqual(COUNTRY_BORDER_DASH)
    expect(disputed?.paint['line-dasharray']).toEqual(DISPUTED_BORDER_DASH)
  })

  it('sıra: sınırlar görüntünün üstünde; havalimanı pinleri, iz ve uçaklar sınırların üstünde', () => {
    // Denetleyici kendi katmanlarını stil yüklenince `addLayer` ile (beforeId'siz) en üste ekler.
    const order = [
      ...satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, borders).layers.map(
        (layer) => layer.id,
      ),
      ...LIVE_MAP_LAYERS.map((layer) => layer.id),
    ]
    const lastBorder = Math.max(...BORDER_LAYER_IDS.map((id) => order.indexOf(id)))
    const firstBorder = Math.min(...BORDER_LAYER_IDS.map((id) => order.indexOf(id)))
    expect(firstBorder).toBeGreaterThan(order.indexOf(SATELLITE_SOURCE_ID))
    for (const id of [AIRPORT_LAYER_ID, TRAIL_LAYER_ID, AIRCRAFT_LAYER_ID]) {
      expect(order.indexOf(id), id).toBeGreaterThan(lastBorder)
    }
  })

  it('atıf: OpenFreeMap/OpenMapTiles/OSM yalnızca sınırlar açıkken; Esri atfı değişmez', () => {
    const withBorders = sourceAttributions(
      satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, borders),
    )
    expect(withBorders).toEqual([ESRI_ATTRIBUTION, OPENFREEMAP_ATTRIBUTION])
    expect(withBorders[1]).toContain('>OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">')
    expect(withBorders[1]).toContain(
      'Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    )
    const withoutBorders = sourceAttributions(
      satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, null),
    )
    expect(withoutBorders).toEqual([ESRI_ATTRIBUTION])
    expect(withoutBorders.join(' ')).not.toContain('OpenStreetMap')
    // Sınır kaynağını yalnızca sınır katmanları kullanır: atıf, sınırlar çizilirken şeritte durur.
    const users = satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, borders).layers.filter(
      (layer) => (layer as { source?: unknown }).source === COUNTRY_BORDER_SOURCE_ID,
    )
    expect(users.map((layer) => layer.id)).toEqual(BORDER_LAYER_IDS)
  })

  it('adımlar: uydu ve vektör adımlarında sınırlar açık; yerel stil ve düz arka planda kapalı', () => {
    const satelliteSteps = basemapSteps(
      { ...satellite, vectorFallbackStyleUrl: 'https://maps.example/protomaps.json' },
      resolveUrl,
    )
    expect(satelliteSteps.map((step) => [step.plain, step.countryBorders])).toEqual([
      [false, true],
      [false, true],
      [false, true],
      [true, false],
    ])
    const vectorSteps = basemapSteps(
      {
        kind: 'vector',
        styleUrl: 'https://tiles.openfreemap.org/styles/dark',
        fallbackStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
        hideRoads: true,
        attribution: OPENFREEMAP_ATTRIBUTION,
      },
      resolveUrl,
    )
    expect(vectorSteps.map((step) => step.countryBorders)).toEqual([true, true, false])
    const localSteps = basemapSteps(
      resolveMapConfig({
        API_HOST: 'localhost:4100',
        MAP_STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',
        EXTERNAL_PROVIDERS_DISABLED: true,
        ESRI_API_KEY: 'key',
      }).basemap,
      resolveUrl,
    )
    expect(localSteps.map((step) => [step.style, step.countryBorders])).toEqual([
      ['http://localhost:3100/test-style.json', false],
      [plainStyle(), false],
    ])
  })

  it('OpenFreeMap stili: boundary çizgileri çıkar, bizimkiler ilkinin yerine ve stilin kaynağıyla girer', () => {
    const original = darkStyle()
    const result = withCountryBorders(original)
    expect(result.layers.map((layer) => layer.id)).toEqual([
      'background',
      'water',
      'highway_major_inner',
      ...BORDER_LAYER_IDS,
      'place_country_major',
    ])
    expect(result.layers.slice(3, 6)).toEqual(countryBorderLayers('openmaptiles'))
    expect(result.sources).toBe(original.sources)
    // Uydudakiyle aynı görünüm: kaynak dışında her şey (süzgeç, kesik, kenar, kimlik) aynı.
    const withoutSource = (layers: readonly object[]) =>
      layers.map((layer) => ({ ...layer, source: null }))
    expect(withoutSource(result.layers.slice(3, 6))).toEqual(
      withoutSource(satelliteStyle(satellite.tilesUrl, ESRI_ATTRIBUTION, borders).layers.slice(2)),
    )
    // Girdi değişmez.
    expect(original.layers).toHaveLength(7)
    expect(original).toEqual(darkStyle())
  })

  it('withCountryBorders: boundary katmanı olmayan stil olduğu gibi döner; ikinci uygulama bir şey değiştirmez', () => {
    const local = testStyle()
    expect(withCountryBorders(local)).toBe(local)
    const protomaps: MapStyle = {
      version: 8,
      sources: { protomaps: { type: 'vector', url: 'https://maps.example/tiles.json' } },
      layers: [
        { id: 'boundaries', type: 'line', source: 'protomaps', 'source-layer': 'boundaries' },
      ],
    }
    expect(withCountryBorders(protomaps)).toBe(protomaps)
    const once = withCountryBorders(darkStyle())
    expect(withCountryBorders(once)).toEqual(once)
  })

  it('yerel test stili: dış kaynak yok, sınır katmanı yok; hazırlık onu değiştirmez', () => {
    const local = testStyle()
    expect(local.sources).toEqual({})
    expect(local.layers.map((layer) => layer.id)).toEqual(['background'])
    const [localStep] = basemapSteps(
      resolveMapConfig({
        API_HOST: 'localhost:4100',
        MAP_STYLE_URL: '/test-style.json',
        EXTERNAL_PROVIDERS_DISABLED: true,
      }).basemap,
      resolveUrl,
    )
    if (!localStep) throw new Error('local step missing')
    expect(prepareFetchedStyle(local, localStep)).toBe(local)
    // Sınırlar açık bir adımda bile boundary katmanı olmayan stile kaynak eklenmez.
    expect(prepareFetchedStyle(local, { ...localStep, countryBorders: true })).toBe(local)
  })

  it('prepareFetchedStyle: OpenFreeMap yedeğinde sınırlar kesikli olur ve atıf adımınkine döner', () => {
    const [, fallback] = basemapSteps(satellite, resolveUrl)
    if (!fallback) throw new Error('fallback step missing')
    const prepared = prepareFetchedStyle(darkStyle(), fallback)
    expect(prepared.layers.map((layer) => layer.id)).toContain(COUNTRY_BORDER_LAYER_ID)
    expect(prepared.layers.map((layer) => layer.id)).not.toContain('boundary_country_z5-')
    expect(sourceAttributions(prepared)).toEqual([OPENFREEMAP_ATTRIBUTION])
    // Sınırlar kapalı adımda yalnızca atıf yazılır.
    const plainPrepared = prepareFetchedStyle(darkStyle(), { ...fallback, countryBorders: false })
    expect(plainPrepared.layers.map((layer) => layer.id)).toContain('boundary_country_z5-')
  })
})

interface Harness {
  controller: BasemapController
  applied: BasemapStep[]
  failed: boolean[]
  runTimers: () => void
  timers: Map<number, { fn: () => void; ms: number }>
}

function harness(steps: BasemapStep[], basemapSources = new Set(['satellite'])): Harness {
  const applied: BasemapStep[] = []
  const failed: boolean[] = []
  const timers = new Map<number, { fn: () => void; ms: number }>()
  let nextId = 1
  const controller = new BasemapController({
    steps,
    apply: (step) => applied.push(step),
    onFailedChange: (value) => failed.push(value),
    isBasemapSource: (id) => basemapSources.has(id),
    setTimer: (fn, ms) => {
      const id = nextId++
      timers.set(id, { fn, ms })
      return id
    },
    clearTimer: (id) => timers.delete(id as number),
  })
  const runTimers = () => {
    const pending = [...timers.entries()]
    timers.clear()
    for (const [, timer] of pending) timer.fn()
  }
  return { controller, applied, failed, runTimers, timers }
}

describe('BasemapController', () => {
  const steps = basemapSteps(satellite, resolveUrl)

  it('ilk adımı uygular; yüklenince sayaç sıfırlanır, zaman aşımı iptal olur', () => {
    const h = harness(steps)
    h.controller.start()
    expect(h.applied).toEqual([steps[0]])
    expect([...h.timers.values()].map((t) => t.ms)).toEqual([STYLE_LOAD_TIMEOUT_MS])
    h.controller.styleLoaded()
    expect(h.timers.size).toBe(0)
    expect(h.controller.failed).toBe(false)
  })

  it('stil isteği 3 kez başarısız olursa sonraki adıma geçer; arada aynı adım yeniden istenir', () => {
    const h = harness(steps)
    h.controller.start()
    h.controller.error({})
    expect([...h.timers.values()].map((t) => t.ms)).toEqual([STYLE_RETRY_DELAY_MS])
    h.runTimers()
    expect(h.applied).toEqual([steps[0], steps[0]])
    h.controller.error({})
    h.runTimers()
    expect(h.applied).toHaveLength(3)
    h.controller.error({})
    expect(BASEMAP_MAX_FAILURES).toBe(3)
    expect(h.applied).toEqual([steps[0], steps[0], steps[0], steps[1]])
    expect(h.controller.step).toBe(steps[1])
    expect(h.failed).toEqual([])
  })

  it('yanıt vermeyen stil zaman aşımıyla başarısız sayılır', () => {
    const h = harness(steps)
    h.controller.start()
    // zaman aşımı → bekleme → yeniden istek → … üçüncü zaman aşımı sonraki adıma geçirir
    for (let i = 0; i < 2 * BASEMAP_MAX_FAILURES - 1; i++) h.runTimers()
    expect(h.applied).toEqual([steps[0], steps[0], steps[0], steps[1]])
    expect(h.controller.step).toBe(steps[1])
  })

  it('yüklendikten sonra altlık karolarının 3 ardışık hatası sonraki adıma geçirir', () => {
    const h = harness(steps)
    h.controller.start()
    h.controller.styleLoaded()
    h.controller.error({ sourceId: 'satellite' })
    h.controller.error({ sourceId: 'satellite' })
    h.controller.tileLoaded('satellite')
    h.controller.error({ sourceId: 'satellite' })
    h.controller.error({ sourceId: 'satellite' })
    expect(h.controller.step).toBe(steps[0])
    h.controller.error({ sourceId: 'satellite' })
    expect(h.controller.step).toBe(steps[1])
  })

  it('yeni stil yüklenirken önceki stilin geç gelen karo hataları sayılmaz', () => {
    const h = harness(steps)
    h.controller.start()
    h.controller.styleLoaded()
    for (let i = 0; i < BASEMAP_MAX_FAILURES; i++) h.controller.error({ sourceId: 'satellite' })
    expect(h.controller.step).toBe(steps[1])
    for (let i = 0; i < 5; i++) h.controller.error({ sourceId: 'satellite' })
    expect(h.controller.step).toBe(steps[1])
    h.controller.error({})
    expect(h.controller.step).toBe(steps[1])
    expect([...h.timers.values()].map((t) => t.ms)).toEqual([STYLE_RETRY_DELAY_MS])
  })

  it('kendi katmanlarımızın ve kaynaksız hataları yüklü altlığı değiştirmez', () => {
    const h = harness(steps)
    h.controller.start()
    h.controller.styleLoaded()
    for (let i = 0; i < 5; i++) {
      h.controller.error({ sourceId: 'hy-aircraft' })
      h.controller.error({})
    }
    expect(h.controller.step).toBe(steps[0])
  })

  it('uydunun üstündeki sınır kaynağının hataları ve karoları uyduyu değiştirmez (D-092)', () => {
    // Denetleyicinin haritadaki kuralı: kaynak haritada var ve NON_BASEMAP_SOURCES'ta değil.
    const present = new Set([SATELLITE_SOURCE_ID, COUNTRY_BORDER_SOURCE_ID, 'hy-aircraft'])
    const basemapSources = new Set([...present].filter((id) => !NON_BASEMAP_SOURCES.has(id)))
    expect([...basemapSources]).toEqual([SATELLITE_SOURCE_ID])
    const h = harness(steps, basemapSources)
    h.controller.start()
    h.controller.styleLoaded()
    // OpenFreeMap kesintisi: TileJSON ve karo hataları kaynak kimliğiyle gelir, sayılmaz.
    for (let i = 0; i < 5; i++) h.controller.error({ sourceId: COUNTRY_BORDER_SOURCE_ID })
    expect(h.controller.step).toBe(steps[0])
    // Sınır karosunun yüklenmesi uydunun ardışık hata sayacını sıfırlamaz.
    h.controller.error({ sourceId: SATELLITE_SOURCE_ID })
    h.controller.error({ sourceId: SATELLITE_SOURCE_ID })
    h.controller.tileLoaded(COUNTRY_BORDER_SOURCE_ID)
    h.controller.error({ sourceId: SATELLITE_SOURCE_ID })
    expect(h.controller.step).toBe(steps[1])
  })

  it('son adım düz arka plandır: şerit açılır, sonraki hatalar yok sayılır', () => {
    const h = harness(steps, new Set(['satellite', 'openmaptiles']))
    h.controller.start()
    for (let i = 0; i < BASEMAP_MAX_FAILURES; i++) {
      h.controller.error({})
      h.runTimers()
    }
    h.controller.styleLoaded()
    for (let i = 0; i < BASEMAP_MAX_FAILURES; i++) h.controller.error({ sourceId: 'openmaptiles' })
    expect(h.controller.step.plain).toBe(true)
    expect(h.controller.failed).toBe(true)
    expect(h.failed).toEqual([true])
    expect(h.timers.size).toBe(0)
    h.controller.error({})
    expect(h.applied.at(-1)?.plain).toBe(true)
    expect(h.applied).toHaveLength(5)
  })

  it('durdurulunca zamanlayıcılar iptal olur ve olaylar yok sayılır', () => {
    const h = harness(steps)
    h.controller.start()
    h.controller.stop()
    expect(h.timers.size).toBe(0)
    for (let i = 0; i < 5; i++) h.controller.error({})
    expect(h.applied).toHaveLength(1)
  })

  it('boş adım listesi kabul edilmez', () => {
    expect(() => harness([])).toThrow()
  })
})

describe('fetchStyle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const respond = (status: number, body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status }))

  it('stil nesnesini döndürür', async () => {
    const fetchMock = respond(200, plainStyle())
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchStyle('http://localhost:3100/test-style.json')).resolves.toEqual(plainStyle())
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3100/test-style.json', {
      signal: undefined,
      headers: { accept: 'application/json' },
    })
  })

  it('başarısız istekte ve bozuk stilde hata fırlatır', async () => {
    vi.stubGlobal('fetch', respond(404, {}))
    await expect(fetchStyle('http://x/missing.json')).rejects.toThrow(/404/)
    vi.stubGlobal('fetch', respond(200, { version: 7, sources: {}, layers: [] }))
    await expect(fetchStyle('http://x/old.json')).rejects.toThrow(/shape/)
    vi.stubGlobal('fetch', respond(200, { version: 8, layers: [] }))
    await expect(fetchStyle('http://x/no-sources.json')).rejects.toThrow(/shape/)
  })
})
