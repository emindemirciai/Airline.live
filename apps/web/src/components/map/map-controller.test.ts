import {
  AIRCRAFT_LAYER,
  AIRPORT_LAYER_ID,
  COUNTRY_LABEL_LAYER_IDS,
  LIVE_MAP_LAYERS,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { clampViewport } from '../../lib/live/connection'
import { INITIAL_BOUNDS, INITIAL_MAX_ZOOM, initialZoom, PRIMARY_AIRPORT_VIEW } from './camera'
import { DEFAULT_LABEL_SETTINGS } from '../../lib/map/label-settings'
import {
  iconScaleAt,
  mapPadding,
  NO_INSETS,
  NO_PANELS,
  overlayLayers,
  resolveHit,
  sameViewState,
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

  it('yakınlaştırma: masaüstünde 8,5; telefonda kısa kenar ~100 km kapsar', () => {
    expect(initialZoom(1280, 720)).toBe(INITIAL_MAX_ZOOM)
    expect(initialZoom(1920, 1080)).toBe(INITIAL_MAX_ZOOM)
    const phone = initialZoom(375, 812)
    expect(phone).toBeGreaterThan(7.5)
    expect(phone).toBeLessThan(8)
    // 375 px'in kapsadığı mesafe ~100 km (Web Mercator, LTFM enlemi).
    const metersPerPixel = (40_075_016.686 * Math.cos((41.2753 * Math.PI) / 180)) / 512 / 2 ** phone
    expect(metersPerPixel * 375).toBeGreaterThan(90_000)
    expect(metersPerPixel * 375).toBeLessThan(110_000)
    expect(initialZoom(0, 0)).toBe(7)
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
    locale: 'tr',
    units: 'metric',
    insets: NO_INSETS,
    panels: NO_PANELS,
  }

  it('etiket ayarının her alanı yeniden çizim ister: havalimanı etiketi dahil', () => {
    expect(sameViewState(base, { ...base, labelSettings: { ...DEFAULT_LABEL_SETTINGS } })).toBe(
      true,
    )
    for (const change of [
      { selected: 'short' },
      { others: 'hidden' },
      { airports: 'hidden' },
      { countries: 'hidden' },
    ] as const) {
      const next = { ...base, labelSettings: { ...DEFAULT_LABEL_SETTINGS, ...change } }
      expect(sameViewState(base, next), JSON.stringify(change)).toBe(false)
    }
    expect(sameViewState(base, { ...base, locale: 'en' })).toBe(false)
  })
})

describe('kendi katmanlarımızın sırası (D-095)', () => {
  it('ülke adları (kademe 3, 2, 1) havalimanı pinlerinin altında; sonra canlı katmanlar', () => {
    for (const compact of [false, true]) {
      const ids = overlayLayers({ compact }).map((layer) => layer.id)
      expect(ids).toEqual([...COUNTRY_LABEL_LAYER_IDS, ...LIVE_MAP_LAYERS.map((layer) => layer.id)])
      expect(ids.indexOf('hy-country-labels-1')).toBeLessThan(ids.indexOf(AIRPORT_LAYER_ID))
    }
    const hidden = overlayLayers({ compact: false, visible: false })
    const visibility = (layer: object) =>
      (layer as { layout?: { visibility?: string } }).layout?.visibility
    expect(hidden.map(visibility)).toEqual([
      'none',
      'none',
      'none',
      undefined,
      undefined,
      undefined,
    ])
  })
})

describe('panel payı (D-085)', () => {
  const base: MapViewState = {
    selectedHex: null,
    following: false,
    labelSettings: DEFAULT_LABEL_SETTINGS,
    airports: [],
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
