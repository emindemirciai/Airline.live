import { describe, expect, it } from 'vitest'
import { languageToggleHref } from './language-toggle'

/** /dil adresindeki `next` değerini çözer (sunucunun okuduğu biçim). */
function nextOf(href: string): string | null {
  return new URL(href, 'http://localhost').searchParams.get('next')
}

describe('languageToggleHref', () => {
  it('hedef dili ve geri dönülecek yolu taşır', () => {
    const href = languageToggleHref('en', '/durum')
    expect(href.startsWith('/dil?to=en&next=')).toBe(true)
    expect(nextOf(href)).toBe('/durum')
  })

  it('sorgu metnini korur; seçili uçak dil değişince kaybolmaz', () => {
    expect(nextOf(languageToggleHref('en', '/', 'hex=4bb26c'))).toBe('/?hex=4bb26c')
    expect(nextOf(languageToggleHref('tr', '/', '?hex=4bb26c&x=1'))).toBe('/?hex=4bb26c&x=1')
  })

  it('sorgu metni tek bir parametre olarak kodlanır, /dil parametrelerine karışmaz', () => {
    const href = languageToggleHref('en', '/', 'hex=4bb26c&to=tr')
    const url = new URL(href, 'http://localhost')
    expect(url.searchParams.get('to')).toBe('en')
    expect(url.searchParams.get('next')).toBe('/?hex=4bb26c&to=tr')
  })

  it('yol bilinmiyorsa kök adrese (harita) döner', () => {
    expect(nextOf(languageToggleHref('en', null))).toBe('/')
    expect(nextOf(languageToggleHref('en', undefined, ''))).toBe('/')
    expect(nextOf(languageToggleHref('en', '', 'hex=4bb26c'))).toBe('/?hex=4bb26c')
  })

  it('boş sorgu metninde soru işareti eklemez', () => {
    expect(nextOf(languageToggleHref('tr', '/yenilikler', ''))).toBe('/yenilikler')
    expect(nextOf(languageToggleHref('tr', '/yenilikler', null))).toBe('/yenilikler')
  })
})
