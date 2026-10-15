import type { Airport } from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_LABEL_SETTINGS, type LabelSettings } from '../../lib/map/label-settings'
import type { TrackedAircraft } from '../../lib/live/store'
import { fixtureListedAirports } from '../../lib/test/ourairports-fixture'
import {
  AIRPORT_LABEL_MIN_ZOOM,
  DEFAULT_PIN_SCALE,
  LabelPainter,
  NORMAL_THEME,
  SELECTED_THEME,
  THY_BAR_WIDTH,
  chipObstacles,
  labelPriority,
  layoutAirportChips,
  measureLabel,
  pinGeometry,
  showsAirportChips,
  type LabelFrame,
  type ScreenAirport,
} from './labels'

/** Eş aralıklı yazı: her karakter yazı boyutunun 0,6'sı. */
const measure = (font: string, text: string) => {
  const size = Number(/(\d+)px/.exec(font)?.[1] ?? 12)
  return text.length * size * 0.6
}

describe('measureLabel', () => {
  it('kısa etiket: tek satır, yan boşluklar', () => {
    const size = measureLabel(
      { primary: 'TK-974', primaryMuted: false, lines: [] },
      NORMAL_THEME,
      false,
      measure,
    )
    expect(size.width).toBe(Math.ceil(6 * 12 * 0.6 + NORMAL_THEME.padX * 2))
    expect(size.height).toBe(
      NORMAL_THEME.padTop + NORMAL_THEME.primaryLine + NORMAL_THEME.padBottom,
    )
  })

  it('tam etiket: en geniş satır belirler; THY şeridi genişliğe eklenir', () => {
    const content = { primary: 'TK-4', primaryMuted: false, lines: ['431 km/sa, 333 m'] }
    const size = measureLabel(content, NORMAL_THEME, true, measure)
    expect(size.width).toBe(Math.ceil(16 * 11 * 0.6 + NORMAL_THEME.padX * 2 + THY_BAR_WIDTH))
    expect(size.height).toBe(
      NORMAL_THEME.padTop +
        NORMAL_THEME.primaryLine +
        NORMAL_THEME.secondaryLine +
        NORMAL_THEME.padBottom,
    )
  })

  it('yazı boyutları okunur kalır: birincil satır en az 11 px, ikinci satır en az 10 px (D-079)', () => {
    const px = (font: string) => Number(/(\d+)px/.exec(font)?.[1])
    for (const theme of [NORMAL_THEME, SELECTED_THEME]) {
      expect(px(theme.primaryFont)).toBeGreaterThanOrEqual(11)
      expect(px(theme.secondaryFont)).toBeGreaterThanOrEqual(10)
      expect(theme.primaryLine).toBeGreaterThan(px(theme.primaryFont))
      expect(theme.secondaryLine).toBeGreaterThan(px(theme.secondaryFont))
    }
    expect(px(NORMAL_THEME.primaryFont)).toBe(12)
  })

  it('seçili etiket daha büyük yazılır', () => {
    const content = { primary: 'TK-4', primaryMuted: false, lines: [] }
    const normal = measureLabel(content, NORMAL_THEME, false, measure)
    const selected = measureLabel(content, SELECTED_THEME, false, measure)
    expect(selected.width).toBeGreaterThan(normal.width)
    expect(selected.height).toBeGreaterThan(normal.height)
  })
})

describe('labelPriority', () => {
  it('seçili > THY > diğer; aynı grupta ekranın ortasına yakın olan önce', () => {
    const selected = labelPriority(true, false, 0, 0, 800, 600)
    const thyEdge = labelPriority(false, true, 0, 0, 800, 600)
    const otherCentre = labelPriority(false, false, 400, 300, 800, 600)
    const otherEdge = labelPriority(false, false, 10, 10, 800, 600)
    expect(selected).toBeGreaterThan(thyEdge)
    expect(thyEdge).toBeGreaterThan(otherCentre)
    expect(otherCentre).toBeGreaterThan(otherEdge)
    expect(otherCentre).toBeLessThan(2)
  })
})

