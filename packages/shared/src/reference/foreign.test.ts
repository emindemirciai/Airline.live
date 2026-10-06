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
  countryName,
  ENABLED_AIRPORT_RING,
  FOREIGN_AIRPORT_CITIES,
  FOREIGN_AIRPORT_NAMES,
  foreignAirportCity,
  foreignAirportName,
  isEnabledAirportRing,
  isCanonicalIcao,
  isForeignCandidate,
  isScheduledIataAirport,
  OURAIRPORTS_ICAO_CORRECTIONS,
  ourAirportsIcao,
  REFERENCE_AIRFIELD_NAMES,
  referenceAirfieldName,
  translatedAirportName,
  TURKEY_COUNTRY,
  UNLABELLED_COUNTRIES,
} from './index'
import { COUNTRY_LABEL_PLACEMENTS } from '../map/country-label-placements'

// Commit'li OurAirports alt kümesi (tools/fixtures/README.md): Türkiye'nin bütün kayıtları, birkaç
// uzak havalimanı, 1.–4. halkanın havalimanları (D-080, D-088, D-090, D-101). Alanlar tırnaklı; `""`
// kaçışlı tırnaktır.
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

/** Halka analizinin kuralı: Türkiye'deki IATA kodlu her havalimanı uzaklık referansıdır. */
const turkishRows = rows
  .filter((r) => r.get('iso_country') === 'TR')
  .filter((r) => LISTABLE.includes(r.get('type') ?? ''))
  .filter((r) => IATA.test((r.get('iata_code') ?? '').trim().toUpperCase()))
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
/** Açık halkalardaki yabancı havalimanları (M6h'den beri 1., 2. ve 3. halka, D-090). */
const listed = candidates.filter((c) => c.listable && c.ring <= ENABLED_AIRPORT_RING)
/** Türkçe adında şehir geçmeyen havalimanları: Ercan (Lefkoşa), Malta (Valletta), Bahreyn (Manama). */
const CITY_NOT_IN_NAME = ['LCEN', 'LMML', 'OBBI']

