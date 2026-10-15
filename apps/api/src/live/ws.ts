/**
 * `GET /v1/ws`: canlı veri WebSocket'i (D-074). Protokol JSON metin çerçeveleridir:
 *
 * - İstemci → sunucu: `{ type: 'subscribe', viewport: { minLon, minLat, maxLon, maxLat }, zoom,
 *   lastSeq? }`. Görünüm REST'teki `bbox` kuralına uyar. Hatalı mesaj `{ type: 'error', code:
 *   'bad_request' }` alır; 5. hatalı mesajda bağlantı 1008 ile kapanır.
 * - Sunucu → istemci:
 *   - `{ type: 'snapshot', seq, coverage, status, aircraft }`: görünümdeki uçakların tamamı.
 *   - `{ type: 'diff', seq, status, cells: [{ c, added, updated, removed }] }`: görünümle kesişen
 *     2°'lik hücrelerin değişimi; saniyede en fazla bir tane, boşsa gönderilmez. İstemci önce
 *     bütün `removed` listelerini, sonra `added`/`updated` kayıtlarını uygular (ws-protocol.ts).
 *   - `{ type: 'reconnect', afterMs }`: sunucu kapanıyor; istemci bu kadar bekleyip son `seq` ile
 *     yeniden bağlanır.
 * - `lastSeq` yalnızca bağlantının ilk aboneliğinde ve aynı görünüm için anlamlıdır: fark tamponu
 *   yetiyorsa eksik turlar tek diff olarak (boş da olabilir), yetmiyorsa tam görüntü gelir. Sonraki
 *   her abonelik (görünüm değişikliği) tam görüntü alır. Abonelik soket başına saniyede bir, IP
 *   başına dakikada 120 işlenir; fazlası atılmaz, en son istenen görünüm ilk uygun anda işlenir.
 *
 * Sınırlar: IP (/64) başına 10, toplam `WS_MAX_CONNECTIONS` bağlantı; el sıkışması IP başına
 * dakikada 30 (üretim dışında 60, `wsRateLimit`). `Origin` başlığı varsa web ya da admin host'u olmalıdır; başlığı olmayan yerel
 * uygulama kabul edilir. Sıkıştırma kapalıdır, en büyük istemci mesajı 16 KiB'tır.
 *
 * Yalnızca `GET` el sıkışması yükseltilir (`isLiveWsUpgrade`, D-113). `HEAD /v1/ws` 405 ve
 * `Allow: GET` alır; `Upgrade` başlıklı başka her istek sıradan HTTP isteği olarak yanıtlanır.
 */
import type { IncomingMessage } from 'node:http'
import { normalizeIP } from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from 'fastify'
import type { Env } from '../env'
import { clientIp } from '../net/client-ip'
import type { LiveSource } from './types'
import { LiveHub, WS_CLOSE } from './ws-hub'

export interface LiveWsOptions {
  /** `null`: canlı veri yok (redis-live tanımsız); bağlantı kabul edilip 1013 ile kapatılır. */
  source: LiveSource | null
  /**
   * false iken (engel listesi henüz okunmadı) yeni bağlantı 1013 `live_unavailable` ile kapatılır;
   * verilmezse hep hazır.
   */
  ready?: () => boolean
  env: Env
  log: FastifyBaseLogger
  now?: () => number
  random?: () => number
  /** Varsayılan 25 sn. */
  pingIntervalMs?: number
}

/** Canlı veri WebSocket'inin yolu. */
export const LIVE_WS_PATH = '/v1/ws'

/**
 * Node HTTP sunucusunun `shouldUpgradeCallback`'i (Node ≥ 24.9; `buildApp`, D-113): yalnızca canlı
 * veri el sıkışması (`GET /v1/ws`, `Upgrade: websocket`) `upgrade` olayına ayrılır. Varsayılanda
 * (`upgrade` dinleyicisi varken) `Connection: Upgrade` taşıyan her istek oraya düşer: soket HTTP
 * sunucusundan kopar (zaman aşımı ve keep-alive işlemez) ve `@fastify/websocket` yolun HTTP
 * işleyicisi yerine el sıkışmasını dener. Burada reddedilen istek sıradan HTTP isteğidir; sunucu
 * `Upgrade` başlığını yok sayar (RFC 9110 §7.8). El sıkışmasının kendisini (anahtar, sürüm) `ws`
 * denetler, hatalıysa 400 verir.
 */
export function isLiveWsUpgrade(request: IncomingMessage): boolean {
  return (
    request.method === 'GET' &&
    request.url?.split('?', 1)[0] === LIVE_WS_PATH &&
    request.headers.upgrade?.toLowerCase() === 'websocket'
  )
}

/** En büyük istemci mesajı; aşılırsa `ws` bağlantıyı 1009 ile kapatır. */
export const WS_MAX_PAYLOAD_BYTES = 16_384

/** El sıkışması hız sınırı (IP başına, üretimde); genel 300/dk yerine geçer. */
export const WS_RATE_LIMIT = { max: 30, timeWindow: '1 minute' } as const

/**
 * Ortamın el sıkışması sınırı (D-088). Üretim dışında (`APP_ENV` development ya da test) iki
 * katıdır: web orada Next geliştirme sunucusuyla çalışır, React StrictMode etkileri iki kez
 * çalıştırdığı için her harita yüklemesi iki el sıkışması açar (bağlan, kapat, bağlan). Böylece
 * sayfa yüklemesi başına bütçe üretimdekiyle (dakikada 30 yükleme) aynı kalır; e2e geliştirme
 * sunucusuna karşı koşar.
 */
