import { compassKey8 } from './compass'
import {
  isLightAndVariable,
  isStrongWind,
  largestCover,
  lowestCloudBaseFt,
  lightWind,
  offScaleWind,
  windLevel,
  windTier,
} from './derive'
import { list, phrase, type Measure, type Phrase, type WeatherText } from './phrase'
import {
  WIND_LEVELS,
  type DecodedMetar,
  type DecodedTaf,
  type LightningRisk,
  type LightWind,
  type Sky,
  type TafPeriod,
  type TrendGroup,
  type Visibility,
  type WeatherGroup,
  type WeatherIconCategory,
  type Wind,
  type WindLevel,
  type WindShear,
  type WindTier,
} from './schema'
import { localDayDifference, toDate, TURKEY_TIME_ZONE, type DateInput } from './time'
import {
  compareWeatherSeverity,
  isFogGroup,
  isHailGroup,
  isOtherGroup,
  isPrecipitationGroup,
  isRainGroup,
  isSnowGroup,
  isThunderGroup,
  isUnknownPrecipitationGroup,
  mostSevereGroup,
  weatherPhraseId,
} from './wx'

/**
 * Sade dil özeti (brief §5). Metin üretmez: her değer metin anahtarı + değişkendir
 * (`renderWeatherText`). Dürüstlük kuralları:
 * - Yağmur, kar, oraj ve sis satırları her zaman vardır; "yok" yalnızca rapor temiz çözüldüyse
 *   yazılır. Rapor NIL ise ya da gövdede hava olayına benzeyen çözülemeyen parça varsa
 *   "belirlenemedi" yazılır (tanınan olaylar yine gösterilir).
 * - Çevredeki (VC) ve son saatteki (RE) olaylar "havalimanında yok" diye ayrıca söylenir. Gök
 *   gürültüsü satırı istisnadır: oraj ya da kümülonimbüs varken şimşek ve yıldırım uyarısını yazar
 *   (`lightning`, D-083); "Yok" diyen metin de bulutu ve olasılığı söyler, uyarıyla çelişmez.
 *   Kümülonimbüs ve havalimanında yağış varken "Yok" denmez, tehlike yazılır (`cloudPrecip`).
 * - Olasılıklı (PROB) tahmin "bekleniyor" diye yazılmaz; kalıp olasılığı söyler.
 */

/** Havalimanı sayfası ve harita penceresi satırları. Null satır gösterilmez. */
export interface WeatherSummaryRows {
  wind: WeatherText
  rain: WeatherText
  snow: WeatherText
  thunderstorm: WeatherText
  fog: WeatherText
  /** Yalnız dolu varsa. */
  hail: WeatherText | null
  /** Yalnız toz, kum, duman, volkanik kül, ani kuvvetli rüzgâr, hortum vb. varsa. */
  other: WeatherText | null
  visibility: WeatherText
  clouds: WeatherText
  temperature: WeatherText | null
  dewPoint: WeatherText | null
  humidity: WeatherText | null
  pressure: WeatherText | null
}

/**
 * Olay satırının durumu: `present` havalimanında var, `vicinity` yalnız çevresinde, `recent` kısa
 * süre önce vardı, `none` yok, `undetermined` belirlenemedi. Arayüz `present` satırı vurgular
 * (kullanıcı kararı 2026-10-02); gök gürültüsü satırının vurgusu `lightning`'den, rüzgârınki
 * `windTier`'dan gelir (D-083). Satırın metni her durumu ayrıca söyler.
 */
export type PhenomenonPresence = 'present' | 'vicinity' | 'recent' | 'none' | 'undetermined'

/** Olay satırlarının durumu (`WeatherSummaryRows` ile aynı adlar). */
export interface WeatherSummaryPresence {
  rain: PhenomenonPresence
  snow: PhenomenonPresence
  thunderstorm: PhenomenonPresence
  fog: PhenomenonPresence
  /** `present` ya da `none` (dolu satırı yalnız dolu varsa yazılır). */
  hail: PhenomenonPresence
  /** `present`, `vicinity` ya da `none`. */
  other: PhenomenonPresence
}

