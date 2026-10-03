import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { localTime } from '../weather/time'
import {
  AIRPORT_TIME_ZONES,
  airportRing,
  airportTimeZone,
  COUNTRY_TIME_ZONES,
  ENABLED_AIRPORT_RING,
  isForeignCandidate,
  isSupportedTimeZone,
  REGION_TIME_ZONES,
} from './index'

/**
 * 1. ve 2. halkanın 164 havalimanı (OurAirports 2026-10-01 indirmesi; 2. halka henüz listede ve
 * fixture'da değil): "ICAO bölge dilim". Beklenen dilimler M6f araştırmasının karşılaştırmasıdır
 * (tzdb `zone.tab` açıklamaları ve bölge kuralları); Sohum kullanıcı kararıyla Moskova saatidir,
 * Volgograd kendi dilimidir (Moskova kuralları). Ülke, bölge kodunun önekidir.
 */
const RING_AIRPORTS: readonly string[] = [
  // 1. halka
  'BKPR XK-01 Europe/Belgrade',
  'LBBG BG-02 Europe/Sofia',
  'LBPD BG-16 Europe/Sofia',
  'LBSF BG-22 Europe/Sofia',
  'LBWN BG-03 Europe/Sofia',
  'LCEN CY-02 Asia/Famagusta',
  'LCLK CY-04 Asia/Nicosia',
  'LCPH CY-06 Asia/Nicosia',
  'LGAL GR-A Europe/Athens',
  'LGAV GR-I Europe/Athens',
  'LGBL GR-E Europe/Athens',
  'LGHI GR-K Europe/Athens',
  'LGIO GR-D Europe/Athens',
  'LGIR GR-M Europe/Athens',
  'LGKL GR-J Europe/Athens',
  'LGKO GR-L Europe/Athens',
  'LGKP GR-L Europe/Athens',
  'LGKV GR-A Europe/Athens',
  'LGKZ GR-C Europe/Athens',
  'LGMK GR-L Europe/Athens',
  'LGMT GR-K Europe/Athens',
  'LGPZ GR-D Europe/Athens',
  'LGRP GR-L Europe/Athens',
  'LGRX GR-G Europe/Athens',
  'LGSA GR-M Europe/Athens',
  'LGSK GR-E Europe/Athens',
  'LGSM GR-K Europe/Athens',
  'LGSR GR-L Europe/Athens',
  'LGST GR-M Europe/Athens',
  'LGTS GR-B Europe/Athens',
  'LLHA IL-HA Asia/Jerusalem',
  'LRBS RO-B Europe/Bucharest',
  'LRCK RO-CT Europe/Bucharest',
  'LRCV RO-DJ Europe/Bucharest',
  'LROP RO-IF Europe/Bucharest',
  'LWOH MK-003 Europe/Skopje',
  'LWSK MK-008 Europe/Skopje',
  'LYNI RS-20 Europe/Belgrade',
  'OICC IR-05 Asia/Tehran',
  'OICS IR-12 Asia/Tehran',
  'OIGG IR-01 Asia/Tehran',
  'OIHH IR-13 Asia/Tehran',
  'OITL IR-24 Asia/Tehran',
  'OITR IR-04 Asia/Tehran',
  'OITT IR-03 Asia/Tehran',
  'OJAM JO-AM Asia/Amman',
  'OLBA LB-JL Asia/Beirut',
  'ORBI IQ-BG Asia/Baghdad',
  'ORER IQ-AR Asia/Baghdad',
  'ORKK IQ-TS Asia/Baghdad',
  'ORSJ IQ-SW Asia/Baghdad',
  'OSAP SY-HL Asia/Damascus',
  'OSDI SY-DI Asia/Damascus',
  'OSKL SY-HA Asia/Damascus',
  'OSLK SY-LA Asia/Damascus',
  'UBBG AZ-GA Asia/Baku',
  'UBBN AZ-NX Asia/Baku',
  'UBBQ AZ-QAB Asia/Baku',
  'UBLC AZ-LAC Asia/Baku',
  'UDSG AM-SH Asia/Yerevan',
  'UDYZ AM-ER Asia/Yerevan',
  'UGKO GE-IM Asia/Tbilisi',
  'UGSB GE-AJ Asia/Tbilisi',
  'UGSS GE-AB Europe/Moscow',
  'UGTB GE-TB Asia/Tbilisi',
  'URKG RU-KDA Europe/Moscow',
  'URKK RU-KDA Europe/Moscow',
  'URMG RU-CE Europe/Moscow',
  'URML RU-DA Europe/Moscow',
  'URMM RU-STA Europe/Moscow',
  'URMN RU-KB Europe/Moscow',
  'URMO RU-SE Europe/Moscow',
  'URMS RU-IN Europe/Moscow',
  'URMT RU-STA Europe/Moscow',
  'URSS RU-KDA Europe/Moscow',
  // 2. halka
  'HEAL EG-MT Africa/Cairo',
  'HEAR EG-SIN Africa/Cairo',
  'HEAX EG-ALX Africa/Cairo',
  'HECA EG-C Africa/Cairo',
  'HECP EG-C Africa/Cairo',
  'HEMM EG-MT Africa/Cairo',
  'HEPS EG-PTS Africa/Cairo',
  'HESH EG-JS Africa/Cairo',
  'HESX EG-GZ Africa/Cairo',
  'HETB EG-JS Africa/Cairo',
  'HLLB LY-BA Africa/Tripoli',
  'HLLQ LY-JA Africa/Tripoli',
  'LATI AL-02 Europe/Tirane',
  'LDDU HR-19 Europe/Zagreb',
  'LDOS HR-14 Europe/Zagreb',
  'LDSB HR-17 Europe/Zagreb',
  'LDSP HR-17 Europe/Zagreb',
  'LDZD HR-13 Europe/Zagreb',
  'LGKF GR-F Europe/Athens',
  'LGKR GR-F Europe/Athens',
  'LGZA GR-F Europe/Athens',
  'LHBP HU-BU Europe/Budapest',
  'LHDC HU-HB Europe/Budapest',
  'LHPP HU-BA Europe/Budapest',
  'LIBC IT-78 Europe/Rome',
  'LIBD IT-75 Europe/Rome',
  'LIBF IT-75 Europe/Rome',
  'LIBR IT-75 Europe/Rome',
  'LICA IT-78 Europe/Rome',
  'LICC IT-82 Europe/Rome',
  'LICR IT-78 Europe/Rome',
  'LIRI IT-72 Europe/Rome',
  'LIRN IT-72 Europe/Rome',
  'LLBG IL-M Asia/Jerusalem',
  'LLER IL-D Asia/Jerusalem',
  'LQBK BA-SRP Europe/Sarajevo',
  'LQMO BA-BIH Europe/Sarajevo',
  'LQSA BA-BIH Europe/Sarajevo',
  'LQTZ BA-BIH Europe/Sarajevo',
  'LRAR RO-AR Europe/Bucharest',
  'LRBC RO-BC Europe/Bucharest',
  'LRBM RO-MM Europe/Bucharest',
  'LRBV RO-BV Europe/Bucharest',
  'LRCL RO-CJ Europe/Bucharest',
  'LRIA RO-IS Europe/Bucharest',
  'LROD RO-BH Europe/Bucharest',
  'LRSB RO-SB Europe/Bucharest',
  'LRSM RO-SM Europe/Bucharest',
  'LRSV RO-SV Europe/Bucharest',
  'LRTM RO-MS Europe/Bucharest',
  'LRTR RO-TM Europe/Bucharest',
  'LUKK MD-CU Europe/Chisinau',
  'LYBE RS-00 Europe/Belgrade',
  'LYKV RS-18 Europe/Belgrade',
  'LYPG ME-16 Europe/Podgorica',
  'LYTV ME-19 Europe/Podgorica',
  'LZKZ SK-KI Europe/Bratislava',
  'OEGT SA-12 Asia/Riyadh',
  'OENN SA-07 Asia/Riyadh',
  'OERF SA-08 Asia/Riyadh',
  'OERR SA-08 Asia/Riyadh',
  'OESK SA-12 Asia/Riyadh',
  'OETB SA-07 Asia/Riyadh',
  'OETR SA-08 Asia/Riyadh',
  'OIAA IR-06 Asia/Tehran',
  'OIAD IR-06 Asia/Tehran',
  'OIAM IR-06 Asia/Tehran',
  'OIAW IR-06 Asia/Tehran',
  'OICK IR-15 Asia/Tehran',
  'OIFK IR-10 Asia/Tehran',
  'OIFM IR-10 Asia/Tehran',
  'OIIE IR-23 Asia/Tehran',
  'OIII IR-23 Asia/Tehran',
  'OIIP IR-30 Asia/Tehran',
  'OINN IR-02 Asia/Tehran',
  'OINR IR-02 Asia/Tehran',
  'OINZ IR-02 Asia/Tehran',
  'OJAI JO-AM Asia/Amman',
  'OJAQ JO-AQ Asia/Amman',
  'OKKK KW-FA Asia/Kuwait',
  'ORMM IQ-BA Asia/Baghdad',
  'ORNI IQ-NA Asia/Baghdad',
  'UATE KZ-MAN Asia/Aqtau',
  'UBBB AZ-BA Asia/Baku',
  'URWA RU-AST Europe/Astrakhan',
  'URWI RU-KL Europe/Moscow',
  'URWW RU-VGG Europe/Volgograd',
  'UTAK TM-B Asia/Ashgabat',
  'UTAN TM-B Asia/Ashgabat',
]

