import { z } from 'zod'

/**
 * Havalimanı hava durumunun (METAR/SPECI ve TAF) ortak sözleşmesi (Parça 1 M6c, D-078).
 *
 * - API raporları okurken çözer (`decodeMetar`, `decodeTaf`) ve bu şemalarla doğrulayıp gönderir;
 *   web, harita penceresi ve ileride mobil aynı şemalarla okur.
 * - Esas veri ham metindir: görüş, bulut, sıcaklık ve rüzgâr ham metinden çözülür. aviationweather.gov
 *   JSON alanlarından yalnızca zamanlar ve istasyon kodu kullanılır (brief §2).
 * - Birimler havacılık birimidir (kt, ft, hPa, °C); görüş metredir. Metrik gösterim arayüzdedir.
 * - Bilinmeyen değer `null`'dır; şemada dönüştürme (transform) yoktur, böylece `z.toJSONSchema`
 *   OpenAPI belgesini aynı şemadan üretebilir.
 */

/** Hava olayı şiddeti: `-` hafif, işaretsiz orta, `+` kuvvetli/yoğun. */
export const WX_INTENSITIES = ['light', 'moderate', 'heavy'] as const
export type WxIntensity = (typeof WX_INTENSITIES)[number]

/** Hava olayı tanımlayıcıları (WMO Code 4678): sığ, parçalı, kısmi, sürüklenen, savrulan, sağanak, oraj, donan. */
export const WX_DESCRIPTORS = ['MI', 'BC', 'PR', 'DR', 'BL', 'SH', 'TS', 'FZ'] as const
export type WxDescriptor = (typeof WX_DESCRIPTORS)[number]

/**
 * Hava olayları (WMO Code 4678). Yağış: DZ RA SN SG IC PL GR GS UP; görüşü azaltan: BR FG FU VA DU
 * SA HZ PY; diğer: PO SQ FC SS DS.
 */
export const WX_PHENOMENA = [
  'DZ',
  'RA',
  'SN',
  'SG',
  'IC',
  'PL',
  'GR',
  'GS',
  'UP',
  'BR',
  'FG',
  'FU',
  'VA',
  'DU',
  'SA',
  'HZ',
  'PY',
  'PO',
  'SQ',
  'FC',
  'SS',
  'DS',
] as const
export type WxPhenomenon = (typeof WX_PHENOMENA)[number]

/** Bulut miktarı: FEW 1–2/8, SCT 3–4/8, BKN 5–7/8, OVC 8/8. */
export const CLOUD_COVERS = ['FEW', 'SCT', 'BKN', 'OVC'] as const
export type CloudCover = (typeof CLOUD_COVERS)[number]

/**
 * Gökyüzü durumu: bulut katmanları, dikey görüş (VV), NSC (önemli bulut yok), NCD (otomatik
 * istasyon bulut algılamadı), SKC/CLR (açık), CAVOK ya da bilinmiyor (grup yok veya `//////`).
 */
export const SKY_KINDS = ['layers', 'vv', 'nsc', 'ncd', 'skc', 'clr', 'cavok', 'unknown'] as const
export type SkyKind = (typeof SKY_KINDS)[number]

/** Sekiz ana yön (en düşük görüşün yönü ve sade görünümdeki rüzgâr yönü). */
export const COMPASS_POINTS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type CompassPoint8 = (typeof COMPASS_POINTS_8)[number]

/** On altı yön (22,5° dilimler). */
export const COMPASS_POINTS_16 = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const
export type CompassPoint16 = (typeof COMPASS_POINTS_16)[number]

/**
 * Etkili rüzgârın şiddeti (D-083), zayıftan güçlüye; rüzgâr satırı bu düzeylerde vurgulanır. Vurgu
 * eşiği ortalama ≥ 17 kt (MGM Beaufort 5) ya da hamle ≥ 25 kt'dir (kullanıcı kararı 2026-10-03);
 * MGM meydan uyarısı eşiği (ortalama ≥ 20 kt ya da hamle ≥ 30 kt) `gusts` ve üstüdür
 * (`isStrongWind`). Adlar MGM Beaufort ıskalasından, hamle karşılıkları Met Office'in fırtına
 * tanımından gelir (`windLevel`). `gusty`: hamle 25–29 kt, ortalama 17 kt'nin altında ("Hamleli
 * rüzgâr"); `fresh`: ortalama 17–19 kt ("Sert rüzgâr"); `gusts`: yalnız hamle meydan uyarısı
 * eşiğini aştı ("Kuvvetli hamle").
 */
