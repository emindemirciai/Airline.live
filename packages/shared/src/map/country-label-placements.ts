/**
 * Ülke adlarının yeri ve ilk sığma yakınlaştırması (D-096). ÜRETİLMİŞ DOSYA: elle düzenlenmez;
 * `pnpm country-labels` `tools/fixtures/naturalearth/countries.json`'dan üretir
 * (tools/src/country-labels). Tools testi tabloyu fixture'dan yeniden hesaplar ve fark olursa
 * kırılır.
 *
 * Satır: ülke kodu → ad (tek satır; `countryLabelText`, üretimdeki Node/ICU CLDR'ından; harita
 * bu adı yazar) ve iki düzen: geniş ve dar (≤ 767 px) harita. Düzen değeri [boylam, enlem, ilk
 * sığma yakınlaştırması] ya da `null` (ad o düzende hiçbir yakınlaştırmada sınırın içine sığmaz,
 * yazılmaz). Çapa sığıyorsa başkenttir.
 */
import type { Locale } from '../locale'

/** [boylam, enlem, ilk sığma yakınlaştırması] ya da null (yazılmaz). */
export type CountryLabelPlacement = readonly [lon: number, lat: number, fitZoom: number] | null

export interface CountryLabelPlacementRow {
  readonly name: string
  readonly regular: CountryLabelPlacement
  readonly compact: CountryLabelPlacement
}

/** Tablonun üretim değişkenleri (tools/src/country-labels). */
export const COUNTRY_LABEL_PLACEMENT_PARAMS = {
  naturalEarth: '4.1.0 1:10m',
  worldAtlas: '2.0.2',
  simplifyKm: 0.5,
  safetyPx: 3,
  safetyKm: 2,
  latticeSteps: 100,
  capitalPreferenceZooms: 0.5,
  candidateToleranceZooms: 0.25,
  fitZoomStep: 0.25,
} as const

export const COUNTRY_LABEL_PLACEMENTS: Readonly<
  Record<Locale, Readonly<Record<string, CountryLabelPlacementRow>>>
