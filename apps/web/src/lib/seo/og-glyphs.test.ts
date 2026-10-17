import { fileURLToPath } from 'node:url'
import type { Locale } from '@havayolu/shared'
import { describe, expect, it } from 'vitest'
import { airportLocation, airportName } from '../../components/airports/airport-text'
import { fixtureForeignCandidates, fixtureTurkishAirports } from '../test/ourairports-fixture'
import { foldOgText, isOgGlyph, OG_GLYPH_RANGES } from './og-glyphs'
import { woffCodePoints } from './test/woff-cmap'

const FONT_DIR = new URL('../../../assets/og-fonts/', import.meta.url)
const font = (file: string) => woffCodePoints(fileURLToPath(new URL(file, FONT_DIR)))

describe('OG_GLYPH_RANGES: yazı tiplerinin kendisi (D-111)', () => {
  it('dört .woff dosyasının cmap kesişimiyle aynı; iki kalınlık aynı harfleri taşır', () => {
    const regular = new Set([
      ...font('overpass-latin-400-normal.woff'),
      ...font('overpass-latin-ext-400-normal.woff'),
    ])
    const bold = new Set([
      ...font('overpass-latin-800-normal.woff'),
      ...font('overpass-latin-ext-800-normal.woff'),
    ])
    expect([...regular].sort((a, b) => a - b)).toEqual([...bold].sort((a, b) => a - b))
    const ranges: string[] = []
    let start: number | null = null
    const sorted = [...regular].sort((a, b) => a - b)
    sorted.forEach((cp, i) => {
      start ??= cp
      if (sorted[i + 1] !== cp + 1) {
        ranges.push(start === cp ? cp.toString(16) : `${start.toString(16)}-${cp.toString(16)}`)
        start = null
      }
    })
    expect(ranges.join(',')).toBe(OG_GLYPH_RANGES)
    expect(regular.size).toBe(657)
  })

  it('Türkçe ve 1.–4. halkanın harfleri var; Vietnamca, Arapça ve Çince yok', () => {
    for (const char of 'ğĞıİşŞçÇöÖüÜșăđłéřěńžøÅ’–') {
      expect(isOgGlyph(char.codePointAt(0) ?? 0), char).toBe(true)
    }
    for (const char of 'ốếạ\u{0645}中') {
      expect(isOgGlyph(char.codePointAt(0) ?? 0), char).toBe(false)
    }
  })
})

describe('foldOgText', () => {
  it('glifi olan metin değişmez (aynı dize)', () => {
    const text = 'İstanbul Sabiha Gökçen Uluslararası Havalimanı'
    expect(foldOgText(text)).toBe(text)
    expect(foldOgText('Côte d’Ivoire · Curaçao')).toBe('Côte d’Ivoire · Curaçao')
  })

  it('olmayan harf temel harfine iner (NFD, işaretler atılır); temel harf de yoksa düşer', () => {
    expect(foldOgText('Phú Quốc Uluslararası Havalimanı')).toBe('Phú Quoc Uluslararası Havalimanı')
    expect(foldOgText('Huế, Vietnam')).toBe('Hue, Vietnam')
    // Düşen yazının bıraktığı boşluk ve uçtaki ayraç temizlenir.
    expect(foldOgText('Guemar Airport - مطار قمار بالوادي')).toBe('Guemar Airport')
    expect(foldOgText('中文')).toBe('')
  })

  it('fixture’ın bütün havalimanları (Türkiye ve 1.–5. halka adayları), iki dilde ad ve yer satırı (şehir, ülke): katlanınca her harfin glifi var', () => {
    const airports = [...fixtureTurkishAirports(), ...fixtureForeignCandidates()]
    // Türkiye 56 + yabancı adaylar (5. halka dahil, askerî liste hariç).
    expect(airports.length).toBeGreaterThan(3_200)
    const folded = new Set<string>()
    for (const airport of airports) {
      for (const locale of ['tr', 'en'] as const satisfies readonly Locale[]) {
        for (const text of [airportName(airport, locale), airportLocation(airport, locale)]) {
          const out = foldOgText(text)
          const missing = [...out].filter((char) => !isOgGlyph(char.codePointAt(0) ?? 0))
          expect(missing, `${airport.icao} ${locale} ${text}`).toEqual([])
          if (out !== text) folded.add(airport.icao)
        }
      }
    }
    // Katlanan metinler yalnız 5. halkanın kaynak adlarında (adlar M6j.3'te gelir); 1.–4. halka değişmez.
    const ringOf = new Map(airports.map((airport) => [airport.icao, airport.ring]))
    expect([...folded].filter((icao) => (ringOf.get(icao) ?? 0) < 5)).toEqual([])
    expect(folded).toContain('VVPQ')
  })
})
