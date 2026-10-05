import {
  getArrivalCoverageReport,
  insertQueuedArrivalCoverageReport,
  listArrivalCoverageReports,
  readStationArrivalCoverage7d,
  type ArrivalCoverageReportDetail,
  type ArrivalCoverageReportStatus,
  type ArrivalCoverageReportSummary,
  type Database,
  type InsertArrivalCoverageReportResult,
  type StationArrivalCoverage7d,
} from '@havayolu/db'
import { ARRIVAL_COVERAGE_HOURS, type ArrivalCoverageHours } from '@havayolu/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { requireAdmin } from '../auth/routes'
import type { SessionStore } from '../auth/session-store'

/**
 * Kapsama raporu uçları (Parça 1 M7b.2, D-098). API kuyruğa iş eklemez: yalnızca
 * `arrival_coverage_reports` tablosuna `queued` satır yazar (danışma kilidi altında; etkin rapor
 * varsa 409). Satırı worker'ın `jobs` rolü üstlenir, çalıştırır ve `done`/`failed` yapar.
 * Liste ve ayrıntı yazmadan "etkin durum" döndürür (15 dk kuyrukta ya da 20 dk çalışırken kalan satır
 * `failed` görünür).
 *
 * - `POST /v1/admin/arrival-coverage/reports` `{ hours }` → 202 `{ id, status, hours }`, etkin rapor
 *   varsa 409 `{ activeId }`
 * - `GET /v1/admin/arrival-coverage/reports` → `{ checkedAt, reports, activeId, stations }`
 * - `GET /v1/admin/arrival-coverage/reports/:id` → rapor, sonucu (`result`), Markdown'ı ve
 *   `checkedAt`
 * - `GET /v1/admin/arrival-coverage/reports/:id/markdown` → `text/markdown` eki
 *   (`kapsama-<YYYYMMDD>T<HHmm>Z.md`, pencere sonu UTC); rapor hazır değilse 409
 *
 * Yönetici oturumu yoksa 401, veritabanı yoksa ya da yanıt vermiyorsa 503. Yanıtlar önbelleğe
 * alınmaz (`no-store`). Sonuç yalnızca toplam sayı taşır; hex, tescil ve çağrı kodu yoktur.
 */

/** Kapsama raporu deposu; üretimde PostgreSQL (`pgArrivalCoverageStore`), testte bellek. */
export interface ArrivalCoverageStore {
  request(hours: ArrivalCoverageHours, now: Date): Promise<InsertArrivalCoverageReportResult>
  list(now: Date): Promise<{ reports: ArrivalCoverageReportSummary[]; activeId: number | null }>
  get(id: number, now: Date): Promise<ArrivalCoverageReportDetail | null>
  stations(): Promise<StationArrivalCoverage7d[]>
}

export function pgArrivalCoverageStore(sql: Database['sql']): ArrivalCoverageStore {
  return {
    request: (hours, now) => insertQueuedArrivalCoverageReport(sql, { hours, now }),
    list: (now) => listArrivalCoverageReports(sql, { now }),
    get: (id, now) => getArrivalCoverageReport(sql, id, now),
    stations: () => readStationArrivalCoverage7d(sql),
  }
}

export interface ArrivalCoverageRouteOptions {
  /** `null`: oturum deposu yok; yönetici girişi kapalı, her istek 401. */
  sessions: SessionStore | null
  /** `null`: veritabanı (DATABASE_URL) yok → 503. */
  store: ArrivalCoverageStore | null
  /** Saat (test); varsayılan sistem saati. */
  now?: () => Date
}

export const ARRIVAL_COVERAGE_REPORTS_PATH = '/v1/admin/arrival-coverage/reports'
/** POST hız sınırı: dakikada en çok 5 istek (istemci başına). */
export const ARRIVAL_COVERAGE_POST_RATE_LIMIT = { max: 5, timeWindow: '1 minute' } as const
/** Rapor kimliği: 1 ile başlayan en çok 18 hane (web indirme ucuyla aynı kural). */
export const ARRIVAL_COVERAGE_REPORT_ID = /^[1-9][0-9]{0,17}$/

const ALLOWED_HOURS: readonly number[] = ARRIVAL_COVERAGE_HOURS

export const ARRIVAL_COVERAGE_ERRORS = {
  unauthorized: { message: 'Yönetici oturumu gerekli.' },
  unavailable: {
    error: 'arrival_coverage_unavailable',
    message: 'Kapsama raporu için veritabanı (DATABASE_URL) yapılandırılmamış.',
  },
  failed: {
    error: 'arrival_coverage_failed',
    message: 'Veritabanı yanıt vermedi; biraz sonra yeniden dene.',
  },
  badHours: {
    error: 'bad_hours',
    message: `Gövde { "hours": n } olmalı; n şunlardan biri: ${ARRIVAL_COVERAGE_HOURS.join(', ')}.`,
    allowed: ARRIVAL_COVERAGE_HOURS,
  },
  badId: {
    error: 'bad_id',
    message: 'Rapor kimliği pozitif bir tamsayı olmalı.',
  },
  notFound: { error: 'not_found', message: 'Rapor bulunamadı.' },
  active: { error: 'report_active', message: 'Çalışan bir kapsama raporu var.' },
  notReady: { error: 'report_not_ready', message: 'Rapor henüz hazır değil.' },
} as const

