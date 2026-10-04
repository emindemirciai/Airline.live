/**
 * Harita etiketlerinin çakışmasız yerleşimi (domain.md → Harita etiketleri: "Etiketler üst üste
 * binmez; yer yoksa etiket yana kayar ve ince bir çizgiyle uçağa bağlanır").
 *
 * Açgözlü yerleşim: öncelik (büyükten küçüğe), eşitlikte kimlik sırasıyla. Her etiket için önce
 * uçağın hemen yanındaki 4 konum (sağ üst, sağ alt, sol üst, sol alt; çizgisiz), sonra 36/56/80 px
 * uzaklıkta 8 yöndeki konumlar (çizgili) denenir. Konum geçerliyse: tümüyle görünümün içinde,
 * yerleşmiş bir etiketle ve herhangi bir uçak simgesiyle (etiketi olmayanlar dahil) kesişmiyor.
 * Yalnızca `mustPlace` ile verilen etiket (seçili uçak) simgesi görünümdeyse her zaman yerleşir;
 * geçerli yer yoksa ilk yakın konuma, gerekirse çakışarak. Diğerleri (seçim yokken en öncelikli
 * olan da) yer bulamazsa çizilmez. Simgesi görünümün tümüyle dışında kalan uçağın etiketi yoktur.
 * Seçili etiket ayrıca haritanın üstündeki panellere (`panels`: arama, kart, liste, düğmeler)
 * değmeyen konumu seçer; ortalanan seçili uçağın etiketi listenin altında kalmaz (D-085).
 *
 * Çakışma denetimi düzenli ızgarayla yapılır; 500 etiket birkaç ms sürer.
 */

export interface LabelBox {
  id: string
  /** Uçak simgesinin merkezi, CSS px. */
  anchorX: number
  anchorY: number
  width: number
  height: number
  /** Büyük olan önce yerleşir (ör. seçili 2, THY 1, diğer 0). */
  priority: number
}

export interface PlacedLabel {
  id: string
  /** Etiketin sol üst köşesi, CSS px. */
  x: number
  y: number
  /** Etiket uçaktan uzakta: simgeden etiket kenarına ince çizgi çizilir. */
  leader: boolean
}

/** Ekranda dikdörtgen: sol üst köşe ve boyut, CSS px. */
export interface ScreenRect {
  x: number
  y: number
  width: number
  height: number
}

export interface LabelLayoutOptions {
  /** Simgenin çakışma yarıçapı, px. */
  iconRadius?: number
  /** Simge ile yakın etiket arasındaki boşluk, px. */
  gap?: number
  /** Etiketi olmayan (gizli) uçakların simge merkezleri: etiketler bunları da örtmez. */
  obstacles?: readonly { x: number; y: number }[]
  /**
   * Önceden ayrılmış dikdörtgenler (sol üst köşe ve boyut; ör. birincil istasyonun IATA kodu):
   * etiketler bunları yerleşmiş bir etiket gibi örtmez. Yalnızca `mustPlace` etiketi yer bulamazsa
   * üstüne gelebilir.
   */
  reserved?: readonly ScreenRect[]
  /**
   * Yer bulamasa da (çakışarak) yerleşecek etiketin kimliği: seçili uçak. Verilmezse her etiket yer
   * bulamayınca atlanır.
   */
  mustPlace?: string | null
  /**
   * Haritanın üstündeki opak paneller (arama, bilgi kartı, uçak listesi, sağ alttaki düğmeler; D-085):
   * `mustPlace` etiketi (seçili uçak) bunlara değmeyen ilk konumu seçer; yer yoksa paneli örtmeyen
   * yakın konuma, o da yoksa yine ilk yakın konuma yerleşir. Diğer etiketler panelin altında
   * kalabilir (panel opaktır, etiketi örter).
   */
  panels?: readonly ScreenRect[]
}

export const LABEL_ICON_RADIUS = 14
export const LABEL_GAP = 4
/** Çizgili konumların simge merkezine uzaklıkları, px. */
export const LEADER_DISTANCES = [36, 56, 80] as const

/** İki etiket arasında bırakılan en az boşluk, px. */
const LABEL_MARGIN = 2
/** Izgara hücresinin kenarı, px. */
const CELL = 64

/** Çizgili konumların yönleri (ekran y aşağı): doğu, kuzeydoğu, güneydoğu, batı, …, kuzey, güney. */
const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, -1],
  [1, 1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
  [0, -1],
  [0, 1],
]

/**
 * Aday konum: etiketin `(fx, fy)` oranındaki noktası simge merkezinden `(ox, oy)` uzağa gelir.
 * Sol üst köşe = (ax + ox − w·fx, ay + oy − h·fy).
 */
interface Slot {
  ox: number
  oy: number
  fx: number
  fy: number
  leader: boolean
}

