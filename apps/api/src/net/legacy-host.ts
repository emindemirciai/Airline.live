import { legacyRedirectLocation } from '@havayolu/shared'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Env } from '../env'

/** WebSocket el sıkışması mı (`Upgrade: websocket`). */
function isWebSocketUpgrade(request: FastifyRequest): boolean {
  return request.headers.upgrade?.toLowerCase() === 'websocket'
}

/**
 * Eski API alan adlarından kalıcı yönlendirme (D-112). `LEGACY_API_HOSTS`'taki bir host'a gelen her
 * istek, yönlendirmeden önce hiçbir iş yapılmadan (güvenlik başlıkları, CORS, hız sınırı, yol eşleme
 * ve 404 dahil) `308 Location: https://<API_HOST><aynı yol ve sorgu>` alır; 308 yöntemi ve gövdeyi
 * korur. Bu yüzden `buildApp`'te ilk kanca olarak kaydedilir.
 *
 * - Host Fastify'ın `request.host`'udur: güvenilen vekilden gelen `X-Forwarded-Host`, yoksa `Host`.
 *   Adres istekten değil env'den kurulur; iç trafik (web → `http://hy-api:4000`, sağlık denetimi)
 *   eski host taşımaz ve dokunulmaz.
 * - WebSocket el sıkışması (`GET /v1/ws`) aynı 308'i düz HTTP yanıtı olarak alır ve soket kapanır.
 *   Tarayıcılar WebSocket yönlendirmesini izlemez: eski adreste açık kalan sekme yeniden bağlanmayı
 *   dener, sayfa yenilenince yeni adresten bağlanır. Web her zaman `API_HOST`'u kullanır.
 * - Tarayıcıların CORS ön kontrolü (OPTIONS) de 308 alır ve yönlendirme izlenmez; eski origin'ler
 *   CORS listesine eklenmez (eski alan adları sayfa sunmaz).
 * - Liste boşsa ya da API_HOST tanımsızsa kanca hiç eklenmez.
 */
export function registerLegacyHostRedirect(
  app: FastifyInstance,
  env: Pick<Env, 'API_HOST' | 'LEGACY_API_HOSTS'>,
): void {
  const target = env.API_HOST
  const legacyHosts = env.LEGACY_API_HOSTS
  if (!target || legacyHosts.length === 0) return
  app.addHook('onRequest', async (request, reply) => {
    const location = legacyRedirectLocation({
      legacyHosts,
      target,
      requestHost: request.host,
      pathAndQuery: request.url,
    })
    if (!location) return
    if (isWebSocketUpgrade(request)) {
      // `@fastify/websocket` soketi yalnızca kendi el sıkışmasında kapatır; yanıt bitince burada kapanır.
      reply.header('connection', 'close')
      reply.raw.once('finish', () => reply.raw.socket?.destroy())
    }
    return reply.code(308).header('location', location).send()
  })
}
