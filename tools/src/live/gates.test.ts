import { describe, expect, it } from 'vitest'
import {
  checkLiveGates,
  isLiveBaseUrl,
  refusalText,
  type GateInput,
  type Refusal,
  type RefusalCode,
} from './gates'

const EMAIL = 'ops@example.org'
const PASSWORD = 's3cret-pw'
const STUB = 'http://127.0.0.1:4301'

const localSource = {
  APP_ENV: 'development',
  CONTACT_EMAIL: EMAIL,
  DATABASE_URL: `postgres://havayolu:${PASSWORD}@localhost:45432/app_dev`,
  REDIS_LIVE_URL: `redis://:${PASSWORD}@127.0.0.1:46380/0`,
  REDIS_QUEUE_URL: `redis://:${PASSWORD}@[::1]:46379/0`,
  // .env.example'daki varsayılan: dosyadaki değer kapıyı etkilemez.
  EXTERNAL_PROVIDERS_DISABLED: 'true',
}

function gates(overrides: Partial<GateInput> = {}): Refusal[] {
  return checkLiveGates({
    confirm: true,
    shellEnv: {},
    source: localSource,
    requiredUrls: ['DATABASE_URL', 'REDIS_LIVE_URL'],
    ...overrides,
  })
}

const codes = (refusals: Refusal[]) => refusals.map((r) => r.code)

describe('checkLiveGates', () => {
  it('yerel geliştirme ortamında --confirm ile ret yok', () => {
    expect(gates()).toEqual([])
    expect(gates({ requiredUrls: [] })).toEqual([])
  })

  it('--confirm yoksa yalnızca confirm_missing (kuru çalıştırma planı)', () => {
    expect(gates({ confirm: false })).toEqual([{ code: 'confirm_missing' }])
  })

  it('ajan oturumu yalnızca --confirm ile reddedilir', () => {
    expect(gates({ shellEnv: { CLAUDECODE: '1' } })).toEqual([
      { code: 'agent_session', subject: 'CLAUDECODE' },
    ])
    expect(codes(gates({ shellEnv: { AI_AGENT: 'some-agent' } }))).toEqual(['agent_session'])
    expect(codes(gates({ shellEnv: { CLAUDECODE: '1', AI_AGENT: 'x' } }))).toEqual([
      'agent_session',
    ])
    expect(codes(gates({ confirm: false, shellEnv: { CLAUDECODE: '1' } }))).toEqual([
      'confirm_missing',
    ])
    expect(gates({ shellEnv: { CLAUDECODE: '', AI_AGENT: ' ' } })).toEqual([])
    // Stub adresinde de geçerlidir: testler shellEnv'i süzülmüş verir.
    expect(codes(gates({ baseUrl: STUB, shellEnv: { CLAUDECODE: '1' } }))).toEqual([
      'agent_session',
    ])
  })

  it('kabukta CI ya da EXTERNAL_PROVIDERS_DISABLED=true/1 canlı adreste reddedilir', () => {
    expect(gates({ shellEnv: { CI: 'true' } })).toEqual([{ code: 'ci', subject: 'CI' }])
    expect(codes(gates({ shellEnv: { CI: '1' } }))).toEqual(['ci'])
    for (const value of ['false', '0', '', ' ']) {
      expect(gates({ shellEnv: { CI: value } })).toEqual([])
    }
    for (const value of ['true', '1', 'TRUE', ' True ']) {
      expect(gates({ shellEnv: { EXTERNAL_PROVIDERS_DISABLED: value } })).toEqual([
        { code: 'external_disabled', subject: 'EXTERNAL_PROVIDERS_DISABLED' },
      ])
    }
    expect(gates({ shellEnv: { EXTERNAL_PROVIDERS_DISABLED: 'false' } })).toEqual([])
    expect(
      codes(
        gates({
          baseUrl: 'https://api.adsb.lol',
          shellEnv: { CI: 'true', EXTERNAL_PROVIDERS_DISABLED: '1' },
        }),
      ),
    ).toEqual(['ci', 'external_disabled'])
  })

  it('aynı değerler yalnızca dosyada (source) ise ret yok', () => {
    expect(
      gates({ source: { ...localSource, CI: 'true', EXTERNAL_PROVIDERS_DISABLED: '1' } }),
    ).toEqual([])
  })

  it('127.0.0.1 test sunucusunda CI ve EXTERNAL_PROVIDERS_DISABLED kapıları uygulanmaz', () => {
    expect(
      gates({ baseUrl: STUB, shellEnv: { CI: 'true', EXTERNAL_PROVIDERS_DISABLED: 'true' } }),
    ).toEqual([])
    expect(isLiveBaseUrl(undefined)).toBe(true)
    expect(isLiveBaseUrl('https://api.adsb.lol')).toBe(true)
    expect(isLiveBaseUrl('https://api.adsb.lol/')).toBe(true)
    expect(isLiveBaseUrl('ayrıştırılamaz')).toBe(true)
    expect(isLiveBaseUrl(STUB)).toBe(false)
  })

  it('APP_ENV yalnızca development ya da test (boş = development)', () => {
    expect(gates({ source: { ...localSource, APP_ENV: 'production' } })).toEqual([
      { code: 'app_env', subject: 'APP_ENV' },
    ])
    expect(gates({ source: { ...localSource, APP_ENV: 'test' } })).toEqual([])
    expect(gates({ source: { ...localSource, APP_ENV: '' } })).toEqual([])
    expect(gates({ source: { ...localSource, APP_ENV: undefined } })).toEqual([])
    expect(codes(gates({ source: { ...localSource, APP_ENV: 'staging' } }))).toEqual(['app_env'])
  })

  it('CONTACT_EMAIL boş, tanımsız ya da #…# talimatıysa ret', () => {
    for (const value of [undefined, '', '  ', '#e-posta yaz#']) {
      expect(gates({ source: { ...localSource, CONTACT_EMAIL: value } })).toEqual([
        { code: 'contact_email', subject: 'CONTACT_EMAIL' },
      ])
    }
  })

  it('zorunlu adres yoksa url_missing; zorunlu değilse ret yok', () => {
    const source = { ...localSource, DATABASE_URL: '', REDIS_LIVE_URL: undefined }
    expect(gates({ source })).toEqual([
      { code: 'url_missing', subject: 'DATABASE_URL' },
      { code: 'url_missing', subject: 'REDIS_LIVE_URL' },
    ])
    expect(gates({ source, requiredUrls: [] })).toEqual([])
    expect(gates({ source: { ...localSource, REDIS_QUEUE_URL: undefined } })).toEqual([])
  })

  it('yerel olmayan adresler reddedilir; ileti adres, parola ve e-posta içermez', () => {
    const remote = {
      ...localSource,
      DATABASE_URL: `postgres://havayolu:${PASSWORD}@db.example.com:5432/app`,
      REDIS_LIVE_URL: `redis://:${PASSWORD}@10.0.0.5:6379/0`,
      REDIS_QUEUE_URL: `rediss://default:${PASSWORD}@cache.example.net:6380`,
    }
    const refusals = gates({ source: remote })
    expect(refusals).toEqual([
      { code: 'url_not_local', subject: 'DATABASE_URL' },
      { code: 'url_not_local', subject: 'REDIS_LIVE_URL' },
      { code: 'url_not_local', subject: 'REDIS_QUEUE_URL' },
    ])
    // Kayıt (requiredUrls boş) da yerel olmayan adresi reddeder.
    expect(codes(gates({ source: remote, requiredUrls: [] }))).toHaveLength(3)
    for (const refusal of refusals) {
      const text = refusalText(refusal)
      expect(text).toContain(refusal.subject)
      for (const leaked of [PASSWORD, 'db.example.com', '10.0.0.5', 'cache.example', EMAIL]) {
        expect(text).not.toContain(leaked)
      }
    }
    expect(refusalText(refusals[0] as Refusal)).toContain('üretim veritabanına bağlanılmaz')
  })

  it('ayrıştırılamayan adres env_invalid', () => {
    expect(gates({ source: { ...localSource, DATABASE_URL: 'havayolu@localhost' } })).toEqual([
      { code: 'env_invalid', subject: 'DATABASE_URL' },
    ])
  })

  it('localhost, 127.0.0.1 ve [::1] kabul edilir', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'LOCALHOST']) {
      const source = {
        ...localSource,
        DATABASE_URL: `postgres://u:p@${host}:45432/app_dev`,
        REDIS_LIVE_URL: `redis://${host}:46380/0`,
        REDIS_QUEUE_URL: `redis://${host}:46379/0`,
      }
      expect(gates({ source })).toEqual([])
    }
  })
})

