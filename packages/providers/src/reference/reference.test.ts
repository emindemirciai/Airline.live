import { readFileSync } from 'node:fs'
import { bearingDifference, distanceKm, initialBearing, type LatLon } from '@havayolu/geo'
import { describe, expect, it } from 'vitest'
import {
  endsAreTooFarApart,
  isImportedAirport,
  MAX_RUNWAY_END_SEPARATION_M,
  MAX_RUNWAY_END_SEPARATION_RATIO,
  parseAirports,
  parseRunways,
  type RunwayRow,
} from './ourairports'
import { parseAirlines } from './vrs'

// Commit'li alt küme: OurAirports ve VRS'ten 2026-09-27'de alındı; halka satırları 2026-10-01
// indirmesinden (tools/fixtures/README.md).
const fixture = (path: string) =>
  readFileSync(new URL(`../../../../tools/fixtures/${path}`, import.meta.url), 'utf8')

const airports = parseAirports(fixture('ourairports/airports.csv'))
const arps = new Map<number, LatLon>(
  airports.rows.map((a) => [a.id, { lat: a.latitudeDeg, lon: a.longitudeDeg }]),
)
const runways = parseRunways(fixture('ourairports/runways.csv'), arps)
const STATIONS = ['LTFM', 'LTFJ', 'LTAC', 'LTBJ', 'LTAI']
const M_PER_FT = 0.3048
const AIRPORTS_HEADER =
  'id,ident,type,name,latitude_deg,longitude_deg,elevation_ft,continent,iso_country,iso_region,municipality,scheduled_service,icao_code,iata_code,gps_code,local_code,home_link,wikipedia_link,keywords'
const RUNWAYS_HEADER =
  'id,airport_ref,airport_ident,length_ft,width_ft,surface,lighted,closed,le_ident,le_latitude_deg,le_longitude_deg,le_elevation_ft,le_heading_degT,le_displaced_threshold_ft,he_ident,he_latitude_deg,he_longitude_deg,he_elevation_ft,he_heading_degT,he_displaced_threshold_ft'

