import { readFileSync } from 'node:fs'
import {
  AIRCRAFT_LAYER,
  AIRPORT_LAYER_ID,
  COUNTRY_LABEL_LAYER_IDS,
  LIVE_MAP_LAYERS,
  type Airport,
} from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import { clampViewport } from '../../lib/live/connection'
import {
  INITIAL_BOUNDS,
  INITIAL_MAX_ZOOM,
  initialZoom,
  nearestWorldLon,
  PRIMARY_AIRPORT_VIEW,
} from './camera'
import { DEFAULT_LABEL_SETTINGS } from '../../lib/map/label-settings'
import { AIRPORT_LABEL_MIN_ZOOM } from './labels'
import {
  drawnAirports,
  iconScaleAt,
  mapPadding,
  NO_INSETS,
  NO_PANELS,
  overlayLayers,
  resolveHit,
  sameAirportList,
  sameViewState,
  screenAirports,
  type HitCandidates,
  type MapViewState,
} from './map-controller'

describe('iconScaleAt', () => {
  it('paylaşılan uçak katmanının icon-size ifadesini izler (z4 0,55 → z10 1)', () => {
    expect(AIRCRAFT_LAYER.layout['icon-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      0.55,
      10,
      1,
    ])
    expect(iconScaleAt(2)).toBe(0.55)
    expect(iconScaleAt(4)).toBe(0.55)
    expect(iconScaleAt(7)).toBeCloseTo(0.775, 9)
    expect(iconScaleAt(10)).toBe(1)
    expect(iconScaleAt(16)).toBe(1)
  })

  it('çok duraklı ifadede doğru aralığı kullanır; sabit ve tanınmayan değerlerde düşmez', () => {
    const expression = ['interpolate', ['linear'], ['zoom'], 0, 0.5, 5, 1, 10, 2]
    expect(iconScaleAt(2.5, expression)).toBeCloseTo(0.75, 9)
    expect(iconScaleAt(7.5, expression)).toBeCloseTo(1.5, 9)
    expect(iconScaleAt(3, 0.8)).toBe(0.8)
    expect(iconScaleAt(3, ['step', ['zoom'], 1, 5, 2])).toBe(1)
    expect(iconScaleAt(3, null)).toBe(1)
  })
})

describe('açılış görünümü (IST/LTFM, D-079)', () => {
  it('ilk abonelik kutusu IST çevresidir ve API görünüm sınırının içindedir', () => {
    expect(clampViewport(INITIAL_BOUNDS)).toEqual(INITIAL_BOUNDS)
    const { lat, lon } = PRIMARY_AIRPORT_VIEW
    expect(INITIAL_BOUNDS.minLat).toBeLessThan(lat)
    expect(INITIAL_BOUNDS.maxLat).toBeGreaterThan(lat)
    expect(INITIAL_BOUNDS.minLon).toBeLessThan(lon)
    expect(INITIAL_BOUNDS.maxLon).toBeGreaterThan(lon)
    expect([lat, lon]).toEqual([41.2753, 28.7519])
  })

  it('yakınlaştırma: masaüstünde 8 (D-104); telefonda kısa kenar ~100 km kapsar', () => {
    expect(INITIAL_MAX_ZOOM).toBe(8)
    expect(initialZoom(1280, 720)).toBe(8)
    expect(initialZoom(1920, 1080)).toBe(8)
    expect(initialZoom(1915, 910)).toBe(8)
    const phone = initialZoom(375, 812)
    expect(phone).toBeGreaterThan(7.5)
    expect(phone).toBeLessThan(8)
    // 375 px'in kapsadığı mesafe ~100 km (Web Mercator, LTFM enlemi).
    const metersPerPixel = (40_075_016.686 * Math.cos((41.2753 * Math.PI) / 180)) / 512 / 2 ** phone
    expect(metersPerPixel * 375).toBeGreaterThan(90_000)
    expect(metersPerPixel * 375).toBeLessThan(110_000)
    expect(initialZoom(0, 0)).toBe(7)
  })

  it('açılış kutusu 1920×1080 ekrandaki açılış görünümünü kapsar', () => {
    const zoom = initialZoom(1920, 1080)
    const world = 512 * 2 ** zoom
    const { lat, lon } = PRIMARY_AIRPORT_VIEW
    // Web Mercator: ortadan yarım genişlik ve yarım yükseklik kadar uzaktaki boylam ve enlemler.
    const y = (latitude: number) =>
      ((1 - Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) / Math.PI) / 2) * world
    const latAt = (py: number) =>
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / world))) * 180) / Math.PI
    const halfLon = (960 / world) * 360
    expect(INITIAL_BOUNDS.minLon).toBeLessThan(lon - halfLon)
    expect(INITIAL_BOUNDS.maxLon).toBeGreaterThan(lon + halfLon)
    expect(INITIAL_BOUNDS.maxLat).toBeGreaterThan(latAt(y(lat) - 540))
    expect(INITIAL_BOUNDS.minLat).toBeLessThan(latAt(y(lat) + 540))
  })
})

