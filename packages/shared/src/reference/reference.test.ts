import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AIRPORT_NAMES,
  airportDisplayName,
  airportDistrict,
  airportName,
  airportNameSource,
  provinceName,
  RUNWAY_SURFACE_KEYS,
  runwaySurfaceKey,
  TR_PROVINCES,
} from './index'

// Commit'li OurAirports alt kümesi (tools/fixtures/README.md): Türkiye'nin bütün kayıtları.
const csv = (path: string) => {
  const text = readFileSync(new URL(`../../../../tools/fixtures/${path}`, import.meta.url), 'utf8')
  const [header = '', ...lines] = text.split(/\r?\n/)
  const columns = header.slice(1, -1).split('","')
  return lines.filter(Boolean).map((line) => {
    const values = line.slice(1, -1).split('","')
    return new Map(columns.map((column, i) => [column, values[i] ?? '']))
  })
}

const airportRows = csv('ourairports/airports.csv')
const runwayRows = csv('ourairports/runways.csv')
const trRows = airportRows.filter((r) => r.get('iso_country') === 'TR')
const LISTED_TYPES = ['large_airport', 'medium_airport', 'small_airport']

/**
 * Veritabanındaki IATA kodlu Türkiye havalimanları: içe aktarım süzgeci (büyük, orta ya da
 * tarifeli; data-sources.md §3) ve `toListedAirports` kuralı (üç harfli IATA; ICAO = icao_code,
 * yoksa gps_code, o da yoksa ident).
 */
const listedIcaos = trRows
  .filter(
    (r) =>
      r.get('type') === 'large_airport' ||
      r.get('type') === 'medium_airport' ||
      r.get('scheduled_service') === 'yes',
  )
  .filter((r) => LISTED_TYPES.includes(r.get('type') ?? ''))
  .filter((r) => /^[A-Z]{3}$/.test((r.get('iata_code') ?? '').trim().toUpperCase()))
  .map((r) => (r.get('icao_code') || r.get('gps_code') || r.get('ident') || '').toUpperCase())

describe('TR_PROVINCES', () => {
  it('81 ilin hepsi TR-01 … TR-81 kodlarıyla, iki dilde dolu', () => {
    const codes = Array.from({ length: 81 }, (_, i) => `TR-${String(i + 1).padStart(2, '0')}`)
    expect(Object.keys(TR_PROVINCES).sort()).toEqual(codes)
    for (const [code, name] of Object.entries(TR_PROVINCES)) {
      expect(name.tr.trim(), code).not.toBe('')
      expect(name.en.trim(), code).not.toBe('')
    }
    expect(new Set(Object.values(TR_PROVINCES).map((n) => n.tr)).size).toBe(81)
  })

  it("fixture'daki her Türkiye iso_region kodu bir ile çözülür (heliport ve kapalı alanlar dahil)", () => {
    expect(trRows.length).toBeGreaterThan(400)
    for (const row of trRows) {
      const region = row.get('iso_region') ?? ''
      expect(provinceName(region, 'tr'), `${row.get('ident')} ${region}`).not.toBeNull()
    }
  })

  it('provinceName: dile göre yazım, kod biçimi ve bilinmeyen kod', () => {
    expect(provinceName('TR-34', 'tr')).toBe('İstanbul')
    expect(provinceName('TR-34', 'en')).toBe('Istanbul')
    expect(provinceName('TR-35', 'en')).toBe('Izmir')
    expect(provinceName('TR-33', 'tr')).toBe('Mersin')
    expect(provinceName('TR-76', 'en')).toBe('Iğdır')
    expect(provinceName(' tr-06 ', 'tr')).toBe('Ankara')
    for (const bad of ['TR-00', 'TR-82', 'TR-1', 'DE-HE', '', 'toString', '__proto__']) {
      expect(provinceName(bad, 'tr'), bad).toBeNull()
    }
    expect(provinceName(null, 'tr')).toBeNull()
    expect(provinceName(undefined, 'en')).toBeNull()
  })
})

