import {
  createRedis,
  maintainTrackPartitions,
  readListingDrift,
  referenceStatus,
  type Database,
  type ReferenceOrigin,
} from '@havayolu/db'
import {
  assertProvidersAllowed,
  createAviationWeatherClient,
  PROVIDER_LICENSES,
  providerUserAgent,
} from '@havayolu/providers'
import { AIRPORT_RING_CONFIG } from '@havayolu/shared'
import {
  Queue,
  UnrecoverableError,
  Worker,
  type Job,
  type JobSchedulerTemplateOptions,
} from 'bullmq'
import type { Logger } from 'pino'
import type { Env } from '../env'
import {
  ARRIVAL_COVERAGE_POLL_INTERVAL_MS,
  createExclusiveRunner,
  createStartupGate,
  startArrivalCoveragePoller,
  type ExclusiveRunner,
} from './arrival-coverage/poll'
import {
  arrivalCoverageFailure,
  arrivalCoverageRatioRetryable,
  runArrivalCoverageRatio7d,
  runNextArrivalCoverageReport,
} from './arrival-coverage/run'
import {
  findFixturesDir,
  fixtureFetcher,
  httpFetcher,
  runReferenceImport,
  type ReferenceFetcher,
} from './reference'
import {
  awcWeatherSource,
  databaseWeatherStore,
  recordWeatherSourcesDisabled,
  runWeatherMetar,
  runWeatherPrune,
  runWeatherTaf,
  type WeatherRunResult,
  type WeatherSource,
} from './weather'
import { FIXTURE_APP_ENVS, fixtureWeatherSource, weatherFixturesDir } from './weather-fixture'

/**
 * `jobs` rolü: bakım ve hava durumu işleri BullMQ job scheduler'larıyla (`upsertJobScheduler`;
 * `repeat` v6'da yok). Zamanlar UTC'dir. Aynı zamanlayıcıyı birden fazla süreç kaydetse de tek iş
 * üretilir. Kuyruk tek eşzamanlıdır: uzun bir referans içe aktarımı hava durumu işini birkaç dakika
 * geciktirebilir; zamanlayıcı başına tek "sıradaki" iş tutulduğu için işler birikmez.
 */
export const MAINTENANCE_QUEUE = 'maintenance'
/** Redis anahtarları projenin `hy:` önekiyle başlar. */
export const QUEUE_PREFIX = 'hy:bull'

export const JOB_NAMES = {
  trackPartitions: 'track-partitions',
  referenceImport: 'reference-import',
  weatherMetar: 'weather-metar',
  weatherTaf: 'weather-taf',
  weatherPrune: 'weather-prune',
} as const
export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES]

export const JOB_SCHEDULES: Record<
  JobName,
  { pattern: string; tz: 'UTC'; opts: JobSchedulerTemplateOptions }
> = {
  // 03:15 TSİ: saklama süresi dolanları sil, 7 gün ilerisini aç (infra.md → Partition bakımı).
  'track-partitions': {
    pattern: '15 0 * * *',
    tz: 'UTC',
    opts: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  },
  // 07:40 TSİ: OurAirports gece yenilenir; VRS günlük (data-sources.md §3–4).
  'reference-import': {
    pattern: '40 4 * * *',
    tz: 'UTC',
    opts: { attempts: 3, backoff: { type: 'exponential', delay: 5 * 60_000 } },
  },
  // METAR 5 dk'da bir (:01, :06 …); Türk METAR'ları yarım saatte ya da saatte bir yayımlanır.
  // Yeniden deneme 60 sn sonra tek kez (NWS: denemeler arası en az 1 dk). D-078.
  'weather-metar': {
    pattern: '1-59/5 * * * *',
    tz: 'UTC',
    opts: { attempts: 2, backoff: { type: 'fixed', delay: 60_000 } },
  },
  // TAF 15 dk'da bir (:03, :18 …): düzeltilmiş tahmin (AMD) en geç 15 dk'da görünür.
  'weather-taf': {
    pattern: '3-59/15 * * * *',
    tz: 'UTC',
    opts: { attempts: 2, backoff: { type: 'fixed', delay: 60_000 } },
  },
  // 03:25 TSİ: 30 günden eski METAR/TAF ve listeden çıkan istasyonlar silinir.
  'weather-prune': {
    pattern: '25 0 * * *',
    tz: 'UTC',
    opts: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
  },
}

