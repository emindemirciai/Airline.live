import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOGO_COLORS, THEME_COLORS } from '../lib/seo/brand'
import { guardNetwork } from '../lib/seo/test/network-guard'
import { decodePng, rgb } from '../lib/seo/test/png'
import AppleIcon, { size as appleIconSize } from './apple-icon'
import Icon, { generateImageMetadata } from './icon'
import manifest from './manifest'

vi.mock('server-only', () => ({}))
const connection = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('next/server', () => ({ connection }))

function pngSize(bytes: Uint8Array): { width: number; height: number } {
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

let network: ReturnType<typeof guardNetwork>

beforeEach(() => {
  network = guardNetwork()
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('APP_NAME', 'havayolu')
})

afterEach(() => {
  network.restore()
  vi.unstubAllEnvs()
  connection.mockClear()
})

describe('manifest.webmanifest', () => {
  it('ad çalışma zamanında APP_NAME’den okunur; simgeler 192 ve 512 px, maskelenebilir simge ayrı', async () => {
    vi.stubEnv('APP_NAME', 'deneme')
    const m = await manifest()
    expect(connection).toHaveBeenCalledTimes(1)
    expect(m).toMatchObject({
      id: '/',
      name: 'deneme',
      short_name: 'deneme',
      lang: 'tr',
      start_url: '/',
      display: 'browser',
      // Açık turkuaz tema (D-081): tarayıcı arayüzü başlık şeridinin, açılış ekranı sayfanın rengi.
      theme_color: THEME_COLORS.header,
      background_color: THEME_COLORS.page,
    })
    expect(m.icons?.map((icon) => [icon.src, icon.sizes, icon.purpose])).toEqual([
      ['/icon/192', '192x192', 'any'],
      ['/icon/512', '512x512', 'any'],
      ['/icon/maskable', '512x512', 'maskable'],
    ])
  })
})

/** Renk yakın mı (kenar yumuşatmasız iç pikseller için ±2). */
function near(actual: [number, number, number, number], hex: string, alpha = 255): boolean {
  const [r, g, b] = rgb(hex)
  return (
    Math.abs(actual[0] - r) <= 2 &&
    Math.abs(actual[1] - g) <= 2 &&
    Math.abs(actual[2] - b) <= 2 &&
    Math.abs(actual[3] - alpha) <= 2
  )
}

describe('uygulama simgeleri', () => {
  it('generateImageMetadata manifestteki 192, 512 px ve maskelenebilir simgeyi tanımlar', () => {
    expect(generateImageMetadata()).toEqual([
      { id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
      { id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
      { id: 'maskable', size: { width: 512, height: 512 }, contentType: 'image/png' },
    ])
  })

  it.each([
    ['192', 192],
    ['512', 512],
  ])(
    '/icon/%s: %i px, köşeleri yuvarlatılmış turkuaz kare, beyaz işaret (D-086)',
    async (id, px) => {
      const response = await Icon({ id: Promise.resolve(id) })
      expect(response.headers.get('content-type')).toBe('image/png')
      const png = decodePng(new Uint8Array(await response.arrayBuffer()))
      expect([png.width, png.height]).toEqual([px, px])
      // Köşe saydam (yarıçap kenarın %24'ü), kenarın ortası ve iç pay zemin rengi.
      expect(png.pixel(1, 1)[3]).toBe(0)
      expect(near(png.pixel(px / 2, 1), THEME_COLORS.header)).toBe(true)
      expect(near(png.pixel(Math.round(px * 0.06), px / 2), THEME_COLORS.header)).toBe(true)
      // Uçağın gövdesi merkezden geçer: merkez beyaz.
      expect(near(png.pixel(px / 2, px / 2), LOGO_COLORS.header.plane)).toBe(true)
      expect(network.networkCalls()).toEqual([])
    },
  )

  it('/icon/maskable: 512 px tam kare (saydam piksel yok), işaret güvenli alanda', async () => {
    const response = await Icon({ id: Promise.resolve('maskable') })
    const png = decodePng(new Uint8Array(await response.arrayBuffer()))
    expect([png.width, png.height]).toEqual([512, 512])
    for (const [x, y] of [
      [0, 0],
      [511, 0],
      [0, 511],
      [511, 511],
    ] as const) {
      expect(near(png.pixel(x, y), THEME_COLORS.header), `${x},${y}`).toBe(true)
    }
    // Güvenli alanın (merkezden kenarın %40'ı) dışında yalnızca zemin rengi vardır.
    for (let angle = 0; angle < 360; angle += 5) {
      const radians = (angle * Math.PI) / 180
      const x = Math.round(256 + Math.cos(radians) * 512 * 0.41)
      const y = Math.round(256 + Math.sin(radians) * 512 * 0.41)
      expect(near(png.pixel(x, y), THEME_COLORS.header), `${angle}°`).toBe(true)
    }
    expect(network.networkCalls()).toEqual([])
  })

  it('apple-icon 180 px tam kare (iOS köşeyi kendisi yuvarlar; saydam piksel siyah olurdu)', async () => {
    const response = AppleIcon()
    expect(appleIconSize).toEqual({ width: 180, height: 180 })
    const png = decodePng(new Uint8Array(await response.arrayBuffer()))
    expect([png.width, png.height]).toEqual([180, 180])
    expect(near(png.pixel(0, 0), THEME_COLORS.header)).toBe(true)
    expect(near(png.pixel(90, 90), LOGO_COLORS.header.plane)).toBe(true)
    expect(network.networkCalls()).toEqual([])
  })

  it('favicon.ico 16, 32 ve 48 px PNG taşıyan geçerli bir ICO; küçük işaret (turkuaz daire, beyaz uçak)', () => {
    const ico = readFileSync(fileURLToPath(new URL('./favicon.ico', import.meta.url)))
    expect(ico.readUInt16LE(0)).toBe(0)
    expect(ico.readUInt16LE(2)).toBe(1)
    const count = ico.readUInt16LE(4)
    const sizes: number[] = []
    for (let i = 0; i < count; i++) {
      const entry = 6 + i * 16
      const length = ico.readUInt32LE(entry + 8)
      const offset = ico.readUInt32LE(entry + 12)
      const png = new Uint8Array(ico.subarray(offset, offset + length))
      const { width, height } = pngSize(png)
      expect(width).toBe(ico[entry])
      expect(height).toBe(ico[entry + 1])
      // Sade işaret (D-086, 32 px ve altı): köşe saydam, dairenin kenarı turkuaz, merkez uçak.
      const image = decodePng(png)
      expect(image.pixel(0, 0)[3], `${width}: köşe`).toBe(0)
      expect(near(image.pixel(Math.round(width * 0.1), width / 2), LOGO_COLORS.small.ring)).toBe(
        true,
      )
      // Merkezdeki piksel çoğunlukla uçaktır (16 px'te gövdenin kenarı yumuşatılır): beyaza yakın.
      expect(image.pixel(width / 2, width / 2)[0], `${width}: merkez`).toBeGreaterThan(200)
      sizes.push(width)
    }
    expect(sizes).toEqual([16, 32, 48])
  })
})