describe('airportDistrict', () => {
  const district = (isoRegion: string, municipality: string | null) =>
    airportDistrict({ isoRegion, municipality })

  it('ham OurAirports yerleşimi ille aynıysa ya da biçimsizse gösterilmez', () => {
    // OurAirports kayıtları: LTFM, LTBA, LTFJ, LTAC.
    expect(district('TR-34', 'Istanbul')).toBeNull()
    expect(district('TR-34', 'Istanbul(Bakırköy)')).toBeNull()
    expect(district('TR-34', 'Pendik, Istanbul')).toBeNull()
    expect(district('TR-06', 'Ankara')).toBeNull()
    expect(district('TR-03', 'AFYONKARAHISAR')).toBeNull()
    expect(district('TR-35', 'Izmir 2')).toBeNull()
    expect(district('TR-35', null)).toBeNull()
    expect(district('TR-35', '  ')).toBeNull()
  })

  it('tek ve ilden farklı yer adı olduğu gibi kalır', () => {
    expect(district('TR-35', 'Gaziemir')).toBe('Gaziemir')
    expect(district('TR-01', 'Sarıçam')).toBe('Sarıçam')
    expect(district('TR-33', ' Tarsus ')).toBe('Tarsus')
    expect(district('TR-43', 'Altıntaş')).toBe('Altıntaş')
    // Bölge tanınmazsa yalnızca biçim denetlenir.
    expect(district('XX-1', 'Somewhere')).toBe('Somewhere')
  })

  it('fixture’daki hiçbir havalimanında İstanbul kayıtlarının ham biçimi kalmaz', () => {
    for (const row of trRows) {
      if (!row.get('iata_code')) continue
      const value = district(row.get('iso_region') ?? '', row.get('municipality') ?? null)
      expect(value ?? '', row.get('ident')).not.toMatch(/[,()]|^Istanbul$/)
    }
  })
})

describe('AIRPORT_NAMES', () => {
  it("tablo, fixture'daki IATA kodlu 61 Türkiye havalimanını eksiksiz ve fazlasız kapsar", () => {
    expect(listedIcaos).toHaveLength(61)
    expect(Object.keys(AIRPORT_NAMES).sort()).toEqual([...listedIcaos].sort())
  })

  it('resmî adlar dolu, Türkçe ad "Havalimanı", İngilizce ad "Airport" ile biter', () => {
    for (const [icao, entry] of Object.entries(AIRPORT_NAMES)) {
      if (entry.source === 'ourairports') continue
      expect(entry.tr, icao).toMatch(/\S Havalimanı$/)
      expect(entry.en, icao).toMatch(/\S Airport$/)
      expect(entry.tr, icao).toBe(entry.tr.trim())
      expect(entry.en, icao).not.toMatch(/Havalimanı|Uluslararası|İstanbul|İzmir/)
    }
  })

  it('kaynak dağılımı: 50 DHMİ, 5 işletmeci, 6 askerî alan OurAirports adıyla', () => {
    const sources = Object.values(AIRPORT_NAMES).map((e) => e.source)
    expect(sources.filter((s) => s === 'dhmi')).toHaveLength(50)
    expect(sources.filter((s) => s === 'operator')).toHaveLength(5)
    expect(
      Object.entries(AIRPORT_NAMES)
        .filter(([, e]) => e.source === 'ourairports')
        .map(([icao]) => icao),
    ).toEqual(['LTAD', 'LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'])
  })

  it('airportDisplayName: resmî ad, İngilizce karşılık ya da OurAirports adı', () => {
    const ist = { icao: 'LTFM', name: 'İstanbul Airport' }
    expect(airportDisplayName(ist, 'tr')).toBe('İstanbul Havalimanı')
    expect(airportDisplayName(ist, 'en')).toBe('Istanbul Airport')
    const cov = { icao: 'LTDB', name: 'Çukurova International Airport' }
    expect(airportDisplayName(cov, 'tr')).toBe('Çukurova Uluslararası Havalimanı')
    const incirlik = { icao: 'LTAG', name: 'İncirlik Air Base' }
    expect(airportDisplayName(incirlik, 'tr')).toBe('İncirlik Air Base')
    expect(airportDisplayName(incirlik, 'en')).toBe('İncirlik Air Base')
    // Tabloda olmayan havalimanı (ör. OurAirports'a sonradan eklenen ya da sonraki halkalardaki)
    // OurAirports adıyla görünür; Türkçede "Airport" kuralla "Havalimanı" olur (D-080).
    expect(airportDisplayName({ icao: 'EGLL', name: 'London Heathrow Airport' }, 'tr')).toBe(
      'London Heathrow Havalimanı',
    )
    expect(airportDisplayName({ icao: 'EGLL', name: 'London Heathrow Airport' }, 'en')).toBe(
      'London Heathrow Airport',
    )
    expect(airportDisplayName({ icao: 'LTZZ', name: 'Yozgat Airport' }, 'tr')).toBe(
      'Yozgat Havalimanı',
    )
    expect(airportDisplayName({ icao: 'ltfj', name: 'x' }, 'tr')).toBe(
      'İstanbul Sabiha Gökçen Uluslararası Havalimanı',
    )
  })

  it("fixture'daki her havalimanı bir ada çözülür: tablo adı ya da açık OurAirports yedeği", () => {
    for (const row of trRows) {
      const icao = (row.get('icao_code') || row.get('gps_code') || row.get('ident') || '').trim()
      if (!listedIcaos.includes(icao)) continue
      const name = row.get('name') ?? ''
      const entry = airportName(icao)
      expect(entry, icao).toBeDefined()
      const shown = airportDisplayName({ icao, name }, 'tr')
      expect(shown, icao).toBe(entry?.source === 'ourairports' ? name : entry?.tr)
      expect(shown.trim(), icao).not.toBe('')
    }
  })

  it('airportName ve airportNameSource: bilinmeyen ve özel kodlar', () => {
    expect(airportName('LTFM')?.source).toBe('operator')
    expect(airportName('toString')).toBeUndefined()
    expect(airportName('__proto__')).toBeUndefined()
    expect(airportNameSource('LTAC')).toBe('dhmi')
    expect(airportNameSource('LTBI')).toBe('ourairports')
    expect(airportNameSource('ZZZZ')).toBe('ourairports')
  })
})

