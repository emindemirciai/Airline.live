import compress from '@fastify/compress'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit, { normalizeIP } from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import type { AirlineCodes } from '@havayolu/db'
import { currentVersion } from '@havayolu/shared'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'
import { registerArrivalCoverageRoutes, type ArrivalCoverageStore } from './admin/arrival-coverage'
import { redisBlocklistStore, registerBlocklistRoutes } from './admin/blocklist'
import { collectServices, type ServiceProbes } from './admin/services'
import { registerAuthRoutes, requireAdmin } from './auth/routes'
import type { SessionStore } from './auth/session-store'
import type { Env } from './env'
import { registerLiveRoutes } from './live/routes'
import type { LiveSource } from './live/types'
import { registerLiveWs } from './live/ws'
import { clientIp } from './net/client-ip'
import { registerAirportRoutes, type AirportRouteOptions } from './reference/airports'
import { registerWeatherRoutes, type WeatherRouteOptions } from './reference/weather'

export interface VersionInfo {
  app: 'havayolu'
  version: string
  gitSha: string
  buildTime: string | null
  env: Env['APP_ENV']
}

export interface AppDeps {
  /** `null`: oturum deposu yok (redis-queue tanımsız) → yönetici girişi kapalı. */
  sessionStore: SessionStore | null
  /** /ready kontrolleri; `null` = yapılandırılmamış (üretimde env doğrulaması bunu engeller). */
  readiness: Record<string, (() => Promise<number>) | null>
  probes: Omit<ServiceProbes, 'api'>
  /** Hız limiti sayaçları için redis-queue; yoksa süreç içi sayaç kullanılır. */
  rateLimitRedis: Redis | null
  /**
   * Canlı veri (D-074): `source` null ise (redis-live yok) ya da `ready()` false iken (engel
   * listesi henüz okunmadı, önbellek başlamadı) /v1/live, arama ve WS 503/1013 döner. `ready`
   * verilmezse kaynak hep hazırdır.
   */
  live: { source: LiveSource | null; codes: () => AirlineCodes; ready?: () => boolean }
  /** Hex engel listesinin deposu (redis-queue); yoksa admin engel listesi uçları 503. */
  blocklistRedis: Redis | null
  /**
   * Kapsama raporu deposu (PostgreSQL, M7b.2); null ise (veritabanı yok) admin kapsama raporu uçları
   * 503.
   */
  arrivalCoverage: ArrivalCoverageStore | null
  /**
   * Havalimanı uçları (`/v1/airports`, `/v1/airports/:code`); okuyucu null ise (veritabanı yok)
   * 503.
   */
  airports: AirportRouteOptions
  /**
   * Hava durumu uçları (`/v1/weather`, `/v1/airports/:code/weather`, `.../weather/history`);
   * okuyucu null ise (veritabanı yok) 503.
   */
  weather: WeatherRouteOptions
}

/** CORS izinli origin'leri: web ve admin host'ları (yerelde http, diğerlerinde https). */
export function allowedOrigins(env: Env): string[] {
  const hosts = [env.WEB_HOST, env.ADMIN_HOST].filter((h): h is string => Boolean(h))
  return hosts.map((host) =>
    host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? `http://${host}`
      : `https://${host}`,
  )
}

const UNAUTHORIZED = { message: 'Yönetici oturumu gerekli.' }

/**
 * API herkese açıktır ama arama sonuçlarında yer almaz (M6b, D-076): her yanıtta bu X-Robots-Tag
 * başlığı gider, /robots.txt bütün yolları kapatır. Sayfalar web host'undadır.
 */
export const API_ROBOTS_TAG = 'noindex'
export const API_ROBOTS_TXT = 'User-agent: *\nDisallow: /\n'

/** Ucuz ve durumsuz sistem uçları hız sınırına girmez: web'in /durum sayfası ve izleme bunları sık çağırır. */
const NO_RATE_LIMIT = { rateLimit: false } as const

