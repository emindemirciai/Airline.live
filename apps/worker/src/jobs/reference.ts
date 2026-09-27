import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  getReferenceSource,
  recordReferenceCheck,
  recordReferenceError,
  syncAirlines,
  syncOurAirports,
  type AirlineInsert,
  type AirportInsert,
  type Database,
  type ReferenceOrigin,
  type ReferenceSourceId,
  type RunwayInsert,
  type SyncCounts,
} from '@havayolu/db'
import {
  OURAIRPORTS_URLS,
  parseAirlines,
  parseAirports,
  parseRunways,
  VRS_AIRLINES_URL,
  type RunwayRow,
  type SkippedRow,
} from '@havayolu/providers'
import { errorMessage } from '@havayolu/shared'
import type { Logger } from 'pino'

/**
 * Referans verisi içe aktarımı (data-sources.md §3–4): OurAirports havalimanı + pist ve VRS
 * havayolları. Günlük çalışır; ETag / Last-Modified ile değişmeyen dosya indirilmez.
 * EXTERNAL_PROVIDERS_DISABLED iken (yerel geliştirme, test) `tools/fixtures/` kullanılır.
 */

export const REFERENCE_URLS: Record<ReferenceSourceId, string> = {
  'ourairports-airports': OURAIRPORTS_URLS.airports,
  'ourairports-runways': OURAIRPORTS_URLS.runways,
  'vrs-airlines': VRS_AIRLINES_URL,
}

const FIXTURE_FILES: Record<ReferenceSourceId, string> = {
  'ourairports-airports': 'ourairports/airports.csv',
  'ourairports-runways': 'ourairports/runways.csv',
  'vrs-airlines': 'vrs/airlines.csv',
}

/** Bir kaynak dosyasının bu indirmede aldığı yanıt. */
export type FetchedFile =
  | { status: 'not_modified' }
  | { status: 'ok'; body: string; etag: string | null; lastModified: string | null }

export interface Validators {
  etag: string | null
  lastModified: string | null
}

/** `validators` verilirse koşullu indirir; değişmediyse `not_modified` döner. */
export type ReferenceFetcher = (
  source: ReferenceSourceId,
  validators: Validators | null,
) => Promise<FetchedFile>

/** Beklenen en büyük dosya ~13 MB (airports.csv); bunun çok üstü hatalı yanıt sayılır. */
export const MAX_REFERENCE_BYTES = 64 * 1024 * 1024
export const REFERENCE_TIMEOUT_MS = 60_000

export class ReferenceFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReferenceFetchError'
  }
}

/** HTTP indirici: tanımlayıcı User-Agent, zaman aşımı, boyut sınırı, koşullu istek. */
export function httpFetcher(options: {
  userAgent: string
  fetch?: typeof globalThis.fetch
  urls?: Record<ReferenceSourceId, string>
  timeoutMs?: number
}): ReferenceFetcher {
  const doFetch = options.fetch ?? globalThis.fetch
  const urls = options.urls ?? REFERENCE_URLS
  return async (source, validators) => {
    const headers: Record<string, string> = {
      'user-agent': options.userAgent,
      accept: 'text/csv, text/plain;q=0.9, */*;q=0.1',
    }
    if (validators?.etag) headers['if-none-match'] = validators.etag
    if (validators?.lastModified) headers['if-modified-since'] = validators.lastModified
    const response = await doFetch(urls[source], {
      headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? REFERENCE_TIMEOUT_MS),
    })
    if (response.status === 304) return { status: 'not_modified' }
    if (response.status !== 200) {
      await response.body?.cancel()
      throw new ReferenceFetchError(`${source}: HTTP ${response.status}`)
    }
    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_REFERENCE_BYTES) {
      await response.body?.cancel()
      throw new ReferenceFetchError(`${source}: dosya beklenenden büyük (${length} bayt)`)
    }
    const body = await response.text()
    if (body.length > MAX_REFERENCE_BYTES) {
      throw new ReferenceFetchError(`${source}: dosya beklenenden büyük`)
    }
    return {
      status: 'ok',
      body,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    }
  }
}

/**
 * Commit'li alt kümeden okur. ETag içerik özetidir; dosya değişmediyse `not_modified` döner, böylece
 * yerelde de değişmeyen veri yeniden yazılmaz.
 */
