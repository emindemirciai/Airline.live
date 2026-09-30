import { afterEach, describe, expect, it, vi } from 'vitest'
import { getServerEnv } from './env'
import type { MapEnvInput } from './map-config'

// `server-only` istemci paketlerinde hata fırlatır; testte sunucu modülü olarak yüklenir.
vi.mock('server-only', () => ({}))

const MAP_KEYS = [
  'API_HOST',
  'MAP_STYLE_URL',
  'MAP_STYLE_URL_DARK',
  'MAP_STYLE_FALLBACK_URL',
  'EXTERNAL_PROVIDERS_DISABLED',
  'ESRI_API_KEY',
] as const

function withEnv(values: Partial<Record<(typeof MAP_KEYS)[number], string>>) {
  for (const key of MAP_KEYS) vi.stubEnv(key, values[key] ?? '')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getServerEnv — harita alanları', () => {
  it('boş değerlerde yerel varsayılanları kullanır', () => {
    withEnv({})
    const env = getServerEnv()
    expect(env.API_HOST).toBe('localhost:4100')
    expect(env.MAP_STYLE_URL).toBe('/test-style.json')
    expect(env.MAP_STYLE_URL_DARK).toBeUndefined()
    expect(env.MAP_STYLE_FALLBACK_URL).toBeUndefined()
    expect(env.EXTERNAL_PROVIDERS_DISABLED).toBe(false)
    expect(env.ESRI_API_KEY).toBeUndefined()
  })

  it('üretim değerlerini okur; sonuç resolveMapConfig girdisine uyar', () => {
    withEnv({
      API_HOST: 'api.havayolu.live',
      MAP_STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',
      MAP_STYLE_URL_DARK: 'https://tiles.openfreemap.org/styles/dark',
      EXTERNAL_PROVIDERS_DISABLED: 'false',
      ESRI_API_KEY: '  test-only-not-a-key_1.2~3+4/5=  ',
    })
    const env = getServerEnv()
    const input: MapEnvInput = env
    expect(input.API_HOST).toBe('api.havayolu.live')
    expect(input.MAP_STYLE_URL_DARK).toBe('https://tiles.openfreemap.org/styles/dark')
    expect(input.EXTERNAL_PROVIDERS_DISABLED).toBe(false)
    expect(input.ESRI_API_KEY).toBe('test-only-not-a-key_1.2~3+4/5=')
  })

  it('EXTERNAL_PROVIDERS_DISABLED true/1 yazımlarını kabul eder', () => {
    for (const value of ['true', 'TRUE', ' 1 ']) {
      withEnv({ EXTERNAL_PROVIDERS_DISABLED: value })
      expect(getServerEnv().EXTERNAL_PROVIDERS_DISABLED).toBe(true)
    }
    withEnv({ EXTERNAL_PROVIDERS_DISABLED: '0' })
    expect(getServerEnv().EXTERNAL_PROVIDERS_DISABLED).toBe(false)
  })

  it('localhost, IP ve IPv6 host biçimlerini kabul eder', () => {
    for (const host of ['localhost:4100', '127.0.0.1:4100', '[::1]:4100', 'api.havayolu.live']) {
      withEnv({ API_HOST: host })
      expect(getServerEnv().API_HOST).toBe(host)
    }
  })

  it('hatalı değerlerde açıklayıcı hata verir', () => {
    const bad: Partial<Record<(typeof MAP_KEYS)[number], string>>[] = [
      { API_HOST: 'https://api.havayolu.live' },
      { API_HOST: 'api.havayolu.live/v1' },
      { MAP_STYLE_URL: '//evil.example/style.json' },
      { MAP_STYLE_URL: 'styles/dark' },
      { MAP_STYLE_URL_DARK: 'javascript:alert(1)' },
      { EXTERNAL_PROVIDERS_DISABLED: 'yes' },
      { ESRI_API_KEY: 'abc def' },
      { ESRI_API_KEY: 'a&b' },
      { ESRI_API_KEY: 'a'.repeat(513) },
    ]
    for (const values of bad) {
      withEnv(values)
      expect(() => getServerEnv(), JSON.stringify(values)).toThrow(/Web ortam değişkenleri hatalı/)
    }
  })

  it('şablon yer tutucusu (#…#) tanımsız sayılır', () => {
    withEnv({ ESRI_API_KEY: '#kullanıcı girer (isteğe bağlı)#' })
    expect(getServerEnv().ESRI_API_KEY).toBeUndefined()
  })
})

