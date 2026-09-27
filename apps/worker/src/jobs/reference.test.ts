import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { parseEnv } from '../env'
import { JOB_SCHEDULES, referenceMode, userAgent } from './index'
import {
  errorText,
  findFixturesDir,
  fixtureFetcher,
  httpFetcher,
  MAX_REFERENCE_BYTES,
  ReferenceFetchError,
  REFERENCE_URLS,
  runwayInsert,
} from './reference'

interface Call {
  url: string
  headers: Record<string, string>
}

/** Stub fetch: isteği kaydeder, verilen yanıtı döner (canlı istek yok). */
function stubFetch(respond: (call: Call) => Response) {
  const calls: Call[] = []
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), headers: (init?.headers ?? {}) as Record<string, string> }
    calls.push(call)
    return respond(call)
  }) as typeof globalThis.fetch
  return { fetch, calls }
}

describe('httpFetcher', () => {
  const userAgentValue = 'havayolu/0.5.0 (+https://havayolu.live)'

  it('tanımlayıcı User-Agent gönderir; ETag ve Last-Modified döner', async () => {
    const { fetch, calls } = stubFetch(
      () =>
        new Response('a,b\n1,2\n', {
          status: 200,
          headers: { etag: '"v1"', 'last-modified': 'Sat, 26 Sep 2026 03:00:00 GMT' },
        }),
    )
    const result = await httpFetcher({ userAgent: userAgentValue, fetch })('vrs-airlines', null)
    expect(result).toEqual({
      status: 'ok',
      body: 'a,b\n1,2\n',
      etag: '"v1"',
      lastModified: 'Sat, 26 Sep 2026 03:00:00 GMT',
    })
    expect(calls[0]?.url).toBe(REFERENCE_URLS['vrs-airlines'])
    expect(calls[0]?.headers['user-agent']).toBe(userAgentValue)
    expect(calls[0]?.headers['if-none-match']).toBeUndefined()
  })

  it('koşullu istek: If-None-Match ve If-Modified-Since; 304 → değişmedi', async () => {
    const { fetch, calls } = stubFetch(() => new Response(null, { status: 304 }))
    const result = await httpFetcher({ userAgent: userAgentValue, fetch })('ourairports-airports', {
      etag: '"v1"',
      lastModified: 'Sat, 26 Sep 2026 03:00:00 GMT',
    })
    expect(result).toEqual({ status: 'not_modified' })
    expect(calls[0]?.headers).toMatchObject({
      'if-none-match': '"v1"',
      'if-modified-since': 'Sat, 26 Sep 2026 03:00:00 GMT',
    })
  })

  it('200 dışı yanıt ve beklenenden büyük dosya hata verir', async () => {
    const failing = stubFetch(() => new Response('<html>', { status: 503 }))
    await expect(
      httpFetcher({ userAgent: userAgentValue, fetch: failing.fetch })('vrs-airlines', null),
    ).rejects.toThrow(new ReferenceFetchError('vrs-airlines: HTTP 503'))

    const huge = stubFetch(
      () =>
        new Response('x', {
          status: 200,
          headers: { 'content-length': String(MAX_REFERENCE_BYTES + 1) },
        }),
    )
    await expect(
      httpFetcher({ userAgent: userAgentValue, fetch: huge.fetch })('vrs-airlines', null),
    ).rejects.toThrow(/beklenenden büyük/)
  })
})

describe('fixtureFetcher', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hy-fixtures-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('içerik özetini ETag olarak verir; aynı içerik değişmedi sayılır', async () => {
    mkdirSync(join(dir, 'vrs'))
    writeFileSync(join(dir, 'vrs', 'airlines.csv'), 'Code,Name\nTHY,Turkish Airlines\n')
    const fetcher = fixtureFetcher(dir)
    const first = await fetcher('vrs-airlines', null)
    expect(first.status).toBe('ok')
    const etag = first.status === 'ok' ? first.etag : null
    expect(etag).toMatch(/^"fixture-[0-9a-f]{40}"$/)
    expect(await fetcher('vrs-airlines', { etag, lastModified: null })).toEqual({
      status: 'not_modified',
    })
    writeFileSync(join(dir, 'vrs', 'airlines.csv'), 'Code,Name\nTHY,Türk Hava Yolları\n')
    expect((await fetcher('vrs-airlines', { etag, lastModified: null })).status).toBe('ok')
  })

  it('repo kökündeki tools/fixtures bulunur', () => {
    expect(findFixturesDir()).toMatch(/tools[\\/]fixtures$/)
    expect(findFixturesDir(tmpdir())).toBeNull()
  })
})