describe('OurAirports airports', () => {
  it('fixture eksiksiz ayrışır; tohum istasyonları ve ARP bilgileri vardır', () => {
    expect(airports.skipped).toEqual([])
    // Fixture bütün TR alanlarını (429), sekiz uzak havalimanını, iki dışlama örneğini (LFPB, FATH;
    // D-109), 1. halkanın 75, 2. halkanın 89, 3. halkanın 275, 4. halkanın 716 ve 5. halkanın 2.030
    // yeni havalimanını (D-080, D-088, D-090, D-101, D-109) içerir; filtre büyük/orta ve tarifeli
    // olanları ve Türkiye'nin IATA kodlu 5 küçük alanını (yurt dışı havalimanlarının uzaklık
    // referansı, D-080) tutar. Thohoyandou (FATH) küçük ve tarifesizdir: içe aktarılmaz.
    const all = parseAirports(fixture('ourairports/airports.csv'), () => true)
    expect(all.skipped).toEqual([])
    expect(all.rows.length).toBe(3624)
    expect(all.rows.filter((a) => a.isoCountry === 'TR')).toHaveLength(429)
    expect(airports.rows.length + airports.ignored).toBe(3624)
    // Halkaların satırları önceki satırların ardından, kaynak sırasıyla gelir: 3. halkanın sonuncusu
    // Samara (UWWW), 4. halkanın ilki Neerlerit Inaat (Grönland), sonuncusu Yining (ZWYN); 5.
    // halkanın ilki Aleknagik (5A8, WKK), sonuncusu Yingkou (ZYYK).
    expect(all.rows.slice(877, 879).map((a) => a.ident)).toEqual(['UWWW', 'BGCO'])
    expect(all.rows.slice(1593, 1595).map((a) => a.ident)).toEqual(['ZWYN', '5A8'])
    expect(all.rows.at(-1)?.ident).toBe('ZYYK')
    expect(all.rows.find((a) => a.ident === 'FATH')).toMatchObject({
      type: 'small_airport',
      scheduledService: false,
      iataCode: 'THY',
    })
    expect(airports.rows.some((a) => a.ident === 'FATH')).toBe(false)
    expect(airports.rows.find((a) => a.ident === 'LFPB')).toMatchObject({
      type: 'large_airport',
      scheduledService: false,
      iataCode: 'LBG',
    })
    expect(airports.rows.find((a) => a.ident === 'LGAV')).toMatchObject({
      iataCode: 'ATH',
      isoCountry: 'GR',
      type: 'large_airport',
      scheduledService: true,
    })
    expect(airports.rows.find((a) => a.ident === 'LCEN')).toMatchObject({
      iataCode: 'ECN',
      isoCountry: 'CY',
    })
    expect(airports.rows.every(isImportedAirport)).toBe(true)
    const turkishWithIata = airports.rows.filter((a) => a.isoCountry === 'TR' && a.iataCode)
    expect(turkishWithIata).toHaveLength(66)
    expect(
      turkishWithIata
        .filter((a) => a.type === 'small_airport' && !a.scheduledService)
        .map((a) => a.ident)
        .sort(),
    ).toEqual(['LTAF', 'LTBD', 'LTBV', 'LTFB', 'LTFK'])
    const ltfm = airports.rows.find((a) => a.ident === 'LTFM')
    expect(ltfm).toMatchObject({ iataCode: 'IST', isoCountry: 'TR', type: 'large_airport' })
    for (const ident of STATIONS)
      expect(
        airports.rows.some((a) => a.ident === ident),
        ident,
      ).toBe(true)
  })

  it('hatalı satırları satır numarası ve sebebiyle atlar', () => {
    const csv = [
      AIRPORTS_HEADER,
      '1,AAAA,small_airport,A,41,29,,EU,TR,TR-34,,no,,,,,,,',
      'x,BBBB,small_airport,B,41,29,,EU,TR,TR-34,,no,,,,,,,',
      '3,CCCC,small_airport,C,,29,,EU,TR,TR-34,,no,,,,,,,',
      '4,DDDD,small_airport,D,95,29,,EU,TR,TR-34,,no,,,,,,,',
      '5,EEEE,small_airport,E,41,29',
    ].join('\n')
    const { rows, skipped } = parseAirports(csv, () => true)
    expect(rows.map((r) => r.ident)).toEqual(['AAAA'])
    expect(skipped.map((s) => s.line)).toEqual([3, 4, 5, 6])
  })

  it('filtre: büyük/orta alan, tarifeli sefer ya da Türkiye’nin IATA kodlu küçük alanı; filtre dışı satır doğrulanmadan sayılır', () => {
    const csv = [
      AIRPORTS_HEADER,
      '1,LARG,large_airport,L,41,29,,EU,TR,TR-34,,yes,,,,,,,',
      '2,MEDI,medium_airport,M,41,29,,EU,TR,TR-34,,no,,,,,,,',
      '3,SMSC,small_airport,S,41,29,,EU,TR,TR-34,,yes,,,,,,,',
      '4,SMAL,small_airport,S,41,29,,EU,TR,TR-34,,no,,,,,,,',
      '5,HELI,heliport,H,,,,EU,TR,TR-34,,no,,,,,,,',
      '6,CLSD,closed,C,41,29,,EU,TR,TR-34,,no,,,,,,,',
      // D-080: Türkiye'nin IATA kodlu küçük alanı uzaklık referansıdır (Gökçeada gibi).
      '7,SMIA,small_airport,S,41,29,,EU,TR,TR-17,,no,,gkd,,,,,',
      // Yurt dışındaki IATA kodlu küçük alan, IATA kodu biçimsiz küçük alan ve IATA kodlu heliport
      // alınmaz.
      '8,SMGR,small_airport,S,41,29,,EU,GR,GR-I,,no,,AAA,,,,,',
      '9,SMBD,small_airport,S,41,29,,EU,TR,TR-34,,no,,0,,,,,',
      '10,HEIA,heliport,H,41,29,,EU,TR,TR-34,,no,,HHH,,,,,',
    ].join('\n')
    const { rows, skipped, ignored } = parseAirports(csv)
    expect(rows.map((r) => r.ident)).toEqual(['LARG', 'MEDI', 'SMSC', 'SMIA'])
    expect(skipped).toEqual([])
    expect(ignored).toBe(6)
  })

  it('aynı satır aynı özeti üretir, alan değişince özet değişir', () => {
    const a = airports.rows[0]
    expect(a).toBeDefined()
    const again = parseAirports(fixture('ourairports/airports.csv')).rows[0]
    expect(again?.rowHash).toBe(a?.rowHash)
    expect(airports.rows[1]?.rowHash).not.toBe(a?.rowHash)
  })
})

