import type { WeatherGroup, WxDescriptor, WxIntensity, WxPhenomenon } from './schema'

/**
 * Hâlihazır hava grubu çözücüsü (WMO Code 4678; MGM Havacılık Meteorolojisi IV.1.3.5; WMO-782
 * s. 13–16). Dilbilgisi: `[RE][-|+|VC][tanımlayıcı][olay×0–3]`; yalnız `TS` ve `VCSH` de geçerlidir.
 * MGM'nin kullanmadığı `UP`, `SHPL` ve benzerleri de kabul edilir (otomatik ya da yabancı raporlar).
 */
const WX_RE =
  /^(RE)?([-+]|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS){0,3})$/

export interface ParsedWeatherGroup extends WeatherGroup {
  /** `RE` önekli (son saatteki hava). */
  recent: boolean
}

const PRECIPITATION: ReadonlySet<WxPhenomenon> = new Set([
  'DZ',
  'RA',
  'SN',
  'SG',
  'IC',
  'PL',
  'GR',
  'GS',
  'UP',
])

/** Metni hava grubu olarak çözer; dilbilgisine uymuyorsa null. */
export function parseWeatherGroup(token: string): ParsedWeatherGroup | null {
  const match = WX_RE.exec(token)
  if (!match) return null
  const [, re, sign, descriptor, codes = ''] = match
  const phenomena = (codes.match(/.{2}/g) ?? []) as WxPhenomenon[]
  const vicinity = sign === 'VC'
  // Olaysız grup yalnız oraj (TS) ya da çevrede sağanak (VCSH) olabilir.
  if (phenomena.length === 0 && !(descriptor === 'TS' || (descriptor === 'SH' && vicinity))) {
    return null
  }
  if (new Set(phenomena).size !== phenomena.length) return null
  const intensity: WxIntensity = sign === '-' ? 'light' : sign === '+' ? 'heavy' : 'moderate'
  return {
    raw: token,
    intensity,
    vicinity,
    descriptor: (descriptor as WxDescriptor | undefined) ?? null,
    phenomena,
    recent: re === 'RE',
  }
}

/** Grubu sözleşmedeki biçime indirger (`recent` alanı listeden anlaşılır). */
export function toWeatherGroup(group: ParsedWeatherGroup): WeatherGroup {
  return {
    raw: group.raw,
    intensity: group.intensity,
    vicinity: group.vicinity,
    descriptor: group.descriptor,
    phenomena: group.phenomena,
  }
}

const has = (g: WeatherGroup, ...codes: WxPhenomenon[]) =>
  codes.some((code) => g.phenomena.includes(code))

/** Yağmur türü (yağmur, çisenti) içeren grup. */
export const isRainGroup = (g: WeatherGroup) => has(g, 'RA', 'DZ')
/** Kar türü (kar, kar taneleri, buz taneleri, buz kristalleri; savrulan/sürüklenen kar dahil). */
export const isSnowGroup = (g: WeatherGroup) => has(g, 'SN', 'SG', 'PL', 'IC')
export const isThunderGroup = (g: WeatherGroup) => g.descriptor === 'TS'
/** Sis ailesi (sığ, parçalı, kısmi, donan sis dahil). */
export const isFogGroup = (g: WeatherGroup) => has(g, 'FG')
export const isHailGroup = (g: WeatherGroup) => has(g, 'GR', 'GS')
export const isUnknownPrecipitationGroup = (g: WeatherGroup) => has(g, 'UP')
/** Toz/kum ailesi ve öteki olaylar (duman, volkanik kül, ani kuvvetli rüzgâr, hortum, sprey). */
export const isOtherGroup = (g: WeatherGroup) =>
  has(g, 'DU', 'SA', 'PO', 'SS', 'DS', 'FU', 'VA', 'SQ', 'FC', 'PY')
export const isDustSandGroup = (g: WeatherGroup) => has(g, 'DU', 'SA', 'PO', 'SS', 'DS')
export const isPrecipitationGroup = (g: WeatherGroup) =>
  g.phenomena.some((p) => PRECIPITATION.has(p))