export function fixtureFetcher(dir: string): ReferenceFetcher {
  return async (source, validators) => {
    const body = readFileSync(join(dir, FIXTURE_FILES[source]), 'utf8')
    const etag = `"fixture-${createHash('sha1').update(body).digest('hex')}"`
    if (validators?.etag === etag) return { status: 'not_modified' }
    return { status: 'ok', body, etag, lastModified: null }
  }
}

/** Yerel geliştirmede repo kökündeki `tools/fixtures`; bulunamazsa null (ör. üretim imajı). */
export function findFixturesDir(startDir: string = process.cwd()): string | null {
  for (let dir = startDir; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      const fixtures = join(dir, 'tools', 'fixtures')
      return existsSync(fixtures) ? fixtures : null
    }
    if (dirname(dir) === dir) return null
  }
}

export interface ReferenceImportDeps {
  db: Database['db']
  fetcher: ReferenceFetcher
  origin: ReferenceOrigin
  log: Logger
  now?: () => Date
}

export interface SourceOutcome {
  status: 'imported' | 'not_modified' | 'failed'
  counts?: Record<string, SyncCounts>
  skipped?: number
  error?: string
}

export interface ReferenceImportResult {
  ourairports: SourceOutcome
  airlines: SourceOutcome
}

/** Hata metni: Drizzle'ın sorgu iletisi yerine asıl PostgreSQL sebebi (packages/shared). */
export const errorText = (error: unknown): string => errorMessage(error)

function logSkipped(log: Logger, source: ReferenceSourceId, skipped: SkippedRow[]) {
  if (skipped.length === 0) return
  log.warn(
    { source, skipped: skipped.length, examples: skipped.slice(0, 10) },
    'referans verisinde hatalı satırlar atlandı',
  )
}

/** Ayrıştırılmış pist → tablo satırı (uçlar `le_*` / `he_*` sütunlarına açılır). */
export function runwayInsert(row: RunwayRow): RunwayInsert {
  const { le, he } = row
  return {
    id: row.id,
    airportId: row.airportId,
    airportIdent: row.airportIdent,
    lengthFt: row.lengthFt,
    widthFt: row.widthFt,
    surface: row.surface,
    lighted: row.lighted,
    endsAreThresholds: row.endsAreThresholds,
    leIdent: le.ident,
    leLatitudeDeg: le.latitudeDeg,
    leLongitudeDeg: le.longitudeDeg,
    leElevationFt: le.elevationFt,
    leHeadingDegT: le.headingDegT,
    leDisplacedThresholdFt: le.displacedThresholdFt,
    leTrueBearingDeg: le.trueBearingDeg,
    leBearingSource: le.bearingSource,
    leHeadingMismatch: le.headingMismatch,
    leThresholdLat: le.thresholdLat,
    leThresholdLon: le.thresholdLon,
    leThresholdSource: le.thresholdSource,
    heIdent: he.ident,
    heLatitudeDeg: he.latitudeDeg,
    heLongitudeDeg: he.longitudeDeg,
    heElevationFt: he.elevationFt,
    heHeadingDegT: he.headingDegT,
    heDisplacedThresholdFt: he.displacedThresholdFt,
    heTrueBearingDeg: he.trueBearingDeg,
    heBearingSource: he.bearingSource,
    heHeadingMismatch: he.headingMismatch,
    heThresholdLat: he.thresholdLat,
    heThresholdLon: he.thresholdLon,
    heThresholdSource: he.thresholdSource,
    rowHash: row.rowHash,
  }
}

/** Hata kaydı yazılamasa bile (ör. veritabanı kapalı) asıl hata kaybolmasın. */
async function recordFailure(
  deps: ReferenceImportDeps,
  ids: readonly ReferenceSourceId[],
  now: Date,
  error: unknown,
) {
  for (const id of ids) {
    try {
      await recordReferenceError(deps.db, id, { origin: deps.origin, now, error: errorText(error) })
    } catch (recordError) {
      deps.log.error({ err: recordError, source: id }, 'referans hata kaydı yazılamadı')
    }
  }
}

async function validatorsFor(
  db: Database['db'],
  source: ReferenceSourceId,
): Promise<Validators | null> {
  const state = await getReferenceSource(db, source)
  // Son içe aktarım başarılıysa koşullu indirilir; hiç içe aktarılmadıysa tam indirilir.
  if (!state?.importedAt) return null
  return { etag: state.etag, lastModified: state.lastModified }
}