/**
 * Kapsama raporu (M7b.2, D-098): rapor istekleri BullMQ'ya girmez, tablodan yoklanır
 * (`arrival-coverage/poll.ts`). Günlük 7 günlük oran işi ayrı, tek eşzamanlı bir kuyruktadır;
 * uzun okuma bakım kuyruğundaki METAR işini geciktirmez. Rapor, oran işi ve iz partition bakımı
 * aynı süreçte sıraya girer (`createExclusiveRunner`): partition DDL'i (`CREATE TABLE … PARTITION
 * OF`, `DETACH PARTITION`) üst tabloda ACCESS EXCLUSIVE kilidi ister ve kapsama okuması 60 sn'ye
 * kadar ACCESS SHARE tutar; ikisi çakışsaydı bekleyen DDL ingest'in iz yazmalarını da bekletirdi.
 * Kapsama işleri ayrıca açılıştaki iz partition işi bitince başlar.
 */
export const ARRIVAL_COVERAGE_QUEUE = 'arrival-coverage'

export const ARRIVAL_COVERAGE_JOB_NAMES = {
  ratio7d: 'arrival-coverage-ratio-7d',
} as const
export type ArrivalCoverageJobName =
  (typeof ARRIVAL_COVERAGE_JOB_NAMES)[keyof typeof ARRIVAL_COVERAGE_JOB_NAMES]

export const ARRIVAL_COVERAGE_SCHEDULES: Record<
  ArrivalCoverageJobName,
  { pattern: string; tz: 'UTC'; opts: JobSchedulerTemplateOptions }
> = {
  // 03:45 TSİ: iz partition bakımından (00:15) ve hava durumu temizliğinden (00:25) sonra.
  'arrival-coverage-ratio-7d': {
    pattern: '45 0 * * *',
    tz: 'UTC',
    opts: { attempts: 3, backoff: { type: 'exponential', delay: 5 * 60_000 } },
  },
}

/** Açılış partition işi bu sürede bitmezse (ya da başka süreçte işlendiyse) yoklama yine başlar. */
export const ARRIVAL_COVERAGE_STARTUP_GATE_MAX_MS = 10 * 60_000

/**
 * Zamanlayıcı tanımının sürümü. Tanım (zaman, deneme ayarları) değişince artırılır; aynı sürümdeki
 * zamanlayıcıya açılışta dokunulmaz, çünkü upsert zamanı geçmiş ama henüz işlenmemiş işi siler.
 */
export const SCHEDULE_REVISION = 1
/** Kapanışta kuyruğun temiz kapanması için beklenen en uzun süre; sonra bağlantılar kesilir. */
export const JOBS_CLOSE_TIMEOUT_MS = 8_000
/** Son başarılı referans kontrolü bundan eskiyse açılışta hemen yeni bir içe aktarım istenir. */
export const REFERENCE_CATCH_UP_MS = 24 * 3_600_000

const KEEP_JOBS = {
  removeOnComplete: { age: 7 * 86_400, count: 100 },
  removeOnFail: { age: 30 * 86_400, count: 200 },
}

export type ReferenceMode =
  | { kind: 'remote'; origin: ReferenceOrigin; fetcher: ReferenceFetcher }
  | { kind: 'fixture'; origin: ReferenceOrigin; fetcher: ReferenceFetcher; dir: string }
  | { kind: 'disabled'; reason: string }

/** Dış istek kapalıysa yalnızca yerelde fixture kullanılır; üretim imajında fixture yoktur. */
export function referenceMode(
  env: Env,
  version: string,
  fixturesDir = findFixturesDir(),
): ReferenceMode {
  try {
    assertProvidersAllowed(env.DATA_USAGE_MODE, [
      PROVIDER_LICENSES.ourAirports,
      PROVIDER_LICENSES.vrsStandingData,
    ])
  } catch (error) {
    return { kind: 'disabled', reason: error instanceof Error ? error.message : String(error) }
  }
  if (!env.EXTERNAL_PROVIDERS_DISABLED) {
    return {
      kind: 'remote',
      origin: 'remote',
      fetcher: httpFetcher({ userAgent: userAgent(env, version) }),
    }
  }
  if (env.APP_ENV !== 'production' && fixturesDir) {
    return {
      kind: 'fixture',
      origin: 'fixture',
      fetcher: fixtureFetcher(fixturesDir),
      dir: fixturesDir,
    }
  }
  return {
    kind: 'disabled',
    reason: "EXTERNAL_PROVIDERS_DISABLED=true ve commit'li fixture yok (üretim imajı)",
  }
}

