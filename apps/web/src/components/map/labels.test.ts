import type { Airport } from '@havayolu/shared'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_LABEL_SETTINGS, type LabelSettings } from '../../lib/map/label-settings'
import type { TrackedAircraft } from '../../lib/live/store'
import { CircleObstacles } from '../../lib/map/label-layout'
import {
  AIRPORT_LABEL_MIN_ZOOM,
  AIRPORT_NAME_MIN_ZOOM,
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
  showsAirportNames,
  type LabelFrame,
  type PlacedAirportChip,
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
    expect(chip).toMatchObject({ icao: 'LTIST', iata: 'IST', major: true, height: 16 })
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

  describe('Kod ve ad (D-084)', () => {
    const named = (names: Record<string, string>) => ({
      nameOf: (airport: Airport) => names[airport.iata] ?? null,
    })
    const overlap = (a: PlacedAirportChip, b: PlacedAirportChip) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

    it('adlı kutu kodun yanındadır: kod kısmı aynı, ad genişliği eklenir; pin başının sağında', () => {
      const [code] = layoutAirportChips([at('IST', 'large_airport', 100, 100)], view, measure)
      const [chip] = layoutAirportChips(
        [at('IST', 'large_airport', 100, 100)],
        view,
        measure,
        undefined,
        named({ IST: 'İstanbul' }),
      )
      expect(code).toMatchObject({ name: null, width: 30, codeWidth: 30 })
      // Kod 3 × 6,6 + 2 × 5 → 30; ad 8 × 6,6 = 52,8; arada 5 px.
      expect(chip).toMatchObject({ iata: 'IST', name: 'İstanbul', codeWidth: 30, width: 88 })
      expect(chip?.x).toBe(code?.x)
      expect(chip?.y).toBe(code?.y)
      expect(chip?.height).toBe(16)
    })

    it('adı olmayan havalimanında kutu yalnız koddur', () => {
      const [chip] = layoutAirportChips(
        [at('XYZ', 'medium_airport', 100, 100)],
        view,
        measure,
        undefined,
        named({}),
      )
      expect(chip).toMatchObject({ name: null, width: chip?.codeWidth })
    })

    it('ad sağa sığmazsa kutu sola geçer; hiçbir yana sığmazsa kod yalnız kalır', () => {
      const ist = at('IST', 'large_airport', 100, 100)
      const pin = pinGeometry(100, 100, DEFAULT_PIN_SCALE)
      // Kodun bittiği yerin hemen sağında bir uçak: kod sığar, adlı kutu sığmaz.
      const right = new CircleObstacles(view)
      right.add(175, pin.headY, 10)
      const [left] = layoutAirportChips([ist], view, measure, right, named({ IST: 'İstanbul' }))
      expect(left?.name).toBe('İstanbul')
      expect((left?.x ?? 0) + (left?.width ?? 0)).toBeLessThan(100)
      // Sol, üst ve alt da dolu: kod sağda kalır, ad yazılmaz.
      const all = new CircleObstacles(view)
      all.add(175, pin.headY, 10)
      all.add(20, pin.headY, 10)
      all.add(100, pin.top - 12, 6)
      all.add(100, 100 + 12, 6)
      const [code] = layoutAirportChips([ist], view, measure, all)
      const [fallback] = layoutAirportChips([ist], view, measure, all, named({ IST: 'İstanbul' }))
      expect(code?.name).toBeNull()
      expect(fallback).toEqual(code)
    })

    it('Kod ve ad, Kod ayarındaki havalimanlarının hiçbirini kaybettirmez; kutular çakışmaz', () => {
      const airports: ScreenAirport[] = []
      const codes = [
        'IST',
        'SAW',
        'ISL',
        'TEQ',
        'BZI',
        'YEI',
        'KCO',
        'CKZ',
        'EDO',
        'ESK',
        'AOE',
        'USQ',
      ]
      codes.forEach((iata, i) => {
        airports.push(
          at(
            iata,
            i % 3 === 0 ? 'large_airport' : 'medium_airport',
            40 + (i % 4) * 90,
            40 + Math.floor(i / 4) * 60,
          ),
        )
      })
      const names = Object.fromEntries(codes.map((iata) => [iata, `${iata} Havalimanı Adı`]))
      const plain = layoutAirportChips(airports, view, measure)
      const withNames = layoutAirportChips(airports, view, measure, undefined, named(names))
      expect(withNames.map((chip) => chip.icao)).toEqual(plain.map((chip) => chip.icao))
      expect(withNames.some((chip) => chip.name !== null)).toBe(true)
      for (let i = 0; i < withNames.length; i++) {
        for (let j = i + 1; j < withNames.length; j++) {
          const a = withNames[i]
          const b = withNames[j]
          if (a && b) expect(overlap(a, b), `${a.iata} ${b.iata}`).toBe(false)
        }
      }
    })

    it('showsAirportChips ve showsAirportNames: Gizle, Kod, Kod ve ad ile yakınlaştırma eşikleri', () => {
      const frame = (airports: LabelSettings['airports'], zoom: number) => ({
        zoom,
        airports: [at('IST', 'large_airport', 100, 100)],
        settings: { ...DEFAULT_LABEL_SETTINGS, airports },
      })
      expect(AIRPORT_LABEL_MIN_ZOOM).toBe(5)
      expect(AIRPORT_NAME_MIN_ZOOM).toBe(7)
      expect(showsAirportChips(frame('code', 5))).toBe(true)
      expect(showsAirportChips(frame('code', 4.99))).toBe(false)
      expect(showsAirportChips(frame('hidden', 12))).toBe(false)
      expect(showsAirportChips({ ...frame('code', 8), airports: [] })).toBe(false)
      expect(showsAirportNames(frame('name', 7))).toBe(true)
      expect(showsAirportNames(frame('name', 6.99))).toBe(false)
      expect(showsAirportNames(frame('code', 12))).toBe(false)
      expect(showsAirportNames(frame('hidden', 12))).toBe(false)
    })
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

  describe('havalimanı etiketi ayarı (D-084)', () => {
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
      airports: LabelSettings['airports'],
      zoom: number,
      locale: 'tr' | 'en' = 'tr',
    ) => {
      const texts: string[] = []
      const painter = new LabelPainter(recordingCanvas(texts))
      painter.resize(400, 300, 1)
      painter.draw({ ...frame(zoom), locale, settings: { ...DEFAULT_LABEL_SETTINGS, airports } })
      return { painter, texts }
    }
    const pin = pinGeometry(100, 100, DEFAULT_PIN_SCALE)
    /** Kod kısmının içi ve adın içi (kod 30 px genişliğindedir). */
    const onCode = { x: pin.headX + pin.headRadius + 8, y: pin.headY }
    const onName = { x: pin.headX + pin.headRadius + 60, y: pin.headY }

    it('Gizle: kod ve ad çizilmez, kod tıklaması yoktur (pin GL katmanındadır)', () => {
      const { painter, texts } = draw('hidden', 10)
      expect(texts).toEqual([])
      expect(painter.airportHitTest(onCode.x, onCode.y)).toBeNull()
    })

    it('Kod: yalnız IATA kodu; adın yeri tıklanmaz', () => {
      const { painter, texts } = draw('code', 10)
      expect(texts).toEqual(['IST'])
      expect(painter.airportHitTest(onCode.x, onCode.y)).toBe('LTFM')
      expect(painter.airportHitTest(onName.x, onName.y)).toBeNull()
    })

    it('Kod ve ad: z ≥ 7 kod ve kısa ad sayfanın dilinde; kutunun tamamı tıklanır', () => {
      const tr = draw('name', 7)
      expect(tr.texts).toEqual(['IST', 'İstanbul'])
      expect(tr.painter.airportHitTest(onName.x, onName.y)).toBe('LTFM')
      expect(draw('name', 10, 'en').texts).toEqual(['IST', 'Istanbul'])
    })

    it('Kod ve ad: z < 7 yalnız kod', () => {
      const { painter, texts } = draw('name', 6.9)
      expect(texts).toEqual(['IST'])
      expect(painter.airportHitTest(onName.x, onName.y)).toBeNull()
      expect(painter.airportHitTest(onCode.x, onCode.y)).toBe('LTFM')
    })
  })
})