const expected = RING_AIRPORTS.map((line) => {
  const [icao = '', isoRegion = '', zone = ''] = line.split(' ')
  return { icao, isoRegion, country: isoRegion.split('-')[0] ?? '', zone }
})
const expectedByIcao = new Map(expected.map((a) => [a.icao, a]))

/** UTC farkı, dakika, verilen anda (`Intl`). */
const offset = (iso: string, zone: string) => localTime(iso, zone).utcOffsetMinutes

/** Çalışma zamanının ülke dilimleri (Node 24: `Intl.Locale#getTimeZones()`; Firefox'ta yok). */
function runtimeZones(country: string): string[] | undefined {
  const locale = new Intl.Locale(`und-${country}`) as Intl.Locale & {
    getTimeZones?: () => string[]
    timeZones?: string[]
  }
  return typeof locale.getTimeZones === 'function' ? locale.getTimeZones() : locale.timeZones
}
const hasRuntimeZones = runtimeZones('GR') !== undefined

describe('saat dilimi tabloları', () => {
  const allZones = [
    ...Object.values(COUNTRY_TIME_ZONES),
    ...Object.values(REGION_TIME_ZONES),
    ...Object.values(AIRPORT_TIME_ZONES),
  ]

  it('her dilim çalışma zamanının listesinde ve biçimlendirilebilir', () => {
    const supported = new Set(Intl.supportedValuesOf('timeZone'))
    for (const zone of new Set(allZones)) {
      expect(supported.has(zone), zone).toBe(true)
      expect(isSupportedTimeZone(zone), zone).toBe(true)
    }
  })

  it('216 tek dilimli ülke ve Kosova; Türkiye Europe/Istanbul', () => {
    expect(Object.keys(COUNTRY_TIME_ZONES)).toHaveLength(217)
    expect(COUNTRY_TIME_ZONES.TR).toBe('Europe/Istanbul')
    expect(COUNTRY_TIME_ZONES.XK).toBe('Europe/Belgrade')
    for (const code of Object.keys(COUNTRY_TIME_ZONES)) expect(code).toMatch(/^[A-Z]{2}$/)
    for (const code of Object.keys(REGION_TIME_ZONES)) expect(code).toMatch(/^[A-Z]{2}-[A-Z0-9]+$/)
    for (const code of Object.keys(AIRPORT_TIME_ZONES)) expect(code).toMatch(/^[A-Z0-9]{4}$/)
  })

  it.runIf(hasRuntimeZones)(
    'ülke tablosu çalışma zamanının ülke dilimleriyle aynı (tzdb zone.tab)',
    () => {
      for (const [country, zone] of Object.entries(COUNTRY_TIME_ZONES)) {
        // XK tzdb'de yoktur (Intl boş liste verir); Belgrad kuralı elle yazılmıştır.
        if (country === 'XK') {
          expect(runtimeZones(country)).toEqual([])
          continue
        }
        expect(runtimeZones(country), country).toEqual([zone])
      }
    },
  )

  it.runIf(hasRuntimeZones)(
    'bölge ve havalimanı kuralları yalnızca çok dilimli ülkelerde ve o ülkenin dilimleriyle',
    () => {
      for (const [region, zone] of Object.entries(REGION_TIME_ZONES)) {
        const country = region.split('-')[0] ?? ''
        expect(Object.hasOwn(COUNTRY_TIME_ZONES, country), region).toBe(false)
        expect(runtimeZones(country), region).toContain(zone)
      }
      // Kıbrıs'ın iki dilimi; Sohum bilinçli istisnadır (Gürcistan tek dilimli, kullanıcı kararı).
      expect(runtimeZones('CY')).toEqual(
        expect.arrayContaining([AIRPORT_TIME_ZONES.LCEN, AIRPORT_TIME_ZONES.LCLK]),
      )
    },
  )
})

