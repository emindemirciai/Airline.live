import type * as Db from '@havayolu/db'
import type { Logger } from 'pino'
import { describe, expect, it, vi } from 'vitest'
import { runReferenceImport, type ReferenceFetcher, type ReferenceImportDeps } from './reference'

// Veritabanı yok: kaynak durumu okuma ve yazma işlevleri taklittir (son içe aktarım başarılı,
// koşullu indirme); içe aktarımın ve kayma satırının akışı gerçektir.
vi.mock('@havayolu/db', async (importOriginal) => ({
  ...(await importOriginal<typeof Db>()),
  getReferenceSource: vi.fn(async () => ({
    importedAt: new Date('2026-10-01T04:40:00Z'),
    etag: '"e"',
    lastModified: null,
  })),
  recordReferenceCheck: vi.fn(async () => undefined),
  recordReferenceError: vi.fn(async () => undefined),
}))

const logger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
const unchanged: ReferenceFetcher = async () => ({ status: 'not_modified' })
const failing: ReferenceFetcher = async () => {
  throw new Error('HTTP 503')
}
const deps = (
  log: ReturnType<typeof logger>,
  fetcher: ReferenceFetcher = unchanged,
): ReferenceImportDeps => ({
  db: {} as ReferenceImportDeps['db'],
  fetcher,
  origin: 'fixture',
  log: log as unknown as Logger,
  now: () => new Date('2026-10-08T04:40:00Z'),
})
const noDrift = { airports: [], icaoCollisions: [] }

describe('runReferenceImport kayma satırı (D-109)', () => {
  it('okuma hatası yalnız uyarı yazar: içe aktarım sonucu değişmez, kayma yok', async () => {
    const log = logger()
    const result = await runReferenceImport({
      ...deps(log),
      readDrift: () => Promise.reject(new Error('veritabanı kapalı')),
    })
    expect(result).toEqual({
      ourairports: { status: 'not_modified' },
      airlines: { status: 'not_modified' },
    })
    expect(log.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      'referans verisi kayması ölçülemedi',
    )
    expect(log.info).not.toHaveBeenCalledWith(expect.anything(), 'referans verisi kayması')
  })

  it('"değişmedi"den sonra da kayma satırı yazılır (boş listede küratörlü adlar sapmadır: warn)', async () => {
    const log = logger()
    const readDrift = vi.fn(async () => noDrift)
    const result = await runReferenceImport({ ...deps(log), readDrift })
    expect(readDrift).toHaveBeenCalledTimes(1)
    expect(result.ourairports.status).toBe('not_modified')
    expect(result.drift?.listed).toBe(0)
    expect(result.drift?.curatedNotListed.count).toBeGreaterThan(0)
    expect(log.warn).toHaveBeenCalledWith({ drift: result.drift }, 'referans verisi kayması')
  })

  it('OurAirports içe aktarımı başarısızsa kayma okunmaz', async () => {
    const log = logger()
    const readDrift = vi.fn(async () => noDrift)
    const result = await runReferenceImport({ ...deps(log, failing), readDrift })
    expect(result.ourairports).toMatchObject({ status: 'failed', error: 'HTTP 503' })
    expect(result.airlines.status).toBe('failed')
    expect(result).not.toHaveProperty('drift')
    expect(readDrift).not.toHaveBeenCalled()
  })

  it('readDrift verilmezse kayma ölçülmez', async () => {
    const result = await runReferenceImport(deps(logger()))
    expect(result).not.toHaveProperty('drift')
  })
})