export async function buildApp(env: Env, deps: AppDeps): Promise<FastifyInstance> {
  const startedAt = new Date()
  const app = Fastify({
    logger:
      env.LOG_LEVEL === 'silent'
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: ['req.headers.authorization', 'req.headers.cookie', '*.token', '*.password'],
          },
    trustProxy: env.TRUSTED_PROXY_CIDRS.length > 0 ? env.TRUSTED_PROXY_CIDRS : false,
  })

  await app.register(helmet, { global: true })
  // 1 KB'tan büyük yanıt gövdeleri br ya da gzip ile sıkıştırılır (toplu hava ~1,3 MB → ~0,1 MB).
  // İstek gövdeleri açılmaz: API yalnız küçük JSON alır, sıkıştırılmış gövde açılınca şişebilir.
  await app.register(compress, { encodings: ['br', 'gzip'], globalDecompression: false })
  // 404, 429 ve hata yanıtları dahil her yanıt (onSend hata işleyicisinden sonra da çalışır).
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-robots-tag', API_ROBOTS_TAG)
    return payload
  })
  const origins = allowedOrigins(env)
  await app.register(cors, { origin: origins.length > 0 ? origins : false, credentials: true })
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // Özel anahtar üreticisinde eklentinin normalleştirmesi otomatik çalışmaz: IPv6 /64 bloğu tek
    // ziyaretçi sayılır (blok içinde adres değiştirerek sınır aşılamaz), IPv4-mapped çözülür.
    keyGenerator: (request) => normalizeIP(clientIp(env.EDGE_PROXY, request), 64),
    // Sayaç deposu (redis-queue) hata verirse istek reddedilmez; API Redis kesintisinde de ayakta kalır.
    skipOnError: true,
    ...(deps.rateLimitRedis ? { redis: deps.rateLimitRedis, nameSpace: 'hy:ratelimit:' } : {}),
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      message: `Çok fazla istek. ${Math.ceil(context.ttl / 1000)} sn sonra yeniden dene.`,
    }),
  })
  await app.register(swagger, {
    openapi: {
      info: { title: 'havayolu API', version: currentVersion() },
      tags: [
        { name: 'system', description: 'Sağlık ve sürüm' },
        { name: 'auth', description: 'Yönetici oturumu (platform-admin sözleşmesi)' },
        { name: 'admin', description: 'Yönetim' },
        { name: 'live', description: 'Canlı uçaklar ve arama (WebSocket: /v1/ws)' },
        { name: 'reference', description: 'Referans verisi (havalimanları)' },
        {
          name: 'weather',
          description:
            'Havalimanı hava durumu: METAR/TAF (aviationweather.gov, NOAA Aviation Weather Center); resmî brifing yerine geçmez',
        },
      ],
    },
  })

  const versionInfo: VersionInfo = {
    app: 'havayolu',
    version: currentVersion(),
    gitSha: env.GIT_SHA,
    buildTime: env.BUILD_TIME ?? null,
    env: env.APP_ENV,
  }

  // Canlılık: süreç ayakta ve istek kabul ediyor mu.
  app.get('/health', { config: NO_RATE_LIMIT, schema: { tags: ['system'] } }, async () => ({
    status: 'ok' as const,
  }))
  app.get(
    '/version',
    { config: NO_RATE_LIMIT, schema: { tags: ['system'] } },
    async () => versionInfo,
  )

  // Hazırlık: bağımlılıklar yanıt veriyor mu. Biri bile başarısızsa 503. Herkese açık olduğu için
  // sürücü hata metni (iç adresler, kullanıcı adı) yanıtta verilmez, yalnızca loglanır.
  app.get('/ready', { schema: { tags: ['system'] } }, async (request, reply) => {
    const entries = await Promise.all(
      Object.entries(deps.readiness).map(async ([name, check]) => {
        if (!check) return [name, { ok: false, error: 'yapılandırılmamış' }] as const
        try {
          return [name, { ok: true, latencyMs: await check() }] as const
        } catch (error) {
          request.log.warn({ err: error, check: name }, 'hazırlık kontrolü başarısız')
          return [name, { ok: false, error: 'erişilemiyor' }] as const
        }
      }),
    )
    const ready = entries.every(([, result]) => result.ok)
    return reply
      .code(ready ? 200 : 503)
      .send({ status: ready ? 'ready' : 'not_ready', checks: Object.fromEntries(entries) })
  })

  app.get(
    '/robots.txt',
    { config: NO_RATE_LIMIT, schema: { hide: true } },
    async (_request, reply) =>
      reply
        .type('text/plain; charset=utf-8')
        .header('cache-control', 'public, max-age=86400')
        .send(API_ROBOTS_TXT),
  )

  app.get('/openapi.json', { config: NO_RATE_LIMIT, schema: { hide: true } }, async () =>
    app.swagger(),
  )

  const store = deps.sessionStore
  await registerAuthRoutes(app, {
    store,
    credentials:
      store && env.ADMIN_EMAIL && env.ADMIN_SETUP_TOKEN
        ? { email: env.ADMIN_EMAIL, setupToken: env.ADMIN_SETUP_TOKEN }
        : null,
  })

  app.get('/v1/admin/services', { schema: { tags: ['admin'] } }, async (request, reply) => {
    const session = store ? await requireAdmin(request, store) : null
    if (!session) return reply.code(401).send(UNAUTHORIZED)
    return collectServices({
      ...deps.probes,
      api: { version: versionInfo.version, gitSha: versionInfo.gitSha, startedAt },
    })
  })

  registerBlocklistRoutes(app, {
    sessions: store,
    blocklist: deps.blocklistRedis ? redisBlocklistStore(deps.blocklistRedis) : null,
  })
  // Kapsama raporu: API satırı kuyruğa yazar, worker'ın jobs rolü çalıştırır (D-098).
  registerArrivalCoverageRoutes(app, { sessions: store, store: deps.arrivalCoverage })

  // Canlı veri: REST, arama ve WebSocket aynı önbellekten okur (D-074).
  registerLiveRoutes(app, deps.live)
  registerLiveWs(app, { source: deps.live.source, ready: deps.live.ready, env, log: app.log })
  // Havalimanları: harita noktaları ve havalimanı sayfaları (OurAirports referans verisi).
  registerAirportRoutes(app, deps.airports)
  // Hava durumu: worker'ın yazdığı METAR/TAF, okurken çözümlenir (D-078).
  registerWeatherRoutes(app, deps.weather)

  return app
}
