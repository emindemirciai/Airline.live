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
  COUNTRY_NAME_OVERRIDES,
  countryLabelText,
  countryName,
  ENABLED_AIRPORT_RING,
  FOREIGN_AIRPORT_CITIES,
  FOREIGN_AIRPORT_NAMES,
  foreignAirportCity,
  foreignAirportName,
  isEnabledAirportRing,
  isCanonicalIcao,
  isForeignCandidate,
  isMilitaryAirfield,
  isScheduledIataAirport,
  OURAIRPORTS_ICAO_CORRECTIONS,
  ourAirportsIcao,
  REFERENCE_AIRFIELD_NAMES,
  referenceAirfieldName,
  translatedAirportName,
  TURKEY_COUNTRY,
  UNLABELLED_COUNTRIES,
} from './index'
import { RING4_AIRPORT_CITIES, RING4_AIRPORT_NAMES } from './foreign-airport-names-r4'
import { COUNTRY_LABEL_PLACEMENTS } from '../map/country-label-placements'

// Commit'li OurAirports alt kümesi (tools/fixtures/README.md): Türkiye'nin bütün kayıtları, birkaç
// uzak havalimanı, 1.–5. halkanın havalimanları (D-080, D-088, D-090, D-101, D-109). Alanlar
// tırnaklı; `""` kaçışlı tırnaktır. Dosya test dosyası başına bir kez ayrıştırılır (D-109).
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
/** Listedeki kimlik: kanonik ICAO, kaynak düzeltmeleriyle (İskenderiye HEAX → HEBA, D-088). */
const icaoOf = (r: Map<string, string>) =>
  ourAirportsIcao({
    ident: r.get('ident') ?? '',
    icaoCode: r.get('icao_code'),
    gpsCode: r.get('gps_code'),
  })
/**
 * `@havayolu/db` `cleanAirportName` kuralı: art arda boşluk teke iner (Bacău, D-088), tek başına
 * duran küçük harfli "airport" "Airport" olur (dokuz Fransız havalimanı, D-090).
 */
const cleanName = (name: string) =>
  name
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bairport\b/g, 'Airport')
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

/**
 * Halka analizinin kuralı: Türkiye'deki IATA kodlu her havalimanı uzaklık referansıdır; askerî hava
 * üsleri hariç (D-107, `@havayolu/db` `turkishReferencePoints`): 56 listelenen ve 5 küçük alan.
 */
const turkishRows = rows
  .filter((r) => r.get('iso_country') === 'TR')
  .filter((r) => LISTABLE.includes(r.get('type') ?? ''))
  .filter((r) => IATA.test((r.get('iata_code') ?? '').trim().toUpperCase()))
  .filter((r) => !isMilitaryAirfield(icaoOf(r)))
const turkish = turkishRows.map(position)
/**
 * Halka analizinin adayları: D-080 kuralı, ICAO koşulu olmadan (`isScheduledIataAirport`; fixture
 * üreticisiyle aynı). `listable`: listeye giren aday, kanonik ICAO'su dört karakter
 * (`isForeignCandidate`, D-101).
 */
const candidates = rows
  .filter((r) => r.get('iso_country') !== 'TR')
  .filter((r) =>
    isScheduledIataAirport(
      r.get('type') ?? '',
      r.get('scheduled_service') === 'yes',
      r.get('iata_code'),
    ),
  )
  .map((r) => {
    const here = position(r)
    const distance = Math.min(...turkish.map((tr) => km(here, tr)))
    return {
      icao: icaoOf(r),
      name: cleanName(r.get('name') ?? ''),
      country: r.get('iso_country') ?? '',
      ...here,
      distance,
      ring: airportRing(distance),
      listable: isForeignCandidate(
        r.get('type') ?? '',
        r.get('scheduled_service') === 'yes',
        r.get('iata_code'),
        icaoOf(r),
      ),
    }
  })
const ringOne = candidates.filter((c) => c.ring === 1)
const ringTwo = candidates.filter((c) => c.ring === 2)
const ringThree = candidates.filter((c) => c.ring === 3)
const ringFour = candidates.filter((c) => c.ring === 4)
const ringFive = candidates.filter((c) => c.ring === 5)
/** Açık halkalardaki yabancı havalimanları (M6i.2'den beri 1.–4. halka, D-102). */
const listed = candidates.filter((c) => c.listable && c.ring <= ENABLED_AIRPORT_RING)
/**
 * Türkçe adında şehir geçmeyen havalimanları: Ercan (Lefkoşa), Malta (Valletta), Bahreyn (Manama);
 * 4. halkada ülke ya da özerk ada adını taşıyanlar (D-102): Guernsey (Saint Peter Port), Jersey
 * (Saint Helier), Man Adası (Douglas), Seyşeller (Victoria).
 */
const CITY_NOT_IN_NAME = ['EGJB', 'EGJJ', 'EGNS', 'FSIA', 'LCEN', 'LMML', 'OBBI']
/**
 * İngilizce adında "Airport" sözcüğü olmayan iki havalimanı (4. halka, D-102): OurAirports adı
 * olduğu gibi kalır.
 */
const EN_WITHOUT_AIRPORT = ['HKMS', 'VIBY']

