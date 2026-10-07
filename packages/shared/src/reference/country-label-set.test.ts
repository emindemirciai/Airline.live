import { describe, expect, it } from 'vitest'
import { COUNTRY_LABEL_AREAS_KM2 } from '../map/country-label-placements'
import {
  COUNTRY_AREA_OVERRIDES_KM2,
  COUNTRY_LABEL_CAPITAL_ANCHORS,
  COUNTRY_TIER_OVERRIDES,
  TIER_1_MIN_AREA_KM2,
  TIER_2_MIN_AREA_KM2,
  UNLABELLED_COUNTRIES,
  countryLabelTier,
  type CountryLabelTier,
} from './country-label-set'
import { countryLabelText, countryName } from './countries'

const curated = Object.keys(COUNTRY_AREA_OVERRIDES_KM2)
const tierOf = (code: string) => {
  const areaKm2 = COUNTRY_LABEL_AREAS_KM2[code]
  if (areaKm2 === undefined) throw new Error(`missing ${code}`)
  return countryLabelTier({ code, areaKm2 })
}

describe('D-095 tablosunun yüzölçümleri (D-100)', () => {
  it('59 ülke; kodlar tekil ISO 3166-1 alpha-2 ve sıralı; 100 km²’ye yuvarlı', () => {
    expect(curated).toHaveLength(59)
    expect(curated).toEqual(curated.toSorted())
    for (const [code, areaKm2] of Object.entries(COUNTRY_AREA_OVERRIDES_KM2)) {
      expect(code).toMatch(/^[A-Z]{2}$/)
      expect(areaKm2, code).toBeGreaterThan(0)
      expect(areaKm2 % 100, code).toBe(0)
    }
  })

  it('üretilen tablo bu değerleri kullanır; Fransa, Danimarka ve Hollanda Avrupa’daki toprağıyla', () => {
    for (const [code, areaKm2] of Object.entries(COUNTRY_AREA_OVERRIDES_KM2)) {
      expect(COUNTRY_LABEL_AREAS_KM2[code], code).toBe(areaKm2)
    }
    expect(COUNTRY_AREA_OVERRIDES_KM2).toMatchObject({
      FR: 551_700,
      DK: 42_900,
      NL: 41_900,
      RS: 77_500,
      CY: 9_300,
      TR: 783_600,
      UA: 603_600,
    })
  })
})

describe('kademe (D-095)', () => {
  it('700.000 km² ve üstü 1, 85.000 km² ve üstü 2, altı 3; Irak 1; Şili, Mozambik, Endonezya 2 (D-100)', () => {
    expect([TIER_1_MIN_AREA_KM2, TIER_2_MIN_AREA_KM2]).toEqual([700_000, 85_000])
    expect(COUNTRY_TIER_OVERRIDES).toEqual({ IQ: 1, CL: 2, MZ: 2, ID: 2 })
    for (const [code, areaKm2] of Object.entries(COUNTRY_LABEL_AREAS_KM2)) {
      const override = Object.hasOwn(COUNTRY_TIER_OVERRIDES, code)
        ? COUNTRY_TIER_OVERRIDES[code]
        : undefined
      const expected: CountryLabelTier =
        override ?? (areaKm2 >= 700_000 ? 1 : areaKm2 >= 85_000 ? 2 : 3)
      expect(countryLabelTier({ code, areaKm2 }), code).toBe(expected)
    }
    // Kademe 2'ye alınan üçü yüzölçümüyle kademe 1'dir (eşiğin üstünde).
    for (const code of ['CL', 'MZ', 'ID']) {
      expect(COUNTRY_LABEL_AREAS_KM2[code], code).toBeGreaterThanOrEqual(TIER_1_MIN_AREA_KM2)
      expect(tierOf(code), code).toBe(2)
    }
    expect(countryLabelTier({ code: 'XX', areaKm2: 700_000 })).toBe(1)
    expect(countryLabelTier({ code: 'XX', areaKm2: 699_900 })).toBe(2)
    expect(countryLabelTier({ code: 'XX', areaKm2: 85_000 })).toBe(2)
    expect(countryLabelTier({ code: 'XX', areaKm2: 84_900 })).toBe(3)
  })

  it('tasarımın örnekleri ve D-095’in 59 ülkesinin kademe sayıları (10 / 20 / 29) değişmedi', () => {
    for (const code of ['TR', 'IR', 'IQ', 'EG', 'SA', 'RU', 'LY', 'DZ', 'KZ']) {
      expect(tierOf(code), code).toBe(1)
    }
    for (const code of ['GR', 'BG', 'RO', 'SY', 'JO', 'AZ', 'UA', 'PL', 'IT', 'DE']) {
      expect(tierOf(code), code).toBe(2)
    }
    for (const code of ['GE', 'AM', 'CY', 'LB', 'RS', 'MK', 'AL', 'XK', 'ME', 'BH', 'QA', 'KW']) {
      expect(tierOf(code), code).toBe(3)
    }
    const counts = [1, 2, 3].map((tier) => curated.filter((code) => tierOf(code) === tier).length)
    expect(counts).toEqual([10, 20, 29])
  })

  it('Natural Earth’ten hesaplananlar: ABD, Çin, Hindistan ve Pakistan 1; Myanmar ve Japonya 2; Fransız Guyanası 3', () => {
    for (const code of ['US', 'CN', 'IN', 'BR', 'CA', 'AU', 'GL', 'PK']) {
      expect(tierOf(code), code).toBe(1)
    }
    for (const code of ['MM', 'JP', 'GB', 'NO', 'YE', 'PT']) expect(tierOf(code), code).toBe(2)
    for (const code of ['GF', 'TW', 'SJ', 'LK']) expect(tierOf(code), code).toBe(3)
    // Eşiğe yakın olanlar: Myanmar 665.000 km² (2), Fransız Guyanası 83.500 km² (3).
    expect(COUNTRY_LABEL_AREAS_KM2.MM).toBeLessThan(TIER_1_MIN_AREA_KM2)
    expect(COUNTRY_LABEL_AREAS_KM2.GF).toBeLessThan(TIER_2_MIN_AREA_KM2)
  })
})

