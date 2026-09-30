import { LOCALES } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { airportFixture, runwayFixture } from '../../lib/test/airport-fixture'
import { fixtureTurkishAirports } from '../../lib/test/ourairports-fixture'
import {
  airportDescription,
  airportName,
  airportProvince,
  airportTitle,
  formatBearing,
  formatCoordinatesDecimal,
  formatCoordinatesDms,
  formatDataDate,
  formatLength,
  formatMeters,
  formatRadius,
  longestRunway,
  runwayDesignator,
  sortByProvince,
} from './airport-text'

const AIRPORTS = fixtureTurkishAirports()
const byIcao = (icao: string) => {
  const airport = AIRPORTS.find((a) => a.icao === icao)
  if (!airport) throw new Error(`fixture has no ${icao}`)
  return airport
}

describe('fixture', () => {
  it('IATA kodlu 61 Türkiye havalimanı, 51 tarifeli (M6b brief §g)', () => {
    expect(AIRPORTS).toHaveLength(61)
    expect(AIRPORTS.filter((a) => a.scheduled)).toHaveLength(51)
    expect(AIRPORTS.every((a) => a.runways.length > 0)).toBe(true)
  })
})

describe('biçimleyiciler (metrik önce, D-072)', () => {
  it('uzunluk m (ft), dile göre ayraç', () => {
    expect(formatLength(13451, 'tr')).toBe('4.100 m (13.451 ft)')
    expect(formatLength(13451, 'en')).toBe('4,100 m (13,451 ft)')
    expect(formatLength(null, 'tr')).toBe('—')
    expect(formatMeters(148, 'tr')).toBe('45 m')
  })

  it('yarıçap km (NM)', () => {
    expect(formatRadius(60, 'tr')).toBe('111 km (60 NM)')
    expect(formatRadius(60, 'en')).toBe('111 km (60 NM)')
  })

  it('gerçek yön tam derece; kuzey 360 yazılır', () => {
    expect(formatBearing(52.4)).toBe('52°')
    expect(formatBearing(179.2)).toBe('179°')
    expect(formatBearing(359.6)).toBe('360°')
    expect(formatBearing(0.2)).toBe('360°')
    expect(formatBearing(-10)).toBe('350°')
    expect(formatBearing(null)).toBe('—')
  })

  it('koordinatlar ondalık ve derece-dakika-saniye, yön harfleri dile göre', () => {
    expect(formatCoordinatesDecimal(41.262222, 28.727778, 'tr')).toBe('41,2622° K, 28,7278° D')
    expect(formatCoordinatesDecimal(41.262222, 28.727778, 'en')).toBe('41.2622° N, 28.7278° E')
    expect(formatCoordinatesDms(41.262222, 28.727778, 'tr')).toBe('41° 15′ 44″ K, 28° 43′ 40″ D')
    expect(formatCoordinatesDms(-33.9461, -151.1772, 'en')).toBe('33° 56′ 46″ S, 151° 10′ 38″ W')
    // Saniye 60'a yuvarlanırsa dakikaya aktarılır.
    expect(formatCoordinatesDms(40.99999, 29.5, 'en')).toBe('41° 00′ 00″ N, 29° 30′ 00″ E')
  })

  it('veri tarihi İstanbul saatine göre gün', () => {
    expect(formatDataDate('2026-09-29T22:30:00.000Z', 'tr')).toBe('30 Eylül 2026')
    expect(formatDataDate('2026-09-29T04:40:00.000Z', 'en')).toBe('29 September 2026')
  })

  it('pist adı iki ucun adıdır', () => {
    expect(runwayDesignator(runwayFixture())).toBe('05/23')
    const unnamed = runwayFixture()
    unnamed.ends[0].ident = ''
    unnamed.ends[1].ident = ' '
    expect(runwayDesignator(unnamed)).toBe('—')
  })

  it('en uzun pist: uzunluğu bilinenler arasından, eşitlikte ilki', () => {
    const airport = airportFixture({
      icao: 'LTXX',
      runways: [
        runwayFixture({ id: 1, lengthFt: 9250 }),
        runwayFixture({ id: 2, lengthFt: null }),
        runwayFixture({ id: 3, lengthFt: 13451 }),
        runwayFixture({ id: 4, lengthFt: 13451 }),
      ],
    })
    expect(longestRunway(airport)?.id).toBe(3)
    expect(longestRunway({ ...airport, runways: [] })).toBeNull()
    expect(longestRunway({ ...airport, runways: [runwayFixture({ lengthFt: null })] })).toBeNull()
    expect(longestRunway(byIcao('LTFM'))?.ends.map((e) => e.ident)).toEqual(['17L', '35R'])
  })
})