export interface WeatherSummary {
  /** Başlık: en önemli hava olayı ya da gökyüzü. */
  headline: WeatherText
  /** Gündüz simgesi (gece biçimi `iconCategory`). */
  icon: WeatherIconCategory
  temperature: Measure | null
  rows: WeatherSummaryRows
  /** Olay satırlarının durumu: havalimanında var olan olay vurgulanır. */
  presence: WeatherSummaryPresence
  /**
   * Eğilim (TREND, gözlemden sonraki 2 saat); yoksa ya da penceresi geçtiyse null. Pencere açıkken
   * gözlem 30 dakikadan eskiyse metin pencerenin bitiş saatiyle yazılır (`trend: 'untilTime'`).
   */
  next2h: WeatherText | null
  /**
   * Eğilim penceresinin durumu (`now` verildiyse): `next2h` gözlem tazeyken "önümüzdeki 2 saat",
   * `untilTime` gözlem eskiyken "… saatine kadar", `expired` pencere geçti (satır gösterilmez).
   * `now` verilmezse her zaman `next2h`.
   */
  trend: TrendWindow
  /**
   * Etkili rüzgârın şiddeti (D-083; `windLevel`): rüzgâr satırı kehribar, turuncu ya da kırmızıdır
   * (`windTier`), yanında şiddetin adı (`weather.wind.level.*`: "Sert rüzgâr", "Hamleli rüzgâr", "Kuvvetli rüzgâr", "Fırtına" …)
   * yazılır. Vurgu eşiğinin (ortalama 17 kt, hamle 25 kt; kullanıcı kararı 2026-10-03) altında ya da
   * NIL'de null.
   */
  windLevel: WindLevel | null
  /**
   * MGM meydan uyarısı eşiği aşıldı (ortalama ≥ 20 kt ya da hamle ≥ 30 kt; `isStrongWind`, API'deki
   * `derived.strongWind` ile aynı). `windLevel` `fresh` ya da `gusty` iken false'tur.
   */
  strongWind: boolean
  /**
   * Hafif rüzgâr (gösterilen hız ≤ 10 km/sa, sakin dahil; kullanıcı kararı 2026-10-03, D-083): rüzgâr
   * satırı açık yeşildir (`windTier` `calm`). `light` iken arayüz "Hafif rüzgâr" etiketini yazar; `calm` ve
   * `lightVariable` iken değer bunu zaten söyler. Rüzgâr kesmesi bildirildiyse satır yine kehribardır.
   * Bilinmeyen rüzgârda ve NIL'de null.
   */
  windLight: LightWind | null
  /**
   * Rüzgâr satırının renk basamağı (`windTier`; kullanıcı isteği 2026-10-04, D-083): rüzgâr varsa
   * satır her zaman renklidir; `calm` açık yeşil, `breeze` limon yeşili ("Hafif-orta rüzgâr"),
   * `moderate` sarı ("Orta rüzgâr"), `fresh` kehribar, `strong` turuncu, `storm` kırmızı (son üçünün
   * adı `windLevel`'dandır). Rüzgâr kesmesi bildirildiyse arayüz satırı en az kehribar yapar.
   * Bilinmeyen rüzgârda ve NIL'de null.
   */
  windTier: WindTier | null
  /**
   * Rüzgâr kesmesi (`WS R34`, `WS ALL RWY`; WMO-306 FM 15, MGM Havacılık Meteorolojisi IV.1.3.9.4):
   * "Rüzgâr kesmesi bildirildi: pist 34". Rüzgâr satırında değerin altına yazılır, satır kehribardır
   * (rüzgâr hafif olsa da). Yoksa ya da NIL'de null.
   */
  windShear: WeatherText | null
  /**
   * Şimşek ve yıldırım uyarısı (D-083): gök gürültüsü satırı bunu yazar (`weather.thunder.*`) ve
   * vurgulanır. Havalimanında oraj (yağışlı ya da yağışsız), çevrede oraj (VCTS) ya da kümülonimbüs
   * bulutu (havalimanında yağışla birlikte ya da yağışsız); yoksa (TCU ve yalnız son saatteki oraj
   * dahil) ya da NIL'de null.
   */
  lightning: LightningRisk | null
  /** Hava olayı satırları "belirlenemedi" diyebilir; ham metne yönlendiren not gösterilir. */
  undetermined: boolean
  /** Uyarı notları (NIL, çözülemeyen parça, otomatik gözlem, düzeltilmiş rapor, SPECI). */
  notes: WeatherText[]
}

const NONE = phrase('weather.value.none')
const UNDETERMINED = phrase('weather.value.undetermined')

/** Grubun kendi metni (`weather.wx.<id>`). */
function groupPhrase(g: WeatherGroup): Phrase {
  return phrase(`weather.wx.${weatherPhraseId(g)}`)
}

/** Listede kullanılan metin: çevredeki grup "havalimanı çevresinde …" kalıbıyla sarılır. */
export function weatherGroupText(g: WeatherGroup): WeatherText {
  if (!g.vicinity) return groupPhrase(g)
  const id = weatherPhraseId(g)
  // VCSH ve VCTS'nin metni zaten çevreyi söyler ("sağanak", "gök gürültüsü") ama kalıp yine gerekir.
  return phrase('weather.wx.vicinity', { phrase: phrase(`weather.wx.${id}`) })
}

const speedMeasure = (kt: number, kmh: number | null | undefined): Measure =>
  kmh === null || kmh === undefined ? { measure: 'speed', kt } : { measure: 'speed', kt, kmh }

/**
 * Hız; ölçek üstü "185 km/sa (100 kt) ve üzeri" (`P99KT`), "180 km/sa (97 kt) ve üzeri" (`P49MPS`).
 * Hangi değerin ölçek üstü olduğu `offScaleWind`'dan gelir (uzman görünümüyle aynı kural).
 */
function speedText(kt: number, kmh: number | null | undefined, offScale: boolean): WeatherText {
  return offScale
    ? phrase('weather.wind.above', { speed: speedMeasure(kt, kmh) })
    : speedMeasure(kt, kmh)
}

/**
 * Rüzgâr kesmesi (D-083): "Rüzgâr kesmesi bildirildi: pist 34" / "… bütün pistler". Pist kodları
 * rapordaki gibidir (`34`, `03R`).
 */
export function windShearText(shear: WindShear | null): WeatherText | null {
  if (!shear) return null
  if (shear.allRunways) return phrase('weather.wind.shearAll')
  const [first, ...rest] = shear.runways
  if (first === undefined) return null
  return rest.length === 0
    ? phrase('weather.wind.shearRunway', { runway: first })
    : phrase('weather.wind.shearRunways', { runways: shear.runways.join(', ') })
}

/**
 * Rüzgâr: "Kuzeydoğudan 33 km/sa (18 kt), hamle 59 km/sa (32 kt), yönü batı ile kuzey arasında
 * değişiyor" (km/sa ve kt birlikte, D-083).
 */
export function windText(wind: Wind | null): WeatherText {
  if (!wind || wind.speedKt === null) return UNDETERMINED
  if (wind.calm) return phrase('weather.wind.calm')
  const offScale = offScaleWind(wind)
  const speed = speedText(wind.speedKt, wind.speedKmh, offScale.speed)
  const items: WeatherText[] = []
  const direction = wind.directionDeg === null ? null : compassKey8(wind.directionDeg)
  if (wind.variable) {
    items.push(
      isLightAndVariable(wind)
        ? phrase('weather.wind.lightVariable')
        : phrase('weather.wind.variable', { speed }),
    )
  } else if (direction === null) {
    items.push(phrase('weather.wind.speedOnly', { speed }))
  } else {
    items.push(
      phrase('weather.wind.from', {
        direction: phrase(`weather.compass.from.${direction}`),
        speed,
      }),
    )
  }
  if (wind.gustKt !== null) {
    items.push(
      phrase('weather.wind.gust', {
        speed: speedText(wind.gustKt, wind.gustKmh, offScale.gust),
      }),
    )
  }
  if (wind.varyingFromDeg !== null && wind.varyingToDeg !== null) {
    const from = compassKey8(wind.varyingFromDeg)
    const to = compassKey8(wind.varyingToDeg)
    if (from && to) {
      items.push(
        phrase('weather.wind.varying', {
          from: phrase(`weather.compass.name.${from}`),
          to: phrase(`weather.compass.name.${to}`),
        }),
      )
    }
  }
  return list(items, 'comma')
}

