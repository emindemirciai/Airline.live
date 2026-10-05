import { format } from '@havayolu/i18n'
import { ARRIVAL_COVERAGE_HOURS, type ArrivalCoverageHours, type Locale } from '@havayolu/shared'
import { z } from 'zod'

/**
 * Admin kapsama raporu sayfasının (`/admin/kapsama`, Parça 1 M7b.2, D-098) saf yardımcıları: rapor
 * kimliği ve saat denetimi, API yanıt şemaları, sonuç özeti, bağlantılar ve biçimlendirme. Sunucu ve
 * istemci bileşenleri ile indirme ucu (`/admin/kapsama/indir`) bunları paylaşır.
 */

export const COVERAGE_PAGE_PATH = '/admin/kapsama'
export const COVERAGE_DOWNLOAD_PATH = '/admin/kapsama/indir'
/** API uç noktası (`apps/api/src/admin/arrival-coverage.ts`). */
export const COVERAGE_API_PATH = '/v1/admin/arrival-coverage/reports'
/** Rapor kimliği: 1 ile başlayan en çok 18 hane (API ile aynı kural). */
export const COVERAGE_REPORT_ID = /^[1-9][0-9]{0,17}$/
/** İndirilen dosyanın adı: `kapsama-<YYYYMMDD>T<HHmm>Z.md` (UTC, `:` yok). */
export const COVERAGE_FILE_NAME = /^kapsama-\d{8}T\d{4}Z\.md$/
/** Formdaki varsayılan pencere (saat). */
export const COVERAGE_DEFAULT_HOURS: ArrivalCoverageHours = 24

const ALLOWED_HOURS: readonly number[] = ARRIVAL_COVERAGE_HOURS

/**
 * Sorgudaki `rapor` değeri; biçim dışıysa null. Kimlik metin olarak kalır (18 haneli değer
 * `Number`'a sığmaz) ve API yoluna `encodeURIComponent` ile girer.
 */
export function parseCoverageReportId(value: unknown): string | null {
  return typeof value === 'string' && COVERAGE_REPORT_ID.test(value) ? value : null
}

/** Formdaki `hours` alanı: yalnızca 6, 12, 24, 48, 72 ya da 168 (ondalık ve boşluk yok). */
export function parseCoverageHours(value: unknown): ArrivalCoverageHours | null {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,2}$/.test(value)) return null
  const hours = Number(value)
  return ALLOWED_HOURS.includes(hours) ? (hours as ArrivalCoverageHours) : null
}

/** API'deki rapor yolu; kimlik yüzde kodlanır. */
export function coverageApiPath(id: string, part: 'detail' | 'markdown' = 'detail'): string {
  const base = `${COVERAGE_API_PATH}/${encodeURIComponent(id)}`
  return part === 'markdown' ? `${base}/markdown` : base
}

export function coverageReportHref(id: string | number): string {
  return `${COVERAGE_PAGE_PATH}?rapor=${encodeURIComponent(String(id))}`
}

export function coverageDownloadHref(id: string | number): string {
  return `${COVERAGE_DOWNLOAD_PATH}?rapor=${encodeURIComponent(String(id))}`
}

/**
 * API'nin `Content-Disposition` başlığındaki dosya adı; `kapsama-<YYYYMMDD>T<HHmm>Z.md` değilse
 * null (indirme ucu adı olduğu gibi aktarmaz).
 */
export function coverageAttachmentName(contentDisposition: string | null): string | null {
  const match = /^attachment;\s*filename="([^"]*)"$/i.exec(contentDisposition?.trim() ?? '')
  const name = match?.[1]
  return name !== undefined && COVERAGE_FILE_NAME.test(name) ? name : null
}

// ---------------------------------------------------------------------------------------------
// API yanıt şemaları

export const COVERAGE_STATUSES = ['queued', 'running', 'done', 'failed'] as const
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number]

const isoTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)))

export const CoverageReportSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(COVERAGE_STATUSES),
  hours: z.number().int().positive(),
  requestedAt: isoTime,
  startedAt: isoTime.nullable(),
  finishedAt: isoTime.nullable(),
  windowStart: isoTime.nullable(),
  windowEnd: isoTime.nullable(),
  error: z.string().nullable(),
  definitionVersion: z.number().int().nullable(),
})
export type CoverageReport = z.infer<typeof CoverageReportSchema>

export const CoverageStationSchema = z.object({
  icao: z.string(),
  iata: z.string(),
  isPrimary: z.boolean(),
  ratio7d: z.number().nullable(),
  arrivals7d: z.number().int().nullable(),
  updatedAt: isoTime.nullable(),
})
export type CoverageStation = z.infer<typeof CoverageStationSchema>