export const WIND_LEVELS = [
  'gusty',
  'fresh',
  'gusts',
  'strong',
  'nearGale',
  'gale',
  'severeGale',
  'storm',
  'violentStorm',
  'hurricane',
] as const
export type WindLevel = (typeof WIND_LEVELS)[number]

/**
 * Hafif rüzgâr (kullanıcı kararı 2026-10-03, D-083): gösterilen hız 10 km/sa ya da altında, sakin
 * dahil; rüzgâr satırı açık yeşildir. Değer metni ilk ikisinde durumu zaten söyler: `calm` "Sakin"
 * (`00000KT`), `lightVariable` "Hafif ve değişken yönlü" (`VRB` ≤ 3 kt). `light` hızı yazar
 * ("Kuzeyden 9 km/sa (5 kt)"); arayüz yanına "Hafif rüzgâr" etiketini koyar (vurgu yalnız renk
 * değildir).
 */
export const LIGHT_WINDS = ['calm', 'lightVariable', 'light'] as const
export type LightWind = (typeof LIGHT_WINDS)[number]

/**
 * Şimşek ve yıldırım uyarısı (D-083), güncel gözlemden: `here` havalimanında oraj ve yağış (ya da
 * yağış belirlenemedi), `hereDry` havalimanında yağışsız oraj (rapor temiz çözüldü), `vicinity`
 * çevrede oraj (VCTS), `cloudPrecip` kümülonimbüs ve havalimanında yağış var ama oraj bildirilmedi
 * (kullanıcı isteği 2026-10-03: "yağmurla beraber … tehlikesi"), `cloud` kümülonimbüs var, oraj ve
 * yağış bildirilmedi, `cloudUndetermined` kümülonimbüs var ve hava olayı belirlenemedi.
 */
export const LIGHTNING_RISKS = [
  'here',
  'hereDry',
  'vicinity',
  'cloudPrecip',
  'cloud',
  'cloudUndetermined',
] as const
export type LightningRisk = (typeof LIGHTNING_RISKS)[number]

/** AWC uçuş kategorisi (ABD sınıflandırması; yalnızca uzman görünümünde, brief §5). */
export const FLIGHT_CATEGORIES = ['VFR', 'MVFR', 'IFR', 'LIFR'] as const
export type FlightCategory = (typeof FLIGHT_CATEGORIES)[number]

/**
 * Simge kategorisi (kendi SVG simgelerimiz; brief §5). `clear`, `fair` ve `partly` gece için
 * `_night` ekiyle gelir (`iconCategory(metar, isDay)`).
 */
export const WEATHER_ICON_CATEGORIES = [
  'severe',
  'thunder',
  'thunder_hail',
  'freezing',
  'hail',
  'snow',
  'sleet',
  'rain_heavy',
  'rain',
  'showers',
  'drizzle',
  'fog',
  'mist_haze',
  'dust_sand',
  'clear',
  'clear_night',
  'fair',
  'fair_night',
  'partly',
  'partly_night',
  'mostly_cloudy',
  'overcast',
  'obscured',
  'unknown',
] as const
export type WeatherIconCategory = (typeof WEATHER_ICON_CATEGORIES)[number]

const isoDateTime = z.iso.datetime({ offset: true })

/** ICAO konum göstergesi (DB kısıtıyla aynı: `^[A-Z0-9]{4}$`). */
export const IcaoSchema = z.string().regex(/^[A-Z0-9]{4}$/)

/** Bir hava olayı grubu (ör. `-SHRA`, `VCTS`, `RERA`'nın `RA` kısmı). */
export const WeatherGroupSchema = z.object({
  /** Gruptaki metin, olduğu gibi (`RE` öneki dahil). */
  raw: z.string(),
  /** Şiddet yağışı niteler: `-TSRA`'da hafif olan yağmurdur, oraj değil. */
  intensity: z.enum(WX_INTENSITIES),
  /** `VC`: havalimanında değil, çevresinde (8–16 km). */
  vicinity: z.boolean(),
  descriptor: z.enum(WX_DESCRIPTORS).nullable(),
  phenomena: z.array(z.enum(WX_PHENOMENA)),
})
export type WeatherGroup = z.infer<typeof WeatherGroupSchema>