/**
 * Önem sırası (1 en önemli), MGM meydan uyarı listesine göre (Havacılık Meteorolojisi VI.1; brief §5):
 * 1 FC/SQ/SS/DS/VA, 2 oraj, 3 donan yağış, 4 dolu, 5 kar ailesi, 6 sis, 7 yağmur ailesi,
 * 8 sığ/parçalı/kısmi sis, 9 pus, kuru pus, duman, toz, kum. Sis yağmurdan önce gelir: "-DZ FG" sistir.
 * Çevredeki (VC) gruplar havalimanındakilerin hepsinden sonra gelir (+10).
 */
export function weatherRank(g: WeatherGroup): number {
  const base = (() => {
    if (has(g, 'FC', 'SQ', 'SS', 'DS', 'VA')) return 1
    if (g.descriptor === 'TS') return 2
    if (g.descriptor === 'FZ' && has(g, 'RA', 'DZ', 'UP')) return 3
    if (isHailGroup(g)) return 4
    if (isSnowGroup(g)) return 5
    if (has(g, 'FG') && (g.descriptor === null || g.descriptor === 'FZ')) return 6
    if (has(g, 'RA', 'DZ', 'UP')) return 7
    if (has(g, 'FG')) return 8
    return 9
  })()
  return g.vicinity ? base + 10 : base
}

const INTENSITY_ORDER: Record<WxIntensity, number> = { heavy: 0, moderate: 1, light: 2 }

/** Önem karşılaştırması: önce sıra, sonra şiddet (+ > orta > −), sonra rapordaki sıra (kararlı). */
export function compareWeatherSeverity(a: WeatherGroup, b: WeatherGroup): number {
  return (
    weatherRank(a) - weatherRank(b) || INTENSITY_ORDER[a.intensity] - INTENSITY_ORDER[b.intensity]
  )
}

/** Gruplardan en önemlisi; boşsa null. */
export function mostSevereGroup(groups: readonly WeatherGroup[]): WeatherGroup | null {
  let best: WeatherGroup | null = null
  for (const g of groups) if (best === null || compareWeatherSeverity(g, best) < 0) best = g
  return best
}

/**
 * Şiddet eki alan metin kimlikleri: `<id>_light`, `<id>`, `<id>_heavy`. Kalanlar tek biçimlidir;
 * `FC`, `SS` ve `DS`'nin kuvvetli biçimi ayrıca vardır (`+FC` hortum, `+SS`/`+DS` kuvvetli kum/toz fırtınası).
 */
const INTENSITY_PHRASES = [
  'DZ',
  'RA',
  'DZRA',
  'SN',
  'RASN',
  'SNRA',
  'SG',
  'PL',
  'GR',
  'GS',
  'UP',
  'SHRA',
  'SHSN',
  'SHRASN',
  'SHSNRA',
  'SHGR',
  'SHGS',
  'SHPL',
  'SHUP',
  'TSRA',
  'TSSN',
  'TSRASN',
  'TSSNRA',
  'TSGR',
  'TSGS',
  'TSPL',
  'TSUP',
  'FZRA',
  'FZDZ',
  'FZUP',
] as const

/** Şiddetsiz metin kimlikleri. */
const PLAIN_PHRASES = [
  'IC',
  'TS',
  'VCSH',
  'VCTS',
  'BR',
  'FG',
  'FZFG',
  'MIFG',
  'BCFG',
  'PRFG',
  'HZ',
  'FU',
  'VA',
  'DU',
  'SA',
  'PY',
  'BLSN',
  'BLDU',
  'BLSA',
  'DRSN',
  'DRDU',
  'DRSA',
  'PO',
  'SQ',
  'FC',
  'SS',
  'DS',
] as const

const HEAVY_ONLY_PHRASES = ['FC', 'SS', 'DS'] as const

/**
 * Hava olayı metin kimliklerinin tamamı (`weather.wx.<id>`). Sabit ve kapalı bir listedir; her
 * grup bunlardan birine indirgenir (`weatherPhraseId`).
 */
