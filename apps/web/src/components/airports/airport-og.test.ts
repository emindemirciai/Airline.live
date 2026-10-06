import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { guardNetwork } from '../../lib/seo/test/network-guard'
import { fixtureListedAirports, fixtureTurkishAirports } from '../../lib/test/ourairports-fixture'
import { airportOgContent, renderAirportOgPng, type AirportOgContent } from './airport-og'

vi.mock('server-only', () => ({}))

const AIRPORTS = fixtureTurkishAirports()
/**
 * Türkiye dışındaki listelenen havalimanları (açık halkalar, bugün 1.–4. halka; D-080, D-088, D-090,
 * D-102).
 */
const FOREIGN = fixtureListedAirports().filter((a) => a.country !== 'TR')

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

  it('yakın ülkelerde Türkçe ad, Türkçe şehir adı ve ülke; Ercan için KKTC (D-080)', () => {
    const athens = FOREIGN.find((a) => a.icao === 'LGAV')
    const ercan = FOREIGN.find((a) => a.icao === 'LCEN')
    const thessaloniki = FOREIGN.find((a) => a.icao === 'LGTS')
    expect(athens && airportOgContent(athens, 'havayolu', null)).toMatchObject({
      codes: 'ATH · LGAV',
      name: 'Atina Eleftherios Venizelos Havalimanı',
      location: 'Atina, Yunanistan',
    })
    expect(ercan && airportOgContent(ercan, 'havayolu', null).location).toBe('Lefkoşa, KKTC')
    // OurAirports'un İngilizce yerleşimi ("Thessaloniki", "Kos Island") görselde yazılmaz.
    expect(thessaloniki && airportOgContent(thessaloniki, 'havayolu', null).location).toBe(
      'Selanik, Yunanistan',
    )
    for (const airport of FOREIGN) {
      const { location } = airportOgContent(airport, 'havayolu', null)
      expect(location, airport.icao).not.toMatch(/Island|Thessaloniki|Damascus|Baghdad/)
    }
  })
})

/** Görseldeki her metin alanı (kodlar, ad, yer satırı) ve karakteri: `alan:karakter`. */
function glyphKeys(content: AirportOgContent): Set<string> {
  const keys = new Set<string>()
  for (const field of ['codes', 'name', 'location'] as const) {
    for (const char of content[field]) keys.add(`${field}:${char}`)
  }
  return keys
}

/**
 * Çizim örneklemi (M6g, D-088): bütün havalimanlarının görsel metinlerindeki her karakteri
 * (alanıyla, çünkü alanların yazı kalınlığı farklıdır) en az bir kez taşıyan havalimanları, açgözlü
 * seçimle; artı en uzun ad ve en uzun yer satırı (en küçük yazı boyu ve satır kırılması). Satori bir
 * harfi yerel yazı tiplerinde bulamazsa harf başına dış istek yapar; her karakter bir kez
 * çizildiğinde ağ denetimi bütün listeyle aynı şeyi kanıtlar. 225 görsel (2. halka) yerelde ~9 sn
 * sürerdi (CI'da katları), 3. halkanın 503 görseli ~20 sn; örneklem karakter kümesiyle sınırlıdır
 * (2. halkada 33, 3. halkada 35 görsel, yerelde ~1,5 sn; D-090).
 */
function glyphCover(contents: readonly AirportOgContent[]): AirportOgContent[] {
  const longest = (field: 'name' | 'location') =>
    contents.reduce((a, b) => (b[field].length > a[field].length ? b : a))
  const picked = new Set<AirportOgContent>([longest('name'), longest('location')])
  const covered = new Set<string>()
  for (const content of picked) for (const key of glyphKeys(content)) covered.add(key)
  for (;;) {
    let best: AirportOgContent | null = null
    let gain = 0
    for (const content of contents) {
      const fresh = [...glyphKeys(content)].filter((key) => !covered.has(key)).length
      if (fresh > gain) {
        best = content
        gain = fresh
      }
    }
    if (best === null) return [...picked]
    picked.add(best)
    for (const key of glyphKeys(best)) covered.add(key)
  }
}

describe('renderAirportOgPng', () => {
  const contents = [...AIRPORTS, ...FOREIGN].map((airport) =>
    airportOgContent(airport, 'havayolu', 'havayolu.live'),
  )
  const sample = glyphCover(contents)

  it('örneklem bütün listenin karakterlerini taşır ve listeden küçüktür', () => {
    const all = new Set(contents.flatMap((content) => [...glyphKeys(content)]))
    const sampled = new Set(sample.flatMap((content) => [...glyphKeys(content)]))
    expect([...all].filter((key) => !sampled.has(key))).toEqual([])
    // 2. halkanın harfleri de örneklemdedir (Romence, Hırvatça, Lehçe, Macarca); 3. halkanın
    // Çekçe, Lehçe ve Danca harfleri de (D-090).
    for (const char of ['ș', 'ă', 'đ', 'ł', 'é', 'ř', 'ě', 'ń', 'ž', 'ø']) {
      expect(all.has(`name:${char}`), char).toBe(true)
    }
    expect(sample.length).toBeLessThan(contents.length / 4)
  })

  it('karakter örneklemindeki her havalimanı 1200×630 PNG olarak ağa çıkmadan çizilir', async () => {
    for (const content of sample) {
      const png = await renderAirportOgPng(content)
      expect(pngSize(png), content.codes).toEqual({ width: 1200, height: 630 })
    }
    expect(network.networkCalls()).toEqual([])
  }, 60_000)
})