const SITE_KEYS = [
  'APP_ENV',
  'WEB_HOST',
  'GOOGLE_SITE_VERIFICATION',
  'BING_SITE_VERIFICATION',
  'YANDEX_VERIFICATION',
] as const

function withSiteEnv(values: Partial<Record<(typeof SITE_KEYS)[number], string>>) {
  withEnv({})
  for (const key of SITE_KEYS) {
    vi.stubEnv(key, values[key] ?? (key === 'APP_ENV' ? 'development' : ''))
  }
}

describe('getServerEnv — site alanları', () => {
  it('WEB_HOST geliştirmede isteğe bağlıdır; kırpılıp küçük harfe çevrilir', () => {
    withSiteEnv({ APP_ENV: 'development' })
    expect(getServerEnv().WEB_HOST).toBeUndefined()
    withSiteEnv({ APP_ENV: 'test', WEB_HOST: ' HavaYolu.live ' })
    expect(getServerEnv().WEB_HOST).toBe('havayolu.live')
    withSiteEnv({ WEB_HOST: 'localhost:3100' })
    expect(getServerEnv().WEB_HOST).toBe('localhost:3100')
  })

  it('WEB_HOST üretimde zorunludur', () => {
    withSiteEnv({ APP_ENV: 'production' })
    expect(() => getServerEnv()).toThrow(/WEB_HOST: üretimde zorunlu/)
    withSiteEnv({ APP_ENV: 'production', WEB_HOST: '#kullanıcı yazar#' })
    expect(() => getServerEnv()).toThrow(/WEB_HOST/)
    withSiteEnv({ APP_ENV: 'production', WEB_HOST: 'havayolu.live' })
    expect(getServerEnv().WEB_HOST).toBe('havayolu.live')
  })

  it('WEB_HOST şemasız bir host olmalıdır', () => {
    for (const host of ['https://havayolu.live', 'havayolu.live/en', 'havayolu live']) {
      withSiteEnv({ WEB_HOST: host })
      expect(() => getServerEnv(), host).toThrow(/Web ortam değişkenleri hatalı: WEB_HOST/)
    }
  })

  it('doğrulama kodları isteğe bağlıdır; boş değer tanımsız sayılır', () => {
    withSiteEnv({})
    const env = getServerEnv()
    expect(env.GOOGLE_SITE_VERIFICATION).toBeUndefined()
    expect(env.BING_SITE_VERIFICATION).toBeUndefined()
    expect(env.YANDEX_VERIFICATION).toBeUndefined()
  })

  it('doğrulama kodlarını okur', () => {
    withSiteEnv({
      GOOGLE_SITE_VERIFICATION: ' test-only_Google-1 ',
      BING_SITE_VERIFICATION: 'TESTONLYBING0123',
      YANDEX_VERIFICATION: 'a'.repeat(128),
    })
    const env = getServerEnv()
    expect(env.GOOGLE_SITE_VERIFICATION).toBe('test-only_Google-1')
    expect(env.BING_SITE_VERIFICATION).toBe('TESTONLYBING0123')
    expect(env.YANDEX_VERIFICATION).toBe('a'.repeat(128))
  })

  it('hatalı doğrulama kodunu reddeder', () => {
    for (const value of ['a b', '<meta>', 'a"b', 'a.b', 'a'.repeat(129)]) {
      withSiteEnv({ GOOGLE_SITE_VERIFICATION: value })
      expect(() => getServerEnv(), value).toThrow(/GOOGLE_SITE_VERIFICATION/)
    }
    withSiteEnv({ YANDEX_VERIFICATION: 'x/y' })
    expect(() => getServerEnv()).toThrow(/YANDEX_VERIFICATION/)
  })
})