describe('refusalText', () => {
  const all: RefusalCode[] = [
    'confirm_missing',
    'agent_session',
    'ci',
    'external_disabled',
    'app_env',
    'contact_email',
    'url_missing',
    'url_not_local',
    'env_invalid',
    'targets',
    'other_ingest',
    'lock_held',
    'lock_lost',
    'redis_unanswered',
    'out_in_fixtures',
    'out_in_repo',
  ]

  it('her kod için sabit, değer taşımayan Türkçe ileti', () => {
    for (const code of all) {
      const text = refusalText({ code })
      expect(text.length).toBeGreaterThan(10)
      expect(text).not.toContain('@')
      expect(text).not.toContain('://')
    }
    expect(refusalText({ code: 'agent_session' })).toBe(
      'Canlı araç bir yapay zekâ ajanı oturumunda çalışmaz; kendi terminalinde çalıştır (DUR-SOR 6)',
    )
    expect(refusalText({ code: 'confirm_missing' })).toContain('--confirm')
    expect(refusalText({ code: 'out_in_fixtures' })).toContain('--fixture')
    expect(refusalText({ code: 'out_in_repo' })).toContain('tools/recordings/tmp')
    expect(refusalText({ code: 'redis_unanswered' })).toContain('kilit alınamadı')
    expect(refusalText({ code: 'lock_held' })).toContain('en çok 2 dk')
    expect(refusalText({ code: 'url_missing', subject: 'REDIS_LIVE_URL' })).toContain(
      'REDIS_LIVE_URL',
    )
  })
})
