import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AIRPORT_COUNTRY_OVERRIDES,
  AIRPORT_NAMES,
  AIRPORT_RING_CONFIG,
  AIRPORT_RING_COUNT,
  AIRPORT_RINGS_KM,
  airportCountryCode,
  airportCountryName,
  airportDisplayName,
  airportLocality,
  airportNameSource,
  airportRing,
  airportRingLimitKm,
  countryName,
  ENABLED_AIRPORT_RING,
  FOREIGN_AIRPORT_CITIES,
  FOREIGN_AIRPORT_NAMES,
  foreignAirportCity,
  foreignAirportName,
  isEnabledAirportRing,
  isForeignCandidate,
  REFERENCE_AIRFIELD_NAMES,
  referenceAirfieldName,
  translatedAirportName,
  TURKEY_COUNTRY,
} from './index'

// Commit'li OurAirports alt kümesi (tools/fixtures/README.md): Türkiye'nin bütün kayıtları, birkaç
// uzak havalimanı ve 1. halkanın havalimanları (D-080). Alanlar tırnaklı; `""` kaçışlı tırnaktır.
const csv = (path: string) => {
  const text = readFileSync(new URL(`../../../../tools/fixtures/${path}`, import.meta.url), 'utf8')
  const [header = '', ...lines] = text.split(/\r?\n/)
  const columns = header.slice(1, -1).split('","')
  return lines.filter(Boolean).map((line) => {
    const values = line
      .slice(1, -1)
      .split('","')
      .map((v) => v.replaceAll('""', '"'))
    return new Map(columns.map((column, i) => [column, values[i] ?? '']))
  })
}

const rows = csv('ourairports/airports.csv')
const icaoOf = (r: Map<string, string>) =>
  (r.get('icao_code') || r.get('gps_code') || r.get('ident') || '').trim().toUpperCase()
const IATA = /^[A-Z]{3}$/
const LISTABLE = ['large_airport', 'medium_airport', 'small_airport']

/** Büyük daire, km (@havayolu/geo `distanceKm` ile aynı yarıçap). */
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

/** Halka analizinin kuralı: Türkiye'deki IATA kodlu her havalimanı uzaklık referansıdır. */
const turkishRows = rows
  .filter((r) => r.get('iso_country') === 'TR')
  .filter((r) => LISTABLE.includes(r.get('type') ?? ''))
  .filter((r) => IATA.test((r.get('iata_code') ?? '').trim().toUpperCase()))
const turkish = turkishRows.map(position)
const candidates = rows
  .filter((r) => r.get('iso_country') !== 'TR')
  .filter((r) =>
    isForeignCandidate(
      r.get('type') ?? '',
      r.get('scheduled_service') === 'yes',
      r.get('iata_code'),
    ),
  )
  .map((r) => {
    const here = position(r)
    const distance = Math.min(...turkish.map((tr) => km(here, tr)))
    return { icao: icaoOf(r), name: r.get('name') ?? '', ring: airportRing(distance) }
  })
const ringOne = candidates.filter((c) => c.ring === 1)

