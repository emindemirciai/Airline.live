import { getMessages } from '@havayolu/i18n'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  COVERAGE_RESULT_FIXTURE,
  coverageDetailFixture,
  coverageReportFixture,
} from '../../../lib/test/coverage-fixture'
import {
  CoverageLast7Table,
  CoverageReportDetail,
  CoverageReportsTable,
  formatCoverageDuration,
} from './coverage-view'

const t = getMessages('tr').admin.coverage
const NOW = Date.parse('2026-10-06T10:02:00.000Z')

/** Görünen metin: etiketler atılır, HTML varlıkları çözülür. */
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

describe('CoverageReportsTable', () => {
  const reports = [
    coverageReportFixture({
      id: 9,
      status: 'queued',
      startedAt: null,
      finishedAt: null,
      windowStart: null,
      windowEnd: null,
      definitionVersion: null,
    }),
    coverageReportFixture({ id: 8, status: 'failed', error: 'timeout_queued', startedAt: null }),
    coverageReportFixture({ id: 7 }),
  ]

  it('zaman aşımı: kuyrukta kalan raporda pencere tire; çalışırken kalan raporun süresi büyümez', () => {
    const html = renderToStaticMarkup(
      createElement(CoverageReportsTable, {
        reports: [
          coverageReportFixture({
            id: 12,
            status: 'failed',
            error: 'timeout_queued',
            startedAt: null,
            finishedAt: '2026-10-06T10:15:00.000Z',
            windowStart: null,
            windowEnd: null,
            definitionVersion: null,
          }),
          coverageReportFixture({
            id: 11,
            status: 'failed',
            error: 'timeout_running',
            finishedAt: '2026-10-06T10:20:05.000Z',
          }),
        ],
        selectedId: null,
        t,
        locale: 'tr',
        nowMs: NOW + 5 * 3_600_000,
      }),
    )
    const visible = text(html)
    expect(visible).not.toContain('iş başlayınca belirlenir')
    expect(visible).toMatch(/12 \S+ \S+ — Hata/)
    expect(visible).toContain(t.failures.timeout_queued)
    expect(visible).toContain(t.failures.timeout_running)
    expect(visible).toContain('20 dk 0 sn')
    expect(html).not.toContain('/admin/kapsama/indir')
  })

  it('durum, pencere, süre ve yalnızca hazır raporda indirme bağlantısı', () => {
    const html = renderToStaticMarkup(
      createElement(CoverageReportsTable, {
        reports,
        selectedId: '7',
        t,
        locale: 'tr',
        nowMs: NOW,
      }),
    )
    const visible = text(html)
    expect(visible).toContain('Kuyrukta')
    expect(visible).toContain('24 saat; iş başlayınca belirlenir')
    expect(visible).toContain(t.failures.timeout_queued)
    expect(visible).toContain('05.10.2026 09:15 → 06.10.2026 09:15')
    expect(visible).toContain('1 dk 30 sn')
    expect(html.match(/href="\/admin\/kapsama\/indir\?rapor=\d+"/g)).toEqual([
      'href="/admin/kapsama/indir?rapor=7"',
    ])
    expect(html).toContain('href="/admin/kapsama?rapor=9"')
    expect(html).toMatch(/<a[^>]*aria-current="page"[^>]*>Görüntüle<\/a>/)
    expect(html).toContain('aria-label="7 numaralı raporu indir (.md)"')
    // `download` özniteliği yok: dosyayı Content-Disposition indirir, hata ve giriş sayfası açılır.
    expect(html).not.toMatch(/<a[^>]*\sdownload[\s=>]/)
  })

  it('rapor yoksa boş durum metni', () => {
    const html = renderToStaticMarkup(
      createElement(CoverageReportsTable, {
        reports: [],
        selectedId: null,
        t,
        locale: 'tr',
        nowMs: NOW,
      }),
    )
    expect(text(html)).toBe(t.reports.empty)
  })
})

