import { PROVIDER_LICENSES } from '@havayolu/providers'
import {
  AirportWeatherSchema,
  IcaoSchema,
  inForceTafs,
  toAirportMetar,
  toAirportTaf,
  toRawMetar,
  toRawTaf,
  WEATHER_BULK_FORMATS,
  WeatherBulkRawResponseSchema,
  WeatherBulkResponseSchema,
  WeatherHistoryResponseSchema,
  type AirportMetar,
  type AirportTaf,
  type AirportWeather,
  type MetarRecordInput,
  type RawAirportWeather,
  type RawMetar,
  type RawTaf,
  type TafRecordInput,
  type WeatherBulkFormat,
  type WeatherBulkRawResponse,
  type WeatherBulkResponse,
  type WeatherHistoryResponse,
} from '@havayolu/shared'
import type { FastifyBaseLogger, FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  AIRPORT_CODE,
  AIRPORT_ERRORS,
  AIRPORTS_CACHE_MAX_ENTRIES,
  AIRPORTS_CACHE_MS,
  AIRPORTS_EMPTY_CACHE_MS,
  AIRPORTS_RATE_LIMIT,
  airportSelection,
  errorSchema,
  selectionQueryProperties,
} from './airports'
import { cachedReader } from './cache'

/** `weather_metar` satırı: ham metin ve zamanlar (çözümleme okurken yapılır, D-078). */
export interface MetarRecord {
  stationIcao: string
  reportType: 'METAR' | 'SPECI'
  observedAt: Date
  rawText: string
  /** AWC `fltCat` (ABD sınıflandırması; yalnızca uzman görünümü). */
  flightCategory: string | null
}

/** `weather_taf` satırı. */
export interface TafRecord {
  stationIcao: string
  issuedAt: Date
  validFrom: Date
  validTo: Date
  rawText: string
}

/** Bir okumanın raporları; sıra önemli değildir (API sıralar). */
export interface WeatherRecords {
  metars: readonly MetarRecord[]
  tafs: readonly TafRecord[]
}

export interface WeatherRouteOptions {
  /**
   * Ülkenin listedeki havalimanları, liste sırasıyla (`listAirportsWithIata`); toplu yanıt bu
   * sırayla bir kayıt verir. `null`: veritabanı yok → 503.
   */
  stations: ((country: string) => Promise<readonly { icao: string }[]>) | null
  /**
   * Listelenen havalimanları, liste sırasıyla (`listListedAirports`; `scope=listed`, D-080).
   * Verilmezse ya da `null` ise `scope=listed` isteği 503.
   */
  listedStations?: (() => Promise<readonly { icao: string }[]>) | null
  /**
   * Kodu (büyük harfli ICAO ya da IATA) `/v1/airports/:code` ile aynı kuralla kanonik ICAO'ya
   * çevirir; bulunamazsa null. Verilmezse ya da `null` ise 503.
   */
  resolve?: ((code: string) => Promise<string | null>) | null
  /**
   * İstasyonların en yeni METAR/SPECI'si ve geçerli (`validTo > now`) TAF'ları. `null`: veritabanı
   * yok → 503.
   */
  latest: ((icaos: readonly string[], now: Date) => Promise<WeatherRecords>) | null
  /**
   * Bir istasyonun `[from, to]` aralığındaki raporları (METAR/SPECI gözlem, TAF yayım zamanına
   * göre). Verilmezse ya da `null` ise 503.
   */
  history?: ((icao: string, from: Date, to: Date) => Promise<WeatherRecords>) | null
  /** Saat, epoch ms (testte sahte saat). */
  now?: () => number
  /** Önbellek başına anahtar sınırı (varsayılan `AIRPORTS_CACHE_MAX_ENTRIES`; testte küçük). */
  cacheMaxEntries?: number
  /** Geçmiş önbelleğinin bayt bütçesi (varsayılan `WEATHER_HISTORY_CACHE_MAX_BYTES`; testte küçük). */
  historyCacheMaxBytes?: number
}

/** Toplu yanıt önbelleğinde `scope=listed` anahtarı (ülke kodları iki harftir, çakışmaz). */
const LISTED_KEY = 'listed'

