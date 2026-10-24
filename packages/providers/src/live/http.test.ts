import { describe, expect, it } from 'vitest'
import { dailyQuota, parseRateLimitHeaders } from './http'

/** adsb.lol'ün 2026-10-24'te gönderdiği başlık (docs/plans/parca-1.md, M7e). */
const ADSBLOL_LIMIT = '4, 4;w=1, 60;w=60, 500;w=86400'
const NOW = Date.UTC(2026, 9, 24, 1, 46)

const headers = (init: Record<string, string>) => new Headers(init)

describe('parseRateLimitHeaders', () => {
  it('adsb.lol başlığı: sınır 4, politikalar 4/1 sn, 60/60 sn, 500/gün; günlük kota 500', () => {
    const info = parseRateLimitHeaders(
      headers({
        'x-ratelimit-limit': ADSBLOL_LIMIT,
        'x-ratelimit-remaining': '3',
        'x-ratelimit-reset': '1',
      }),
      NOW,
    )
    expect(info).toEqual({
      limit: 4,
      policies: [
        { quota: 4, windowS: 1 },
        { quota: 60, windowS: 60 },
        { quota: 500, windowS: 86_400 },
      ],
      remaining: 3,
      resetS: 1,
    })
    expect(dailyQuota(info)).toBe(500)
  })

  it('kalan ve sıfırlama yoksa null; sıfırlama Unix zamanıysa kalan süreye çevrilir', () => {
    const bare = parseRateLimitHeaders(headers({ 'x-ratelimit-limit': ADSBLOL_LIMIT }), NOW)
    expect(bare).toMatchObject({ remaining: null, resetS: null })
    const epoch = parseRateLimitHeaders(
      headers({
        'x-ratelimit-limit': ADSBLOL_LIMIT,
        'x-ratelimit-reset': String(Math.floor(NOW / 1000) + 3_600),
      }),
      NOW,
    )
    expect(epoch?.resetS).toBe(3_600)
    // Geçmişteki Unix zamanı 0 sn'ye kırpılır.
    const past = parseRateLimitHeaders(
      headers({ 'x-ratelimit-limit': '500;w=86400', 'x-ratelimit-reset': '1700000000' }),
      NOW,
    )
    expect(past?.resetS).toBe(0)
    // Bozuk kalan ve sıfırlama değerleri tek başına null olur; sınır yine okunur.
    const odd = parseRateLimitHeaders(
      headers({
        'x-ratelimit-limit': ADSBLOL_LIMIT,
        'x-ratelimit-remaining': '-1',
        'x-ratelimit-reset': 'yakinda',
      }),
      NOW,
    )
    expect(odd).toMatchObject({ limit: 4, remaining: null, resetS: null })
  })

  it('ratelimit-* adları (önek yok) ve ratelimit-policy okunur; politika tekrarı eklenmez', () => {
    const info = parseRateLimitHeaders(
      headers({
        'ratelimit-limit': '60',
        'ratelimit-remaining': '12',
        'ratelimit-reset': '30',
        'ratelimit-policy': '60;w=60, 1000;w=86400;comment="gunluk", 60;w=60',
      }),
      NOW,
    )
    expect(info).toEqual({
      limit: 60,
      policies: [
        { quota: 60, windowS: 60 },
        { quota: 1000, windowS: 86_400 },
      ],
      remaining: 12,
      resetS: 30,
    })
    expect(dailyQuota(info)).toBe(1000)
  })

  it('x-ratelimit-* varsa ratelimit-* okunmaz', () => {
    const info = parseRateLimitHeaders(
      headers({ 'x-ratelimit-limit': '500;w=86400', 'ratelimit-limit': '5;w=86400' }),
      NOW,
    )
    expect(dailyQuota(info)).toBe(500)
    // Pencere parametresiz değer yoksa sınır ilk politikanın kotasıdır.
    expect(info?.limit).toBe(500)
  })

  it('bozuk sınır başlığı null döner (yarım bilgiyle karar verilmez)', () => {
    for (const value of [
      '',
      ' ',
      'cok',
      '4, x;w=1',
      '4, 4;w=0',
      '4, 4;w=-1',
      '4, 4;w',
      '-4',
      '4.5;w=1',
      ', 4;w=1',
    ]) {
      expect(parseRateLimitHeaders(headers({ 'x-ratelimit-limit': value }), NOW), value).toBeNull()
    }
    expect(parseRateLimitHeaders(headers({}), NOW)).toBeNull()
    expect(parseRateLimitHeaders(headers({ 'x-ratelimit-remaining': '3' }), NOW)).toBeNull()
  })
})

describe('dailyQuota', () => {
  it('her politikanın güne çevrilmiş kotasının en küçüğü; politika yoksa null', () => {
    expect(dailyQuota(null)).toBeNull()
    expect(dailyQuota({ limit: 4, policies: [], remaining: null, resetS: null })).toBeNull()
    expect(
      dailyQuota({
        limit: 10,
        policies: [
          { quota: 10, windowS: 1 },
          { quota: 100, windowS: 3_600 },
        ],
        remaining: null,
        resetS: null,
      }),
    ).toBe(2_400)
    // Günden uzun pencere günlük ortalamaya iner (aşağı yuvarlanır).
    expect(
      dailyQuota({
        limit: 15_000,
        policies: [{ quota: 15_000, windowS: 30 * 86_400 }],
        remaining: null,
        resetS: null,
      }),
    ).toBe(500)
  })
})
