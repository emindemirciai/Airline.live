import { formatDate, formatReleaseTime } from '@havayolu/i18n'
import type { ChangelogEntry, Locale } from '@havayolu/shared'

/**
 * Yayın zamanının kaynağı (D-091):
 * - `released`: changelog'daki yayın anı (`releasedAt`, GitHub Release'in yayımlanma anı)
 * - `serverStart`: yayın anı henüz yazılmamış çalışan sürüm; web sunucusunun açılış anı
 * - `date`: yayın anı olmayan eski sürüm; yalnızca gün
 */
export type ReleaseTimeSource = 'released' | 'serverStart' | 'date'

export interface ReleaseTime {
  /** `<time dateTime>`: ISO 8601 an ("2026-10-04T17:27:12Z") ya da yalnızca gün ("2026-10-04"). */
  dateTime: string
  /** Görünen metin: "4 Ekim 2026, 20:27 (Türkiye saati)" ya da yalnızca gün "4 Ekim 2026". */
  text: string
  source: ReleaseTimeSource
}

export interface ReleaseTimeContext {
  locale: Locale
  /** Sunucuda çalışan sürüm (`currentVersion()`). */
  runningVersion: string
  /** Web sunucusunun açılış anı (`SERVER_STARTED_AT`). */
  serverStartedAt: Date
}

/** Anı saniyeye kadar, salisesiz ISO 8601 UTC yazar ("2026-10-04T17:27:12Z"; `releasedAt` biçimi). */
export function isoInstant(at: Date): string {
  return at.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Bir sürümün Yenilikler sayfasında gösterilecek yayın zamanı. Saat sunucuda, mutlak olarak
 * (Europe/Istanbul) yazılır; istemcide yeniden hesaplanmaz, hidrasyon farkı olmaz.
 */
export function releaseTime(
  entry: Pick<ChangelogEntry, 'version' | 'date' | 'releasedAt'>,
  { locale, runningVersion, serverStartedAt }: ReleaseTimeContext,
): ReleaseTime {
  if (entry.releasedAt !== undefined) {
    return {
      dateTime: entry.releasedAt,
      text: formatReleaseTime(entry.releasedAt, locale),
      source: 'released',
    }
  }
  if (entry.version === runningVersion && Number.isFinite(serverStartedAt.getTime())) {
    return {
      dateTime: isoInstant(serverStartedAt),
      text: formatReleaseTime(serverStartedAt, locale),
      source: 'serverStart',
    }
  }
  return { dateTime: entry.date, text: formatDate(entry.date, locale), source: 'date' }
}
