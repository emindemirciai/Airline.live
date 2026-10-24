import { describe, expect, it } from 'vitest'
import { effectiveLiveScope, EnvError, parseEnv } from './env'

describe('ADSBLOL_DAILY_BUDGET (D-122)', () => {
  it('üretimde de varsayılan 480: şablonda değer yoksa bütçe açıktır', () => {
    const production = parseEnv({
      APP_ENV: 'production',
      REDIS_QUEUE_URL: 'redis://localhost:46379',
      DATABASE_URL: 'postgres://localhost:45432/app',
    })
    expect(production.ADSBLOL_DAILY_BUDGET).toBe(480)
    expect(parseEnv({ ADSBLOL_DAILY_BUDGET: '0' }).ADSBLOL_DAILY_BUDGET).toBe(0)
    expect(() => parseEnv({ ADSBLOL_DAILY_BUDGET: '-5' })).toThrow(EnvError)
    expect(() => parseEnv({ ADSBLOL_DAILY_BUDGET: '0.5' })).toThrow(EnvError)
  })
})

describe('LIVE_AIRCRAFT_SCOPE (D-115)', () => {
  it('üretimde her değer airline sayılır; airline dışındaki değer bir uyarı üretir', () => {
    const long = 'a'.repeat(80)
    const cases: [string | undefined, string | null, string | null][] = [
      [undefined, null, null],
      ['airline', null, 'airline'],
      [' Airline ', null, 'airline'],
      ['all', 'production_forces_airline', 'all'],
      ['xyz', 'production_forces_airline', 'xyz'],
      [long, 'production_forces_airline', '(invalid)'],
      ['all; drop', 'production_forces_airline', '(invalid)'],
    ]
    for (const [value, warning, requested] of cases) {
      expect(
        effectiveLiveScope({ APP_ENV: 'production', LIVE_AIRCRAFT_SCOPE: value }),
        String(value),
      ).toEqual({ scope: 'airline', warning, requested })
    }
  })

  it('üretimde parseEnv hiçbir değerde düşmez (kapsam değeri doğrulanmaz)', () => {
    const production = {
      APP_ENV: 'production',
      REDIS_QUEUE_URL: 'redis://localhost:46379',
      DATABASE_URL: 'postgres://localhost:45432/app',
    }
    for (const value of ['all', 'bogus', 'x'.repeat(80)]) {
      expect(() => parseEnv({ ...production, LIVE_AIRCRAFT_SCOPE: value }), value).not.toThrow()
    }
  })

  it('geliştirme ve testte boşsa all, doluysa verilen değer', () => {
    expect(
      effectiveLiveScope({ APP_ENV: 'development', LIVE_AIRCRAFT_SCOPE: undefined }).scope,
    ).toBe('all')
    expect(effectiveLiveScope({ APP_ENV: 'test', LIVE_AIRCRAFT_SCOPE: undefined }).scope).toBe(
      'all',
    )
    expect(effectiveLiveScope({ APP_ENV: 'development', LIVE_AIRCRAFT_SCOPE: 'airline' })).toEqual({
      scope: 'airline',
      warning: null,
      requested: 'airline',
    })
    expect(effectiveLiveScope({ APP_ENV: 'test', LIVE_AIRCRAFT_SCOPE: 'all' }).scope).toBe('all')
    expect(parseEnv({ LIVE_AIRCRAFT_SCOPE: '' }).LIVE_AIRCRAFT_SCOPE).toBeUndefined()
  })

  it('geliştirme ve testte geçersiz değer açılışta hata verir', () => {
    for (const env of [
      { LIVE_AIRCRAFT_SCOPE: 'bogus' },
      { APP_ENV: 'test', LIVE_AIRCRAFT_SCOPE: 'x' },
    ]) {
      expect(() => parseEnv(env)).toThrow(EnvError)
      expect(() => parseEnv(env)).toThrow(/LIVE_AIRCRAFT_SCOPE: airline ya da all olmalı/)
    }
    expect(parseEnv({ LIVE_AIRCRAFT_SCOPE: ' ALL ' }).LIVE_AIRCRAFT_SCOPE).toBe(' ALL ')
  })
})