describe('airportTimeZone', () => {
  it('1. ve 2. halkanın 164 havalimanı beklenen dilimde', () => {
    expect(expected).toHaveLength(164)
    expect(expectedByIcao.size).toBe(164)
    for (const airport of expected) {
      expect(airportTimeZone(airport), airport.icao).toBe(airport.zone)
    }
  })

  it('kural sırası: havalimanı, bölge, ülke; kodlar kırpılır ve büyük harfe çevrilir', () => {
    // Sohum: ülke Gürcistan (Asia/Tbilisi, UTC+4), havalimanı kuralı Moskova saati.
    expect(airportTimeZone({ icao: 'UGSS', country: 'GE', isoRegion: 'GE-AB' })).toBe(
      'Europe/Moscow',
    )
    expect(airportTimeZone({ icao: 'UGTB', country: 'GE', isoRegion: 'GE-TB' })).toBe(
      'Asia/Tbilisi',
    )
    expect(airportTimeZone({ icao: ' lcen ', country: 'cy', isoRegion: 'cy-02' })).toBe(
      'Asia/Famagusta',
    )
    expect(airportTimeZone({ icao: 'URWA', country: 'RU', isoRegion: 'RU-AST' })).toBe(
      'Europe/Astrakhan',
    )
    expect(airportTimeZone({ icao: 'LTFM', country: 'TR', isoRegion: 'TR-34' })).toBe(
      'Europe/Istanbul',
    )
    expect(airportTimeZone({ icao: 'LTFM', country: 'TR' })).toBe('Europe/Istanbul')
  })

  it('kuralı olmayan çok dilimli ülke, bilinmeyen ülke ve boş kod null', () => {
    // Rusya'nın kuralı yazılmamış bölgesi, ABD, Kıbrıs'ın havalimanı kuralı olmayan bir alanı,
    // Ukrayna (iki dilim), bilinmeyen kod.
    expect(airportTimeZone({ icao: 'UUEE', country: 'RU', isoRegion: 'RU-MOS' })).toBeNull()
    expect(airportTimeZone({ icao: 'KJFK', country: 'US', isoRegion: 'US-NY' })).toBeNull()
    expect(airportTimeZone({ icao: 'LCRA', country: 'CY', isoRegion: 'CY-06' })).toBeNull()
    expect(airportTimeZone({ icao: 'UKBB', country: 'UA', isoRegion: 'UA-32' })).toBeNull()
    expect(airportTimeZone({ icao: 'XXXX', country: 'ZZ', isoRegion: 'ZZ-1' })).toBeNull()
    expect(airportTimeZone({ icao: '', country: '', isoRegion: null })).toBeNull()
    // Nesne prototipinin anahtarları tablo kaydı sayılmaz.
    expect(airportTimeZone({ icao: 'constructor', country: 'toString' })).toBeNull()
  })

  it('çalışma zamanının tanımadığı dilim null (eski tarayıcı)', () => {
    expect(isSupportedTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isSupportedTimeZone('Europe/Athens')).toBe(true)
  })
})

