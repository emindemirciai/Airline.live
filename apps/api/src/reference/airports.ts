import type {
  Airport,
  AirportDetail,
  AirportDetailsResponse,
  AirportsResponse,
} from '@havayolu/shared'
import type { FastifyBaseLogger, FastifyInstance } from 'fastify'

export interface AirportRouteOptions {
  /** Ülkenin IATA kodlu havalimanları (`listAirportsWithIata`); `null`: veritabanı yok → 503. */
  list: ((country: string) => Promise<Airport[]>) | null
  /**
   * Aynı liste pistler, istasyon ve veri tarihiyle (`listAirportDetails`; `include=runways`).
   * Verilmezse ya da `null` ise (veritabanı yok) 503.
   */
  details?: ((country: string) => Promise<AirportDetail[]>) | null
  /**
   * Tek havalimanı, büyük harfli ICAO ya da IATA koduyla (`findAirportDetail`); yoksa null.
   * Verilmezse ya da `null` ise (veritabanı yok) 503.
   */
  find?: ((code: string) => Promise<AirportDetail | null>) | null
  /** Saat, epoch ms (testte sahte saat). */
  now?: () => number
  /** Önbellek başına anahtar sınırı (varsayılan `AIRPORTS_CACHE_MAX_ENTRIES`; testte küçük). */
  cacheMaxEntries?: number
}

/** IP başına hız sınırı (`/v1/search` ile aynı düzen). */
export const AIRPORTS_RATE_LIMIT = { max: 60, timeWindow: '1 minute' } as const
export const AIRPORTS_DEFAULT_COUNTRY = 'TR'
/** Ülke (ve kod) başına sunucu içi önbellek süresi; referans verisi günde bir değişir. */
export const AIRPORTS_CACHE_MS = 10 * 60_000
/**
 * Boş liste ve bulunamayan kod bu kadar tutulur: ilk kurulumda OurAirports içe aktarımı worker'da
 * API'den sonra biter; harita ve havalimanı sayfaları 10 dk beklemez.
 */
export const AIRPORTS_EMPTY_CACHE_MS = 60_000
/** Okuma başarısız olup eldeki kopya sunulunca veritabanı bu aralıktan önce yeniden denenmez. */
export const AIRPORTS_RETRY_MS = 60_000
/**
 * Önbellekteki anahtar sınırı (ülke ya da kod başına bir kayıt): rastgele kodlarla gelen istekler
 * belleği büyütemez; sınır aşılınca en eski kayıt atılır.
 */
export const AIRPORTS_CACHE_MAX_ENTRIES = 1_024
/** Tarayıcı önbelleği: 5 dk. */
export const AIRPORTS_CACHE_CONTROL = 'public, max-age=300'
/** `include` değerleri: bugün yalnızca pistler (havalimanı sayfaları). */
export const AIRPORTS_INCLUDE = ['runways'] as const

/** ISO 3166-1 alpha-2, büyük harf. */
const COUNTRY = /^[A-Z]{2}$/
/** ICAO (4) ya da IATA (3) kodu; büyük/küçük harf fark etmez. */
const AIRPORT_CODE = /^[A-Za-z0-9]{3,4}$/

export const AIRPORT_ERRORS = {
  badCountry: {
    error: 'bad_country',
    message: 'country iki büyük harfli ISO 3166-1 ülke kodu olmalı (ör. TR).',
  },
  badInclude: {
    error: 'bad_include',
    message: 'include yalnızca runways olabilir.',
  },
  badCode: {
    error: 'bad_code',
    message: 'Kod 4 karakterli ICAO ya da 3 harfli IATA kodu olmalı (ör. LTFM, IST).',
  },
  notFound: {
    error: 'airport_not_found',
    message: 'Bu kodla havalimanı bulunamadı.',
  },
  unavailable: {
    error: 'airports_unavailable',
    message: 'Havalimanı listesi şu an kullanılamıyor.',
  },
} as const

const nullable = (type: string) => ({ type: [type, 'null'] })

