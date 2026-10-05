import { describe, expect, it } from 'vitest'
import { checkLocalDbGate, localDbRefusalText, type LocalDbRefusal } from './gate'

const LOCAL = 'postgres://havayolu:havayolu_dev_only@localhost:45432/app_dev'

function refusals(source: Record<string, string | undefined>): LocalDbRefusal['code'][] {
  const gate = checkLocalDbGate(source)
  return gate.ok ? [] : gate.refusals.map((r) => r.code)
}

describe('checkLocalDbGate', () => {
  it.each([
    LOCAL,
    'postgres://u:p@127.0.0.1:45432/app_dev',
    'postgresql://u:p@[::1]:45432/app_dev',
    'postgres://u:p@LOCALHOST/app_dev',
  ])('yerel adres geçer: %s', (url) => {
    expect(checkLocalDbGate({ DATABASE_URL: url })).toEqual({ ok: true, databaseUrl: url })
  })

  it('APP_ENV development, test ve tanımsız geçer; production ve başka değer ret', () => {
    expect(refusals({ DATABASE_URL: LOCAL, APP_ENV: 'development' })).toEqual([])
    expect(refusals({ DATABASE_URL: LOCAL, APP_ENV: 'test' })).toEqual([])
    expect(refusals({ DATABASE_URL: LOCAL, APP_ENV: ' ' })).toEqual([])
    expect(refusals({ DATABASE_URL: LOCAL, APP_ENV: 'production' })).toEqual(['app_env'])
    expect(refusals({ DATABASE_URL: LOCAL, APP_ENV: 'staging' })).toEqual(['app_env'])
  })

  it('DATABASE_URL yok, boş ya da şablon talimatıysa ret', () => {
    expect(refusals({})).toEqual(['database_url_missing'])
    expect(refusals({ DATABASE_URL: '  ' })).toEqual(['database_url_missing'])
    expect(refusals({ DATABASE_URL: '#üretimde Dokploy verir#' })).toEqual(['database_url_missing'])
  })

  it('ayrıştırılamayan ya da postgres olmayan adres geçersizdir', () => {
    expect(refusals({ DATABASE_URL: 'localhost:45432' })).toEqual(['database_url_invalid'])
    expect(refusals({ DATABASE_URL: 'redis://localhost:46379/0' })).toEqual([
      'database_url_invalid',
    ])
  })

  it.each([
    'postgres://havayolu:gizli-parola@db.havayolu.live:5432/app',
    'postgres://u:p@10.0.0.5:5432/app',
    'postgres://u:p@localhost.havayolu.live/app',
    'postgres://u:p@127.0.0.2/app',
  ])('yerel olmayan adres ret: %s', (url) => {
    expect(refusals({ DATABASE_URL: url, APP_ENV: 'production' })).toEqual([
      'app_env',
      'database_url_not_local',
    ])
  })

  it('ret iletileri adres, kullanıcı ya da parola içermez', () => {
    const gate = checkLocalDbGate({
      DATABASE_URL: 'postgres://kullanici:gizli-parola@db.havayolu.live:5432/app',
      APP_ENV: 'production',
    })
    expect(gate.ok).toBe(false)
    const text = gate.ok ? '' : gate.refusals.map(localDbRefusalText).join('\n')
    expect(text).toContain('DATABASE_URL yerel değil')
    expect(text).toContain('APP_ENV development ya da test olmalı')
    for (const secret of ['gizli-parola', 'kullanici', 'db.havayolu.live', '5432']) {
      expect(text).not.toContain(secret)
    }
  })

  it('her ret kodunun sabit bir iletisi vardır', () => {
    const codes: LocalDbRefusal[] = [
      { code: 'database_url_missing', subject: 'DATABASE_URL' },
      { code: 'database_url_invalid', subject: 'DATABASE_URL' },
      { code: 'database_url_not_local', subject: 'DATABASE_URL' },
      { code: 'app_env', subject: 'APP_ENV' },
    ]
    for (const r of codes) expect(localDbRefusalText(r)).toMatch(/\S/)
  })
})