/** Görüş değeri (tek parça). */
function visibilityValue(v: Visibility): WeatherText {
  if (v.tenKmOrMore) return phrase('weather.visibility.tenKmPlus')
  if (v.lessThan50m) return phrase('weather.visibility.lessThan50')
  if (v.meters === null) return UNDETERMINED
  const value: Measure = { measure: 'visibility', meters: v.meters }
  if (v.qualifier === 'above') return phrase('weather.visibility.above', { visibility: value })
  if (v.qualifier === 'below') return phrase('weather.visibility.below', { visibility: value })
  return value
}

/** Görüş satırı: hâkim görüş ve varsa daha düşük en düşük görüş ile yönü. */
export function visibilityText(visibility: Visibility | null, cavok: boolean): WeatherText {
  if (cavok) return phrase('weather.visibility.tenKmPlus')
  if (!visibility) return UNDETERMINED
  const items = [visibilityValue(visibility)]
  const minimum = visibility.minimum
  if (
    minimum &&
    minimum.direction !== null &&
    (visibility.meters === null || minimum.meters < visibility.meters)
  ) {
    items.push(
      phrase('weather.visibility.minimum', {
        visibility: { measure: 'visibility', meters: minimum.meters },
        direction: phrase(`weather.compass.name.${minimum.direction}`),
      }),
    )
  }
  return list(items, 'comma')
}

/** Bulut satırı: "Çok bulutlu, en alçak bulut 760 m, kümülonimbüs". */
export function cloudsText(sky: Sky, cavok: boolean): WeatherText {
  if (cavok || sky.kind === 'cavok') return phrase('weather.clouds.cavok')
  switch (sky.kind) {
    case 'nsc':
      return phrase('weather.clouds.nsc')
    case 'ncd':
      return phrase('weather.clouds.ncd')
    case 'skc':
    case 'clr':
      return phrase('weather.clouds.skc')
    case 'vv':
      return sky.verticalVisibilityFt === null
        ? phrase('weather.clouds.vvUnknown')
        : phrase('weather.clouds.vv', {
            height: { measure: 'height', ft: sky.verticalVisibilityFt },
          })
    case 'unknown':
      return UNDETERMINED
    default:
      break
  }
  const items: WeatherText[] = []
  const cover = largestCover(sky)
  items.push(cover ? phrase(`weather.clouds.${cover}`) : UNDETERMINED)
  const lowest = lowestCloudBaseFt(sky)
  if (lowest !== null) {
    items.push(phrase('weather.clouds.lowest', { height: { measure: 'height', ft: lowest } }))
  }
  if (sky.layers.some((l) => l.type === 'CB')) items.push(phrase('weather.clouds.cb'))
  if (sky.layers.some((l) => l.type === 'TCU')) items.push(phrase('weather.clouds.tcu'))
  return list(items, 'comma')
}

interface PresenceInput {
  here: readonly WeatherGroup[]
  near: readonly WeatherGroup[]
  recent: readonly WeatherGroup[]
  undetermined: boolean
}

/** Olay satırının durumu: havalimanında var / belirlenemedi / çevresinde / kısa süre önce / yok. */
function presenceOf({ here, near, recent, undetermined }: PresenceInput): PhenomenonPresence {
  if (here.length > 0) return 'present'
  if (undetermined) return 'undetermined'
  if (near.length > 0) return 'vicinity'
  if (recent.length > 0) return 'recent'
  return 'none'
}

/** Olay satırı: havalimanında varsa olaylar; yoksa belirlenemedi / çevresinde / kısa süre önce / yok. */
function presenceRow(input: PresenceInput): WeatherText {
  switch (presenceOf(input)) {
    case 'present':
      return list(input.here.map(groupPhrase), 'comma')
    case 'undetermined':
      return UNDETERMINED
    case 'vicinity':
      return phrase('weather.value.vicinity', {
        phrase: list(input.near.map(groupPhrase), 'comma'),
      })
    case 'recent':
      return phrase('weather.value.recent', {
        phrase: list(input.recent.map(recentPhrase), 'comma'),
      })
    case 'none':
      return NONE
  }
}

/**
 * Şimşek ve yıldırım uyarısı (D-083). Yıldırım yağmurun dışına da düşer: yağışsız oraj gerçek bir
 * olaydır (METAR'da tek başına `TS`), yıldırım çoğu zaman oraj merkezinden 5 km'den uzağa, 16–24 km'ye
 * kadar düşer (NWS), gök gürültüsü ~20 km'den uzakta nadiren duyulur (Met Office). Bu yüzden:
 * havalimanında TS → tehlike (yağış olsun olmasın), VCTS (8–16 km) → havalimanına da düşebilir,
 * kümülonimbüs ve havalimanında yağış (`-SHRA FEW025CB`) → tehlike (kullanıcının sözü, 2026-10-03),
 * yalnız kümülonimbüs → olabilir. TCU (örssüz, gelişen bulut) ve yalnız son saatteki oraj (RETS) için
 * iddia yazılmaz. "Yağış yok" (`hereDry`) yalnız rapor temiz çözüldüyse söylenir (D-078): hava olayı
 * belirlenemediyse (`TS //`, görüşü eksik rapor, çözülemeyen parça) yağış bilinmez, `here` yazılır.
 * Tanınan yağış grubu rapor belirlenemese de vardır: CB ile `cloudPrecip` yazılır (metni "Yok"
 * demez); yalnız tanınan yağış yoksa `cloudUndetermined`.
 */
function lightningRisk(
  here: readonly WeatherGroup[],
  near: readonly WeatherGroup[],
  cb: boolean,
  undetermined: boolean,
): LightningRisk | null {
  if (here.some(isThunderGroup)) {
    return here.some(isPrecipitationGroup) || undetermined ? 'here' : 'hereDry'
  }
  if (near.some(isThunderGroup)) return 'vicinity'
  if (!cb) return null
  if (here.some(isPrecipitationGroup)) return 'cloudPrecip'
  return undetermined ? 'cloudUndetermined' : 'cloud'
}