/** Hava durumu yanıtları 60 sn süreç içinde tutulur; METAR en sık 5 dk'da bir yenilenir. */
export const WEATHER_CACHE_MS = 60_000
/** Tarayıcı ve web veri önbelleği: 60 sn. */
export const WEATHER_CACHE_CONTROL = 'public, max-age=60'
/** IP başına hız sınırı (havalimanı uçlarıyla aynı). */
export const WEATHER_RATE_LIMIT = AIRPORTS_RATE_LIMIT
/** Geçmiş penceresi, saat: varsayılan son 24 saat, istek başına en fazla 7 gün. */
export const WEATHER_HISTORY_DEFAULT_HOURS = 24
export const WEATHER_HISTORY_MAX_HOURS = 168
/**
 * Geçmiş önbelleği yalnızca iki sabit pencere tutar (24 ve 168 saat); başka `hours` değerleri
 * bunlardan biri kesilerek verilir. Böylece anahtar sayısı istasyon × 2 ile sınırlıdır: farklı
 * `hours` değerleriyle gelen istekler önbelleği şişiremez.
 */
export const WEATHER_HISTORY_CACHE_WINDOWS = [
  WEATHER_HISTORY_DEFAULT_HOURS,
  WEATHER_HISTORY_MAX_HOURS,
] as const
/**
 * Geçmiş önbelleğindeki anahtar sınırı: 3. halkada listelenen havalimanları × 2 pencereyi
 * karşılıyordu (498 × 2 = 996, askerî üsler çıkmadan önce 503 × 2 = 1.006; D-080, D-088, D-090,
 * D-107; 2. halkada 512'ydi). Belleği asıl sınırlayan bayt bütçesidir (24 MB): 24 saatlik pencereler
 * ~50–100 KB'tır, bütçeye en çok ~480 pencere sığar; 168 saatlik pencereler (0,5–0,7 MB) bütçeden
 * atılır. 4. halkada (1.217 × 2 = 2.434) değişmedi (D-101, D-102): bütçe anahtar sınırından önce
 * dolar.
 */
export const WEATHER_HISTORY_CACHE_MAX_ENTRIES = 1024
/**
 * Geçmiş önbelleğinin bayt bütçesi. 168 saatlik bir yanıt 0,5–0,7 MB'tır; API yığını 270 MB
 * (compose) olduğundan önbellek en çok 24 MB tutar, aşılınca en eski pencere atılır.
 */
export const WEATHER_HISTORY_CACHE_MAX_BYTES = 24 * 1024 * 1024

/** İstenen saati karşılayan en küçük önbellek penceresi. */
export function historyCacheWindow(hours: number): number {
  return (
    WEATHER_HISTORY_CACHE_WINDOWS.find((window) => hours <= window) ?? WEATHER_HISTORY_MAX_HOURS
  )
}

export const WEATHER_ERRORS = {
  badHours: {
    error: 'bad_hours',
    message: `hours 1–${WEATHER_HISTORY_MAX_HOURS} arasında tam sayı olmalı (varsayılan ${WEATHER_HISTORY_DEFAULT_HOURS}).`,
  },
  unavailable: {
    error: 'weather_unavailable',
    message: 'Hava durumu şu an kullanılamıyor.',
  },
  badFormat: {
    error: 'bad_format',
    message: `format ${WEATHER_BULK_FORMATS.join(' ya da ')} olmalı (varsayılan full).`,
  },
  /**
   * `scope=listed` yalnız ham biçimle (D-111): listelenen bütün havalimanlarının çözümlenmiş toplu
   * yanıtı 4. halkada ~4,4 MB, 5. halkada ~15,8 MB'tır ve önbellek her dolduğunda olay döngüsünü
   * ~0,5 sn tutardı. Web ham biçimi ister; tam biçim ülke isteğinde (`country=XX`) kalır.
   */
  rawRequired: {
    error: 'format_required',
    message:
      'scope=listed yalnızca format=raw ile istenebilir; çözümlenmiş biçim için country kullanın.',
  },
} as const

/** Toplu yanıtın biçimi; verilmezse `full`, geçersizse null (400 bad_format). */
export function weatherBulkFormat(value: unknown): WeatherBulkFormat | null {
  if (value === undefined) return 'full'
  return typeof value === 'string' && (WEATHER_BULK_FORMATS as readonly string[]).includes(value)
    ? (value as WeatherBulkFormat)
    : null
}

