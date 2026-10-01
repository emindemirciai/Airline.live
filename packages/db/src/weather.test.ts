import { describe, expect, it } from 'vitest'
import { dedupeMetars, dedupeTafs, type MetarWrite, type TafWrite } from './weather'

const metar = (raw: string, overrides: Partial<MetarWrite> = {}): MetarWrite => ({
  stationIcao: 'LTFM',
  reportType: 'METAR',
  observedAt: new Date('2026-01-14T06:20:00Z'),
  rawText: raw,
  qnhHpa: 1007,
  flightCategory: 'MVFR',
  ...overrides,
})

describe('dedupeMetars', () => {
  it('aynı anahtarda düzeltilmiş rapor (COR) kalır, sırası ne olursa olsun', () => {
    const original = metar('LTFM 140620Z 22018G28KT 5000 -TSRA 21/10 Q1007')
    const corrected = metar('METAR COR LTFM 140620Z 22018G28KT 5000 -TSRA 10/08 Q1007')
    expect(dedupeMetars([original, corrected])).toEqual([corrected])
    expect(dedupeMetars([corrected, original])).toEqual([corrected])
  })

  it('COR yoksa listede sonra gelen kalır; tür ya da zaman farklıysa ikisi de kalır', () => {
    const a = metar('LTFM 140620Z 22018KT 9999 Q1007')
    const b = metar('LTFM 140620Z 22019KT 9999 Q1007')
    expect(dedupeMetars([a, b])).toEqual([b])
    const speci = metar('LTFM 140620Z 22018KT 3000 TSRA Q1007', { reportType: 'SPECI' })
    const later = metar('LTFM 140650Z 22018KT 9999 Q1007', {
      observedAt: new Date('2026-01-14T06:50:00Z'),
    })
    expect(dedupeMetars([a, speci, later])).toHaveLength(3)
  })
})

describe('dedupeTafs', () => {
  it('anahtar istasyon ve yayın zamanıdır; COR tercih edilir', () => {
    const taf = (raw: string, station = 'LTFM'): TafWrite => ({
      stationIcao: station,
      issuedAt: new Date('2026-01-15T10:40:00Z'),
      validFrom: new Date('2026-01-15T12:00:00Z'),
      validTo: new Date('2026-01-16T18:00:00Z'),
      rawText: raw,
    })
    const original = taf('TAF LTFM 151040Z 1512/1618 03015KT 9999 SCT025')
    const corrected = taf('TAF COR LTFM 151040Z 1512/1618 03015KT 9999 BKN025')
    const other = taf('TAF LTBA 151040Z 1512/1612 04010KT CAVOK', 'LTBA')
    expect(dedupeTafs([corrected, original, other])).toEqual([corrected, other])
  })
})