describe('referenceMode ve User-Agent', () => {
  const env = (vars: Record<string, string>) => parseEnv({ APP_ENV: 'test', ...vars })

  it('dış istek açıksa uzak kaynak; kapalıysa (varsayılan) yerelde fixture, üretimde kapalı', () => {
    expect(
      referenceMode(env({ EXTERNAL_PROVIDERS_DISABLED: 'false' }), '0.5.0', '/fixtures').kind,
    ).toBe('remote')
    // Tanımsızsa dış istek kapalıdır (güvenli varsayılan).
    expect(referenceMode(env({}), '0.5.0', '/fixtures').kind).toBe('fixture')
    expect(
      referenceMode(env({ EXTERNAL_PROVIDERS_DISABLED: 'true' }), '0.5.0', '/fixtures').kind,
    ).toBe('fixture')
    const production = parseEnv({
      APP_ENV: 'production',
      EXTERNAL_PROVIDERS_DISABLED: 'true',
      DATABASE_URL: 'postgres://u:p@db:5432/x',
      REDIS_QUEUE_URL: 'redis://:p@q:6379/0',
    })
    expect(referenceMode(production, '0.5.0', '/fixtures').kind).toBe('disabled')
    expect(referenceMode(env({ EXTERNAL_PROVIDERS_DISABLED: 'true' }), '0.5.0', null).kind).toBe(
      'disabled',
    )
  })

  it('User-Agent ürün adı, sürüm ve site adresini taşır; e-posta yalnızca env verilirse', () => {
    expect(userAgent(env({ WEB_HOST: 'havayolu.live' }), '0.5.0')).toBe(
      'havayolu/0.5.0 (+https://havayolu.live)',
    )
    expect(userAgent(env({}), '0.5.0')).toBe('havayolu/0.5.0')
    expect(
      userAgent(env({ WEB_HOST: 'havayolu.live', CONTACT_EMAIL: 'iletisim@example.com' }), '1'),
    ).toBe('havayolu/1 (+https://havayolu.live; iletisim@example.com)')
  })

  it('zamanlayıcılar UTC ve günde bir kez', () => {
    for (const schedule of Object.values(JOB_SCHEDULES)) {
      expect(schedule.tz).toBe('UTC')
      expect(schedule.pattern).toMatch(/^\d+ \d+ \* \* \*$/)
    }
  })
})

describe('yardımcılar', () => {
  it('errorText sorgu metni yerine PostgreSQL sebebini verir', () => {
    const cause = new Error('null value in column "x" violates not-null constraint')
    const wrapped = new Error('Failed query: insert into ... params: 1,2,3', { cause })
    expect(errorText(wrapped)).toBe(cause.message)
    expect(errorText(new Error('düz'))).toBe('düz')
    expect(errorText('metin')).toBe('metin')
  })

  it('runwayInsert uçları le_/he_ sütunlarına açar', () => {
    const end = (ident: string) => ({
      ident,
      latitudeDeg: 41,
      longitudeDeg: 28.7,
      elevationFt: 300,
      headingDegT: 174,
      displacedThresholdFt: null,
      trueBearingDeg: 179.2,
      bearingSource: 'coordinates' as const,
      headingMismatch: true,
      thresholdLat: 41,
      thresholdLon: 28.7,
      thresholdSource: 'runway_end' as const,
    })
    const row = runwayInsert({
      id: 1,
      airportId: 2,
      airportIdent: 'LTFM',
      lengthFt: 12_303,
      widthFt: 197,
      surface: 'ASP',
      lighted: true,
      endsAreThresholds: false,
      le: end('16L'),
      he: end('34R'),
      rowHash: 'h',
    })
    expect(row).toMatchObject({
      leIdent: '16L',
      heIdent: '34R',
      leHeadingMismatch: true,
      leTrueBearingDeg: 179.2,
      heThresholdSource: 'runway_end',
    })
  })
})
