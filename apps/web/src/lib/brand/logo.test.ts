import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LOGO_COLORS, THEME_COLORS } from '../seo/brand'
import {
  LOGO_ICON_CORNER_RATIO,
  LOGO_ICON_INSET_RATIO,
  LOGO_KNOCKOUT_PATH,
  LOGO_KNOCKOUT_TAIL_PATH,
  LOGO_KNOCKOUT_WIDTH,
  LOGO_PLANE_SCALE,
  LOGO_RING,
  LOGO_SMALL_DISC_RADIUS,
  logoPlaneTransform,
  PLANE_BODY,
  PLANE_BODY_PATH,
  PLANE_ENGINES_PATH,
  toPlaneSpace,
  type LogoPoint,
} from './logo-geometry'
import { logoIconSvg, logoSvg } from './logo-svg'

/**
 * Tasarım tuvalindeki "A · Halka" (Main.dc.html, kullanıcı kararı 2026-10-03, D-086): `planeTop`
 * sembolünün iki yolu ve işaretin dönüşümleri. Geometri bu değerlerden sapmamalıdır.
 */
const DESIGN_BODY =
  'M50 4C52.6 4 54 7.5 54 13L54 36L87 56.5C91 59 94 60.5 95 62.5C95.3 63.3 94.6 63.8 93.6 63.6L54 52L54 78L68 87.5C69.6 88.5 70 89.7 69.3 90.4L54 86.6C53.6 90.6 52 94 50 96C48 94 46.4 90.6 46 86.6L30.7 90.4C30 89.7 30.4 88.5 32 87.5L46 78L46 52L6.4 63.6C5.4 63.8 4.7 63.3 5 62.5C6 60.5 9 59 13 56.5L46 36L46 13C46 7.5 47.4 4 50 4Z'
const DESIGN_ENGINES =
  'M65.6 39a2.6 2.6 0 0 1 2.6 2.6v6.8a2.6 2.6 0 0 1-5.2 0v-6.8a2.6 2.6 0 0 1 2.6-2.6ZM34.4 39a2.6 2.6 0 0 1 2.6 2.6v6.8a2.6 2.6 0 0 1-5.2 0v-6.8a2.6 2.6 0 0 1 2.6-2.6Z'

/** Uçak koordinatındaki bir noktanın kutudaki yeri (`logoPlaneTransform`; SVG'de y aşağı). */
function toBox([x, y]: LogoPoint, scale: number): LogoPoint {
  const angle = Math.PI / 4
  const dx = (x - 50) * scale
  const dy = (y - 50) * scale
  return [
    50 + dx * Math.cos(angle) - dy * Math.sin(angle),
    50 + dx * Math.sin(angle) + dy * Math.cos(angle),
  ]
}

const fromCentre = ([x, y]: LogoPoint) => Math.hypot(x - 50, y - 50)

/** Gövde çizgisinin köşe noktaları (eğrilerin bitişleri dahil). */
const BODY_POINTS: LogoPoint[] = [
  PLANE_BODY.start,
  ...PLANE_BODY.segments.map((segment) => ('line' in segment ? segment.line : segment.curve[2])),
]

describe('logo geometrisi (D-086)', () => {
  it('uçağın yolları tasarımdaki `planeTop` sembolüyle birebir aynıdır', () => {
    expect(PLANE_BODY_PATH).toBe(DESIGN_BODY)
    expect(PLANE_ENGINES_PATH).toBe(DESIGN_ENGINES)
  })

  it('dönüşüm: merkezde 45° sağ üst, tam işarette 0,98, küçük işarette 0,74', () => {
    expect(logoPlaneTransform('full')).toBe(
      'translate(50 50) rotate(45) scale(0.98) translate(-50 -50)',
    )
    expect(logoPlaneTransform('small')).toBe(
      'translate(50 50) rotate(45) scale(0.74) translate(-50 -50)',
    )
    expect(LOGO_RING).toEqual({ cx: 50, cy: 50, r: 40, strokeWidth: 7 })
    expect(LOGO_KNOCKOUT_WIDTH).toBe(10)
    // Kuyruk üçgeni maskededir: yatay kuyruk ile kuyruk konisi arasında halka kırıntısı kalmaz (D-086).
    expect(LOGO_KNOCKOUT_TAIL_PATH).toBe('M30.7 90.4L50 96L69.3 90.4L50 80Z')
    expect(LOGO_KNOCKOUT_PATH).toBe(PLANE_BODY_PATH + LOGO_KNOCKOUT_TAIL_PATH)
    expect(LOGO_SMALL_DISC_RADIUS).toBe(48)
    expect([LOGO_ICON_CORNER_RATIO, LOGO_ICON_INSET_RATIO]).toEqual([0.24, 0.12])
  })

  it('burun sağ üste bakar; toPlaneSpace dönüşümün tersidir', () => {
    const nose = toBox([50, 4], LOGO_PLANE_SCALE.full)
    expect(nose[0]).toBeGreaterThan(75)
    expect(nose[1]).toBeLessThan(25)
    for (const variant of ['full', 'small'] as const) {
      for (const point of BODY_POINTS) {
        const [x, y] = toPlaneSpace(...toBox(point, LOGO_PLANE_SCALE[variant]), variant)
        expect(x).toBeCloseTo(point[0], 9)
        expect(y).toBeCloseTo(point[1], 9)
      }
    }
  })

  it('tam işarette burun, kanat uçları ve kuyruk halkanın dışına taşar (halkayı keser)', () => {
    const outer = LOGO_RING.r + LOGO_RING.strokeWidth / 2
    const scale = LOGO_PLANE_SCALE.full
    for (const [name, point] of [
      ['burun', [50, 4]],
      ['sağ kanat ucu', [95, 62.5]],
      ['sol kanat ucu', [5, 62.5]],
      ['kuyruk', [50, 96]],
      ['sağ yatay kuyruk', [69.3, 90.4]],
      ['sol yatay kuyruk', [30.7, 90.4]],
    ] as const) {
      expect(fromCentre(toBox(point, scale)), name).toBeGreaterThan(outer)
    }
  })

  it('küçük işarette uçak dairenin içinde kalır; uygulama simgesinde işaret güvenli alandadır', () => {
    const farthest = (scale: number) =>
      Math.max(...BODY_POINTS.map((point) => fromCentre(toBox(point, scale))))
    expect(farthest(LOGO_PLANE_SCALE.small)).toBeLessThan(LOGO_SMALL_DISC_RADIUS)
    // Maskelenebilir simgenin güvenli alanı: merkezden kenarın %40'ı.
    const iconScale = 1 - 2 * LOGO_ICON_INSET_RATIO
    expect((farthest(LOGO_PLANE_SCALE.full) * iconScale) / 100).toBeLessThan(0.4)
    expect(((LOGO_RING.r + LOGO_RING.strokeWidth / 2) * iconScale) / 100).toBeLessThan(0.4)
  })
})