const airportProperties = {
  icao: { type: 'string', description: 'ICAO kodu; yoksa GPS kodu ya da OurAirports kimliği' },
  iata: { type: 'string', description: 'IATA kodu (3 harf)' },
  name: { type: 'string', description: 'OurAirports adı' },
  city: { ...nullable('string'), description: 'Şehir (OurAirports municipality)' },
  lat: { type: 'number' },
  lon: { type: 'number' },
  elevationFt: { ...nullable('integer'), description: 'Yükseklik, ft' },
  type: { type: 'string', enum: ['large_airport', 'medium_airport', 'small_airport'] },
  scheduled: { type: 'boolean', description: 'Tarifeli sefer var mı' },
} as const
const airportRequired = Object.keys(airportProperties)

const runwayEndSchema = {
  type: 'object',
  required: ['ident', 'trueBearingDeg', 'displacedThresholdFt', 'thresholdLat', 'thresholdLon'],
  properties: {
    ident: { type: 'string', description: 'Pist adı (16L); kaynakta yoksa boş' },
    trueBearingDeg: {
      ...nullable('number'),
      description: 'Bu uçtan karşı uca gerçek yön, derece (koordinatlardan; düzeltme varsa o)',
    },
    displacedThresholdFt: { ...nullable('integer'), description: 'Kaydırılmış eşik, ft' },
    thresholdLat: { ...nullable('number'), description: 'Pist eşiği enlemi' },
    thresholdLon: { ...nullable('number'), description: 'Pist eşiği boylamı' },
  },
} as const

const runwaySchema = {
  type: 'object',
  required: ['id', 'lengthFt', 'widthFt', 'surface', 'lighted', 'ends'],
  properties: {
    id: { type: 'integer', description: 'OurAirports pist kimliği' },
    lengthFt: { ...nullable('integer'), description: 'Uzunluk, ft' },
    widthFt: { ...nullable('integer'), description: 'Genişlik, ft' },
    surface: { ...nullable('string'), description: 'Kaplama, ham kod (ASP, CON, PEM …)' },
    lighted: { type: 'boolean' },
    ends: {
      type: 'array',
      description: 'Alçak ve yüksek numaralı uç',
      items: runwayEndSchema,
      minItems: 2,
      maxItems: 2,
    },
  },
} as const

const detailProperties = {
  isoRegion: { type: 'string', description: 'ISO 3166-2 bölge kodu (TR-34)' },
  municipality: {
    ...nullable('string'),
    description: 'OurAirports municipality (çoğu zaman ilçe)',
  },
  station: {
    type: ['object', 'null'],
    description: 'İzlenen istasyon ayarları; istasyon değilse null',
    required: ['active', 'primary', 'fetchRadiusNm'],
    properties: {
      active: { type: 'boolean' },
      primary: { type: 'boolean' },
      fetchRadiusNm: { type: 'number', description: 'Veri çekim çemberi, deniz mili' },
    },
  },
  dataUpdatedAt: {
    type: 'string',
    format: 'date-time',
    description: 'Havalimanı, pist ve pist düzeltmelerinin en yeni değişikliği',
  },
  runways: { type: 'array', description: 'Açık pistler, pist adına göre', items: runwaySchema },
} as const

/** `Airport` (`@havayolu/shared`). */
const airportSchema = {
  type: 'object',
  required: airportRequired,
  properties: airportProperties,
} as const

/** OpenAPI belgesi için liste öğesi: ayrıntı alanları isteğe bağlıdır. */
const airportListItemSchema = {
  type: 'object',
  description: 'Ayrıntı alanları (isoRegion … runways) yalnızca include=runways ile gelir',
  required: airportRequired,
  properties: { ...airportProperties, ...detailProperties },
} as const

/** `AirportDetail` (`@havayolu/shared`). */
const airportDetailSchema = {
  type: 'object',
  required: [...airportRequired, ...Object.keys(detailProperties)],
  properties: { ...airportProperties, ...detailProperties },
} as const

const listResponse = <T>(items: T) =>
  ({
    type: 'object',
    required: ['country', 'airports'],
    properties: { country: { type: 'string' }, airports: { type: 'array', items } },
  }) as const