describe('resolveHit: tıklama önceliği (D-079)', () => {
  const none: HitCandidates = {
    label: null,
    airborne: null,
    chip: null,
    pin: null,
    ground: null,
    near: null,
  }
  const hit = (c: Partial<HitCandidates>) => resolveHit({ ...none, ...c })

  it('havadaki uçağın simgesi pin ve koddan önce gelir; etiket hepsinden önce', () => {
    expect(hit({ airborne: 'air', pin: 'LTFM', chip: 'LTFM' })).toEqual({
      kind: 'aircraft',
      hex: 'air',
    })
    expect(hit({ label: 'lbl', airborne: 'air', chip: 'LTFM' })).toEqual({
      kind: 'aircraft',
      hex: 'lbl',
    })
  })

  it('pin ya da kod yerdeki uçaktan önce gelir (apronda havalimanı penceresi açılır)', () => {
    expect(hit({ pin: 'LTFM', ground: 'taxi' })).toEqual({ kind: 'airport', icao: 'LTFM' })
    expect(hit({ chip: 'LTFM', ground: 'taxi', near: 'taxi' })).toEqual({
      kind: 'airport',
      icao: 'LTFM',
    })
  })

  it('yerdeki uçak dokunma payından önce; pay en sonda; boş yer null', () => {
    expect(hit({ ground: 'taxi', near: 'other' })).toEqual({ kind: 'aircraft', hex: 'taxi' })
    expect(hit({ pin: 'LTFJ', near: 'air' })).toEqual({ kind: 'airport', icao: 'LTFJ' })
    expect(hit({ near: 'air' })).toEqual({ kind: 'aircraft', hex: 'air' })
    expect(hit({})).toBeNull()
  })
})

describe('sameViewState (D-084, D-114)', () => {
  const base: MapViewState = {
    selectedHex: null,
    following: false,
    labelSettings: DEFAULT_LABEL_SETTINGS,
    airports: [],
    popupIcao: null,
    linkIcao: null,
    locale: 'tr',
    units: 'metric',
    insets: NO_INSETS,
    panels: NO_PANELS,
  }

  it('etiket ayarının her alanı yeniden çizim ister: havalimanları ayarının her değeri dahil', () => {
    expect(sameViewState(base, { ...base, labelSettings: { ...DEFAULT_LABEL_SETTINGS } })).toBe(
      true,
    )
    for (const change of [
      { selected: 'short' },
      { others: 'hidden' },
      { airportDisplay: 'icon' },
      { airportDisplay: 'hidden' },
      { countries: 'hidden' },
    ] as const) {
      const next = { ...base, labelSettings: { ...DEFAULT_LABEL_SETTINGS, ...change } }
      expect(sameViewState(base, next), JSON.stringify(change)).toBe(false)
    }
    expect(sameViewState(base, { ...base, locale: 'en' })).toBe(false)
  })

  it('açık pencere ve `?havalimani=` hedefi de karşılaştırılır (Gizle’de onlar çizilir)', () => {
    for (const key of ['popupIcao', 'linkIcao'] as const) {
      expect(sameViewState({ ...base, [key]: 'LTFM' }, { ...base, [key]: 'LTFM' }), key).toBe(true)
      expect(sameViewState(base, { ...base, [key]: 'LTFM' }), key).toBe(false)
      expect(sameViewState({ ...base, [key]: 'LTFM' }, { ...base, [key]: 'LTFJ' }), key).toBe(false)
    }
    expect(sameViewState({ ...base, popupIcao: 'LTFM' }, { ...base, linkIcao: 'LTFM' })).toBe(false)
  })
})

