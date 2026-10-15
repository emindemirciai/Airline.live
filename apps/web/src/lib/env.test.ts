import { afterEach, describe, expect, it, vi } from 'vitest'
import { getServerEnv, metaTagContent } from './env'
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
      API_HOST: 'api.airline.live',
      MAP_STYLE_URL: 'https://tiles.openfreemap.org/styles/liberty',
      MAP_STYLE_URL_DARK: 'https://tiles.openfreemap.org/styles/dark',
      EXTERNAL_PROVIDERS_DISABLED: 'false',
      ESRI_API_KEY: '  test-only-not-a-key_1.2~3+4/5=  ',
    })
    const env = getServerEnv()
    const input: MapEnvInput = env
    expect(input.API_HOST).toBe('api.airline.live')
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
    for (const host of ['localhost:4100', '127.0.0.1:4100', '[::1]:4100', 'api.airline.live']) {
      withEnv({ API_HOST: host })
      expect(getServerEnv().API_HOST).toBe(host)
    }
  })

  it('hatalı değerlerde açıklayıcı hata verir', () => {
    const bad: Partial<Record<(typeof MAP_KEYS)[number], string>>[] = [
      { API_HOST: 'https://api.airline.live' },
      { API_HOST: 'api.airline.live/v1' },
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
    withSiteEnv({ APP_ENV: 'test', WEB_HOST: ' AirLine.live ' })
    expect(getServerEnv().WEB_HOST).toBe('airline.live')
    withSiteEnv({ WEB_HOST: 'localhost:3100' })
    expect(getServerEnv().WEB_HOST).toBe('localhost:3100')
  })

  it('WEB_HOST üretimde zorunludur', () => {
    withSiteEnv({ APP_ENV: 'production' })
    expect(() => getServerEnv()).toThrow(/WEB_HOST: üretimde zorunlu/)
    withSiteEnv({ APP_ENV: 'production', WEB_HOST: '#kullanıcı yazar#' })
    expect(() => getServerEnv()).toThrow(/WEB_HOST/)
    withSiteEnv({ APP_ENV: 'production', WEB_HOST: 'airline.live' })
    expect(getServerEnv().WEB_HOST).toBe('airline.live')
  })

  it('WEB_HOST şemasız bir host olmalıdır', () => {
    for (const host of ['https://airline.live', 'airline.live/en', 'havayolu live']) {
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

  it('arama motorunun verdiği tam meta etiketinden content değerini alır (D-117)', () => {
    withSiteEnv({
      GOOGLE_SITE_VERIFICATION:
        ' <meta name="google-site-verification" content="test-only_Google-1" /> ',
      BING_SITE_VERIFICATION: '<meta name="msvalidate.01" content="TESTONLYBING0123" />',
      YANDEX_VERIFICATION: "<META CONTENT='testonly0123abcd' NAME='yandex-verification'>",
    })
    const env = getServerEnv()
    expect(env.GOOGLE_SITE_VERIFICATION).toBe('test-only_Google-1')
    expect(env.BING_SITE_VERIFICATION).toBe('TESTONLYBING0123')
    expect(env.YANDEX_VERIFICATION).toBe('testonly0123abcd')
    // Dokploy'a yapıştırılan biçim (2026-10-15): eğik çizgi `>`'ye bitişik.
    withSiteEnv({
      GOOGLE_SITE_VERIFICATION: '<meta name="google-site-verification" content="test-only_G"/>',
    })
    expect(getServerEnv().GOOGLE_SITE_VERIFICATION).toBe('test-only_G')
  })

  it('içindeki değer kod değilse meta etiketini de reddeder (D-117)', () => {
    for (const value of [
      '<meta name="google-site-verification">',
      '<meta name="google-site-verification" content="">',
      '<meta name="google-site-verification" content="a b">',
      '<meta name="google-site-verification" content="a.b">',
      `<meta name="google-site-verification" content="${'a'.repeat(129)}">`,
      '<meta name="google-site-verification" content="abc"> sonra',
      '<meta name="google-site-verification" content="abc" "fazla">',
      '<metadata content="abc">',
      '<script content="abc"></script>',
      'content="abc"',
    ]) {
      withSiteEnv({ GOOGLE_SITE_VERIFICATION: value })
      expect(() => getServerEnv(), value).toThrow(/GOOGLE_SITE_VERIFICATION/)
    }
  })
})

describe('metaTagContent (D-117)', () => {
  it('öznitelik sırası, tırnak biçimi ve büyük-küçük harf fark etmez', () => {
    for (const [tag, content] of [
      ['<meta name="google-site-verification" content="abc-1_X" />', 'abc-1_X'],
      ['<meta content="abc" name="google-site-verification">', 'abc'],
      ["<meta name='msvalidate.01' content='ABC123'/>", 'ABC123'],
      ['<META NAME="yandex-verification" CONTENT="0a1b">', '0a1b'],
      ['<meta name=google-site-verification content=abc>', 'abc'],
      ['<meta\n  name="google-site-verification"\n  content = " abc "\n/>', 'abc'],
      ['<meta content="first" content="second">', 'first'],
      ['<meta data-content="x" content="abc">', 'abc'],
      ['<meta name="google-site-verification" content="">', ''],
      ['<meta content>', ''],
    ] as const) {
      expect(metaTagContent(tag), tag).toBe(content)
    }
  })

  it('etiket değilse, content yoksa ya da öznitelikler çözülemiyorsa undefined', () => {
    for (const value of [
      'abc',
      '',
      '<meta>',
      '<meta />',
      '<meta name="google-site-verification">',
      '<meta content="abc" "x">',
      '<meta content="abc"> x',
      'x <meta content="abc">',
      '<metadata content="abc">',
      '<link content="abc">',
    ]) {
      expect(metaTagContent(value), value).toBeUndefined()
    }
  })
})

describe('getServerEnv — eski alan adları (D-112)', () => {
  const LEGACY_KEYS = [
    'WEB_HOST',
    'ADMIN_HOST',
    'API_HOST',
    'LEGACY_WEB_HOSTS',
    'LEGACY_ADMIN_HOSTS',
  ] as const
  const PRODUCTION = {
    WEB_HOST: 'airline.live',
    ADMIN_HOST: 'admin.airline.live',
    API_HOST: 'api.airline.live',
  }

  function withLegacyEnv(values: Partial<Record<(typeof LEGACY_KEYS)[number], string>>) {
    withSiteEnv({})
    for (const key of LEGACY_KEYS) vi.stubEnv(key, values[key] ?? '')
  }

  it('boşsa iki liste de boştur (yerel geliştirme ve geçişten önceki üretim)', () => {
    withLegacyEnv({})
    const env = getServerEnv()
    expect(env.LEGACY_WEB_HOSTS).toEqual([])
    expect(env.LEGACY_ADMIN_HOSTS).toEqual([])
    withLegacyEnv({ LEGACY_WEB_HOSTS: '#boş bırak#', LEGACY_ADMIN_HOSTS: ' , ' })
    expect(getServerEnv().LEGACY_WEB_HOSTS).toEqual([])
    expect(getServerEnv().LEGACY_ADMIN_HOSTS).toEqual([])
  })

  it('listeleri kırpar, küçük harfe çevirir, tekilleştirir', () => {
    withLegacyEnv({
      ...PRODUCTION,
      LEGACY_WEB_HOSTS: ' Havayolu.Live , www.havayolu.live, havayolu.live ',
      LEGACY_ADMIN_HOSTS: 'ADMIN.havayolu.live',
    })
    const env = getServerEnv()
    expect(env.LEGACY_WEB_HOSTS).toEqual(['havayolu.live', 'www.havayolu.live'])
    expect(env.LEGACY_ADMIN_HOSTS).toEqual(['admin.havayolu.live'])
  })

  it('geçersiz girdiyi reddeder: şema, yol, IP ve tek parçalı ad', () => {
    for (const value of [
      'https://havayolu.live',
      'havayolu.live/en',
      '127.0.0.1',
      'localhost',
      'hy-web',
    ]) {
      withLegacyEnv({ ...PRODUCTION, LEGACY_WEB_HOSTS: value })
      expect(() => getServerEnv(), value).toThrow(/LEGACY_WEB_HOSTS/)
    }
  })

  it('hedefsiz liste reddedilir', () => {
    withLegacyEnv({ LEGACY_WEB_HOSTS: 'havayolu.live' })
    expect(() => getServerEnv()).toThrow(/LEGACY_WEB_HOSTS: WEB_HOST tanımlı olmalı/)
    withLegacyEnv({ WEB_HOST: 'airline.live', LEGACY_ADMIN_HOSTS: 'admin.havayolu.live' })
    expect(() => getServerEnv()).toThrow(/LEGACY_ADMIN_HOSTS: ADMIN_HOST tanımlı olmalı/)
  })

  it('yeni host’ları kapsayan ya da iki listede birden olan girdi reddedilir (döngü)', () => {
    for (const value of [
      'airline.live',
      'www.airline.live',
      'admin.airline.live',
      'api.airline.live',
    ]) {
      withLegacyEnv({ ...PRODUCTION, LEGACY_WEB_HOSTS: value })
      expect(() => getServerEnv(), value).toThrow(/yönlendirme döngüye girer/)
    }
    withLegacyEnv({
      ...PRODUCTION,
      LEGACY_WEB_HOSTS: 'havayolu.live',
      LEGACY_ADMIN_HOSTS: 'havayolu.live',
    })
    expect(() => getServerEnv()).toThrow(/iki listede birden/)
  })
})
