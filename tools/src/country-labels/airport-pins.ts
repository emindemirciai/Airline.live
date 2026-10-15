/**
 * Ülke adlarının boş yer araması için havalimanı engelleri (D-099): haritada pini çizilen
 * havalimanları ve pinin (z5'ten kodun da) ekranda kapladığı kutu. Yalnızca çevrimdışı üretici ve
 * testler kullanır; üretim koduna girmez.
 *
 * - **Havalimanları:** üretimdeki liste kuralı (`GET /v1/airports?scope=listed`, D-080) commit'li
 *   OurAirports fixture'ına (2026-10-01 kopyası, tools/fixtures/README.md) uygulanır: içe aktarım
 *   süzgeci (`@havayolu/providers` `parseAirports`), kimlik sırası, Türkiye'deki uzaklık
 *   referansları ve halka seçimi (`@havayolu/db` `turkishReferencePoints`, `selectListedAirports`,
 *   `AIRPORT_RING_CONFIG`). Fixture Türkiye'nin bütün satırlarını ve açık halkaların (1.–4.) bütün
 *   yurt dışı adaylarını taşır: liste, üretimin kuralının bu kopyaya uygulanmış hâlidir (1.240 = 56
 *   + 77 + 104 + 283 + 720; savaş nedeniyle kapalı 23 havalimanı kapanış tablosuyla, D-110; askerî
 *   hava üsleri listelenmez, D-107; `listedAirportPins`). Üretim
 *   OurAirports'u her gece yeniden içe aktarır (`reference-import`); tarifeli sefer, tür, IATA kodu
 *   ya da konum değişirse üretimin listesi fixture'dan ayrılabilir. Bunu hiçbir test yakalamaz:
 *   kullanıcı iki listeyi elle karşılaştırır (ACTIVATION "Ülke adlarının engelleri"), ayrılık varsa
 *   fixture onayla tazelenir ve tablo yeniden üretilir. Halka açılınca da fixture genişler ve tablo
 *   yeniden üretilir (M6i.2, D-102) (airport-pins.test.ts açık halkayı denetler).
 * - **Haritadaki pinler** (`mapAirportPins`): liste, web haritasının savunma süzgecinden
 *   (`@havayolu/shared` `mapShownAirports`, D-103) geçerek. D-107'den beri liste askerî hava üssü
 *   taşımadığı için süzgeç bir şey çıkarmaz; engeller listenin kendisidir: 1.240 havalimanı
 *   (Türkiye 56).
 * - **Pin:** bitmap kutusu (airport-pin.ts): 24 × 32 görünüm kutusu + her yana 3 birim pay; katman
 *   alt kenarı noktaya bağlar ve `icon-offset` ile 3 birim aşağı kaydırır (`AIRPORT_LAYER`; ofset
 *   `icon-size` ile çarpılır). Ucu noktadadır; kutu noktaya göre [−15s, +15s] × [−35s, +3s] px, s
 *   katmanın o yakınlaştırmadaki `icon-size`'ıdır. Kutu, pinin saydam payını da içerir.
 * - **Kod kutuları:** havalimanı kodları z5'ten yazılır (web labels.ts `AIRPORT_LABEL_MIN_ZOOM`;
 *   ayarın varsayılanı "Kod"). `layoutAirportChips` kodu sırayla pin başının sağına, soluna, pinin
 *   üstüne ve noktanın altına dener; yer engelliyse (başka pin ya da kod, uçak simgesi, seçili
 *   uçağın izi ya da görünümün kenarı) sonrakine geçer. Model ilk iki adayı sayar: sağdaki kutu başın
 *   yarıçapı + 3 px boşluktan başlar, soldaki onun noktaya göre aynasıdır; ikisi de 30 px geniş (üç
 *   harf IBM Plex Mono 500 11 px, harf ilerlemesi 0,6 em, + 2 × 5 px), 16 px yüksek, başın merkezinde
 *   ortalıdır. Üst ve alt adaylar sayılmaz: sayılsa İTALYA'da boş yer kalmıyordu (D-099 "Bilinen
 *   sınırlar"). Sabitler labels.ts'tekilerle aynıdır (airport-pins.test.ts kaynağı okuyup
 *   karşılaştırır).
 */
