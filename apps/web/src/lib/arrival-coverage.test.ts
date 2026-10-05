import { getMessages } from '@havayolu/i18n'
import type { ArrivalCoverageResult } from '@havayolu/shared'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import {
  COVERAGE_REPORT_ID,
  CoverageDetailSchema,
  CoverageListSchema,
  coverageApiPath,
  coverageAttachmentName,
  coverageDownloadHref,
  coverageDurationMs,
  coverageFailureText,
  coverageRefreshActiveId,
  coverageReportHref,
  coverageResultSummary,
  formatCoveragePercent,
  formatCoverageTime,
  parseCoverageHours,
  parseCoverageReportId,
  type CoverageResultSummarySchema,
} from './arrival-coverage'
import { COVERAGE_RESULT_FIXTURE, coverageReportFixture } from './test/coverage-fixture'

const t = getMessages('tr').admin.coverage

const report = coverageReportFixture
const RESULT_SUMMARY = COVERAGE_RESULT_FIXTURE

describe('kimlik ve saat denetimi', () => {
  it('rapor kimliği: 1 ile başlayan en çok 18 hane, metin olarak kalır', () => {
    expect(COVERAGE_REPORT_ID.source).toBe('^[1-9][0-9]{0,17}$')
    expect(parseCoverageReportId('1')).toBe('1')
    expect(parseCoverageReportId('999999999999999999')).toBe('999999999999999999')
    for (const value of [
      null,
      undefined,
      '',
      '0',
      '01',
      '-1',
      '1.5',
      '1e3',
      ' 1',
      '1 ',
      '1/../2',
      '%31',
      'abc',
      '1999999999999999999',
      7,
    ]) {
      expect(parseCoverageReportId(value), String(value)).toBeNull()
    }
  })

  it('formdaki saat yalnızca 6, 12, 24, 48, 72 ya da 168', () => {
    for (const hours of [6, 12, 24, 48, 72, 168])
      expect(parseCoverageHours(String(hours))).toBe(hours)
    for (const value of [
      '0',
      '1',
      '7',
      '169',
      '24.0',
      ' 24',
      '024',
      '+24',
      '1e1',
      'abc',
      '',
      null,
      24,
    ]) {
      expect(parseCoverageHours(value), String(value)).toBeNull()
    }
  })
})

describe('bağlantılar ve API yolu', () => {
  it('API yolu kimliği yüzde kodlar; sayfa ve indirme bağlantıları', () => {
    expect(coverageApiPath('12')).toBe('/v1/admin/arrival-coverage/reports/12')
    expect(coverageApiPath('12', 'markdown')).toBe('/v1/admin/arrival-coverage/reports/12/markdown')
    // Denetimden kaçan bir değer olsa da yol bölümünden çıkamaz.
    expect(coverageApiPath('1/../../x')).toBe('/v1/admin/arrival-coverage/reports/1%2F..%2F..%2Fx')
    expect(coverageReportHref(12)).toBe('/admin/kapsama?rapor=12')
    expect(coverageDownloadHref('12')).toBe('/admin/kapsama/indir?rapor=12')
  })

  it('ek adı yalnızca kapsama-<YYYYMMDD>T<HHmm>Z.md biçiminde kabul edilir', () => {
    expect(coverageAttachmentName('attachment; filename="kapsama-20261006T0915Z.md"')).toBe(
      'kapsama-20261006T0915Z.md',
    )
    for (const header of [
      null,
      '',
      'inline; filename="kapsama-20261006T0915Z.md"',
      'attachment; filename="kapsama-2026-10-06T09:15Z.md"',
      'attachment; filename="../kapsama-20261006T0915Z.md"',
      'attachment; filename="kapsama-20261006T0915Z.md.html"',
      'attachment; filename="kapsama-20261006T0915Z.md"; x="1"',
      'attachment; filename="a"\r\nSet-Cookie: x=1',
      'attachment; filename=kapsama-20261006T0915Z.md',
    ]) {
      expect(coverageAttachmentName(header), String(header)).toBeNull()
    }
  })
})

