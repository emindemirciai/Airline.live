import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  cleanAirportName,
  greatCircleKm,
  HIDDEN_RUNWAY_IDS,
  isHiddenRunway,
  MILITARY_AIRFIELD_ICAOS,
  MIN_RUNWAY_LENGTH_FT,
  nearestDistanceKm,
  nearestReference,
  OURAIRPORTS_ICAO_CORRECTIONS,
  ourAirportsIcao,
  ringForDistance,
  selectListedAirports,
  toAirportDetails,
  toListedAirports,
  turkishReferencePoints,
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
    expect(MILITARY_AIRFIELD_ICAOS).toEqual(['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'])
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

  it('HIDDEN_RUNWAY_IDS: yinelenen boş pist satırı gösterilmez; doldurulursa görünür', () => {
    expect(
      Object.keys(HIDDEN_RUNWAY_IDS)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([260310, 260338, 260339, 260344, 260408, 504922, 608245])
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
    })
    expect(isHiddenRunway(ghost)).toBe(true)
    expect(isHiddenRunway(real)).toBe(false)
    const [detail] = withDetails([taba], [real, ghost], [])
    expect(detail?.runways.map((r) => r.id)).toEqual([235597])
    // Kaynak satırı doldurursa (uzunluk ya da genişlik), pist yeniden görünür.
    const filled = { ...ghost, lengthFt: 13_123 }
    expect(isHiddenRunway(filled)).toBe(false)
    expect(withDetails([taba], [real, filled], [])[0]?.runways).toHaveLength(2)
    // Tabloda olmayan boş satır gösterilir (genel kural yok, yalnız bilinen kayıtlar).
    expect(isHiddenRunway({ ...ghost, id: 1 })).toBe(false)
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
    const empty = (id: number, le: string, he: string) =>
      runwayRow({
        id,
        lengthFt: null,
        widthFt: null,
        surface: 'GRS',
        lighted: false,
        leIdent: le,
        heIdent: he,
        leTrueBearingDeg: null,
        heTrueBearingDeg: null,
      })
    expect(isHiddenRunway(empty(608245, '18', '36'))).toBe(true)
    expect(isHiddenRunway(empty(504922, '07H', '25H'))).toBe(true)
    expect(isHiddenRunway({ ...empty(608245, '18', '36'), lengthFt: 3000 })).toBe(false)
  })
})

