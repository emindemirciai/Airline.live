import { describe, expect, it } from 'vitest'
import { format, formatDate, formatReleaseTime, getMessages, resolveLocale } from './index'

type Tree = { [key: string]: string | Tree }

function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keyPaths(value, `${prefix}${key}.`),
  )
}

function valueAt(tree: Tree, path: string): string | Tree {
  return path
    .split('.')
    .reduce<string | Tree>((node, k) => (node as Tree)[k] as string | Tree, tree)
}

/** Metindeki "{ad}" yer tutucularının sıralı listesi. */
function placeholders(value: string | Tree): string[] {
  return [...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? '').sort()
}

describe('i18n', () => {
  it('tr ve en aynı anahtarlara sahiptir ve hiçbir metin boş değildir', () => {
    const tr = getMessages('tr') as unknown as Tree
    const en = getMessages('en') as unknown as Tree
    expect(keyPaths(en).sort()).toEqual(keyPaths(tr).sort())
    const empty = (tree: Tree) =>
      keyPaths(tree).filter((path) => {
        const value = valueAt(tree, path)
        return typeof value === 'string' && value.trim() === ''
      })
    expect(empty(tr)).toEqual([])
    expect(empty(en)).toEqual([])
  })

  it('hiçbir metinde sayıdan ya da sayı yer tutucusundan önce "·" veya "–" yoktur', () => {
    // "Çok bulutlu · 16 °C" eksi 16 gibi okunur (kullanıcı kararı 2026-10-02, D-081); ayraç virgüldür.
    // Yer tutucunun sayı olup olmadığı bilinemediği için önündeki ayraç hiç kullanılmaz.
    const NUMBER_AFTER_DOT = /[·–—]\s*(?:\{|[−-]?\d)/
    for (const locale of ['tr', 'en'] as const) {
      const tree = getMessages(locale) as unknown as Tree
      const offending = keyPaths(tree).filter((path) =>
        NUMBER_AFTER_DOT.test(String(valueAt(tree, path))),
      )
      expect(offending, locale).toEqual([])
    }
  })

  it('tr ve en metinleri aynı yer tutucuları taşır', () => {
    const tr = getMessages('tr') as unknown as Tree
    const en = getMessages('en') as unknown as Tree
    const mismatched = keyPaths(tr).filter(
      (path) => placeholders(valueAt(tr, path)).join() !== placeholders(valueAt(en, path)).join(),
    )
    expect(mismatched).toEqual([])
  })

  it('haritanın spesifikasyonda sabitlenen Türkçe metinleri değişmez', () => {
    const map = getMessages('tr').map
    // docs/prompts/parca-1.md §M6, domain.md → Terimler ve Harita etiketleri
    expect(map.search.notFound).toBe(
      'Bu sefer şu an havada görünmüyor ya da farklı bir çağrı koduyla uçuyor; tescil ile arayabilirsin.',
    )
    expect(map.card.follow).toBe('Uçağı ortala')
    expect(map.status.noProvider).toBe('Canlı veri kaynağı şu an kapalı; haritada uçak görünmüyor.')
    expect(map.status.basemapFailed).toBe('Harita altlığı yüklenemedi.')
    expect(map.labels.button).toBe('Etiketler')
    expect([map.labels.hidden, map.labels.short, map.labels.full]).toEqual(['Gizle', 'Kısa', 'Tam'])
    expect(format(map.status.freshness, { s: 4 })).toBe('Veri yaşı 4 sn')
    expect(format(map.card.secondsAgo, { s: 12 })).toBe('12 sn önce')
  })

  it('harita metinlerinde "takip" geçmez (yalnızca bildirim aboneliği için kullanılır)', () => {
    for (const locale of ['tr', 'en'] as const) {
      const map = getMessages(locale).map as unknown as Tree
      const texts = keyPaths(map).map((path) => String(valueAt(map, path)))
      expect(texts.filter((text) => /takip|follow/i.test(text))).toEqual([])
    }
  })

  it('bilinmeyen dil varsayılana düşer', () => {
    expect(resolveLocale('en')).toBe('en')
    expect(resolveLocale('de')).toBe('tr')
    expect(resolveLocale(undefined)).toBe('tr')
  })

  it('yer tutucuları doldurur, eksikte hata verir', () => {
    expect(format('{done} / {total}', { done: 2, total: 14 })).toBe('2 / 14')
    expect(() => format('{missing}', {})).toThrow()
  })

  it('tarihi dile göre biçimlendirir', () => {
    expect(formatDate('2026-09-25', 'tr')).toBe('25 Eylül 2026')
    expect(formatDate('2026-09-25', 'en')).toBe('25 September 2026')
  })

  it('yayın anı: İstanbul saatiyle gün, 24 saatlik saat ve dilim etiketi (D-091)', () => {
    expect(formatReleaseTime('2026-10-04T17:27:12Z', 'tr')).toBe(
      '4 Ekim 2026, 20:27 (Türkiye saati)',
    )
    expect(formatReleaseTime('2026-10-04T17:27:12Z', 'en')).toBe('4 October 2026, 20:27 (UTC+3)')
    // Gün de İstanbul takvimindedir: UTC 23:17 ertesi gün 02:17'dir.
    expect(formatReleaseTime('2026-10-01T23:17:49Z', 'tr')).toBe(
      '2 Ekim 2026, 02:17 (Türkiye saati)',
    )
    expect(formatReleaseTime('2026-10-01T23:17:49Z', 'en')).toBe('2 October 2026, 02:17 (UTC+3)')
    // Gece yarısı 00:00 yazılır (24:00 değil); Date ve epoch ms de kabul edilir.
    expect(formatReleaseTime(new Date('2026-09-30T21:00:00Z'), 'tr')).toBe(
      '1 Ekim 2026, 00:00 (Türkiye saati)',
    )
    expect(formatReleaseTime(Date.UTC(2026, 8, 25, 15, 7, 8), 'en')).toBe(
      '25 September 2026, 18:07 (UTC+3)',
    )
    expect(formatReleaseTime('bozuk', 'tr')).toBe('—')
  })
})