import { readFileSync } from 'node:fs'
import {
  AIRPORT_LAYER,
  AIRPORT_PIN_HALO,
  AIRPORT_PIN_HEAD,
  AIRPORT_PIN_MARGIN,
  AIRPORT_PIN_OUTLINE,
  AIRPORT_PIN_VIEWBOX,
  AIRPORT_RING_CONFIG,
  interpolateStops,
  mapShownAirports,
  type CountryLabelStops,
} from '@havayolu/shared'
import { selectListedAirports, turkishReferencePoints } from '@havayolu/db'
import { parseAirports } from '@havayolu/providers'
import { mercatorX, mercatorY, WORLD_SIZE } from './geometry'
import type { GlyphBox } from './label-model'

/** Commit'li OurAirports fixture'ı (tools/fixtures/README.md). */
export const OURAIRPORTS_FIXTURE_URL = new URL(
  '../../fixtures/ourairports/airports.csv',
  import.meta.url,
)

/** Havalimanı kodları bu yakınlaştırmadan itibaren yazılır (labels.ts `AIRPORT_LABEL_MIN_ZOOM`). */
export const AIRPORT_CHIP_MIN_ZOOM = 5
/** Kodun yazı boyu, px (labels.ts `AIRPORT_FONT`). */
export const AIRPORT_CHIP_FONT_PX = 11
/** IBM Plex Mono'nun harf ilerlemesi, em (eşaralıklı yazı tipi: 600 / 1.000 birim). */
export const AIRPORT_CHIP_ADVANCE_EM = 0.6
/** Kod kutusunun yan boşluğu, px (labels.ts `AIRPORT_PAD_X`). */
export const AIRPORT_CHIP_PAD_X = 5
/** Kod kutusunun yüksekliği, px (labels.ts `AIRPORT_HEIGHT`). */
export const AIRPORT_CHIP_HEIGHT = 16
/** Kod kutusu ile pin başı arasındaki boşluk, px (labels.ts `AIRPORT_GAP`). */
export const AIRPORT_CHIP_GAP = 3
/** IATA kodu üç harftir. */
export const AIRPORT_CHIP_CHARS = 3

/** Kod kutusunun genişliği, px: `tavan(3 × 0,6 × 11 + 2 × 5)` = 30. */
export const AIRPORT_CHIP_WIDTH = Math.ceil(
  AIRPORT_CHIP_CHARS * AIRPORT_CHIP_ADVANCE_EM * AIRPORT_CHIP_FONT_PX + 2 * AIRPORT_CHIP_PAD_X,
)

/** Listelenen ya da haritada pini çizilen havalimanı. */
export interface AirportPin {
  icao: string
  iata: string
  /** Türkiye 0, yurt dışı açık halka (1–4). */
  ring: number
  lat: number
  lon: number
}

/** Fixture'dan listelenen havalimanları (üretimin kuralı), ICAO sırasıyla. */
export function listedAirportPins(csv: string): AirportPin[] {
  const { rows, skipped } = parseAirports(csv)
  if (skipped.length > 0) throw new Error(`OurAirports fixture: ${skipped.length} bad rows`)
  const sorted = [...rows].sort((a, b) => a.id - b.id)
  const listed = selectListedAirports(sorted, {
    turkey: turkishReferencePoints(sorted),
    ...AIRPORT_RING_CONFIG,
  })
  return listed
    .map(({ icao, iata, ring, lat, lon }) => ({ icao, iata, ring, lat, lon }))
    .sort((a, b) => (a.icao < b.icao ? -1 : a.icao > b.icao ? 1 : 0))
}

/**
 * Haritada pini çizilen havalimanları, ICAO sırasıyla: listelenenler, web haritasının kullandığı
 * savunma süzgecinden (`mapShownAirports`, `@havayolu/shared`; D-103) geçerek. Liste askerî hava
 * üssü taşımadığı için (D-107) bugün listenin kendisidir. Süzgeç ya da liste kuralı değişirse
 * buradaki engeller de değişir ve sürüklenme testi tablo yeniden üretilene kadar kırılır. Ülke
 * adlarının engelleri bunlardır.
 */
