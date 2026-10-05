import { describe, expect, it } from 'vitest'
import {
  COUNTRY_CAPITALS,
  COUNTRY_TIER_OVERRIDES,
  HOLE_COUNTRIES,
  TIER_1_MIN_AREA_KM2,
  TIER_2_MIN_AREA_KM2,
  UNLABELLED_COUNTRIES,
  countryLabelTier,
  type CountryLabelTier,
} from './capitals'
import { countryLabelText, countryName } from './countries'

const codes = COUNTRY_CAPITALS.map((c) => c.code)
const tierOf = (code: string) => {
  const capital = COUNTRY_CAPITALS.find((c) => c.code === code)
  if (!capital) throw new Error(`missing ${code}`)
  return countryLabelTier(capital)
}

describe('başkentler (D-095)', () => {
  it('59 ülke; kodlar tekil ISO 3166-1 alpha-2 ve sıralı', () => {
    expect(COUNTRY_CAPITALS).toHaveLength(59)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/)
    expect(codes).toEqual(codes.toSorted())
  })

  it('konumlar iki ondalıklı ve bölgenin içinde; yüzölçümü pozitif ve 100 km²’ye yuvarlı', () => {
    for (const { code, lat, lon, areaKm2 } of COUNTRY_CAPITALS) {
      expect(Math.round(lat * 100) / 100, code).toBe(lat)
      expect(Math.round(lon * 100) / 100, code).toBe(lon)
      expect(lat, code).toBeGreaterThanOrEqual(10)
      expect(lat, code).toBeLessThanOrEqual(62)
      expect(lon, code).toBeGreaterThanOrEqual(-10)
      expect(lon, code).toBeLessThanOrEqual(75)
      expect(areaKm2, code).toBeGreaterThan(0)
      expect(areaKm2 % 100, code).toBe(0)
    }
  })

  it('başkent adları iki dilde dolu; Lefkoşa, Priştine, Ankara', () => {
    for (const { code, capital } of COUNTRY_CAPITALS) {
      expect(capital.tr.trim(), code).not.toBe('')
      expect(capital.en.trim(), code).not.toBe('')
    }
    const byCode = new Map(COUNTRY_CAPITALS.map((c) => [c.code, c]))
    expect(byCode.get('CY')?.capital).toEqual({ tr: 'Lefkoşa', en: 'Nicosia' })
    expect(byCode.get('XK')?.capital).toEqual({ tr: 'Priştine', en: 'Pristina' })
    expect(byCode.get('TR')).toMatchObject({ lat: 39.93, lon: 32.86 })
  })

  it('ad kayması yalnızca Slovakya’da: 2,5 em yukarıda (Viyana’yla çakışma, D-095)', () => {
    const offsets = COUNTRY_CAPITALS.filter((c) => c.labelOffsetEm !== undefined)
    expect(offsets.map((c) => [c.code, c.labelOffsetEm])).toEqual([['SK', [0, -2.5]]])
    const others = COUNTRY_CAPITALS.filter((c) => c.code !== 'SK')
    for (const capital of others) expect(capital, capital.code).not.toHaveProperty('labelOffsetEm')
  })

  it('İsrail ve Filistin yok; Ukrayna, Kosova ve Kıbrıs var', () => {
    expect(UNLABELLED_COUNTRIES).toEqual(['IL', 'PS'])
    for (const code of UNLABELLED_COUNTRIES) expect(codes).not.toContain(code)
    expect(HOLE_COUNTRIES).toEqual(['UA'])
    for (const code of ['UA', 'XK', 'CY', 'TR']) expect(codes).toContain(code)
  })

  it('kademe: 700.000 km² ve üstü 1, 85.000 km² ve üstü 2, altı 3; Irak 1', () => {
    expect([TIER_1_MIN_AREA_KM2, TIER_2_MIN_AREA_KM2]).toEqual([700_000, 85_000])
    expect(COUNTRY_TIER_OVERRIDES).toEqual({ IQ: 1 })
    for (const capital of COUNTRY_CAPITALS) {
      const expected: CountryLabelTier =
        capital.code === 'IQ'
          ? 1
          : capital.areaKm2 >= 700_000
            ? 1
            : capital.areaKm2 >= 85_000
              ? 2
              : 3
      expect(countryLabelTier(capital), capital.code).toBe(expected)
    }
    expect(countryLabelTier({ code: 'XX', areaKm2: 700_000 })).toBe(1)
    expect(countryLabelTier({ code: 'XX', areaKm2: 699_900 })).toBe(2)
    expect(countryLabelTier({ code: 'XX', areaKm2: 85_000 })).toBe(2)
    expect(countryLabelTier({ code: 'XX', areaKm2: 84_900 })).toBe(3)
  })

  it('tasarımın örnekleri: kademe 1, 2 ve 3; kademe sayıları 10 / 20 / 29', () => {
    for (const code of ['TR', 'IR', 'IQ', 'EG', 'SA', 'RU', 'LY', 'DZ', 'KZ']) {
      expect(tierOf(code), code).toBe(1)
    }
    for (const code of ['GR', 'BG', 'RO', 'SY', 'JO', 'AZ', 'UA', 'PL', 'IT', 'DE']) {
      expect(tierOf(code), code).toBe(2)
    }
    for (const code of ['GE', 'AM', 'CY', 'LB', 'RS', 'MK', 'AL', 'XK', 'ME', 'BH', 'QA', 'KW']) {
      expect(tierOf(code), code).toBe(3)
    }
    expect(tierOf('MT')).toBe(3)
    const counts = [1, 2, 3].map(
      (tier) => COUNTRY_CAPITALS.filter((c) => countryLabelTier(c) === tier).length,
    )
    expect(counts).toEqual([10, 20, 29])
  })
})

