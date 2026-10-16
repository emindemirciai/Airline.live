import { legacyRedirectLocation } from '@havayolu/shared'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Env } from '../env'

/**
 * Upgrade isteği mi: `Upgrade` başlığı var (`websocket`, `h2c` ya da bilinmeyen bir belirteç).
 * Node canlı veri el sıkışmasını (`GET /v1/ws`) `upgrade` olayına ayırır (`isLiveWsUpgrade`,
 * D-113): soket HTTP sunucusundan kopar, zaman aşımları işlemez ve yanıt bitince kendiliğinden
 * kapanmaz. Öbür yükseltme istekleri sıradan HTTP isteğidir; bağlantıları da yanıttan sonra kapanır
 * (`Connection: close`). Başlık, `injectWS`'in sahte isteğini de kapsar.
 */
function isUpgradeRequest(request: FastifyRequest): boolean {
  return request.headers.upgrade !== undefined
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
 * - Her upgrade isteği (WebSocket el sıkışması `GET /v1/ws`, `h2c` ya da başka bir belirteç) aynı
 *   308'i düz HTTP yanıtı olarak alır ve soket yanıttan sonra kapanır; yoksa her istek hız sınırına
 *   takılmadan açık bir soket bırakırdı. Tarayıcılar WebSocket yönlendirmesini izlemez: eski adreste
 *   açık kalan sekme yeniden bağlanmayı dener, sayfa yenilenince yeni adresten bağlanır. Web her zaman
 *   `API_HOST`'u kullanır.
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
    if (isUpgradeRequest(request)) {
      // `upgrade` olayından gelen soketi `@fastify/websocket` yalnızca kendi onRequest kancası çalıştıysa
      // kapatır. Bu kanca ondan önce yanıt verdiği için soket yanıt bitince burada kapanır.
      reply.header('connection', 'close')
      reply.raw.once('finish', () => reply.raw.socket?.destroy())
    }
    return reply.code(308).header('location', location).send()
  })
}
