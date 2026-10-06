/**
 * OurAirports pist kaplaması (`surface`) serbest metindir; aynı kaplama farklı yazılır (ASP, ASPH,
 * Asphalt, ASPHALT). Arayüz ham kodu bir anahtara çevirir, metni `surface.<anahtar>` i18n
 * iletisinden alır. Kodlar: OurAirports veri sözlüğü (ASP, CON, TURF, GRS, GRE, WATER, UNK;
 * https://ourairports.com/help/data-dictionary.html) ve kaynakta görülen DAFIF kodları: PEM
 * "kısmen beton, asfalt ya da bitümlü makadam", PER "kalıcı kaplama, ayrıntısı bilinmiyor".
 */
export const RUNWAY_SURFACE_KEYS = [
  'asphalt',
  'concrete',
  /** PEM: karışık kaplama (kısmen beton, asfalt ya da bitümlü makadam). */
  'mixed',
  /** PER: kalıcı kaplama, türü bilinmiyor. */
  'paved',
  'grass',
  /** Sıkıştırılmamış toprak zemin. */
  'dirt',
  'gravel',
  /** Kum (4. halka, D-101): Barra'nın (EGPR) kumsal pisti, Bosaso (HCMF). */
  'sand',
  'water',
  'unknown',
] as const
export type RunwaySurfaceKey = (typeof RUNWAY_SURFACE_KEYS)[number]

/** Büyük harfe çevrilmiş ham kod → anahtar. */
const SURFACE_CODES: Readonly<Record<string, RunwaySurfaceKey>> = {
  ASP: 'asphalt',
  ASPH: 'asphalt',
  ASPHALT: 'asphalt',
  // 4. halka (D-101): bitüm ve makadam asfalt kaplamadır (Hindistan, İskandinavya, Afrika).
  BIT: 'asphalt',
  BITUM: 'asphalt',
  MAC: 'asphalt',
  MACADAM: 'asphalt',
  CON: 'concrete',
  CONC: 'concrete',
  CONCRETE: 'concrete',
  PEM: 'mixed',
  // Kaynakta iki kaplamanın birlikte yazıldığı biçim (ör. Gabala/UBBQ): karışık kaplama.
  'ASPHALT/CONCRETE': 'mixed',
  'CONCRETE/ASPHALT': 'mixed',
  'ASP/CON': 'mixed',
  'CON/ASP': 'mixed',
  // 3. halkada Polonya'nın pistleri (Łódź, Wrocław, Rzeszów; D-090).
  'ASPH-CONC': 'mixed',
  'CONC-ASPH': 'mixed',
  'ASPH/CONC': 'mixed',
  'CONC/ASPH': 'mixed',
  // 4. halka (D-101): bileşik kaplama.
  COM: 'mixed',
  COMPOSITE: 'mixed',
  PER: 'paved',
  // 4. halka (D-101): türü yazılmamış sert ya da kaplamalı yüzey.
  HARD: 'paved',
  PAVED: 'paved',
  GRS: 'grass',
  GRASS: 'grass',
  // Rzeszów'ün (EPRZ) acil iniş şeridi; D-090.
  'GRS EMERGENCY STRIP': 'grass',
  TURF: 'grass',
  GROUND: 'dirt',
  DIRT: 'dirt',
  // 4. halka (D-101): kaplamasız zemin.
  UNPAVED: 'dirt',
  GRE: 'gravel',
  GVL: 'gravel',
  GRAVEL: 'gravel',
  // 4. halka (D-101): sıkıştırılmış kırma taş ve laterit (Afrika'nın kırmızı toprak pistleri).
  'GRADED HARDCORE': 'gravel',
  LAT: 'gravel',
  SAN: 'sand',
  SAND: 'sand',
  WATER: 'water',
  UNK: 'unknown',
}

/** Ham kaplama kodundan i18n anahtarı; boş ya da tanınmayan kod `unknown`. */
export function runwaySurfaceKey(surface: string | null | undefined): RunwaySurfaceKey {
  const code = surface?.trim().toUpperCase() ?? ''
  return Object.hasOwn(SURFACE_CODES, code) ? (SURFACE_CODES[code] ?? 'unknown') : 'unknown'
}