/** Yer rüzgârı (10 dk ortalama, gerçek kuzeye göre, esen yön). */
export const WindSchema = z.object({
  /** `00000KT`. */
  calm: z.boolean(),
  /** `VRB`: yön değişken. */
  variable: z.boolean(),
  /** Esen yön, derece; değişken ya da bilinmiyorsa null. */
  directionDeg: z.number().nullable(),
  /** Ortalama hız, kt (MPS/KMH çevrilir, tam sayıya yuvarlanır); bilinmiyorsa null. */
  speedKt: z.number().nullable(),
  /** Hamle, kt. */
  gustKt: z.number().nullable(),
  /**
   * Ortalama hız ve hamle, km/sa, raporun kendi biriminden tek yuvarlamayla (KT × 1,852; MPS × 3,6;
   * KMH olduğu gibi). kt'den yeniden çevrilseydi MPS raporunda 1 km/sa sapabilirdi (11 MPS = 21 kt
   * → 39 km/sa; doğrusu 40). M6e'de eklendi (D-083): eski API yanıtında yoktur, yoksa kt'den çevrilir.
   */
  speedKmh: z.number().nullable().optional(),
  gustKmh: z.number().nullable().optional(),
  /** `dddVddd`: yönün değiştiği aralık, saat yönünde. */
  varyingFromDeg: z.number().nullable(),
  varyingToDeg: z.number().nullable(),
  /**
   * `P99KT` (100 kt ve üzeri) ya da `P49MPS` (50 m/s ve üzeri, 97 kt): ortalama ya da hamle ölçeğin
   * üstünde. Hangisi olduğu `offScaleWind`'dan okunur.
   */
  aboveMaxKt: z.boolean(),
})
export type Wind = z.infer<typeof WindSchema>

/** Görüş. Ham metindeki metre değeridir (AWC `visib` mil ve kayıplıdır, kullanılmaz). */
export const VisibilitySchema = z.object({
  /** Hâkim görüş, m; `9999` → 10000, `0000` → 50 (`below`); bilinmiyorsa (`////`) null. */
  meters: z.number().nullable(),
  /** `9999` ya da CAVOK: 10 km ve üzeri. */
  tenKmOrMore: z.boolean(),
  /** `0000`: 50 m'den az. */
  lessThan50m: z.boolean(),
  /** Değer bir sınır: `above` (ör. `P6SM`), `below` (`0000`, `M1/4SM`). */
  qualifier: z.enum(['above', 'below']).nullable(),
  /** En düşük görüş ve yönü (ör. `1400SW`). */
  minimum: z
    .object({ meters: z.number(), direction: z.enum(COMPASS_POINTS_8).nullable() })
    .nullable(),
  /** `NDV`: yöne göre değişim bilinmiyor (otomatik istasyon). */
  ndv: z.boolean(),
})
export type Visibility = z.infer<typeof VisibilitySchema>

/** Pist görüş mesafesi (RVR), `Rxx/[PM]dddd[V[PM]dddd][UDN]`. */
export const RvrSchema = z.object({
  runway: z.string(),
  /** m (FT ile verilmişse çevrilir); bilinmiyorsa (`R24/////`) null. */
  meters: z.number().nullable(),
  qualifier: z.enum(['above', 'below']).nullable(),
  varyingToMeters: z.number().nullable(),
  varyingToQualifier: z.enum(['above', 'below']).nullable(),
  /** U artıyor, D azalıyor, N değişmiyor. */
  tendency: z.enum(['up', 'down', 'none']).nullable(),
})
export type Rvr = z.infer<typeof RvrSchema>

/** Bulut katmanı; tabanlar yerden (havalimanı seviyesinden) ft. */
export const CloudLayerSchema = z.object({
  /** `///` (otomatik istasyon miktarı ölçemedi) ise null. */
  cover: z.enum(CLOUD_COVERS).nullable(),
  baseFt: z.number().nullable(),
  /** Kümülonimbüs ya da kule biçimli kümülüs. */
  type: z.enum(['CB', 'TCU']).nullable(),
})
export type CloudLayer = z.infer<typeof CloudLayerSchema>