describe('logo renkleri (D-086)', () => {
  it('açık zeminde turkuaz halka ve koyu uçak; şeritte beyaz; koyu zeminde açık turkuaz', () => {
    expect(LOGO_COLORS).toEqual({
      light: { ring: '#0A828D', plane: '#0B2A33' },
      header: { ring: '#FFFFFF', plane: '#FFFFFF' },
      dark: { ring: '#5FD3DD', plane: '#FFFFFF' },
      small: { ring: '#0A828D', plane: '#FFFFFF' },
    })
    expect(LOGO_COLORS.light.ring).toBe(THEME_COLORS.header)
    expect(LOGO_COLORS.light.plane).toBe(THEME_COLORS.ink)
  })
})

describe('logo SVG’si', () => {
  it('tam işaret: halka kendi maskesiyle kesilir, uçak üstte; süstür', () => {
    const html = renderToStaticMarkup(
      logoSvg({ variant: 'full', colors: LOGO_COLORS.light, maskId: 'cut', size: 40 }),
    )
    expect(html).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 100" width="40" height="40" aria-hidden="true" focusable="false">/,
    )
    expect(html).toContain(
      '<mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">',
    )
    expect(html).toContain(
      `<path d="${DESIGN_BODY}M30.7 90.4L50 96L69.3 90.4L50 80Z" transform="translate(50 50) rotate(45) scale(0.98) translate(-50 -50)" fill="#000" stroke="#000" stroke-width="10" stroke-linejoin="round"></path>`,
    )
    expect(html).toContain(
      '<circle cx="50" cy="50" r="40" fill="none" stroke="#0A828D" stroke-width="7" mask="url(#cut)"></circle>',
    )
    expect(html).toContain(
      `<g transform="translate(50 50) rotate(45) scale(0.98) translate(-50 -50)" fill="#0B2A33"><path d="${DESIGN_BODY}"></path><path d="${DESIGN_ENGINES}"></path></g>`,
    )
    // Halka uçaktan önce çizilir (uçak üstte).
    expect(html.indexOf('<circle')).toBeLessThan(html.lastIndexOf(`<path d="${DESIGN_BODY}"`))
    expect(html).not.toMatch(/<title|aria-label|role=/)
  })

  it('küçük işaret: dolu daire ve 0,74 ölçekli uçak; maske yok', () => {
    const html = renderToStaticMarkup(
      logoSvg({ variant: 'small', colors: LOGO_COLORS.small, maskId: 'unused' }),
    )
    expect(html).toContain('<circle cx="50" cy="50" r="48" fill="#0A828D"></circle>')
    expect(html).toContain(
      '<g transform="translate(50 50) rotate(45) scale(0.74) translate(-50 -50)" fill="#FFFFFF">',
    )
    expect(html).not.toMatch(/<mask|width="/)
  })

  it('uygulama simgesi: turkuaz zemin (yuvarlak ya da tam kare), %12 içeride beyaz tam işaret', () => {
    const rounded = renderToStaticMarkup(logoIconSvg({ size: 192, rounded: true, maskId: 'm' }))
    expect(rounded).toContain('<rect width="100" height="100" rx="24" fill="#0A828D"></rect>')
    expect(rounded).toContain('<g transform="translate(12 12) scale(0.76)">')
    expect(rounded).toContain('stroke="#FFFFFF" stroke-width="7" mask="url(#m)"')
    const square = renderToStaticMarkup(logoIconSvg({ size: 512, rounded: false, maskId: 'm' }))
    expect(square).toContain('<rect width="100" height="100" rx="0" fill="#0A828D"></rect>')
  })
})
