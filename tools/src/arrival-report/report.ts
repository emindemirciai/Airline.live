import { mkdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import type { Database } from '@havayolu/db'
import type {
  ArrivalCoverageHours,
  ArrivalCoverageResult,
  ArrivalCoverageStationResult,
  ArrivalRuleResult,
} from '@havayolu/shared'
import { checkLocalDbGate, localDbRefusalText } from './gate'

/**
 * `pnpm coverage:report --hours N` (Parça 1 M7b.2, D-098): kapsama raporunu yerel veritabanında
 * admin işiyle aynı kodla (worker'ın `runArrivalCoverage` + `renderArrivalCoverageMarkdown`)
 * hesaplar ve `tools/recordings/tmp/kapsama-<YYYYMMDD>T<HHmm>Z.md`'ye yazar (pencere sonu, UTC;
 * `wx`: var olan dosya ezilmez). Yalnızca yerel `DATABASE_URL` (kapı); ağa çıkmaz, veritabanına
 * yazmaz (okumalar salt okunur işlemlerdedir). Rapor kimseye gönderilmez; üretim raporu yalnızca
 * admin işidir.
 */

type Sql = Database['sql']

export interface GeneratedReport {
  result: ArrivalCoverageResult
  markdown: string
}

/** Raporun hesaplanamadığı beklenen durum (ör. penceredeki örneklerde hiç `baro_rate` yok). */
export class CoverageReportFailure extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
  ) {
    super(message)
    this.name = 'CoverageReportFailure'
  }
}

export interface CoverageReportConfig {
  root: string
  hours: ArrivalCoverageHours
  /** `devEnvSource` sonucu: süreç > .env > .env.example. */
  source: Record<string, string | undefined>
  /** Çıktı klasörü; varsayılan `<root>/tools/recordings/tmp` (gitignore'da). */
  outDir?: string
}

export interface CoverageReportDatabase {
  sql: Sql
  close(): Promise<void>
}

export interface CoverageReportDeps {
  now(): number
  log(line: string): void
  error(line: string): void
  openDb(databaseUrl: string): CoverageReportDatabase
  /**
   * Raporu hesaplar ve Markdown'ını üretir (CLI worker'ın modülünü verir). Beklenen hata
   * `CoverageReportFailure`'dır (çıkış 1); başka hata iç hatadır (çıkış 4).
   */
  generate(sql: Sql, params: { jobStartMs: number; hours: number }): Promise<GeneratedReport>
  /** Veritabanı PING'inin zaman aşımı (ms); varsayılan 5000. */
  pingTimeoutMs?: number
}

export type CoverageReportExitCode = 0 | 1 | 2 | 4

export interface CoverageReportRun {
  exitCode: CoverageReportExitCode
  outPath: string | null
  result: ArrivalCoverageResult | null
}

/** Dosya adı: `kapsama-<YYYYMMDD>T<HHmm>Z.md` (UTC, ':' yok). */
export function coverageReportFileName(atMs: number): string {
  const iso = new Date(atMs).toISOString()
  return `kapsama-${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z.md`
}

const PERCENT = new Intl.NumberFormat('tr-TR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const DECIMAL = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 })
const INTEGER = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 })

/** `%33,3` (Türkçe yüzde biçimi); değer yoksa `—`. */
export function formatShare(share: number | null): string {
  return share === null ? '—' : PERCENT.format(share)
}

function utcMinute(iso: string): string {
  return `${iso.slice(0, 16)}Z`
}

function ruleText(rule: ArrivalRuleResult): string {
  const base =
    rule.verdict === 'applies'
      ? 'uygulanır'
      : rule.verdict === 'does_not_apply'
        ? 'uygulanmaz'
        : 'varış yok'
  const flags = [rule.borderline ? 'sınırda' : null, rule.lowSample ? 'az örnek' : null].filter(
    (f): f is string => f !== null,
  )
  return flags.length > 0 ? `${base} (${flags.join(', ')})` : base
}

/** Konsoldaki istasyon satırı: varış, yerde örneği, medyanlar ve iki kuralın sonucu. */
export function stationSummaryLine(s: ArrivalCoverageStationResult): string {
  const parts = [
    `${s.icao} (${s.iata}): ${INTEGER.format(s.arrivals)} varış`,
    `yerde örneği ${formatShare(s.groundShare)} (${s.groundSeen}/${s.arrivals})`,
  ]
  if (s.all.medianAglFt !== null) parts.push(`medyan AGL ${INTEGER.format(s.all.medianAglFt)} ft`)
  if (s.all.medianThresholdKm !== null) {
    parts.push(`eşiğe medyan ${DECIMAL.format(s.all.medianThresholdKm)} km`)
  }
  parts.push(`Kural 1: ${ruleText(s.rule1)}`, `Kural 2: ${ruleText(s.rule2)}`)
  if (s.openRecordArrivals > 0) parts.push(`açık kayıt ${s.openRecordArrivals}`)
  return parts.join(' · ')
}