/** Atıf (NOAA Aviation Weather Center); lisans kaydındaki metin ve bağlantı. */
const ATTRIBUTION = PROVIDER_LICENSES.aviationWeather.attribution

/**
 * Zod sözleşmesinden (`@havayolu/shared`) OpenAPI şeması: belge ile yanıt aynı kaynaktan gelir.
 * Yanıt gövdesi Fastify serileştiricisiyle değil, aynı zod şemasıyla doğrulanıp bir kez metne
 * çevrilir (önbellek penceresi başına); bu yüzden şemada olmayan alan gönderilmez, olan düşmez.
 */
export function openApiSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { target: 'draft-7' }) as Record<
    string,
    unknown
  >
  return nullableEnums(rest) as Record<string, unknown>
}

/**
 * Zod `z.enum([...]).nullable()` alanını `anyOf: [{enum}, {type: 'null'}]` olarak yazar; Swagger bunu
 * OpenAPI 3.0'ın `nullable: true` biçimine çevirir. OpenAPI 3.0'da `nullable` `enum`'u genişletmez:
 * null değer listede yoksa geçersiz sayılır. Bu yüzden null'a izin veren her `anyOf`'taki enum'a
 * `null` eklenir (yayımlanan şema gerçek yanıtları kabul etsin; weather.test.ts → Ajv).
 */
