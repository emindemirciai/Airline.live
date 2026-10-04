/**
 * Uçak ve havalimanı etiketleri: haritanın üstündeki `<canvas class="live-map__labels">`
 * (pointer-events yok, cihaz piksel oranına duyarlı). Harita her `render` olayında ve her çizim
 * turunda yeniden çizer (map-controller.ts).
 *
 * - Havalimanı IATA kodları önce çizilir (z ≥ 5), havalimanı pininin (GL katmanı, ucu noktada)
 *   başının yanında ya da üstünde; hiçbir pini örtmez (D-079). Tuval uçak katmanının üstünde
 *   olduğundan kod hiçbir uçak simgesini ve seçili uçağın izini örtmez: bunlara değen konum
 *   denenmez, yer yoksa kod yazılmaz. Tek istisna birincil istasyondur (IST): kodu yerdeki
 *   uçakların üstüne yazılabilir, havadakilere yine değmez; uçak etiketleri de (seçili uçağınki yer
 *   bulamazsa hariç) IST kodunu örtmez. Kodlar birbirini de örtmez; diğer kodların üstüne uçak
 *   etiketleri gelebilir. Çizilen kodun kutusu tıklanabilir (`airportHitTest`):
 *   havalimanı penceresini açar (M6c).
 * - Havalimanı etiketi ayarı (`settings.airports`, D-084): Gizle → kod yazılmaz (pinler GL
 *   katmanındadır, görünür ve tıklanır kalır); Kod → IATA kodu. Haritada havalimanı adı yazılmaz:
 *   ad, pin ya da koda tıklanınca açılan havalimanı penceresindedir (kullanıcı isteği 2026-10-04).
 * - Uçak etiketleri etiket ayarına göre kurulur (seçili uçak `selected`, diğerleri `others`;
 *   Gizle → etiket yok, simge yine engel sayılır), `layoutLabels` ile çakışmasız yerleşir.
 * - Görünüm kullanıcının tasarım tuvalindendir (Etiket.dc.html), renkler "Açık turkuaz" temasından
 *   (D-081): opak beyaz kutu, ince açık turkuaz kenar; sefer no koyu, bilinmiyorsa çağrı kodu gri;
 *   seçili uçağın etiketi kehribar zemin, koyu kenar ve koyu yazı; THY etiketinin sol kenarında
 *   kırmızı şerit; uzaktaki etiketi simgeye beyaz kenarlı ince koyu bir çizgi bağlar (seçilide koyu
 *   kenarlı kehribar). Havalimanı kodu beyaz (büyük havalimanı) ya da açık turkuaz kutuda koyu yazılır.
 */
import type { UnitSystem } from '@havayolu/i18n'
import {
  AIRPORT_PIN_HALO,
  AIRPORT_PIN_HEAD,
  AIRPORT_PIN_OUTLINE,
  AIRPORT_PIN_VIEWBOX,
  MAP_COLORS,
  isTurkishAirlines,
  type Airport,
  type Locale,
} from '@havayolu/shared'
import type { TrackedAircraft } from '../../lib/live/store'
import {
  CircleObstacles,
  layoutLabels,
  leaderEnd,
  type LabelBox,
  type ScreenRect,
} from '../../lib/map/label-layout'
import type { LabelSettings } from '../../lib/map/label-settings'
import { labelContent, type LabelContent, type LabelMode } from '../../lib/map/label-text'

const FONT_FAMILY = '"IBM Plex Mono", ui-monospace, monospace'

/** Etiketin yazı ve kutu ölçüleri (CSS px). */
export interface LabelTheme {
  primaryFont: string
  primaryLine: number
  secondaryFont: string
  secondaryLine: number
  padX: number
  padTop: number
  padBottom: number
  radius: number
  border: number
}

/** Yazı boyutları kullanıcı isteğiyle (2026-10-01, D-079) birer piksel küçüldü; en küçüğü 11 px. */
export const NORMAL_THEME: LabelTheme = {
  primaryFont: `500 12px ${FONT_FAMILY}`,
  primaryLine: 15,
  secondaryFont: `400 11px ${FONT_FAMILY}`,
  secondaryLine: 14,
  padX: 6,
  padTop: 2,
  padBottom: 3,
  radius: 4,
  border: 1,
}

