import type { Locale } from '../locale'
import { localTime, utcOffsetLabel } from '../weather/time'
import { CHANGELOG } from './entries'
import type { ChangelogEntry } from './types'

export type { ChangelogEntry, ChangelogLink } from './types'
export { CHANGELOG } from './entries'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
/** Yayın anı: ISO 8601, UTC ("Z"), saniyeye kadar, salisesiz (GitHub Release `publishedAt` biçimi). */
const RELEASED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/

/** Geçerli bir yayın anı mı: `RELEASED_AT` biçiminde ve takvimde var olan bir an (31 Eylül değil). */
export function isReleasedAt(value: string): boolean {
  if (!RELEASED_AT.test(value)) return false
  const ms = Date.parse(value)
  return Number.isFinite(ms) && new Date(ms).toISOString() === value.replace(/Z$/, '.000Z')
}

export function parseSemver(version: string): [number, number, number] {
  const match = SEMVER.exec(version)
  if (!match) throw new Error(`Geçersiz sürüm: "${version}" (beklenen: 1.2.3)`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Changelog listesinin tutarlılığını denetler: geçerli semver ve tarih, yinelenmeyen ve
 * yeniden eskiye kesin azalan sürümler, boş olmayan TR/EN metinler, "/" ile başlayan bağlantılar.
 * `releasedAt` varsa (D-091): ISO 8601 UTC, İstanbul'daki günü `date`'tir ve iki ardışık kayıtta da
 * varsa yeniden eskiye kesin azalır. Sorun listesini döndürür; boş liste = geçerli.
 */
export function validateChangelog(entries: readonly ChangelogEntry[]): string[] {
  const problems: string[] = []
  if (entries.length === 0) problems.push('Changelog boş.')
  entries.forEach((entry, index) => {
    const where = `v${entry.version}`
    if (!SEMVER.test(entry.version)) problems.push(`${where}: sürüm semver değil.`)
    if (!DATE.test(entry.date) || Number.isNaN(Date.parse(entry.date)))
      problems.push(`${where}: tarih YYYY-MM-DD değil.`)
    if (entry.releasedAt !== undefined) {
      if (!isReleasedAt(entry.releasedAt)) {
        problems.push(`${where}: yayın anı ISO 8601 UTC değil (ör. 2026-10-04T17:27:12Z).`)
      } else {
        const day = localTime(entry.releasedAt).dateKey
        if (day !== entry.date)
          problems.push(`${where}: yayın anının İstanbul'daki günü (${day}) tarihle aynı değil.`)
      }
    }
    const texts = [entry.title, ...entry.items, ...(entry.tryLinks ?? []).map((l) => l.label)]
    if (texts.some((t) => t.tr.trim() === '' || t.en.trim() === ''))
      problems.push(`${where}: boş TR/EN metin var.`)
    if (entry.items.length === 0) problems.push(`${where}: madde yok.`)
    for (const link of entry.tryLinks ?? []) {
      if (!link.path.startsWith('/') || link.path.startsWith('//'))
        problems.push(`${where}: bağlantı "/" ile başlayan bir iç yol olmalı (${link.path}).`)
    }
    const next = entries[index + 1]
    if (next && SEMVER.test(entry.version) && SEMVER.test(next.version)) {
      if (compareSemver(entry.version, next.version) <= 0)
        problems.push(`${where}: sürümler yeniden eskiye kesin azalan sırada olmalı.`)
      if (entry.date < next.date) problems.push(`${where}: tarih bir önceki sürümden eski.`)
    }
    if (
      entry.releasedAt !== undefined &&
      next?.releasedAt !== undefined &&
      isReleasedAt(entry.releasedAt) &&
      isReleasedAt(next.releasedAt) &&
      entry.releasedAt <= next.releasedAt
    )
      problems.push(`${where}: yayın anı bir önceki sürümünkinden sonra olmalı.`)
  })
  return problems
}

/** Uygulamanın güncel sürümü = changelog'daki en yeni kayıt. Kök package.json ile CI'da eşitlenir. */
export function currentVersion(entries: readonly ChangelogEntry[] = CHANGELOG): string {
  const latest = entries[0]
  if (!latest) throw new Error('Changelog boş; güncel sürüm belirlenemiyor.')
  return latest.version
}

/**
 * Sürümün yayın damgası, iki dilde aynı (CHANGELOG.md başlığı, GitHub Release notu): yayın anı varsa
 * İstanbul'daki gün, saat ve o anki UTC farkı ("2026-10-04 20:27 (UTC+3)"), yoksa yalnızca gün
 * ("2026-10-04"). Fark `Intl`'den gelir, koda gömülmez (D-091).
 */
export function releaseStamp(entry: Pick<ChangelogEntry, 'date' | 'releasedAt'>): string {
  if (entry.releasedAt === undefined || !isReleasedAt(entry.releasedAt)) return entry.date
  const local = localTime(entry.releasedAt)
  return `${local.dateKey} ${local.hhmm} (${utcOffsetLabel(local.utcOffsetMinutes)})`
}

const HEADINGS: Record<Locale, string> = { tr: 'Türkçe', en: 'English' }
const TRY_LABEL: Record<Locale, string> = { tr: 'Dene', en: 'Try it' }

/** CHANGELOG.md içeriğini üretir (TR + EN). */
export function renderChangelogMarkdown(entries: readonly ChangelogEntry[] = CHANGELOG): string {
  const lines: string[] = [
    '# Yenilikler / Changelog',
    '',
    '> Bu dosya `packages/shared/src/changelog/entries.ts` kaynağından `pnpm changelog` ile üretilir; elle düzenleme.',
    '> Aynı içerik uygulamada **Yenilikler** (`/yenilikler`) sayfasında görünür.',
    '>',
    '> *Generated from `packages/shared/src/changelog/entries.ts` by `pnpm changelog`; do not edit by hand.*',
    '> *The same content appears in the app’s **What’s new** (`/yenilikler`) page.*',
    '',
  ]
  for (const entry of entries) {
    lines.push('---', '', `## v${entry.version} — ${releaseStamp(entry)}`, '')
    for (const locale of ['tr', 'en'] as const) {
      lines.push(`### ${HEADINGS[locale]}`, `**${entry.title[locale]}**`, '')
      for (const item of entry.items) lines.push(`- ${item[locale]}`)
      if (entry.tryLinks?.length) {
        const links = entry.tryLinks.map((l) => `[${l.label[locale]}](${l.path})`).join(' · ')
        lines.push('', `${TRY_LABEL[locale]}: ${links}`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}