describe('runwaySurfaceKey', () => {
  it("fixture'daki her dolu kaplama kodu bilinen bir türe çevrilir", () => {
    const surfaces = new Set(runwayRows.map((r) => r.get('surface') ?? ''))
    for (const surface of surfaces) {
      if (surface.trim() === '') continue
      expect(runwaySurfaceKey(surface), surface).not.toBe('unknown')
    }
  })

  it('yazım farkları aynı türe düşer; boş ve tanınmayan kod unknown', () => {
    for (const code of ['ASP', 'ASPH', 'Asphalt', 'ASPHALT', ' asp ']) {
      expect(runwaySurfaceKey(code), code).toBe('asphalt')
    }
    for (const code of ['CON', 'CONC', 'Concrete', 'CONCRETE', 'concrete']) {
      expect(runwaySurfaceKey(code), code).toBe('concrete')
    }
    expect(runwaySurfaceKey('PEM')).toBe('mixed')
    expect(runwaySurfaceKey('Asphalt/Concrete')).toBe('mixed')
    expect(runwaySurfaceKey('CON/ASP')).toBe('mixed')
    expect(runwaySurfaceKey('PER')).toBe('paved')
    expect(runwaySurfaceKey('GRASS')).toBe('grass')
    expect(runwaySurfaceKey('TURF')).toBe('grass')
    expect(runwaySurfaceKey('Ground')).toBe('dirt')
    expect(runwaySurfaceKey('GRE')).toBe('gravel')
    expect(runwaySurfaceKey('WATER')).toBe('water')
    for (const code of ['', '  ', 'UNK', 'MOON', 'constructor', null, undefined]) {
      expect(runwaySurfaceKey(code), String(code)).toBe('unknown')
    }
  })

  it('her anahtar RUNWAY_SURFACE_KEYS içindedir', () => {
    const inputs = ['ASP', 'CON', 'PEM', 'PER', 'GRS', 'DIRT', 'GVL', 'WATER', 'x']
    for (const input of inputs) {
      expect(RUNWAY_SURFACE_KEYS).toContain(runwaySurfaceKey(input))
    }
  })
})
