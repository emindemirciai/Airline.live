import { describe, expect, it } from 'vitest'
import {
  DEFAULT_UNIT_SYSTEM,
  formatAltitude,
  formatDistance,
  formatFlightNumber,
  formatSpeed,
  formatVerticalRate,
  isUnitSystem,
  NO_VALUE,
  normalizeFlightNumber,
  UNIT_SYSTEMS,
} from './index'

const MINUS = '−'
const aviation = { units: 'aviation' } as const
const en = { locale: 'en' } as const
const enAviation = { units: 'aviation', locale: 'en' } as const

describe('birim sistemi', () => {
  it('varsayılan metriktir; iki sistem vardır', () => {
    expect(DEFAULT_UNIT_SYSTEM).toBe('metric')
    expect(UNIT_SYSTEMS).toEqual(['metric', 'aviation'])
    expect(isUnitSystem('metric')).toBe(true)
    expect(isUnitSystem('aviation')).toBe(true)
    expect(isUnitSystem('imperial')).toBe(false)
    expect(isUnitSystem(undefined)).toBe(false)
  })

  it('bilinmeyen değer "—" olarak yazılır', () => {
    expect(NO_VALUE).toBe('—')
    expect(formatAltitude(null)).toBe('—')
    expect(formatSpeed(null, aviation)).toBe('—')
    expect(formatVerticalRate(null, en)).toBe('—')
    expect(formatDistance(null)).toBe('—')
    expect(formatAltitude(Number.NaN)).toBe('—')
    expect(formatSpeed(Number.POSITIVE_INFINITY)).toBe('—')
  })
})

describe('formatAltitude', () => {
  it('metrikte tam metre, tr binlik ayırıcı nokta', () => {
    expect(formatAltitude(1093)).toBe('333 m')
    expect(formatAltitude(3587)).toBe('1.093 m')
    expect(formatAltitude(37000)).toBe('11.278 m')
    expect(formatAltitude(0)).toBe('0 m')
  })

  it('en binlik ayırıcı virgül', () => {
    expect(formatAltitude(3587, en)).toBe('1,093 m')
  })

  it('havacılık biriminde ft', () => {
    expect(formatAltitude(1093, aviation)).toBe('1.093 ft')
    expect(formatAltitude(1093, enAviation)).toBe('1,093 ft')
    expect(formatAltitude(35000.4, aviation)).toBe('35.000 ft')
  })

  it('nowrap: sayı ile birim arasında bölünmez boşluk (pencerede pist uzunluğu, D-083)', () => {
    // 11.155 ft = 3.400 m (AYT): dar sütunda "3.400" ile "m" ayrı satıra düşmez.
    expect(formatAltitude(11155, { nowrap: true })).toBe('3.400\u00a0m')
    expect(formatAltitude(11155, { nowrap: true, units: 'aviation', locale: 'en' })).toBe(
      '11,155\u00a0ft',
    )
    expect(formatAltitude(-1234, { nowrap: true })).toBe('−376\u00a0m')
    expect(formatAltitude(null, { nowrap: true })).toBe('—')
    // Varsayılan olağan boşluktur (harita etiketleri ve tablolar değişmez).
    expect(formatAltitude(11155)).toBe('3.400 m')
    expect(formatAltitude(11155, { nowrap: false })).toBe('3.400 m')
  })

  it('yerdeyse değerden bağımsız "yerde" / "on ground"', () => {
    expect(formatAltitude(null, { onGround: true })).toBe('yerde')
    expect(formatAltitude(125, { onGround: true, units: 'aviation' })).toBe('yerde')
    expect(formatAltitude(null, { onGround: true, locale: 'en' })).toBe('on ground')
    expect(formatAltitude(1093, { onGround: false })).toBe('333 m')
  })

  it('deniz seviyesinin altı U+2212 ile; sıfıra yuvarlanan değer işaretsiz', () => {
    expect(formatAltitude(-100)).toBe(`${MINUS}30 m`)
    expect(formatAltitude(-100, aviation)).toBe(`${MINUS}100 ft`)
    expect(formatAltitude(-1)).toBe('0 m')
  })
})

describe('formatSpeed', () => {
  it('metrikte km/sa (en km/h)', () => {
    expect(formatSpeed(233)).toBe('432 km/sa')
    expect(formatSpeed(232.7)).toBe('431 km/sa')
    expect(formatSpeed(232.7, en)).toBe('431 km/h')
    expect(formatSpeed(600)).toBe('1.111 km/sa')
    expect(formatSpeed(0)).toBe('0 km/sa')
  })

  it('havacılık biriminde kt', () => {
    expect(formatSpeed(233, aviation)).toBe('233 kt')
    expect(formatSpeed(15.4, enAviation)).toBe('15 kt')
    expect(formatSpeed(1000, aviation)).toBe('1.000 kt')
  })
})