describe('ad ve il', () => {
  it('resmî Türkçe ad ve İngilizce karşılığı; il bölge kodundan', () => {
    const ltfm = byIcao('LTFM')
    expect(airportName(ltfm, 'tr')).toBe('İstanbul Havalimanı')
    expect(airportName(ltfm, 'en')).toBe('Istanbul Airport')
    expect(airportProvince(ltfm, 'tr')).toBe('İstanbul')
    expect(airportProvince(ltfm, 'en')).toBe('Istanbul')
    // Çukurova (TR-33): ilçe Tarsus, il Mersin.
    expect(airportProvince(byIcao('LTDB'), 'tr')).toBe('Mersin')
  })

  it('bölge kodu tanınmazsa yerleşim, o da yoksa ülke', () => {
    const unknown = airportFixture({ icao: 'LTXX', isoRegion: 'XX-1', municipality: 'Somewhere' })
    expect(airportProvince(unknown, 'tr')).toBe('Somewhere')
    expect(airportProvince({ ...unknown, municipality: null }, 'en')).toBe('Türkiye')
  })
})

describe('başlık ve açıklama: fixture’daki her havalimanı', () => {
  const FORBIDDEN = /rötar|gecikme|kalkış saati|METAR|meydan|delay|departure time/i

  it.each(LOCALES)(
    '%s: başlık kodları taşır, açıklama 70–170 karakter ve vaat içermez',
    (locale) => {
      for (const [airport, covered] of AIRPORTS.flatMap((a) => [
        [a, true] as const,
        [a, false] as const,
      ])) {
        const title = airportTitle(airport, locale)
        const description = airportDescription(airport, locale, covered)
        expect(title, airport.icao).toContain(`(${airport.iata}/${airport.icao})`)
        expect(title.startsWith(airportName(airport, locale)), airport.icao).toBe(true)
        expect(description.length, `${airport.icao}: ${description}`).toBeGreaterThanOrEqual(70)
        expect(description.length, `${airport.icao}: ${description}`).toBeLessThanOrEqual(170)
        expect(title, airport.icao).not.toMatch(FORBIDDEN)
        expect(description, airport.icao).not.toMatch(FORBIDDEN)
        expect(description, airport.icao).not.toContain('{')
      }
    },
  )

  it('açıklama veriden kurulur: pist sayısı, en uzun pist, rakım', () => {
    expect(airportDescription(byIcao('LTFM'), 'tr', true)).toBe(
      'İstanbul Havalimanı, İstanbul: 6 pist, en uzunu 4.100 m; rakım 99 m. Çevredeki uçaklar canlı haritada görünür; tarife bilgisi içermez.',
    )
    expect(airportDescription(byIcao('LTDA'), 'en', true)).toMatch(
      /^Hatay Airport, Hatay: one runway, 2,082 m; elevation 82 m\. /,
    )
    const noFacts = airportFixture({ icao: 'LTXX', runways: [], elevationFt: null })
    expect(airportDescription(noFacts, 'tr', true)).toBe(
      'LTXX Airport, İstanbul. Çevredeki uçaklar canlı haritada görünür; tarife bilgisi içermez.',
    )
  })

  it('çekim alanının dışındaki havalimanı çevredeki uçakları vaat etmez', () => {
    const ltcw = byIcao('LTCW')
    for (const locale of LOCALES) {
      const description = airportDescription(ltcw, locale, false)
      expect(description, locale).not.toMatch(/Çevredeki uçaklar|nearby aircraft/)
    }
    expect(airportDescription(ltcw, 'tr', false)).toMatch(
      /\. Canlı veri çekim alanının dışında; tarife bilgisi içermez\.$/,
    )
    expect(airportDescription(ltcw, 'en', false)).toMatch(
      /\. Outside the live data fetch area; no schedule data\.$/,
    )
  })

  it('başlık', () => {
    expect(airportTitle(byIcao('LTFM'), 'tr')).toBe(
      'İstanbul Havalimanı (IST/LTFM) canlı hava trafiği ve pistler',
    )
    expect(airportTitle(byIcao('LTFM'), 'en')).toBe(
      'Istanbul Airport (IST/LTFM) live air traffic and runways',
    )
  })
})

describe('sortByProvince', () => {
  it('ile, sonra ada göre, sayfanın dilinin alfabesiyle', () => {
    const tr = sortByProvince(AIRPORTS, 'tr').map((a) => airportProvince(a, 'tr'))
    expect(tr[0]).toBe('Adana')
    // Türk alfabesi: Çanakkale C'den sonra, İ I'dan sonra gelir.
    expect(tr.indexOf('Çanakkale')).toBeGreaterThan(tr.lastIndexOf('Bursa'))
    expect(tr.indexOf('Çanakkale')).toBeLessThan(tr.indexOf('Denizli'))
    expect(tr.indexOf('İstanbul')).toBeGreaterThan(tr.indexOf('Iğdır'))
    const istanbul = sortByProvince(AIRPORTS, 'tr')
      .filter((a) => a.isoRegion === 'TR-34')
      .map((a) => a.icao)
    // İstanbul Atatürk, İstanbul Havalimanı, İstanbul Sabiha Gökçen.
    expect(istanbul).toEqual(['LTBA', 'LTFM', 'LTFJ'])
  })
})