export function nullableEnums(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(nullableEnums)
  if (node === null || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) out[key] = nullableEnums(value)
  const anyOf = out.anyOf
  if (
    Array.isArray(anyOf) &&
    anyOf.some((member) => isObjectRecord(member) && member.type === 'null')
  ) {
    out.anyOf = anyOf.map((member) =>
      isObjectRecord(member) && Array.isArray(member.enum) && !member.enum.includes(null)
        ? { ...member, enum: [...(member.enum as unknown[]), null] }
        : member,
    )
  }
  return out
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Hava raporları ICAO konum göstergesiyle tutulur; ICAO'su olmayan havalimanında rapor olmaz. */
const isIcao = (code: string) => IcaoSchema.safeParse(code).success

/** Aynı istasyonda en yeni gözlem; eşitse SPECI (önemli değişiklik raporu) önce. */
const newestMetarFirst = (a: MetarRecord, b: MetarRecord) =>
  b.observedAt.getTime() - a.observedAt.getTime() ||
  (a.reportType === b.reportType ? 0 : a.reportType === 'SPECI' ? -1 : 1)

const newestTafFirst = (a: TafRecord, b: TafRecord) => b.issuedAt.getTime() - a.issuedAt.getTime()

const metarInput = (row: MetarRecord): MetarRecordInput => ({
  raw: row.rawText,
  type: row.reportType,
  observedAt: row.observedAt,
  flightCategory: row.flightCategory,
})

const tafInput = (row: TafRecord): TafRecordInput => ({
  raw: row.rawText,
  issuedAt: row.issuedAt,
  validFrom: row.validFrom,
  validTo: row.validTo,
})

/** Kayıttaki raporun çözümlenmiş görünümleri (`@havayolu/shared` `toAirportMetar`/`toAirportTaf`). */
export interface WeatherViews {
  metarView(row: MetarRecord): AirportMetar | null
  tafView(row: TafRecord): AirportTaf | null
}

/**
 * Raporları okurken çözümler (ham metin esastır; D-078). Görünümler paylaşılandır (D-101): web ham
 * toplu yanıttan aynı fonksiyonlarla çözer. Çözümleyici atmaz; atarsa rapor loglanır ve yok sayılır:
 * tek bozuk rapor bütün havalimanlarının yanıtını düşürmez.
 */
export function weatherViews(log: FastifyBaseLogger): WeatherViews {
  return {
    metarView: (row) =>
      toAirportMetar(metarInput(row), (error) =>
        log.error(
          { err: error, station: row.stationIcao, raw: row.rawText },
          'metar could not be decoded',
        ),
      ),
    tafView: (row) =>
      toAirportTaf(tafInput(row), (error) =>
        log.error(
          { err: error, station: row.stationIcao, raw: row.rawText },
          'taf could not be decoded',
        ),
      ),
  }
}

/** Bir istasyonun okunan raporları. */
export interface StationRecords {
  metars: MetarRecord[]
  tafs: TafRecord[]
}

/**
 * Raporlar istasyona göre bir kez gruplanır: toplu yanıt her istasyon için bütün diziyi taramaz
 * (istasyon × rapor yerine istasyon + rapor; ~1.220 istasyonda ~62 ms yerine ~0,6 ms, D-101).
 */
export function groupByStation(records: WeatherRecords): Map<string, StationRecords> {
  const groups = new Map<string, StationRecords>()
  const group = (icao: string) => {
    let found = groups.get(icao)
    if (found === undefined) {
      found = { metars: [], tafs: [] }
      groups.set(icao, found)
    }
    return found
  }
  for (const row of records.metars) group(row.stationIcao).metars.push(row)
  for (const row of records.tafs) group(row.stationIcao).tafs.push(row)
  return groups
}

const NO_RECORDS: StationRecords = { metars: [], tafs: [] }

/** Süresi dolmamış TAF'lar, en yeni yayımlanan önce. */
const liveTafs = (records: StationRecords, at: Date) =>
  records.tafs.filter((t) => t.validTo.getTime() > at.getTime()).sort(newestTafFirst)

/**
 * Tam biçimde bir havalimanı: en yeni çözülebilen METAR/SPECI ve yürürlükteki TAF'lar (D-088):
 * kalan geçerliliğinin tamamı daha yeni TAF'larca kapsanan TAF özete bir şey katmaz, METAR/TAF
 * kaydında kalır. Toplu yanıtın büyük kısmı bu eski TAF'lardı (1. halkada istasyon başına ortalama
 * 3,4 TAF).
 */
export function fullStationWeather(
  icao: string,
  records: StationRecords | undefined,
  at: Date,
  generatedAt: string,
  views: WeatherViews,
): AirportWeather {
  const own = records ?? NO_RECORDS
  let metar: AirportMetar | null = null
  for (const row of [...own.metars].sort(newestMetarFirst)) {
    metar = views.metarView(row)
    if (metar !== null) break
  }
  const tafs = inForceTafs(
    liveTafs(own, at)
      .map((row) => views.tafView(row))
      .filter((t): t is AirportTaf => t !== null),
    at,
  )
  return { icao, generatedAt, metar, tafs }
}

/**
 * Ham biçimde bir havalimanı (`format=raw`, D-101): hiçbir rapor çözümlenmez. En yeni METAR/SPECI
 * (zamanı geçersiz satır atlanır) ve süresi dolmamış bütün TAF'lar, en yeni yayımlanan önce;
 * yürürlükteki TAF seçimini okuyan çözümlemeden sonra yapar (`toAirportWeather`). Veritabanı
 * istasyon başına tek METAR verir; o çözülebildiği sürece sonuç tam biçimle aynıdır.
 */
export function rawStationWeather(
  icao: string,
  records: StationRecords | undefined,
  at: Date,
): RawAirportWeather {
  const own = records ?? NO_RECORDS
  let metar: RawMetar | null = null
  for (const row of [...own.metars].sort(newestMetarFirst)) {
    metar = toRawMetar(metarInput(row))
    if (metar !== null) break
  }
  const tafs = liveTafs(own, at)
    .map((row) => toRawTaf(tafInput(row)))
    .filter((t): t is RawTaf => t !== null)
  return { icao, metar, tafs }
}

/**
 * Toplu yanıtın metni (`format` tam ya da ham; D-101). Kayıtlar istasyona göre bir kez gruplanır;
 * ham biçimde hiçbir rapor çözümlenmez. Gövde paylaşılan zod sözleşmesiyle doğrulanır (şemada
 * olmayan alan gönderilmez).
 */
export function weatherBulkBody(
  format: WeatherBulkFormat,
  icaos: readonly string[],
  records: WeatherRecords,
  at: Date,
  views: WeatherViews,
): string {
  const generatedAt = at.toISOString()
  const attribution = { text: ATTRIBUTION.text, url: ATTRIBUTION.url }
  const groups = groupByStation(records)
  if (format === 'raw') {
    const response: WeatherBulkRawResponse = {
      generatedAt,
      attribution,
      stations: icaos.map((icao) => rawStationWeather(icao, groups.get(icao), at)),
    }
    return JSON.stringify(WeatherBulkRawResponseSchema.parse(response))
  }
  const response: WeatherBulkResponse = {
    generatedAt,
    attribution,
    stations: icaos.map((icao) =>
      fullStationWeather(icao, groups.get(icao), at, generatedAt, views),
    ),
  }
  return JSON.stringify(WeatherBulkResponseSchema.parse(response))
}

/** Önbellekte tutulan, bir kez metne çevrilmiş yanıt. */
interface CachedBody {
  body: string
}

/**
 * Önbellekteki geçmiş penceresi: kayıtlar en yeni önce, her biri bir kez metne çevrilmiş. İstenen
 * saat penceresi bunlardan zamanına göre süzülerek yanıt metnine eklenir (yeniden doğrulama yok).
 */
interface CachedHistory {
  icao: string
  /** Pencerenin okunduğu an (yanıtın `to` ve `generatedAt` değeri), epoch ms. */
  to: number
  entries: readonly { time: number; json: string }[]
  /** Kayıt metinlerinin toplam uzunluğu (bayt bütçesi). */
  bytes: number
}

/**
 * Hava durumu uçları (aviationweather.gov METAR/TAF; worker yazar, API okurken çözümler):
 * - `GET /v1/weather?country=TR` ya da `?scope=listed` (D-080): listedeki her havalimanı için güncel
 *   hava. `format=raw` (D-101) raporları çözümlemeden verir; web sunucusu bunu ister ve yalnız
 *   çizdiği havalimanını çözümler (`toAirportWeather`). `scope=listed` yalnız ham biçimledir
 *   (D-111; tam biçim 400).
 * - `GET /v1/airports/:code/weather`: tek havalimanı (tarayıcı yenilemesi, API ve mobil).
 * - `GET /v1/airports/:code/weather/history?hours=24`: METAR/SPECI/TAF kaydı, en yeni önce.
 * Yanıtlar 60 sn süreç içinde tutulur; veritabanı okunamazsa eldeki kopya, o da yoksa 503.
 */
export function registerWeatherRoutes(
  app: FastifyInstance,
  {
    stations,
    listedStations = null,
    resolve = null,
    latest,
    history = null,
    now = Date.now,
    cacheMaxEntries: maxEntries = AIRPORTS_CACHE_MAX_ENTRIES,
    historyCacheMaxBytes = WEATHER_HISTORY_CACHE_MAX_BYTES,
  }: WeatherRouteOptions,
): void {
  const views = weatherViews(app.log)
  const { metarView, tafView } = views

  /** Toplu yanıtın istasyon okuyucusu: ülke kodu ya da `LISTED_KEY`; okuyucu yoksa null. */
  const bulkStations = (key: string) =>
    key === LISTED_KEY ? listedStations : stations === null ? null : () => stations(key)

  /** Toplu yanıtın okuyucusu; biçim başına ayrı önbellek (anahtar: ülke kodu ya da `LISTED_KEY`). */
  const bulkReader = (format: WeatherBulkFormat) =>
    cachedReader<CachedBody>({
      read:
        latest === null
          ? null
          : async (key) => {
              const read = bulkStations(key)
              if (read === null) throw new Error(`no station reader for ${key}`)
              // ICAO'su olmayan (GPS kodu ya da OurAirports kimliğiyle listelenen) havalimanı atlanır.
              const icaos = (await read()).map((s) => s.icao).filter(isIcao)
              const at = new Date(now())
              const records =
                icaos.length === 0 ? { metars: [], tafs: [] } : await latest(icaos, at)
              return { body: weatherBulkBody(format, icaos, records, at, views) }
            },
      ttl: () => WEATHER_CACHE_MS,
      now,
      log: app.log,
      what: format === 'raw' ? 'weather (raw)' : 'weather',
      maxEntries,
    })
  const loadBulk: Record<WeatherBulkFormat, ReturnType<typeof bulkReader>> = {
    full: bulkReader('full'),
    raw: bulkReader('raw'),
  }

  const loadOne = cachedReader<CachedBody>({
    read:
      latest === null
        ? null
        : async (icao) => {
            const at = new Date(now())
            const records = await latest([icao], at)
            const response = fullStationWeather(
              icao,
              groupByStation(records).get(icao),
              at,
              at.toISOString(),
              views,
            )
            return { body: JSON.stringify(AirportWeatherSchema.parse(response)) }
          },
    ttl: () => WEATHER_CACHE_MS,
    now,
    log: app.log,
    what: 'airport weather',
    maxEntries,
  })

  /** Anahtar: `ICAO:pencere` (`historyCacheWindow`); en çok istasyon × 2 anahtar. */
  const loadHistory = cachedReader<CachedHistory>({
    read:
      history === null
        ? null
        : async (key) => {
            const [icao = '', windowText = ''] = key.split(':')
            const hours = Number(windowText)
            const to = new Date(now())
            const from = new Date(to.getTime() - hours * 3_600_000)
            const records = await history(icao, from, to)
            const response: WeatherHistoryResponse = WeatherHistoryResponseSchema.parse({
              icao,
              from: from.toISOString(),
              to: to.toISOString(),
              generatedAt: to.toISOString(),
              entries: historyEntries(icao, records, from, to),
            })
            const entries = response.entries.map((entry) => ({
              time: Date.parse(entry.time),
              json: JSON.stringify(entry),
            }))
            const bytes = entries.reduce((sum, entry) => sum + entry.json.length, 0)
            return { icao, to: to.getTime(), entries, bytes }
          },
    ttl: () => WEATHER_CACHE_MS,
    now,
    log: app.log,
    what: 'weather history',
    maxEntries: Math.min(maxEntries, WEATHER_HISTORY_CACHE_MAX_ENTRIES),
    maxBytes: historyCacheMaxBytes,
    sizeOf: (value) => value.bytes,
  })

  /** Önbellekteki pencereden son `hours` saatin yanıt metni (şema alan sırasıyla). */
  const historyBody = (cached: CachedHistory, hours: number): CachedBody => {
    const to = new Date(cached.to)
    const from = new Date(cached.to - hours * 3_600_000)
    const parts = cached.entries
      .filter((entry) => entry.time >= from.getTime() && entry.time <= to.getTime())
      .map((entry) => entry.json)
    const head = JSON.stringify({
      icao: cached.icao,
      from: from.toISOString(),
      to: to.toISOString(),
      generatedAt: to.toISOString(),
    })
    return { body: `${head.slice(0, -1)},"entries":[${parts.join(',')}]}` }
  }

  type HistoryEntry = WeatherHistoryResponse['entries'][number]

  const historyEntries = (
    icao: string,
    records: WeatherRecords,
    from: Date,
    to: Date,
  ): HistoryEntry[] => {
    const inWindow = (time: Date) =>
      time.getTime() >= from.getTime() && time.getTime() <= to.getTime()
    const entries: { time: number; entry: HistoryEntry }[] = []
    for (const row of records.metars) {
      if (row.stationIcao !== icao || !inWindow(row.observedAt)) continue
      const metar = metarView(row)
      entries.push({
        time: row.observedAt.getTime(),
        entry: {
          kind: row.reportType,
          time: row.observedAt.toISOString(),
          raw: row.rawText,
          ...(metar === null ? {} : { metar }),
        },
      })
    }
    for (const row of records.tafs) {
      if (row.stationIcao !== icao || !inWindow(row.issuedAt)) continue
      const taf = tafView(row)
      entries.push({
        time: row.issuedAt.getTime(),
        entry: {
          kind: 'TAF',
          time: row.issuedAt.toISOString(),
          raw: row.rawText,
          ...(taf === null
            ? {}
            : {
                taf: {
                  validFrom: taf.validFrom,
                  validTo: taf.validTo,
                  amended: taf.amended,
                  corrected: taf.corrected,
                  cancelled: taf.cancelled,
                },
              }),
        },
      })
    }
    // En yeni önce; aynı anda gözlem rapordan önce gelir (TAF sonra), sonra ham metin.
    const rank = (kind: HistoryEntry['kind']) => (kind === 'TAF' ? 1 : 0)
    return entries
      .sort(
        (a, b) =>
          b.time - a.time ||
          rank(a.entry.kind) - rank(b.entry.kind) ||
          (a.entry.raw < b.entry.raw ? -1 : a.entry.raw > b.entry.raw ? 1 : 0),
      )
      .map((e) => e.entry)
  }

  const loadCode = cachedReader<string | null>({
    read: resolve,
    ttl: (icao) => (icao === null ? AIRPORTS_EMPTY_CACHE_MS : AIRPORTS_CACHE_MS),
    now,
    log: app.log,
    what: 'airport code',
    maxEntries,
  })

  const fail = (reply: FastifyReply, status: 400 | 404 | 503, body: object) => {
    reply.header('cache-control', 'no-store')
    return reply.code(status).send(body)
  }
  const sendBody = (reply: FastifyReply, cached: CachedBody) =>
    reply
      .header('cache-control', WEATHER_CACHE_CONTROL)
      // Gövde hazır JSON metnidir; Fastify metni olduğu gibi gönderir.
      .type('application/json; charset=utf-8')
      .send(cached.body)

  /** Biçimi geçerli kodun kanonik ICAO'su; bulunamazsa 404, okunamazsa 503 yanıtı. */
  const resolveCode = async (
    code: string,
  ): Promise<{ icao: string } | { status: 404 | 503; body: object }> => {
    const resolved = await loadCode(code.toUpperCase())
    if (resolved === null) return { status: 503, body: AIRPORT_ERRORS.unavailable }
    if (resolved.value === null || !isIcao(resolved.value)) {
      return { status: 404, body: AIRPORT_ERRORS.notFound }
    }
    return { icao: resolved.value }
  }

  const validCode = (code: unknown): code is string =>
    typeof code === 'string' && AIRPORT_CODE.test(code)

  const codeParams = {
    type: 'object',
    required: ['code'],
    properties: {
      code: {
        type: 'string',
        pattern: AIRPORT_CODE.source,
        description:
          'ICAO (4 karakter), IATA (3 harf) ya da adres takma adı (kodu değişen havalimanının eski kodu, ör. UTSS → UZSS); büyük/küçük harf fark etmez. Yanıttaki icao kanonik koddur',
      },
    },
  } as const

  app.get(
    '/v1/weather',
    {
      config: { rateLimit: WEATHER_RATE_LIMIT },
      attachValidation: true,
      schema: {
        tags: ['weather'],
        summary: 'Ülkenin ya da listelenen havalimanlarının güncel havası (METAR/TAF)',
        description:
          "Listedeki her havalimanı için bir kayıt, liste sırasıyla; raporu olmayan havalimanında metar null. Varsayılan biçim (full) çözümlenmiştir ve tafs yalnız yürürlükteki TAF'lardır: kalan geçerliliği daha yeni TAF'larca kapsanan eski TAF'lar METAR/TAF kaydındadır. format=raw hiçbir raporu çözümlemez: en yeni METAR/SPECI ve süresi dolmamış bütün TAF'lar ham metin ve zamanlarıyla gelir (yürürlük seçimi okuyandadır). scope=listed yalnız format=raw ile istenir (yoksa 400 format_required); country isteği iki biçimi de verir. Kaynak: aviationweather.gov (NOAA Aviation Weather Center); resmî brifing yerine geçmez.",
        querystring: {
          type: 'object',
          properties: {
            ...selectionQueryProperties,
            format: {
              type: 'string',
              enum: [...WEATHER_BULK_FORMATS],
              description:
                'full (varsayılan): çözümlenmiş raporlar (yalnız country isteğinde). raw: yalnız ham metin ve kayıt zamanları (istasyon başına ~0,9 KB); scope=listed için zorunlu',
            },
          },
        },
        response: {
          200: {
            anyOf: [
              openApiSchema(WeatherBulkResponseSchema),
              openApiSchema(WeatherBulkRawResponseSchema),
            ],
          },
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { country, scope, format } = (request.query ?? {}) as {
        country?: unknown
        scope?: unknown
        format?: unknown
      }
      const selection = airportSelection(country, scope)
      if ('error' in selection) return fail(reply, 400, selection.error)
      const bulkFormat = weatherBulkFormat(format)
      if (bulkFormat === null) return fail(reply, 400, WEATHER_ERRORS.badFormat)
      if (request.validationError !== undefined) {
        return fail(
          reply,
          400,
          'scope' in selection ? AIRPORT_ERRORS.badScope : AIRPORT_ERRORS.badCountry,
        )
      }
      if ('scope' in selection && bulkFormat !== 'raw') {
        return fail(reply, 400, WEATHER_ERRORS.rawRequired)
      }
      const key = 'scope' in selection ? LISTED_KEY : selection.country
      if (bulkStations(key) === null) return fail(reply, 503, WEATHER_ERRORS.unavailable)
      const loaded = await loadBulk[bulkFormat](key)
      if (loaded === null) return fail(reply, 503, WEATHER_ERRORS.unavailable)
      return sendBody(reply, loaded.value)
    },
  )

  app.get(
    '/v1/airports/:code/weather',
    {
      config: { rateLimit: WEATHER_RATE_LIMIT },
      attachValidation: true,
      schema: {
        tags: ['weather'],
        summary: 'Tek havalimanında güncel hava (METAR/TAF, çözümlenmiş)',
        description:
          "Bilinen havalimanında rapor yoksa 200 ve metar null; yürürlükte TAF yoksa tafs boş (eski TAF'lar METAR/TAF kaydındadır). Kaynak: aviationweather.gov.",
        params: codeParams,
        response: {
          200: openApiSchema(AirportWeatherSchema),
          400: errorSchema,
          404: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { code } = (request.params ?? {}) as { code?: unknown }
      if (request.validationError !== undefined || !validCode(code)) {
        return fail(reply, 400, AIRPORT_ERRORS.badCode)
      }
      const resolved = await resolveCode(code)
      if (!('icao' in resolved)) return fail(reply, resolved.status, resolved.body)
      const loaded = await loadOne(resolved.icao)
      if (loaded === null) return fail(reply, 503, WEATHER_ERRORS.unavailable)
      return sendBody(reply, loaded.value)
    },
  )

  app.get(
    '/v1/airports/:code/weather/history',
    {
      config: { rateLimit: WEATHER_RATE_LIMIT },
      attachValidation: true,
      schema: {
        tags: ['weather'],
        summary: 'Havalimanının METAR/SPECI/TAF kaydı (en yeni önce)',
        description:
          'Son `hours` saatte gözlenen METAR/SPECI ve yayımlanan TAF raporları; kayıt 30 gün saklanır, istek başına en fazla 7 gün.',
        params: codeParams,
        querystring: {
          type: 'object',
          properties: {
            hours: {
              type: 'integer',
              minimum: 1,
              maximum: WEATHER_HISTORY_MAX_HOURS,
              default: WEATHER_HISTORY_DEFAULT_HOURS,
              description: `Geriye doğru pencere, saat (1–${WEATHER_HISTORY_MAX_HOURS}; varsayılan ${WEATHER_HISTORY_DEFAULT_HOURS})`,
            },
          },
        },
        response: {
          200: openApiSchema(WeatherHistoryResponseSchema),
          400: errorSchema,
          404: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { code } = (request.params ?? {}) as { code?: unknown }
      const { hours: raw = WEATHER_HISTORY_DEFAULT_HOURS } = (request.query ?? {}) as {
        hours?: unknown
      }
      const error = request.validationError
      if (error?.validationContext === 'params' || !validCode(code)) {
        return fail(reply, 400, AIRPORT_ERRORS.badCode)
      }
      // Fastify sorgu değerini şemaya göre sayıya çevirir; yine de metin de kabul edilir.
      const hours =
        typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN
      if (
        error !== undefined ||
        !Number.isInteger(hours) ||
        hours < 1 ||
        hours > WEATHER_HISTORY_MAX_HOURS
      ) {
        return fail(reply, 400, WEATHER_ERRORS.badHours)
      }
      const resolved = await resolveCode(code)
      if (!('icao' in resolved)) return fail(reply, resolved.status, resolved.body)
      const icao = resolved.icao
      const loaded = await loadHistory(`${icao}:${historyCacheWindow(hours)}`)
      if (loaded === null) return fail(reply, 503, WEATHER_ERRORS.unavailable)
      return sendBody(reply, historyBody(loaded.value, hours))
    },
  )
}