describe('formatVerticalRate', () => {
  it('alçalma U+2212 ile, metrikte m/dk (en m/min)', () => {
    expect(formatVerticalRate(-1235)).toBe(`${MINUS}376 m/dk`)
    expect(formatVerticalRate(-1235, en)).toBe(`${MINUS}376 m/min`)
    expect(formatVerticalRate(-1235)).not.toContain('-')
  })

  it('havacılık biriminde ft/dk (en ft/min) ve binlik ayırıcı', () => {
    expect(formatVerticalRate(-1235, aviation)).toBe(`${MINUS}1.235 ft/dk`)
    expect(formatVerticalRate(-1235, enAviation)).toBe(`${MINUS}1,235 ft/min`)
    expect(formatVerticalRate(64, aviation)).toBe('+64 ft/dk')
  })

  it('tırmanış "+" ile; sıfır ve sıfıra yuvarlanan değer işaretsiz', () => {
    expect(formatVerticalRate(1235)).toBe('+376 m/dk')
    expect(formatVerticalRate(0)).toBe('0 m/dk')
    expect(formatVerticalRate(1)).toBe('0 m/dk')
    expect(formatVerticalRate(-1)).toBe('0 m/dk')
    expect(formatVerticalRate(0, enAviation)).toBe('0 ft/min')
  })

  it('yuvarlama sıfırdan uzağadır (işarete göre simetrik)', () => {
    expect(formatVerticalRate(0.5, aviation)).toBe('+1 ft/dk')
    expect(formatVerticalRate(-0.5, aviation)).toBe(`${MINUS}1 ft/dk`)
    expect(formatAltitude(-2.5, aviation)).toBe(`${MINUS}3 ft`)
  })
})

describe('formatDistance', () => {
  it("10 km'nin altında bir ondalık, tr ondalık ayırıcı virgül", () => {
    expect(formatDistance(6)).toBe('6,0 km')
    expect(formatDistance(9.94)).toBe('9,9 km')
    expect(formatDistance(0)).toBe('0,0 km')
  })

  it('en ondalık ayırıcı nokta', () => {
    expect(formatDistance(6, en)).toBe('6.0 km')
  })

  it('nowrap: sayı ile birim arasında bölünmez boşluk (uçak listesinin konum sütunu, D-085)', () => {
    expect(formatDistance(45, { nowrap: true })).toBe('45\u00a0km')
    expect(formatDistance(4.2, { nowrap: true, locale: 'en', units: 'aviation' })).toBe(
      '2.3\u00a0NM',
    )
    expect(formatDistance(null, { nowrap: true })).toBe('—')
    expect(formatDistance(45, { nowrap: false })).toBe('45 km')
  })

  it("10 ve üstü tam sayı; 10'a yuvarlanan değer de tam sayı", () => {
    expect(formatDistance(12.4)).toBe('12 km')
    expect(formatDistance(9.96)).toBe('10 km')
    expect(formatDistance(1234.5)).toBe('1.235 km')
    expect(formatDistance(1234.5, en)).toBe('1,235 km')
  })

  it('havacılık biriminde NM', () => {
    expect(formatDistance(6, aviation)).toBe('3,2 NM')
    expect(formatDistance(6, enAviation)).toBe('3.2 NM')
    expect(formatDistance(1852, aviation)).toBe('1.000 NM')
    expect(formatDistance(18.52, aviation)).toBe('10 NM')
  })
})

describe('formatFlightNumber', () => {
  it('havayolu kodu ile numara arasında tire', () => {
    expect(formatFlightNumber('TK', 4)).toBe('TK-4')
    expect(formatFlightNumber('TK', '1985')).toBe('TK-1985')
    expect(formatFlightNumber('pc', 2020)).toBe('PC-2020')
  })

  it('baştaki sıfırları atar, soneki büyük harfe çevirir', () => {
    expect(formatFlightNumber(' tk ', '0004')).toBe('TK-4')
    expect(formatFlightNumber('TK', '4a')).toBe('TK-4A')
    expect(formatFlightNumber('TK', 0)).toBe('TK-0')
  })
})

describe('normalizeFlightNumber', () => {
  it('TK4, tk 4, TK-4 ve TK0004 aynı sefer sayılır', () => {
    for (const input of ['TK4', 'tk 4', 'TK-4', 'TK0004', 'TK 0004', ' tk - 4 ', 'Tk4']) {
      expect(normalizeFlightNumber(input)).toEqual({ airline: 'TK', number: '4' })
    }
  })

  it('3 harfli ICAO kodu ve rakam içeren IATA kodu', () => {
    expect(normalizeFlightNumber('THY4')).toEqual({ airline: 'THY', number: '4' })
    expect(normalizeFlightNumber('pgt 1234')).toEqual({ airline: 'PGT', number: '1234' })
    expect(normalizeFlightNumber('W61234')).toEqual({ airline: 'W6', number: '1234' })
    expect(normalizeFlightNumber('6E-123')).toEqual({ airline: '6E', number: '123' })
    expect(normalizeFlightNumber('TK1985')).toEqual({ airline: 'TK', number: '1985' })
  })

  it('tek harfli sonek korunur', () => {
    expect(normalizeFlightNumber('TK 4a')).toEqual({ airline: 'TK', number: '4A' })
    expect(normalizeFlightNumber('THY012B')).toEqual({ airline: 'THY', number: '12B' })
  })

  it('tanınmayan biçim null döner', () => {
    for (const input of [
      '',
      '   ',
      'TK',
      '4',
      'T4',
      'TK12345',
      'TK0',
      'TK 000',
      '12345',
      '12 34',
      'THYX4',
      'TK 4 5',
      'TK4AB',
      'TK/4',
      'İST4',
    ]) {
      expect(normalizeFlightNumber(input)).toBeNull()
    }
  })

  it('biçimleyiciyle gidiş dönüş', () => {
    const parsed = normalizeFlightNumber('tk0004')
    expect(parsed).not.toBeNull()
    if (parsed) expect(formatFlightNumber(parsed.airline, parsed.number)).toBe('TK-4')
  })
})