export const SELECTED_THEME: LabelTheme = {
  primaryFont: `500 15px ${FONT_FAMILY}`,
  primaryLine: 18,
  secondaryFont: `500 11px ${FONT_FAMILY}`,
  secondaryLine: 14,
  padX: 8,
  padTop: 3,
  padBottom: 4,
  radius: 6,
  border: 2,
}

/** THY etiketinin sol kenarındaki kırmızı şeridin genişliği. */
export const THY_BAR_WIDTH = 3

/**
 * Etiket renkleri (D-081). Yazılar beyaz kutuya karşı en az 6,05:1, küçük havalimanının kutusuna
 * karşı 11,69:1; seçili etiketin yazısı kehribara karşı 10,52:1'dir (WCAG AA, 11 px yazı).
 */
const COLORS = {
  box: MAP_COLORS.labelBox,
  border: MAP_COLORS.labelBorder,
  primary: MAP_COLORS.labelInk,
  primaryMuted: MAP_COLORS.labelMuted,
  secondary: MAP_COLORS.labelInk,
  selectedInk: MAP_COLORS.selectedInk,
  selectedBorder: MAP_COLORS.labelInk,
  leader: MAP_COLORS.labelInk,
  airportChip: MAP_COLORS.labelBox,
  airportChipMinor: MAP_COLORS.airportChipMinor,
  airportBorder: MAP_COLORS.labelBorder,
  airportInk: MAP_COLORS.labelInk,
} as const

/** Havalimanı kodları bu yakınlaştırmadan itibaren yazılır. */
export const AIRPORT_LABEL_MIN_ZOOM = 5
const AIRPORT_FONT = `500 11px ${FONT_FAMILY}`
const AIRPORT_PAD_X = 5
const AIRPORT_HEIGHT = 16
/** Kod kutusu ile pin arasındaki boşluk, px. */
const AIRPORT_GAP = 3
const AIRPORT_MARGIN = 2
/** Pin katmanının `icon-size` değeri verilmezse (testler) kullanılan ölçek (z8 civarı). */
export const DEFAULT_PIN_SCALE = 0.6

/**
 * Pinin ekrandaki geometrisi (CSS px): uç noktadadır (`x`, `y`), baş yukarıdadır. Kenar ve hat
 * dahil. `scale` katmanın o yakınlaştırmadaki `icon-size` değeridir (airport-pin.ts birimleri).
 */
export function pinGeometry(x: number, y: number, scale: number) {
  const edge = AIRPORT_PIN_OUTLINE / 2 + AIRPORT_PIN_HALO
  return {
    headX: x,
    headY: y - (AIRPORT_PIN_VIEWBOX.height - AIRPORT_PIN_HEAD.cy) * scale,
    headRadius: (AIRPORT_PIN_HEAD.r + edge) * scale,
    top: y - (AIRPORT_PIN_VIEWBOX.height + edge) * scale,
  }
}

/** Pinin çakışma daireleri: baş ve uca doğru incelen gövde (kodlar pinleri örtmez). */
function addPinObstacles(obstacles: CircleObstacles, x: number, y: number, scale: number): void {
  const pin = pinGeometry(x, y, scale)
  obstacles.add(pin.headX, pin.headY, pin.headRadius)
  obstacles.add(x, y - 9 * scale, 5 * scale)
  obstacles.add(x, y - 3.5 * scale, 2.5 * scale)
}
/** Havalimanı kodu ile uçak simgesi arasında bırakılan boşluk, px. */
const AIRPORT_ICON_CLEARANCE = 2
/** Seçili uçağın simgesi (hale dahil) diğerlerinden büyük sayılır. */
const SELECTED_ICON_SCALE = 1.25
/** Seçili uçağın iz noktalarının çakışma yarıçapı (3 px çizgi + pay), px. */
const TRAIL_OBSTACLE_RADIUS = 3

const AIRPORT_RANK: Readonly<Record<Airport['type'], number>> = {
  large_airport: 0,
  medium_airport: 1,
  small_airport: 2,
}

export interface ScreenAircraft {
  ac: TrackedAircraft
  /** Simgenin ekrandaki merkezi, CSS px. */
  x: number
  y: number
}

export interface ScreenAirport {
  airport: Airport
  x: number
  y: number
}

