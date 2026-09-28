import { describe, expect, it } from 'vitest'
import { positionSource, type LiveSourceId, type PositionSource } from './aircraft'
import {
  decodeTrackSource,
  LIVE_SOURCE_IDS,
  POSITION_SLOTS_PER_SOURCE,
  POSITION_SOURCES,
  trackSourceCode,
} from './index'

describe('track_points.source kodu', () => {
  it('sağlayıcı sırası kalıcıdır: adsbLol 0, localReceiver 1 (D-073)', () => {
    expect(LIVE_SOURCE_IDS).toEqual(['adsbLol', 'localReceiver'])
  })

  it('konum kaynakları birleşim sırasıyla, tekrarsız ve 16 yuvaya sığar', () => {
    expect(POSITION_SOURCES).toEqual([
      'adsb_icao',
      'adsb_icao_nt',
      'adsr_icao',
      'tisb_icao',
      'adsc',
      'mlat',
      'other',
      'mode_s',
      'adsb_other',
      'adsr_other',
      'tisb_other',
      'tisb_trackfile',
      'unknown',
    ])
    expect(new Set(POSITION_SOURCES).size).toBe(POSITION_SOURCES.length)
    expect(POSITION_SOURCES.length).toBeLessThanOrEqual(POSITION_SLOTS_PER_SOURCE)
  })

  it('listedeki her değer ayrıştırıcının tanıdığı konum kaynağıdır', () => {
    for (const source of POSITION_SOURCES) expect(positionSource(source)).toBe(source)
  })

  it('kod = sağlayıcı × 16 + konum kaynağı sırası', () => {
    expect(trackSourceCode('adsbLol', 'adsb_icao')).toBe(0)
    expect(trackSourceCode('adsbLol', 'mlat')).toBe(5)
    expect(trackSourceCode('adsbLol', 'unknown')).toBe(12)
    expect(trackSourceCode('localReceiver', 'adsb_icao')).toBe(16)
    expect(trackSourceCode('localReceiver', 'tisb_other')).toBe(26)
    expect(trackSourceCode('localReceiver', 'unknown')).toBe(28)
  })

  it('her çift için kod benzersizdir, smallint aralığındadır ve geri çözülür', () => {
    const codes = new Set<number>()
    for (const source of LIVE_SOURCE_IDS) {
      for (const position of POSITION_SOURCES) {
        const code = trackSourceCode(source, position)
        expect(code).toBeGreaterThanOrEqual(0)
        expect(code).toBeLessThanOrEqual(32767)
        codes.add(code)
        expect(decodeTrackSource(code)).toEqual({ source, positionSource: position })
      }
    }
    expect(codes.size).toBe(LIVE_SOURCE_IDS.length * POSITION_SOURCES.length)
  })

  it('tanımsız kod null döner', () => {
    for (const code of [-1, 13, 15, 29, 31, 32, 1000, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(decodeTrackSource(code)).toBeNull()
    }
  })

  it('tip dışı değer (çalışma zamanında) RangeError verir', () => {
    expect(() => trackSourceCode('someOtherSource' as LiveSourceId, 'adsb_icao')).toThrow(
      RangeError,
    )
    expect(() => trackSourceCode('adsbLol', 'radar' as PositionSource)).toThrow(RangeError)
  })
})