/** Son saatteki olay: yağışsız oraj (`RETS`) "gök gürültüsü" diye yazılır (VCTS ile aynı ad). */
function recentPhrase(g: WeatherGroup): Phrase {
  const id = weatherPhraseId(g)
  return phrase(`weather.wx.${id === 'TS' ? 'VCTS' : id}`)
}

/**
 * Başlık metni. Yağışsız oraj grubunun metni "yağış yok" der ("Gök gürültüsü ve şimşek, yağış
 * yok"); bu yalnız rapor temiz çözüldüyse ve havalimanında yağış yoksa doğrudur. Hava olayı
 * belirlenemediyse (yağış bilinmez; yağmur satırı "Belirlenemedi", D-078) ya da yağış ayrı bir
 * grupta yazıldıysa (`TS RA`, `TS -SHRA`, `TS GS`; yağmur ya da dolu satırı yağışı yazar) başlık
 * yalnız "Gök gürültüsü" yazar (`weather.wx.VCTS`, D-083).
 */
function headlineText(m: DecodedMetar): WeatherText {
  const h = m.derived.headline
  switch (h.kind) {
    case 'nil':
      return phrase('weather.headline.noReport')
    case 'undetermined':
      return phrase('weather.headline.undetermined')
    case 'weather': {
      const here = m.weather.filter((g) => !g.vicinity)
      const worst = mostSevereGroup(here)
      if (!worst) return phrase('weather.headline.unknown')
      const precipitationUnknownOrElsewhere =
        m.derived.weatherUndetermined || here.some(isPrecipitationGroup)
      return weatherPhraseId(worst) === 'TS' && precipitationUnknownOrElsewhere
        ? phrase('weather.wx.VCTS')
        : groupPhrase(worst)
    }
    default:
      break
  }
  switch (h.phrase) {
    case 'cavok':
      return phrase('weather.headline.cavok')
    case 'nsc':
      return phrase('weather.headline.nsc')
    case 'skc':
      return phrase('weather.clouds.skc')
    case 'ncd':
      return phrase('weather.clouds.ncd')
    case 'vv':
      return phrase('weather.clouds.vvUnknown')
    case 'FEW':
    case 'SCT':
    case 'BKN':
    case 'OVC':
      return phrase(`weather.clouds.${h.phrase}`)
    default:
      return phrase('weather.headline.unknown')
  }
}

type Conditions = Pick<TrendGroup, 'wind' | 'visibility' | 'cavok' | 'weather' | 'nsw' | 'sky'>

/** Değişiklik grubunun öğeleri: "görüş 4 km, sağanak yağmur". */
export function changeText(c: Conditions): WeatherText {
  const items: WeatherText[] = []
  if (c.wind) items.push(phrase('weather.change.wind', { wind: windText(c.wind) }))
  if (c.cavok) {
    items.push(phrase('weather.change.cavok'))
  } else if (c.visibility) {
    items.push(
      phrase('weather.change.visibility', { visibility: visibilityText(c.visibility, false) }),
    )
  }
  if (!c.cavok) items.push(...c.weather.map(weatherGroupText))
  if (c.nsw) items.push(phrase('weather.change.nsw'))
  if (!c.cavok && c.sky) items.push(cloudsText(c.sky, false))
  return items.length === 0 ? UNDETERMINED : list(items, 'comma')
}

/** METAR eğiliminin (TREND) kapsadığı süre: gözlemden sonraki 2 saat (WMO-49). */
export const METAR_TREND_WINDOW_MS = 2 * 3_600_000
/** Bundan eski gözlemde "önümüzdeki 2 saat" yerine pencerenin bitiş saati yazılır. */
export const METAR_TREND_RELATIVE_AFTER_MS = 30 * 60_000

export type TrendWindow = 'next2h' | 'untilTime' | 'expired'

/** Eğilim penceresinin `now` anındaki durumu; gözlem zamanı ya da `now` yoksa `next2h`. */
export function metarTrendWindow(
  observedAt: DateInput | null,
  now: DateInput | undefined,
): { window: TrendWindow; endsAt: number | null } {
  if (observedAt === null || now === undefined) return { window: 'next2h', endsAt: null }
  const observed = toDate(observedAt).getTime()
  const at = toDate(now).getTime()
  if (!Number.isFinite(observed) || !Number.isFinite(at)) return { window: 'next2h', endsAt: null }
  const endsAt = observed + METAR_TREND_WINDOW_MS
  if (at >= endsAt) return { window: 'expired', endsAt }
  return {
    window: at - observed > METAR_TREND_RELATIVE_AFTER_MS ? 'untilTime' : 'next2h',
    endsAt,
  }
}

/**
 * METAR TREND: "Önümüzdeki 2 saatte ara ara görüş 4 km, sağanak yağmur". Gözlem eskiyse "15:20
 * saatine kadar ara ara …" (pencerenin sonu); pencere geçtiyse yazılmaz (ileriye dönük iddia
 * kalmaz).
 */
function next2hText(
  m: DecodedMetar,
  trend: { window: TrendWindow; endsAt: number | null },
): WeatherText | null {
  if (m.nil || trend.window === 'expired') return null
  const until = trend.window === 'untilTime' && trend.endsAt !== null
  const to: Measure | null = until
    ? { measure: 'time', iso: new Date(trend.endsAt as number).toISOString() }
    : null
  if (m.trend.length > 0) {
    return list(
      m.trend.slice(0, 2).map((g) => {
        const change = changeText(g)
        if (to) {
          return phrase(
            g.kind === 'TEMPO' ? 'weather.trend.tempoUntil' : 'weather.trend.becmgUntil',
            {
              change,
              to,
            },
          )
        }
        return phrase(g.kind === 'TEMPO' ? 'weather.trend.tempo' : 'weather.trend.becmg', {
          change,
        })
      }),
      'semicolon',
    )
  }
  if (!m.nosig) return null
  return to ? phrase('weather.trend.nosigUntil', { to }) : phrase('weather.trend.nosig')
}

export interface SummarizeMetarOptions {
  /** Şimdiki an: eğilim yalnızca gözlemden sonraki 2 saat içinde ve ona göre yazılır. */
  now?: DateInput
}

