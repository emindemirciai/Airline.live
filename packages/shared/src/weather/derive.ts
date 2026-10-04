import { ktToKmh } from './phrase'
import {
  WIND_LEVELS,
  type CloudCover,
  type DecodedMetar,
  type Headline,
  type LightWind,
  type MetarDerived,
  type Sky,
  type WeatherFlags,
  type WeatherGroup,
  type WeatherIconCategory,
  type Wind,
  type WindLevel,
  type WindTier,
} from './schema'
import {
  isDustSandGroup,
  isFogGroup,
  isHailGroup,
  isRainGroup,
  isSnowGroup,
  isThunderGroup,
  isUnknownPrecipitationGroup,
  mostSevereGroup,
  weatherPhraseId,
} from './wx'

/** Kuvvetli rüzgâr eşikleri, kt (MGM meydan uyarısı; Havacılık Meteorolojisi VI.1). */
export const STRONG_WIND_MEAN_KT = 20
export const STRONG_WIND_GUST_KT = 30

/**
 * Rüzgâr satırının vurgu eşikleri, kt (kullanıcı kararı 2026-10-03, D-083): ortalama MGM Beaufort 5
 * ("Sert rüzgâr", 17–21 kt) ya da hamle 25 kt (46 km/sa). Meydan uyarısı eşiğinin altındadır;
 * `isStrongWind` ve API'deki `derived.strongWind` değişmedi.
 */
export const FRESH_WIND_MEAN_KT = 17
export const GUSTY_WIND_GUST_KT = 25

/**
 * Hafif rüzgârın üst sınırı, km/sa (kullanıcı kararı 2026-10-03, D-083: "rüzgâr 10 km ve altında ise
 * açık yeşil"). Gösterilen km/sa değerine göredir (`Wind.speedKmh`, yoksa kt'den çevrilen): KT
 * raporunda 5 kt (9 km/sa) hafiftir, 6 kt (11 km/sa) değildir; MPS raporunda 2 m/s (7 km/sa) hafif,
 * 3 m/s (11 km/sa) değildir.
 */
export const LIGHT_WIND_MAX_KMH = 10

/**
 * "Tatlı rüzgâr"ın (`breeze`) üst sınırı, km/sa (kullanıcı isteği 2026-10-04, D-083): gösterilen hız
 * 11–19 km/sa limon yeşili, 20 km/sa ve üstü (vurgu eşiğine kadar) sarı "Orta rüzgâr"dır. Sınır
 * hafif rüzgârınki gibi gösterilen km/sa'dadır: KT raporunda 10 kt (19 km/sa) tatlı, 11 kt (20 km/sa)
 * orta; 16 kt (30 km/sa) orta, 17 kt (31 km/sa) kehribar "Sert rüzgâr". MGM Beaufort ıskalasında 3
 * "Tatlı Rüzgâr" 7–10 kt, 4 "Orta Rüzgâr" 11–16 kt'dir. Alt uç MGM'ye uymaz: 6 kt (11 km/sa, 3 m/s)
 * MGM'de Beaufort 2 "Hafif Rüzgâr"dır ama burada tatlıdır, çünkü 10/11 km/sa sınırı kullanıcının
 * hafif rüzgâr kuralıdır (`LIGHT_WIND_MAX_KMH`).
 */
export const BREEZE_WIND_MAX_KMH = 19

const COVER_ORDER: Record<CloudCover, number> = { FEW: 1, SCT: 2, BKN: 3, OVC: 4 }

/**
 * Tavan: en alçak BKN/OVC katmanının tabanı (CB/TCU dahil) ya da dikey görüş, ft. ICAO tanımı:
 * gökyüzünün yarısından fazlasını kaplayan en alçak katman (20.000 ft altı). Yoksa null.
 */
export function ceilingFt(sky: Sky): number | null {
  if (sky.kind === 'vv') return sky.verticalVisibilityFt
  if (sky.kind !== 'layers') return null
  let lowest: number | null = null
  for (const layer of sky.layers) {
    if ((layer.cover === 'BKN' || layer.cover === 'OVC') && layer.baseFt !== null) {
      if (layer.baseFt < 20_000 && (lowest === null || layer.baseFt < lowest)) lowest = layer.baseFt
    }
  }
  return lowest
}

/** Katmanlardan en büyük tek katman miktarı; katmanlar toplanmaz (MGM IV.1.3.6.6). */
export function largestCover(sky: Sky): CloudCover | null {
  let best: CloudCover | null = null
  for (const layer of sky.layers) {
    if (layer.cover && (best === null || COVER_ORDER[layer.cover] > COVER_ORDER[best])) {
      best = layer.cover
    }
  }
  return best
}

