/**
 * OurAirports pist kaplaması (`surface`) serbest metindir; aynı kaplama farklı yazılır (ASP, ASPH,
 * Asphalt, ASPHALT). Arayüz ham kodu bir anahtara çevirir, metni `surface.<anahtar>` i18n
 * iletisinden alır. Kodlar: OurAirports veri sözlüğü (ASP, CON, TURF, GRS, GRE, WATER, UNK;
 * https://ourairports.com/help/data-dictionary.html) ve kaynakta görülen DAFIF kodları: PEM
 * "kısmen beton, asfalt ya da bitümlü makadam", PER "kalıcı kaplama, ayrıntısı bilinmiyor".
 *
 * 5. halkada (D-109) ABD'nin FAA kodları kaplamanın durumunu sona ekler (ASPH-G "iyi", CONC-F
 * "orta", GRAVEL-P "kötü", WATER-E "mükemmel"): tanınmayan kodun sonundaki tek harfli durum eki
 * (-E, -G, -F, -P) atılıp kod yeniden aranır. Kaplamanın türü değişmez; durum gösterilmez.
 *
 * OurAirports düzenleyicisinin silme işaretleri ("DELETE", "Delete duplicate") kaplama değildir:
 * bu satırlar sunucuda gizlenir (`@havayolu/db` `isHiddenRunway`, D-109); burada `unknown`'dır.
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
  // 5. halka (D-109): asfalt betonu asfalt kaplamadır (Sendai RJNS); Manaus'un (SBEG) kodu PCN
  // değerini de taşır.
  'ASPHALT CONCRETE': 'asphalt',
  'ASPH 71/F/C/X/T': 'asphalt',
  CON: 'concrete',
  CONC: 'concrete',
  CONCRETE: 'concrete',
  // 5. halka (D-109): oluklu beton (Des Moines KDSM, Owensboro KOWB) ve çimento (Çin).
  'CONCRETE-GROOVED': 'concrete',
  'CONCRETE/GROOVED': 'concrete',
  CEMENT: 'concrete',
  CEM: 'concrete',
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
  // 5. halka (D-109): Toronto'nun (CYYZ) asfalt-beton yazımı ve DAFIF'in COP kodu ("composite"
  // sayıldı; Laoag RPVV, Quilpie YQLP; çevrimdışı doğrulanamadı).
  'ASP/CONC': 'mixed',
  COP: 'mixed',
  PER: 'paved',
  // 4. halka (D-101): türü yazılmamış sert ya da kaplamalı yüzey.
  HARD: 'paved',
  PAVED: 'paved',
  GRS: 'grass',
  GRASS: 'grass',
  // Rzeszów'ün (EPRZ) acil iniş şeridi; D-090.
  'GRS EMERGENCY STRIP': 'grass',
  // 5. halka (D-109): Ballina (AYBA) "çimli kara kil".
  'GRASSED BLACK CLAY': 'grass',
  TURF: 'grass',
  GROUND: 'dirt',
  DIRT: 'dirt',
  // 4. halka (D-101): kaplamasız zemin.
  UNPAVED: 'dirt',
  // 5. halka (D-109): kil (Avustralya'nın dokuz havalimanı) sıkıştırılmış toprak sayılır.
  CLA: 'dirt',
  GRE: 'gravel',
  GVL: 'gravel',
  GRAVEL: 'gravel',
  // 4. halka (D-101): sıkıştırılmış kırma taş ve laterit (Afrika'nın kırmızı toprak pistleri).
  'GRADED HARDCORE': 'gravel',
  LAT: 'gravel',
  // 5. halka (D-109): Kanada ve Alaska yazımları; çakıl-toprak karışımı (Orutsararmiut PAOR)
  // çakıl sayılır.
  GRVL: 'gravel',
  'GRVL-DIRT': 'gravel',
  'SAND/GRAVEL': 'gravel',
  'CRUSHED ROCK': 'gravel',
  'TREATED GRAVEL': 'gravel',
  SAN: 'sand',
  SAND: 'sand',
  WATER: 'water',
  UNK: 'unknown',
}

/** FAA kaplama durumu eki: -E mükemmel, -G iyi, -F orta, -P kötü (D-109). */
const FAA_CONDITION_SUFFIX = /-[EGFP]$/

const lookup = (code: string): RunwaySurfaceKey | undefined =>
  Object.hasOwn(SURFACE_CODES, code) ? SURFACE_CODES[code] : undefined

/**
 * Ham kaplama kodundan i18n anahtarı; boş ya da tanınmayan kod `unknown`. Kod tanınmazsa sonundaki
 * FAA durum eki atılıp bir kez daha aranır (ASPH-G → ASPH, GRVL-DIRT-F → GRVL-DIRT; D-109).
 */
export function runwaySurfaceKey(surface: string | null | undefined): RunwaySurfaceKey {
  const code = surface?.trim().toUpperCase() ?? ''
  const direct = lookup(code)
  if (direct !== undefined) return direct
  if (!FAA_CONDITION_SUFFIX.test(code)) return 'unknown'
  return lookup(code.replace(FAA_CONDITION_SUFFIX, '')) ?? 'unknown'
}
