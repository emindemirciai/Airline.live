import {
  AIRPORT_RINGS_KM,
  civilFlightClosure,
  ENABLED_AIRPORT_RING,
  foreignAirportCity,
  foreignAirportName,
  LOCALES,
} from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { airportFixture, runwayFixture } from '../../lib/test/airport-fixture'
import { fixtureListedAirports, fixtureTurkishAirports } from '../../lib/test/ourairports-fixture'
import {
  airportCountry,
  airportCountryFull,
  airportDescription,
  airportLocation,
  airportName,
  airportPlace,
  airportProvince,
  airportTitle,
  formatBearing,
  formatCoordinatesDecimal,
  formatCoordinatesDms,
  formatDataDate,
  formatLength,
  formatMeters,
  formatRadius,
  isTurkish,
  listedRadiusKm,
  longestRunway,
  runwayDesignator,
  sortByCountry,
  sortByProvince,
} from './airport-text'

const AIRPORTS = fixtureTurkishAirports()
const LISTED = fixtureListedAirports()
const FOREIGN = LISTED.filter((a) => !isTurkish(a))
const byIcao = (icao: string) => {
  const airport = LISTED.find((a) => a.icao === icao)
  if (!airport) throw new Error(`fixture has no ${icao}`)
  return airport
}

