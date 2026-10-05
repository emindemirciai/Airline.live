import { ARRIVAL_COVERAGE_HOURS } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import {
  ARRIVAL_FIXTURE_USAGE,
  ArrivalReportArgsError,
  COVERAGE_REPORT_USAGE,
  parseArrivalFixtureArgs,
  parseCoverageReportArgs,
  parseReportHours,
} from './args'

describe('parseCoverageReportArgs', () => {
  it('varsayılan 24 saat; baştaki -- atlanır', () => {
    expect(parseCoverageReportArgs([])).toEqual({ kind: 'run', hours: 24 })
    expect(parseCoverageReportArgs(['--', '--hours', '6'])).toEqual({ kind: 'run', hours: 6 })
    expect(parseCoverageReportArgs(['--hours=168'])).toEqual({ kind: 'run', hours: 168 })
  })

  it('admin sayfasının bütün süreleri kabul edilir', () => {
    for (const hours of ARRIVAL_COVERAGE_HOURS) {
      expect(parseCoverageReportArgs(['--hours', String(hours)])).toEqual({ kind: 'run', hours })
    }
  })

  it.each(['0', '1', '25', '169', '-24', '24.5', 'abc', '', ' ', '0024', '1e1'])(
    '--hours %j reddedilir',
    (value) => {
      expect(() => parseCoverageReportArgs(['--hours', value])).toThrow(ArrivalReportArgsError)
    },
  )

  it('boşluklu değer kırpılır', () => {
    expect(parseReportHours(' 48 ')).toBe(48)
  })

  it('bilinmeyen bayrak ve konumsal argüman hata verir', () => {
    expect(() => parseCoverageReportArgs(['--confirm'])).toThrow(ArrivalReportArgsError)
    expect(() => parseCoverageReportArgs(['24'])).toThrow(ArrivalReportArgsError)
  })

  it('-h ve --help yardım döndürür', () => {
    expect(parseCoverageReportArgs(['-h'])).toEqual({ kind: 'help' })
    expect(parseCoverageReportArgs(['--help', '--hours', '6'])).toEqual({ kind: 'help' })
  })

  it('kullanım metni süreleri, çıktı yolunu, yerel kapıyı ve çıkış kodlarını yazar', () => {
    expect(COVERAGE_REPORT_USAGE).toContain('6, 12, 24, 48, 72, 168')
    expect(COVERAGE_REPORT_USAGE).toContain('tools/recordings/tmp/kapsama-<YYYYMMDD>T<HHmm>Z.md')
    expect(COVERAGE_REPORT_USAGE).toContain('localhost/127.0.0.1/::1')
    expect(COVERAGE_REPORT_USAGE).toMatch(/0 rapor yazıldı · 1 rapor hesaplanamadı/)
    expect(COVERAGE_REPORT_USAGE).toContain('4 iç hata')
  })
})

describe('parseArrivalFixtureArgs', () => {
  it('varsayılan yazma; --clean yalnızca siler; -h yardım', () => {
    expect(parseArrivalFixtureArgs([])).toEqual({ kind: 'seed' })
    expect(parseArrivalFixtureArgs(['--', '--clean'])).toEqual({ kind: 'clean' })
    expect(parseArrivalFixtureArgs(['-h'])).toEqual({ kind: 'help' })
  })

  it('bilinmeyen bayrak hata verir', () => {
    expect(() => parseArrivalFixtureArgs(['--hours', '24'])).toThrow(ArrivalReportArgsError)
  })

  it('kullanım metni istasyonu, hex’leri ve beklenen sonucu yazar', () => {
    expect(ARRIVAL_FIXTURE_USAGE).toContain('LTAI')
    expect(ARRIVAL_FIXTURE_USAGE).toContain('e2e0a1, e2e0a2, e2e0a3')
    expect(ARRIVAL_FIXTURE_USAGE).toContain('%33,3')
  })
})