describe('yerel saat ve UTC farkı (Intl, yaz saati dahil)', () => {
  it('Atina yazın UTC+3, 25 Ekim 2026 01:00 UTC’den sonra UTC+2', () => {
    expect(offset('2026-10-24T12:00:00Z', 'Europe/Athens')).toBe(180)
    expect(offset('2026-10-25T00:59:00Z', 'Europe/Athens')).toBe(180)
    expect(offset('2026-10-25T01:00:00Z', 'Europe/Athens')).toBe(120)
    expect(offset('2026-10-26T12:00:00Z', 'Europe/Athens')).toBe(120)
    expect(localTime('2026-10-26T21:05:00Z', 'Europe/Athens').hhmm).toBe('23:05')
  })

  it('Tahran UTC+3:30 (yaz saati yok), Astrahan UTC+4, Grozni ve Volgograd UTC+3, Aktav UTC+5', () => {
    for (const at of ['2026-01-15T12:00:00Z', '2026-07-15T12:00:00Z']) {
      expect(offset(at, 'Asia/Tehran')).toBe(210)
      expect(offset(at, 'Europe/Astrakhan')).toBe(240)
      expect(offset(at, 'Europe/Moscow')).toBe(180)
      expect(offset(at, 'Europe/Volgograd')).toBe(180)
      expect(offset(at, 'Asia/Aqtau')).toBe(300)
      expect(offset(at, 'Europe/Istanbul')).toBe(180)
    }
  })

  it('Ercan (Asia/Famagusta) Lefkoşa ile aynı; Kahire 29 Ekim 2026 gecesine kadar UTC+3', () => {
    for (const at of ['2026-01-15T12:00:00Z', '2026-07-15T12:00:00Z', '2026-10-26T12:00:00Z']) {
      expect(offset(at, 'Asia/Famagusta')).toBe(offset(at, 'Asia/Nicosia'))
    }
    expect(offset('2026-10-29T12:00:00Z', 'Africa/Cairo')).toBe(180)
    expect(offset('2026-10-30T12:00:00Z', 'Africa/Cairo')).toBe(120)
  })
})