export interface LabelFrame {
  width: number
  height: number
  /** Simgenin çakışma yarıçapı (yakınlaştırmaya göre), px. */
  iconRadius: number
  zoom: number
  aircraft: readonly ScreenAircraft[]
  airports: readonly ScreenAirport[]
  /** Seçili uçağın izinin ekrandaki noktaları (havalimanı kodları bunları örtmez). */
  trail: readonly { x: number; y: number }[]
  selectedHex: string | null
  settings: LabelSettings
  locale: Locale
  units: UnitSystem
  /** Pin katmanının o yakınlaştırmadaki `icon-size` değeri (varsayılan `DEFAULT_PIN_SCALE`). */
  pinScale?: number
  /** Birincil istasyonun ICAO kodu (IST/LTFM): kodu yerdeki uçakların üstüne yazılabilir. */
  primaryIcao?: string | null
  /**
   * Haritanın üstündeki opak paneller (tuvale göre, CSS px): seçili uçağın etiketi bunları örtmeyen
   * konumu seçer (D-085).
   */
  panels?: readonly ScreenRect[]
}

/** Ölçülmüş etiket: içerik, kutu boyutu ve tema. */
export interface MeasuredLabel {
  content: LabelContent
  width: number
  height: number
  theme: LabelTheme
  thy: boolean
}

type MeasureText = (font: string, text: string) => number

/** Etiketin kutusu: en geniş satır + yan boşluklar (+ THY şeridi), satır yükseklikleri toplamı. */
export function measureLabel(
  content: LabelContent,
  theme: LabelTheme,
  thy: boolean,
  measure: MeasureText,
): { width: number; height: number } {
  let textWidth = measure(theme.primaryFont, content.primary)
  for (const line of content.lines)
    textWidth = Math.max(textWidth, measure(theme.secondaryFont, line))
  const bar = thy ? THY_BAR_WIDTH : 0
  return {
    width: Math.ceil(textWidth + theme.padX * 2 + bar),
    height:
      theme.padTop +
      theme.primaryLine +
      content.lines.length * theme.secondaryLine +
      theme.padBottom,
  }
}

/**
 * Yerleşim önceliği: seçili uçak her zaman önce; sonra THY, sonra diğerleri; aynı grupta ekranın
 * ortasına yakın olan önce (kalabalıkta etiketini koruyan uçaklar bakılan yerdekilerdir).
 */
export function labelPriority(
  selected: boolean,
  thy: boolean,
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  if (selected) return 10
  const cx = width / 2
  const cy = height / 2
  const reach = Math.hypot(cx, cy) || 1
  const closeness = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / reach)
  return (thy ? 2 : 1) + closeness * 0.999
}

export interface PlacedAirportChip {
  icao: string
  iata: string
  x: number
  y: number
  width: number
  height: number
  major: boolean
}

export interface ChipLayoutOptions {
  /** Pin katmanının `icon-size` değeri (varsayılan `DEFAULT_PIN_SCALE`). */
  pinScale?: number
  /**
   * Birincil istasyon (IST): kodu yalnızca bu engellere bakar (yerdeki uçaklar hariç, kullanıcı
   * kararı 2026-10-01). Kalabalık apronda da kod görünür ve tıklanır; havadaki uçağı yine örtmez.
   */
  primary?: { icao: string; obstacles?: Pick<CircleObstacles, 'hits'> }
}

/**
 * Havalimanı kodlarının yeri: pin başının sağında, yer yoksa solunda, pinin üstünde ya da noktanın
 * altında. Birincil istasyon ilk, sonra büyük havalimanları yerleşir; birbirini, bir pini ya da bir
 * engeli (uçak simgesi, seçili uçağın izi) örten ya da görünümden taşan kod yazılmaz.
 */