describe('halkalar', () => {
  it('sınırlar, halka sayısı ve açık halka (M6d: 1. halka)', () => {
    expect(AIRPORT_RINGS_KM).toEqual([500, 1000, 2000, 5000])
    expect(AIRPORT_RING_COUNT).toBe(5)
    expect(ENABLED_AIRPORT_RING).toBe(1)
    expect(AIRPORT_RING_CONFIG).toEqual({ ringsKm: [500, 1000, 2000, 5000], enabledRing: 1 })
    expect(TURKEY_COUNTRY).toBe('TR')
  })

  it('airportRing: sınır dahil, sonsuz son halka, geçersiz uzaklık hata', () => {
    expect(airportRing(0)).toBe(1)
    expect(airportRing(500)).toBe(1)
    expect(airportRing(500.01)).toBe(2)
    expect(airportRing(1000)).toBe(2)
    expect(airportRing(1999.9)).toBe(3)
    expect(airportRing(5000)).toBe(4)
    expect(airportRing(5000.1)).toBe(5)
    expect(airportRing(20_000)).toBe(5)
    expect(airportRing(Number.POSITIVE_INFINITY)).toBe(5)
    expect(() => airportRing(-1)).toThrow(RangeError)
    expect(() => airportRing(Number.NaN)).toThrow(RangeError)
  })

  it('airportRingLimitKm ve isEnabledAirportRing', () => {
    expect(airportRingLimitKm(1)).toBe(500)
    expect(airportRingLimitKm(4)).toBe(5000)
    expect(airportRingLimitKm(5)).toBeNull()
    expect(airportRingLimitKm(0)).toBeNull()
    expect(airportRingLimitKm(1.5)).toBeNull()
    expect(isEnabledAirportRing(0)).toBe(true)
    expect(isEnabledAirportRing(1)).toBe(true)
    expect(isEnabledAirportRing(2)).toBe(false)
    expect(isEnabledAirportRing(-1)).toBe(false)
    expect(isEnabledAirportRing(0.5)).toBe(false)
  })

  it('isForeignCandidate: büyük ya da orta, tarifeli, üç harfli IATA', () => {
    expect(isForeignCandidate('large_airport', true, 'ATH')).toBe(true)
    expect(isForeignCandidate('medium_airport', true, ' jkh ')).toBe(true)
    expect(isForeignCandidate('small_airport', true, 'ABC')).toBe(false)
    expect(isForeignCandidate('heliport', true, 'ABC')).toBe(false)
    expect(isForeignCandidate('large_airport', false, 'ATH')).toBe(false)
    for (const iata of ['', 'AB', 'ABCD', 'A1B', null, undefined]) {
      expect(isForeignCandidate('large_airport', true, iata), String(iata)).toBe(false)
    }
  })

  it("fixture: halka analiziyle aynı kural 75 havalimanı verir (Türkiye'ye en yakın 48 km)", () => {
    expect(ringOne).toHaveLength(75)
    // Sekiz uzak fixture havalimanı (EGLL, KJFK …) 1. halkada değildir.
    expect(candidates.filter((c) => c.ring > 1).length).toBeGreaterThanOrEqual(8)
    expect(ringOne.map((c) => c.icao)).toEqual(
      expect.arrayContaining(['LGAV', 'LCEN', 'UGTB', 'BKPR', 'ORSJ', 'URSS']),
    )
  })
})

