import { describe, expect, it } from 'vitest'
import { formatCheckedAt } from './status-time'

describe('formatCheckedAt (/durum kontrol zamanı, D-106)', () => {
  it('UTC ve etiketli, iki dilde', () => {
    expect(formatCheckedAt('2026-10-06T14:20:00Z', 'tr')).toBe('6.10.2026 14:20:00 UTC')
    expect(formatCheckedAt('2026-10-06T14:20:00Z', 'en')).toBe('06/10/2026, 14:20:00 UTC')
  })

  it('gün İstanbul saatine kaydırılmaz (22:30 UTC İstanbul’da ertesi gündür)', () => {
    expect(formatCheckedAt('2026-10-06T22:30:00Z', 'tr')).toBe('6.10.2026 22:30:00 UTC')
    expect(formatCheckedAt('2026-10-06T22:30:00Z', 'en')).toBe('06/10/2026, 22:30:00 UTC')
  })
})