/**
 * Önce 4 yakın konum (sağ üst, sağ alt, sol üst, sol alt), sonra uzaklık sırasıyla çizgililer.
 * Üst ve alt yakın konumlar arasında etiket boşluğu kadar ara kalır; aynı noktadaki iki uçağın
 * etiketi üst üste dizilebilir.
 */
function slots(near: number): Slot[] {
  const half = LABEL_MARGIN / 2
  const result: Slot[] = [
    { ox: near, oy: -half, fx: 0, fy: 1, leader: false },
    { ox: near, oy: half, fx: 0, fy: 0, leader: false },
    { ox: -near, oy: -half, fx: 1, fy: 1, leader: false },
    { ox: -near, oy: half, fx: 1, fy: 0, leader: false },
  ]
  for (const distance of LEADER_DISTANCES) {
    for (const [dx, dy] of DIRECTIONS) {
      const scale = dx !== 0 && dy !== 0 ? distance * Math.SQRT1_2 : distance
      // Etiketin uçağa bakan kenarı (ya da köşesi) bu noktaya gelir.
      result.push({
        ox: dx * scale,
        oy: dy * scale,
        fx: dx > 0 ? 0 : dx < 0 ? 1 : 0.5,
        fy: dy > 0 ? 0 : dy < 0 ? 1 : 0.5,
        leader: true,
      })
    }
  }
  return result
}

interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Icon {
  x: number
  y: number
}

/** Düzenli ızgara: her hücre ona değen öğeleri tutar; hücreler ilk kullanımda oluşturulur. */
class Grid<T> {
  private readonly cols: number
  private readonly rows: number
  private readonly cells: (T[] | undefined)[]

  constructor(width: number, height: number) {
    this.cols = Math.max(1, Math.ceil(width / CELL))
    this.rows = Math.max(1, Math.ceil(height / CELL))
    this.cells = new Array<T[] | undefined>(this.cols * this.rows)
  }

  private col(x: number): number {
    return Math.min(this.cols - 1, Math.max(0, Math.floor(x / CELL)))
  }

  private row(y: number): number {
    return Math.min(this.rows - 1, Math.max(0, Math.floor(y / CELL)))
  }

  insert(item: T, area: Rect): void {
    const c1 = this.col(area.x1)
    const r1 = this.row(area.y1)
    for (let r = this.row(area.y0); r <= r1; r++) {
      for (let c = this.col(area.x0); c <= c1; c++) {
        const key = r * this.cols + c
        const cell = this.cells[key]
        if (cell) cell.push(item)
        else this.cells[key] = [item]
      }
    }
  }

  /** Alanın değdiği hücrelerdeki öğelerden biri için `hit` true dönerse true. */
  some(area: Rect, hit: (item: T) => boolean): boolean {
    const c1 = this.col(area.x1)
    const r1 = this.row(area.y1)
    for (let r = this.row(area.y0); r <= r1; r++) {
      for (let c = this.col(area.x0); c <= c1; c++) {
        const cell = this.cells[r * this.cols + c]
        if (!cell) continue
        for (const item of cell) if (hit(item)) return true
      }
    }
    return false
  }
}

