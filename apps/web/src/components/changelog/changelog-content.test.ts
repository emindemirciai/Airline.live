import { getMessages } from '@havayolu/i18n'
import { CHANGELOG, currentVersion, type ChangelogEntry } from '@havayolu/shared'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChangelogContent } from './changelog-content'
import { isoInstant, releaseTime } from './release-time'

/** Web sunucusunun açılışı (sahte): 4 Ekim 2026 21:05:09 Türkiye saati. */
const SERVER_START = new Date('2026-10-04T18:05:09.734Z')

const entry = (version: string, date: string, releasedAt?: string): ChangelogEntry => ({
  version,
  date,
  ...(releasedAt === undefined ? {} : { releasedAt }),
  title: { tr: `Başlık ${version}`, en: `Title ${version}` },
  items: [{ tr: `Madde ${version}`, en: `Item ${version}` }],
})

/** Çalışan sürüm (yayın anı henüz yok), yayın anlı bir sürüm, yayın anı olmayan eski bir sürüm. */
const ENTRIES = [
  entry('0.17.1', '2026-10-04'),
  entry('0.17.0', '2026-10-04', '2026-10-04T17:27:12Z'),
  entry('0.1.0', '2026-09-25'),
]

function render(
  locale: 'tr' | 'en',
  entries: readonly ChangelogEntry[] = ENTRIES,
  runningVersion = '0.17.1',
) {
  return renderToStaticMarkup(
    createElement(ChangelogContent, {
      locale,
      runningVersion,
      serverStartedAt: SERVER_START,
      entries,
    }),
  )
}

/** Sürüm kartının `<time>` öğesi: `[datetime, metin]`. */
function timeOf(html: string, version: string): [string, string] | null {
  const card = html.split(`id="v${version}"`)[1]?.split('</li>')[0] ?? ''
  const match = /<time dateTime="([^"]+)">([^<]*)<\/time>/.exec(card)
  return match ? [match[1] ?? '', match[2] ?? ''] : null
}

describe('releaseTime (D-091)', () => {
  const tr = { locale: 'tr' as const, runningVersion: '0.17.1', serverStartedAt: SERVER_START }

  it('yayın anı varsa onu gösterir: İstanbul saatiyle gün ve saat', () => {
    expect(releaseTime(ENTRIES[1] as ChangelogEntry, tr)).toEqual({
      dateTime: '2026-10-04T17:27:12Z',
      text: '4 Ekim 2026, 20:27 (Türkiye saati)',
      source: 'released',
    })
    expect(releaseTime(ENTRIES[1] as ChangelogEntry, { ...tr, locale: 'en' })).toMatchObject({
      text: '4 October 2026, 20:27 (UTC+3)',
    })
  })

  it('yayın anı olmayan çalışan sürüm: sunucunun açılış anı, saniyeye kadar', () => {
    expect(releaseTime(ENTRIES[0] as ChangelogEntry, tr)).toEqual({
      dateTime: '2026-10-04T18:05:09Z',
      text: '4 Ekim 2026, 21:05 (Türkiye saati)',
      source: 'serverStart',
    })
  })

  it('çalışan sürümün yayın anı yazılmışsa açılış anı kullanılmaz', () => {
    expect(
      releaseTime(ENTRIES[1] as ChangelogEntry, { ...tr, runningVersion: '0.17.0' }).source,
    ).toBe('released')
  })

  it('yayın anı olmayan diğer sürümler yalnızca gün', () => {
    expect(releaseTime(ENTRIES[2] as ChangelogEntry, tr)).toEqual({
      dateTime: '2026-09-25',
      text: '25 Eylül 2026',
      source: 'date',
    })
    expect(
      releaseTime(ENTRIES[0] as ChangelogEntry, { ...tr, runningVersion: '0.18.0' }).source,
    ).toBe('date')
    expect(
      releaseTime(ENTRIES[0] as ChangelogEntry, { ...tr, serverStartedAt: new Date(Number.NaN) })
        .source,
    ).toBe('date')
  })

  it('ISO anı salisesiz yazılır', () => {
    expect(isoInstant(new Date('2026-10-04T17:27:12.999Z'))).toBe('2026-10-04T17:27:12Z')
  })
})

describe('ChangelogContent', () => {
  it('<time dateTime> ve metin: yayın anı, sunucu açılışı, yalnızca gün', () => {
    const html = render('tr')
    expect(timeOf(html, '0.17.1')).toEqual([
      '2026-10-04T18:05:09Z',
      '4 Ekim 2026, 21:05 (Türkiye saati)',
    ])
    expect(timeOf(html, '0.17.0')).toEqual([
      '2026-10-04T17:27:12Z',
      '4 Ekim 2026, 20:27 (Türkiye saati)',
    ])
    expect(timeOf(html, '0.1.0')).toEqual(['2026-09-25', '25 Eylül 2026'])
    // Etiket <time>'ın dışında, metin yalnızca zamandır.
    expect(html).toContain('Yayın tarihi: <time dateTime="2026-10-04T17:27:12Z">')
  })

  it('İngilizce: UTC farkıyla', () => {
    const html = render('en')
    expect(timeOf(html, '0.17.1')).toEqual([
      '2026-10-04T18:05:09Z',
      '4 October 2026, 21:05 (UTC+3)',
    ])
    expect(timeOf(html, '0.17.0')).toEqual([
      '2026-10-04T17:27:12Z',
      '4 October 2026, 20:27 (UTC+3)',
    ])
    expect(timeOf(html, '0.1.0')).toEqual(['2026-09-25', '25 September 2026'])
    expect(html).toContain('Released: <time')
  })

  it('"Güncel sürüm" yalnızca çalışan sürümde', () => {
    const html = render('tr')
    const current = getMessages('tr').changelog.current
    expect(html.split(current)).toHaveLength(2)
    expect(html.split('id="v0.17.1"')[1]?.split('</li>')[0]).toContain(current)
  })

  it('gerçek changelog: her sürümün saati var; en yeni sürüm üstte', () => {
    for (const locale of ['tr', 'en'] as const) {
      const html = render(locale, CHANGELOG, currentVersion())
      const versions = [...html.matchAll(/<li class="release" id="v([\d.]+)"/g)].map((m) => m[1])
      expect(versions).toEqual(CHANGELOG.map((e) => e.version))
      for (const e of CHANGELOG) {
        const [dateTime, text] = timeOf(html, e.version) ?? ['', '']
        expect(dateTime, `v${e.version}`).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
        expect(text, `v${e.version}`).toMatch(
          locale === 'tr'
            ? /^\d{1,2} \p{L}+ \d{4}, \d{2}:\d{2} \(Türkiye saati\)$/u
            : /, \d{2}:\d{2} \(UTC\+3\)$/,
        )
      }
    }
    const tr = render('tr', CHANGELOG, currentVersion())
    expect(timeOf(tr, '0.17.0')).toEqual([
      '2026-10-04T17:27:12Z',
      '4 Ekim 2026, 20:27 (Türkiye saati)',
    ])
    // Gece yarısından sonra yayımlanan sürüm (UTC 23:17): İstanbul'da ertesi gün.
    expect(timeOf(tr, '0.11.0')).toEqual([
      '2026-10-01T23:17:49Z',
      '2 Ekim 2026, 02:17 (Türkiye saati)',
    ])
  })
})