/** Çözülmüş METAR'ın sade dil özeti. */
export function summarizeMetar(
  m: DecodedMetar,
  options: SummarizeMetarOptions = {},
): WeatherSummary {
  const trend = metarTrendWindow(m.observedAt, options.now)
  const undetermined = m.nil || m.derived.weatherUndetermined
  const here = m.nil ? [] : m.weather.filter((g) => !g.vicinity)
  const near = m.nil ? [] : m.weather.filter((g) => g.vicinity)
  const recent = m.nil ? [] : m.recent
  const pick = (groups: readonly WeatherGroup[], test: (g: WeatherGroup) => boolean) =>
    groups.filter(test)
  const rainLike = (g: WeatherGroup) => isRainGroup(g) || isUnknownPrecipitationGroup(g)
  const snowLike = (g: WeatherGroup) => isSnowGroup(g) || isUnknownPrecipitationGroup(g)
  const fogLike = (g: WeatherGroup) =>
    isFogGroup(g) || g.phenomena.includes('BR') || g.phenomena.includes('HZ')

  const hail = pick(here, isHailGroup)
  const otherHere = pick(here, isOtherGroup)
  const otherNear = pick(near, isOtherGroup)
  const other =
    otherHere.length + otherNear.length === 0
      ? null
      : list([...otherHere.map(groupPhrase), ...otherNear.map(weatherGroupText)], 'comma')

  const notes: WeatherText[] = []
  if (m.nil) notes.push(phrase('weather.note.nil'))
  else if (undetermined) notes.push(phrase('weather.note.undetermined'))
  if (m.auto) notes.push(phrase('weather.note.auto'))
  if (m.corrected) notes.push(phrase('weather.note.corrected'))
  if (m.type === 'SPECI') notes.push(phrase('weather.note.speci'))

  const temperature: Measure | null =
    m.nil || m.temperatureC === null ? null : { measure: 'temperature', celsius: m.temperatureC }
  const humidity = m.nil ? null : m.derived.relativeHumidityPct

  const rain: PresenceInput = {
    here: pick(here, rainLike),
    near: pick(near, (g) => g.descriptor === 'SH' || isRainGroup(g)),
    recent: pick(recent, isRainGroup),
    undetermined,
  }
  const snow: PresenceInput = {
    here: pick(here, snowLike),
    near: pick(near, isSnowGroup),
    recent: pick(recent, isSnowGroup),
    undetermined,
  }
  const thunderstorm: PresenceInput = {
    here: pick(here, isThunderGroup),
    near: pick(near, isThunderGroup),
    recent: pick(recent, isThunderGroup),
    undetermined,
  }
  const lightning = m.nil ? null : lightningRisk(here, near, m.derived.flags.cb, undetermined)
  const level = m.nil ? null : windLevel(m.wind)
  const fog: PresenceInput = {
    here: pick(here, fogLike),
    near: pick(near, isFogGroup),
    recent: pick(recent, isFogGroup),
    undetermined,
  }

  return {
    headline: headlineText(m),
    icon: m.derived.icon,
    temperature,
    rows: {
      wind: m.nil ? UNDETERMINED : windText(m.wind),
      rain: presenceRow(rain),
      snow: presenceRow(snow),
      thunderstorm: lightning ? phrase(`weather.thunder.${lightning}`) : presenceRow(thunderstorm),
      fog: presenceRow(fog),
      hail: hail.length > 0 ? list(hail.map(groupPhrase), 'comma') : null,
      other,
      visibility: m.nil ? UNDETERMINED : visibilityText(m.visibility, m.cavok),
      clouds: m.nil ? UNDETERMINED : cloudsText(m.sky, m.cavok),
      temperature,
      dewPoint:
        m.nil || m.dewPointC === null ? null : { measure: 'temperature', celsius: m.dewPointC },
      humidity: humidity === null ? null : phrase('weather.humidity', { percent: humidity }),
      pressure: m.nil || m.qnhHpa === null ? null : { measure: 'pressure', hpa: m.qnhHpa },
    },
    presence: {
      rain: presenceOf(rain),
      snow: presenceOf(snow),
      thunderstorm: presenceOf(thunderstorm),
      fog: presenceOf(fog),
      hail: hail.length > 0 ? 'present' : 'none',
      other: otherHere.length > 0 ? 'present' : otherNear.length > 0 ? 'vicinity' : 'none',
    },
    next2h: next2hText(m, trend),
    trend: trend.window,
    windLevel: level,
    strongWind: !m.nil && isStrongWind(m.wind),
    windLight: m.nil ? null : lightWind(m.wind),
    windTier: m.nil ? null : windTier(m.wind),
    windShear: m.nil ? null : windShearText(m.windShear),
    lightning,
    undetermined,
    notes,
  }
}

// ---------------------------------------------------------------------------------------------
// TAF özeti
// ---------------------------------------------------------------------------------------------

export interface TafSummary {
  /** ok: geçerli tahmin var; none: yok; cancelled: en yeni tahmin iptal; nil: tahmin yayımlanmadı. */
  status: 'ok' | 'none' | 'cancelled' | 'nil'
  /**
   * Öne çıkan en fazla iki öğe (en önemli hava olayı ve varsa en şiddetli kuvvetli rüzgâr), her
   * biri bir satır.
   */
  items: WeatherText[]
  /** "Tahmin yarın 21:00 saatine kadar geçerli."; geçerli tahmin yoksa null. */
  validUntil: WeatherText | null
  /** Öğe yoksa açıklama (önemli hava olayı beklenmiyor / geçerli tahmin yok / iptal / yok). */
  message: WeatherText | null
  /** Kullanılan en yeni tahmin güncellenmiş (AMD) ya da düzeltilmiş (COR) mi. */
  amended: boolean
  corrected: boolean
}

export interface SummarizeTafOptions {
  /** Özetin kapsadığı süre, saat (varsayılan 24). */
  horizonHours?: number
  /** "Yarın" kararı için saat dilimi (varsayılan Europe/Istanbul). */
  timeZone?: string
}

type Kind = 'BASE' | 'FM' | 'BECMG' | 'TEMPO' | 'PROB' | 'PROBTEMPO'