export type WeatherMode =
  | { kind: 'remote'; origin: 'remote'; source: WeatherSource }
  | { kind: 'fixture'; origin: 'fixture'; source: WeatherSource; dir: string }
  | { kind: 'disabled'; reason: string }

/**
 * Hava durumu kaynağı (D-078): dış istek açıksa aviationweather.gov; kapalıysa yalnızca APP_ENV
 * development ya da test iken commit'li, zamanı kaydırılan fixture; diğer durumlarda kapalı
 * (nedeniyle; admin satırı "yapılandırılmamış" gösterir).
 */
export function weatherMode(
  env: Env,
  version: string,
  fixturesDir = findFixturesDir(),
  now?: () => Date,
): WeatherMode {
  try {
    assertProvidersAllowed(env.DATA_USAGE_MODE, [PROVIDER_LICENSES.aviationWeather])
  } catch (error) {
    return { kind: 'disabled', reason: error instanceof Error ? error.message : String(error) }
  }
  if (!env.EXTERNAL_PROVIDERS_DISABLED) {
    return {
      kind: 'remote',
      origin: 'remote',
      source: awcWeatherSource(createAviationWeatherClient({ userAgent: userAgent(env, version) })),
    }
  }
  const dir = weatherFixturesDir(fixturesDir)
  if ((FIXTURE_APP_ENVS as readonly string[]).includes(env.APP_ENV) && dir) {
    return {
      kind: 'fixture',
      origin: 'fixture',
      source: fixtureWeatherSource({ dir, appEnv: env.APP_ENV, ...(now ? { now } : {}) }),
      dir,
    }
  }
  return {
    kind: 'disabled',
    reason:
      "EXTERNAL_PROVIDERS_DISABLED=true ve commit'li hava durumu fixture'ı yok (üretim imajı)",
  }
}

/** Kaynak sahiplerinin bizi tanıyabilmesi için açık User-Agent (Node'un varsayılanı değil). */
export function userAgent(
  env: Pick<Env, 'APP_NAME' | 'WEB_HOST' | 'CONTACT_EMAIL'>,
  version: string,
) {
  return providerUserAgent({
    appName: env.APP_NAME,
    version,
    webHost: env.WEB_HOST,
    contactEmail: env.CONTACT_EMAIL,
  })
}

/** PostgreSQL "tablo yok" hatası: yerelde migration çalıştırılmamış. */
function explain(error: unknown): Error {
  if ((error as { code?: string }).code === '42P01') {
    return new Error('veritabanı tabloları yok; önce `pnpm db:migrate` çalıştır')
  }
  return error instanceof Error ? error : new Error(String(error))
}

export interface JobsDeps {
  env: Env
  redisUrl: string
  database: Database
  log: Logger
  version: string
  now?: () => Date
  /** Redis anahtar öneki; testler kendi önekini verir. */
  prefix?: string
  /** Kapsama raporu yoklama aralığı (varsayılan 10 sn); testler kısaltır. */
  arrivalCoveragePollMs?: number
  /**
   * Kapsama okumalarını ve iz partition bakımını sıraya koyan çalıştırıcı (varsayılan yeni bir
   * `createExclusiveRunner`); testler sırayı gözlemlemek için kendi çalıştırıcısını verir.
   */
  coverageExclusive?: ExclusiveRunner
}

export interface JobsHandle {
  close: () => Promise<void>
}

