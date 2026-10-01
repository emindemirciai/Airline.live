import { describe, expect, it } from 'vitest'
import { DecodedTafSchema } from './schema'
import { decodeTaf } from './taf'

const REF = '2026-01-15T13:00:00Z'

describe('brief §2 fixture TAF’ları', () => {
  it('LTFM: TEMPO, PROB30 TEMPO, BECMG', () => {
    const t = decodeTaf(
      'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA FEW025CB PROB30 TEMPO 1514/1518 TSRA BECMG 1520/1522 02008KT',
      { referenceTime: REF },
    )
    expect(t).toMatchObject({
      station: 'LTFM',
      issuedAt: '2026-01-15T10:40:00.000Z',
      validFrom: '2026-01-15T12:00:00.000Z',
      validTo: '2026-01-16T18:00:00.000Z',
      amended: false,
      cancelled: false,
      nil: false,
      unparsed: [],
    })
    expect(t.periods.map((p) => [p.kind, p.probability, p.from, p.to])).toEqual([
      ['BASE', null, '2026-01-15T12:00:00.000Z', '2026-01-16T18:00:00.000Z'],
      ['TEMPO', null, '2026-01-15T12:00:00.000Z', '2026-01-15T18:00:00.000Z'],
      ['TEMPO', 30, '2026-01-15T14:00:00.000Z', '2026-01-15T18:00:00.000Z'],
      ['BECMG', null, '2026-01-15T20:00:00.000Z', '2026-01-15T22:00:00.000Z'],
    ])
    expect(t.periods[0]).toMatchObject({
      raw: '03015G28KT 9999 SCT025 BKN035',
      wind: { directionDeg: 30, speedKt: 15, gustKt: 28 },
      visibility: { tenKmOrMore: true },
      weather: [],
    })
    expect(t.periods[2]?.raw).toBe('PROB30 TEMPO 1514/1518 TSRA')
    expect(t.periods[2]?.weather[0]).toMatchObject({ descriptor: 'TS', phenomena: ['RA'] })
  })

  it('LTBA: CAVOK, BECMG NSC, FM', () => {
    const t = decodeTaf(
      'TAF LTBA 151040Z 1512/1612 04010KT CAVOK BECMG 1600/1602 3000 BR NSC FM161000 05012KT 9999 FEW030',
      { referenceTime: REF },
    )
    expect(t.periods.map((p) => [p.kind, p.from, p.to])).toEqual([
      ['BASE', '2026-01-15T12:00:00.000Z', '2026-01-16T10:00:00.000Z'],
      ['BECMG', '2026-01-16T00:00:00.000Z', '2026-01-16T02:00:00.000Z'],
      ['FM', '2026-01-16T10:00:00.000Z', '2026-01-16T12:00:00.000Z'],
    ])
    expect(t.periods[0]?.cavok).toBe(true)
    expect(t.periods[1]?.sky?.kind).toBe('nsc')
    expect(t.periods[2]?.raw).toBe('FM161000 05012KT 9999 FEW030')
  })

  it('LTAC: VV, NSW', () => {
    const t = decodeTaf(
      'TAF LTAC 151040Z 1512/1612 32012KT 2000 SN BKN008 OVC015 TEMPO 1512/1516 0800 +SN VV005 BECMG 1518/1520 6000 NSW SCT020',
      { referenceTime: REF },
    )
    expect(t.periods[1]?.sky).toEqual({ kind: 'vv', layers: [], verticalVisibilityFt: 500 })
    expect(t.periods[2]?.nsw).toBe(true)
  })

  it('LTAI: AMD, PROB40 (TEMPO’suz)', () => {
    const t = decodeTaf(
      'TAF AMD LTAI 151215Z 1512/1618 20015G28KT 3000 TSRA SCT015CB BKN030 PROB40 1515/1518 1500 +TSRA BECMG 1600/1602 9999 NSW SCT025',
      { referenceTime: REF },
    )
    expect(t.amended).toBe(true)
    expect(t.issuedAt).toBe('2026-01-15T12:15:00.000Z')
    expect(t.periods[1]).toMatchObject({
      kind: 'PROB',
      probability: 40,
      from: '2026-01-15T15:00:00.000Z',
      to: '2026-01-15T18:00:00.000Z',
      raw: 'PROB40 1515/1518 1500 +TSRA',
    })
  })

  it('LTCG: 9 saatlik TAF', () => {
    const t = decodeTaf(
      'TAF LTCG 151040Z 1512/1521 00000KT 0300 FG VV001 BECMG 1513/1515 3000 BR SCT005',
      { referenceTime: REF },
    )
    expect(t.validTo).toBe('2026-01-15T21:00:00.000Z')
    expect(t.periods[0]?.wind?.calm).toBe(true)
  })

  it('LTBJ: süresi dolmuş TAF da çözülür', () => {
    const t = decodeTaf('TAF LTBJ 140440Z 1406/1506 VRB03KT 9999 FEW040', { referenceTime: REF })
    expect(t.validTo).toBe('2026-01-15T06:00:00.000Z')
  })
})