interface Candidate {
  kind: Kind
  probability: number | null
  /** Pencerenin (kesilmiş) başı ve sonu, epoch ms. */
  from: number
  to: number
  /** BECMG penceresinin sonu (kademeli değişimin bittiği an). */
  becmgTo: number | null
  /** Başlangıcı şimdiden önce: "… saatine kadar" kalıbı. */
  started: boolean
  group: WeatherGroup | null
  wind: Wind | null
}

interface State {
  wind: Wind | null
  visibility: Visibility | null
  cavok: boolean
  weather: WeatherGroup[]
  sky: Sky | null
}

interface Prevailing {
  start: number
  /** Sonraki dilimin başı (BECMG ise değişim penceresinin başı); yoksa geçerlilik sonu. */
  end: number
  /**
   * Bu dilimin koşullarının sürebileceği son an. Sonraki dilim BECMG ise değişim penceresinin
   * sonu (sonraki dilimin sonunu aşmadan); değilse `end`. WMO-782: değişim pencerenin içinde
   * belirsiz bir anda olur, yeni koşullar pencerenin sonundan itibaren hâkimdir; pencere boyunca
   * eski koşul (ör. zayıflayan kuvvetli rüzgâr) sürebilir.
   */
  until: number
  kind: 'BASE' | 'FM' | 'BECMG'
  becmgTo: number | null
  state: State
}

const ms = (iso: string | null) => (iso === null ? null : Date.parse(iso))

const stateOf = (p: TafPeriod): State => ({
  wind: p.wind,
  visibility: p.visibility,
  cavok: p.cavok,
  weather: p.cavok || p.nsw ? [] : p.weather,
  sky: p.sky,
})

/** BECMG yalnız bildirdiği öğeleri değiştirir. */
function applyChange(state: State, p: TafPeriod): State {
  if (p.cavok)
    return {
      ...state,
      wind: p.wind ?? state.wind,
      visibility: p.visibility,
      cavok: true,
      weather: [],
      sky: p.sky,
    }
  return {
    wind: p.wind ?? state.wind,
    visibility: p.visibility ?? state.visibility,
    cavok: p.visibility ? false : state.cavok,
    weather: p.nsw ? [] : p.weather.length > 0 ? p.weather : state.weather,
    sky: p.sky ?? state.sky,
  }
}

/** Temel tahmin, FM ve BECMG'den hâkim durum dilimleri. */
function prevailingStates(taf: DecodedTaf): Prevailing[] {
  const validFrom = ms(taf.validFrom)
  const validTo = ms(taf.validTo)
  if (validFrom === null || validTo === null) return []
  const out: Prevailing[] = []
  const ordered = taf.periods
    .filter((p) => p.kind === 'BASE' || p.kind === 'FM' || p.kind === 'BECMG')
    .map((p) => ({ p, start: p.kind === 'BASE' ? validFrom : ms(p.from) }))
    .filter((x): x is { p: TafPeriod; start: number } => x.start !== null)
    .sort((a, b) => a.start - b.start)
  for (const { p, start } of ordered) {
    const previous = out.at(-1)
    if (previous) previous.end = start
    const state = p.kind === 'BECMG' && previous ? applyChange(previous.state, p) : stateOf(p)
    out.push({
      start,
      end: validTo,
      until: validTo,
      kind: p.kind as Prevailing['kind'],
      becmgTo: p.kind === 'BECMG' ? ms(p.to) : null,
      state,
    })
  }
  out.forEach((p, index) => {
    const next = out[index + 1]
    p.until =
      next?.kind === 'BECMG'
        ? Math.min(Math.max(next.becmgTo ?? next.start, p.end), next.end)
        : p.end
  })
  // Sıfır uzunluklu dilim (BECMG geçerliliğin başında başlıyor) pencere boyunca yine geçerlidir.
  return out.filter((p) => p.until > p.start)
}

/** Yenisi eskisinin yerini alır: her TAF yalnız daha yeni bir TAF'ın kapsamadığı dilimleri verir. */
function coverage(
  tafs: readonly DecodedTaf[],
  from: number,
): { taf: DecodedTaf; from: number; to: number }[] {
  const out: { taf: DecodedTaf; from: number; to: number }[] = []
  const covered: [number, number][] = []
  for (const taf of tafs) {
    const validFrom = ms(taf.validFrom)
    const validTo = ms(taf.validTo)
    if (validFrom === null || validTo === null) continue
    let pieces: [number, number][] = [[Math.max(validFrom, from), validTo]]
    for (const [cFrom, cTo] of covered) {
      pieces = pieces.flatMap(([a, b]): [number, number][] => {
        if (cTo <= a || cFrom >= b) return [[a, b]]
        const rest: [number, number][] = []
        if (cFrom > a) rest.push([a, cFrom])
        if (cTo < b) rest.push([cTo, b])
        return rest
      })
    }
    for (const [a, b] of pieces) if (b > a) out.push({ taf, from: a, to: b })
    covered.push([validFrom, validTo])
  }
  return out
}

function candidatesFor(
  taf: DecodedTaf,
  windowFrom: number,
  windowTo: number,
  now: number,
  horizonEnd: number,
): Candidate[] {
  const out: Candidate[] = []
  const add = (
    kind: Kind,
    probability: number | null,
    start: number,
    end: number,
    becmgTo: number | null,
    state: Pick<State, 'weather' | 'wind'>,
  ) => {
    const from = Math.max(start, windowFrom)
    const to = Math.min(end, windowTo)
    // Ufuk yalnız süzer: ufuktan önce başlayan pencere gerçek sonuyla yazılır.
    if (to <= from || from >= horizonEnd) return
    const base = { kind, probability, from, to, becmgTo, started: from <= now }
    const worst = mostSevereGroup(state.weather)
    if (worst) out.push({ ...base, group: worst, wind: null })
    if (isStrongWind(state.wind)) out.push({ ...base, group: null, wind: state.wind })
  }
  for (const p of prevailingStates(taf)) add(p.kind, null, p.start, p.until, p.becmgTo, p.state)
  for (const p of taf.periods) {
    if (p.kind !== 'TEMPO' && p.kind !== 'PROB') continue
    const start = ms(p.from)
    const end = ms(p.to)
    if (start === null || end === null) continue
    const kind: Kind =
      p.kind === 'TEMPO' ? (p.probability !== null ? 'PROBTEMPO' : 'TEMPO') : 'PROB'
    add(kind, p.probability, start, end, null, { weather: p.nsw ? [] : p.weather, wind: p.wind })
  }
  return out
}