describe('halkalar', () => {
  it('sınırlar, halka sayısı ve açık halka (M6i.2: 4. halka, D-102)', () => {
    expect(AIRPORT_RINGS_KM).toEqual([500, 1000, 2000, 5000])
    expect(AIRPORT_RING_COUNT).toBe(5)
    expect(ENABLED_AIRPORT_RING).toBe(4)
    expect(AIRPORT_RING_CONFIG).toEqual({ ringsKm: [500, 1000, 2000, 5000], enabledRing: 4 })
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
    expect(isEnabledAirportRing(2)).toBe(true)
    expect(isEnabledAirportRing(3)).toBe(true)
    expect(isEnabledAirportRing(4)).toBe(true)
    expect(isEnabledAirportRing(5)).toBe(false)
    expect(isEnabledAirportRing(-1)).toBe(false)
    expect(isEnabledAirportRing(0.5)).toBe(false)
  })

  it('isForeignCandidate: büyük ya da orta, tarifeli, üç harfli IATA, dört karakterli ICAO', () => {
    expect(isForeignCandidate('large_airport', true, 'ATH', 'LGAV')).toBe(true)
    expect(isForeignCandidate('medium_airport', true, ' jkh ', 'LGHI')).toBe(true)
    expect(isForeignCandidate('small_airport', true, 'ABC', 'LGXA')).toBe(false)
    expect(isForeignCandidate('heliport', true, 'ABC', 'LGXA')).toBe(false)
    expect(isForeignCandidate('large_airport', false, 'ATH', 'LGAV')).toBe(false)
    for (const iata of ['', 'AB', 'ABCD', 'A1B', null, undefined]) {
      expect(isForeignCandidate('large_airport', true, iata, 'LGAV'), String(iata)).toBe(false)
      expect(isScheduledIataAirport('large_airport', true, iata), String(iata)).toBe(false)
    }
    // ICAO ekseni (D-101): kanonik ICAO kırpılıp büyük harfe çevrilir; rakam olabilir (VA1G).
    for (const icao of ['EGLL', 'egll', ' EGLL ', 'VA1G', 'UZSS']) {
      expect(isForeignCandidate('medium_airport', true, 'LHR', icao), icao).toBe(true)
      expect(isCanonicalIcao(icao), icao).toBe(true)
    }
    for (const icao of ['UG-0002', 'KHX', 'EGLLX', 'EG L', 'EG-L', '', null, undefined]) {
      expect(isForeignCandidate('medium_airport', true, 'KHX', icao), String(icao)).toBe(false)
      expect(isCanonicalIcao(icao), String(icao)).toBe(false)
    }
    // ICAO koşulu olmayan D-080 kuralı aynı satırları seçer, ICAO'ya bakmaz.
    expect(isScheduledIataAirport('medium_airport', true, 'KHX')).toBe(true)
    expect(isScheduledIataAirport('small_airport', true, 'KHX')).toBe(false)
  })

  it("fixture: halka analiziyle aynı kural 75 havalimanı verir (Türkiye'ye en yakın 48 km)", () => {
    expect(ringOne).toHaveLength(75)
    // Sekiz uzak fixture havalimanından EDDF, OMDB ve OTHH 3. halkada (D-090), EGLL, LFPG, EHAM ve
    // LEMD 4. halkada (D-101), KJFK 5. halkadadır (D-109).
    const far = ['EDDF', 'OMDB', 'OTHH', 'EGLL', 'LFPG', 'EHAM', 'LEMD', 'KJFK']
    expect(far.map((icao) => candidates.find((c) => c.icao === icao)?.ring)).toEqual([
      3, 3, 3, 4, 4, 4, 4, 5,
    ])
    expect(
      ringFour
        .map((c) => c.icao)
        .filter((icao) => ['EGLL', 'LFPG', 'EHAM', 'LEMD'].includes(icao))
        .sort(),
    ).toEqual(['EGLL', 'EHAM', 'LEMD', 'LFPG'])
    expect(ringOne.map((c) => c.icao)).toEqual(
      expect.arrayContaining(['LGAV', 'LCEN', 'UGTB', 'BKPR', 'ORSJ', 'URSS']),
    )
  })

  it('fixture: 2. halka 89 havalimanı, 14 yeni ülke; en yakını Ben Gurion, en uzağı Kuveyt (D-088)', () => {
    expect(ringTwo).toHaveLength(89)
    const byDistance = ringTwo.toSorted((a, b) => a.distance - b.distance)
    // Ben Gurion 500,44 km: tam km'ye yuvarlanınca 500 olur ama halkası 2'dir.
    expect(byDistance[0]?.icao).toBe('LLBG')
    expect(byDistance[0]?.distance).toBeGreaterThan(500)
    expect(byDistance[0]?.distance).toBeLessThan(501)
    expect(byDistance.at(-1)?.icao).toBe('OKKK')
    expect(byDistance.at(-1)?.distance).toBeLessThanOrEqual(1000)
    const ringOneCountries = new Set(ringOne.map((c) => c.country))
    const newCountries = [...new Set(ringTwo.map((c) => c.country))]
      .filter((code) => !ringOneCountries.has(code))
      .sort()
    expect(newCountries).toEqual(
      ['AL', 'BA', 'EG', 'HR', 'HU', 'IT', 'KW', 'KZ', 'LY', 'MD', 'ME', 'SA', 'SK', 'TM'].sort(),
    )
    expect(ringTwo.map((c) => c.icao)).toEqual(
      expect.arrayContaining(['HECA', 'OIIE', 'LYBE', 'LHBP', 'LIRN', 'UBBB', 'HEBA']),
    )
    // Kaynaktaki yanlış kod listede görünmez (İskenderiye, D-088).
    expect(listed.map((c) => c.icao)).not.toContain('HEAX')
  })

  it('fixture: 3. halka 278 havalimanı, 27 yeni ülke; en yakını Gachsaran, en uzağı Växjö (D-090)', () => {
    expect(ringThree).toHaveLength(278)
    expect(ringOne.length + ringTwo.length + ringThree.length).toBe(442)
    // 1.–3. halkanın her adayı dört karakterli ICAO taşır ve listededir.
    expect([...ringOne, ...ringTwo, ...ringThree].every((c) => c.listable)).toBe(true)
    const byDistance = ringThree.toSorted((a, b) => a.distance - b.distance)
    // 1.000 km sınırında yuvarlama vakası yok: en yakını 1.006 km (Hakkari Yüksekova'ya).
    expect(byDistance[0]?.icao).toBe('OIAH')
    expect(byDistance[0]?.distance).toBeGreaterThan(1006)
    expect(byDistance[0]?.distance).toBeLessThan(1007)
    expect(byDistance.at(-1)?.icao).toBe('ESMX')
    expect(byDistance.at(-1)?.distance).toBeLessThanOrEqual(2000)
    const earlier = new Set([...ringOne, ...ringTwo].map((c) => c.country))
    const newCountries = [...new Set(ringThree.map((c) => c.country))]
      .filter((code) => !earlier.has(code))
      .sort()
    expect(newCountries).toEqual(
      [
        ...['AE', 'AF', 'AT', 'BE', 'BH', 'BY', 'CH', 'CZ', 'DE', 'DK', 'DZ', 'EE', 'ES', 'FR'],
        ...['LT', 'LU', 'LV', 'MT', 'NL', 'OM', 'PL', 'QA', 'SD', 'SE', 'SI', 'TN', 'UZ'],
      ].sort(),
    )
    // Fixture'ın uzak örneklerinden üçü 3. halkadadır; Özbekistan UZxx koduyla (OurAirports UTxx).
    expect(ringThree.map((c) => c.icao)).toEqual(
      expect.arrayContaining(['EDDF', 'OMDB', 'OTHH', 'LOWW', 'UUEE', 'OERK', 'LIRF', 'UZSS']),
    )
    expect(ringThree.map((c) => c.icao)).not.toContain('UTSS')
    // Barselona (2.002,6 km) 4. halkadadır.
    expect(ringThree.map((c) => c.icao)).not.toContain('LEBL')
    expect(ringFour.map((c) => c.icao)).toContain('LEBL')
  })

  it('fixture: 4. halka 720 aday, 719 listelenir (UG-0002 dört karakterli ICAO kuralıyla dışarıda); halka açık (D-101, D-102)', () => {
    expect(ringFour).toHaveLength(720)
    expect(ringFour.filter((c) => c.listable)).toHaveLength(719)
    // Kihihi Savannah pisti (IATA KHX): icao_code ve gps_code yok, kanonik kimliği ident'tir.
    // 1.–4. halkada dört karakterli ICAO kuralına takılan tek aday odur (5. halkada WKK ve LSG).
    expect(candidates.filter((c) => c.ring <= 4 && !c.listable).map((c) => c.icao)).toEqual([
      'UG-0002',
    ])
    const khx = rows.find((r) => r.get('ident') === 'UG-0002')
    expect(khx?.get('iata_code')).toBe('KHX')
    expect([khx?.get('icao_code'), khx?.get('gps_code')]).toEqual(['', ''])
    const byDistance = ringFour.toSorted((a, b) => a.distance - b.distance)
    expect(byDistance[0]?.icao).toBe('LEBL')
    expect(byDistance[0]?.distance).toBeCloseTo(2002.6, 1)
    expect(byDistance.at(-1)?.icao).toBe('ZMCK')
    expect(byDistance.at(-1)?.distance).toBeCloseTo(4981.0, 1)
    const earlier = new Set([...ringOne, ...ringTwo, ...ringThree].map((c) => c.country))
    const newCountries = [...new Set(ringFour.filter((c) => c.listable).map((c) => c.country))]
      .filter((code) => !earlier.has(code))
      .sort()
    expect(newCountries).toEqual(
      [
        ...['AO', 'BD', 'BF', 'BI', 'BJ', 'BT', 'CD', 'CF', 'CG', 'CI', 'CM', 'CN', 'DJ', 'EH'],
        ...['ER', 'ET', 'FI', 'FO', 'GA', 'GB', 'GG', 'GH', 'GI', 'GL', 'GQ', 'IE', 'IM', 'IN'],
        ...['IS', 'JE', 'KE', 'KG', 'LK', 'MA', 'ML', 'MN', 'MR', 'MV', 'NE', 'NG', 'NO', 'NP'],
        ...['PK', 'PT', 'RW', 'SC', 'SO', 'SS', 'ST', 'TD', 'TG', 'TJ', 'TZ', 'UG', 'YE'],
      ].sort(),
    )
    // Uganda KHX'siz de dört havalimanıyla yeni ülkedir.
    expect(ringFour.filter((c) => c.listable && c.country === 'UG')).toHaveLength(4)
    // M6i.2'den beri liste 4. halkayı da taşır (D-102): 75 + 89 + 278 + 719 = 1.161 yurt dışı.
    expect(listed).toHaveLength(1161)
    expect(listed).toHaveLength(
      ringOne.length +
        ringTwo.length +
        ringThree.length +
        ringFour.filter((c) => c.listable).length,
    )
    expect(listed.map((c) => c.icao)).toEqual(
      expect.arrayContaining(['EGLL', 'LFPG', 'EHAM', 'LEMD', 'LEBL', 'VIDP', 'ZMCK']),
    )
    expect(listed.map((c) => c.icao)).not.toContain('UG-0002')
    expect(listed.map((c) => c.icao)).not.toContain('KJFK')
  })

  it("fixture: 5. halka 2.031 aday, 2.029'u dört karakterli ICAO'lu, 2.026'sı listelenebilir (askerî liste); halka kapalı (D-109)", () => {
    expect(ringFive).toHaveLength(2031)
    expect(ringFive.filter((c) => c.listable)).toHaveLength(2029)
    // Dört karakterli ICAO kuralına takılan iki aday (D-101'in öngördüğü): Aleknagik (5A8, WKK) ve
    // Leshan (CN-0249, LSG).
    expect(ringFive.filter((c) => !c.listable).map((c) => c.icao)).toEqual(['5A8', 'CN-0249'])
    // Askerî liste (D-109): adı yalnız askerî üç alan listelenmez.
    const military = ringFive.filter((c) => isMilitaryAirfield(c.icao)).map((c) => c.icao)
    expect(military.sort()).toEqual(['PKWA', 'PWAK', 'YBOK'])
    const ringFiveListed = ringFive.filter((c) => c.listable && !isMilitaryAirfield(c.icao))
    expect(ringFiveListed).toHaveLength(2026)
    // Ortak sivil-askerî iki havalimanı listelenir (D-103): Ascension (FHAW) ve MidAmerica (KBLV).
    expect(ringFiveListed.map((c) => c.icao)).toEqual(expect.arrayContaining(['FHAW', 'KBLV']))
    const byDistance = ringFive.toSorted((a, b) => a.distance - b.distance)
    // 5.000 km sınırında yuvarlama vakası yok: en yakını Xining 5.002,66 km.
    expect(byDistance[0]?.icao).toBe('ZLXN')
    expect(byDistance[0]?.distance).toBeCloseTo(5002.66, 1)
    expect(byDistance.at(-1)?.icao).toBe('NTAT')
    expect(byDistance.at(-1)?.distance).toBeCloseTo(17767.2, 0)
    const earlier = new Set(
      [...ringOne, ...ringTwo, ...ringThree, ...ringFour].map((c) => c.country),
    )
    const countries = new Set(ringFiveListed.map((c) => c.country))
    expect(countries.size).toBe(129)
    expect([...countries].filter((code) => !earlier.has(code))).toHaveLength(118)
    // Bütün halkalar açılınca: 1.161 + 2.026 = 3.187 yurt dışı havalimanı; uygulamada halka 4'tür.
    expect(listed.length + ringFiveListed.length).toBe(3187)
    expect(ENABLED_AIRPORT_RING).toBe(4)
    expect(listed.map((c) => c.icao)).not.toContain('KJFK')
    // Fixture'ın iki dışlama örneği aday değildir (D-109): Le Bourget tarifesiz, Thohoyandou küçük.
    for (const icao of ['LFPB', 'FATH']) {
      expect(
        rows.some((r) => icaoOf(r) === icao),
        icao,
      ).toBe(true)
      expect(
        candidates.map((c) => c.icao),
        icao,
      ).not.toContain(icao)
    }
  })
})

