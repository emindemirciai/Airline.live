/**
 * Logonun geometrisi: "A · Halka" (kullanıcı kararı 2026-10-03, D-086). Üstten görülen çift motorlu
 * bir yolcu uçağı halkanın içinden 45° ile sağ üste uçar; burun, kanat uçları ve kuyruk halkayı
 * keser. Bütün çizimler bu modülden okur: sitenin başlığı (`components/brand/brand-mark.tsx`),
 * uygulama simgeleri ve paylaşım görselleri (`logo-svg.tsx`, `lib/seo/og.tsx`) ve
 * `scripts/gen-favicon.mts`. Birimler 100 × 100 kutudadır (SVG `viewBox="0 0 100 100"`). Bu modül
 * import almaz; script'ten doğrudan okunabilir. Renkler `lib/seo/brand.ts` → `LOGO_COLORS`'tadır.
 */

/** Kutunun kenarı ve merkezi (birim). */
export const LOGO_BOX = 100
export const LOGO_CENTER = 50

export type LogoPoint = readonly [x: number, y: number]

/** Kapalı çizginin bir parçası: doğru ya da kübik Bézier (iki denetim noktası ve bitiş). */
export type LogoSegment =
  { readonly line: LogoPoint } | { readonly curve: readonly [LogoPoint, LogoPoint, LogoPoint] }

export interface LogoOutline {
  readonly start: LogoPoint
  readonly segments: readonly LogoSegment[]
}

/**
 * Gövde, ok açılı kanatlar (uçları kavisli) ve yatay kuyruk: tek kapalı çizgi. Uçak burnu yukarıda
 * (50, 4), kuyruğu aşağıda (50, 96) çizilir; yön `logoPlaneTransform` ile verilir. Çizgi ekranda saat
 * yönündedir.
 */
export const PLANE_BODY: LogoOutline = {
  start: [50, 4],
  segments: [
    {
      curve: [
        [52.6, 4],
        [54, 7.5],
        [54, 13],
      ],
    },
    { line: [54, 36] },
    { line: [87, 56.5] },
    {
      curve: [
        [91, 59],
        [94, 60.5],
        [95, 62.5],
      ],
    },
    {
      curve: [
        [95.3, 63.3],
        [94.6, 63.8],
        [93.6, 63.6],
      ],
    },
    { line: [54, 52] },
    { line: [54, 78] },
    { line: [68, 87.5] },
    {
      curve: [
        [69.6, 88.5],
        [70, 89.7],
        [69.3, 90.4],
      ],
    },
    { line: [54, 86.6] },
    {
      curve: [
        [53.6, 90.6],
        [52, 94],
        [50, 96],
      ],
    },
    {
      curve: [
        [48, 94],
        [46.4, 90.6],
        [46, 86.6],
      ],
    },
    { line: [30.7, 90.4] },
    {
      curve: [
        [30, 89.7],
        [30.4, 88.5],
        [32, 87.5],
      ],
    },
    { line: [46, 78] },
    { line: [46, 52] },
    { line: [6.4, 63.6] },
    {
      curve: [
        [5.4, 63.8],
        [4.7, 63.3],
        [5, 62.5],
      ],
    },
    {
      curve: [
        [6, 60.5],
        [9, 59],
        [13, 56.5],
      ],
    },
    { line: [46, 36] },
    { line: [46, 13] },
    {
      curve: [
        [46, 7.5],
        [47.4, 4],
        [50, 4],
      ],
    },
  ],
}

/** Motor gondolu: gövdeye paralel kapsül (uçları yarım daire). `top` burun ucudur. */
export interface LogoCapsule {
  readonly x: number
  readonly top: number
  /** Düz kısmın boyu (iki yarım dairenin merkezleri arası). */
  readonly length: number
  readonly radius: number
}

/** İki motor, kanadın önünde (sağ, sol). */
export const PLANE_ENGINES: readonly LogoCapsule[] = [
  { x: 65.6, top: 39, length: 6.8, radius: 2.6 },
  { x: 34.4, top: 39, length: 6.8, radius: 2.6 },
]

/** Halka: merkez, yarıçap ve çizgi kalınlığı. */
export const LOGO_RING = { cx: LOGO_CENTER, cy: LOGO_CENTER, r: 40, strokeWidth: 7 } as const

