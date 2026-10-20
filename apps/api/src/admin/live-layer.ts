import {
  LIVE_LAYER_REASON_MAX,
  listAdminActions,
  readLiveLayer,
  setLiveLayer,
  type AdminAction,
  type Database,
  type LiveLayerView,
} from '@havayolu/db'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { requireAdmin } from '../auth/routes'
import type { SessionStore } from '../auth/session-store'

/** Canlı katman anahtarının deposu; üretimde PostgreSQL (`pgLiveLayerStore`), testte bellek. */
export interface LiveLayerStore {
  read(): Promise<LiveLayerView>
  set(params: { enabled: boolean; actor: string; reason: string | null }): Promise<LiveLayerView>
  actions(limit: number): Promise<AdminAction[]>
}

export function pgLiveLayerStore(sql: Database['sql']): LiveLayerStore {
  return {
    read: () => readLiveLayer(sql),
    set: (params) => setLiveLayer(sql, params),
    actions: (limit) => listAdminActions(sql, limit),
  }
}

export interface LiveLayerRouteOptions {
  /** `null`: oturum deposu yok; yönetici girişi kapalı, her istek 401. */
  sessions: SessionStore | null
  /** `null`: veritabanı (DATABASE_URL) yok → 503. */
  store: LiveLayerStore | null
  /** Başarılı değişiklikten sonra çağrılır: API kendi kopyasını hemen yeniler. */
  changed: () => void
}

export const LIVE_LAYER_PATH = '/v1/admin/live-layer'
/** Yanıttaki işlem kaydı uzunluğu. */
export const LIVE_LAYER_ACTIONS_LIMIT = 20

const ERRORS = {
  unauthorized: { message: 'Yönetici oturumu gerekli.' },
  unavailable: {
    error: 'live_layer_unavailable',
    message: 'Veritabanı (DATABASE_URL) bağlı değil; canlı katman anahtarı kullanılamıyor.',
  },
  badBody: {
    error: 'bad_request',
    message: `Gövde { "enabled": true|false, "reason"?: metin (en çok ${LIVE_LAYER_REASON_MAX} karakter) } olmalı.`,
  },
} as const