/** Gökyüzü: düz nesne (birleşim değil), istemciler ve JSON şeması için basit tutulur. */
export const SkySchema = z.object({
  kind: z.enum(SKY_KINDS),
  /** `kind === 'layers'` iken katmanlar, alçaktan yükseğe; aksi hâlde boş. */
  layers: z.array(CloudLayerSchema),
  /** `kind === 'vv'` iken dikey görüş, ft (`VV///` → null). */
  verticalVisibilityFt: z.number().nullable(),
})
export type Sky = z.infer<typeof SkySchema>

/** Rüzgâr kesmesi (`WS R35`, `WS ALL RWY`). */
export const WindShearSchema = z.object({
  allRunways: z.boolean(),
  runways: z.array(z.string()),
})
export type WindShear = z.infer<typeof WindShearSchema>

/**
 * Bir değişiklik grubunun (METAR TREND, TAF dönemi) bildirdiği koşullar. Değişiklik gruplarında
 * `null` ya da boş alan "değişmiyor" demektir; `nsw` önemli hava olayının sona erdiğini söyler.
 */
const conditionsShape = {
  wind: WindSchema.nullable(),
  visibility: VisibilitySchema.nullable(),
  cavok: z.boolean(),
  weather: z.array(WeatherGroupSchema),
  /** NSW: önemli hava olayı sona eriyor. */
  nsw: z.boolean(),
  sky: SkySchema.nullable(),
  /** Grupta çözülemeyen parçalar. */
  unparsed: z.array(z.string()),
}

/** METAR TREND grubu (önümüzdeki 2 saat). */
export const TrendGroupSchema = z.object({
  kind: z.enum(['BECMG', 'TEMPO']),
  /** Grubun ham metni (`TEMPO FM1300 4000 SHRA`). */
  raw: z.string(),
  /** FM/TL/AT zamanları (UTC, ISO 8601); gözlem zamanı bilinmiyorsa ya da grup yoksa null. */
  from: isoDateTime.nullable(),
  until: isoDateTime.nullable(),
  at: isoDateTime.nullable(),
  ...conditionsShape,
})
export type TrendGroup = z.infer<typeof TrendGroupSchema>

/** Çözülen METAR'dan türetilen değerler. */
export const WeatherFlagsSchema = z.object({
  /** Havalimanında yağmur ya da çisenti (sağanak, oraj, donan ve karışık dahil). */
  rain: z.boolean(),
  /** Havalimanında kar, kar taneleri, buz taneleri, buz kristalleri; savrulan/sürüklenen kar dahil. */
  snow: z.boolean(),
  /** Havalimanında oraj (gök gürültülü). */
  thunderstorm: z.boolean(),
  /** Havalimanında sis (sığ, parçalı, kısmi, donan dahil). */
  fog: z.boolean(),
  /** Pus (BR). */
  mist: z.boolean(),
  /** Kuru pus (HZ). */
  haze: z.boolean(),
  /** Donan yağış ya da donan sis (FZ). */
  freezing: z.boolean(),
  /** Dolu ya da küçük dolu (GR/GS). */
  hail: z.boolean(),
  /** Türü belirlenemeyen yağış (UP). */
  unknownPrecipitation: z.boolean(),
  /** Toz, kum, toz/kum hortumu, kum/toz fırtınası. */
  dustSand: z.boolean(),
  /** Duman, volkanik kül, ani sert rüzgâr (SQ), hortum (FC). */
  otherPhenomena: z.boolean(),
  /** Havalimanı çevresinde sağanak (VCSH). */
  vicinityShowers: z.boolean(),
  /** Havalimanı çevresinde oraj (VCTS). */
  vicinityThunderstorm: z.boolean(),
  /** Havalimanı çevresinde sis (VCFG). */
  vicinityFog: z.boolean(),
  /** Son saatteki (RE) hava olayı bildirildi. */
  recent: z.boolean(),
  /** Kümülonimbüs bulutu var. */
  cb: z.boolean(),
  /** Kule biçimli kümülüs var. */
  tcu: z.boolean(),
})
export type WeatherFlags = z.infer<typeof WeatherFlagsSchema>

