import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AIRPORT_MAP_NAME_MAX_LENGTH,
  AIRPORT_MAP_NAMES,
  AIRPORT_NAMES,
  airportDisplayName,
  airportMapName,
  FOREIGN_AIRPORT_NAMES,
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
    (r.get('icao_code') || r.get('gps_code') || r.get('ident') || '').trim().toUpperCase(),
    r.get('name') ?? '',
  ]),
)

const turkish = Object.keys(AIRPORT_NAMES)
const reference = Object.keys(REFERENCE_AIRFIELD_NAMES)
const foreign = Object.keys(FOREIGN_AIRPORT_NAMES)
/** Görünen adı olan bütün havalimanları: 61 Türkiye, 5 uzaklık referansı, 1. halkanın 75'i. */
const all = [...turkish, ...reference, ...foreign]

/** İngilizce cins adları: Türkçe adda bulunmaz (kullanıcı isteği 2026-10-03, D-084). */
const ENGLISH_GENERIC = /\b(Air ?[Bb]ase|Airport|International|National|Airfield|Heliport|Island)\b/
/** Türkçe cins adları: İngilizce adda bulunmaz. */
const TURKISH_GENERIC = /Havalimanı|Havaalanı|Hava Üssü|Üssü|Uluslararası|Ulusal/

describe('görünen adların dili (D-084)', () => {
  it("fixture'daki 141 havalimanının her biri fixture'da vardır ve iki dilde adlanır", () => {
    expect(turkish).toHaveLength(61)
    expect(reference).toHaveLength(5)
    expect(foreign).toHaveLength(75)
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

  it('Türkçe yazım düzeltmeleri: Gebele, Şehit Eşrefi İsfahani, Serdar-ı Cengel', () => {
    const tr = (icao: string) => airportDisplayName({ icao, name: '' }, 'tr')
    expect(tr('UBBQ')).toBe('Gebele Havalimanı')
    expect(tr('OICC')).toBe('Kirmanşah Şehit Eşrefi İsfahani Havalimanı')
    expect(tr('OIGG')).toBe('Reşt Serdar-ı Cengel Havalimanı')
    // İngilizce ad OurAirports adı kalır.
    expect(airportDisplayName({ icao: 'UBBQ', name: '' }, 'en')).toBe(
      'Gabala International Airport',
    )
  })
})

describe('airportMapName: haritadaki kısa ad (D-084)', () => {
  const listed = [...turkish, ...foreign]

  it('Türkiye tablosu ad tablosuyla aynı havalimanlarını kapsar', () => {
    expect(Object.keys(AIRPORT_MAP_NAMES).sort()).toEqual([...turkish].sort())
  })

  it('listelenen her havalimanının iki dilde en çok 16 karakterlik kısa adı vardır', () => {
    expect(AIRPORT_MAP_NAME_MAX_LENGTH).toBe(16)
    for (const icao of listed) {
      for (const locale of ['tr', 'en'] as const) {
        const name = airportMapName({ icao }, locale)
        expect(name, `${icao} ${locale}`).not.toBeNull()
        expect(name, `${icao} ${locale}`).toBe(name?.trim())
        expect([...(name ?? '')].length, `${icao} ${locale}: ${name}`).toBeLessThanOrEqual(
          AIRPORT_MAP_NAME_MAX_LENGTH,
        )
        expect(name, `${icao} ${locale}`).toMatch(/^\p{Lu}/u)
      }
    }
  })

  it('kısa ad dile uygundur ve her dilde tekildir (iki kutu aynı adı yazmaz)', () => {
    for (const icao of listed) {
      expect(airportMapName({ icao }, 'tr'), icao).not.toMatch(
        /\b(Base|Air|Airport|International)\b/,
      )
      expect(airportMapName({ icao }, 'en'), icao).not.toMatch(/Üssü|Havalimanı|Hava\b/)
    }
    for (const locale of ['tr', 'en'] as const) {
      const names = listed.map((icao) => airportMapName({ icao }, locale))
      expect(new Set(names).size, locale).toBe(names.length)
    }
  })

  it('Türkiye’de kısa ad görünen addaki yer adıdır ("Üssü" / "Base" dışında)', () => {
    for (const icao of turkish) {
      for (const locale of ['tr', 'en'] as const) {
        const place = (airportMapName({ icao }, locale) ?? '').replace(/ (Üssü|Base)$/, '')
        expect(airportDisplayName({ icao, name: '' }, locale), `${icao} ${locale}`).toContain(place)
      }
    }
  })

  it('örnekler; tabloda olmayan ya da özel kodlu havalimanında null', () => {
    const both = (icao: string) => [airportMapName({ icao }, 'tr'), airportMapName({ icao }, 'en')]
    expect(both('LTFM')).toEqual(['İstanbul', 'Istanbul'])
    expect(both(' ltfj ')).toEqual(['Sabiha Gökçen', 'Sabiha Gökçen'])
    expect(both('LTAC')).toEqual(['Esenboğa', 'Esenboğa'])
    expect(both('LTAD')).toEqual(['Etimesgut', 'Etimesgut'])
    expect(both('LTAG')).toEqual(['İncirlik Üssü', 'Incirlik Base'])
    expect(both('LTCW')).toEqual(['Yüksekova', 'Yüksekova'])
    expect(both('LGAV')).toEqual(['Atina', 'Athens'])
    expect(both('LROP')).toEqual(['Bükreş', 'Bucharest'])
    expect(both('LRBS')).toEqual(['Băneasa', 'Băneasa'])
    expect(both('UBBQ')).toEqual(['Gebele', 'Gabala'])
    expect(both('EGLL')).toEqual([null, null])
    expect(both('toString')).toEqual([null, null])
    expect(both('__proto__')).toEqual([null, null])
  })
})