/** En alçak bulut tabanı (miktarı ne olursa olsun), ft. */
export function lowestCloudBaseFt(sky: Sky): number | null {
  let lowest: number | null = null
  for (const layer of sky.layers) {
    if (layer.baseFt !== null && (lowest === null || layer.baseFt < lowest)) lowest = layer.baseFt
  }
  return lowest
}

const MAGNUS_A = 17.625
const MAGNUS_B = 243.04

/**
 * Bağıl nem, % (Magnus, Alduchov–Eskridge katsayıları; Lawrence 2005, BAMS 86(2)). Sıcaklık ve işba
 * tam derece verildiği için ±7 puan belirsizdir: %5'e yuvarlanır, 100 ile sınırlanır.
 */
export function relativeHumidity(
  temperatureC: number | null,
  dewPointC: number | null,
): number | null {
  if (temperatureC === null || dewPointC === null) return null
  if (!Number.isFinite(temperatureC) || !Number.isFinite(dewPointC)) return null
  const rh =
    100 *
    Math.exp(
      (MAGNUS_A * dewPointC) / (MAGNUS_B + dewPointC) -
        (MAGNUS_A * temperatureC) / (MAGNUS_B + temperatureC),
    )
  return Math.min(100, Math.round(rh / 5) * 5)
}

/**
 * Ortalama rüzgârın şiddet adı (kt alt sınırı, büyükten küçüğe). MGM Beaufort ıskalası: 5 Sert
 * Rüzgâr 17, 7 Fırtınamsı Rüzgâr 28, 8 Fırtına 34, 9 Kuvvetli Fırtına 41, 10 Tam Fırtına 48, 11 Çok
 * Şiddetli Fırtına 56, 12 Harikeyn (Orkan) 64 kt. 20–27 kt tek bant, "Kuvvetli rüzgâr"dır: alt sınır
 * MGM meydan uyarısının eşiğidir (Beaufort 5'in üst ucu 20–21 kt da vurgulu satırda "Sert" değil
 * "Kuvvetli" okunur; D-083). "Sert rüzgâr" bu yüzden 17–19 kt'dir.
 */
const MEAN_LEVELS: readonly (readonly [number, WindLevel])[] = [
  [64, 'hurricane'],
  [56, 'violentStorm'],
  [48, 'storm'],
  [41, 'severeGale'],
  [34, 'gale'],
  [28, 'nearGale'],
  [STRONG_WIND_MEAN_KT, 'strong'],
  [FRESH_WIND_MEAN_KT, 'fresh'],
]

/**
 * Hamlenin şiddet adı (kt alt sınırı). MGM ıskalası hamle karşılığı vermez; fırtına düzeyleri Met
 * Office'in deniz tahmini sözlüğündeki hamle karşılıklarıdır (Gale 43, Severe gale 52, Storm 61,
 * Violent storm 69 kt; Hurricane force yalnız ortalamayla). Hamle MGM meydan uyarısı eşiğini (30 kt)
 * geçtiyse `gusts` ("Kuvvetli hamle"), vurgu eşiğini (25 kt) geçtiyse `gusty` ("Hamleli rüzgâr").
 */
const GUST_LEVELS: readonly (readonly [number, WindLevel])[] = [
  [69, 'violentStorm'],
  [61, 'storm'],
  [52, 'severeGale'],
  [43, 'gale'],
  [STRONG_WIND_GUST_KT, 'gusts'],
  [GUSTY_WIND_GUST_KT, 'gusty'],
]

function levelFor(kt: number | null, table: readonly (readonly [number, WindLevel])[]) {
  if (kt === null || !Number.isFinite(kt)) return null
  return table.find(([min]) => kt >= min)?.[1] ?? null
}

/**
 * Etkili rüzgârın şiddeti (D-083): ortalamanın ve hamlenin düzeyinden büyüğü (`WIND_LEVELS` sırası);
 * vurgu eşiğinin (ortalama 17 kt, hamle 25 kt) altında, sakin ya da bilinmeyen rüzgârda null. Ölçek
 * üstü değer (P99) 100 kt sayılır (çözücü öyle yazar). Örnek: 25G43 → `gale`, 19G30 → `gusts`,
 * 20 → `strong`, 19 → `fresh`, 16G25 → `gusty`, 18G32 → `gusts` (hamle meydan uyarısı eşiğinde).
 */
