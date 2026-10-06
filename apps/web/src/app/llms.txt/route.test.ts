import type * as AirportsModule from '../../lib/airports'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { airportFixture, runwayFixture } from '../../lib/test/airport-fixture'
import { GET } from './route'

vi.mock('server-only', () => ({}))
const connection = vi.hoisted(() => vi.fn(async () => undefined))
const getAirports = vi.hoisted(() => vi.fn())
vi.mock('next/server', () => ({ connection }))
vi.mock('../../lib/airports', async (importOriginal) => ({
  ...(await importOriginal<typeof AirportsModule>()),
  getAirports,
}))

const AIRPORTS = [
  airportFixture({
    icao: 'LTFM',
    iata: 'IST',
    name: 'Istanbul Airport',
    isoRegion: 'TR-34',
    station: { active: true, primary: true, fetchRadiusNm: 60 },
    runways: [1, 2, 3, 4, 5, 6].map((id) => runwayFixture({ id })),
  }),
  airportFixture({
    icao: 'LTAC',
    iata: 'ESB',
    name: 'Esenboğa International Airport',
    isoRegion: 'TR-06',
  }),
  airportFixture({ icao: 'LTAG', iata: 'ADA', scheduled: false, isoRegion: 'TR-01' }),
  // Türkiye dışındaki havalimanları (D-080): ayrı bölümde, ülkeye sonra ada göre.
  airportFixture({
    icao: 'LGAV',
    iata: 'ATH',
    name: 'Athens Eleftherios Venizelos International Airport',
    country: 'GR',
    isoRegion: 'GR-I',
    ring: 1,
    distanceToTrKm: 275,
    runways: [1, 2].map((id) => runwayFixture({ id })),
  }),
  airportFixture({
    icao: 'LCEN',
    iata: 'ECN',
    name: 'Ercan International Airport',
    country: 'CY',
    isoRegion: 'CY-02',
    ring: 1,
    distanceToTrKm: 168,
  }),
]
/** Bölüm başlığı 2. halkadan beri (kullanıcı kararı 2026-10-03, D-088). */
const FOREIGN_HEADING = '## Türkiye dışındaki havalimanları / Airports outside Türkiye'
const HOST = 'https://havayolu.live'

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('APP_NAME', 'havayolu')
  vi.stubEnv('WEB_HOST', 'havayolu.live')
  getAirports.mockResolvedValue(AIRPORTS)
})

afterEach(() => {
  vi.unstubAllEnvs()
  connection.mockClear()
  getAirports.mockReset()
})

async function llms(): Promise<{ response: Response; text: string }> {
  const response = await GET()
  return { response, text: await response.text() }
}

