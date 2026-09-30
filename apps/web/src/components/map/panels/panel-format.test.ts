import { describe, expect, it } from 'vitest'
import {
  elapsedText,
  formatPosition,
  formatTrack,
  positionSourceLabel,
  searchResultText,
  textOrDash,
} from './panel-format'

const messages = { secondsAgo: '{s} sn önce', minutesAgo: '{m} dk önce' }

describe('searchResultText', () => {
  it('ad · tip · tescil yazar, bilinmeyenleri atlar', () => {
    const base = { hex: '4bb26c', cs: 'THY974', fn: { airline: 'TK', number: '974' } }
    expect(searchResultText({ ...base, type: 'A21N', reg: 'TC-LSA' })).toBe(
      'TK-974 · A21N · TC-LSA',
    )
    expect(searchResultText({ ...base, type: null, reg: 'TC-LSA' })).toBe('TK-974 · TC-LSA')
    expect(searchResultText({ ...base, fn: null, type: 'B738', reg: null })).toBe('THY974 · B738')
    // Ad tescilse (sefer no ve çağrı kodu yok) tescil bir kez yazılır.
    expect(searchResultText({ ...base, fn: null, cs: null, type: 'B738', reg: 'TC-JVI' })).toBe(
      'TC-JVI · B738',
    )
  })
})

describe('positionSourceLabel', () => {
  it('mlat ve adsb_icao okunur yazılır, diğerleri olduğu gibi kalır', () => {
    expect(positionSourceLabel('mlat')).toBe('MLAT')
    expect(positionSourceLabel('adsb_icao')).toBe('ADS-B')
    expect(positionSourceLabel('tisb_icao')).toBe('tisb_icao')
  })
})

describe('elapsedText', () => {
  it('60 sn altında saniye, üstünde dakika (aşağı yuvarlanır)', () => {
    expect(elapsedText(10_000, 10_000, messages)).toBe('0 sn önce')
    expect(elapsedText(10_000, 22_900, messages)).toBe('12 sn önce')
    expect(elapsedText(0, 59_999, messages)).toBe('59 sn önce')
    expect(elapsedText(0, 60_000, messages)).toBe('1 dk önce')
    expect(elapsedText(0, 185_000, messages)).toBe('3 dk önce')
  })

  it('saat farkıyla gelecekte kalan zaman 0 sn sayılır', () => {
    expect(elapsedText(20_000, 10_000, messages)).toBe('0 sn önce')
  })
})

describe('formatTrack', () => {
  it('tam dereceye yuvarlar ve 360°yi 0° yazar', () => {
    expect(formatTrack(359.4)).toBe('359°')
    expect(formatTrack(359.6)).toBe('0°')
    expect(formatTrack(0)).toBe('0°')
    expect(formatTrack(-10)).toBe('350°')
  })

  it('bilinmeyen yön "—" olur', () => {
    expect(formatTrack(null)).toBe('—')
    expect(formatTrack(Number.NaN)).toBe('—')
  })
})

describe('formatPosition', () => {
  it('3 ondalıklı "enlem, boylam" yazar', () => {
    expect(formatPosition(41.27534, 28.75191)).toBe('41.275, 28.752')
    expect(formatPosition(-33.9, -70.1)).toBe('-33.900, -70.100')
  })
})

describe('textOrDash', () => {
  it('boş ya da bilinmeyen metni "—" yazar', () => {
    expect(textOrDash('TC-LSA')).toBe('TC-LSA')
    expect(textOrDash(null)).toBe('—')
    expect(textOrDash(' ')).toBe('—')
  })
})