const PREVAILING: ReadonlySet<Kind> = new Set(['BASE', 'FM', 'BECMG'])

/** İki aday aynı öğeyi mi söyler: aynı en önemli olay (metin ve çevre) ya da ikisi de kuvvetli rüzgâr. */
function sameSubject(a: Candidate, b: Candidate): boolean {
  if (a.group && b.group) {
    return (
      weatherPhraseId(a.group) === weatherPhraseId(b.group) && a.group.vicinity === b.group.vicinity
    )
  }
  return a.group === null && b.group === null && a.wind !== null && b.wind !== null
}

/**
 * Birleşen kuvvetli rüzgâr dilimlerinin en güçlü değerleri: en yüksek ortalama ve en yüksek hamle
 * (ör. 25G38'in ardından 28G40 → 28 kt, hamle 40 kt). Yön ve yön aralığı ortalaması en yüksek
 * dilimden (eşitse öncekinden) gelir. Ortalamadan büyük olmayan hamle yazılmaz.
 */
function strongestWind(a: Wind, b: Wind): Wind {
  const base = (b.speedKt ?? 0) > (a.speedKt ?? 0) ? b : a
  const gusty = (b.gustKt ?? -1) > (a.gustKt ?? -1) ? b : a
  const gust = gusty.gustKt
  const kept = gust !== null && gust > (base.speedKt ?? 0)
  return {
    ...base,
    gustKt: kept ? gust : null,
    gustKmh: kept ? (gusty.gustKmh ?? null) : null,
    aboveMaxKt: a.aboveMaxKt || b.aboveMaxKt,
  }
}

/**
 * Hâkim durumun (temel tahmin, FM, BECMG) ardışık dilimleri aynı öğeyi taşıyorsa tek öğe olur;
 * sonu, birleşen dilimlerin sonudur. Dilimler bir TAF'ın içinde başka bir öğe değişince (ör.
 * yalnız rüzgârı değiştiren BECMG) ve bir TAF'tan yenisine geçerken (kapsama sınırı) bölünür; olay
 * sürüyorsa "… saatine kadar" o sınırı değil olayın gerçek sonunu söylemelidir. Birleşen kuvvetli
 * rüzgâr öğesi ilk dilimin değil bütün dilimlerin en güçlü değerlerini söyler (`strongestWind`).
 * TEMPO ve PROB pencereleri birleştirilmez.
 */
function mergePrevailing(candidates: readonly Candidate[]): Candidate[] {
  const others = candidates.filter((c) => !PREVAILING.has(c.kind))
  const runs: Candidate[] = []
  const prevailing = candidates
    .filter((c) => PREVAILING.has(c.kind))
    .sort((a, b) => a.from - b.from || a.to - b.to)
  for (const candidate of prevailing) {
    const run = runs.findLast((r) => sameSubject(r, candidate))
    // Bitişik ya da örtüşen (BECMG penceresi boyunca süren eski koşul) dilimler birleşir.
    if (run && candidate.from <= run.to) {
      run.to = Math.max(run.to, candidate.to)
      if (run.wind && candidate.wind) run.wind = strongestWind(run.wind, candidate.wind)
    } else runs.push({ ...candidate })
  }
  return [...runs, ...others]
}

const CERTAINTY: Record<Kind, number> = {
  BASE: 0,
  FM: 0,
  BECMG: 0,
  TEMPO: 1,
  PROBTEMPO: 2,
  PROB: 2,
}

/** Rüzgâr şiddetinin sırası (`WIND_LEVELS`, zayıftan güçlüye); eşiğin altında −1. */
function windRank(wind: Wind | null): number {
  const level = windLevel(wind)
  return level === null ? -1 : WIND_LEVELS.indexOf(level)
}

function timeParam(at: number, now: number, timeZone: string): WeatherText {
  const iso = new Date(at).toISOString()
  const time: Measure = { measure: 'time', iso }
  const days = localDayDifference(now, at, timeZone)
  if (days === 0) return time
  if (days === 1) return phrase('weather.time.tomorrow', { time })
  return phrase('weather.time.onDate', { date: { measure: 'date', iso }, time })
}

function itemText(c: Candidate, now: number, timeZone: string): WeatherText {
  const level = windLevel(c.wind)
  const subject: WeatherText = c.group
    ? weatherGroupText(c.group)
    : phrase('weather.taf.strongWind', {
        level: phrase(`weather.wind.level.${level ?? 'strong'}`),
        wind: windText(c.wind),
      })
  const from = timeParam(c.from, now, timeZone)
  const to = timeParam(c.to, now, timeZone)
  const probability = c.probability ?? 30
  switch (c.kind) {
    case 'BASE':
      return c.started
        ? phrase('weather.taf.until', { to, phrase: subject })
        : phrase('weather.taf.base', { from, to, phrase: subject })
    case 'FM':
      return c.started
        ? phrase('weather.taf.until', { to, phrase: subject })
        : phrase('weather.taf.fm', { from, phrase: subject })
    case 'BECMG':
      return c.started
        ? phrase('weather.taf.until', { to, phrase: subject })
        : phrase('weather.taf.becmg', {
            from,
            to: timeParam(c.becmgTo ?? c.to, now, timeZone),
            phrase: subject,
          })
    case 'TEMPO':
      return c.started
        ? phrase('weather.taf.tempoUntil', { to, phrase: subject })
        : phrase('weather.taf.tempo', { from, to, phrase: subject })
    case 'PROB':
      return c.started
        ? phrase('weather.taf.probUntil', { to, probability, phrase: subject })
        : phrase('weather.taf.prob', { from, to, probability, phrase: subject })
    case 'PROBTEMPO':
      return c.started
        ? phrase('weather.taf.probTempoUntil', { to, probability, phrase: subject })
        : phrase('weather.taf.probTempo', { from, to, probability, phrase: subject })
  }
}

