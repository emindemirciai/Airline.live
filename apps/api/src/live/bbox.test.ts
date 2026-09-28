import type { CoverageCircle } from '@havayolu/db'
import { distanceNm } from '@havayolu/geo'
import { describe, expect, it } from 'vitest'
import { coverageOf, distanceToBboxNm, inBbox, parseBbox, toBbox } from './bbox'

describe('parseBbox', () => {
  it('minLon,minLat,maxLon,maxLat biçimini okur', () => {
    expect(parseBbox('28.5,40.8,29.5,41.5')).toEqual({
      minLon: 28.5,
      minLat: 40.8,
      maxLon: 29.5,
      maxLat: 41.5,
    })
    expect(parseBbox(' -10 , -5.5 ,10., .5 ')).toEqual({
      minLon: -10,
      minLat: -5.5,
      maxLon: 10,
      maxLat: 0.5,
    })
    // En geniş izinli kutu: tam 60° × 40°.
    expect(parseBbox('0,0,60,40')).not.toBeNull()
    // Sınırlar dahil.
    expect(parseBbox('-180,-90,-120,-50')).not.toBeNull()
    expect(parseBbox('120,50,180,90')).not.toBeNull()
  })

  it('bozuk, sınır dışı, ters ya da çok geniş kutuyu reddeder', () => {
    for (const bad of [
      '',
      '1,2,3',
      '1,2,3,4,5',
      '28,40,29,x',
      '28,40,29,',
      '1e1,2,30,4',
      '0x10,2,30,4',
      'NaN,2,30,4',
      'Infinity,2,30,4',
      '28,40,28,41', // min = max
      '29,40,28,41', // min > max
      '28,41,29,40',
      '-181,0,-170,10',
      '170,0,181,10',
      '0,-91,10,0',
      '0,80,10,91',
      '0,0,60.0001,10', // 60°'den geniş
      '0,0,10,40.5', // 40°'den geniş
      '170,0,-170,10', // antimeridyeni aşan kutu desteklenmez
    ]) {
      expect(parseBbox(bad), bad).toBeNull()
    }
  })

  it('toBbox sayıları aynı kurallarla doğrular (WebSocket)', () => {
    expect(toBbox(28, 40, 29, 41)).toEqual({ minLon: 28, minLat: 40, maxLon: 29, maxLat: 41 })
    expect(toBbox(Number.NaN, 40, 29, 41)).toBeNull()
    expect(toBbox(28, 40, Number.POSITIVE_INFINITY, 41)).toBeNull()
    expect(toBbox(0, 0, 61, 10)).toBeNull()
  })
})

describe('inBbox', () => {
  const box = { minLon: 28, minLat: 40, maxLon: 29, maxLat: 41 }
  it('içerideki ve sınırdaki nokta içeride, dışarıdaki dışarıda', () => {
    expect(inBbox({ lat: 40.5, lon: 28.5 }, box)).toBe(true)
    expect(inBbox({ lat: 40, lon: 28 }, box)).toBe(true)
    expect(inBbox({ lat: 41, lon: 29 }, box)).toBe(true)
    expect(inBbox({ lat: 41.0001, lon: 28.5 }, box)).toBe(false)
    expect(inBbox({ lat: 40.5, lon: 27.9999 }, box)).toBe(false)
  })
})

