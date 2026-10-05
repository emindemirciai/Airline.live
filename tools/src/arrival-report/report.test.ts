import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Database } from '@havayolu/db'
import { afterEach, describe, expect, it } from 'vitest'
import {
  coverageReportFileName,
  coverageReportSummary,
  CoverageReportFailure,
  formatShare,
  runCoverageReport,
  stationSummaryLine,
  type CoverageReportConfig,
  type CoverageReportDeps,
  type GeneratedReport,
} from './report'
import { coverageResult, stationResult } from './test/result'

const LOCAL_URL = 'postgres://havayolu:havayolu_dev_only@localhost:45432/app_dev'
const NOW = Date.parse('2026-10-05T12:00:30Z')
const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'hy-coverage-report-'))
  dirs.push(dir)
  return dir
}

type Sql = Database['sql']

interface Harness {
  deps: CoverageReportDeps
  logs: string[]
  errors: string[]
  opened: string[]
  closed: number
  calls: { jobStartMs: number; hours: number }[]
}

function harness(
  generate: (params: { jobStartMs: number; hours: number }) => Promise<GeneratedReport>,
  options: { pingOk?: boolean } = {},
): Harness {
  const h: Harness = {
    logs: [],
    errors: [],
    opened: [],
    closed: 0,
    calls: [],
    deps: undefined as unknown as CoverageReportDeps,
  }
  const sql = (() =>
    options.pingOk === false
      ? Promise.reject(new Error('connect ECONNREFUSED'))
      : Promise.resolve([{ ok: 1 }])) as unknown as Sql
  h.deps = {
    now: () => NOW,
    log: (line) => void h.logs.push(line),
    error: (line) => void h.errors.push(line),
    openDb: (url) => {
      h.opened.push(url)
      return {
        sql,
        close: async () => {
          h.closed += 1
        },
      }
    },
    generate: async (_sql, params) => {
      h.calls.push(params)
      return generate(params)
    },
    pingTimeoutMs: 200,
  }
  return h
}

function config(root: string, overrides: Partial<CoverageReportConfig> = {}): CoverageReportConfig {
  return {
    root,
    hours: 24,
    source: { DATABASE_URL: LOCAL_URL, APP_ENV: 'development' },
    ...overrides,
  }
}

const MARKDOWN = '# Kapsama raporu\n\nVeri: ADSB.lol — ODbL 1.0\n'

describe('coverageReportFileName', () => {
  it('UTC dakikasıyla ve iki noktasız ad verir', () => {
    expect(coverageReportFileName(Date.parse('2026-10-05T11:15:59.999Z'))).toBe(
      'kapsama-20261005T1115Z.md',
    )
    expect(coverageReportFileName(Date.parse('2026-01-02T03:04:00Z'))).toBe(
      'kapsama-20260102T0304Z.md',
    )
  })
})

describe('konsol özeti', () => {
  it('Türkçe yüzde, kurallar ve bayraklar', () => {
    expect(formatShare(1 / 3)).toBe('%33,3')
    expect(formatShare(null)).toBe('—')
    expect(stationSummaryLine(stationResult())).toBe(
      'LTAI (AYT): 3 varış · yerde örneği %33,3 (1/3) · medyan AGL 308 ft · eşiğe medyan 1,5 km · Kural 1: uygulanır (sınırda, az örnek) · Kural 2: uygulanmaz (az örnek)',
    )
    const empty = stationSummaryLine(
      stationResult({
        icao: 'LTFJ',
        iata: 'SAW',
        arrivals: 0,
        groundSeen: 0,
        groundShare: null,
        openRecordArrivals: 2,
        all: { ...stationResult().all, medianAglFt: null, medianThresholdKm: null },
        rule1: { verdict: 'no_arrivals', borderline: false, lowSample: true },
        rule2: { verdict: 'no_arrivals', borderline: false, lowSample: true },
      }),
    )
    expect(empty).toBe(
      'LTFJ (SAW): 0 varış · yerde örneği — (0/0) · Kural 1: varış yok (az örnek) · Kural 2: varış yok (az örnek) · açık kayıt 2',
    )
  })

  it('pencere, etkin başlangıç, veri boşluğu uyarısı ve toplam', () => {
    const lines = coverageReportSummary(
      coverageResult({ effectiveStart: '2026-10-05T07:00:00.000Z', dataGapWarning: true }),
    )
    expect(lines[0]).toBe('Pencere: 2026-10-04T11:15Z – 2026-10-05T11:15Z (24 sa, tanım sürümü 1)')
    expect(lines).toContain('Etkin başlangıç (ilk baro_rate): 2026-10-05T07:00Z')
    expect(lines.some((l) => l.startsWith('Uyarı:'))).toBe(true)
    expect(lines.at(-1)).toBe('Toplam: 3 varış, 1 yerde örneğiyle')
    const plain = coverageReportSummary(coverageResult())
    expect(plain.some((l) => l.startsWith('Etkin başlangıç'))).toBe(false)
    expect(plain.some((l) => l.startsWith('Uyarı:'))).toBe(false)
  })
})