const byPriority = (a: LabelBox, b: LabelBox) =>
  b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function layoutLabels(
  boxes: readonly LabelBox[],
  view: { width: number; height: number },
  opts: LabelLayoutOptions = {},
): PlacedLabel[] {
  const radius = opts.iconRadius ?? LABEL_ICON_RADIUS
  const { width, height } = view
  if (!(width > 0 && height > 0) || boxes.length === 0) return []
  const candidates = slots(radius + (opts.gap ?? LABEL_GAP))

  const iconVisible = (x: number, y: number) =>
    x + radius >= 0 && y + radius >= 0 && x - radius <= width && y - radius <= height

  // Bütün simgeler (etiketli ve etiketsiz) çakışma engelidir; görünüme değmeyenler atlanır.
  const icons = new Grid<Icon>(width, height)
  const addIcon = (x: number, y: number) => {
    if (!iconVisible(x, y)) return
    icons.insert({ x, y }, { x0: x - radius, y0: y - radius, x1: x + radius, y1: y + radius })
  }
  for (const box of boxes) addIcon(box.anchorX, box.anchorY)
  for (const obstacle of opts.obstacles ?? []) addIcon(obstacle.x, obstacle.y)
  const radiusSq = radius * radius

  const labels = new Grid<Rect>(width, height)
  const place = (rect: Rect) => labels.insert(rect, rect)
  for (const r of opts.reserved ?? [])
    place({ x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height })

  const inside = (r: Rect) => r.x0 >= 0 && r.y0 >= 0 && r.x1 <= width && r.y1 <= height

  const free = (r: Rect): boolean => {
    const padded = {
      x0: r.x0 - LABEL_MARGIN,
      y0: r.y0 - LABEL_MARGIN,
      x1: r.x1 + LABEL_MARGIN,
      y1: r.y1 + LABEL_MARGIN,
    }
    const hitsLabel = labels.some(
      padded,
      (o) => padded.x0 < o.x1 && padded.x1 > o.x0 && padded.y0 < o.y1 && padded.y1 > o.y0,
    )
    if (hitsLabel) return false
    return !icons.some(r, (icon) => {
      const dx = icon.x < r.x0 ? r.x0 - icon.x : icon.x > r.x1 ? icon.x - r.x1 : 0
      const dy = icon.y < r.y0 ? r.y0 - icon.y : icon.y > r.y1 ? icon.y - r.y1 : 0
      return dx * dx + dy * dy < radiusSq
    })
  }

  const rectAt = (box: LabelBox, slot: Slot): Rect => {
    const x0 = box.anchorX + slot.ox - box.width * slot.fx
    const y0 = box.anchorY + slot.oy - box.height * slot.fy
    return { x0, y0, x1: x0 + box.width, y1: y0 + box.height }
  }

  const result: PlacedLabel[] = []
  const mustPlace = opts.mustPlace ?? null

  // Paneller (yalnızca seçili etiket için): etiketler arası boşluk kadar genişletilmiş.
  const panels: Rect[] = (opts.panels ?? []).map((p) => ({
    x0: p.x - LABEL_MARGIN,
    y0: p.y - LABEL_MARGIN,
    x1: p.x + p.width + LABEL_MARGIN,
    y1: p.y + p.height + LABEL_MARGIN,
  }))
  const clearOfPanels = (r: Rect) =>
    panels.every((p) => r.x1 <= p.x0 || r.x0 >= p.x1 || r.y1 <= p.y0 || r.y0 >= p.y1)

  const placeBox = (box: LabelBox): void => {
    // Simgesi görünmeyen uçağın etiketi (kenarda, çizgisi dışarıyı gösteren) kafa karıştırır.
    if (!(box.width > 0 && box.height > 0) || !iconVisible(box.anchorX, box.anchorY)) return
    const avoidPanels = box.id === mustPlace && panels.length > 0
    for (const slot of candidates) {
      const rect = rectAt(box, slot)
      if (!inside(rect) || !free(rect)) continue
      if (avoidPanels && !clearOfPanels(rect)) continue
      place(rect)
      result.push({ id: box.id, x: rect.x0, y: rect.y0, leader: slot.leader })
      return
    }
    // Seçili uçak: simgesi görünümdeyse etiketi çakışsa da gösterilir.
    const anchorVisible =
      box.anchorX >= 0 && box.anchorX <= width && box.anchorY >= 0 && box.anchorY <= height
    if (box.id !== mustPlace || !anchorVisible) return
    const nearRects = candidates.filter((slot) => !slot.leader).map((slot) => rectAt(box, slot))
    let rect = nearRects.find((r) => inside(r) && clearOfPanels(r)) ?? nearRects.find(inside)
    if (!rect) {
      const [first] = nearRects
      const x0 = Math.min(Math.max(first?.x0 ?? 0, 0), Math.max(0, width - box.width))
      const y0 = Math.min(Math.max(first?.y0 ?? 0, 0), Math.max(0, height - box.height))
      rect = { x0, y0, x1: x0 + box.width, y1: y0 + box.height }
    }
    place(rect)
    result.push({ id: box.id, x: rect.x0, y: rect.y0, leader: false })
  }

  for (const box of [...boxes].sort(byPriority)) placeBox(box)
  return result
}

/**
 * Daire biçimli engeller (uçak simgeleri, iz noktaları) için ızgaralı çakışma dizini: dikdörtgen bir
 * dairenin içine giriyor mu. Havalimanı kodları (labels.ts) uçakları örtmesin diye kullanılır.
 */
export class CircleObstacles {
  private readonly grid: Grid<{ x: number; y: number; r: number }>

  constructor(view: { width: number; height: number }) {
    this.grid = new Grid(view.width, view.height)
  }

  add(x: number, y: number, r: number): void {
    this.grid.insert({ x, y, r }, { x0: x - r, y0: y - r, x1: x + r, y1: y + r })
  }

  /** Dikdörtgen (`x`, `y` sol üst köşe) herhangi bir daireye değiyor mu. */
  hits(x: number, y: number, width: number, height: number): boolean {
    const rect = { x0: x, y0: y, x1: x + width, y1: y + height }
    return this.grid.some(rect, (c) => {
      const dx = c.x < rect.x0 ? rect.x0 - c.x : c.x > rect.x1 ? c.x - rect.x1 : 0
      const dy = c.y < rect.y0 ? rect.y0 - c.y : c.y > rect.y1 ? c.y - rect.y1 : 0
      return dx * dx + dy * dy < c.r * c.r
    })
  }
}

/** Çizginin etiket tarafındaki ucu: etiket dikdörtgeninin simgeye en yakın noktası. */
export function leaderEnd(
  anchorX: number,
  anchorY: number,
  rect: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(anchorX, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(anchorY, rect.y), rect.y + rect.height),
  }
}
