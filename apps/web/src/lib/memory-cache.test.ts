import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryCache } from './memory-cache'

let clock = 0
const now = () => clock

beforeEach(() => {
  clock = 1_000_000
})

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })
  return { promise, resolve, reject }
}

/** Arka plandaki yenilemenin sözleri çözülsün. */
const settle = () => new Promise((resolve) => setImmediate(resolve))

const HOUR = 3_600_000
const MINUTE = 60_000

describe('createMemoryCache: staleWhileRevalidate (havalimanı listesi, D-111)', () => {
  const options = { ttlMs: HOUR, retryMs: MINUTE, maxStaleMs: Infinity, now }

  it('süresi dolan değer hemen döner; arkada tek yenileme, sonraki çağrı yenisini alır', async () => {
    let calls = 0
    const loads = [deferred<string>(), deferred<string>()]
    const get = createMemoryCache({
      ...options,
      staleWhileRevalidate: true,
      load: () => {
        const next = loads[calls]
        calls += 1
        return next?.promise ?? Promise.reject(new Error('unexpected load'))
      },
    })
    const cold = get()
    loads[0]?.resolve('v1')
    expect(await cold).toBe('v1')
    clock += HOUR - 1
    expect(await get()).toBe('v1')
    expect(calls).toBe(1)
    clock += 1
    // Süre doldu: yenileme sürerken bütün çağrılar eski değeri beklemeden alır, tek istek gider.
    const stale = await Promise.all(Array.from({ length: 50 }, () => get()))
    expect(new Set(stale)).toEqual(new Set(['v1']))
    expect(calls).toBe(2)
    loads[1]?.resolve('v2')
    await settle()
    expect(await get()).toBe('v2')
    expect(calls).toBe(2)
  })

  it('başarısız yenileme: eski değer yaş sınırı olmadan verilir; 60 sn dolmadan yeniden denenmez', async () => {
    let calls = 0
    let fail = false
    const get = createMemoryCache({
      ...options,
      staleWhileRevalidate: true,
      load: async () => {
        calls += 1
        if (fail) throw new Error('API down')
        return `v${calls}`
      },
    })
    expect(await get()).toBe('v1')
    fail = true
    clock += HOUR
    expect(await get()).toBe('v1')
    await settle()
    expect(calls).toBe(2)
    clock += MINUTE - 1
    expect(await get()).toBe('v1')
    await settle()
    expect(calls).toBe(2)
    clock += 1
    expect(await get()).toBe('v1')
    await settle()
    expect(calls).toBe(3)
    // Bir gün sonra da eski liste verilir (API'nin uzun kesintisi sayfaları düşürmez).
    clock += 24 * HOUR
    expect(await get()).toBe('v1')
    await settle()
    fail = false
    clock += MINUTE
    expect(await get()).toBe('v1')
    await settle()
    expect(await get()).toBe('v5')
  })

  it('değere göre süre: boş liste yalnız 60 sn tutulur', async () => {
    const values = [[], ['LTFM']]
    let calls = 0
    const get = createMemoryCache<readonly string[]>({
      ...options,
      ttlMs: (value) => (value.length === 0 ? MINUTE : HOUR),
      staleWhileRevalidate: true,
      load: async () => values[Math.min(calls++, values.length - 1)] ?? [],
    })
    expect(await get()).toEqual([])
    clock += MINUTE - 1
    expect(await get()).toEqual([])
    expect(calls).toBe(1)
    clock += 1
    expect(await get()).toEqual([])
    await settle()
    expect(calls).toBe(2)
    expect(await get()).toEqual(['LTFM'])
    clock += HOUR - 1
    expect(await get()).toEqual(['LTFM'])
    expect(calls).toBe(2)
  })

  it('hiç değer yokken çağrı yüklemeyi bekler ve hatasını fırlatır; sonraki çağrı beklemeden yeniden dener', async () => {
    let calls = 0
    const pending = deferred<string>()
    const get = createMemoryCache({
      ...options,
      staleWhileRevalidate: true,
      load: () => {
        calls += 1
        return calls === 1 ? pending.promise : Promise.resolve('v2')
      },
    })
    const first = get()
    const second = get()
    pending.reject(new Error('HTTP 503'))
    await expect(first).rejects.toThrow('HTTP 503')
    await expect(second).rejects.toThrow('HTTP 503')
    expect(calls).toBe(1)
    // Yeniden deneme süresi soğuk yolda beklenmez: sayfa 500'den hemen kurtulur.
    expect(await get()).toBe('v2')
    expect(calls).toBe(2)
  })
})

describe('createMemoryCache: varsayılan (toplu hava, D-090) değişmedi', () => {
  it('süresi dolunca ilk çağrı yenilemeyi bekler; soğuk hata null, fırlatmaz', async () => {
    let version = 0
    const get = createMemoryCache({
      ttlMs: MINUTE,
      retryMs: 15_000,
      maxStaleMs: 10 * MINUTE,
      now,
      load: async () => `v${++version}`,
    })
    expect(await get()).toBe('v1')
    clock += MINUTE
    expect(await get()).toBe('v2')
    const failing = createMemoryCache({
      ttlMs: MINUTE,
      retryMs: 15_000,
      maxStaleMs: 10 * MINUTE,
      now,
      load: () => Promise.reject(new TypeError('fetch failed')),
    })
    expect(await failing()).toBeNull()
  })
})
