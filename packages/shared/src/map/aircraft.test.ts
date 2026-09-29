import { describe, expect, it } from 'vitest'
import {
  AIRCRAFT_CATEGORIES,
  AIRCRAFT_ICON_IDS,
  AIRCRAFT_VARIANTS,
  aircraftCategory,
  aircraftIconId,
  aircraftSortKey,
  aircraftVariant,
  isTurkishAirlines,
} from './aircraft'

describe('aircraftCategory', () => {
  it('ADS-B kategori tablosu', () => {
    const table: [string, string][] = [
      ['A1', 'light'],
      ['A2', 'light'],
      ['A3', 'jet'],
      ['A4', 'jet'],
      ['A5', 'heavy'],
      ['A7', 'rotor'],
      ['B1', 'light'],
      ['B4', 'light'],
    ]
    for (const [cat, expected] of table) {
      expect(aircraftCategory(cat, null), cat).toBe(expected)
      // Kategori tip kodundan önce gelir.
      expect(aircraftCategory(cat, 'B77W'), cat).toBe(expected)
    }
  })

  it('kategori kırpılır ve büyük harfe çevrilir', () => {
    expect(aircraftCategory(' a5 ', null)).toBe('heavy')
    expect(aircraftCategory('a7', 'A320')).toBe('rotor')
  })

  it('tabloda olmayan kategori tip koduna düşer', () => {
    for (const cat of ['A0', 'A6', 'B2', 'B6', 'C1', '']) {
      expect(aircraftCategory(cat, 'A321'), cat).toBe('jet')
      expect(aircraftCategory(cat, 'B789'), cat).toBe('heavy')
      expect(aircraftCategory(cat, null), cat).toBe('unknown')
    }
  })

  it('geniş gövde tip kodları (önek ve tam liste)', () => {
    for (const type of [
      'B744',
      'B748',
      'B762',
      'B763',
      'B772',
      'B77L',
      'B77W',
      'B788',
      'B789',
      'B78X',
      'A332',
      'A333',
      'A339',
      'A343',
      'A346',
      'A359',
      'A35K',
      'A388',
      'A306',
      'A30B',
      'A310',
      'A3ST',
      'MD11',
      'DC10',
      'L101',
      'IL96',
      'IL76',
      'A124',
      'A225',
      'C5',
      'C5M',
      'C17',
    ]) {
      expect(aircraftCategory(null, type), type).toBe('heavy')
    }
  })

  it('bilinen hafif tipler light, diğer her tip jet', () => {
    for (const type of ['C172', 'C152', 'P28A', 'DA40', 'DA42', 'SR22', 'C208', 'PA34']) {
      expect(aircraftCategory(null, type), type).toBe('light')
    }
    for (const type of ['A320', 'A21N', 'B738', 'B38M', 'E190', 'AT76', 'DH8D', 'CRJ9', 'AN12']) {
      expect(aircraftCategory(null, type), type).toBe('jet')
    }
  })

  it('helikopter tip kodundan tanınmaz; tip kırpılıp büyük harfe çevrilir', () => {
    expect(aircraftCategory(null, 'EC35')).toBe('jet')
    expect(aircraftCategory(null, ' b77w ')).toBe('heavy')
    expect(aircraftCategory(null, ' c172')).toBe('light')
  })

  it('kategori ve tip yoksa unknown', () => {
    expect(aircraftCategory(null, null)).toBe('unknown')
    expect(aircraftCategory(null, '  ')).toBe('unknown')
  })
})

describe('isTurkishAirlines ve aircraftVariant', () => {
  const thyByFlight = { cs: 'THY974', fn: { airline: 'TK' } }
  const thyByCallsign = { cs: 'THY7RN', fn: null }
  const pegasus = { cs: 'PGT123', fn: { airline: 'PC' } }
  const ajet = { cs: 'TKJ5DA', fn: { airline: 'VF' } }
  const anonymous = { cs: null, fn: null }

  it('sefer no TK ya da çağrı kodu THY ile başlıyorsa THY', () => {
    expect(isTurkishAirlines(thyByFlight)).toBe(true)
    expect(isTurkishAirlines(thyByCallsign)).toBe(true)
    expect(isTurkishAirlines({ cs: null, fn: { airline: 'TK' } })).toBe(true)
    expect(isTurkishAirlines(pegasus)).toBe(false)
    expect(isTurkishAirlines(ajet)).toBe(false)
    expect(isTurkishAirlines(anonymous)).toBe(false)
    expect(isTurkishAirlines({ cs: 'XTHY1', fn: null })).toBe(false)
  })

  it('seçili uçak her zaman selected; sıralama anahtarı seçili > THY > diğer', () => {
    expect(aircraftVariant(thyByFlight, true)).toBe('selected')
    expect(aircraftVariant(thyByFlight, false)).toBe('thy')
    expect(aircraftVariant(pegasus, false)).toBe('other')
    expect(aircraftVariant(anonymous, true)).toBe('selected')
    expect(aircraftSortKey('selected')).toBe(2)
    expect(aircraftSortKey('thy')).toBe(1)
    expect(aircraftSortKey('other')).toBe(0)
  })
})

describe('ikon adları', () => {
  it('hy-ac-<sınıf>-<tür>', () => {
    expect(aircraftIconId('jet', 'thy')).toBe('hy-ac-jet-thy')
    expect(aircraftIconId('unknown', 'selected')).toBe('hy-ac-unknown-selected')
  })

  it('bütün sınıf × tür ikonları, tekrarsız', () => {
    expect(AIRCRAFT_ICON_IDS).toHaveLength(AIRCRAFT_CATEGORIES.length * AIRCRAFT_VARIANTS.length)
    expect(new Set(AIRCRAFT_ICON_IDS).size).toBe(AIRCRAFT_ICON_IDS.length)
    for (const category of AIRCRAFT_CATEGORIES) {
      for (const variant of AIRCRAFT_VARIANTS) {
        expect(AIRCRAFT_ICON_IDS).toContain(aircraftIconId(category, variant))
      }
    }
    for (const id of AIRCRAFT_ICON_IDS) expect(id).toMatch(/^hy-ac-[a-z]+-[a-z]+$/)
  })
})
