import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AIRPORT_NAMES,
  airportDisplayName,
  airportDistrict,
  airportName,
  airportNameSource,
  airportOfficialName,
  isMilitaryAirfield,
  mapShownAirports,
  MILITARY_AIRFIELD_ICAOS,
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
 * tarifeli; data-sources.md §3) ve `toListedAirports`'ın biçim kuralı (üç harfli IATA; ICAO =
 * icao_code, yoksa gps_code, o da yoksa ident). Askerî hava üsleri de burada sayılır; listelenmezler
 * ve ad tablosunda yoktur (D-107).
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
  it("tablo, fixture'daki IATA kodlu 61 Türkiye satırından askerî üsler dışındaki 56'sını eksiksiz ve fazlasız kapsar (D-107)", () => {
    expect(listedIcaos).toHaveLength(61)
    const civil = listedIcaos.filter((icao) => !isMilitaryAirfield(icao)).sort()
    expect(civil).toHaveLength(56)
    expect(Object.keys(AIRPORT_NAMES).sort()).toEqual(civil)
  })

  it('adlar dolu; "Havalimanı" / "Airport" ile biter', () => {
    for (const [icao, entry] of Object.entries(AIRPORT_NAMES)) {
      expect(entry.tr, icao).toMatch(/\S Havalimanı$/)
      expect(entry.en, icao).toMatch(/\S Airport$/)
      expect(entry.tr, icao).toBe(entry.tr.trim())
      expect(entry.en, icao).not.toMatch(/Havalimanı|Uluslararası|İstanbul|İzmir/)
    }
  })

  it('kaynak dağılımı: 50 DHMİ, 5 işletmeci, 1 bakanlık (LTAD); askerî üs ve OurAirports adı yok', () => {
    const sources = Object.values(AIRPORT_NAMES).map((e) => e.source)
    expect(sources.filter((s) => s === 'dhmi')).toHaveLength(50)
    expect(sources.filter((s) => s === 'operator')).toHaveLength(5)
    const icaos = (source: string) =>
      Object.entries(AIRPORT_NAMES)
        .filter(([, e]) => e.source === source)
        .map(([icao]) => icao)
    expect(icaos('ministry')).toEqual(['LTAD'])
    expect(sources).toHaveLength(56)
    expect(sources).not.toContain('ourairports')
    // Askerî üslerin adı tabloda yoktur (D-107): istemci paketlerine girmez.
    for (const icao of MILITARY_AIRFIELD_ICAOS) expect(airportName(icao), icao).toBeUndefined()
  })

  it('Ankara (Etimesgut) iki dilde (kullanıcı kararı 2026-10-03, D-084)', () => {
    const names = (icao: string, name: string) => [
      airportDisplayName({ icao, name }, 'tr'),
      airportDisplayName({ icao, name }, 'en'),
    ]
    expect(names('LTAD', 'Etimesgut Air Base')).toEqual([
      'Ankara (Etimesgut) Havalimanı',
      'Ankara (Etimesgut) Airport',
    ])
    // Resmî ad: bakanlığın verdiği ad (parantezsiz); tabloda olmayan kodda (askerî üs dahil) yok.
    expect(airportOfficialName('LTAD')).toBe('Ankara Havalimanı')
    expect(airportOfficialName('LTAC')).toBe('Ankara Esenboğa Havalimanı')
    expect(airportOfficialName(' ltfm ')).toBe('İstanbul Havalimanı')
    expect(airportOfficialName('LTAG')).toBeUndefined()
    expect(airportOfficialName('LGAV')).toBeUndefined()
    expect(airportOfficialName('ZZZZ')).toBeUndefined()
  })

  it('airportDisplayName: resmî ad, İngilizce karşılık ya da OurAirports adı', () => {
    const ist = { icao: 'LTFM', name: 'İstanbul Airport' }
    expect(airportDisplayName(ist, 'tr')).toBe('İstanbul Havalimanı')
    expect(airportDisplayName(ist, 'en')).toBe('Istanbul Airport')
    const cov = { icao: 'LTDB', name: 'Çukurova International Airport' }
    expect(airportDisplayName(cov, 'tr')).toBe('Çukurova Uluslararası Havalimanı')
    // Tabloda olmayan havalimanı (ör. OurAirports'a sonradan eklenen ya da sonraki halkalardaki)
    // OurAirports adıyla görünür; Türkçede "Airport" kuralla "Havalimanı" olur (D-080).
    // 5. halka açıldı (M6j.3, D-109): Heathrow ve Los Angeles tablodadır; tabloda olmayan örnek
    // listelenmeyen Paris-Le Bourget'dir (tarifesiz, D-109'un dışlama örneği).
    expect(airportDisplayName({ icao: 'EGLL', name: 'London Heathrow Airport' }, 'tr')).toBe(
      'Londra Heathrow Havalimanı',
    )
    const lax = { icao: 'KLAX', name: 'Los Angeles International Airport' }
    expect(airportDisplayName(lax, 'tr')).toBe('Los Angeles Havalimanı')
    expect(airportDisplayName(lax, 'en')).toBe('Los Angeles International Airport')
    const lfpb = { icao: 'LFPB', name: 'Paris-Le Bourget International Airport' }
    expect(airportDisplayName(lfpb, 'tr')).toBe('Paris-Le Bourget Uluslararası Havalimanı')
    expect(airportDisplayName(lfpb, 'en')).toBe('Paris-Le Bourget International Airport')
    expect(airportDisplayName({ icao: 'LTZZ', name: 'Yozgat Airport' }, 'tr')).toBe(
      'Yozgat Havalimanı',
    )
    expect(airportDisplayName({ icao: 'ltfj', name: 'x' }, 'tr')).toBe(
      'İstanbul Sabiha Gökçen Uluslararası Havalimanı',
    )
  })

  it("fixture'daki her havalimanı tablodaki Türkçe adına çözülür", () => {
    for (const row of trRows) {
      const icao = (row.get('icao_code') || row.get('gps_code') || row.get('ident') || '').trim()
      if (!listedIcaos.includes(icao) || isMilitaryAirfield(icao)) continue
      const name = row.get('name') ?? ''
      const entry = airportName(icao)
      expect(entry, icao).toBeDefined()
      const shown = airportDisplayName({ icao, name }, 'tr')
      expect(shown, icao).toBe(entry?.tr)
      expect(shown.trim(), icao).not.toBe('')
    }
  })

  it("askerî hava üsleri (D-103, D-107): Türkiye'de tam olarak fixture'daki IATA kodlu Türkiye satırlarından ad tablosunda olmayan beşi; Etimesgut ve yurt dışındaki ortak sivil-askerî havalimanları sivil", () => {
    const unnamed = listedIcaos.filter((icao) => !Object.hasOwn(AIRPORT_NAMES, icao)).sort()
    const turkish = MILITARY_AIRFIELD_ICAOS.filter((icao) => icao.startsWith('LT'))
    expect(turkish).toEqual(['LTAG', 'LTAH', 'LTBG', 'LTBI', 'LTBL'])
    expect(turkish).toEqual(unnamed)
    for (const icao of MILITARY_AIRFIELD_ICAOS) {
      expect(isMilitaryAirfield(icao), icao).toBe(true)
      expect(isMilitaryAirfield(` ${icao.toLowerCase()} `), icao).toBe(true)
    }
    // Sivil: tablonun 56 kaydı (Ankara (Etimesgut) dahil, kullanıcı kararı 2026-10-03), tarifeli
    // sivil seferi olan ortak sivil-askerî havalimanları (Bağdat ORBI, Podgorica LYPG,
    // Cuxhaven/Nordholz ETMN; 4. halkanın EKKA, VIAG, DNPM ve ZURK'u; 5. halkanın Ascension FHAW ve
    // MidAmerica KBLV'si, D-103, D-109) ve tabloda olmayan kodlar.
    const civil = Object.keys(AIRPORT_NAMES)
    expect(civil).toHaveLength(56)
    const shared = ['ORBI', 'LYPG', 'ETMN', 'EKKA', 'VIAG', 'DNPM', 'ZURK', 'FHAW', 'KBLV']
    for (const icao of [...civil, ...shared, 'ZZZZ'])
      expect(isMilitaryAirfield(icao), icao).toBe(false)
    expect(isMilitaryAirfield('LTAD')).toBe(false)
    expect(isMilitaryAirfield('__proto__')).toBe(false)
    expect(isMilitaryAirfield('')).toBe(false)
  })

  it("yurt dışı askerî liste (D-109): adı yalnız askerî üç alan fixture'da 5. halka adayıdır", () => {
    const foreign = MILITARY_AIRFIELD_ICAOS.filter((icao) => !icao.startsWith('LT'))
    expect(foreign).toEqual(['PKWA', 'PWAK', 'YBOK'])
    // OurAirports üçünü tarifeli orta havalimanı diye kaydeder (D-080 adayı); adları askerîdir.
    const rows = foreign.map((icao) => airportRows.find((r) => r.get('ident') === icao))
    expect(
      rows.map((r) => [r?.get('type'), r?.get('scheduled_service'), r?.get('iata_code')]),
    ).toEqual([
      ['medium_airport', 'yes', 'KWA'],
      ['medium_airport', 'yes', 'AWK'],
      ['medium_airport', 'yes', 'OKY'],
    ])
    expect(rows.map((r) => r?.get('name'))).toEqual([
      'Bucholz Army Air Field',
      'Wake Island Airfield',
      'Oakey Army Aviation Centre',
    ])
  })

  it('mapShownAirports (D-103): askerî üsleri çıkarır, öbürlerini sırasıyla ve aynı nesneyle tutar', () => {
    const rows = ['LTFM', 'LTBL', 'LTAD', 'ltag', 'ORBI', 'LTBJ', ' LTBI '].map((icao, index) => ({
      icao,
      index,
    }))
    const shown = mapShownAirports(rows)
    expect(shown.map((row) => row.icao)).toEqual(['LTFM', 'LTAD', 'ORBI', 'LTBJ'])
    expect(shown[0]).toBe(rows[0])
    expect(mapShownAirports(MILITARY_AIRFIELD_ICAOS.map((icao) => ({ icao })))).toEqual([])
    expect(mapShownAirports([])).toEqual([])
    const civil = Object.keys(AIRPORT_NAMES).map((icao) => ({ icao }))
    expect(mapShownAirports(civil)).toEqual(civil)
  })

  it('airportName ve airportNameSource: bilinmeyen ve özel kodlar', () => {
    expect(airportName('LTFM')?.source).toBe('operator')
    expect(airportName('toString')).toBeUndefined()
    expect(airportName('__proto__')).toBeUndefined()
    expect(airportNameSource('LTAC')).toBe('dhmi')
    // Askerî üs tabloda yoktur (D-107); listelenmediği için bu kaynak hiçbir sayfada yazılmaz.
    expect(airportNameSource('LTBI')).toBe('ourairports')
    expect(airportNameSource('LTAD')).toBe('ministry')
    expect(airportNameSource('ZZZZ')).toBe('ourairports')
  })
})

