/**
 * Ülke adlarının havalimanı engelleri (D-099): listelenen havalimanları üretimin kuralıyla commit'li
 * OurAirports fixture'ından gelir (askerî hava üsleri listede yok, D-107); engeller haritada pini
 * çizilenlerdir (D-103: liste, savunma süzgecinden geçerek); pin ve kod kutuları (pin başının
 * sağında ve solunda) haritanın çizdiği boydadır (sabitler web'in labels.ts'iyle ve kod yazı
 * tipinin dosyasıyla karşılaştırılır); dizinli arama kaba taramayla aynı sonucu verir.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { inflateSync } from 'node:zlib'
import {
  AIRPORT_LAYER,
  ENABLED_AIRPORT_RING,
  MILITARY_AIRFIELD_ICAOS,
  mapShownAirports,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import {
  AIRPORT_CHIP_ADVANCE_EM,
  AIRPORT_CHIP_FONT_PX,
  AIRPORT_CHIP_GAP,
  AIRPORT_CHIP_HEIGHT,
  AIRPORT_CHIP_MIN_ZOOM,
  AIRPORT_CHIP_PAD_X,
  AIRPORT_CHIP_WIDTH,
  AirportObstacles,
  chipBoxPx,
  chipLeftBoxPx,
  listedAirportPins,
  mapAirportPins,
  obstacleBoxesPx,
  pinBoxPx,
  pinScaleAt,
  readOurAirportsFixture,
  worldBoxAt,
  worldBoxesOverlap,
  type WorldBox,
} from './airport-pins'
import { mercatorX, mercatorY } from './geometry'

// Fixture bir kez okunur (D-109).
const FIXTURE = readOurAirportsFixture()
const PINS = listedAirportPins(FIXTURE)
const MAP_PINS = mapAirportPins(FIXTURE)

/** Web'in paketleri ve kaynağı (apps/web; ağ yok). */
const webRequire = createRequire(new URL('../../../apps/web/package.json', import.meta.url))
const LABELS_SOURCE = readFileSync(
  new URL('../../../apps/web/src/components/map/labels.ts', import.meta.url),
  'utf8',
)

/** Kaynakta `const <ad> = <sayı>` satırının sayısı. */
function sourceNumber(name: string): number {
  const match = new RegExp(`const ${name} = (\\d+(?:\\.\\d+)?)\\b`).exec(LABELS_SOURCE)
  if (!match) throw new Error(`labels.ts: ${name} missing`)
  return Number(match[1])
}

/** WOFF 1.0 tablosu (zlib ya da sıkıştırmasız). */
function woffTable(buffer: Buffer, tag: string): Buffer {
  for (let i = 0; i < buffer.readUInt16BE(12); i++) {
    const at = 44 + i * 20
    if (buffer.toString('latin1', at, at + 4) !== tag) continue
    const offset = buffer.readUInt32BE(at + 4)
    const length = buffer.readUInt32BE(at + 8)
    const raw = buffer.subarray(offset, offset + length)
    return length === buffer.readUInt32BE(at + 12) ? raw : inflateSync(raw)
  }
  throw new Error(`${tag} missing`)
}

/** Kaba tarama: her havalimanının pin ve iki kod kutusu ayrı ayrı denetlenir. */
function bruteHits(box: WorldBox, zoom: number): { count: number; icaos: string[] } {
  const parts = [pinBoxPx(zoom), chipBoxPx(zoom), chipLeftBoxPx(zoom)].filter(
    (part) => part !== null,
  )
  let count = 0
  const icaos: string[] = []
  for (const pin of MAP_PINS) {
    const inside = parts.filter((part) =>
      worldBoxesOverlap(box, worldBoxAt(pin.lon, pin.lat, part, zoom)),
    )
    count += inside.length
    if (inside.length > 0) icaos.push(pin.icao)
  }
  return { count, icaos: icaos.sort() }
}