/**
 * Uçağın halkada açtığı boşluk: gövde çizgisi bu kalınlıkta (her yanda yarısı) ve yuvarlak köşeyle
 * çizilip halkadan çıkarılır (SVG maskesi). Motorlar halkaya uzaktır; maskeye girmez.
 */
export const LOGO_KNOCKOUT_WIDTH = 10

/**
 * Kuyrukta maskeye eklenen üçgen (uçak koordinatlarında): yatay kuyruğun iki arka ucu, kuyruk
 * konisi ve gövde. Onsuz gövde çizgisinin boşluğu yatay kuyruk ile kuyruk konisi arasında halkanın
 * dış kenarından iki küçük üçgen bırakıyordu (128 px ve üstünde nokta gibi görünür). Aynı kalınlıkla
 * çizilir; başka hiçbir kesik değişmez (D-086).
 */
export const LOGO_KNOCKOUT_TAIL_PATH = 'M30.7 90.4L50 96L69.3 90.4L50 80Z'

/** Uçuş yönü: saat yönünde derece (0 = burun yukarıda); 45 = sağ üst. */
export const LOGO_HEADING_DEG = 45

/** Uçağın ölçeği: tam işarette halkayı keser, küçük işarette dairenin içinde kalır. */
export const LOGO_PLANE_SCALE = { full: 0.98, small: 0.74 } as const

/** Küçük işaretin dairesi (halka yok; 32 px ve altındaki tek başına simgeler, favicon). */
export const LOGO_SMALL_DISC_RADIUS = 48

/** Uygulama simgesi: köşe yarıçapı ve tam işaretin her kenardan içeri payı (kenara oran). */
export const LOGO_ICON_CORNER_RATIO = 0.24
export const LOGO_ICON_INSET_RATIO = 0.12

export type LogoVariant = keyof typeof LOGO_PLANE_SCALE

function point([x, y]: LogoPoint): string {
  return `${x} ${y}`
}

/** Kapalı çizginin SVG yol verisi: `M50 4C52.6 4 54 7.5 54 13L54 36…Z`. */
function outlinePath(outline: LogoOutline): string {
  const parts = outline.segments.map((segment) =>
    'line' in segment ? `L${point(segment.line)}` : `C${segment.curve.map(point).join(' ')}`,
  )
  return `M${point(outline.start)}${parts.join('')}Z`
}

/** Kapsüllerin SVG yol verisi (saat yönünde; gövdeyle aynı yönde, örtüşen alan boş kalmaz). */
function capsulePath(capsules: readonly LogoCapsule[]): string {
  return capsules
    .map(({ x, top, length, radius: r }) => {
      const arc = `a${r} ${r} 0 0 1`
      return `M${x} ${top}${arc} ${r} ${r}v${length}${arc}-${2 * r} 0v-${length}${arc} ${r}-${r}Z`
    })
    .join('')
}

/** Uçağın yol verisi: gövde ve motorlar (ayrı `<path>`'ler). */
export const PLANE_BODY_PATH = outlinePath(PLANE_BODY)
export const PLANE_ENGINES_PATH = capsulePath(PLANE_ENGINES)

/** Halkadan çıkarılan şekil: gövde ve kuyruk üçgeni (aynı kalınlıkta çizgiyle). */
export const LOGO_KNOCKOUT_PATH = PLANE_BODY_PATH + LOGO_KNOCKOUT_TAIL_PATH

/** Uçağı kutunun merkezinde döndürüp ölçekleyen SVG dönüşümü. */
export function logoPlaneTransform(variant: LogoVariant): string {
  const c = LOGO_CENTER
  return `translate(${c} ${c}) rotate(${LOGO_HEADING_DEG}) scale(${LOGO_PLANE_SCALE[variant]}) translate(-${c} -${c})`
}

/**
 * Kutudaki bir noktanın uçak çiziminin koordinatlarındaki karşılığı (`logoPlaneTransform`'un tersi);
 * script'in tarayıcısız çiziminde kullanılır.
 */
export function toPlaneSpace(x: number, y: number, variant: LogoVariant): LogoPoint {
  const scale = LOGO_PLANE_SCALE[variant]
  const angle = (-LOGO_HEADING_DEG * Math.PI) / 180
  const dx = (x - LOGO_CENTER) / scale
  const dy = (y - LOGO_CENTER) / scale
  return [
    LOGO_CENTER + dx * Math.cos(angle) - dy * Math.sin(angle),
    LOGO_CENTER + dx * Math.sin(angle) + dy * Math.cos(angle),
  ]
}