/**
 * Yanıtlar kipine göre kendi şemasıyla serileştirilir: düz listede yalnızca `Airport` alanları,
 * ayrıntılı listede `AirportDetail` alanları gider; fazla alan gönderilmez.
 */
const plainListSchema = listResponse(airportSchema)
const detailListSchema = listResponse(airportDetailSchema)

const errorSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: { error: { type: 'string' }, message: { type: 'string' } },
} as const

interface CacheEntry<V> {
  value: V
  /** Bu ana kadar veritabanına gidilmez. */
  freshUntil: number
}

/**
 * Anahtar başına süreç içi önbellek: taze kopya varsa o, yoksa tek bir okuma (eşzamanlı istekler
 * aynı okumayı bekler). Okuma başarısız olursa eldeki (süresi geçmiş) kopya sunulur ve
 * `AIRPORTS_RETRY_MS` boyunca yeniden denenmez; kopya yoksa `null` (→ 503).
 */
function cachedReader<V>(options: {
  read: ((key: string) => Promise<V>) | null
  ttl: (value: V) => number
  now: () => number
  log: FastifyBaseLogger
  what: string
  maxEntries: number
}): (key: string) => Promise<{ value: V } | null> {
  const { read, ttl, now, log, what, maxEntries } = options
  const cache = new Map<string, CacheEntry<V>>()
  const pending = new Map<string, Promise<{ value: V } | null>>()

  const remember = (key: string, entry: CacheEntry<V>) => {
    cache.delete(key)
    cache.set(key, entry)
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value
      if (oldest === undefined) break
      cache.delete(oldest)
    }
  }

  const refresh = async (
    reader: (key: string) => Promise<V>,
    key: string,
    stale: CacheEntry<V> | undefined,
  ): Promise<{ value: V } | null> => {
    try {
      const value = await reader(key)
      remember(key, { value, freshUntil: now() + ttl(value) })
      return { value }
    } catch (error) {
      log.warn({ err: error, key }, `${what} could not be read`)
      if (stale === undefined) return null
      stale.freshUntil = now() + AIRPORTS_RETRY_MS
      return { value: stale.value }
    }
  }

  return (key) => {
    const entry = cache.get(key)
    if (entry !== undefined && entry.freshUntil > now())
      return Promise.resolve({ value: entry.value })
    if (read === null) return Promise.resolve(null)
    let inflight = pending.get(key)
    if (inflight === undefined) {
      inflight = refresh(read, key, entry).finally(() => pending.delete(key))
      pending.set(key, inflight)
    }
    return inflight
  }
}

const listTtl = (airports: readonly unknown[]) =>
  airports.length === 0 ? AIRPORTS_EMPTY_CACHE_MS : AIRPORTS_CACHE_MS

/**
 * Havalimanı uçları (OurAirports, kamu malı):
 * - `GET /v1/airports?country=TR`: haritadaki havalimanı noktaları ve IATA kodları.
 * - `GET /v1/airports?country=TR&include=runways`: aynı liste pistler, istasyon ve veri tarihiyle
 *   (web'in havalimanı sayfaları, site haritası ve llms.txt bu tek çağrıdan beslenir).
 * - `GET /v1/airports/:code`: tek havalimanı, ICAO ya da IATA koduyla (API ve mobil istemciler).
 * Ülke ya da kod başına 10 dk süreç içi önbellek (boş liste ve bulunamayan kod 1 dk).
 */