const viewSchema = {
  type: 'object',
  required: ['enabled', 'updatedAt', 'updatedBy', 'actions'],
  properties: {
    enabled: { type: 'boolean', description: 'Canlı katman açık mı' },
    updatedAt: { type: ['string', 'null'], description: 'Son değişiklik (ISO 8601)' },
    updatedBy: { type: ['string', 'null'], description: 'Son değiştiren yönetici' },
    actions: {
      type: 'array',
      description: `Son ${LIVE_LAYER_ACTIONS_LIMIT} işlem, en yeni önce`,
      items: {
        type: 'object',
        required: ['at', 'actor', 'action', 'reason'],
        properties: {
          at: { type: 'string' },
          actor: { type: 'string' },
          action: { type: 'string', enum: ['on', 'off'] },
          reason: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, message: { type: 'string' } },
} as const

export interface LiveLayerResponse {
  enabled: boolean
  updatedAt: string | null
  updatedBy: string | null
  actions: { at: string; actor: string; action: 'on' | 'off'; reason: string | null }[]
}

type BodyCheck = { ok: true; enabled: boolean; reason: string | null } | { ok: false }

/**
 * Gövde: `enabled` boolean olmalı; `reason` isteğe bağlı metin, kırpılır, NUL karakterleri atılır,
 * boşsa null, 500 karakterden (kod noktası; tablo denetimiyle aynı) uzunsa ret.
 */
export function parseLiveLayerBody(body: unknown): BodyCheck {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false }
  const { enabled, reason } = body as { enabled?: unknown; reason?: unknown }
  if (typeof enabled !== 'boolean') return { ok: false }
  if (reason === undefined || reason === null) return { ok: true, enabled, reason: null }
  if (typeof reason !== 'string') return { ok: false }
  const cleaned = reason.replaceAll('\u0000', '').trim()
  if ([...cleaned].length > LIVE_LAYER_REASON_MAX) return { ok: false }
  return { ok: true, enabled, reason: cleaned === '' ? null : cleaned }
}

async function view(store: LiveLayerStore): Promise<LiveLayerResponse> {
  const [state, actions] = await Promise.all([
    store.read(),
    store.actions(LIVE_LAYER_ACTIONS_LIMIT),
  ])
  return {
    enabled: state.enabled,
    updatedAt: state.updatedAt?.toISOString() ?? null,
    updatedBy: state.updatedBy,
    actions: actions.map((a) => ({
      at: a.at.toISOString(),
      actor: a.actor,
      action: a.action === 'live_layer_on' ? 'on' : 'off',
      reason: a.reason,
    })),
  }
}

/**
 * Canlı katman anahtarı (Parça 1 M7d.1, D-115). Kapalıyken worker canlı uçak yazmaz ve
 * `redis-live`'ı temizler; API ve WS boş küme döner (birkaç saniye içinde).
 * - `GET /v1/admin/live-layer` → durum, son değişiklik ve son 20 işlem
 * - `PUT /v1/admin/live-layer` `{ enabled, reason? }` → aynı biçim; her başarılı istek (durum
 *   aynı kalsa da) işlem kaydına yazılır. Acil durum anahtarıdır: genel IP sınırı dışında ek hız
 *   sınırı yoktur. Log e-posta ve neden taşımaz.
 */
export function registerLiveLayerRoutes(
  app: FastifyInstance,
  { sessions, store, changed }: LiveLayerRouteOptions,
): void {
  /** Yönetici değilse 401, depo yoksa 503 gönderir ve null döner. */
  const guard = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<{ store: LiveLayerStore; actor: string } | null> => {
    const session = sessions ? await requireAdmin(request, sessions) : null
    if (!session) {
      void reply.code(401).send(ERRORS.unauthorized)
      return null
    }
    if (!store) {
      void reply.code(503).send(ERRORS.unavailable)
      return null
    }
    return { store, actor: session.email }
  }

  app.get(
    LIVE_LAYER_PATH,
    {
      schema: {
        tags: ['admin'],
        summary: 'Canlı katman anahtarı ve işlem kaydı',
        response: { 200: viewSchema, 401: errorSchema, 503: errorSchema },
      },
    },
    async (request, reply) => {
      reply.header('cache-control', 'no-store')
      const ok = await guard(request, reply)
      if (!ok) return reply
      return view(ok.store)
    },
  )

  app.put(
    LIVE_LAYER_PATH,
    {
      // Şema yalnızca belge içindir: Fastify'ın tür zorlaması (1 → true, "false" → false) acil
      // durum anahtarında istenmez; gövdeyi `parseLiveLayerBody` sıkı denetler.
      validatorCompiler: () => () => true,
      schema: {
        tags: ['admin'],
        summary: 'Canlı katmanı aç ya da kapat',
        body: {
          type: 'object',
          required: ['enabled'],
          properties: {
            enabled: { type: 'boolean' },
            reason: {
              type: 'string',
              description: `İsteğe bağlı neden (ör. karar sayısı), en çok ${LIVE_LAYER_REASON_MAX} karakter`,
            },
          },
        },
        response: { 200: viewSchema, 400: errorSchema, 401: errorSchema, 503: errorSchema },
      },
    },
    async (request, reply) => {
      reply.header('cache-control', 'no-store')
      const ok = await guard(request, reply)
      if (!ok) return reply
      const parsed = parseLiveLayerBody(request.body)
      if (!parsed.ok) return reply.code(400).send(ERRORS.badBody)
      await ok.store.set({ enabled: parsed.enabled, actor: ok.actor, reason: parsed.reason })
      request.log.info(
        { event: 'admin_live_layer', enabled: parsed.enabled },
        'live layer switched by admin',
      )
      changed()
      return view(ok.store)
    },
  )
}
