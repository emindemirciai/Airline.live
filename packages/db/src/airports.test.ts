import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CIVIL_FLIGHT_CLOSURE_ICAOS,
  cleanAirportName,
  findAirportInRows,
  greatCircleKm,
  IDENT_ALIAS_EXCLUSIONS,
  identAlias,
  identAliasExclusionCensus,
  isEmptyRunway,
  isHiddenRunway,
  MILITARY_AIRFIELD_ICAOS,
  MIN_RUNWAY_LENGTH_FT,
  nearestDistanceKm,
  nearestReference,
  OURAIRPORTS_ICAO_CORRECTIONS,
  ourAirportsIcao,
  ringForDistance,
  rowMatchesCode,
  RUNWAY_TOMBSTONE_SURFACE,
  selectListedAirports,
  toAirportDetails,
  toListedAirports,
  turkishReferencePoints,
  visibleRunways,
  type AirportDetailSourceRow,
  type AirportSourceRow,
  type ListingContext,
  type RingContext,
  type RunwaySourceRow,
  type StationSourceRow,
} from './airports'

/** `@havayolu/shared` `AIRPORT_RINGS_KM` (bu paket shared'a bağımlı değildir; API testi eşitliği denetler). */
const RINGS_KM = [500, 1000, 2000, 5000]
/** Türkiye referansları: İstanbul (LTFM) ve Antalya (LTAI). */
const TURKEY = [
  { lat: 41.2611, lon: 28.7419, icao: 'LTFM', iata: 'IST', name: 'Istanbul Airport' },
  { lat: 36.8987, lon: 30.8005, icao: 'LTAI', iata: 'AYT', name: 'Antalya International Airport' },
]
const CONTEXT: RingContext = { turkey: TURKEY, ringsKm: RINGS_KM }
const listed = (rows: readonly AirportSourceRow[]) => toListedAirports(rows, CONTEXT)
const withDetails = (
  airportRows: readonly AirportDetailSourceRow[],
  runwayRows: readonly RunwaySourceRow[],
  stationRows: readonly StationSourceRow[],
) => toAirportDetails(airportRows, runwayRows, stationRows, CONTEXT)

let nextId = 1

const row = (overrides: Partial<AirportSourceRow> = {}): AirportSourceRow => ({
  id: nextId++,
  ident: 'LTFM',
  type: 'large_airport',
  name: 'Istanbul Airport',
  latitudeDeg: 41.2611,
  longitudeDeg: 28.7419,
  elevationFt: 325,
  isoCountry: 'TR',
  municipality: 'Istanbul',
  scheduledService: true,
  icaoCode: 'LTFM',
  iataCode: 'IST',
  gpsCode: 'LTFM',
  ...overrides,
})