export const CoverageListSchema = z.object({
  /** API'nin etkin durumu hesapladığı an; çalışan raporun süresi buna göre yazılır. */
  checkedAt: isoTime,
  reports: z.array(CoverageReportSchema),
  activeId: z.number().int().positive().nullable(),
  stations: z.array(CoverageStationSchema),
})
export type CoverageList = z.infer<typeof CoverageListSchema>

export const CoverageDetailSchema = CoverageReportSchema.extend({
  result: z.unknown(),
  markdown: z.string().nullable(),
  checkedAt: isoTime,
})
export type CoverageDetail = z.infer<typeof CoverageDetailSchema>

// ---------------------------------------------------------------------------------------------
// Sonuç özeti (`@havayolu/shared` `ArrivalCoverageResult`'ın sayfada gösterilen alt kümesi)

const RuleSchema = z.object({
  verdict: z.enum(['applies', 'does_not_apply', 'no_arrivals']),
  borderline: z.boolean(),
  lowSample: z.boolean(),
})
export type CoverageRule = z.infer<typeof RuleSchema>

const StationResultSchema = z.object({
  icao: z.string(),
  iata: z.string(),
  arrivals: z.number(),
  openRecordArrivals: z.number(),
  groundSeen: z.number(),
  groundShare: z.number().nullable(),
  groundShareWilson: z.object({ low: z.number(), high: z.number() }).nullable(),
  all: z.object({
    medianAglFt: z.number().nullable(),
    medianThresholdKm: z.number().nullable(),
  }),
  rule1: RuleSchema,
  rule2: RuleSchema,
})

export const CoverageResultSummarySchema = z.object({
  definitionVersion: z.number(),
  window: z.object({ start: isoTime, end: isoTime, hours: z.number() }),
  effectiveStart: isoTime.nullable(),
  dataGapWarning: z.boolean(),
  stations: z.array(StationResultSchema),
  totals: z.object({
    arrivals: z.number(),
    groundSeen: z.number(),
    openRecordArrivals: z.number(),
  }),
})
export type CoverageResultSummary = z.infer<typeof CoverageResultSummarySchema>

/** Raporun sonucundan sayfadaki özet; sonuç yoksa ya da biçimi tanınmıyorsa null. */
export function coverageResultSummary(result: unknown): CoverageResultSummary | null {
  const parsed = CoverageResultSummarySchema.safeParse(result)
  return parsed.success ? parsed.data : null
}

// ---------------------------------------------------------------------------------------------
// Biçimlendirme

const localeTag = (locale: Locale) => (locale === 'tr' ? 'tr-TR' : 'en-GB')

/** UTC tarih ve saat, dakikaya kadar (`06.10.2026 11:15`). */
export function formatCoverageTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

export function formatCoveragePercent(share: number, locale: Locale): string {
  return new Intl.NumberFormat(localeTag(locale), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(share)
}

export function formatCoverageNumber(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: digits }).format(value)
}

/**
 * Raporun süresi (ms): bitmişse başlangıçtan bitişe, çalışıyorsa başlangıçtan şimdiye; başlamamışsa
 * null. Bitişi bilinmeyen başarısız rapor (API zaman aşımı anını vermediyse) için de null: süre
 * "şimdi"ye göre büyümeye devam etmez.
 */
export function coverageDurationMs(report: CoverageReport, nowMs: number): number | null {
  if (report.startedAt === null) return null
  if (report.finishedAt === null && report.status === 'failed') return null
  const start = Date.parse(report.startedAt)
  const end = report.finishedAt === null ? nowMs : Date.parse(report.finishedAt)
  return Math.max(0, end - start)
}

/**
 * Otomatik yenilemenin izlediği etkin rapor (sayfa, sunucu tarafı). Liste alındıysa API'nin etkin
 * raporu (yoksa null). Alınamadıysa seçili rapor kuyrukta ya da çalışıyorsa onun kimliği; o da
 * yoksa `undefined` ("bilinmiyor": istemci bileşeni son bilinen etkin raporu korur).
 */
export function coverageRefreshActiveId(
  list: { ok: true; list: Pick<CoverageList, 'activeId'> } | { ok: false },
  detail: { ok: true; report: Pick<CoverageReport, 'id' | 'status'> } | { ok: false } | null,
): number | null | undefined {
  if (list.ok) return list.list.activeId
  if (detail?.ok && (detail.report.status === 'queued' || detail.report.status === 'running')) {
    return detail.report.id
  }
  return undefined
}

/** Hata sütunu: bilinen kodlar çevrilir, diğer ileti olduğu gibi (`other`) gösterilir. */
export function coverageFailureText(
  error: string | null,
  labels: { timeout_queued: string; timeout_running: string; other: string },
): string | null {
  if (error === null || error.trim() === '') return null
  if (error === 'timeout_queued') return labels.timeout_queued
  if (error === 'timeout_running') return labels.timeout_running
  return format(labels.other, { message: error })
}