describe('drawnAirports: havalimanları Gizle / Simge / Simge ve kod (D-114)', () => {
  const ltfm = { icao: 'LTFM', iata: 'IST', lat: 41.26, lon: 28.73 } as Airport
  const ltfj = { icao: 'LTFJ', iata: 'SAW', lat: 40.9, lon: 29.31 } as Airport
  const egll = { icao: 'EGLL', iata: 'LHR', lat: 51.47, lon: -0.45 } as Airport
  const airports = [ltfm, ltfj, egll]
  const hidden = { airportDisplay: 'hidden' } as const
  const none = { popupIcao: null, linkIcao: null }
  const popup = (popupIcao: string) => ({ popupIcao, linkIcao: null })
  const link = (linkIcao: string) => ({ popupIcao: null, linkIcao })

  it('Simge ve Simge ve kod: bütün liste aynı başvuruyla çizilir; pencere ve bağlantı bir şey değiştirmez', () => {
    for (const airportDisplay of ['icon', 'icon-code'] as const) {
      for (const kept of [
        none,
        popup('LTFJ'),
        link('EGLL'),
        { popupIcao: 'LTFJ', linkIcao: 'LTFM' },
      ]) {
        expect(drawnAirports(airports, { airportDisplay }, kept), airportDisplay).toBe(airports)
      }
    }
    expect(drawnAirports(airports, DEFAULT_LABEL_SETTINGS, none)).toBe(airports)
  })

  it('Gizle: hiçbiri çizilmez; pencere ve bağlantı yoksa paylaşılan boş liste', () => {
    expect(drawnAirports(airports, hidden, none)).toEqual([])
    expect(drawnAirports(airports, hidden, none)).toBe(drawnAirports([ltfm], hidden, none))
  })

  it('Gizle, istisna 1: açık pencerenin havalimanı (listeden, aramadan ya da önceden pinle açılmış)', () => {
    expect(drawnAirports(airports, hidden, popup('LTFJ'))).toEqual([ltfj])
    expect(drawnAirports(airports, hidden, popup('LTFJ'))[0]).toBe(ltfj)
  })

  it('Gizle, istisna 2: adresteki `?havalimani=` hedefi', () => {
    expect(drawnAirports(airports, hidden, link('LTFM'))).toEqual([ltfm])
    expect(drawnAirports(airports, hidden, link('LTFM'))[0]).toBe(ltfm)
  })

  it('Gizle: ikisi birlikte listedeki sırayla, aynı havalimanıysa bir kez', () => {
    expect(drawnAirports(airports, hidden, { popupIcao: 'EGLL', linkIcao: 'LTFM' })).toEqual([
      ltfm,
      egll,
    ])
    expect(drawnAirports(airports, hidden, { popupIcao: 'LTFM', linkIcao: 'LTFM' })).toEqual([ltfm])
  })

  it('Gizle: listede olmayan kod (ör. askerî üs, D-107) ve boş liste hiçbir şey çizmez', () => {
    expect(drawnAirports(airports, hidden, popup('LTBL'))).toEqual([])
    expect(drawnAirports(airports, hidden, link('LTBL'))).toEqual([])
    expect(drawnAirports(airports, hidden, { popupIcao: 'LTBL', linkIcao: 'LTFJ' })).toEqual([ltfj])
    expect(drawnAirports([], hidden, { popupIcao: 'LTFM', linkIcao: 'LTFM' })).toEqual([])
  })

  it('pin kaynağı yalnız çizilen liste değişince yenilenir (sameAirportList)', () => {
    const open = drawnAirports(airports, hidden, popup('LTFM'))
    // Her güncellemede yeni dizi ama aynı havalimanı: kaynak yenilenmez.
    expect(sameAirportList(open, drawnAirports(airports, hidden, popup('LTFM')))).toBe(true)
    // Pencere kapandı ama bağlantı aynı havalimanını gösteriyor: pin kalır, kaynak yenilenmez.
    expect(sameAirportList(open, drawnAirports(airports, hidden, link('LTFM')))).toBe(true)
    expect(sameAirportList(drawnAirports(airports, hidden, none), [])).toBe(true)
    // Pencere kapandı, başka havalimanı açıldı, Simge'ye geçildi: yenilenir.
    expect(sameAirportList(open, drawnAirports(airports, hidden, none))).toBe(false)
    expect(sameAirportList(open, drawnAirports(airports, hidden, popup('LTFJ')))).toBe(false)
    expect(sameAirportList(open, drawnAirports(airports, { airportDisplay: 'icon' }, none))).toBe(
      false,
    )
    // Simge ile Simge ve kod arasında liste aynıdır: kaynak yenilenmez, yalnız kodlar değişir.
    expect(
      sameAirportList(
        drawnAirports(airports, { airportDisplay: 'icon' }, none),
        drawnAirports(airports, { airportDisplay: 'icon-code' }, none),
      ),
    ).toBe(true)
    // Yeniden yüklenen liste (yeni nesneler) yenilenir.
    expect(
      sameAirportList(
        airports,
        airports.map((a) => ({ ...a })),
      ),
    ).toBe(false)
  })

  it('MapController pin kaynağını ve kodları yalnız çizilen listeyle kurar ve yeniler', () => {
    // Denetleyici MapLibre ister; bağlantı kaynak metninden denetlenir (lazy-chunks.test.ts gibi).
    // Kayıtlı Gizle'yle açılan sayfada kaynak ilk kurulumda da boştur: ham listeyle kurulsaydı bütün
    // pinler ilk pencereye kadar çizilirdi.
    const text = readFileSync(new URL('./map-controller.ts', import.meta.url), 'utf8')
    expect(text).toContain(
      'this.drawn = drawnAirports(options.state.airports, options.state.labelSettings, options.state)',
    )
    expect(text).toContain('[AIRPORT_SOURCE_ID, airportCollection(this.drawn)]')
    expect(text).toContain('const drawn = drawnAirports(next.airports, next.labelSettings, next)')
    expect(text).toContain('setData(airportCollection(drawn))')
    expect(text).not.toMatch(/airportCollection\((?:this\.state|next|previous)\.airports\)/)
    // Kod çizimi de aynı listeden: `screenAirports(project, this.drawn, …)`.
    expect(text).toMatch(/screenAirports\(\s*\(lngLat\) => map\.project\(lngLat\),\s*this\.drawn,/)
  })

  it('kodlar yalnız Simge ve kod’da izdüşürülür; Gizle’de çizilen istisnanın da yalnız pini var', () => {
    const project = vi.fn(([lon, lat]: [number, number]) => ({ x: lon * 10, y: lat * 10 }))
    const inView = (x: number, y: number) => x >= 0 && x <= 500 && y >= 0 && y <= 500
    const both = { popupIcao: 'LTFJ', linkIcao: 'LTFM' }
    // Gizle: istisnalar pin kaynağındadır ama kodları yazılmaz, izdüşüm de yapılmaz.
    expect(drawnAirports(airports, hidden, both)).toEqual([ltfm, ltfj])
    expect(
      screenAirports(project, drawnAirports(airports, hidden, both), 9, hidden, inView, 28.75),
    ).toEqual([])
    // Simge: bütün pinler, hiçbir kod.
    const icon = { airportDisplay: 'icon' } as const
    expect(
      screenAirports(project, drawnAirports(airports, icon, both), 9, icon, inView, 28.75),
    ).toEqual([])
    expect(project).not.toHaveBeenCalled()
    // Simge ve kod: görünümdekilerin kodu.
    const codes = { airportDisplay: 'icon-code' } as const
    const screen = screenAirports(
      project,
      drawnAirports(airports, codes, none),
      9,
      codes,
      inView,
      28.75,
    )
    expect(screen.map((item) => item.airport.icao)).toEqual(['LTFM', 'LTFJ'])
    expect(project).toHaveBeenCalledTimes(3)
  })
})

describe('kendi katmanlarımızın sırası (D-095, D-096)', () => {
  it('ülke adları (40 katman: kademe 3, 2, 1) havalimanı pinlerinin altında; sonra canlı katmanlar', () => {
    for (const compact of [false, true]) {
      const ids = overlayLayers({ compact }).map((layer) => layer.id)
      expect(ids).toEqual([...COUNTRY_LABEL_LAYER_IDS, ...LIVE_MAP_LAYERS.map((layer) => layer.id)])
      expect(ids).toHaveLength(40 + LIVE_MAP_LAYERS.length)
      const lastName = COUNTRY_LABEL_LAYER_IDS.at(-1) ?? ''
      expect(ids.indexOf(lastName)).toBeLessThan(ids.indexOf(AIRPORT_LAYER_ID))
    }
    const hidden = overlayLayers({ compact: false, visible: false })
    const visibility = (layer: object) =>
      (layer as { layout?: { visibility?: string } }).layout?.visibility
    expect(hidden.map(visibility)).toEqual([
      ...COUNTRY_LABEL_LAYER_IDS.map(() => 'none'),
      ...LIVE_MAP_LAYERS.map(() => undefined),
    ])
  })
})

describe('panel payı (D-085)', () => {
  const base: MapViewState = {
    selectedHex: null,
    following: false,
    labelSettings: DEFAULT_LABEL_SETTINGS,
    airports: [],
    popupIcao: null,
    linkIcao: null,
    locale: 'tr',
    units: 'metric',
    insets: NO_INSETS,
    panels: NO_PANELS,
  }

  it('alttaki ve soldaki pay ayrı ayrı yeniden yerleşim ister; aynı değerli yeni nesne istemez', () => {
    expect(sameViewState(base, { ...base, insets: { bottom: 0, left: 0 } })).toBe(true)
    expect(sameViewState(base, { ...base, insets: { bottom: 320, left: 0 } })).toBe(false)
    expect(sameViewState(base, { ...base, insets: { bottom: 0, left: 400 } })).toBe(false)
  })

  it('panel dikdörtgenleri (seçili etiket örtmez) başvuruyla karşılaştırılır', () => {
    const panels = [{ x: 404, y: 12, width: 352, height: 442 }]
    expect(sameViewState({ ...base, panels }, { ...base, panels })).toBe(true)
    expect(sameViewState(base, { ...base, panels })).toBe(false)
    expect(sameViewState({ ...base, panels }, { ...base, panels: [...panels] })).toBe(false)
  })

  it('MapLibre dolgusu: üst ve sağ 0, alt ve sol paydan; negatif pay 0', () => {
    expect(mapPadding({ bottom: 320, left: 0 })).toEqual({ top: 0, right: 0, bottom: 320, left: 0 })
    expect(mapPadding({ bottom: 0, left: 400 })).toEqual({ top: 0, right: 0, bottom: 0, left: 400 })
    expect(mapPadding({ bottom: -5, left: -1 })).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
})

describe('screenAirports: havalimanı izdüşümü yalnız kod yazılacaksa (D-101)', () => {
  const airports = [
    { icao: 'LTFM', lat: 41.26, lon: 28.73 },
    { icao: 'LTBA', lat: 40.98, lon: 28.81 },
    { icao: 'EGLL', lat: 51.47, lon: -0.45 },
  ] as Airport[]
  // Sahte izdüşüm: boylam × 10 → x, enlem × 10 → y; ekran 0–500 px.
  const setup = () => {
    const project = vi.fn(([lon, lat]: [number, number]) => ({ x: lon * 10, y: lat * 10 }))
    const inView = (x: number, y: number) => x >= 0 && x <= 500 && y >= 0 && y <= 500
    return { project, inView }
  }

  it('z4 ya da ayar Simge ya da Gizle: hiçbir havalimanı izdüşürülmez', () => {
    expect(AIRPORT_LABEL_MIN_ZOOM).toBe(5)
    const { project, inView } = setup()
    expect(screenAirports(project, airports, 4, DEFAULT_LABEL_SETTINGS, inView, 28.75)).toEqual([])
    expect(
      screenAirports(project, airports, 4.99, { airportDisplay: 'icon-code' }, inView, 28.75),
    ).toEqual([])
    expect(screenAirports(project, airports, 9, { airportDisplay: 'icon' }, inView, 28.75)).toEqual(
      [],
    )
    expect(
      screenAirports(project, airports, 9, { airportDisplay: 'hidden' }, inView, 28.75),
    ).toEqual([])
    expect(project).not.toHaveBeenCalled()
  })

  it('z5 ve ayar Simge ve kod: her havalimanı bir kez izdüşürülür, görünümdekiler döner', () => {
    const { project, inView } = setup()
    const screen = screenAirports(
      project,
      airports,
      5,
      { airportDisplay: 'icon-code' },
      inView,
      28.75,
    )
    expect(project).toHaveBeenCalledTimes(3)
    expect(screen.map((item) => item.airport.icao)).toEqual(['LTFM', 'LTBA'])
    expect(screen[0]?.x).toBeCloseTo(287.3, 6)
    expect(screen[0]?.y).toBeCloseTo(412.6, 6)
  })

  it('180. meridyen (D-111): 179,5° D ve −179,5°’de z5 kamerada Fiji, Tonga, Samoa ve Wallis kodları görünümde', () => {
    // MapLibre'nin izdüşümü gibi (Web Mercator, dünya 512 × 2^z px) ve onun gibi boylamı sarmadan:
    // 179,5° D'ye bakan kamerada sarılmamış Tonga (−175,15°) x = −15.501 px'e düşerdi (MapLibre
    // 6.11.2 `MercatorTransform` ile aynı sayı); pini 184,85°'de çizilir.
    const width = 1280
    const height = 800
    const world = 512 * 2 ** 5
    const mercatorY = (lat: number) => {
      const sin = Math.sin((lat * Math.PI) / 180)
      return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world
    }
    const camera = (centerLon: number) => ({
      project: ([lon, lat]: [number, number]) => ({
        x: ((lon - centerLon) / 360) * world + width / 2,
        y: mercatorY(lat) - mercatorY(-17) + height / 2,
      }),
      inView: (x: number, y: number) => x >= 0 && x <= width && y >= 0 && y <= height,
    })
    const pacific = [
      { icao: 'NFFN', iata: 'NAN', lat: -17.755, lon: 177.443 },
      { icao: 'NFTF', iata: 'TBU', lat: -21.241, lon: -175.15 },
      { icao: 'NSFA', iata: 'APW', lat: -13.83, lon: -172.008 },
      { icao: 'NLWW', iata: 'WLS', lat: -13.238, lon: -176.199 },
    ] as Airport[]
    const unwrapped = camera(179.5).project([-175.15, -21.241])
    expect(Math.round(unwrapped.x)).toBe(-15501)
    for (const centerLon of [179.5, -179.5]) {
      const { project, inView } = camera(centerLon)
      const screen = screenAirports(
        project,
        pacific,
        5,
        { airportDisplay: 'icon-code' },
        inView,
        centerLon,
      )
      expect(
        screen.map((item) => item.airport.iata),
        String(centerLon),
      ).toEqual(['NAN', 'TBU', 'APW', 'WLS'])
      for (const { airport, x } of screen) {
        expect(x, `${airport.iata} @ ${centerLon}`).toBeGreaterThanOrEqual(0)
        expect(x, `${airport.iata} @ ${centerLon}`).toBeLessThanOrEqual(width)
      }
    }
  })
})

describe('nearestWorldLon (180. meridyen, D-111)', () => {
  it('boylam kameranın ortasına en yakın dünya kopyasına kayar (360’ın katı kadar)', () => {
    expect(nearestWorldLon(-175.15, 179.5)).toBeCloseTo(184.85, 9)
    expect(nearestWorldLon(177.443, -179.5)).toBeCloseTo(-182.557, 9)
    expect(nearestWorldLon(28.75, 28.75)).toBe(28.75)
    expect(nearestWorldLon(-0.45, 28.75)).toBe(-0.45)
    // Sarılmamış kamera (MapLibre `getCenter`, 540° D) da çalışır.
    expect(nearestWorldLon(28.75, 540)).toBeCloseTo(388.75, 9)
    for (const centerLon of [-540, -179.5, 0, 179.5, 359]) {
      for (const lon of [-180, -175.15, 0, 177.443, 180]) {
        const wrapped = nearestWorldLon(lon, centerLon)
        expect(Math.abs(wrapped - centerLon)).toBeLessThanOrEqual(180)
        expect((((wrapped - lon) % 360) + 360) % 360).toBeCloseTo(0, 9)
      }
    }
  })
})