export function windLevel(wind: Wind | null): WindLevel | null {
  if (!wind || wind.calm) return null
  const mean = levelFor(wind.speedKt, MEAN_LEVELS)
  const gust = levelFor(wind.gustKt, GUST_LEVELS)
  if (mean === null) return gust
  if (gust === null) return mean
  return WIND_LEVELS.indexOf(gust) > WIND_LEVELS.indexOf(mean) ? gust : mean
}

/**
 * Ölçeğin üstündeki değer (D-083): `aboveMaxKt` ortalama ile hamleyi birlikte söyler. Hamle
 * ortalamadan büyüktür; ortalama ölçeğin üstündeyse hamlesi de öyledir. Bu yüzden ölçek üstü değer,
 * hamle varsa hamledir (ortalama hamleye eşitse ikisi), yoksa ortalamadır. Ölçeğin sınırı birime
 * göredir (`P99KT` 100 kt, `P49MPS` 50 m/s = 97 kt); kt eşiğiyle karar verilmez. Sade ve uzman
 * görünüm aynı kuralı kullanır ("… ve üzeri").
 */
export function offScaleWind(wind: Wind): { speed: boolean; gust: boolean } {
  if (!wind.aboveMaxKt) return { speed: false, gust: false }
  if (wind.gustKt === null) return { speed: true, gust: false }
  return { speed: wind.speedKt !== null && wind.speedKt >= wind.gustKt, gust: true }
}

/**
 * MGM meydan uyarısı eşiği: ortalama ≥ 20 kt ya da hamle ≥ 30 kt (ölçek üstü P99 da). API'deki
 * `derived.strongWind` ve TAF'ın rüzgâr öğesi bununla seçilir; `windLevel` `gusts` ya da daha
 * güçlüyse doğrudur. Satırın vurgusu daha alçak eşikten başlar (`windLevel`: `fresh`, `gusty`;
 * kullanıcı kararı 2026-10-03, D-083).
 */
export function isStrongWind(wind: Wind | null): boolean {
  const level = windLevel(wind)
  return level !== null && WIND_LEVELS.indexOf(level) >= WIND_LEVELS.indexOf('gusts')
}

/** Değişken yönlü ve 3 kt ya da altında, hamlesiz: "Hafif ve değişken yönlü" (hız yazılmaz). */
export function isLightAndVariable(wind: Wind): boolean {
  return wind.variable && wind.speedKt !== null && wind.speedKt <= 3 && wind.gustKt === null
}

/** Gösterilen km/sa: raporun kendi biriminden çevrilen değer, yoksa kt'den (sade görünümle aynı). */
function shownKmh(kt: number, kmh: number | null | undefined): number {
  return typeof kmh === 'number' && Number.isFinite(kmh) ? kmh : ktToKmh(kt)
}

/**
 * Hafif rüzgâr (kullanıcı kararı 2026-10-03, D-083): sakin ya da gösterilen ortalama hız (ve varsa
 * hamle) ≤ 10 km/sa. Bilinmeyen hızda, ölçek üstü raporda ve NIL'de null. Satır açık yeşildir;
 * hangi metnin yazıldığı (`LightWind`) arayüzün etiket kararı içindir.
 */
export function lightWind(wind: Wind | null): LightWind | null {
  if (!wind) return null
  if (wind.calm) return 'calm'
  if (wind.speedKt === null || !Number.isFinite(wind.speedKt) || wind.aboveMaxKt) return null
  if (shownKmh(wind.speedKt, wind.speedKmh) > LIGHT_WIND_MAX_KMH) return null
  if (wind.gustKt !== null && shownKmh(wind.gustKt, wind.gustKmh) > LIGHT_WIND_MAX_KMH) return null
  return isLightAndVariable(wind) ? 'lightVariable' : 'light'
}

/**
 * Şiddet düzeyinin renk basamağı (D-083, kullanıcı isteği 2026-10-04): `gusty` ve `fresh` kehribar;
 * meydan uyarısı eşiğinden (`gusts`, `strong`) Beaufort 8'in altına (`nearGale`, ortalama 28–33 kt)
 * turuncu; `gale` ve üstü (ortalama ≥ 34 kt ya da hamle ≥ 43 kt; Met Office hamle karşılıkları)
 * kırmızı.
 */
const LEVEL_TIERS: Record<WindLevel, Extract<WindTier, 'fresh' | 'strong' | 'storm'>> = {
  gusty: 'fresh',
  fresh: 'fresh',
  gusts: 'strong',
  strong: 'strong',
  nearGale: 'strong',
  gale: 'storm',
  severeGale: 'storm',
  storm: 'storm',
  violentStorm: 'storm',
  hurricane: 'storm',
}