describe('4. halka pist kuralları (D-101)', () => {
  it('Hassi Messaoud 01/19, Beauvais 13R/31L ve Bujumbura 02/20 boş satırları gizli', () => {
    const empty = (id: number, le: string, he: string) =>
      runwayRow({
        id,
        lengthFt: null,
        widthFt: null,
        surface: 'UNK',
        lighted: false,
        leIdent: le,
        heIdent: he,
        leTrueBearingDeg: null,
        heTrueBearingDeg: null,
      })
    for (const [id, le, he] of [
      [260338, '01', '19'],
      [260344, '13R', '31L'],
      [260310, '02', '20'],
    ] as const) {
      expect(isHiddenRunway(empty(id, le, he)), String(id)).toBe(true)
      expect(isHiddenRunway({ ...empty(id, le, he), widthFt: 148 }), String(id)).toBe(false)
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

/**
 * Commit'li OurAirports fixture'ı (tools/fixtures/README.md): Türkiye, sekiz uzak havalimanı ve
 * 1.–4. halka. İçe aktarım süzgeci (data-sources.md §3) uygulanır; pistlerden kapalılar alınmaz.
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

describe('fixture: 4. halka açıkken liste ve pistler (D-101; uygulamada halka henüz 3)', () => {
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
    }))
  const context: ListingContext = {
    turkey: turkishReferencePoints(fixtureAirports),
    ringsKm: RINGS_KM,
    enabledRing: 4,
  }
  const listedRing4 = selectListedAirports(fixtureAirports, context)

  it('56 + 75 + 89 + 278 + 719 = 1.217; askerî üsler (D-107) ve UG-0002 (KHX) listede yok, her ICAO dört karakter', () => {
    expect(listedRing4).toHaveLength(1217)
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
    expect(foreign).toHaveLength(1161)
    expect([1, 2, 3, 4].map((ring) => foreign.filter((a) => a.ring === ring).length)).toEqual([
      75, 89, 278, 719,
    ])
    for (const airport of listedRing4) expect(airport.icao).toMatch(/^[A-Z0-9]{4}$/)
    expect(listedRing4.map((a) => a.icao)).not.toContain('UG-0002')
    expect(listedRing4.map((a) => a.iata)).not.toContain('KHX')
    // ICAO koşulu olmasa 720 aday olurdu: KHX 4. halkadadır ve ülke listesinde görünür.
    const uganda = toListedAirports(
      fixtureAirports.filter((a) => a.isoCountry === 'UG'),
      context,
    )
    expect(uganda.find((a) => a.iata === 'KHX')).toMatchObject({ icao: 'UG-0002', ring: 4 })
    expect(listedRing4.filter((a) => a.country === 'UG')).toHaveLength(4)
    // Açık halka 3'te liste bugünkü 498'dir (D-107'den önce 503).
    expect(selectListedAirports(fixtureAirports, { ...context, enabledRing: 3 })).toHaveLength(498)
  })

  it('üsler uzaklık referansından çıkınca halka üyeliği değişmez; en yakın Türkiye havalimanı yalnız dört yerde Çiğli yerine sivil alan olur (D-107)', () => {
    // D-107'den önceki referans: 61 nokta + beş üs (66).
    const bases = fixtureAirports
      .filter((a) => MILITARY_AIRFIELD_ICAOS.includes(ourAirportsIcao(a)))
      .map((a) => ({
        lat: a.latitudeDeg,
        lon: a.longitudeDeg,
        icao: ourAirportsIcao(a),
        iata: a.iataCode ?? '',
        name: cleanAirportName(a.name),
      }))
    expect(bases.map((b) => b.icao).sort()).toEqual([...MILITARY_AIRFIELD_ICAOS])
    const before: ListingContext = { ...context, turkey: [...context.turkey, ...bases] }
    const all = { ...context, enabledRing: 5 }
    const now = toAirportDetails(fixtureAirports, [], [], all).filter((a) => a.country !== 'TR')
    // Ayrıntı kaydı halka süzgeci uygulamaz: bütün adaylar (1.–5. halka) karşılaştırılır.
    const old = new Map(toAirportDetails(fixtureAirports, [], [], before).map((a) => [a.icao, a]))
    expect(now.length).toBeGreaterThan(1161)
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

  it('gizli satırlar: tablodaki yedi kayıt, karşı ucu olmayanlar ve yalnız Pamplona’nın 2 ft’lik satırı', () => {
    const hidden = fixtureRunways.filter(isHiddenRunway)
    const inTable = hidden.filter((r) => Object.hasOwn(HIDDEN_RUNWAY_IDS, r.id)).map((r) => r.id)
    expect(inTable.sort((a, b) => a - b)).toEqual(
      Object.keys(HIDDEN_RUNWAY_IDS)
        .map(Number)
        .sort((a, b) => a - b),
    )
    const byLength = hidden
      .filter((r) => r.heIdent !== null && !Object.hasOwn(HIDDEN_RUNWAY_IDS, r.id))
      .map((r) => r.id)
    expect(byLength).toEqual([260341])
    const details = toAirportDetails(fixtureAirports, fixtureRunways, [], context)
    const runwayIds = (icao: string) =>
      details.find((a) => a.icao === icao)?.runways.map((r) => r.id)
    expect(runwayIds('LEPP')).toEqual([238947])
    expect(runwayIds('DAUH')).toEqual([232838])
    expect(runwayIds('HBBA')).toEqual([234430])
    expect(runwayIds('LFOB')).toEqual([235868, 235869])
    expect(runwayIds('USDB')).toHaveLength(2)
  })

  it('görünür pisti olmayan listelenen havalimanları boş pist listesiyle gelir (GMAZ, ULDD, VIMB, VOVI, ZWTK ve UBLC)', () => {
    const listedIcaos = new Set(listedRing4.map((a) => a.icao))
    const details = toAirportDetails(fixtureAirports, fixtureRunways, [], context).filter((a) =>
      listedIcaos.has(a.icao),
    )
    expect(details).toHaveLength(1217)
    const withoutRunways = details.filter((a) => a.runways.length === 0).map((a) => a.icao)
    expect(withoutRunways.sort()).toEqual(['GMAZ', 'UBLC', 'ULDD', 'VIMB', 'VOVI', 'ZWTK'])
    for (const icao of withoutRunways) {
      const detail = details.find((a) => a.icao === icao)
      expect(detail?.runways, icao).toEqual([])
      expect(detail?.dataUpdatedAt, icao).toBe('2026-10-01T23:03:49.000Z')
    }
  })
})

describe('pist kurallarının web test yardımcısındaki yazımı (D-101)', () => {
  it('gizli kimlikler ve 100 ft sınırı `apps/web/src/lib/test/ourairports-fixture.ts` ile aynı', () => {
    // Web @havayolu/db'ye bağımlı değildir; yardımcı kuralları kendi yazar (sayfa metni testleri).
    const source = readFileSync(
      new URL('../../../apps/web/src/lib/test/ourairports-fixture.ts', import.meta.url),
      'utf8',
    )
    const ids = /const HIDDEN_RUNWAY_IDS = new Set\(\[([^\]]*)\]\)/.exec(source)?.[1] ?? ''
    expect([...ids.matchAll(/'(\d+)'/g)].map((m) => Number(m[1])).sort((a, b) => a - b)).toEqual(
      Object.keys(HIDDEN_RUNWAY_IDS)
        .map(Number)
        .sort((a, b) => a - b),
    )
    expect(/const MIN_RUNWAY_LENGTH_FT = (\d+)/.exec(source)?.[1]).toBe(
      String(MIN_RUNWAY_LENGTH_FT),
    )
  })
})