describe('API yanıt şemaları', () => {
  it('liste ve ayrıntı API biçimini kabul eder; eksik alanı reddeder', () => {
    const list = {
      checkedAt: '2026-10-06T10:02:00.000Z',
      reports: [report(), report({ id: 8, status: 'queued', startedAt: null, finishedAt: null })],
      activeId: 8,
      stations: [
        {
          icao: 'LTFM',
          iata: 'IST',
          isPrimary: true,
          ratio7d: 0.875,
          arrivals7d: 640,
          updatedAt: '2026-10-06T00:45:12.000Z',
        },
      ],
    }
    expect(CoverageListSchema.parse(list)).toEqual(list)
    expect(CoverageListSchema.safeParse({ ...list, activeId: '8' }).success).toBe(false)
    expect(
      CoverageListSchema.safeParse({ ...list, reports: [{ ...report(), status: 'stale' }] })
        .success,
    ).toBe(false)
    const detail = {
      ...report(),
      result: RESULT_SUMMARY,
      markdown: '# Kapsama raporu\n',
      checkedAt: '2026-10-06T10:02:00.000Z',
    }
    expect(CoverageDetailSchema.parse(detail)).toMatchObject({ markdown: '# Kapsama raporu\n' })
    expect(CoverageDetailSchema.safeParse({ ...detail, requestedAt: 'dün' }).success).toBe(false)
    const { checkedAt: _checkedAt, ...withoutCheckedAt } = detail
    expect(CoverageDetailSchema.safeParse(withoutCheckedAt).success).toBe(false)
  })

  it('sonuç özeti: paylaşılan sonuç tipi şemaya uyar; bozuk sonuç null', () => {
    expectTypeOf<ArrivalCoverageResult>().toExtend<z.input<typeof CoverageResultSummarySchema>>()
    expect(coverageResultSummary(RESULT_SUMMARY)).toEqual(RESULT_SUMMARY)
    expect(coverageResultSummary(null)).toBeNull()
    expect(coverageResultSummary({ ...RESULT_SUMMARY, stations: [{ icao: 'LTAI' }] })).toBeNull()
  })
})

describe('biçimlendirme', () => {
  it('UTC saat (dakikaya kadar) ve Türkçe yüzde', () => {
    expect(formatCoverageTime('2026-10-06T23:15:59.000Z', 'tr')).toBe('06.10.2026 23:15')
    expect(formatCoveragePercent(1 / 3, 'tr')).toBe('%33,3')
  })

  it('süre: bitmiş, çalışan ve başlamamış rapor', () => {
    const now = Date.parse('2026-10-06T10:02:00.000Z')
    expect(coverageDurationMs(report(), now)).toBe(90_000)
    expect(coverageDurationMs(report({ status: 'running', finishedAt: null }), now)).toBe(115_000)
    expect(
      coverageDurationMs(report({ status: 'queued', startedAt: null, finishedAt: null }), now),
    ).toBeNull()
  })

  it('süre: zaman aşımına uğrayan rapor büyümez (iki zaman aşımı kodu)', () => {
    const later = Date.parse('2026-10-06T12:00:00.000Z')
    // API zaman aşımı anını bitiş olarak verir: çalışırken zaman aşımı = başlangıç + 20 dk.
    const running = report({
      status: 'failed',
      error: 'timeout_running',
      finishedAt: '2026-10-06T10:20:05.000Z',
    })
    expect(coverageDurationMs(running, later)).toBe(20 * 60_000)
    expect(coverageDurationMs(running, later + 3_600_000)).toBe(20 * 60_000)
    // Bitişi bilinmeyen başarısız rapor için süre yazılmaz ("şimdi"ye göre büyümez).
    expect(
      coverageDurationMs(report({ ...running, finishedAt: null }), later + 3_600_000),
    ).toBeNull()
    // Kuyrukta zaman aşımı: iş hiç başlamadı.
    const queued = report({
      status: 'failed',
      error: 'timeout_queued',
      startedAt: null,
      finishedAt: '2026-10-06T10:15:00.000Z',
      windowStart: null,
      windowEnd: null,
    })
    expect(coverageDurationMs(queued, later)).toBeNull()
  })

  it('otomatik yenilemenin etkin raporu: liste, yoksa süren seçili rapor, yoksa bilinmiyor', () => {
    const list = (activeId: number | null) => ({ ok: true as const, list: { activeId } })
    const failed = { ok: false as const }
    const detail = (status: 'queued' | 'running' | 'done' | 'failed') => ({
      ok: true as const,
      report: { id: 7, status },
    })
    expect(coverageRefreshActiveId(list(7), null)).toBe(7)
    expect(coverageRefreshActiveId(list(null), detail('running'))).toBeNull()
    expect(coverageRefreshActiveId(failed, detail('running'))).toBe(7)
    expect(coverageRefreshActiveId(failed, detail('queued'))).toBe(7)
    expect(coverageRefreshActiveId(failed, detail('done'))).toBeUndefined()
    expect(coverageRefreshActiveId(failed, failed)).toBeUndefined()
    expect(coverageRefreshActiveId(failed, null)).toBeUndefined()
  })

  it('hata kodları çevrilir, diğer ileti olduğu gibi gösterilir', () => {
    expect(coverageFailureText('timeout_queued', t.failures)).toBe(t.failures.timeout_queued)
    expect(coverageFailureText('timeout_running', t.failures)).toBe(t.failures.timeout_running)
    expect(coverageFailureText('Pencerede baro_rate yok', t.failures)).toBe(
      'Hata: Pencerede baro_rate yok',
    )
    expect(coverageFailureText(null, t.failures)).toBeNull()
    expect(coverageFailureText(' ', t.failures)).toBeNull()
  })
})