describe('halkalar', () => {
  it('sınırlar, halka sayısı ve açık halka (M6h: 3. halka, D-090)', () => {
    expect(AIRPORT_RINGS_KM).toEqual([500, 1000, 2000, 5000])
    expect(AIRPORT_RING_COUNT).toBe(5)
    expect(ENABLED_AIRPORT_RING).toBe(3)
    expect(AIRPORT_RING_CONFIG).toEqual({ ringsKm: [500, 1000, 2000, 5000], enabledRing: 3 })
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
    expect(isEnabledAirportRing(4)).toBe(false)
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
    // Sekiz uzak fixture havalimanından yalnız KJFK 4. halkanın ötesindedir; EDDF, OMDB ve OTHH 3.
    // halkada (D-090), EGLL, LFPG, EHAM ve LEMD 4. halkadadır (D-101).
    expect(candidates.filter((c) => c.ring > 4).map((c) => c.icao)).toEqual(['KJFK'])
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
    expect(listed).toHaveLength(442)
    expect(listed).toHaveLength(ringOne.length + ringTwo.length + ringThree.length)
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

  it('fixture: 4. halka 720 aday, 719 listelenebilir (UG-0002 dört karakterli ICAO kuralıyla dışarıda); halka henüz kapalı (D-101)', () => {
    expect(ringFour).toHaveLength(720)
    expect(ringFour.filter((c) => c.listable)).toHaveLength(719)
    // Kihihi Savannah pisti (IATA KHX): icao_code ve gps_code yok, kanonik kimliği ident'tir.
    // Bütün fixture'da dört karakterli ICAO kuralına takılan tek aday odur.
    expect(candidates.filter((c) => !c.listable).map((c) => c.icao)).toEqual(['UG-0002'])
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
    // Halka açılana kadar (M6i.2) liste 3. halkada kalır.
    expect(listed.map((c) => c.icao)).not.toContain('EGLL')
  })
})

describe('FOREIGN_AIRPORT_NAMES', () => {
  it("fixture'daki açık halkaların (1., 2. ve 3.) her havalimanı için tam bir kayıt vardır, fazlası yoktur", () => {
    expect(Object.keys(FOREIGN_AIRPORT_NAMES)).toHaveLength(442)
    expect(Object.keys(FOREIGN_AIRPORT_NAMES).sort()).toEqual(listed.map((c) => c.icao).sort())
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
      // "Airport" sözcüğün parçası da olabilir: EuroAirport Basel-Mulhouse-Freiburg (D-090).
      expect(name.en, icao).toMatch(/Airport/)
      expect(name.en, icao).not.toMatch(/Havalimanı|\bairport\b/)
    }
    const tr = Object.values(FOREIGN_AIRPORT_NAMES).map((n) => n.tr)
    expect(new Set(tr).size).toBe(tr.length)
  })

  it('İngilizce ad OurAirports adıdır; yalnızca Bağdat, Podgorica, Cuxhaven ve Guemar kısaltılmıştır', () => {
    // Karşılaştırma API'nin ad temizliğinden geçmiş adla: Bacău'nun kaynaktaki adında çift boşluk,
    // dokuz Fransız havalimanının adında küçük harfli "airport" var (D-088, D-090).
    const differs = listed
      .filter((c) => FOREIGN_AIRPORT_NAMES[c.icao]?.en !== c.name)
      .map((c) => c.icao)
      .sort()
    expect(differs).toEqual(['DAUO', 'ETMN', 'LYPG', 'ORBI'])
    expect(FOREIGN_AIRPORT_NAMES.LYPG?.en).toBe('Podgorica Airport')
    expect(FOREIGN_AIRPORT_NAMES.ETMN?.en).toBe('Sea-Airport Cuxhaven/Nordholz')
    expect(FOREIGN_AIRPORT_NAMES.DAUO?.en).toBe('Guemar Airport')
    expect(FOREIGN_AIRPORT_NAMES.LRBC?.en).toBe('Bacău George Enescu International Airport')
    const raw = (icao: string) => rows.find((r) => icaoOf(r) === icao)?.get('name')
    expect(raw('LFKB')).toBe('Bastia-Poretta International airport')
    expect(FOREIGN_AIRPORT_NAMES.LFKB?.en).toBe('Bastia-Poretta International Airport')
    expect(raw('LFLW')).toBe('Aurillac airport')
    expect(FOREIGN_AIRPORT_NAMES.LFLW?.en).toBe('Aurillac Airport')
    // Bütün fixture'da (4. halkanın yedi Fransız havalimanı dahil, D-101) küçük harfli "airport".
    const lowercase = rows
      .filter((r) => /\bairport\b/.test(r.get('name') ?? ''))
      .map(icaoOf)
      .sort()
    expect(lowercase).toEqual([
      ...['LFBE', 'LFBZ', 'LFKB', 'LFKJ', 'LFLB', 'LFLC', 'LFLP', 'LFLW'],
      ...['LFMU', 'LFMV', 'LFOB', 'LFOK', 'LFRB', 'LFRG', 'LFRK', 'LFSL'],
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

  it("fixture'daki açık halkaların ülkelerinin hepsi Intl'de adlandırılır (3. halkayla 58)", () => {
    const countries = new Set(listed.map((c) => c.country))
    expect(countries.size).toBe(58)
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

  it('4. halkaya kadar listelenebilecek her havalimanının ülkesi de tabloda (M6i.2 ülke kümesini ve fixture’ı değiştirmez; tablo yeni pinlerle yeniden üretilir)', () => {
    const countries = new Set(candidates.filter((c) => c.listable).map((c) => c.country))
    expect(candidates.filter((c) => c.listable && c.ring === 4).length).toBeGreaterThan(500)
    for (const code of countries) {
      if (UNLABELLED_COUNTRIES.includes(code)) continue
      expect(labelled.has(code), code).toBe(true)
    }
  })

  it('havalimanı olmayan ülkeler de yazılır (D-100): Ukrayna, Hindistan, Grönland, ABD', () => {
    for (const code of ['UA', 'IN', 'GL', 'US']) {
      expect(listedCountries.has(code), code).toBe(false)
      for (const locale of ['tr', 'en'] as const) {
        const row = COUNTRY_LABEL_PLACEMENTS[locale][code]
        expect(row?.regular, `${code} ${locale}`).not.toBeNull()
        expect(row?.compact, `${code} ${locale}`).not.toBeNull()
      }
    }
    expect(labelled.size).toBe(244)
  })
})