describe('countryLabelText (D-095)', () => {
  it('Türkçe: dilin büyük harf kuralıyla (i → İ, ı → I)', () => {
    expect(countryLabelText('TR', 'tr')).toBe('TÜRKİYE')
    expect(countryLabelText('CY', 'tr')).toBe('KIBRIS')
    expect(countryLabelText('XK', 'tr')).toBe('KOSOVA')
    expect(countryLabelText('IR', 'tr')).toBe('İRAN')
    expect(countryLabelText('AE', 'tr')).toBe('BİRLEŞİK ARAP EMİRLİKLERİ')
    expect(countryLabelText('SA', 'tr')).toBe('SUUDİ ARABİSTAN')
  })

  it('İngilizce: i → I; "&" yerine "and"', () => {
    expect(countryLabelText('TR', 'en')).toBe('TÜRKIYE')
    expect(countryLabelText('CY', 'en')).toBe('CYPRUS')
    expect(countryLabelText('XK', 'en')).toBe('KOSOVO')
    expect(countryLabelText('IR', 'en')).toBe('IRAN')
    expect(countryLabelText('DZ', 'en')).toBe('ALGERIA')
    expect(countryLabelText('BA', 'en')).toBe('BOSNIA AND HERZEGOVINA')
  })

  it('her başkentin adı countryName’in büyük harfidir; küçük harf yok', () => {
    for (const { code } of COUNTRY_CAPITALS) {
      for (const [locale, intl] of [
        ['tr', 'tr-TR'],
        ['en', 'en-GB'],
      ] as const) {
        const text = countryLabelText(code, locale)
        expect(text, `${code} ${locale}`).toBe(countryName(code, locale).toLocaleUpperCase(intl))
        expect(text, `${code} ${locale}`).toBe(text.toLocaleUpperCase(intl))
        expect(text, `${code} ${locale}`).not.toMatch(/\p{Ll}/u)
        expect(text, `${code} ${locale}`).not.toBe(code)
      }
    }
  })
})
