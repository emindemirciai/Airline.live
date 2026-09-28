import { addToBlocklist, readBlocklist, removeFromBlocklist } from '@havayolu/db'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Redis } from 'ioredis'
import { requireAdmin } from '../auth/routes'
import type { SessionStore } from '../auth/session-store'

/** Engel listesi deposu; üretimde redis-queue kümesi (`hy:blocklist:hex`), testte bellek. */
export interface BlocklistStore {
  list(): Promise<string[]>
  add(hexes: readonly string[]): Promise<number>
  remove(hexes: readonly string[]): Promise<number>
}

export function redisBlocklistStore(redis: Redis): BlocklistStore {
  return {
    list: async () => [...(await readBlocklist(redis))].sort(),
    add: (hexes) => addToBlocklist(redis, hexes),
    remove: (hexes) => removeFromBlocklist(redis, hexes),
  }
}

export interface BlocklistRouteOptions {
  /** `null`: oturum deposu yok; yönetici girişi kapalı, her istek 401. */
  sessions: SessionStore | null
  /** `null`: redis-queue tanımsız → 503. */
  blocklist: BlocklistStore | null
}

/** Tek istekte gönderilebilecek en fazla hex. */
export const BLOCKLIST_MAX_ITEMS = 1_000
const HEX = /^~?[0-9a-f]{6}$/

const ERRORS = {
  unauthorized: { message: 'Yönetici oturumu gerekli.' },
  unavailable: {
    error: 'blocklist_unavailable',
    message: 'Engel listesi deposu (redis-queue) yapılandırılmamış.',
  },
  badBody: {
    error: 'bad_request',
    message: `Gövde { "hexes": [...] } olmalı (1–${BLOCKLIST_MAX_ITEMS} hex).`,
  },
} as const

const hexesBody = {
  type: 'object',
  required: ['hexes'],
  properties: {
    hexes: {
      type: 'array',
      minItems: 1,
      maxItems: BLOCKLIST_MAX_ITEMS,
      items: { type: 'string', description: '6 haneli ICAO hex (ICAO dışı adres ~ önekli)' },
    },
  },
} as const

type BodyCheck = { ok: true; hexes: string[] } | { ok: false; status: number; body: object }

/** Hex'leri kırpar, küçük harfe çevirir, tekrarları atar; biri bile geçersizse hiçbiri yazılmaz. */
export function parseHexes(body: unknown): BodyCheck {
  const hexes = (body as { hexes?: unknown } | null)?.hexes
  if (
    !Array.isArray(hexes) ||
    hexes.length === 0 ||
    hexes.length > BLOCKLIST_MAX_ITEMS ||
    !hexes.every((value): value is string => typeof value === 'string')
  ) {
    return { ok: false, status: 400, body: ERRORS.badBody }
  }
  const normalized = new Set<string>()
  const invalid: string[] = []
  for (const value of hexes) {
    const hex = value.trim().toLowerCase()
    if (HEX.test(hex)) normalized.add(hex)
    else invalid.push(value)
  }
  if (invalid.length > 0) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'bad_hex',
        message: 'Geçersiz hex: 6 onaltılık hane olmalı (ICAO dışı adres ~ önekli).',
        invalid: invalid.slice(0, 20),
      },
    }
  }
  return { ok: true, hexes: [...normalized] }
}

/**
 * Yöneticinin hex engel listesi (D-074). Listedeki uçak REST, WebSocket ve aramada dönmez; API
 * listeyi 30 sn'de bir okur, değişiklik en geç o sürede etkinleşir.
 * - `GET /v1/admin/blocklist` → `{ hexes }`
 * - `POST /v1/admin/blocklist` `{ hexes }` → `{ added }`
 * - `DELETE /v1/admin/blocklist` `{ hexes }` → `{ removed }`
 */
export function registerBlocklistRoutes(
  app: FastifyInstance,
  { sessions, blocklist }: BlocklistRouteOptions,
): void {
  /** Yönetici değilse 401, depo yoksa 503 gönderir ve null döner. */
  const guard = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<BlocklistStore | null> => {
    const session = sessions ? await requireAdmin(request, sessions) : null
    if (!session) {
      void reply.code(401).send(ERRORS.unauthorized)
      return null
    }
    if (!blocklist) {
      void reply.code(503).send(ERRORS.unavailable)
      return null
    }
    return blocklist
  }

  app.get(
    '/v1/admin/blocklist',
    { schema: { tags: ['admin'], summary: 'Hex engel listesi' } },
    async (request, reply) => {
      const store = await guard(request, reply)
      if (!store) return reply
      return { hexes: await store.list() }
    },
  )

  app.post(
    '/v1/admin/blocklist',
    {
      attachValidation: true,
      schema: { tags: ['admin'], summary: 'Engel listesine ekle', body: hexesBody },
    },
    async (request, reply) => {
      const store = await guard(request, reply)
      if (!store) return reply
      const parsed = parseHexes(request.body)
      if (!parsed.ok) return reply.code(parsed.status).send(parsed.body)
      const added = await store.add(parsed.hexes)
      request.log.info({ event: 'admin_blocklist_add', count: added }, 'blocklist entries added')
      return { added }
    },
  )

  app.delete(
    '/v1/admin/blocklist',
    {
      attachValidation: true,
      schema: { tags: ['admin'], summary: 'Engel listesinden çıkar', body: hexesBody },
    },
    async (request, reply) => {
      const store = await guard(request, reply)
      if (!store) return reply
      const parsed = parseHexes(request.body)
      if (!parsed.ok) return reply.code(parsed.status).send(parsed.body)
      const removed = await store.remove(parsed.hexes)
      request.log.info(
        { event: 'admin_blocklist_remove', count: removed },
        'blocklist entries removed',
      )
      return { removed }
    },
  )
}
