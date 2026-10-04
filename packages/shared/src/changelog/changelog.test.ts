import { describe, expect, it } from 'vitest'
import { localTime } from '../weather/time'
import {
  CHANGELOG,
  compareSemver,
  currentVersion,
  isReleasedAt,
  releaseStamp,
  renderChangelogMarkdown,
  validateChangelog,
  type ChangelogEntry,
} from './index'

const entry = (version: string, date = '2026-09-25', releasedAt?: string): ChangelogEntry => ({
  version,
  date,
  ...(releasedAt === undefined ? {} : { releasedAt }),
  title: { tr: 'Başlık', en: 'Title' },
  items: [{ tr: 'Madde', en: 'Item' }],
})

const byVersion = (version: string) => CHANGELOG.find((e) => e.version === version)

describe('changelog', () => {
  it('gerçek changelog geçerlidir', () => {
    expect(validateChangelog(CHANGELOG)).toEqual([])
  })

  it('semver karşılaştırması sayısal yapılır', () => {
    expect(compareSemver('0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(() => compareSemver('v1.0.0', '1.0.0')).toThrow()
  })

  it('sıralama, tarih ve boş metin hatalarını yakalar', () => {
    expect(validateChangelog([entry('0.1.0'), entry('0.2.0')])).toHaveLength(1)
    expect(
      validateChangelog([entry('0.2.0', '2026-09-01'), entry('0.1.0', '2026-09-02')]),
    ).toHaveLength(1)
    expect(validateChangelog([{ ...entry('0.1.0'), title: { tr: '', en: 'x' } }])).toHaveLength(1)
    expect(
      validateChangelog([
        { ...entry('0.1.0'), tryLinks: [{ path: 'https://x', label: { tr: 'a', en: 'b' } }] },
      ]),
    ).toHaveLength(1)
    expect(validateChangelog([])).toHaveLength(1)
  })

  it('güncel sürüm en yeni kayıttır', () => {
    expect(currentVersion([entry('0.3.0'), entry('0.2.0')])).toBe('0.3.0')
  })

  it('markdown her iki dili ve bağlantıları içerir', () => {
    const md = renderChangelogMarkdown([
      { ...entry('0.2.0'), tryLinks: [{ path: '/durum', label: { tr: 'Durum', en: 'Status' } }] },
    ])
    expect(md).toContain('## v0.2.0 — 2026-09-25')
    expect(md).toContain('### Türkçe')
    expect(md).toContain('### English')
    expect(md).toContain('[Durum](/durum)')
    expect(md).toContain('[Status](/durum)')
  })
})

describe('yayın anı (releasedAt, D-091)', () => {
  it('biçim: ISO 8601 UTC, saniyeye kadar, salisesiz; takvimde olmayan an geçersiz', () => {
    expect(isReleasedAt('2026-10-04T17:27:12Z')).toBe(true)
    for (const bad of [
      '2026-10-04',
      '2026-10-04 17:27:12Z',
      '2026-10-04T17:27Z',
      '2026-10-04T17:27:12.000Z',
      '2026-10-04T20:27:12+03:00',
      '2026-10-04T17:27:12',
      '2026-09-31T10:00:00Z',
      '2026-10-04T24:00:00Z',
    ]) {
      expect(isReleasedAt(bad), bad).toBe(false)
      expect(validateChangelog([entry('0.1.0', '2026-10-04', bad)]), bad).toHaveLength(1)
    }
  })

  it('İstanbul takvimindeki günü `date` ile aynı olmalı (UTC gece yarısı değil, 21:00Z sınırı)', () => {
    // 2026-10-01T23:17:49Z İstanbul'da 2 Ekim 02:17'dir (v0.11.0).
    expect(validateChangelog([entry('0.1.0', '2026-10-02', '2026-10-01T23:17:49Z')])).toEqual([])
    const wrong = validateChangelog([entry('0.1.0', '2026-10-01', '2026-10-01T23:17:49Z')])
    expect(wrong).toHaveLength(1)
    expect(wrong[0]).toContain('2026-10-02')
    expect(validateChangelog([entry('0.1.0', '2026-10-01', '2026-10-01T20:59:59Z')])).toEqual([])
    expect(validateChangelog([entry('0.1.0', '2026-10-01', '2026-10-01T21:00:00Z')])).toHaveLength(
      1,
    )
  })

  it('yeniden eskiye kesin azalır; eksik olan sıralamaya katılmaz', () => {
    const newer = entry('0.2.0', '2026-10-04', '2026-10-04T17:27:12Z')
    const older = entry('0.1.0', '2026-10-04', '2026-10-04T14:25:25Z')
    expect(validateChangelog([newer, older])).toEqual([])
    expect(
      validateChangelog([
        { ...newer, releasedAt: older.releasedAt },
        { ...older, releasedAt: newer.releasedAt },
      ]),
    ).toHaveLength(1)
    expect(validateChangelog([newer, { ...older, releasedAt: newer.releasedAt }])).toHaveLength(1)
    expect(validateChangelog([entry('0.2.0', '2026-10-04'), older])).toEqual([])
    expect(validateChangelog([newer, entry('0.1.0', '2026-10-04')])).toEqual([])
  })

  it('gerçek veri: en yeni dışında her sürümde var, biçimi ve günü doğru, en yenisi üstte', () => {
    const [newest, ...past] = CHANGELOG
    expect(newest).toBeDefined()
    // Yayın adımı önceki sürümün GitHub Release anını yazar (D-091); yalnızca en yeni sürüm boş olabilir.
    expect(past.filter((e) => e.releasedAt === undefined).map((e) => e.version)).toEqual([])
    const stamped = CHANGELOG.filter((e) => e.releasedAt !== undefined)
    for (const e of stamped) {
      const at = e.releasedAt ?? ''
      expect(isReleasedAt(at), `v${e.version}`).toBe(true)
      expect(localTime(at).dateKey, `v${e.version}`).toBe(e.date)
    }
    const times = stamped.map((e) => Date.parse(e.releasedAt ?? ''))
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(new Set(times).size).toBe(times.length)
  })

  it('gerçek veri: GitHub Release anları ve düzeltilen günler', () => {
    expect(byVersion('0.17.0')).toMatchObject({
      date: '2026-10-04',
      releasedAt: '2026-10-04T17:27:12Z',
    })
    // TSİ gece yarısından sonra yayımlananlar ertesi günün tarihini taşır.
    expect(byVersion('0.13.0')).toMatchObject({ date: '2026-10-03' })
    expect(byVersion('0.11.0')).toMatchObject({ date: '2026-10-02' })
    expect(byVersion('0.10.0')).toMatchObject({ date: '2026-10-01' })
    expect(byVersion('0.8.0')).toMatchObject({ date: '2026-09-29' })
    // Düzeltilen günler: v0.9.0 30 Eylül 23:50'de, v0.4.0 27 Eylül 08:45'te yayımlandı.
    expect(byVersion('0.9.0')).toMatchObject({
      date: '2026-09-30',
      releasedAt: '2026-09-30T20:50:22Z',
    })
    expect(byVersion('0.4.0')).toMatchObject({
      date: '2026-09-27',
      releasedAt: '2026-09-27T05:45:46Z',
    })
    // v0.1.0: ilk commit'in saati (release'i sonradan açıldı).
    expect(byVersion('0.1.0')?.releasedAt).toBe('2026-09-25T15:07:08Z')
  })

  it('yayın damgası: İstanbul saatiyle gün, saat ve UTC farkı; yoksa yalnızca gün', () => {
    expect(releaseStamp({ date: '2026-10-04', releasedAt: '2026-10-04T17:27:12Z' })).toBe(
      '2026-10-04 20:27 (UTC+3)',
    )
    expect(releaseStamp({ date: '2026-10-02', releasedAt: '2026-10-01T23:17:49Z' })).toBe(
      '2026-10-02 02:17 (UTC+3)',
    )
    expect(releaseStamp({ date: '2026-10-04' })).toBe('2026-10-04')
    expect(releaseStamp({ date: '2026-10-04', releasedAt: 'bozuk' })).toBe('2026-10-04')
  })

  it('markdown başlığı yayın anı varsa saati taşır', () => {
    const md = renderChangelogMarkdown([
      entry('0.2.0', '2026-10-04'),
      entry('0.1.0', '2026-10-04', '2026-10-04T17:27:12Z'),
    ])
    expect(md).toContain('## v0.2.0 — 2026-10-04\n')
    expect(md).toContain('## v0.1.0 — 2026-10-04 20:27 (UTC+3)\n')
    expect(renderChangelogMarkdown()).toContain('## v0.17.0 — 2026-10-04 20:27 (UTC+3)\n')
  })
})
