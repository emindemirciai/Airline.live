import type { FastifyInstance, FastifyRequest } from 'fastify'
import { verifyAdminCredentials, type AdminCredentials } from './verify-login'
import type { AdminSession, SessionStore } from './session-store'

export interface AuthRouteOptions {
  /** `null`: oturum deposu yok; giriş kapalıdır. */
  store: SessionStore | null
  /** Tanımlı değilse yönetici girişi kapalıdır (404). */
  credentials: AdminCredentials | null
}

const MESSAGES = {
  disabled: 'Yönetici girişi bu sunucuda yapılandırılmamış.',
  missing: 'E-posta ve şifre zorunludur.',
  invalid: 'E-posta ya da şifre hatalı.',
  unauthorized: 'Yönetici oturumu gerekli.',
} as const

export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization
  if (!header) return null
  const [scheme, value] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && value ? value.trim() : null
}

/** Admin oturumu isteyen rotalar için: geçerli oturumu döndürür ya da 401 yanıtını gönderir. */
export async function requireAdmin(
  request: FastifyRequest,
  store: SessionStore,
): Promise<AdminSession | null> {
  const token = bearerToken(request)
  return token ? store.get(token) : null
}

/**
 * Platform-admin giriş sözleşmesi (docs/spec/infra.md → "Analiz"). Hem kendi admin panelimiz hem
 * kullanıcının "Siteni Analiz Et" uygulaması bu uç noktaları kullanır:
 * - POST /api/auth/login {email, password} → {token}
 * - GET /api/admin/session (Bearer) → 200 yetkili / 401
 * - GET /api/auth/me (Bearer) → {user: {email, role}}
 * - POST /api/auth/logout (Bearer) → 204
 */
export async function registerAuthRoutes(
  app: FastifyInstance,
  { store, credentials }: AuthRouteOptions,
) {
  app.post(
    '/api/auth/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['auth'],
        body: {
          type: 'object',
          properties: { email: { type: 'string' }, password: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      if (!credentials || !store) return reply.code(404).send({ message: MESSAGES.disabled })
      const body = (request.body ?? {}) as { email?: unknown; password?: unknown }
      const email = typeof body.email === 'string' ? body.email : ''
      const password = typeof body.password === 'string' ? body.password : ''
      if (!email || !password) return reply.code(400).send({ message: MESSAGES.missing })
      if (!verifyAdminCredentials(credentials, email, password)) {
        request.log.warn({ event: 'admin_login_failed' }, 'yönetici girişi başarısız')
        return reply.code(401).send({ message: MESSAGES.invalid })
      }
      const { token, expiresInSeconds } = await store.create(credentials.email)
      request.log.info({ event: 'admin_login' }, 'yönetici girişi')
      return reply.send({ token, expiresIn: expiresInSeconds })
    },
  )

  app.get('/api/admin/session', { schema: { tags: ['auth'] } }, async (request, reply) => {
    const session = store ? await requireAdmin(request, store) : null
    if (!session) return reply.code(401).send({ message: MESSAGES.unauthorized })
    return { ok: true, user: { email: session.email, role: session.role } }
  })

  app.get('/api/auth/me', { schema: { tags: ['auth'] } }, async (request, reply) => {
    const session = store ? await requireAdmin(request, store) : null
    if (!session) return reply.code(401).send({ message: MESSAGES.unauthorized })
    return { user: { email: session.email, role: session.role } }
  })

  app.post('/api/auth/logout', { schema: { tags: ['auth'] } }, async (request, reply) => {
    const token = bearerToken(request)
    if (token && store) await store.revoke(token)
    return reply.code(204).send()
  })
}