export function layoutAirportChips(
  airports: readonly ScreenAirport[],
  view: { width: number; height: number },
  measure: MeasureText,
  obstacles?: Pick<CircleObstacles, 'hits'>,
  options: ChipLayoutOptions = {},
): PlacedAirportChip[] {
  const scale = options.pinScale ?? DEFAULT_PIN_SCALE
  const primary = options.primary
  const rank = (a: ScreenAirport) =>
    a.airport.icao === primary?.icao ? -1 : AIRPORT_RANK[a.airport.type]
  const sorted = [...airports].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.airport.iata < b.airport.iata ? -1 : a.airport.iata > b.airport.iata ? 1 : 0),
  )
  const pins = new CircleObstacles(view)
  for (const { x, y } of airports) addPinObstacles(pins, x, y, scale)
  const placed: PlacedAirportChip[] = []
  const overlaps = (x: number, y: number, w: number, h: number) =>
    placed.some(
      (o) =>
        x - AIRPORT_MARGIN < o.x + o.width &&
        x + w + AIRPORT_MARGIN > o.x &&
        y - AIRPORT_MARGIN < o.y + o.height &&
        y + h + AIRPORT_MARGIN > o.y,
    )
  for (const { airport, x, y } of sorted) {
    const width = Math.ceil(measure(AIRPORT_FONT, airport.iata) + AIRPORT_PAD_X * 2)
    const height = AIRPORT_HEIGHT
    const pin = pinGeometry(x, y, scale)
    const blockers = airport.icao === primary?.icao ? primary.obstacles : obstacles
    const candidates: [number, number][] = [
      [x + pin.headRadius + AIRPORT_GAP, pin.headY - height / 2],
      [x - pin.headRadius - AIRPORT_GAP - width, pin.headY - height / 2],
      [x - width / 2, pin.top - AIRPORT_GAP - height],
      [x - width / 2, y + AIRPORT_GAP],
    ]
    for (const [cx, cy] of candidates) {
      if (cx < 0 || cy < 0 || cx + width > view.width || cy + height > view.height) continue
      if (overlaps(cx, cy, width, height)) continue
      if (pins.hits(cx, cy, width, height)) continue
      if (blockers?.hits(cx, cy, width, height)) continue
      placed.push({
        icao: airport.icao,
        iata: airport.iata,
        x: cx,
        y: cy,
        width,
        height,
        major: airport.type === 'large_airport',
      })
      break
    }
  }
  return placed
}

/** Kodlar yazılır mı: ayar Gizle değil, yakınlaştırma yeterli ve görünümde havalimanı var. */
export function showsAirportChips(
  frame: Pick<LabelFrame, 'zoom' | 'airports' | 'settings'>,
): boolean {
  return (
    frame.settings.airports !== 'hidden' &&
    frame.zoom >= AIRPORT_LABEL_MIN_ZOOM &&
    frame.airports.length > 0
  )
}

/**
 * Havalimanı kodlarının örtmeyeceği yerler: uçak simgeleri ve seçili uçağın izi. `ground: false`
 * yerdeki uçakları katmaz (birincil istasyonun kodu için).
 */
export function chipObstacles(
  frame: LabelFrame,
  { ground = true }: { ground?: boolean } = {},
): CircleObstacles {
  const obstacles = new CircleObstacles(frame)
  for (const item of frame.aircraft) {
    if (!ground && item.ac.gnd) continue
    const scale = item.ac.hex === frame.selectedHex ? SELECTED_ICON_SCALE : 1
    obstacles.add(item.x, item.y, frame.iconRadius * scale + AIRPORT_ICON_CLEARANCE)
  }
  for (const point of frame.trail) obstacles.add(point.x, point.y, TRAIL_OBSTACLE_RADIUS)
  return obstacles
}

interface CachedLabel extends MeasuredLabel {
  key: string
}

interface HitBox {
  hex: string
  x: number
  y: number
  width: number
  height: number
}

/** Metin ölçüsü önbelleği bu boyutu aşınca boşaltılır. */
const MEASURE_CACHE_LIMIT = 4_000