describe('fixture', () => {
  it('IATA kodlu 56 Türkiye havalimanı (askerî üsler yok, D-107), 51 tarifeli (M6b brief §g)', () => {
    expect(AIRPORTS).toHaveLength(56)
    expect(AIRPORTS.filter((a) => a.scheduled)).toHaveLength(51)
    expect(AIRPORTS.every((a) => a.runways.length > 0)).toBe(true)
  })

  it('1.–4. halka: Türkiye dışındaki 1.184 havalimanı 5.000 km içinde, tarifeli ya da kapanış tablosunda ve Türkçe adlı (D-080, D-088, D-090, D-102, D-110)', () => {
    const ring1 = FOREIGN.filter((a) => a.ring === 1)
    const ring2 = FOREIGN.filter((a) => a.ring === 2)
    const ring3 = FOREIGN.filter((a) => a.ring === 3)
    const ring4 = FOREIGN.filter((a) => a.ring === 4)
    expect(ring1).toHaveLength(77)
    expect(ring2).toHaveLength(104)
    expect(ring3).toHaveLength(283)
    expect(ring4).toHaveLength(720)
    expect(FOREIGN).toHaveLength(ring1.length + ring2.length + ring3.length + ring4.length)
    expect(FOREIGN).toHaveLength(1184)
    expect(LISTED).toHaveLength(AIRPORTS.length + FOREIGN.length)
    expect(LISTED).toHaveLength(1240)
    // Savaş nedeniyle kapalı 23 havalimanı OurAirports'ta tarifesizdir; kapanış tablosuyla listelenir.
    expect(FOREIGN.every((a) => a.scheduled || civilFlightClosure(a.icao) !== undefined)).toBe(true)
    expect(FOREIGN.filter((a) => !a.scheduled)).toHaveLength(23)
    expect(ring1.every((a) => (a.distanceToTrKm ?? Infinity) <= 500)).toBe(true)
    // Uzaklık tam km'ye yuvarlıdır, halka tam uzaklıktandır: Ben Gurion 500,44 km → 500, 2. halka.
    expect(ring2.every((a) => (a.distanceToTrKm ?? -1) >= 500)).toBe(true)
    expect(ring2.every((a) => (a.distanceToTrKm ?? Infinity) <= 1000)).toBe(true)
    expect(byIcao('LLBG')).toMatchObject({ ring: 2, distanceToTrKm: 500 })
    // 3. halka 1.000 km'nin dışındadır (en yakını Gachsaran, 1.006 km; yuvarlama sınırı vakası yok).
    expect(ring3.every((a) => (a.distanceToTrKm ?? -1) > 1000)).toBe(true)
    expect(ring3.every((a) => (a.distanceToTrKm ?? Infinity) <= 2000)).toBe(true)
    expect(byIcao('OIAH')).toMatchObject({ ring: 3, distanceToTrKm: 1006 })
    expect(byIcao('LOWW')).toMatchObject({ ring: 3, country: 'AT' })
    // 4. halka 2.000 km'nin dışındadır (en yakını Barselona, 2.003 km; en uzağı Ulan Batur, 4.981 km).
    expect(ring4.every((a) => (a.distanceToTrKm ?? -1) > 2000)).toBe(true)
    expect(ring4.every((a) => (a.distanceToTrKm ?? Infinity) <= 5000)).toBe(true)
    expect(byIcao('LEBL')).toMatchObject({ ring: 4, distanceToTrKm: 2003 })
    expect(byIcao('ZMCK')).toMatchObject({ ring: 4, distanceToTrKm: 4981 })
    // Fixture'ın uzak örneklerinden Frankfurt, Dubai ve Doha Hamad 3. halkada; Heathrow, Paris
    // Charles de Gaulle, Amsterdam ve Madrid 4. halkadadır ve listelenir. New York JFK 5. halkadadır.
    for (const icao of ['EDDF', 'OMDB', 'OTHH']) expect(byIcao(icao).ring).toBe(3)
    for (const icao of ['EGLL', 'LFPG', 'EHAM', 'LEMD']) expect(byIcao(icao).ring).toBe(4)
    // Kihihi (UG-0002, IATA KHX) dört karakterli ICAO taşımaz ve listelenmez (D-101).
    for (const icao of ['KJFK', 'UG-0002']) {
      expect(
        LISTED.some((a) => a.icao === icao),
        icao,
      ).toBe(false)
    }
    expect(LISTED.some((a) => a.iata === 'KHX')).toBe(false)
    expect(LISTED.every((a) => /^[A-Z0-9]{4}$/.test(a.icao))).toBe(true)
    expect(FOREIGN.filter((a) => foreignAirportName(a.icao) === undefined)).toEqual([])
    expect(FOREIGN.filter((a) => foreignAirportCity(a.icao) === undefined)).toEqual([])
    expect(AIRPORTS.every((a) => a.country === 'TR' && a.ring === 0)).toBe(true)
    for (const icao of ['LGAV', 'LGTS', 'LCEN', 'LCLK', 'UGTB', 'LBSF']) byIcao(icao)
    for (const icao of ['HECA', 'OIIE', 'LYBE', 'LHBP', 'OKKK', 'LZKZ']) byIcao(icao)
    // Yardımcı API'nin kaynak düzeltmelerini izler (D-088): İskenderiye HEBA (kaynakta HEAX), Taba
    // ve Cluj-Napoca'nın yinelenen boş pisti gizli, Bacău'nun adında çift boşluk yok.
    expect(byIcao('HEBA').iata).toBe('HBE')
    expect(LISTED.some((a) => a.icao === 'HEAX')).toBe(false)
    expect(byIcao('HETB').runways).toHaveLength(1)
    expect(byIcao('LRCL').runways).toHaveLength(1)
    expect(byIcao('LRBC').name).toBe('Bacău George Enescu International Airport')
    // D-090: Voronej ve Linz'in boş satırı gizli, Stuttgart'ın tek uçlu helikopter alanları pist
    // değildir; Fransız adlarındaki küçük harfli "airport" büyük harfle yazılır.
    expect(byIcao('UUOO').runways).toHaveLength(1)
    expect(byIcao('LOWL').runways).toHaveLength(2)
    expect(byIcao('EDDS').runways).toHaveLength(1)
    expect(byIcao('LFKB').name).toBe('Bastia-Poretta International Airport')
    expect(LISTED.filter((a) => /\bairport\b/.test(a.name)).map((a) => a.icao)).toEqual([])
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

describe('yer: il ya da ülke (D-080)', () => {
  it('Türkiye’de il; Türkiye dışında ülke adı, sayfanın dilinde', () => {
    expect(airportPlace(byIcao('LTFM'), 'tr')).toBe('İstanbul')
    expect(airportPlace(byIcao('LGAV'), 'tr')).toBe('Yunanistan')
    expect(airportPlace(byIcao('LGAV'), 'en')).toBe('Greece')
    expect(airportCountry(byIcao('UGTB'), 'tr')).toBe('Gürcistan')
    expect(airportCountry(byIcao('LBSF'), 'en')).toBe('Bulgaria')
    // 2. halkanın yeni ülkeleri (D-088): ad `Intl.DisplayNames`'ten, istisna gerekmez.
    expect(airportPlace(byIcao('HECA'), 'tr')).toBe('Mısır')
    expect(airportPlace(byIcao('HECA'), 'en')).toBe('Egypt')
    expect(airportCountry(byIcao('LIRN'), 'tr')).toBe('İtalya')
    expect(airportCountry(byIcao('OKKK'), 'tr')).toBe('Kuveyt')
    expect(airportCountry(byIcao('LZKZ'), 'en')).toBe('Slovakia')
    expect(airportCountry(byIcao('LQSA'), 'tr')).toBe('Bosna-Hersek')
  })

  it('Ercan (LCEN) KKTC’de gösterilir; diğerleri OurAirports’un ülkesini korur', () => {
    const ercan = byIcao('LCEN')
    expect(ercan.country).toBe('CY')
    expect(airportCountry(ercan, 'tr')).toBe('KKTC')
    expect(airportCountry(ercan, 'en')).toBe('TRNC')
    expect(airportCountryFull(ercan, 'tr')).toBe('Kuzey Kıbrıs Türk Cumhuriyeti (KKTC)')
    expect(airportCountryFull(ercan, 'en')).toBe('Turkish Republic of Northern Cyprus (TRNC)')
    expect(airportCountryFull(byIcao('LGAV'), 'tr')).toBe('Yunanistan')
    expect(airportCountry(byIcao('LCLK'), 'tr')).toBe('Kıbrıs')
    expect(airportCountry(byIcao('UGSS'), 'tr')).toBe('Gürcistan')
    const pristina = airportFixture({ icao: 'BKPR', country: 'XK', isoRegion: 'XK-01', ring: 1 })
    expect(airportCountry(pristina, 'tr')).toBe('Kosova')
    expect(airportCountry(pristina, 'en')).toBe('Kosovo')
  })

  it('yer satırı: Türkiye’de "il, Türkiye"; Türkiye dışında sayfanın dilinde şehir ve ülke', () => {
    expect(airportLocation(byIcao('LTFM'), 'tr')).toBe('İstanbul, Türkiye')
    expect(airportLocation(byIcao('LTFM'), 'en')).toBe('Istanbul, Türkiye')
    // Küratörlü şehir adı (D-080). OurAirports yerleşimi ("Spata-Artemida", "Thessaloniki", "Kos
    // Island", Sitia için "Crete Island", Ercan için "Tymbou (Kirklar)", Senendec için boş) yazılmaz.
    expect(airportLocation(byIcao('LGAV'), 'tr')).toBe('Atina, Yunanistan')
    expect(airportLocation(byIcao('LGAV'), 'en')).toBe('Athens, Greece')
    expect(airportLocation(byIcao('LGTS'), 'tr')).toBe('Selanik, Yunanistan')
    expect(airportLocation(byIcao('LGKO'), 'tr')).toBe('İstanköy, Yunanistan')
    expect(airportLocation(byIcao('LGKO'), 'en')).toBe('Kos, Greece')
    expect(airportLocation(byIcao('LGST'), 'tr')).toBe('Sitia, Yunanistan')
    expect(airportLocation(byIcao('OSDI'), 'tr')).toBe('Şam, Suriye')
    expect(airportLocation(byIcao('UGTB'), 'en')).toBe('Tbilisi, Georgia')
    expect(airportLocation(byIcao('LCEN'), 'tr')).toBe('Lefkoşa, KKTC')
    expect(airportLocation(byIcao('OICS'), 'tr')).toBe('Senendec, İran')
    // 2. halka (D-088): OurAirports yerleşimi "Cairo", "Al Jiza", "Rinas" yerine küratörlü şehir.
    expect(airportLocation(byIcao('HECA'), 'tr')).toBe('Kahire, Mısır')
    expect(airportLocation(byIcao('HECA'), 'en')).toBe('Cairo, Egypt')
    expect(airportLocation(byIcao('LATI'), 'tr')).toBe('Tiran, Arnavutluk')
    for (const airport of FOREIGN) {
      const city = foreignAirportCity(airport.icao)
      for (const locale of LOCALES) {
        const line = airportLocation(airport, locale)
        expect(line, airport.icao).not.toMatch(/Türkiye|\{|\(/)
        // Şehir adında "Island" yoktur; ülke adında olabilir (Faroe Islands, 4. halka).
        expect(city?.[locale], airport.icao).not.toMatch(/Island/)
        expect(line, airport.icao).toBe(`${city?.[locale]}, ${airportCountry(airport, locale)}`)
      }
    }
    // 4. halka (D-102): küratörlü şehir; ülke adının içinde "Islands" olabilir.
    expect(airportLocation(byIcao('EGLL'), 'tr')).toBe('Londra, Birleşik Krallık')
    expect(airportLocation(byIcao('EGLL'), 'en')).toBe('London, United Kingdom')
    expect(airportLocation(byIcao('EKVG'), 'en')).toBe('Vágar, Faroe Islands')
    // Tabloda olmayan yabancı havalimanı (sonraki halkalar): Türkçe sayfada yalnızca ülke, İngilizce
    // sayfada temiz OurAirports yerleşimi.
    const jfk = airportFixture({
      icao: 'KJFK',
      country: 'US',
      isoRegion: 'US-NY',
      municipality: 'New York',
      ring: 5,
    })
    expect(airportLocation(jfk, 'tr')).toBe('Amerika Birleşik Devletleri')
    expect(airportLocation(jfk, 'en')).toBe('New York, United States')
  })

  it('açık halkaların sınırı ortak yapılandırmadan gelir (4. halka 5.000 km, D-102)', () => {
    expect(listedRadiusKm()).toBe(AIRPORT_RINGS_KM[ENABLED_AIRPORT_RING - 1])
    expect(listedRadiusKm()).toBe(5000)
  })
})

describe('başlık ve açıklama: fixture’daki her havalimanı', () => {
  const FORBIDDEN = /rötar|gecikme|kalkış saati|METAR|meydan|delay|departure time/i

  it.each(LOCALES)(
    '%s: başlık kodları taşır, açıklama 70–170 karakter ve vaat içermez',
    (locale) => {
      for (const [airport, covered] of LISTED.flatMap((a) => [
        [a, true] as const,
        [a, false] as const,
      ])) {
        const title = airportTitle(airport, locale, covered)
        const description = airportDescription(airport, locale, covered)
        // Çekim alanının dışındaki havalimanının başlığı canlı trafik vaat etmez (D-106). "live"
        // sözcük olarak aranır: 4. halkanın Liverpool'u (EGGP) adında taşır (D-102).
        if (!covered) expect(title, airport.icao).not.toMatch(/canlı|\blive\b/i)
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
    // Yakın ülkelerde il yerine ülke.
    expect(airportDescription(byIcao('LGAV'), 'en', false)).toMatch(/, Greece: \d runways?, /)
    expect(airportDescription(byIcao('LGAV'), 'tr', false)).toMatch(/, Yunanistan: \d pist/)
    const noFacts = airportFixture({ icao: 'LTXX', runways: [], elevationFt: null })
    expect(airportDescription(noFacts, 'tr', true)).toBe(
      'LTXX Havalimanı, İstanbul. Çevredeki uçaklar canlı haritada görünür; tarife bilgisi içermez.',
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
    expect(airportTitle(byIcao('LTFM'), 'tr', true)).toBe(
      'İstanbul Havalimanı (IST/LTFM) canlı hava trafiği ve pistler',
    )
    expect(airportTitle(byIcao('LTFM'), 'en', true)).toBe(
      'Istanbul Airport (IST/LTFM) live air traffic and runways',
    )
  })

  it('savaş nedeniyle kapalı havalimanı (D-110): başlık canlı trafik vaat etmez, açıklamanın son cümlesi not', () => {
    // Kamışlı canlı veri çekim alanının içindedir; başlığı yine de canlı trafik vaat etmez.
    for (const covered of [true, false]) {
      expect(airportTitle(byIcao('UKBB'), 'tr', covered)).toBe(
        'Kiev Borispil Havalimanı (KBP/UKBB): pistler ve havalimanı bilgileri',
      )
      expect(
        airportTitle(byIcao('OSKL'), 'en', covered).endsWith(
          ' (KAC/OSKL): runways and airport information',
        ),
      ).toBe(true)
    }
    expect(airportTitle(byIcao('UKBB'), 'en', true)).toBe(
      'Boryspil International Airport (KBP/UKBB): runways and airport information',
    )
    expect(airportDescription(byIcao('UKBB'), 'tr', false)).toBe(
      'Kiev Borispil Havalimanı, Ukrayna: 2 pist, en uzunu 4.000 m; rakım 130 m. Savaş nedeniyle sivil uçuşlara kapalı (2022’den beri).',
    )
    expect(airportDescription(byIcao('UKBB'), 'en', true)).toBe(
      'Boryspil International Airport, Ukraine: 2 runways, longest 4,000 m; elevation 130 m. Closed to civil flights because of the war (since 2022).',
    )
    expect(
      airportDescription(byIcao('OSKL'), 'tr', true).endsWith(
        '. Savaş nedeniyle sivil uçuşlara kapalı olabilir (2024’ten beri).',
      ),
    ).toBe(true)
    expect(airportDescription(byIcao('OSKL'), 'tr', true)).not.toMatch(/Çevredeki uçaklar/)
    // Yeniden açılan Krasnodar olağan kalıpla.
    expect(airportTitle(byIcao('URKK'), 'tr', true)).toMatch(/canlı hava trafiği ve pistler$/)
  })

  it('çekim alanının dışındaki havalimanının başlığı canlı trafik vaat etmez (Viyana, Hakkari Yüksekova; D-106)', () => {
    expect(airportTitle(byIcao('LOWW'), 'tr', false)).toBe(
      'Viyana Havalimanı (VIE/LOWW): pistler ve havalimanı bilgileri',
    )
    expect(airportTitle(byIcao('LOWW'), 'en', false)).toBe(
      'Vienna International Airport (VIE/LOWW): runways and airport information',
    )
    for (const locale of LOCALES) {
      const title = airportTitle(byIcao('LTCW'), locale, false)
      expect(title, locale).toContain('(YKO/LTCW): ')
      expect(title, locale).not.toMatch(/canlı|live|hava durumu|weather/i)
    }
  })
})

describe('sortByProvince', () => {
  it('ile, sonra ada göre, sayfanın dilinin alfabesiyle', () => {
    const tr = sortByProvince(AIRPORTS, 'tr').map((a) => airportProvince(a, 'tr'))
    // Adana'nın listelenen havalimanı yok (İncirlik askerî üs, D-107; Şakirpaşa tarifesiz küçük alan).
    expect(tr[0]).toBe('Adıyaman')
    expect(tr).not.toContain('Adana')
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

describe('sortByCountry', () => {
  it('Türkiye dışındakiler ülkeye, sonra ada göre; Türkçe sayfada Türkçe sıralama', () => {
    const collator = new Intl.Collator('tr-TR')
    const rows = sortByCountry(FOREIGN, 'tr')
    const countries = rows.map((a) => airportCountry(a, 'tr'))
    expect(countries).toEqual(countries.toSorted((a, b) => collator.compare(a, b)))
    // 3. halkadan beri ilk ülke Afganistan'dır (D-090; 2. halkada Arnavutluk, 1. halkada Azerbaycan).
    expect(countries[0]).toBe('Afganistan')
    // Türk alfabesi: Irak I'dan, İran İ'den sonra gelir; Yunanistan en sondadır.
    expect(countries.indexOf('İran')).toBeGreaterThan(countries.lastIndexOf('Irak'))
    expect(countries.at(-1)).toBe('Yunanistan')
    const greece = rows.filter((a) => a.country === 'GR').map((a) => airportName(a, 'tr'))
    expect(greece).toEqual(greece.toSorted((a, b) => collator.compare(a, b)))
    const en = sortByCountry(FOREIGN, 'en').map((a) => airportCountry(a, 'en'))
    expect(en[0]).toBe('Afghanistan')
  })
})