describe('coverageOf', () => {
  // LTFM ARP çevresinde 40 NM çember (≈ 0,67° enlem).
  const ist: CoverageCircle = {
    id: 'ist',
    kind: 'primary',
    lat: 41.2753,
    lon: 28.7519,
    radiusNm: 40,
  }
  const wide: CoverageCircle = { id: 'west', kind: 'region', lat: 39, lon: 32, radiusNm: 600 }

  it('çember listesi yoksa unknown', () => {
    expect(coverageOf({ minLon: 28, minLat: 41, maxLon: 29, maxLat: 41.5 }, null)).toBe('unknown')
  })

  it('bütün örnek noktalar içerideyse full', () => {
    expect(coverageOf({ minLon: 28.6, minLat: 41.2, maxLon: 28.9, maxLat: 41.35 }, [ist])).toBe(
      'full',
    )
    expect(coverageOf({ minLon: 26, minLat: 36, maxLon: 42, maxLat: 42 }, [wide])).toBe('full')
  })

  it('bazı noktalar içerideyse partial', () => {
    expect(coverageOf({ minLon: 28.5, minLat: 41, maxLon: 30.5, maxLat: 42 }, [ist])).toBe(
      'partial',
    )
  })

  it('hiçbir nokta içeride değilse none; boş plan da none', () => {
    expect(coverageOf({ minLon: 40, minLat: 37, maxLon: 41, maxLat: 38 }, [ist])).toBe('none')
    expect(coverageOf({ minLon: 28.6, minLat: 41.2, maxLon: 28.9, maxLat: 41.35 }, [])).toBe('none')
  })

  it('bütün Türkiye’yi içeren geniş görünüm partial’dır (çemberler örnek noktaların arasında)', () => {
    // Worker planındaki gerçek çemberler (D-073): Batı, birincil IST ve Doğu.
    const plan: CoverageCircle[] = [
      { id: 'west', kind: 'region', lat: 39.5, lon: 29.5, radiusNm: 250 },
      ist,
      { id: 'east', kind: 'region', lat: 39.2, lon: 38.8, radiusNm: 250 },
    ]
    expect(coverageOf({ minLon: 14, minLat: 27, maxLon: 54, maxLat: 47 }, plan)).toBe('partial')
    expect(coverageOf({ minLon: 0, minLat: 20, maxLon: 60, maxLat: 60 }, plan)).toBe('partial')
    // Merkez kutuda ama hiçbir örnek nokta çemberde değil.
    expect(coverageOf({ minLon: 20, minLat: 41, maxLon: 60, maxLat: 41.5 }, [ist])).toBe('partial')
  })

  it('merkezi kutu dışında kalan çember kenara örnek noktaların arasında değiyorsa partial', () => {
    // IST merkezi batı kenarından ≈ 20 NM uzakta; kenardaki en yakın örnek nokta ≈ 48 NM.
    const box = { minLon: 29.2, minLat: 36, maxLon: 60, maxLat: 44 }
    expect(distanceToBboxNm(ist, box)).toBeGreaterThan(19)
    expect(distanceToBboxNm(ist, box)).toBeLessThan(21)
    expect(coverageOf(box, [ist])).toBe('partial')
    // Aynı kutu çemberin erişemeyeceği kadar doğuda: none.
    expect(coverageOf({ ...box, minLon: 30 }, [ist])).toBe('none')
  })

  it('distanceToBboxNm: içeride 0, enlem kenarında boylam farkı yok, antimeridyen komşuluğu', () => {
    const box = { minLon: 28, minLat: 40, maxLon: 30, maxLat: 41 }
    expect(distanceToBboxNm({ lat: 40.5, lon: 29 }, box)).toBe(0)
    // Kutunun 1° kuzeyi: 60 NM.
    expect(distanceToBboxNm({ lat: 42, lon: 29 }, box)).toBeCloseTo(60, 0)
    // Kuzeydoğu köşesinin dışındaki noktaya en yakın yer köşedir.
    expect(distanceToBboxNm({ lat: 42, lon: 31 }, box)).toBeCloseTo(
      distanceNm({ lat: 42, lon: 31 }, { lat: 41, lon: 30 }),
      6,
    )
    // Boylam kenarının dışında: büyük çember ayağı kenar üzerindedir, köşeden daha yakındır.
    const side = distanceToBboxNm({ lat: 40.5, lon: 31 }, box)
    expect(side).toBeLessThan(distanceNm({ lat: 40.5, lon: 31 }, { lat: 40.5, lon: 30 }))
    expect(side).toBeCloseTo(60 * Math.cos((40.5 * Math.PI) / 180), 0)
    // 179,5° D'deki nokta −180° kenarına 0,5° (≈ 30 NM) uzaktır, 360° değil.
    const pacific = { minLon: -180, minLat: -5, maxLon: -170, maxLat: 5 }
    expect(distanceToBboxNm({ lat: 0, lon: 179.5 }, pacific)).toBeCloseTo(30, 0)
  })

  it('iki çemberin birleşimi kutuyu kapsıyorsa full', () => {
    const left: CoverageCircle = { id: 'a', kind: 'region', lat: 40, lon: 28, radiusNm: 90 }
    const right: CoverageCircle = { id: 'b', kind: 'region', lat: 40, lon: 30, radiusNm: 90 }
    const box = { minLon: 27.5, minLat: 39.7, maxLon: 30.5, maxLat: 40.3 }
    expect(coverageOf(box, [left])).toBe('partial')
    expect(coverageOf(box, [left, right])).toBe('full')
  })
})
