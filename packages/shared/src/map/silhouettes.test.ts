import { describe, expect, it } from 'vitest'
import { AIRCRAFT_CATEGORIES } from './aircraft'
import { AIRCRAFT_SILHOUETTES, AIRCRAFT_TAIL_ACCENTS, SILHOUETTE_VIEWBOX } from './silhouettes'

/** Yol dizesindeki uç noktalar (M, L, C, Q, A komutlarının son koordinat çiftleri ve kontrol noktaları). */
function points(path: string): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = []
  const commands = path.match(/[A-Za-z][^A-Za-z]*/g) ?? []
  for (const command of commands) {
    const letter = command[0] ?? ''
    const numbers = (command.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number)
    if (letter === 'Z') continue
    if (letter === 'A') {
      // rx ry dönüş büyük-yay yön x y
      for (let i = 0; i + 6 < numbers.length; i += 7) {
        result.push({ x: numbers[i + 5] ?? NaN, y: numbers[i + 6] ?? NaN })
      }
      continue
    }
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      result.push({ x: numbers[i] ?? NaN, y: numbers[i + 1] ?? NaN })
    }
  }
  return result
}

describe('uçak silüetleri', () => {
  it('her sınıf için yalnızca mutlak M/L/C/Q/A/Z komutlarından oluşan kapalı bir yol vardır', () => {
    for (const category of AIRCRAFT_CATEGORIES) {
      const path = AIRCRAFT_SILHOUETTES[category]
      expect(path, category).toMatch(/^M/)
      expect(path.replace(/[\d.\s-]/g, ''), category).toMatch(/^[MLCQAZ]+$/)
      expect(path.trim().endsWith('Z'), category).toBe(true)
    }
  })

  it('görünüm kutusunun içinde, kenar çizgisine pay bırakarak durur', () => {
    expect(SILHOUETTE_VIEWBOX).toBe(64)
    for (const category of AIRCRAFT_CATEGORIES) {
      for (const { x, y } of points(AIRCRAFT_SILHOUETTES[category])) {
        expect(Number.isFinite(x) && Number.isFinite(y), category).toBe(true)
        expect(x, category).toBeGreaterThanOrEqual(1.5)
        expect(x, category).toBeLessThanOrEqual(62.5)
        expect(y, category).toBeGreaterThanOrEqual(1.5)
        expect(y, category).toBeLessThanOrEqual(62.5)
      }
    }
  })

  it('yatayda ortalı ve simetriktir (burun yukarıda, x = 32 ekseni)', () => {
    for (const category of AIRCRAFT_CATEGORIES) {
      const xs = points(AIRCRAFT_SILHOUETTES[category]).map((p) => p.x)
      expect(Math.min(...xs) + Math.max(...xs), category).toBeCloseTo(SILHOUETTE_VIEWBOX, 5)
      // En üst nokta (burun ya da rotor) eksen üzerindedir ya da eksene göre simetrik bir çifttir.
      const ys = points(AIRCRAFT_SILHOUETTES[category]).map((p) => p.y)
      expect(Math.min(...ys), category).toBeLessThan(16)
    }
  })

  it('sınıfların boyutu farklıdır: geniş gövde en büyük, hafif uçak ve helikopter daha küçük', () => {
    const span = (category: (typeof AIRCRAFT_CATEGORIES)[number]) => {
      const xs = points(AIRCRAFT_SILHOUETTES[category]).map((p) => p.x)
      return Math.max(...xs) - Math.min(...xs)
    }
    expect(span('heavy')).toBeGreaterThan(span('jet'))
    expect(span('jet')).toBeGreaterThan(span('unknown'))
    expect(span('jet')).toBeGreaterThan(span('rotor'))
  })

  it('kuyruk vurgusu her sınıfta vardır ve ince bir şerit olarak eksende kalır', () => {
    for (const category of AIRCRAFT_CATEGORIES) {
      const accent = points(AIRCRAFT_TAIL_ACCENTS[category])
      expect(accent.length, category).toBeGreaterThan(2)
      for (const { x, y } of accent) {
        expect(Math.abs(x - 32), category).toBeLessThanOrEqual(1.2)
        expect(y, category).toBeGreaterThan(32)
        expect(y, category).toBeLessThanOrEqual(62.5)
      }
    }
  })

  it('silüetler birbirinden farklıdır', () => {
    const paths = new Set(AIRCRAFT_CATEGORIES.map((category) => AIRCRAFT_SILHOUETTES[category]))
    expect(paths.size).toBe(AIRCRAFT_CATEGORIES.length)
  })
})
