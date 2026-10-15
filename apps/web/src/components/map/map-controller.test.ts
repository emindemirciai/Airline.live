import {
  AIRCRAFT_LAYER,
  AIRPORT_LAYER_ID,
  COUNTRY_LABEL_LAYER_IDS,
  LIVE_MAP_LAYERS,
  type Airport,
} from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import { clampViewport } from '../../lib/live/connection'
import { INITIAL_BOUNDS, INITIAL_MAX_ZOOM, initialZoom, PRIMARY_AIRPORT_VIEW } from './camera'
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

describe('sameViewState (D-084)', () => {
  const base: MapViewState = {
    selectedHex: null,
    following: false,
    labelSettings: DEFAULT_LABEL_SETTINGS,
    airports: [],
    popupIcao: null,
    locale: 'tr',
    units: 'metric',
    insets: NO_INSETS,
    panels: NO_PANELS,
  }

  it('etiket ayarının her alanı yeniden çizim ister: havalimanı etiketi ve simgeleri dahil', () => {
    expect(sameViewState(base, { ...base, labelSettings: { ...DEFAULT_LABEL_SETTINGS } })).toBe(
      true,
    )
    for (const change of [
      { selected: 'short' },
      { others: 'hidden' },
      { airports: 'hidden' },
      { airportIcons: 'hidden' },
      { countries: 'hidden' },
    ] as const) {
      const next = { ...base, labelSettings: { ...DEFAULT_LABEL_SETTINGS, ...change } }
      expect(sameViewState(base, next), JSON.stringify(change)).toBe(false)
    }
    expect(sameViewState(base, { ...base, locale: 'en' })).toBe(false)
  })

  it('açık pencere de karşılaştırılır (simgeler gizliyken onun havalimanı çizilir, D-113)', () => {
    expect(sameViewState({ ...base, popupIcao: 'LTFM' }, { ...base, popupIcao: 'LTFM' })).toBe(true)
    expect(sameViewState(base, { ...base, popupIcao: 'LTFM' })).toBe(false)
    expect(sameViewState({ ...base, popupIcao: 'LTFM' }, { ...base, popupIcao: 'LTFJ' })).toBe(
      false,
    )
  })
})

describe('drawnAirports: havalimanı simgeleri gizlenebilir (D-113)', () => {
  const ltfm = { icao: 'LTFM', iata: 'IST', lat: 41.26, lon: 28.73 } as Airport
  const ltfj = { icao: 'LTFJ', iata: 'SAW', lat: 40.9, lon: 29.31 } as Airport
  const egll = { icao: 'EGLL', iata: 'LHR', lat: 51.47, lon: -0.45 } as Airport
  const airports = [ltfm, ltfj, egll]
  const shown = { airportIcons: 'shown' } as const
  const hidden = { airportIcons: 'hidden' } as const

  it('simgeler açıkken bütün liste aynı başvuruyla çizilir; açık pencere bir şey değiştirmez', () => {
    expect(drawnAirports(airports, shown, null)).toBe(airports)
    expect(drawnAirports(airports, shown, 'LTFJ')).toBe(airports)
    expect(drawnAirports(airports, DEFAULT_LABEL_SETTINGS, null)).toBe(airports)
  })

  it('simgeler gizliyken hiçbiri çizilmez; yalnız açık pencerenin havalimanı çizilir', () => {
    expect(drawnAirports(airports, hidden, null)).toEqual([])
    expect(drawnAirports(airports, hidden, 'LTFJ')).toEqual([ltfj])
    expect(drawnAirports(airports, hidden, 'LTFJ')[0]).toBe(ltfj)
    // Listede olmayan kod (ör. askerî üs, D-107): hiçbiri.
    expect(drawnAirports(airports, hidden, 'LTBL')).toEqual([])
    expect(drawnAirports([], hidden, 'LTFM')).toEqual([])
  })

  it('pin kaynağı yalnız çizilen liste değişince yenilenir (sameAirportList)', () => {
    const open = drawnAirports(airports, hidden, 'LTFM')
    // Her çizimde yeni dizi ama aynı havalimanı: kaynak yenilenmez.
    expect(sameAirportList(open, drawnAirports(airports, hidden, 'LTFM'))).toBe(true)
    expect(sameAirportList(drawnAirports(airports, hidden, null), [])).toBe(true)
    // Pencere kapandı, başka havalimanı açıldı, simgeler geri geldi: yenilenir.
    expect(sameAirportList(open, drawnAirports(airports, hidden, null))).toBe(false)
    expect(sameAirportList(open, drawnAirports(airports, hidden, 'LTFJ'))).toBe(false)
    expect(sameAirportList(open, drawnAirports(airports, shown, 'LTFM'))).toBe(false)
    expect(sameAirportList(airports, drawnAirports(airports, shown, null))).toBe(true)
    // Yeniden yüklenen liste (yeni nesneler) yenilenir.
    expect(
      sameAirportList(
        airports,
        airports.map((a) => ({ ...a })),
      ),
    ).toBe(false)
  })

  it('kodlar da yalnız çizilen havalimanları için izdüşürülür (screenAirports)', () => {
    const project = vi.fn(([lon, lat]: [number, number]) => ({ x: lon * 10, y: lat * 10 }))
    const inView = (x: number, y: number) => x >= 0 && x <= 500 && y >= 0 && y <= 500
    const settings = { ...DEFAULT_LABEL_SETTINGS, airportIcons: 'hidden' } as const
    expect(
      screenAirports(project, drawnAirports(airports, settings, null), 9, settings, inView),
    ).toEqual([])
    expect(project).not.toHaveBeenCalled()
    const open = screenAirports(
      project,
      drawnAirports(airports, settings, 'LTFM'),
      9,
      settings,
      inView,
    )
    expect(open.map((item) => item.airport.icao)).toEqual(['LTFM'])
    expect(project).toHaveBeenCalledTimes(1)
    // Açık pencerenin havalimanının kodu da etiket ayarına uyar: Gizle'de yazılmaz.
    const noCodes = { ...settings, airports: 'hidden' } as const
    expect(
      screenAirports(project, drawnAirports(airports, noCodes, 'LTFM'), 9, noCodes, inView),
    ).toEqual([])
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

  it('z4 ya da ayar Gizle: hiçbir havalimanı izdüşürülmez', () => {
    expect(AIRPORT_LABEL_MIN_ZOOM).toBe(5)
    const { project, inView } = setup()
    expect(screenAirports(project, airports, 4, DEFAULT_LABEL_SETTINGS, inView)).toEqual([])
    expect(screenAirports(project, airports, 4.99, { airports: 'code' }, inView)).toEqual([])
    expect(screenAirports(project, airports, 9, { airports: 'hidden' }, inView)).toEqual([])
    expect(project).not.toHaveBeenCalled()
  })

  it('z5 ve ayar Kod: her havalimanı bir kez izdüşürülür, görünümdekiler döner', () => {
    const { project, inView } = setup()
    const screen = screenAirports(project, airports, 5, { airports: 'code' }, inView)
    expect(project).toHaveBeenCalledTimes(3)
    expect(screen.map((item) => item.airport.icao)).toEqual(['LTFM', 'LTBA'])
    expect(screen[0]?.x).toBeCloseTo(287.3, 6)
    expect(screen[0]?.y).toBeCloseTo(412.6, 6)
  })
})