describe('toListedAirports', () => {
  it('satırı ortak Airport biçimine çevirir', () => {
    expect(listed([row()])).toEqual([
      {
        icao: 'LTFM',
        iata: 'IST',
        name: 'Istanbul Airport',
        city: 'Istanbul',
        lat: 41.2611,
        lon: 28.7419,
        elevationFt: 325,
        type: 'large_airport',
        scheduled: true,
        country: 'TR',
        ring: 0,
        distanceToTrKm: null,
      },
    ])
  })

  it('ICAO: icao_code, yoksa gps_code, o da yoksa ident', () => {
    const list = listed([
      row({ ident: 'LTBJ', icaoCode: null, gpsCode: 'LTBJ', iataCode: 'ADB' }),
      row({ ident: 'TR-0099', icaoCode: ' ', gpsCode: null, iataCode: 'XXA' }),
      row({ ident: 'LTXX', icaoCode: 'ltyy', gpsCode: 'LTZZ', iataCode: 'XXB' }),
    ])
    expect(list.map((a) => [a.iata, a.icao])).toEqual([
      ['ADB', 'LTBJ'],
      ['XXA', 'TR-0099'],
      ['XXB', 'LTYY'],
    ])
  })

  it('askerî hava üsleri (D-107) listelenmez: kanonik ICAO, gps_code, ident ya da küçük harfle de', () => {
    // Türkiye'nin beş üssü (D-107) ve 5. halkanın askerî listesi (D-109).
    expect(MILITARY_AIRFIELD_ICAOS).toEqual([
      ...['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'],
      ...['PKWA', 'PWAK', 'YBOK'],
    ])
    const list = listed([
      row({ ident: 'LTAG', icaoCode: 'LTAG', gpsCode: 'LTAG', iataCode: 'UAB' }),
      row({ ident: 'LTAH', icaoCode: ' ltah ', gpsCode: null, iataCode: 'AFY' }),
      row({ ident: 'TR-0101', icaoCode: null, gpsCode: 'LTBG', iataCode: 'BDM' }),
      row({ ident: 'LTBI', icaoCode: null, gpsCode: null, iataCode: 'ESK' }),
      row({ ident: 'LTBL', icaoCode: 'LTBL', gpsCode: 'LTBL', iataCode: 'IGL' }),
      row({ ident: 'LTBJ', icaoCode: 'LTBJ', gpsCode: 'LTBJ', iataCode: 'ADB' }),
      // Askerî adlı ama sivil olan Ankara (Etimesgut) listede kalır (D-084).
      row({ ident: 'LTAD', icaoCode: 'LTAD', gpsCode: 'LTAD', iataCode: 'ANK' }),
    ])
    expect(list.map((a) => a.icao)).toEqual(['LTBJ', 'LTAD'])
  })

  it('IATA kırpılır ve büyük harfe çevrilir; üç harf değilse satır atlanır', () => {
    const list = listed([
      row({ ident: 'LTAA', icaoCode: 'LTAA', iataCode: ' saw ' }),
      row({ ident: 'LTAB', icaoCode: 'LTAB', iataCode: '' }),
      row({ ident: 'LTAC', icaoCode: 'LTAC', iataCode: null }),
      row({ ident: 'LTAD', icaoCode: 'LTAD', iataCode: 'AB' }),
      row({ ident: 'LTAE', icaoCode: 'LTAE', iataCode: 'A1B' }),
      row({ ident: 'LTAF', icaoCode: 'LTAF', iataCode: 'ABCD' }),
    ])
    expect(list.map((a) => [a.icao, a.iata])).toEqual([['LTAA', 'SAW']])
  })

  it('küçük havalimanı yalnızca tarifeliyse (içe aktarım koşulu); büyük ve orta her zaman', () => {
    const list = listed([
      row({ ident: 'L1', icaoCode: 'L1', iataCode: 'AAA', type: 'small_airport' }),
      row({
        ident: 'L2',
        icaoCode: 'L2',
        iataCode: 'BBB',
        type: 'small_airport',
        scheduledService: false,
      }),
      row({
        ident: 'L3',
        icaoCode: 'L3',
        iataCode: 'CCC',
        type: 'medium_airport',
        scheduledService: false,
      }),
    ])
    expect(list.map((a) => a.icao)).toEqual(['L1', 'L3'])
  })

  it('yalnızca büyük, orta ve küçük havalimanları', () => {
    const list = listed([
      row({ ident: 'L1', icaoCode: 'L1', iataCode: 'AAA', type: 'large_airport' }),
      row({ ident: 'L2', icaoCode: 'L2', iataCode: 'BBB', type: 'medium_airport' }),
      row({ ident: 'L3', icaoCode: 'L3', iataCode: 'CCC', type: 'small_airport' }),
      row({ ident: 'L4', icaoCode: 'L4', iataCode: 'DDD', type: 'heliport' }),
      row({ ident: 'L5', icaoCode: 'L5', iataCode: 'EEE', type: 'closed' }),
      row({ ident: 'L6', icaoCode: 'L6', iataCode: 'FFF', type: 'seaplane_base' }),
    ])
    expect(list.map((a) => a.type)).toEqual(['large_airport', 'medium_airport', 'small_airport'])
  })

  it('IATA’ya, eşitse ICAO’ya göre sıralar; aynı ICAO’da önce gelen satır kalır', () => {
    const list = listed([
      row({ ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST', name: 'İlk' }),
      row({ ident: 'LTFJ', icaoCode: 'LTFJ', iataCode: 'SAW' }),
      row({ ident: 'LTAC', icaoCode: 'LTAC', iataCode: 'ESB' }),
      row({ ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'ISX', name: 'İkinci' }),
      row({ ident: 'ZZZZ', icaoCode: 'ZZZZ', iataCode: 'ESB' }),
    ])
    expect(list.map((a) => `${a.iata}/${a.icao}`)).toEqual([
      'ESB/LTAC',
      'ESB/ZZZZ',
      'IST/LTFM',
      'SAW/LTFJ',
    ])
    expect(list.find((a) => a.icao === 'LTFM')?.name).toBe('İlk')
  })

  it('boş şehir null; ad kırpılır; yükseklik bilinmiyorsa null', () => {
    const [airport] = listed([
      row({ municipality: '  ', name: ' Kapadokya ', elevationFt: null, scheduledService: false }),
    ])
    expect(airport).toMatchObject({
      city: null,
      name: 'Kapadokya',
      elevationFt: null,
      scheduled: false,
    })
  })

  it('satır yoksa liste boş', () => {
    expect(listed([])).toEqual([])
  })
})

const detailRow = (overrides: Partial<AirportDetailSourceRow> = {}): AirportDetailSourceRow => ({
  ...row(),
  isoRegion: 'TR-34',
  updatedAt: new Date('2026-09-27T04:40:00Z'),
  ...overrides,
})

const runwayRow = (overrides: Partial<RunwaySourceRow> = {}): RunwaySourceRow => ({
  id: 1,
  airportId: 1,
  lengthFt: 12_303,
  widthFt: 197,
  surface: 'CON',
  lighted: true,
  leIdent: '16L',
  leTrueBearingDeg: 175.1,
  leDisplacedThresholdFt: null,
  leThresholdLat: 41.29,
  leThresholdLon: 28.72,
  heIdent: '34R',
  heTrueBearingDeg: 355.1,
  heDisplacedThresholdFt: 0,
  heThresholdLat: 41.26,
  heThresholdLon: 28.73,
  leLatitudeDeg: 41.29,
  heLatitudeDeg: 41.26,
  updatedAt: new Date('2026-09-27T04:40:00Z'),
  overrideUpdatedAt: null,
  ...overrides,
})

describe('toAirportDetails', () => {
  it('havalimanına pistleri, istasyonu ve veri tarihini ekler', () => {
    const airport = detailRow({ id: 10, municipality: ' Istanbul ', isoRegion: ' tr-34 ' })
    const [detail] = withDetails(
      [airport],
      [runwayRow({ id: 5, airportId: 10, surface: ' ', leIdent: null })],
      [{ icao: 'LTFM', isActive: true, isPrimary: true, fetchRadiusNm: 60 }],
    )
    expect(detail).toEqual({
      icao: 'LTFM',
      iata: 'IST',
      name: 'Istanbul Airport',
      city: 'Istanbul',
      lat: 41.2611,
      lon: 28.7419,
      elevationFt: 325,
      type: 'large_airport',
      scheduled: true,
      country: 'TR',
      ring: 0,
      distanceToTrKm: null,
      nearestTr: null,
      isoRegion: 'TR-34',
      municipality: 'Istanbul',
      station: { active: true, primary: true, fetchRadiusNm: 60 },
      dataUpdatedAt: '2026-09-27T04:40:00.000Z',
      runways: [
        {
          id: 5,
          lengthFt: 12_303,
          widthFt: 197,
          surface: null,
          lighted: true,
          ends: [
            {
              ident: '',
              trueBearingDeg: 175.1,
              displacedThresholdFt: null,
              thresholdLat: 41.29,
              thresholdLon: 28.72,
            },
            {
              ident: '34R',
              trueBearingDeg: 355.1,
              displacedThresholdFt: 0,
              thresholdLat: 41.26,
              thresholdLon: 28.73,
            },
          ],
        },
      ],
    })
  })

  it('istasyon değilse null; istasyon kodu büyük/küçük harf ve boşluk farkıyla eşleşir', () => {
    const [ist, saw] = withDetails(
      [
        detailRow({ id: 1, ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST' }),
        detailRow({ id: 2, ident: 'LTFJ', icaoCode: 'LTFJ', iataCode: 'SAW' }),
      ],
      [],
      [{ icao: ' ltfj ', isActive: false, isPrimary: false, fetchRadiusNm: 45.5 }],
    )
    expect(ist?.icao).toBe('LTFM')
    expect(ist?.station).toBeNull()
    expect(ist?.runways).toEqual([])
    expect(saw?.station).toEqual({ active: false, primary: false, fetchRadiusNm: 45.5 })
  })

  it('pistler pist adına göre sayısal sıralanır; adı olmayan sona, eşitlikte kimlik', () => {
    const [detail] = withDetails(
      [detailRow({ id: 1 })],
      [
        runwayRow({ id: 1, leIdent: '18' }),
        runwayRow({ id: 2, leIdent: '16R' }),
        runwayRow({ id: 3, leIdent: null }),
        runwayRow({ id: 4, leIdent: '9' }),
        runwayRow({ id: 5, leIdent: '16L' }),
        runwayRow({ id: 6, leIdent: '16L' }),
        runwayRow({ id: 7, airportId: 99, leIdent: '01' }),
      ],
      [],
    )
    expect(detail?.runways.map((r) => r.id)).toEqual([4, 5, 6, 2, 1, 3])
  })

  it('veri tarihi: havalimanı, pist ve pist düzeltmesinin en yenisi', () => {
    const at = (iso: string) => new Date(iso)
    const [detail] = withDetails(
      [detailRow({ id: 1, updatedAt: at('2026-09-01T00:00:00Z') })],
      [
        runwayRow({ id: 1, updatedAt: at('2026-09-02T00:00:00Z') }),
        runwayRow({
          id: 2,
          updatedAt: at('2026-08-01T00:00:00Z'),
          overrideUpdatedAt: at('2026-09-03T12:00:00Z'),
        }),
      ],
      [],
    )
    expect(detail?.dataUpdatedAt).toBe('2026-09-03T12:00:00.000Z')
    const [plain] = withDetails([detailRow({ updatedAt: at('2026-09-05T00:00:00Z') })], [], [])
    expect(plain?.dataUpdatedAt).toBe('2026-09-05T00:00:00.000Z')
  })

  it('liste kuralı aynen uygulanır: IATA sırası, tekil ICAO, IATA kodu olmayan yok', () => {
    const details = withDetails(
      [
        detailRow({ id: 1, ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST', name: 'İlk' }),
        detailRow({ id: 2, ident: 'LTAC', icaoCode: 'LTAC', iataCode: 'ESB' }),
        detailRow({ id: 3, ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'ISX', name: 'İkinci' }),
        detailRow({ id: 4, ident: 'LTAE', icaoCode: 'LTAE', iataCode: null }),
      ],
      [runwayRow({ id: 9, airportId: 3 })],
      [],
    )
    expect(details.map((d) => `${d.iata}/${d.icao}/${d.name}`)).toEqual([
      'ESB/LTAC/Istanbul Airport',
      'IST/LTFM/İlk',
    ])
    // Listede görünmeyen satırın pisti başka havalimanına geçmez.
    expect(details.flatMap((d) => d.runways)).toEqual([])
  })

  it('sürücü sayıyı metin verirse sayıya çevrilir', () => {
    const [detail] = withDetails(
      [detailRow({ id: 1 })],
      [runwayRow({ leTrueBearingDeg: '175.5' as unknown as number, heThresholdLat: null })],
      [],
    )
    expect(detail?.runways[0]?.ends[0].trueBearingDeg).toBe(175.5)
    expect(detail?.runways[0]?.ends[1].thresholdLat).toBeNull()
  })
})

describe('halka hesabı', () => {
  it('greatCircleKm ve nearestDistanceKm: ekvatorda 1° ≈ 111,2 km; referans yoksa sonsuz', () => {
    expect(greatCircleKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.195, 2)
    expect(greatCircleKm({ lat: 41, lon: 29 }, { lat: 41, lon: 29 })).toBe(0)
    const refs = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 3 },
    ]
    expect(nearestDistanceKm({ lat: 0, lon: 4 }, refs)).toBeCloseTo(111.195, 2)
    expect(nearestDistanceKm({ lat: 0, lon: 4 }, [])).toBe(Number.POSITIVE_INFINITY)
  })

  it('ringForDistance: sınır dahil; sınırların ötesi son halka (shared airportRing ile aynı)', () => {
    expect(ringForDistance(0, RINGS_KM)).toBe(1)
    expect(ringForDistance(500, RINGS_KM)).toBe(1)
    expect(ringForDistance(500.01, RINGS_KM)).toBe(2)
    expect(ringForDistance(2000, RINGS_KM)).toBe(3)
    expect(ringForDistance(5000.1, RINGS_KM)).toBe(5)
    expect(ringForDistance(Number.POSITIVE_INFINITY, RINGS_KM)).toBe(5)
    expect(ringForDistance(10, [])).toBe(1)
  })

  it('turkishReferencePoints: Türkiye, IATA kodlu büyük/orta/küçük alanlar (tarifesiz dahil)', () => {
    const points = turkishReferencePoints([
      row({ latitudeDeg: 1, iataCode: 'IST' }),
      row({ latitudeDeg: 2, iataCode: ' gkd ', type: 'small_airport', scheduledService: false }),
      row({ latitudeDeg: 3, iataCode: null }),
      row({ latitudeDeg: 4, iataCode: 'A1B' }),
      row({ latitudeDeg: 5, iataCode: 'HPX', type: 'heliport' }),
      row({ latitudeDeg: 6, iataCode: 'ATH', isoCountry: 'GR' }),
      row({ latitudeDeg: 7, iataCode: 'XXA', isoCountry: ' tr ' }),
    ])
    expect(points.map((p) => p.lat)).toEqual([1, 2, 7])
    // Kimlik listedeki kuralla: ICAO, yoksa GPS kodu, o da yoksa ident; IATA büyük harf.
    expect(points[1]).toEqual({
      lat: 2,
      lon: 28.7419,
      icao: 'LTFM',
      iata: 'GKD',
      name: 'Istanbul Airport',
    })
    const [byGps, byIdent] = turkishReferencePoints([
      row({ icaoCode: null, gpsCode: ' ltxa ', ident: 'TR-0001', name: ' Gökçeada Airport ' }),
      row({ icaoCode: null, gpsCode: null, ident: ' tr-0002 ' }),
    ])
    expect(byGps).toMatchObject({ icao: 'LTXA', name: 'Gökçeada Airport' })
    expect(byIdent?.icao).toBe('TR-0002')
    // Askerî hava üsleri (D-107) uzaklık referansı değildir.
    const civil = turkishReferencePoints([
      row({ ident: 'LTBL', icaoCode: 'LTBL', gpsCode: 'LTBL', iataCode: 'IGL' }),
      row({ ident: 'LTAG', icaoCode: null, gpsCode: ' ltag ', iataCode: 'UAB' }),
      row({ ident: 'LTBJ', icaoCode: 'LTBJ', gpsCode: 'LTBJ', iataCode: 'ADB' }),
    ])
    expect(civil.map((p) => p.icao)).toEqual(['LTBJ'])
  })

  it('nearestReference: en yakın referans ve uzaklığı; eşitlikte önce gelen; referans yoksa null', () => {
    const refs = [
      { lat: 0, lon: -1, id: 'west' },
      { lat: 0, lon: 1, id: 'east' },
      { lat: 0, lon: 3, id: 'far' },
    ]
    expect(nearestReference({ lat: 0, lon: 0 }, refs)?.reference.id).toBe('west')
    const near = nearestReference({ lat: 0, lon: 2.9 }, refs)
    expect(near?.reference.id).toBe('far')
    expect(near?.km).toBeCloseTo(11.12, 1)
    expect(nearestReference({ lat: 0, lon: 0 }, [])).toBeNull()
  })
})

/** Ekvatorda tek Türkiye referansı (0, 0): boylam farkı × 111,195 km. */
const EQUATOR_REFERENCE = { lat: 0, lon: 0, icao: 'LTFK', iata: 'GKD', name: 'Gökçeada Airport' }
const EQUATOR: RingContext = { turkey: [EQUATOR_REFERENCE], ringsKm: RINGS_KM }

const foreign = (overrides: Partial<AirportSourceRow>): AirportSourceRow =>
  row({
    isoCountry: 'GR',
    latitudeDeg: 0,
    municipality: null,
    ...overrides,
  })

describe('yurt dışı kayıtları', () => {
  it('toListedAirports: ülke kırpılıp büyük harfe çevrilir; halka ve tam km uzaklık', () => {
    const list = toListedAirports(
      [
        foreign({ ident: 'LGAV', icaoCode: 'LGAV', iataCode: 'ATH', longitudeDeg: 4 }),
        foreign({
          ident: 'EGLL',
          icaoCode: 'EGLL',
          iataCode: 'LHR',
          longitudeDeg: 10,
          isoCountry: ' gb ',
        }),
        // Türkiye satırı halka 0, uzaklık null (konumu ne olursa olsun).
        row({ longitudeDeg: 50, latitudeDeg: 0 }),
      ],
      EQUATOR,
    )
    expect(list.map((a) => [a.icao, a.country, a.ring, a.distanceToTrKm])).toEqual([
      ['LGAV', 'GR', 1, 445],
      ['LTFM', 'TR', 0, null],
      ['EGLL', 'GB', 3, 1112],
    ])
  })

  it('Türkiye referansı yoksa yurt dışı kaydı son halkada, uzaklığı null', () => {
    const [airport] = toListedAirports(
      [foreign({ ident: 'LGAV', icaoCode: 'LGAV', iataCode: 'ATH' })],
      { turkey: [], ringsKm: RINGS_KM },
    )
    expect(airport).toMatchObject({ ring: 5, distanceToTrKm: null })
  })

  it('selectListedAirports: Türkiye + açık halkadaki adaylar; aday kuralı ve halka süzgeci', () => {
    const rows = [
      row({ id: 1, ident: 'LTFM', icaoCode: 'LTFM', iataCode: 'IST' }),
      // Tarifesiz orta Türkiye havalimanı listelenir (bugünkü 61 kuralı).
      row({
        id: 2,
        ident: 'LTBA',
        icaoCode: 'LTBA',
        iataCode: 'ISL',
        type: 'medium_airport',
        scheduledService: false,
      }),
      foreign({ id: 3, ident: 'LGAV', icaoCode: 'LGAV', iataCode: 'ATH', longitudeDeg: 4 }),
      // 500 km'nin hemen ötesi: 2. halka.
      foreign({ id: 4, ident: 'LGTS', icaoCode: 'LGTS', iataCode: 'SKG', longitudeDeg: 4.6 }),
      // Aday değil: küçük havalimanı, tarifesiz orta havalimanı, IATA kodu bozuk.
      foreign({ id: 5, ident: 'LGXA', icaoCode: 'LGXA', iataCode: 'XAA', type: 'small_airport' }),
      foreign({
        id: 6,
        ident: 'LGXB',
        icaoCode: 'LGXB',
        iataCode: 'XBB',
        type: 'medium_airport',
        scheduledService: false,
      }),
      foreign({ id: 7, ident: 'LGXC', icaoCode: 'LGXC', iataCode: 'X1' }),
      // Yurt dışı orta, tarifeli: aday; 1. halkada.
      foreign({
        id: 8,
        ident: 'ORSU',
        icaoCode: 'ORSJ',
        iataCode: 'isu',
        type: 'medium_airport',
        longitudeDeg: -2,
        isoCountry: 'IQ',
      }),
    ]
    const ringOne = selectListedAirports(rows, { ...EQUATOR, enabledRing: 1 })
    expect(ringOne.map((a) => `${a.iata}/${a.icao}/${a.ring}`)).toEqual([
      'ATH/LGAV/1',
      'ISL/LTBA/0',
      'IST/LTFM/0',
      'ISU/ORSJ/1',
    ])
    const ringTwo = selectListedAirports(rows, { ...EQUATOR, enabledRing: 2 })
    expect(ringTwo.map((a) => a.icao)).toEqual(['LGAV', 'LTBA', 'LTFM', 'ORSJ', 'LGTS'])
    expect(ringTwo.find((a) => a.icao === 'LGTS')).toMatchObject({ ring: 2, distanceToTrKm: 511 })
    expect(selectListedAirports(rows, { ...EQUATOR, enabledRing: 0 }).map((a) => a.icao)).toEqual([
      'LTBA',
      'LTFM',
    ])
  })

  it('selectListedAirports: yurt dışı adayının kanonik ICAO’su dört karakter (D-101)', () => {
    const rows = [
      // ICAO, GPS kodu ve ident yedekleri; küçük harf ve boşluk kanonik koda düzelir.
      foreign({ id: 1, ident: 'LGAV', icaoCode: ' lgav ', gpsCode: null, iataCode: 'ATH' }),
      foreign({ id: 2, ident: 'GR-0001', icaoCode: null, gpsCode: 'LGKO', iataCode: 'KGS' }),
      foreign({ id: 3, ident: 'LGRP', icaoCode: null, gpsCode: null, iataCode: 'RHO' }),
      // Kihihi (UG-0002): icao_code ve gps_code yok, kimlik ident'tir; listeye girmez.
      foreign({ id: 4, ident: 'UG-0002', icaoCode: null, gpsCode: null, iataCode: 'KHX' }),
      foreign({ id: 5, ident: 'GR-0002', icaoCode: 'LGX', gpsCode: null, iataCode: 'XXA' }),
      foreign({ id: 6, ident: 'GR-0003', icaoCode: null, gpsCode: 'LGXYZ', iataCode: 'XXB' }),
      // Türkiye satırına ICAO koşulu uygulanmaz (liste kuralı, D-080).
      row({ id: 7, ident: 'TR-0042', icaoCode: null, gpsCode: null, iataCode: 'TRX' }),
    ]
    const selected = selectListedAirports(rows, { ...EQUATOR, enabledRing: 5 })
    expect(selected.map((a) => a.icao).sort()).toEqual(['LGAV', 'LGKO', 'LGRP', 'TR-0042'])
    // Ülke listesi (`toListedAirports`, `?country=UG`) ICAO koşulunu uygulamaz.
    expect(toListedAirports(rows, EQUATOR).map((a) => a.icao)).toContain('UG-0002')
  })

  it('selectListedAirports: savaş nedeniyle kapalı havalimanı tarifesiz de adaydır (D-110)', () => {
    const rows = [
      foreign({
        id: 1,
        ident: 'UKBB',
        icaoCode: 'UKBB',
        gpsCode: 'UKBB',
        iataCode: 'KBP',
        scheduledService: false,
      }),
      // GPS yedeği; küçük harf ve boşluk kanonik koda düzelir.
      foreign({
        id: 2,
        ident: 'UA-0001',
        icaoCode: null,
        gpsCode: ' ukll ',
        iataCode: 'LWO',
        type: 'medium_airport',
        scheduledService: false,
      }),
      // Tabloda olmayan tarifesiz orta havalimanı aday değildir (Poltava: kapanışın nedeni savaş değil).
      foreign({
        id: 3,
        ident: 'UKHP',
        icaoCode: 'UKHP',
        iataCode: 'PLV',
        type: 'medium_airport',
        scheduledService: false,
      }),
      // Tabloda olsa da küçük alan ve IATA kodu olmayan satır aday değildir.
      foreign({
        id: 4,
        ident: 'UKOO',
        icaoCode: 'UKOO',
        iataCode: 'ODS',
        type: 'small_airport',
        scheduledService: false,
      }),
      foreign({ id: 5, ident: 'UKKK', icaoCode: 'UKKK', iataCode: null, scheduledService: false }),
    ]
    const selected = selectListedAirports(rows, { ...EQUATOR, enabledRing: 5 })
    expect(selected.map((a) => a.icao).sort()).toEqual(['UKBB', 'UKLL'])
    // `scheduled` OurAirports değeridir (API sözleşmesi değişmez, D-090): uçuş evresinin merkeze
    // göre kuralları kullanmaz (pist hizası kuralı kullanır).
    expect(selected.every((a) => !a.scheduled)).toBe(true)
    // Halka süzgeci geçerlidir.
    expect(selectListedAirports(rows, { ...EQUATOR, enabledRing: 0 })).toEqual([])
    // Tablo shared'in `CIVIL_FLIGHT_CLOSURES` anahtarlarıdır (apps/api rings.test.ts eşitliği denetler).
    expect(CIVIL_FLIGHT_CLOSURE_ICAOS).toHaveLength(35)
    expect(CIVIL_FLIGHT_CLOSURE_ICAOS).toEqual(CIVIL_FLIGHT_CLOSURE_ICAOS.toSorted())
  })

  it('toAirportDetails: yurt dışı kaydı ülke, halka, uzaklık ve uzaklığın ölçüldüğü Türkiye havalimanını taşır', () => {
    const [detail] = toAirportDetails(
      [
        {
          ...foreign({ id: 3, ident: 'LCEN', icaoCode: 'LCEN', iataCode: 'ECN', longitudeDeg: 2 }),
          isoCountry: 'CY',
          isoRegion: 'CY-02',
          updatedAt: new Date('2026-10-01T23:03:00Z'),
        },
      ],
      [],
      [],
      EQUATOR,
    )
    expect(detail).toMatchObject({
      icao: 'LCEN',
      country: 'CY',
      ring: 1,
      distanceToTrKm: 222,
      // Uzaklık listelenmeyen küçük alana da ölçülebilir (Gökçeada; D-080).
      nearestTr: { icao: 'LTFK', iata: 'GKD', name: 'Gökçeada Airport' },
      isoRegion: 'CY-02',
      station: null,
    })
  })
})

describe('adres takma adı (D-109)', () => {
  it('identAlias: dört karakterli, kanonik ICAO’dan farklı, çakışmasız ident', () => {
    const none = new Set<string>()
    const uzss = { ident: 'UTSS', icaoCode: 'UZSS', gpsCode: 'UZSS' }
    expect(identAlias(uzss, none)).toBe('UTSS')
    expect(identAlias({ ...uzss, ident: ' utss ' }, none)).toBe('UTSS')
    // Rakamlı kimlik de (Rewa VA1G → VERW).
    expect(identAlias({ ident: 'VA1G', icaoCode: 'VERW', gpsCode: 'VERW' }, none)).toBe('VA1G')
    // Kimlik kanonik ICAO'ysa ya da dört karakter değilse takma ad yok.
    expect(identAlias({ ident: 'LTFM', icaoCode: 'LTFM', gpsCode: 'LTFM' }, none)).toBeNull()
    expect(identAlias({ ident: 'BZ-CUK', icaoCode: 'MZCK', gpsCode: 'MZCK' }, none)).toBeNull()
    expect(identAlias({ ident: 'AXF', icaoCode: 'ZBAL', gpsCode: 'ZBAL' }, none)).toBeNull()
    expect(identAlias({ ident: 'CN-0079', icaoCode: 'ZGSG', gpsCode: 'ZGSG' }, none)).toBeNull()
    // Kanonik ICAO'su ident olan satır (icao_code ve gps_code boş) takma ad taşımaz.
    expect(identAlias({ ident: 'UG-0002', icaoCode: null, gpsCode: null }, none)).toBeNull()
    // İskenderiye: kaynak düzeltmesiyle kanonik ICAO ident'tir (HEBA).
    expect(identAlias({ ident: 'HEBA', icaoCode: 'HEAX', gpsCode: 'HEAX' }, none)).toBeNull()
    // Başka bir satırın kanonik ICAO'su olan kimlik takma ad değildir: eldeki satırlardan ya da
    // veritabanında olmayan satırlardan (WABP Burumeso ID-0394, WIOD Singkawang ID-0290, WRLB
    // Dagai ID-0041).
    expect(identAlias(uzss, new Set(['UTSS']))).toBeNull()
    expect(IDENT_ALIAS_EXCLUSIONS).toEqual(['WABP', 'WIOD', 'WRLB'])
    expect(identAlias({ ident: 'WABP', icaoCode: 'WAYY', gpsCode: 'WAYY' }, none)).toBeNull()
    expect(identAlias({ ident: 'WIOD', icaoCode: 'WIKT', gpsCode: 'WIKT' }, none)).toBeNull()
    expect(identAlias({ ident: 'WRLB', icaoCode: 'WAQJ', gpsCode: 'WAQJ' }, none)).toBeNull()
  })

  it('identAliasExclusionCensus: içe aktarılan satırın kimliği başka bir satırın kanonik ICAO’suysa', () => {
    // 2026-10-01'in üç örneği, eş satırları içe aktarılmaz (kanonik ICAO: icao_code, gps_code).
    expect(
      identAliasExclusionCensus([
        { ident: 'WRLB', icaoCode: 'WAQJ', gpsCode: 'WAQJ', imported: true },
        { ident: 'ID-0041', icaoCode: null, gpsCode: 'WRLB', imported: false },
        { ident: 'WABP', icaoCode: 'WAYY', gpsCode: 'WAYY', imported: true },
        { ident: 'ID-0394', icaoCode: 'WABP', gpsCode: 'WABP', imported: false },
        { ident: 'WIOD', icaoCode: 'WIKT', gpsCode: 'WIKT', imported: true },
        { ident: 'ID-0290', icaoCode: 'WIOD', gpsCode: 'WIOD', imported: false },
        // Takma ad (çakışmasız), kimliği kanonik ICAO olan satır ve içe aktarılmayan satır sayılmaz.
        { ident: 'UTSS', icaoCode: 'UZSS', gpsCode: 'UZSS', imported: true },
        { ident: 'LTFM', icaoCode: 'LTFM', gpsCode: 'LTFM', imported: true },
        { ident: 'XXAA', icaoCode: 'XXBB', gpsCode: null, imported: false },
        { ident: 'XX-1', icaoCode: 'XXAA', gpsCode: null, imported: true },
      ]),
    ).toEqual(['WABP', 'WIOD', 'WRLB'])
    // Eş satır içe aktarılsa da sayılır (listede durması zararsız); kimlik kendi ICAO'suysa sayılmaz.
    expect(
      identAliasExclusionCensus([
        { ident: 'ABCD', icaoCode: 'WXYZ', gpsCode: null, imported: true },
        { ident: 'QQ-1', icaoCode: 'ABCD', gpsCode: null, imported: true },
      ]),
    ).toEqual(['ABCD'])
    expect(
      identAliasExclusionCensus([
        { ident: 'HEBA', icaoCode: 'HEAX', gpsCode: 'HEAX', imported: true },
      ]),
    ).toEqual([])
  })

  it('liste ve tek havalimanı aynı satırlarla denetler: başka satırın ICAO’su olan kimlik hiçbir yolda takma ad değil', async () => {
    // X: yurt dışı aday, kimliği ABCD, ICAO'su WXYZ. Y: küçük tarifeli havalimanı, ICAO'su ABCD
    // (aday değil; liste onu göstermez ama veritabanının takma ad denetimi onu görür).
    const x = detailRow({
      id: 1,
      ident: 'ABCD',
      icaoCode: 'WXYZ',
      gpsCode: 'WXYZ',
      iataCode: 'XYZ',
      isoCountry: 'GR',
      latitudeDeg: 37.9,
      longitudeDeg: 23.9,
    })
    const y = detailRow({
      id: 2,
      ident: 'GR-0001',
      type: 'small_airport',
      icaoCode: 'ABCD',
      gpsCode: 'ABCD',
      iataCode: 'QQQ',
      isoCountry: 'GR',
      latitudeDeg: 38.1,
      longitudeDeg: 24.1,
    })
    const rows = [x, y]
    const listedX = withDetails(rows, [], []).find((a) => a.icao === 'WXYZ')
    expect(listedX?.icao).toBe('WXYZ')
    expect(Object.hasOwn(listedX ?? {}, 'identAlias')).toBe(false)
    expect(await findAirportInRows(rows, [], [], 'ABCD', CONTEXT)).toMatchObject({ icao: 'ABCD' })
    for (const code of ['WXYZ', 'xyz']) {
      const found = await findAirportInRows(rows, [], [], code, CONTEXT)
      expect(found?.icao, code).toBe('WXYZ')
      expect(Object.hasOwn(found ?? {}, 'identAlias'), code).toBe(false)
    }
    // Y tarifesizse (`listedFilter`'e girmez, veritabanında da denetlenmez) iki yol da takma adı
    // verir; böyle bir eş satırı `IDENT_ALIAS_EXCLUSIONS` tutar.
    const unscheduled = [x, { ...y, scheduledService: false }]
    expect(withDetails(unscheduled, [], []).find((a) => a.icao === 'WXYZ')).toMatchObject({
      identAlias: 'ABCD',
    })
    expect(await findAirportInRows(unscheduled, [], [], 'ABCD', CONTEXT)).toMatchObject({
      icao: 'WXYZ',
      identAlias: 'ABCD',
    })
    expect(await findAirportInRows(unscheduled, [], [], 'WXYZ', CONTEXT)).toMatchObject({
      identAlias: 'ABCD',
    })
  })

  it('rowMatchesCode: ICAO, GPS kodu, ident ya da IATA; kırpılır ve büyük harfe çevrilir', () => {
    const uzss = row({ ident: 'UTSS', icaoCode: 'UZSS', gpsCode: ' uzss ', iataCode: 'SKD' })
    for (const code of ['UZSS', 'uzss', 'UTSS', ' utss ', 'SKD']) {
      expect(rowMatchesCode(uzss, code), code).toBe(true)
    }
    expect(rowMatchesCode(uzss, 'UZS')).toBe(false)
    expect(rowMatchesCode(row({ icaoCode: null, gpsCode: null, iataCode: null }), '')).toBe(false)
  })

  it('ayrıntı kaydı takma adı taşır; yoksa alan yazılmaz', () => {
    const details = withDetails(
      [
        detailRow({
          id: 1,
          ident: 'UTSS',
          icaoCode: 'UZSS',
          gpsCode: 'UZSS',
          iataCode: 'SKD',
          isoCountry: 'UZ',
        }),
        detailRow({ id: 2 }),
      ],
      [],
      [],
    )
    const samarkand = details.find((a) => a.icao === 'UZSS')
    const istanbul = details.find((a) => a.icao === 'LTFM')
    expect(samarkand).toMatchObject({ icao: 'UZSS', identAlias: 'UTSS' })
    expect(istanbul?.icao).toBe('LTFM')
    expect(Object.hasOwn(istanbul ?? {}, 'identAlias')).toBe(false)
  })
})

describe('kaynak düzeltmeleri (D-088)', () => {
  it('ourAirportsIcao: İskenderiye HEAX → HEBA yalnız kaynaktaki yanlış değer durdukça', () => {
    expect(OURAIRPORTS_ICAO_CORRECTIONS).toEqual({ HEBA: { icaoCode: 'HEAX', icao: 'HEBA' } })
    const alexandria = { ident: 'HEBA', icaoCode: 'HEAX', gpsCode: 'HEAX' }
    expect(ourAirportsIcao(alexandria)).toBe('HEBA')
    expect(ourAirportsIcao({ ident: ' heba ', icaoCode: ' heax ', gpsCode: null })).toBe('HEBA')
    // OurAirports düzeltirse ya da başka bir koda geçerse düzeltme uygulanmaz.
    expect(ourAirportsIcao({ ...alexandria, icaoCode: 'HEBA' })).toBe('HEBA')
    expect(ourAirportsIcao({ ...alexandria, icaoCode: 'HEZZ' })).toBe('HEZZ')
    // Başka satırda HEAX olduğu gibi kalır.
    expect(ourAirportsIcao({ ident: 'EG-0078', icaoCode: 'HEAX', gpsCode: null })).toBe('HEAX')
    expect(ourAirportsIcao({ ident: 'toString', icaoCode: null, gpsCode: null })).toBe('TOSTRING')

    const egypt = {
      isoCountry: 'EG',
      latitudeDeg: 30.93249,
      longitudeDeg: 29.696437,
      municipality: 'Alexandria',
    }
    const list = listed([
      row({ ...egypt, ident: 'HEBA', icaoCode: 'HEAX', gpsCode: 'HEAX', iataCode: 'HBE' }),
    ])
    expect(list.map((a) => [a.iata, a.icao])).toEqual([['HBE', 'HEBA']])
  })

  it('cleanAirportName: ad kırpılır, art arda boşluk teke iner (Bacău)', () => {
    expect(cleanAirportName(' Bacău George Enescu International  Airport ')).toBe(
      'Bacău George Enescu International Airport',
    )
    const [bacau] = listed([
      row({
        ident: 'LRBC',
        icaoCode: 'LRBC',
        iataCode: 'BCM',
        isoCountry: 'RO',
        name: 'Bacău George Enescu International  Airport',
      }),
    ])
    expect(bacau?.name).toBe('Bacău George Enescu International Airport')
    const [reference] = turkishReferencePoints([
      row({ ident: 'LTFK', icaoCode: 'LTFK', iataCode: 'GKD', name: ' Gökçeada\tAirport ' }),
    ])
    expect(reference?.name).toBe('Gökçeada Airport')
  })

  it('cleanAirportName: tek başına duran küçük harfli "airport" "Airport" olur (D-090)', () => {
    expect(cleanAirportName('Bastia-Poretta International airport')).toBe(
      'Bastia-Poretta International Airport',
    )
    expect(cleanAirportName(' Aurillac  airport ')).toBe('Aurillac Airport')
    // Sözcüğün parçası ve zaten büyük harfli ad değişmez.
    expect(cleanAirportName('Airportville airfield')).toBe('Airportville airfield')
    expect(cleanAirportName('Sea-Airport Cuxhaven/Nordholz')).toBe('Sea-Airport Cuxhaven/Nordholz')
    expect(cleanAirportName('EuroAirport Basel–Mulhouse–Freiburg')).toBe(
      'EuroAirport Basel–Mulhouse–Freiburg',
    )
    expect(cleanAirportName('Heliairport x')).toBe('Heliairport x')
    const [bastia] = listed([
      row({
        ident: 'LFKB',
        icaoCode: 'LFKB',
        iataCode: 'BIA',
        isoCountry: 'FR',
        name: 'Bastia-Poretta International airport',
      }),
    ])
    expect(bastia?.name).toBe('Bastia-Poretta International Airport')
  })

  it('boş yinelenen pist satırı gösterilmez; doldurulursa görünür (genel kural, D-088, D-109)', () => {
    const taba = detailRow({
      id: 3150,
      ident: 'HETB',
      icaoCode: 'HETB',
      gpsCode: 'HETB',
      iataCode: 'TCP',
      isoCountry: 'EG',
      isoRegion: 'EG-JS',
    })
    const real = runwayRow({ id: 235597, airportId: 3150, leIdent: '04L', heIdent: '22R' })
    const ghost = runwayRow({
      id: 260339,
      airportId: 3150,
      lengthFt: null,
      widthFt: null,
      surface: 'UNK',
      lighted: false,
      // Uç koordinatı yok: içe aktarım eşiği havalimanı merkezine (ARP) düşürür.
      leIdent: '04',
      leTrueBearingDeg: null,
      leThresholdLat: 29.587778,
      leThresholdLon: 34.778056,
      heIdent: '22',
      heTrueBearingDeg: null,
      heThresholdLat: 29.587778,
      heThresholdLon: 34.778056,
      leLatitudeDeg: null,
      heLatitudeDeg: null,
    })
    expect(isEmptyRunway(ghost)).toBe(true)
    expect(isEmptyRunway(real)).toBe(false)
    // Satır kuralları boş satırı tek başına gizlemez: kural havalimanının öbür satırlarına bakar.
    expect(isHiddenRunway(ghost)).toBe(false)
    expect(visibleRunways([real, ghost]).map((r) => r.id)).toEqual([235597])
    const [detail] = withDetails([taba], [real, ghost], [])
    expect(detail?.runways.map((r) => r.id)).toEqual([235597])
    // Kaynak satırı doldurursa (uzunluk, genişlik ya da uç koordinatı), pist yeniden görünür.
    for (const filled of [
      { ...ghost, lengthFt: 13_123 },
      { ...ghost, widthFt: 148 },
      { ...ghost, leLatitudeDeg: 29.6 },
      { ...ghost, heLatitudeDeg: 29.6 },
    ]) {
      expect(isEmptyRunway(filled)).toBe(false)
      expect(withDetails([taba], [real, filled], [])[0]?.runways).toHaveLength(2)
    }
    // Havalimanının tek bilgisi boş satırsa gösterilir (pist var, ölçüsü bilinmiyor); öbür satırın
    // uzunluğu yoksa da.
    expect(visibleRunways([ghost])).toEqual([ghost])
    expect(visibleRunways([ghost, { ...real, lengthFt: null }])).toHaveLength(2)
    // Başka havalimanının pisti sayılmaz.
    expect(visibleRunways([{ ...real, airportId: 1 }, ghost])).toHaveLength(2)
    // Satır kurallarıyla gizlenen uzun satır (karşı ucu yok) boş satırı gizletmez.
    expect(visibleRunways([{ ...real, heIdent: null }, ghost])).toEqual([ghost])
  })

  it('karşı ucu olmayan satır pist sayılmaz: Stuttgart helikopter alanları (D-090)', () => {
    const stuttgart = detailRow({
      id: 2222,
      ident: 'EDDS',
      icaoCode: 'EDDS',
      gpsCode: 'EDDS',
      iataCode: 'STR',
      isoCountry: 'DE',
      isoRegion: 'DE-BW',
    })
    const main = runwayRow({ id: 233000, airportId: 2222, leIdent: '07', heIdent: '25' })
    const helipad = (id: number, ident: string) =>
      runwayRow({
        id,
        airportId: 2222,
        lengthFt: 98,
        widthFt: 98,
        surface: 'ASPH',
        leIdent: ident,
        heIdent: null,
        heTrueBearingDeg: null,
        heDisplacedThresholdFt: null,
        heThresholdLat: null,
        heThresholdLon: null,
        heLatitudeDeg: null,
      })
    const north = helipad(608377, 'H-NORTH')
    const south = helipad(608378, 'H-SOUTH')
    expect(isHiddenRunway(north)).toBe(true)
    expect(isHiddenRunway({ ...south, heIdent: '  ' })).toBe(true)
    expect(isHiddenRunway(main)).toBe(false)
    const [detail] = withDetails([stuttgart], [main, north, south], [])
    expect(detail?.runways.map((r) => r.id)).toEqual([233000])
  })

  it('Voronej 18/36 ve Linz 07H/25H boş satırları gizli (D-090)', () => {
    const real = runwayRow({ id: 1, airportId: 7, leIdent: '12', heIdent: '30' })
    const empty = (id: number, le: string, he: string) =>
      runwayRow({
        id,
        airportId: 7,
        lengthFt: null,
        widthFt: null,
        surface: 'GRS',
        lighted: false,
        leIdent: le,
        heIdent: he,
        leTrueBearingDeg: null,
        heTrueBearingDeg: null,
        leLatitudeDeg: null,
        heLatitudeDeg: null,
      })
    expect(visibleRunways([real, empty(608245, '18', '36')])).toEqual([real])
    expect(visibleRunways([real, empty(504922, '07H', '25H')])).toEqual([real])
    expect(visibleRunways([real, { ...empty(608245, '18', '36'), lengthFt: 3000 }])).toHaveLength(2)
  })
})

describe('4. halka pist kuralları (D-101)', () => {
  it('Hassi Messaoud 01/19, Beauvais 13R/31L ve Bujumbura 02/20 boş satırları gizli', () => {
    const real = runwayRow({ id: 1, airportId: 9, leIdent: '18', heIdent: '36' })
    const empty = (id: number, le: string, he: string) =>
      runwayRow({
        id,
        airportId: 9,
        lengthFt: null,
        widthFt: null,
        surface: 'UNK',
        lighted: false,
        leIdent: le,
        heIdent: he,
        leTrueBearingDeg: null,
        heTrueBearingDeg: null,
        leLatitudeDeg: null,
        heLatitudeDeg: null,
      })
    for (const [id, le, he] of [
      [260338, '01', '19'],
      [260344, '13R', '31L'],
      [260310, '02', '20'],
    ] as const) {
      expect(visibleRunways([real, empty(id, le, he)]), String(id)).toEqual([real])
      expect(
        visibleRunways([real, { ...empty(id, le, he), widthFt: 148 }]),
        String(id),
      ).toHaveLength(2)
    }
  })

  it('100 ft’ten kısa kayıtlı uzunluk pist değildir (Pamplona 03/21, 2 ft); uzunluğu bilinmeyen satır bu kuralla gizlenmez', () => {
    expect(MIN_RUNWAY_LENGTH_FT).toBe(100)
    const pamplona = runwayRow({
      id: 260341,
      lengthFt: 2,
      widthFt: null,
      surface: 'UNK',
      leIdent: '03',
      heIdent: '21',
    })
    expect(isHiddenRunway(pamplona)).toBe(true)
    expect(isHiddenRunway({ ...pamplona, lengthFt: 99 })).toBe(true)
    expect(isHiddenRunway({ ...pamplona, lengthFt: 100 })).toBe(false)
    expect(isHiddenRunway({ ...pamplona, lengthFt: null })).toBe(false)
    // Bovanenkovo'nun (USDB) 722 ft'lik iki uçlu helikopter şeridi pisttir.
    expect(
      isHiddenRunway(runwayRow({ id: 526934, lengthFt: 722, leIdent: '10H', heIdent: '28H' })),
    ).toBe(false)
  })
})

describe('5. halka pist kuralları (D-109)', () => {
  it('OurAirports düzenleyicisinin silme işareti gizlenir, satır dolu olsa da (Hamilton NZHN)', () => {
    expect(RUNWAY_TOMBSTONE_SURFACE.source).toBe('^\\s*delete')
    expect(RUNWAY_TOMBSTONE_SURFACE.flags).toBe('i')
    const duplicate = runwayRow({ id: 238057, surface: 'Delete duplicate', lengthFt: 2033 })
    expect(isHiddenRunway(duplicate)).toBe(true)
    expect(isHiddenRunway({ ...duplicate, surface: ' DELETE ' })).toBe(true)
    expect(isHiddenRunway({ ...duplicate, surface: 'ASP' })).toBe(false)
    // "DELETE" yalnız başta: kaplama adının içinde geçen sözcük işaret değildir.
    expect(isHiddenRunway({ ...duplicate, surface: 'ASP (to delete)' })).toBe(false)
  })

  it('karşı ucu olmayan uzun satır da gizli kalır (Langzhong ZULA, D-090)', () => {
    const zula = runwayRow({
      id: 354841,
      lengthFt: 11_811,
      surface: 'ASP',
      leIdent: null,
      heIdent: null,
    })
    expect(isHiddenRunway(zula)).toBe(true)
    expect(visibleRunways([zula])).toEqual([])
  })
})

/**
 * Commit'li OurAirports fixture'ı (tools/fixtures/README.md): Türkiye, on uzak havalimanı (iki
 * dışlama örneği LFPB ve FATH dahil) ve 1.–5. halka. İçe aktarım süzgeci (data-sources.md §3)
 * uygulanır; pistlerden kapalılar alınmaz. Dosyalar test dosyası başına bir kez ayrıştırılır (D-109).
 */
const FIXTURE_DIR = new URL('../../../tools/fixtures/ourairports/', import.meta.url)

/** RFC 4180 CSV (bütün alanlar tırnaklı, `""` kaçışlı tırnak). */
function readFixtureCsv(name: string): Map<string, string>[] {
  const text = readFileSync(new URL(name, FIXTURE_DIR), 'utf8')
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      record.push(field)
      field = ''
    } else if (c === '\n') {
      record.push(field)
      records.push(record)
      record = []
      field = ''
    } else field += c
  }
  const [header = [], ...body] = records
  return body.map((cells) => new Map(header.map((column, i) => [column, cells[i] ?? ''])))
}

const text = (value: string | undefined): string | null =>
  value === undefined || value.trim() === '' ? null : value
const number = (value: string | undefined): number | null =>
  text(value) === null ? null : Number(value)

const fixtureAirports: AirportDetailSourceRow[] = readFixtureCsv('airports.csv')
  .filter(
    (r) =>
      r.get('type') === 'large_airport' ||
      r.get('type') === 'medium_airport' ||
      r.get('scheduled_service') === 'yes' ||
      (r.get('iso_country') === 'TR' && /^[A-Z]{3}$/.test(r.get('iata_code') ?? '')),
  )
  .map((r) => ({
    id: Number(r.get('id')),
    ident: r.get('ident') ?? '',
    type: r.get('type') ?? '',
    name: r.get('name') ?? '',
    latitudeDeg: Number(r.get('latitude_deg')),
    longitudeDeg: Number(r.get('longitude_deg')),
    elevationFt: number(r.get('elevation_ft')),
    isoCountry: r.get('iso_country') ?? '',
    isoRegion: r.get('iso_region') ?? '',
    municipality: text(r.get('municipality')),
    scheduledService: r.get('scheduled_service') === 'yes',
    icaoCode: text(r.get('icao_code')),
    iataCode: text(r.get('iata_code')),
    gpsCode: text(r.get('gps_code')),
    updatedAt: new Date('2026-10-01T23:03:49Z'),
  }))
const imported = new Set(fixtureAirports.map((a) => a.id))
const fixtureRunways: RunwaySourceRow[] = readFixtureCsv('runways.csv')
  .filter((r) => r.get('closed') !== '1' && imported.has(Number(r.get('airport_ref'))))
  .map((r) => ({
    ...runwayRow(),
    id: Number(r.get('id')),
    airportId: Number(r.get('airport_ref')),
    lengthFt: number(r.get('length_ft')),
    widthFt: number(r.get('width_ft')),
    surface: text(r.get('surface')),
    lighted: r.get('lighted') === '1',
    leIdent: text(r.get('le_ident')),
    heIdent: text(r.get('he_ident')),
    leLatitudeDeg: number(r.get('le_latitude_deg')),
    heLatitudeDeg: number(r.get('he_latitude_deg')),
  }))
/** Bütün halkalar açık bağlam (5. halka, D-109): uygulamada açık halka hâlâ 4'tür. */
const fixtureContext: ListingContext = {
  turkey: turkishReferencePoints(fixtureAirports),
  ringsKm: RINGS_KM,
  enabledRing: 5,
}
const listedRing5 = selectListedAirports(fixtureAirports, fixtureContext)
const listedRing4 = selectListedAirports(fixtureAirports, { ...fixtureContext, enabledRing: 4 })
const listedRing5Icaos = new Set(listedRing5.map((a) => a.icao))
const fixtureDetails = toAirportDetails(fixtureAirports, fixtureRunways, [], fixtureContext).filter(
  (a) => listedRing5Icaos.has(a.icao),
)

describe('fixture: 4. halka açıkken liste ve pistler (D-101; uygulamada M6i.2’den beri açık, D-102)', () => {
  const context: ListingContext = { ...fixtureContext, enabledRing: 4 }

  it('56 + 77 + 104 + 283 + 720 = 1.240 (savaş nedeniyle kapalı 23 havalimanıyla, D-110); askerî üsler (D-107) ve UG-0002 (KHX) listede yok, her ICAO dört karakter', () => {
    expect(listedRing4).toHaveLength(1240)
    expect(listedRing4.filter((a) => a.country === 'TR')).toHaveLength(56)
    for (const icao of MILITARY_AIRFIELD_ICAOS) {
      expect(
        listedRing4.map((a) => a.icao),
        icao,
      ).not.toContain(icao)
    }
    for (const iata of ['UAB', 'AFY', 'BDM', 'ESK', 'IGL']) {
      expect(
        listedRing4.map((a) => a.iata),
        iata,
      ).not.toContain(iata)
    }
    // Ülke listesi (`?country=TR`) de üssüzdür; uzaklık referansında da üs yoktur.
    const turkey = toListedAirports(
      fixtureAirports.filter((a) => a.isoCountry === 'TR'),
      context,
    )
    expect(turkey).toHaveLength(56)
    expect(context.turkey).toHaveLength(61)
    expect(context.turkey.filter((r) => MILITARY_AIRFIELD_ICAOS.includes(r.icao))).toEqual([])
    const foreign = listedRing4.filter((a) => a.country !== 'TR')
    expect(foreign).toHaveLength(1184)
    expect([1, 2, 3, 4].map((ring) => foreign.filter((a) => a.ring === ring).length)).toEqual([
      77, 104, 283, 720,
    ])
    // OurAirports'ta tarifesiz 23 havalimanı kapanış tablosuyla listededir (D-110).
    const unscheduled = foreign.filter((a) => !a.scheduled).map((a) => a.icao)
    expect(unscheduled).toHaveLength(23)
    for (const icao of unscheduled) expect(CIVIL_FLIGHT_CLOSURE_ICAOS, icao).toContain(icao)
    expect(foreign.filter((a) => CIVIL_FLIGHT_CLOSURE_ICAOS.includes(a.icao))).toHaveLength(35)
    for (const airport of listedRing4) expect(airport.icao).toMatch(/^[A-Z0-9]{4}$/)
    expect(listedRing4.map((a) => a.icao)).not.toContain('UG-0002')
    expect(listedRing4.map((a) => a.iata)).not.toContain('KHX')
    // ICAO koşulu olmasa KHX de aday olurdu: 4. halkadadır ve ülke listesinde görünür.
    const uganda = toListedAirports(
      fixtureAirports.filter((a) => a.isoCountry === 'UG'),
      context,
    )
    expect(uganda.find((a) => a.iata === 'KHX')).toMatchObject({ icao: 'UG-0002', ring: 4 })
    expect(listedRing4.filter((a) => a.country === 'UG')).toHaveLength(4)
    // Açık halka 3'te liste 498'di (M6h–M6i.1, D-090; D-107'den önce 503); kapanış tablosunun 1.–3.
    // halkadaki 22 tarifesiz kaydıyla 520 olurdu (D-110).
    expect(selectListedAirports(fixtureAirports, { ...context, enabledRing: 3 })).toHaveLength(520)
  })

  it('üsler uzaklık referansından çıkınca halka üyeliği değişmez; en yakın Türkiye havalimanı yalnız dört yerde Çiğli yerine sivil alan olur (D-107)', () => {
    // D-107'den önceki referans: 61 nokta + beş üs (66).
    const bases = fixtureAirports
      .filter((a) => a.isoCountry === 'TR')
      .filter((a) => MILITARY_AIRFIELD_ICAOS.includes(ourAirportsIcao(a)))
      .map((a) => ({
        lat: a.latitudeDeg,
        lon: a.longitudeDeg,
        icao: ourAirportsIcao(a),
        iata: a.iataCode ?? '',
        name: cleanAirportName(a.name),
      }))
    expect(bases.map((b) => b.icao).sort()).toEqual(['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'])
    const before: ListingContext = { ...context, turkey: [...context.turkey, ...bases] }
    const all = { ...context, enabledRing: 5 }
    const now = toAirportDetails(fixtureAirports, [], [], all).filter((a) => a.country !== 'TR')
    // Ayrıntı kaydı halka süzgeci uygulamaz: bütün adaylar (1.–5. halka) karşılaştırılır.
    const old = new Map(toAirportDetails(fixtureAirports, [], [], before).map((a) => [a.icao, a]))
    expect(now.length).toBeGreaterThan(3187)
    const ringChanges = now.filter((a) => old.get(a.icao)?.ring !== a.ring)
    expect(ringChanges).toEqual([])
    expect(selectListedAirports(fixtureAirports, all)).toHaveLength(
      selectListedAirports(fixtureAirports, { ...before, enabledRing: 5 }).length,
    )
    const nearestChanges = now
      .filter((a) => old.get(a.icao)?.nearestTr?.icao !== a.nearestTr?.icao)
      .map((a) => [
        a.icao,
        old.get(a.icao)?.nearestTr?.iata,
        old.get(a.icao)?.distanceToTrKm,
        a.nearestTr?.iata,
        a.distanceToTrKm,
        a.ring,
      ])
    expect(nearestChanges.sort()).toEqual([
      ['HLLM', 'IGL', 1386, 'GKD', 1386, 3],
      ['LGAV', 'IGL', 275, 'ADB', 284, 1],
      ['LGHI', 'IGL', 78, 'ADB', 89, 1],
      ['LGKL', 'IGL', 466, 'ADB', 472, 1],
    ])
    // Hiçbir kaydın en yakını üs değildir.
    for (const airport of now) {
      expect(MILITARY_AIRFIELD_ICAOS, airport.icao).not.toContain(airport.nearestTr?.icao)
    }
  })

  it('görünür pisti olmayan listelenen havalimanları boş pist listesiyle gelir (GMAZ, ULDD, VIMB, VOVI, ZWTK ve UBLC)', () => {
    const details = fixtureDetails.filter((a) => a.ring <= 4)
    expect(details).toHaveLength(1240)
    const withoutRunways = details.filter((a) => a.runways.length === 0).map((a) => a.icao)
    expect(withoutRunways.sort()).toEqual(['GMAZ', 'UBLC', 'ULDD', 'VIMB', 'VOVI', 'ZWTK'])
    for (const icao of withoutRunways) {
      const detail = details.find((a) => a.icao === icao)
      expect(detail?.runways, icao).toEqual([])
      expect(detail?.dataUpdatedAt, icao).toBe('2026-10-01T23:03:49.000Z')
    }
  })
})

describe('fixture: 5. halka açık bağlamla (D-109; uygulamada halka 4)', () => {
  it("56 + 77 + 104 + 283 + 720 + 2.026 = 3.266 (D-110'dan önce 3.243); dışlananlar listede yok", () => {
    expect(listedRing5).toHaveLength(3266)
    expect(
      [0, 1, 2, 3, 4, 5].map((ring) => listedRing5.filter((a) => a.ring === ring).length),
    ).toEqual([56, 77, 104, 283, 720, 2026])
    expect(listedRing5.filter((a) => a.country !== 'TR')).toHaveLength(3210)
    // Dört karakterli ICAO kuralı (D-101: Aleknagik 5A8/WKK, Kihihi UG-0002/KHX, Leshan
    // CN-0249/LSG), askerî liste (D-109: Wake PWAK/AWK, Oakey YBOK/OKY, Kwajalein PKWA/KWA) ve aday
    // olmayan iki dışlama örneği (Paris-Le Bourget LFPB/LBG tarifesiz; Thohoyandou FATH/THY küçük,
    // içe aktarılmaz).
    const icaos = listedRing5.map((a) => a.icao)
    const iatas = listedRing5.map((a) => a.iata)
    for (const icao of ['5A8', 'UG-0002', 'CN-0249', 'PWAK', 'YBOK', 'PKWA', 'LFPB', 'FATH']) {
      expect(icaos, icao).not.toContain(icao)
    }
    for (const iata of ['WKK', 'KHX', 'LSG', 'AWK', 'OKY', 'KWA', 'LBG', 'THY']) {
      expect(iatas, iata).not.toContain(iata)
    }
    for (const airport of listedRing5) expect(airport.icao).toMatch(/^[A-Z0-9]{4}$/)
    // Le Bourget içe aktarılır (büyük havalimanı) ve ülke listesinde görünür; Thohoyandou hiç yoktur.
    const france = toListedAirports(
      fixtureAirports.filter((a) => a.isoCountry === 'FR'),
      fixtureContext,
    )
    expect(france.find((a) => a.iata === 'LBG')).toMatchObject({ icao: 'LFPB', scheduled: false })
    expect(fixtureAirports.some((a) => a.ident === 'FATH')).toBe(false)
    // Askerî alanlar ülke listesinde de yoktur.
    const marshall = toListedAirports(
      fixtureAirports.filter((a) => a.isoCountry === 'MH'),
      fixtureContext,
    )
    expect(marshall.map((a) => a.icao)).not.toContain('PKWA')
  })

  it("boş yinelenen satır kuralı tablodaki yedi satırı, 5. halkanın 13 satırını ve Simferopol'ünkünü tutar; silme işareti NZHN 238057 ve 260389", () => {
    const measured = new Set(
      fixtureRunways
        .filter((r) => !isHiddenRunway(r) && r.lengthFt !== null)
        .map((r) => r.airportId),
    )
    // Karşı ucu olan boş satırlar (Ponta Porã'nın karşı ucu olmayan boş satırı 352918 satır
    // kuralıyla zaten gizli).
    const emptyDuplicates = fixtureRunways
      .filter((r) => isEmptyRunway(r) && r.heIdent !== null && measured.has(r.airportId))
      .map((r) => r.id)
    // D-088, D-090, D-101'in kimlik tablosu (Bujumbura, Hassi Messaoud, Taba, Beauvais, Cluj, Linz,
    // Voronej) ve 5. halkanın 13 satırı (SKBS, SKMZ, SKAS, SKRH, SKSV, RJNO, NZGS, NZHN 260389 (silme
    // işareti de), NZKK, NZRO, NZWK, RCKU, WAJO); kapanış bloğunda Simferopol'ün uzunluksuz 01/19'u
    // (UKFF 260413, 01L/19R'nin yinelemesi; D-110).
    const table = [260310, 260338, 260339, 260344, 260408, 504922, 608245]
    const ringFive = [260326, 260329, 260332, 260333, 260334, 260378, 260388, 260389]
    const ringFiveRest = [260391, 260398, 260402, 260411, 327756]
    const closures = [260413]
    expect(emptyDuplicates.sort((x, y) => x - y)).toEqual(
      [...table, ...ringFive, ...ringFiveRest, ...closures].sort((x, y) => x - y),
    )
    expect(fixtureDetails.find((a) => a.icao === 'UKFF')?.runways.map((r) => r.id)).toEqual([
      239635,
    ])
    const tombstones = fixtureRunways
      .filter((r) => RUNWAY_TOMBSTONE_SURFACE.test(r.surface ?? ''))
      .map((r) => r.id)
    expect(tombstones).toEqual([238057, 260389])
    // Satır kuralları: karşı ucu olmayanlar (Stuttgart'ın iki helikopter alanı, LTAO ve TR-0315'in
    // "H" satırları, 5. halkada Atlanta-DeKalb ve Campo Grande helikopter alanları, Langzhong ZULA
    // ve Ponta Porã'nın boş satırı), 100 ft'ten kısa Pamplona ve iki silme işareti.
    const rowHidden = fixtureRunways.filter((r) => isHiddenRunway(r)).map((r) => r.id)
    expect(rowHidden).toHaveLength(10)
    expect(rowHidden.filter((id) => id === 260341 || id === 354841)).toHaveLength(2)
    const runwayIds = (icao: string) =>
      fixtureDetails.find((a) => a.icao === icao)?.runways.map((r) => r.id)
    expect(runwayIds('LEPP')).toEqual([238947])
    expect(runwayIds('DAUH')).toEqual([232838])
    expect(runwayIds('HBBA')).toEqual([234430])
    expect(runwayIds('LFOB')).toEqual([235868, 235869])
    expect(runwayIds('USDB')).toHaveLength(2)
    // Hamilton: üç gerçek satır; 238057 (07/25'in dolu kopyası) ve 260389 (boş) silme işaretli.
    expect(runwayIds('NZHN')?.sort((a, b) => a - b)).toEqual([238058, 238059, 238060])
  })

  it('görünür pistler: 1.–4. halka 1.568 (savaş kapanışlarının 27 pistiyle, D-110), 5. halka 2.978; pistsiz 6 + 14 havalimanı', () => {
    const visible = (rings: readonly number[]) =>
      fixtureDetails
        .filter((a) => rings.includes(a.ring))
        .reduce((total, airport) => total + airport.runways.length, 0)
    expect(visible([0, 1, 2, 3, 4])).toBe(1568)
    expect(visible([5])).toBe(2978)
    const withoutRunways = (ring: (r: number) => boolean) =>
      fixtureDetails
        .filter((a) => ring(a.ring) && a.runways.length === 0)
        .map((a) => a.icao)
        .sort()
    expect(withoutRunways((r) => r <= 4)).toEqual(['GMAZ', 'UBLC', 'ULDD', 'VIMB', 'VOVI', 'ZWTK'])
    expect(withoutRunways((r) => r === 5)).toEqual([
      ...['AYBM', 'MZBE', 'MZCK', 'MZCP', 'MZPB', 'NWWA', 'UERS'],
      ...['UESU', 'UEVV', 'WAKT', 'WIOS', 'WITC', 'ZPZT', 'ZULA'],
    ])
  })
})

describe('fixture: adres takma adları (D-109)', () => {
  it('1.–4. halkada 29, 5. halkada 23 takma ad; hiçbiri listelenen bir ICAO değil, WABP takma ad değil', () => {
    const aliases = fixtureDetails
      .filter((a) => a.identAlias !== undefined)
      .map((a) => [a.identAlias, a.icao, a.ring] as const)
    expect(aliases.filter(([, , ring]) => ring <= 4)).toHaveLength(29)
    expect(aliases.filter(([, , ring]) => ring === 5)).toHaveLength(23)
    expect(aliases.map(([alias, icao]) => `${alias}>${icao}`)).toEqual(
      expect.arrayContaining(['UTSS>UZSS', 'LELO>LERJ', 'VA1G>VERW', 'SPIM>SPJC', 'KPBI>KDJT']),
    )
    for (const [alias] of aliases) expect(listedRing5Icaos.has(alias ?? ''), alias).toBe(false)
    expect(fixtureDetails.find((a) => a.icao === 'WAYY')?.identAlias).toBeUndefined()
  })

  it('tek havalimanı: ICAO, IATA ve takma ad; askerî alan ve başka satırın ICAO’su bulunmaz', async () => {
    const find = (code: string) =>
      findAirportInRows(fixtureAirports, fixtureRunways, [], code, fixtureContext)
    // 4. halka açıkken (uygulama): Semerkant'ın eski kodu.
    expect(await find('UTSS')).toMatchObject({ icao: 'UZSS', iata: 'SKD', identAlias: 'UTSS' })
    expect(await find('utss')).toMatchObject({ icao: 'UZSS' })
    // 5. halka (halka süzgeci yok): Lima, Palm Beach, Harare.
    expect(await find('SPIM')).toMatchObject({ icao: 'SPJC', iata: 'LIM', ring: 5 })
    expect(await find('KPBI')).toMatchObject({ icao: 'KDJT', iata: 'DJT' })
    expect(await find('FVHA')).toMatchObject({ icao: 'FVRG', iata: 'HRE' })
    // Kanonik kod ve IATA aynı kaydı verir; kayıt takma adını taşır.
    expect(await find('UZSS')).toMatchObject({ icao: 'UZSS', identAlias: 'UTSS' })
    expect(await find('SKD')).toMatchObject({ icao: 'UZSS', identAlias: 'UTSS' })
    // WABP: Timika'nın (WAYY) kimliği, ama Burumeso'nun ICAO'su; takma ad değildir.
    expect(await find('WABP')).toBeNull()
    expect(await find('WAYY')).toMatchObject({ icao: 'WAYY', iata: 'TIM' })
    // Askerî alanlar hiçbir kodla bulunmaz (D-107, D-109); aday olmayan Le Bourget ülke
    // listesindeki gibi bulunur, Thohoyandou içe aktarılmadığı için bulunmaz.
    for (const code of [
      'PWAK',
      'AWK',
      'YBOK',
      'OKY',
      'PKWA',
      'KWA',
      'LTBL',
      'IGL',
      'FATH',
      'THY',
    ]) {
      expect(await find(code), code).toBeNull()
    }
    expect(await find('LBG')).toMatchObject({ icao: 'LFPB', scheduled: false })
  })
})

describe('pist kurallarının web test yardımcısındaki yazımı (D-101, D-109)', () => {
  it('100 ft sınırı ve silme işareti `apps/web/src/lib/test/ourairports-fixture.ts` ile aynı', () => {
    // Web @havayolu/db'ye bağımlı değildir; yardımcı kuralları kendi yazar (sayfa metni testleri).
    const source = readFileSync(
      new URL('../../../apps/web/src/lib/test/ourairports-fixture.ts', import.meta.url),
      'utf8',
    )
    expect(/const MIN_RUNWAY_LENGTH_FT = (\d+)/.exec(source)?.[1]).toBe(
      String(MIN_RUNWAY_LENGTH_FT),
    )
    expect(/const RUNWAY_TOMBSTONE_SURFACE = (\/.*\/[a-z]*)\n/.exec(source)?.[1]).toBe(
      String(RUNWAY_TOMBSTONE_SURFACE),
    )
    // Boş satır: uzunluk, genişlik ve iki ucun koordinatı (dört sütun).
    for (const column of ['length_ft', 'width_ft', 'le_latitude_deg', 'he_latitude_deg']) {
      expect(source, column).toContain(`num(row.${column}) === null`)
    }
    // Eski kimlik tablosu kalmadı (D-109: genel kural).
    expect(source).not.toContain('HIDDEN_RUNWAY_IDS')
    // Adres takma adı olamayacak kimlikler (D-109).
    const exclusions = /const IDENT_ALIAS_EXCLUSIONS = \[([^\]]*)\]/.exec(source)?.[1] ?? ''
    expect([...exclusions.matchAll(/'([A-Z0-9]+)'/g)].map((m) => m[1])).toEqual([
      ...IDENT_ALIAS_EXCLUSIONS,
    ])
  })
})