describe('FOREIGN_AIRPORT_NAMES', () => {
  it("fixture'daki açık halkaların (1.–4.) her havalimanı için tam bir kayıt vardır, fazlası yoktur", () => {
    expect(Object.keys(FOREIGN_AIRPORT_NAMES)).toHaveLength(1161)
    expect(Object.keys(FOREIGN_AIRPORT_NAMES).sort()).toEqual(listed.map((c) => c.icao).sort())
    // 4. halkanın ayrı tablosu (D-102): tam olarak 4. halkanın 719 listelenen havalimanı.
    expect(Object.keys(RING4_AIRPORT_NAMES).sort()).toEqual(
      ringFour
        .filter((c) => c.listable)
        .map((c) => c.icao)
        .sort(),
    )
    expect(Object.keys(RING4_AIRPORT_CITIES).sort()).toEqual(
      Object.keys(RING4_AIRPORT_NAMES).sort(),
    )
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
      // "Airport" sözcüğün parçası da olabilir: EuroAirport Basel-Mulhouse-Freiburg (D-090). İki
      // 4. halka adında hiç yoktur (Air Force Station, Lodge Airstrip; D-102).
      if (EN_WITHOUT_AIRPORT.includes(icao)) expect(name.en, icao).not.toMatch(/Airport/)
      else expect(name.en, icao).toMatch(/Airport/)
      expect(name.en, icao).not.toMatch(/Havalimanı|\bairport\b/)
    }
    // Adlar tekildir: Türkçe ve İngilizce, büyük-küçük harf ve aksan katlanınca da (1.161 ad).
    const fold = (text: string) =>
      text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en')
    for (const locale of ['tr', 'en'] as const) {
      const names = Object.values(FOREIGN_AIRPORT_NAMES).map((n) => n[locale])
      expect(new Set(names).size, locale).toBe(names.length)
      expect(new Set(names.map(fold)).size, locale).toBe(names.length)
    }
    expect(EN_WITHOUT_AIRPORT.map((icao) => FOREIGN_AIRPORT_NAMES[icao]?.en)).toEqual([
      'Mara Serena Lodge Airstrip',
      'Bareilly Air Force Station',
    ])
  })

  it('Türkçe adda İngilizce sözcük yok; City, Port ve Saint yalnız yer ya da kişi adının parçasıysa (D-102)', () => {
    const english = new Set(
      [
        ...['Air', 'Airport', 'Airstrip', 'Base', 'Bay', 'Cargo', 'Central', 'City', 'Civil'],
        ...['Domestic', 'East', 'Force', 'International', 'Island', 'Lake', 'Lodge', 'National'],
        ...['New', 'North', 'Old', 'Port', 'Regional', 'Saint', 'South', 'St.', 'State'],
        ...['Station', 'West'],
      ].map((word) => word.toLowerCase()),
    )
    const found = Object.entries(FOREIGN_AIRPORT_NAMES)
      .map(
        ([icao, name]) =>
          [
            icao,
            name.tr.split(/[\s-]+/).filter((word) => english.has(word.toLowerCase())),
          ] as const,
      )
      .filter(([, words]) => words.length > 0)
    // Port Said, Port Sudan, Port Harcourt, Port-Gentil ve Benin City şehrin; Saint-Exupéry
    // kişinin, Saint-Jacques ve St. Gallen yerin adıdır; City aynı şehrin havalimanlarını ayıran
    // tek addır (London City; Port Harcourt City, öbür havalimanı DNPO).
    expect(Object.fromEntries(found)).toEqual({
      DNBE: ['City'],
      DNPM: ['Port', 'City'],
      DNPO: ['Port'],
      EGLC: ['City'],
      FOOG: ['Port'],
      HEPS: ['Port'],
      HSPN: ['Port'],
      LFLL: ['Saint'],
      LFRN: ['Saint'],
      LSZR: ['St.'],
    })
  })

  it('İngilizce ad OurAirports adıdır; yalnızca belgeli sınıflarda kısaltılmıştır (D-080, D-088, D-090, D-102)', () => {
    // Karşılaştırma API'nin ad temizliğinden geçmiş adla: Bacău'nun kaynaktaki adında çift boşluk,
    // dokuz Fransız havalimanının adında küçük harfli "airport" var (D-088, D-090).
    const differs = listed
      .filter((c) => FOREIGN_AIRPORT_NAMES[c.icao]?.en !== c.name)
      .map((c) => c.icao)
      .sort()
    expect(differs).toEqual(
      [
        // 1.–3. halka: askerî üs eki (Bağdat, Podgorica, Cuxhaven) ve sondaki Arapça yazım (Guemar).
        ...['DAUO', 'ETMN', 'LYPG', 'ORBI'],
        // 4. halka (D-102): askerî üs ikinci adı (EKKA, VIAG, DNPM, ZURK), ikinci havalimanı adı
        // (OEGN), yerel ad yerine parantezdeki İngilizce ad (LPVZ), parantezli ya da virgüllü semt ve
        // ikinci ad (EBAW, DAOO, VOVI, VERW), kaynakta yinelenen cins sözcük (LEGR).
        ...['DAOO', 'DNPM', 'EBAW', 'EKKA', 'LEGR', 'LPVZ', 'OEGN', 'VERW', 'VIAG', 'VOVI', 'ZURK'],
      ].sort(),
    )
    // Kısaltılan ad, kaynağın sözcüklerinden oluşur (yeni sözcük eklenmez).
    const words = (text: string) => text.split(/[\s/,()–-]+/).filter(Boolean)
    for (const icao of differs) {
      const source = new Set(words(listed.find((c) => c.icao === icao)?.name ?? ''))
      for (const word of words(FOREIGN_AIRPORT_NAMES[icao]?.en ?? '')) {
        expect(source.has(word), `${icao} ${word}`).toBe(true)
      }
    }
    expect(FOREIGN_AIRPORT_NAMES.LPVZ?.en).toBe('Viseu Airport')
    expect(FOREIGN_AIRPORT_NAMES.LEGR?.en).toBe('F.G.L. Granada-Jaén Airport')
    expect(FOREIGN_AIRPORT_NAMES.VERW?.en).toBe('Rewa Airport')
    expect(FOREIGN_AIRPORT_NAMES.LYPG?.en).toBe('Podgorica Airport')
    expect(FOREIGN_AIRPORT_NAMES.ETMN?.en).toBe('Sea-Airport Cuxhaven/Nordholz')
    expect(FOREIGN_AIRPORT_NAMES.DAUO?.en).toBe('Guemar Airport')
    expect(FOREIGN_AIRPORT_NAMES.LRBC?.en).toBe('Bacău George Enescu International Airport')
    const raw = (icao: string) => rows.find((r) => icaoOf(r) === icao)?.get('name')
    expect(raw('LFKB')).toBe('Bastia-Poretta International airport')
    expect(FOREIGN_AIRPORT_NAMES.LFKB?.en).toBe('Bastia-Poretta International Airport')
    expect(raw('LFLW')).toBe('Aurillac airport')
    expect(FOREIGN_AIRPORT_NAMES.LFLW?.en).toBe('Aurillac Airport')
    // Bütün fixture'da (4. halkanın yedi Fransız havalimanı dahil, D-101; 5. halkada Puerto Suárez
    // SLPS, D-109) küçük harfli "airport".
    const lowercase = rows
      .filter((r) => /\bairport\b/.test(r.get('name') ?? ''))
      .map(icaoOf)
      .sort()
    expect(lowercase).toEqual([
      ...['LFBE', 'LFBZ', 'LFKB', 'LFKJ', 'LFLB', 'LFLC', 'LFLP', 'LFLW'],
      ...['LFMU', 'LFMV', 'LFOB', 'LFOK', 'LFRB', 'LFRG', 'LFRK', 'LFSL'],
      'SLPS',
    ])
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

  it('2. halka: Türkçe yer adları, kişi adları ve D-088 yazım kararları', () => {
    const tr = (icao: string) => FOREIGN_AIRPORT_NAMES[icao]?.tr
    expect(tr('HECA')).toBe('Kahire Havalimanı')
    expect(tr('HEBA')).toBe('İskenderiye Havalimanı')
    expect(tr('HESH')).toBe('Şarm el-Şeyh Havalimanı')
    expect(tr('LQSA')).toBe('Saraybosna Havalimanı')
    expect(tr('LHBP')).toBe('Budapeşte Liszt Ferenc Havalimanı')
    expect(tr('LYBE')).toBe('Belgrad Nikola Tesla Havalimanı')
    expect(tr('LIRN')).toBe('Napoli Havalimanı')
    expect(tr('OIIE')).toBe('Tahran İmam Humeyni Havalimanı')
    expect(tr('UBBB')).toBe('Bakü Haydar Aliyev Havalimanı')
    expect(tr('LATI')).toBe('Tiran Rahibe Teresa Havalimanı')
    expect(tr('OJAI')).toBe('Amman Kraliçe Alia Havalimanı')
    expect(tr('LIBC')).toBe('Crotone Pisagor Havalimanı')
    expect(tr('LRSV')).toBe('Suceava Büyük Stefan Havalimanı')
    expect(tr('OIFM')).toBe('İsfahan Şehit Beheşti Havalimanı')
    // Resmî adın ayırt edici özel adı korunur (siyasi ad dahil, D-080 kuralı).
    expect(tr('OIAW')).toBe('Ahvaz Kasım Süleymani Havalimanı')
    // Yalnız tarihte kalan biçimler kullanılmaz: Yaş, Temeşvar, Katanya değil.
    expect(tr('LRIA')).toBe('Iași Havalimanı')
    expect(tr('LRTR')).toBe('Timișoara Traian Vuia Havalimanı')
    expect(tr('LICC')).toBe('Catania Fontanarossa Havalimanı')
    expect(tr('OEGT')).toBe('Kurayyat Havalimanı')
    expect(tr('LDSP')).toBe('Split Aziz Hieronymus Havalimanı')
    // Adı şehir taşımayan havalimanında şehir önde.
    expect(tr('LRBM')).toBe('Baia Mare Maramureș Havalimanı')
    expect(tr('HLLQ')).toBe('Beyda El Abrak Havalimanı')
    expect(tr('OESK')).toBe('Sekaka El Cevf Havalimanı')
  })

  it('3. halka: Türkçe yer adları, kişi adları ve D-090 yazım kararları', () => {
    const tr = (icao: string) => FOREIGN_AIRPORT_NAMES[icao]?.tr
    expect(tr('LOWW')).toBe('Viyana Havalimanı')
    expect(tr('EDDM')).toBe('Münih Havalimanı')
    expect(tr('EDDK')).toBe('Köln/Bonn Havalimanı')
    expect(tr('LSZH')).toBe('Zürih Havalimanı')
    expect(tr('LSGG')).toBe('Cenevre Havalimanı')
    expect(tr('LKPR')).toBe('Prag Václav Havel Havalimanı')
    expect(tr('EPWA')).toBe('Varşova Chopin Havalimanı')
    expect(tr('LIRF')).toBe('Roma Fiumicino Leonardo da Vinci Havalimanı')
    expect(tr('LIMJ')).toBe('Cenova Kristof Kolomb Havalimanı')
    expect(tr('LFKJ')).toBe('Ajaccio Napolyon Bonapart Havalimanı')
    expect(tr('EPWR')).toBe('Wrocław Kopernik Havalimanı')
    expect(tr('UUEE')).toBe('Moskova Şeremetyevo Havalimanı')
    expect(tr('UUOO')).toBe('Voronej Havalimanı')
    expect(tr('UAOO')).toBe('Kızılorda Korkut Ata Havalimanı')
    expect(tr('OERK')).toBe('Riyad Kral Halid Havalimanı')
    expect(tr('OEJN')).toBe('Cidde Kral Abdulaziz Havalimanı')
    expect(tr('OMDB')).toBe('Dubai Havalimanı')
    expect(tr('OTHH')).toBe('Doha Hamad Havalimanı')
    expect(tr('OIKK')).toBe('Kirman Ayetullah Haşimi Rafsancani Havalimanı')
    expect(tr('DTMB')).toBe('Monastir Habib Burgiba Havalimanı')
    expect(tr('OAHR')).toBe('Herat Hace Abdullah Ensari Havalimanı')
    // Varsayılan yazımlar (orkestratör varsayılanı 2026-10-04; kullanıcı itiraz edebilir).
    expect(tr('DAAE')).toBe('Béjaïa Soummam-Abane Ramdane Havalimanı')
    expect(tr('EPKK')).toBe('Krakov Papa II. Jean Paul Havalimanı')
    expect(tr('HEMA')).toBe('Marsa Alam Havalimanı')
    expect(tr('UZSA')).toBe('Navoi Havalimanı')
    expect(tr('DTTZ')).toBe('Tozeur Nefta Havalimanı')
    expect(tr('LEMH')).toBe('Menorca Havalimanı')
    expect(tr('EPSC')).toBe('Szczecin-Goleniów Dayanışma Havalimanı')
    // Ülke adını taşıyan havalimanları ve şehir yerine bölge.
    expect(tr('OBBI')).toBe('Bahreyn Havalimanı')
    expect(tr('LMML')).toBe('Malta Havalimanı')
    expect(tr('OERS')).toBe('Kızıldeniz Havalimanı')
    expect(tr('LFSB')).toBe('Basel-Mulhouse-Freiburg Havalimanı')
    expect(FOREIGN_AIRPORT_NAMES.LFSB?.en).toBe('EuroAirport Basel–Mulhouse–Freiburg')
    // Tartışmalı ada OurAirports ülkesiyle (İran) ve kendi adıyla (D-080 karar 2).
    expect(tr('OIBA')).toBe('Ebu Musa Havalimanı')
  })

  it('4. halka: dondurulmuş yazım tablosundan exonym, kişi adı, unvan ve harf çevirisi (D-102)', () => {
    const tr = (icao: string) => FOREIGN_AIRPORT_NAMES[icao]?.tr
    const en = (icao: string) => FOREIGN_AIRPORT_NAMES[icao]?.en
    // Aynı şehrin havalimanları ayırt edici adla.
    expect(tr('EGLL')).toBe('Londra Heathrow Havalimanı')
    expect(en('EGLL')).toBe('London Heathrow Airport')
    expect(tr('EGLC')).toBe('Londra City Havalimanı')
    expect(tr('LFPG')).toBe('Paris Charles de Gaulle Havalimanı')
    expect(tr('LFPO')).toBe('Paris-Orly Havalimanı')
    expect(tr('LEMD')).toBe('Madrid-Barajas Adolfo Suárez Havalimanı')
    expect(tr('LEBL')).toBe('Barselona El Prat Josep Tarradellas Havalimanı')
    // Exonym, kişi adı ve unvan (dondurulmuş tablo).
    expect(tr('VIDP')).toBe('Yeni Delhi Indira Gandhi Havalimanı')
    expect(tr('OPLA')).toBe('Lahor Allame İkbal Havalimanı')
    expect(tr('ZMCK')).toBe('Ulan Batur Cengiz Han Havalimanı')
    expect(tr('GMMN')).toBe('Kazablanka V. Muhammed Havalimanı')
    expect(tr('DAAG')).toBe('Cezayir Houari Boumediene Havalimanı')
    // Kiril harf çevirisi ve Rusça bileşik adın tiresi.
    expect(tr('ULLI')).toBe('Sankt-Peterburg Pulkovo Havalimanı')
    expect(tr('UNNT')).toBe('Novosibirsk Tolmaçevo Havalimanı')
    // Ülke ya da özerk ada adını taşıyan havalimanında şehir adda geçmez.
    expect(foreignAirportCity('EGJJ')).toEqual({ tr: 'Saint Helier', en: 'Saint Helier' })
    expect(foreignAirportCity('FSIA')?.en).toBe('Victoria')
  })

  it('kaynak düzeltmesi: İskenderiye OurAirports HEAX → HEBA; yalnız yanlış değer durdukça', () => {
    expect(OURAIRPORTS_ICAO_CORRECTIONS).toEqual({ HEBA: { icaoCode: 'HEAX', icao: 'HEBA' } })
    const alexandria = rows.find((r) => r.get('ident') === 'HEBA')
    expect(alexandria?.get('icao_code')).toBe('HEAX')
    expect(alexandria?.get('gps_code')).toBe('HEAX')
    expect(alexandria && icaoOf(alexandria)).toBe('HEBA')
    expect(ourAirportsIcao({ ident: ' heba ', icaoCode: ' heax ', gpsCode: 'HEAX' })).toBe('HEBA')
    // OurAirports düzeltirse ya da başka bir koda geçerse tablo devre dışıdır.
    expect(ourAirportsIcao({ ident: 'HEBA', icaoCode: 'HEBA', gpsCode: 'HEAX' })).toBe('HEBA')
    expect(ourAirportsIcao({ ident: 'HEBA', icaoCode: 'HEZZ', gpsCode: null })).toBe('HEZZ')
    // Genel kural: icao_code, yoksa gps_code, o da yoksa ident.
    expect(ourAirportsIcao({ ident: 'ORSU', icaoCode: 'ORSJ', gpsCode: 'ORSU' })).toBe('ORSJ')
    expect(ourAirportsIcao({ ident: 'TM-0002', icaoCode: '', gpsCode: ' utan ' })).toBe('UTAN')
    expect(ourAirportsIcao({ ident: 'x1', icaoCode: null, gpsCode: undefined })).toBe('X1')
    expect(ourAirportsIcao({ ident: 'toString', icaoCode: null, gpsCode: null })).toBe('TOSTRING')
  })

  it('airportDisplayName yurt dışı tablosunu kullanır; bilinmeyen havalimanı kuralla çevrilir', () => {
    const lgav = { icao: 'lgav', name: 'Athens Eleftherios Venizelos International Airport' }
    expect(airportDisplayName(lgav, 'tr')).toBe('Atina Eleftherios Venizelos Havalimanı')
    expect(airportDisplayName(lgav, 'en')).toBe(
      'Athens Eleftherios Venizelos International Airport',
    )
    const ltfm = { icao: 'LTFM', name: 'Istanbul Airport' }
    expect(airportDisplayName(ltfm, 'tr')).toBe('İstanbul Havalimanı')
    // OMDB 3. halkada tabloya girdi (D-090); tabloda olmayan örnek JFK (5. halka).
    const omdb = { icao: 'OMDB', name: 'Dubai International Airport' }
    expect(airportDisplayName(omdb, 'tr')).toBe('Dubai Havalimanı')
    expect(airportDisplayName(omdb, 'en')).toBe('Dubai International Airport')
    const kjfk = { icao: 'KJFK', name: 'John F. Kennedy International Airport' }
    expect(airportDisplayName(kjfk, 'tr')).toBe('John F. Kennedy Uluslararası Havalimanı')
    expect(airportDisplayName(kjfk, 'en')).toBe('John F. Kennedy International Airport')
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
      // Türkçe şehir adı Türkçe havalimanı adındaki yer adıdır; Ercan Lefkoşa'nın, Bahreyn
      // Havalimanı Manama'nın, Malta Havalimanı Valletta'nın havalimanıdır (D-090).
      if (!CITY_NOT_IN_NAME.includes(icao)) {
        expect(FOREIGN_AIRPORT_NAMES[icao]?.tr, icao).toContain(city.tr)
      }
    }
    for (const icao of CITY_NOT_IN_NAME) {
      expect(FOREIGN_AIRPORT_NAMES[icao]?.tr, icao).not.toContain(FOREIGN_AIRPORT_CITIES[icao]?.tr)
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
    // 2. halka (D-088): yerleşim boş, yazım hatalı ya da köy adı.
    expect(airportLocality(at('OICK', null, 'IR', 'IR-20'), 'tr')).toBe('Hürremabad')
    expect(airportLocality(at('OICK', null, 'IR', 'IR-20'), 'en')).toBe('Khorramabad')
    expect(airportLocality(at('HLLQ', 'Al Albraq', 'LY', 'LY-JA'), 'en')).toBe('Bayda')
    expect(airportLocality(at('HESX', 'Al Jiza', 'EG', 'EG-GZ'), 'tr')).toBe('Gize')
    expect(airportLocality(at('LATI', 'Rinas', 'AL', 'AL-02'), 'en')).toBe('Tirana')
    // 3. halka (D-090): yanıltıcı yerleşim, bölge adı, ülke adını taşıyan havalimanı.
    const hahn = at('EDFH', 'Frankfurt am Main (Lautzenhausen)', 'DE', 'DE-RP')
    expect(airportLocality(hahn, 'tr')).toBe('Hahn')
    expect(airportLocality(at('OEGS', 'Qassim', 'SA', 'SA-05'), 'tr')).toBe('Bureyde')
    expect(airportLocality(at('OEGS', 'Qassim', 'SA', 'SA-05'), 'en')).toBe('Buraidah')
    expect(airportLocality(at('LFSB', 'Bâle / Mulhouse', 'FR', 'FR-GES'), 'en')).toBe('Mulhouse')
    expect(airportLocality(at('OBBI', 'Manama', 'BH', 'BH-13'), 'tr')).toBe('Manama')
    expect(airportLocality(at('LMML', 'Valletta', 'MT', 'MT-25'), 'tr')).toBe('Valletta')
    expect(airportLocality(at('OERS', 'Hanak', 'SA', 'SA-07'), 'tr')).toBe('Kızıldeniz')
    expect(airportLocality(at('OERS', 'Hanak', 'SA', 'SA-07'), 'en')).toBe('Red Sea')
    expect(airportLocality(at('LOWW', 'Vienna', 'AT', 'AT-3'), 'tr')).toBe('Viyana')
    expect(foreignAirportCity(' lgav ')?.en).toBe('Athens')
    expect(foreignAirportCity('toString')).toBeUndefined()
    // 4. halka (D-102): yerleşim semt ya da köy; ülke adını taşıyan ada havalimanı.
    const egll = at('EGLL', 'London', 'GB', 'GB-ENG')
    expect(airportLocality(egll, 'tr')).toBe('Londra')
    expect(airportLocality({ ...egll, municipality: 'London (Hounslow)' }, 'en')).toBe('London')
    expect(airportLocality(at('EGJB', 'Saint Peter Port', 'GG', 'GG-U-A'), 'tr')).toBe(
      'Saint Peter Port',
    )
    // Tabloda olmayan yabancı havalimanı (5. halka): İngilizce sayfada temiz OurAirports yerleşimi.
    const kjfk = at('KJFK', 'New York', 'US', 'US-NY')
    expect(airportLocality(kjfk, 'tr')).toBeNull()
    expect(airportLocality(kjfk, 'en')).toBe('New York')
    expect(airportLocality({ ...kjfk, municipality: 'New York (Queens)' }, 'en')).toBeNull()
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

  it('countryName: 2. halkanın yeni ülkeleri; İngilizcede "&" yerine "and" (D-088)', () => {
    expect(countryName('EG', 'tr')).toBe('Mısır')
    expect(countryName('IT', 'tr')).toBe('İtalya')
    expect(countryName('KW', 'tr')).toBe('Kuveyt')
    expect(countryName('ME', 'tr')).toBe('Karadağ')
    expect(countryName('BA', 'tr')).toBe('Bosna-Hersek')
    expect(countryName('BA', 'en')).toBe('Bosnia and Herzegovina')
    expect(countryName('TT', 'en')).toBe('Trinidad and Tobago')
    expect(countryName('SK', 'en')).toBe('Slovakia')
  })

  it('countryName: CLDR adı yerine elle tutulan adlar (D-100); havalimanı ülkesi de aynı adla', () => {
    expect(Object.keys(COUNTRY_NAME_OVERRIDES)).toEqual(['CD', 'CG', 'CI', 'MM', 'SJ'])
    expect(countryName('CD', 'tr')).toBe('Kongo Demokratik Cumhuriyeti')
    expect(countryName('CD', 'en')).toBe('Democratic Republic of the Congo')
    expect(countryName('CG', 'tr')).toBe('Kongo Cumhuriyeti')
    expect(countryName('CG', 'en')).toBe('Republic of the Congo')
    expect(countryName('CI', 'tr')).toBe('Fildişi Sahili')
    // İngilizcede CLDR'ın adı, tipografik kesme işaretiyle (U+2019).
    expect(countryName('CI', 'en')).toBe('Côte d’Ivoire')
    expect(countryName('MM', 'tr')).toBe('Myanmar')
    expect(countryName('MM', 'en')).toBe('Myanmar')
    expect(countryName('SJ', 'tr')).toBe('Svalbard')
    expect(countryName(' sj ', 'en')).toBe('Svalbard')
    // CLDR'ın kendi adları başkent ve ayraçla ayırır (kural bunun için var).
    const cldr = (code: string, locale: string) =>
      new Intl.DisplayNames(locale, { type: 'region' }).of(code)
    expect(cldr('CD', 'tr-TR')).toContain(' - ')
    expect(cldr('MM', 'en-GB')).toContain('(')
    expect(airportCountryName({ icao: 'FZAA', country: 'CD' }, 'tr')).toBe(
      'Kongo Demokratik Cumhuriyeti',
    )
    expect(airportCountryName({ icao: 'VYYY', country: 'MM' }, 'en', 'long')).toBe('Myanmar')
  })

  it('countryName: 3. halkanın yeni ülkeleri (D-090)', () => {
    expect(countryName('DE', 'tr')).toBe('Almanya')
    expect(countryName('AT', 'tr')).toBe('Avusturya')
    expect(countryName('CZ', 'tr')).toBe('Çekya')
    expect(countryName('CZ', 'en')).toBe('Czechia')
    expect(countryName('AE', 'tr')).toBe('Birleşik Arap Emirlikleri')
    expect(countryName('AE', 'en')).toBe('United Arab Emirates')
    expect(countryName('CH', 'tr')).toBe('İsviçre')
    expect(countryName('BY', 'en')).toBe('Belarus')
    expect(countryName('NL', 'tr')).toBe('Hollanda')
    expect(countryName('UZ', 'tr')).toBe('Özbekistan')
  })

  it('countryName: 4. halkanın ülkeleri (D-102); iki Kongo ve Fildişi Sahili D-100 tablosundan', () => {
    // 4. halka Kongo DC (14), Kongo (2) ve Fildişi Sahili (3) havalimanlarını açar; adları
    // `COUNTRY_NAME_OVERRIDES`'tan gelir (ayrı bir 4. halka tablosu yoktur).
    const ringFour = (country: string) =>
      listed.filter((c) => c.ring === 4 && c.country === country)
    expect(ringFour('CD')).toHaveLength(14)
    expect(ringFour('CG')).toHaveLength(2)
    expect(ringFour('CI')).toHaveLength(3)
    expect(countryName(' cg ', 'tr')).toBe('Kongo Cumhuriyeti')
    expect(countryLabelText('CD', 'tr')).toBe('KONGO DEMOKRATİK CUMHURİYETİ')
    for (const { icao, country } of [...ringFour('CD'), ...ringFour('CG'), ...ringFour('CI')]) {
      for (const locale of ['tr', 'en'] as const) {
        expect(airportCountryName({ icao, country }, locale), icao).toBe(
          COUNTRY_NAME_OVERRIDES[country]?.[locale],
        )
      }
    }
    // Öbür 4. halka ülkeleri CLDR adıyla.
    expect(countryName('BJ', 'tr')).toBe('Benin')
    expect(countryName('GB', 'tr')).toBe('Birleşik Krallık')
  })

  it("fixture'daki açık halkaların ülkelerinin hepsi Intl'de adlandırılır (4. halkayla 113)", () => {
    const countries = new Set(listed.map((c) => c.country))
    // 3. halkaya kadar 58, 4. halkanın 55 yeni ülkesiyle 113 (D-102).
    expect(countries.size).toBe(113)
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

describe('ülke adlarının kapsamı (D-095, D-100)', () => {
  /** Adı haritada yazılan ülkeler (üretilen tablo). */
  const labelled = new Set(Object.keys(COUNTRY_LABEL_PLACEMENTS.tr))
  /** Listelenen havalimanlarının ülkeleri: Türkiye ve açık halkalar. */
  const listedCountries = new Set([TURKEY_COUNTRY, ...listed.map((c) => c.country)])

  it('listelenen havalimanı olan her ülkenin adı tabloda; İsrail ve Filistin hariç', () => {
    // İsrail'in listelenen havalimanı vardır (Ben Gurion); adı yazılmaz.
    expect(listedCountries.has('IL')).toBe(true)
    for (const code of listedCountries) {
      expect(labelled.has(code), code).toBe(!UNLABELLED_COUNTRIES.includes(code))
    }
  })

  it('4. halka açık (D-102): listelenebilecek her havalimanının ülkesi de tabloda; tablo 4. halkanın pinleriyle yeniden üretildi', () => {
    // Açık halkaların adayları; fixture'daki 5. halka satırları (D-109) halka açılınca (M6j.3) sayılır.
    const open = candidates.filter((c) => c.listable && c.ring <= ENABLED_AIRPORT_RING)
    const countries = new Set(open.map((c) => c.country))
    expect(listed.filter((c) => c.ring === 4)).toHaveLength(719)
    for (const code of countries) {
      if (UNLABELLED_COUNTRIES.includes(code)) continue
      expect(labelled.has(code), code).toBe(true)
    }
    // 5. halkanın tabloda kodu olmayan iki ülkesi: Natural Earth'te tek birimdeki Christmas ve Cocos
    // (Hint Okyanusu Toprakları; ikisi de adın sığamayacağı kadar küçük, D-100).
    const ringFiveCountries = new Set(
      candidates.filter((c) => c.listable && c.ring === 5).map((c) => c.country),
    )
    const missing = [...ringFiveCountries].filter((code) => !labelled.has(code)).sort()
    expect(missing).toEqual(['CC', 'CX'])
  })

  it('havalimanı listelenmeyen ülkeler de yazılır (D-100): Ukrayna, ABD, Brezilya, Avustralya; Hindistan ve Grönland 4. halkayla listelenir (D-102)', () => {
    // v0.22.5'te (3. halka) Hindistan ve Grönland'ın da listelenen havalimanı yoktu.
    expect(listedCountries.has('IN')).toBe(true)
    expect(listedCountries.has('GL')).toBe(true)
    for (const code of ['UA', 'US', 'BR', 'AU']) expect(listedCountries.has(code), code).toBe(false)
    for (const code of ['UA', 'US', 'BR', 'AU', 'IN', 'GL']) {
      for (const locale of ['tr', 'en'] as const) {
        const row = COUNTRY_LABEL_PLACEMENTS[locale][code]
        expect(row?.regular, `${code} ${locale}`).not.toBeNull()
        expect(row?.compact, `${code} ${locale}`).not.toBeNull()
      }
    }
    expect(labelled.size).toBe(244)
  })
})
