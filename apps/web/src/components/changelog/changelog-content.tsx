import { getMessages } from '@havayolu/i18n'
import { CHANGELOG, pickText, type ChangelogEntry, type Locale } from '@havayolu/shared'
import Link from 'next/link'
// Göreli yollar: vitest `@/` takma adını çözmez ve bu bileşen testte çizilir.
import { localePath } from '../../lib/locale-routing'
import { releaseTime } from './release-time'

export interface ChangelogContentProps {
  locale: Locale
  /** Sunucuda çalışan sürüm (`currentVersion()`); "Güncel sürüm" etiketi ve açılış anı ona aittir. */
  runningVersion: string
  /** Web sunucusunun açılış anı: yayın anı henüz yazılmamış çalışan sürümün yayın saati (D-091). */
  serverStartedAt: Date
  entries?: readonly ChangelogEntry[]
}

/**
 * Yenilikler sayfasının içeriği (`/yenilikler`, `/en/yenilikler`): her sürümün başlığı, yayın tarihi
 * ve saati (Europe/Istanbul; D-091), maddeleri ve "Dene →" bağlantıları. En yeni sürüm en üsttedir.
 */
export function ChangelogContent({
  locale,
  runningVersion,
  serverStartedAt,
  entries = CHANGELOG,
}: ChangelogContentProps) {
  const t = getMessages(locale).changelog
  return (
    <>
      <h1>{t.title}</h1>
      <p className="lead">{t.intro}</p>
      <ol className="releases">
        {entries.map((entry) => {
          const released = releaseTime(entry, { locale, runningVersion, serverStartedAt })
          return (
            <li key={entry.version} className="release" id={`v${entry.version}`}>
              <header className="release-header">
                <h2>
                  <span className="mono">v{entry.version}</span> {pickText(entry.title, locale)}
                </h2>
                <p className="release-meta">
                  <span>
                    {t.released}: <time dateTime={released.dateTime}>{released.text}</time>
                  </span>
                  {entry.version === runningVersion ? (
                    <span className="state state-current">{t.current}</span>
                  ) : null}
                </p>
              </header>
              <ul className="release-items">
                {entry.items.map((item) => (
                  <li key={item.tr}>{pickText(item, locale)}</li>
                ))}
              </ul>
              {entry.tryLinks?.length ? (
                <p className="try-links">
                  {entry.tryLinks.map((link) => (
                    <Link key={link.path} href={localePath(locale, link.path)} className="try-link">
                      {t.tryIt}: {pickText(link.label, locale)} →
                    </Link>
                  ))}
                </p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </>
  )
}