describe('CoverageReportDetail', () => {
  it('istasyon özeti: varış, yerde örneği payı, aralık, medyanlar, kural rozetleri ve bayraklar', () => {
    const html = renderToStaticMarkup(
      createElement(CoverageReportDetail, {
        report: coverageDetailFixture(),
        t,
        locale: 'tr',
        nowMs: NOW,
      }),
    )
    const visible = text(html)
    expect(visible).toContain('Rapor 7 Hazır')
    expect(visible).toContain('AYT LTAI 3 %33,3 (1/3) %6,2…%79,2 412 ft 2,7 km')
    expect(visible).toContain('Uygulanır (sınırda, az örnek)')
    expect(visible).toContain('Uygulanmaz (az örnek)')
    expect(visible).toContain('Toplam 3 varış; 1 tanesinde yerde örneği var.')
    expect(html).toContain('href="/admin/kapsama/indir?rapor=7"')
    expect(html).not.toMatch(/<a[^>]*\sdownload[\s=>]/)
    expect(visible).not.toContain(t.detail.dataGapWarning)
  })

  it('Markdown metni HTML olarak yorumlanmaz', () => {
    const markdown = '# Kapsama raporu\n\n<script>alert(1)</script><img src=x onerror=alert(2)>\n'
    const html = renderToStaticMarkup(
      createElement(CoverageReportDetail, {
        report: coverageDetailFixture({ markdown }),
        t,
        locale: 'tr',
        nowMs: NOW,
      }),
    )
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toMatch(/<pre class="coverage-markdown" tabindex="0">/)
  })

  it('veri boşluğu uyarısı; okunamayan sonuçta yalnızca Markdown', () => {
    const warned = renderToStaticMarkup(
      createElement(CoverageReportDetail, {
        report: coverageDetailFixture({
          result: { ...COVERAGE_RESULT_FIXTURE, dataGapWarning: true },
        }),
        t,
        locale: 'tr',
        nowMs: NOW,
      }),
    )
    expect(text(warned)).toContain(t.detail.dataGapWarning)

    const unreadable = renderToStaticMarkup(
      createElement(CoverageReportDetail, {
        report: coverageDetailFixture({ result: { stations: 'bozuk' } }),
        t,
        locale: 'tr',
        nowMs: NOW,
      }),
    )
    expect(text(unreadable)).toContain(t.detail.resultUnreadable)
    expect(unreadable).not.toContain('<table')
    expect(unreadable).toContain('coverage-markdown')
  })

  it('kuyruktaki ve başarısız rapor: bekleme ya da hata iletisi, indirme yok', () => {
    const queued = renderToStaticMarkup(
      createElement(CoverageReportDetail, {
        report: coverageDetailFixture({
          status: 'queued',
          startedAt: null,
          finishedAt: null,
          windowStart: null,
          windowEnd: null,
          result: null,
          markdown: null,
        }),
        t,
        locale: 'tr',
        nowMs: NOW,
      }),
    )
    expect(text(queued)).toContain(t.detail.pending)
    expect(queued).not.toContain('/admin/kapsama/indir')

    const failed = renderToStaticMarkup(
      createElement(CoverageReportDetail, {
        report: coverageDetailFixture({
          status: 'failed',
          error: 'Pencerede baro_rate yok (v0.20.0 öncesi)',
          result: null,
          markdown: null,
        }),
        t,
        locale: 'tr',
        nowMs: NOW,
      }),
    )
    expect(failed).toContain('role="alert"')
    expect(text(failed)).toContain('Hata: Pencerede baro_rate yok (v0.20.0 öncesi)')
    expect(failed).not.toContain('/admin/kapsama/indir')
  })
})

describe('CoverageLast7Table', () => {
  it('oran, varış ve güncellenme; iş çalışmadıysa tire ve "henüz çalışmadı"', () => {
    const html = renderToStaticMarkup(
      createElement(CoverageLast7Table, {
        stations: [
          {
            icao: 'LTFM',
            iata: 'IST',
            isPrimary: true,
            ratio7d: 0.875,
            arrivals7d: 1640,
            updatedAt: '2026-10-06T00:45:12.000Z',
          },
          {
            icao: 'LTAI',
            iata: 'AYT',
            isPrimary: false,
            ratio7d: null,
            arrivals7d: null,
            updatedAt: null,
          },
        ],
        t,
        locale: 'tr',
      }),
    )
    const visible = text(html)
    expect(visible).toContain('IST LTFM %87,5 1.640 06.10.2026 00:45')
    expect(visible).toContain('AYT LTAI — — henüz çalışmadı')
  })
})

describe('formatCoverageDuration', () => {
  it('saniye ve dakika', () => {
    expect(formatCoverageDuration(4_400, t)).toBe('4 sn')
    expect(formatCoverageDuration(59_499, t)).toBe('59 sn')
    expect(formatCoverageDuration(600_000, t)).toBe('10 dk 0 sn')
  })
})
