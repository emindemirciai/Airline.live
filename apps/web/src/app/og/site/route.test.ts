import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AIRPORT_NAMES, TR_PROVINCES } from '@havayolu/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as OgSiteModule from '../../../lib/seo/og-site'
import { renderSiteOgPng } from '../../../lib/seo/og-site'
import { guardNetwork } from '../../../lib/seo/test/network-guard'
import { GET } from './route'

vi.mock('server-only', () => ({}))
const connection = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('next/server', () => ({ connection }))
// Gerçek çizim, çağrı sayısı izlenerek (bellekteki önbelleğin denetimi).
vi.mock('../../../lib/seo/og-site', async (importOriginal) => {
  const original = await importOriginal<typeof OgSiteModule>()
  return { ...original, renderSiteOgPng: vi.fn(original.renderSiteOgPng) }
})

/** PNG imzası ve IHDR'deki genişlik/yükseklik. */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

// Hiçbir çizim ağa çıkmamalı (CLAUDE.md: testler ve üretim kodu canlı dış servise istek atmaz).
let network: ReturnType<typeof guardNetwork>

beforeEach(() => {
  network = guardNetwork()
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('APP_NAME', 'havayolu')
  vi.stubEnv('WEB_HOST', 'airline.live')
})

afterEach(() => {
  network.restore()
  vi.unstubAllEnvs()
  connection.mockClear()
})

describe('GET /og/site', () => {
  it('1200×630 PNG döner, önce connection() çağrılır, ağa çıkılmaz', async () => {
    const response = await GET()
    expect(connection).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('cache-control')).toBe('public, max-age=86400')
    expect(pngSize(new Uint8Array(await response.arrayBuffer()))).toEqual({
      width: 1200,
      height: 630,
    })
    expect(network.networkCalls()).toEqual([])
  })

  it('görsel süreçte bir kez çizilir; ad ya da alan adı değişince yeniden çizilir', async () => {
    const render = vi.mocked(renderSiteOgPng)
    const first = new Uint8Array(await (await GET()).arrayBuffer())
    const before = render.mock.calls.length
    const second = new Uint8Array(await (await GET()).arrayBuffer())
    expect(render.mock.calls.length).toBe(before)
    expect(second).toEqual(first)

    vi.stubEnv('APP_NAME', 'deneme')
    const renamed = new Uint8Array(await (await GET()).arrayBuffer())
    expect(render.mock.calls.length).toBe(before + 1)
    expect(render.mock.lastCall?.[0]).toMatchObject({ name: 'deneme', host: 'airline.live' })
    expect(renamed).not.toEqual(first)
    expect(network.networkCalls()).toEqual([])
  })

  it('WEB_HOST yoksa alan adı yazılmaz', async () => {
    vi.stubEnv('WEB_HOST', '')
    await GET()
    expect(vi.mocked(renderSiteOgPng).mock.lastCall?.[0]).toMatchObject({ host: null })
  })
})

/** OurAirports fixture'ındaki Türkiye satırları (adlar, yerleşimler); üretim dökümüyle aynıdır. */
function ourAirportsTurkeyText(): string {
  const csv = readFileSync(
    fileURLToPath(
      new URL('../../../../../../tools/fixtures/ourairports/airports.csv', import.meta.url),
    ),
    'utf8',
  )
  return csv
    .split('\n')
    .filter((line) => line.includes('"TR"'))
    .join(' ')
}

describe('paylaşım görseli yazı tipleri', () => {
  it('Türkçe harfler, havalimanı ve il adları yerel yazı tipleriyle çizilir', async () => {
    const names = Object.values(AIRPORT_NAMES).flatMap((entry) => [entry.tr, entry.en])
    const provinces = Object.values(TR_PROVINCES).flatMap((p) => [p.tr, p.en])
    const all = ['ÇçĞğİıÖöŞşÜüÂâÎîÛû · — ’ “ ”', ...names, ...provinces, ourAirportsTurkeyText()]
    // Harf kapsamı için her karakterin bir kez çizilmesi yeter.
    const text = [...new Set(all.join(' '))].join('')
    expect(text).toContain('ğ')
    const png = await renderSiteOgPng({
      name: 'havayolu',
      host: 'airline.live',
      taglineTr: text,
      taglineEn: text,
    })
    expect(pngSize(new Uint8Array(png))).toEqual({ width: 1200, height: 630 })
    expect(network.networkCalls()).toEqual([])
  })

  it('koruma çalışıyor: kapsam dışındaki bir karakter (→) yazı tipi indirmeyi dener', async () => {
    // Satori indirme hatasını yakalayıp konsola yazar; test çıktısını kirletmesin.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await renderSiteOgPng({ name: 'havayolu', host: null, taglineTr: '→', taglineEn: '→' })
    } catch {
      // Çizimin sonucu önemsizdir; yalnızca denenen istek sayılır.
    } finally {
      consoleError.mockRestore()
    }
    expect(network.networkCalls().some((url) => url.includes('fonts.googleapis.com'))).toBe(true)
  })
})
