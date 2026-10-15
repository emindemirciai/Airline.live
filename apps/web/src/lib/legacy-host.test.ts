import { describe, expect, it } from 'vitest'
import { legacyHostRedirect, type LegacyHostEnv } from './legacy-host'

/** Marka geçişinden sonraki üretim ortamı (D-112). */
const ENV: LegacyHostEnv = {
  WEB_HOST: 'airline.live',
  ADMIN_HOST: 'admin.airline.live',
  API_HOST: 'api.airline.live',
  LEGACY_WEB_HOSTS: 'havayolu.live,www.havayolu.live',
  LEGACY_ADMIN_HOSTS: 'admin.havayolu.live',
}

describe('legacyHostRedirect', () => {
  it('eski kök ve eski www tek adımda yeni köke gider; yol, /en öneki ve sorgu korunur', () => {
    expect(legacyHostRedirect(ENV, 'havayolu.live', '/')).toBe('https://airline.live/')
    expect(legacyHostRedirect(ENV, 'www.havayolu.live', '/en/havalimanlari?x=1')).toBe(
      'https://airline.live/en/havalimanlari?x=1',
    )
    expect(legacyHostRedirect(ENV, 'havayolu.live', '/istasyon/LTFM?havalimani=LTFM&a=%20b')).toBe(
      'https://airline.live/istasyon/LTFM?havalimani=LTFM&a=%20b',
    )
  })

  it('eski admin host’u yeni admin host’una gider (yol aynı kalır)', () => {
    expect(legacyHostRedirect(ENV, 'admin.havayolu.live', '/admin/kapsama?saat=24')).toBe(
      'https://admin.airline.live/admin/kapsama?saat=24',
    )
    expect(legacyHostRedirect(ENV, 'admin.havayolu.live', '/')).toBe('https://admin.airline.live/')
  })

  it('host büyük-küçük harf, port ve sondaki noktadan bağımsız eşleşir', () => {
    expect(legacyHostRedirect(ENV, 'HAVAYOLU.LIVE', '/durum')).toBe('https://airline.live/durum')
    expect(legacyHostRedirect(ENV, 'Www.Havayolu.Live:443', '/')).toBe('https://airline.live/')
    expect(legacyHostRedirect(ENV, 'havayolu.live.', '/')).toBe('https://airline.live/')
  })

  it('yeni host’lara, bilinmeyen host’a ve boş host’a dokunmaz', () => {
    for (const host of [
      'airline.live',
      'www.airline.live',
      'admin.airline.live',
      'api.airline.live',
      'api.havayolu.live',
      'evil.example',
      'hy-web:3000',
      '',
      null,
    ]) {
      expect(legacyHostRedirect(ENV, host, '/'), String(host)).toBeNull()
    }
  })

  it('listeler boşsa ya da tanımsızsa hiçbir şey yapmaz', () => {
    expect(
      legacyHostRedirect(
        { ...ENV, LEGACY_WEB_HOSTS: '', LEGACY_ADMIN_HOSTS: undefined },
        'havayolu.live',
        '/',
      ),
    ).toBeNull()
    expect(legacyHostRedirect({}, 'havayolu.live', '/')).toBeNull()
  })

  it('hedef tanımsız ya da #…# talimatıysa yönlendirmez', () => {
    expect(legacyHostRedirect({ ...ENV, WEB_HOST: undefined }, 'havayolu.live', '/')).toBeNull()
    expect(legacyHostRedirect({ ...ENV, WEB_HOST: '#yaz#' }, 'havayolu.live', '/')).toBeNull()
    expect(legacyHostRedirect({ ...ENV, ADMIN_HOST: '' }, 'admin.havayolu.live', '/')).toBeNull()
  })

  it('hatalı liste döngü kurmaz: yeni host’ları kapsayan, geçersiz ve #…# girdiler atlanır', () => {
    const env: LegacyHostEnv = {
      ...ENV,
      LEGACY_WEB_HOSTS: 'airline.live, www.airline.live, localhost, havayolu.live',
      LEGACY_ADMIN_HOSTS: '#boş bırak#',
    }
    expect(legacyHostRedirect(env, 'airline.live', '/')).toBeNull()
    expect(legacyHostRedirect(env, 'www.airline.live', '/')).toBeNull()
    expect(legacyHostRedirect(env, 'localhost', '/')).toBeNull()
    expect(legacyHostRedirect(env, 'admin.havayolu.live', '/')).toBeNull()
    expect(legacyHostRedirect(env, 'havayolu.live', '/x')).toBe('https://airline.live/x')
  })

  it('yerel denemede hedef localhost ise http kullanılır', () => {
    expect(
      legacyHostRedirect(
        { WEB_HOST: 'localhost:3100', LEGACY_WEB_HOSTS: 'old.example' },
        'old.example',
        '/en',
      ),
    ).toBe('http://localhost:3100/en')
  })
})
