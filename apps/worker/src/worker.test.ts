import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'
import { HEALTH_MAX_HEARTBEAT_AGE_MS, healthStatus, type HealthState } from './health'
import { parseRoles, RoleError, WORKER_ROLES } from './roles'

describe('parseRoles', () => {
  it('virgülle ayrılmış rolleri ayrıştırır, tekrarları atar', () => {
    expect(parseRoles('ingest, engine,ingest', 'production')).toEqual(['ingest', 'engine'])
    expect(parseRoles('NOTIFIER,jobs', 'production')).toEqual(['notifier', 'jobs'])
  })

  it('all yerelde bütün rolleri verir, üretimde reddedilir', () => {
    expect(parseRoles('all', 'development')).toEqual([...WORKER_ROLES])
    expect(() => parseRoles('all', 'production')).toThrow(RoleError)
  })

  it('bilinmeyen ya da boş rol hata verir', () => {
    expect(() => parseRoles('ingest,uydurma', 'development')).toThrow(/uydurma/)
    expect(() => parseRoles(' , ', 'development')).toThrow(RoleError)
  })
})

describe('healthStatus', () => {
  const base: HealthState = {
    service: 'worker-rt',
    roles: ['ingest'],
    version: '0.3.0',
    lastHeartbeatAt: null,
    heartbeatRequired: true,
  }
  const now = new Date('2026-09-25T12:00:00Z')

  it('taze heartbeat sağlıklıdır', () => {
    const result = healthStatus({ ...base, lastHeartbeatAt: new Date(now.getTime() - 10_000) }, now)
    expect(result.healthy).toBe(true)
    expect(result.body).toMatchObject({ status: 'ok', heartbeatAgeSec: 10 })
  })

  it('heartbeat hiç yoksa ya da eskiyse sağlıksızdır', () => {
    expect(healthStatus(base, now).healthy).toBe(false)
    const stale = new Date(now.getTime() - HEALTH_MAX_HEARTBEAT_AGE_MS - 1)
    expect(healthStatus({ ...base, lastHeartbeatAt: stale }, now).healthy).toBe(false)
  })

  it('Redis yoksa (yerel) heartbeat beklenmez', () => {
    expect(healthStatus({ ...base, heartbeatRequired: false }, now).healthy).toBe(true)
  })
})

describe('env', () => {
  it('varsayılanlar ve üretim kuralı', () => {
    const parsed = parseEnv({})
    expect(parsed.WORKER_ROLE).toBe('all')
    expect(parsed.WORKER_HEALTH_PORT).toBe(4200)
    expect(parsed.WORKER_SERVICE_NAME).toBe('worker-dev')
    expect(() => parseEnv({ APP_ENV: 'production' })).toThrow(/REDIS_QUEUE_URL/)
    expect(() => parseEnv({ WORKER_SERVICE_NAME: 'Worker RT' })).toThrow()
  })

  it('APP_NAME User-Agent ürün adıdır: varsayılan Airline.live, boşluklu ad reddedilir (D-112)', () => {
    expect(parseEnv({}).APP_NAME).toBe('Airline.live')
    expect(parseEnv({ APP_NAME: '  ' }).APP_NAME).toBe('Airline.live')
    expect(parseEnv({ APP_NAME: ' Deneme.site ' }).APP_NAME).toBe('Deneme.site')
    for (const name of ['Airline Live', 'Airline/live', 'Airline;live', 'Hava(yolu)', 'Çağrı']) {
      expect(() => parseEnv({ APP_NAME: name }), name).toThrow(/APP_NAME: User-Agent ürün adı olur/)
    }
  })

  it('ingest varsayılanları', () => {
    const parsed = parseEnv({})
    expect(parsed.ADSBLOL_RPS).toBe(0.1)
    expect(parsed.WATCH_HEX_LIST).toEqual([])
    expect(parsed.LOCAL_RECEIVER_URLS).toBeUndefined()
    expect(parsed.REDIS_LIVE_URL).toBeUndefined()
    expect(parseEnv({ ADSBLOL_RPS: ' ', WATCH_HEX_LIST: '' }).WATCH_HEX_LIST).toEqual([])
  })

  it('ADSBLOL_RPS 0,05–0,2 dışında hata verir, kırpılmaz', () => {
    expect(parseEnv({ ADSBLOL_RPS: '0.05' }).ADSBLOL_RPS).toBe(0.05)
    expect(parseEnv({ ADSBLOL_RPS: '0.2' }).ADSBLOL_RPS).toBe(0.2)
    for (const value of ['0.3', '0.01', '0', '-0.1']) {
      expect(() => parseEnv({ ADSBLOL_RPS: value })).toThrow(/ADSBLOL_RPS: 0,05–0,2 istek\/sn/)
    }
    expect(() => parseEnv({ ADSBLOL_RPS: 'hızlı' })).toThrow(/ADSBLOL_RPS: sayı olmalı/)
  })

  it('WATCH_HEX_LIST küçük harfe çevrilir ve tekilleşir; hata değeri değil sırayı söyler', () => {
    expect(parseEnv({ WATCH_HEX_LIST: ' 4B8750, 4b8750 ,abcdef,' }).WATCH_HEX_LIST).toEqual([
      '4b8750',
      'abcdef',
    ])
    let message = ''
    try {
      parseEnv({ WATCH_HEX_LIST: 'abcdef,4b875,ZZZZZZ' })
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/WATCH_HEX_LIST: 2, 3\. değer 6 haneli ICAO hex değil/)
    expect(message).not.toMatch(/4b875|zzzzzz/i)
  })

  it('LOCAL_RECEIVER_URLS açılışta doğrulanır; ileti adres ya da token taşımaz', () => {
    expect(
      parseEnv({ LOCAL_RECEIVER_URLS: 'http://127.0.0.1:4300/data/aircraft.json|tok_1' })
        .LOCAL_RECEIVER_URLS,
    ).toBe('http://127.0.0.1:4300/data/aircraft.json|tok_1')
    expect(() => parseEnv({ LOCAL_RECEIVER_URLS: 'ftp://alici/aircraft.json' })).toThrow(
      /LOCAL_RECEIVER_URLS: 1\. alıcı: yalnızca http\(s\) adresi/,
    )
    let message = ''
    try {
      parseEnv({ LOCAL_RECEIVER_URLS: 'http://a/b.json,http://kullanici:gizli@alici/x.json' })
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/LOCAL_RECEIVER_URLS: 2\. alıcı: kimlik bilgisi/)
    expect(message).not.toMatch(/gizli|kullanici/)
  })

  it("REDIS_LIVE_URL'de doldurulmamış parola talimatı hata verir", () => {
    expect(() =>
      parseEnv({ REDIS_LIVE_URL: 'redis://:#parola üret#@hy-redis-live:6379/0' }),
    ).toThrow(/REDIS_LIVE_URL: REDIS_LIVE_PASSWORD doldurulmamış/)
    expect(parseEnv({ REDIS_LIVE_URL: 'redis://:x@localhost:46380/0' }).REDIS_LIVE_URL).toBe(
      'redis://:x@localhost:46380/0',
    )
  })

  it('anahtar ve başlık tutarlılığı env hatası değildir (ingest yapılandırma hatası olur)', () => {
    const parsed = parseEnv({ ADSBLOL_API_KEY: 'k1' })
    expect(parsed.ADSBLOL_API_KEY).toBe('k1')
    expect(parsed.ADSBLOL_API_KEY_HEADER).toBeUndefined()
  })
})
