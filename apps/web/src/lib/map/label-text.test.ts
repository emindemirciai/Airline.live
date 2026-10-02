import { describe, expect, it } from 'vitest'
import { aircraft } from '../live/test/fakes'
import { aircraftTitle, labelContent } from './label-text'

const tr = { locale: 'tr', units: 'metric' } as const

describe('labelContent', () => {
  it('Tam: sefer no ve "hız, yükseklik" (metrik, TR); sayıdan önce "·" yok', () => {
    // 232,7 kt ≈ 431 km/sa, 1.093 ft ≈ 333 m (domain.md örneği).
    expect(labelContent(aircraft({ gs: 232.7, alt: 1_093 }), 'full', tr)).toEqual({
      primary: 'TK-974',
      primaryMuted: false,
      lines: ['431 km/sa, 333 m'],
    })
    const [line] = labelContent(aircraft({ gs: 232.7, alt: 1_093 }), 'full', tr).lines
    expect(line).not.toMatch(/[·–]s*[−-]?d/)
  })

  it('Kısa: yalnızca sefer no', () => {
    expect(labelContent(aircraft(), 'short', tr)).toEqual({
      primary: 'TK-974',
      primaryMuted: false,
      lines: [],
    })
  })

  it('yerdeki uçakta yükseklik yerine "yerde" yazar', () => {
    expect(labelContent(aircraft({ gs: 0, alt: null, gnd: true }), 'full', tr).lines).toEqual([
      '0 km/sa, yerde',
    ])
  })

  it('İngilizce ve havacılık birimleriyle biçimler', () => {
    expect(
      labelContent(aircraft({ gs: 232.7, alt: 1_093 }), 'full', { locale: 'en', units: 'aviation' })
        .lines,
    ).toEqual(['233 kt, 1,093 ft'])
    expect(
      labelContent(aircraft({ gnd: true, alt: null }), 'full', { locale: 'en', units: 'metric' })
        .lines[0],
    ).toMatch(/, on ground$/)
  })

  it('sefer no yoksa çağrı kodu, yoksa tescil, o da yoksa büyük harf hex; hepsi gri', () => {
    expect(labelContent(aircraft({ fn: null, cs: 'THY6FE' }), 'short', tr)).toMatchObject({
      primary: 'THY6FE',
      primaryMuted: true,
    })
    expect(labelContent(aircraft({ fn: null, cs: '  ' }), 'short', tr)).toMatchObject({
      primary: 'TC-JJA',
      primaryMuted: true,
    })
    expect(labelContent(aircraft({ fn: null, cs: '  ', reg: null }), 'short', tr)).toMatchObject({
      primary: '4BB1C5',
      primaryMuted: true,
    })
    expect(
      labelContent(aircraft({ fn: null, cs: null, reg: null, hex: '~ab12cd' }), 'short', tr),
    ).toMatchObject({ primary: '~AB12CD', primaryMuted: true })
  })

  it('sefer no tireli ve baştaki sıfırsız yazılır', () => {
    expect(aircraftTitle(aircraft({ fn: { airline: 'TK', number: '0004' } }))).toEqual({
      text: 'TK-4',
      kind: 'flight',
    })
  })

  it('başlık sırası: sefer no, çağrı kodu, tescil (tasarım tuvali), büyük harfli hex', () => {
    expect(aircraftTitle({ hex: '4bb26c', cs: 'THY4KN', fn: null, reg: 'TC-JVI' })).toEqual({
      text: 'THY4KN',
      kind: 'callsign',
    })
    expect(aircraftTitle({ hex: '4bb26c', cs: null, fn: null, reg: 'TC-JVI' })).toEqual({
      text: 'TC-JVI',
      kind: 'registration',
    })
    expect(aircraftTitle({ hex: '4bb26c', cs: '  ', fn: null, reg: ' ' })).toEqual({
      text: '4BB26C',
      kind: 'hex',
    })
    expect(aircraftTitle({ hex: '~ab12cd', cs: null, fn: null, reg: null }).text).toBe('~AB12CD')
  })

  it('hız ve yükseklik bilinmiyorsa ikinci satır yazılmaz; biri bilinmiyorsa "—"', () => {
    expect(labelContent(aircraft({ gs: null, alt: null }), 'full', tr).lines).toEqual([])
    expect(labelContent(aircraft({ gs: null, alt: 1_093 }), 'full', tr).lines).toEqual(['—, 333 m'])
  })
})