// Commit'li OurAirports alt kümesi (tools/fixtures/README.md); foreign.test.ts ile aynı okuma.
const rows = (() => {
  const text = readFileSync(
    new URL('../../../../tools/fixtures/ourairports/airports.csv', import.meta.url),
    'utf8',
  )
  const [header = '', ...lines] = text.split(/\r?\n/)
  const columns = header.slice(1, -1).split('","')
  return lines.filter(Boolean).map((line) => {
    const values = line
      .slice(1, -1)
      .split('","')
      .map((v) => v.replaceAll('""', '"'))
    return new Map(columns.map((column, i) => [column, values[i] ?? '']))
  })
})()
const icaoOf = (r: Map<string, string>) =>
  (r.get('icao_code') || r.get('gps_code') || r.get('ident') || '').trim().toUpperCase()
const fixtureAirport = (r: Map<string, string>) => ({
  icao: icaoOf(r),
  country: r.get('iso_country') ?? '',
  isoRegion: r.get('iso_region') ?? '',
})

/** Büyük daire, km (foreign.test.ts ile aynı). */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)))
}
const position = (r: Map<string, string>) => ({
  lat: Number(r.get('latitude_deg')),
  lon: Number(r.get('longitude_deg')),
})

describe('fixture: listelenen her havalimanının dilimi var', () => {
  const turkish = rows.filter((r) => r.get('iso_country') === 'TR')
  const references = turkish
    .filter((r) =>
      ['large_airport', 'medium_airport', 'small_airport'].includes(r.get('type') ?? ''),
    )
    .filter((r) => /^[A-Z]{3}$/.test((r.get('iata_code') ?? '').trim().toUpperCase()))
    .map(position)

  it('Türkiye havalimanları Europe/Istanbul', () => {
    expect(turkish.length).toBeGreaterThan(60)
    for (const r of turkish) {
      expect(airportTimeZone(fixtureAirport(r)), icaoOf(r)).toBe('Europe/Istanbul')
    }
  })

  it('açık halkalardaki yabancı havalimanları beklenen dilimde (halka açılınca liste büyür)', () => {
    const listed = rows
      .filter((r) => r.get('iso_country') !== 'TR')
      .filter((r) =>
        isForeignCandidate(
          r.get('type') ?? '',
          r.get('scheduled_service') === 'yes',
          r.get('iata_code'),
        ),
      )
      .filter((r) => {
        const here = position(r)
        const distance = Math.min(...references.map((tr) => km(here, tr)))
        return airportRing(distance) <= ENABLED_AIRPORT_RING
      })
    expect(listed.length).toBeGreaterThanOrEqual(75)
    for (const r of listed) {
      const airport = fixtureAirport(r)
      const zone = airportTimeZone(airport)
      expect(zone, airport.icao).not.toBeNull()
      expect(zone, airport.icao).toBe(expectedByIcao.get(airport.icao)?.zone)
    }
  })
})