/** Şiddet düzeyinin renk basamağı (`fresh`, `strong`, `storm`). */
export function windLevelTier(level: WindLevel): WindTier {
  return LEVEL_TIERS[level]
}

/**
 * Rüzgâr satırının renk basamağı (kullanıcı isteği 2026-10-04: "rüzgâr varsa renkli belirt",
 * derecelendirilmiş; D-083). Önce şiddet düzeyi (`windLevel`, kt eşikleri değişmedi; ölçek üstü P99
 * 100 kt sayılır, en az kendi düzeyidir); düzey yoksa gösterilen km/sa (ortalama ve varsa hamlenin
 * büyüğü; hafif rüzgâr kuralıyla aynı): sakin ya da ≤ 10 km/sa `calm`, 11–19 km/sa `breeze`, 20 km/sa
 * ve üstü `moderate` (ortalama < 17 kt, hamle < 25 kt; ör. `10G20KT`, hamle 37 km/sa, sarıdır).
 * Ölçek üstü değer yalnız alt sınırdır: hafif sayılmaz. Bilinmeyen hızda (`/////KT`) ve rüzgâr
 * yoksa null.
 */
export function windTier(wind: Wind | null): WindTier | null {
  if (!wind) return null
  if (wind.calm) return 'calm'
  const level = windLevel(wind)
  if (level !== null) return LEVEL_TIERS[level]
  if (wind.speedKt === null || !Number.isFinite(wind.speedKt)) return null
  if (lightWind(wind) !== null) return 'calm'
  const gust =
    wind.gustKt !== null && Number.isFinite(wind.gustKt) ? shownKmh(wind.gustKt, wind.gustKmh) : 0
  const kmh = Math.max(shownKmh(wind.speedKt, wind.speedKmh), gust)
  return kmh <= BREEZE_WIND_MAX_KMH ? 'breeze' : 'moderate'
}

/** Hava olayı bayrakları (havalimanındaki ve çevredeki gruplar ayrı). */
export function weatherFlags(
  weather: readonly WeatherGroup[],
  recent: readonly WeatherGroup[],
  sky: Sky,
): WeatherFlags {
  const here = weather.filter((g) => !g.vicinity)
  const near = weather.filter((g) => g.vicinity)
  const any = (groups: readonly WeatherGroup[], test: (g: WeatherGroup) => boolean) =>
    groups.some(test)
  const hasCode = (g: WeatherGroup, ...codes: string[]) =>
    g.phenomena.some((p) => codes.includes(p))
  return {
    rain: any(here, isRainGroup),
    snow: any(here, isSnowGroup),
    thunderstorm: any(here, isThunderGroup),
    fog: any(here, isFogGroup),
    mist: any(here, (g) => hasCode(g, 'BR')),
    haze: any(here, (g) => hasCode(g, 'HZ')),
    freezing: any(here, (g) => g.descriptor === 'FZ'),
    hail: any(here, isHailGroup),
    unknownPrecipitation: any(here, isUnknownPrecipitationGroup),
    dustSand: any(here, isDustSandGroup),
    otherPhenomena: any(here, (g) => hasCode(g, 'FU', 'VA', 'SQ', 'FC', 'PY')),
    vicinityShowers: any(near, (g) => g.descriptor === 'SH'),
    vicinityThunderstorm: any(near, (g) => g.descriptor === 'TS'),
    vicinityFog: any(near, isFogGroup),
    recent: recent.length > 0,
    cb: sky.layers.some((l) => l.type === 'CB'),
    tcu: sky.layers.some((l) => l.type === 'TCU'),
  }
}

/** Gökyüzü başlığı (hava olayı yoksa). */
function skyHeadline(sky: Sky, cavok: boolean): Headline {
  if (cavok || sky.kind === 'cavok') return { kind: 'sky', code: 'CAVOK', phrase: 'cavok' }
  switch (sky.kind) {
    case 'nsc':
      return { kind: 'sky', code: 'NSC', phrase: 'nsc' }
    case 'ncd':
      return { kind: 'sky', code: 'NCD', phrase: 'ncd' }
    case 'skc':
    case 'clr':
      return { kind: 'sky', code: sky.kind.toUpperCase(), phrase: 'skc' }
    case 'vv':
      return { kind: 'sky', code: 'VV', phrase: 'vv' }
    case 'layers': {
      const cover = largestCover(sky)
      return cover
        ? { kind: 'sky', code: cover, phrase: cover }
        : { kind: 'sky', code: 'unknown', phrase: 'unknown' }
    }
    default:
      return { kind: 'sky', code: 'unknown', phrase: 'unknown' }
  }
}