export function mapAirportPins(csv: string): AirportPin[] {
  return mapShownAirports(listedAirportPins(csv))
}

/** Commit'li fixture'ı okur. */
export function readOurAirportsFixture(): string {
  return readFileSync(OURAIRPORTS_FIXTURE_URL, 'utf8')
}

/** Pin katmanının `icon-size` durakları (`AIRPORT_LAYER`: `interpolate linear zoom …`). */
function pinScaleStops(): CountryLabelStops {
  const expression = AIRPORT_LAYER.layout['icon-size'] as unknown[]
  const flat = expression.slice(3) as number[]
  const stops: [number, number][] = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    stops.push([flat[i] as number, flat[i + 1] as number])
  }
  return stops
}

const PIN_SCALE_STOPS = pinScaleStops()

/** Pinin z'deki ölçeği (`icon-size`; ilk duraktan önce ilk değer). */
export function pinScaleAt(zoom: number): number {
  return interpolateStops(PIN_SCALE_STOPS, zoom)
}

/** Pin bitmapinin kutusu, px, noktaya göre (y aşağı). */
export function pinBoxPx(zoom: number): GlyphBox {
  const s = pinScaleAt(zoom)
  const halfWidth = AIRPORT_PIN_VIEWBOX.width / 2 + AIRPORT_PIN_MARGIN
  return {
    left: -halfWidth * s,
    top: -(AIRPORT_PIN_VIEWBOX.height + AIRPORT_PIN_MARGIN) * s,
    right: halfWidth * s,
    bottom: AIRPORT_PIN_MARGIN * s,
  }
}

/** Kodun pin başının sağındaki kutusu (ilk aday), px, noktaya göre; z5'in altında null. */
export function chipBoxPx(zoom: number): GlyphBox | null {
  if (zoom < AIRPORT_CHIP_MIN_ZOOM) return null
  const s = pinScaleAt(zoom)
  const headRadius = (AIRPORT_PIN_HEAD.r + AIRPORT_PIN_OUTLINE / 2 + AIRPORT_PIN_HALO) * s
  const headY = -(AIRPORT_PIN_VIEWBOX.height - AIRPORT_PIN_HEAD.cy) * s
  const left = headRadius + AIRPORT_CHIP_GAP
  return {
    left,
    top: headY - AIRPORT_CHIP_HEIGHT / 2,
    right: left + AIRPORT_CHIP_WIDTH,
    bottom: headY + AIRPORT_CHIP_HEIGHT / 2,
  }
}

/**
 * Kodun pin başının solundaki kutusu (ikinci aday: sağdaki yer engelliyse), px, noktaya göre:
 * sağdaki kutunun noktaya göre aynası; z5'in altında null.
 */
export function chipLeftBoxPx(zoom: number): GlyphBox | null {
  const right = chipBoxPx(zoom)
  if (!right) return null
  return { left: -right.right, top: right.top, right: -right.left, bottom: right.bottom }
}

/** Bir havalimanının engel kutuları, px, noktaya göre: pin ve z5'ten kodun sağ ve sol kutusu. */
export function obstacleBoxesPx(zoom: number): GlyphBox[] {
  return [pinBoxPx(zoom), chipBoxPx(zoom), chipLeftBoxPx(zoom)].filter((box) => box !== null)
}

/** Kutu, z0 izdüşüm birimi (dünya): [x1, y1, x2, y2]. */
export type WorldBox = readonly [x1: number, y1: number, x2: number, y2: number]

/** İki açık kutu örtüşüyor mu (kenara değmek örtüşme değildir). */
export const worldBoxesOverlap = (a: WorldBox, b: WorldBox): boolean =>
  a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

/** Px kutusunu z'de (lon, lat) çapasıyla dünya birimine taşır. */
export function worldBoxAt(lon: number, lat: number, box: GlyphBox, zoom: number): WorldBox {
  return worldBoxAtPoint(mercatorX(lon), mercatorY(lat), box, zoom)
}