/** Raporun konsol özeti (Markdown'ın yerine geçmez). */
export function coverageReportSummary(result: ArrivalCoverageResult): string[] {
  const lines = [
    `Pencere: ${utcMinute(result.window.start)} – ${utcMinute(result.window.end)} (${result.window.hours} sa, tanım sürümü ${result.definitionVersion})`,
  ]
  if (result.effectiveStart !== null && result.effectiveStart > result.window.start) {
    lines.push(`Etkin başlangıç (ilk baro_rate): ${utcMinute(result.effectiveStart)}`)
  }
  if (result.dataGapWarning) {
    lines.push('Uyarı: bir istasyonda baro_rate ya da seen_pos boş örnek payı %5’i aşıyor')
  }
  for (const station of result.stations) lines.push(`  ${stationSummaryLine(station)}`)
  lines.push(
    `Toplam: ${result.totals.arrivals} varış, ${result.totals.groundSeen} yerde örneğiyle` +
      (result.totals.openRecordArrivals > 0
        ? `; açık kayıt yüzünden sayılmayan ${result.totals.openRecordArrivals}`
        : ''),
  )
  return lines
}

async function ping(sql: Sql, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      sql`select 1`.then(() => true),
      new Promise<false>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      }),
    ])
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

const errorCode = (error: unknown) => (error as { code?: unknown } | null)?.code

/** Konsolda gösterilen yol: kökten göreli, '/' ayraçlı (kök dışındaysa mutlak). */
function shownPath(root: string, path: string): string {
  const rel = relative(root, path)
  return rel === '' || rel.startsWith('..') || isAbsolute(rel) ? path : rel.split(sep).join('/')
}

/**
 * Raporu hesaplayıp dosyaya yazar. Sıra: kapı → PING → hesap → dosya (`wx`). Dosya yalnızca
 * rapor tamamlanınca oluşur; yarım dosya kalmaz.
 */
export async function runCoverageReport(
  config: CoverageReportConfig,
  deps: CoverageReportDeps,
): Promise<CoverageReportRun> {
  const gate = checkLocalDbGate(config.source)
  if (!gate.ok) {
    for (const refusal of gate.refusals) deps.error(`✗ ${localDbRefusalText(refusal)}`)
    return { exitCode: 2, outPath: null, result: null }
  }
  const db = deps.openDb(gate.databaseUrl)
  try {
    if (!(await ping(db.sql, deps.pingTimeoutMs ?? 5_000))) {
      deps.error('✗ PostgreSQL yanıt vermedi; pnpm dev:infra çalışıyor mu (Docker Desktop)?')
      return { exitCode: 2, outPath: null, result: null }
    }
    const jobStartMs = deps.now()
    deps.log(`Kapsama raporu hesaplanıyor: son ${config.hours} saat, yerel veritabanı`)
    let generated: GeneratedReport
    try {
      generated = await deps.generate(db.sql, { jobStartMs, hours: config.hours })
    } catch (error) {
      if (error instanceof CoverageReportFailure) {
        deps.error(`✗ Rapor hesaplanamadı: ${error.message}`)
        return { exitCode: 1, outPath: null, result: null }
      }
      const code = errorCode(error)
      if (code === '42P01' || code === '42703') {
        deps.error('✗ Veritabanı şeması eski; önce pnpm db:migrate çalıştır')
        return { exitCode: 2, outPath: null, result: null }
      }
      throw error
    }
    const outDir = config.outDir ?? join(config.root, 'tools', 'recordings', 'tmp')
    const outPath = join(outDir, coverageReportFileName(Date.parse(generated.result.window.end)))
    try {
      mkdirSync(outDir, { recursive: true })
      writeFileSync(outPath, generated.markdown, { encoding: 'utf8', flag: 'wx' })
    } catch (error) {
      const shown = shownPath(config.root, outPath)
      deps.error(
        errorCode(error) === 'EEXIST'
          ? `✗ ${shown} zaten var; üzerine yazılmaz (bir dakika sonra yeniden çalıştır)`
          : `✗ ${shown} yazılamadı: ${error instanceof Error ? error.message : String(error)}`,
      )
      return { exitCode: 2, outPath: null, result: generated.result }
    }
    for (const line of coverageReportSummary(generated.result)) deps.log(line)
    deps.log(`✓ Rapor yazıldı: ${shownPath(config.root, outPath)}`)
    return { exitCode: 0, outPath, result: generated.result }
  } finally {
    await db.close()
  }
}