/**
 * Başlık durumu: havalimanındaki en önemli hava olayı (MGM meydan uyarı sırası; brief §5) ya da
 * gökyüzü. `phrase` metin anahtarı kimliğidir (`weather.wx.<phrase>`, `weather.clouds.<phrase>`).
 */
export const HeadlineSchema = z.object({
  kind: z.enum(['weather', 'sky', 'nil', 'undetermined']),
  /** Seçilen hava grubu (`-SHRA`) ya da gökyüzü kodu (`BKN`, `CAVOK`, `NSC`, `VV`). */
  code: z.string(),
  /** Metin kimliği (`SHRA_light`, `BKN`, `cavok`). */
  phrase: z.string(),
})
export type Headline = z.infer<typeof HeadlineSchema>

export const MetarDerivedSchema = z.object({
  /** Tavan: en alçak BKN/OVC katmanı ya da dikey görüş, ft; yoksa null. */
  ceilingFt: z.number().nullable(),
  /** Bağıl nem (Magnus, Alduchov–Eskridge), %5'e yuvarlanmış, en fazla 100. */
  relativeHumidityPct: z.number().nullable(),
  flags: WeatherFlagsSchema,
  headline: HeadlineSchema,
  /** Ortalama ≥ 20 kt ya da hamle ≥ 30 kt (MGM meydan uyarı eşikleri). */
  strongWind: z.boolean(),
  /**
   * Raporun gövdesinde hava olayına benzeyen ama çözülemeyen parça var, hava olayı gözlenemedi
   * (`//`) ya da rapor NIL: yağmur, kar, oraj ve sis için "yok" denemez, "belirlenemedi" denir.
   */
  weatherUndetermined: z.boolean(),
  /** Gündüz simgesi; gece biçimi için `iconCategory(metar, isDay)`. */
  icon: z.enum(WEATHER_ICON_CATEGORIES),
})
export type MetarDerived = z.infer<typeof MetarDerivedSchema>

/** `decodeMetar` çıktısı. */
export const DecodedMetarSchema = z.object({
  /** Ham metindeki istasyon; okunamazsa null. */
  station: z.string().nullable(),
  type: z.enum(['METAR', 'SPECI']),
  /** Gözlem zamanı (UTC, ISO 8601); verilmemiş ve çözülememişse null. */
  observedAt: isoDateTime.nullable(),
  raw: z.string(),
  /** AUTO: otomatik gözlem. */
  auto: z.boolean(),
  /** COR: düzeltilmiş rapor. */
  corrected: z.boolean(),
  /** NIL: rapor yayımlanmadı. */
  nil: z.boolean(),
  /** Bilinmiyorsa (`/////KT` ya da grup yok) null. */
  wind: WindSchema.nullable(),
  visibility: VisibilitySchema.nullable(),
  cavok: z.boolean(),
  rvr: z.array(RvrSchema),
  /** Hâlihazır hava (havalimanı ve çevresi). */
  weather: z.array(WeatherGroupSchema),
  /** Son saatteki hava (`RE..`). */
  recent: z.array(WeatherGroupSchema),
  sky: SkySchema,
  temperatureC: z.number().nullable(),
  dewPointC: z.number().nullable(),
  /** QNH, hPa (`Qdddd`; `Adddd` inHg ise çevrilir). */
  qnhHpa: z.number().nullable(),
  windShear: WindShearSchema.nullable(),
  trend: z.array(TrendGroupSchema),
  /** NOSIG: önümüzdeki 2 saatte önemli değişiklik beklenmiyor. */
  nosig: z.boolean(),
  /** AWC `fltCat`; çözücü bilmez (null), API kayıttan doldurur. */
  flightCategory: z.enum(FLIGHT_CATEGORIES).nullable(),
  /** RMK sonrası, olduğu gibi. */
  remarks: z.string().nullable(),
  /** Çözülemeyen parçalar (gövde ve TREND). */
  unparsed: z.array(z.string()),
  derived: MetarDerivedSchema,
})
export type DecodedMetar = z.infer<typeof DecodedMetarSchema>