export class LabelPainter {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly widths = new Map<string, number>()
  private labels = new WeakMap<TrackedAircraft, CachedLabel>()
  private hitBoxes: HitBox[] = []
  /** Son çizimde yazılan havalimanı kodları (tıklama: havalimanı penceresi). */
  private chips: PlacedAirportChip[] = []
  private width = 0
  private height = 0
  private pixelRatio = 1

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context is unavailable')
    this.canvas = canvas
    this.ctx = ctx
  }

  /** Tuvali haritanın boyutuna getirir (CSS px × cihaz piksel oranı). */
  resize(width: number, height: number, devicePixelRatio: number): void {
    const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
    if (width === this.width && height === this.height && ratio === this.pixelRatio) return
    this.width = width
    this.height = height
    this.pixelRatio = ratio
    this.canvas.width = Math.max(1, Math.round(width * ratio))
    this.canvas.height = Math.max(1, Math.round(height * ratio))
  }

  /** Yazı tipi yüklendikten sonra ölçüler yeniden alınır. */
  invalidateText(): void {
    this.widths.clear()
    this.labels = new WeakMap()
  }

  /** Noktadaki (CSS px) uçak etiketinin hex'i; üstte çizilen önce. */
  hitTest(x: number, y: number): string | null {
    for (let i = this.hitBoxes.length - 1; i >= 0; i--) {
      const box = this.hitBoxes[i]
      if (box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
        return box.hex
      }
    }
    return null
  }

  /**
   * Noktadaki (CSS px) havalimanı kodunun ICAO kodu; kod çizilmediyse (çakışma, uzak görünüm) null.
   * Tıklama önceliği map-controller.ts → `resolveHit`'tedir.
   */
  airportHitTest(x: number, y: number): string | null {
    for (const chip of this.chips) {
      if (x >= chip.x && x <= chip.x + chip.width && y >= chip.y && y <= chip.y + chip.height) {
        return chip.icao
      }
    }
    return null
  }

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.hitBoxes = []
    this.chips = []
  }

  /** Çerçeveyi çizer; tuval önceden `resize` ile haritanın boyutuna getirilmiş olmalıdır. */
  draw(frame: LabelFrame): void {
    this.clear()
    const ctx = this.ctx
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const measure = this.measure

    if (showsAirportChips(frame)) {
      const primaryIcao = frame.primaryIcao ?? null
      this.chips = layoutAirportChips(frame.airports, frame, measure, chipObstacles(frame), {
        pinScale: frame.pinScale ?? DEFAULT_PIN_SCALE,
        ...(primaryIcao === null
          ? {}
          : { primary: { icao: primaryIcao, obstacles: chipObstacles(frame, { ground: false }) } }),
      })
      for (const chip of this.chips) this.drawAirportChip(chip)
    }

    const boxes: LabelBox[] = []
    const obstacles: { x: number; y: number }[] = []
    const measured = new Map<string, { item: ScreenAircraft; label: MeasuredLabel }>()
    for (const item of frame.aircraft) {
      const selected = item.ac.hex === frame.selectedHex
      const mode: LabelMode = selected ? frame.settings.selected : frame.settings.others
      if (mode === 'hidden') {
        obstacles.push({ x: item.x, y: item.y })
        continue
      }
      const label = this.labelFor(item.ac, mode, selected, frame)
      measured.set(item.ac.hex, { item, label })
      boxes.push({
        id: item.ac.hex,
        anchorX: item.x,
        anchorY: item.y,
        width: label.width,
        height: label.height,
        priority: labelPriority(selected, label.thy, item.x, item.y, frame.width, frame.height),
      })
    }
    if (boxes.length === 0) return

    const placed = layoutLabels(boxes, frame, {
      iconRadius: frame.iconRadius,
      obstacles,
      // Birincil istasyonun kodu uçak etiketlerinin altında kalmaz (D-079); seçili etiket hariç.
      reserved: this.chips.filter((chip) => chip.icao === frame.primaryIcao),
      // Yalnızca seçili uçağın etiketi yer bulamasa da çizilir; diğerleri simge örtmez.
      mustPlace: frame.selectedHex,
      // Seçili etiket listenin, aramanın, kartın ve düğmelerin altında kalmaz (D-085).
      panels: frame.panels ?? [],
    })
    // Önce çizgiler, sonra kutular: kutu çizginin ucunu örter. Seçili etiket en son (üstte).
    placed.sort((a, b) => Number(a.id === frame.selectedHex) - Number(b.id === frame.selectedHex))
    for (const place of placed) {
      if (!place.leader) continue
      const entry = measured.get(place.id)
      if (entry)
        this.drawLeader(
          entry.item,
          place,
          entry.label,
          place.id === frame.selectedHex,
          frame.iconRadius,
        )
    }
    for (const place of placed) {
      const entry = measured.get(place.id)
      if (!entry) continue
      this.drawLabel(place.x, place.y, entry.label, place.id === frame.selectedHex)
      this.hitBoxes.push({
        hex: place.id,
        x: place.x,
        y: place.y,
        width: entry.label.width,
        height: entry.label.height,
      })
    }
  }

  private readonly measure: MeasureText = (font, text) => {
    const key = `${font}\u0000${text}`
    let width = this.widths.get(key)
    if (width === undefined) {
      if (this.widths.size >= MEASURE_CACHE_LIMIT) this.widths.clear()
      this.ctx.font = font
      width = this.ctx.measureText(text).width
      this.widths.set(key, width)
    }
    return width
  }

  private labelFor(
    ac: TrackedAircraft,
    mode: 'short' | 'full',
    selected: boolean,
    frame: LabelFrame,
  ): MeasuredLabel {
    const key = `${mode}|${selected ? 1 : 0}|${frame.locale}|${frame.units}`
    const cached = this.labels.get(ac)
    if (cached && cached.key === key) return cached
    const content = labelContent(ac, mode, { locale: frame.locale, units: frame.units })
    const theme = selected ? SELECTED_THEME : NORMAL_THEME
    const thy = isTurkishAirlines(ac)
    const size = measureLabel(content, theme, thy, this.measure)
    const label: CachedLabel = { key, content, theme, thy, ...size }
    this.labels.set(ac, label)
    return label
  }

  private drawAirportChip(chip: PlacedAirportChip): void {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.roundRect(chip.x + 0.5, chip.y + 0.5, chip.width - 1, chip.height - 1, 3)
    ctx.fillStyle = chip.major ? COLORS.airportChip : COLORS.airportChipMinor
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = COLORS.airportBorder
    ctx.stroke()
    ctx.font = AIRPORT_FONT
    ctx.fillStyle = COLORS.airportInk
    ctx.fillText(chip.iata, chip.x + AIRPORT_PAD_X, chip.y + chip.height / 2 + 0.5)
  }

  private drawLeader(
    item: ScreenAircraft,
    place: { x: number; y: number },
    label: MeasuredLabel,
    selected: boolean,
    iconRadius: number,
  ): void {
    const end = leaderEnd(item.x, item.y, {
      x: place.x,
      y: place.y,
      width: label.width,
      height: label.height,
    })
    const dx = end.x - item.x
    const dy = end.y - item.y
    const length = Math.hypot(dx, dy)
    if (length <= iconRadius) return
    // Çizgi simgenin kenarından başlar, simgenin üstüne binmez.
    const startX = item.x + (dx / length) * iconRadius
    const startY = item.y + (dy / length) * iconRadius
    const ctx = this.ctx
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(end.x, end.y)
    ctx.lineWidth = 3.5
    // Kenar: koyu çizgiye beyaz, seçilinin kehribar çizgisine koyu (uydu görüntüsünden ayrılsın).
    ctx.strokeStyle = selected ? COLORS.selectedBorder : COLORS.box
    ctx.stroke()
    ctx.lineWidth = 1.5
    ctx.strokeStyle = selected ? MAP_COLORS.selected : COLORS.leader
    ctx.stroke()
  }

  private drawLabel(x: number, y: number, label: MeasuredLabel, selected: boolean): void {
    const ctx = this.ctx
    const { theme, content, width, height } = label
    const inset = theme.border / 2
    ctx.beginPath()
    ctx.roundRect(x + inset, y + inset, width - theme.border, height - theme.border, theme.radius)
    ctx.fillStyle = selected ? MAP_COLORS.selected : COLORS.box
    ctx.fill()
    ctx.lineWidth = theme.border
    ctx.strokeStyle = selected ? COLORS.selectedBorder : COLORS.border
    ctx.stroke()

    let textX = x + theme.padX
    if (label.thy) {
      ctx.fillStyle = MAP_COLORS.thyRed
      ctx.fillRect(
        x + theme.border + 1,
        y + theme.border + 1,
        THY_BAR_WIDTH,
        height - theme.border * 2 - 2,
      )
      textX += THY_BAR_WIDTH
    }

    let lineTop = y + theme.padTop
    ctx.font = theme.primaryFont
    ctx.fillStyle = selected
      ? COLORS.selectedInk
      : content.primaryMuted
        ? COLORS.primaryMuted
        : COLORS.primary
    ctx.fillText(content.primary, textX, lineTop + theme.primaryLine / 2 + 0.5)
    lineTop += theme.primaryLine
    ctx.font = theme.secondaryFont
    ctx.fillStyle = selected ? COLORS.selectedInk : COLORS.secondary
    for (const line of content.lines) {
      ctx.fillText(line, textX, lineTop + theme.secondaryLine / 2 + 0.5)
      lineTop += theme.secondaryLine
    }
  }
}
