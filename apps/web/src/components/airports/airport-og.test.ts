import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardNetwork } from '../../lib/seo/test/network-guard'
import { fixtureTurkishAirports } from '../../lib/test/ourairports-fixture'
import { airportOgContent, renderAirportOgPng } from './airport-og'

vi.mock('server-only', () => ({}))

const AIRPORTS = fixtureTurkishAirports()

/** PNG imzası ve IHDR'deki genişlik/yükseklik. */
function pngSize(buffer: ArrayBuffer): { width: number; height: number } {
  const bytes = new Uint8Array(buffer)
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const view = new DataView(buffer)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

// Satori bir harfi yerel yazı tiplerinde bulamazsa Google Fonts'a gider; bu hiç olmamalı.
let network: ReturnType<typeof guardNetwork>

beforeEach(() => {
  network = guardNetwork()
})

afterEach(() => {
  network.restore()
})

describe('airportOgContent', () => {
  it('kodlar, resmî Türkçe ad, il ve alan adı (dilden bağımsız)', () => {
    const ltfj = AIRPORTS.find((a) => a.icao === 'LTFJ')
    expect(ltfj).toBeDefined()
    expect(airportOgContent(ltfj!, 'havayolu', 'havayolu.live')).toEqual({
      app: 'havayolu',
      host: 'havayolu.live',
      codes: 'SAW · LTFJ',
      name: 'İstanbul Sabiha Gökçen Uluslararası Havalimanı',
      location: 'İstanbul, Türkiye',
    })
  })
})

describe('renderAirportOgPng', () => {
  it('fixture’daki her havalimanı 1200×630 PNG olarak ağa çıkmadan çizilir', async () => {
    for (const airport of AIRPORTS) {
      const png = await renderAirportOgPng(airportOgContent(airport, 'havayolu', 'havayolu.live'))
      expect(pngSize(png), airport.icao).toEqual({ width: 1200, height: 630 })
    }
    expect(network.networkCalls()).toEqual([])
  }, 60_000)
})