describe('OurAirports runways ve pist eşikleri (M2 kabulü)', () => {
  it('fixture ayrışır; içe aktarılmayan havalimanının pisti ve kapalı pist filtre dışıdır', () => {
    expect(runways.skipped).toEqual([])
    // 4.604 veri satırı: taban (149; LFPB'nin üç pisti dahil) ve 1.–5. halkanın açık pistleri (4.455).
    expect(runways.rows.length + runways.ignored).toBe(4604)
    const ltfm = airports.rows.find((a) => a.ident === 'LTFM')?.id
    const other = parseRunways(
      [
        RUNWAYS_HEADER,
        '9,999999,ZZZZ,1000,30,ASP,1,0,09,,,,,,27,,,,,',
        `10,${ltfm},LTFM,1000,30,ASP,1,1,09,,,,,,27,,,,,`,
        `11,${ltfm},LTFM,1000,30,ASP,1,0,09,,,,,,27,,,,,`,
        `x,${ltfm},LTFM,1000,30,ASP,1,0,09,,,,,,27,,,,,`,
      ].join('\n'),
      arps,
    )
    expect(other.rows.map((r) => r.id)).toEqual([11])
    expect(other.rows[0]?.le.thresholdSource).toBe('arp_fallback')
    expect(other.ignored).toBe(2)
    expect(other.skipped).toEqual([{ line: 5, reason: 'id sayı değil: x' }])
  })

  it('iki ucu aynı noktaya yazılmış pistte yön heading alanından gelir (ör. LHTL 14/32)', () => {
    const end = { lat: 47.35, lon: 18.98 }
    const { rows } = parseRunways(
      [
        RUNWAYS_HEADER,
        '271004,30488,LHTL,5800,100,ASP,1,0,14,47.35,18.98,331,142,1207,32,47.35,18.98,331,322,',
      ].join('\n'),
      new Map([[30488, end]]),
    )
    const [lhtl] = rows
    expect(lhtl?.le).toMatchObject({
      bearingSource: 'heading_field',
      trueBearingDeg: 142,
      headingMismatch: false,
      thresholdSource: 'displaced_threshold',
    })
    expect(lhtl?.he).toMatchObject({ bearingSource: 'heading_field', trueBearingDeg: 322 })
    const shifted = { lat: lhtl?.le.thresholdLat ?? 0, lon: lhtl?.le.thresholdLon ?? 0 }
    expect(distanceKm(end, shifted) * 1000).toBeCloseTo(1207 * M_PER_FT, 0)
    expect(initialBearing(end, shifted)).toBeCloseTo(142, 1)
  })

  it('uçları kayıtlı uzunluğa göre çok uzak pist: yön heading alanından, eşikler ARP (VAAM 08/26, D-101)', () => {
    // Fixture satırı 610195: 6.070 ft (1.850 m) kayıtlı, uçlar 74,5 km arayla (77,01° D ve 77,73° D).
    const vaam = runways.rows.find((r) => r.id === 610195)
    const arp = arps.get(vaam?.airportId ?? -1)
    expect(vaam?.airportIdent).toBe('IN-0065')
    expect(arp).toBeDefined()
    expect(vaam?.endsAreThresholds).toBe(false)
    for (const [end, heading] of [
      [vaam?.le, 75],
      [vaam?.he, 255],
    ] as const) {
      expect(end).toMatchObject({
        trueBearingDeg: heading,
        bearingSource: 'heading_field',
        headingMismatch: false,
        thresholdLat: arp?.lat,
        thresholdLon: arp?.lon,
        thresholdSource: 'arp_fallback',
      })
    }
    // Ham uç koordinatları kayıtta olduğu gibi kalır.
    expect(vaam?.le.longitudeDeg).toBe(77.01274)
    expect(vaam?.he.longitudeDeg).toBe(77.72992)
    // Kural fixture'ın açık pistlerinde yalnız bu satırı ve 5. halkada Pueblo'nun (KPUB) 241424
    // 08L/26R satırını (4.690 ft, uçlar 3,14 km arayla) etkiler: geri kalan her iki uçlu pistte uçlar
    // uzunluğun iki katını ya da 1 km'yi aşmaz.
    const affected = runways.rows
      .filter((r) => {
        const le = r.le.latitudeDeg !== null && r.le.longitudeDeg !== null
        const he = r.he.latitudeDeg !== null && r.he.longitudeDeg !== null
        return le && he && endsAreTooFarApart(rawEnd(r.le), rawEnd(r.he), r.lengthFt)
      })
      .map((r) => r.id)
    expect(affected).toEqual([610195, 241424])
  })

  it('uç uzaklığı kuralının sınırları web test yardımcısındakiyle aynı (D-101)', () => {
    // Web @havayolu/providers'a bağımlı değildir; yardımcı kuralı kendi yazar.
    const source = readFileSync(
      new URL('../../../../apps/web/src/lib/test/ourairports-fixture.ts', import.meta.url),
      'utf8',
    )
    expect(/const MAX_RUNWAY_END_SEPARATION_RATIO = (\d+)/.exec(source)?.[1]).toBe(
      String(MAX_RUNWAY_END_SEPARATION_RATIO),
    )
    expect(/const MAX_RUNWAY_END_SEPARATION_M = (\d+)/.exec(source)?.[1]).toBe(
      String(MAX_RUNWAY_END_SEPARATION_M),
    )
  })

  it('endsAreTooFarApart: uzunluğun iki katından ve 1 km’den uzak uçlar; uzunluk yoksa kural yok', () => {
    const west = { lat: 20, lon: 77 }
    const at = (metres: number) => ({ lat: 20, lon: 77 + metres / 1000 / 104.6 })
    // 1.850 m pist: 3.000 m arayla uçlar sınırın altında, 4.000 m arayla üstünde.
    expect(endsAreTooFarApart(west, at(3000), 6070)).toBe(false)
    expect(endsAreTooFarApart(west, at(4000), 6070)).toBe(true)
    // Kısa pistte 1 km alt sınırı: 300 ft (91 m) pistin uçları 900 m arayla kural dışı.
    expect(endsAreTooFarApart(west, at(900), 300)).toBe(false)
    expect(endsAreTooFarApart(west, at(1100), 300)).toBe(true)
    // Uzunluğu bilinmeyen pistte karşılaştıracak değer yok.
    expect(endsAreTooFarApart(west, at(50_000), null)).toBe(false)
    expect(endsAreTooFarApart(west, at(50_000), 0)).toBe(false)
    expect(MAX_RUNWAY_END_SEPARATION_RATIO).toBe(2)
    expect(MAX_RUNWAY_END_SEPARATION_M).toBe(1000)
    // Uzunluk yazılı, uçlar çok uzak: satır yine pisttir, yön heading alanından.
    const { rows } = parseRunways(
      [
        RUNWAYS_HEADER,
        '1,30488,ZZZZ,1000,30,ASP,1,0,09,20,77,,90,,27,20,77.2,,270,',
        '2,30488,ZZZZ,1000,30,ASP,1,0,09,20,77,,90,,27,20,77.002,,270,',
      ].join('\n'),
      new Map([[30488, { lat: 20.1, lon: 77.1 }]]),
    )
    expect(rows.map((r) => [r.id, r.le.bearingSource, r.le.thresholdSource])).toEqual([
      [1, 'heading_field', 'arp_fallback'],
      [2, 'coordinates', 'runway_end'],
    ])
  })

  const stationRunways = runways.rows.filter(
    (r) =>
      STATIONS.includes(r.airportIdent) && r.le.latitudeDeg !== null && r.he.latitudeDeg !== null,
  )
  const threshold = (end: RunwayRow['le']): LatLon => ({
    lat: end.thresholdLat,
    lon: end.thresholdLon,
  })
  const rawEnd = (end: RunwayRow['le']): LatLon => ({
    lat: end.latitudeDeg ?? Number.NaN,
    lon: end.longitudeDeg ?? Number.NaN,
  })

  it('beş tohum istasyonunun bütün pistleri kontrol edilir (LTFM 6 pist)', () => {
    expect(stationRunways.filter((r) => r.airportIdent === 'LTFM')).toHaveLength(6)
    expect(stationRunways.length).toBeGreaterThanOrEqual(15)
  })

  it.each(stationRunways.map((r) => [`${r.airportIdent} ${r.le.ident}/${r.he.ident}`, r] as const))(
    '%s: eşikler arası mesafe = uzunluk − kaydırmalar (±50 m)',
    (_name, runway) => {
      const expected =
        (runway.lengthFt ?? 0) * M_PER_FT -
        (runway.le.displacedThresholdFt ?? 0) * M_PER_FT -
        (runway.he.displacedThresholdFt ?? 0) * M_PER_FT
      const actual = distanceKm(threshold(runway.le), threshold(runway.he)) * 1000
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(50)
    },
  )

  it.each(stationRunways.map((r) => [`${r.airportIdent} ${r.le.ident}/${r.he.ident}`, r] as const))(
    '%s: eşikten eşiğe yön = pist yönü (±1°); heading alanı tutarsızsa işaretlenir',
    (_name, runway) => {
      const bearing = initialBearing(threshold(runway.le), threshold(runway.he))
      expect(runway.le.bearingSource).toBe('coordinates')
      if (runway.le.headingDegT !== null && !runway.le.headingMismatch) {
        expect(bearingDifference(bearing, runway.le.headingDegT)).toBeLessThanOrEqual(1)
      } else {
        expect(
          bearingDifference(bearing, runway.le.trueBearingDeg ?? Number.NaN),
        ).toBeLessThanOrEqual(1)
      }
    },
  )

  it('LTFM: heading alanı hatalı dört pist yakalanır (koordinat yönü 179°, alan 174°; D-066)', () => {
    const mismatched = stationRunways
      .filter((r) => r.airportIdent === 'LTFM' && r.le.headingMismatch)
      .map((r) => r.le.ident)
      .sort()
    expect(mismatched).toEqual(['16L', '16R', '17L', '17R'])
  })

  it('kaydırılmış eşik ham uçtan displaced × 0,3048 m uzaktadır (±1 m); uç zaten eşikse kaydırılmaz', () => {
    // Uçları kayıtlı uzunluğa göre çok uzak pistin (VAAM, D-101) eşikleri ARP'tır; ayrı test.
    const withBothEnds = runways.rows.filter(
      (r) =>
        r.le.latitudeDeg !== null &&
        r.he.latitudeDeg !== null &&
        !endsAreTooFarApart(rawEnd(r.le), rawEnd(r.he), r.lengthFt),
    )
    const displaced = withBothEnds.flatMap((r) =>
      [r.le, r.he]
        .filter((end) => (end.displacedThresholdFt ?? 0) > 0)
        .map((end) => ({ runway: r, end })),
    )
    const physicalEnds = displaced.filter((d) => !d.runway.endsAreThresholds)
    const alreadyThresholds = displaced.filter((d) => d.runway.endsAreThresholds)
    expect(physicalEnds.length).toBeGreaterThan(0)
    expect(alreadyThresholds.length).toBeGreaterThan(0)
    for (const { end } of physicalEnds) {
      expect(end.thresholdSource).toBe('displaced_threshold')
      const shift = distanceKm(rawEnd(end), threshold(end)) * 1000
      expect(Math.abs(shift - (end.displacedThresholdFt ?? 0) * M_PER_FT)).toBeLessThanOrEqual(1)
    }
    for (const { end } of alreadyThresholds) {
      expect(end.thresholdSource).toBe('displaced_threshold')
      expect(distanceKm(rawEnd(end), threshold(end)) * 1000).toBeLessThan(0.01)
    }
  })

  it('LTAC 03L: koordinat zaten kaydırılmış eşik (uçlar 3.387 m, uzunluk 3.750 − 350 m; D-066)', () => {
    const ltac = runways.rows.find((r) => r.airportIdent === 'LTAC' && r.le.ident === '03L')
    expect(ltac?.endsAreThresholds).toBe(true)
  })
})

describe('VRS airlines', () => {
  const airlines = parseAirlines(fixture('vrs/airlines.csv'))

  it('fixture ayrışır; Türk havayolları doğru kodlarla gelir', () => {
    expect(airlines.rows.length).toBeGreaterThan(5000)
    const byCode = new Map(airlines.rows.map((a) => [a.code, a]))
    expect(byCode.get('THY')).toMatchObject({ icao: 'THY', iata: 'TK', name: 'Turkish Airlines' })
    expect(byCode.get('TKJ')).toMatchObject({ icao: 'TKJ', iata: 'VF', name: 'AJet' })
    expect(byCode.get('PGT')).toMatchObject({ icao: 'PGT', iata: 'PC' })
  })

  it('boş ya da yinelenen kodu atlar', () => {
    const { rows, skipped } = parseAirlines(
      'Code,Name,ICAO,IATA,PositioningFlightPattern,CharterFlightPattern\nAAA,A,AAA,,,\n,B,,,,\nAAA,A2,,,,',
    )
    expect(rows.map((r) => r.name)).toEqual(['A'])
    expect(skipped.map((s) => s.line)).toEqual([3, 4])
  })
})