/** TAF dönemi: temel tahmin ya da değişiklik grubu. */
export const TafPeriodSchema = z.object({
  /** BASE temel; FM tam değişiklik; BECMG kademeli; TEMPO geçici; PROB yalnız olasılık. */
  kind: z.enum(['BASE', 'FM', 'BECMG', 'TEMPO', 'PROB']),
  /** PROB30/PROB40 (TEMPO ile birlikte de olabilir). */
  probability: z.number().nullable(),
  /** Dönemin başı ve sonu (UTC, ISO 8601). FM için son, sonraki FM ya da geçerlilik sonudur. */
  from: isoDateTime.nullable(),
  to: isoDateTime.nullable(),
  raw: z.string(),
  ...conditionsShape,
})
export type TafPeriod = z.infer<typeof TafPeriodSchema>

/** `decodeTaf` çıktısı. */
export const DecodedTafSchema = z.object({
  station: z.string().nullable(),
  issuedAt: isoDateTime.nullable(),
  validFrom: isoDateTime.nullable(),
  validTo: isoDateTime.nullable(),
  raw: z.string(),
  /** AMD: güncellenmiş tahmin. */
  amended: z.boolean(),
  /** COR: düzeltilmiş tahmin. */
  corrected: z.boolean(),
  /** CNL: tahmin iptal edildi. */
  cancelled: z.boolean(),
  /** NIL: tahmin yok. */
  nil: z.boolean(),
  periods: z.array(TafPeriodSchema),
  unparsed: z.array(z.string()),
})
export type DecodedTaf = z.infer<typeof DecodedTafSchema>

/** API'deki METAR: gözlem zamanı kayıttan gelir, her zaman doludur. */
export const AirportMetarSchema = DecodedMetarSchema.extend({ observedAt: isoDateTime })
export type AirportMetar = z.infer<typeof AirportMetarSchema>

/** API'deki TAF: zamanlar kayıttan gelir (AWC epoch'u ham gün/saatten önceliklidir). */
export const AirportTafSchema = DecodedTafSchema.extend({
  issuedAt: isoDateTime,
  validFrom: isoDateTime,
  validTo: isoDateTime,
})
export type AirportTaf = z.infer<typeof AirportTafSchema>

/**
 * Bir havalimanının güncel havası: `GET /v1/airports/:code/weather` ve toplu yanıtın elemanı.
 * Rapor yoksa `metar: null`, geçerli TAF yoksa `tafs: []` (404 değil).
 */
export const AirportWeatherSchema = z.object({
  icao: IcaoSchema,
  generatedAt: isoDateTime,
  metar: AirportMetarSchema.nullable(),
  /** Süresi dolmamış TAF'lar, en yeni yayımlanan önce. */
  tafs: z.array(AirportTafSchema),
})
export type AirportWeather = z.infer<typeof AirportWeatherSchema>

/** Veri atfı (lisans kaydındaki metin ve bağlantı). */
export const WeatherAttributionSchema = z.object({ text: z.string(), url: z.string() })

/** `GET /v1/weather?country=TR`: listedeki her havalimanı, liste sırasıyla. */
export const WeatherBulkResponseSchema = z.object({
  generatedAt: isoDateTime,
  attribution: WeatherAttributionSchema,
  stations: z.array(AirportWeatherSchema),
})
export type WeatherBulkResponse = z.infer<typeof WeatherBulkResponseSchema>

/** METAR/TAF kaydının bir satırı. */
export const WeatherHistoryEntrySchema = z.object({
  kind: z.enum(['METAR', 'SPECI', 'TAF']),
  /** METAR/SPECI için gözlem, TAF için yayım zamanı. */
  time: isoDateTime,
  raw: z.string(),
  /** METAR/SPECI'nin çözümü (güncel havadaki `metar` ile aynı biçim). */
  metar: AirportMetarSchema.optional(),
  /** TAF özeti. */
  taf: z
    .object({
      validFrom: isoDateTime,
      validTo: isoDateTime,
      amended: z.boolean(),
      corrected: z.boolean(),
      cancelled: z.boolean(),
    })
    .optional(),
})
export type WeatherHistoryEntry = z.infer<typeof WeatherHistoryEntrySchema>

/** `GET /v1/airports/:code/weather/history?hours=24`: en yeni önce. */
export const WeatherHistoryResponseSchema = z.object({
  icao: IcaoSchema,
  from: isoDateTime,
  to: isoDateTime,
  generatedAt: isoDateTime,
  entries: z.array(WeatherHistoryEntrySchema),
})
export type WeatherHistoryResponse = z.infer<typeof WeatherHistoryResponseSchema>
