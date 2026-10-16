import { describe, expect, it } from 'vitest'
import {
  hostMatches,
  hostOrigin,
  isLegacyHostEntry,
  legacyRedirectLocation,
  normalizeHost,
  parseLegacyHosts,
  PUBLIC_HOST,
  splitHostList,
} from './hosts'
import { DEFAULT_APP_NAME } from './project'

describe('normalizeHost', () => {
  it('kırpar, küçük harfe çevirir, addaki sondaki noktayı atar; port kalır', () => {
    expect(normalizeHost(' Old.Example. ')).toBe('old.example')
    expect(normalizeHost('OLD.EXAMPLE.:443')).toBe('old.example:443')
    expect(normalizeHost('[::1]:3100')).toBe('[::1]:3100')
    expect(normalizeHost('')).toBe('')
    expect(normalizeHost(null)).toBe('')
    expect(normalizeHost(undefined)).toBe('')
  })
})

describe('isLegacyHostEntry', () => {
  it('iki ya da daha çok parçalı alan adını (isteğe bağlı portla) kabul eder', () => {
    for (const host of [
      'old.example',
      'www.old.example',
      'admin.old.example',
      'old.example:8443',
    ]) {
      expect(isLegacyHostEntry(host), host).toBe(true)
    }
  })

  it('IP adresi, tek parçalı ad, şema, yol ve boşluk olamaz', () => {
    for (const host of [
      'localhost',
      'localhost:3100',
      'hy-api',
      'hy-web:3000',
      '127.0.0.1',
      '10.0.0.5:4000',
      '[::1]',
      '[::1]:4100',
      'https://old.example',
      'old.example/en',
      'old example',
      'old..example',
      '',
    ]) {
      expect(isLegacyHostEntry(host), host).toBe(false)
    }
  })
})

describe('splitHostList ve parseLegacyHosts', () => {
  it('virgülle böler, kırpar, küçük harfe çevirir, tekilleştirir; boşlar atılır', () => {
    expect(splitHostList(' Old.Example , www.old.example,,old.example ')).toEqual([
      'old.example',
      'www.old.example',
    ])
  })

  it('tanımsız değer, boş metin ve #…# talimatı boş listedir', () => {
    expect(splitHostList(undefined)).toEqual([])
    expect(splitHostList('')).toEqual([])
    expect(splitHostList('#boş bırak#')).toEqual([])
  })

  it('hoşgörülü okuma geçersiz girdileri atlar', () => {
    expect(parseLegacyHosts('old.example, localhost, hy-api, 127.0.0.1, www.old.example')).toEqual([
      'old.example',
      'www.old.example',
    ])
  })
})

describe('hostMatches', () => {
  it('portsuz girdi her portu, portlu girdi yalnızca kendi portunu kapsar', () => {
    expect(hostMatches('old.example', 'old.example')).toBe(true)
    expect(hostMatches('old.example', 'OLD.EXAMPLE:443')).toBe(true)
    expect(hostMatches('old.example', 'old.example.')).toBe(true)
    expect(hostMatches('old.example:8443', 'old.example:8443')).toBe(true)
    expect(hostMatches('old.example:8443', 'old.example')).toBe(false)
    expect(hostMatches('old.example', 'www.old.example')).toBe(false)
    expect(hostMatches('old.example', 'sub-old.example')).toBe(false)
    expect(hostMatches('old.example', null)).toBe(false)
    expect(hostMatches('', 'old.example')).toBe(false)
  })
})

describe('hostOrigin', () => {
  it('yerel adlarda http, diğerlerinde https', () => {
    expect(hostOrigin('airline.live')).toBe('https://airline.live')
    expect(hostOrigin('localhost:3100')).toBe('http://localhost:3100')
    expect(hostOrigin('127.0.0.1:4100')).toBe('http://127.0.0.1:4100')
    expect(hostOrigin('[::1]:3100')).toBe('http://[::1]:3100')
  })
})

describe('legacyRedirectLocation', () => {
  const legacyHosts = ['old.example', 'www.old.example']
  const redirect = (requestHost: string | null, pathAndQuery = '/', target = 'new.example') =>
    legacyRedirectLocation({ legacyHosts, target, requestHost, pathAndQuery })

  it('eski host’a gelen isteği yol ve sorguyla yeni host’a yönlendirir', () => {
    expect(redirect('old.example', '/en/havalimanlari?x=1&y=2')).toBe(
      'https://new.example/en/havalimanlari?x=1&y=2',
    )
    expect(redirect('www.old.example', '/istasyon/LTFM')).toBe('https://new.example/istasyon/LTFM')
    expect(redirect('OLD.Example:443', '/?hex=4bb001')).toBe('https://new.example/?hex=4bb001')
  })

  it('adres istekten değil hedeften kurulur; origin-form olmayan hedef köke gider', () => {
    expect(redirect('old.example', '//evil.example/x')).toBe('https://new.example//evil.example/x')
    expect(redirect('old.example', 'http://evil.example/x')).toBe('https://new.example/')
    expect(redirect('old.example', '*')).toBe('https://new.example/')
  })

  it('başka host’a, boş listeye ve tanımsız ya da geçersiz hedefe dokunmaz', () => {
    expect(redirect('new.example')).toBeNull()
    expect(redirect('other.example')).toBeNull()
    expect(redirect(null)).toBeNull()
    expect(
      legacyRedirectLocation({
        legacyHosts: [],
        target: 'new.example',
        requestHost: 'old.example',
        pathAndQuery: '/',
      }),
    ).toBeNull()
    for (const target of [
      undefined,
      '',
      '#kullanıcı yazar#',
      'https://new.example',
      'new example',
    ]) {
      expect(
        legacyRedirectLocation({
          legacyHosts,
          target,
          requestHost: 'old.example',
          pathAndQuery: '/',
        }),
        String(target),
      ).toBeNull()
    }
  })

  it('istek zaten hedef host’taysa (hatalı liste) yönlendirmez: döngü olmaz', () => {
    expect(
      legacyRedirectLocation({
        legacyHosts: ['new.example'],
        target: 'new.example',
        requestHost: 'new.example',
        pathAndQuery: '/',
      }),
    ).toBeNull()
  })

  it('yerel hedefte http kullanılır', () => {
    expect(
      legacyRedirectLocation({
        legacyHosts: ['old.example'],
        target: 'localhost:3100',
        requestHost: 'old.example',
        pathAndQuery: '/durum',
      }),
    ).toBe('http://localhost:3100/durum')
  })
})

describe('marka', () => {
  it('varsayılan ad User-Agent ürün adı olabilir (RFC 9110 token) ve genel host biçimine uyar', () => {
    expect(DEFAULT_APP_NAME).toBe('Airline.live')
    expect(DEFAULT_APP_NAME).toMatch(/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/)
    expect(PUBLIC_HOST.test(DEFAULT_APP_NAME.toLowerCase())).toBe(true)
  })
})