export async function startJobs({
  env,
  redisUrl,
  database,
  log,
  version,
  now = () => new Date(),
  prefix = QUEUE_PREFIX,
  arrivalCoveragePollMs = ARRIVAL_COVERAGE_POLL_INTERVAL_MS,
  coverageExclusive,
}: JobsDeps): Promise<JobsHandle> {
  const mode = referenceMode(env, version)
  if (mode.kind === 'disabled') log.warn({ reason: mode.reason }, 'referans içe aktarımı kapalı')
  else log.info({ mode: mode.kind }, 'referans içe aktarımı hazır')

  const weather = weatherMode(env, version, undefined, now)
  const weatherStore = databaseWeatherStore(database)
  /** METAR kaydı denetlenmiş ya da doldurulmuş istasyonlar; süreç boyunca (runWeatherMetar). */
  const metarBackfilled = new Set<string>()
  if (weather.kind === 'disabled') {
    log.warn({ reason: weather.reason }, 'hava durumu (METAR/TAF) kapalı')
    await recordWeatherSourcesDisabled(weatherStore, weather.reason, log)
  } else {
    log.info({ mode: weather.kind }, 'hava durumu (METAR/TAF) hazır')
  }
  /** Yazılan ya da güncellenen rapor varsa info, yoksa debug (5 dk'da bir iş log'u boğmasın). */
  const logWeather = (job: string, result: WeatherRunResult) => {
    const changed = 'written' in result && result.written.inserted + result.written.updated > 0
    if (changed) log.info({ job, result }, 'hava durumu güncellendi')
    else log.debug({ job, result }, 'hava durumu kontrol edildi')
  }

  const retentionDays = {
    track_points_sampled: env.TRACK_SAMPLED_RETENTION_DAYS,
    track_points_fine: env.TRACK_FINE_RETENTION_DAYS,
  }

  // Kapsama raporu ve günlük oran işi açılış partition işinden sonra başlar. Rapor, oran işi ve
  // iz partition bakımı aynı çalıştırıcıda sıraya girer: DDL kapsama okumasıyla çakışmaz. Kapsama
  // işleri kapıyı çalıştırıcının dışında bekler, bu yüzden açılıştaki partition işi kilitlenmez.
  const coverageGate = createStartupGate({
    maxWaitMs: ARRIVAL_COVERAGE_STARTUP_GATE_MAX_MS,
    onOpen: (reason) => log.info({ reason }, 'arrival coverage jobs enabled'),
  })
  const exclusive = coverageExclusive ?? createExclusiveRunner()
  const shutdown = new AbortController()

  const processor = async (job: Job) => {
    try {
      if (job.name === JOB_NAMES.trackPartitions) {
        // Kapsama raporu sürüyorsa bakım onun bitmesini (en çok ~11 dk) bekler; bu sırada bakım
        // kuyruğundaki METAR işi de bekler. Partition'lar 7 gün önceden açıldığı için gecikme
        // ingest'i etkilemez.
        const result = await exclusive(() =>
          maintainTrackPartitions(database.sql, now(), { retentionDays }),
        )
        coverageGate.open('track-partitions')
        const defaultRows = Object.values(result.defaultRows).reduce((a, b) => a + b, 0)
        if (defaultRows > 0) {
          log.warn(
            { defaultRows: result.defaultRows },
            "DEFAULT partition'da satır var: günlük partition eksik kalmış olabilir",
          )
        }
        const summary = {
          created: result.created.length,
          dropped: result.dropped.length,
          movedRows: result.movedRows,
          purgedDefaultRows: result.purgedDefaultRows,
          defaultRows,
        }
        log.info({ ...summary, droppedNames: result.dropped }, 'iz partition bakımı tamam')
        return summary
      }
      if (job.name === JOB_NAMES.referenceImport) {
        if (mode.kind === 'disabled') return { skipped: mode.reason }
        const result = await runReferenceImport({
          db: database.db,
          fetcher: mode.fetcher,
          origin: mode.origin,
          log,
          now,
          readDrift: () => readListingDrift(database.db, AIRPORT_RING_CONFIG),
        })
        // Kayma sayımları kendi satırındadır (`referans verisi kayması`, D-109).
        const { drift: _drift, ...summary } = result
        log.info({ result: summary }, 'referans içe aktarımı bitti')
        const failed = Object.entries(result).filter(([, outcome]) => outcome.status === 'failed')
        // Başarısız kaynak varsa iş başarısız sayılır ve BullMQ geri çekilmeyle yeniden dener.
        if (failed.length > 0) {
          throw new Error(
            failed.map(([name, outcome]) => `${name}: ${outcome.error ?? 'hata'}`).join('; '),
          )
        }
        return result
      }
      if (job.name === JOB_NAMES.weatherMetar || job.name === JOB_NAMES.weatherTaf) {
        if (weather.kind === 'disabled') return { skipped: weather.reason }
        const run = job.name === JOB_NAMES.weatherMetar ? runWeatherMetar : runWeatherTaf
        const result = await run({
          store: weatherStore,
          source: weather.source,
          origin: weather.origin,
          log,
          now,
          backfilled: metarBackfilled,
        })
        logWeather(job.name, result)
        return result
      }
      if (job.name === JOB_NAMES.weatherPrune) {
        return await runWeatherPrune({ store: weatherStore, log, now })
      }
      throw new Error(`bilinmeyen iş: ${job.name}`)
    } catch (error) {
      throw explain(error)
    }
  }

  // BullMQ işleyici bağlantıları komutları sınırsız yeniden dener (infra.md: maxRetriesPerRequest null).
  const queueConnection = createRedis(redisUrl, {
    name: `${env.WORKER_SERVICE_NAME}:jobs-queue`,
    maxRetriesPerRequest: null,
  })
  const workerConnection = createRedis(redisUrl, {
    name: `${env.WORKER_SERVICE_NAME}:jobs-worker`,
    maxRetriesPerRequest: null,
  })
  const queue = new Queue(MAINTENANCE_QUEUE, { connection: queueConnection, prefix })
  const worker = new Worker(MAINTENANCE_QUEUE, processor, {
    connection: workerConnection,
    prefix,
    concurrency: 1,
    ...KEEP_JOBS,
  })
  worker.on('failed', (job, error) => {
    log.error({ job: job?.name, attempt: job?.attemptsMade, err: error }, 'bakım işi başarısız')
    // Partition işi son denemesinde de başarısız olduysa kapsama işleri beklemeden başlar.
    if (job?.name === JOB_NAMES.trackPartitions && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      coverageGate.open('track-partitions-failed')
    }
  })
  worker.on('error', (error) => log.error({ err: error }, 'bakım kuyruğu hatası'))
  queue.on('error', (error) => log.error({ err: error }, 'bakım kuyruğu hatası'))

  const coverageProcessor = async (job: Job) => {
    if (job.name !== ARRIVAL_COVERAGE_JOB_NAMES.ratio7d) {
      throw new Error(`unknown arrival coverage job: ${job.name}`)
    }
    await coverageGate.ready
    try {
      const summary = await exclusive(() =>
        runArrivalCoverageRatio7d({ sql: database.sql, now, log, signal: shutdown.signal }),
      )
      log.info({ ...summary }, 'arrival coverage 7-day ratio written')
      return summary
    } catch (error) {
      // Bütçe aşımı ve üç denemede de zaman aşımına uğrayan okuma yeniden denemeyle düzelmez; her
      // BullMQ denemesi 7 günlük taramayı baştan yapıp veritabanına 10 dk yük bindirirdi.
      if (!arrivalCoverageRatioRetryable(error)) {
        const failure = arrivalCoverageFailure(error)
        throw new UnrecoverableError(`${failure.code}: ${failure.message}`)
      }
      throw explain(error)
    }
  }
  const coverageWorkerConnection = createRedis(redisUrl, {
    name: `${env.WORKER_SERVICE_NAME}:coverage-worker`,
    maxRetriesPerRequest: null,
  })
  const coverageQueue = new Queue(ARRIVAL_COVERAGE_QUEUE, { connection: queueConnection, prefix })
  const coverageWorker = new Worker(ARRIVAL_COVERAGE_QUEUE, coverageProcessor, {
    connection: coverageWorkerConnection,
    prefix,
    concurrency: 1,
    ...KEEP_JOBS,
  })
  coverageWorker.on('failed', (job, error) => {
    log.error(
      { job: job?.name, attempt: job?.attemptsMade, err: error },
      'arrival coverage job failed',
    )
  })
  coverageWorker.on('error', (error) => log.error({ err: error }, 'arrival coverage queue error'))
  coverageQueue.on('error', (error) => log.error({ err: error }, 'arrival coverage queue error'))

  for (const [name, schedule] of Object.entries(JOB_SCHEDULES)) {
    const existing = await queue.getJobScheduler(name)
    const unchanged =
      existing?.pattern === schedule.pattern &&
      existing.tz === schedule.tz &&
      (existing.template?.data as { revision?: number } | undefined)?.revision === SCHEDULE_REVISION
    if (unchanged) continue
    await queue.upsertJobScheduler(
      name,
      { pattern: schedule.pattern, tz: schedule.tz },
      { name, data: { revision: SCHEDULE_REVISION }, opts: { ...schedule.opts, ...KEEP_JOBS } },
    )
  }
  for (const [name, schedule] of Object.entries(ARRIVAL_COVERAGE_SCHEDULES)) {
    const existing = await coverageQueue.getJobScheduler(name)
    const unchanged =
      existing?.pattern === schedule.pattern &&
      existing.tz === schedule.tz &&
      (existing.template?.data as { revision?: number } | undefined)?.revision === SCHEDULE_REVISION
    if (unchanged) continue
    await coverageQueue.upsertJobScheduler(
      name,
      { pattern: schedule.pattern, tz: schedule.tz },
      { name, data: { revision: SCHEDULE_REVISION }, opts: { ...schedule.opts, ...KEEP_JOBS } },
    )
  }

  // Telafi: süreç işin zamanında kapalıysa (yayın, yeniden başlatma) o günün işi kaçmasın.
  // Partition bakımı ucuz ve idempotenttir, her açılışta çalışır. Referans içe aktarımı tablolar
  // boşsa ya da son başarılı kontrol 24 saatten eskiyse istenir. Tekilleştirme, aynı iş kuyrukta
  // ya da çalışırken yeniden eklenmesini önler.
  await queue.add(
    JOB_NAMES.trackPartitions,
    { reason: 'startup' },
    {
      ...JOB_SCHEDULES['track-partitions'].opts,
      ...KEEP_JOBS,
      deduplication: { id: 'track-partitions-startup' },
    },
  )
  if (mode.kind !== 'disabled') {
    try {
      const status = await referenceStatus(database.db)
      const checks = status.sources.map((source) => source.checkedAt?.getTime() ?? 0)
      const oldest = checks.length === 3 ? Math.min(...checks) : 0
      const stale = now().getTime() - oldest > REFERENCE_CATCH_UP_MS
      if (status.airports === 0 || status.airlines === 0 || stale) {
        await queue.add(
          JOB_NAMES.referenceImport,
          { reason: 'catch-up' },
          {
            ...JOB_SCHEDULES['reference-import'].opts,
            ...KEEP_JOBS,
            deduplication: { id: 'reference-import-catch-up' },
          },
        )
        log.info('referans verisi boş ya da 24 saatten eski: içe aktarım istendi')
      }
    } catch (error) {
      log.warn({ err: explain(error) }, 'referans durumu okunamadı; telafi içe aktarımı atlandı')
    }
  }

  // Hava durumu açılışta hemen istenir (referans telafisinden sonra kuyruğa girer, böylece boş
  // veritabanında istasyon listesi hazır olur); bir sonraki zamanlanmış çalışma beklenmez.
  if (weather.kind !== 'disabled') {
    for (const name of [JOB_NAMES.weatherMetar, JOB_NAMES.weatherTaf] as const) {
      await queue.add(
        name,
        { reason: 'startup' },
        { ...JOB_SCHEDULES[name].opts, ...KEEP_JOBS, deduplication: { id: `${name}-startup` } },
      )
    }
  }

  // Kapsama raporu istekleri tablodan yoklanır (API BullMQ kullanmaz); tek eşzamanlı.
  const poller = startArrivalCoveragePoller({
    ready: coverageGate.ready,
    intervalMs: arrivalCoveragePollMs,
    log,
    runOnce: (signal) =>
      exclusive(async () => {
        const outcome = await runNextArrivalCoverageReport({
          sql: database.sql,
          now,
          log,
          signal,
          appVersion: version,
          fineRetentionDays: env.TRACK_FINE_RETENTION_DAYS,
        })
        return outcome.kind !== 'idle'
      }),
  })

  log.info(
    {
      schedules: [...Object.keys(JOB_SCHEDULES), ...Object.keys(ARRIVAL_COVERAGE_SCHEDULES)],
      arrivalCoveragePollMs,
    },
    'bakım işleri başladı',
  )

  const connections = [queueConnection, workerConnection, coverageWorkerConnection]
  const disconnect = () => {
    for (const connection of connections) connection.disconnect()
  }
  return {
    // Redis erişilemezken BullMQ'nun kapanışı sonsuza dek bekleyebilir (komutlar çevrimdışı
    // kuyrukta); süre dolunca bağlantılar kesilir, kapanış takılmaz. Çalışan kapsama raporu ve
    // oran işi iptal sinyaliyle bir sonraki ifade denemesinden önce durur.
    close: async () => {
      shutdown.abort()
      // Kapıyı bekleyen oran işi iptal sinyalini görüp hemen biter (yoklayıcı kapalıdır).
      coverageGate.open('shutdown')
      const graceful = (async () => {
        await poller.close()
        await coverageWorker.close()
        await worker.close()
        await coverageQueue.close()
        await queue.close()
        for (const connection of connections) await connection.quit()
        return 'closed' as const
      })().catch(() => 'failed' as const)
      const timeout = new Promise<'timeout'>((resolve) => {
        setTimeout(() => resolve('timeout'), JOBS_CLOSE_TIMEOUT_MS).unref()
      })
      const outcome = await Promise.race([graceful, timeout])
      if (outcome !== 'closed') {
        log.warn({ outcome }, 'bakım kuyruğu temiz kapanmadı; Redis bağlantıları kesiliyor')
        disconnect()
      }
    },
  }
}