describe('FOREIGN_AIRPORT_NAMES', () => {
  it("fixture'daki 1. halkanın her havalimanı için tam bir kayıt vardır, fazlası yoktur", () => {
    expect(Object.keys(FOREIGN_AIRPORT_NAMES).sort()).toEqual(ringOne.map((c) => c.icao).sort())
    // Türkiye tablosuyla çakışma yok.
    for (const icao of Object.keys(FOREIGN_AIRPORT_NAMES)) {
      expect(Object.hasOwn(AIRPORT_NAMES, icao), icao).toBe(false)
    }
  })

  it('Türkçe ad "Havalimanı" ile biter ve niteleme taşımaz; adlar tekildir', () => {
    for (const [icao, name] of Object.entries(FOREIGN_AIRPORT_NAMES)) {
      expect(name.tr, icao).toMatch(/^\S.* Havalimanı$/)
      expect(name.tr, icao).toBe(name.tr.trim())
      expect(name.tr, icao).not.toMatch(/Airport|International|National|Uluslararası|Ulusal/)
      expect(name.en, icao).toMatch(/\bAirport\b/)
      expect(name.en, icao).not.toMatch(/Havalimanı/)
    }
    const tr = Object.values(FOREIGN_AIRPORT_NAMES).map((n) => n.tr)
    expect(new Set(tr).size).toBe(tr.length)
  })

  it('İngilizce ad OurAirports adıdır; yalnızca Bağdat kısaltılmıştır', () => {
    const differs = ringOne
      .filter((c) => FOREIGN_AIRPORT_NAMES[c.icao]?.en !== c.name)
      .map((c) => c.icao)
    expect(differs).toEqual(['ORBI'])
  })

  it('Türkçe yer adları (exonym) ve özel adlar', () => {
    const tr = (icao: string) => FOREIGN_AIRPORT_NAMES[icao]?.tr
    expect(tr('LGAV')).toBe('Atina Eleftherios Venizelos Havalimanı')
    expect(tr('LGTS')).toBe('Selanik Makedonya Havalimanı')
    expect(tr('LBSF')).toBe('Sofya Havalimanı')
    expect(tr('UGTB')).toBe('Tiflis Havalimanı')
    expect(tr('ORBI')).toBe('Bağdat Havalimanı')
    expect(tr('OSDI')).toBe('Şam Havalimanı')
    expect(tr('UDSG')).toBe('Gümrü Şirak Havalimanı')
    expect(tr('LGKO')).toBe('İstanköy Hipokrat Havalimanı')
    expect(tr('LCEN')).toBe('Ercan Havalimanı')
    expect(tr('ORSJ')).toBe('Süleymaniye Celal Talabani Havalimanı')
  })

  it('airportDisplayName yurt dışı tablosunu kullanır; bilinmeyen havalimanı kuralla çevrilir', () => {
    const lgav = { icao: 'lgav', name: 'Athens Eleftherios Venizelos International Airport' }
    expect(airportDisplayName(lgav, 'tr')).toBe('Atina Eleftherios Venizelos Havalimanı')
    expect(airportDisplayName(lgav, 'en')).toBe(
      'Athens Eleftherios Venizelos International Airport',
    )
    const ltfm = { icao: 'LTFM', name: 'Istanbul Airport' }
    expect(airportDisplayName(ltfm, 'tr')).toBe('İstanbul Havalimanı')
    const ommb = { icao: 'OMDB', name: 'Dubai International Airport' }
    expect(airportDisplayName(ommb, 'tr')).toBe('Dubai Uluslararası Havalimanı')
    expect(airportDisplayName(ommb, 'en')).toBe('Dubai International Airport')
    // Yurt dışı adı resmî Türkçe ad değildir: kaynak OurAirports kalır.
    expect(airportNameSource('LGAV')).toBe('ourairports')
    expect(foreignAirportName(' lgav ')?.en).toBe(lgav.name)
    expect(foreignAirportName('toString')).toBeUndefined()
    expect(foreignAirportName('__proto__')).toBeUndefined()
  })

  it('şehir tablosu ad tablosuyla aynı havalimanlarını kapsar; şehir adları niteleme taşımaz', () => {
    expect(Object.keys(FOREIGN_AIRPORT_CITIES).sort()).toEqual(
      Object.keys(FOREIGN_AIRPORT_NAMES).sort(),
    )
    for (const [icao, city] of Object.entries(FOREIGN_AIRPORT_CITIES)) {
      for (const value of [city.tr, city.en]) {
        expect(value, icao).toBe(value.trim())
        expect(value, icao).toMatch(/^\p{Lu}/u)
        expect(value, icao).not.toMatch(/Island|Airport|Havalimanı|\(|,/)
      }
      // Türkçe şehir adı Türkçe havalimanı adındaki yer adıdır; Ercan Lefkoşa'nın havalimanıdır.
      if (icao !== 'LCEN') expect(FOREIGN_AIRPORT_NAMES[icao]?.tr, icao).toContain(city.tr)
    }
  })

  it('airportLocality: Türkiye’de ilçe; yakın ülkede küratörlü şehir; tabloda yoksa TR’de null', () => {
    const at = (icao: string, municipality: string | null, country = 'GR', isoRegion = 'GR-B') => ({
      icao,
      country,
      isoRegion,
      municipality,
    })
    // OurAirports yerleşimi İngilizce ya da şehir değildir: "Thessaloniki", "Kos Island", "Crete Island".
    expect(airportLocality(at('LGTS', 'Thessaloniki'), 'tr')).toBe('Selanik')
    expect(airportLocality(at('LGTS', 'Thessaloniki'), 'en')).toBe('Thessaloniki')
    expect(airportLocality(at('LGKO', 'Kos Island'), 'tr')).toBe('İstanköy')
    expect(airportLocality(at('LGKO', 'Kos Island'), 'en')).toBe('Kos')
    expect(airportLocality(at('LGST', 'Crete Island'), 'tr')).toBe('Sitia')
    expect(airportLocality(at('LGAV', 'Spata-Artemida'), 'tr')).toBe('Atina')
    expect(airportLocality(at('LCEN', 'Tymbou (Kirklar)', 'CY', 'CY-02'), 'tr')).toBe('Lefkoşa')
    expect(foreignAirportCity(' lgav ')?.en).toBe('Athens')
    expect(foreignAirportCity('toString')).toBeUndefined()
    // Tabloda olmayan yabancı havalimanı: İngilizce sayfada temiz OurAirports yerleşimi.
    const egll = at('EGLL', 'London', 'GB', 'GB-ENG')
    expect(airportLocality(egll, 'tr')).toBeNull()
    expect(airportLocality(egll, 'en')).toBe('London')
    expect(airportLocality({ ...egll, municipality: 'London (Hounslow)' }, 'en')).toBeNull()
    // Türkiye: temiz ve ilden farklı OurAirports yerleşimi, iki dilde aynı.
    const ltbj = at('LTBJ', 'Gaziemir', 'TR', 'TR-35')
    expect(airportLocality(ltbj, 'tr')).toBe('Gaziemir')
    expect(airportLocality(ltbj, 'en')).toBe('Gaziemir')
    expect(airportLocality({ ...ltbj, municipality: 'Izmir' }, 'tr')).toBeNull()
  })

  it('translatedAirportName: yalnızca tam sözcük "Airport" çevrilir', () => {
    expect(translatedAirportName(' Frankfurt am Main Airport ', 'tr')).toBe(
      'Frankfurt am Main Havalimanı',
    )
    expect(translatedAirportName('Hamad International Airport', 'tr')).toBe(
      'Hamad Uluslararası Havalimanı',
    )
    expect(
      translatedAirportName('Baghdad International Airport / New Al Muthana Air Base', 'tr'),
    ).toBe('Baghdad Uluslararası Havalimanı / New Al Muthana Air Base')
    expect(translatedAirportName('Airportville Airfield', 'tr')).toBe('Airportville Airfield')
    expect(translatedAirportName('Hamad International Airport', 'en')).toBe(
      'Hamad International Airport',
    )
  })
})

describe('REFERENCE_AIRFIELD_NAMES', () => {
  it("fixture'daki listelenmeyen her Türkiye uzaklık referansının Türkçe ve İngilizce adı vardır", () => {
    const unlisted = turkishRows
      .map(icaoOf)
      .filter((icao) => !Object.hasOwn(AIRPORT_NAMES, icao))
      .sort()
    expect(unlisted).toEqual(['LTAF', 'LTBD', 'LTBV', 'LTFB', 'LTFK'])
    expect(Object.keys(REFERENCE_AIRFIELD_NAMES).sort()).toEqual(unlisted)
    for (const [icao, name] of Object.entries(REFERENCE_AIRFIELD_NAMES)) {
      expect(name.tr, icao).toMatch(/^\S.* Havalimanı$/)
      expect(name.en, icao).toMatch(/^\S.* Airport$/)
      expect(name.en.replace(/ Airport$/, ''), icao).toBe(name.tr.replace(/ Havalimanı$/, ''))
    }
  })

  it('airportDisplayName uzaklık referansını Türkçe yazımıyla verir (OurAirports "Bodrum-Imsık")', () => {
    const ltbv = { icao: 'LTBV', name: 'Bodrum-Imsık Airport' }
    expect(airportDisplayName(ltbv, 'tr')).toBe('Bodrum-İmsık Havalimanı')
    expect(airportDisplayName(ltbv, 'en')).toBe('Bodrum-İmsık Airport')
    expect(airportDisplayName({ icao: 'LTFB', name: 'Selçuk Efes Airport' }, 'tr')).toBe(
      'Selçuk-Efes Havalimanı',
    )
    expect(airportDisplayName({ icao: 'ltfk', name: 'Gökçeada Airport' }, 'tr')).toBe(
      'Çanakkale Gökçeada Havalimanı',
    )
    expect(referenceAirfieldName('constructor')).toBeUndefined()
    // Sayfası yoktur; ad kaynağı resmî tablo değildir.
    expect(airportNameSource('LTBV')).toBe('ourairports')
  })
})

describe('ülke adları', () => {
  it('countryName: Intl ile iki dilde; kod kırpılır, biçimsiz kod olduğu gibi kalır', () => {
    expect(countryName('GR', 'tr')).toBe('Yunanistan')
    expect(countryName('GR', 'en')).toBe('Greece')
    expect(countryName(' ge ', 'tr')).toBe('Gürcistan')
    expect(countryName('CY', 'tr')).toBe('Kıbrıs')
    expect(countryName('TR', 'tr')).toBe('Türkiye')
    expect(countryName('XK', 'tr')).toBe('Kosova')
    expect(countryName('XK', 'en')).toBe('Kosovo')
    expect(countryName('', 'tr')).toBe('')
    expect(countryName('GRC', 'en')).toBe('GRC')
    expect(countryName('1A', 'en')).toBe('1A')
  })

  it("fixture'daki 1. halka ülkelerinin hepsi Intl'de adlandırılır", () => {
    const countries = new Set(
      rows
        .filter((r) => ringOne.some((c) => c.icao === icaoOf(r)))
        .map((r) => r.get('iso_country') ?? ''),
    )
    expect(countries.size).toBeGreaterThanOrEqual(15)
    for (const code of countries) {
      for (const locale of ['tr', 'en'] as const) {
        expect(countryName(code, locale), `${code} ${locale}`).not.toBe(code)
      }
    }
  })

  it('airportCountryName: Ercan (LCEN) KKTC; diğerleri OurAirports ülkesi', () => {
    const ercan = { icao: 'LCEN', country: 'CY' }
    expect(airportCountryName(ercan, 'tr')).toBe('KKTC')
    expect(airportCountryName(ercan, 'en')).toBe('TRNC')
    expect(airportCountryName(ercan, 'tr', 'long')).toBe('Kuzey Kıbrıs Türk Cumhuriyeti')
    expect(airportCountryName(ercan, 'en', 'long')).toBe('Turkish Republic of Northern Cyprus')
    expect(airportCountryName({ icao: ' lcen ', country: 'CY' }, 'tr')).toBe('KKTC')
    expect(airportCountryName({ icao: 'LCLK', country: 'CY' }, 'tr')).toBe('Kıbrıs')
    expect(airportCountryName({ icao: 'UGSS', country: 'GE' }, 'tr')).toBe('Gürcistan')
    expect(airportCountryName({ icao: 'BKPR', country: 'XK' }, 'en', 'long')).toBe('Kosovo')
    expect(airportCountryName({ icao: 'LGAV', country: 'GR' }, 'tr')).toBe('Yunanistan')
    expect(Object.keys(AIRPORT_COUNTRY_OVERRIDES)).toEqual(['LCEN'])
  })

  it('airportCountryCode: gösterilen ülkenin ISO kodu; KKTC için null', () => {
    expect(airportCountryCode({ icao: 'LCEN', country: 'CY' })).toBeNull()
    expect(airportCountryCode({ icao: 'LCLK', country: ' cy ' })).toBe('CY')
    expect(airportCountryCode({ icao: 'LTFM', country: 'TR' })).toBe('TR')
    expect(airportCountryCode({ icao: 'XXXX', country: '' })).toBeNull()
  })
})
