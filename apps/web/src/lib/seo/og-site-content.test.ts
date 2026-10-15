import { getMessages } from '@havayolu/i18n'
import { describe, expect, it, vi } from 'vitest'
import { siteOgContent, siteOgVersion } from './og-site-content'

vi.mock('server-only', () => ({}))

describe('siteOgContent / siteOgVersion (paylaşım görselinin adres sürümü, D-106)', () => {
  it('içerik ad, alan adı ve iki dildeki kısa tanımdır', () => {
    expect(siteOgContent('havayolu', 'airline.live')).toEqual({
      name: 'havayolu',
      host: 'airline.live',
      taglineTr: getMessages('tr').seo.ogTagline,
      taglineEn: getMessages('en').seo.ogTagline,
    })
  })

  it('aynı içerik aynı sürümü verir; herhangi bir alan değişince sürüm değişir', () => {
    const base = siteOgContent('havayolu', 'airline.live')
    const version = siteOgVersion(base)
    expect(version).toMatch(/^[0-9a-f]{8}$/)
    expect(siteOgVersion({ ...base })).toBe(version)
    // v0.22.2'ye kadarki Türkçe kısa tanım: adres değiştiği için sosyal ağlar eski kartı tutmaz.
    expect(siteOgVersion({ ...base, taglineTr: 'Türkiye canlı uçuş takibi' })).not.toBe(version)
    expect(siteOgVersion({ ...base, taglineEn: 'x' })).not.toBe(version)
    expect(siteOgVersion({ ...base, name: 'x' })).not.toBe(version)
    expect(siteOgVersion({ ...base, host: null })).not.toBe(version)
  })
})
