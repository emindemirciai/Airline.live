import { describe, expect, it } from 'vitest'
import { hourStart } from './ingest'
import type { Redis } from 'ioredis'
import {
  clearLiveAircraft,
  compactAircraft,
  LIVE_KEYS,
  parseCoverage,
  parseScoredMembers,
  writeLiveUpdates,
  type CoverageCircle,
  type LiveAircraftInput,
} from './live'

const base: LiveAircraftInput = {
  hex: '4bb463',
  lat: 41.2748739,
  lon: 28.7321363,
  altBaroFt: 3025,
  onGround: false,
  gsKt: 182.6,
  trackDeg: 354.4,
  sampleTime: 1_790_000_000_500,
  dbFlags: 0,
}

describe('compactAircraft', () => {
  it('koordinatı 5 ondalığa, hızı ve yönü tam sayıya yuvarlar', () => {
    expect(compactAircraft(base)).toEqual([
      '4bb463',
      41.27487,
      28.73214,
      3025,
      0,
      183,
      354,
      1_790_000_000_500,
      0,
    ])
  })

  it('bilinmeyen değerler null kalır; yerdeki uçak 1 olur', () => {
    expect(
      compactAircraft({
        ...base,
        altBaroFt: null,
        onGround: true,
        gsKt: null,
        trackDeg: null,
        dbFlags: null,
      }),
    ).toEqual(['4bb463', 41.27487, 28.73214, null, 1, null, null, 1_790_000_000_500, null])
  })

  it('yuvarlanınca 360 olan yön 0 yazılır; negatif koordinat korunur', () => {
    const tuple = compactAircraft({ ...base, trackDeg: 359.7, lat: -12.345678, lon: -0.000004 })
    expect(tuple[6]).toBe(0)
    expect(tuple[1]).toBe(-12.34568)
    expect(Math.abs(tuple[2])).toBe(0)
  })

  it('sonlu olmayan irtifa ve hız boş yazılır', () => {
    const tuple = compactAircraft({ ...base, altBaroFt: Number.NaN, gsKt: Infinity })
    expect(tuple[3]).toBeNull()
    expect(tuple[5]).toBeNull()
  })
})

describe('LIVE_KEYS', () => {
  it('bütün anahtarlar projenin hy: önekini taşır', () => {
    expect(LIVE_KEYS.aircraft('abc123')).toBe('hy:ac:abc123')
    expect(LIVE_KEYS.provider('adsbLol')).toBe('hy:provider:adsbLol')
    for (const key of [
      LIVE_KEYS.geo,
      LIVE_KEYS.seen,
      LIVE_KEYS.updates,
      LIVE_KEYS.batch,
      LIVE_KEYS.regions,
      LIVE_KEYS.coverage,
    ]) {
      expect(key.startsWith('hy:')).toBe(true)
    }
    expect(LIVE_KEYS.coverage).toBe('hy:ingest:coverage')
  })
})

describe('parseCoverage', () => {
  const west: CoverageCircle = { id: 'west', kind: 'west', lat: 39.5, lon: 30.1, radiusNm: 250 }
  const primary: CoverageCircle = {
    id: 'primary',
    kind: 'primary',
    lat: 41.274874,
    lon: 28.732136,
    radiusNm: 40,
  }

  it('geçerli çemberleri döndürür; fazla alanlar atılır; boş dizi geçerlidir', () => {
    expect(parseCoverage(JSON.stringify([west, { ...primary, covers: ['LTFM'] }]))).toEqual([
      west,
      primary,
    ])
    expect(parseCoverage('[]')).toEqual([])
  })

  it('kayıt yoksa, JSON bozuksa ya da dizi değilse null', () => {
    expect(parseCoverage(null)).toBeNull()
    expect(parseCoverage('')).toBeNull()
    expect(parseCoverage('{"id":"west"}')).toBeNull()
    expect(parseCoverage('[{"id":"west"')).toBeNull()
    expect(parseCoverage('null')).toBeNull()
  })

  it('tek bir bozuk çember bütün kaydı geçersiz kılar', () => {
    const bad: unknown[] = [
      null,
      'west',
      [west],
      { ...west, id: 7 },
      { ...west, kind: null },
      { ...west, lat: 91 },
      { ...west, lat: '39.5' },
      { ...west, lon: -180.5 },
      { ...west, radiusNm: 0 },
      { ...west, radiusNm: -5 },
      { ...west, radiusNm: '40' },
      { id: 'west', kind: 'west', lat: 39.5, lon: 30.1 },
    ]
    for (const item of bad) {
      expect(parseCoverage(JSON.stringify([primary, item]))).toBeNull()
    }
    // JSON'da NaN ve ∞ null olur; o da reddedilir.
    expect(parseCoverage(JSON.stringify([{ ...west, radiusNm: Infinity }]))).toBeNull()
  })

  it('sınırdaki koordinatlar geçerlidir', () => {
    const edge = { id: 'x', kind: 'station', lat: -90, lon: 180, radiusNm: 0.5 }
    expect(parseCoverage(JSON.stringify([edge]))).toEqual([edge])
  })
})