> = {
  tr: {
    AE: {
      name: 'BİRLEŞİK ARAP EMİRLİKLERİ',
      regular: [54.15, 23.6, 5.5],
      compact: [54.15, 23.6, 5.5],
    },
    AF: { name: 'AFGANİSTAN', regular: [67.35, 35.4, 4], compact: [67.35, 35.4, 3.75] },
    AL: { name: 'ARNAVUTLUK', regular: [20.12, 40.8, 6.5], compact: [20.12, 40.8, 6.5] },
    AM: { name: 'ERMENİSTAN', regular: [44.51, 40.18, 6.25], compact: [44.51, 40.18, 6.25] },
    AT: { name: 'AVUSTURYA', regular: [15.28, 48.08, 4.75], compact: [15.28, 48.08, 4.75] },
    AZ: { name: 'AZERBAYCAN', regular: [48.12, 40.44, 5.75], compact: [48.12, 40.44, 5.5] },
    BA: { name: 'BOSNA-HERSEK', regular: [18.08, 43.96, 4.75], compact: [18.08, 43.96, 4.75] },
    BE: { name: 'BELÇİKA', regular: [4.35, 50.85, 5], compact: [4.35, 50.85, 5] },
    BG: { name: 'BULGARİSTAN', regular: [24.71, 42.56, 5.5], compact: [24.71, 42.56, 5] },
    BH: { name: 'BAHREYN', regular: null, compact: null },
    BY: { name: 'BELARUS', regular: [27.8, 53.8, 3.75], compact: [27.8, 53.8, 3.75] },
    CH: { name: 'İSVİÇRE', regular: [7.9, 46.8, 4.75], compact: [7.9, 46.8, 4.75] },
    CY: { name: 'KIBRIS', regular: [33.36, 35.17, 6.25], compact: [33.36, 35.17, 6.25] },
    CZ: { name: 'ÇEKYA', regular: [14.44, 50.08, 4.5], compact: [14.44, 50.08, 4.5] },
    DE: { name: 'ALMANYA', regular: [11.4, 52.3, 3.75], compact: [11.4, 52.3, 3.5] },
    DK: { name: 'DANİMARKA', regular: [9.28, 56.08, 5.75], compact: [9.28, 56.08, 5.75] },
    DZ: { name: 'CEZAYİR', regular: [3.15, 30.87, 3], compact: [3.15, 30.87, 3] },
    EE: { name: 'ESTONYA', regular: [24.99, 59.08, 4.75], compact: [24.99, 59.08, 4.75] },
    EG: { name: 'MISIR', regular: [28.99, 27.56, 3], compact: [28.99, 27.56, 3] },
    ES: { name: 'İSPANYA', regular: [-3.7, 40.42, 3.75], compact: [-3.7, 40.42, 3.5] },
    FR: { name: 'FRANSA', regular: [2.35, 48.86, 3.5], compact: [2.35, 48.86, 3.5] },
    GE: { name: 'GÜRCİSTAN', regular: [44.8, 41.71, 5], compact: [44.8, 41.71, 5] },
    GR: { name: 'YUNANİSTAN', regular: [21.69, 39.33, 6.25], compact: [21.69, 39.33, 6] },
    HR: { name: 'HIRVATİSTAN', regular: [16.8, 45.54, 5.25], compact: [16.8, 45.54, 5.25] },
    HU: { name: 'MACARİSTAN', regular: [19.04, 47.39, 5.25], compact: [19.04, 47.39, 4.75] },
    IQ: { name: 'IRAK', regular: [43.4, 32.7, 3.75], compact: [43.4, 32.7, 3.25] },
    IR: { name: 'İRAN', regular: [51.4, 35.4, 3], compact: [51.4, 35.4, 3] },
    IT: { name: 'İTALYA', regular: [9.96, 45, 4], compact: [9.96, 45, 3.75] },
    JO: { name: 'ÜRDÜN', regular: [36.65, 31.95, 5.5], compact: [36.65, 31.95, 5] },
    KW: { name: 'KUVEYT', regular: [47.62, 29.22, 6.25], compact: [47.62, 29.22, 6.25] },
    KZ: { name: 'KAZAKİSTAN', regular: [71.44, 51.17, 3.5], compact: [71.44, 51.17, 3] },
    LB: { name: 'LÜBNAN', regular: [36.04, 34.14, 6.75], compact: [36.04, 34.14, 6.75] },
    LT: { name: 'LİTVANYA', regular: [24.54, 55.14, 4.75], compact: [24.54, 55.14, 4.75] },
    LU: { name: 'LÜKSEMBURG', regular: null, compact: null },
    LV: { name: 'LETONYA', regular: [24.08, 56.8, 4.5], compact: [24.08, 56.8, 4.5] },
    LY: { name: 'LİBYA', regular: [14.08, 29.76, 3.25], compact: [14.08, 29.76, 3] },
    MD: { name: 'MOLDOVA', regular: [28.72, 47.16, 5.75], compact: [28.72, 47.16, 5.75] },
    ME: { name: 'KARADAĞ', regular: [19.26, 42.78, 6], compact: [19.26, 42.78, 6] },
    MK: { name: 'KUZEY MAKEDONYA', regular: [21.69, 41.85, 5.75], compact: [21.69, 41.85, 5.75] },
    MT: { name: 'MALTA', regular: null, compact: null },
    NL: { name: 'HOLLANDA', regular: [5.48, 52.28, 5.5], compact: [5.48, 52.28, 5.5] },
    OM: { name: 'UMMAN', regular: [57.4, 22.6, 4.5], compact: [57.4, 22.6, 4] },
    PL: { name: 'POLONYA', regular: [20.35, 51.81, 3.75], compact: [20.35, 51.81, 3.5] },
    QA: { name: 'KATAR', regular: [51.26, 25.18, 6.5], compact: [51.26, 25.18, 6.5] },
    RO: { name: 'ROMANYA', regular: [25, 45.2, 4], compact: [25, 45.2, 3.75] },
    RS: { name: 'SIRBİSTAN', regular: [20.45, 44.55, 5.25], compact: [20.45, 44.55, 5.25] },
    RU: { name: 'RUSYA', regular: [37.62, 55.76, 3], compact: [37.62, 55.76, 3] },
    SA: { name: 'SUUDİ ARABİSTAN', regular: [45.1, 23.98, 4], compact: [45.1, 23.98, 3.5] },
    SD: { name: 'SUDAN', regular: [32.56, 15.5, 3.5], compact: [32.56, 15.5, 3.25] },
    SE: { name: 'İSVEÇ', regular: [15.68, 59.92, 3.5], compact: [15.68, 59.92, 3.5] },
    SI: { name: 'SLOVENYA', regular: [14.51, 46.06, 5.75], compact: [14.51, 46.06, 5.75] },
    SK: { name: 'SLOVAKYA', regular: [18.48, 48.48, 4.75], compact: [18.48, 48.48, 4.75] },
    SY: { name: 'SURİYE', regular: [38.15, 35.28, 4], compact: [38.15, 35.28, 3.75] },
    TM: { name: 'TÜRKMENİSTAN', regular: [58.35, 38.7, 4.25], compact: [58.35, 38.7, 4] },
    TN: { name: 'TUNUS', regular: [9.36, 33.36, 5], compact: [9.36, 33.36, 4.75] },
    TR: { name: 'TÜRKİYE', regular: [33.2, 39.4, 3.25], compact: [33.2, 39.4, 3] },
    UA: { name: 'UKRAYNA', regular: [30.52, 50.45, 3.5], compact: [30.52, 50.45, 3.5] },
    UZ: { name: 'ÖZBEKİSTAN', regular: [63, 42.3, 4.5], compact: [63, 42.3, 4.25] },
    XK: { name: 'KOSOVA', regular: [21.08, 42.58, 6], compact: [21.08, 42.58, 6] },
  },
  en: {
    AE: {
      name: 'UNITED ARAB EMIRATES',
      regular: [54.15, 23.6, 5.25],
      compact: [54.15, 23.6, 5.25],
    },
    AF: { name: 'AFGHANISTAN', regular: [67.35, 35.4, 4], compact: [67.35, 35.4, 3.75] },
    AL: { name: 'ALBANIA', regular: [20.12, 40.8, 6], compact: [20.12, 40.8, 6] },
    AM: { name: 'ARMENIA', regular: [44.51, 40.18, 6], compact: [44.51, 40.18, 6] },
    AT: { name: 'AUSTRIA', regular: [15.28, 48.08, 4.5], compact: [15.28, 48.08, 4.5] },
    AZ: { name: 'AZERBAIJAN', regular: [48.12, 40.44, 5.75], compact: [48.12, 40.44, 5.5] },
    BA: {
      name: 'BOSNIA AND HERZEGOVINA',
      regular: [18.08, 43.96, 5.75],
      compact: [18.08, 43.96, 5.75],
    },
    BE: { name: 'BELGIUM', regular: [4.35, 50.85, 5], compact: [4.35, 50.85, 5] },
    BG: { name: 'BULGARIA', regular: [24.71, 42.56, 4.75], compact: [24.71, 42.56, 4.5] },
    BH: { name: 'BAHRAIN', regular: null, compact: null },
    BY: { name: 'BELARUS', regular: [27.8, 53.8, 3.75], compact: [27.8, 53.8, 3.75] },
    CH: { name: 'SWITZERLAND', regular: [7.9, 46.8, 5.25], compact: [7.9, 46.8, 5.25] },
    CY: { name: 'CYPRUS', regular: [33.36, 35.17, 6.5], compact: [33.36, 35.17, 6.5] },
    CZ: { name: 'CZECHIA', regular: [14.44, 50.08, 4.5], compact: [14.44, 50.08, 4.5] },
    DE: { name: 'GERMANY', regular: [11.4, 52.3, 3.75], compact: [11.4, 52.3, 3.5] },
    DK: { name: 'DENMARK', regular: [9.28, 56.08, 5.5], compact: [9.28, 56.08, 5.5] },
    DZ: { name: 'ALGERIA', regular: [3.15, 30.87, 3], compact: [3.15, 30.87, 3] },
    EE: { name: 'ESTONIA', regular: [24.99, 59.08, 4.75], compact: [24.99, 59.08, 4.75] },
    EG: { name: 'EGYPT', regular: [28.99, 27.56, 3.25], compact: [28.99, 27.56, 3] },
    ES: { name: 'SPAIN', regular: [-3.7, 40.42, 3.5], compact: [-3.7, 40.42, 3.5] },
    FR: { name: 'FRANCE', regular: [2.35, 48.86, 3.5], compact: [2.35, 48.86, 3.5] },
    GE: { name: 'GEORGIA', regular: [44.8, 41.71, 4.75], compact: [44.8, 41.71, 4.75] },
    GR: { name: 'GREECE', regular: [21.69, 39.33, 5.5], compact: [21.69, 39.33, 5.25] },
    HR: { name: 'CROATIA', regular: [16.8, 45.54, 4.75], compact: [16.8, 45.54, 4.75] },
    HU: { name: 'HUNGARY', regular: [19.04, 47.39, 4.5], compact: [19.04, 47.39, 4.25] },
    IQ: { name: 'IRAQ', regular: [43.4, 32.7, 3.75], compact: [43.4, 32.7, 3.25] },
    IR: { name: 'IRAN', regular: [51.4, 35.4, 3], compact: [51.4, 35.4, 3] },
    IT: { name: 'ITALY', regular: [9.96, 45, 3.75], compact: [9.96, 45, 3.5] },
    JO: { name: 'JORDAN', regular: [36.65, 31.95, 5.75], compact: [36.65, 31.95, 5.25] },
    KW: { name: 'KUWAIT', regular: [47.62, 29.22, 6.25], compact: [47.62, 29.22, 6.25] },
    KZ: { name: 'KAZAKHSTAN', regular: [71.44, 51.17, 3.5], compact: [71.44, 51.17, 3] },
    LB: { name: 'LEBANON', regular: [36.04, 34.14, 6.75], compact: [36.04, 34.14, 6.75] },
    LT: { name: 'LITHUANIA', regular: [24.54, 55.14, 4.75], compact: [24.54, 55.14, 4.75] },
    LU: { name: 'LUXEMBOURG', regular: null, compact: null },
    LV: { name: 'LATVIA', regular: [24.08, 56.8, 4.5], compact: [24.08, 56.8, 4.5] },
    LY: { name: 'LIBYA', regular: [14.08, 29.76, 3.25], compact: [14.08, 29.76, 3] },
    MD: { name: 'MOLDOVA', regular: [28.72, 47.16, 5.75], compact: [28.72, 47.16, 5.75] },
    ME: { name: 'MONTENEGRO', regular: [19.26, 42.78, 6.5], compact: [19.26, 42.78, 6.5] },
    MK: { name: 'NORTH MACEDONIA', regular: [21.69, 41.85, 5.75], compact: [21.69, 41.85, 5.75] },
    MT: { name: 'MALTA', regular: null, compact: null },
    NL: { name: 'NETHERLANDS', regular: [5.48, 52.28, 6], compact: [5.48, 52.28, 6] },
    OM: { name: 'OMAN', regular: [57.4, 22.6, 4], compact: [57.4, 22.6, 3.75] },
    PL: { name: 'POLAND', regular: [20.35, 51.81, 3.5], compact: [20.35, 51.81, 3.5] },
    QA: { name: 'QATAR', regular: [51.26, 25.18, 6.5], compact: [51.26, 25.18, 6.5] },
    RO: { name: 'ROMANIA', regular: [25, 45.2, 3.75], compact: [25, 45.2, 3.75] },
    RS: { name: 'SERBIA', regular: [20.45, 44.55, 4.75], compact: [20.45, 44.55, 4.75] },
    RU: { name: 'RUSSIA', regular: [37.62, 55.76, 3], compact: [37.62, 55.76, 3] },
    SA: { name: 'SAUDI ARABIA', regular: [45.1, 23.98, 3.25], compact: [45.1, 23.98, 3] },
    SD: { name: 'SUDAN', regular: [32.56, 15.5, 3.5], compact: [32.56, 15.5, 3.25] },
    SE: { name: 'SWEDEN', regular: [15.68, 59.92, 3.75], compact: [15.68, 59.92, 3.5] },
    SI: { name: 'SLOVENIA', regular: [14.51, 46.06, 5.75], compact: [14.51, 46.06, 5.75] },
    SK: { name: 'SLOVAKIA', regular: [18.48, 48.48, 4.75], compact: [18.48, 48.48, 4.75] },
    SY: { name: 'SYRIA', regular: [38.15, 35.28, 3.75], compact: [38.15, 35.28, 3.5] },
    TM: { name: 'TURKMENISTAN', regular: [58.35, 38.7, 4.25], compact: [58.35, 38.7, 4] },
    TN: { name: 'TUNISIA', regular: [9.36, 33.36, 5.5], compact: [9.36, 33.36, 5] },
    TR: { name: 'TÜRKIYE', regular: [33.2, 39.4, 3.25], compact: [33.2, 39.4, 3] },
    UA: { name: 'UKRAINE', regular: [30.52, 50.45, 3.5], compact: [30.52, 50.45, 3.5] },
    UZ: { name: 'UZBEKISTAN', regular: [63, 42.3, 4.5], compact: [63, 42.3, 4.25] },
    XK: { name: 'KOSOVO', regular: [21.08, 42.58, 6], compact: [21.08, 42.58, 6] },
  },
}