describe('listelenen havalimanları (D-080, D-099)', () => {
  it('üretimdeki liste: 1.217 havalimanı (Türkiye 56, 1. halka 75, 2. halka 89, 3. halka 278, 4. halka 719), askerî üsler yok (D-107), ICAO sırasıyla', () => {
    // Halka açılınca fixture yeni halkanın adaylarıyla genişler ve tablo yeniden üretilir (M6i.2'de
    // 4. halka, D-102).
    expect(ENABLED_AIRPORT_RING).toBe(4)
    expect(PINS).toHaveLength(1217)
    const byRing = [0, 1, 2, 3, 4].map((ring) => PINS.filter((pin) => pin.ring === ring).length)
    expect(byRing).toEqual([56, 75, 89, 278, 719])
    const icaos = PINS.map((pin) => pin.icao)
    expect(icaos).toEqual([...icaos].sort())
    expect(new Set(icaos).size).toBe(1217)
    for (const icao of ['LTFM', 'LTAC', 'OIIE', 'LIMP', 'UUEE', 'HEBA', 'EGLL', 'VIDP', 'ZMCK'])
      expect(icaos).toContain(icao)
    for (const icao of MILITARY_AIRFIELD_ICAOS) expect(icaos).not.toContain(icao)
    // Dört karakterli ICAO'su olmayan Kihihi (UG-0002, IATA KHX) listede yoktur (D-101).
    expect(icaos).not.toContain('UG-0002')
    expect(PINS.some((pin) => pin.iata === 'KHX')).toBe(false)
  })

  it('haritadaki pinler (D-103, D-107): listenin kendisi; savunma süzgeci (`mapShownAirports`) bir şey çıkarmaz; 1.217 havalimanı (Türkiye 56)', () => {
    expect(MAP_PINS).toHaveLength(1217)
    const byRing = [0, 1, 2, 3, 4].map((ring) => MAP_PINS.filter((pin) => pin.ring === ring).length)
    expect(byRing).toEqual([56, 75, 89, 278, 719])
    const icaos = MAP_PINS.map((pin) => pin.icao)
    expect(icaos).toEqual([...icaos].sort())
    expect(MAP_PINS).toEqual(PINS)
    // Kural web haritasıyla ortaktır (tek yer `@havayolu/shared` `mapShownAirports`).
    expect(MAP_PINS).toEqual(mapShownAirports(PINS))
    // Ankara (Etimesgut) ve yurt dışındaki ortak sivil-askerî havalimanları sivildir, pinleri kalır.
    // 4. halkanın ortak sivil-askerî havalimanları da (EKKA, VIAG, DNPM, ZURK; D-103).
    for (const icao of ['LTAD', 'LTBJ', 'ORBI', 'LYPG', 'ETMN', 'EKKA', 'VIAG', 'DNPM', 'ZURK'])
      expect(icaos).toContain(icao)
  })
})

