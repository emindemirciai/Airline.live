import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MAP_COLORS } from '@havayolu/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardNetwork } from '../lib/seo/test/network-guard'
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
  it('ad çalışma zamanında APP_NAME’den okunur; simgeler 192 ve 512 px', async () => {
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
      theme_color: MAP_COLORS.background,
      background_color: MAP_COLORS.background,
    })
    expect(m.icons?.map((icon) => [icon.src, icon.sizes, icon.purpose])).toEqual([
      ['/icon/192', '192x192', 'any'],
      ['/icon/512', '512x512', 'any'],
      ['/icon/512', '512x512', 'maskable'],
    ])
  })
})

describe('uygulama simgeleri', () => {
  it('generateImageMetadata manifestteki 192 ve 512 px simgeleri tanımlar', () => {
    expect(generateImageMetadata()).toEqual([
      { id: '192', size: { width: 192, height: 192 }, contentType: 'image/png' },
      { id: '512', size: { width: 512, height: 512 }, contentType: 'image/png' },
    ])
  })

  it.each([192, 512])('%i px PNG çizilir, ağa çıkılmaz', async (px) => {
    const response = await Icon({ id: Promise.resolve(String(px)) })
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(pngSize(new Uint8Array(await response.arrayBuffer()))).toEqual({ width: px, height: px })
    expect(network.networkCalls()).toEqual([])
  })

  it('apple-icon 180 px', async () => {
    const response = AppleIcon()
    expect(appleIconSize).toEqual({ width: 180, height: 180 })
    expect(pngSize(new Uint8Array(await response.arrayBuffer()))).toEqual({
      width: 180,
      height: 180,
    })
    expect(network.networkCalls()).toEqual([])
  })

  it('favicon.ico 16, 32 ve 48 px PNG taşıyan geçerli bir ICO', () => {
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
      sizes.push(width)
    }
    expect(sizes).toEqual([16, 32, 48])
  })
})