export const WX_PHRASE_IDS: readonly string[] = [
  ...INTENSITY_PHRASES.flatMap((id) => [`${id}_light`, id, `${id}_heavy`]),
  ...PLAIN_PHRASES,
  ...HEAVY_ONLY_PHRASES.map((id) => `${id}_heavy`),
]

const INTENSITY_SET: ReadonlySet<string> = new Set(INTENSITY_PHRASES)
const PLAIN_SET: ReadonlySet<string> = new Set(PLAIN_PHRASES)

/** Yağmur ve karın sırası: önce yazılan baskındır (RASN çoğunlukla yağmur, SNRA çoğunlukla kar). */
function rainSnowOrder(g: WeatherGroup): 'RASN' | 'SNRA' {
  return g.phenomena.indexOf('RA') < g.phenomena.indexOf('SN') ? 'RASN' : 'SNRA'
}

/** Grubun şiddetsiz temel kimliği; kapalı listede yoksa ilk olayın kimliği. */
function basePhraseId(g: WeatherGroup): string {
  const d = g.descriptor
  const mixedRainSnow = has(g, 'RA') && has(g, 'SN')
  if (d === 'TS') {
    if (g.vicinity && g.phenomena.length === 0) return 'VCTS'
    if (g.phenomena.length === 0) return 'TS'
    if (has(g, 'GR')) return 'TSGR'
    if (has(g, 'GS')) return 'TSGS'
    if (mixedRainSnow) return `TS${rainSnowOrder(g)}`
    if (has(g, 'SN', 'SG', 'IC')) return 'TSSN'
    if (has(g, 'RA', 'DZ')) return 'TSRA'
    if (has(g, 'PL')) return 'TSPL'
    if (has(g, 'UP')) return 'TSUP'
    return 'TS'
  }
  if (d === 'SH') {
    if (g.phenomena.length === 0) return 'VCSH'
    if (has(g, 'GR')) return 'SHGR'
    if (has(g, 'GS')) return 'SHGS'
    if (mixedRainSnow) return `SH${rainSnowOrder(g)}`
    if (has(g, 'SN', 'SG', 'IC')) return 'SHSN'
    if (has(g, 'RA', 'DZ')) return 'SHRA'
    if (has(g, 'PL')) return 'SHPL'
    if (has(g, 'UP')) return 'SHUP'
  }
  if (d === 'FZ') {
    if (has(g, 'RA')) return 'FZRA'
    if (has(g, 'DZ')) return 'FZDZ'
    if (has(g, 'FG')) return 'FZFG'
    if (has(g, 'UP')) return 'FZUP'
  }
  if ((d === 'MI' || d === 'BC' || d === 'PR') && has(g, 'FG')) return `${d}FG`
  if (d === 'BL' || d === 'DR') {
    for (const code of ['SN', 'DU', 'SA'] as const) if (has(g, code)) return `${d}${code}`
  }
  // Tanımlayıcısız ya da kapalı listede olmayan birleşim.
  if (has(g, 'GR')) return 'GR'
  if (has(g, 'GS')) return 'GS'
  if (mixedRainSnow) return rainSnowOrder(g)
  if (has(g, 'RA') && has(g, 'DZ')) return 'DZRA'
  const first = g.phenomena[0]
  return first ?? 'UP'
}

/**
 * Grubun metin kimliği (`weather.wx.<id>`): ör. `-SHRA` → `SHRA_light`, `+TSRAGR` → `TSGR_heavy`,
 * `VCSH` → `VCSH`, `BR` → `BR`, `+FC` → `FC_heavy`. Çevre (VC) bilgisi kimliğe girmez (VCSH/VCTS
 * dışında); arayüz onu `weather.wx.vicinity` kalıbıyla sarar.
 */
export function weatherPhraseId(g: WeatherGroup): string {
  const base = basePhraseId(g)
  if (INTENSITY_SET.has(base)) {
    if (g.intensity === 'light') return `${base}_light`
    if (g.intensity === 'heavy') return `${base}_heavy`
    return base
  }
  if ((HEAVY_ONLY_PHRASES as readonly string[]).includes(base) && g.intensity === 'heavy') {
    return `${base}_heavy`
  }
  return PLAIN_SET.has(base) ? base : 'UP'
}
