import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BLOCKLIST_REFRESH_MS, BLOCKLIST_RETRY_MS, BlocklistSync } from './blocklist-sync'

const T0 = Date.UTC(2026, 8, 28, 12, 0, 0)

function setup(results: (ReadonlySet<string> | Error)[]) {
  const reads: number[] = []
  const log = { info: vi.fn(), warn: vi.fn() }
  const sync = new BlocklistSync({
    read: async () => {
      reads.push(Date.now())
      const next = results.length > 1 ? results.shift() : results[0]
      if (next === undefined || next instanceof Error) throw next ?? new Error('no result')
      return next
    },
    log,
  })
  return { sync, reads, log }
}

describe('BlocklistSync', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: T0 })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ilk okuma başarısızsa kapalı kalır ve 5 sn’de bir dener; yüklenince 30 sn’de bir yeniler', async () => {
    const down = new Error('Connection is closed.')
    const { sync, reads, log } = setup([down, down, new Set(['4bb1a2']), new Set(['4bb1a3'])])
    let loaded: boolean | null = null
    void sync.whenLoaded().then((value) => {
      loaded = value
    })
    sync.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(sync.loaded()).toBe(false)
    expect(sync.current().size).toBe(0)
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ loaded: false }),
      'blocklist could not be read; live data withheld until it loads',
    )

    await vi.advanceTimersByTimeAsync(BLOCKLIST_RETRY_MS)
    expect(sync.loaded()).toBe(false)
    await vi.advanceTimersByTimeAsync(BLOCKLIST_RETRY_MS)
    expect(sync.loaded()).toBe(true)
    expect(loaded).toBe(true)
    expect([...sync.current()]).toEqual(['4bb1a2'])
    expect(reads.map((t) => t - T0)).toEqual([0, 5_000, 10_000])
    // Uyarı dakikada bir: ikinci hata yazılmadı.
    expect(log.warn).toHaveBeenCalledTimes(1)

    // Yüklendikten sonra 30 sn'de bir.
    await vi.advanceTimersByTimeAsync(BLOCKLIST_REFRESH_MS - 1)
    expect(reads).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(reads).toHaveLength(4)
    expect([...sync.current()]).toEqual(['4bb1a3'])
    expect(await sync.whenLoaded()).toBe(true)
    sync.stop()
  })

  it('yüklendikten sonraki okuma hatası son iyi listeyi korur', async () => {
    const { sync, log } = setup([new Set(['4bb1a2']), new Error('Connection is closed.')])
    sync.start()
    expect(await sync.whenLoaded()).toBe(true)
    await vi.advanceTimersByTimeAsync(BLOCKLIST_REFRESH_MS)
    expect(sync.loaded()).toBe(true)
    expect([...sync.current()]).toEqual(['4bb1a2'])
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ loaded: true }),
      'blocklist could not be read; keeping the last list',
    )
    sync.stop()
  })

  it('yüklenmeden durdurulursa bekleyen false alır ve deneme durur', async () => {
    const { sync, reads } = setup([new Error('down')])
    sync.start()
    const pending = sync.whenLoaded()
    await vi.advanceTimersByTimeAsync(BLOCKLIST_RETRY_MS)
    sync.stop()
    expect(await pending).toBe(false)
    expect(await sync.whenLoaded()).toBe(false)
    const count = reads.length
    await vi.advanceTimersByTimeAsync(BLOCKLIST_RETRY_MS * 3)
    expect(reads).toHaveLength(count)
    expect(sync.loaded()).toBe(false)
  })

  it('depo yoksa (redis-queue tanımsız) liste boştur ve hemen yüklenmiş sayılır', async () => {
    const sync = new BlocklistSync({ read: null, log: { info: vi.fn(), warn: vi.fn() } })
    expect(sync.loaded()).toBe(true)
    sync.start()
    expect(await sync.whenLoaded()).toBe(true)
    expect(sync.current().size).toBe(0)
    expect(await sync.refresh()).toBe(true)
  })
})
