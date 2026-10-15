import { format, getMessages } from '@havayolu/i18n'
import { PROJECT } from '@havayolu/shared'

/**
 * Sayfa kaynağında (sağ tık → Sayfa kaynağını görüntüle) görünen telif ve lisans bildirimi.
 * İki dil birlikte yazılır; ekranda gösterilmez. HTML yorumu olarak döner.
 */
export function sourceNoticeLines(app: string): string[] {
  const values = {
    app,
    year: PROJECT.copyrightYear,
    owner: PROJECT.owner,
    ownerUrl: PROJECT.ownerUrl,
  }
  return (['tr', 'en'] as const).flatMap((locale, index) => {
    const t = getMessages(locale).legal
    const lines = [t.owner, t.license, t.violation, t.brand].map((line) => format(line, values))
    return index === 0 ? lines : ['', ...lines]
  })
}

/** Yorum içinde "--" ya da ">" yorumu erken kapatabilir; bu karakterler zararsız hâle getirilir. */
function commentSafe(line: string): string {
  return line.replaceAll('--', '‐‐').replaceAll('>', '›').replaceAll('<', '‹')
}

export function sourceNoticeComment(app: string): string {
  const body = sourceNoticeLines(app)
    .map((line) => `  ${commentSafe(line)}`.trimEnd())
    .join('\n')
  return `<!--\n${body}\n-->`
}
