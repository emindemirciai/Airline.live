import {
  AIRPORT_LIST_SCOPES,
  airportRingLimitKm,
  ENABLED_AIRPORT_RING,
  type Airport,
  type AirportDetail,
  type AirportDetailsResponse,
  type AirportListScope,
  type AirportsResponse,
  type ListedAirportDetailsResponse,
  type ListedAirportsResponse,
} from '@havayolu/shared'
import type { FastifyInstance } from 'fastify'
import { CACHE_RETRY_MS, cachedReader } from './cache'

export interface AirportRouteOptions {
  /** Ülkenin IATA kodlu havalimanları (`listAirportsWithIata`); `null`: veritabanı yok → 503. */
  list: ((country: string) => Promise<Airport[]>) | null
  /**
   * Aynı liste pistler, istasyon ve veri tarihiyle (`listAirportDetails`; `include=runways`).
   * Verilmezse ya da `null` ise (veritabanı yok) 503.
   */
  details?: ((country: string) => Promise<AirportDetail[]>) | null
  /**
   * Listelenen havalimanları (`listListedAirports`; `scope=listed`, D-080): Türkiye ve açık
   * halkalardaki yurt dışı adayları. Verilmezse ya da `null` ise 503.
   */
  listed?: (() => Promise<Airport[]>) | null
  /** Aynı liste pistlerle (`listListedAirportDetails`; `scope=listed&include=runways`). */
  listedDetails?: (() => Promise<AirportDetail[]>) | null
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
export const AIRPORTS_RETRY_MS = CACHE_RETRY_MS
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
export const COUNTRY = /^[A-Z]{2}$/
/** ICAO (4) ya da IATA (3) kodu; büyük/küçük harf fark etmez. */
export const AIRPORT_CODE = /^[A-Za-z0-9]{3,4}$/

export const AIRPORT_ERRORS = {
  badCountry: {
    error: 'bad_country',
    message: 'country iki büyük harfli ISO 3166-1 ülke kodu olmalı (ör. TR).',
  },
  badScope: {
    error: 'bad_scope',
    message: 'scope yalnızca listed olabilir.',
  },
  scopeConflict: {
    error: 'scope_conflict',
    message: 'country ve scope birlikte verilemez; birini seçin.',
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

/** Liste seçimi: ülke (varsayılan TR) ya da kapsam (`scope=listed`). */
export type AirportSelection = { country: string } | { scope: AirportListScope }

/**
 * `country` ve `scope` sorgu değerlerinden seçim (`/v1/airports` ve `/v1/weather` ortak kuralı):
 * ikisi birlikte verilemez; hiçbiri yoksa ülke TR. Biçim hatasında hata gövdesi döner.
 */
export function airportSelection(
  country: unknown,
  scope: unknown,
): AirportSelection | { error: (typeof AIRPORT_ERRORS)[keyof typeof AIRPORT_ERRORS] } {
  if (country !== undefined && scope !== undefined) return { error: AIRPORT_ERRORS.scopeConflict }
  if (scope !== undefined) {
    return typeof scope === 'string' && (AIRPORT_LIST_SCOPES as readonly string[]).includes(scope)
      ? { scope: scope as AirportListScope }
      : { error: AIRPORT_ERRORS.badScope }
  }
  const code = country ?? AIRPORTS_DEFAULT_COUNTRY
  return typeof code === 'string' && COUNTRY.test(code)
    ? { country: code }
    : { error: AIRPORT_ERRORS.badCountry }
}

/** Açık halkanın sınırı, açıklama metni için (": Türkiye'ye ≤ 2000 km"); son halkada boş. */
function enabledRingLimit(): string {
  const limit = airportRingLimitKm(ENABLED_AIRPORT_RING)
  return limit === null ? '' : `: Türkiye'ye ≤ ${limit} km`
}

/** Sorgu şemasının ortak alanları; varsayılan şemada değil kodda uygulanır (çakışma denetimi). */
export const selectionQueryProperties = {
  country: {
    type: 'string',
    pattern: COUNTRY.source,
    description:
      'ISO 3166-1 alpha-2 ülke kodu, büyük harf. scope ile birlikte verilemez; ikisi de yoksa TR',
  },
  scope: {
    type: 'string',
    enum: [...AIRPORT_LIST_SCOPES],
    description: `listed: listelenen havalimanları (Türkiye'nin IATA kodlu havalimanları ve açık halkalardaki yurt dışı havalimanları; açık halka ${ENABLED_AIRPORT_RING}${enabledRingLimit()}). country ile birlikte verilemez`,
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
  country: {
    type: 'string',
    description: 'ISO 3166-1 alpha-2 ülke kodu (OurAirports iso_country)',
  },
  ring: {
    type: 'integer',
    minimum: 0,
    description:
      "Halka: Türkiye'de 0; yurt dışında Türkiye'deki en yakın IATA kodlu havalimanına uzaklığa göre 1 (≤ 500 km), 2 (≤ 1.000), 3 (≤ 2.000), 4 (≤ 5.000), 5 (ötesi)",
  },
  distanceToTrKm: {
    ...nullable('integer'),
    minimum: 0,
    description:
      "Türkiye'deki en yakın IATA kodlu havalimanına büyük daire uzaklığı, km; Türkiye'de null",
  },
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
  nearestTr: {
    type: ['object', 'null'],
    description:
      "Türkiye'deki en yakın IATA kodlu havalimanı (distanceToTrKm ona ölçülür; listelenmeyen küçük alan olabilir); Türkiye'de null",
    required: ['icao', 'iata', 'name'],
    properties: {
      icao: { type: 'string', description: 'ICAO kodu' },
      iata: { type: 'string', description: 'IATA kodu' },
      name: { type: 'string', description: 'OurAirports adı' },
    },
  },
  isoRegion: { type: 'string', description: 'ISO 3166-2 bölge kodu (TR-34, GR-I)' },
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

const countryListResponse = <T>(items: T) =>
  ({
    type: 'object',
    required: ['country', 'airports'],
    properties: { country: { type: 'string' }, airports: { type: 'array', items } },
  }) as const

const scopeListResponse = <T>(items: T) =>
  ({
    type: 'object',
    required: ['scope', 'airports'],
    properties: {
      scope: { type: 'string', enum: [...AIRPORT_LIST_SCOPES] },
      airports: { type: 'array', items },
    },
  }) as const

/** OpenAPI belgesi: ülke isteğinde `country`, `scope=listed` isteğinde `scope` alanı gelir. */
const documentedListResponse = {
  type: 'object',
  description:
    'country isteğinde zarf { country, airports }, scope=listed isteğinde { scope, airports }',
  required: ['airports'],
  properties: {
    country: { type: 'string', description: 'İstenen ülke (yalnızca country isteğinde)' },
    scope: {
      type: 'string',
      enum: [...AIRPORT_LIST_SCOPES],
      description: 'İstenen kapsam (yalnızca scope isteğinde)',
    },
    airports: { type: 'array', items: airportListItemSchema },
  },
} as const

/**
 * Yanıtlar kipine göre kendi şemasıyla serileştirilir: düz listede yalnızca `Airport` alanları,
 * ayrıntılı listede `AirportDetail` alanları gider; fazla alan gönderilmez.
 */
const plainListSchema = countryListResponse(airportSchema)
const detailListSchema = countryListResponse(airportDetailSchema)
const plainScopeSchema = scopeListResponse(airportSchema)
const detailScopeSchema = scopeListResponse(airportDetailSchema)

export const errorSchema = {
  type: 'object',
  required: ['error', 'message'],
  properties: { error: { type: 'string' }, message: { type: 'string' } },
} as const

const listTtl = (airports: readonly unknown[]) =>
  airports.length === 0 ? AIRPORTS_EMPTY_CACHE_MS : AIRPORTS_CACHE_MS

/**
 * Havalimanı uçları (OurAirports, kamu malı):
 * - `GET /v1/airports?country=TR`: ülkenin havalimanı noktaları ve IATA kodları.
 * - `GET /v1/airports?scope=listed`: listelenen havalimanları (D-080): Türkiye'nin IATA kodlu
 *   havalimanları ve açık halkalardaki yurt dışı havalimanları (harita).
 * - `include=runways`: aynı liste pistler, istasyon ve veri tarihiyle (web'in havalimanı sayfaları,
 *   site haritası ve llms.txt `scope=listed&include=runways` çağrısından beslenir).
 * - `GET /v1/airports/:code`: tek havalimanı, ICAO ya da IATA koduyla (API ve mobil istemciler).
 * Ülke, kapsam ya da kod başına 10 dk süreç içi önbellek (boş liste ve bulunamayan kod 1 dk).
 */
export function registerAirportRoutes(
  app: FastifyInstance,
  {
    list,
    details = null,
    listed = null,
    listedDetails = null,
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
  // Kapsam başına tek anahtar (bugün yalnızca `listed`).
  const loadListed = cachedReader<ListedAirportsResponse>({
    read:
      listed === null
        ? null
        : async (scope) => ({ scope: scope as AirportListScope, airports: await listed() }),
    ttl: (body) => listTtl(body.airports),
    now,
    log: app.log,
    what: 'listed airports',
    maxEntries: AIRPORT_LIST_SCOPES.length,
  })
  const loadListedDetails = cachedReader<ListedAirportDetailsResponse>({
    read:
      listedDetails === null
        ? null
        : async (scope) => ({ scope: scope as AirportListScope, airports: await listedDetails() }),
    ttl: (body) => listTtl(body.airports),
    now,
    log: app.log,
    what: 'listed airport details',
    maxEntries: AIRPORT_LIST_SCOPES.length,
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
        summary:
          'Havalimanı listesi: ülkenin IATA kodlu havalimanları ya da listelenen havalimanları (istenirse pistlerle)',
        querystring: {
          type: 'object',
          properties: {
            ...selectionQueryProperties,
            include: {
              type: 'string',
              enum: [...AIRPORTS_INCLUDE],
              description:
                'runways: bölge, istasyon, veri tarihi ve açık pistler de gelir (havalimanı sayfaları)',
            },
          },
        },
        response: {
          200: documentedListResponse,
          400: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const { country, scope, include } = (request.query ?? {}) as {
        country?: unknown
        scope?: unknown
        include?: unknown
      }
      const selection = airportSelection(country, scope)
      if ('error' in selection) {
        reply.header('cache-control', 'no-store')
        return reply.code(400).send(selection.error)
      }
      if (include !== undefined && include !== 'runways') {
        reply.header('cache-control', 'no-store')
        return reply.code(400).send(AIRPORT_ERRORS.badInclude)
      }
      if (request.validationError !== undefined) {
        reply.header('cache-control', 'no-store')
        return reply
          .code(400)
          .send('scope' in selection ? AIRPORT_ERRORS.badScope : AIRPORT_ERRORS.badCountry)
      }
      const withRunways = include === 'runways'
      let loaded: { value: unknown } | null
      let schema: Record<string, unknown>
      if ('scope' in selection) {
        loaded = withRunways
          ? await loadListedDetails(selection.scope)
          : await loadListed(selection.scope)
        schema = withRunways ? detailScopeSchema : plainScopeSchema
      } else {
        loaded = withRunways
          ? await loadDetails(selection.country)
          : await loadList(selection.country)
        schema = withRunways ? detailListSchema : plainListSchema
      }
      if (loaded === null) {
        reply.header('cache-control', 'no-store')
        return reply.code(503).send(AIRPORT_ERRORS.unavailable)
      }
      reply.header('cache-control', AIRPORTS_CACHE_CONTROL)
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
        description:
          "Her ülkenin IATA kodlu havalimanı bulunur (halka süzgeci uygulanmaz); kayıt ülkesini, halkasını ve Türkiye'ye uzaklığını taşır.",
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