describe('runCoverageReport', () => {
  it('raporu yerel veritabanında hesaplar ve tools/recordings/tmp altına yazar', async () => {
    const root = tempRoot()
    const h = harness(async () => ({ result: coverageResult(), markdown: MARKDOWN }))
    const run = await runCoverageReport(config(root, { hours: 6 }), h.deps)
    const expected = join(root, 'tools', 'recordings', 'tmp', 'kapsama-20261005T1115Z.md')
    expect(run.exitCode).toBe(0)
    expect(run.outPath).toBe(expected)
    expect(readFileSync(expected, 'utf8')).toBe(MARKDOWN)
    expect(h.opened).toEqual([LOCAL_URL])
    expect(h.calls).toEqual([{ jobStartMs: NOW, hours: 6 }])
    expect(h.closed).toBe(1)
    expect(h.errors).toEqual([])
    expect(h.logs.join('\n')).toContain('LTAI (AYT): 3 varış · yerde örneği %33,3 (1/3)')
    expect(h.logs.at(-1)).toBe('✓ Rapor yazıldı: tools/recordings/tmp/kapsama-20261005T1115Z.md')
    // Günlükte bağlantı adresi ve parola yoktur.
    expect(h.logs.join('\n')).not.toContain('havayolu_dev_only')
  })

  it('var olan dosya ezilmez: çıkış 2, içerik değişmez', async () => {
    const root = tempRoot()
    const outDir = join(root, 'cikti')
    const h = harness(async () => ({ result: coverageResult(), markdown: MARKDOWN }))
    const first = await runCoverageReport(config(root, { outDir }), h.deps)
    expect(first.exitCode).toBe(0)
    writeFileSync(first.outPath as string, 'elle düzenlendi\n')
    const second = await runCoverageReport(config(root, { outDir }), h.deps)
    expect(second.exitCode).toBe(2)
    expect(second.outPath).toBeNull()
    expect(readFileSync(first.outPath as string, 'utf8')).toBe('elle düzenlendi\n')
    expect(h.errors.at(-1)).toMatch(/kapsama-20261005T1115Z\.md zaten var; üzerine yazılmaz/)
    expect(h.closed).toBe(2)
  })

  it('yerel olmayan veritabanı: bağlantı açılmaz, hesap yapılmaz, çıkış 2', async () => {
    const root = tempRoot()
    const h = harness(async () => ({ result: coverageResult(), markdown: MARKDOWN }))
    const run = await runCoverageReport(
      config(root, {
        source: {
          DATABASE_URL: 'postgres://u:gizli@db.havayolu.live:5432/app',
          APP_ENV: 'production',
        },
      }),
      h.deps,
    )
    expect(run.exitCode).toBe(2)
    expect(h.opened).toEqual([])
    expect(h.calls).toEqual([])
    expect(h.errors.join('\n')).toContain('DATABASE_URL yerel değil')
    expect(h.errors.join('\n')).toContain('APP_ENV development ya da test olmalı')
    expect(h.errors.join('\n')).not.toContain('gizli')
    expect(existsSync(join(root, 'tools'))).toBe(false)
  })

  it('PostgreSQL yanıt vermezse çıkış 2 ve bağlantı kapanır', async () => {
    const root = tempRoot()
    const h = harness(async () => ({ result: coverageResult(), markdown: MARKDOWN }), {
      pingOk: false,
    })
    const run = await runCoverageReport(config(root), h.deps)
    expect(run.exitCode).toBe(2)
    expect(h.calls).toEqual([])
    expect(h.closed).toBe(1)
    expect(h.errors).toEqual([
      '✗ PostgreSQL yanıt vermedi; pnpm dev:infra çalışıyor mu (Docker Desktop)?',
    ])
  })

  it('rapor hesaplanamazsa (bilinen hata) çıkış 1 ve dosya yazılmaz', async () => {
    const root = tempRoot()
    const h = harness(async () => {
      throw new CoverageReportFailure('Pencerede baro_rate_fpm dolu örnek yok', 'no_baro_rate')
    })
    const run = await runCoverageReport(config(root), h.deps)
    expect(run.exitCode).toBe(1)
    expect(h.errors).toEqual(['✗ Rapor hesaplanamadı: Pencerede baro_rate_fpm dolu örnek yok'])
    expect(existsSync(join(root, 'tools', 'recordings', 'tmp'))).toBe(false)
    expect(h.closed).toBe(1)
  })

  it('şema eski (42P01/42703): db:migrate önerilir, çıkış 2', async () => {
    const root = tempRoot()
    const h = harness(async () => {
      throw Object.assign(new Error('column "baro_rate_fpm" does not exist'), { code: '42703' })
    })
    const run = await runCoverageReport(config(root), h.deps)
    expect(run.exitCode).toBe(2)
    expect(h.errors).toEqual(['✗ Veritabanı şeması eski; önce pnpm db:migrate çalıştır'])
  })

  it('beklenmeyen hata fırlatılır (CLI çıkış 4) ve bağlantı yine kapanır', async () => {
    const root = tempRoot()
    const h = harness(async () => {
      throw new Error('boom')
    })
    await expect(runCoverageReport(config(root), h.deps)).rejects.toThrow('boom')
    expect(h.closed).toBe(1)
    expect(readdirSync(root)).toEqual([])
  })
})
