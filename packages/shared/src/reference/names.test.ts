import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AIRPORT_NAMES,
  airportDisplayName,
  FOREIGN_AIRPORT_NAMES,
  ourAirportsIcao,
  REFERENCE_AIRFIELD_NAMES,
} from './index'

// Commit'li OurAirports alt kümesi (tools/fixtures/README.md); `""` kaçışlı tırnaktır.
const csv = (path: string) => {
  const text = readFileSync(new URL(`../../../../tools/fixtures/${path}`, import.meta.url), 'utf8')
  const [header = '', ...lines] = text.split(/\r?\n/)
  const columns = header.slice(1, -1).split('","')
  return lines.filter(Boolean).map((line) => {
    const values = line
      .slice(1, -1)
      .split('","')
      .map((v) => v.replaceAll('""', '"'))
    return new Map(columns.map((column, i) => [column, values[i] ?? '']))
  })
}

const ourAirportsName = new Map(
  csv('ourairports/airports.csv').map((r) => [
    // Kanonik ICAO, kaynak düzeltmeleriyle (İskenderiye HEAX → HEBA, D-088).
    ourAirportsIcao({
      ident: r.get('ident') ?? '',
      icaoCode: r.get('icao_code'),
      gpsCode: r.get('gps_code'),
    }),
    r.get('name') ?? '',
  ]),
)

const turkish = Object.keys(AIRPORT_NAMES)
const reference = Object.keys(REFERENCE_AIRFIELD_NAMES)
const foreign = Object.keys(FOREIGN_AIRPORT_NAMES)
/**
 * Görünen adı olan bütün havalimanları: 56 Türkiye (askerî hava üsleri tabloda yok, D-107), 5
 * uzaklık referansı, 1., 2. ve 3. halkanın 442'si (75 + 89 + 278, D-088, D-090).
 */
const all = [...turkish, ...reference, ...foreign]

/** İngilizce cins adları: Türkçe adda bulunmaz (kullanıcı isteği 2026-10-03, D-084). */
const ENGLISH_GENERIC = /\b(Air ?[Bb]ase|Airport|International|National|Airfield|Heliport|Island)\b/
/** Türkçe cins adları: İngilizce adda bulunmaz. */
const TURKISH_GENERIC = /Havalimanı|Havaalanı|Hava Üssü|Üssü|Uluslararası|Ulusal/

describe('görünen adların dili (D-084)', () => {
  it("fixture'daki 503 havalimanının her biri fixture'da vardır ve iki dilde adlanır", () => {
    expect(turkish).toHaveLength(56)
    expect(reference).toHaveLength(5)
    expect(foreign).toHaveLength(442)
    for (const icao of all) {
      const name = ourAirportsName.get(icao)
      expect(name, icao).toBeDefined()
      for (const locale of ['tr', 'en'] as const) {
        expect(airportDisplayName({ icao, name: name ?? '' }, locale).trim(), icao).not.toBe('')
      }
    }
  })

  it('Türkçe adda İngilizce cins adı (Air Base, Airbase, Airport, International) yoktur', () => {
    for (const icao of all) {
      const tr = airportDisplayName({ icao, name: ourAirportsName.get(icao) ?? '' }, 'tr')
      expect(tr, icao).not.toMatch(ENGLISH_GENERIC)
    }
  })

  it('İngilizce adda Türkçe cins adı (Havalimanı, Hava Üssü, Uluslararası) yoktur', () => {
    for (const icao of all) {
      const en = airportDisplayName({ icao, name: ourAirportsName.get(icao) ?? '' }, 'en')
      expect(en, icao).not.toMatch(TURKISH_GENERIC)
    }
  })

  it('OurAirports adı hiçbir Türkiye havalimanında olduğu gibi gösterilmez', () => {
    // Önceden askerî alanlar iki dilde "Etimesgut Air Base", "Çiğli Airbase" yazıyordu.
    for (const icao of turkish) {
      const name = ourAirportsName.get(icao) ?? ''
      expect(airportDisplayName({ icao, name }, 'tr'), icao).not.toBe(name)
    }
  })

  it('Türkçe yazım düzeltmeleri: Gebele, Şehit Eşrefi İsfahani, Serdar Cengel', () => {
    const tr = (icao: string) => airportDisplayName({ icao, name: '' }, 'tr')
    expect(tr('UBBQ')).toBe('Gebele Havalimanı')
    expect(tr('OICC')).toBe('Kirmanşah Şehit Eşrefi İsfahani Havalimanı')
    expect(tr('OIGG')).toBe('Reşt Serdar Cengel Havalimanı')
    // İngilizce ad OurAirports adı kalır.
    expect(airportDisplayName({ icao: 'UBBQ', name: '' }, 'en')).toBe(
      'Gabala International Airport',
    )
  })
})
