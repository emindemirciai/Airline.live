import { describe, expect, it } from 'vitest'
import {
  format,
  formatDate,
  formatReleaseTime,
  formatSinceYear,
  getMessages,
  resolveLocale,
} from './index'

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
    // Ülke adları (D-095): Gizle / Göster; ipucu adların uzaklaşınca göründüğünü söyler.
    expect(map.labels.countries).toBe('Ülke adları')
    expect(map.labels.countryModes).toEqual({ hidden: 'Gizle', shown: 'Göster' })
    expect(map.labels.hint).toBe(
      'Kısa: yalnızca sefer no. Tam: sefer no, hız ve yükseklik. Ülke adları haritayı uzaklaştırınca görünür.',
    )
    const en = getMessages('en').map.labels
    expect(en.countries).toBe('Country names')
    expect(en.countryModes).toEqual({ hidden: 'Hide', shown: 'Show' })
    expect(en.hint).toBe(
      'Short: flight number only. Full: flight number, speed and altitude. Country names appear when you zoom out.',
    )
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

  it('"… beri" yılı: Türkçede okunuşa göre ayrılma eki, İngilizcede yalnız yıl (D-090)', () => {
    const cases: [number, string][] = [
      [2022, '2022’den'],
      [2021, '2021’den'],
      [2023, '2023’ten'],
      [2024, '2024’ten'],
      [2025, '2025’ten'],
      [2026, '2026’dan'],
      [2027, '2027’den'],
      [2028, '2028’den'],
      [2029, '2029’dan'],
      [2010, '2010’dan'],
      [2020, '2020’den'],
      [2030, '2030’dan'],
      [2040, '2040’tan'],
      [2050, '2050’den'],
      [2060, '2060’tan'],
      [2070, '2070’ten'],
      [2080, '2080’den'],
      [2090, '2090’dan'],
      [1900, '1900’den'],
      [2000, '2000’den'],
    ]
    for (const [year, expected] of cases)
      expect(formatSinceYear(year, 'tr'), String(year)).toBe(expected)
    expect(formatSinceYear(2022, 'en')).toBe('2022')
    expect(() => formatSinceYear(0, 'tr')).toThrow(RangeError)
    expect(() => formatSinceYear(2022.5, 'en')).toThrow(RangeError)
    // Kullanıcının kararlaştırdığı metin (2026-10-04, D-090).
    const tr = getMessages('tr')
    const en = getMessages('en')
    expect(format(tr.airport.civilClosure, { since: formatSinceYear(2022, 'tr') })).toBe(
      'Sivil uçuşlara kapalı olabilir (2022’den beri)',
    )
    expect(format(en.airport.civilClosure, { since: formatSinceYear(2022, 'en') })).toBe(
      'May be closed to civil flights (since 2022)',
    )
    expect(tr.map.airportPopup.civilClosure).toBe(tr.airport.civilClosure)
    expect(en.map.airportPopup.civilClosure).toBe(en.airport.civilClosure)
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
