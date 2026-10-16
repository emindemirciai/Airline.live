import { PROJECT } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { sourceNoticeComment, sourceNoticeLines } from './source-notice'

describe('sayfa kaynağı bildirimi', () => {
  it('sahibi, MIT şartını ve markanın kapsam dışı olduğunu iki dilde yazar', () => {
    const text = sourceNoticeLines('Airline.live').join('\n')
    expect(text).toContain(`Airline.live · © ${PROJECT.copyrightYear} ${PROJECT.owner}`)
    expect(text).toContain(PROJECT.ownerUrl)
    // Repo gizlidir ve iç adını taşır (D-068, D-112): adresi sayfa kaynağına yazılmaz.
    expect(text).not.toMatch(/github\.com\/[^/\s]+\/[^/\s]+/)
    expect(text).toContain('MIT lisansıyla')
    expect(text).toContain('MIT License')
    expect(text).toContain('5846')
    expect(text).toContain('“Airline.live” adı ve logosu')
    expect(text).toContain('The “Airline.live” name and logo')
    // MIT'in tek şartı kopyalar ve önemli bölümler içindir; kullanım şarta bağlanmaz.
    expect(text).toContain('tüm kopyaları ya da önemli bölümleri')
    expect(text).toContain('All copies or substantial portions')
    expect(text).not.toMatch(/kullanan|Anyone who uses|site content|sitedeki içerikler/)
  })

  it('geçerli ve kaçamayan tek bir HTML yorumu üretir', () => {
    const comment = sourceNoticeComment('ad--> <script>')
    expect(comment.startsWith('<!--\n')).toBe(true)
    expect(comment.endsWith('\n-->')).toBe(true)
    const inner = comment.slice(4, -3)
    expect(inner).not.toContain('--')
    expect(inner).not.toContain('<')
    expect(inner).not.toContain('>')
  })
})