describe('WMO-782 ve MGM örnekleri', () => {
  it('WMO-782 tam örnek: PROB30 TEMPO', () => {
    const t = decodeTaf(
      'TAF LUDO 130530Z 1307/1316 31015KT 8000 SHRA FEW005 FEW010CB SCT018 BKN025 TEMPO 1311/1316 4000 +SHRA PROB30 TEMPO 1314/1316 TSRA SCT005 BKN010CB',
      { referenceTime: '2026-03-13T06:00:00Z' },
    )
    expect(t.periods.map((p) => [p.kind, p.probability])).toEqual([
      ['BASE', null],
      ['TEMPO', null],
      ['TEMPO', 30],
    ])
    expect(t.periods[0]?.sky?.layers).toHaveLength(4)
    expect(t.unparsed).toEqual([])
  })

  it('WMO-782: TAF AMD … CNL', () => {
    const t = decodeTaf('TAF AMD LUDO 161500Z 1606/1712 CNL', {
      referenceTime: '2026-03-16T15:00:00Z',
    })
    expect(t).toMatchObject({ amended: true, cancelled: true, periods: [] })
    expect(t.validFrom).toBe('2026-03-16T06:00:00.000Z')
    expect(t.validTo).toBe('2026-03-17T12:00:00.000Z')
  })

  it('MGM V.3.7.11: PROB40 FZFG ve BECMG NSW', () => {
    const t = decodeTaf(
      'TAF LTXX 090140Z 0903/0912 11003KT 2500 BCFG SCT014 BKN030 PROB40 0906/0908 0500 FZFG BKN008 BKN030 BECMG 0910/0912 9999 NSW SCT030 BKN080 =',
      { referenceTime: '2026-01-09T02:00:00Z' },
    )
    expect(t.periods[1]).toMatchObject({ kind: 'PROB', probability: 40 })
    expect(t.periods[1]?.weather[0]?.raw).toBe('FZFG')
    expect(t.periods[2]?.nsw).toBe(true)
  })

  it('MGM: TAF NIL', () => {
    const t = decodeTaf('TAF LTAI 151040Z NIL=', { referenceTime: REF })
    expect(t).toMatchObject({ nil: true, periods: [], validFrom: null })
  })

  it('MGM: P99KT ve GP99 TAF rüzgârı; TX/TN tanınır', () => {
    const t = decodeTaf(
      'TAF LTXX 150440Z 1506/1515 33090GP99KT 9999 FEW030 TX25/1512Z TN15/1506Z',
      { referenceTime: REF },
    )
    expect(t.periods[0]?.wind).toMatchObject({ speedKt: 90, gustKt: 100, aboveMaxKt: true })
    expect(t.unparsed).toEqual([])
  })
})

describe('zamanlar', () => {
  it('ay sonu geçişi (3118/0124) ve HH=24', () => {
    const t = decodeTaf(
      'TAF LTFM 311640Z 3118/0124 03010KT 9999 FEW030 BECMG 0102/0104 BKN020 TEMPO 0120/0124 SHRA',
      { referenceTime: '2026-01-31T17:00:00Z' },
    )
    expect(t.validFrom).toBe('2026-01-31T18:00:00.000Z')
    expect(t.validTo).toBe('2026-02-02T00:00:00.000Z')
    expect(t.periods[1]?.from).toBe('2026-02-01T02:00:00.000Z')
    expect(t.periods[2]?.to).toBe('2026-02-02T00:00:00.000Z')
  })

  it('kayıttaki zamanlar (AWC epoch) ham gruplardan önceliklidir', () => {
    const t = decodeTaf('TAF LTFM 151040Z 1512/1618 03015KT 9999 SCT025', {
      issuedAt: '2026-01-15T10:41:00Z',
      validFrom: '2026-01-15T12:00:00Z',
      validTo: '2026-01-16T18:00:00Z',
    })
    expect(t.issuedAt).toBe('2026-01-15T10:41:00.000Z')
    expect(t.periods[0]?.from).toBe('2026-01-15T12:00:00.000Z')
  })

  it('yalnız geçerlilik başı verilse de dönem zamanları oturtulur', () => {
    const t = decodeTaf('TAF LTFM 151040Z 1512/1618 03015KT 9999 SCT025 TEMPO 1514/1516 SHRA', {
      validFrom: '2026-01-15T12:00:00Z',
    })
    expect(t.issuedAt).toBe('2026-01-15T10:40:00.000Z')
    expect(t.periods[1]?.from).toBe('2026-01-15T14:00:00.000Z')
  })

  it('referans yoksa zamanlar null, çözüm yine yapılır', () => {
    const t = decodeTaf('TAF LTFM 151040Z 1512/1618 03015KT 9999 SCT025')
    expect([t.issuedAt, t.validFrom, t.validTo]).toEqual([null, null, null])
    expect(t.periods[0]?.wind?.speedKt).toBe(15)
  })
})

describe('sözleşme', () => {
  const samples = [
    'TAF LTFM 151040Z 1512/1618 03015G28KT 9999 SCT025 BKN035 TEMPO 1512/1518 4000 SHRA FEW025CB PROB30 TEMPO 1514/1518 TSRA BECMG 1520/1522 02008KT',
    'TAF AMD LUDO 161500Z 1606/1712 CNL',
    'TAF LTAI 151040Z NIL=',
    'TAF LTXX 150440Z 1506/1515 XYZ 9999 QQQ',
    '',
  ]
  it.each(samples)('çıktı şemaya uyar: %s', (raw) => {
    const t = decodeTaf(raw, { referenceTime: REF })
    expect(DecodedTafSchema.parse(t)).toEqual(t)
    expect(JSON.parse(JSON.stringify(t))).toEqual(t)
  })

  it('tanınmayan parçalar dönemde ve TAF düzeyinde listelenir', () => {
    const t = decodeTaf('TAF LTXX 150440Z 1506/1515 XYZ 9999 QQQ', { referenceTime: REF })
    expect(t.unparsed).toEqual(['XYZ', 'QQQ'])
    expect(t.periods[0]?.unparsed).toEqual(['XYZ', 'QQQ'])
  })
})