/** Gövdedeki `hours` izinli pencerelerden biri mi (6, 12, 24, 48, 72, 168). */
export function parseArrivalCoverageHours(body: unknown): ArrivalCoverageHours | null {
  const hours = (body as { hours?: unknown } | null)?.hours
  return typeof hours === 'number' && ALLOWED_HOURS.includes(hours)
    ? (hours as ArrivalCoverageHours)
    : null
}

/** Yol parametresindeki kimlik; biçim dışıysa null (400), güvenli tamsayı dışıysa 0 (404). */
export function parseArrivalCoverageReportId(value: unknown): number | null {
  if (typeof value !== 'string' || !ARRIVAL_COVERAGE_REPORT_ID.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : 0
}

const pad = (value: number, width = 2) => String(value).padStart(width, '0')

/**
 * İndirilen dosyanın adı: `kapsama-<YYYYMMDD>T<HHmm>Z.md` (UTC, `:` yok; Windows dosya adında
 * geçersizdir). Pencere sonu yoksa bitiş, o da yoksa istenme anı kullanılır.
 */
export function arrivalCoverageFileName(at: Date): string {
  const date = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}`
  return `kapsama-${date}T${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}Z.md`
}

const isoOrNull = (date: Date | null) => (date === null ? null : date.toISOString())

/** API yanıtındaki rapor özeti (zamanlar ISO 8601 UTC). */
export interface ArrivalCoverageReportJson {
  id: number
  /** Etkin durum. */
  status: ArrivalCoverageReportStatus
  hours: number
  requestedAt: string
  startedAt: string | null
  finishedAt: string | null
  windowStart: string | null
  windowEnd: string | null
  /** Hata kodu (`timeout_queued`, `timeout_running`) ya da worker'ın kısa iletisi. */
  error: string | null
  definitionVersion: number | null
}

export interface ArrivalCoverageReportDetailJson extends ArrivalCoverageReportJson {
  /** `@havayolu/shared` `ArrivalCoverageResult`; rapor bitmemişse null. */
  result: unknown
  markdown: string | null
  /** Etkin durumun hesaplandığı an (ISO); çalışan raporun süresi buna göre gösterilir. */
  checkedAt: string
}

export interface ArrivalCoverageStationJson {
  icao: string
  iata: string
  isPrimary: boolean
  ratio7d: number | null
  arrivals7d: number | null
  updatedAt: string | null
}

export function reportJson(report: ArrivalCoverageReportSummary): ArrivalCoverageReportJson {
  return {
    id: report.id,
    status: report.status,
    hours: report.hours,
    requestedAt: report.requestedAt.toISOString(),
    startedAt: isoOrNull(report.startedAt),
    finishedAt: isoOrNull(report.finishedAt),
    windowStart: isoOrNull(report.windowStart),
    windowEnd: isoOrNull(report.windowEnd),
    error: report.error,
    definitionVersion: report.definitionVersion,
  }
}

/** Etkin istasyonlar (önce birincil); pasif istasyonların sütunları yazılmaz. */
export function stationsJson(
  rows: readonly StationArrivalCoverage7d[],
): ArrivalCoverageStationJson[] {
  return rows
    .filter((row) => row.isActive)
    .map((row) => ({
      icao: row.icao,
      iata: row.iata,
      isPrimary: row.isPrimary,
      ratio7d: row.ratio7d,
      arrivals7d: row.arrivals7d,
      updatedAt: isoOrNull(row.updatedAt),
    }))
}

const idParams = {
  type: 'object',
  required: ['id'],
  properties: {
    id: {
      type: 'string',
      pattern: ARRIVAL_COVERAGE_REPORT_ID.source,
      description: 'Rapor kimliği',
    },
  },
} as const

const hoursBody = {
  type: 'object',
  required: ['hours'],
  properties: {
    hours: {
      type: 'integer',
      enum: [...ARRIVAL_COVERAGE_HOURS],
      description: 'Pencere (saat); pencere işin başlangıcından 45 dk önce biter',
    },
  },
} as const

export function registerArrivalCoverageRoutes(
  app: FastifyInstance,
  { sessions, store, now = () => new Date() }: ArrivalCoverageRouteOptions,
): void {
  /** Yönetici değilse 401, depo yoksa 503 gönderir ve null döner. */
  const guard = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<ArrivalCoverageStore | null> => {
    void reply.header('cache-control', 'no-store')
    const session = sessions ? await requireAdmin(request, sessions) : null
    if (!session) {
      void reply.code(401).send(ARRIVAL_COVERAGE_ERRORS.unauthorized)
      return null
    }
    if (!store) {
      void reply.code(503).send(ARRIVAL_COVERAGE_ERRORS.unavailable)
      return null
    }
    return store
  }

  /** Veritabanı hatası: sürücü iletisi (iç adres, kullanıcı adı) yanıta girmez, loglanır. */
  const failed = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
    request.log.warn({ err: error, event: 'admin_arrival_coverage_failed' }, 'database error')
    return reply.code(503).send(ARRIVAL_COVERAGE_ERRORS.failed)
  }

  /** Kimlik biçim dışıysa 400, rapor yoksa 404 gönderir ve null döner. */
  const loadReport = async (
    request: FastifyRequest,
    reply: FastifyReply,
    reports: ArrivalCoverageStore,
    at: Date = now(),
  ): Promise<ArrivalCoverageReportDetail | null> => {
    const id = parseArrivalCoverageReportId((request.params as { id?: unknown } | null)?.id)
    if (id === null) {
      void reply.code(400).send(ARRIVAL_COVERAGE_ERRORS.badId)
      return null
    }
    const report = id === 0 ? null : await reports.get(id, at)
    if (!report) {
      void reply.code(404).send(ARRIVAL_COVERAGE_ERRORS.notFound)
      return null
    }
    return report
  }

  app.post(
    ARRIVAL_COVERAGE_REPORTS_PATH,
    {
      attachValidation: true,
      config: { rateLimit: ARRIVAL_COVERAGE_POST_RATE_LIMIT },
      schema: {
        tags: ['admin'],
        summary: 'Kapsama raporu iste',
        description:
          'Kuyruğa `queued` satır yazar (202); worker raporu çalıştırır. Aynı anda tek rapor etkin olur (409).',
        body: hoursBody,
      },
    },
    async (request, reply) => {
      const reports = await guard(request, reply)
      if (!reports) return reply
      const hours = parseArrivalCoverageHours(request.body)
      if (hours === null) return reply.code(400).send(ARRIVAL_COVERAGE_ERRORS.badHours)
      let result: InsertArrivalCoverageReportResult
      try {
        result = await reports.request(hours, now())
      } catch (error) {
        return failed(request, reply, error)
      }
      if (!result.queued) {
        return reply
          .code(409)
          .send({ ...ARRIVAL_COVERAGE_ERRORS.active, activeId: result.activeId })
      }
      request.log.info(
        { event: 'admin_arrival_coverage_requested', reportId: result.id, hours },
        'arrival coverage report requested',
      )
      return reply.code(202).send({ id: result.id, status: 'queued', hours })
    },
  )

  app.get(
    ARRIVAL_COVERAGE_REPORTS_PATH,
    {
      schema: {
        tags: ['admin'],
        summary: 'Kapsama raporları',
        description:
          'En yeni 50 rapor (Markdown olmadan, etkin durumlarıyla), etkin raporun kimliği ve istasyonların 7 günlük kapsaması.',
      },
    },
    async (request, reply) => {
      const reports = await guard(request, reply)
      if (!reports) return reply
      try {
        const at = now()
        const [list, stations] = await Promise.all([reports.list(at), reports.stations()])
        return {
          checkedAt: at.toISOString(),
          reports: list.reports.map(reportJson),
          activeId: list.activeId,
          stations: stationsJson(stations),
        }
      } catch (error) {
        return failed(request, reply, error)
      }
    },
  )

  app.get(
    `${ARRIVAL_COVERAGE_REPORTS_PATH}/:id`,
    {
      attachValidation: true,
      schema: {
        tags: ['admin'],
        summary: 'Kapsama raporu',
        description: 'Rapor, sonucu (JSON) ve Markdown metni.',
        params: idParams,
      },
    },
    async (request, reply) => {
      const reports = await guard(request, reply)
      if (!reports) return reply
      try {
        const at = now()
        const report = await loadReport(request, reply, reports, at)
        if (!report) return reply
        const detail: ArrivalCoverageReportDetailJson = {
          ...reportJson(report),
          result: report.result,
          markdown: report.markdown,
          checkedAt: at.toISOString(),
        }
        return detail
      } catch (error) {
        return failed(request, reply, error)
      }
    },
  )

  app.get(
    `${ARRIVAL_COVERAGE_REPORTS_PATH}/:id/markdown`,
    {
      attachValidation: true,
      schema: {
        tags: ['admin'],
        summary: 'Kapsama raporunu indir (.md)',
        description:
          'text/markdown eki, adı `kapsama-<YYYYMMDD>T<HHmm>Z.md` (pencere sonu, UTC). Rapor hazır değilse 409.',
        params: idParams,
      },
    },
    async (request, reply) => {
      const reports = await guard(request, reply)
      if (!reports) return reply
      try {
        const report = await loadReport(request, reply, reports)
        if (!report) return reply
        if (report.status !== 'done' || report.markdown === null) {
          return reply
            .code(409)
            .send({ ...ARRIVAL_COVERAGE_ERRORS.notReady, status: report.status })
        }
        const name = arrivalCoverageFileName(
          report.windowEnd ?? report.finishedAt ?? report.requestedAt,
        )
        return reply
          .type('text/markdown; charset=utf-8')
          .header('content-disposition', `attachment; filename="${name}"`)
          .header('x-content-type-options', 'nosniff')
          .send(report.markdown)
      } catch (error) {
        return failed(request, reply, error)
      }
    },
  )
}
