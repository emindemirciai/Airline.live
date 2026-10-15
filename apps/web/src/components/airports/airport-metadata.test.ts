import { LOCALES } from '@havayolu/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { INDEX_ROBOTS, NOINDEX_ROBOTS } from '../../lib/seo/metadata'
import { airportFixture } from '../../lib/test/airport-fixture'
import { airportPageMetadata } from './airport-metadata'

// `server-only` istemci paketlerinde hata fırlatır; testte sunucu modülü olarak yüklenir.
vi.mock('server-only', () => ({}))

beforeEach(() => {
  vi.stubEnv('APP_ENV', 'test')
  vi.stubEnv('APP_NAME', 'havayolu')
  vi.stubEnv('WEB_HOST', 'airline.live')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

const LTFM = airportFixture({
  icao: 'LTFM',
  iata: 'IST',
  lat: 41.262222,
  lon: 28.727778,
  station: { active: true, primary: true, fetchRadiusNm: 60 },
})
/** Ad tablosunda olmayan, tarifesiz ve istasyon olmayan yeni Türkiye kaydı (OurAirports'a eklenen). */
const LTZZ = airportFixture({
  icao: 'LTZZ',
  iata: 'YZG',
  name: 'Yozgat Airport',
  isoRegion: 'TR-66',
  lat: 39.8,
  lon: 34.8,
  scheduled: false,
})
const AIRPORTS = [LTFM, LTZZ]

describe('airportPageMetadata (istasyon sayfasının üst verisi)', () => {
  it.each(LOCALES)(
    '%s: adı doğrulanmamış, tarifesiz ve istasyon olmayan kayıt `noindex, follow` alır (D-076, D-084)',
    (locale) => {
      const meta = airportPageMetadata({ locale, airport: LTZZ, airports: AIRPORTS })
      expect(meta.robots).toEqual(NOINDEX_ROBOTS)
      expect(meta.robots).toEqual({ index: false, follow: true })
      expect(meta.alternates?.canonical).toMatch(/\/istasyon\/LTZZ$/)
      // Paylaşım görseli sayfanın klasöründen gelir; sitenin varsayılan görseli yazılmaz.
      expect(Object.hasOwn(meta.openGraph ?? {}, 'images')).toBe(false)
    },
  )

  it.each(LOCALES)('%s: izlenen istasyon ve tarifeli havalimanı dizine girer', (locale) => {
    expect(airportPageMetadata({ locale, airport: LTFM, airports: AIRPORTS }).robots).toEqual(
      INDEX_ROBOTS,
    )
    const scheduled = { ...LTZZ, scheduled: true }
    expect(
      airportPageMetadata({ locale, airport: scheduled, airports: [LTFM, scheduled] }).robots,
    ).toEqual(INDEX_ROBOTS)
  })

  it.each(LOCALES)(
    '%s: başlık ve açıklama canlı veri çekim alanına bakar; dışındaki havalimanı canlı trafik vaat etmez (D-106)',
    (locale) => {
      const vienna = airportFixture({
        icao: 'LOWW',
        iata: 'VIE',
        name: 'Vienna International Airport',
        country: 'AT',
        isoRegion: 'AT-3',
        lat: 48.110278,
        lon: 16.569722,
      })
      const airports = [...AIRPORTS, vienna]
      const inside = airportPageMetadata({ locale, airport: LTFM, airports })
      const outside = airportPageMetadata({ locale, airport: vienna, airports })
      expect(inside.title).toMatch(locale === 'tr' ? /canlı hava trafiği/ : /live air traffic/)
      expect(outside.title).toMatch(/^.+ \(VIE\/LOWW\): /)
      expect(outside.title).not.toMatch(/canlı|live/i)
      // og:title sayfa başlığının aynısıdır.
      expect(outside.openGraph?.title).toBe(outside.title)
      expect(outside.description).toMatch(
        locale === 'tr' ? /Canlı veri çekim alanının dışında/ : /Outside the live data fetch area/,
      )
    },
  )
})