describe('pin ve kod kutusu (D-099)', () => {
  it('pin: bitmap kutusu (30 × 38 birim) × icon-size, uç noktada, 3 birim aşağı kaydırılmış', () => {
    expect(AIRPORT_LAYER.layout['icon-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      0.45,
      8,
      0.6,
      12,
      0.8,
      15,
      0.9,
    ])
    expect(AIRPORT_LAYER.layout['icon-anchor']).toBe('bottom')
    expect(AIRPORT_LAYER.layout['icon-offset']).toEqual([0, 3])
    expect([pinScaleAt(3), pinScaleAt(4), pinScaleAt(6), pinScaleAt(8)]).toEqual([
      0.45, 0.45, 0.525, 0.6,
    ])
    const box = pinBoxPx(4)
    expect(box.left).toBeCloseTo(-6.75, 9)
    expect(box.top).toBeCloseTo(-15.75, 9)
    expect(box.right).toBeCloseTo(6.75, 9)
    expect(box.bottom).toBeCloseTo(1.35, 9)
  })

  it('kod: z5’ten, 30 × 16 px, pin başının sağında 3 px boşlukla, başın ortasında', () => {
    expect(AIRPORT_CHIP_WIDTH).toBe(30)
    expect(chipBoxPx(4.99)).toBeNull()
    const s = pinScaleAt(5)
    expect(s).toBeCloseTo(0.4875, 9)
    const chip = chipBoxPx(5)
    if (!chip) throw new Error('chip')
    expect(chip.left).toBeCloseTo(12.4 * s + 3, 9)
    expect(chip.right - chip.left).toBeCloseTo(30, 9)
    expect(chip.bottom - chip.top).toBeCloseTo(16, 9)
    expect((chip.top + chip.bottom) / 2).toBeCloseTo(-20.8 * s, 9)
  })

  it('sol kod: sağ yer engelliyse pin başının solunda, sağdakinin aynası: [−(12,4s + 3 + 30), −(12,4s + 3)] × [−20,8s − 8, −20,8s + 8]', () => {
    expect(chipLeftBoxPx(4.99)).toBeNull()
    for (const zoom of [5, 6, 7.5]) {
      const s = pinScaleAt(zoom)
      const left = chipLeftBoxPx(zoom)
      if (!left) throw new Error('left chip')
      expect(left.left).toBeCloseTo(-(12.4 * s + 3 + 30), 9)
      expect(left.right).toBeCloseTo(-(12.4 * s + 3), 9)
      expect(left.top).toBeCloseTo(-20.8 * s - 8, 9)
      expect(left.bottom).toBeCloseTo(-20.8 * s + 8, 9)
    }
    // Engel kutuları: z5'in altında yalnız pin; z5'ten pin, sağdaki ve soldaki kod.
    expect(obstacleBoxesPx(4.75)).toEqual([pinBoxPx(4.75)])
    expect(obstacleBoxesPx(6)).toEqual([pinBoxPx(6), chipBoxPx(6), chipLeftBoxPx(6)])
  })

  it('sabitler web’in labels.ts’iyle ve IBM Plex Mono 500’ün dosyasıyla aynı', () => {
    expect(sourceNumber('AIRPORT_LABEL_MIN_ZOOM')).toBe(AIRPORT_CHIP_MIN_ZOOM)
    expect(sourceNumber('AIRPORT_PAD_X')).toBe(AIRPORT_CHIP_PAD_X)
    expect(sourceNumber('AIRPORT_HEIGHT')).toBe(AIRPORT_CHIP_HEIGHT)
    expect(sourceNumber('AIRPORT_GAP')).toBe(AIRPORT_CHIP_GAP)
    expect(LABELS_SOURCE).toContain(
      `const AIRPORT_FONT = \`500 ${AIRPORT_CHIP_FONT_PX}px \${FONT_FAMILY}\``,
    )
    expect(LABELS_SOURCE).toContain(
      `const FONT_FAMILY = '"IBM Plex Mono", ui-monospace, monospace'`,
    )
    // İlk aday pin başının sağı, ikincisi solu (model ikisini sayar); başın yarıçapı kenar ve hat
    // dahil. Üçüncü ve dördüncü aday (pinin üstü, noktanın altı) sayılmaz (D-099 "Bilinen sınırlar").
    const candidates = [
      '[x + pin.headRadius + AIRPORT_GAP, pin.headY - height / 2],',
      '[x - pin.headRadius - AIRPORT_GAP - width, pin.headY - height / 2],',
      '[x - width / 2, pin.top - AIRPORT_GAP - height],',
      '[x - width / 2, y + AIRPORT_GAP],',
    ]
    const positions = candidates.map((candidate) => LABELS_SOURCE.indexOf(candidate))
    expect(positions.every((position) => position > 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(LABELS_SOURCE).toContain('const edge = AIRPORT_PIN_OUTLINE / 2 + AIRPORT_PIN_HALO')
    expect(LABELS_SOURCE).toContain('headRadius: (AIRPORT_PIN_HEAD.r + edge) * scale,')
    // Eşaralıklı: en geniş ilerleme = her harfin ilerlemesi, 600 / 1.000 em.
    const font = readFileSync(
      webRequire.resolve('@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff'),
    )
    const unitsPerEm = woffTable(font, 'head').readUInt16BE(18)
    const advanceMax = woffTable(font, 'hhea').readUInt16BE(10)
    expect(advanceMax / unitsPerEm).toBe(AIRPORT_CHIP_ADVANCE_EM)
  })
})

describe('dizinli arama (D-099)', () => {
  it('hits ve hitIcaos kaba taramayla aynı (z3–7, rastgele ama sabit kutular)', () => {
    const obstacles = new AirportObstacles(MAP_PINS)
    let seed = 20261005
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed / 2 ** 31
    }
    let nonEmpty = 0
    for (let i = 0; i < 400; i++) {
      const zoom = 3 + Math.round(random() * 16) / 4
      const lon = 10 + random() * 40
      const lat = 30 + random() * 20
      const width = (20 + random() * 300) / 2 ** zoom
      const height = (10 + random() * 100) / 2 ** zoom
      const x = mercatorX(lon)
      const y = mercatorY(lat)
      const box: WorldBox = [x, y, x + width, y + height]
      const expected = bruteHits(box, zoom)
      expect(obstacles.hits(box, zoom), `${i}`).toBe(expected.count)
      expect(obstacles.hitIcaos(box, zoom), `${i}`).toEqual(expected.icaos)
      if (expected.count > 0) {
        nonEmpty++
        // Sınıra ulaşınca durur: bir havalimanının pini ve iki kodu birlikte sayılır (en çok 3).
        const limited = obstacles.hits(box, zoom, 1)
        expect(limited).toBeGreaterThanOrEqual(1)
        expect(limited).toBeLessThanOrEqual(Math.min(3, expected.count))
      }
    }
    expect(nonEmpty).toBeGreaterThan(50)
    // Sınır: kutu pinin kenarına yalnızca değiyorsa sayılmaz.
    const ltfm = MAP_PINS.find((pin) => pin.icao === 'LTFM')
    if (!ltfm) throw new Error('LTFM')
    const pin = worldBoxAt(ltfm.lon, ltfm.lat, pinBoxPx(4), 4)
    const touching: WorldBox = [pin[2], pin[1], pin[2] + 0.01, pin[3]]
    expect(obstacles.hitIcaos(touching, 4)).not.toContain('LTFM')
  })
})