describe('runwaySurfaceKey', () => {
  it("fixture'daki her dolu kaplama kodu bilinen bir türe çevrilir (OurAirports'un UNK kodu hariç)", () => {
    const surfaces = new Set(runwayRows.map((r) => r.get('surface') ?? ''))
    // OurAirports düzenleyicisinin silme işareti kaplama değildir; satırı sunucu gizler (Hamilton
    // NZHN'nin "Delete duplicate" ve "Delete" satırları; `@havayolu/db` `RUNWAY_TOMBSTONE_SURFACE`,
    // D-109).
    const tombstones = [...surfaces].filter((surface) => /^\s*delete/i.test(surface)).sort()
    expect(tombstones).toEqual(['Delete', 'Delete duplicate'])
    for (const surface of surfaces) {
      // UNK sözlükte "bilinmiyor"dur (aşağıda).
      if (surface.trim() === '' || surface === 'UNK' || tombstones.includes(surface)) continue
      expect(runwaySurfaceKey(surface), surface).not.toBe('unknown')
    }
    const unk = runwayRows
      .filter((r) => r.get('surface') === 'UNK')
      .map((r) => `${r.get('id')} ${r.get('airport_ident')}`)
    // Gösterilmeyen yinelenen boş satırlar: Taba 04/22, Cluj 08/26 (D-088); Hassi Messaoud 01/19,
    // Bujumbura 02/20, Beauvais 13R/31L ve 2 ft'lik Pamplona 03/21 (D-101); 5. halkada Kolombiya'nın
    // beşi, Kushiro (RJNO), Yeni Zelanda'nın dördü ve Chiayi (RCKU) (D-109); Simferopol'ün uzunluksuz
    // 01/19'u (UKFF, 01L/19R'nin yinelemesi; D-110). Gösterilen ama kaplaması
    // bilinmeyen pistler: 4. halkada Kulusuk, Malindi'nin ikisi, Moğolistan'ın dördü, Nyingchi; 5.
    // halkada Riberalta, Puerto Jiménez, Narsarsuaq, Paramaribo Zorg en Hoop, Huambo ve
    // Paraparaumu.
    expect(unk.sort()).toEqual([
      ...['259639 SLRI', '259670 ZUNZ', '259687 MRPJ', '260073 BGAA', '260075 BGKK'],
      ...['260115 HKML', '260116 HKML', '260134 ZMAT', '260135 ZMAH', '260137 ZMBN'],
      ...['260141 ZMUL', '260274 SURV', '260303 FNHU', '260310 HBBA', '260326 SKBS'],
      ...['260329 SKMZ', '260332 SKAS', '260333 SKRH', '260334 SKSV', '260338 DAUH'],
      ...['260339 HETB', '260341 LEPP', '260344 LFOB', '260378 RJNO', '260388 NZGS'],
      ...['260391 NZKK', '260395 NZPM', '260398 NZRO', '260402 NZWK', '260408 LRCL'],
      ...['260411 RCKU', '260413 UKFF'],
    ])
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
    for (const code of ['ASPH-CONC', 'CONC-ASPH', 'CONC/ASPH', 'asph/conc']) {
      expect(runwaySurfaceKey(code), code).toBe('mixed')
    }
    expect(runwaySurfaceKey('GRS Emergency Strip')).toBe('grass')
    expect(runwaySurfaceKey('PER')).toBe('paved')
    expect(runwaySurfaceKey('GRASS')).toBe('grass')
    expect(runwaySurfaceKey('TURF')).toBe('grass')
    expect(runwaySurfaceKey('Ground')).toBe('dirt')
    expect(runwaySurfaceKey('GRE')).toBe('gravel')
    expect(runwaySurfaceKey('WATER')).toBe('water')
    // 4. halkanın kodları (D-101).
    for (const code of ['BIT', 'BITUM', 'Macadam', 'MAC']) {
      expect(runwaySurfaceKey(code), code).toBe('asphalt')
    }
    for (const code of ['Hard', 'hard', 'paved']) expect(runwaySurfaceKey(code), code).toBe('paved')
    for (const code of ['COM', 'Composite']) expect(runwaySurfaceKey(code), code).toBe('mixed')
    for (const code of ['Graded Hardcore', 'LAT']) {
      expect(runwaySurfaceKey(code), code).toBe('gravel')
    }
    expect(runwaySurfaceKey('Unpaved')).toBe('dirt')
    for (const code of ['SAN', 'Sand', 'sand']) expect(runwaySurfaceKey(code), code).toBe('sand')
    for (const code of ['', '  ', 'UNK', 'MOON', 'constructor', null, undefined]) {
      expect(runwaySurfaceKey(code), String(code)).toBe('unknown')
    }
  })

  it('5. halkanın kodları ve FAA durum eki (D-109)', () => {
    // FAA'nın durum eki (-E mükemmel, -G iyi, -F orta, -P kötü) atılıp yeniden aranır.
    const suffixed = {
      'ASPH-G': 'asphalt',
      'ASPH-F': 'asphalt',
      'CONC-G': 'concrete',
      'CONC-E': 'concrete',
      'CONC-F': 'concrete',
      'GRAVEL-P': 'gravel',
      'GRAVEL-G': 'gravel',
      'GRVL-G': 'gravel',
      'GRVL-DIRT-G': 'gravel',
      'GRVL-DIRT-F': 'gravel',
      'WATER-E': 'water',
      ' asph-g ': 'asphalt',
    } as const
    for (const [code, key] of Object.entries(suffixed))
      expect(runwaySurfaceKey(code), code).toBe(key)
    // Ek tek harf ve tanınan bir koda dönmüyorsa kod tanınmaz; ek atılmadan tanınan kod değişmez.
    for (const code of ['MOON-G', 'ASPH-X', 'ASPH-GG', 'UNK-G', '-G']) {
      expect(runwaySurfaceKey(code), code).toBe('unknown')
    }
    expect(runwaySurfaceKey('ASPH-CONC')).toBe('mixed')
    const table = {
      'Grassed black clay': 'grass',
      GRVL: 'gravel',
      'SAND/GRAVEL': 'gravel',
      'CRUSHED ROCK': 'gravel',
      'TREATED GRAVEL': 'gravel',
      'GRVL-DIRT': 'gravel',
      'ASP/CONC': 'mixed',
      COP: 'mixed',
      'Concrete-Grooved': 'concrete',
      'concrete/grooved': 'concrete',
      Cement: 'concrete',
      CEM: 'concrete',
      'asphalt concrete': 'asphalt',
      'ASPH 71/F/C/X/T': 'asphalt',
      CLA: 'dirt',
    } as const
    expect(Object.keys(table)).toHaveLength(15)
    for (const [code, key] of Object.entries(table)) expect(runwaySurfaceKey(code), code).toBe(key)
    // Silme işareti kaplama değildir (satırı sunucu gizler).
    for (const code of ['DELETE', 'Delete duplicate']) {
      expect(runwaySurfaceKey(code), code).toBe('unknown')
    }
  })

  it('her anahtar RUNWAY_SURFACE_KEYS içindedir', () => {
    const inputs = ['ASP', 'CON', 'PEM', 'PER', 'GRS', 'DIRT', 'GVL', 'SAND', 'WATER', 'x']
    for (const input of inputs) {
      expect(RUNWAY_SURFACE_KEYS).toContain(runwaySurfaceKey(input))
    }
  })
})
