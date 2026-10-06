/**
 * Ülke adlarının yeri ve ilk sığma yakınlaştırması (D-096, D-099). ÜRETİLMİŞ DOSYA: elle
 * düzenlenmez; `pnpm country-labels` `tools/fixtures/naturalearth/countries.json`'dan ve
 * `tools/fixtures/ourairports/airports.csv`'nin haritada pini çizilen havalimanlarından
 * (listelenenler, askerî hava üsleri hariç; D-103) üretir (tools/src/country-labels). Tools testi
 * tabloyu fixture'lardan yeniden hesaplar ve fark olursa kırılır.
 *
 * Satır: ülke kodu → ad (tek satır; `countryLabelText`, üretimdeki Node/ICU CLDR'ından; harita
 * bu adı yazar) ve iki düzen: geniş ve dar (≤ 767 px) harita. Düzen değeri [boylam, enlem, ilk
 * sığma yakınlaştırması] ya da `null` (ad o düzende hiçbir yakınlaştırmada sınırın içine sığmaz,
 * yazılmaz). Çapa ülkenin içinde, havalimanı pinlerinden ve kodlarından (modelin saydığı
 * kutularla) uzak boş bir yerdedir (D-099); KIBRIS kullanıcı kararıyla Lefkoşa'dadır (D-095).
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
  clearMaxDelayZooms: 1.5,
  crowdedMaxDelayZooms: 0.25,
  airportPins: 1217,
  airportCodeMinZoom: 5,
  airportCodeSides: ['right', 'left'],
  capitalAnchored: ['CY'],
  fitZoomStep: 0.25,
} as const

export const COUNTRY_LABEL_PLACEMENTS: Readonly<
  Record<Locale, Readonly<Record<string, CountryLabelPlacementRow>>>
> = {
  tr: {
    AE: {
      name: 'BİRLEŞİK ARAP EMİRLİKLERİ',
      regular: [53.9, 23.55, 5.25],
      compact: [53.9, 23.55, 5.25],
    },
    AF: { name: 'AFGANİSTAN', regular: [65.4, 33.6, 3.75], compact: [65.4, 33.6, 3.5] },
    AL: { name: 'ARNAVUTLUK', regular: [20.2, 40.64, 6.25], compact: [20.2, 40.64, 6.25] },
    AM: { name: 'ERMENİSTAN', regular: [44.52, 40.48, 6], compact: [44.52, 40.48, 6] },
    AT: { name: 'AVUSTURYA', regular: [14.64, 47.6, 5], compact: [14.64, 47.6, 5] },
    AZ: { name: 'AZERBAYCAN', regular: [47.52, 40.56, 5.5], compact: [47.52, 40.56, 5.25] },
    BA: { name: 'BOSNA-HERSEK', regular: [17.44, 44.28, 5.25], compact: [17.44, 44.28, 5.25] },
    BE: { name: 'BELÇİKA', regular: [5.28, 50.36, 5.5], compact: [5.28, 50.36, 5.5] },
    BG: { name: 'BULGARİSTAN', regular: [24.99, 43.33, 5.5], compact: [24.99, 43.33, 5.25] },
    BH: { name: 'BAHREYN', regular: null, compact: null },
    BY: { name: 'BELARUS', regular: [27.9, 53.5, 3.5], compact: [27.9, 53.5, 3.5] },
    CH: { name: 'İSVİÇRE', regular: [8.15, 46.75, 5], compact: [8.15, 46.75, 5] },
    CY: { name: 'KIBRIS', regular: [33.36, 35.17, 6.25], compact: [33.36, 35.17, 6.25] },
    CZ: { name: 'ÇEKYA', regular: [14.28, 49.84, 4.5], compact: [14.28, 49.84, 4.5] },
    DE: { name: 'ALMANYA', regular: [9.9, 50.7, 4.25], compact: [9.9, 50.7, 4] },
    DK: { name: 'DANİMARKA', regular: [9.28, 56.08, 5.75], compact: [9.28, 56.08, 5.75] },
    DZ: { name: 'CEZAYİR', regular: [2.31, 26.04, 3], compact: [2.31, 26.04, 3] },
    EE: { name: 'ESTONYA', regular: [25.83, 58.87, 4.5], compact: [25.83, 58.87, 4.5] },
    EG: { name: 'MISIR', regular: [28.73, 24.96, 3.25], compact: [28.73, 24.96, 3] },
    ES: { name: 'İSPANYA', regular: [-3.68, 40.02, 3.75], compact: [-3.68, 40.02, 3.5] },
    FR: { name: 'FRANSA', regular: [3.9, 48.15, 3.5], compact: [3.9, 48.15, 3.5] },
    GE: { name: 'GÜRCİSTAN', regular: [44.38, 42.28, 5.25], compact: [44.38, 42.28, 5.25] },
    GR: { name: 'YUNANİSTAN', regular: [21.33, 39.51, 6.5], compact: [21.33, 39.51, 6] },
    HR: { name: 'HIRVATİSTAN', regular: [16.68, 45.54, 5.5], compact: [16.68, 45.54, 5.5] },
    HU: { name: 'MACARİSTAN', regular: [18.55, 47.25, 5.5], compact: [18.55, 47.25, 5.25] },
    IQ: { name: 'IRAK', regular: [41.6, 33, 4], compact: [41.6, 33, 3.5] },
    IR: { name: 'İRAN', regular: [55.6, 34, 3], compact: [55.6, 34, 3] },
    IT: { name: 'İTALYA', regular: [11.4, 46.2, 5.25], compact: [11.4, 46.2, 5] },
    JO: { name: 'ÜRDÜN', regular: [36.45, 30.6, 5.25], compact: [36.45, 30.6, 5] },
    KW: { name: 'KUVEYT', regular: [47.48, 29.7, 6.25], compact: [47.48, 29.7, 6.25] },
    KZ: { name: 'KAZAKİSTAN', regular: [58.22, 48.79, 3], compact: [58.22, 48.79, 3] },
    LB: { name: 'LÜBNAN', regular: [36.06, 34.18, 6.5], compact: [36.06, 34.18, 6.5] },
    LT: { name: 'LİTVANYA', regular: [24.3, 55.44, 4.5], compact: [24.3, 55.44, 4.5] },
    LU: { name: 'LÜKSEMBURG', regular: null, compact: null },
    LV: { name: 'LETONYA', regular: [26.08, 56.8, 4.5], compact: [26.08, 56.8, 4.5] },
    LY: { name: 'LİBYA', regular: [20.16, 26.4, 3], compact: [20.16, 26.4, 3] },
    MD: { name: 'MOLDOVA', regular: [28.28, 47.72, 5.5], compact: [28.28, 47.72, 5.5] },
    ME: { name: 'KARADAĞ', regular: [19.24, 42.86, 5.75], compact: [19.24, 42.86, 5.75] },
    MK: { name: 'KUZEY MAKEDONYA', regular: [21.63, 41.58, 5.5], compact: [21.63, 41.58, 5.5] },
    MT: { name: 'MALTA', regular: null, compact: null },
    NL: { name: 'HOLLANDA', regular: [5.76, 52.24, 5.5], compact: [5.76, 52.24, 5.5] },
    OM: { name: 'UMMAN', regular: [54.6, 18.7, 4.25], compact: [54.6, 18.7, 4] },
    PL: { name: 'POLONYA', regular: [21.12, 53.24, 4.25], compact: [21.12, 53.24, 4] },
    QA: { name: 'KATAR', regular: [51.2, 25.1, 6.25], compact: [51.2, 25.1, 6.25] },
    RO: { name: 'ROMANYA', regular: [25.5, 45.4, 4.25], compact: [25.5, 45.4, 4] },
    RS: { name: 'SIRBİSTAN', regular: [20.8, 44.3, 5], compact: [20.8, 44.3, 5] },
    RU: { name: 'RUSYA', regular: [57.51, 61.77, 3], compact: [57.51, 61.77, 3] },
    SA: { name: 'SUUDİ ARABİSTAN', regular: [46.64, 23.1, 4.25], compact: [46.64, 23.1, 4] },
    SD: { name: 'SUDAN', regular: [29.58, 18.02, 3], compact: [29.58, 18.02, 3] },
    SE: { name: 'İSVEÇ', regular: [20.02, 66.78, 3.5], compact: [20.02, 66.78, 3.5] },
    SI: { name: 'SLOVENYA', regular: [14.64, 46.12, 5.5], compact: [14.64, 46.12, 5.5] },
    SK: { name: 'SLOVAKYA', regular: [19.2, 48.54, 5.25], compact: [19.2, 48.54, 5.25] },
    SY: { name: 'SURİYE', regular: [38.64, 35.28, 3.75], compact: [38.64, 35.28, 3.5] },
    TM: { name: 'TÜRKMENİSTAN', regular: [58.65, 39.15, 4], compact: [58.65, 39.15, 3.75] },
    TN: { name: 'TUNUS', regular: [9.76, 32.96, 4.75], compact: [9.76, 32.96, 4.5] },
    TR: { name: 'TÜRKİYE', regular: [33.8, 39.4, 3.25], compact: [33.8, 39.4, 3] },
    UA: { name: 'UKRAYNA', regular: [32.49, 49.4, 3.5], compact: [32.49, 49.4, 3.5] },
    UZ: { name: 'ÖZBEKİSTAN', regular: [63, 42.3, 4.5], compact: [63, 42.3, 4.25] },
    XK: { name: 'KOSOVA', regular: [20.86, 42.48, 5.75], compact: [20.86, 42.48, 5.75] },
  },
  en: {
    AE: { name: 'UNITED ARAB EMIRATES', regular: [53.9, 23.55, 5], compact: [53.9, 23.55, 5] },
    AF: { name: 'AFGHANISTAN', regular: [65.4, 33.6, 4], compact: [65.4, 33.6, 3.75] },
    AL: { name: 'ALBANIA', regular: [20.2, 40.64, 5.75], compact: [20.2, 40.64, 5.75] },
    AM: { name: 'ARMENIA', regular: [44.52, 40.48, 5.5], compact: [44.52, 40.48, 5.5] },
    AT: { name: 'AUSTRIA', regular: [14.64, 47.6, 4.5], compact: [14.64, 47.6, 4.5] },
    AZ: { name: 'AZERBAIJAN', regular: [47.52, 40.56, 5.5], compact: [47.52, 40.56, 5.25] },
    BA: {
      name: 'BOSNIA AND HERZEGOVINA',
      regular: [17.44, 44.28, 5.75],
      compact: [17.44, 44.28, 5.75],
    },
    BE: { name: 'BELGIUM', regular: [5.28, 50.36, 5.5], compact: [5.28, 50.36, 5.5] },
    BG: { name: 'BULGARIA', regular: [24.99, 43.33, 5], compact: [24.99, 43.33, 4.5] },
    BH: { name: 'BAHRAIN', regular: null, compact: null },
    BY: { name: 'BELARUS', regular: [27.9, 53.5, 3.5], compact: [27.9, 53.5, 3.5] },
    CH: { name: 'SWITZERLAND', regular: [8.15, 46.75, 5], compact: [8.15, 46.75, 5] },
    CY: { name: 'CYPRUS', regular: [33.36, 35.17, 6.5], compact: [33.36, 35.17, 6.5] },
    CZ: { name: 'CZECHIA', regular: [14.28, 49.84, 4.5], compact: [14.28, 49.84, 4.5] },
    DE: { name: 'GERMANY', regular: [9.9, 50.7, 4.25], compact: [9.9, 50.7, 4] },
    DK: { name: 'DENMARK', regular: [9.28, 56.08, 5.5], compact: [9.28, 56.08, 5.5] },
    DZ: { name: 'ALGERIA', regular: [2.31, 26.04, 3], compact: [2.31, 26.04, 3] },
    EE: { name: 'ESTONIA', regular: [25.83, 58.87, 4.5], compact: [25.83, 58.87, 4.5] },
    EG: { name: 'EGYPT', regular: [28.73, 24.96, 3.5], compact: [28.73, 24.96, 3] },
    ES: { name: 'SPAIN', regular: [-3.68, 40.02, 3.5], compact: [-3.68, 40.02, 3.5] },
    FR: { name: 'FRANCE', regular: [3.9, 48.15, 3.5], compact: [3.9, 48.15, 3.5] },
    GE: { name: 'GEORGIA', regular: [44.38, 42.28, 5], compact: [44.38, 42.28, 5] },
    GR: { name: 'GREECE', regular: [21.33, 39.51, 5.75], compact: [21.33, 39.51, 5.5] },
    HR: { name: 'CROATIA', regular: [16.68, 45.54, 4.75], compact: [16.68, 45.54, 4.75] },
    HU: { name: 'HUNGARY', regular: [18.55, 47.25, 5], compact: [18.55, 47.25, 4.5] },
    IQ: { name: 'IRAQ', regular: [41.6, 33, 4], compact: [41.6, 33, 3.5] },
    IR: { name: 'IRAN', regular: [55.6, 34, 3], compact: [55.6, 34, 3] },
    IT: { name: 'ITALY', regular: [11.4, 46.2, 4.75], compact: [11.4, 46.2, 4.5] },
    JO: { name: 'JORDAN', regular: [36.45, 30.6, 5.5], compact: [36.45, 30.6, 5.25] },
    KW: { name: 'KUWAIT', regular: [47.48, 29.7, 6.25], compact: [47.48, 29.7, 6.25] },
    KZ: { name: 'KAZAKHSTAN', regular: [58.22, 48.79, 3], compact: [58.22, 48.79, 3] },
    LB: { name: 'LEBANON', regular: [36.06, 34.18, 6.75], compact: [36.06, 34.18, 6.75] },
    LT: { name: 'LITHUANIA', regular: [24.3, 55.44, 4.5], compact: [24.3, 55.44, 4.5] },
    LU: { name: 'LUXEMBOURG', regular: null, compact: null },
    LV: { name: 'LATVIA', regular: [26.08, 56.8, 4.5], compact: [26.08, 56.8, 4.5] },
    LY: { name: 'LIBYA', regular: [20.16, 26.4, 3], compact: [20.16, 26.4, 3] },
    MD: { name: 'MOLDOVA', regular: [28.28, 47.72, 5.5], compact: [28.28, 47.72, 5.5] },
    ME: { name: 'MONTENEGRO', regular: [19.24, 42.86, 6.25], compact: [19.24, 42.86, 6.25] },
    MK: { name: 'NORTH MACEDONIA', regular: [21.63, 41.58, 5.5], compact: [21.63, 41.58, 5.5] },
    MT: { name: 'MALTA', regular: null, compact: null },
    NL: { name: 'NETHERLANDS', regular: [5.76, 52.24, 5.75], compact: [5.76, 52.24, 5.75] },
    OM: { name: 'OMAN', regular: [54.6, 18.7, 3.75], compact: [54.6, 18.7, 3.5] },
    PL: { name: 'POLAND', regular: [21.12, 53.24, 4], compact: [21.12, 53.24, 3.75] },
    QA: { name: 'QATAR', regular: [51.2, 25.1, 6.25], compact: [51.2, 25.1, 6.25] },
    RO: { name: 'ROMANIA', regular: [25.5, 45.4, 4.25], compact: [25.5, 45.4, 4] },
    RS: { name: 'SERBIA', regular: [20.8, 44.3, 4.75], compact: [20.8, 44.3, 4.75] },
    RU: { name: 'RUSSIA', regular: [57.51, 61.77, 3], compact: [57.51, 61.77, 3] },
    SA: { name: 'SAUDI ARABIA', regular: [46.64, 23.1, 3.5], compact: [46.64, 23.1, 3.25] },
    SD: { name: 'SUDAN', regular: [29.58, 18.02, 3], compact: [29.58, 18.02, 3] },
    SE: { name: 'SWEDEN', regular: [20.02, 66.78, 3.5], compact: [20.02, 66.78, 3.5] },
    SI: { name: 'SLOVENIA', regular: [14.64, 46.12, 5.5], compact: [14.64, 46.12, 5.5] },
    SK: { name: 'SLOVAKIA', regular: [19.2, 48.54, 5.25], compact: [19.2, 48.54, 5.25] },
    SY: { name: 'SYRIA', regular: [38.64, 35.28, 3.5], compact: [38.64, 35.28, 3.5] },
    TM: { name: 'TURKMENISTAN', regular: [58.65, 39.15, 4], compact: [58.65, 39.15, 3.75] },
    TN: { name: 'TUNISIA', regular: [9.76, 32.96, 5.25], compact: [9.76, 32.96, 4.75] },
    TR: { name: 'TÜRKIYE', regular: [33.8, 39.4, 3.25], compact: [33.8, 39.4, 3] },
    UA: { name: 'UKRAINE', regular: [32.49, 49.4, 3.5], compact: [32.49, 49.4, 3.5] },
    UZ: { name: 'UZBEKISTAN', regular: [63, 42.3, 4.5], compact: [63, 42.3, 4.25] },
    XK: { name: 'KOSOVO', regular: [20.86, 42.48, 5.75], compact: [20.86, 42.48, 5.75] },
  },
}