export function wsRateLimit(appEnv: Env['APP_ENV']): { max: number; timeWindow: string } {
  return appEnv === 'production' ? WS_RATE_LIMIT : { ...WS_RATE_LIMIT, max: WS_RATE_LIMIT.max * 2 }
}

/** Açık merkezler: `closeLiveSockets` hepsini kapatır (testlerde birden çok uygulama olabilir). */
const hubs = new Set<LiveHub>()

/**
 * app.ts'teki CORS kuralıyla aynı izinli origin'ler: web ve admin host'ları (yerelde http,
 * diğerlerinde https). app.ts bu modülü içe aktardığı için döngü kurmamak adına burada da vardır;
 * ws.test.ts ikisinin aynı sonucu verdiğini denetler.
 */
export function wsAllowedOrigins(env: Pick<Env, 'WEB_HOST' | 'ADMIN_HOST'>): string[] {
  const hosts = [env.WEB_HOST, env.ADMIN_HOST].filter((h): h is string => Boolean(h))
  return hosts.map((host) =>
    host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? `http://${host}`
      : `https://${host}`,
  )
}

/** Hız sınırıyla aynı ziyaretçi anahtarı: IPv6 /64 bloğu tek ziyaretçidir (app.ts keyGenerator). */
function visitorKey(env: Env, request: FastifyRequest): string {
  const ip = clientIp(env.EDGE_PROXY, request)
  return ip ? normalizeIP(ip, 64) : 'unknown'
}

function toText(data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean): string | null {
  if (isBinary) return null
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8')
  return data.toString('utf8')
}

/** `@fastify/websocket`'i ve `GET /v1/ws` yolunu kaydeder. */
export function registerLiveWs(app: FastifyInstance, opts: LiveWsOptions): void {
  const { env } = opts
  const ready = opts.ready ?? (() => true)
  const origins = new Set(wsAllowedOrigins(env))
  const hub = opts.source
    ? new LiveHub({
        source: opts.source,
        log: opts.log,
        maxConnections: env.WS_MAX_CONNECTIONS,
        now: opts.now,
        random: opts.random,
        pingIntervalMs: opts.pingIntervalMs,
      })
    : null

  void app.register(websocket, {
    options: { perMessageDeflate: false, maxPayload: WS_MAX_PAYLOAD_BYTES },
    // İstemci kaynaklı soket hataları kodludur ve debug yazılır. Protokol hatasında (bozuk çerçeve,
    // 16 KiB'ı aşan mesaj) `ws` kapanışı kendi koduyla (1002/1007/1009) başlatmıştır; el sıkışması
    // tamamlansın diye soket sonlandırılmaz. Kodsuz hata işleyicinin kendi hatasıdır.
    errorHandler: (error, socket, request) => {
      const code = (error as { code?: unknown }).code
      if (typeof code === 'string') {
        request.log.debug({ code }, 'ws socket error')
        if (code.startsWith('WS_ERR_')) return
      } else {
        request.log.error({ err: error }, 'ws handler failed')
      }
      socket.terminate()
    },
  })

  // Yol, eklenti yüklendikten sonra kaydedilsin diye ayrı bir kapsamdadır (onRoute kancası).
  void app.register(async (scope) => {
    scope.get(
      LIVE_WS_PATH,
      {
        websocket: true,
        // Fastify GET yolunun HEAD ikizini seçeneklerin kopyasıyla kurar. `@fastify/websocket` HEAD
        // yolunu sarmaz; ikiz, aşağıdaki işleyiciyi `(request, reply)` ile çağırırdı: 500 ve
        // merkezde soketi olmayan bir istemci, ilk ping turunda süreç çökerdi (D-113).
        exposeHeadRoute: false,
        config: { rateLimit: wsRateLimit(env.APP_ENV) },
      },
      (socket, request) => {
        const origin = request.headers.origin
        if (origin !== undefined && !origins.has(origin)) {
          request.log.debug('ws origin rejected')
          socket.close(WS_CLOSE.policyViolation, 'origin_not_allowed')
          return
        }
        if (!hub || !ready()) {
          socket.close(WS_CLOSE.tryAgainLater, 'live_unavailable')
          return
        }
        const client = hub.connect(socket, visitorKey(env, request))
        if (!client) return
        socket.on('message', (data, isBinary) => hub.message(client, toText(data, isBinary)))
        socket.on('pong', () => hub.pong(client))
        socket.on('close', () => hub.disconnected(client))
      },
    )
    // El sıkışması yalnızca GET'tir. `Upgrade` başlıklı HEAD de buraya gelir (`isLiveWsUpgrade`).
    scope.head(LIVE_WS_PATH, { schema: { hide: true } }, async (_request, reply) =>
      reply.code(405).header('allow', 'GET').send({
        statusCode: 405,
        error: 'Method Not Allowed',
        message: 'WebSocket el sıkışması GET ile yapılır.',
      }),
    )
  })

  if (hub) {
    app.addHook('onReady', async () => {
      hub.start()
      hubs.add(hub)
    })
    app.addHook('onClose', async () => {
      hub.stop()
      hubs.delete(hub)
    })
  }
}

/**
 * SIGTERM yolu (infra.md): yeni bağlantı kabul edilmez, her istemciye `{type:'reconnect',
 * afterMs: 1000–10000}` gönderilir ve bağlantı 1012 ile kapatılır. Hepsi kapanınca ya da en geç
 * 3 sn sonra çözülür. `app.close()`'tan önce çağrılır.
 */
export async function closeLiveSockets(): Promise<void> {
  await Promise.all([...hubs].map((hub) => hub.closeAll()))
}