/** Px kutusunu z'de izdüşüm noktasıyla (x, y) dünya birimine taşır. */
function worldBoxAtPoint(x: number, y: number, box: GlyphBox, zoom: number): WorldBox {
  const scale = 2 ** zoom
  return [x + box.left / scale, y + box.top / scale, x + box.right / scale, y + box.bottom / scale]
}

/**
 * Havalimanı engelleri, dünya biriminde, boylama göre sıralı (aralık araması). `hits(box, zoom)`
 * kutuya giren pin ve kod kutularının sayısını verir; bir havalimanının pini, sağdaki ve soldaki
 * kod kutusu ayrı sayılır.
 */
export class AirportObstacles {
  private readonly xs: Float64Array
  private readonly ys: Float64Array
  /** Havalimanlarının x'e göre sırası. */
  private readonly order: Uint32Array
  private readonly sortedX: Float64Array

  constructor(readonly airports: readonly AirportPin[]) {
    this.xs = Float64Array.from(airports, (airport) => mercatorX(airport.lon))
    this.ys = Float64Array.from(airports, (airport) => mercatorY(airport.lat))
    this.order = Uint32Array.from(airports.keys()).sort(
      (a, b) => (this.xs[a] as number) - (this.xs[b] as number) || a - b,
    )
    this.sortedX = Float64Array.from(this.order, (index) => this.xs[index] as number)
  }

  /** x'i en az `x` olan ilk sıra. */
  private lowerBound(x: number): number {
    let low = 0
    let high = this.sortedX.length
    while (low < high) {
      const middle = (low + high) >> 1
      if ((this.sortedX[middle] as number) < x) low = middle + 1
      else high = middle
    }
    return low
  }

  /**
   * Kutuya z'de giren havalimanlarının dizinleri ve her birinde giren parça sayısı (pin, sağdaki ve
   * soldaki kod). Kutu dünyanın komşu kopyalarında da aranır (D-100): 180. meridyenin yanındaki bir
   * adın kutusu meridyeni aşabilir, havalimanları ise 180° B–180° D arasındadır.
   */
  private visit(
    box: WorldBox,
    zoom: number,
    found: (index: number, parts: number) => boolean,
  ): void {
    const scale = 2 ** zoom
    const boxes = obstacleBoxesPx(zoom)
    // Noktanın kutuya girebilmesi için x aralığı: parçaların noktanın solundaki ve sağındaki en
    // geniş uzanımı (soldaki kod solda, sağdaki kod sağda en uzağa gider).
    const reachLeft = Math.max(0, ...boxes.map((part) => -part.left)) / scale
    const reachRight = Math.max(0, ...boxes.map((part) => part.right)) / scale
    for (const shift of [0, -WORLD_SIZE, WORLD_SIZE]) {
      const copy: WorldBox = [box[0] + shift, box[1], box[2] + shift, box[3]]
      for (let i = this.lowerBound(copy[0] - reachRight); i < this.sortedX.length; i++) {
        const x = this.sortedX[i] as number
        if (x > copy[2] + reachLeft) break
        const index = this.order[i] as number
        const y = this.ys[index] as number
        let parts = 0
        for (const part of boxes) {
          if (worldBoxesOverlap(copy, worldBoxAtPoint(x, y, part, zoom))) parts++
        }
        if (parts > 0 && found(index, parts)) return
      }
    }
  }

  /**
   * Dünya kutusuna z'de giren pin ve kod kutusu sayısı; `limit`e ulaşınca sayım durur (aday
   * elemede yeter).
   */
  hits(box: WorldBox, zoom: number, limit = Infinity): number {
    let count = 0
    this.visit(box, zoom, (_, parts) => {
      count += parts
      return count >= limit
    })
    return count
  }

  /** Kutuya z'de pini ya da kodu giren havalimanlarının ICAO kodları, sıralı (rapor ve testler). */
  hitIcaos(box: WorldBox, zoom: number): string[] {
    const found: string[] = []
    this.visit(box, zoom, (index) => {
      found.push((this.airports[index] as AirportPin).icao)
      return false
    })
    return found.sort()
  }
}