export function registerAirportRoutes(
  app: FastifyInstance,
  {
    list,
    details = null,
    find = null,
    now = Date.now,
    cacheMaxEntries: maxEntries = AIRPORTS_CACHE_MAX_ENTRIES,
  }: AirportRouteOptions,
): void {
  const loadList = cachedReader<AirportsResponse>({
    read: list === null ? null : async (country) => ({ country, airports: await list(country) }),
    ttl: (body) => listTtl(body.airports),
    now,
    log: app.log,
    what: 'airports',
    maxEntries,
  })
  const loadDetails = cachedReader<AirportDetailsResponse>({
    read:
      details === null ? null : async (country) => ({ country, airports: await details(country) }),
    ttl: (body) => listTtl(body.airports),
    now,
    log: app.log,
    what: 'airport details',
    maxEntries,
  })
  const loadOne = cachedReader<AirportDetail | null>({
    read: find,
    ttl: (airport) => (airport === null ? AIRPORTS_EMPTY_CACHE_MS : AIRPORTS_CACHE_MS),
    now,
    log: app.log,
    what: 'airport',
    maxEntries,
  })

  app.get(
    '/v1/airports',
    {
      config: { rateLimit: AIRPORTS_RATE_LIMIT },
      attachValidation: true,
      schema: {
        tags: ['reference'],
        summary: 'Ülkenin IATA kodlu havalimanları (harita noktaları; istenirse pistlerle)',
        querystring: {
          type: 'object',
          properties: {
            country: {
              type: 'string',
              pattern: COUNTRY.source,
              default: AIRPORTS_DEFAULT_COUNTRY,
              description: 'ISO 3166-1 alpha-2 ülke kodu, büyük harf (varsayılan TR)',
            },
            include: {
              type: 'string',
              enum: [...AIRPORTS_INCLUDE],
              description:
                'runways: bölge, istasyon, veri tarihi ve açık pistler de gelir (havalimanı sayfaları)',
            },
          },
        },
        response: {
          200: listResponse(airportListItemSchema),
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { country: raw = AIRPORTS_DEFAULT_COUNTRY, include } = (request.query ?? {}) as {
        country?: unknown
        include?: unknown
      }
      if (typeof raw !== 'string' || !COUNTRY.test(raw)) {
        reply.header('cache-control', 'no-store')
        return reply.code(400).send(AIRPORT_ERRORS.badCountry)
      }
      if (include !== undefined && include !== 'runways') {
        reply.header('cache-control', 'no-store')
        return reply.code(400).send(AIRPORT_ERRORS.badInclude)
      }
      if (request.validationError !== undefined) {
        reply.header('cache-control', 'no-store')
        return reply.code(400).send(AIRPORT_ERRORS.badCountry)
      }
      const withRunways = include === 'runways'
      const loaded = withRunways ? await loadDetails(raw) : await loadList(raw)
      if (loaded === null) {
        reply.header('cache-control', 'no-store')
        return reply.code(503).send(AIRPORT_ERRORS.unavailable)
      }
      reply.header('cache-control', AIRPORTS_CACHE_CONTROL)
      const schema = withRunways ? detailListSchema : plainListSchema
      // Özel serileştiricide Fastify içerik türünü kendisi yazmaz.
      return reply
        .type('application/json; charset=utf-8')
        .serializer(reply.compileSerializationSchema(schema, '200'))
        .send(loaded.value)
    },
  )

  app.get(
    '/v1/airports/:code',
    {
      config: { rateLimit: AIRPORTS_RATE_LIMIT },
      attachValidation: true,
      schema: {
        tags: ['reference'],
        summary: 'Tek havalimanı: pistler, istasyon ve veri tarihiyle',
        params: {
          type: 'object',
          required: ['code'],
          properties: {
            code: {
              type: 'string',
              pattern: AIRPORT_CODE.source,
              description:
                'ICAO (4 karakter) ya da IATA (3 harf) kodu; büyük/küçük harf fark etmez. Yanıttaki icao kanonik koddur',
            },
          },
        },
        response: {
          200: airportDetailSchema,
          400: errorSchema,
          404: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { code } = (request.params ?? {}) as { code?: unknown }
      if (
        request.validationError !== undefined ||
        typeof code !== 'string' ||
        !AIRPORT_CODE.test(code)
      ) {
        reply.header('cache-control', 'no-store')
        return reply.code(400).send(AIRPORT_ERRORS.badCode)
      }
      const loaded = await loadOne(code.toUpperCase())
      if (loaded === null) {
        reply.header('cache-control', 'no-store')
        return reply.code(503).send(AIRPORT_ERRORS.unavailable)
      }
      if (loaded.value === null) {
        reply.header('cache-control', 'no-store')
        return reply.code(404).send(AIRPORT_ERRORS.notFound)
      }
      reply.header('cache-control', AIRPORTS_CACHE_CONTROL)
      return loaded.value
    },
  )
}