describe('GET /llms.txt', () => {
  it('düz metin, UTF-8; önce connection() çağrılır', async () => {
    const { response } = await llms()
    expect(connection).toHaveBeenCalledTimes(1)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
  })

  it('llms.txt biçimi: # başlık, > özet, ## bölümler, sonda Optional', async () => {
    const { text } = await llms()
    const lines = text.split('\n')
    expect(lines[0]).toBe('# havayolu')
    expect(lines[2]?.startsWith('> ')).toBe(true)
    const headings = lines.filter((l) => l.startsWith('## '))
    expect(headings).toEqual([
      '## Harita / Map',
      '## Havalimanları / Airports',
      FOREIGN_HEADING,
      '## Hakkında / About',
      '## Optional',
    ])
    expect(text).toContain('ADSB.lol')
    expect(text).toContain('ODbL')
    // Hava durumu ve kaynağı (D-078); resmî brifing olmadığı iki dilde de yazılır.
    expect(text).toContain('[aviationweather.gov](https://aviationweather.gov/)')
    expect(text).toContain('resmî brifing yerine geçmez')
    expect(text).toContain('not an official briefing')
  })

  it('her bağlantı sitenin mutlak adresidir (dış kaynak atıfları hariç)', async () => {
    const { text } = await llms()
    const links = [...text.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1] ?? '')
    expect(links.length).toBeGreaterThan(10)
    const external = [
      'https://adsb.lol',
      'https://opendatacommons.org/',
      'https://ourairports.com/',
      'https://aviationweather.gov/',
    ]
    for (const link of links) {
      const ok = link.startsWith(`${HOST}/`) || external.some((e) => link.startsWith(e))
      expect(ok, link).toBe(true)
    }
    expect(links).toEqual(expect.arrayContaining([`${HOST}/`, `${HOST}/en`, `${HOST}/hakkinda`]))
  })

  it('dizine eklenen her havalimanı için tek satır; noindex havalimanı yok', async () => {
    const { text } = await llms()
    const lines = text.split('\n')
    const airportLines = lines
      .slice(0, lines.indexOf(FOREIGN_HEADING))
      .filter((l) => l.includes('/istasyon/'))
    expect(airportLines).toHaveLength(2)
    expect(text).not.toContain('LTAG')
    expect(airportLines).toContain(
      `- [İstanbul Havalimanı (IST/LTFM)](${HOST}/istasyon/LTFM): İstanbul; 6 pist; English: [Istanbul Airport](${HOST}/en/istasyon/LTFM)`,
    )
    // İl sırası Türkçe alfabeyle: Ankara, İstanbul.
    expect(airportLines[0]).toContain('(ESB/LTAC)')
  })

  it('Türkiye dışındakiler ayrı listede: ülke (Ercan için KKTC), Türkiye’ye uzaklık, pist sayısı', async () => {
    const { text } = await llms()
    const lines = text.split('\n')
    const foreign = lines.slice(
      lines.indexOf(FOREIGN_HEADING) + 1,
      lines.indexOf('## Hakkında / About'),
    )
    expect(foreign.filter((l) => l.startsWith('- '))).toEqual([
      `- [Ercan Havalimanı (ECN/LCEN)](${HOST}/istasyon/LCEN): KKTC; Türkiye’ye uzaklık 168 km; 1 pist; English: [Ercan International Airport](${HOST}/en/istasyon/LCEN)`,
      `- [Atina Eleftherios Venizelos Havalimanı (ATH/LGAV)](${HOST}/istasyon/LGAV): Yunanistan; Türkiye’ye uzaklık 275 km; 2 pist; English: [Athens Eleftherios Venizelos International Airport](${HOST}/en/istasyon/LGAV)`,
    ])
    // Kapsama dürüstlüğü: Türkiye dışındaki havalimanları 5.000 km'ye kadar listelenir (4. halka,
    // D-102), canlı uçak verisi Türkiye odaklıdır.
    expect(text).toContain(
      'Türkiye dışındaki havalimanları da listelenir: Türkiye’deki en yakın havalimanına uzaklığı en fazla 5.000 km olan',
    )
    expect(text).toContain('at most 5,000 km from the nearest airport in Türkiye')
    expect(text).not.toMatch(/[Yy]akın ülke|neighbouring/)
    expect(text).toContain('Live aircraft data is focused on Türkiye')
    // Yabancı havalimanı yoksa bölüm yazılmaz.
    getAirports.mockResolvedValue(AIRPORTS.filter((a) => a.country === 'TR'))
    expect((await llms()).text).not.toContain(FOREIGN_HEADING)
  })

  it('görünür pisti olmayan havalimanında pist notu yazılmaz ("0 pist" yok; D-101, D-102)', async () => {
    // Taşkurgan'ın (ZWTK) kaynakta karşı ucu eksik tek pist satırı var: görünür pisti yoktur.
    getAirports.mockResolvedValue([
      ...AIRPORTS,
      airportFixture({
        icao: 'ZWTK',
        iata: 'HQL',
        name: 'Tashikuergan Hongqilafu Airport',
        country: 'CN',
        isoRegion: 'CN-65',
        ring: 4,
        distanceToTrKm: 2719,
        runways: [],
      }),
    ])
    const { text } = await llms()
    expect(text.split('\n')).toContain(
      `- [Taşkurgan Hongqilafu Havalimanı (HQL/ZWTK)](${HOST}/istasyon/ZWTK): Çin; Türkiye’ye uzaklık 2.719 km; English: [Tashikuergan Hongqilafu Airport](${HOST}/en/istasyon/ZWTK)`,
    )
    expect(text).not.toMatch(/\b0 pist/)
    // Pisti olanlar yine sayıyla.
    expect(text).toContain('; 2 pist; ')
  })

  it('kodun doğrulamadığı "her hesaplanan değer tahmini etiketlidir" iddiasını taşımaz', async () => {
    const { text } = await llms()
    expect(text).not.toMatch(/“tahmini” etiketi|labelled “estimated”/)
    // Tarifesiz ama resmî adı DHMİ'den doğrulanan sivil havalimanı da listelenir (D-076).
    getAirports.mockResolvedValue([
      ...AIRPORTS,
      airportFixture({ icao: 'LTCL', iata: 'SXZ', scheduled: false, isoRegion: 'TR-56' }),
    ])
    expect((await llms()).text).toContain(`(${HOST}/istasyon/LTCL)`)
  })

  it('e-posta ya da kişisel veri içermez', async () => {
    const { text } = await llms()
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]/i)
  })
})