describe('parseScoredMembers', () => {
  it('düz WITHSCORES yanıtını çiftlere çevirir; sayı olmayan skor ve eksik çift atlanır', () => {
    expect(
      parseScoredMembers(['4bb463', '1790000000000', '~2c3a4f', '1790000000500', 'bad001', 'x']),
    ).toEqual([
      { hex: '4bb463', sampleTime: 1_790_000_000_000 },
      { hex: '~2c3a4f', sampleTime: 1_790_000_000_500 },
    ])
    expect(parseScoredMembers(['4bb463'])).toEqual([])
    expect(parseScoredMembers([])).toEqual([])
  })
})

describe('hourStart', () => {
  it('UTC saat başına indirir', () => {
    expect(hourStart(new Date('2026-01-20T10:59:59.999Z')).toISOString()).toBe(
      '2026-01-20T10:00:00.000Z',
    )
    expect(hourStart(new Date('2026-01-20T10:00:00.000Z')).toISOString()).toBe(
      '2026-01-20T10:00:00.000Z',
    )
  })
})

/** Pipeline komutlarını sırasıyla kaydeden sahte Redis (canlı istek yok). */
function recordingRedis() {
  const commands: string[] = []
  const pipeline = new Proxy(
    {},
    {
      get(_target, name: string) {
        if (name === 'exec') return async () => commands.map(() => [null, 1])
        return (...args: unknown[]) => {
          commands.push(`${name} ${args.map(String).join(' ')}`)
          return pipeline
        }
      },
    },
  )
  const calls: string[] = []
  const redis = {
    pipeline: () => pipeline,
    eval: async (...args: unknown[]) => {
      calls.push(`eval ${args.slice(1).map(String).join(' ')}`)
      return 3
    },
    del: async (...keys: string[]) => {
      calls.push(`del ${keys.join(' ')}`)
      return 1
    },
  } as unknown as Redis
  return { redis, commands, calls }
}

describe('writeLiveUpdates (çekilen uçaklar)', () => {
  it('çekilenler güncellemelerden sonra seen, geo ve hash’ten silinir', async () => {
    const { redis, commands } = recordingRedis()
    await writeLiveUpdates(redis, [base], ['4bb464', '4bb465'])
    const names = commands.map((c) => c.split(' ')[0])
    const lastUpdate = names.lastIndexOf('publish')
    const firstRemoval = commands.findIndex((c) => c === 'zrem hy:ac:seen 4bb464 4bb465')
    expect(lastUpdate).toBeGreaterThanOrEqual(0)
    expect(firstRemoval).toBeGreaterThan(lastUpdate)
    expect(commands.slice(firstRemoval)).toEqual([
      'zrem hy:ac:seen 4bb464 4bb465',
      'zrem hy:ac:geo 4bb464 4bb465',
      'del hy:ac:4bb464 hy:ac:4bb465',
    ])
  })

  it('yalnızca çekilen varsa güncelleme ve yayın yoktur; ikisi de boşsa hiçbir komut yok', async () => {
    const only = recordingRedis()
    await writeLiveUpdates(only.redis, [], ['4bb464'])
    expect(only.commands).toEqual([
      'zrem hy:ac:seen 4bb464',
      'zrem hy:ac:geo 4bb464',
      'del hy:ac:4bb464',
    ])
    const none = recordingRedis()
    await writeLiveUpdates(none.redis, [], [])
    expect(none.commands).toEqual([])
  })
})

describe('clearLiveAircraft', () => {
  it('süpürmeyi +inf sınırıyla çalıştırır, sonra güncelleme stream’ini siler', async () => {
    const { redis, calls } = recordingRedis()
    expect(await clearLiveAircraft(redis)).toBe(3)
    expect(calls).toEqual([
      `eval 2 ${LIVE_KEYS.seen} ${LIVE_KEYS.geo} +inf hy:ac:`,
      'del hy:ac:updates',
    ])
  })
})
