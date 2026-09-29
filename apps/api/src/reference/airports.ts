import type { Airport, AirportsResponse } from '@havayolu/shared'
import type { FastifyInstance } from 'fastify'

export interface AirportRouteOptions {
  /** Ülkenin IATA kodlu havalimanları (`listAirportsWithIata`); `null`: veritabanı yok → 503. */
  list: ((country: string) => Promise<Airport[]>) | null
  /** Saat, epoch ms (testte sahte saat). */
  now?: () => number
}

/** IP başına hız sınırı (`/v1/search` ile aynı düzen). */
export const AIRPORTS_RATE_LIMIT = { max: 60, timeWindow: '1 minute' } as const
export const AIRPORTS_DEFAULT_COUNTRY = 'TR'
/** Ülke başına sunucu içi önbellek süresi; referans verisi günde bir değişir. */
export const AIRPORTS_CACHE_MS = 10 * 60_000
/**
 * Boş liste bu kadar tutulur: ilk kurulumda OurAirports içe aktarımı worker'da API'den sonra
 * biter; harita havalimanlarını 10 dk beklemez.
 */
export const AIRPORTS_EMPTY_CACHE_MS = 60_000
/** Okuma başarısız olup eldeki kopya sunulunca veritabanı bu aralıktan önce yeniden denenmez. */
export const AIRPORTS_RETRY_MS = 60_000
/** Tarayıcı önbelleği: 5 dk. */
export const AIRPORTS_CACHE_CONTROL = 'public, max-age=300'

/** ISO 3166-1 alpha-2, büyük harf. */
const COUNTRY = /^[A-Z]{2}$/

export const AIRPORT_ERRORS = {
  badCountry: {
    error: 'bad_country',
    message: 'country iki büyük harfli ISO 3166-1 ülke kodu olmalı (ör. TR).',
  },
  unavailable: {
    error: 'airports_unavailable',
    message: 'Havalimanı listesi şu an kullanılamıyor.',
  },
} as const

const nullable = (type: string) => ({ type: [type, 'null'] })

/** `Airport` (`@havayolu/shared`); yanıt bu şemayla serileştirilir, fazla alan gönderilmez. */
const airportSchema = {
  type: 'object',
  required: ['icao', 'iata', 'name', 'city', 'lat', 'lon', 'elevationFt', 'type', 'scheduled'],
  properties: {
    icao: { type: 'string', description: 'ICAO kodu; yoksa GPS kodu ya da OurAirports kimliği' },
    iata: { type: 'string', description: 'IATA kodu (3 harf)' },
    name: { type: 'string' },
    city: { ...nullable('string'), description: 'Şehir (OurAirports municipality)' },
    lat: { type: 'number' },
    lon: { type: 'number' },
    elevationFt: { ...nullable('integer'), description: 'Yükseklik, ft' },
    type: { type: 'string', enum: ['large_airport', 'medium_airport', 'small_airport'] },
    scheduled: { type: 'boolean', description: 'Tarifeli sefer var mı' },
  },
} as const

const errorSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: { error: { type: 'string' }, message: { type: 'string' } },
} as const

interface CacheEntry {
  body: AirportsResponse
  /** Bu ana kadar veritabanına gidilmez. */
  freshUntil: number
}

/**
 * `GET /v1/airports?country=TR`: haritadaki havalimanı noktaları ve IATA kodları (OurAirports,
 * kamu malı). Ülke başına 10 dk süreç içi önbellek; aynı ülkenin eşzamanlı istekleri tek okumayı
 * bekler. Okuma başarısız olursa eldeki (süresi geçmiş) kopya sunulur; kopya yoksa 503.
 */
export function registerAirportRoutes(
  app: FastifyInstance,
  { list, now = Date.now }: AirportRouteOptions,
): void {
  const cache = new Map<string, CacheEntry>()
  const pending = new Map<string, Promise<AirportsResponse | null>>()

  const refresh = async (
    read: (country: string) => Promise<Airport[]>,
    country: string,
    stale: CacheEntry | undefined,
  ): Promise<AirportsResponse | null> => {
    try {
      const airports = await read(country)
      const body: AirportsResponse = { country, airports }
      const ttl = airports.length === 0 ? AIRPORTS_EMPTY_CACHE_MS : AIRPORTS_CACHE_MS
      cache.set(country, { body, freshUntil: now() + ttl })
      return body
    } catch (error) {
      app.log.warn({ err: error, country }, 'airports could not be read')
      if (stale === undefined) return null
      stale.freshUntil = now() + AIRPORTS_RETRY_MS
      return stale.body
    }
  }

  /** Önbellekteki taze kopya, yoksa tek bir okuma; `null` → 503. */
  const load = (country: string): Promise<AirportsResponse | null> => {
    const entry = cache.get(country)
    if (entry !== undefined && entry.freshUntil > now()) return Promise.resolve(entry.body)
    if (list === null) return Promise.resolve(null)
    let inflight = pending.get(country)
    if (inflight === undefined) {
      inflight = refresh(list, country, entry).finally(() => pending.delete(country))
      pending.set(country, inflight)
    }
    return inflight
  }

  app.get(
    '/v1/airports',
    {
      config: { rateLimit: AIRPORTS_RATE_LIMIT },
      attachValidation: true,
      schema: {
        tags: ['reference'],
        summary: 'Ülkenin IATA kodlu havalimanları (harita noktaları)',
        querystring: {
          type: 'object',
          properties: {
            country: {
              type: 'string',
              pattern: COUNTRY.source,
              default: AIRPORTS_DEFAULT_COUNTRY,
              description: 'ISO 3166-1 alpha-2 ülke kodu, büyük harf (varsayılan TR)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['country', 'airports'],
            properties: {
              country: { type: 'string' },
              airports: { type: 'array', items: airportSchema },
            },
          },
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { country: raw = AIRPORTS_DEFAULT_COUNTRY } = (request.query ?? {}) as {
        country?: unknown
      }
      if (request.validationError !== undefined || typeof raw !== 'string' || !COUNTRY.test(raw)) {
        reply.header('cache-control', 'no-store')
        return reply.code(400).send(AIRPORT_ERRORS.badCountry)
      }
      const body = await load(raw)
      if (body === null) {
        reply.header('cache-control', 'no-store')
        return reply.code(503).send(AIRPORT_ERRORS.unavailable)
      }
      reply.header('cache-control', AIRPORTS_CACHE_CONTROL)
      return body
    },
  )
}
