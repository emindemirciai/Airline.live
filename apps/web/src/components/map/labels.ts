/**
 * Uçak ve havalimanı etiketleri: haritanın üstündeki `<canvas class="live-map__labels">`
 * (pointer-events yok, cihaz piksel oranına duyarlı). Harita her `render` olayında ve her çizim
 * turunda yeniden çizer (map-controller.ts).
 *
 * - Havalimanı IATA kodları önce çizilir (z ≥ 5). Tuval uçak katmanının üstünde olduğundan kod
 *   hiçbir uçak simgesini ve seçili uçağın izini örtmez: bunlara değen konum denenmez, yer yoksa kod
 *   yazılmaz. Kodlar birbirini de örtmez; uçak etiketleri üstlerine gelebilir.
 * - Uçak etiketleri etiket ayarına göre kurulur (seçili uçak `selected`, diğerleri `others`;
 *   Gizle → etiket yok, simge yine engel sayılır), `layoutLabels` ile çakışmasız yerleşir.
 * - Görünüm kullanıcının tasarım tuvalindendir (Etiket.dc.html): opak koyu kutu, ince kenar; sefer
 *   no beyaz, bilinmiyorsa çağrı kodu gri; seçili uçağın etiketi kehribar zemin, koyu kenar ve koyu
 *   yazı; THY etiketinin sol kenarında kırmızı şerit; uzaktaki etiketi simgeye koyu kenarlı ince
 *   bir çizgi bağlar (seçilide kehribar).
 */
import type { UnitSystem } from '@havayolu/i18n'
import { MAP_COLORS, isTurkishAirlines, type Airport, type Locale } from '@havayolu/shared'
import type { TrackedAircraft } from '../../lib/live/store'
import { CircleObstacles, layoutLabels, leaderEnd, type LabelBox } from '../../lib/map/label-layout'
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

export const NORMAL_THEME: LabelTheme = {
  primaryFont: `500 13px ${FONT_FAMILY}`,
  primaryLine: 16,
  secondaryFont: `400 12px ${FONT_FAMILY}`,
  secondaryLine: 15,
  padX: 6,
  padTop: 2,
  padBottom: 3,
  radius: 4,
  border: 1,
}

export const SELECTED_THEME: LabelTheme = {
  primaryFont: `500 16px ${FONT_FAMILY}`,
  primaryLine: 19,
  secondaryFont: `500 12px ${FONT_FAMILY}`,
  secondaryLine: 15,
  padX: 8,
  padTop: 3,
  padBottom: 4,
  radius: 6,
  border: 2,
}

/** THY etiketinin sol kenarındaki kırmızı şeridin genişliği. */
export const THY_BAR_WIDTH = 3

/** Etiket renkleri (tasarım tuvali v2). */
const COLORS = {
  box: MAP_COLORS.background,
  border: MAP_COLORS.lineStrong,
  primary: '#FFFFFF',
  primaryMuted: '#B9C5D0',
  secondary: '#D3DBE2',
  selectedInk: '#111111',
  leader: '#FFFFFF',
  airportChip: '#FFFFFF',
  airportChipMinor: '#C5CED6',
  airportInk: MAP_COLORS.background,
} as const

/** Havalimanı kodları bu yakınlaştırmadan itibaren yazılır. */
export const AIRPORT_LABEL_MIN_ZOOM = 5
const AIRPORT_FONT = `500 12px ${FONT_FAMILY}`
const AIRPORT_PAD_X = 5
const AIRPORT_HEIGHT = 18
/** Kod kutusunun havalimanı noktasına yatay uzaklığı. */
const AIRPORT_OFFSET = 7
/** Üst ve alt konumun dikey uzaklığı: yandaki kodlarla çakışmaz. */
const AIRPORT_OFFSET_Y = AIRPORT_HEIGHT / 2 + 4
const AIRPORT_MARGIN = 2
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
  iata: string
  x: number
  y: number
  width: number
  height: number
  major: boolean
}

/**
 * Havalimanı kodlarının yeri: noktanın sağında, yer yoksa solunda, üstünde ya da altında.
 * Büyük havalimanları önce yerleşir; birbirini ya da bir engeli (uçak simgesi, seçili uçağın izi)
 * örten ya da görünümden taşan kod yazılmaz.
 */
export function layoutAirportChips(
  airports: readonly ScreenAirport[],
  view: { width: number; height: number },
  measure: MeasureText,
  obstacles?: Pick<CircleObstacles, 'hits'>,
): PlacedAirportChip[] {
  const sorted = [...airports].sort(
    (a, b) =>
      AIRPORT_RANK[a.airport.type] - AIRPORT_RANK[b.airport.type] ||
      (a.airport.iata < b.airport.iata ? -1 : a.airport.iata > b.airport.iata ? 1 : 0),
  )
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
    const candidates: [number, number][] = [
      [x + AIRPORT_OFFSET, y - height / 2],
      [x - AIRPORT_OFFSET - width, y - height / 2],
      [x - width / 2, y - AIRPORT_OFFSET_Y - height],
      [x - width / 2, y + AIRPORT_OFFSET_Y],
    ]
    for (const [cx, cy] of candidates) {
      if (cx < 0 || cy < 0 || cx + width > view.width || cy + height > view.height) continue
      if (overlaps(cx, cy, width, height)) continue
      if (obstacles?.hits(cx, cy, width, height)) continue
      placed.push({
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

/** Havalimanı kodlarının örtmeyeceği yerler: bütün uçak simgeleri ve seçili uçağın izi. */
export function chipObstacles(frame: LabelFrame): CircleObstacles {
  const obstacles = new CircleObstacles(frame)
  for (const item of frame.aircraft) {
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

  clear(): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.hitBoxes = []
  }

  /** Çerçeveyi çizer; tuval önceden `resize` ile haritanın boyutuna getirilmiş olmalıdır. */
  draw(frame: LabelFrame): void {
    this.clear()
    const ctx = this.ctx
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0)
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const measure = this.measure

    if (frame.zoom >= AIRPORT_LABEL_MIN_ZOOM && frame.airports.length > 0) {
      for (const chip of layoutAirportChips(frame.airports, frame, measure, chipObstacles(frame)))
        this.drawAirportChip(chip)
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
      // Yalnızca seçili uçağın etiketi yer bulamasa da çizilir; diğerleri simge örtmez.
      mustPlace: frame.selectedHex,
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
    ctx.strokeStyle = COLORS.airportInk
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
    ctx.strokeStyle = COLORS.box
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
    ctx.strokeStyle = selected ? MAP_COLORS.background : COLORS.border
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
