import { describe, expect, it } from 'vitest'
import { LiveArgsError } from './args'
import { pointPath } from './guard'
import { findStationPoint } from './station'
import { FIXTURES_DIR } from './test/adsblol-stub'

describe('findStationPoint', () => {
  it("LTFM'nin ARP'ı commit'li fixture'daki nokta sorgusunun yolunu verir", () => {
    const ltfm = findStationPoint('LTFM', FIXTURES_DIR)
    expect(ltfm).toEqual({ icao: 'LTFM', lat: 41.274874, lon: 28.732136 })
    expect(pointPath(ltfm.lat, ltfm.lon, 40)).toBe('/v2/point/41.2749/28.7321/40')
    expect(findStationPoint(' ltfm ', FIXTURES_DIR).icao).toBe('LTFM')
  })

  it('kanonik ICAO ile eşleşir: UZSS bulunur, OurAirports kimliği UTSS bulunmaz', () => {
    expect(findStationPoint('UZSS', FIXTURES_DIR)).toMatchObject({ icao: 'UZSS', lat: 39.701842 })
    expect(() => findStationPoint('UTSS', FIXTURES_DIR)).toThrow(LiveArgsError)
  })

  it('D-088 düzeltmesi: İskenderiye HEBA ile bulunur, kaynaktaki yanlış HEAX ile bulunmaz', () => {
    expect(findStationPoint('HEBA', FIXTURES_DIR)).toMatchObject({ icao: 'HEBA', lat: 30.93249 })
    expect(() => findStationPoint('HEAX', FIXTURES_DIR)).toThrow(/fixture'ında yok/)
  })

  it('bilinmeyen ya da biçimi bozuk kod LiveArgsError', () => {
    expect(() => findStationPoint('ZZZZ', FIXTURES_DIR)).toThrow(/ZZZZ OurAirports/)
    for (const code of ['LTF', 'LTFMX', 'IST1', '']) {
      expect(() => findStationPoint(code, FIXTURES_DIR)).toThrow(LiveArgsError)
    }
  })
})