describe('adı yazılmayanlar ve başkentte sabit ad', () => {
  it('İsrail ve Filistin yok; tabloda da yoklar', () => {
    expect(UNLABELLED_COUNTRIES).toEqual(['IL', 'PS'])
    for (const code of [...UNLABELLED_COUNTRIES, 'AQ']) {
      expect(COUNTRY_LABEL_AREAS_KM2).not.toHaveProperty(code)
    }
  })

  it('yalnız KIBRIS başkentinde, Lefkoşa’da (D-095)', () => {
    expect(COUNTRY_LABEL_CAPITAL_ANCHORS).toEqual({
      CY: { capital: { tr: 'Lefkoşa', en: 'Nicosia' }, lat: 35.17, lon: 33.36 },
    })
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
    expect(countryLabelText('TT', 'en')).toBe('TRINIDAD AND TOBAGO')
  })

  it('elle tutulan adlar (D-100): iki Kongo resmî adıyla, MYANMAR ayraçsız, FİLDİŞİ SAHİLİ Türkçe, SVALBARD', () => {
    expect(countryLabelText('CD', 'tr')).toBe('KONGO DEMOKRATİK CUMHURİYETİ')
    expect(countryLabelText('CD', 'en')).toBe('DEMOCRATIC REPUBLIC OF THE CONGO')
    expect(countryLabelText('CG', 'tr')).toBe('KONGO CUMHURİYETİ')
    expect(countryLabelText('CG', 'en')).toBe('REPUBLIC OF THE CONGO')
    expect(countryLabelText('MM', 'tr')).toBe('MYANMAR')
    expect(countryLabelText('MM', 'en')).toBe('MYANMAR')
    expect(countryLabelText('CI', 'tr')).toBe('FİLDİŞİ SAHİLİ')
    expect(countryLabelText('CI', 'en')).toBe('CÔTE D’IVOIRE')
    expect(countryLabelText('SJ', 'tr')).toBe('SVALBARD')
    expect(countryLabelText('SJ', 'en')).toBe('SVALBARD')
  })

  it('hiçbir adda ayraç, " - " ya da "&" yok (iki dilde, tablonun bütün kodları)', () => {
    for (const code of Object.keys(COUNTRY_LABEL_AREAS_KM2)) {
      for (const locale of ['tr', 'en'] as const) {
        const name = countryName(code, locale)
        expect(name, `${code} ${locale}`).not.toMatch(/[()&]| - /)
      }
    }
  })

  it('tablodaki her ülkenin adı countryName’in büyük harfidir; Intl adını bilir; küçük harf yok', () => {
    for (const code of Object.keys(COUNTRY_LABEL_AREAS_KM2)) {
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
