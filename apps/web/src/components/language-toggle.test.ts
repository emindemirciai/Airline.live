import { describe, expect, it } from 'vitest'
import { languageToggleHref, languageToggleHrefFromLocation } from '../lib/language-href'

describe('languageToggleHref (sunucu: mantıksal yoldan)', () => {
  it('Türkçe sayfadan İngilizce ikizine, İngilizceden Türkçeye gider', () => {
    expect(languageToggleHref('en', '/')).toBe('/en')
    expect(languageToggleHref('en', '/durum')).toBe('/en/durum')
    expect(languageToggleHref('en', '/istasyon/LTFM')).toBe('/en/istasyon/LTFM')
    expect(languageToggleHref('tr', '/istasyon/LTFM')).toBe('/istasyon/LTFM')
    expect(languageToggleHref('tr', '/')).toBe('/')
  })

  it('sorgu metnini korur; seçili uçak dil değişince kaybolmaz', () => {
    expect(languageToggleHref('en', '/?hex=ff0001')).toBe('/en?hex=ff0001')
    expect(languageToggleHref('tr', '/?hex=ff0001&x=1')).toBe('/?hex=ff0001&x=1')
    expect(languageToggleHref('en', '/?havalimani=LTFM')).toBe('/en?havalimani=LTFM')
  })

  it('yol bilinmiyor ya da güvensizse kök adrese gider', () => {
    expect(languageToggleHref('en', null)).toBe('/en')
    expect(languageToggleHref('en', undefined)).toBe('/en')
    expect(languageToggleHref('en', '//evil.example')).toBe('/en')
    expect(languageToggleHref('tr', 'https://evil.example')).toBe('/')
  })

  it('öneki iki kez eklemez', () => {
    expect(languageToggleHref('en', '/en/durum')).toBe('/en/durum')
    expect(languageToggleHref('tr', '/en/durum')).toBe('/durum')
  })
})

describe('languageToggleHrefFromLocation (istemci: tarayıcı adresinden)', () => {
  it('/en ↔ / arasında geçer', () => {
    expect(languageToggleHrefFromLocation('tr', '/en')).toBe('/')
    expect(languageToggleHrefFromLocation('en', '/')).toBe('/en')
    expect(languageToggleHrefFromLocation('tr', '/en/istasyon/LTFM')).toBe('/istasyon/LTFM')
    expect(languageToggleHrefFromLocation('en', '/istasyon/LTFM')).toBe('/en/istasyon/LTFM')
  })

  it('sorgu metnini korur (soru işaretli ya da işaretsiz)', () => {
    expect(languageToggleHrefFromLocation('en', '/', '?hex=ff0001')).toBe('/en?hex=ff0001')
    expect(languageToggleHrefFromLocation('tr', '/en', '?hex=ff0001')).toBe('/?hex=ff0001')
    expect(languageToggleHrefFromLocation('en', '/durum', 'x=1')).toBe('/en/durum?x=1')
  })

  it('boş sorgu metninde soru işareti eklemez', () => {
    expect(languageToggleHrefFromLocation('tr', '/en/yenilikler', '')).toBe('/yenilikler')
    expect(languageToggleHrefFromLocation('tr', '/en/yenilikler', null)).toBe('/yenilikler')
    expect(languageToggleHrefFromLocation('en', '/yenilikler', '?')).toBe('/en/yenilikler')
  })

  it('yol bilinmiyorsa kök adrese gider', () => {
    expect(languageToggleHrefFromLocation('en', null)).toBe('/en')
    expect(languageToggleHrefFromLocation('tr', '', '?hex=ff0001')).toBe('/?hex=ff0001')
  })

  it('/english gibi yolları önek saymaz', () => {
    expect(languageToggleHrefFromLocation('en', '/english')).toBe('/en/english')
  })
})