/**
 * Başlık: havalimanındaki en önemli hava olayı; yoksa gökyüzü. NIL raporda `nil`; hava olayı
 * belirlenemiyorsa ve tanınan olay yoksa `undetermined` (gökyüzü "olay yok" izlenimi vermesin).
 */
export function headline(
  metar: Pick<DecodedMetar, 'nil' | 'weather' | 'sky' | 'cavok'>,
  weatherUndetermined: boolean,
): Headline {
  if (metar.nil) return { kind: 'nil', code: 'NIL', phrase: 'nil' }
  const worst = mostSevereGroup(metar.weather.filter((g) => !g.vicinity))
  if (worst) return { kind: 'weather', code: worst.raw, phrase: weatherPhraseId(worst) }
  if (weatherUndetermined) return { kind: 'undetermined', code: '', phrase: 'undetermined' }
  return skyHeadline(metar.sky, metar.cavok)
}

/** Hava grubunun simgesi. */
function weatherIcon(g: WeatherGroup): WeatherIconCategory {
  const has = (...codes: string[]) => g.phenomena.some((p) => codes.includes(p))
  if (has('FC', 'SQ', 'SS', 'DS', 'VA')) return 'severe'
  if (g.descriptor === 'TS') return has('GR', 'GS') ? 'thunder_hail' : 'thunder'
  if (g.descriptor === 'FZ' && has('RA', 'DZ', 'UP')) return 'freezing'
  if (has('GR', 'GS')) return 'hail'
  if (has('RA', 'DZ') && has('SN', 'SG', 'PL')) return 'sleet'
  if (has('PL')) return 'sleet'
  if (has('SN', 'SG', 'IC')) return 'snow'
  if (has('FG')) return 'fog'
  if (has('RA', 'UP')) {
    if (g.descriptor === 'SH') return g.intensity === 'heavy' ? 'rain_heavy' : 'showers'
    return g.intensity === 'heavy' ? 'rain_heavy' : 'rain'
  }
  if (has('DZ')) return 'drizzle'
  if (has('DU', 'SA', 'PO')) return 'dust_sand'
  return 'mist_haze'
}

const NIGHT_VARIANTS: Partial<Record<WeatherIconCategory, WeatherIconCategory>> = {
  clear: 'clear_night',
  fair: 'fair_night',
  partly: 'partly_night',
}

/** Başlıktan gündüz simgesi. */
function dayIcon(metar: Pick<DecodedMetar, 'nil' | 'weather' | 'sky' | 'cavok'>, h: Headline) {
  if (h.kind === 'nil' || h.kind === 'undetermined') return 'unknown' as const
  if (h.kind === 'weather') {
    const worst = mostSevereGroup(metar.weather.filter((g) => !g.vicinity))
    return worst ? weatherIcon(worst) : ('unknown' as const)
  }
  switch (h.phrase) {
    case 'cavok':
    case 'nsc':
      return 'fair' as const
    case 'skc':
    case 'ncd':
      return 'clear' as const
    case 'FEW':
      return 'fair' as const
    case 'SCT':
      return 'partly' as const
    case 'BKN':
      return 'mostly_cloudy' as const
    case 'OVC':
      return 'overcast' as const
    case 'vv':
      return 'obscured' as const
    default:
      return 'unknown' as const
  }
}

/** Simge kategorisi; `clear`, `fair` ve `partly` gece (`isDay` false) `_night` biçimini alır. */
export function iconCategory(
  metar: Pick<DecodedMetar, 'nil' | 'weather' | 'sky' | 'cavok' | 'derived'>,
  isDay: boolean,
): WeatherIconCategory {
  const icon = metar.derived.icon
  return isDay ? icon : (NIGHT_VARIANTS[icon] ?? icon)
}

/** Çözülen alanlardan türetilen değerler (`decodeMetar` çağırır). */
export function deriveMetar(
  metar: Omit<DecodedMetar, 'derived'>,
  weatherUndetermined: boolean,
): MetarDerived {
  const h = headline(metar, weatherUndetermined)
  return {
    ceilingFt: ceilingFt(metar.sky),
    relativeHumidityPct: relativeHumidity(metar.temperatureC, metar.dewPointC),
    flags: weatherFlags(metar.weather, metar.recent, metar.sky),
    headline: h,
    strongWind: isStrongWind(metar.wind),
    weatherUndetermined,
    icon: dayIcon(metar, h),
  }
}