/**
 * Süresi dolmamış TAF'lar, en son yayımlanan önce (yayım zamanı yoksa geçerlilik başı; eşitte
 * giriş sırası korunur). Geçerlilik sonu olmayan NIL ya da iptal (CNL) TAF da sayılır.
 */
function liveNewestFirst<T extends DecodedTaf>(tafs: readonly T[], nowMs: number): T[] {
  const issued = (t: DecodedTaf) => ms(t.issuedAt) ?? ms(t.validFrom) ?? 0
  return [...tafs]
    .sort((a, b) => issued(b) - issued(a))
    .filter((t) => {
      const end = ms(t.validTo)
      return end === null ? t.nil || t.cancelled : end > nowMs
    })
}

/** Özetin kullandığı TAF: NIL ya da iptal değil, geçerlilik başı ve sonu var. */
const isUsableTaf = (t: DecodedTaf): boolean =>
  !t.nil && !t.cancelled && Boolean(t.validFrom) && Boolean(t.validTo)

/**
 * Yürürlükteki TAF'lar (D-088): süresi dolmamış TAF'lardan, kalan geçerliliğinin (şimdiden
 * geçerlilik sonuna) tamamı daha yeni yayımlanmış TAF'larca kapsananlar çıkar. Yeni TAF eskisinin
 * yerini alır (WMO-782 s. 48); `summarizeTaf` her saat için en son yayımlanan ve o saati kapsayan
 * TAF'ı kullandığından çıkan TAF'lar özete hiçbir dilim vermez, özet aynı kalır (birim testi
 * denetler). Henüz başlamamış yeni TAF'ın önündeki saatleri veren eski TAF kalır. NIL ve iptal
 * TAF'lar ve tarihi eksik olanlar kimseyi kapsamaz, süreleri dolmadıkça kalır. Giriş sırası korunur.
 *
 * Toplu hava yanıtı (`GET /v1/weather`) ve tek havalimanının havası yalnız bunları taşır; eski
 * TAF'lar METAR/TAF kaydındadır (`/weather/history`). 1. halkada üretimde istasyon başına ortalama
 * 3,4 geçerli TAF vardı ve toplu yanıtın %84'ü TAF'tı.
 */
export function inForceTafs<T extends DecodedTaf>(tafs: readonly T[], now: DateInput): T[] {
  const nowMs = toDate(now).getTime()
  const live = liveNewestFirst(tafs, nowMs)
  const contributing = new Set<DecodedTaf>(
    coverage(live.filter(isUsableTaf), nowMs).map((segment) => segment.taf),
  )
  const kept = new Set<DecodedTaf>(live.filter((t) => !isUsableTaf(t) || contributing.has(t)))
  return tafs.filter((t) => kept.has(t))
}

/**
 * Geçerli TAF'ların sade dil özeti: şimdiden itibaren (varsayılan 24 saat) her saat için en son
 * yayımlanan ve o saati kapsayan TAF kullanılır (WMO-782 s. 48); tahmin geçerlilik sonunun ötesine
 * uzatılmaz. En önemli hava olayı (TEMPO ve PROB dahil) zaman penceresi ve niteleyicisiyle, varsa
 * en şiddetli kuvvetli rüzgâr ikinci satırda verilir.
 */
export function summarizeTaf(
  tafs: readonly DecodedTaf[],
  now: DateInput,
  options: SummarizeTafOptions = {},
): TafSummary {
  const nowMs = toDate(now).getTime()
  const timeZone = options.timeZone ?? TURKEY_TIME_ZONE
  const horizonEnd = nowMs + (options.horizonHours ?? 24) * 3_600_000
  const live = liveNewestFirst(tafs, nowMs)
  const empty = (status: TafSummary['status'], key: 'none' | 'cancelled' | 'nil'): TafSummary => ({
    status,
    items: [],
    validUntil: null,
    message: phrase(`weather.taf.${key}`),
    amended: false,
    corrected: false,
  })
  const newest = live[0]
  if (newest?.cancelled) return empty('cancelled', 'cancelled')
  const usable = live.filter(isUsableTaf)
  if (usable.length === 0) return newest?.nil ? empty('nil', 'nil') : empty('none', 'none')

  const candidates = mergePrevailing(
    coverage(usable, nowMs).flatMap((segment) =>
      candidatesFor(segment.taf, segment.from, segment.to, nowMs, horizonEnd),
    ),
  )
  const weatherCandidates = candidates
    .filter((c): c is Candidate & { group: WeatherGroup } => c.group !== null)
    .sort(
      (a, b) =>
        compareWeatherSeverity(a.group, b.group) ||
        a.from - b.from ||
        CERTAINTY[a.kind] - CERTAINTY[b.kind],
    )
  // Rüzgâr da hava olayı gibi önce şiddetine göre seçilir: sonra gelen daha güçlü rüzgâr (ör.
  // kuvvetli temel rüzgârın ardından TEMPO fırtına) öncekinin arkasında kalmaz (D-083). Eşitse en
  // erken, sonra en kesin olan.
  const windCandidates = candidates
    .filter((c) => c.wind !== null)
    .sort(
      (a, b) =>
        windRank(b.wind) - windRank(a.wind) ||
        a.from - b.from ||
        CERTAINTY[a.kind] - CERTAINTY[b.kind],
    )

  const chosen: Candidate[] = []
  const first = weatherCandidates[0]
  if (first) chosen.push(first)
  const strong = windCandidates[0]
  if (strong) chosen.push(strong)
  else if (first) {
    const firstId = weatherPhraseId(first.group)
    const second = weatherCandidates.find((c) => weatherPhraseId(c.group) !== firstId)
    if (second) chosen.push(second)
  }

  const validTo = Math.max(...usable.map((t) => ms(t.validTo) ?? 0))
  const lead = usable[0]
  return {
    status: 'ok',
    items: chosen.slice(0, 2).map((c) => itemText(c, nowMs, timeZone)),
    validUntil: phrase('weather.taf.validUntil', { time: timeParam(validTo, nowMs, timeZone) }),
    message: chosen.length === 0 ? phrase('weather.taf.nothingSignificant') : null,
    amended: lead?.amended ?? false,
    corrected: lead?.corrected ?? false,
  }
}