describe('layoutAirportChips', () => {
  const airport = (iata: string, type: Airport['type']): Airport => ({
    icao: `LT${iata}`,
    iata,
    name: iata,
    city: null,
    lat: 0,
    lon: 0,
    elevationFt: null,
    type,
    scheduled: true,
    country: 'TR',
    ring: 0,
    distanceToTrKm: null,
  })
  const at = (iata: string, type: Airport['type'], x: number, y: number): ScreenAirport => ({
    airport: airport(iata, type),
    x,
    y,
  })
  const view = { width: 400, height: 300 }

  it('kodu pin başının sağına koyar, pini örtmez; büyük havalimanı beyaz zeminlidir', () => {
    const [chip] = layoutAirportChips([at('IST', 'large_airport', 100, 100)], view, measure)
    const pin = pinGeometry(100, 100, DEFAULT_PIN_SCALE)
    // Kutu yalnız koddur: 3 × 6,6 + 2 × 5 → 30 px; ad alanı yoktur (D-084, 2026-10-04).
    expect(chip).toMatchObject({ icao: 'LTIST', iata: 'IST', major: true, width: 30, height: 16 })
    expect(Object.keys(chip ?? {}).sort()).toEqual(
      ['height', 'iata', 'icao', 'major', 'width', 'x', 'y'].sort(),
    )
    // Kodun ortası pin başıyla aynı hizada, sol kenarı başın sağında (pinin ucu 100,100'de).
    expect((chip?.y ?? 0) + (chip?.height ?? 0) / 2).toBeCloseTo(pin.headY)
    expect(chip?.x ?? 0).toBeGreaterThan(pin.headX + pin.headRadius)
    expect(chip?.x ?? 0).toBeLessThan(pin.headX + pin.headRadius + 5)
    // Pin kutusu (baş ve uç) kodun dışındadır.
    expect(chip?.y ?? 0).toBeLessThan(100)
    expect((chip?.y ?? 0) + (chip?.height ?? 0)).toBeLessThan(100)
  })

  it('pin ölçeği yakınlaştırmayla büyür; kod pinden uzaklaşır', () => {
    const near = layoutAirportChips(
      [at('IST', 'large_airport', 100, 150)],
      view,
      measure,
      undefined,
      {
        pinScale: 0.45,
      },
    )[0]
    const far = layoutAirportChips(
      [at('IST', 'large_airport', 100, 150)],
      view,
      measure,
      undefined,
      {
        pinScale: 0.9,
      },
    )[0]
    expect(far?.x ?? 0).toBeGreaterThan(near?.x ?? 0)
    expect(far?.y ?? 0).toBeLessThan(near?.y ?? 0)
  })

  it('kod başka bir havalimanının pinini örtmez', () => {
    // SAW'ın pini IST kodunun sağdaki yerinde: IST kodu sola kayar.
    const chips = layoutAirportChips(
      [at('IST', 'large_airport', 100, 100), at('SAW', 'large_airport', 130, 100)],
      view,
      measure,
    )
    const ist = chips.find((chip) => chip.iata === 'IST')
    expect(ist?.x ?? 0).toBeLessThan(100)
  })

  it('yer yoksa sola, üste ya da alta kaydırır; hiçbiri olmazsa yazmaz', () => {
    const chips = layoutAirportChips(
      [
        at('IST', 'large_airport', 100, 100),
        at('ISL', 'medium_airport', 100, 100),
        at('SAW', 'large_airport', 100, 100),
        at('BZI', 'small_airport', 100, 100),
        at('OGU', 'small_airport', 100, 100),
      ],
      view,
      measure,
    )
    // Büyükler önce (IST, SAW), sonra orta (ISL), sonra küçük (BZI); beşincisine yer kalmaz.
    expect(chips.map((chip) => chip.iata)).toEqual(['IST', 'SAW', 'ISL', 'BZI'])
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        const a = chips[i]
        const b = chips[j]
        if (!a || !b) continue
        const overlap =
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        expect(overlap).toBe(false)
      }
    }
  })

  it('uçak simgesini örtmez: sağdaki uçak kodu sola kaydırır, her yan doluysa kod yazılmaz', () => {
    const ist = at('IST', 'large_airport', 100, 100)
    const frameWith = (
      aircraft: { hex: string; x: number; y: number }[],
      trail: { x: number; y: number }[] = [],
    ): LabelFrame => ({
      width: 400,
      height: 300,
      iconRadius: 14,
      zoom: 10,
      aircraft: aircraft.map(({ hex, x, y }) => ({ ac: { hex } as TrackedAircraft, x, y })),
      airports: [ist],
      trail,
      selectedHex: 'sel',
      settings: DEFAULT_LABEL_SETTINGS,
      locale: 'tr',
      units: 'metric',
    })
    // Pistte, havalimanı noktasının 25 px doğusunda iniş yapan uçak (LTFM 18/36 örneği).
    const [left] = layoutAirportChips(
      [ist],
      view,
      measure,
      chipObstacles(frameWith([{ hex: 'a', x: 125, y: 100 }])),
    )
    expect(left?.x).toBeLessThan(100)
    const blocked = chipObstacles(
      frameWith([
        { hex: 'a', x: 125, y: 100 },
        { hex: 'b', x: 75, y: 100 },
        { hex: 'c', x: 100, y: 75 },
        { hex: 'd', x: 100, y: 125 },
      ]),
    )
    expect(layoutAirportChips([ist], view, measure, blocked)).toEqual([])
  })

  it('seçili uçağın yer izini de örtmez', () => {
    const ist = at('IST', 'large_airport', 100, 100)
    const trail = [
      { x: 110, y: 90 },
      { x: 120, y: 100 },
      { x: 130, y: 110 },
    ]
    const obstacles = chipObstacles({
      width: 400,
      height: 300,
      iconRadius: 14,
      zoom: 12,
      aircraft: [],
      airports: [ist],
      trail,
      selectedHex: null,
      settings: DEFAULT_LABEL_SETTINGS,
      locale: 'tr',
      units: 'metric',
    })
    const [chip] = layoutAirportChips([ist], view, measure, obstacles)
    expect(chip?.x).toBeLessThan(100)
  })

  it('birincil istasyonun kodu yerdeki uçakların üstüne yazılır; havadakilere yine değmez', () => {
    const ist = at('IST', 'large_airport', 100, 100)
    ist.airport.icao = 'LTFM'
    const ring = (gnd: boolean) =>
      [
        { hex: 'a', x: 125, y: 88 },
        { hex: 'b', x: 75, y: 88 },
        { hex: 'c', x: 100, y: 70 },
        { hex: 'd', x: 100, y: 120 },
      ].map(({ hex, x, y }) => ({ ac: { hex, gnd } as TrackedAircraft, x, y }))
    const frame = (gnd: boolean): LabelFrame => ({
      width: 400,
      height: 300,
      iconRadius: 14,
      zoom: 10,
      aircraft: ring(gnd),
      airports: [ist],
      trail: [],
      selectedHex: null,
      settings: DEFAULT_LABEL_SETTINGS,
      locale: 'tr',
      units: 'metric',
    })
    const layout = (gnd: boolean, primary: boolean) =>
      layoutAirportChips([ist], view, measure, chipObstacles(frame(gnd)), {
        ...(primary
          ? { primary: { icao: 'LTFM', obstacles: chipObstacles(frame(gnd), { ground: false }) } }
          : {}),
      })
    // Apronda dört yanı yerdeki uçaklarla dolu: kural yokken kod yazılmazdı.
    expect(layout(true, false)).toEqual([])
    expect(layout(true, true).map((chip) => chip.icao)).toEqual(['LTFM'])
    // Havadaki uçaklar birincil istasyonda da engeldir.
    expect(layout(false, true)).toEqual([])
  })

  it('görünümden taşan kod yazılmaz', () => {
    expect(layoutAirportChips([at('VAN', 'medium_airport', -50, 100)], view, measure)).toEqual([])
    const [chip] = layoutAirportChips([at('VAN', 'medium_airport', 395, 100)], view, measure)
    expect(chip?.x).toBeLessThan(395)
  })

  it('showsAirportChips: kod yalnız Simge ve kod’da, yakınlaştırma eşiğiyle (D-084, D-114)', () => {
    const frame = (airportDisplay: LabelSettings['airportDisplay'], zoom: number) => ({
      zoom,
      airports: [at('IST', 'large_airport', 100, 100)],
      settings: { ...DEFAULT_LABEL_SETTINGS, airportDisplay },
    })
    expect(AIRPORT_LABEL_MIN_ZOOM).toBe(5)
    expect(showsAirportChips(frame('icon-code', 5))).toBe(true)
    expect(showsAirportChips(frame('icon-code', 4.99))).toBe(false)
    expect(showsAirportChips(frame('icon', 12))).toBe(false)
    // Gizle'de çizilen tek tük havalimanının (açık pencere, `?havalimani=`) da kodu yazılmaz.
    expect(showsAirportChips(frame('hidden', 12))).toBe(false)
    expect(showsAirportChips({ ...frame('icon-code', 8), airports: [] })).toBe(false)
  })
})