/**
 * Havalimanı ve pist dosyaları birlikte işlenir: biri değiştiyse diğeri de (koşulsuz) indirilir;
 * pist eşikleri havalimanı merkezine düşebildiği ve pistler havalimanına bağlı olduğu için ikisi
 * tek işlemde yazılır.
 */
async function importOurAirports(deps: ReferenceImportDeps, now: Date): Promise<SourceOutcome> {
  const { db, fetcher, origin, log } = deps
  const ids = ['ourairports-airports', 'ourairports-runways'] as const
  try {
    let [airportsFile, runwaysFile] = await Promise.all(
      ids.map(async (id) => fetcher(id, await validatorsFor(db, id))),
    )
    if (airportsFile?.status === 'not_modified' && runwaysFile?.status === 'not_modified') {
      for (const id of ids) {
        const state = await getReferenceSource(db, id)
        await recordReferenceCheck(db, id, {
          origin,
          now,
          etag: state?.etag ?? null,
          lastModified: state?.lastModified ?? null,
          imported: null,
        })
      }
      return { status: 'not_modified' }
    }
    if (airportsFile?.status !== 'ok') airportsFile = await fetcher('ourairports-airports', null)
    if (runwaysFile?.status !== 'ok') runwaysFile = await fetcher('ourairports-runways', null)
    if (airportsFile.status !== 'ok' || runwaysFile.status !== 'ok') {
      throw new ReferenceFetchError('koşulsuz indirme 304 döndü')
    }

    const airports = parseAirports(airportsFile.body)
    logSkipped(log, 'ourairports-airports', airports.skipped)
    const arps = new Map(
      airports.rows.map((a) => [a.id, { lat: a.latitudeDeg, lon: a.longitudeDeg }] as const),
    )
    const runways = parseRunways(runwaysFile.body, arps)
    logSkipped(log, 'ourairports-runways', runways.skipped)

    const counts = await syncOurAirports(db, {
      airports: airports.rows satisfies AirportInsert[],
      runways: runways.rows.map(runwayInsert),
    })
    const files = { 'ourairports-airports': airportsFile, 'ourairports-runways': runwaysFile }
    const parsed = { 'ourairports-airports': airports, 'ourairports-runways': runways }
    for (const id of ids) {
      await recordReferenceCheck(db, id, {
        origin,
        now,
        etag: files[id].etag,
        lastModified: files[id].lastModified,
        imported: { rowCount: parsed[id].rows.length, skippedCount: parsed[id].skipped.length },
      })
    }
    return {
      status: 'imported',
      counts,
      skipped: airports.skipped.length + runways.skipped.length,
    }
  } catch (error) {
    await recordFailure(deps, ids, now, error)
    return { status: 'failed', error: errorText(error) }
  }
}

async function importAirlines(deps: ReferenceImportDeps, now: Date): Promise<SourceOutcome> {
  const { db, fetcher, origin, log } = deps
  const id = 'vrs-airlines' as const
  try {
    const file = await fetcher(id, await validatorsFor(db, id))
    if (file.status === 'not_modified') {
      const state = await getReferenceSource(db, id)
      await recordReferenceCheck(db, id, {
        origin,
        now,
        etag: state?.etag ?? null,
        lastModified: state?.lastModified ?? null,
        imported: null,
      })
      return { status: 'not_modified' }
    }
    const airlines = parseAirlines(file.body)
    logSkipped(log, id, airlines.skipped)
    const counts = await syncAirlines(db, airlines.rows satisfies AirlineInsert[])
    await recordReferenceCheck(db, id, {
      origin,
      now,
      etag: file.etag,
      lastModified: file.lastModified,
      imported: { rowCount: airlines.rows.length, skippedCount: airlines.skipped.length },
    })
    return { status: 'imported', counts: { airlines: counts }, skipped: airlines.skipped.length }
  } catch (error) {
    await recordFailure(deps, [id], now, error)
    return { status: 'failed', error: errorText(error) }
  }
}

/** İki kaynak birbirinden bağımsızdır; biri başarısız olursa diğeri yine içe aktarılır. */
export async function runReferenceImport(
  deps: ReferenceImportDeps,
): Promise<ReferenceImportResult> {
  const now = (deps.now ?? (() => new Date()))()
  const ourairports = await importOurAirports(deps, now)
  const airlines = await importAirlines(deps, now)
  return { ourairports, airlines }
}
