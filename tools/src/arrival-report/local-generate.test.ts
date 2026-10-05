import type { Database } from '@havayolu/db'
import { ArrivalCoverageError } from '@havayolu/worker/jobs/arrival-coverage/run'
import { describe, expect, it } from 'vitest'
import {
  asCoverageReportFailure,
  DEFAULT_FINE_RETENTION_DAYS,
  fineRetentionDays,
  localCoverageGenerator,
} from './local-generate'
import { CoverageReportFailure } from './report'

describe('fineRetentionDays', () => {
  it('pozitif tam sayıyı okur; yoksa ya da geçersizse 30', () => {
    expect(fineRetentionDays({ TRACK_FINE_RETENTION_DAYS: ' 8 ' })).toBe(8)
    expect(fineRetentionDays({})).toBe(DEFAULT_FINE_RETENTION_DAYS)
    for (const value of ['', '0', '-3', '7.5', 'otuz']) {
      expect(fineRetentionDays({ TRACK_FINE_RETENTION_DAYS: value })).toBe(30)
    }
  })
})

describe('asCoverageReportFailure', () => {
  it('worker’ın bilinen hatası koduyla ve Türkçe iletisiyle çıkış 1 olur', () => {
    const failure = asCoverageReportFailure(
      new ArrivalCoverageError('no_baro_rate', 'Pencerede baro_rate yok'),
    )
    expect(failure).toBeInstanceOf(CoverageReportFailure)
    expect(failure).toMatchObject({ code: 'no_baro_rate', message: 'Pencerede baro_rate yok' })
  })

  it('tükenen SQL yeniden denemeleri (57014, 55P03) de bilinen hatadır', () => {
    for (const [sqlState, code] of [
      ['57014', 'statement_timeout'],
      ['55P03', 'lock_timeout'],
    ] as const) {
      const failure = asCoverageReportFailure(Object.assign(new Error('x'), { code: sqlState }))
      expect(failure).toBeInstanceOf(CoverageReportFailure)
      expect(failure).toMatchObject({ code })
    }
  })

  it('başka hata olduğu gibi kalır (CLI çıkış 4 ya da şema iletisi)', () => {
    const schema = Object.assign(new Error('relation does not exist'), { code: '42P01' })
    expect(asCoverageReportFailure(schema)).toBe(schema)
    const plain = new Error('boom')
    expect(asCoverageReportFailure(plain)).toBe(plain)
  })
})

describe('localCoverageGenerator', () => {
  it('saklama süresini aşan pencere veritabanına dokunmadan reddedilir', async () => {
    const sql = (() => {
      throw new Error('veritabanına gidilmemeli')
    }) as unknown as Database['sql']
    const generate = localCoverageGenerator({ appVersion: '0.0.0-test', retentionDays: 7 })
    const error = await generate(sql, { jobStartMs: Date.now(), hours: 168 }).catch(
      (e: unknown) => e,
    )
    expect(error).toBeInstanceOf(CoverageReportFailure)
    expect(error).toMatchObject({ code: 'retention_exceeded' })
    expect((error as Error).message).toContain('en çok 144 saat')
  })
})