describe('LabelPainter.airportHitTest', () => {
  /** Tuvalin 2B bağlamı yerine çizim çağrılarını yutan, ölçüyü `measure` ile veren sahte bağlam. */
  function fakeCanvas(): HTMLCanvasElement {
    const ctx = new Proxy(
      { measureText: (text: string) => ({ width: measure('12px', text) }) },
      {
        get: (target, key) =>
          key in target ? target[key as keyof typeof target] : vi.fn(() => undefined),
        set: () => true,
      },
    )
    return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
  }

  const ist: Airport = {
    icao: 'LTFM',
    iata: 'IST',
    name: 'İstanbul Havalimanı',
    city: null,
    lat: 41.27,
    lon: 28.75,
    elevationFt: 325,
    type: 'large_airport',
    scheduled: true,
    country: 'TR',
    ring: 0,
    distanceToTrKm: null,
  }

  const frame = (zoom: number): LabelFrame => ({
    width: 400,
    height: 300,
    iconRadius: 14,
    zoom,
    aircraft: [],
    airports: [{ airport: ist, x: 100, y: 100 }],
    trail: [],
    selectedHex: null,
    settings: DEFAULT_LABEL_SETTINGS,
    locale: 'tr',
    units: 'metric',
  })

  it('çizilen kodun kutusu havalimanının ICAO kodunu verir; kutu dışı ve temizlenmiş tuval null', () => {
    const painter = new LabelPainter(fakeCanvas())
    painter.resize(400, 300, 1)
    painter.draw(frame(8))
    // Kod pin başının sağında (pinin ucu 100,100; baş ~12 px yukarıda).
    const pin = pinGeometry(100, 100, DEFAULT_PIN_SCALE)
    const inside = { x: pin.headX + pin.headRadius + 8, y: pin.headY }
    expect(painter.airportHitTest(inside.x, inside.y)).toBe('LTFM')
    expect(painter.airportHitTest(100, 100)).toBeNull()
    expect(painter.airportHitTest(inside.x, 120)).toBeNull()
    expect(painter.hitTest(inside.x, inside.y)).toBeNull()
    painter.clear()
    expect(painter.airportHitTest(inside.x, inside.y)).toBeNull()
  })

  it('kodların yazılmadığı uzak görünümde kod tıklaması yoktur', () => {
    const painter = new LabelPainter(fakeCanvas())
    painter.resize(400, 300, 1)
    painter.draw(frame(4))
    expect(painter.airportHitTest(112, 100)).toBeNull()
  })

  describe('havalimanları ayarı (D-084, D-114)', () => {
    /** Çizilen yazıları kaydeden sahte bağlam. */
    function recordingCanvas(texts: string[]): HTMLCanvasElement {
      const ctx = new Proxy(
        {
          measureText: (text: string) => ({ width: measure('12px', text) }),
          fillText: (text: string) => {
            texts.push(text)
          },
        },
        {
          get: (target, key) =>
            key in target ? target[key as keyof typeof target] : vi.fn(() => undefined),
          set: () => true,
        },
      )
      return { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement
    }
    const draw = (
      airportDisplay: LabelSettings['airportDisplay'],
      zoom: number,
      locale: 'tr' | 'en' = 'tr',
    ) => {
      const texts: string[] = []
      const painter = new LabelPainter(recordingCanvas(texts))
      painter.resize(400, 300, 1)
      painter.draw({
        ...frame(zoom),
        locale,
        settings: { ...DEFAULT_LABEL_SETTINGS, airportDisplay },
      })
      return { painter, texts }
    }
    const pin = pinGeometry(100, 100, DEFAULT_PIN_SCALE)
    /** Kodun içi ve kodun sağı (kod 30 px genişliğindedir). */
    const onCode = { x: pin.headX + pin.headRadius + 8, y: pin.headY }
    const beside = { x: pin.headX + pin.headRadius + 60, y: pin.headY }

    it('Simge ve Gizle: kod çizilmez, kod tıklaması yoktur (pin GL katmanındadır)', () => {
      // Gizle'de çerçeveye yalnız istisna havalimanı (açık pencere, `?havalimani=`) girer; onun da
      // kodu yazılmaz.
      for (const airportDisplay of ['icon', 'hidden'] as const) {
        const { painter, texts } = draw(airportDisplay, 10)
        expect(texts, airportDisplay).toEqual([])
        expect(painter.airportHitTest(onCode.x, onCode.y), airportDisplay).toBeNull()
      }
    })

    it('Simge ve kod: her yakınlaştırmada ve iki dilde yalnız IATA kodu; ad yazılmaz, kodun yanı tıklanmaz', () => {
      for (const [zoom, locale] of [
        [5, 'tr'],
        [7, 'tr'],
        [10, 'tr'],
        [14, 'en'],
      ] as const) {
        const { painter, texts } = draw('icon-code', zoom, locale)
        expect(texts, `z${zoom} ${locale}`).toEqual(['IST'])
        expect(painter.airportHitTest(onCode.x, onCode.y)).toBe('LTFM')
        expect(painter.airportHitTest(beside.x, beside.y)).toBeNull()
      }
    })
  })
})

describe('listelenen havalimanları z5’te (4. halka, 1.240 havalimanı; D-090, D-102, D-107, D-110)', () => {
  // Web Mercator, z5: kodların yazıldığı en uzak yakınlaştırma (AIRPORT_LABEL_MIN_ZOOM), görünümdeki
  // havalimanı sayısı en büyüktür. Kod yerleşimi haritanın her `render` olayında yalnız
  // görünümdekilere yapılır (`screenAirports`). 3. halkada 2560×1440 görünüm bütün listeyi (498)
  // kapsıyordu; 4. halka İzlanda'dan Moğolistan'a uzanır, aynı görünüm Türkiye'nin çevresindeki en
  // yoğun bölgeyi (Avrupa, Orta Doğu, Kuzey Afrika) taşır.
  const ZOOM = AIRPORT_LABEL_MIN_ZOOM
  const VIEW = { width: 2560, height: 1440 }
  /**
   * 2560×1440 görünümdeki havalimanları (1.240 listelenenden; D-110'dan önce 1.217'den 909, savaş
   * nedeniyle kapalı 23 havalimanından Bukavu dışındaki 22'si görünümde).
   */
  const SCREEN_AIRPORTS = 931
  const world = 256 * 2 ** ZOOM
  const project = (lat: number, lon: number) => {
    const sin = Math.sin((lat * Math.PI) / 180)
    return {
      x: ((lon + 180) / 360) * world,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world,
    }
  }
  const centre = project(41.5, 35)
  const listed = fixtureListedAirports()
  const screen: ScreenAirport[] = listed
    .map((airport) => {
      const { x, y } = project(airport.lat, airport.lon)
      return { airport, x: x - centre.x + VIEW.width / 2, y: y - centre.y + VIEW.height / 2 }
    })
    .filter(({ x, y }) => x >= 0 && x <= VIEW.width && y >= 0 && y <= VIEW.height)

  it('görünümdekiler; kodlar birbirini örtmez, görünümden taşmaz, her havalimanına en çok bir kod', () => {
    expect(listed).toHaveLength(1240)
    expect(screen).toHaveLength(SCREEN_AIRPORTS)
    // 1.–3. halkanın hepsi görünümdedir (498 ve savaş kapanışlarının 22'si, D-110).
    expect(screen.filter(({ airport }) => airport.ring <= 3)).toHaveLength(520)
    const chips = layoutAirportChips(screen, VIEW, measure)
    expect(chips.length).toBeGreaterThan(50)
    expect(new Set(chips.map((chip) => chip.icao)).size).toBe(chips.length)
    const violations: string[] = []
    for (const [i, a] of chips.entries()) {
      if (a.x < 0 || a.y < 0 || a.x + a.width > VIEW.width || a.y + a.height > VIEW.height) {
        violations.push(`${a.iata}: görünüm dışı`)
      }
      for (const b of chips.slice(i + 1)) {
        const overlap =
          a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
        if (overlap) violations.push(`${a.iata} ↔ ${b.iata}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('yerleşim hızlıdır (her render olayında çalışır)', () => {
    for (let i = 0; i < 5; i++) layoutAirportChips(screen, VIEW, measure)
    const times: number[] = []
    for (let i = 0; i < 9; i++) {
      const start = performance.now()
      layoutAirportChips(screen, VIEW, measure)
      times.push(performance.now() - start)
    }
    times.sort((a, b) => a - b)
    // Hedef dizüstünde < 2 ms; CI makineleri için geniş pay (label-layout.test.ts ile aynı).
    expect(times[4]).toBeLessThan(50)
  })
})
